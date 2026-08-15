import assert from 'node:assert/strict'
import test from 'node:test'

import { EARTH_BOULDER_IDENTITY_ORIENTATION } from '../core-kernels/primary-spell-earth-orientation.ts'
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
  type BoneyardEnemyStore,
} from './boneyard-enemy-store.ts'
import {
  resolveBoneyardSpellCombat,
  WATER_PRIMARY_ACTOR_MASK,
  WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK,
} from './boneyard-spell-combat.ts'

const WORLD_KEY = 'boneyard:combat-test'

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
  }, spells, [], 1, WORLD_KEY)
  assert.deepEqual(equality.hits, [], 'strict distance equality must miss')

  const boundaryEnemy = enemies.actors[0]!
  const crossCell = resolveBoneyardSpellCombat({
    ...enemies,
    actors: [{ ...boundaryEnemy, position: { x: 101, y: 0 } }],
  }, spellState({
    projectiles: [projectile({ id: 8, kind: 'fire', position: { x: 99, y: 0 } })],
  }), [], 1, WORLD_KEY)
  assert.deepEqual(crossCell.hits, [], 'the native point query never crosses a cell boundary')

  const negative = resolveBoneyardSpellCombat({
    ...enemies,
    actors: [{ ...boundaryEnemy, position: { x: 0.25, y: 0 } }],
  }, spellState({
    projectiles: [projectile({ id: 9, kind: 'fire', position: { x: -0.25, y: 0 } })],
  }), [], 1, WORLD_KEY)
  assert.equal(negative.hits[0]?.actorId, 1, 'float32 truncation maps both roots to cell zero')
})

test('Fire and Ether skip an ineligible Coffin and contact the next hostile actor', () => {
  const enemies = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'COFFIN' },
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
  ])
  for (const kind of ['fire', 'ether'] as const) {
    const result = resolveBoneyardSpellCombat(enemies, spellState({
      projectiles: [projectile({ id: kind === 'fire' ? 7 : 8, kind })],
    }), [], 1, WORLD_KEY)
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
  }), [], 77, WORLD_KEY)

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
  }), [], 77, WORLD_KEY)

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
  const first = resolveBoneyardSpellCombat(enemies, spells, [], 1, WORLD_KEY)

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
    () => 0,
  )

  assert.deepEqual(result.hits.map(({ actorId }) => actorId), [2])
  assert.equal(result.enemies.actors[0]?.currentHealth, 5)
  assert.equal(result.enemies.actors[1]?.currentHealth, 4.975)
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
        orientation: [...EARTH_BOULDER_IDENTITY_ORIENTATION],
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
      return { ...common, kind: 'fire', underpowered: false }
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
