import assert from 'node:assert/strict'
import test from 'node:test'

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
import { resolveBoneyardSpellCombat } from './boneyard-spell-combat.ts'

const WORLD_KEY = 'boneyard:combat-test'

test('flight projectiles sweep to the path-first actor and retire after one contact', () => {
  const enemies = spawnSkeletons([
    { x: 90, y: 0 },
    { x: 40, y: 0 },
  ])
  const spells = spellState({
    projectiles: [projectile({
      id: 7,
      kind: 'fire',
      position: { x: 100, y: 0 },
      velocity: { x: 100, y: 0 },
    })],
  })

  const result = resolveBoneyardSpellCombat(enemies, spells, [], 1, WORLD_KEY)

  assert.deepEqual(result.hits, [{
    actorId: 2,
    amount: 4,
    killed: false,
    ownerId: 'wizard',
    spellId: 7,
    spellKind: 'fire',
    tick: 1,
  }])
  assert.equal(result.enemies.actors[0]!.currentHealth, 5)
  assert.equal(result.enemies.actors[1]!.currentHealth, 1)
  assert.deepEqual(result.spells.projectiles, [])
  assert.deepEqual(result.spells.transients.map(({ kind }) => kind), ['fire-impact'])
  assert.equal(result.spells.nextId, 101)
})

test('native projectile radius participates in swept enemy contact', () => {
  const spawned = spawnSkeletons([{ x: 50, y: 31 }])
  const enemy = spawned.actors[0]!
  const enemies = {
    ...spawned,
    actors: [{
      ...enemy,
      config: { ...enemy.config, collisionRadius: 10 },
    }],
  }
  const spells = spellState({
    projectiles: [projectile({
      id: 7,
      kind: 'fire',
      position: { x: 100, y: 0 },
      velocity: { x: 100, y: 0 },
    })],
  })

  const result = resolveBoneyardSpellCombat(enemies, spells, [], 1, WORLD_KEY)

  assert.equal(result.hits[0]?.actorId, enemy.id)
  assert.deepEqual(result.spells.projectiles, [])
})

test('world contact retires a projectile before an actor hidden behind collision', () => {
  const enemies = spawnSkeletons([{ x: 80, y: 0 }])
  const spells = spellState({
    projectiles: [projectile({
      id: 7,
      kind: 'fire',
      position: { x: 100, y: 0 },
      velocity: { x: 100, y: 0 },
    })],
  })

  const result = resolveBoneyardSpellCombat(
    enemies,
    spells,
    [],
    1,
    WORLD_KEY,
    () => 0.4,
  )

  assert.deepEqual(result.hits, [])
  assert.equal(result.enemies, enemies)
  assert.deepEqual(result.spells.projectiles, [])
  assert.deepEqual(result.spells.transients, [{
    ageTicks: 0,
    id: 100,
    kind: 'fire-impact',
    origin: { x: 40, y: 0 },
    ownerId: 'wizard',
    worldKey: WORLD_KEY,
  }])
})

test('a nearer actor wins over later terrain and publishes one Fire impact', () => {
  const enemies = spawnSkeletons([{ x: 40, y: 0 }])
  const spells = spellState({
    projectiles: [projectile({
      id: 7,
      kind: 'fire',
      position: { x: 100, y: 0 },
      velocity: { x: 100, y: 0 },
    })],
  })

  const result = resolveBoneyardSpellCombat(
    enemies,
    spells,
    [],
    1,
    WORLD_KEY,
    () => 0.9,
  )

  assert.equal(result.hits[0]?.actorId, 1)
  assert.deepEqual(result.spells.projectiles, [])
  assert.deepEqual(result.spells.transients.map(({ kind }) => kind), ['fire-impact'])
})

test('terrain wins an exact projectile-contact tie', () => {
  const spawned = spawnSkeletons([{ x: 50, y: 0 }])
  const enemy = spawned.actors[0]!
  const enemies = {
    ...spawned,
    actors: [{
      ...enemy,
      config: { ...enemy.config, collisionRadius: 0 },
    }],
  }
  const spells = spellState({
    projectiles: [projectile({
      id: 7,
      kind: 'fire',
      position: { x: 100, y: 0 },
      velocity: { x: 100, y: 0 },
    })],
  })

  const result = resolveBoneyardSpellCombat(
    enemies,
    spells,
    [],
    1,
    WORLD_KEY,
    () => 0.275,
  )

  assert.deepEqual(result.hits, [])
  assert.equal(result.enemies.actors[0]!.currentHealth, 5)
  const impact = result.spells.transients[0]
  assert.ok(impact?.kind === 'fire-impact')
  assert.deepEqual({ ...impact, origin: undefined }, {
    ageTicks: 0,
    id: 100,
    kind: 'fire-impact',
    origin: undefined,
    ownerId: 'wizard',
    worldKey: WORLD_KEY,
  })
  assert.ok(Math.abs(impact.origin.x - 27.5) < 1e-12)
  assert.equal(impact.origin.y, 0)
})

test('point contacts consume captured damage and multiply Earth base damage by charge', () => {
  const enemies = spawnSkeletons([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
  ])
  const spells = spellState({
    projectiles: [
      projectile({ id: 4, kind: 'earth', charge: 0.5, damage: 30, position: { x: 200, y: 0 } }),
      projectile({ id: 3, kind: 'ether', damage: 2, position: { x: 100, y: 0 } }),
      projectile({ id: 2, kind: 'ether', damage: 4, position: { x: 0, y: 0 } }),
    ],
  })

  const result = resolveBoneyardSpellCombat(enemies, spells, [], 1, WORLD_KEY)

  assert.deepEqual(result.hits.map((hit) => [hit.spellId, hit.amount, hit.actorId]), [
    [2, 4, 1],
    [3, 2, 2],
    [4, 15, 3],
  ])
  assert.deepEqual(result.spells.projectiles, [])
  assert.deepEqual(result.enemies.actors.map((actor) => actor.currentHealth), [1, 3, -10])
  const killed = result.enemies.actors[2]!
  assert.equal(killed.lifeState, 'dying')
  assert.equal(killed.deathStartedTick, 1)
  assert.equal(killed.lastDamagedByPlayerId, 'wizard')
  assert.equal(result.hits[2]!.killed, true)
  const earthImpact = result.spells.transients.find(({ kind }) => kind === 'earth-impact')
  assert.ok(earthImpact?.kind === 'earth-impact')
  assert.equal(earthImpact.birthTick, 1)
  assert.equal(earthImpact.charge, 0.5)
  assert.equal(result.spells.transients.length, 1)

  const repeated = resolveBoneyardSpellCombat(
    result.enemies,
    result.spells,
    [],
    2,
    WORLD_KEY,
  )
  assert.equal(repeated.spells, result.spells)
  assert.equal(repeated.spells.transients.length, 1)
})

test('projectiles ignore dying actors and continue to the first living contact', () => {
  let enemies = spawnSkeletons([
    { x: 20, y: 0 },
    { x: 70, y: 0 },
  ])
  const lethal = resolveBoneyardSpellCombat(enemies, spellState({
    projectiles: [projectile({
      id: 1,
      kind: 'earth',
      charge: 1,
      position: { x: 20, y: 0 },
    })],
  }), [], 1, WORLD_KEY)
  enemies = lethal.enemies

  const result = resolveBoneyardSpellCombat(enemies, spellState({
    projectiles: [projectile({
      id: 2,
      kind: 'fire',
      position: { x: 100, y: 0 },
      velocity: { x: 100, y: 0 },
    })],
  }), [], 2, WORLD_KEY)

  assert.equal(result.hits[0]!.actorId, 2)
  assert.equal(result.enemies.actors[0]!.lifeState, 'dying')
  assert.equal(result.enemies.actors[1]!.currentHealth, 1)
})

test('semantic Air and Water emissions consume their rank-indexed tick damage', () => {
  const enemies = spawnSkeletons([
    { x: 50, y: 0 },
    { x: 200, y: 0 },
    { x: 240, y: 0 },
    { x: -40, y: 0 },
  ])
  const spells = spellState({
    transients: [
      transient({ id: 11, kind: 'water' }),
      transient({ id: 12, kind: 'water' }),
      transient({ id: 10, kind: 'air', targetId: 'enemy:2' }),
    ],
  })

  const result = resolveBoneyardSpellCombat(enemies, spells, [
    emission({ damage: 0.035, id: 11, kind: 'water', manaCost: 0.175 }),
    emission({ damage: 0.04, id: 10, kind: 'air', manaCost: 0.14 }),
  ], 1, WORLD_KEY)

  assert.deepEqual(result.hits.map((hit) => [hit.spellId, hit.actorId, hit.amount]), [
    [10, 2, 0.04],
    [11, 1, 0.035],
    [11, 2, 0.035],
  ])
  assert.ok(Math.abs(result.enemies.actors[0]!.currentHealth - 4.965) < 1e-12)
  assert.ok(Math.abs(result.enemies.actors[1]!.currentHealth - 4.925) < 1e-12)
  assert.equal(result.enemies.actors[2]!.currentHealth, 5)
  assert.equal(result.enemies.actors[3]!.currentHealth, 5)
  assert.equal(result.spells, spells)
})

test('selected Air contact respects terrain ordering and terrain wins a tie', () => {
  const spawned = spawnSkeletons([{ x: 100, y: 0 }])
  const enemy = spawned.actors[0]!
  const enemies = {
    ...spawned,
    actors: [{
      ...enemy,
      config: { ...enemy.config, collisionRadius: 10 },
    }],
  }
  const spells = spellState({
    transients: [transient({ id: 10, kind: 'air', targetId: 'enemy:1' })],
  })
  const selectedContactProgress = 0.9

  const tied = resolveBoneyardSpellCombat(
    enemies,
    spells,
    [emission({ id: 10, kind: 'air' })],
    1,
    WORLD_KEY,
    () => selectedContactProgress,
  )
  assert.deepEqual(tied.hits, [])
  assert.equal(tied.enemies.actors[0]!.currentHealth, 5)

  const actorFirst = resolveBoneyardSpellCombat(
    enemies,
    spells,
    [emission({ id: 10, kind: 'air' })],
    1,
    WORLD_KEY,
    () => selectedContactProgress + 0.01,
  )
  assert.equal(actorFirst.hits[0]?.actorId, 1)
  assert.equal(actorFirst.enemies.actors[0]!.currentHealth, 4.975)
})

for (const kind of ['water'] as const) {
  test(`${kind} terrain contact blocks targets at and beyond the wall`, () => {
    const spawned = spawnSkeletons([
      { x: 50, y: 0 },
      { x: 112.5, y: 0 },
      { x: 160, y: 0 },
    ])
    const enemies = {
      ...spawned,
      actors: spawned.actors.map((actor) => ({
        ...actor,
        config: { ...actor.config, collisionRadius: 10 },
      })),
    }
    const worldContactCalls: Array<{
      end: Readonly<{ x: number; y: number }>
      radius: number
      start: Readonly<{ x: number; y: number }>
    }> = []

    const result = resolveBoneyardSpellCombat(
      enemies,
      spellState({ transients: [transient({
        direction: { x: 0.8, y: 0.2 },
        id: 10,
        kind,
      })] }),
      [emission({ id: 10, kind })],
      1,
      WORLD_KEY,
      (start, end, radius) => {
        worldContactCalls.push({ end, radius, start })
        return 0.5
      },
    )

    assert.deepEqual(worldContactCalls, [{
      end: { x: 205, y: 0 },
      radius: 0,
      start: { x: 0, y: 0 },
    }])
    assert.deepEqual(result.hits.map((hit) => hit.actorId), [1])
    assert.ok(Math.abs(result.enemies.actors[0]!.currentHealth - 4.975) < 1e-12)
    assert.equal(result.enemies.actors[1]!.currentHealth, 5)
    assert.equal(result.enemies.actors[2]!.currentHealth, 5)
  })
}

test('older channel transients never repeat their visual-lifetime damage', () => {
  const enemies = spawnSkeletons([{ x: 50, y: 0 }])
  const spells = spellState({
    transients: [transient({ ageTicks: 1, id: 10, kind: 'air' })],
  })

  const result = resolveBoneyardSpellCombat(enemies, spells, [], 1, WORLD_KEY)

  assert.deepEqual(result.hits, [])
  assert.equal(result.enemies, enemies)
  assert.equal(result.spells, spells)
})

test('Fire and Earth presentation transients never become channel damage rays', () => {
  const enemies = spawnSkeletons([{ x: 50, y: 0 }])
  const spells = spellState({
    transients: [
      {
        ageTicks: 0,
        direction: { x: 1, y: 0 },
        id: 20,
        kind: 'fire',
        origin: { x: 0, y: 0 },
        ownerId: 'wizard',
        variant: 0,
        worldKey: WORLD_KEY,
      },
      {
        ageTicks: 0,
        falling: false,
        fallVelocity: 0,
        height: -2,
        id: 21,
        kind: 'earth-called-rock',
        lateralMagnitude: 0,
        ownerId: 'wizard',
        parentId: 1,
        position: { x: 0, y: 0 },
        rotation: 0,
        rotationStep: 0,
        scale: 1,
        speed: 0.1,
        targetHeight: -40,
        variant: 0,
        worldKey: WORLD_KEY,
      },
      {
        ageTicks: 0,
        birthTick: 1,
        charge: 1,
        id: 22,
        kind: 'earth-impact',
        lifetimeTicks: 10,
        origin: { x: 0, y: 0 },
        ownerId: 'wizard',
        worldKey: WORLD_KEY,
      },
    ],
  })

  const result = resolveBoneyardSpellCombat(enemies, spells, [], 1, WORLD_KEY)

  assert.deepEqual(result.hits, [])
  assert.equal(result.enemies, enemies)
  assert.equal(result.spells, spells)
})

test('world-mismatched spells remain live without touching Boneyard actors', () => {
  const enemies = spawnSkeletons([{ x: 0, y: 0 }])
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
  assert.equal(result.spells.projectiles.length, 1)
})

test('equal path contacts choose the lower stable actor id regardless of array order', () => {
  const spawned = spawnSkeletons([
    { x: 50, y: 0 },
    { x: 50, y: 0 },
  ])
  const first = spawned.actors[0]!
  const second = {
    ...spawned.actors[1]!,
    config: {
      ...spawned.actors[1]!.config,
      collisionRadius: first.config.collisionRadius,
    },
  }
  const enemies = {
    ...spawned,
    actors: [second, first],
  }
  const spells = spellState({
    projectiles: [projectile({
      id: 8,
      kind: 'fire',
      position: { x: 100, y: 0 },
      velocity: { x: 100, y: 0 },
    })],
  })

  const result = resolveBoneyardSpellCombat(enemies, spells, [], 1, WORLD_KEY)

  assert.equal(result.hits[0]!.actorId, 1)
  assert.equal(result.enemies.actors.find((actor) => actor.id === 1)!.currentHealth, 1)
  assert.equal(result.enemies.actors.find((actor) => actor.id === 2)!.currentHealth, 5)
})

function spawnSkeletons(positions: readonly Readonly<{ x: number; y: number }>[]): BoneyardEnemyStore {
  return stepBoneyardEnemyStore(createBoneyardEnemyStore('spell-combat'), {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: (request) => request.requestedPosition,
    resolveSpawnIntents: () => positions.map((position, index): BoneyardEnemySpawnIntent => ({
      enemyToken: 'SKELETON',
      flags: [],
      id: index + 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
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
    damage: options.damage ?? {
      earth: 10,
      ether: 1 + (options.id & 1),
      fire: 4,
    }[options.kind],
    direction: normalized(velocity),
    flightTicks: 1,
    id: options.id,
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
        kind: 'earth',
      }
    case 'ether':
      return {
        ...common,
        headingDegrees: 0,
        kind: 'ether',
        targetId: null,
        turnAccumulator: 0,
      }
    case 'fire':
      return { ...common, kind: 'fire' }
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
    variant: 0,
    worldKey: options.worldKey ?? WORLD_KEY,
  }
  switch (options.kind) {
    case 'air':
      return {
        ...common,
        endpoint: { x: 205, y: 0 },
        kind: 'air',
        midpoint: { x: 102.5, y: 0 },
        targetId: options.targetId ?? null,
      }
    case 'water':
      return {
        ...common,
        kind: 'water',
        obstructionPoint: null,
      }
  }
}

function emission(options: {
  damage?: number
  id: number
  kind: PrimarySpellChannelEmission['kind']
  manaCost?: number
  worldKey?: string
}): PrimarySpellChannelEmission {
  return {
    damage: options.damage ?? 0.025,
    direction: { x: 1, y: 0 },
    id: options.id,
    kind: options.kind,
    manaCost: options.manaCost ?? (options.kind === 'air' ? 0.12 : 0.125),
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    worldKey: options.worldKey ?? WORLD_KEY,
  }
}

function normalized(vector: Readonly<{ x: number; y: number }>): { x: number; y: number } {
  const length = Math.hypot(vector.x, vector.y)
  return length === 0
    ? { x: 1, y: 0 }
    : { x: vector.x / length, y: vector.y / length }
}
