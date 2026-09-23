import assert from 'node:assert/strict'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

import { enterBoneyard, enterElementHub } from './game-smoke-navigation.mjs'
import { createSlowWindowsCpuProfile } from './party-soak-cpu-profile.mjs'
import { createDiagnosticCheckpointWriter } from './party-soak-evidence.mjs'
import { SOAK_ELEMENTS, SOAK_MUTATION } from './party-soak-settings.mjs'

const output = resolve(required('SDR_SOAK_OUTPUT'))
const baseUrl = process.env.SDR_SOAK_URL || 'http://127.0.0.1:4191'
const targetWave = positive('SDR_SOAK_WAVE', 100)
const maximumMs = positive('SDR_SOAK_MAX_MS', 12 * 60 * 60 * 1000)
const sampleMs = positive('SDR_SOAK_SAMPLE_MS', 5000)
const stallMs = positive('SDR_SOAK_STALL_MS', 20 * 60 * 1000)
const profileSlowWindows = process.env.SDR_SOAK_PROFILE_SLOW_WINDOWS === '1'
const profileThresholdFps = positive('SDR_SOAK_PROFILE_MIN_FPS', 90)
const localPeer = process.env.SDR_SOAK_LOCAL_PEER === '1'
const headless = process.env.SDR_SOAK_HEADLESS === '1'
const maximumActiveGap = process.env.SDR_SOAK_MAX_SNAPSHOT_GAP_MS
  ? positive('SDR_SOAK_MAX_SNAPSHOT_GAP_MS') : null
const pilotModId = 'local.performance.party-soak'
const runtime = JSON.parse(await readFile(process.env.SDR_SOAK_RUNTIME_FILE || join(output, 'runtime.json'), 'utf8'))
await mkdir(output, { recursive: true })
const events = createWriteStream(join(output, 'client-events.jsonl'), { flags: 'wx' })
const streams = []
const clients = []
const ownedBrowsers = new Map()
const startedAt = Date.now()
let completed = false
let closing = false
let failure = null
let samples = 0
let highestWave = 0
let waveChangedAt = Date.now()
let lastScreenshotWave = 0
let errorCount = 0
let expectedRun = null
let expectedParty = null
let stopSignal = null
let profilingFailure = null
process.once('SIGINT', () => { stopSignal = 'SIGINT' })
process.once('SIGTERM', () => { stopSignal = 'SIGTERM' })
event('monitor.started', { pid: process.pid, targetWave, maximumMs, sampleMs, stallMs, profileSlowWindows, profileThresholdFps, localPeer, headless })

try {
  const launchOptions = {
    executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless, handleSIGINT: false, handleSIGTERM: false,
    args: ['--autoplay-policy=no-user-gesture-required'],
  }
  const mac = await launchOwnedBrowser(launchOptions)
  clients.push(await createClient(mac, 'mac', process.env.SDR_SOAK_MAC_ELEMENT || SOAK_ELEMENTS.mac))
  const peer = localPeer ? await launchOwnedBrowser(launchOptions)
    : await chromium.connectOverCDP(process.env.SDR_SOAK_WINDOWS_CDP || 'http://127.0.0.1:9431')
  clients.push(await createClient(peer, localPeer ? 'mac-peer' : 'windows',
    process.env.SDR_SOAK_PEER_ELEMENT || process.env.SDR_SOAK_WINDOWS_ELEMENT || SOAK_ELEMENTS.windows))
  await Promise.all(clients.map(async client => {
    await client.page.bringToFront()
    await enterElementHub(client.page, baseUrl, client.element)
    await client.page.waitForFunction(() => window.__sdrSoak?.playerId && window.__sdrSoak?.party)
    client.playerId = await client.page.evaluate(() => window.__sdrSoak.playerId)
    await client.page.screenshot({ path: join(output, `${client.name}-hub.png`) })
  }))

  // Shared-bootstrap private Colleges already admit guests into their owner's
  // party. Otherwise use the ordinary invitation and the guest's Accept UI.
  const initialParties = await Promise.all(clients.map(client => client.page.evaluate(() => window.__sdrSoak.party)))
  if (initialParties[0].id !== initialParties[1].id) {
    await clients[0].page.evaluate(targetPlayerId => {
      window.__sdrSoak.socket.send(JSON.stringify({ type: 'client-party-invite', targetPlayerId }))
    }, clients[1].playerId)
    const invitation = clients[1].page.locator('[data-party-invitation]')
    await invitation.waitFor({ timeout: 30000 })
    await invitation.getByRole('button', { name: /^accept$/i }).click()
  }
  await Promise.all(clients.map(client => client.page.waitForFunction(() => (
    window.__sdrSoak?.party?.memberPlayerIds.length === 2
  ), undefined, { timeout: 30000 })))
  const parties = await Promise.all(clients.map(client => client.page.evaluate(() => window.__sdrSoak.party)))
  assert.equal(parties[0].id, parties[1].id, 'both browsers must join the same authoritative party')
  expectedParty = parties[0].id
  event('party.joined', { partyId: expectedParty, players: clients.map(c => ({ name: c.name, id: c.playerId })) })
  const leader = clients.find(client => client.playerId === parties[0].leaderPlayerId)
  assert.ok(leader, 'the authoritative party leader must be one of the monitored clients')
  await enterBoneyard(leader.page)
  await Promise.all(clients.map(async client => {
    await client.page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90000 })
    await client.page.waitForFunction(() => (
      document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.playerCount === 2
    ), undefined, { timeout: 30000 })
    await client.page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 30000 })
    await client.page.screenshot({ path: join(output, `${client.name}-entry.png`) })
    client.previousMetrics = metricMap(await client.cdp.send('Performance.getMetrics'))
    client.previousTick = null
    client.network = networkWindow()
    client.activeSnapshotAt = null
  }))
  event('boneyard.entered', { elapsedSeconds: (Date.now() - startedAt) / 1000 })

  while (Date.now() - startedAt < maximumMs) {
    if (stopSignal !== null) break
    const rows = await Promise.all(clients.map(sampleClient))
    samples += 1
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const client = clients[index]
      client.stream.write(JSON.stringify(row) + '\n')
      updateSummary(client.summary, row)
      assert.ok(row.runId, `${client.name} Boneyard renderer disappeared`)
      assert.equal(row.hidden, false, `${client.name} browser became hidden`)
      assert.equal(row.lifeState, 'alive', `${client.name} pilot died`)
      assert.equal(row.playerCount, 2, `${client.name} lost a party participant`)
      assert.equal(row.partyId, expectedParty, `${client.name} changed party`)
      expectedRun ??= row.runId
      assert.equal(row.runId, expectedRun, `${client.name} changed authoritative run`)
      assert.ok(row.snapshots > 0, `${client.name} stopped receiving snapshots`)
      assert.ok(row.renderedFrames > 0, `${client.name} stopped rendering`)
      if (maximumActiveGap !== null) assert.ok(row.maximumActiveSnapshotGapMs < maximumActiveGap,
        `${client.name} active snapshot gap ${row.maximumActiveSnapshotGapMs.toFixed(1)} ms exceeds ${maximumActiveGap} ms`)
      assert.ok(!client.reducerHealth.some(health => (
        health.modId === pilotModId && health.key === 'pilot' && health.disabled
      )), `${client.name} native pilot reducer circuit opened`)
      client.previousTick = row.tick
      client.profiler?.observe(row)
    }
    assert.equal(profilingFailure, null, 'CPU diagnostic failed; inspect client-events.jsonl')
    console.log(JSON.stringify({ event: 'sample', rows }))
    assert.equal(errorCount, 0, 'Client errors were recorded; inspect client-events.jsonl')
    const minimumWave = Math.min(...rows.map(row => row.wave))
    if (minimumWave > highestWave) {
      highestWave = minimumWave
      waveChangedAt = Date.now()
    }
    assert.ok(Date.now() - waveChangedAt < stallMs, `No wave progression for ${stallMs / 60000} minutes`)
    if (minimumWave >= lastScreenshotWave + 10 || minimumWave > targetWave) {
      for (const client of clients) { client.captureActive = true; client.activeSnapshotAt = null }
      try {
        await Promise.all(clients.map(c => c.page.screenshot({ path: join(output, `${c.name}-wave-${minimumWave}.png`) })))
      } finally {
        for (const client of clients) { client.captureActive = false; client.activeSnapshotAt = null }
      }
      lastScreenshotWave = minimumWave
    }
    if (minimumWave > targetWave) { completed = true; break }
  }
  if (stopSignal === null) {
    assert.equal(completed, true, `Both clients must finish wave ${targetWave}, entering wave ${targetWave + 1}`)
    assert.equal(errorCount, 0, 'Browser, network, or rendering errors occurred; inspect client-events.jsonl')
  } else event('monitor.stopped', { signal: stopSignal, highestWave })
} catch (error) {
  failure = String(error.stack || error)
  event('monitor.failed', { message: clean(failure) })
  await Promise.all(clients.map(c => c.page.screenshot({ path: join(output, `${c.name}-failure.png`) }).catch(() => {})))
  process.exitCode = 1
} finally {
  closing = true
  await Promise.all(clients.map(async client => {
    try { await client.profiler?.close() }
    catch {
      failure ??= `${client.name} CPU diagnostic failed; inspect client-events.jsonl`
      process.exitCode = 1
    }
    try { await client.checkpoints.flush() }
    catch {
      failure ??= `${client.name} diagnostic checkpoint write failed; inspect client-events.jsonl`
      process.exitCode = 1
    }
  }))
  await Promise.all(clients.map(async client => {
    await client.cdp.detach().catch(() => {})
    await client.context.close().catch(() => {})
    event('monitor.context_closed', { client: client.name })
    const owned = ownedBrowsers.get(client.browser)
    if (owned) {
      try {
        await withDeadline(owned.close(), 15000, `${client.name} browser did not exit`)
      } catch {
        event('monitor.browser_force_closed', { client: client.name, pid: owned.process().pid })
        await owned.kill()
      }
    } else await client.browser.close()
    event('monitor.browser_closed', { client: client.name })
  }))
  for (const [browser, server] of ownedBrowsers) {
    if (!clients.some(client => client.browser === browser)) await server.kill()
  }
  await writeFile(join(output, 'result.json'), JSON.stringify({
    completed, passed: completed && failure === null && errorCount === 0 && stopSignal === null,
    stopSignal, targetWave, highestWave, samples, runId: expectedRun, partyId: expectedParty, localPeer, headless, maximumActiveGap,
    startedAtUtc: new Date(startedAt).toISOString(), finishedAtUtc: new Date().toISOString(),
    errorCount, failure: failure && clean(failure),
    viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1,
    clients: clients.map(({ name, element, playerId, summary, reducerHealth, checkpoints, profiler }) => ({
      name, element, playerId, reducerHealth, diagnosticCheckpoint: checkpoints.status(),
      cpuDiagnostic: profiler?.status() ?? null, ...summary,
    })),
    mutation: SOAK_MUTATION,
  }, null, 2))
  await Promise.all([events, ...streams].map(stream => new Promise(done => stream.end(done))))
}

async function createClient(browser, name, element) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.setDefaultTimeout(90000)
  const stream = createWriteStream(join(output, `${name}.jsonl`), { flags: 'wx' })
  streams.push(stream)
  const client = { browser, context, page, name, element, stream,
    network: networkWindow(), summary: { samples: 0 }, previousMetrics: null, previousTick: null,
    activeSnapshotAt: null, paused: false, resumeGrace: false, captureActive: false,
    reducerHealth: [], checkpointSequence: null, errorCount: 0 }
  const problem = (kind, details) => {
    if (closing) return
    errorCount += 1
    client.errorCount += 1
    event(kind, { client: name, ...details })
  }
  client.checkpoints = createDiagnosticCheckpointWriter(
    join(output, `diagnostic-${name}-latest-owner-save.json`), error => {
      problem('checkpoint.write_failed', { code: error.code ?? error.name ?? 'Error' })
    },
  )
  page.on('pageerror', error => problem('page.error', { message: clean(error.message) }))
  page.on('crash', () => problem('page.crashed', {}))
  page.on('console', message => {
    if (message.type() === 'error') problem('console.error', { message: clean(message.text()) })
  })
  page.on('response', response => {
    if (response.status() >= 400) problem('http.error', { status: response.status(), path: pathname(response.url()) })
  })
  page.on('requestfailed', request => problem('request.failed', {
    path: pathname(request.url()), message: clean(request.failure()?.errorText),
  }))
  page.on('websocket', socket => {
    socket.on('framereceived', ({ payload }) => {
      if (closing) return
      const bytes = typeof payload === 'string' ? Buffer.byteLength(payload) : payload.length
      client.network.bytes += bytes
      const prefix = typeof payload === 'string' ? payload.slice(0, 100) : payload.subarray(0, 100).toString()
      if (prefix.includes('"type":"server-gameplay-pause"') || prefix.includes('"type":"server-gameplay-resume-grace"')) {
        const message = JSON.parse(typeof payload === 'string' ? payload : payload.toString())
        if (message.type === 'server-gameplay-pause') client.paused = message.pause !== null
        else client.resumeGrace = message.grace !== null
        client.activeSnapshotAt = null
      }
      if (prefix.includes('"type":"server-save-checkpoint"')) {
        try {
          const message = JSON.parse(typeof payload === 'string' ? payload : payload.toString())
          const save = JSON.parse(message.save)
          const health = checkpointReducerHealth(save)
          const disabled = health.find(row => row.modId === pilotModId && row.key === 'pilot' && row.disabled)
          if (disabled && !client.reducerHealth.some(row => row.modId === pilotModId && row.key === 'pilot' && row.disabled)) {
            problem('pilot.disabled', { ...disabled, checkpointSequence: message.sequence,
              nativeReason: 'reducer-circuit-open', source: 'server-save-checkpoint' })
          }
          client.reducerHealth = health
          client.checkpointSequence = message.sequence
          client.checkpoints.push(message.sequence, save)
        } catch (error) { problem('checkpoint.invalid', { code: error.name ?? 'Error' }) }
      }
      if (!prefix.includes('"type":"server-snapshot"')) return
      const now = performance.now()
      if (client.network.lastAt !== null) client.network.gaps.push(now - client.network.lastAt)
      if (!client.paused && !client.resumeGrace && !client.captureActive) {
        if (client.activeSnapshotAt !== null) client.network.activeGaps.push(now - client.activeSnapshotAt)
        client.activeSnapshotAt = now
      } else {
        client.network.excludedSnapshots += 1
        client.activeSnapshotAt = null
      }
      client.network.lastAt = now
      client.network.snapshots += 1
    })
    socket.on('socketerror', error => problem('socket.error', { message: clean(error) }))
    socket.on('close', () => problem('socket.closed', {}))
  })
  await page.addInitScript(runtimeValue => {
    window.solomonDarkRuntime = runtimeValue
    localStorage.setItem('solomon-dark-game-settings-v1', JSON.stringify({
      enableActivityMessages: false, enableGlobalChat: false,
    }))
    const NativeSocket = window.WebSocket
    const probe = { socket: null, playerId: null, party: null }
    window.__sdrSoak = probe
    window.WebSocket = class extends NativeSocket {
      constructor(...args) {
        super(...args)
        this.addEventListener('message', event => {
          if (typeof event.data !== 'string') return
          const prefix = event.data.slice(0, 100)
          if (!prefix.includes('"type":"server-welcome"') && !prefix.includes('"type":"server-party-state"')) return
          const message = JSON.parse(event.data)
          if (message.type === 'server-welcome') { probe.socket = this; probe.playerId = message.playerId }
          if (message.type === 'server-party-state') probe.party = message.state.party
        })
      }
    }
  }, runtime)
  const browserCdp = await browser.newBrowserCDPSession()
  const system = await browserCdp.send('SystemInfo.getInfo')
  await writeFile(join(output, `${name}-hardware.json`), JSON.stringify({
    browser: browser.version(), devices: system.gpu.devices, featureStatus: system.gpu.featureStatus,
  }, null, 2))
  await browserCdp.detach()
  client.cdp = await context.newCDPSession(page)
  await client.cdp.send('Performance.enable')
  const window = await client.cdp.send('Browser.getWindowForTarget')
  client.windowId = window.windowId
  if (name === 'windows' && profileSlowWindows) {
    client.profiler = createSlowWindowsCpuProfile({
      cdp: client.cdp, path: join(output, 'windows-low-fps.cpuprofile'), event,
      thresholdFps: profileThresholdFps,
      onError: error => {
        profilingFailure ??= error.code ?? error.name ?? 'Error'
        problem('profiling.failed', { code: profilingFailure })
      },
    })
  }
  return client
}

async function launchOwnedBrowser(options) {
  const server = await chromium.launchServer({ ...options, host: '127.0.0.1' })
  try {
    const browser = await chromium.connect(server.wsEndpoint())
    ownedBrowsers.set(browser, server)
    return browser
  } catch (error) {
    await server.kill()
    throw error
  }
}

async function sampleClient(client) {
  const sampleStartedAt = Date.now()
  const sampled = await withDeadline(client.page.evaluate(duration => new Promise(resolveSample => {
    const presentation = window.__sdrGamePresentation
    if (!presentation) throw new Error('Presentation diagnostics unavailable')
    const readFrame = () => document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    const initialFrameCount = readFrame()?.frameCount ?? 0
    const started = performance.now()
    const gaps = []
    const longTasks = []
    let previous = null
    let hidden = document.hidden
    const unsubscribe = presentation.subscribe(now => {
      hidden ||= document.hidden
      if (previous !== null) gaps.push(now - previous)
      previous = now
    })
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration)
    })
    observer.observe({ entryTypes: ['longtask'] })
    setTimeout(() => {
      unsubscribe()
      observer.disconnect()
      const frame = readFrame()
      const scene = document.querySelector('.boneyard-scene')
      const durationMs = performance.now() - started
      resolveSample({
        durationMs, gaps, longTasks, hidden, documentHasFocus: document.hasFocus(),
        renderedFrames: (frame?.frameCount ?? initialFrameCount) - initialFrameCount,
        runId: frame?.runId ?? null, tick: frame?.tick ?? null,
        playerCount: frame?.playerCount ?? null, lifeState: frame?.localPlayerLifeState ?? null,
        health: frame?.localPlayerHealth ?? null, mana: frame?.localPlayerMana ?? null,
        enemyCount: frame?.enemyCount ?? null, enemyProjectileCount: frame?.enemyProjectileCount ?? null,
        primarySpellCount: frame?.primarySpellCount ?? null, secondaryAbilityCount: frame?.secondaryAbilityCount ?? null,
        residentCount: frame?.residentCount ?? null, visibleResidentCount: frame?.visibleResidentCount ?? null,
        complexShadowQuadCount: frame?.complexShadowQuadCount ?? null,
        playerX: frame?.playerX ?? null, playerY: frame?.playerY ?? null,
        wave: Number(scene?.dataset.waveOrdinal ?? 0), wavePhase: scene?.dataset.wavePhase ?? null,
        solomonPhase: scene?.dataset.solomonPhase ?? null,
        combatEnabled: scene?.dataset.combatEnabled ?? null,
        presentationPaused: scene?.dataset.presentationPaused ?? null,
        partyId: window.__sdrSoak?.party?.id ?? null,
        dialogs: [...document.querySelectorAll('[role="dialog"]')].map(node => node.getAttribute('aria-label')),
      })
    }, duration)
  }), sampleMs), sampleMs + 30000, `${client.name} browser did not answer the performance sample`)
  const [metrics, window] = await Promise.all([
    client.cdp.send('Performance.getMetrics'),
    client.cdp.send('Browser.getWindowBounds', { windowId: client.windowId }),
  ])
  const after = metricMap(metrics)
  const seconds = after.Timestamp - client.previousMetrics.Timestamp
  const network = client.network
  client.network = networkWindow(network.lastAt)
  const { gaps, longTasks, ...state } = sampled
  const row = {
    client: client.name, atUtc: new Date().toISOString(), elapsedSeconds: (Date.now() - startedAt) / 1000,
    ...state, windowState: window.bounds.windowState,
    renderFps: sampled.renderedFrames / (sampled.durationMs / 1000),
    presentationFps: gaps.length * 1000 / Math.max(1, gaps.reduce((a, b) => a + b, 0)),
    frameP95Ms: percentile(gaps, 0.95), frameP99Ms: percentile(gaps, 0.99), maximumFrameMs: Math.max(0, ...gaps),
    slowFrames34: gaps.filter(gap => gap > 34).length, slowFrames100: gaps.filter(gap => gap > 100).length,
    longTaskCount: longTasks.length, maximumLongTaskMs: Math.max(0, ...longTasks),
    scriptCpuPercent: (after.ScriptDuration - client.previousMetrics.ScriptDuration) / seconds * 100,
    taskCpuPercent: (after.TaskDuration - client.previousMetrics.TaskDuration) / seconds * 100,
    heapMiB: after.JSHeapUsedSize / 1048576, documents: after.Documents, nodes: after.Nodes,
    snapshots: network.snapshots, snapshotHz: network.snapshots / seconds,
    snapshotP99GapMs: percentile(network.gaps, 0.99), maximumSnapshotGapMs: Math.max(0, ...network.gaps),
    maximumActiveSnapshotGapMs: Math.max(0, ...network.activeGaps), excludedSnapshots: network.excludedSnapshots,
    ingressKiBPerSecond: network.bytes / 1024 / seconds,
    serverTickHz: client.previousTick === null ? null : (sampled.tick - client.previousTick) / seconds,
    checkpointSequence: client.checkpointSequence, reducerHealth: client.reducerHealth,
    cpuProfiling: client.profiler?.overlaps(sampleStartedAt, Date.now()) ?? false,
    errors: client.errorCount, totalErrors: errorCount,
  }
  client.previousMetrics = after
  return row
}

function updateSummary(summary, row) {
  summary.samples += 1
  summary.minimumFps = Math.min(summary.minimumFps ?? Infinity, row.renderFps)
  summary.meanFps = (summary.meanFps ?? 0) + (row.renderFps - (summary.meanFps ?? 0)) / summary.samples
  summary.maximumFrameMs = Math.max(summary.maximumFrameMs ?? 0, row.maximumFrameMs)
  summary.maximumSnapshotGapMs = Math.max(summary.maximumSnapshotGapMs ?? 0, row.maximumSnapshotGapMs)
  summary.maximumActiveSnapshotGapMs = Math.max(summary.maximumActiveSnapshotGapMs ?? 0, row.maximumActiveSnapshotGapMs)
  summary.maximumHeapMiB = Math.max(summary.maximumHeapMiB ?? 0, row.heapMiB)
  summary.firstHeapMiB ??= row.heapMiB
  summary.finalHeapMiB = row.heapMiB
  summary.longTaskCount = (summary.longTaskCount ?? 0) + row.longTaskCount
  summary.slowFrames100 = (summary.slowFrames100 ?? 0) + row.slowFrames100
  summary.finalWave = row.wave
}
function networkWindow(lastAt = null) { return { bytes: 0, snapshots: 0, gaps: [], activeGaps: [], excludedSnapshots: 0, lastAt } }
function checkpointReducerHealth(document) {
  return Object.values(document.modState ?? {}).flatMap(mod => (
    (mod.runtime?.reducer_health ?? []).map(row => ({
      modId: row.mod_id, key: row.key, disabled: row.disabled, failures: row.failures,
    }))
  ))
}
function metricMap(value) { return Object.fromEntries(value.metrics.map(metric => [metric.name, metric.value])) }
function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0
}
function event(kind, details) {
  const row = { atUtc: new Date().toISOString(), event: kind, ...details }
  events.write(JSON.stringify(row) + '\n')
  console.log(JSON.stringify(row))
}
function clean(value) { return String(value).replaceAll(runtime.gameEndpoint.credential, '[redacted]') }
function pathname(value) { try { const url = new URL(value); return url.origin + url.pathname } catch { return '[invalid URL]' } }
function required(name) { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value }
function positive(name, fallback) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
  return value
}
async function withDeadline(promise, timeoutMs, message) {
  let timer
  try {
    return await Promise.race([promise, new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    })])
  } finally { clearTimeout(timer) }
}
