import assert from 'node:assert/strict'
import test from 'node:test'
import { createGameSimulation, type GameSimulationState } from '../core-server/game-simulation.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { createNativeFlameLashFactory } from '../core-kernels/native-weld-flame-birth.ts'
import { createNativeWeldFlameLashFade } from '../core-kernels/native-weld-flame-lash.ts'
import { stepNativeWeldWorldActor } from '../core-kernels/native-weld-primary-runtime.ts'
import { createGameSnapshot } from './game-snapshot.ts'
import { createHostFlamePresentationHistory } from './flame-presentation-history.ts'
import { gameSnapshot, gameSnapshotFrame } from '../protocol/codecs/snapshot.ts'
import { createGameSnapshotFrame, createReplicatedEntityBaseline, EntityReplicationReconstructor, EntityReplicationGapError } from '../protocol/entity-replication.ts'
import { createHubPresentationTimeline } from '../client/hub-presentation-timeline.ts'
import { createRetainedFlamePresentation, flameCameraDisplacements, flamePresentationEpoch } from '../client/flame-presentation.ts'
import { gameRunWorldTick } from '../core-kernels/game-run.ts'
import { NativeSecondaryScreenFeedbackPresentation } from '../renderer/native-screen-feedback.ts'
import { createGameSaveDocument } from '../save/game-save-document.ts'

function fixture(enhancedEffects = false, tick = 1, cameraDisplacement = { x: 4, y: 0 }) {
  const initial = createGameSimulation({ owner: { displayName: 'Flame', discipline: 'arcane', element: 'fire' } })
  const order = createNativeWorldManagerOrder(initial.worldManagerOrder)
  const channel = { buildId: 1003 as const, enhancedEffects, direction: { x: 1, y: 0 },
    id: 1, origin: { x: 0, y: 0 }, midpoint: { x: 250, y: 0 }, endpoint: { x: 500, y: 0 },
    ownerId: 'owner', targetId: null, tick, underpowered: false,
    vector: [8, 2, 1, .8, 0, 0, 0, 0], worldKey: 'hub:courtyard' }
  const endpoint = createNativeWeldFlameLashFade({ ...channel, id: 3, origin: channel.endpoint,
    rng: initial.combatRng, variant: 'endpoint', registerWorldPainter: order.register })
  const factory = createNativeFlameLashFactory({ channel, sourceFadeId: 2, cameraDisplacement,
    geometry: { start: channel.origin, control: channel.midpoint, end: channel.endpoint, offset: { x: 0, y: 0 } },
    role: 'main', width: 1, creatorRegistration: initial.playerEntities.lightings[0]!.lightRegistration,
    miscAppendOrdinal: 0, registerWorldPainter: order.register, rng: endpoint.rng })
  const born: GameSimulationState = { ...initial, tick, worldManagerOrder: order.state(),
    combatRng: factory.rng, primarySpells: { nextId: 4, projectiles: [],
      transients: [endpoint.actor, factory.source, factory.channel] } }
  return { initial, born }
}

function advance(state: GameSimulationState): GameSimulationState {
  return { ...state, tick: state.tick + 1, primarySpells: { ...state.primarySpells,
    transients: state.primarySpells.transients.flatMap(actor => {
      assert.ok(actor.kind === 'weld-channel' || actor.kind === 'weld-flame-lash-fade')
      const next = stepNativeWeldWorldActor(actor, state.combatRng)
      assert.deepEqual(next.rng, state.combatRng)
      return next.actor ? [next.actor] : []
    }) } }
}

test('100Hz births absent at ticks0/5 survive object/compact-delta delivery only during true intervals', () => {
  const { initial, born } = fixture()
  const history = createHostFlamePresentationHistory()
  const welcome = gameSnapshot(JSON.parse(JSON.stringify({ ...createGameSnapshot(initial, 'owner'), flamePresentation: history.resetFrame(initial) })))
  const baseline = createReplicatedEntityBaseline(welcome)
  let current = born
  history.advance(initial, current)
  for (let tick = 2; tick <= 5; tick += 1) {
    const next = advance(current); history.advance(current, next); current = next
    if (tick === 2) {
      const compatibilityRow = current.primarySpells.transients.find(actor => actor.kind === 'weld-channel')!
      assert.equal(compatibilityRow.ageTicks, 1)
      assert.equal('lifetimeTicks' in compatibilityRow, false)
    }
  }
  assert.equal(welcome.primarySpells.transients.length, 0)
  assert.equal(current.primarySpells.transients.length, 0)
  const snapshot = { ...createGameSnapshot(current, 'owner'), flamePresentation: history.resetFrame(current) }
  const frame = gameSnapshotFrame(JSON.parse(JSON.stringify({ ...createGameSnapshotFrame(snapshot, 1, baseline),
    flamePresentation: history.frame(current, baseline.flamePresentation!) })))
  assert.equal(frame.world.entities.keyframe, false)
  assert.equal(frame.primarySpells.transients.length, 0)
  assert.equal(frame.flamePresentation.births.length, 3)
  const replica = new EntityReplicationReconstructor(); replica.reset(welcome, 1)
  const delivered = replica.apply(frame, 2)
  assert.equal(delivered.world.kind, 'hub')
  if (welcome.world.kind !== 'hub' || delivered.world.kind !== 'hub') throw new Error('fixture')
  const timeline = createHubPresentationTimeline({ initialSnapshot: welcome as typeof welcome & { world: typeof welcome.world },
    initialReceivedAtMs: 0, localPlayerId: 'owner', serverTickRate: 100, snapshotRate: 20 })
  timeline.push(delivered as typeof delivered & { world: typeof delivered.world }, 50)
  const sample = (tick: number) => timeline.sample(50 + tick * 10).primarySpells.transients
  assert.equal(sample(0).length, 0)
  assert.equal(sample(1).length, 3)
  const ribbon = sample(1).find(actor => actor.kind === 'weld-channel')!
  assert.ok(ribbon.kind === 'weld-channel' && ribbon.flameVisual?.kind === 'native-birth-v1')
  assert.equal(ribbon.flameVisual.path.radiusFactors.length, 5)
  assert.equal(sample(2).length, 1) // Normal coarse endpoint survives native update two.
  assert.equal(sample(3).length, 0)
  timeline.push(delivered as typeof delivered & { world: typeof delivered.world }, 50)
  assert.equal(sample(1).length, 3)
  assert.equal(sample(5).length, 0)
  const feedback = new NativeSecondaryScreenFeedbackPresentation(0, 'hub:courtyard')
  for (const tick of [1, 2, 5]) {
    const camera = flameCameraDisplacements(timeline.sample(50 + tick * 10))
    assert.equal(camera.length, 1, 'camera recipe outlives the one-update ribbon without lengthening it')
    feedback.consumeFlameCameraDisplacements(camera)
    feedback.consumeFlameCameraDisplacements(camera)
    assert.deepEqual(feedback.sampleCameraDisplacement(tick), { x: 4 * .75 ** tick, y: 0 })
  }
  const save = JSON.parse(createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: null,
    mods: [], modState: {}, playerId: 'owner', state: current }))
  assert.equal('flamePresentation' in save.continuation.simulation, false)
  assert.equal(save.continuation.simulation.primarySpells.transients.length, 0)
  const previousBaseline = createReplicatedEntityBaseline(delivered)
  for (let tick = 6; tick <= 8; tick += 1) {
    const next = advance(current); history.advance(current, next); current = next
  }
  const finalSnapshot = { ...createGameSnapshot(current, 'owner'), flamePresentation: history.resetFrame(current) }
  const finalFrame = gameSnapshotFrame(JSON.parse(JSON.stringify({ ...createGameSnapshotFrame(finalSnapshot, 2, previousBaseline),
    flamePresentation: history.frame(current, previousBaseline.flamePresentation!) })))
  const finalDelivery = replica.apply(finalFrame, 3)
  if (finalDelivery.world.kind !== 'hub') throw new Error('fixture')
  timeline.push(finalDelivery as typeof finalDelivery & { world: typeof finalDelivery.world }, 80)
  assert.deepEqual(flameCameraDisplacements(timeline.sample(130)), [])
  assert.deepEqual(feedback.sampleCameraDisplacement(8), { x: 0, y: 0 })
})

test('paused world time retains live births; load/reconnect reset clears connection recipes', () => {
  const { initial, born } = fixture(), history = createHostFlamePresentationHistory()
  history.resetFrame(initial); history.advance(initial, born)
  const paused = { ...createGameSnapshot(born, 'owner'), flamePresentation: history.resetFrame(born) }
  if (paused.world.kind !== 'hub') throw new Error('fixture')
  const timeline = createHubPresentationTimeline({ initialSnapshot: paused as typeof paused & { world: typeof paused.world },
    initialReceivedAtMs: 0, localPlayerId: 'owner', serverTickRate: 100, snapshotRate: 20 })
  assert.deepEqual(timeline.sample(0).primarySpells, timeline.sample(100_000).primarySpells)
  const replaced = { ...born, primarySpells: { ...born.primarySpells, transients: [] } }
  const reset = history.resetFrame(replaced)
  assert.notEqual(reset.epoch, paused.flamePresentation.epoch)
  const loaded = { ...createGameSnapshot(replaced, 'owner'), flamePresentation: reset }
  if (loaded.world.kind !== 'hub') throw new Error('fixture')
  timeline.push(loaded as typeof loaded & { world: typeof loaded.world }, 100_001)
  assert.equal(timeline.sample(100_002).primarySpells.transients.length, 0)
  assert.deepEqual(history.frame(replaced, null).births, [])
})

test('same paused-tick removal resets owner, peer and observer recipes while preserving exact survivor age', () => {
  const { initial, born } = fixture(true), history = createHostFlamePresentationHistory()
  const welcome = gameSnapshot(JSON.parse(JSON.stringify({ ...createGameSnapshot(initial, 'owner'),
    flamePresentation: history.resetFrame(initial) })))
  history.advance(initial, born)
  const paused = advance(born)
  history.advance(born, paused)
  const snapshot = { ...createGameSnapshot(paused, 'owner'), flamePresentation: history.resetFrame(paused) }
  const baseline = createReplicatedEntityBaseline(welcome)
  const before = gameSnapshotFrame(JSON.parse(JSON.stringify({ ...createGameSnapshotFrame(snapshot, 1, baseline),
    flamePresentation: history.frame(paused, baseline.flamePresentation!) })))
  const removedId = 2, survivorId = 3
  const survivor = paused.primarySpells.transients.find(actor => actor.id === survivorId)!
  assert.ok(survivor.kind === 'weld-flame-lash-fade')
  assert.equal(survivor.ageTicks, 1)
  const unchanged = { ...paused, primarySpells: { ...paused.primarySpells, transients: [...paused.primarySpells.transients] } }
  history.advance(paused, unchanged)
  assert.equal(history.resetFrame(unchanged).epoch, snapshot.flamePresentation.epoch)
  const removed = { ...unchanged, primarySpells: { ...unchanged.primarySpells,
    transients: unchanged.primarySpells.transients.filter(actor => actor.id !== removedId) } }
  history.advance(unchanged, removed)
  const resetSnapshot = { ...createGameSnapshot(removed, 'owner'), flamePresentation: history.resetFrame(removed) }
  assert.notEqual(resetSnapshot.flamePresentation.epoch, snapshot.flamePresentation.epoch)
  for (const recipient of ['owner', 'peer', 'observer']) {
    const replica = new EntityReplicationReconstructor(); replica.reset(welcome, 1)
    const delivered = replica.apply(before, 2)
    if (welcome.world.kind !== 'hub' || delivered.world.kind !== 'hub') throw new Error('fixture')
    const timeline = createHubPresentationTimeline({ initialSnapshot: welcome as typeof welcome & { world: typeof welcome.world },
      initialReceivedAtMs: 0, localPlayerId: recipient, serverTickRate: 100, snapshotRate: 20 })
    timeline.push(delivered as typeof delivered & { world: typeof delivered.world }, 20)
    assert.equal(timeline.sample(1_000).primarySpells.transients.length, 2)
    const feedback = new NativeSecondaryScreenFeedbackPresentation(0, 'hub:courtyard')
    feedback.consumeFlameCameraDisplacements(flameCameraDisplacements(timeline.sample(1_000)))
    assert.deepEqual(feedback.sampleCameraDisplacement(2), { x: 2.25, y: 0 }, recipient)
    // Both client and observer send paths force their existing keyframe when
    // history resets, even though their acknowledged world tick is unchanged.
    const acknowledged = createReplicatedEntityBaseline(delivered)
    const reset = gameSnapshotFrame(JSON.parse(JSON.stringify({ ...createGameSnapshotFrame(resetSnapshot, 2, acknowledged, true),
      flamePresentation: history.frame(removed, acknowledged.flamePresentation!) })))
    assert.equal(reset.flamePresentation.kind, 'reset')
    assert.equal(reset.world.entities.keyframe, true)
    const replacement = replica.apply(reset, 3)
    if (replacement.world.kind !== 'hub') throw new Error('fixture')
    timeline.push(replacement as typeof replacement & { world: typeof replacement.world }, 1_001)
    timeline.push(replacement as typeof replacement & { world: typeof replacement.world }, 1_001)
    for (const now of [1_001, 100_000]) {
      const actors = timeline.sample(now).primarySpells.transients
      assert.deepEqual(actors.map(actor => actor.id), [survivorId], recipient)
      assert.ok(actors[0]!.kind === 'weld-flame-lash-fade')
      assert.equal(actors[0]!.ageTicks, survivor.ageTicks, recipient)
      assert.equal(actors[0]!.alpha, survivor.alpha, recipient)
      const cameras = flameCameraDisplacements(timeline.sample(now))
      assert.equal(cameras.length, 1, 'surviving compatibility channel reseeds its exact-age camera recipe')
      feedback.consumeFlameCameraDisplacements(cameras)
      assert.deepEqual(feedback.sampleCameraDisplacement(2), { x: 2.25, y: 0 }, `${recipient}: epoch is not a fresh impulse`)
    }
    // A new load/reconnect owner starts from current complete actors only.
    const reconnected = createHubPresentationTimeline({ initialSnapshot: replacement as typeof replacement & { world: typeof replacement.world },
      initialReceivedAtMs: 2_000, localPlayerId: recipient, serverTickRate: 100, snapshotRate: 20 })
    const restoredFeedback = new NativeSecondaryScreenFeedbackPresentation(2, 'hub:courtyard')
    restoredFeedback.consumeFlameCameraDisplacements(flameCameraDisplacements(reconnected.sample(2_000)))
    assert.deepEqual(restoredFeedback.sampleCameraDisplacement(2), { x: 2.25, y: 0 }, recipient)
    const emptyLoad = { ...replacement, primarySpells: { ...replacement.primarySpells, transients: [] } }
    const emptyTimeline = createHubPresentationTimeline({ initialSnapshot: emptyLoad as typeof emptyLoad & { world: typeof replacement.world },
      initialReceivedAtMs: 2_000, localPlayerId: recipient, serverTickRate: 100, snapshotRate: 20 })
    assert.deepEqual(flameCameraDisplacements(emptyTimeline.sample(2_000)), [], `${recipient}: load does not restore a connection queue`)
  }
})

test('same-tick fresh Flame birth resets a previously acknowledged empty tick', () => {
  const { initial, born } = fixture(), history = createHostFlamePresentationHistory()
  const empty = { ...initial, tick: born.tick }
  const baseline = history.resetFrame(empty)
  history.advance(empty, born)
  const frame = history.frame(born, { epoch: baseline.epoch, worldTick: baseline.throughTick })
  assert.equal(frame.kind, 'reset')
  assert.notEqual(frame.epoch, baseline.epoch)
  assert.equal(born.primarySpells.transients.length, 3)
})

test('rollback to a previously seen state object always allocates a fresh epoch', () => {
  const { initial, born } = fixture(), history = createHostFlamePresentationHistory()
  const first = history.resetFrame(initial)
  history.advance(initial, born)
  const later = history.resetFrame(born)
  assert.equal(later.epoch, first.epoch)
  history.advance(born, initial)
  const restored = history.resetFrame(initial)
  assert.equal(restored.throughTick, initial.tick)
  assert.ok(restored.epoch > later.epoch)
  const empty = { ...born, primarySpells: { ...born.primarySpells, transients: [] } }
  history.advance(born, empty)
  const cleared = history.resetFrame(empty)
  history.advance(empty, born)
  const restoredBirths = history.resetFrame(born)
  assert.ok(restoredBirths.epoch > cleared.epoch)
})

test('same-world timeline rollback resets an existing owner, peer and observer camera consumer', () => {
  const late = fixture(true, 100).born, early = fixture(true, 1, { x: 0, y: 4 }).born
  const history = createHostFlamePresentationHistory()
  const before = { ...createGameSnapshot(late, 'owner'), flamePresentation: history.resetFrame(late) }
  history.advance(late, early)
  const after = { ...createGameSnapshot(early, 'owner'), flamePresentation: history.resetFrame(early) }
  if (before.world.kind !== 'hub' || after.world.kind !== 'hub') throw new Error('fixture')
  for (const recipient of ['owner', 'peer', 'observer']) {
    const timeline = createHubPresentationTimeline({ initialSnapshot: before as typeof before & { world: typeof before.world },
      initialReceivedAtMs: 0, localPlayerId: recipient, serverTickRate: 100, snapshotRate: 20 })
    const feedback = new NativeSecondaryScreenFeedbackPresentation(100, 'hub:courtyard')
    const display = (now: number) => {
      const frame = timeline.sample(now)
      feedback.synchronizeWorldTimeline(gameRunWorldTick(frame.tick, frame.run), flamePresentationEpoch(frame), frame.tick)
      feedback.consumeFlameCameraDisplacements(flameCameraDisplacements(frame))
      return feedback.sampleCameraDisplacement(frame.tick)
    }
    assert.deepEqual(display(0), { x: 3, y: 0 }, recipient)
    timeline.push(after as typeof after & { world: typeof after.world }, 1)
    assert.deepEqual(display(1), { x: 0, y: 3 }, recipient)
    timeline.push(after as typeof after & { world: typeof after.world }, 1)
    assert.deepEqual(display(10_000), { x: 0, y: 3 }, `${recipient}: paused delivery is idempotent`)
    const emptyState = { ...early, tick: 0, primarySpells: { ...early.primarySpells, transients: [] } }
    history.advance(early, emptyState)
    const empty = { ...createGameSnapshot(emptyState, 'owner'), flamePresentation: history.resetFrame(emptyState) }
    if (empty.world.kind !== 'hub') throw new Error('fixture')
    timeline.push(empty as typeof empty & { world: typeof empty.world }, 10_001)
    assert.deepEqual(display(10_002), { x: 0, y: 0 }, `${recipient}: empty rollback clears retained feedback`)
  }
})

test('Region camera continues under GameOver while ordinary pause and stopped Flame visuals remain frozen', () => {
  const { born } = fixture(true), history = createHostFlamePresentationHistory()
  const retained = createRetainedFlamePresentation(history.resetFrame(born))
  const feedback = new NativeSecondaryScreenFeedbackPresentation(1, 'hub:courtyard')
  const frozenVisuals = retained.sample(born.primarySpells, 1)
  const camera = retained.cameraDisplacements(born.primarySpells, 1, 1)
  feedback.consumeFlameCameraDisplacements(camera)
  assert.deepEqual(feedback.sampleCameraDisplacement(1), { x: 3, y: 0 })
  // Ordinary pause does not advance Region: wall time or repeated delivery is irrelevant.
  for (let repeat = 0; repeat < 5; repeat += 1) {
    feedback.consumeFlameCameraDisplacements(camera)
    assert.deepEqual(feedback.sampleCameraDisplacement(1), { x: 3, y: 0 })
  }
  for (const liveTick of [2, 8, 11]) {
    const run = { ...born.run, phase: 'game-over' as const, gameOverTicks: liveTick - 1 }
    const stopped = gameRunWorldTick(liveTick, run)
    assert.equal(stopped, 1)
    assert.deepEqual(retained.sample(born.primarySpells, stopped), frozenVisuals)
    const proposals = retained.cameraDisplacements(born.primarySpells, stopped, liveTick)
    assert.equal(proposals.length, liveTick < 8 ? 1 : 0)
    feedback.consumeFlameCameraDisplacements(proposals)
    assert.deepEqual(feedback.sampleCameraDisplacement(liveTick), liveTick === 2 ? { x: 2.25, y: 0 } : { x: 0, y: 0 })
  }
  const reconnected = new NativeSecondaryScreenFeedbackPresentation(11, 'hub:courtyard')
  reconnected.consumeFlameCameraDisplacements(retained.cameraDisplacements(born.primarySpells, 1, 11))
  assert.deepEqual(reconnected.sampleCameraDisplacement(11), { x: 0, y: 0 })
})

test('reset-born live fades honor next-tick teardown between sparse endpoint snapshots', () => {
  const { born } = fixture(true), history = createHostFlamePresentationHistory()
  // This is a newly loaded current state, so no connection birth queue exists.
  const welcome = gameSnapshot(JSON.parse(JSON.stringify({ ...createGameSnapshot(born, 'owner'),
    flamePresentation: history.resetFrame(born) })))
  const baseline = createReplicatedEntityBaseline(welcome)
  const next = advance(born)
  let current: GameSimulationState = { ...next, primarySpells: { ...next.primarySpells,
    transients: next.primarySpells.transients.filter(actor => actor.id !== 2) } }
  history.advance(born, current)
  for (let tick = 3; tick <= 5; tick += 1) {
    const next = advance(current); history.advance(current, next); current = next
  }
  const frame = gameSnapshotFrame(JSON.parse(JSON.stringify({
    ...createGameSnapshotFrame({ ...createGameSnapshot(current, 'owner'), flamePresentation: history.resetFrame(current) }, 1, baseline),
    flamePresentation: history.frame(current, baseline.flamePresentation!) })))
  assert.equal(frame.flamePresentation.births.find(birth => birth.id === 2)!.endTickExclusive, 2)
  const replica = new EntityReplicationReconstructor(); replica.reset(welcome, 1)
  const delivered = replica.apply(frame, 2)
  if (welcome.world.kind !== 'hub' || delivered.world.kind !== 'hub') throw new Error('fixture')
  const timeline = createHubPresentationTimeline({ initialSnapshot: welcome as typeof welcome & { world: typeof welcome.world },
    initialReceivedAtMs: 0, localPlayerId: 'owner', serverTickRate: 100, snapshotRate: 20 })
  timeline.push(delivered as typeof delivered & { world: typeof delivered.world }, 40)
  assert.ok(timeline.sample(40).primarySpells.transients.some(actor => actor.id === 2))
  for (const now of [50, 60, 70, 80]) {
    assert.equal(timeline.sample(now).primarySpells.transients.some(actor => actor.id === 2), false)
    assert.ok(timeline.sample(now).primarySpells.transients.some(actor => actor.id === 3))
  }
})

test('coverage gaps request existing snapshot recovery and malformed recipes are rejected', () => {
  const { initial } = fixture()
  const snapshot = createGameSnapshot(initial, 'owner')
  const replica = new EntityReplicationReconstructor(); replica.reset(snapshot, 1)
  const frame = createGameSnapshotFrame(snapshot, 1, createReplicatedEntityBaseline(snapshot))
  assert.throws(() => replica.apply({ ...frame, flamePresentation: { kind: 'continuous', epoch: 99,
    worldKey: 'hub', afterTick: 0, throughTick: 0, births: [] } }, 2), EntityReplicationGapError)
  assert.throws(() => gameSnapshotFrame({ ...frame, flamePresentation: undefined }), /flamePresentation/)
  assert.throws(() => gameSnapshotFrame({ ...frame, flamePresentation: { ...frame.flamePresentation, replayRng: 42 } }), /replayRng/)
})
