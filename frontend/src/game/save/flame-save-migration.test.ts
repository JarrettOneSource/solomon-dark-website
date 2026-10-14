import assert from 'node:assert/strict'
import test from 'node:test'
import { drawNativeInteger } from '../core-kernels/native-rng.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { createNativeWeldChannelActor, stepNativeWeldWorldActor } from '../core-kernels/native-weld-primary-runtime.ts'
import { createNativeWeldFlameLashFade, nativeFlameLashFadeLight } from '../core-kernels/native-weld-flame-lash.ts'
import type { NativeWeldFlameLashFadeState } from '../core-kernels/native-weld-flame-lash.ts'
import { removePrimarySpellOwner } from '../core-kernels/primary-spells.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import type { GameSimulationState } from '../core-server/game-simulation.ts'
import { observeMlBotPolicyOwnEffects } from '../core-server/ml-bot-policy/own-effects.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { gameSnapshot } from '../protocol/codecs/snapshot.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from './game-save-document.ts'

const suppressed = { kind: 'legacy-suppressed' } as const
const vector = [8, 2, 1, .8, 0, 0, 0, 0]
const observationOptions = { playerId: 'owner', worldKey: 'hub:courtyard', position: { x: 0, y: 0 }, quickbar: [] }
function document(state: GameSimulationState) {
  return createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {}, playerId: 'owner', state })
}
function legacyState() {
  const source = createGameSimulation({ owner: { discipline: 'arcane', displayName: 'Flame recovery', element: 'fire' } })
  const order = createNativeWorldManagerOrder(source.worldManagerOrder)
  const channel = (id: number, ageTicks: number) => ({
    ...createNativeWeldChannelActor({ buildId: 1003, direction: { x: 1, y: 0 }, id, origin: { x: 10, y: 20 },
      ownerId: 'owner', targetId: `enemy:${id}`, tick: 1 - ageTicks, underpowered: false, vector,
      worldKey: 'hub:courtyard', midpoint: { x: 20, y: 20 }, endpoint: { x: 30, y: 20 }, enhancedEffects: true }),
    ageTicks, painterRegistrations: [order.register('actor')],
  })
  const born = createNativeWeldFlameLashFade({ direction: { x: 1, y: 0 }, id: 3, origin: { x: 30, y: 20 },
    ownerId: 'owner', rng: source.gameRng, tick: 1, variant: 'chain', vector, worldKey: 'hub:courtyard' }).actor
  const oldFade: NativeWeldFlameLashFadeState = { ...born, alpha: 1, baseScale: Math.fround(.1),
    flameVisual: suppressed, lightRegistration: null, painterRegistrations: [order.register('actor')] }
  const transients = [channel(2, 1), oldFade, channel(1, 0)]
  return { ...source, tick: 1, primarySpells: { nextId: 4, projectiles: [], transients }, worldManagerOrder: order.state() }
}

test('schema 45, 46 and 50 suppress unprovable Flame visuals without changing actors or ML observations', () => {
  const state = legacyState()
  const currentDocument = document(state)
  const baseline = restoreGameSaveDocument(currentDocument).state
  const before = observeMlBotPolicyOwnEffects(state, observationOptions)
  assert.equal(before.primaryEffectActive, true)
  assert.equal(before.blockR[19], 1)
  assert.equal(before.blockR[23 + 19], 1)
  for (const schemaVersion of [45, 46, 50]) {
    const saved = JSON.parse(currentDocument)
    saved.schemaVersion = schemaVersion
    const simulation = saved.continuation.simulation
    for (const actor of simulation.primarySpells.transients) {
      delete actor.flameVisual
      if (schemaVersion < 46 && actor.kind === 'weld-channel') delete actor.enhancedEffects
    }
    if (schemaVersion < 46) delete simulation.enhancedEffects
    if (schemaVersion < 47) delete simulation.screenFlashes
    const restored = restoreGameSaveDocument(JSON.stringify(saved)).state
    assert.deepEqual(restored.primarySpells, baseline.primarySpells)
    assert.deepEqual(restored.worldManagerOrder, baseline.worldManagerOrder)
    assert.deepEqual(restored.gameRng, drawNativeInteger(state.gameRng, 0x40000000).state)
    assert.deepEqual(restored.combatRng, baseline.combatRng)
    assert.deepEqual(observeMlBotPolicyOwnEffects(restored, observationOptions), before)
    assert.deepEqual(restored.primarySpells.transients.map(actor => actor.id), [2, 3, 1])
    assert.equal(restored.primarySpells.nextId, 4)
    for (const actor of restored.primarySpells.transients) {
      assert.ok(actor.kind === 'weld-channel' || actor.kind === 'weld-flame-lash-fade')
      assert.deepEqual(actor.flameVisual, suppressed)
      for (const forbidden of ['durationTicks', 'activeTicksRemaining', 'lifetimeTicks']) assert.equal(forbidden in actor, false)
      if (actor.kind === 'weld-flame-lash-fade') assert.equal(nativeFlameLashFadeLight(actor), null)
    }
    const snapshot = createGameSnapshot(restored, 'owner')
    assert.deepEqual(gameSnapshot(JSON.parse(JSON.stringify(snapshot))).primarySpells, restored.primarySpells)
  }
})

test('migrated Flame channels keep RNG-free ordinary expiry and owner teardown', () => {
  const state = restoreGameSaveDocument(document(legacyState())).state
  let primary = state.primarySpells
  for (let update = 1; update <= 2; update += 1) {
    primary = { ...primary, transients: primary.transients.flatMap(actor => {
      assert.ok(actor.kind === 'weld-channel' || actor.kind === 'weld-flame-lash-fade')
      const result = stepNativeWeldWorldActor(actor, state.gameRng)
      assert.deepEqual(result.rng, state.gameRng)
      return result.actor ? [result.actor] : []
    }) }
    assert.equal(primary.transients.filter(actor => actor.kind === 'weld-channel').length, 2 - update)
    const observed = observeMlBotPolicyOwnEffects({ ...state, primarySpells: primary }, observationOptions)
    assert.equal(observed.primaryEffectActive, update < 2)
    if (update < 2) assert.equal(observed.blockR[19], 1)
    assert.equal(primary.nextId, 4)
  }
  const removed = removePrimarySpellOwner(state.primarySpells, 'owner')
  assert.deepEqual(removed.transients, [])
  assert.equal(removed.nextId, 4)
  assert.equal(observeMlBotPolicyOwnEffects({ ...state, primarySpells: removed }, observationOptions).primaryEffectActive, false)
})

test('current saves preserve complete Flame births and reject absent samples or connection replay data', () => {
  const source = createGameSimulation({ owner: { discipline: 'arcane', displayName: 'Native Flame', element: 'fire' } })
  const order = createNativeWorldManagerOrder(source.worldManagerOrder)
  const creatorRegistration = order.register('actor')
  const point = { x: 10, y: 20 }
  const channel = { ...createNativeWeldChannelActor({ buildId: 1003, direction: { x: 1, y: 0 }, id: 1,
    origin: point, ownerId: 'owner', targetId: null, tick: 0, underpowered: false, vector, worldKey: 'hub:courtyard',
    midpoint: point, endpoint: point, flameVisual: { kind: 'native-birth-v1', role: 'main', cameraDisplacement: { x: 4, y: 0 },
      start: point, control: point, end: point, offset: { x: 0, y: 0 }, width: 1,
      ribbon: { kind: 'short', widthFactor: .75 }, path: { intensity: 1, radiusFactors: [], creatorRegistration, miscAppendOrdinal: 0 } } }),
    painterRegistrations: [order.register('actor')] }
  const born = createNativeWeldFlameLashFade({ direction: { x: 1, y: 0 }, id: 2, origin: point, ownerId: 'owner',
    registerWorldPainter: order.register, rng: source.gameRng, tick: 0, variant: 'endpoint', vector, worldKey: 'hub:courtyard' })
  const state = { ...source, primarySpells: { nextId: 3, projectiles: [], transients: [channel, born.actor] },
    worldManagerOrder: order.state() }
  const saved = document(state)
  const parsed = JSON.parse(saved)
  assert.equal('flamePresentationReplay' in parsed.continuation.simulation, false)
  assert.deepEqual(restoreGameSaveDocument(saved).state.primarySpells, state.primarySpells)
  for (const index of [0, 1]) {
    const missing = JSON.parse(saved)
    delete missing.continuation.simulation.primarySpells.transients[index].flameVisual
    assert.throws(() => restoreGameSaveDocument(JSON.stringify(missing)), /flameVisual|painter registrations/)
  }
  const missingWidth = JSON.parse(saved)
  delete missingWidth.continuation.simulation.primarySpells.transients[0].flameVisual.ribbon.widthFactor
  assert.throws(() => restoreGameSaveDocument(JSON.stringify(missingWidth)), /widthFactor/)
  parsed.continuation.simulation.flamePresentationReplay = { staleConnection: true }
  assert.throws(() => restoreGameSaveDocument(JSON.stringify(parsed)), /flamePresentationReplay/)
})
