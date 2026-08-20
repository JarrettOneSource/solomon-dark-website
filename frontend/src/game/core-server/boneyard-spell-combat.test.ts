import assert from 'node:assert/strict'
import test from 'node:test'

import { EARTH_BOULDER_IDENTITY_ORIENTATION } from '../core-kernels/primary-spell-earth-orientation.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeSign,
} from '../core-kernels/native-rng.ts'
import { ETHER_PRIMARY_INITIAL_TURN } from '../core-kernels/primary-spell-targeting.ts'
import type { PrimarySpellTarget } from '../core-kernels/primary-spell-targeting.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardEnemySpawnIntent,
} from '../core-kernels/boneyard-wave-director.ts'
import type {
  PrimarySpellChannelEmission,
  PrimarySpellProjectileState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  createBoneyardEnemyStore,
  stepBoneyardEnemyStore,
  type BoneyardEnemyProjectile,
  type BoneyardEnemyStore,
} from './boneyard-enemy-store.ts'
import {
  resolveBoneyardSpellCombat,
  WATER_PRIMARY_ACTOR_MASK,
  WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK,
  type BoneyardSpellWorldContact,
} from './boneyard-spell-combat.ts'

const WORLD_KEY = 'boneyard:combat-test'
const COMBAT_RNG = createNativeRng(17)

function resolveCombatWithAuthority(
  enemies: BoneyardEnemyStore,
  spells: PrimarySpellSimulationState,
  emissions: readonly PrimarySpellChannelEmission[],
  tick: number,
  options: Readonly<{
    firstWorldContact?: BoneyardSpellWorldContact | null
    resolveMovement?: (
      actorId: number,
      start: Readonly<{ x: number; y: number }>,
      requested: Readonly<{ x: number; y: number }>,
      radius: number,
    ) => Readonly<{ x: number; y: number }>
    damageMultiplier?: (actorId: number, kind: string) => number
    rngSeed?: number
  }> = {},
) {
  return resolveBoneyardSpellCombat(
    enemies,
    spells,
    emissions,
    tick,
    WORLD_KEY,
    createNativeRng(options.rngSeed ?? 0),
    options.firstWorldContact ?? null,
    undefined,
    options.damageMultiplier ?? (() => 1),
    [],
    options.resolveMovement ?? ((_actorId, _start, requested) => requested),
  )
}

test('Fire uses the post-move same-cell point query, projected slot order, and strict radius sum', () => {
  const enemies = spawnEnemies([
    { position: { x: 18, y: 0 }, token: 'SKELETON' },
    { position: { x: 5, y: 0 }, token: 'SKELETON' },
  ])
  const spells = spellState({
    projectiles: [projectile({ id: 7, kind: 'fire', position: { x: 0, y: 0 } })],
  })
  let worldQueries = 0
  const result = resolveBoneyardSpellCombat(
    enemies,
    spells,
    [],
    1,
    WORLD_KEY,
    COMBAT_RNG,
    () => {
      worldQueries += 1
      return 0
    },
  )

  assert.equal(worldQueries, 0, 'projectile terrain contact belongs to the native tick kernel')
  assert.deepEqual(result.hits.map(({ actorId }) => actorId), [1])
  assert.deepEqual(result.events.map(({ sound }) => sound), ['bone-crack'])
  assert.equal(result.enemies.actors[0]?.currentHealth, 1)
  assert.equal(result.enemies.actors[1]?.currentHealth, 5)
  assert.deepEqual(result.spells.projectiles, [])
  assert.deepEqual(result.spells.transients, [{
    ageTicks: 0,
    id: 100,
    kind: 'fire-impact',
    lightRegistration: { managerLane: 'transient', registrationOrdinal: 100 },
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    worldKey: WORLD_KEY,
  }])

  const equalityEnemy = enemies.actors[0]!
  const equality = resolveBoneyardSpellCombat({
    ...enemies,
    actors: [{
      ...equalityEnemy,
      config: { ...equalityEnemy.config, collisionRadius: 2 },
      position: { x: 22, y: 0 },
    }],
  }, spells, [], 1, WORLD_KEY, COMBAT_RNG)
  assert.deepEqual(equality.hits, [], 'strict distance equality must miss')

  const boundaryEnemy = enemies.actors[0]!
  const crossCell = resolveBoneyardSpellCombat({
    ...enemies,
    actors: [{ ...boundaryEnemy, position: { x: 101, y: 0 } }],
  }, spellState({
    projectiles: [projectile({ id: 8, kind: 'fire', position: { x: 99, y: 0 } })],
  }), [], 1, WORLD_KEY, COMBAT_RNG)
  assert.deepEqual(crossCell.hits, [], 'the native point query never crosses a cell boundary')

  const negative = resolveBoneyardSpellCombat({
    ...enemies,
    actors: [{ ...boundaryEnemy, position: { x: 0.25, y: 0 } }],
  }, spellState({
    projectiles: [projectile({ id: 9, kind: 'fire', position: { x: -0.25, y: 0 } })],
  }), [], 1, WORLD_KEY, COMBAT_RNG)
  assert.equal(negative.hits[0]?.actorId, 1, 'float32 truncation maps both roots to cell zero')
})

test('Fire contact partitions direct and rectangular splash damage and consumes Ember RNG', () => {
  const spawned = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
    { position: { x: 100, y: 0 }, token: 'SKELETON' },
    { position: { x: 104.5, y: 0 }, token: 'SKELETON' },
  ])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({
      ...actor,
      currentHealth: 100,
      maximumHealth: 100,
    })),
  }
  const base = projectile({ id: 7, kind: 'fire' })
  if (base.kind !== 'fire') throw new Error('Expected a Fire fixture')
  const result = resolveBoneyardSpellCombat(enemies, spellState({
    projectiles: [{
      ...base,
      burnDamage: 10,
      damage: 30,
      emberDamage: 8,
      emberFragments: 2,
      explodeDamage: 12,
      explodeRadius: 15,
      privateSeed: 123_456,
    }],
  }), [], 1, WORLD_KEY, COMBAT_RNG)

  assert.deepEqual(
    result.hits.map(({ actorId, amount, spellKind }) => ({ actorId, amount, spellKind })),
    [
      { actorId: 1, amount: 18, spellKind: 'fire' },
      { actorId: 1, amount: 6, spellKind: 'fire-explosion' },
      { actorId: 2, amount: 6, spellKind: 'fire-explosion' },
    ],
  )
  assert.deepEqual(result.enemies.actors.map(({ currentHealth }) => currentHealth), [76, 94, 100])
  assert.deepEqual(
    result.spells.transients.map(({ id, kind }) => ({ id, kind })),
    [
      { id: 100, kind: 'fire-impact' },
      { id: 101, kind: 'fire-explosion' },
      { id: 102, kind: 'fire-ember' },
      { id: 103, kind: 'fire-ember' },
    ],
  )
  assert.equal(result.rng.indexA, 6)
  assert.deepEqual(result.burns, [
    { damage: 10, ownerId: 'wizard', targetId: 1 },
    { damage: 10, ownerId: 'wizard', targetId: 1 },
    { damage: 10, ownerId: 'wizard', targetId: 2 },
  ])
})

test('persistent Fire and GoodImp contacts use authoritative semantic events', () => {
  const spawned = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
    { position: { x: 15, y: 0 }, token: 'SKELETON' },
    { position: { x: 32, y: 0 }, token: 'SKELETON' },
  ])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({
      ...actor,
      currentHealth: 100,
      maximumHealth: 100,
    })),
  }
  const result = resolveBoneyardSpellCombat(
    enemies,
    spellState({}),
    [],
    3,
    WORLD_KEY,
    COMBAT_RNG,
    null,
    undefined,
    undefined,
    undefined,
    undefined,
    [
      {
        amount: 0.6,
        burnDamage: 9,
        kind: 'fire-patch',
        ownerId: 'wizard',
        position: { x: 0, y: 0 },
        radius: 32,
        spellId: 7,
        worldKey: WORLD_KEY,
      },
      {
        amount: 12,
        kind: 'fire-good-imp',
        ownerId: 'wizard',
        spellId: 8,
        targetId: 'enemy:2',
        worldKey: WORLD_KEY,
      },
    ],
  )

  assert.deepEqual(
    result.hits.map(({ actorId, amount, spellKind }) => ({ actorId, amount, spellKind })),
    [
      { actorId: 1, amount: 0.6, spellKind: 'fire-patch' },
      { actorId: 2, amount: 0.6, spellKind: 'fire-patch' },
      { actorId: 2, amount: 12, spellKind: 'fire-good-imp' },
    ],
  )
  assert.deepEqual(
    result.enemies.actors.map(({ currentHealth }) => currentHealth),
    [99.4, 87.4, 100],
  )
  assert.deepEqual(result.burns, [
    { damage: 9, ownerId: 'wizard', targetId: 1 },
    { damage: 9, ownerId: 'wizard', targetId: 2 },
  ])
})

test('Fire and Ether skip an ineligible Coffin and contact the next hostile actor', () => {
  const enemies = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'COFFIN' },
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
  ])
  for (const kind of ['fire', 'ether'] as const) {
    const result = resolveBoneyardSpellCombat(enemies, spellState({
      projectiles: [projectile({ id: kind === 'fire' ? 7 : 8, kind })],
    }), [], 1, WORLD_KEY, COMBAT_RNG)
    assert.deepEqual(result.hits.map(({ actorId }) => actorId), [2])
    assert.deepEqual(result.spells.projectiles, [])
    assert.equal(result.spells.transients[0]?.kind, `${kind}-impact`)
  }
})

test('Fire consumes on flag-four scenery roots without applying hostile damage', () => {
  const enemies = spawnEnemies([{ position: { x: 10, y: 0 }, token: 'SKELETON' }])
  const spells = spellState({
    projectiles: [projectile({ id: 7, kind: 'fire', position: { x: 0, y: 0 } })],
  })
  const grave = sceneryTarget('grave', 0.01, 20.009)
  const result = resolveBoneyardSpellCombat(
    enemies,
    spells,
    [],
    9,
    WORLD_KEY,
    null,
    undefined,
    () => 1,
    [grave],
  )

  assert.deepEqual(result.hits, [])
  assert.equal(result.enemies, enemies)
  assert.deepEqual(result.spells.projectiles, [])
  assert.deepEqual(result.spells.transients.map(({ kind }) => kind), ['fire-impact'])

  const equality = resolveBoneyardSpellCombat(
    createBoneyardEnemyStore('empty-fire-scenery'),
    spells,
    [],
    9,
    WORLD_KEY,
    null,
    undefined,
    () => 1,
    [sceneryTarget('grave-edge', 0.01, 20.01)],
  )
  assert.equal(equality.spells, spells, 'strict radius equality must miss the grave root')
})

test('Ether contact uses its six-unit point query and publishes FadeMM at the advanced root', () => {
  const spawned = spawnEnemies([{ position: { x: 19.999, y: 0 }, token: 'SKELETON' }])
  const enemy = spawned.actors[0]!
  const enemies = {
    ...spawned,
    actors: [{ ...enemy, config: { ...enemy.config, collisionRadius: 14 } }],
  }
  const result = resolveBoneyardSpellCombat(enemies, spellState({
    projectiles: [projectile({ id: 8, kind: 'ether', position: { x: 0, y: 0 } })],
  }), [], 77, WORLD_KEY, COMBAT_RNG)

  assert.deepEqual(result.hits.map(({ actorId, amount }) => ({ actorId, amount })), [{
    actorId: 1,
    amount: 2,
  }])
  assert.deepEqual(result.spells.transients, [{
    ageTicks: 0,
    birthTick: 77,
    id: 100,
    kind: 'ether-impact',
    lightRegistration: { managerLane: 'transient', registrationOrdinal: 100 },
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    visualScale: 1,
    worldKey: WORLD_KEY,
  }])
})

test('Piercing keeps the missile, scales payload and art, and emits native contact streaks', () => {
  const enemies = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
    { position: { x: 100, y: 0 }, token: 'SKELETON' },
  ])
  const base = projectile({
    id: 8,
    kind: 'ether',
    position: { x: 0, y: 0 },
    velocity: { x: 3, y: 0 },
  })
  if (base.kind !== 'ether') throw new Error('Expected an Ether fixture')
  const result = resolveBoneyardSpellCombat(enemies, spellState({
    projectiles: [{
      ...base,
      damageRetention: 0.5,
      piercesRemaining: 1,
      reacquiresTarget: true,
    }],
  }), [], 77, WORLD_KEY, COMBAT_RNG)

  assert.deepEqual(result.hits.map(({ actorId, amount }) => ({ actorId, amount })), [{
    actorId: 1,
    amount: 2,
  }])
  const continued = result.spells.projectiles[0]
  assert.equal(continued?.kind, 'ether')
  if (continued?.kind !== 'ether') throw new Error('Expected a surviving Ether missile')
  assert.equal(continued.damage, 1)
  assert.equal(continued.piercesRemaining, 0)
  assert.equal(continued.visualScale, 0.5)
  assert.deepEqual(continued.position, { x: 20, y: 0 })
  assert.equal(continued.targetId, 'enemy:2')
  assert.equal(result.spells.nextId, 104)
  assert.deepEqual(
    result.spells.transients.map((effect) => effect.kind),
    Array.from({ length: 4 }, () => 'ether-pierce-streak'),
  )
  assert.deepEqual(
    result.spells.transients.map((effect) => 'origin' in effect ? effect.origin.x : null),
    [5, 10, 15, 20],
  )
})

test('Earth gathers strict charge-scaled roots once and never fractures on actor contact', () => {
  const enemies = spawnEnemies([
    { position: { x: 20, y: 0 }, token: 'SKELETON' },
    { position: { x: 70, y: 0 }, token: 'SKELETON' },
    { position: { x: 75, y: 0 }, token: 'SKELETON' },
  ])
  const spells = spellState({
    projectiles: [projectile({
      charge: 1,
      damage: 10,
      hitTargetIds: ['enemy:1'],
      id: 4,
      kind: 'earth',
    })],
  })
  const first = resolveBoneyardSpellCombat(
    enemies, spells, [], 1, WORLD_KEY, COMBAT_RNG,
  )

  assert.deepEqual(first.hits.map(({ actorId }) => actorId), [2])
  assert.equal(first.enemies.actors[0]?.currentHealth, 5)
  assert.equal(first.enemies.actors[1]?.lifeState, 'dying')
  assert.equal(first.enemies.actors[2]?.currentHealth, 5)
  assert.deepEqual(first.spells.transients, [])
  assert.equal(first.spells.projectiles.length, 1)
  const boulder = first.spells.projectiles[0]
  assert.ok(boulder?.kind === 'earth')
  assert.deepEqual(boulder.hitTargetIds, ['enemy:1', 'enemy:2'])

  const repeated = resolveBoneyardSpellCombat(
    first.enemies,
    first.spells,
    [],
    2,
    WORLD_KEY,
    first.rng,
  )
  assert.deepEqual(repeated.hits, [])
  assert.equal(repeated.spells, first.spells)
})

test('Earth contact consumes the finalized quadratic release pool without scaling charge twice', () => {
  const enemies = spawnEnemies([{ position: { x: 20, y: 0 }, token: 'SKELETON' }])
  const result = resolveBoneyardSpellCombat(enemies, spellState({
    projectiles: [projectile({
      charge: 0.5,
      damage: 2.5,
      id: 4,
      kind: 'earth',
    })],
  }), [], 1, WORLD_KEY)

  assert.deepEqual(result.hits.map(({ amount }) => amount), [2.5])
  assert.equal(result.enemies.actors[0]?.currentHealth, 2.5)
})

test('Earth contact spends its residual pool in native target order and breaks below threshold', () => {
  const enemies = spawnEnemies([
    { position: { x: 20, y: 0 }, token: 'SKELETON' },
    { position: { x: 40, y: 0 }, token: 'SKELETON' },
  ])
  const result = resolveBoneyardSpellCombat(enemies, spellState({
    projectiles: [projectile({
      id: 41,
      kind: 'earth',
      remainingDamage: 6,
      toughness: 1,
    })],
  }), [], 9, WORLD_KEY)

  assert.deepEqual(result.hits.map(({ actorId, amount }) => ({ actorId, amount })), [
    { actorId: 1, amount: 5 },
    { actorId: 2, amount: 3.5 },
  ])
  assert.equal(result.enemies.actors[0]?.currentHealth, 0)
  assert.equal(result.enemies.actors[1]?.currentHealth, 1.5)
  assert.deepEqual(result.spells.projectiles, [])
  assert.deepEqual(result.spells.transients.map(({ kind }) => kind), ['earth-impact'])
})

test('Bind Rocks reduces only pool consumption, never the outgoing target payload', () => {
  const enemies = spawnEnemies([
    { position: { x: 20, y: 0 }, token: 'SKELETON' },
    { position: { x: 40, y: 0 }, token: 'SKELETON' },
  ])
  const result = resolveBoneyardSpellCombat(enemies, spellState({
    projectiles: [projectile({
      id: 42,
      kind: 'earth',
      remainingDamage: 10,
      toughness: 5,
    })],
  }), [], 10, WORLD_KEY)

  assert.deepEqual(result.hits.map(({ amount }) => amount), [5, 5])
  const boulder = result.spells.projectiles[0]
  assert.ok(boulder?.kind === 'earth')
  assert.equal(boulder.remainingDamage, 9)
})

test('Water uses the root-only 205-unit 15-degree cone and per-target LOS', () => {
  assert.equal(WATER_PRIMARY_ACTOR_MASK, 0x1082)
  assert.equal(WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK, 0x2)
  const enemies = spawnEnemies([
    { position: { x: 50, y: 0 }, token: 'SKELETON' },
    { position: { x: 200, y: 0 }, token: 'SKELETON' },
    { position: { x: 205, y: 0 }, token: 'SKELETON' },
    { position: { x: 100, y: 30 }, token: 'SKELETON' },
  ])
  const water = emission({ id: 11, kind: 'water' })
  const lineStarts: Readonly<{ x: number; y: number }>[] = []
  const result = resolveBoneyardSpellCombat(
    enemies,
    spellState({ transients: [transient({ id: 11, kind: 'water' })] }),
    [water],
    1,
    WORLD_KEY,
    COMBAT_RNG,
    (start, end) => {
      lineStarts.push({ ...start })
      return end.x === 200 ? 0.5 : null
    },
  )

  assert.deepEqual(result.hits.map(({ actorId }) => actorId), [1])
  assert.ok(lineStarts.every((start) => (
    start.x === water.queryOrigin.x && start.y === water.queryOrigin.y
  )))
  assert.equal(result.enemies.actors[0]?.currentHealth, 4.975)
  assert.equal(result.enemies.actors[1]?.currentHealth, 5, 'LOS blocks this root')
  assert.equal(result.enemies.actors[2]?.currentHealth, 5, 'strict reach equality misses')
  assert.equal(result.enemies.actors[3]?.currentHealth, 5, 'root is outside 15 degrees')
})

test('Chill Wind tumbles hostile Arrows through the native vslot and SpinAway program', () => {
  const base = spawnEnemies([])
  const arrow = enemyArrow({ id: 7, position: { x: 50, y: 0 } })
  const enemies: BoneyardEnemyStore = {
    ...base,
    nextProjectileEffectId: 20,
    projectiles: [arrow],
  }
  const water = emission({ id: 11, kind: 'water' })
  assert.equal(water.primarySkill.kind, 'water')
  const profile = { ...water.primarySkill, pushbackPercent: 10 }
  const initialRng = createNativeRng(23)
  const rotation = drawNativeFloat(initialRng, 360)
  const angularMagnitude = drawNativeFloat(rotation.state, 1)
  const angularVelocity = drawNativeSign(
    angularMagnitude.state,
    Math.fround(1 + angularMagnitude.value),
  )
  const result = resolveBoneyardSpellCombat(
    enemies,
    spellState({ transients: [transient({ id: 11, kind: 'water' })] }),
    [{ ...water, primarySkill: profile }],
    1,
    WORLD_KEY,
    initialRng,
  )

  assert.deepEqual(result.enemies.projectiles, [])
  assert.deepEqual(result.events.map(({ projectileId, type }) => ({ projectileId, type })), [{
    projectileId: 7,
    type: 'projectile-retired',
  }])
  assert.deepEqual(result.rng, angularVelocity.state)
  assert.deepEqual(result.enemies.projectileEffects, [{
    ageTicks: 0,
    alpha: 6,
    alphaLossPerTick: Math.fround(0.1),
    angularVelocityDeg: angularVelocity.value,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 2,
    id: 20,
    kind: 'arrow-tumble',
    lastStepTick: 1,
    lifetimeTicks: 60,
    ownerActorId: 3,
    ownerProjectileId: 7,
    phaseOriginTicks: 8,
    position: { x: 50, y: 0 },
    rotationDeg: rotation.value,
    scale: 1,
    spawnTick: 1,
    tint: 0xffffff,
    velocity: { x: 1, y: 0 },
  }])

  const advanced = stepBoneyardEnemyStore(result.enemies, {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: (request) => request.requestedPosition,
    resolveSpawnIntents: () => [],
    tick: 2,
  }).store.projectileEffects[0]!
  assert.equal(advanced.ageTicks, 1)
  assert.equal(advanced.alpha, Math.fround(6 - Math.fround(0.1)))
  assert.deepEqual(advanced.position, { x: 51, y: 0 })
  assert.equal(advanced.rotationDeg, Math.fround(rotation.value + angularVelocity.value))
  assert.deepEqual(advanced.velocity, { x: Math.fround(0.98), y: 0 })
})

test('underpowered Water carries half damage through the narrow actor-mask lane', () => {
  const enemies = spawnEnemies([{ position: { x: 50, y: 0 }, token: 'SKELETON' }])
  const weak = emission({
    damage: 0.0125,
    id: 11,
    kind: 'water',
    underpowered: true,
  })
  const result = resolveBoneyardSpellCombat(
    enemies,
    spellState({ transients: [transient({ id: 11, kind: 'water' })] }),
    [weak],
    1,
    WORLD_KEY,
  )
  assert.deepEqual(result.hits.map(({ amount }) => amount), [0.0125])
  assert.equal(result.enemies.actors[0]?.currentHealth, 4.9875)
})

test('Air damages only the hostile selected by its semantic target id', () => {
  const enemies = spawnEnemies([
    { position: { x: 20, y: 0 }, token: 'SKELETON' },
    { position: { x: 100, y: 0 }, token: 'SKELETON' },
  ])
  const result = resolveBoneyardSpellCombat(
    enemies,
    spellState({
      transients: [transient({ id: 10, kind: 'air', targetId: 'enemy:2' })],
    }),
    [emission({ id: 10, kind: 'air' })],
    1,
    WORLD_KEY,
    COMBAT_RNG,
    () => 0,
  )

  assert.deepEqual(result.hits.map(({ actorId }) => actorId), [2])
  assert.equal(result.enemies.actors[0]?.currentHealth, 5)
  assert.equal(result.enemies.actors[1]?.currentHealth, 4.975)
})

test('Lightning chains to the nearest unused roots, decays in float32, and attaches Stun', () => {
  const enemies = spawnEnemies([
    { position: { x: 20, y: 0 }, token: 'SKELETON' },
    { position: { x: 100, y: 0 }, token: 'SKELETON' },
    { position: { x: 250, y: 0 }, token: 'SKELETON' },
  ])
  const profile = {
    arcCount: 2,
    damageMaximum: 100,
    damageMinimum: 100,
    damageRollCount: 1,
    disintegrateChance: 0,
    hurricaneDamageMaximum: 0,
    hurricaneDamageMinimum: 0,
    kind: 'air',
    manaCost: 12,
    rank: 1,
    skillId: 24,
    stunMovementFactor: 0.3,
  } as const
  const result = resolveCombatWithAuthority(
    enemies,
    spellState({
      transients: [transient({ id: 10, kind: 'air', targetId: 'enemy:1' })],
    }),
    [emission({ damage: 1, id: 10, kind: 'air', primarySkill: profile })],
    1,
    { damageMultiplier: (actorId) => actorId === 2 ? 2 : 1 },
  )

  const secondHop = Math.fround(1 * Math.fround(0.600000024))
  const thirdHop = Math.fround(secondHop * Math.fround(0.600000024))
  assert.deepEqual(result.hits.map(({ actorId }) => actorId), [1, 2, 3])
  assert.equal(result.hits[0]?.amount, 1)
  assert.equal(result.hits[1]?.amount, secondHop * 2, 'Prismatic doubles electric damage')
  assert.equal(result.hits[2]?.amount, thirdHop)
  assert.deepEqual(result.targetEffects, [1, 2, 3].map((targetId) => ({
    patch: { stunFactor: 0.3, stunTicks: 25 },
    targetId,
    worldKey: WORLD_KEY,
  })))
  const chainBodies = result.spells.transients.filter(({ kind }) => kind === 'air')
  assert.equal(chainBodies.length, 3)
  assert.deepEqual(chainBodies.slice(1).map((effect) => (
    effect.kind === 'air' ? effect.targetId : null
  )), ['enemy:2', 'enemy:3'])
})

test('Disintegrate executes only below the strict post-hit twenty-percent gate', () => {
  const enemies = spawnEnemies([
    { position: { x: 20, y: 0 }, token: 'SKELETON' },
  ])
  const profile = {
    arcCount: 0,
    damageMaximum: 400,
    damageMinimum: 400,
    damageRollCount: 1,
    disintegrateChance: 100,
    hurricaneDamageMaximum: 0,
    hurricaneDamageMinimum: 0,
    kind: 'air',
    manaCost: 12,
    rank: 1,
    skillId: 24,
    stunMovementFactor: 1,
  } as const
  const spells = spellState({
    transients: [transient({ id: 10, kind: 'air', targetId: 'enemy:1' })],
  })
  const equality = resolveCombatWithAuthority(
    enemies,
    spells,
    [emission({ damage: 4, id: 10, kind: 'air', primarySkill: profile })],
    40,
  )
  assert.equal(equality.enemies.actors[0]?.lifeState, 'alive')
  assert.equal(equality.enemies.actors[0]?.currentHealth, 1)

  const below = resolveCombatWithAuthority(
    enemies,
    spells,
    [emission({ damage: 4.01, id: 10, kind: 'air', primarySkill: profile })],
    40,
  )
  assert.equal(below.enemies.actors[0]?.lifeState, 'dying')
  assert.equal(below.enemies.actors[0]?.currentHealth, 0)
  assert.equal(below.hits[0]?.amount, 5)
})

test('underpowered channels suppress every learned Air and Water branch', () => {
  const enemies = spawnEnemies([
    { position: { x: 20, y: 0 }, token: 'SKELETON' },
    { position: { x: 100, y: 100 }, token: 'SKELETON' },
  ])
  const airProfile = {
    arcCount: 3,
    damageMaximum: 100,
    damageMinimum: 100,
    damageRollCount: 1,
    disintegrateChance: 100,
    hurricaneDamageMaximum: 10,
    hurricaneDamageMinimum: 5,
    kind: 'air',
    manaCost: 12,
    rank: 1,
    skillId: 24,
    stunMovementFactor: 0.2,
  } as const
  const air = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [transient({ id: 10, kind: 'air', targetId: 'enemy:1' })] }),
    [emission({
      damage: 1,
      id: 10,
      kind: 'air',
      primarySkill: airProfile,
      underpowered: true,
    })],
    40,
  )
  assert.deepEqual(air.hits.map(({ actorId }) => actorId), [1])
  assert.deepEqual(air.targetEffects, [])
  assert.equal(air.spells.transients.filter(({ kind }) => kind === 'air').length, 1)
  assert.equal(air.rng.indexA, 1, 'weak Air consumes only its ordinary contact scalar')

  const waterProfile = {
    armorMaximum: 25,
    armorPerSecond: 8,
    auraMovementFactor: 0.4,
    auraRadius: 120,
    auraSlowFactor: 0.4,
    coldDurationTicks: 200,
    coldMovementFactor: 0.25,
    damageMaximum: 100,
    damageMinimum: 100,
    damageRollCount: 1,
    hailChance: 100,
    hailDamageMaximum: 10,
    hailDamageMinimum: 5,
    hailThreshold: 3_000,
    halfAngleDegrees: 25,
    kind: 'water',
    manaCost: 12.5,
    minimumColdDurationTicks: 200,
    pushbackPercent: 4,
    rank: 1,
    reach: 245,
    skillId: 32,
    slowdownScale: 2,
  } as const
  const movementRequests: unknown[] = []
  const water = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [transient({ id: 11, kind: 'water' })] }),
    [emission({
      damage: 1,
      id: 11,
      kind: 'water',
      primarySkill: waterProfile,
      underpowered: true,
    })],
    1,
    { resolveMovement: (...request) => {
      movementRequests.push(request)
      return request[2]
    } },
  )
  assert.deepEqual(water.hits.map(({ spellKind }) => spellKind), ['water'])
  assert.deepEqual(water.targetEffects, [{
    patch: { coldSlowFactor: 0.75, coldSlowTicks: 25 },
    targetId: 1,
    worldKey: WORLD_KEY,
  }])
  assert.equal(water.spells.transients.some(({ kind }) => kind === 'water-aura'), false)
  assert.deepEqual(movementRequests, [])
  assert.equal(water.rng.indexA, 0)
})

test('Frost applies widened cone cold, Chill pushback, Aura, Permafrost, and Hail authority', () => {
  const enemies = spawnEnemies([
    { position: { x: 50, y: 0 }, token: 'SKELETON' },
    { position: { x: 230, y: 60 }, token: 'SKELETON' },
  ])
  const movementRequests: Readonly<{ x: number; y: number }>[] = []
  const profile = {
    armorMaximum: 0,
    armorPerSecond: 0,
    auraMovementFactor: 0.4,
    auraRadius: 120,
    auraSlowFactor: 0.4,
    coldDurationTicks: 200,
    coldMovementFactor: 0.25,
    damageMaximum: 100,
    damageMinimum: 100,
    damageRollCount: 1,
    hailDamageMaximum: 1,
    hailDamageMinimum: 1,
    hailChance: 100,
    hailThreshold: 3_000,
    halfAngleDegrees: 25,
    kind: 'water',
    manaCost: 12.5,
    minimumColdDurationTicks: 200,
    pushbackPercent: 4,
    rank: 1,
    reach: 245,
    skillId: 32,
    slowdownScale: 2,
  } as const
  const result = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [transient({ id: 11, kind: 'water' })] }),
    [emission({ damage: 1, id: 11, kind: 'water', primarySkill: profile })],
    6,
    {
      resolveMovement: (_actorId, _start, requested) => {
        movementRequests.push({ ...requested })
        return requested
      },
    },
  )

  assert.deepEqual(result.hits.map(({ actorId, spellKind }) => ({ actorId, spellKind })), [
    { actorId: 1, spellKind: 'water' },
    { actorId: 1, spellKind: 'water-hail' },
    { actorId: 2, spellKind: 'water' },
    { actorId: 2, spellKind: 'water-hail' },
  ])
  assert.equal(result.enemies.actors[0]?.currentHealth, 3)
  assert.equal(result.enemies.actors[0]?.position.x, 60)
  assert.deepEqual(movementRequests, [{ x: 60, y: 0 }])
  assert.deepEqual(result.targetEffects, [
    { patch: { coldSlowFactor: 0.4, coldSlowTicks: 200 }, targetId: 1, worldKey: WORLD_KEY },
    { patch: { coldSlowFactor: 0.25, coldSlowTicks: 200 }, targetId: 1, worldKey: WORLD_KEY },
    { patch: { coldSlowFactor: 0.25, coldSlowTicks: 200 }, targetId: 2, worldKey: WORLD_KEY },
  ])
  assert.equal(result.enemies.actors[1]?.currentHealth, 3, 'Cone of Ice widens the acquired wedge')
  assert.equal(result.spells.transients.some(({ kind }) => kind === 'water-aura'), true)
})

test('world-mismatched spells remain live without touching Boneyard actors', () => {
  const enemies = spawnEnemies([{ position: { x: 0, y: 0 }, token: 'SKELETON' }])
  const spells = spellState({
    projectiles: [projectile({ id: 1, kind: 'fire', worldKey: 'boneyard:other' })],
    transients: [transient({ id: 2, kind: 'water', worldKey: 'hub:courtyard' })],
  })
  const result = resolveBoneyardSpellCombat(
    enemies,
    spells,
    [emission({ id: 2, kind: 'water', worldKey: 'hub:courtyard' })],
    1,
    WORLD_KEY,
    COMBAT_RNG,
  )
  assert.deepEqual(result.hits, [])
  assert.equal(result.enemies, enemies)
  assert.equal(result.spells, spells)
})

function spawnEnemies(
  specs: readonly Readonly<{
    position: { x: number; y: number }
    token: keyof typeof BONEYARD_WAVE_ENEMY_TYPES
  }>[],
): BoneyardEnemyStore {
  return stepBoneyardEnemyStore(createBoneyardEnemyStore('spell-combat'), {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: (request) => request.requestedPosition,
    resolveSpawnIntents: () => specs.map(({ position, token }, index): BoneyardEnemySpawnIntent => ({
      enemyToken: token,
      flags: [],
      id: index + 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[token],
      position: { ...position },
      spawnTick: 0,
      waveOrdinal: 1,
    })),
    tick: 0,
  }).store
}

function spellState(options: {
  projectiles?: readonly PrimarySpellProjectileState[]
  transients?: readonly PrimarySpellTransientState[]
}): PrimarySpellSimulationState {
  return {
    nextId: 100,
    projectiles: options.projectiles ?? [],
    transients: options.transients ?? [],
  }
}

function projectile(options: {
  charge?: number
  damage?: number
  hitTargetIds?: readonly string[]
  id: number
  kind: PrimarySpellProjectileState['kind']
  position?: Readonly<{ x: number; y: number }>
  remainingDamage?: number
  toughness?: number
  velocity?: Readonly<{ x: number; y: number }>
  worldKey?: string
}): PrimarySpellProjectileState {
  const velocity = options.velocity ?? { x: 0, y: 0 }
  const common = {
    ageTicks: 1,
    charge: options.charge ?? 1,
    damage: options.damage ?? { earth: 10, ether: 2, fire: 4 }[options.kind],
    direction: normalized(velocity),
    flightTicks: 1,
    id: options.id,
    lightRegistration: { managerLane: 'actor' as const, registrationOrdinal: options.id },
    ownerId: 'wizard',
    phase: 'flight' as const,
    position: { ...(options.position ?? { x: 0, y: 0 }) },
    velocity: { ...velocity },
    worldKey: options.worldKey ?? WORLD_KEY,
  }
  switch (options.kind) {
    case 'earth':
      return {
        ...common,
        assemblyCharge: options.charge ?? 1,
        hitTargetIds: [...(options.hitTargetIds ?? [])],
        kind: 'earth',
        maximumCharge: Math.max(1, options.charge ?? 1),
        orientation: [...EARTH_BOULDER_IDENTITY_ORIENTATION],
        remainingDamage: options.remainingDamage ?? options.damage ?? 10,
        toughness: options.toughness ?? 1,
      }
    case 'ether':
      return {
        ...common,
        damageRetention: 1,
        headingDegrees: 0,
        kind: 'ether',
        piercesRemaining: 0,
        reacquiresTarget: false,
        speed: 3,
        targetId: null,
        turnInput: 2,
        turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
        underpowered: false,
        visualScale: 1,
      }
    case 'fire':
      return {
        ...common,
        burnDamage: 0,
        emberDamage: 0,
        emberFragments: 0,
        explodeDamage: 0,
        explodeRadius: 0,
        kind: 'fire',
        privateSeed: 0,
        spentEmber: { kind: 'none' },
        underpowered: false,
      }
  }
}

function transient(options: {
  ageTicks?: number
  direction?: Readonly<{ x: number; y: number }>
  id: number
  kind: 'air' | 'water'
  targetId?: string | null
  worldKey?: string
}): PrimarySpellTransientState {
  const direction = { ...(options.direction ?? { x: 1, y: 0 }) }
  const common = {
    ageTicks: options.ageTicks ?? 0,
    direction,
    id: options.id,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    underpowered: false,
    variant: 0,
    worldKey: options.worldKey ?? WORLD_KEY,
  }
  return options.kind === 'air'
    ? {
        ...common,
        birthTick: 0,
        endpoint: { x: 205, y: 0 },
        hurricaneCharge: 0,
        kind: 'air',
        lightRegistration: {
          managerLane: 'transient',
          registrationOrdinal: options.id,
        },
        midpoint: { x: 102.5, y: 0 },
        targetId: options.targetId ?? null,
      }
    : {
        ...common,
        kind: 'water',
        lightRegistration: null,
        obstructionDistance: null,
        obstructionPoint: null,
      }
}

function emission(options: {
  damage?: number
  id: number
  kind: PrimarySpellChannelEmission['kind']
  underpowered?: boolean
  primarySkill?: PrimarySpellChannelEmission['primarySkill']
  worldKey?: string
}): PrimarySpellChannelEmission {
  return {
    damage: options.damage ?? 0.025,
    direction: { x: 1, y: 0 },
    id: options.id,
    kind: options.kind,
    manaCost: options.kind === 'air' ? 0.12 : 0.125,
    origin: { x: -10, y: -10 },
    ownerId: 'wizard',
    primarySkill: options.primarySkill ?? (options.kind === 'air'
      ? {
          arcCount: 0,
          damageMaximum: 2.5,
          damageMinimum: 2.5,
          damageRollCount: 1,
          disintegrateChance: 0,
          hurricaneDamageMaximum: 0,
          hurricaneDamageMinimum: 0,
          kind: 'air',
          manaCost: 12,
          rank: 1,
          skillId: 24,
          stunMovementFactor: 1,
        }
      : {
          armorMaximum: 0,
          armorPerSecond: 0,
          auraMovementFactor: 1,
          auraRadius: 0,
          auraSlowFactor: 1,
          coldDurationTicks: 25,
          coldMovementFactor: 0.5,
          damageMaximum: 2.5,
          damageMinimum: 2.5,
          damageRollCount: 1,
          hailDamageMaximum: 0,
          hailDamageMinimum: 0,
          hailChance: 0,
          hailThreshold: 0,
          halfAngleDegrees: 15,
          kind: 'water',
          manaCost: 12.5,
          minimumColdDurationTicks: 0,
          pushbackPercent: 0,
          rank: 1,
          reach: 205,
          skillId: 32,
          slowdownScale: 1,
        }),
    queryOrigin: { x: 0, y: 0 },
    underpowered: options.underpowered ?? false,
    worldKey: options.worldKey ?? WORLD_KEY,
  }
}

function normalized(vector: Readonly<{ x: number; y: number }>): { x: number; y: number } {
  const length = Math.hypot(vector.x, vector.y)
  return length === 0
    ? { x: 1, y: 0 }
    : { x: vector.x / length, y: vector.y / length }
}

function sceneryTarget(id: string, bodyRadius: number, x: number): PrimarySpellTarget {
  return {
    active: true,
    actorFlags: 0x4,
    attachment: { x: 0, y: 0 },
    bodyRadius,
    id: `scenery:${id}`,
    kind: 'scenery',
    nativePriority: 0,
    pendingRemove: false,
    position: { x, y: 0 },
    registrationOrder: 0,
  }
}

function enemyArrow(options: {
  id: number
  position: Readonly<{ x: number; y: number }>
}): BoneyardEnemyProjectile {
  return {
    ageTicks: 8,
    bounceVelocity: 0,
    coldSlowTicks: 0,
    contactRadius: 8,
    damage: 1,
    headingDeg: 90,
    hitPlayerIds: [],
    homing: false,
    id: options.id,
    kind: 'arrow',
    lastStepTick: 0,
    lightRegistration: null,
    lifetimeTicks: 300,
    minimumSpeed: 0,
    nativeTypeId: 0x7da,
    ownerActorId: 3,
    payload: 'normal',
    poisonDamage: 0,
    poisonDuration: 0,
    position: { ...options.position },
    speed: 5,
    settledTicksRemaining: 0,
    spawnTick: 0,
    targetPlayerId: null,
    verticalOffset: 0,
    verticalVelocity: 0,
    visualPhaseDeg: 0,
    visualScale: 1,
  }
}
