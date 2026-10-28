import assert from 'node:assert/strict'
import test from 'node:test'
import { BONEYARD_WAVE_ENEMY_TYPES, type BoneyardEnemySpawnIntent } from '../core-kernels/boneyard-wave-director.ts'
import type { NativeWeldPrimarySkillProfile } from '../core-kernels/native-primary-skill-profile.ts'
import { advanceNativeRngWords, createNativeRng, drawNativeFloat } from '../core-kernels/native-rng.ts'
import { createNativeFireDetonation, stepNativeFireEmber } from '../core-kernels/primary-spell-fire-effects.ts'
import { createNativeWeldChannelActor } from '../core-kernels/native-weld-primary-runtime.ts'
import { createPrimarySpellWeldFireDetonation, createPrimarySpellWeldSteamDetonation, type PrimarySpellChannelEmission, type PrimarySpellFireExplosionState, type PrimarySpellSimulationState, type PrimarySpellTransientState } from '../core-kernels/primary-spells.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from './boneyard-enemy-store.ts'
import { resolveBoneyardSpellCombat } from './boneyard-spell-combat.ts'
import { damageBoneyardEnemy } from './enemies/damage.ts'
import type { BoneyardEnemyStore } from './enemies/model.ts'

const WORLD = 'boneyard:report118'
function spawn(points: readonly { x: number; y: number }[], health = 100): BoneyardEnemyStore {
  const store = stepBoneyardEnemyStore(createBoneyardEnemyStore('report118'), {
    projectileWorldBlocked: () => false, players: {},
    resolveMovement: request => request.requestedPosition,
    resolveSpawnIntents: () => points.map((position, index): BoneyardEnemySpawnIntent => ({
      enemyToken: 'SKELETON', flags: [], id: index + 1, locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON, position, spawnTick: 0, waveOrdinal: 1,
    })), tick: 0,
  }).store
  return { ...store, actors: store.actors.map(actor => ({ ...actor, currentHealth: health })) }
}
function spells(transients: readonly PrimarySpellTransientState[] = []): PrimarySpellSimulationState {
  return { nextId: 100, projectiles: [], transients }
}
function flame(source: BoneyardEnemyStore, options: {
  arcs?: number; damage?: number; explode?: number; radius?: number; fragments?: number; weak?: boolean
  deferred?: boolean; targetId?: string | null; endpoint?: { x: number; y: number } | null
} = {}) {
  const vector = [200, 10, options.arcs ?? 1, .4, options.explode ?? .01, options.radius ?? 8, 2, options.fragments ?? 3]
  const profile: NativeWeldPrimarySkillProfile = {
    buildId: 1003, castKind: 'channel', damageFactor: 1, damageMaximum: 200,
    damageMinimum: 200, damageRollCount: 1, kind: 'weld', manaCost: 10, rank: 1,
    skillId: 1003, vector: { buildId: 1003, castKind: 'channel', values: vector },
  }
  const origin = { x: 0, y: 0 }
  const endpoint = options.endpoint === undefined ? { x: 20, y: -20 } : options.endpoint
  const body = createNativeWeldChannelActor({
    buildId: 1003, direction: { x: 1, y: 0 }, endpoint, id: 10,
    midpoint: { x: 10, y: -10 }, origin, ownerId: 'wizard', targetId: 'enemy:1',
    tick: 1, underpowered: options.weak ?? false, vector, worldKey: WORLD,
  })
  const emission: PrimarySpellChannelEmission = {
    ...(options.deferred ? { flameLashPresentation: { midpoint: { x: 10, y: -10 }, targetId: options.targetId === undefined ? 'enemy:1' : options.targetId } } : {}),
    damage: options.damage ?? 2, direction: { x: 1, y: 0 }, endpoint, id: 10,
    kind: 'weld', manaCost: .1, origin, ownerId: 'wizard', primarySkill: profile,
    queryOrigin: origin, terrainContact: false, underpowered: options.weak ?? false, worldKey: WORLD,
  }
  return resolveBoneyardSpellCombat(source, spells(options.deferred ? [] : [body]), [emission], 1, WORLD, createNativeRng(17))
}
function count(result: ReturnType<typeof flame>, kind: PrimarySpellTransientState['kind']) {
  return result.spells.transients.filter(effect => effect.kind === kind).length
}
function explosion(presentation: 'fire' | 'steam', scale = 1): PrimarySpellFireExplosionState {
  return { ageTicks: 0, burnDamage: 0, damage: 6, footprintDimension: scale * 110, id: 90,
    kind: 'fire-explosion', lightRegistration: { managerLane: 'transient', registrationOrdinal: 90 },
    origin: { x: 0, y: 0 }, ownerId: 'wizard', presentation, soundPitch: 1, visualScale: scale, worldKey: WORLD }
}
function area(source: BoneyardEnemyStore, presentation: 'fire' | 'steam' = 'fire', scale = 1) {
  return resolveBoneyardSpellCombat(source, spells([explosion(presentation, scale)]), [], 1, WORLD, createNativeRng(17))
}

test('report118: nonlethal Flame contacts never dispatch Explode or Embers', () => {
  const result = flame(spawn([{ x: 20, y: 0 }, { x: 100, y: 0 }]))
  assert.equal(result.hits.length, 2)
  assert.equal(count(result, 'fire-explosion'), 0)
  assert.equal(count(result, 'fire-ember'), 0)
})
test('report118: main death and chain death use root XY and truncated main/half fragment counts', () => {
  const result = flame(spawn([{ x: 20, y: 0 }, { x: 100, y: 0 }], 1), { fragments: 3.9 })
  assert.equal(count(result, 'fire-explosion'), 2)
  assert.equal(count(result, 'fire-ember'), 4)
  assert.deepEqual(result.spells.transients.filter(effect => effect.kind === 'fire-explosion').map(effect => effect.origin),
    [{ x: 20, y: 0 }, { x: 100, y: 0 }])
})
test('report118: weak Flame suppresses Stun and chains but preserves its main death payload', () => {
  const source = spawn([{ x: 20, y: 0 }, { x: 100, y: 0 }])
  const weak = flame(source, { weak: true, damage: 1 })
  assert.deepEqual(weak.hits.map(hit => hit.actorId), [1])
  assert.equal(weak.targetEffects.length, 0)
  const killed = flame({ ...source, actors: source.actors.map((actor, index) => ({ ...actor, currentHealth: index === 0 ? .5 : 100 })) },
    { weak: true, damage: 1 })
  assert.equal(count(killed, 'fire-explosion'), 1)
  assert.equal(count(killed, 'fire-ember'), 3)
})
test('report118: Embers alone do not install a Flame special-death context', () => {
  const result = flame(spawn([{ x: 20, y: 0 }], 1), { arcs: 0, explode: 0 })
  assert.equal(count(result, 'fire-explosion'), 0)
  assert.equal(count(result, 'fire-ember'), 0)
})
test('report118: shield and armor-break do not admit a Flame terminal payload', () => {
  const source = spawn([{ x: 20, y: 0 }], 1)
  const shield = flame({ ...source, actors: source.actors.map(actor => ({ ...actor, shieldHealth: .5, shieldMaximumHealth: .5 })) }, { arcs: 0 })
  assert.equal(shield.enemies.actors[0]!.currentHealth, 1, 'shield break has no HP spill')
  assert.equal(count(shield, 'fire-explosion'), 0)
  const actor = source.actors[0]!
  assert.equal(actor.config.enemyToken, 'SKELETON')
  if (actor.config.enemyToken !== 'SKELETON') throw new Error('fixture')
  const armor = flame({ ...source, actors: [{ ...actor, config: { ...actor.config, family: { ...actor.config.family, armor: true } } }] }, { arcs: 0 })
  assert.equal(armor.enemies.actors[0]!.lifeState, 'alive')
  assert.equal(count(armor, 'fire-explosion'), 0)
})
test('report118: Cocoon removal is killed without the native terminal payload dispatch', () => {
  const source = spawn([{ x: 20, y: 0 }], 1)
  const cocoon: BoneyardEnemyStore = { ...source, actors: source.actors.map(actor => ({
    ...actor, brain: { family: 'cocoon', phase: 'active', ownerPlayerId: null, ownerPosition: actor.position },
  })) }
  const result = flame(cocoon, { arcs: 0 })
  assert.equal(result.hits[0]!.killed, true)
  assert.equal(count(result, 'fire-explosion'), 0)
  assert.equal(count(result, 'fire-ember'), 0)
})
test('report118: a newborn death area resolves before selecting the next Flame chain and never inherits the payload', () => {
  const source = spawn([{ x: 20, y: 0 }, { x: 25, y: 0 }, { x: 150, y: 0 }], 1)
  const result = flame(source, { explode: 10, radius: 10, fragments: 0 })
  assert.deepEqual(result.hits.map(hit => [hit.actorId, hit.spellKind]), [[1, 'weld'], [2, 'fire-explosion'], [3, 'weld']])
  assert.equal(count(result, 'fire-explosion'), 2, 'collateral death does not recursively inherit the context')
})
test('report118 shared: Fire has one two-lane HP call with a strict root circle', () => {
  const source = spawn([{ x: 54, y: 0 }, { x: 55, y: 0 }, { x: 40, y: 40 }, { x: -55, y: 0 }])
  const result = area(source)
  assert.deepEqual(result.hits.map(hit => [hit.actorId, hit.amount]), [[1, 12]])
  assert.deepEqual(result.enemies.actors.map(actor => actor.currentHealth), [88, 100, 100, 100])
})
test('report118 shared: Steam uses lower-inclusive upper-exclusive root rectangle of side55scale', () => {
  const source = spawn([{ x: -27.5, y: 0 }, { x: 27.5, y: 0 }, { x: 0, y: 27.49 }, { x: 30, y: 0 }])
  const result = area(source, 'steam')
  assert.deepEqual(result.hits.map(hit => [hit.actorId, hit.amount]), [[1, 12], [3, 12]])
})
test('report118 shared: area visitation is X cell then Y cell then binding order', () => {
  const result = area(spawn([{ x: 130, y: 0 }, { x: -120, y: 0 }, { x: 0, y: 120 }, { x: 0, y: -120 }, { x: 0, y: 0 }]), 'fire', 3)
  assert.deepEqual(result.hits.map(hit => hit.actorId), [2, 4, 5, 3, 1])
})
test('report118 shared: both area lanes drain shield once with no HP spill', () => {
  const source = spawn([{ x: 0, y: 0 }])
  const result = area({ ...source, actors: source.actors.map(actor => ({ ...actor, shieldHealth: 9, shieldMaximumHealth: 9 })) })
  assert.equal(result.enemies.actors[0]!.shieldHealth, 0)
  assert.equal(result.enemies.actors[0]!.currentHealth, 100)
  assert.equal(result.hits.length, 1)
})
test('report118 shared: area magic damage does not set the native magic-hit flag on Cocoon', () => {
  const source = spawn([{ x: 0, y: 0 }])
  const cocoon: BoneyardEnemyStore = { ...source, webbedPlayers: { trapped: { severity: 3, strength: 100, cocoonHealth: 100, hitPulse: 0 } },
    actors: source.actors.map(actor => ({ ...actor, brain: { family: 'cocoon', phase: 'active', ownerPlayerId: 'trapped', ownerPosition: actor.position } })) }
  const result = area(cocoon)
  assert.equal(result.enemies.webbedPlayers.trapped!.cocoonHealth, 88)
  assert.equal(result.enemies.webbedPlayers.trapped!.hitPulse, 1)
  assert.deepEqual(result.enemies.steeringRngState, cocoon.steeringRngState)
})
test('report118 shared: Burning Bolt and Meteor helper reuse gets exactly both explosion lanes', () => {
  for (const buildId of [1000, 1007] as const) {
    const detonation = createPrimarySpellWeldFireDetonation(100, {
      buildId, direction: { x: 1, y: 0 }, ownerId: 'wizard', position: { x: 0, y: 0 },
      vector: [10, 20, 1, 1, 1, 12, 10, 0, 0], worldKey: WORLD,
    }, { x: 0, y: 0 }, 1, createNativeRng(17), 11, false)
    const result = resolveBoneyardSpellCombat(spawn([{ x: 0, y: 0 }]), { ...spells(detonation.transients), nextId: detonation.nextId }, [], 1, WORLD, detonation.rng)
    assert.deepEqual(result.hits.map(hit => hit.amount), [12], String(buildId))
  }
})
test('report118 shared: a Steam detonation retains gray presentation and zero-payload ordinary children', () => {
  const built = createPrimarySpellWeldSteamDetonation(100, { emberDamage: 2, emberFragments: 3, explodeDamage: 12, explodeRadius: 10,
    ownerId: 'wizard', position: { x: 0, y: 0 }, worldKey: WORLD }, 1, createNativeRng(17), 11)
  const result = resolveBoneyardSpellCombat(spawn([{ x: 0, y: 0 }]), { ...spells(built.transients), nextId: built.nextId }, [], 1, WORLD, built.rng)
  assert.deepEqual(result.hits.map(hit => hit.amount), [12])
  assert.equal(built.transients.filter(effect => effect.kind === 'weld-steam').length, 9)
  assert.ok(built.transients.filter(effect => effect.kind === 'weld-steam').every(effect => effect.vector.every(value => value === 0)))
})
test('report118 shared: preexisting area effects are not replayed by a later Flame death', () => {
  const source = spawn([{ x: 20, y: 0 }, { x: 100, y: 0 }])
  const prior = damageBoneyardEnemy(source, { actorId: 1, amount: 1, sourcePlayerId: 'wizard', tick: 1 })
  assert.equal(prior.killed, false)
  const old = { ...explosion('fire'), ageTicks: 1 }
  const result = resolveBoneyardSpellCombat(prior.store, spells([old]), [], 1, WORLD, createNativeRng(17))
  assert.equal(result.hits.length, 0)
})

test('report118: production deferred main birth follows the admitted death burst exactly once', () => {
  const result = flame(spawn([{ x: 20, y: 0 }], 1), { arcs: 0, fragments: 0, deferred: true })
  assert.deepEqual(result.spells.transients.map(effect => effect.kind), [
    'fire-explosion', 'weld-flame-lash-fade', 'weld-flame-lash-fade', 'weld-channel',
  ])
  assert.equal(new Set(result.spells.transients.map(effect => effect.id)).size, result.spells.transients.length)
  const registrations = result.spells.transients.flatMap(effect => effect.painterRegistrations ?? [])
  assert.equal(new Set(registrations.map(value => value.managerLane + ':' + value.registrationOrdinal)).size, registrations.length)
})
test('report118: no-target/no-endpoint deferred cast still owns its source flare and main channel', () => {
  const result = flame(spawn([]), { deferred: true, targetId: null, endpoint: null })
  assert.deepEqual(result.hits, [])
  assert.deepEqual(result.spells.transients.map(effect => effect.kind), ['weld-flame-lash-fade', 'weld-channel'])
  const flare = result.spells.transients[0]!
  assert.equal(flare.kind === 'weld-flame-lash-fade' && flare.variant, 'source')
})
test('report118: flash then optional seed draws occur on nonlethal and shield hits before main birth', () => {
  const source = spawn([{ x: 20, y: 0 }])
  const withPayload = flame(source, { arcs: 0, deferred: true })
  const withoutPayload = flame(source, { arcs: 0, deferred: true, explode: 0 })
  const shielded = flame({ ...source, actors: source.actors.map(actor => ({ ...actor, shieldHealth: 20, shieldMaximumHealth: 20 })) },
    { arcs: 0, deferred: true })
  // Report116 restores the independent endpoint heading word; flash/seed still precede all births.
  assert.deepEqual(withPayload.rng, advanceNativeRngWords(createNativeRng(17), 14))
  assert.deepEqual(withoutPayload.rng, advanceNativeRngWords(createNativeRng(17), 13))
  assert.deepEqual(shielded.rng, withPayload.rng)
  const flash = drawNativeFloat(createNativeRng(17), .5)
  assert.equal(withPayload.enemies.actors[0]!.hitFeedback.strength, Math.fround(.25 + flash.value))
})
test('report118 shared: constructor visits area then each registered Ember until its first consumed contact', () => {
  const events: string[] = []
  const built = createNativeFireDetonation(100, {
    burnDamage: 0, emberDamage: 2, emberFragments: 2, explodeDamage: 12, explodeRadius: 10,
    privateSeed: 11, spentEmber: { kind: 'none' },
  }, { x: 0, y: 0 }, 'wizard', WORLD, createNativeRng(17), {
    beforeEmbers: () => events.push('area'),
    registerEmber: ember => events.push('register:' + ember.id),
    resolveEmberContact: contact => { events.push('contact:' + contact.spellId); return true },
  })
  assert.deepEqual(events, ['area', 'register:100', 'contact:100', 'register:101', 'contact:101'])
  assert.equal(built.contacts.length, 2, 'consumption stops all remaining construction ticks')
  assert.equal(built.embers.length, 0)
  assert.equal(built.nextId, 102)
})
test('report118 shared: naturally spent Immolate keeps its own total20 and strict55 root circle', () => {
  let ember = createNativeFireDetonation(100, {
    burnDamage: 0, emberDamage: 0, emberFragments: 1, explodeDamage: 0, explodeRadius: 0,
    privateSeed: 11, spentEmber: { kind: 'immolate', damage: 20 },
  }, { x: 0, y: 0 }, 'wizard', WORLD, createNativeRng(17)).embers[0]!
  let retirement: ReturnType<typeof stepNativeFireEmber>['retirement'] = { kind: 'none' }
  for (let tick = 0; tick < 2_000; tick += 1) {
    const result = stepNativeFireEmber(ember)
    if (!result.ember) { retirement = result.retirement; break }
    ember = result.ember
  }
  assert.equal(retirement.kind, 'immolate')
  if (retirement.kind !== 'immolate') throw new Error('fixture did not retire')
  const origin = retirement.explosion.origin
  const born: PrimarySpellFireExplosionState = { ...retirement.explosion, ageTicks: 0, id: 200,
    kind: 'fire-explosion', lightRegistration: { managerLane: 'transient', registrationOrdinal: 200 }, soundPitch: 1 }
  const result = resolveBoneyardSpellCombat(spawn([origin, { x: origin.x + 55, y: origin.y }]), spells([born]), [], 1, WORLD, createNativeRng(17))
  assert.deepEqual(result.hits.map(hit => [hit.actorId, hit.amount]), [[1, 20]])
})
