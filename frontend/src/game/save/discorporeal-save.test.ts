import assert from 'node:assert/strict'
import test from 'node:test'
import { NATIVE_MAGE_ACTION_PROGRAMS } from '../core-server/enemies/programs.ts'
import { createNativeDemonSkullAction, type NativeDemonSkullActionKind } from '../core-kernels/native-demon-skull.ts'
import { receiveNativePuppetHit, NATIVE_WORLD_PUPPET_HIT_KINDS } from '../core-kernels/native-puppet-hit.ts'
import { NATIVE_SURVIVAL_BOSS_SOURCES } from '../core-kernels/native-survival-boss-catalog.ts'
import { nativeDiscorporealRecipe } from '../core-kernels/native-survival-discorporeal.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { stepBoneyardEnemyStore } from '../core-server/boneyard-enemy-store.ts'
import { createGameSimulation, enterBoneyardWorld, type GameSimulationState } from '../core-server/game-simulation.ts'
import { damageBoneyardEnemy } from '../core-server/enemies/damage.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../host/boneyard-catalog.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from './game-save-document.ts'

const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16, 69))!
const players = { owner: { alive: true, connected: true, eligible: true, collisionRadius: 25,
  position: { x: 0, y: -200 }, headingDeg: 0, velocityPerTick: { x: 0, y: 0 } } }
const context = { players, lightAt: () => 1, projectileWorldBlocked: () => false,
  clipSpellSegment: ({ end }: { end: Readonly<{ x: number; y: number }> }) => end,
  resolveMovement: ({ requestedPosition }: { requestedPosition: Readonly<{ x: number; y: number }> }) => requestedPosition,
  nativeViewBounds: { x: -800, y: -500, w: 1600, h: 1000 }, resolveSpawnIntents: () => [] }

function fixture(kind: NativeDemonSkullActionKind | 'death' | 'mega') {
  const state = enterBoneyardWorld(createGameSimulation({ owner: {
    displayName: 'Discorporeal save', element: 'fire', discipline: 'arcane',
  } }), loaded)
  if (state.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  let enemies = stepBoneyardEnemyStore(state.world.enemies, { ...context, tick: 0,
    registerWorldPainter: order.register,
    resolveSpawnIntents: () => [{ enemyToken: 'DEMONSKULL', nativeTypeId: 1008, flags: [], id: 1,
      authoredRecipe: nativeDiscorporealRecipe(NATIVE_SURVIVAL_BOSS_SOURCES[0]!.sourceSha256),
      enableDiscorporealHealthGates: true, locationPolicy: 'anywhere', position: { x: 0, y: 0 }, spawnTick: 0, waveOrdinal: 38 }],
  }).store
  enemies = { ...enemies, actors: enemies.actors.map(actor => {
    if (actor.brain.family !== 'demon-skull') throw new Error('Expected Discorporeal')
    return { ...actor, targetPlayerId: 'owner', headingDeg: 0, brain: { ...actor.brain,
      bodyHeadingDeg: 0, pendingAttack: null, capabilities: kind === 'mega' ? 16 : 0,
      actions: kind === 'death' || kind === 'mega' ? [] : [createNativeDemonSkullAction(kind, 0, 0, 1, 123)] } }
  }) }
  if (kind === 'death' || kind === 'mega') {
    enemies = damageBoneyardEnemy(enemies, { actorId: 1, amount: 20000, sourcePlayerId: 'owner', tick: 0 }).store
  }
  return { ...state, world: { ...state.world, enemies }, worldManagerOrder: order.state() }
}

function advance(state: GameSimulationState) {
  if (state.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const tick = state.tick + 1
  const result = stepBoneyardEnemyStore(state.world.enemies, { ...context, tick, registerWorldPainter: order.register })
  return { state: { ...state, tick, world: { ...state.world, enemies: result.store }, worldManagerOrder: order.state() }, result }
}

function save(state: GameSimulationState) {
  return createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: loaded,
    mods: [], modState: {}, playerId: 'owner', state })
}

for (const [kind, age] of [
  ['bite', 20], ['eyes', 61], ['mouth', 301], ['spit', 40], ['flair', 201], ['scream', 0], ['death', 401], ['mega', 603],
] as const) {
  test(`Discorporeal ${kind} resumes the live action, RNG, descendants and audio without replaying births`, () => {
    let original: GameSimulationState = fixture(kind)
    for (let tick = 0; tick < age; tick += 1) original = advance(original).state
    let restored = restoreGameSaveDocument(save(original)).state
    if (original.world.kind !== 'boneyard' || restored.world.kind !== 'boneyard') throw new Error('Expected saved Boneyard')
    assert.deepEqual(restored.world.enemies, original.world.enemies)
    if (kind === 'mega') assert.ok(restored.world.enemies.bossSpells.some(spell => spell.kind === 'ultra-banish' && spell.megaDeath))
    for (let tick = 0; tick < 30; tick += 1) {
      const expected = advance(original)
      const actual = advance(restored)
      assert.deepEqual(actual.result, expected.result, `continuation tick ${tick}`)
      original = expected.state
      restored = actual.state
    }
  })
}

test('Discorporeal saves reject malformed private brain and action fields', () => {
  const document = save(fixture('mouth'))
  const edits: ReadonlyArray<(brain: Record<string, any>) => void> = [
    brain => { brain.capabilities = 64 },
    brain => { brain.pendingAttack = 'flair' },
    brain => { brain.phase = 'unrecognized' },
    brain => { brain.recoil.x = 'left' },
    brain => { brain.seen = 1 },
    brain => { brain.deathCountdown = 1.5 },
    brain => { delete brain.actions },
    brain => { brain.actions[0].kind = 'unrecognized' },
    brain => { brain.actions[0].warmupTicks = 1.5 },
    brain => { brain.actions[0].retired = 'false' },
    brain => { brain.actions[0].beamPower = null },
    brain => { brain.actions[0].extraField = 1 },
  ]
  for (const edit of edits) {
    const invalid = JSON.parse(document)
    edit(invalid.continuation.simulation.world.enemies.actors[0].brain)
    assert.throws(() => restoreGameSaveDocument(JSON.stringify(invalid)), /saved Discorporeal/)
  }
})

test('native signed Mouth and Spit counters survive the save boundary', () => {
  for (const kind of ['mouth', 'spit'] as const) {
    const document = JSON.parse(save(fixture(kind)))
    const action = document.continuation.simulation.world.enemies.actors[0].brain.actions[0]
    if (kind === 'mouth') Object.assign(action, {
      warmupTicks: 0, warmupTurnSpeed: -.003, beamPower: -.014, trackingDelayTicks: -516, recoveryTicks: -1, retired: true,
    })
    else Object.assign(action, { cooldownTicks: -1000, mouthTicks: -1 })
    const restored = restoreGameSaveDocument(JSON.stringify(document)).state
    if (restored.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
    const brain = restored.world.enemies.actors[0]!.brain
    assert.ok(brain.family === 'demon-skull')
    assert.deepEqual(brain.actions[0], action)
  }
})

test('legacy query caches gain native Fenceposts and discard obsolete Goodie scenery aliases', () => {
  const state = fixture('scream')
  const document = JSON.parse(save(state))
  document.schemaVersion = 33
  const world = document.continuation.simulation.world
  world.primarySceneryTargets = world.primarySceneryTargets.filter((target: { id: string }) => !target.id.startsWith('fencepost:'))
  world.primarySceneryTargets.push({ ...state.world.primarySceneryTargets[0], id: 'scenery:obsolete-goodie', actorFlags: 4, bodyRadius: 20 })
  const restored = restoreGameSaveDocument(JSON.stringify(document)).state
  if (restored.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  assert.deepEqual(restored.world.primarySceneryTargets, state.world.primarySceneryTargets)
})

test('generic Puppet hit saves require a live owner of the recorded kind', () => {
  const state = fixture('mouth')
  const prefixes = { scenery: 'scenery:', goodie: 'goodie:', arrow: 'projectile:', firebolt: 'projectile:', meteor: 'primary:', leviathan: 'secondary:' }
  for (const kind of NATIVE_WORLD_PUPPET_HIT_KINDS) {
    const document = JSON.parse(save(state))
    document.continuation.simulation.world.enemies.puppetHits = [{
      kind, targetId: `${prefixes[kind]}999999`, hitTick: 0, feedback: receiveNativePuppetHit(0),
    }]
    assert.throws(() => restoreGameSaveDocument(JSON.stringify(document)), /saved Puppet hit owner/)
  }
  const targetId = state.world.primarySceneryTargets[0]!.id
  const current = { ...state, world: { ...state.world, enemies: { ...state.world.enemies,
    puppetHits: [{ kind: 'scenery' as const, targetId, hitTick: 0, feedback: receiveNativePuppetHit(0, .25) }],
  } } }
  const restored = restoreGameSaveDocument(save(current)).state
  if (restored.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  assert.deepEqual(restored.world.enemies.puppetHits, current.world.enemies.puppetHits)
})

test('Firebolt private trails retain their parent painter through saves and reject detached ownership', () => {
  let state: GameSimulationState = fixture('scream')
  if (state.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const spawned = stepBoneyardEnemyStore(state.world.enemies, { ...context, tick: 1, registerWorldPainter: order.register,
    resolveSpawnIntents: () => [{ enemyToken: 'SKELETONMAGE', nativeTypeId: 1003, flags: ['FLAG_CASTFIRE'], id: 2,
      locationPolicy: 'anywhere', position: { x: 0, y: 0 }, spawnTick: 1, waveOrdinal: 0 }],
  }).store
  state = { ...state, tick: 1, worldManagerOrder: order.state(), world: { ...state.world, enemies: { ...spawned,
    actors: spawned.actors.map(actor => actor.brain.family !== 'mage' ? actor : { ...actor, targetPlayerId: 'owner',
      brain: { ...actor.brain, phase: 'cast', castProgram: 'short', castRoll: 0, markerEmitted: false,
        actionProgress: NATIVE_MAGE_ACTION_PROGRAMS.short.markerProgress } }),
  } } }
  state = advance(advance(advance(state).state).state).state
  const document = save(state)
  const restored = restoreGameSaveDocument(document).state
  if (restored.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  const trail = restored.world.enemies.projectileEffects.find(effect => effect.kind === 'firebolt-trail')!
  assert.ok(trail)
  const parent = restored.world.enemies.projectiles.find(projectile => projectile.id === trail.ownerProjectileId)!
  assert.equal(parent.kind, 'firebolt')
  assert.deepEqual(trail.painterRegistration, parent.painterRegistration)
  for (const breakParent of [false, true]) {
    const invalid = JSON.parse(document)
    const enemies = invalid.continuation.simulation.world.enemies
    if (breakParent) enemies.projectiles = []
    else enemies.projectileEffects.find((effect: { kind: string }) => effect.kind === 'firebolt-trail').painterRegistration.registrationOrdinal += 1
    assert.throws(() => restoreGameSaveDocument(JSON.stringify(invalid)), /Firebolt trail/)
  }
})
