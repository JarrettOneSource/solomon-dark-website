import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeDemonSkullAction, type NativeDemonSkullAction } from '../core-kernels/native-demon-skull.ts'
import { NATIVE_SURVIVAL_BOSS_SOURCES } from '../core-kernels/native-survival-boss-catalog.ts'
import { nativeDiscorporealRecipe } from '../core-kernels/native-survival-discorporeal.ts'
import { projectBoneyardEnemies } from '../host/project-boneyard-enemies.ts'
import { boneyardEnemyDescriptor, boneyardEnemySample, materializeBoneyardEnemy } from '../protocol/boneyard-enemy-replication.ts'
import { nativeBossSpells } from '../protocol/codecs/boss-spells.ts'
import { boneyardEnemySnapshot } from '../protocol/codecs/enemies.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from './boneyard-enemy-store.ts'
import { damageBoneyardEnemy } from './enemies/damage.ts'
import type { BoneyardDemonSkullActor, BoneyardEnemyStore, BoneyardEnemyStoreStepContext } from './enemies/model.ts'
import type { BoneyardEnemyProjectile } from './enemies/model.ts'
import { boneyardPuppetTarget } from './boneyard-world-targets.ts'
import { boneyardMouthTargets, hitBoneyardPuppet, stepBoneyardPuppetHits } from './enemies/puppet-hits.ts'
import { createEnemyWork } from './enemies/work.ts'
import { bindWorldPuppetTargets } from './enemies/registration.ts'
import { spawnDemonSkullBeamSegments } from './enemies/demon-skull-effects.ts'
import { createNativeGuidedMissile } from '../core-kernels/native-guided-missile.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createNativeSilk } from '../core-kernels/native-silk.ts'
import { nativePrimaryPolygonTargets } from '../core-kernels/primary-spell-targeting.ts'

const sha = NATIVE_SURVIVAL_BOSS_SOURCES[0]!.sourceSha256
const context: BoneyardEnemyStoreStepContext = {
  tick: 0, nativeViewBounds: { x: -800, y: -500, w: 1600, h: 1000 },
  projectileWorldBlocked: () => false, clipSpellSegment: ({ end }) => end,
  players: { player: { alive: true, connected: true, eligible: true, collisionRadius: 25,
    headingDeg: 0, position: { x: 0, y: -200 }, velocityPerTick: { x: 0, y: 0 } } },
  resolveMovement: ({ requestedPosition }) => requestedPosition, resolveSpawnIntents: () => [],
}
function spawned(): BoneyardEnemyStore {
  return stepBoneyardEnemyStore(createBoneyardEnemyStore('discorporeal'), { ...context,
    resolveSpawnIntents: () => [{ enemyToken: 'DEMONSKULL', nativeTypeId: 1008, flags: [], id: 1,
      authoredRecipe: nativeDiscorporealRecipe(sha), enableDiscorporealHealthGates: true,
      locationPolicy: 'anywhere', position: { x: 0, y: 0 }, spawnTick: 0, waveOrdinal: 38 }],
  }).store
}
function editActor(store: BoneyardEnemyStore, edit: (actor: BoneyardDemonSkullActor) => BoneyardDemonSkullActor): BoneyardEnemyStore {
  return { ...store, actors: store.actors.map(actor => {
    if (actor.config.enemyToken !== 'DEMONSKULL' || actor.brain.family !== 'demon-skull') return actor
    return edit({ ...actor, config: actor.config, brain: actor.brain })
  }) }
}
function action(kind: NativeDemonSkullAction['kind']): NativeDemonSkullAction {
  return createNativeDemonSkullAction(kind, 0, 0, 1, 123)
}
function setActions(store: BoneyardEnemyStore, actions: readonly NativeDemonSkullAction[]): BoneyardEnemyStore {
  return editActor(store, actor => ({ ...actor, targetPlayerId: 'player', headingDeg: 0,
    brain: { ...actor.brain, actions, bodyHeadingDeg: 0, pendingAttack: null } }))
}
function step(store: BoneyardEnemyStore, override: Partial<BoneyardEnemyStoreStepContext> = {}) {
  return stepBoneyardEnemyStore(store, { ...context, tick: store.lastStepTick + 1, ...override })
}

function queryProjectile(kind: BoneyardEnemyProjectile['kind'], id: number): BoneyardEnemyProjectile {
  const source = { ageTicks: 0, bounceVelocity: 0, chillTumbleAccumulator: 0, coldSlowTicks: 0,
    contactRadius: 5, damage: 1, secondaryDamage: 0, headingDeg: 0, hitPlayerIds: [], homing: false,
    id, lastStepTick: 25, lightRegistration: null, lifetimeTicks: 100, minimumSpeed: 0, nativeTypeId: 0x7da as const,
    nativeCellBindingOrder: id, nativeRegistrationOrder: id, ownerActorId: 1,
    painterRegistration: { managerLane: kind === 'arrow' || kind === 'firebolt' ? 'transient' as const : 'actor' as const, registrationOrdinal: id },
    payload: 'normal' as const, poisonDamage: 0, poisonDuration: 0, position: { x: 0, y: -100 },
    speed: 0, settledTicksRemaining: 0, spawnTick: 25, targetPlayerId: null, turnSpeed: 0,
    verticalOffset: 0, verticalVelocity: 0, visualPhaseDeg: 0, visualScale: 1 }
  return kind === 'arrow' ? { ...source, kind, velocity: { x: 0, y: 0 } } : { ...source, kind }
}

test('Mouth preserves grid and transient admission, callback disposition, and non-HP owner clocks', () => {
  const work = createEnemyWork(spawned(), context, true)
  work.projectiles = (['arrow', 'firebolt', 'guided-missile', 'demon-bomb', 'poison-pool'] as const)
    .map((kind, index) => queryProjectile(kind, index + 10))
  const owner = { id: 20, ageTicks: 0, damage: 1, ownerActorId: 1, spawnTick: 25, position: { x: 0, y: -100 },
    painterRegistration: { managerLane: 'transient' as const, registrationOrdinal: 20 } }
  work.bossSpells = [
    { ...owner, kind: 'eye-laser', headingDeg: 0, phaseDeg: 0, velocity: { x: 0, y: -1 } },
    { ...owner, id: 21, kind: 'skull-missile', painterRegistration: { managerLane: 'actor', registrationOrdinal: 21 },
      ...createNativeGuidedMissile(createNativeRng(1), owner.position, 0, 1).state, targetPlayerId: null },
  ]
  work.targetCellBindings = { ...work.targetCellBindings, 'boss-spell:21': { cellX: 0, cellY: -1, order: 21 } }
  work.silks = [{ id: 22, ownerActorId: 1, spawnTick: 25,
    state: createNativeSilk(owner.position, context.players.player!, 20, createNativeRng(1)).state,
    painterRegistration: { managerLane: 'actor', registrationOrdinal: 22 }, nativeCellBindingOrder: 22, nativeRegistrationOrder: 22 }]
  const puppetTargets = [
    boneyardPuppetTarget('scenery:tree', owner.position, 4, 30, 'scenery'),
    boneyardPuppetTarget('fencepost:1', owner.position, 4, 31, 'scenery'),
    boneyardPuppetTarget('goodie:1', owner.position, 0x2004, 32, 'goodie'),
    boneyardPuppetTarget('primary:1', owner.position, 8, 33, 'meteor'),
    boneyardPuppetTarget('secondary:1', owner.position, 0x200, 34, 'leviathan'),
  ]
  bindWorldPuppetTargets(work, puppetTargets)
  const current = { ...context, puppetTargets, tick: 25 }
  const targets = boneyardMouthTargets(work, current, 1)
  const polygon = [{ x: -100, y: -250 }, { x: 100, y: -250 }, { x: 100, y: 0 }, { x: -100, y: 0 }]
  const selected = nativePrimaryPolygonTargets({ targets, polygon, actorMask: 0xffffffff })
  assert.deepEqual(selected.slice(-3).map(target => target.id), ['projectile:10', 'projectile:11', 'boss-spell:20'])
  assert.ok(selected.some(target => target.id === 'projectile:12' && target.queryLane === 'grid'))
  assert.ok(selected.some(target => target.id === 'boss-spell:21' && target.queryLane === 'grid'))
  assert.ok(selected.some(target => target.id === 'silk:22'))
  assert.equal(selected.some(target => target.id === 'projectile:13' || target.id === 'projectile:14' || target.id === 'enemy:1'), false)
  for (const target of selected) hitBoneyardPuppet(work, target, 25, 1)
  assert.deepEqual(work.puppetHits.map(hit => hit.kind).sort(), ['arrow', 'firebolt', 'goodie', 'leviathan', 'meteor', 'scenery', 'scenery'])
  stepBoneyardPuppetHits(work, current)
  for (const hit of work.puppetHits) {
    assert.equal(hit.feedback.strength, 1)
    assert.equal(hit.feedback.timer, hit.kind === 'meteor' || hit.kind === 'leviathan' ? 1 : Math.fround(.95))
  }
  work.projectiles = []
  stepBoneyardPuppetHits(work, { ...current, puppetTargets: [], tick: 26 })
  assert.deepEqual(work.puppetHits, [])
})

test('Discorporeal source membership, authored lanes and full/compact visual state agree', () => {
  assert.equal(NATIVE_SURVIVAL_BOSS_SOURCES.length, 12)
  for (const source of NATIVE_SURVIVAL_BOSS_SOURCES) {
    const recipe = nativeDiscorporealRecipe(source.sourceSha256)
    assert.equal(recipe.maximumHealth, 17500)
    assert.deepEqual([recipe.primaryDamage, recipe.secondaryDamage, recipe.tertiaryDamage, recipe.extraDamage], [45, 45, 20, 10])
  }
  const store = spawned()
  const [snapshot] = projectBoneyardEnemies(store, 0)
  assert.ok(snapshot)
  assert.equal(snapshot.enemyToken, 'DEMONSKULL')
  assert.deepEqual(snapshot.demonSkull?.bodyOffset, { x: 0, y: 25 })
  assert.deepEqual(boneyardEnemySnapshot(JSON.parse(JSON.stringify(snapshot)), 'boss'), snapshot)
  const restored = materializeBoneyardEnemy(boneyardEnemyDescriptor(snapshot), boneyardEnemySample(snapshot))
  assert.equal(restored.demonSkull?.bodyHeadingDeg, -1)
  assert.deepEqual(restored.demonSkull?.bodyOffset, snapshot.demonSkull?.bodyOffset)
})

test('the ordered action list preserves overlapping Bite and Eye dispatch and removes retired entries next tick', () => {
  const bite = action('bite'); const eyes = action('eyes')
  assert.equal(bite.kind, 'bite'); assert.equal(eyes.kind, 'eyes')
  if (bite.kind !== 'bite' || eyes.kind !== 'eyes') throw new Error('action fixture')
  let store = setActions(spawned(), [{ ...bite, progress: 3.9 }, { ...eyes, warmupTicks: 0, shotsRemaining: 1 }])
  store = editActor(store, actor => ({ ...actor, brain: { ...actor.brain, eyeCharge: .99 } }))
  const result = step(store)
  assert.equal(result.store.bossSpells.filter(spell => spell.kind === 'eye-laser').length, 2)
  assert.equal(result.playerDamage[0]?.physicalDamage, 45)
  const actor = result.store.actors[0]!
  assert.equal(actor.brain.family, 'demon-skull')
  if (actor.brain.family !== 'demon-skull') throw new Error('boss')
  assert.deepEqual(actor.brain.actions.map(value => value.kind), ['bite', 'eyes'])
  const retiring = setActions(result.store, [{ ...bite, progress: 13 }, { ...eyes, shotsRemaining: 0, warmupTicks: 0, recoveryTicks: 1 }])
  const retired = step(retiring).store
  const retiredBrain = retired.actors[0]!.brain
  assert.ok(retiredBrain.family === 'demon-skull' && retiredBrain.actions.every(value => value.retired))
  const removed = step(retired).store.actors[0]!.brain
  assert.ok(removed.family === 'demon-skull' && removed.actions.length === 0)
})

test('Mouth hits friendly enemies during its turn, excludes itself, creates target fire and expires into recovery', () => {
  let store = spawned()
  store = step(store, { resolveSpawnIntents: () => [{ enemyToken: 'SKELETON', nativeTypeId: 1001, flags: [], id: 2,
    locationPolicy: 'anywhere', position: { x: 0, y: -120 }, spawnTick: 1, waveOrdinal: 0 }] }).store
  const mouth = action('mouth')
  if (mouth.kind !== 'mouth') throw new Error('mouth')
  store = setActions(store, [{ ...mouth, warmupTicks: 0 }])
  store = { ...store, lastStepTick: 24 }
  const result = step(store)
  assert.equal(result.store.actors.find(actor => actor.config.enemyToken === 'SKELETON')?.currentHealth, 1)
  assert.equal(result.store.actors[0]!.currentHealth, 17500)
  assert.equal(result.playerDamage[0]?.magicDamage, 4)
  assert.ok(result.store.bossSpells.some(spell => spell.kind === 'green-fire'))
  assert.ok(result.store.bossSpells.some(spell => spell.kind === 'mouth-beam-segment'))
  assert.doesNotThrow(() => nativeBossSpells(JSON.parse(JSON.stringify(result.store.bossSpells)), 'spells', 25))
  const ending = setActions(result.store, [{ ...mouth, warmupTicks: 0, beamPower: .001 }])
  const ended = step(ending).store.actors[0]!.brain
  assert.ok(ended.family === 'demon-skull' && ended.bodyPose === 0)
  if (ended.family === 'demon-skull') assert.deepEqual(ended.bodyOffset, { x: 0, y: 0 })
})

test('Mouth segment vertices, UVs and endpoint fades join continuously in every heading quadrant', () => {
  const store = spawned()
  const source = store.actors[0]!
  if (source.brain.family !== 'demon-skull' || source.config.enemyToken !== 'DEMONSKULL') throw new Error('Expected Discorporeal')
  for (const headingDeg of [0, 30, 90, 180, 270]) {
    const work = createEnemyWork(store, context, true)
    const actor: BoneyardDemonSkullActor = { ...source, brain: source.brain, config: source.config, headingDeg }
    spawnDemonSkullBeamSegments(work, actor, 37, 512, .5)
    const segments = work.bossSpells.filter(spell => spell.kind === 'mouth-beam-segment')
    assert.equal(segments.length, 4)
    assert.equal(segments[0]!.endAlpha, 0, 'native +0x64 clears the first near pair')
    assert.equal(segments.at(-1)!.startAlpha, 0, 'native +0x60 fades the final far pair')
    assert.deepEqual(segments.map(segment => [segment.startAlpha, segment.endAlpha]), [[.5, 0], [.5, .5], [.32, .5], [0, .32]])
    const angle = headingDeg * Math.PI / 180
    for (const [index, segment] of segments.entries()) {
      assert.equal(segment.uvOffset, .48)
      if (index > 0) assert.equal(segments[index - 1]!.startAlpha, segment.endAlpha)
      for (const [vertexIndex, vertex] of segment.vertices.entries()) {
        const distance = (vertex.x - actor.position.x) * Math.sin(angle)
          - (vertex.y - actor.position.y + 40) * Math.cos(angle)
        assert.ok(Math.abs(distance - (index + (vertexIndex < 2 ? 1 : 0)) * 128) < .0001)
      }
    }
  }
})

test('the enemy damage receiver retains Mouth hit strength and the subsequent native owner update', () => {
  let store = step(spawned(), { resolveSpawnIntents: () => [{ enemyToken: 'SKELETON', nativeTypeId: 1001,
    flags: [], id: 2, locationPolicy: 'anywhere', position: { x: 0, y: -120 }, spawnTick: 1, waveOrdinal: 0 }] }).store
  store = damageBoneyardEnemy(store, { actorId: 2, amount: 1, sourcePlayerId: null,
    hitStrength: .25, tick: 1 }).store
  assert.equal(projectBoneyardEnemies(store, 1).find(actor => actor.id === 2)?.animation.hitFlash, .25)
  store = step(store).store
  assert.equal(projectBoneyardEnemies(store, 2).find(actor => actor.id === 2)?.animation.hitFlash, .23749999701976776)
})

test('Spit uses the shared green Fire and Imp variants, and its descendants outlive the caster', () => {
  const spit = action('spit')
  if (spit.kind !== 'spit') throw new Error('spit')
  let store = setActions(spawned(), [{ ...spit, shotsRemaining: 1 }])
  store = editActor(store, actor => ({ ...actor, brain: { ...actor.brain, capabilities: 15 } }))
  const player = context.players.player!
  store = step(store, { players: { player: { ...player, position: { x: 0, y: -200 }, velocityPerTick: { x: 0, y: -.1 } } } }).store
  assert.equal(store.bossSpells.filter(spell => spell.kind === 'unholy-spit').length, 1)
  store = { ...store, actors: [] }
  for (let tick = 0; tick < 100 && !store.actors.some(actor => actor.config.nativeTypeId === 2044); tick += 1) store = step(store).store
  const imps = store.actors.filter(actor => actor.config.nativeTypeId === 2044)
  assert.ok(imps.length > 0)
  assert.ok(imps.every(actor => actor.brain.family === 'imp' && actor.config.primaryDamage === .5 && actor.config.experience === .5))
  assert.ok(store.bossSpells.some(spell => spell.kind === 'green-fire'))
  for (const snapshot of projectBoneyardEnemies(store, store.lastStepTick)) {
    assert.doesNotThrow(() => boneyardEnemySnapshot(JSON.parse(JSON.stringify(snapshot)), 'imp'))
    assert.equal(materializeBoneyardEnemy(boneyardEnemyDescriptor(snapshot), boneyardEnemySample(snapshot)).nativeTypeId, 2044)
  }
  for (let tick = 0; tick < 10; tick += 1) {
    store = step(store).store
    assert.deepEqual(nativeBossSpells(JSON.parse(JSON.stringify(store.bossSpells)), 'spells', store.lastStepTick), store.bossSpells)
  }
})

test('death follows the shared stream, retains the complete head, and retires before UltraBanish finishes', () => {
  let store = damageBoneyardEnemy(spawned(), { actorId: 1, amount: 20000, sourcePlayerId: 'player', tick: 0 }).store
  for (let tick = 1; tick <= 401; tick += 1) store = step(store).store
  const brain = store.actors[0]!.brain
  assert.ok(brain.family === 'demon-skull' && brain.bodyPose === 2 && brain.deathCountdown === 599)
  for (let tick = 402; tick <= 601; tick += 1) store = step(store).store
  assert.equal(store.actors.length, 1)
  assert.equal(store.bossSpells.filter(spell => spell.kind === 'ultra-banish').length, 1)
  const next = step(store)
  assert.equal(next.store.actors.length, 0)
  assert.equal(next.rewards.length, 1)
  assert.ok(next.store.bossSpells.some(spell => spell.kind === 'ultra-banish'))
  assert.doesNotThrow(() => nativeBossSpells(JSON.parse(JSON.stringify(next.store.bossSpells)), 'spells', 602))
  store = next.store
  for (let tick = 0; tick < 155; tick += 1) store = step(store).store
  assert.ok(store.bossSpells.every(spell => spell.kind !== 'ultra-banish'))
})

test('mega UltraBanish uses background Bouncers with the native long fade and separate bounce impulse', () => {
  const base = spawned()
  const bossSpells = [{ kind: 'ultra-banish' as const, id: 10, ageTicks: 0, spawnTick: 0,
    ownerActorId: 1, damage: 0, position: { x: 0, y: 0 },
    painterRegistration: { managerLane: 'transient' as const, registrationOrdinal: 10 },
    alpha: 1, flashAlpha: 1.5, lightRadius: 1, remainingTicks: 2000, megaDeath: true }]
  const next = step({ ...base, actors: [], bossSpells, nextProjectileId: 11 }).store
  const bones = next.deathEffects.filter(effect => effect.role === 'ultra-banish-bone')
  assert.equal(bones.length, 1)
  assert.equal(bones[0]!.presentationOwner, 'background')
  assert.equal(bones[0]!.painterRegistration, null)
  assert.ok(bones[0]!.lifetimeTicks > 1300)
  assert.ok(bones[0]!.bounceVelocity < bones[0]!.verticalVelocity * 3)
  assert.ok(bones[0]!.entry >= 1819 && bones[0]!.entry <= 1822)
})
