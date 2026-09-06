import assert from 'node:assert/strict'
import test from 'node:test'
import { DefaultSerializer, deserialize, serialize } from 'node:v8'
import { isDeepStrictEqual } from 'node:util'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

import { createIdlePlayerCharacterInput } from '../core-kernels/player-character.ts'
import {
  createGameSimulation,
  enterBoneyardWorld,
  stepGameSimulationTick,
  removePlayerCharacter,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import { createBoneyardCatalog, materializeBoneyard } from './boneyard-catalog.ts'
import { RunArchiveRecorder, runArchivePlayers, type RunArchive } from './run-archive.ts'
import { RunArchiveStore, readRunArchive } from './run-archive-store.ts'

test('completed runs retain the entire last living party and a reproducible slow tick', async context => {
  const loadedBoneyard = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))!
  let state = enterBoneyardWorld(createGameSimulation({
    first: { displayName: 'First', discipline: 'body', element: 'ether' },
    second: { displayName: 'Second', discipline: 'mind', element: 'water' },
  }, { gameRngSeed: 123 }), loadedBoneyard)
  const archives: RunArchive[] = []
  const recorder = new RunArchiveRecorder({
    content: { manifestSha256: '0'.repeat(64), mods: [] },
    revision: 'a'.repeat(40),
    sessionId: 'shared-hub',
    write: archive => { archives.push(archive) },
  })
  const inputs = {
    first: { ...createIdlePlayerCharacterInput(), movement: { x: 1, y: 0 } },
    second: createIdlePlayerCharacterInput(),
  }
  const original = deserialize(serialize(state))
  const before = state
  state = stepGameSimulationTick(state, inputs)
  assert.ok(isDeepStrictEqual(before, original), 'the recorder must be able to retain immutable tick state')
  recorder.observe({ before, after: state, inputs, loadedBoneyard, tickMs: 24, behindMs: 13 })
  const lastAlive = state
  const dead: GameSimulationState = {
    ...state,
    tick: state.tick + 1,
    run: { ...state.run, phase: 'game-over', gameOverEventId: 1 },
    playerEntities: {
      ...state.playerEntities,
      progressions: state.playerEntities.progressions.map(progression => ({
        ...progression,
        currentHealth: 0,
        lifeState: 'dying',
      })),
    },
  }
  recorder.observe({ before: state, after: dead, inputs, loadedBoneyard, tickMs: 3, behindMs: 0 })
  recorder.observe({ before: dead, after: dead, inputs, loadedBoneyard, tickMs: 1, behindMs: 0 })
  assert.equal(archives.length, 1)
  const archive: RunArchive = deserialize(serialize(archives[0]))
  assert.equal(archive.endReason, 'game-over')
  assert.ok(isDeepStrictEqual(archive.lastAlive?.state, lastAlive), 'last living state changed during capture')
  assert.deepEqual(archive.lastAlive?.state.playerEntities.identities.map(row => row.playerId), ['first', 'second'])
  assert.ok(isDeepStrictEqual(archive.worstTick.state, before), 'slow-tick checkpoint differs from its source')
  assert.equal(archive.worstTick.tickMs, 24)
  assert.ok(isDeepStrictEqual(
    stepGameSimulationTick(archive.worstTick.state, archive.worstTick.inputs),
    stepGameSimulationTick(before, inputs),
  ), 'the captured inputs must reproduce the same next tick')
  assert.equal(archive.performance.tickCount, 2)
  assert.equal(archive.performance.overBudgetTicks, 1)
  const root = await mkdtemp(join(tmpdir(), 'run-archive-'))
  const directory = join(root, 'archives')
  context.after(() => rm(root, { recursive: true, force: true }))
  const oldUmask = process.umask(0)
  context.after(() => process.umask(oldUmask))
  const store = new RunArchiveStore(directory)
  const saveStartedAt = performance.now()
  const pendingWrite = store.save(archive)
  await store.close()
  const path = join(directory, `${archive.id}.sdrrun.gz`)
  assert.ok(isDeepStrictEqual(await readRunArchive(path), archive))
  const receipt = await pendingWrite
  assert.ok(receipt.serializationMs >= 0 && receipt.serializationMs <= performance.now() - saveStartedAt)
  assert.equal((await stat(directory)).mode & 0o777, 0o700)
  assert.equal((await stat(path)).mode & 0o777, 0o600)
  assert.equal((await stat(`${path}.json`)).mode & 0o777, 0o600)
  await assert.rejects(store.save({ ...archive, endReason: 'server-error' }), /EEXIST/)
  assert.equal((await readRunArchive(path)).endReason, 'game-over', 'duplicate ids cannot overwrite an archive')
  assert.ok(receipt.bytes > 0)
  assert.match(receipt.sha256, /^[0-9a-f]{64}$/)
  assert.equal(JSON.parse(await readFile(`${path}.json`, 'utf8')).runId, archive.runId)
  assert.deepEqual(JSON.parse(await readFile(`${path}.json`, 'utf8')).players.map(
    (player: { displayName: string }) => player.displayName,
  ), ['First', 'Second'])
  assert.equal(await store.prune(), 0)
  const modifiedAt = new Date(Math.floor(Date.now() / 1000) * 1000)
  await utimes(path, modifiedAt, modifiedAt)
  const expiresAt = (await stat(path)).mtimeMs + 30 * 24 * 60 * 60 * 1_000
  assert.equal(await store.prune(expiresAt - 1_000), 0)
  assert.equal(await store.prune(expiresAt), 0)
  await writeFile(`${path}.keep`, '')
  const future = expiresAt + 1_000
  assert.equal(await store.prune(future), 0)
  await rm(`${path}.keep`)
  assert.equal(await store.prune(future), 1)
  assert.deepEqual(await readdir(directory), [])
  for (const invalid of [
    null,
    { ...archive, schemaVersion: 2 },
    { ...archive, protocolVersion: archive.protocolVersion + 1 },
    { ...archive, revision: 'unversioned' },
    { ...archive, revision: `prefix${'a'.repeat(40)}` },
    { ...archive, revision: `${'a'.repeat(40)}suffix` },
    { ...archive, lastAliveByPlayer: null },
    { ...archive, loadedBoneyard: null },
    { ...archive, loadedBoneyard: { ...archive.loadedBoneyard, runId: 'wrong-run' } },
    { ...archive, worstTick: null },
    { ...archive, worstTick: { ...archive.worstTick, state: createGameSimulation() } },
  ]) {
    const writer = new DefaultSerializer()
    writer.writeHeader()
    writer.writeValue({ encodingVersion: 1, stateCount: 0 })
    writer.writeValue(invalid)
    await writeFile(path, gzipSync(writer.releaseBuffer()))
    await assert.rejects(readRunArchive(path), { name: 'Error', message: /^Run archive (schema|metadata)/ })
  }
  for (const invalidHeader of [null, { encodingVersion: 2, stateCount: 0 },
    { encodingVersion: 1, stateCount: -1 }, { encodingVersion: 1, stateCount: 0.5 },
    { encodingVersion: 1, stateCount: 1_000_000_000 }]) {
    const writer = new DefaultSerializer()
    writer.writeHeader()
    writer.writeValue(invalidHeader)
    await writeFile(path, gzipSync(writer.releaseBuffer()))
    await assert.rejects(readRunArchive(path), /encoding header is invalid/)
  }
  await writeFile(path, 'not a gzip archive')
  await assert.rejects(readRunArchive(path), { code: 'Z_DATA_ERROR' })
  await assert.rejects(store.save({ ...archive, id: '../outside' }), /id is invalid/)
  await assert.rejects(store.save({ ...archive, id: `../${randomUUID()}` }), /id is invalid/)
  const withoutLiving = await store.save({ ...archive, id: randomUUID(), lastAlive: null, lastAliveByPlayer: new Map() })
  const summary = JSON.parse(await readFile(join(directory, `${withoutLiving.file}.json`), 'utf8'))
  assert.equal(summary.lastAliveTick, null)
  assert.deepEqual(summary.players, [
    { playerId: 'first', displayName: 'First', lastAliveTick: null },
    { playerId: 'second', displayName: 'Second', lastAliveTick: null },
  ])
  await rm(join(directory, `${withoutLiving.file}.json`))
  await store.prune(Date.now() + 31 * 24 * 60 * 60 * 1000)
  assert.deepEqual(await readdir(directory), [])
  for (const name of ['.writing-Ab12Cd', '.writing-Ab12Cd.backup', 'backup.writing-Ab12Cd']) {
    const path = join(directory, name)
    await mkdir(path)
    await writeFile(join(path, 'capture'), 'partial')
  }
  assert.equal(await store.prune(), 0, 'in-progress writes must survive cleanup')
  assert.equal(await store.prune(Date.now() + 31 * 24 * 60 * 60 * 1000), 1)
  assert.deepEqual((await readdir(directory)).sort(), ['.writing-Ab12Cd.backup', 'backup.writing-Ab12Cd'])
  await store.close()
})

test('abandoned and closed worlds archive once and performance history remains bounded', () => {
  const loadedBoneyard = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))!
  const state = enterBoneyardWorld(createGameSimulation(), loadedBoneyard)
  const archives: RunArchive[] = []
  const recorder = new RunArchiveRecorder({
    content: { manifestSha256: '0'.repeat(64), mods: [] },
    revision: 'b'.repeat(40), sessionId: 'private', write: archive => { archives.push(archive) },
    now: () => new Date('2026-09-05T00:00:00Z'),
  })
  for (let index = 0; index < 6_201; index += 1) {
    recorder.observe({ before: state, after: state, inputs: {}, loadedBoneyard, tickMs: 1, behindMs: 0 })
  }
  recorder.retain(new Set([loadedBoneyard.runId]))
  assert.equal(archives.length, 0)
  recorder.retain(new Set())
  recorder.close()
  assert.equal(archives.length, 1)
  assert.equal(archives[0]?.endReason, 'world-ended')
  assert.equal(archives[0]?.performance.recent.length, 60)
  assert.equal(archives[0]?.performance.tickCount, 6_201)
  recorder.observe({ before: state, after: state, inputs: {}, loadedBoneyard, tickMs: 2, behindMs: 0 })
  recorder.close('server-error')
  assert.equal(archives[1]?.endReason, 'server-error')
})

test('world boundaries preserve exact performance totals and do not fabricate a living checkpoint', () => {
  const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))!
  const hub = createGameSimulation()
  const live = enterBoneyardWorld(hub, loaded)
  const captures: RunArchive[] = []
  const recorder = new RunArchiveRecorder({
    content: { manifestSha256: '0'.repeat(64), mods: [] },
    revision: 'c'.repeat(40), sessionId: 'isolated', write: archive => { captures.push(archive) },
  })
  for (let index = 0; index < 100; index += 1) {
    recorder.observe({ before: live, after: index === 99 ? hub : live, inputs: {},
      loadedBoneyard: loaded, tickMs: index < 20 ? 15 : 10, behindMs: index === 50 ? 250 : 0 })
  }
  assert.equal(captures[0]?.endReason, 'world-ended')
  assert.deepEqual(captures[0]?.performance, {
    tickCount: 100, overBudgetTicks: 20, totalTickMs: 1100,
    recent: [{ tick: hub.tick, tickCount: 100, meanTickMs: 11, maximumTickMs: 15,
      maximumBehindMs: 250, overBudgetTicks: 20 }],
  })
  assert.equal(captures[0]?.lastAlive?.state.world.kind, 'boneyard')
  const dead: GameSimulationState = { ...live, playerEntities: {
    ...live.playerEntities,
    progressions: live.playerEntities.progressions.map(player => ({ ...player, lifeState: 'spectating' })),
  } }
  recorder.observe({ before: dead, after: dead, inputs: {}, loadedBoneyard: loaded, tickMs: 1, behindMs: 0 })
  recorder.observe({ before: dead, after: dead, inputs: {}, loadedBoneyard: loaded, tickMs: 30, behindMs: 0 })
  recorder.close()
  assert.equal(captures[1]?.lastAlive, null)
  assert.equal(captures[1]?.worstTick.tickMs, 30)
  assert.equal(captures[1]?.endReason, 'host-closed')
})

test('runs closed during loading retain their initial living state without inventing tick measurements', () => {
  const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))!
  const state = enterBoneyardWorld(createGameSimulation(), loaded)
  const captures: RunArchive[] = []
  const recorder = new RunArchiveRecorder({
    content: { manifestSha256: '0'.repeat(64), mods: [] },
    revision: 'd'.repeat(40), sessionId: 'loading', write: archive => { captures.push(archive) },
  })
  recorder.checkpoint(state, loaded)
  recorder.checkpoint(state, loaded)
  recorder.close()
  assert.equal(captures.length, 1)
  assert.ok(isDeepStrictEqual(captures[0]?.lastAlive?.state, state), 'initial state changed before archival')
  assert.deepEqual(captures[0]?.performance, {
    tickCount: 0, overBudgetTicks: 0, totalTickMs: 0, recent: [],
  })
})

test('the surviving teammate and between-tick state changes remain reproducible', () => {
  const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))!
  const hub = createGameSimulation({
    first: { displayName: 'First', discipline: 'body', element: 'ether' },
    second: { displayName: 'Second', discipline: 'mind', element: 'water' },
  })
  const initial = enterBoneyardWorld(hub, loaded)
  const mixed: GameSimulationState = { ...initial, playerEntities: {
    ...initial.playerEntities,
    progressions: initial.playerEntities.progressions.map((player, index) => ({
      ...player, lifeState: index === 0 ? 'dying' : 'alive', currentHealth: index === 0 ? 0 : 40,
    })),
  } }
  const captures: RunArchive[] = []
  const recorder = new RunArchiveRecorder({
    content: { manifestSha256: '0'.repeat(64), mods: [] },
    revision: 'e'.repeat(40), sessionId: 'party', write: archive => { captures.push(archive) },
  })
  recorder.checkpoint(hub, loaded)
  recorder.close()
  assert.equal(captures.length, 0, 'the Hub is not a Boneyard run')
  const after = stepGameSimulationTick(mixed, {})
  recorder.observe({ before: mixed, after, inputs: {}, loadedBoneyard: loaded, tickMs: 17, behindMs: 0 })
  recorder.close()
  assert.ok(isDeepStrictEqual(captures[0]?.lastAlive?.state, after), 'closing must retain the latest living tick')
  const next = stepGameSimulationTick(after, {})
  recorder.observe({ before: after, after: next, inputs: {}, loadedBoneyard: loaded, tickMs: 17, behindMs: 0 })
  const healed: GameSimulationState = { ...next, playerEntities: {
    ...next.playerEntities,
    progressions: next.playerEntities.progressions.map((player, index) => (
      index === 1 ? { ...player, currentHealth: player.currentHealth + 5 } : player
    )),
  } }
  const dead: GameSimulationState = { ...healed, run: { ...healed.run, phase: 'game-over' } }
  recorder.observe({ before: healed, after: dead, inputs: {}, loadedBoneyard: loaded, tickMs: 17, behindMs: 0 })
  assert.ok(isDeepStrictEqual(captures[1]?.lastAlive?.state, healed), 'accepted inventory changes before the death tick must survive')
})

test('each player retains their own last living moment after a teammate dies and disconnects', () => {
  const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))!
  const initial = enterBoneyardWorld(createGameSimulation({
    first: { displayName: 'First', discipline: 'body', element: 'ether' },
    second: { displayName: 'Second', discipline: 'mind', element: 'water' },
  }), loaded)
  const captures: RunArchive[] = []
  const recorder = new RunArchiveRecorder({
    content: { manifestSha256: '0'.repeat(64), mods: [] },
    revision: 'f'.repeat(40), sessionId: 'party', write: archive => { captures.push(archive) },
  })
  const firstDead: GameSimulationState = { ...initial, tick: initial.tick + 1, playerEntities: {
    ...initial.playerEntities,
    progressions: initial.playerEntities.progressions.map((player, index) => (
      index === 0 ? { ...player, lifeState: 'dying', currentHealth: 0 } : player
    )),
  } }
  recorder.observe({ before: initial, after: firstDead, inputs: {}, loadedBoneyard: loaded, tickMs: 1, behindMs: 0 })
  const remaining = removePlayerCharacter(firstDead, 'first')
  const progressed = stepGameSimulationTick(remaining, {})
  recorder.observe({ before: remaining, after: progressed, inputs: {}, loadedBoneyard: loaded, tickMs: 1, behindMs: 0 })
  const changedWhilePaused: GameSimulationState = { ...progressed, playerEntities: {
    ...progressed.playerEntities,
    progressions: progressed.playerEntities.progressions.map(player => ({ ...player, currentMana: 3 })),
  } }
  recorder.checkpoint(changedWhilePaused, loaded)
  recorder.close()
  const archive = captures[0]!
  assert.ok(isDeepStrictEqual(archive.lastAliveByPlayer.get('first')?.state, initial))
  assert.ok(isDeepStrictEqual(archive.lastAliveByPlayer.get('second')?.state, changedWhilePaused))
  assert.equal(archive.performance.tickCount, 2, 'pause and disconnect checkpoints do not invent ticks')
  assert.deepEqual(runArchivePlayers(archive), [
    { playerId: 'first', displayName: 'First', lastAliveTick: initial.tick },
    { playerId: 'second', displayName: 'Second', lastAliveTick: changedWhilePaused.tick },
  ])
})

test('saving distinct last-alive worlds yields to the server between serialization slices', async context => {
  const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))!
  const state = enterBoneyardWorld(createGameSimulation(), loaded)
  const archives: RunArchive[] = []
  const recorder = new RunArchiveRecorder({
    content: { manifestSha256: '0'.repeat(64), mods: [] }, revision: 'a'.repeat(40),
    sessionId: 'serialization', write: captured => { archives.push(captured) },
  })
  recorder.checkpoint(state, loaded)
  recorder.close()
  const archive = archives[0]!
  let turn = 0
  let heartbeat: NodeJS.Immediate
  const beat = (): void => { turn += 1; heartbeat = setImmediate(beat) }
  heartbeat = setImmediate(beat)
  context.after(() => clearImmediate(heartbeat))
  const serializationTurns: number[] = []
  const second = { ...state }
  for (const [index, world] of [state, second].entries()) {
    Object.defineProperty(world, 'tick', { enumerable: true, get() {
      serializationTurns.push(turn)
      return index
    } })
  }
  const root = await mkdtemp(join(tmpdir(), 'run-archive-yield-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const store = new RunArchiveStore(root)
  const receipt = await store.save({ ...archive, finalState: second })
  const restored = await readRunArchive(join(root, receipt.file))
  assert.ok(serializationTurns[0]! < serializationTurns[1]!, 'world encoding monopolized one event-loop turn')
  assert.equal(restored.finalState.tick, 1)
  assert.equal(restored.lastAlive?.state.tick, 0)
  assert.equal(restored.lastAlive?.state, restored.worstTick.state, 'encoding must preserve shared checkpoint references')
})
