import { actorHeadingFromVector } from '../core-kernels/actor-heading.ts'
import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import {
  evaluateBoneyardEnemyConfig,
  type BoneyardEnemyArenaScalars,
  type BoneyardSkeletonWeapon,
  type EvaluatedBoneyardEnemyConfig,
} from '../core-kernels/boneyard-enemy-config.ts'
import {
  BOUNDED_ARCHER_RANGE_BANDS,
  BOUNDED_ENEMY_COLD_SLOW_TICKS,
  BOUNDED_ENEMY_POISON_DURATION_SECONDS,
  BOUNDED_MAGE_ALLY_SHIELD_RANGE,
  BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS,
  BOUNDED_MAGE_RANGE_BANDS,
  NATIVE_WRAITH_DAZZLE_TICKS,
  boundedArcherAimHeading,
  boundedMageShieldIntervalTicks,
  projectilePayloadForArrow,
  type BoneyardEnemyProjectilePayload,
} from '../core-kernels/boneyard-enemy-modifiers.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardEnemySpawnIntent,
} from '../core-kernels/boneyard-wave-director.ts'
import {
  nextBoneyardWaveRandom,
  randomBoneyardWaveInteger,
  seedBoneyardWaveRng,
} from '../core-kernels/boneyard-wave-timeline.ts'

export type BoneyardEnemyActorId = number
export type BoneyardEnemyProjectileId = number
export type BoneyardEnemyEventId = number

export const NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS = 2
export const NATIVE_ENEMY_TARGET_REFRESH_TICKS = 25
export const NATIVE_ENEMY_MISSING_TARGET_REFRESH_TICKS = 3
/** Named web presentation bound until family gait distance is closed natively. */
export const BOUNDED_ENEMY_GAIT_DISTANCE_PER_POSE = 2

export const NATIVE_SKELETON_ACTION_PROGRAMS = Object.freeze({
  claw: Object.freeze({ markerProgress: 4, progressPerTick: 0.125, strictEnd: 7 }),
  pike: Object.freeze({ markerProgress: 2, progressPerTick: 0.125, strictEnd: 12 }),
  weapon: Object.freeze({ markerProgress: 9, progressPerTick: 0.25, strictEnd: 24 }),
})

export const NATIVE_SKELETON_CLAW_MARKERS = Object.freeze([4, 8] as const)

export const NATIVE_ARCHER_ACTION_PROGRAM = Object.freeze({
  markerProgress: 13,
  progressPerTick: 0.0843750015,
  strictEnd: 16,
})

export const NATIVE_MAGE_ACTION_PROGRAMS = Object.freeze({
  long: Object.freeze({ markerProgress: 31, progressPerTick: 0.253125012, strictEnd: 47 }),
  short: Object.freeze({ markerProgress: 25, progressPerTick: 0.253125012, strictEnd: 41 }),
})

/** Named deterministic web programs for families whose exact action clocks remain open. */
export const BOUNDED_ENEMY_ACTION_PROGRAMS = Object.freeze({
  demonBomb: Object.freeze({ markerTick: 6, strictEndTick: 11, recoveryTicks: 36 }),
  impContact: Object.freeze({ cooldownTicks: 18, markerTick: 6, strictEndTick: 11 }),
  wraithDrain: Object.freeze({ cooldownTicks: 50, markerTick: 4, strictEndTick: 9 }),
  zombieSwipe: Object.freeze({ knockbackTicks: 24, markerTick: 5, strictEndTick: 9 }),
})

/** Named center-distance bounds; native family attack reach remains unresolved. */
export const BOUNDED_ENEMY_ATTACK_REACH = Object.freeze({
  COFFIN: 0,
  DEMON: 180,
  IMP: 28,
  SKELETON: 36,
  SKELETONARCHER: 240,
  SKELETONMAGE: 220,
  WRAITH: 52,
  ZOMBIE: 48,
})

export const BOUNDED_ENEMY_DEATH_PROGRAM_TICKS = Object.freeze({
  COFFIN: 31,
  DEMON: 49,
  IMP: 19,
  SKELETON: 24,
  SKELETONARCHER: 24,
  SKELETONMAGE: 24,
  WRAITH: 36,
  ZOMBIE: 36,
})

/** Named deterministic web bounds until enemy projectile kinematics are closed natively. */
export const BOUNDED_ENEMY_PROJECTILE_PROGRAMS = Object.freeze({
  arrow: Object.freeze({ contactRadius: 8, homing: false, lifetimeTicks: 300, speed: 5 }),
  'demon-bomb': Object.freeze({ contactRadius: 18, homing: true, lifetimeTicks: 400, speed: 2.5 }),
  firebolt: Object.freeze({ contactRadius: 10, homing: false, lifetimeTicks: 300, speed: 4.5 }),
  'guided-missile': Object.freeze({ contactRadius: 12, homing: true, lifetimeTicks: 400, speed: 3 }),
  'poison-pool': Object.freeze({ contactRadius: 35, homing: false, lifetimeTicks: 1000, speed: 0 }),
})

/** Retail Coffin opening calls its Maggot helper exactly three times. */
export const NATIVE_COFFIN_OPENING_MAGGOT_EMISSIONS = 3

/** Named web bounds until retail Coffin replenishment timing is closed. */
export const BOUNDED_COFFIN_MAGGOT_PROGRAM = Object.freeze({
  replenishmentEmissionCount: 1,
  replenishmentIntervalTicks: 50,
})

/** Named web bounds until retail Maggot launch and crawl kinematics are closed. */
export const BOUNDED_MAGGOT_PROGRAM = Object.freeze({
  attackDelayAfterEmergenceTicks: 10,
  attackReach: 18,
  bitePresentationTicks: 6,
  collisionRadius: 8,
  deathTicks: 12,
  emergenceTicks: 24,
  gaitDistancePerPose: 2,
  launchHeadingStepDeg: 137.5,
  launchTrajectories: Object.freeze({
    edge: Object.freeze({ horizontalStep: 1.75, originDistance: 12, verticalHeight: 12 }),
    lid: Object.freeze({ horizontalStep: 1.25, originDistance: 8, verticalHeight: 20 }),
  }),
  movementStep: 0.5,
  poisonDurationTicks: 10,
})

const NATIVE_WRAITH_RETREAT_MINIMUM_TICKS = 200
const NATIVE_WRAITH_RETREAT_RANDOM_COUNT = 601
const NATIVE_COFFIN_HIDDEN_SHORT_TICKS = 180
const NATIVE_COFFIN_HIDDEN_LONG_TICKS = 360
const NATIVE_COFFIN_RISE_TICKS = 10
const NATIVE_COFFIN_HOLD_MINIMUM_TICKS = 150
const NATIVE_COFFIN_HOLD_RANDOM_COUNT = 150
const NATIVE_COFFIN_OPEN_TICKS = 60

interface ActionClock {
  readonly actionProgress: number
  readonly markerEmitted: boolean
}

export interface BoneyardSkeletonBrain extends ActionClock {
  readonly action: 'claw' | 'pike' | 'weapon'
  readonly contactTargetPlayerId: string | null
  readonly family: 'skeleton'
  readonly phase: 'approach' | 'attack' | 'death'
}

export interface BoneyardArcherBrain extends ActionClock {
  readonly aimRngState: number
  readonly family: 'archer'
  readonly phase: 'range-control' | 'attack' | 'death'
}

export interface BoneyardMageBrain extends ActionClock {
  readonly castProgram: 'long' | 'short'
  readonly castRoll: number
  readonly family: 'mage'
  readonly phase: 'range-control' | 'cast' | 'death'
  readonly shieldTicksRemaining: number
}

export interface BoneyardImpBrain {
  readonly actionTick: number
  readonly contactTargetPlayerId: string | null
  readonly cooldownTicks: number
  readonly family: 'imp'
  readonly markerEmitted: boolean
  readonly phase: 'flight' | 'contact' | 'cooldown' | 'death'
}

export interface BoneyardZombieBrain {
  readonly actionTick: number
  readonly contactTargetPlayerId: string | null
  readonly family: 'zombie'
  readonly markerEmitted: boolean
  readonly phase: 'approach' | 'swipe' | 'knockback' | 'death'
  readonly phaseTicksRemaining: number
}

export interface BoneyardWraithBrain {
  readonly actionTick: number
  readonly alpha: number
  readonly contactTargetPlayerId: string | null
  readonly family: 'wraith'
  readonly markerEmitted: boolean
  readonly phase: 'approach' | 'orbit' | 'drain' | 'cooldown' | 'death'
  readonly phaseTicksRemaining: number
}

export interface BoneyardDemonBrain {
  readonly actionTick: number
  readonly family: 'demon'
  readonly markerEmitted: boolean
  readonly phase: 'approach' | 'bomb' | 'recovery' | 'death'
  readonly phaseTicksRemaining: number
}

export interface BoneyardCoffinBrain {
  readonly family: 'coffin'
  readonly maggotsReleased: boolean
  readonly nextMaggotReplenishmentTick: number
  readonly phase: 'hidden' | 'rising' | 'holding' | 'opening' | 'open' | 'death'
  readonly phaseTick: number
  readonly phaseTicksRemaining: number
}

export type BoneyardEnemyBrain =
  | BoneyardArcherBrain
  | BoneyardCoffinBrain
  | BoneyardDemonBrain
  | BoneyardImpBrain
  | BoneyardMageBrain
  | BoneyardSkeletonBrain
  | BoneyardWraithBrain
  | BoneyardZombieBrain

export interface BoneyardEnemyActor {
  readonly brain: BoneyardEnemyBrain
  readonly config: EvaluatedBoneyardEnemyConfig
  readonly currentHealth: number
  readonly deathEpoch: number | null
  readonly deathStartedTick: number | null
  readonly deathTick: number
  readonly gaitPose: number
  readonly headingDeg: number
  readonly id: BoneyardEnemyActorId
  readonly lastDamagedByPlayerId: string | null
  readonly lastDamageTick: number | null
  readonly lastMovementTick: number | null
  readonly lifeState: 'alive' | 'dying'
  readonly lightningEffect: Readonly<{
    eventId: number
    startedTick: number
    targetPosition: Readonly<BoneyardPoint>
  }> | null
  readonly nextMovementTick: number
  readonly nextTargetRefreshTick: number
  readonly position: Readonly<BoneyardPoint>
  readonly rewardGranted: boolean
  readonly shieldHealth: number
  readonly shieldMaximumHealth: number
  readonly sourceSpawnIntentId: number
  readonly spawnTick: number
  readonly targetPlayerId: string | null
  readonly terminalEmitted: boolean
  readonly waveOrdinal: number
}

export type BoneyardEnemyProjectileKind =
  | 'arrow'
  | 'demon-bomb'
  | 'firebolt'
  | 'guided-missile'
  | 'poison-pool'

export interface BoneyardEnemyProjectile {
  readonly ageTicks: number
  readonly coldSlowTicks: number
  readonly contactRadius: number
  readonly damage: number
  readonly headingDeg: number
  readonly hitPlayerIds: readonly string[]
  readonly homing: boolean
  readonly id: BoneyardEnemyProjectileId
  readonly kind: BoneyardEnemyProjectileKind
  readonly lastStepTick: number
  readonly lifetimeTicks: number
  readonly nativeTypeId: 0x7da | 0x7eb | 0x7ec | 0x7f7 | 0x806
  readonly ownerActorId: BoneyardEnemyActorId
  readonly payload: BoneyardEnemyProjectilePayload
  readonly poisonDamage: number
  readonly poisonDuration: number
  readonly position: Readonly<BoneyardPoint>
  readonly speed: number
  readonly spawnTick: number
  readonly targetPlayerId: string | null
}

export interface BoneyardMaggotActor {
  readonly collisionRadius: number
  readonly currentHealth: number
  readonly damage: number
  readonly deathEpoch: number | null
  readonly deathStartedTick: number | null
  readonly deathTick: number
  readonly gaitPose: number
  readonly headingDeg: number
  readonly id: BoneyardEnemyActorId
  readonly emergenceTick: number
  readonly launchTrajectory: 'edge' | 'lid'
  readonly launchVelocity: Readonly<BoneyardPoint>
  readonly lastAttackTick: number | null
  readonly lastDamagedByPlayerId: string | null
  readonly lastDamageTick: number | null
  readonly lastMovementTick: number | null
  readonly lifeState: 'alive' | 'dying'
  readonly maximumHealth: number
  readonly nextAttackTick: number
  readonly nextMovementTick: number
  readonly ownerCoffinActorId: BoneyardEnemyActorId
  readonly poisonDamage: number
  readonly poisonDuration: number
  readonly position: Readonly<BoneyardPoint>
  readonly movementPhase: 'crawl' | 'emerging'
  readonly spawnTick: number
  readonly targetPlayerId: string | null
  readonly terminalEmitted: boolean
}

export type BoneyardEnemyTerminalOutput =
  | 'archer-shatter'
  | 'coffin-break'
  | 'demon-split'
  | 'imp-split'
  | 'mage-shatter'
  | 'skeleton-shatter'
  | 'wraith-fragments'
  | 'zombie-collapse'

export type BoneyardEnemySemanticEventType =
  | 'attack-marker'
  | 'coffin-maggot-release'
  | 'enemy-death'
  | 'enemy-retired'
  | 'enemy-spawned'
  | 'enemy-terminal-output'
  | 'mage-lightning'
  | 'projectile-impact'
  | 'projectile-retired'
  | 'projectile-spawned'
  | 'reward'

export interface BoneyardEnemySemanticEvent {
  readonly actorId: BoneyardEnemyActorId
  readonly count?: number
  readonly eventId: BoneyardEnemyEventId
  readonly output?: BoneyardEnemyTerminalOutput
  readonly projectileId?: BoneyardEnemyProjectileId
  readonly sourcePosition?: Readonly<BoneyardPoint>
  readonly targetPosition?: Readonly<BoneyardPoint>
  readonly targetPlayerId?: string | null
  readonly tick: number
  readonly type: BoneyardEnemySemanticEventType
}

export interface BoneyardEnemyPlayerDamage {
  readonly actorId: BoneyardEnemyActorId
  readonly amount: number
  readonly coldSlowTicks: number
  readonly dazzleTicks: number
  readonly eventId: BoneyardEnemyEventId
  readonly poisonDamage: number
  readonly poisonDuration: number
  readonly playerId: string
}

export interface BoneyardEnemyReward {
  readonly actorId: BoneyardEnemyActorId
  readonly eventId: BoneyardEnemyEventId
  readonly experience: number
  readonly playerId: string | null
}

export interface BoneyardEnemyRetirement {
  readonly actorId: BoneyardEnemyActorId
  readonly eventId: BoneyardEnemyEventId
}

export interface BoneyardEnemyStore {
  readonly actors: readonly BoneyardEnemyActor[]
  readonly lastStepTick: number
  readonly maggots: readonly BoneyardMaggotActor[]
  readonly nextActorId: BoneyardEnemyActorId
  readonly nextDeathEpoch: number
  readonly nextEventId: BoneyardEnemyEventId
  readonly nextProjectileId: BoneyardEnemyProjectileId
  readonly nextSyntheticSpawnIntentId: number
  readonly projectiles: readonly BoneyardEnemyProjectile[]
  readonly rngState: number
}

export interface BoneyardEnemyTargetCandidate {
  readonly alive: boolean
  readonly collisionRadius: number
  readonly connected: boolean
  readonly eligible: boolean
  readonly position: Readonly<BoneyardPoint>
  readonly velocityPerTick: Readonly<BoneyardPoint>
}

export type BoneyardEnemyTargets = Readonly<Record<string, BoneyardEnemyTargetCandidate>>

export interface BoneyardEnemyMovementRequest {
  readonly actorId: BoneyardEnemyActorId
  readonly delta: Readonly<BoneyardPoint>
  readonly position: Readonly<BoneyardPoint>
  readonly radius: number
  readonly requestedPosition: Readonly<BoneyardPoint>
}

export type ResolveBoneyardEnemyMovement = (
  request: BoneyardEnemyMovementRequest,
) => Readonly<BoneyardPoint>

export interface BoneyardEnemyProjectileWorldContactRequest {
  readonly end: Readonly<BoneyardPoint>
  readonly projectileId: BoneyardEnemyProjectileId
  readonly radius: number
  readonly start: Readonly<BoneyardPoint>
}

export type FirstBoneyardEnemyProjectileWorldContact = (
  request: BoneyardEnemyProjectileWorldContactRequest,
) => number | null

export interface BoneyardEnemyStoreStepContext {
  readonly arenaScalars?: Partial<BoneyardEnemyArenaScalars>
  readonly firstProjectileWorldContact: FirstBoneyardEnemyProjectileWorldContact
  readonly players: BoneyardEnemyTargets
  readonly resolveMovement: ResolveBoneyardEnemyMovement
  readonly resolveSpawnIntents: (
    liveEnemyCount: number,
  ) => readonly BoneyardEnemySpawnIntent[]
  readonly tick: number
}

export interface BoneyardEnemyStoreStepResult {
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly playerDamage: readonly BoneyardEnemyPlayerDamage[]
  readonly retired: readonly BoneyardEnemyRetirement[]
  readonly rewards: readonly BoneyardEnemyReward[]
  readonly spawnedActorIds: readonly BoneyardEnemyActorId[]
  readonly store: BoneyardEnemyStore
}

export interface DamageBoneyardEnemyRequest {
  readonly actorId: BoneyardEnemyActorId
  readonly amount: number
  readonly sourcePlayerId: string | null
  readonly tick: number
}

export interface DamageBoneyardEnemyResult {
  readonly accepted: boolean
  readonly killed: boolean
  readonly store: BoneyardEnemyStore
}

interface WorkingStep {
  actors: BoneyardEnemyActor[]
  events: BoneyardEnemySemanticEvent[]
  maggots: BoneyardMaggotActor[]
  nextActorId: number
  nextDeathEpoch: number
  nextEventId: number
  nextProjectileId: number
  nextSyntheticSpawnIntentId: number
  playerDamage: BoneyardEnemyPlayerDamage[]
  projectiles: BoneyardEnemyProjectile[]
  retired: BoneyardEnemyRetirement[]
  rewards: BoneyardEnemyReward[]
  rngState: number
  spawnedActorIds: number[]
}

interface ActionProgram {
  markerProgress: number
  progressPerTick: number
  strictEnd: number
}

export function createBoneyardEnemyStore(seed: string): BoneyardEnemyStore {
  return {
    actors: [],
    lastStepTick: -1,
    maggots: [],
    nextActorId: 1,
    nextDeathEpoch: 1,
    nextEventId: 1,
    nextProjectileId: 1,
    nextSyntheticSpawnIntentId: 1,
    projectiles: [],
    rngState: seedBoneyardWaveRng(`${seed}:enemy-actors`),
  }
}

/** Includes every actor throughout its terminal presentation interval. */
export function boneyardEnemyLiveCount(source: BoneyardEnemyStore): number {
  return source.actors.length + source.maggots.length
}

export function damageBoneyardEnemy(
  source: BoneyardEnemyStore,
  request: DamageBoneyardEnemyRequest,
): DamageBoneyardEnemyResult {
  validateTick(request.tick)
  if (request.tick < source.lastStepTick) {
    throw new RangeError('enemy damage tick must not precede the store clock')
  }
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw new RangeError('enemy damage must be finite and positive')
  }
  const index = source.actors.findIndex((actor) => actor.id === request.actorId)
  const actor = source.actors[index]
  if (!actor) return damageBoneyardMaggot(source, request)
  if (actor.lifeState !== 'alive') {
    return { accepted: false, killed: false, store: source }
  }
  const absorbed = Math.min(actor.shieldHealth, request.amount)
  const shieldHealth = actor.shieldHealth - absorbed
  const currentHealth = actor.currentHealth - (request.amount - absorbed)
  const killed = currentHealth <= 0
  const nextActor: BoneyardEnemyActor = killed
    ? {
        ...actor,
        brain: deathBrain(actor.brain),
        currentHealth,
        deathEpoch: source.nextDeathEpoch,
        deathStartedTick: request.tick,
        deathTick: 0,
        lastDamagedByPlayerId: request.sourcePlayerId,
        lastDamageTick: request.tick,
        lifeState: 'dying',
        lightningEffect: null,
        shieldHealth: 0,
        shieldMaximumHealth: 0,
      }
    : {
        ...actor,
        currentHealth,
        lastDamagedByPlayerId: request.sourcePlayerId,
        lastDamageTick: request.tick,
        shieldHealth,
        shieldMaximumHealth: shieldHealth === 0 ? 0 : actor.shieldMaximumHealth,
      }
  const actors = [...source.actors]
  actors[index] = nextActor
  return {
    accepted: true,
    killed,
    store: {
      ...source,
      actors,
      nextDeathEpoch: source.nextDeathEpoch + (killed ? 1 : 0),
    },
  }
}

function damageBoneyardMaggot(
  source: BoneyardEnemyStore,
  request: DamageBoneyardEnemyRequest,
): DamageBoneyardEnemyResult {
  const index = source.maggots.findIndex((maggot) => maggot.id === request.actorId)
  const maggot = source.maggots[index]
  if (!maggot || maggot.lifeState !== 'alive') {
    return { accepted: false, killed: false, store: source }
  }
  const currentHealth = maggot.currentHealth - request.amount
  const killed = currentHealth <= 0
  const nextMaggot: BoneyardMaggotActor = {
    ...maggot,
    currentHealth,
    deathEpoch: killed ? source.nextDeathEpoch : maggot.deathEpoch,
    deathStartedTick: killed ? request.tick : maggot.deathStartedTick,
    lastDamagedByPlayerId: request.sourcePlayerId,
    lastDamageTick: request.tick,
    lifeState: killed ? 'dying' : 'alive',
  }
  const maggots = [...source.maggots]
  maggots[index] = nextMaggot
  return {
    accepted: true,
    killed,
    store: {
      ...source,
      maggots,
      nextDeathEpoch: source.nextDeathEpoch + (killed ? 1 : 0),
    },
  }
}

export function stepBoneyardEnemyStore(
  source: BoneyardEnemyStore,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyStoreStepResult {
  validateTick(context.tick)
  if (context.tick <= source.lastStepTick) {
    throw new RangeError('enemy store ticks must advance monotonically')
  }
  const work: WorkingStep = {
    actors: [],
    events: [],
    maggots: [...source.maggots],
    nextActorId: source.nextActorId,
    nextDeathEpoch: source.nextDeathEpoch,
    nextEventId: source.nextEventId,
    nextProjectileId: source.nextProjectileId,
    nextSyntheticSpawnIntentId: source.nextSyntheticSpawnIntentId,
    playerDamage: [],
    projectiles: [...source.projectiles],
    retired: [],
    rewards: [],
    rngState: source.rngState,
    spawnedActorIds: [],
  }
  for (const actor of source.actors) {
    const stepped = actor.lifeState === 'dying'
      ? stepDyingActor(work, actor, context)
      : stepLivingActor(work, actor, context)
    if (stepped) work.actors.push(stepped)
  }
  stepMageShields(work)
  stepMaggots(work, context)
  stepProjectiles(work, context)
  const spawnIntents = context.resolveSpawnIntents(
    work.actors.length + work.maggots.length,
  )
  work.actors.push(...materializeSpawnIntents(work, context, spawnIntents))
  return {
    events: Object.freeze(work.events),
    playerDamage: Object.freeze(work.playerDamage),
    retired: Object.freeze(work.retired),
    rewards: Object.freeze(work.rewards),
    spawnedActorIds: Object.freeze(work.spawnedActorIds),
    store: {
      actors: work.actors,
      lastStepTick: context.tick,
      maggots: work.maggots,
      nextActorId: work.nextActorId,
      nextDeathEpoch: work.nextDeathEpoch,
      nextEventId: work.nextEventId,
      nextProjectileId: work.nextProjectileId,
      nextSyntheticSpawnIntentId: work.nextSyntheticSpawnIntentId,
      projectiles: work.projectiles,
      rngState: work.rngState,
    },
  }
}

function materializeSpawnIntents(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
  spawnIntents: readonly BoneyardEnemySpawnIntent[],
): BoneyardEnemyActor[] {
  const actors: BoneyardEnemyActor[] = []
  for (const intent of spawnIntents) {
    const baseSpeed = nextBoneyardWaveRandom(work.rngState)
    const radius = nextBoneyardWaveRandom(baseSpeed.state)
    const armor = nextBoneyardWaveRandom(radius.state)
    const split = nextBoneyardWaveRandom(armor.state)
    work.rngState = split.state
    const config = evaluateBoneyardEnemyConfig(intent.enemyToken, {
      arenaScalars: context.arenaScalars,
      flags: intent.flags,
      random: {
        baseSpeedUnit: baseSpeed.value,
        collisionRadiusUnit: radius.value,
        randomArmor: armor.value >= 0.5,
        splitUnit: split.value >= 0.5 ? 1 : 0,
      },
      waveOrdinal: intent.waveOrdinal,
    })
    const targetPlayerId = nearestEligibleTarget(intent.position, context.players)
    const actor: BoneyardEnemyActor = {
      brain: createBrain(work, config),
      config,
      currentHealth: config.maximumHealth,
      deathEpoch: null,
      deathStartedTick: null,
      deathTick: 0,
      gaitPose: 0,
      headingDeg: targetHeading(intent.position, targetPlayerId, context.players),
      id: work.nextActorId,
      lastDamagedByPlayerId: null,
      lastDamageTick: null,
      lastMovementTick: null,
      lifeState: 'alive',
      lightningEffect: null,
      nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      nextTargetRefreshTick: context.tick + (
        targetPlayerId === null
          ? NATIVE_ENEMY_MISSING_TARGET_REFRESH_TICKS
          : NATIVE_ENEMY_TARGET_REFRESH_TICKS
      ),
      position: Object.freeze({ ...intent.position }),
      rewardGranted: false,
      shieldHealth: 0,
      shieldMaximumHealth: 0,
      sourceSpawnIntentId: intent.id,
      spawnTick: intent.spawnTick,
      targetPlayerId,
      terminalEmitted: false,
      waveOrdinal: intent.waveOrdinal,
    }
    work.nextActorId += 1
    work.spawnedActorIds.push(actor.id)
    emitEvent(work, context.tick, 'enemy-spawned', actor.id, {
      targetPlayerId,
    })
    actors.push(actor)
  }
  return actors
}

function createBrain(
  work: WorkingStep,
  config: EvaluatedBoneyardEnemyConfig,
): BoneyardEnemyBrain {
  switch (config.enemyToken) {
    case 'SKELETON': return {
      action: skeletonAction(config.family.weapon),
      actionProgress: 0,
      contactTargetPlayerId: null,
      family: 'skeleton',
      markerEmitted: false,
      phase: 'approach',
    }
    case 'SKELETONARCHER': {
      const seed = nextBoneyardWaveRandom(work.rngState)
      work.rngState = seed.state
      return {
        actionProgress: 0,
        aimRngState: seed.state,
        family: 'archer',
        markerEmitted: false,
        phase: 'range-control',
      }
    }
    case 'SKELETONMAGE': return {
      actionProgress: 0,
      castProgram: 'short',
      castRoll: 0,
      family: 'mage',
      markerEmitted: false,
      phase: 'range-control',
      shieldTicksRemaining: config.family.shieldInterval > 0
        ? boundedMageShieldIntervalTicks(config.family.shieldInterval)
        : 0,
    }
    case 'IMP': return {
      actionTick: 0,
      contactTargetPlayerId: null,
      cooldownTicks: 0,
      family: 'imp',
      markerEmitted: false,
      phase: 'flight',
    }
    case 'ZOMBIE': return {
      actionTick: 0,
      contactTargetPlayerId: null,
      family: 'zombie',
      markerEmitted: false,
      phase: 'approach',
      phaseTicksRemaining: 0,
    }
    case 'WRAITH': return {
      actionTick: 0,
      alpha: 1,
      contactTargetPlayerId: null,
      family: 'wraith',
      markerEmitted: false,
      phase: 'approach',
      phaseTicksRemaining: 0,
    }
    case 'DEMON': return {
      actionTick: 0,
      family: 'demon',
      markerEmitted: false,
      phase: 'approach',
      phaseTicksRemaining: 0,
    }
    case 'COFFIN': {
      const hidden = randomBoneyardWaveInteger(work.rngState, 2)
      work.rngState = hidden.state
      return {
        family: 'coffin',
        maggotsReleased: false,
        nextMaggotReplenishmentTick: 0,
        phase: 'hidden',
        phaseTick: 0,
        phaseTicksRemaining: hidden.value === 0
          ? NATIVE_COFFIN_HIDDEN_SHORT_TICKS
          : NATIVE_COFFIN_HIDDEN_LONG_TICKS,
      }
    }
  }
}

function stepMageShields(work: WorkingStep): void {
  for (let index = 0; index < work.actors.length; index += 1) {
    const source = work.actors[index]!
    if (
      source.lifeState !== 'alive'
      || source.brain.family !== 'mage'
      || source.config.enemyToken !== 'SKELETONMAGE'
      || source.config.family.shieldInterval <= 0
    ) continue
    const remaining = Math.max(0, source.brain.shieldTicksRemaining - 1)
    if (remaining > 0) {
      work.actors[index] = {
        ...source,
        brain: { ...source.brain, shieldTicksRemaining: remaining },
      }
      continue
    }

    let mage = source
    if (source.config.family.selfShield && source.config.family.selfShieldHealth > 0) {
      mage = withRefreshedShield(mage, source.config.family.selfShieldHealth)
    }
    mage = {
      ...mage,
      brain: {
        ...(mage.brain as BoneyardMageBrain),
        shieldTicksRemaining: boundedMageShieldIntervalTicks(
          source.config.family.shieldInterval,
        ),
      },
    }
    work.actors[index] = mage

    if (!source.config.family.otherShield || source.config.family.otherShieldHealth <= 0) continue
    const allyIndex = nearestShieldAllyIndex(work.actors, source, index)
    if (allyIndex >= 0) {
      work.actors[allyIndex] = withRefreshedShield(
        work.actors[allyIndex]!,
        source.config.family.otherShieldHealth,
      )
    }
  }
}

function nearestShieldAllyIndex(
  actors: readonly BoneyardEnemyActor[],
  source: BoneyardEnemyActor,
  sourceIndex: number,
): number {
  let selectedIndex = -1
  let selectedDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < actors.length; index += 1) {
    if (index === sourceIndex) continue
    const actor = actors[index]!
    if (actor.lifeState !== 'alive') continue
    const distance = Math.hypot(
      actor.position.x - source.position.x,
      actor.position.y - source.position.y,
    )
    if (distance > BOUNDED_MAGE_ALLY_SHIELD_RANGE) continue
    if (
      distance < selectedDistance
      || (
        distance === selectedDistance
        && (selectedIndex < 0 || actor.id < actors[selectedIndex]!.id)
      )
    ) {
      selectedDistance = distance
      selectedIndex = index
    }
  }
  return selectedIndex
}

function withRefreshedShield(
  actor: BoneyardEnemyActor,
  strength: number,
): BoneyardEnemyActor {
  const shieldHealth = Math.max(actor.shieldHealth, strength)
  return {
    ...actor,
    shieldHealth,
    shieldMaximumHealth: Math.max(actor.shieldMaximumHealth, shieldHealth),
  }
}

function stepLivingActor(
  work: WorkingStep,
  source: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const lightningEffect = source.lightningEffect !== null
    && context.tick - source.lightningEffect.startedTick >= BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS
    ? null
    : source.lightningEffect
  const timed = lightningEffect === source.lightningEffect
    ? source
    : { ...source, lightningEffect }
  const targeted = refreshTarget(timed, context)
  const actor = targeted.brain.family === 'coffin'
    ? targeted
    : faceTarget(targeted, context.players)
  switch (actor.brain.family) {
    case 'skeleton': return stepSkeleton(work, actor, actor.brain, context)
    case 'archer': return stepArcher(work, actor, actor.brain, context)
    case 'mage': return stepMage(work, actor, actor.brain, context)
    case 'imp': return stepImp(work, actor, actor.brain, context)
    case 'zombie': return stepZombie(work, actor, actor.brain, context)
    case 'wraith': return stepWraith(work, actor, actor.brain, context)
    case 'demon': return stepDemon(work, actor, actor.brain, context)
    case 'coffin': return stepCoffin(work, actor, actor.brain, context)
  }
}

function stepSkeleton(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardSkeletonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetSkeleton(actor, brain)
  if (brain.phase === 'attack') {
    if (brain.action === 'claw') {
      return stepSkeletonClawAction(work, actor, brain, context)
    }
    const program = NATIVE_SKELETON_ACTION_PROGRAMS[brain.action]
    return stepProgressAction(
      work,
      actor,
      brain,
      program,
      context.tick,
      brain.contactTargetPlayerId,
      (eventId) => {
        directContactPlayerDamage(
          work,
          actor,
          brain.contactTargetPlayerId,
          context.players,
          BOUNDED_ENEMY_ATTACK_REACH.SKELETON,
          eventId,
        )
      },
    )
  }
  if (targetWithinAttackReach(
    actor,
    context.players,
    BOUNDED_ENEMY_ATTACK_REACH.SKELETON,
  )) {
    return {
      ...actor,
      brain: {
        ...brain,
        actionProgress: 0,
        contactTargetPlayerId: actor.targetPlayerId,
        markerEmitted: false,
        phase: 'attack',
      },
    }
  }
  return moveTowardTarget(actor, brain, context, 1)
}

function stepSkeletonClawAction(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardSkeletonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const program = NATIVE_SKELETON_ACTION_PROGRAMS.claw
  const previousProgress = brain.actionProgress
  const rawProgress = previousProgress
    + program.progressPerTick * actor.config.attackSpeed
  const completed = rawProgress > program.strictEnd
  const wrappedProgress = completed
    ? rawProgress - (program.strictEnd + 1)
    : rawProgress
  let markerEmitted = brain.markerEmitted
  for (const marker of NATIVE_SKELETON_CLAW_MARKERS) {
    if (!inclusiveCircularMarkerCrossed(
      previousProgress,
      wrappedProgress,
      marker,
      completed,
    )) continue
    const eventId = attackMarker(
      work,
      actor,
      context.tick,
      brain.contactTargetPlayerId,
    )
    directContactPlayerDamage(
      work,
      actor,
      brain.contactTargetPlayerId,
      context.players,
      BOUNDED_ENEMY_ATTACK_REACH.SKELETON,
      eventId,
    )
    markerEmitted = true
  }
  if (completed) {
    return {
      ...actor,
      brain: {
        ...brain,
        actionProgress: 0,
        contactTargetPlayerId: null,
        markerEmitted: false,
        phase: 'approach',
      },
    }
  }
  return {
    ...actor,
    brain: { ...brain, actionProgress: rawProgress, markerEmitted },
  }
}

function inclusiveCircularMarkerCrossed(
  previousProgress: number,
  currentProgress: number,
  marker: number,
  wrapped: boolean,
): boolean {
  return wrapped
    ? marker >= previousProgress || marker <= currentProgress
    : previousProgress <= marker && marker <= currentProgress
}

function stepArcher(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardArcherBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetArcher(actor, brain)
  if (brain.phase === 'attack') {
    let aimRngState = brain.aimRngState
    const stepped = stepProgressAction(
      work,
      actor,
      brain,
      NATIVE_ARCHER_ACTION_PROGRAM,
      context.tick,
      actor.targetPlayerId,
      () => {
        aimRngState = emitArcherVolley(work, actor, brain.aimRngState, context)
      },
    )
    return stepped.brain.family === 'archer' && aimRngState !== brain.aimRngState
      ? { ...stepped, brain: { ...stepped.brain, aimRngState } }
      : stepped
  }
  const distance = targetDistance(actor, context.players)
  const range = actor.config.enemyToken === 'SKELETONARCHER'
    ? BOUNDED_ARCHER_RANGE_BANDS[actor.config.family.rangeMode]
    : BOUNDED_ARCHER_RANGE_BANDS[0]
  if (distance >= range.minimum && distance <= range.maximum) {
    return { ...actor, brain: { ...brain, actionProgress: 0, markerEmitted: false, phase: 'attack' } }
  }
  return moveTowardTarget(actor, brain, context, distance < range.minimum ? -1 : 1)
}

function stepMage(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardMageBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetMage(actor, brain)
  if (brain.phase === 'cast') {
    const base = NATIVE_MAGE_ACTION_PROGRAMS[brain.castProgram]
    let lightningEffect: BoneyardEnemyActor['lightningEffect'] = null
    const stepped = stepProgressAction(
      work,
      actor,
      brain,
      { ...base, progressPerTick: base.progressPerTick * (1 + brain.castRoll) },
      context.tick,
      actor.targetPlayerId,
      (eventId) => {
        lightningEffect = emitMageAttack(work, actor, context, eventId)
      },
    )
    return lightningEffect === null ? stepped : { ...stepped, lightningEffect }
  }
  const distance = targetDistance(actor, context.players)
  const range = actor.config.enemyToken === 'SKELETONMAGE'
    ? BOUNDED_MAGE_RANGE_BANDS[actor.config.family.rangeMode]
    : BOUNDED_MAGE_RANGE_BANDS[0]
  if (distance >= range.minimum && distance <= range.maximum) {
    const program = nextBoneyardWaveRandom(work.rngState)
    const roll = nextBoneyardWaveRandom(program.state)
    work.rngState = roll.state
    return {
      ...actor,
      brain: {
        ...brain,
        actionProgress: 0,
        castProgram: program.value < 0.5 ? 'short' : 'long',
        castRoll: roll.value,
        markerEmitted: false,
        phase: 'cast',
      },
    }
  }
  return moveTowardTarget(actor, brain, context, distance < range.minimum ? -1 : 1)
}

function stepImp(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardImpBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetImp(actor, brain)
  if (brain.phase === 'cooldown') {
    const remaining = Math.max(0, brain.cooldownTicks - 1)
    return {
      ...actor,
      brain: remaining === 0
        ? {
            ...brain,
            actionTick: 0,
            contactTargetPlayerId: null,
            cooldownTicks: 0,
            markerEmitted: false,
            phase: 'flight',
          }
        : { ...brain, cooldownTicks: remaining },
    }
  }
  if (brain.phase === 'contact') {
    const nextTick = brain.actionTick + actor.config.attackSpeed
    let markerEmitted = brain.markerEmitted
    if (!markerEmitted && nextTick >= BOUNDED_ENEMY_ACTION_PROGRAMS.impContact.markerTick) {
      const eventId = attackMarker(work, actor, context.tick, brain.contactTargetPlayerId)
      directContactPlayerDamage(
        work,
        actor,
        brain.contactTargetPlayerId,
        context.players,
        BOUNDED_ENEMY_ATTACK_REACH.IMP,
        eventId,
      )
      markerEmitted = true
    }
    if (nextTick > BOUNDED_ENEMY_ACTION_PROGRAMS.impContact.strictEndTick) {
      return {
        ...actor,
        brain: {
          ...brain,
          actionTick: 0,
          contactTargetPlayerId: null,
          cooldownTicks: BOUNDED_ENEMY_ACTION_PROGRAMS.impContact.cooldownTicks,
          markerEmitted: false,
          phase: 'cooldown',
        },
      }
    }
    return { ...actor, brain: { ...brain, actionTick: nextTick, markerEmitted } }
  }
  if (targetWithinAttackReach(actor, context.players, BOUNDED_ENEMY_ATTACK_REACH.IMP)) {
    return {
      ...actor,
      brain: {
        ...brain,
        actionTick: 0,
        contactTargetPlayerId: actor.targetPlayerId,
        markerEmitted: false,
        phase: 'contact',
      },
    }
  }
  return moveTowardTarget(actor, brain, context, 1)
}

function stepZombie(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardZombieBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetZombie(actor, brain)
  if (brain.phase === 'knockback') {
    const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
    return {
      ...actor,
      brain: remaining === 0
        ? {
            ...brain,
            actionTick: 0,
            contactTargetPlayerId: null,
            markerEmitted: false,
            phase: 'approach',
            phaseTicksRemaining: 0,
          }
        : { ...brain, phaseTicksRemaining: remaining },
    }
  }
  if (brain.phase === 'swipe') {
    const nextTick = brain.actionTick + actor.config.attackSpeed
    let markerEmitted = brain.markerEmitted
    if (!markerEmitted && nextTick >= BOUNDED_ENEMY_ACTION_PROGRAMS.zombieSwipe.markerTick) {
      const eventId = attackMarker(work, actor, context.tick, brain.contactTargetPlayerId)
      directContactPlayerDamage(
        work,
        actor,
        brain.contactTargetPlayerId,
        context.players,
        BOUNDED_ENEMY_ATTACK_REACH.ZOMBIE,
        eventId,
      )
      markerEmitted = true
    }
    if (nextTick > BOUNDED_ENEMY_ACTION_PROGRAMS.zombieSwipe.strictEndTick) {
      return {
        ...actor,
        brain: {
          ...brain,
          actionTick: 0,
          contactTargetPlayerId: null,
          markerEmitted: false,
          phase: 'knockback',
          phaseTicksRemaining: BOUNDED_ENEMY_ACTION_PROGRAMS.zombieSwipe.knockbackTicks,
        },
      }
    }
    return { ...actor, brain: { ...brain, actionTick: nextTick, markerEmitted } }
  }
  if (targetWithinAttackReach(actor, context.players, BOUNDED_ENEMY_ATTACK_REACH.ZOMBIE)) {
    return {
      ...actor,
      brain: {
        ...brain,
        actionTick: 0,
        contactTargetPlayerId: actor.targetPlayerId,
        markerEmitted: false,
        phase: 'swipe',
      },
    }
  }
  return moveTowardTarget(actor, brain, context, 1)
}

function stepWraith(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardWraithBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetWraith(actor, brain)
  if (brain.phase === 'cooldown') {
    const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
    return {
      ...actor,
      brain: remaining === 0
        ? {
            ...brain,
            actionTick: 0,
            contactTargetPlayerId: null,
            markerEmitted: false,
            phase: 'approach',
            phaseTicksRemaining: 0,
          }
        : { ...brain, alpha: 0.65 + 0.35 * remaining / 50, phaseTicksRemaining: remaining },
    }
  }
  if (brain.phase === 'orbit') {
    const moved = moveTowardTarget(actor, brain, context, 0, 1)
    const movedBrain = moved.brain as BoneyardWraithBrain
    const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
    return {
      ...moved,
      brain: remaining === 0
        ? { ...movedBrain, actionTick: 0, markerEmitted: false, phase: 'drain', phaseTicksRemaining: 0 }
        : { ...movedBrain, phaseTicksRemaining: remaining },
    }
  }
  if (brain.phase === 'drain') {
    const nextTick = brain.actionTick + actor.config.attackSpeed
    let markerEmitted = brain.markerEmitted
    if (!markerEmitted && nextTick >= BOUNDED_ENEMY_ACTION_PROGRAMS.wraithDrain.markerTick) {
      const eventId = attackMarker(work, actor, context.tick, brain.contactTargetPlayerId)
      directContactPlayerDamage(
        work,
        actor,
        brain.contactTargetPlayerId,
        context.players,
        BOUNDED_ENEMY_ATTACK_REACH.WRAITH,
        eventId,
      )
      markerEmitted = true
    }
    if (nextTick > BOUNDED_ENEMY_ACTION_PROGRAMS.wraithDrain.strictEndTick) {
      return {
        ...actor,
        brain: {
          ...brain,
          actionTick: 0,
          alpha: 0.65,
          contactTargetPlayerId: null,
          markerEmitted: false,
          phase: 'cooldown',
          phaseTicksRemaining: BOUNDED_ENEMY_ACTION_PROGRAMS.wraithDrain.cooldownTicks,
        },
      }
    }
    return { ...actor, brain: { ...brain, actionTick: nextTick, markerEmitted } }
  }
  if (targetWithinAttackReach(actor, context.players, BOUNDED_ENEMY_ATTACK_REACH.WRAITH)) {
    const retreat = randomBoneyardWaveInteger(work.rngState, NATIVE_WRAITH_RETREAT_RANDOM_COUNT)
    work.rngState = retreat.state
    return {
      ...actor,
      brain: {
        ...brain,
        contactTargetPlayerId: actor.targetPlayerId,
        phase: 'orbit',
        phaseTicksRemaining: NATIVE_WRAITH_RETREAT_MINIMUM_TICKS + retreat.value,
      },
    }
  }
  return moveTowardTarget(actor, brain, context, 1)
}

function stepDemon(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardDemonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetDemon(actor, brain)
  if (brain.phase === 'recovery') {
    const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
    return {
      ...actor,
      brain: remaining === 0
        ? { ...brain, actionTick: 0, markerEmitted: false, phase: 'approach', phaseTicksRemaining: 0 }
        : { ...brain, phaseTicksRemaining: remaining },
    }
  }
  if (brain.phase === 'bomb') {
    const nextTick = brain.actionTick + actor.config.attackSpeed
    let markerEmitted = brain.markerEmitted
    if (!markerEmitted && nextTick >= BOUNDED_ENEMY_ACTION_PROGRAMS.demonBomb.markerTick) {
      attackMarker(work, actor, context.tick)
      spawnProjectile(work, actor, context.tick, 'demon-bomb', actor.config.primaryDamage ?? 0)
      markerEmitted = true
    }
    if (nextTick > BOUNDED_ENEMY_ACTION_PROGRAMS.demonBomb.strictEndTick) {
      return {
        ...actor,
        brain: {
          ...brain,
          actionTick: 0,
          markerEmitted: false,
          phase: 'recovery',
          phaseTicksRemaining: BOUNDED_ENEMY_ACTION_PROGRAMS.demonBomb.recoveryTicks,
        },
      }
    }
    return { ...actor, brain: { ...brain, actionTick: nextTick, markerEmitted } }
  }
  if (targetWithinAttackReach(actor, context.players, BOUNDED_ENEMY_ATTACK_REACH.DEMON)) {
    return { ...actor, brain: { ...brain, actionTick: 0, markerEmitted: false, phase: 'bomb' } }
  }
  return moveTowardTarget(actor, brain, context, 1)
}

function stepCoffin(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardCoffinBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const tick = context.tick
  if (brain.phase === 'open') {
    const family = actor.config.enemyToken === 'COFFIN' ? actor.config.family : null
    if (
      family === null
      || tick < brain.nextMaggotReplenishmentTick
      || ownedLiveMaggotCount(work.maggots, actor.id) >= family.maximumMaggots
    ) return actor
    const count = spawnCoffinMaggots(
      work,
      actor,
      context,
      BOUNDED_COFFIN_MAGGOT_PROGRAM.replenishmentEmissionCount,
    )
    if (count > 0) {
      emitEvent(work, tick, 'coffin-maggot-release', actor.id, { count })
    }
    return {
      ...actor,
      brain: {
        ...brain,
        nextMaggotReplenishmentTick: tick
          + BOUNDED_COFFIN_MAGGOT_PROGRAM.replenishmentIntervalTicks,
      },
    }
  }
  const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
  if (remaining > 0) {
    return {
      ...actor,
      brain: { ...brain, phaseTick: brain.phaseTick + 1, phaseTicksRemaining: remaining },
    }
  }
  switch (brain.phase) {
    case 'hidden': return {
      ...actor,
      brain: {
        ...brain,
        phase: 'rising',
        phaseTick: 0,
        phaseTicksRemaining: NATIVE_COFFIN_RISE_TICKS,
      },
    }
    case 'rising': {
      const hold = randomBoneyardWaveInteger(work.rngState, NATIVE_COFFIN_HOLD_RANDOM_COUNT)
      work.rngState = hold.state
      return {
        ...actor,
        brain: {
          ...brain,
          phase: 'holding',
          phaseTick: 0,
          phaseTicksRemaining: NATIVE_COFFIN_HOLD_MINIMUM_TICKS + hold.value,
        },
      }
    }
    case 'holding': return {
      ...actor,
      brain: {
        ...brain,
        phase: 'opening',
        phaseTick: 0,
        phaseTicksRemaining: NATIVE_COFFIN_OPEN_TICKS,
      },
    }
    case 'opening': {
      const count = spawnCoffinMaggots(
        work,
        actor,
        context,
        NATIVE_COFFIN_OPENING_MAGGOT_EMISSIONS,
      )
      emitEvent(work, tick, 'coffin-maggot-release', actor.id, {
        count,
      })
      return {
        ...actor,
        brain: {
          ...brain,
          maggotsReleased: true,
          nextMaggotReplenishmentTick: tick
            + BOUNDED_COFFIN_MAGGOT_PROGRAM.replenishmentIntervalTicks,
          phase: 'open',
          phaseTick: NATIVE_COFFIN_OPEN_TICKS,
          phaseTicksRemaining: 0,
        },
      }
    }
    case 'death': return actor
  }
}

function spawnCoffinMaggots(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
  requestedCount: number,
): number {
  if (actor.config.enemyToken !== 'COFFIN') return 0
  const family = actor.config.family
  const available = Math.max(
    0,
    family.maximumMaggots - ownedLiveMaggotCount(work.maggots, actor.id),
  )
  const count = Math.min(requestedCount, available)
  for (let index = 0; index < count; index += 1) {
    const launchTrajectory: BoneyardMaggotActor['launchTrajectory'] = (
      work.nextActorId % 2 === 0 ? 'lid' : 'edge'
    )
    const trajectory = BOUNDED_MAGGOT_PROGRAM.launchTrajectories[launchTrajectory]
    const headingDeg = positiveModulo(
      actor.headingDeg
        + (work.nextActorId - actor.id) * BOUNDED_MAGGOT_PROGRAM.launchHeadingStepDeg,
      360,
    )
    const headingRadians = headingDeg * Math.PI / 180
    const unitX = Math.sin(headingRadians)
    const unitY = -Math.cos(headingRadians)
    const position = Object.freeze({
      x: actor.position.x + unitX * trajectory.originDistance,
      y: actor.position.y + unitY * trajectory.originDistance,
    })
    const targetPlayerId = nearestEligibleTarget(position, context.players)
    work.maggots.push(Object.freeze({
      collisionRadius: BOUNDED_MAGGOT_PROGRAM.collisionRadius,
      currentHealth: family.maggotHealth,
      damage: family.maggotDamage,
      deathEpoch: null,
      deathStartedTick: null,
      deathTick: 0,
      emergenceTick: 0,
      gaitPose: 0,
      headingDeg,
      id: work.nextActorId,
      launchTrajectory,
      launchVelocity: Object.freeze({
        x: unitX * trajectory.horizontalStep,
        y: unitY * trajectory.horizontalStep,
      }),
      lastAttackTick: null,
      lastDamagedByPlayerId: null,
      lastDamageTick: null,
      lastMovementTick: null,
      lifeState: 'alive',
      maximumHealth: family.maggotHealth,
      movementPhase: 'emerging',
      nextAttackTick: context.tick
        + BOUNDED_MAGGOT_PROGRAM.emergenceTicks
        + BOUNDED_MAGGOT_PROGRAM.attackDelayAfterEmergenceTicks,
      nextMovementTick: context.tick + 1,
      ownerCoffinActorId: actor.id,
      poisonDamage: family.maggotPoisonDamage,
      poisonDuration: family.maggotPoisonDamage > 0
        ? BOUNDED_MAGGOT_PROGRAM.poisonDurationTicks
        : 0,
      position,
      spawnTick: context.tick,
      targetPlayerId,
      terminalEmitted: false,
    }))
    work.spawnedActorIds.push(work.nextActorId)
    emitEvent(work, context.tick, 'enemy-spawned', work.nextActorId, {
      targetPlayerId,
    })
    work.nextActorId += 1
  }
  return count
}

function ownedLiveMaggotCount(
  maggots: readonly BoneyardMaggotActor[],
  ownerCoffinActorId: BoneyardEnemyActorId,
): number {
  return maggots.filter((maggot) => (
    maggot.ownerCoffinActorId === ownerCoffinActorId
    && maggot.lifeState === 'alive'
  )).length
}

function stepMaggots(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
): void {
  const retained: BoneyardMaggotActor[] = []
  for (const source of work.maggots) {
    if (!hasLiveCoffinOwner(work.actors, source.ownerCoffinActorId)) {
      retireMaggot(work, source, context.tick)
      continue
    }
    if (source.lifeState === 'dying') {
      let maggot = source
      if (!maggot.terminalEmitted) {
        emitEvent(work, context.tick, 'enemy-death', maggot.id)
        maggot = { ...maggot, terminalEmitted: true }
      }
      const deathStartedTick = source.deathStartedTick ?? context.tick
      const deathTick = Math.max(0, context.tick - deathStartedTick)
      if (deathTick >= BOUNDED_MAGGOT_PROGRAM.deathTicks) {
        const eventId = emitEvent(work, context.tick, 'enemy-retired', maggot.id)
        work.retired.push(Object.freeze({ actorId: maggot.id, eventId }))
      } else {
        retained.push({ ...maggot, deathTick })
      }
      continue
    }

    if (source.movementPhase === 'emerging') {
      retained.push(stepEmergingMaggot(source, context))
      continue
    }

    const targetPlayerId = nearestEligibleTarget(source.position, context.players)
    if (targetPlayerId === null) {
      retained.push({ ...source, targetPlayerId: null })
      continue
    }
    const target = context.players[targetPlayerId]
    if (!target) throw new Error(`Maggot target ${targetPlayerId} disappeared during one tick`)
    const distance = Math.hypot(
      target.position.x - source.position.x,
      target.position.y - source.position.y,
    )
    if (distance <= Math.max(
      BOUNDED_MAGGOT_PROGRAM.attackReach,
      source.collisionRadius + target.collisionRadius,
    )) {
      if (context.tick >= source.nextAttackTick) {
        const eventId = emitEvent(work, context.tick, 'attack-marker', source.id, {
          targetPlayerId,
        })
        work.playerDamage.push(Object.freeze({
          actorId: source.id,
          amount: source.damage,
          coldSlowTicks: 0,
          dazzleTicks: 0,
          eventId,
          playerId: targetPlayerId,
          poisonDamage: source.poisonDamage,
          poisonDuration: source.poisonDuration,
        }))
        work.nextDeathEpoch += 1
        emitEvent(work, context.tick, 'enemy-death', source.id)
        retained.push({
          ...source,
          deathEpoch: work.nextDeathEpoch - 1,
          deathStartedTick: context.tick,
          deathTick: 0,
          headingDeg: targetHeading(source.position, targetPlayerId, context.players),
          lastAttackTick: context.tick,
          lifeState: 'dying',
          targetPlayerId,
          terminalEmitted: true,
        })
      } else {
        retained.push({ ...source, targetPlayerId })
      }
      continue
    }
    if (context.tick < source.nextMovementTick) {
      retained.push({ ...source, targetPlayerId })
      continue
    }
    const unitX = (target.position.x - source.position.x) / distance
    const unitY = (target.position.y - source.position.y) / distance
    const delta = Object.freeze({
      x: unitX * BOUNDED_MAGGOT_PROGRAM.movementStep,
      y: unitY * BOUNDED_MAGGOT_PROGRAM.movementStep,
    })
    const requestedPosition = Object.freeze({
      x: source.position.x + delta.x,
      y: source.position.y + delta.y,
    })
    const position = context.resolveMovement({
      actorId: source.id,
      delta,
      position: source.position,
      radius: source.collisionRadius,
      requestedPosition,
    })
    validatePoint(position, 'resolved Maggot position')
    const traveled = Math.hypot(
      position.x - source.position.x,
      position.y - source.position.y,
    )
    retained.push({
      ...source,
      gaitPose: traveled === 0
        ? source.gaitPose
        : positiveModulo(
            source.gaitPose + traveled / BOUNDED_MAGGOT_PROGRAM.gaitDistancePerPose,
            2,
          ),
      headingDeg: actorHeadingFromVector(unitX, unitY),
      lastMovementTick: traveled === 0 ? source.lastMovementTick : context.tick,
      nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      position: Object.freeze({ ...position }),
      targetPlayerId,
    })
  }
  work.maggots = retained
}

function hasLiveCoffinOwner(
  actors: readonly BoneyardEnemyActor[],
  ownerCoffinActorId: BoneyardEnemyActorId,
): boolean {
  return actors.some((actor) => (
    actor.id === ownerCoffinActorId
    && actor.lifeState === 'alive'
    && actor.config.enemyToken === 'COFFIN'
  ))
}

function retireMaggot(
  work: WorkingStep,
  maggot: BoneyardMaggotActor,
  tick: number,
): void {
  const eventId = emitEvent(work, tick, 'enemy-retired', maggot.id)
  work.retired.push(Object.freeze({ actorId: maggot.id, eventId }))
}

function stepEmergingMaggot(
  source: BoneyardMaggotActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardMaggotActor {
  const emergenceTick = Math.min(
    BOUNDED_MAGGOT_PROGRAM.emergenceTicks,
    Math.max(source.emergenceTick, context.tick - source.spawnTick),
  )
  const elapsedTicks = emergenceTick - source.emergenceTick
  if (elapsedTicks === 0) return source
  const delta = Object.freeze({
    x: source.launchVelocity.x * elapsedTicks,
    y: source.launchVelocity.y * elapsedTicks,
  })
  const requestedPosition = Object.freeze({
    x: source.position.x + delta.x,
    y: source.position.y + delta.y,
  })
  const position = context.resolveMovement({
    actorId: source.id,
    delta,
    position: source.position,
    radius: source.collisionRadius,
    requestedPosition,
  })
  validatePoint(position, 'resolved emerging Maggot position')
  const traveled = Math.hypot(
    position.x - source.position.x,
    position.y - source.position.y,
  )
  const movementPhase = emergenceTick >= BOUNDED_MAGGOT_PROGRAM.emergenceTicks
    ? 'crawl' as const
    : 'emerging' as const
  return {
    ...source,
    emergenceTick,
    lastMovementTick: traveled === 0 ? source.lastMovementTick : context.tick,
    movementPhase,
    nextMovementTick: context.tick + (
      movementPhase === 'crawl' ? NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS : 1
    ),
    position: Object.freeze({ ...position }),
  }
}

function stepProgressAction<B extends BoneyardSkeletonBrain | BoneyardArcherBrain | BoneyardMageBrain>(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: B,
  program: ActionProgram,
  tick: number,
  markerTargetPlayerId: string | null,
  onMarker: (eventId: number) => void,
): BoneyardEnemyActor {
  const actionProgress = brain.actionProgress
    + program.progressPerTick * actor.config.attackSpeed
  let markerEmitted = brain.markerEmitted
  if (!markerEmitted && actionProgress >= program.markerProgress) {
    const eventId = attackMarker(work, actor, tick, markerTargetPlayerId)
    onMarker(eventId)
    markerEmitted = true
  }
  if (actionProgress > program.strictEnd) {
    const completedBrain = brain.family === 'skeleton'
      ? {
          ...brain,
          actionProgress: 0,
          contactTargetPlayerId: null,
          markerEmitted: false,
          phase: 'approach' as const,
        }
      : { ...brain, actionProgress: 0, markerEmitted: false, phase: 'range-control' as const }
    return {
      ...actor,
      brain: completedBrain,
    }
  }
  return { ...actor, brain: { ...brain, actionProgress, markerEmitted } }
}

function moveTowardTarget<B extends BoneyardEnemyBrain>(
  actor: BoneyardEnemyActor,
  brain: B,
  context: BoneyardEnemyStoreStepContext,
  radialDirection: -1 | 0 | 1,
  tangentDirection: -1 | 0 | 1 = 0,
): BoneyardEnemyActor {
  if (context.tick < actor.nextMovementTick || actor.targetPlayerId === null) return actor
  const target = context.players[actor.targetPlayerId]
  if (!target) return actor
  const dx = target.position.x - actor.position.x
  const dy = target.position.y - actor.position.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return { ...actor, nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS }
  const unitX = dx / length
  const unitY = dy / length
  const directionX = unitX * radialDirection + -unitY * tangentDirection
  const directionY = unitY * radialDirection + unitX * tangentDirection
  const step = 0.25
    * actor.config.chaseSpeed
    * actor.config.baseSpeed
    * actor.config.scale
    * NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS
  const delta = Object.freeze({ x: directionX * step, y: directionY * step })
  const requestedPosition = Object.freeze({
    x: actor.position.x + delta.x,
    y: actor.position.y + delta.y,
  })
  const position = context.resolveMovement({
    actorId: actor.id,
    delta,
    position: actor.position,
    radius: actor.config.collisionRadius,
    requestedPosition,
  })
  validatePoint(position, 'resolved enemy position')
  const traveled = Math.hypot(
    position.x - actor.position.x,
    position.y - actor.position.y,
  )
  return {
    ...actor,
    brain,
    gaitPose: traveled === 0
      ? actor.gaitPose
      : positiveModulo(
          actor.gaitPose + traveled / BOUNDED_ENEMY_GAIT_DISTANCE_PER_POSE,
          8,
        ),
    headingDeg: actorHeadingFromVector(directionX, directionY),
    lastMovementTick: traveled === 0 ? actor.lastMovementTick : context.tick,
    nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    position: Object.freeze({ ...position }),
  }
}

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}

function refreshTarget(
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const current = actor.targetPlayerId === null
    ? undefined
    : context.players[actor.targetPlayerId]
  if (current && targetEligible(current) && context.tick < actor.nextTargetRefreshTick) {
    return actor
  }
  const targetPlayerId = nearestEligibleTarget(actor.position, context.players)
  return {
    ...actor,
    nextTargetRefreshTick: context.tick + (
      targetPlayerId === null
        ? NATIVE_ENEMY_MISSING_TARGET_REFRESH_TICKS
        : NATIVE_ENEMY_TARGET_REFRESH_TICKS
    ),
    targetPlayerId,
  }
}

function nearestEligibleTarget(
  position: Readonly<BoneyardPoint>,
  players: BoneyardEnemyTargets,
): string | null {
  let selected: string | null = null
  let selectedDistance = Number.POSITIVE_INFINITY
  for (const [playerId, player] of Object.entries(players)) {
    validatePoint(player.position, `enemy target ${playerId}`)
    validatePoint(player.velocityPerTick, `enemy target ${playerId} velocity`)
    if (!Number.isFinite(player.collisionRadius) || player.collisionRadius < 0) {
      throw new RangeError(`enemy target ${playerId} collision radius must be non-negative`)
    }
    if (!targetEligible(player)) continue
    const dx = player.position.x - position.x
    const dy = player.position.y - position.y
    const distance = dx * dx + dy * dy
    if (
      distance < selectedDistance
      || (distance === selectedDistance && (selected === null || playerId < selected))
    ) {
      selected = playerId
      selectedDistance = distance
    }
  }
  return selected
}

function targetEligible(target: BoneyardEnemyTargetCandidate): boolean {
  return target.alive && target.connected && target.eligible
}

function targetDistance(
  actor: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
): number {
  if (actor.targetPlayerId === null) return Number.POSITIVE_INFINITY
  const target = players[actor.targetPlayerId]
  if (!target) return Number.POSITIVE_INFINITY
  return Math.hypot(
    target.position.x - actor.position.x,
    target.position.y - actor.position.y,
  )
}

function targetWithinAttackReach(
  actor: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
  centerReach: number,
): boolean {
  return targetPlayerWithinAttackReach(
    actor,
    actor.targetPlayerId,
    players,
    centerReach,
  )
}

function targetPlayerWithinAttackReach(
  actor: BoneyardEnemyActor,
  targetPlayerId: string | null,
  players: BoneyardEnemyTargets,
  centerReach: number,
): boolean {
  if (targetPlayerId === null) return false
  const target = players[targetPlayerId]
  if (!target || !targetEligible(target)) return false
  return Math.hypot(
    target.position.x - actor.position.x,
    target.position.y - actor.position.y,
  ) <= Math.max(
    centerReach,
    actor.config.collisionRadius + target.collisionRadius,
  )
}

function faceTarget(
  actor: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return actor
  const target = players[actor.targetPlayerId]
  if (!target) return actor
  const dx = target.position.x - actor.position.x
  const dy = target.position.y - actor.position.y
  return dx === 0 && dy === 0
    ? actor
    : { ...actor, headingDeg: actorHeadingFromVector(dx, dy) }
}

function targetHeading(
  position: Readonly<BoneyardPoint>,
  targetPlayerId: string | null,
  players: BoneyardEnemyTargets,
): number {
  const target = targetPlayerId === null ? undefined : players[targetPlayerId]
  return target
    ? actorHeadingFromVector(
        target.position.x - position.x,
        target.position.y - position.y,
      )
    : 0
}

function attackMarker(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
  targetPlayerId: string | null = actor.targetPlayerId,
): number {
  return emitEvent(work, tick, 'attack-marker', actor.id, {
    targetPlayerId,
  })
}

function directPlayerDamage(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  targetPlayerId: string | null,
  eventId: number,
): void {
  if (targetPlayerId === null || actor.config.primaryDamage === null) return
  const zombie = actor.config.enemyToken === 'ZOMBIE' ? actor.config.family : null
  work.playerDamage.push(Object.freeze({
    actorId: actor.id,
    amount: actor.config.primaryDamage,
    coldSlowTicks: 0,
    dazzleTicks: actor.config.enemyToken === 'WRAITH'
      ? NATIVE_WRAITH_DAZZLE_TICKS
      : 0,
    eventId,
    playerId: targetPlayerId,
    poisonDamage: zombie?.poisonPunchDamage ?? 0,
    poisonDuration: zombie?.poisonDuration ?? 0,
  }))
}

function emitArcherVolley(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  sourceRngState: number,
  context: BoneyardEnemyStoreStepContext,
): number {
  if (actor.config.enemyToken !== 'SKELETONARCHER' || actor.targetPlayerId === null) {
    return sourceRngState
  }
  const target = context.players[actor.targetPlayerId]
  if (!target || !targetEligible(target)) return sourceRngState
  const totalArrows = 1 + actor.config.family.extraArrows
  let rngState = sourceRngState
  for (let arrowIndex = 0; arrowIndex < totalArrows; arrowIndex += 1) {
    const random = nextBoneyardWaveRandom(rngState)
    rngState = random.state
    const headingDeg = boundedArcherAimHeading({
      accuracyMode: actor.config.family.accuracyMode,
      arrowIndex,
      arrowType: actor.config.family.arrowType,
      origin: actor.position,
      projectileSpeed: BOUNDED_ENEMY_PROJECTILE_PROGRAMS.arrow.speed,
      randomUnit: random.value,
      targetPosition: target.position,
      targetVelocityPerTick: target.velocityPerTick,
      totalArrows,
    })
    const poison = actor.config.family.arrowType === 'poison'
    spawnProjectile(
      work,
      actor,
      context.tick,
      'arrow',
      actor.config.primaryDamage ?? 0,
      {
        headingDeg,
        payload: projectilePayloadForArrow(actor.config.family.arrowType),
        poisonDamage: poison ? actor.config.secondaryDamage : 0,
        poisonDuration: poison ? BOUNDED_ENEMY_POISON_DURATION_SECONDS : 0,
        secondaryDamage: actor.config.family.arrowType === 'fire'
          ? actor.config.secondaryDamage
          : 0,
      },
    )
  }
  return rngState
}

function directContactPlayerDamage(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  targetPlayerId: string | null,
  players: BoneyardEnemyTargets,
  centerReach: number,
  eventId: number,
): void {
  if (!targetPlayerWithinAttackReach(actor, targetPlayerId, players, centerReach)) return
  directPlayerDamage(work, actor, targetPlayerId, eventId)
}

function emitMageAttack(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
  eventId: number,
): BoneyardEnemyActor['lightningEffect'] {
  if (actor.config.enemyToken !== 'SKELETONMAGE') return null
  switch (actor.config.family.element) {
    case 'fire':
      spawnProjectile(
        work,
        actor,
        context.tick,
        'firebolt',
        actor.config.primaryDamage ?? 0,
        { payload: 'fire' },
      )
      return null
    case 'frost':
      spawnProjectile(
        work,
        actor,
        context.tick,
        'guided-missile',
        actor.config.primaryDamage ?? 0,
        { coldSlowTicks: BOUNDED_ENEMY_COLD_SLOW_TICKS, payload: 'cold' },
      )
      return null
    case 'poison':
      spawnProjectile(
        work,
        actor,
        context.tick,
        'guided-missile',
        actor.config.primaryDamage ?? 0,
        {
          payload: 'poison',
          poisonDamage: actor.config.primaryDamage ?? 0,
          poisonDuration: BOUNDED_ENEMY_POISON_DURATION_SECONDS,
        },
      )
      return null
    case 'lightning': {
      const target = actor.targetPlayerId === null
        ? undefined
        : context.players[actor.targetPlayerId]
      if (!target || !targetEligible(target)) return null
      directPlayerDamage(work, actor, actor.targetPlayerId, eventId)
      const lightningEventId = emitEvent(
        work,
        context.tick,
        'mage-lightning',
        actor.id,
        {
          sourcePosition: Object.freeze({ ...actor.position }),
          targetPlayerId: actor.targetPlayerId,
          targetPosition: Object.freeze({ ...target.position }),
        },
      )
      return Object.freeze({
        eventId: lightningEventId,
        startedTick: context.tick,
        targetPosition: Object.freeze({ ...target.position }),
      })
    }
  }
}

interface SpawnEnemyProjectileOptions {
  readonly coldSlowTicks?: number
  readonly headingDeg?: number
  readonly payload?: BoneyardEnemyProjectilePayload
  readonly poisonDamage?: number
  readonly poisonDuration?: number
  readonly secondaryDamage?: number
}

function spawnProjectile(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
  kind: BoneyardEnemyProjectileKind,
  damage: number,
  options: SpawnEnemyProjectileOptions = {},
): BoneyardEnemyProjectile {
  const program = BOUNDED_ENEMY_PROJECTILE_PROGRAMS[kind]
  const zombie = actor.config.enemyToken === 'ZOMBIE' ? actor.config.family : null
  const projectile: BoneyardEnemyProjectile = Object.freeze({
    ageTicks: 0,
    coldSlowTicks: options.coldSlowTicks ?? 0,
    contactRadius: program.contactRadius,
    damage: kind === 'poison-pool' ? 0 : damage + (options.secondaryDamage ?? 0),
    headingDeg: options.headingDeg ?? actor.headingDeg,
    hitPlayerIds: Object.freeze([]),
    homing: program.homing,
    id: work.nextProjectileId,
    kind,
    lastStepTick: tick,
    lifetimeTicks: program.lifetimeTicks,
    nativeTypeId: projectileNativeTypeId(kind),
    ownerActorId: actor.id,
    payload: options.payload ?? (kind === 'poison-pool' ? 'poison' : 'none'),
    poisonDamage: kind === 'poison-pool' ? damage : (options.poisonDamage ?? 0),
    poisonDuration: kind === 'poison-pool'
      ? (zombie?.poisonDuration ?? 0)
      : (options.poisonDuration ?? 0),
    position: Object.freeze({ ...actor.position }),
    speed: program.speed,
    spawnTick: tick,
    targetPlayerId: actor.targetPlayerId,
  })
  work.nextProjectileId += 1
  work.projectiles.push(projectile)
  emitEvent(work, tick, 'projectile-spawned', actor.id, {
    projectileId: projectile.id,
    targetPlayerId: actor.targetPlayerId,
  })
  return projectile
}

function stepProjectiles(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
): void {
  const retained: BoneyardEnemyProjectile[] = []
  for (const source of work.projectiles) {
    if (source.lastStepTick >= context.tick) {
      retained.push(source)
      continue
    }
    const elapsedTicks = context.tick - source.lastStepTick
    const movementTicks = Math.min(
      elapsedTicks,
      Math.max(0, source.lifetimeTicks - source.ageTicks),
    )
    const ageTicks = source.ageTicks + movementTicks
    const priorTarget = source.targetPlayerId === null
      ? undefined
      : context.players[source.targetPlayerId]
    const targetPlayerId = source.homing
      ? priorTarget && targetEligible(priorTarget)
        ? source.targetPlayerId
        : nearestEligibleTarget(source.position, context.players)
      : source.targetPlayerId
    const direction = projectileDirection(source, targetPlayerId, context.players)
    const requestedPosition = Object.freeze({
      x: source.position.x + direction.x * source.speed * movementTicks,
      y: source.position.y + direction.y * source.speed * movementTicks,
    })
    const contact = firstProjectileContact(
      source.position,
      requestedPosition,
      source.contactRadius,
      context.players,
      new Set(source.hitPlayerIds),
    )
    const worldContact = source.kind === 'poison-pool'
      ? null
      : context.firstProjectileWorldContact({
          end: requestedPosition,
          projectileId: source.id,
          radius: source.contactRadius,
          start: source.position,
        })
    if (
      worldContact !== null
      && (!Number.isFinite(worldContact) || worldContact < 0 || worldContact > 1)
    ) {
      throw new RangeError('enemy projectile world contact must be null or within [0, 1]')
    }
    if (
      worldContact !== null
      && (contact === null || worldContact <= contact.progress)
    ) {
      emitEvent(work, context.tick, 'projectile-impact', source.ownerActorId, {
        projectileId: source.id,
        targetPlayerId: null,
      })
      emitEvent(work, context.tick, 'projectile-retired', source.ownerActorId, {
        projectileId: source.id,
        targetPlayerId: null,
      })
      continue
    }
    if (contact !== null) {
      const eventId = emitEvent(work, context.tick, 'projectile-impact', source.ownerActorId, {
        projectileId: source.id,
        targetPlayerId: contact.playerId,
      })
      work.playerDamage.push(Object.freeze({
        actorId: source.ownerActorId,
        amount: source.damage,
        coldSlowTicks: source.coldSlowTicks,
        dazzleTicks: 0,
        eventId,
        playerId: contact.playerId,
        poisonDamage: source.poisonDamage,
        poisonDuration: source.poisonDuration,
      }))
      if (source.kind !== 'poison-pool') {
        emitEvent(work, context.tick, 'projectile-retired', source.ownerActorId, {
          projectileId: source.id,
          targetPlayerId: contact.playerId,
        })
        continue
      }
      const hitPlayerIds = Object.freeze([...source.hitPlayerIds, contact.playerId].sort())
      if (ageTicks < source.lifetimeTicks) {
        retained.push(Object.freeze({
          ...source,
          ageTicks,
          headingDeg: direction.headingDeg,
          hitPlayerIds,
          lastStepTick: context.tick,
          position: requestedPosition,
          targetPlayerId,
        }))
        continue
      }
    }
    if (ageTicks >= source.lifetimeTicks) {
      emitEvent(work, context.tick, 'projectile-retired', source.ownerActorId, {
        projectileId: source.id,
        targetPlayerId,
      })
      continue
    }
    retained.push(Object.freeze({
      ...source,
      ageTicks,
      headingDeg: direction.headingDeg,
      lastStepTick: context.tick,
      position: requestedPosition,
      targetPlayerId,
    }))
  }
  work.projectiles = retained
}

function projectileDirection(
  projectile: BoneyardEnemyProjectile,
  targetPlayerId: string | null,
  players: BoneyardEnemyTargets,
): Readonly<BoneyardPoint> & { readonly headingDeg: number } {
  const target = targetPlayerId === null ? undefined : players[targetPlayerId]
  if (projectile.homing && target && targetEligible(target)) {
    const dx = target.position.x - projectile.position.x
    const dy = target.position.y - projectile.position.y
    const length = Math.hypot(dx, dy)
    if (length > 0) {
      return {
        headingDeg: actorHeadingFromVector(dx, dy),
        x: dx / length,
        y: dy / length,
      }
    }
  }
  const radians = projectile.headingDeg * Math.PI / 180
  return {
    headingDeg: projectile.headingDeg,
    x: Math.sin(radians),
    y: -Math.cos(radians),
  }
}

function firstProjectileContact(
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
  radius: number,
  players: BoneyardEnemyTargets,
  excludedPlayerIds: ReadonlySet<string>,
): { playerId: string; progress: number } | null {
  const vx = end.x - start.x
  const vy = end.y - start.y
  const lengthSquared = vx * vx + vy * vy
  let selected: { playerId: string; progress: number } | null = null
  for (const [playerId, player] of Object.entries(players)) {
    if (!targetEligible(player) || excludedPlayerIds.has(playerId)) continue
    const wx = player.position.x - start.x
    const wy = player.position.y - start.y
    const progress = lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, (wx * vx + wy * vy) / lengthSquared))
    const nearestX = start.x + vx * progress
    const nearestY = start.y + vy * progress
    const dx = player.position.x - nearestX
    const dy = player.position.y - nearestY
    const contactRadius = radius + player.collisionRadius
    if (dx * dx + dy * dy > contactRadius * contactRadius) continue
    if (
      selected === null
      || progress < selected.progress
      || (progress === selected.progress && playerId < selected.playerId)
    ) selected = { playerId, progress }
  }
  return selected
}

function projectileNativeTypeId(
  kind: BoneyardEnemyProjectileKind,
): BoneyardEnemyProjectile['nativeTypeId'] {
  switch (kind) {
    case 'arrow': return 0x7da
    case 'firebolt': return 0x7eb
    case 'guided-missile': return 0x7ec
    case 'demon-bomb': return 0x7f7
    case 'poison-pool': return 0x806
  }
}

function stepDyingActor(
  work: WorkingStep,
  source: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor | null {
  const tick = context.tick
  const deathStartedTick = source.deathStartedTick ?? tick
  const deathTick = Math.max(0, tick - deathStartedTick)
  let actor = { ...source, deathTick }
  if (!actor.terminalEmitted) {
    emitEvent(work, tick, 'enemy-death', actor.id)
    const output = terminalOutput(actor.config.enemyToken)
    emitEvent(work, tick, 'enemy-terminal-output', actor.id, {
      count: terminalOutputCount(actor),
      output,
    })
    spawnTerminalChildren(work, actor, context)
    if (
      actor.config.enemyToken === 'ZOMBIE'
      && actor.config.family.rotten
      && actor.config.family.poisonPoolDamage > 0
    ) {
      spawnProjectile(
        work,
        actor,
        tick,
        'poison-pool',
        actor.config.family.poisonPoolDamage,
      )
    }
    const rewardEventId = emitEvent(work, tick, 'reward', actor.id, {
      targetPlayerId: actor.lastDamagedByPlayerId,
    })
    work.rewards.push(Object.freeze({
      actorId: actor.id,
      eventId: rewardEventId,
      experience: actor.config.experience,
      playerId: actor.lastDamagedByPlayerId,
    }))
    actor = { ...actor, rewardGranted: true, terminalEmitted: true }
  }
  if (deathTick < BOUNDED_ENEMY_DEATH_PROGRAM_TICKS[actor.config.enemyToken]) {
    return actor
  }
  const eventId = emitEvent(work, tick, 'enemy-retired', actor.id)
  work.retired.push(Object.freeze({ actorId: actor.id, eventId }))
  return null
}

function spawnTerminalChildren(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): void {
  if (actor.config.enemyToken !== 'IMP' && actor.config.enemyToken !== 'DEMON') return
  const count = actor.config.family.splitCount
  if (count === 0) return
  const radius = Math.max(10, actor.config.collisionRadius)
  const spawnIntents = Array.from({ length: count }, (_, index): BoneyardEnemySpawnIntent => {
    const angle = index / count * Math.PI * 2
    const intent: BoneyardEnemySpawnIntent = {
      enemyToken: 'IMP',
      flags: [],
      id: work.nextSyntheticSpawnIntentId,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.IMP,
      position: {
        x: actor.position.x + Math.cos(angle) * radius,
        y: actor.position.y + Math.sin(angle) * radius,
      },
      spawnTick: context.tick,
      waveOrdinal: actor.waveOrdinal,
    }
    work.nextSyntheticSpawnIntentId += 1
    return intent
  })
  work.actors.push(...materializeSpawnIntents(work, context, spawnIntents))
}

function terminalOutput(token: EvaluatedBoneyardEnemyConfig['enemyToken']): BoneyardEnemyTerminalOutput {
  switch (token) {
    case 'SKELETON': return 'skeleton-shatter'
    case 'SKELETONARCHER': return 'archer-shatter'
    case 'SKELETONMAGE': return 'mage-shatter'
    case 'IMP': return 'imp-split'
    case 'ZOMBIE': return 'zombie-collapse'
    case 'WRAITH': return 'wraith-fragments'
    case 'DEMON': return 'demon-split'
    case 'COFFIN': return 'coffin-break'
  }
}

function terminalOutputCount(actor: BoneyardEnemyActor): number | undefined {
  if (actor.config.enemyToken === 'IMP' || actor.config.enemyToken === 'DEMON') {
    return actor.config.family.splitCount
  }
  return undefined
}

function emitEvent(
  work: WorkingStep,
  tick: number,
  type: BoneyardEnemySemanticEventType,
  actorId: BoneyardEnemyActorId,
  patch: Omit<Partial<BoneyardEnemySemanticEvent>, 'actorId' | 'eventId' | 'tick' | 'type'> = {},
): number {
  const eventId = work.nextEventId
  work.nextEventId += 1
  work.events.push(Object.freeze({ actorId, eventId, tick, type, ...patch }))
  return eventId
}

function deathBrain(brain: BoneyardEnemyBrain): BoneyardEnemyBrain {
  return { ...brain, phase: 'death' } as BoneyardEnemyBrain
}

function skeletonAction(weapon: BoneyardSkeletonWeapon): 'claw' | 'pike' | 'weapon' {
  if (weapon === 'claw') return 'claw'
  if (weapon === 'pike') return 'pike'
  return 'weapon'
}

function resetSkeleton(
  actor: BoneyardEnemyActor,
  brain: BoneyardSkeletonBrain,
): BoneyardEnemyActor {
  return brain.phase === 'approach' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionProgress: 0,
      contactTargetPlayerId: null,
      markerEmitted: false,
      phase: 'approach',
    },
  }
}

function resetArcher(
  actor: BoneyardEnemyActor,
  brain: BoneyardArcherBrain,
): BoneyardEnemyActor {
  return brain.phase === 'range-control' ? actor : {
    ...actor,
    brain: { ...brain, actionProgress: 0, markerEmitted: false, phase: 'range-control' },
  }
}

function resetMage(actor: BoneyardEnemyActor, brain: BoneyardMageBrain): BoneyardEnemyActor {
  return brain.phase === 'range-control' ? actor : {
    ...actor,
    brain: { ...brain, actionProgress: 0, markerEmitted: false, phase: 'range-control' },
  }
}

function resetImp(actor: BoneyardEnemyActor, brain: BoneyardImpBrain): BoneyardEnemyActor {
  return brain.phase === 'flight' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionTick: 0,
      contactTargetPlayerId: null,
      cooldownTicks: 0,
      markerEmitted: false,
      phase: 'flight',
    },
  }
}

function resetZombie(
  actor: BoneyardEnemyActor,
  brain: BoneyardZombieBrain,
): BoneyardEnemyActor {
  return brain.phase === 'approach' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionTick: 0,
      contactTargetPlayerId: null,
      markerEmitted: false,
      phase: 'approach',
      phaseTicksRemaining: 0,
    },
  }
}

function resetWraith(
  actor: BoneyardEnemyActor,
  brain: BoneyardWraithBrain,
): BoneyardEnemyActor {
  return brain.phase === 'approach' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionTick: 0,
      contactTargetPlayerId: null,
      markerEmitted: false,
      phase: 'approach',
      phaseTicksRemaining: 0,
    },
  }
}

function resetDemon(actor: BoneyardEnemyActor, brain: BoneyardDemonBrain): BoneyardEnemyActor {
  return brain.phase === 'approach' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionTick: 0,
      markerEmitted: false,
      phase: 'approach',
      phaseTicksRemaining: 0,
    },
  }
}

function validateTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('enemy store tick must be a non-negative safe integer')
  }
}

function validatePoint(point: Readonly<BoneyardPoint>, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`${label} must contain finite coordinates`)
  }
}
