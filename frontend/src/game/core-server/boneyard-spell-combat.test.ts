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
import {
  createPrimarySpellFireDetonation,
  type PrimarySpellChannelEmission,
  type PrimarySpellProjectileState,
  type PrimarySpellSimulationState,
  type PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  createNativeWeldPersistentActor,
  type NativeWeldOneShotBuildId,
} from '../core-kernels/native-weld-primary-runtime.ts'
import type { NativeWeldPrimarySkillProfile } from '../core-kernels/native-primary-skill-profile.ts'
import type { NativeSecondarySteamedPulse } from '../core-kernels/native-secondary-abilities.ts'
import { spawnNativeWeldSteamActor } from '../core-kernels/native-weld-steam.ts'
import { nativeEtherBlastDamage } from '../core-kernels/native-ether-blast.ts'
import { createNativeHurricanePresentation } from '../core-kernels/native-hurricane.ts'
import {
  spawnNativeFireGoodImp,
  stepNativeFireGoodImp,
  type NativeFireActorContact,
} from '../core-kernels/primary-spell-fire-effects.ts'
import type {
  NativeWeldBuildId,
  NativeWeldCastKind,
} from '../core-kernels/native-weld-primary-profile.ts'
import {
  createBoneyardEnemyStore,
  stepBoneyardEnemyStore,
  type BoneyardEnemyProjectile,
  type BoneyardEnemyStore,
  type BoneyardMaggotActor,
} from './boneyard-enemy-store.ts'
import {
  nativeWeldFrostRadialRadius,
  resolveBoneyardSpellCombat,
  WATER_PRIMARY_ACTOR_MASK,
  WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK,
  type BoneyardSpellWorldContact,
} from './boneyard-spell-combat.ts'

const WORLD_KEY = 'boneyard:combat-test'
const COMBAT_RNG = createNativeRng(17)
const TEST_ENEMY_PATH = Object.freeze({
  baseTurnRate: 0.75,
  flankAngleDeg: 0,
  flankRadius: 0,
  flankTicksRemaining: 0,
  reorientationTicksRemaining: 0,
  speedFactor: 1,
  stalledMovementTicks: 0,
  turnFactor: 1,
  wanderHeadingDeg: 0,
})

test('GoodImp keeps a valid hostile until the native 300-tick refresh edge', () => {
  const spawned = spawnNativeFireGoodImp({
    burnDamage: 1,
    damage: 2,
    id: 1,
    lifetimeTicks: 1_000,
    ownerId: 'player',
    position: { x: 0, y: 0 },
    worldKey: WORLD_KEY,
  }, createNativeRng(31))
  const target = (id: string, x: number): PrimarySpellTarget => ({
    active: true,
    actorFlags: 0x2,
    attachment: { x: 0, y: 0 },
    bodyRadius: 10,
    cellBindingOrder: id === 'a' ? 0 : 1,
    headingDeg: 90,
    id,
    kind: 'enemy',
    nativePriority: 0,
    pendingRemove: false,
    position: { x, y: 0 },
    registrationOrder: id === 'a' ? 0 : 1,
  })
  const acquired = stepNativeFireGoodImp(spawned.goodImp, {
    canOccupy: () => false,
    rng: spawned.rng,
    targets: [target('a', 1_000), target('b', 2_000)],
  })
  assert.equal(acquired.goodImp?.targetId, 'a')
  assert.equal(acquired.goodImp?.nextTargetRefreshTick, 300)

  const retained = stepNativeFireGoodImp({
    ...acquired.goodImp!,
    ageTicks: 299,
  }, {
    canOccupy: () => false,
    rng: acquired.rng,
    targets: [target('a', 2_000), target('b', 100)],
  })
  assert.equal(retained.goodImp?.targetId, 'a')

  const refreshed = stepNativeFireGoodImp({
    ...retained.goodImp!,
    ageTicks: 300,
  }, {
    canOccupy: () => false,
    rng: retained.rng,
    targets: [target('a', 2_000), target('b', 100)],
  })
  assert.equal(refreshed.goodImp?.targetId, 'b')
  assert.equal(refreshed.goodImp?.nextTargetRefreshTick, 600)
})

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
    fireActorContacts?: readonly NativeFireActorContact[]
    fireballCorridorLength?: number
    primarySceneryTargets?: readonly PrimarySpellTarget[]
    rngSeed?: number
    steamedPulses?: readonly NativeSecondarySteamedPulse[]
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
    options.primarySceneryTargets ?? [],
    undefined,
    options.fireActorContacts ?? [],
    options.resolveMovement ?? ((_actorId, _start, requested) => requested),
    options.steamedPulses ?? [],
    () => options.fireballCorridorLength ?? 1_600,
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

test('Fire detonation replays registered Ember pre-tick contacts once and consumes the child', () => {
  const base = projectile({ id: 7, kind: 'fire' })
  if (base.kind !== 'fire') throw new Error('Expected a Fire projectile fixture')
  const detonation = createPrimarySpellFireDetonation(
    100,
    {
      ...base,
      burnDamage: 2,
      emberDamage: 3,
      emberFragments: 1,
      privateSeed: 123_456,
    },
    { x: 0, y: 0 },
    createNativeRng(900),
  )
  const firstContact = detonation.contacts[0]!
  const enemies = spawnEnemies([{
    position: { ...firstContact.position },
    token: 'SKELETON',
  }])
  const result = resolveCombatWithAuthority(
    enemies,
    {
      nextId: detonation.nextId,
      projectiles: [],
      transients: detonation.transients,
    },
    [],
    1,
    { fireActorContacts: detonation.contacts },
  )

  assert.deepEqual(result.hits.map(({ amount, spellKind }) => ({ amount, spellKind })), [{
    amount: 3,
    spellKind: 'fire-ember',
  }])
  assert.deepEqual(result.burns, [{ damage: 2, ownerId: 'wizard', targetId: 1 }])
  assert.equal(result.spells.transients.some(({ id }) => id === firstContact.spellId), false)
  assert.deepEqual(result.spells.transients.map(({ kind }) => kind), [
    'fire-impact',
    'fire-impact',
  ])
})

test('Ether Blast damages current HP in the strict 175-radius query and requests EtherBurn', () => {
  const spawned = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
    { position: { x: 175, y: 0 }, token: 'SKELETON' },
  ])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({
      ...actor,
      config: { ...actor.config, maximumHealth: 100 },
      currentHealth: 100,
    })),
  }
  const pulse: PrimarySpellTransientState = {
    ageTicks: 0,
    birthTick: 7,
    charges: 2,
    id: 9,
    kind: 'ether-blast',
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    presentationRng: createNativeRng(14),
    worldKey: WORLD_KEY,
  }
  const result = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [pulse] }),
    [],
    7,
  )
  const amount = nativeEtherBlastDamage(2, 100)
  assert.deepEqual(
    result.hits.map(({ actorId, amount: hitAmount, spellKind }) => ({
      actorId,
      amount: hitAmount,
      spellKind,
    })),
    [{ actorId: 1, amount, spellKind: 'ether-blast' }],
  )
  assert.equal(result.enemies.actors[0]!.currentHealth, 100 - amount)
  assert.equal(result.enemies.actors[0]!.config.maximumHealth, 100)
  assert.equal(result.enemies.actors[1]!.currentHealth, 100)
  assert.deepEqual(result.etherBurns, [{ ownerId: 'wizard', targetId: 1 }])

  const retained = resolveCombatWithAuthority(result.enemies, result.spells, [], 8)
  assert.deepEqual(retained.etherBurns, [])
  assert.deepEqual(retained.hits, [])
})

test('Hurricane batches clockwise force, target-owned cooldown, and charge-cubed contact', () => {
  const spawned = spawnEnemies([{ position: { x: 100, y: 0 }, token: 'SKELETON' }])
  const actor = spawned.actors[0]!
  const enemies = {
    ...spawned,
    actors: [{
      ...actor,
      config: { ...actor.config, maximumHealth: 100 },
      currentHealth: 100,
      hurricaneContactCooldown: 0,
    }],
  }
  const initialRng = createNativeRng(2900)
  const program = createNativeHurricanePresentation(createNativeRng(29)).program
  const hurricane: PrimarySpellTransientState = {
    ageTicks: 1,
    birthTick: 0,
    charge: 1,
    contactCharge: 1,
    damageMaximum: 10,
    damageMinimum: 10,
    enhancedEffects: true,
    id: 10,
    kind: 'air-hurricane',
    lanes: program.lanes,
    ownerId: 'wizard',
    phaseDegrees: 0,
    position: { x: 0, y: 0 },
    worldKey: WORLD_KEY,
  }
  const movements: Readonly<{ x: number; y: number }>[] = []
  const result = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [hurricane] }),
    [],
    1,
    {
      damageMultiplier: (_actorId, kind) => kind === 'air' ? 2 : 1,
      resolveMovement: (_actorId, _start, requested) => {
        movements.push({ ...requested })
        return requested
      },
      rngSeed: 2900,
    },
  )
  assert.deepEqual(movements, [{ x: 100, y: 14.986320495605469 }])
  assert.equal(result.enemies.actors[0]?.currentHealth, 80)
  assert.equal(result.enemies.actors[0]?.hurricaneContactCooldown, 100)
  assert.deepEqual(result.hits.map(({ amount, ownerId, spellKind }) => ({
    amount,
    ownerId,
    spellKind,
  })), [{ amount: 20, ownerId: 'wizard', spellKind: 'air-hurricane' }])
  assert.deepEqual(result.events.map(({ sound }) => sound), ['bone-crack'])
  assert.deepEqual(result.rng, initialRng, 'equal damage endpoints consume no RNG word')

  const boundaryMovement: unknown[] = []
  const boundary = resolveCombatWithAuthority(
    {
      ...enemies,
      actors: [{
        ...enemies.actors[0]!,
        hurricaneContactCooldown: 0,
        position: { x: 280, y: 0 },
      }],
    },
    spellState({ transients: [hurricane] }),
    [],
    1,
    { resolveMovement: (...args) => {
      boundaryMovement.push(args)
      return args[2]
    } },
  )
  assert.deepEqual(boundary.hits, [])
  assert.deepEqual(boundaryMovement, [])

  const goodImpSpawn = spawnNativeFireGoodImp({
    burnDamage: 0,
    damage: 10,
    id: 11,
    lifetimeTicks: 100,
    ownerId: 'wizard',
    position: { x: 100, y: 0 },
    worldKey: WORLD_KEY,
  }, createNativeRng(11))
  const goodImp = {
    ...goodImpSpawn.goodImp,
    kind: 'fire-good-imp' as const,
    lightRegistration: { managerLane: 'actor' as const, registrationOrdinal: 11 },
  }
  const friendly = resolveCombatWithAuthority(
    createBoneyardEnemyStore('hurricane-good-imp'),
    spellState({ transients: [hurricane, goodImp] }),
    [],
    1,
  )
  const movedImp = friendly.spells.transients.find(({ id }) => id === 11)
  assert.equal(movedImp?.kind, 'fire-good-imp')
  assert.deepEqual(
    movedImp?.kind === 'fire-good-imp' ? movedImp.position : null,
    { x: 100, y: 14.986320495605469 },
  )
  assert.deepEqual(friendly.hits, [], 'friendly GoodImp receives only Hurricane orbit force')

  const maggot: BoneyardMaggotActor = {
    collisionRadius: 8,
    currentHealth: 100,
    damage: 2,
    deathOffsets: [],
    deathEpoch: null,
    deathStartedTick: null,
    deathTick: 0,
    emergenceTick: 24,
    gaitPose: 0,
    headingDeg: 90,
    hurricaneContactCooldown: 0,
    id: 1,
    launchTrajectory: 'edge',
    launchVelocity: { x: 0, y: 0 },
    lastAttackTick: null,
    lastDamagedByPlayerId: null,
    lastDamageTick: null,
    lastMovementTick: null,
    lifeState: 'alive',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    maximumHealth: 100,
    movementPhase: 'crawl',
    nativeCellBindingOrder: 1,
    nativeRegistrationOrder: 1,
    nextAttackTick: 20,
    nextMovementTick: 2,
    nextTargetRefreshTick: 300,
    ownerCoffinActorId: 99,
    path: TEST_ENEMY_PATH,
    poisonDamage: 0,
    poisonDuration: 0,
    position: { x: 100, y: 0 },
    spawnTick: 0,
    staffActionFactor: 1,
    staffMovementFactor: 1,
    targetPlayerId: null,
    terminalEmitted: false,
  }
  const maggotContact = resolveCombatWithAuthority({
    ...createBoneyardEnemyStore('hurricane-maggot'),
    maggots: [maggot],
  }, spellState({ transients: [hurricane] }), [], 1)
  assert.equal(maggotContact.enemies.maggots[0]?.currentHealth, 90)
  assert.equal(maggotContact.enemies.maggots[0]?.hurricaneContactCooldown, 100)
  assert.deepEqual(maggotContact.enemies.maggots[0]?.position, {
    x: 100,
    y: 14.986320495605469,
  })
  assert.equal(maggotContact.hits[0]?.spellKind, 'air-hurricane')
})

test('low-charge Hurricane contact suppresses the ordinary target hit sound only', () => {
  const spawned = spawnEnemies([{ position: { x: 100, y: 0 }, token: 'SKELETON' }])
  const actor = spawned.actors[0]!
  const program = createNativeHurricanePresentation(createNativeRng(29)).program
  const result = resolveCombatWithAuthority({
    ...spawned,
    actors: [{
      ...actor,
      config: { ...actor.config, maximumHealth: 100 },
      currentHealth: 100,
      hurricaneContactCooldown: 0,
    }],
  }, spellState({
    transients: [{
      ageTicks: 1,
      birthTick: 0,
      charge: 0.4,
      contactCharge: 0.4,
      damageMaximum: 10,
      damageMinimum: 10,
      enhancedEffects: true,
      id: 10,
      kind: 'air-hurricane',
      lanes: program.lanes,
      ownerId: 'wizard',
      phaseDegrees: 0,
      position: { x: 0, y: 0 },
      worldKey: WORLD_KEY,
    }],
  }), [], 1)
  assert.equal(result.hits[0]?.amount, Math.fround(0.4 ** 3 * 10))
  assert.deepEqual(result.events, [])
  assert.equal(result.enemies.actors[0]?.lifeState, 'alive')
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
  assert.equal(result.rng.indexA, 8)
  assert.deepEqual(result.burns, [
    { damage: 10, ownerId: 'wizard', targetId: 1 },
    { damage: 10, ownerId: 'wizard', targetId: 1 },
    { damage: 10, ownerId: 'wizard', targetId: 2 },
  ])
})

test('Fire impact skips a nonpositive direct remainder but still detonates and retires', () => {
  const spawned = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
  ])
  const actor = spawned.actors[0]!
  const base = projectile({ id: 7, kind: 'fire' })
  if (base.kind !== 'fire') throw new Error('Expected a Fire fixture')
  const result = resolveBoneyardSpellCombat({
    ...spawned,
    actors: [{
      ...actor,
      config: { ...actor.config, maximumHealth: 100 },
      currentHealth: 100,
    }],
  }, spellState({
    projectiles: [{
      ...base,
      burnDamage: 10,
      damage: 5,
      emberDamage: 0,
      emberFragments: 0,
      explodeDamage: 6,
      explodeRadius: 15,
    }],
  }), [], 1, WORLD_KEY, COMBAT_RNG)

  assert.deepEqual(
    result.hits.map(({ amount, spellKind }) => ({ amount, spellKind })),
    [{ amount: 3, spellKind: 'fire-explosion' }],
  )
  assert.equal(result.enemies.actors[0]!.currentHealth, 97)
  assert.deepEqual(result.burns, [
    { damage: 10, ownerId: 'wizard', targetId: actor.id },
  ])
  assert.deepEqual(result.spells.projectiles, [])
  assert.deepEqual(
    result.spells.transients.map(({ kind }) => kind),
    ['fire-impact', 'fire-explosion'],
  )
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
  const enemies = spawnEnemies([{ position: { x: -10, y: 0 }, token: 'SKELETON' }])
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
    COMBAT_RNG,
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
    COMBAT_RNG,
    null,
    undefined,
    () => 1,
    [sceneryTarget('grave-edge', 0.01, 20.01)],
  )
  assert.equal(equality.spells, spells, 'strict radius equality must miss the grave root')
})

test('Fireball suppresses an earlier scenery slot while a hostile occupies its live-width corridor', () => {
  const spawned = spawnEnemies([{ position: { x: 60, y: 0 }, token: 'SKELETON' }])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({
      ...actor,
      nativeCellBindingOrder: 1,
      nativeRegistrationOrder: 1,
    })),
  }
  const fire = projectile({
    id: 7,
    kind: 'fire',
    position: { x: 0, y: 0 },
    velocity: { x: 4.5, y: 0 },
  })
  const scenery = sceneryTarget('tree', 8, 10)
  const passed = resolveCombatWithAuthority(enemies, spellState({ projectiles: [fire] }), [], 9, {
    fireballCorridorLength: 100,
    primarySceneryTargets: [scenery],
  })
  assert.deepEqual(passed.hits, [])
  assert.deepEqual(passed.spells.projectiles.map(({ id }) => id), [fire.id])
  assert.deepEqual(passed.spells.transients, [])

  const pointBlank = resolveCombatWithAuthority(
    enemies,
    spellState({ projectiles: [fire] }),
    [],
    9,
    {
      fireballCorridorLength: 100,
      primarySceneryTargets: [{ ...scenery, position: { x: 1, y: 0 } }],
    },
  )
  assert.deepEqual(pointBlank.spells.projectiles, [])
  assert.deepEqual(pointBlank.spells.transients.map(({ kind }) => kind), ['fire-impact'])
})

test('MagicMissile family widens from hostile-only to flags-four scenery contact', () => {
  const spawned = spawnEnemies([{ position: { x: 50, y: 0 }, token: 'SKELETON' }])
  const scenery = sceneryTarget('tree', 8, 0)
  const retainedTargetId = `enemy:${spawned.actors[0]!.id}`
  const young = projectile({
    ageTicks: 199,
    id: 8,
    kind: 'ether',
    targetId: retainedTargetId,
  })
  const retained = resolveCombatWithAuthority(
    spawned,
    spellState({ projectiles: [young] }),
    [],
    199,
    { primarySceneryTargets: [scenery] },
  )
  assert.deepEqual(retained.spells.projectiles.map(({ id }) => id), [young.id])

  for (const widened of [
    projectile({ ageTicks: 199, id: 9, kind: 'ether', targetId: null }),
    projectile({ ageTicks: 200, id: 10, kind: 'ether', targetId: retainedTargetId }),
  ]) {
    const result = resolveCombatWithAuthority(
      spawned,
      spellState({ projectiles: [widened] }),
      [],
      widened.ageTicks,
      { primarySceneryTargets: [scenery] },
    )
    assert.deepEqual(result.hits, [])
    assert.deepEqual(result.spells.projectiles, [])
    assert.deepEqual(result.spells.transients.map(({ kind }) => kind), ['ether-impact'])
  }
})

test('all three MagicMissile-derived welds inherit widened scenery retirement', () => {
  const scenery = sceneryTarget('tree', 8, 0)
  for (const buildId of [1000, 1001, 1002] as const) {
    const spell = projectile({ ageTicks: 200, buildId, id: buildId, kind: 'weld' })
    const result = resolveCombatWithAuthority(
      createBoneyardEnemyStore(`weld-scenery-${buildId}`),
      spellState({ projectiles: [spell] }),
      [],
      200,
      { primarySceneryTargets: [scenery] },
    )
    assert.deepEqual(result.hits, [])
    assert.deepEqual(result.spells.projectiles, [])
    assert.ok(result.spells.transients.some(({ kind }) => kind === 'weld-impact'))
  }
})

test('welded missile contacts preserve each native elemental payload and impact owner', () => {
  const spawned = spawnEnemies([{ position: { x: 0, y: 0 }, token: 'SKELETON' }])
  const enemy = spawned.actors[0]!
  const enemies = {
    ...spawned,
    actors: [{ ...enemy, currentHealth: 100, maximumHealth: 100 }],
  }

  const burning = resolveCombatWithAuthority(enemies, spellState({
    projectiles: [projectile({
      buildId: 1000,
      id: 801,
      kind: 'weld',
      vector: [5, 5, 10, 1, 1, 6, 10, 0, 0],
    })],
  }), [], 31)
  assert.deepEqual(burning.hits.map(({ amount, spellKind }) => ({ amount, spellKind })), [
    { amount: 5, spellKind: 'weld' },
    { amount: 3, spellKind: 'fire-explosion' },
  ])
  assert.deepEqual(
    burning.spells.transients.map(({ kind }) => kind),
    ['weld-impact', 'fire-explosion'],
  )

  const frost = resolveCombatWithAuthority(enemies, spellState({
    projectiles: [projectile({
      buildId: 1001,
      id: 802,
      kind: 'weld',
      vector: [5, 5, 10, 1, 1, 0.75, 0.2],
    })],
  }), [], 32)
  assert.deepEqual(frost.targetEffects, [{
    patch: {
      coldSlowFactor: 0.5,
      coldSlowMaterial: true,
      coldSlowTicks: 150,
    },
    targetId: 1,
    worldKey: WORLD_KEY,
  }])

  const lightning = resolveCombatWithAuthority(enemies, spellState({
    projectiles: [projectile({
      buildId: 1002,
      id: 803,
      kind: 'weld',
      vector: [5, 5, 10, 1, 1, 2, 0.64],
    })],
  }), [], 33)
  assert.deepEqual(lightning.targetEffects, [{
    patch: { electricBurn: {
      arcCount: 2,
      damagePerTick: 0.05,
      ownerId: 'wizard',
      sourceActorId: 803,
      stunFactor: 0.64,
      ticks: 100,
    } },
    targetId: 1,
    worldKey: WORLD_KEY,
  }])
})

test('Frost Missile owns its fifteen-step radial damage and ColdSlow contact', () => {
  const radius = nativeWeldFrostRadialRadius(0.2)
  let expectedRadius = Math.fround(0.2 * 120)
  for (let step = 0; step < 15; step += 1) {
    expectedRadius = Math.fround(expectedRadius * 1.024999976158142)
  }
  assert.equal(radius, expectedRadius)
  const spawned = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
    { position: { x: radius - 1, y: 0 }, token: 'SKELETON' },
    { position: { x: radius + 100, y: 0 }, token: 'SKELETON' },
  ])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({
      ...actor,
      currentHealth: 100,
      maximumHealth: 100,
    })),
  }
  const result = resolveCombatWithAuthority(enemies, spellState({
    projectiles: [projectile({
      buildId: 1001,
      damage: 5,
      id: 804,
      kind: 'weld',
      vector: [5, 5, 10, 1, 1, 0.2, 0],
    })],
  }), [], 34)
  assert.deepEqual(result.hits.map(({ actorId, amount }) => ({ actorId, amount })), [
    { actorId: 1, amount: 5 },
    { actorId: 1, amount: 0.25 },
    { actorId: 2, amount: 0.25 },
  ])
  assert.deepEqual(result.targetEffects.map(({ targetId }) => targetId), [1, 2])
})

test('Crawling Shock uses its 15-unit query and survives exactly its captured contacts', () => {
  const spawned = spawnEnemies([{ position: { x: 28.999, y: 0 }, token: 'SKELETON' }])
  const enemy = spawned.actors[0]!
  const enemies = {
    ...spawned,
    actors: [{
      ...enemy,
      config: { ...enemy.config, collisionRadius: 14 },
      currentHealth: 100,
      maximumHealth: 100,
    }],
  }
  const source = projectile({
    buildId: 1009,
    contactsRemaining: 2,
    damage: 4,
    id: 809,
    kind: 'weld',
    vector: [4, 10, 2, 0.7, 1, 1.25],
  })
  const first = resolveCombatWithAuthority(
    enemies,
    spellState({ projectiles: [source] }),
    [],
    40,
  )
  assert.deepEqual(first.hits.map(({ amount }) => amount), [4])
  assert.equal(first.spells.projectiles[0]?.kind, 'weld')
  if (first.spells.projectiles[0]?.kind !== 'weld') throw new Error('expected GroundSpark')
  assert.equal(first.spells.projectiles[0].contactsRemaining, 1)
  assert.deepEqual(first.targetEffects, [{
    patch: { electricBurn: {
      arcCount: 2,
      damagePerTick: 0.08,
      ownerId: 'wizard',
      sourceActorId: 809,
      stunFactor: 0.7,
      ticks: 50,
    } },
    targetId: 1,
    worldKey: WORLD_KEY,
  }])

  const last = resolveCombatWithAuthority(first.enemies, first.spells, [], 41)
  assert.deepEqual(last.spells.projectiles, [])
  assert.deepEqual(last.spells.transients.map(({ kind }) => kind), [
    'weld-impact',
    'weld-impact',
  ])
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
    { position: { x: 30, y: 0 }, token: 'SKELETON' },
    { position: { x: 120, y: 0 }, token: 'SKELETON' },
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

test('Piercing retries target selection without excluding the contacted actor', () => {
  const enemies = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
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
  const continued = result.spells.projectiles[0]
  assert.equal(continued?.kind, 'ether')
  if (continued?.kind === 'ether') assert.equal(continued.targetId, 'enemy:1')
})

test('Earth gathers strict roots once, shrinks, and sheds one independent contact rock', () => {
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
  assert.deepEqual(first.spells.transients.map(({ kind }) => kind), ['earth-boulder-bit'])
  assert.equal(first.spells.projectiles.length, 1)
  const boulder = first.spells.projectiles[0]
  assert.ok(boulder?.kind === 'earth')
  assert.deepEqual(boulder.hitTargetIds, ['enemy:1', 'enemy:2'])
  assert.equal(boulder.remainingDamage, 7.5)
  assert.equal(boulder.charge, 0.9125000238418579)
  assert.equal(boulder.assemblyCharge, 1)

  const repeated = resolveBoneyardSpellCombat(
    first.enemies,
    first.spells,
    [],
    2,
    WORLD_KEY,
    first.rng,
  )
  assert.deepEqual(repeated.hits, [])
  assert.deepEqual(repeated.spells.projectiles, first.spells.projectiles)
  assert.equal(repeated.spells.transients[0]?.kind, 'earth-boulder-bit')
  assert.equal(repeated.spells.transients[0]?.ageTicks, 0)
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
  assert.deepEqual(result.spells.transients.map(({ kind }) => kind), [
    'earth-boulder-bit',
    'earth-impact',
  ])
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
  assert.deepEqual(result.spells.transients.map(({ kind }) => kind), [
    'earth-boulder-bit',
    'earth-boulder-bit',
    'earth-impact',
  ])
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
  assert.equal(boulder.charge, 0.9649999737739563)
  assert.deepEqual(result.spells.transients.map(({ kind }) => kind), [
    'earth-boulder-bit',
    'earth-boulder-bit',
  ])
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
    lightRegistration: null,
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

test('Flame Lash retains the semantic Lightning target, chains, stuns, and owns Fire payloads', () => {
  const spawned = spawnEnemies([
    { position: { x: 20, y: 0 }, token: 'SKELETON' },
    { position: { x: 100, y: 0 }, token: 'SKELETON' },
  ])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({ ...actor, currentHealth: 100, maximumHealth: 100 })),
  }
  const profile = weldProfile(1003, [200, 10, 1, 0.4, 3, 8, 0, 0], 'channel')
  const result = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [{
      ageTicks: 0,
      birthTick: 1,
      buildId: 1003,
      direction: { x: 1, y: 0 },
      endpoint: { x: 20, y: 0 },
      id: 10,
      kind: 'weld-channel',
      lightRegistration: null,
      midpoint: { x: 10, y: 0 },
      origin: { x: 0, y: 0 },
      ownerId: 'wizard',
      targetId: 'enemy:1',
      underpowered: false,
      variant: 0,
      vector: profile.vector.values,
      worldKey: WORLD_KEY,
    }] }),
    [emission({ damage: 2, id: 10, kind: 'weld', primarySkill: profile })],
    1,
  )

  assert.deepEqual(result.hits.map(({ actorId, amount }) => ({ actorId, amount })), [
    { actorId: 1, amount: 2 },
    { actorId: 2, amount: Math.fround(2 * Math.fround(0.600000024)) },
  ])
  assert.deepEqual(result.targetEffects.filter(({ patch }) => patch.stunTicks !== undefined), [
    { patch: { stunFactor: 0.4, stunTicks: 25 }, targetId: 1, worldKey: WORLD_KEY },
    { patch: { stunFactor: 0.4, stunTicks: 25 }, targetId: 2, worldKey: WORLD_KEY },
  ])
  assert.equal(result.spells.transients.filter(({ kind }) => kind === 'fire-explosion').length, 2)
  const flameFades = result.spells.transients.filter(({ kind }) => (
    kind === 'weld-flame-lash-fade'
  ))
  assert.equal(flameFades.length, 2)
  assert.ok(flameFades.every((effect) => (
    effect.kind === 'weld-flame-lash-fade'
      && effect.variant === 'chain'
      && effect.record === 35
  )))
  assert.equal(result.spells.transients.some((effect) => (
    effect.kind === 'weld-channel' && effect.id !== 10 && effect.targetId === 'enemy:2'
  )), true)
})

test('Blizzard Beam combines its widened cone with chaining and applies Cold before Stun', () => {
  const spawned = spawnEnemies([
    { position: { x: 100, y: 0 }, token: 'SKELETON' },
    { position: { x: 180, y: 10 }, token: 'SKELETON' },
  ])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({ ...actor, currentHealth: 100, maximumHealth: 100 })),
  }
  const profile = weldProfile(1004, [200, 10, 1, 0.25, 0, 0.2, 0.04], 'channel')
  const result = resolveCombatWithAuthority(
    enemies,
    spellState({}),
    [emission({ damage: 2, id: 11, kind: 'weld', primarySkill: profile })],
    2,
  )

  assert.deepEqual(result.hits.map(({ actorId }) => actorId), [1, 2])
  assert.deepEqual(result.targetEffects.map(({ patch, targetId }) => ({
    kind: patch.coldSlowTicks === undefined ? 'stun' : 'cold',
    targetId,
  })), [
    { kind: 'cold', targetId: 1 }, { kind: 'stun', targetId: 1 },
    { kind: 'cold', targetId: 2 }, { kind: 'stun', targetId: 2 },
  ])
})

test('Steam particle contact installs its ten-tick Steamed payload and exports the pulse', () => {
  const spawned = spawnEnemies([{ position: { x: 0, y: 0 }, token: 'SKELETON' }])
  const actor = spawned.actors[0]!
  const enemies = {
    ...spawned,
    actors: [{ ...actor, currentHealth: 100, maximumHealth: 100 }],
  }
  const profile = weldProfile(1005, [300, 10, 5, 0.1, 4, 6, 2, 3], 'channel')
  const steam = spawnNativeWeldSteamActor({
    damage: 3,
    direction: { x: 1, y: 0 },
    id: 12,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    queryOrigin: { x: 0, y: 0 },
    rng: createNativeRng(0),
    tick: 2,
    underpowered: false,
    vector: profile.vector.values,
    worldKey: WORLD_KEY,
  }).actor
  assert.ok(steam?.kind === 'weld-steam' && steam.variant === 'normal')
  const applied = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [{ ...steam, contactDue: true }] }),
    [],
    1,
  )
  assert.deepEqual(applied.targetEffects, [{
    patch: { steamed: {
      damagePerTick: 3,
      emberDamage: 2,
      emberFragments: 3,
      explodeDamage: 4,
      explodeRadius: 6,
      ownerId: 'wizard',
      sourceActorId: 12,
      ticks: 10,
    } },
    targetId: 1,
    worldKey: WORLD_KEY,
  }])

  const pulsed = resolveCombatWithAuthority(
    applied.enemies,
    spellState({}),
    [],
    2,
    { steamedPulses: [{
      emberDamage: 2,
      emberFragments: 3,
      explodeDamage: 4,
      explodeRadius: 6,
      position: actor.position,
      sourcePlayerId: 'wizard',
      targetId: actor.id,
      worldKey: WORLD_KEY,
    }] },
  )
  assert.equal(pulsed.spells.transients.some(({ kind }) => kind === 'fire-explosion'), true)
  assert.equal(pulsed.spells.transients.filter(({ kind }) => kind === 'fire-ember').length, 3)
})

test('Meteor impact owns its 45-unit half-damage contact and ten-tick rooted pulse', () => {
  const spawned = spawnEnemies([
    { position: { x: 20, y: 0 }, token: 'SKELETON' },
    { position: { x: 70, y: 0 }, token: 'SKELETON' },
  ])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({ ...actor, currentHealth: 100, maximumHealth: 100 })),
  }
  const meteor: PrimarySpellTransientState = {
    ageTicks: 51,
    birthTick: 0,
    bodyScale: 1,
    buildId: 1007,
    cameraDisplacement: { x: 10, y: 0 },
    damage: 20,
    debris: Array.from({ length: 5 }, (_, index) => ({
      alpha: 2 as const,
      colorGreen: 0.25,
      height: 0,
      index,
      position: { x: 0, y: 0 },
      record: 2008 as const,
      rotationDegrees: 0,
      rotationStepDegrees: 1,
      scale: Math.fround(0.45),
      velocity: { x: 0, y: 0 },
      verticalVelocity: -1,
    })),
    direction: { x: 1, y: 0 },
    fallHeadingDegrees: 20,
    fallHeight: 0,
    fallStep: Math.fround(0.04),
    id: 20,
    impactAgeTicks: 0,
    impactDue: true,
    impactRadiusScalar: 1,
    impactRotationDegrees: 0,
    impactSoundPitch: null,
    impactThrowFirePitch: null,
    impactTicksRemaining: 200,
    kind: 'weld-meteor',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 20 },
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    phase: 'impact',
    position: { x: 0, y: 0 },
    privateSeed: 99,
    pulseDue: false,
    pulseSequence: 0,
    pulseTicksRemaining: 10,
    underpowered: false,
    vector: [10, 20, 2, 1, 2, 0, 0, 0, 0],
    worldKey: WORLD_KEY,
  }
  const impact = resolveCombatWithAuthority(enemies, spellState({ transients: [meteor] }), [], 3)
  assert.deepEqual(impact.hits.map(({ actorId, amount }) => ({ actorId, amount })), [{
    actorId: 1,
    amount: 10,
  }])

  const pulse = resolveCombatWithAuthority(enemies, spellState({ transients: [{
    ...meteor,
    cameraDisplacement: null,
    impactDue: false,
    pulseDue: true,
    pulseSequence: 1,
  }] }), [], 4)
  assert.deepEqual(pulse.hits.map(({ actorId, amount }) => ({ actorId, amount })), [
    { actorId: 1, amount: 1 },
  ])
})

test('released Ethereal Boulder pieces own independent native residual pools', () => {
  const spawned = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
    { position: { x: 10, y: 0 }, token: 'SKELETON' },
  ])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({
      ...actor,
      currentHealth: 4,
      maximumHealth: 4,
    })),
  }
  const boulder: PrimarySpellTransientState = {
    ageTicks: 5,
    assemblyScale: 0.5,
    birthTick: 0,
    buildId: 1006,
    damage: 10,
    direction: { x: 1, y: 0 },
    flightTicks: 5,
    hitTargetIds: [],
    id: 31,
    kind: 'weld-persistent',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 31 },
    lifetimeTicksRemaining: 1_000,
    maximumScale: 0.5,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    orientation: [...EARTH_BOULDER_IDENTITY_ORIENTATION],
    phase: 'flight',
    pulseSequence: 1,
    quantity: 0,
    remainingDamage: 10,
    scale: 0.5,
    shellScale: 0.5,
    speedFactor: 1,
    toughness: 2,
    vector: [10, 2, 1, 1, 2, 1],
    velocity: { x: 3, y: 0 },
    worldKey: WORLD_KEY,
  }
  const resolved = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [boulder] }),
    [],
    4,
  )
  assert.deepEqual(resolved.hits.map(({ actorId, amount }) => ({ actorId, amount })), [
    { actorId: 1, amount: 4 },
    { actorId: 2, amount: 4 },
  ])
  const retained = resolved.spells.transients.find(({ id }) => id === 31)
  assert.ok(retained?.kind === 'weld-persistent' && retained.buildId === 1006)
  assert.equal(retained.remainingDamage, 8)
  assert.equal(retained.scale, 0.4650000035762787)
  assert.equal(retained.shellScale, retained.scale)
  assert.equal(retained.assemblyScale, 0.5)
  assert.deepEqual(retained.hitTargetIds, ['enemy:1', 'enemy:2'])
  assert.equal(resolved.spells.transients.filter(({ kind }) => (
    kind === 'weld-boulder-debris'
  )).length, 2)
})

test('terminal Ethereal Boulder keeps the contact bit, Ether fade, and full breakup family', () => {
  const spawned = spawnEnemies([{ position: { x: 0, y: 0 }, token: 'SKELETON' }])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({
      ...actor,
      currentHealth: 20,
      maximumHealth: 20,
    })),
  }
  const created = createNativeWeldPersistentActor({
    buildId: 1006,
    direction: { x: 1, y: 0 },
    id: 33,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    tick: 0,
    vector: [10, 2, 1, 1, 1, 1],
    worldKey: WORLD_KEY,
  })
  assert.equal(created.buildId, 1006)
  if (created.buildId !== 1006) throw new Error('expected EBoulder')
  const source: PrimarySpellTransientState = {
    ...created,
    assemblyScale: 0.5,
    damage: 10,
    flightTicks: 1,
    maximumScale: 0.5,
    phase: 'flight',
    remainingDamage: 3,
    scale: 0.5,
    shellScale: 0.5,
    velocity: { x: 3, y: 0 },
  }
  const result = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [source] }),
    [],
    5,
  )
  assert.equal(result.spells.transients.some(({ id }) => id === source.id), false)
  assert.equal(result.spells.transients.filter(({ kind }) => (
    kind === 'weld-boulder-debris'
  )).length, 16)
  const fade = result.spells.transients.find((effect) => (
    effect.kind === 'weld-impact' && effect.buildId === 1006
  ))
  assert.ok(fade?.kind === 'weld-impact' && fade.buildId === 1006)
  assert.equal(fade.presentationScale, 2)
})

test('released Hailstones rocks contact at carrier offsets and divide only pool consumption', () => {
  const spawned = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
  ])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({
      ...actor,
      currentHealth: 4,
      maximumHealth: 4,
    })),
  }
  const hailstones: PrimarySpellTransientState = {
    ageTicks: 1,
    birthTick: 0,
    buildId: 1008,
    collisionRadius: 40,
    damage: 10,
    direction: { x: 1, y: 0 },
    id: 32,
    kind: 'weld-persistent',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 32 },
    maximumScale: 1,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    phase: 'flight',
    releaseAgeTicks: 1,
    releaseFadeScale: 1,
    pulseSequence: 1,
    pushback: 0,
    rocks: [{
      damageRemaining: 10,
      decay: 1,
      localPosition: { x: 0, y: 0, z: 0 },
      phase: 0,
      rockId: 0,
      releaseOffset: { x: 0, y: 0 },
      spriteRecord: 168,
      visualScale: 0.2,
    }],
    scale: 0.5,
    toughness: 2,
    vector: [10, 2, 1, 2, 0, 0],
    widen: 0,
    worldKey: WORLD_KEY,
  }
  const resolved = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [hailstones] }),
    [],
    4,
  )
  assert.deepEqual(resolved.hits.map(({ actorId, amount }) => ({ actorId, amount })), [
    { actorId: 2, amount: 4 },
    { actorId: 1, amount: 4 },
  ])
  const retained = resolved.spells.transients.find(({ id }) => id === 32)
  assert.ok(retained?.kind === 'weld-persistent' && retained.buildId === 1008)
  assert.equal(retained.rocks[0]!.damageRemaining, 6)
})

test('Hail contacts own ColdSlow, one resident Knockback, and per-rock line and flash retirement', () => {
  const spawned = spawnEnemies([
    { position: { x: 0, y: 0 }, token: 'SKELETON' },
  ])
  const enemies = {
    ...spawned,
    actors: spawned.actors.map((actor) => ({
      ...actor,
      currentHealth: 10,
      maximumHealth: 10,
    })),
  }
  const hailstones: PrimarySpellTransientState = {
    ageTicks: 2,
    birthTick: 0,
    buildId: 1008,
    collisionRadius: 40,
    damage: 1,
    direction: { x: 1, y: 0 },
    id: 40,
    kind: 'weld-persistent',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 40 },
    maximumScale: 1,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    phase: 'flight',
    pulseSequence: 1,
    pushback: 0.2,
    releaseAgeTicks: 1,
    releaseFadeScale: 1,
    rocks: [0, 1].map((rockId) => ({
      damageRemaining: 1,
      decay: 1,
      localPosition: { x: 0, y: 0, z: 0 },
      phase: 1,
      releaseOffset: { x: 0, y: 0 },
      rockId,
      spriteRecord: 168 as const,
      visualScale: 0.2,
    })),
    scale: 0.5,
    toughness: 1,
    vector: [1, 2, 1, 1, 0.2, 0],
    widen: 0,
    worldKey: WORLD_KEY,
  }
  const releaseTick = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [{ ...hailstones, releaseAgeTicks: 0 }] }),
    [],
    3,
  )
  assert.deepEqual(releaseTick.hits, [])

  const result = resolveCombatWithAuthority(
    enemies,
    spellState({ transients: [hailstones] }),
    [],
    4,
    { rngSeed: 44 },
  )
  assert.deepEqual(result.hits.map(({ actorId, amount }) => ({ actorId, amount })), [
    { actorId: 1, amount: 1 },
    { actorId: 1, amount: 1 },
  ])
  assert.equal(result.targetEffects.length, 2)
  assert.ok(result.targetEffects.every(({ patch }) => (
    patch.coldSlowFactor === 0.5 && patch.coldSlowTicks === 250
  )))
  assert.equal(result.spells.transients.some((effect) => (
    effect.kind === 'weld-persistent' && effect.buildId === 1008
  )), false)
  assert.equal(result.spells.transients.filter(({ kind }) => kind === 'weld-hail-line').length, 2)
  assert.equal(result.spells.transients.filter(({ kind }) => kind === 'weld-hail-flash').length, 2)
  assert.equal(result.spells.transients.filter(({ kind }) => kind === 'weld-hail-knockback').length, 1)
  assert.equal(result.spells.transients.some(({ kind }) => kind === 'weld-boulder-debris'), false)
  const knockback = result.spells.transients.find(({ kind }) => kind === 'weld-hail-knockback')
  assert.ok(knockback?.kind === 'weld-hail-knockback')
  assert.equal(knockback.remainingTicks, 4)

  const moved = resolveCombatWithAuthority(result.enemies, result.spells, [], 5)
  assert.deepEqual(moved.enemies.actors[0]?.position, { x: 1, y: 0 })
  const retainedKnockback = moved.spells.transients.find(({ kind }) => (
    kind === 'weld-hail-knockback'
  ))
  assert.ok(retainedKnockback?.kind === 'weld-hail-knockback')
  assert.equal(retainedKnockback.remainingTicks, 3)
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
    patch: { coldSlowFactor: 0.75, coldSlowMaterial: true, coldSlowTicks: 25 },
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
    { patch: { coldSlowFactor: 0.4, coldSlowMaterial: true, coldSlowTicks: 200 }, targetId: 1, worldKey: WORLD_KEY },
    { patch: { coldSlowFactor: 0.25, coldSlowMaterial: true, coldSlowTicks: 200 }, targetId: 1, worldKey: WORLD_KEY },
    { patch: { coldSlowFactor: 0.25, coldSlowMaterial: true, coldSlowTicks: 200 }, targetId: 2, worldKey: WORLD_KEY },
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
  ageTicks?: number
  buildId?: NativeWeldOneShotBuildId
  charge?: number
  contactsRemaining?: number
  damage?: number
  hitTargetIds?: readonly string[]
  id: number
  kind: PrimarySpellProjectileState['kind']
  position?: Readonly<{ x: number; y: number }>
  remainingDamage?: number
  toughness?: number
  targetId?: string | null
  velocity?: Readonly<{ x: number; y: number }>
  vector?: readonly number[]
  worldKey?: string
}): PrimarySpellProjectileState {
  const velocity = options.velocity ?? { x: 0, y: 0 }
  const common = {
    ageTicks: options.ageTicks ?? 1,
    charge: options.charge ?? 1,
    damage: options.damage ?? { earth: 10, ether: 2, fire: 4, weld: 5 }[options.kind],
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
        shellCharge: options.charge ?? 1,
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
        targetId: options.targetId ?? null,
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
    case 'weld':
      return {
        ...common,
        ballLightningAcceleration: options.buildId === 1002 ? 2 : null,
        basePresentationPhaseDegrees: options.buildId === 1009 ? null : 0,
        buildId: options.buildId ?? 1000,
        castPlaybackRate: 1,
        castSoundVariant: options.buildId === 1002 || options.buildId === 1009 ? 0 : null,
        charge: 1,
        contactsRemaining: options.contactsRemaining ?? 1,
        frostPulseAspect: options.buildId === 1001 ? 0.5 : null,
        frostPresentationLanes: options.buildId === 1001
          ? [
              { aspect: 0.5, rotationDegrees: 10, scale: 0.5 },
              { aspect: 0.75, rotationDegrees: 20, scale: 0.75 },
            ]
          : null,
        frostTurnDegrees: options.buildId === 1001 ? 0 : null,
        groundSparkNativeAgeTicks: options.buildId === 1009 ? 0 : null,
        groundSparkTurnTicksRemaining: options.buildId === 1009 ? 0 : null,
        headingDegrees: 0,
        hitTargetIds: [],
        kind: 'weld',
        presentationSeed: (options.buildId ?? 1000) === 1000 || options.buildId === 1009
          ? 0
          : null,
        projectileIndex: 0,
        reacquiresTarget: false,
        secondaryPresentationPhaseDegrees: options.buildId === 1001 ? 0 : null,
        speed: 3,
        targetId: options.targetId ?? null,
        turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
        turnInput: options.buildId === 1009 ? 0 : 2,
        underpowered: false,
        vector: options.vector ?? [5, 5, 10, 1, 1, 0, 0, 0, 0],
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

function weldProfile(
  buildId: NativeWeldBuildId,
  values: readonly number[],
  castKind: NativeWeldCastKind,
): NativeWeldPrimarySkillProfile {
  return {
    buildId,
    castKind,
    damageFactor: 1,
    damageMaximum: values[0]!,
    damageMinimum: values[0]!,
    damageRollCount: 1,
    kind: 'weld',
    manaCost: values[1]!,
    rank: 1,
    skillId: buildId,
    vector: { buildId, castKind, values: Object.freeze([...values]) },
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
    cellBindingOrder: 0,
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
    nativeCellBindingOrder: options.id,
    nativeRegistrationOrder: options.id,
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
