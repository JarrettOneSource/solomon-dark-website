import assert from 'node:assert/strict'
import test from 'node:test'
import { getEventListeners } from 'node:events'
import { RunPerformanceSampler, attachRunPerformanceCapture } from './run-performance.ts'
import { createGameClientDiagnostics, type BrowserGameDiagnosticReport } from './game-diagnostics.ts'
import { startGamePresentationLoop } from '../game-presentation-frame-loop.ts'
import { createGameSimulation, enterBoneyardWorld } from '../core-server/game-simulation.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../host/boneyard-catalog.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { createGameClientSnapshot } from '../protocol/primary-spell-hail-replication.ts'
import type { GameTransport } from './game-transport.ts'
import type { GameClientSnapshot, GameplayPauseState, GameplayResumeGraceState } from '../protocol/game-protocol.ts'

test('run samples separate frame stalls, snapshot gaps, ping and hidden windows', () => {
  const sampler = new RunPerformanceSampler(0)
  const context = { serverTick: 42, pingMs: 250, hidden: false, paused: false }
  for (const now of [0, 80, 96, 112, 128]) sampler.frame(now, false)
  for (const now of [0, 50, 300]) sampler.snapshot(now)
  sampler.message(1234)
  assert.deepEqual(sampler.sample(315, context), {
    ...context, durationMs: 315, frames: 4, slowFrames: 1,
    maximumFrameMs: 80, frameP95Ms: 80, frameP99Ms: 80,
    snapshots: 3, maximumSnapshotGapMs: 250, messageCharacters: 1234,
  })
  const stalled = sampler.sample(1000, context)
  assert.equal(stalled.maximumSnapshotGapMs, 700)
  assert.equal(stalled.durationMs, 685)
  sampler.frame(1100, true)
  sampler.visibilityChanged()
  sampler.frame(1200, false)
  sampler.frame(1216, false)
  const visible = sampler.sample(2000, { ...context, pingMs: null })
  assert.equal(visible.maximumFrameMs, 16)
  assert.equal(visible.messageCharacters, 0)
  assert.equal(visible.maximumSnapshotGapMs, 0)
  assert.equal(visible.hidden, true, 'a window spanning background time must be marked hidden')
  assert.equal(visible.durationMs, 1000)
  const empty = sampler.sample(3000, context)
  assert.equal(empty.frames, 0)
  assert.equal(empty.frameP95Ms, 0)
  assert.equal(empty.hidden, false)
})

test('automatic capture uploads each run with its own id and cleans up on transport close', async context => {
  let clock = 0
  let hidden = false
  let rejectUpload = false
  let pause: GameplayPauseState | null = null
  let grace: GameplayResumeGraceState | null = null
  const animationFrames: FrameRequestCallback[] = []
  let stopRendering = () => {}
  context.after(() => stopRendering())
  const intervals = new Map<number, () => void>()
  const browser = Object.assign(new EventTarget(), {
    innerWidth: 844, innerHeight: 390, devicePixelRatio: 2,
    location: { origin: 'https://example.com', pathname: '/game', search: '?private=value' },
    requestAnimationFrame(callback: FrameRequestCallback) { animationFrames.push(callback); return 1 },
    cancelAnimationFrame() { animationFrames.length = 0 },
    setInterval(callback: () => void) { intervals.set(1, callback); return 1 },
  })
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  Object.defineProperty(document, 'hidden', { get: () => hidden })
  const reports: BrowserGameDiagnosticReport[] = []
  const globals = {
    window: browser, document, location: browser.location,
    navigator: { userAgent: 'Test Browser', onLine: true },
    performance: { now: () => clock },
    clearInterval: (id: number) => intervals.delete(id),
    fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, '/api/game/run-performance')
      assert.equal(init.keepalive, true)
      reports.push(JSON.parse(String(init.body)))
      if (rejectUpload) return Response.json({ error: 'Storage unavailable.' }, { status: 503 })
      return Response.json({ logId: crypto.randomUUID(), submittedAtUtc: new Date().toISOString() })
    },
  }
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, value })
    context.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous)
      else Reflect.deleteProperty(globalThis, key)
    })
  }
  const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))!
  const hub = createGameSimulation({
    hero: { displayName: 'Hero', discipline: 'body', element: 'ether' },
    ally: { displayName: 'Ally', discipline: 'mind', element: 'water' },
  })
  const state = enterBoneyardWorld(hub, loaded)
  const playerId = state.playerEntities.identities[0]!.playerId
  let snapshot = createGameClientSnapshot(createGameSnapshot(hub, playerId))
  const snapshots = new Set<(value: GameClientSnapshot) => void>()
  const closes = new Set<Parameters<GameTransport['onClose']>[0]>()
  const messages = new Set<(payload: string) => void>()
  const transport: GameTransport = {
    readyState: 'open', close() {}, send() {},
    onClose(callback) { closes.add(callback); return () => { closes.delete(callback) } },
    onMessage(callback) { messages.add(callback); return () => { messages.delete(callback) } },
  }
  const diagnostics = createGameClientDiagnostics({ writeToConsole: false })
  diagnostics.info('chat.example', 'Unrelated transcript must not be uploaded.')
  const session = {
    playerId, getSnapshot: () => snapshot, getPingMs: () => 42,
    getGameplayPause: () => pause, getGameplayResumeGrace: () => grace,
    onSnapshot(callback: (value: GameClientSnapshot) => void) {
      snapshots.add(callback); return () => { snapshots.delete(callback) }
    },
  }
  attachRunPerformanceCapture(session, transport, diagnostics)
  stopRendering = startGamePresentationLoop(() => {})
  for (const callback of intervals.values()) callback()
  for (const callback of messages) callback('Ignored Hub message')
  animationFrames.shift()?.(0)
  assert.equal(reports.length, 0)
  snapshot = createGameClientSnapshot(createGameSnapshot(state, playerId))
  for (const callback of snapshots) callback(snapshot)
  for (const now of [20, 100, 120, 140]) {
    clock = now
    const callback = animationFrames.shift()
    if (callback) callback(now)
    if (now === 100) for (const callback of snapshots) callback(snapshot)
    assert.equal(reports.length, 0, 'ordinary snapshots must not split a run report')
  }
  for (const callback of messages) callback('12345')
  for (const callback of intervals.values()) callback()
  pause = { ownerDisplayName: 'Owner', ownerPlayerId: playerId, source: 'pause-menu' }
  clock += 1000
  for (const callback of intervals.values()) callback()
  pause = null
  grace = { reason: 'pause-menu-closed', remainingMs: 1000, sequence: 1 }
  clock += 1000
  for (const callback of intervals.values()) callback()
  grace = null
  clock += 1000
  for (const callback of intervals.values()) callback()
  snapshot = { ...snapshot, run: { ...snapshot.run, phase: 'game-over' } }
  for (const callback of snapshots) callback(snapshot)
  assert.equal(reports.length, 1)
  assert.equal(reports[0]?.performance?.samples[0]?.maximumFrameMs, 80)
  assert.equal(reports[0]?.performance?.samples[0]?.messageCharacters, 5)
  assert.equal(reports[0]?.performance?.samples[0]?.pingMs, 42)
  assert.equal(reports[0]?.performance?.samples[0]?.snapshots, 2)
  assert.equal(reports[0]?.performance?.samples[0]?.maximumSnapshotGapMs, 100)
  assert.deepEqual(reports[0]?.performance?.samples.slice(0, 4).map(sample => sample.paused), [false, true, true, false])
  assert.equal(reports[0]?.entries.length, 1)
  assert.ok(reports[0]!.entries.every(entry => entry.event.length > 0 && entry.message.length > 0))
  assert.equal(reports[0]?.pageUrl, 'https://example.com/game')
  assert.equal(JSON.stringify(reports[0]).includes('Unrelated transcript'), false)
  snapshot = createGameClientSnapshot(createGameSnapshot(state, playerId))
  for (const callback of snapshots) callback(snapshot)
  snapshot = createGameClientSnapshot(createGameSnapshot(hub, playerId))
  for (const callback of snapshots) callback(snapshot)
  assert.equal(reports[1]?.performance?.endReason, 'world-ended')
  const cachedPage = new Event('pagehide')
  Object.defineProperty(cachedPage, 'persisted', { value: true })
  browser.dispatchEvent(cachedPage)
  assert.equal(reports.length, 2)
  snapshot = createGameClientSnapshot(createGameSnapshot(state, playerId))
  for (const callback of snapshots) callback(snapshot)
  hidden = true
  document.dispatchEvent(new Event('visibilitychange'))
  hidden = false
  document.dispatchEvent(new Event('visibilitychange'))
  browser.dispatchEvent(cachedPage)
  assert.equal(reports[2]?.performance?.endReason, 'page-hidden')
  assert.equal(reports[2]?.performance?.samples[0]?.hidden, true)
  assert.equal(reports[2]?.performance?.samples[0]?.maximumSnapshotGapMs, 0)
  for (const callback of snapshots) callback(snapshot)
  hidden = true
  document.dispatchEvent(new Event('visibilitychange'))
  for (let index = 0; index < 62; index += 1) {
    clock += 1_000
    for (const callback of intervals.values()) callback()
  }
  const queuedClose = [...closes][0]!
  for (const callback of closes) callback({ code: 1000, reason: '', wasClean: true })
  queuedClose({ code: 1000, reason: '', wasClean: true })
  browser.dispatchEvent(new Event('pagehide'))
  assert.equal(reports.length, 4)
  assert.notEqual(reports[0]?.clientLogId, reports[1]?.clientLogId)
  assert.equal(reports[3]?.performance?.samples.length, 60)
  assert.equal(reports[3]?.performance?.endReason, 'connection-closed')
  assert.equal(snapshots.size + messages.size + closes.size + intervals.size, 0)
  assert.equal(getEventListeners(browser, 'pagehide').length, 0)
  assert.equal(getEventListeners(document, 'visibilitychange').length, 0)
  rejectUpload = true
  attachRunPerformanceCapture(session, { ...transport }, diagnostics)
  browser.dispatchEvent(new Event('pagehide'))
  assert.equal(reports[4]?.performance?.endReason, 'page-hidden')
  assert.equal(snapshots.size + messages.size + closes.size + intervals.size, 0)
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.ok(diagnostics.createReport(null).entries.some(entry => (
    entry.event === 'run.performance_upload_failed' && entry.detail === 'Storage unavailable.'
  )))
  assert.ok(diagnostics.createReport(null).entries.every(entry => entry.message.length > 0))
  rejectUpload = false
  attachRunPerformanceCapture(session, { ...transport }, diagnostics)
  snapshot = { ...snapshot, tick: snapshot.tick + 1, players: {
    ...snapshot.players,
    [playerId]: { ...snapshot.players[playerId]!, progression: {
      ...snapshot.players[playerId]!.progression, lifeState: 'dying', currentHealth: 0,
    } },
  } }
  for (const callback of snapshots) callback(snapshot)
  assert.equal(reports[5]?.performance?.endReason, 'player-died')
  for (const callback of snapshots) callback(snapshot)
  assert.equal(reports.length, 6, 'spectating must not repeatedly submit the same death')
  snapshot = createGameClientSnapshot(createGameSnapshot(state, playerId))
  for (const callback of snapshots) callback(snapshot)
  for (const callback of closes) callback({ code: 1000, reason: '', wasClean: true })
  assert.equal(reports[6]?.performance?.endReason, 'connection-closed')
  assert.equal(getEventListeners(browser, 'pagehide').length, 0)
  await new Promise<void>(resolve => setImmediate(resolve))
})

test('frame percentiles distinguish frequent and rare stalls within a bounded sample window', () => {
  const sampler = new RunPerformanceSampler(0)
  const context = { serverTick: 1, pingMs: null, hidden: false, paused: false }
  let clock = 0
  sampler.frame(clock, false)
  for (let index = 0; index < 100; index += 1) {
    clock += index < 2 ? 80 : index === 2 ? 34 : 16
    sampler.frame(clock, false)
  }
  const sample = sampler.sample(clock, context)
  assert.equal(sample.frameP95Ms, 16)
  assert.equal(sample.frameP99Ms, 80)
  assert.equal(sample.slowFrames, 2)
  for (let index = 0; index < 1002; index += 1) {
    clock += 10
    sampler.frame(clock, false)
  }
  assert.equal(sampler.sample(clock, context).frames, 1000)
})
