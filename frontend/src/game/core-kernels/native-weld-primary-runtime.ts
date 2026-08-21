import { actorHeadingFromVector } from './actor-heading.ts'
import type { NativeWeldPrimarySkillProfile } from './native-primary-skill-profile.ts'
import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import {
  ETHER_PRIMARY_INITIAL_TURN,
  advanceEtherPrimaryHoming,
  directionFromHeading,
  nativePrimaryTargetEligible,
  selectEtherPrimaryTarget,
  type PrimarySpellTarget,
} from './primary-spell-targeting.ts'
import type { Vector2 } from './vector.ts'
import type { NativeWeldBuildId } from './native-weld-primary-profile.ts'
import type {
  NativeLightProviderRegistration,
  RegisterNativeLightProvider,
} from './native-light-provider-order.ts'
import { nativeEarthBoulderReleasedDamage } from './native-earth-boulder.ts'
import {
  EARTH_BOULDER_IDENTITY_ORIENTATION,
  earthBoulderFlightOrientationStep,
  earthBoulderHeldOrientationStep,
  type EarthBoulderOrientation,
} from './primary-spell-earth-orientation.ts'

export type NativeWeldOneShotBuildId = 1000 | 1001 | 1002 | 1009
export type NativeWeldChannelBuildId = 1003 | 1004 | 1005
export type NativeWeldPersistentBuildId = 1006 | 1007 | 1008

export type NativeWeldCastCue =
  | 'ball-lightning'
  | 'blizzard-beam-loop'
  | 'burning-bolt'
  | 'crawling-shock'
  | 'ethereal-boulder-loop'
  | 'flame-lash-loop'
  | 'frost-missile'
  | 'hailstones-loop'
  | 'meteor-swarm-loop'
  | 'steam-jet-loop'

export interface NativeWeldAudioPlan {
  readonly buildId: NativeWeldBuildId
  readonly cue: NativeWeldCastCue
  readonly loop: boolean
  readonly nativeLoopIds: readonly number[]
  readonly nativeSoundIds: readonly number[]
  readonly nativeSoundVariantIds: readonly number[]
}

const WELD_AUDIO_PLANS: Readonly<Record<NativeWeldBuildId, NativeWeldAudioPlan>> = {
  1000: plan(1000, 'burning-bolt', { sounds: [57, 97] }),
  1001: plan(1001, 'frost-missile', { sounds: [38] }),
  1002: plan(1002, 'ball-lightning', { soundVariants: [224, 225] }),
  1003: plan(1003, 'flame-lash-loop', { loops: [157], sounds: [33] }),
  1004: plan(1004, 'blizzard-beam-loop', { loops: [160], sounds: [44] }),
  1005: plan(1005, 'steam-jet-loop', { loops: [172, 157] }),
  1006: plan(1006, 'ethereal-boulder-loop', { loops: [159], sounds: [87] }),
  1007: plan(1007, 'meteor-swarm-loop', { loops: [165] }),
  1008: plan(1008, 'hailstones-loop', { loops: [160, 159], sounds: [87] }),
  1009: plan(1009, 'crawling-shock', { soundVariants: [203, 204, 205] }),
}

export interface NativeWeldProjectileState {
  readonly ageTicks: number
  readonly ballLightningAcceleration: number | null
  readonly basePresentationPhaseDegrees: number | null
  readonly buildId: NativeWeldOneShotBuildId
  readonly castPlaybackRate: number
  readonly castSoundVariant: number | null
  readonly charge: 1
  readonly contactsRemaining: number
  readonly damage: number
  readonly direction: Vector2
  readonly flightTicks: number
  readonly headingDegrees: number
  readonly hitTargetIds: readonly string[]
  readonly id: number
  readonly frostPulseAspect: number | null
  readonly frostTurnDegrees: number | null
  readonly groundSparkNativeAgeTicks: number | null
  readonly groundSparkTurnTicksRemaining: number | null
  readonly kind: 'weld'
  readonly lightRegistration: NativeLightProviderRegistration
  readonly ownerId: string
  readonly phase: 'flight'
  readonly position: Vector2
  readonly presentationSeed: number | null
  readonly projectileIndex: number
  readonly secondaryPresentationPhaseDegrees: number | null
  readonly speed: number
  readonly targetId: string | null
  readonly turnAccumulator: number
  readonly turnInput: number
  readonly underpowered: boolean
  readonly vector: readonly number[]
  readonly velocity: Vector2
  readonly worldKey: string
}

interface NativeWeldOwnedActorBase {
  readonly ageTicks: number
  readonly birthTick: number
  readonly buildId: NativeWeldBuildId
  readonly direction: Vector2
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly vector: readonly number[]
  readonly worldKey: string
}

export interface NativeWeldChannelActorState extends NativeWeldOwnedActorBase {
  readonly buildId: NativeWeldChannelBuildId
  readonly endpoint: Vector2 | null
  readonly kind: 'weld-channel'
  readonly lightRegistration: null
  readonly midpoint: Vector2 | null
  readonly targetId: string | null
  readonly variant: number
}

interface NativeWeldPersistentActorBase extends NativeWeldOwnedActorBase {
  readonly kind: 'weld-persistent'
  readonly lightRegistration: NativeLightProviderRegistration | null
  readonly pulseSequence: number
}

export interface NativeWeldEtherealBoulderState extends NativeWeldPersistentActorBase {
  readonly assemblyScale: number
  readonly buildId: 1006
  readonly damage: number
  readonly flightTicks: number
  readonly hitTargetIds: readonly string[]
  readonly lifetimeTicksRemaining: number
  readonly lightRegistration: NativeLightProviderRegistration
  readonly maximumScale: number
  readonly orientation: EarthBoulderOrientation
  readonly phase: 'flight' | 'held'
  readonly quantity: number
  readonly remainingDamage: number
  readonly scale: number
  readonly speedFactor: number
  readonly toughness: number
  readonly velocity: Vector2
  readonly visualScaleFactor: number
}

export interface NativeWeldHailstoneRockState {
  readonly damageRemaining: number
  readonly decay: number
  readonly localPosition: Readonly<{ x: number; y: number; z: number }>
  readonly phase: number
  readonly releaseOffset: Vector2 | null
  readonly spriteRecord: 168 | 169 | 170
  readonly visualScale: number
}

export interface NativeWeldHailstonesState extends NativeWeldPersistentActorBase {
  readonly buildId: 1008
  readonly damage: number
  readonly lightRegistration: NativeLightProviderRegistration
  readonly maximumScale: 1
  readonly phase: 'flight' | 'held'
  readonly presentationScale: number
  readonly pushback: number
  readonly rocks: readonly NativeWeldHailstoneRockState[]
  readonly scale: number
  readonly toughness: number
  readonly widen: number
}

export interface NativeWeldMeteorFieldState extends NativeWeldPersistentActorBase {
  readonly buildId: 1007
  readonly lightRegistration: null
  readonly phase: 'held'
}

export type NativeWeldPersistentActorState =
  | NativeWeldEtherealBoulderState
  | NativeWeldHailstonesState
  | NativeWeldMeteorFieldState

export interface NativeWeldMeteorActorState extends NativeWeldOwnedActorBase {
  readonly buildId: 1007
  readonly damage: number
  readonly fallScalar: number
  readonly impactDue: boolean
  readonly impactTicksRemaining: number
  readonly kind: 'weld-meteor'
  readonly lightRegistration: NativeLightProviderRegistration
  readonly phase: 'fall' | 'impact'
  readonly position: Vector2
  readonly presentationPhase: number
  readonly privateSeed: number
  readonly pulseDue: boolean
  readonly pulseSequence: number
  readonly pulseTicksRemaining: number
}

export interface NativeWeldImpactActorState extends NativeWeldOwnedActorBase {
  readonly buildId: NativeWeldOneShotBuildId | NativeWeldPersistentBuildId
  readonly kind: 'weld-impact'
  readonly lightRegistration: null
  readonly position: Vector2
}

export type NativeWeldWorldActor =
  | NativeWeldChannelActorState
  | NativeWeldImpactActorState
  | NativeWeldMeteorActorState
  | NativeWeldPersistentActorState

export interface SpawnNativeWeldOneShotInput {
  readonly aimDirection: Vector2
  readonly firstId: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly primarySkill: NativeWeldPrimarySkillProfile
  readonly registerLightProvider?: RegisterNativeLightProvider
  readonly rng: NativeRngState
  readonly targets: readonly PrimarySpellTarget[]
  readonly underpowered: boolean
  readonly worldKey: string
}

export interface SpawnNativeWeldOneShotResult {
  readonly projectiles: readonly NativeWeldProjectileState[]
  readonly rng: NativeRngState
}

export const NATIVE_WELD_CHANNEL_VISIBLE_TICKS = 5
export const NATIVE_WELD_IMPACT_VISIBLE_TICKS = 20
export const NATIVE_WELD_METEOR_CADENCE_TICKS = 25
export const NATIVE_WELD_METEOR_FALL_STEP = Math.fround(0.02)
export const NATIVE_WELD_METEOR_IMPACT_TICKS = 200
export const NATIVE_WELD_METEOR_PULSE_TICKS = 10
export const NATIVE_WELD_PERSISTENT_INITIAL_SCALE = Math.fround(0.18)
export const NATIVE_WELD_HAILSTONES_SPEED = 10
export const NATIVE_WELD_HAILSTONES_LOOKAHEAD = 30
export const NATIVE_WELD_HAILSTONES_TARGET_RADIUS_FACTOR = 3

const NATIVE_WELD_BALL_LIGHTNING_SPEED_FACTOR = 0.8500000238418579
const NATIVE_WELD_BALL_LIGHTNING_INITIAL_ACCELERATION = 2
const NATIVE_WELD_BALL_LIGHTNING_ACCELERATION_DECAY = 0.8999999761581421
const NATIVE_WELD_BALL_LIGHTNING_SPEED_CAP = 6
const NATIVE_WELD_FROST_TURN_DECAY = 0.949999988079071
const NATIVE_WELD_FROST_TURN_LIMIT = 35
const NATIVE_WELD_GROUND_SPARK_AUDIO_RANGE = Math.fround(0.05)
const NATIVE_WELD_GROUND_SPARK_WEAK_AUDIO_FACTOR = 0.800000011920929
const NATIVE_WELD_GROUND_SPARK_PRIVATE_MULTIPLIER = 0x0a67cfcf
const NATIVE_WELD_GROUND_SPARK_TURN_TICKS = 20
const NATIVE_WELD_GROUND_SPARK_TURN_MINIMUM = 17
const NATIVE_WELD_GROUND_SPARK_TURN_RANGE = 20

export function nativeWeldAudioPlan(buildId: NativeWeldBuildId): NativeWeldAudioPlan {
  return WELD_AUDIO_PLANS[buildId]
}

export function spawnNativeWeldOneShot(
  input: SpawnNativeWeldOneShotInput,
): SpawnNativeWeldOneShotResult {
  const profile = input.primarySkill
  if (profile.castKind !== 'one-shot' || !isOneShotBuild(profile.buildId)) {
    throw new Error(`weld build ${profile.buildId} is not a one-shot actor`)
  }
  const damage = drawNativeWeldDamage(
    input.rng,
    profile.damageMinimum,
    profile.damageMaximum,
  )
  let rng = damage.rng
  const aimHeading = actorHeadingFromVector(input.aimDirection.x, input.aimDirection.y)
  const quantity = input.underpowered
    ? 1
    : profile.buildId === 1009
      ? 3
      : Math.round(profile.vector.values[3]!)
  let castPlaybackRate = input.underpowered ? Math.fround(0.75) : 1
  let ballLightningTurnScale = 1
  if (profile.buildId === 1001) {
    const draw = drawNativeFloat(rng, Math.fround(0.1))
    rng = draw.state
    if (!input.underpowered) castPlaybackRate = Math.fround(1 + draw.value)
  } else if (profile.buildId === 1002) {
    const draw = drawNativeFloat(rng, Math.fround(0.25))
    rng = draw.state
    ballLightningTurnScale = input.underpowered
      ? Math.fround(0.75)
      : Math.fround(1 + draw.value)
    castPlaybackRate = ballLightningTurnScale
  } else if (profile.buildId === 1009) {
    const draw = drawNativeFloat(rng, NATIVE_WELD_GROUND_SPARK_AUDIO_RANGE, true)
    rng = draw.state
    castPlaybackRate = Math.fround(1 + draw.value)
    if (input.underpowered) {
      castPlaybackRate = Math.fround(
        castPlaybackRate * NATIVE_WELD_GROUND_SPARK_WEAK_AUDIO_FACTOR,
      )
    }
  }
  let castSoundVariant: number | null = null
  if (profile.buildId === 1002 || profile.buildId === 1009) {
    const draw = drawNativeInteger(rng, profile.buildId === 1002 ? 2 : 3)
    rng = draw.state
    castSoundVariant = draw.value
  }
  const projectiles: NativeWeldProjectileState[] = []
  for (let index = 0; index < quantity; index += 1) {
    const headingDegrees = profile.buildId === 1009
      ? normalizeDegrees(aimHeading + (index === 0 ? 0 : index === 1 ? -30 : 30))
      : nativeWeldMissileFanHeading(aimHeading, quantity, index)
    const direction = directionFromHeading(headingDegrees)
    const position = Object.freeze({
      x: input.origin.x,
      y: Math.fround(input.origin.y + (profile.buildId === 1009 ? 15 : 10)),
    })
    const speedFactor = profile.buildId === 1009
      ? index === 0 ? 4 : 3
      : input.underpowered
        ? Math.fround(0.8)
        : profile.buildId === 1002
          ? Math.fround(
              profile.vector.values[4]! * NATIVE_WELD_BALL_LIGHTNING_SPEED_FACTOR,
            )
          : profile.vector.values[4]!
    const speed = profile.buildId === 1009
      ? speedFactor
      : Math.fround(3 * speedFactor)
    const target = profile.buildId === 1009
      ? null
      : selectEtherPrimaryTarget({
          aimDirection: direction,
          origin: position,
          targets: input.targets,
        })
    let basePresentationPhaseDegrees: number | null = null
    if (profile.buildId !== 1009) {
      const phase = drawNativeFloat(rng, 360)
      rng = phase.state
      basePresentationPhaseDegrees = phase.value
    }
    let secondaryPresentationPhaseDegrees: number | null = null
    let frostPulseAspect: number | null = null
    if (profile.buildId === 1001) {
      const phase = drawNativeFloat(rng, 360)
      rng = phase.state
      secondaryPresentationPhaseDegrees = phase.value
      const aspect = drawNativeFloat(rng, Math.fround(0.25))
      rng = aspect.state
      frostPulseAspect = Math.fround(0.5 + aspect.value)
    }
    let presentationSeed: number | null = null
    let groundSparkNativeAgeTicks: number | null = null
    if (profile.buildId === 1000 || profile.buildId === 1009) {
      const nativeSeed = drawNativeInteger(
        rng,
        profile.buildId === 1000 ? 100_000 : 1_000_000,
      )
      rng = nativeSeed.state
      presentationSeed = nativeSeed.value
      if (profile.buildId === 1009) {
        const age = drawNativeInteger(rng, 360)
        rng = age.state
        groundSparkNativeAgeTicks = age.value
      }
    }
    const vector = underpoweredWeldVector(
      profile.buildId,
      profile.vector.values,
      input.underpowered,
    )
    const ballLightningAcceleration = profile.buildId === 1002
      ? NATIVE_WELD_BALL_LIGHTNING_INITIAL_ACCELERATION
      : null
    const movementSpeed = profile.buildId === 1002
      ? nativeBallLightningMovementSpeed(speed, ballLightningAcceleration!)
      : speed
    projectiles.push(Object.freeze({
      ageTicks: 0,
      ballLightningAcceleration,
      basePresentationPhaseDegrees,
      buildId: profile.buildId,
      castPlaybackRate,
      castSoundVariant,
      charge: 1,
      contactsRemaining: profile.buildId === 1009
        ? Math.round(vector[4]!) + 1
        : 1,
      damage: Math.fround(damage.value * (input.underpowered ? 0.5 : 1)),
      direction,
      flightTicks: 0,
      frostPulseAspect,
      frostTurnDegrees: profile.buildId === 1001 ? 0 : null,
      groundSparkNativeAgeTicks,
      groundSparkTurnTicksRemaining: profile.buildId === 1009 ? 0 : null,
      headingDegrees,
      hitTargetIds: Object.freeze([]),
      id: input.firstId + index,
      kind: 'weld',
      lightRegistration: input.registerLightProvider?.('actor') ?? Object.freeze({
        managerLane: 'actor',
        registrationOrdinal: input.firstId + index,
      }),
      ownerId: input.ownerId,
      phase: 'flight',
      position,
      presentationSeed,
      projectileIndex: index,
      secondaryPresentationPhaseDegrees,
      speed,
      targetId: target?.id ?? null,
      turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
      turnInput: profile.buildId === 1009
        ? 0
        : Math.fround(
            2
              * speedFactor
              * (profile.buildId === 1002 ? ballLightningTurnScale : 1)
              * 0.75 ** Math.ceil(index / 2),
          ),
      underpowered: input.underpowered,
      vector,
      velocity: Object.freeze({
        x: Math.fround(direction.x * movementSpeed),
        y: Math.fround(direction.y * movementSpeed),
      }),
      worldKey: input.worldKey,
    }))
  }
  return { projectiles: Object.freeze(projectiles), rng }
}

export function stepNativeWeldProjectile(
  projectile: NativeWeldProjectileState,
  targets: readonly PrimarySpellTarget[],
): NativeWeldProjectileState {
  if (projectile.buildId === 1009) {
    const position = Object.freeze({
      x: Math.fround(projectile.position.x + projectile.velocity.x),
      y: Math.fround(projectile.position.y + projectile.velocity.y),
    })
    let direction = projectile.direction
    let presentationSeed = projectile.presentationSeed!
    let speed = projectile.speed
    let turnTicksRemaining = projectile.groundSparkTurnTicksRemaining! - 1
    if (turnTicksRemaining < 1) {
      const turnMagnitudeWord = nativeGroundSparkPrivateWord(presentationSeed)
      const turnSignWord = nativeGroundSparkPrivateWord(turnMagnitudeWord)
      const speedWord = nativeGroundSparkPrivateWord(turnSignWord)
      const magnitude = Math.fround(
        Math.fround((turnMagnitudeWord % 100_000) / 100_000)
          * NATIVE_WELD_GROUND_SPARK_TURN_RANGE
          + NATIVE_WELD_GROUND_SPARK_TURN_MINIMUM,
      )
      const signedMagnitude = turnSignWord % 2 === 0 ? -magnitude : magnitude
      direction = directionFromHeading(projectile.headingDegrees + signedMagnitude)
      presentationSeed = speedWord
      speed = speedWord % 4 + 1
      turnTicksRemaining = NATIVE_WELD_GROUND_SPARK_TURN_TICKS
    }
    return Object.freeze({
      ...projectile,
      ageTicks: projectile.ageTicks + 1,
      direction,
      flightTicks: projectile.flightTicks + 1,
      groundSparkNativeAgeTicks: projectile.groundSparkNativeAgeTicks! + 1,
      groundSparkTurnTicksRemaining: turnTicksRemaining,
      position,
      presentationSeed,
      speed,
      velocity: Object.freeze({
        x: Math.fround(direction.x * speed),
        y: Math.fround(direction.y * speed),
      }),
    })
  }
  const candidate = projectile.targetId === null
    ? undefined
    : targets.find(({ id }) => id === projectile.targetId)
  const target = candidate && nativePrimaryTargetEligible(candidate, 0x2)
    ? candidate
    : selectEtherPrimaryTarget({
        aimDirection: projectile.direction,
        origin: projectile.position,
        targets,
      })
  const movementSpeed = projectile.buildId === 1002
    ? nativeBallLightningMovementSpeed(
        projectile.speed,
        projectile.ballLightningAcceleration!,
      )
    : projectile.speed
  const advanced = advanceEtherPrimaryHoming({
    headingDegrees: projectile.headingDegrees,
    movementScalar: 1,
    position: projectile.position,
    speed: movementSpeed,
    targetPosition: target?.position ?? null,
    turnAccumulator: projectile.turnAccumulator,
    turnInput: projectile.turnInput,
  })
  const ballLightningAcceleration = projectile.buildId === 1002
    ? Math.fround(
        projectile.ballLightningAcceleration!
          * NATIVE_WELD_BALL_LIGHTNING_ACCELERATION_DECAY,
      )
    : null
  const nextMovementSpeed = projectile.buildId === 1002
    ? nativeBallLightningMovementSpeed(projectile.speed, ballLightningAcceleration!)
    : projectile.speed
  let frostTurnDegrees = projectile.frostTurnDegrees
  if (projectile.buildId === 1001) {
    frostTurnDegrees = Math.fround(
      projectile.frostTurnDegrees! * NATIVE_WELD_FROST_TURN_DECAY,
    )
    if (advanced.headingDegrees !== projectile.headingDegrees) {
      frostTurnDegrees = Math.fround(
        signedHeadingDelta(projectile.headingDegrees, advanced.headingDegrees)
          + frostTurnDegrees,
      )
      frostTurnDegrees = Math.max(
        -NATIVE_WELD_FROST_TURN_LIMIT,
        Math.min(NATIVE_WELD_FROST_TURN_LIMIT, frostTurnDegrees),
      )
    }
  }
  return Object.freeze({
    ...projectile,
    ageTicks: projectile.ageTicks + 1,
    ballLightningAcceleration,
    basePresentationPhaseDegrees: projectile.basePresentationPhaseDegrees === null
      ? null
      : Math.fround(
          projectile.basePresentationPhaseDegrees + movementSpeed * 3,
        ),
    direction: advanced.direction,
    flightTicks: projectile.flightTicks + 1,
    frostTurnDegrees,
    headingDegrees: advanced.headingDegrees,
    position: advanced.position,
    targetId: target?.id ?? null,
    turnAccumulator: advanced.turnAccumulator,
    velocity: Object.freeze({
      x: Math.fround(advanced.direction.x * nextMovementSpeed),
      y: Math.fround(advanced.direction.y * nextMovementSpeed),
    }),
  })
}

export function createNativeWeldChannelActor(input: {
  readonly buildId: NativeWeldChannelBuildId
  readonly direction: Vector2
  readonly endpoint?: Vector2 | null
  readonly id: number
  readonly midpoint?: Vector2 | null
  readonly origin: Vector2
  readonly ownerId: string
  readonly targetId: string | null
  readonly tick: number
  readonly vector: readonly number[]
  readonly worldKey: string
}): NativeWeldChannelActorState {
  return Object.freeze({
    ageTicks: 0,
    birthTick: input.tick,
    buildId: input.buildId,
    direction: Object.freeze({ ...input.direction }),
    endpoint: input.endpoint ? Object.freeze({ ...input.endpoint }) : null,
    id: input.id,
    kind: 'weld-channel',
    lightRegistration: null,
    midpoint: input.midpoint ? Object.freeze({ ...input.midpoint }) : null,
    origin: Object.freeze({ ...input.origin }),
    ownerId: input.ownerId,
    targetId: input.targetId,
    variant: input.id % 4,
    vector: Object.freeze([...input.vector]),
    worldKey: input.worldKey,
  })
}

export function createNativeWeldPersistentActor(input: {
  readonly buildId: NativeWeldPersistentBuildId
  readonly direction: Vector2
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly registerLightProvider?: RegisterNativeLightProvider
  readonly tick: number
  readonly vector: readonly number[]
  readonly worldKey: string
}): NativeWeldPersistentActorState {
  const base = {
    ageTicks: 0,
    birthTick: input.tick,
    buildId: input.buildId,
    direction: Object.freeze({ ...input.direction }),
    id: input.id,
    kind: 'weld-persistent',
    origin: Object.freeze({ ...input.origin }),
    ownerId: input.ownerId,
    pulseSequence: 0,
    vector: Object.freeze([...input.vector]),
    worldKey: input.worldKey,
  } as const
  if (input.buildId === 1006) {
    return Object.freeze({
      ...base,
      assemblyScale: NATIVE_WELD_PERSISTENT_INITIAL_SCALE,
      buildId: 1006,
      damage: input.vector[0]!,
      flightTicks: 0,
      hitTargetIds: Object.freeze([]),
      lifetimeTicksRemaining: Math.floor(input.vector[3]! * 1_000 + 250),
      lightRegistration: weldActorLightRegistration(input),
      maximumScale: Math.fround(0.75),
      orientation: Object.freeze([
        ...EARTH_BOULDER_IDENTITY_ORIENTATION,
      ]) as EarthBoulderOrientation,
      phase: 'held',
      quantity: Math.max(1, Math.min(4, Math.round(input.vector[2]!))),
      remainingDamage: input.vector[0]!,
      scale: NATIVE_WELD_PERSISTENT_INITIAL_SCALE,
      speedFactor: input.vector[3]!,
      toughness: input.vector[4]!,
      velocity: Object.freeze({ x: 0, y: 0 }),
      visualScaleFactor: 1,
    })
  }
  if (input.buildId === 1008) {
    return Object.freeze({
      ...base,
      buildId: 1008,
      damage: input.vector[0]!,
      lightRegistration: weldActorLightRegistration(input),
      maximumScale: 1,
      phase: 'held',
      presentationScale: 1,
      pushback: input.vector[4]!,
      rocks: Object.freeze([]),
      scale: NATIVE_WELD_PERSISTENT_INITIAL_SCALE,
      toughness: input.vector[3]!,
      widen: input.vector[5]!,
    })
  }
  return Object.freeze({
    ...base,
    buildId: 1007,
    lightRegistration: null,
    phase: 'held',
  })
}

export function updateNativeWeldPersistentActor(
  actor: NativeWeldPersistentActorState,
  origin: Vector2,
  direction: Vector2,
  sourceRng: NativeRngState,
): { readonly actor: NativeWeldPersistentActorState; readonly rng: NativeRngState } {
  if (actor.buildId === 1006) {
    const growth = Math.fround(actor.vector[5]! * 1.5) * 0.0025
    const scale = Math.min(actor.maximumScale, Math.fround(actor.scale + growth))
    return {
      actor: Object.freeze({
        ...actor,
        ageTicks: actor.ageTicks + 1,
        assemblyScale: Math.floor(30 * scale) === Math.floor(30 * actor.scale)
          ? actor.assemblyScale
          : scale,
        buildId: 1006,
        direction: Object.freeze({ ...direction }),
        origin: Object.freeze({ ...origin }),
        orientation: Object.freeze(earthBoulderHeldOrientationStep(
          actor.orientation,
          direction,
        )),
        pulseSequence: actor.pulseSequence + 1,
        scale,
      }),
      rng: sourceRng,
    }
  }
  if (actor.buildId === 1008) {
    const oldBucket = Math.floor(30 * actor.scale)
    const growth = Math.fround(actor.vector[2]! * 2.5) * 0.0025 * 3
    const scale = Math.min(actor.maximumScale, Math.fround(actor.scale + growth))
    let rng = sourceRng
    let rocks = actor.rocks
    if (Math.floor(30 * scale) !== oldBucket) {
      const rebuilt = rebuildNativeWeldHailstonesRocks(actor, scale, rng)
      rocks = rebuilt.rocks
      rng = rebuilt.rng
    }
    return {
      actor: Object.freeze({
        ...actor,
        ageTicks: actor.ageTicks + 1,
        buildId: 1008,
        direction: Object.freeze({ ...direction }),
        origin: Object.freeze({ ...origin }),
        pulseSequence: actor.pulseSequence + 1,
        rocks,
        scale,
      }),
      rng,
    }
  }
  return {
    actor: Object.freeze({
      ...actor,
      ageTicks: actor.ageTicks + 1,
      buildId: 1007,
      direction: Object.freeze({ ...direction }),
      origin: Object.freeze({ ...origin }),
      pulseSequence: actor.pulseSequence + 1,
    }),
    rng: sourceRng,
  }
}

export function releaseNativeWeldPersistentActor(input: {
  readonly actor: NativeWeldPersistentActorState
  readonly firstChildId: number
  readonly registerLightProvider?: RegisterNativeLightProvider
  readonly rng: NativeRngState
}): {
  readonly actors: readonly NativeWeldPersistentActorState[]
  readonly nextId: number
  readonly rng: NativeRngState
} {
  const { actor } = input
  if (actor.buildId === 1007) {
    return { actors: Object.freeze([]), nextId: input.firstChildId, rng: input.rng }
  }
  if (actor.buildId === 1008) {
    const presentation = drawNativeFloat(input.rng, Math.fround(0.75))
    const carrierOrigin = Object.freeze({
      x: Math.fround(actor.origin.x - actor.direction.x * 10),
      y: Math.fround(actor.origin.y - actor.direction.y * 20),
    })
    const rocks = actor.rocks.map((rock) => Object.freeze({
      ...rock,
      damageRemaining: actor.damage,
      releaseOffset: Object.freeze({
        x: rock.localPosition.y,
        y: nativeWeldHailstoneReleaseHeight(rock.localPosition.z, rock.decay),
      }),
    }))
    return {
      actors: Object.freeze([Object.freeze({
        ...actor,
        direction: Object.freeze({ ...actor.direction }),
        origin: carrierOrigin,
        phase: 'flight',
        presentationScale: Math.fround(presentation.value + 0.75),
        rocks: Object.freeze(rocks),
      })]),
      nextId: input.firstChildId,
      rng: presentation.state,
    }
  }

  const split = nativeWeldEtherealBoulderSplit(actor)
  return {
    actors: Object.freeze(split.map((piece, index) => Object.freeze({
      ...actor,
      direction: piece.direction,
      hitTargetIds: Object.freeze([]),
      id: index === 0 ? actor.id : input.firstChildId + index - 1,
      lightRegistration: index === 0
        ? actor.lightRegistration
        : input.registerLightProvider?.('actor') ?? Object.freeze({
            managerLane: 'actor',
            registrationOrdinal: input.firstChildId + index - 1,
          }),
      lifetimeTicksRemaining: Math.floor(piece.speedFactor * 1_000 + 250),
      origin: piece.origin,
      phase: 'flight',
      flightTicks: 0,
      pulseSequence: actor.pulseSequence + 1,
      quantity: 0,
      remainingDamage: nativeEarthBoulderReleasedDamage(actor.damage, actor.scale),
      speedFactor: piece.speedFactor,
      velocity: Object.freeze({
        x: Math.fround(piece.direction.x * 3 * piece.speedFactor),
        y: Math.fround(piece.direction.y * 3 * piece.speedFactor),
      }),
      visualScaleFactor: piece.visualScaleFactor,
    }))),
    nextId: input.firstChildId + split.length - 1,
    rng: input.rng,
  }
}

export function retainNativeWeldPersistentActorContacts(
  actor: NativeWeldEtherealBoulderState,
  hitTargetIds: readonly string[],
  remainingDamage: number,
): NativeWeldEtherealBoulderState | null {
  if (remainingDamage < 0.001) return null
  return Object.freeze({
    ...actor,
    hitTargetIds: Object.freeze([...hitTargetIds]),
    remainingDamage,
  })
}

export function retainNativeWeldHailstoneDamage(
  actor: NativeWeldHailstonesState,
  damageByIndex: readonly number[],
): NativeWeldHailstonesState | null {
  const rocks = actor.rocks.flatMap((rock, index) => {
    const damageRemaining = damageByIndex[index] ?? rock.damageRemaining
    return damageRemaining < 0.001
      ? []
      : [Object.freeze({ ...rock, damageRemaining })]
  })
  return rocks.length === 0 ? null : Object.freeze({ ...actor, rocks: Object.freeze(rocks) })
}

export function createNativeWeldMeteor(input: {
  readonly damage: number
  readonly direction: Vector2
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly presentationPhase: number
  readonly privateSeed: number
  readonly registerLightProvider?: RegisterNativeLightProvider
  readonly tick: number
  readonly vector: readonly number[]
  readonly worldKey: string
}): NativeWeldMeteorActorState {
  return Object.freeze({
    ageTicks: 0,
    birthTick: input.tick,
    buildId: 1007,
    damage: input.damage,
    direction: Object.freeze({ ...input.direction }),
    fallScalar: Math.fround(1 - input.presentationPhase),
    id: input.id,
    impactDue: false,
    impactTicksRemaining: NATIVE_WELD_METEOR_IMPACT_TICKS,
    kind: 'weld-meteor',
    lightRegistration: input.registerLightProvider?.('actor') ?? Object.freeze({
      managerLane: 'actor',
      registrationOrdinal: input.id,
    }),
    origin: Object.freeze({ ...input.origin }),
    ownerId: input.ownerId,
    position: Object.freeze({ ...input.origin }),
    presentationPhase: input.presentationPhase,
    privateSeed: input.privateSeed,
    phase: 'fall',
    pulseDue: false,
    pulseSequence: 0,
    pulseTicksRemaining: NATIVE_WELD_METEOR_PULSE_TICKS,
    vector: Object.freeze([...input.vector]),
    worldKey: input.worldKey,
  })
}

export function stepNativeWeldWorldActor(
  actor: NativeWeldWorldActor,
  canAdvance: (
    actor: NativeWeldPersistentActorState,
    from: Readonly<Vector2>,
    to: Readonly<Vector2>,
  ) => boolean = () => true,
): NativeWeldWorldActor | null {
  if (actor.kind === 'weld-channel') {
    return actor.ageTicks + 1 < NATIVE_WELD_CHANNEL_VISIBLE_TICKS
      ? Object.freeze({ ...actor, ageTicks: actor.ageTicks + 1 })
      : null
  }
  if (actor.kind === 'weld-impact') {
    return actor.ageTicks + 1 < NATIVE_WELD_IMPACT_VISIBLE_TICKS
      ? Object.freeze({ ...actor, ageTicks: actor.ageTicks + 1 })
      : null
  }
  if (actor.kind === 'weld-meteor') {
    if (actor.phase === 'fall') {
      const fallScalar = Math.fround(actor.fallScalar - NATIVE_WELD_METEOR_FALL_STEP)
      return fallScalar > 0
        ? Object.freeze({
            ...actor,
            ageTicks: actor.ageTicks + 1,
            fallScalar,
          })
        : Object.freeze({
            ...actor,
            ageTicks: actor.ageTicks + 1,
            fallScalar,
            impactDue: true,
            phase: 'impact',
          })
    }
    const impactTicksRemaining = actor.impactTicksRemaining - 1
    if (impactTicksRemaining <= 0) return null
    const pulseTicksRemaining = actor.pulseTicksRemaining - 1
    const pulseDue = pulseTicksRemaining === 0
    return Object.freeze({
      ...actor,
      ageTicks: actor.ageTicks + 1,
      impactDue: false,
      impactTicksRemaining,
      pulseDue,
      pulseSequence: pulseDue ? actor.pulseSequence + 1 : actor.pulseSequence,
      pulseTicksRemaining: pulseDue
        ? NATIVE_WELD_METEOR_PULSE_TICKS
        : pulseTicksRemaining,
    })
  }
  if (actor.phase === 'held') return actor
  if (actor.buildId === 1006) {
    const lifetimeTicksRemaining = actor.lifetimeTicksRemaining - 1
    if (lifetimeTicksRemaining <= 0) return null
    const origin = Object.freeze({
      x: Math.fround(actor.origin.x + actor.velocity.x),
      y: Math.fround(actor.origin.y + actor.velocity.y),
    })
    if (!canAdvance(actor, actor.origin, origin)) return null
    return Object.freeze({
      ...actor,
      ageTicks: actor.ageTicks + 1,
      flightTicks: actor.flightTicks + 1,
      lifetimeTicksRemaining,
      origin,
      orientation: Object.freeze(earthBoulderFlightOrientationStep(
        actor.orientation,
        actor.direction,
        actor.velocity,
        actor.scale,
      )),
    })
  }
  const lookahead = Object.freeze({
    x: Math.fround(actor.origin.x + actor.direction.x * NATIVE_WELD_HAILSTONES_LOOKAHEAD),
    y: Math.fround(actor.origin.y + actor.direction.y * NATIVE_WELD_HAILSTONES_LOOKAHEAD),
  })
  if (!canAdvance(actor, actor.origin, lookahead)) return null
  const origin = Object.freeze({
    x: Math.fround(actor.origin.x + actor.direction.x * NATIVE_WELD_HAILSTONES_SPEED),
    y: Math.fround(actor.origin.y + actor.direction.y * NATIVE_WELD_HAILSTONES_SPEED),
  })
  return Object.freeze({
    ...actor,
    ageTicks: actor.ageTicks + 1,
    origin,
    rocks: Object.freeze(actor.rocks.map((rock) => Object.freeze({
      ...rock,
      decay: Math.fround(rock.decay * Math.fround(0.95)),
      phase: Math.min(1, Math.fround(rock.phase + Math.fround(0.025))),
    }))),
  })
}

export function drawNativeWeldDamage(
  source: NativeRngState,
  minimum: number,
  maximum: number,
): { readonly rng: NativeRngState; readonly value: number } {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) {
    throw new RangeError('weld damage endpoints must be finite and ordered')
  }
  if (minimum === maximum) return { rng: source, value: minimum }
  const draw = drawNativeFloat(source, Math.fround(maximum - minimum))
  return {
    rng: draw.state,
    value: Math.fround(Math.fround(minimum) + draw.value),
  }
}

export function nativeWeldMissileFanHeading(
  aimHeading: number,
  quantity: number,
  index: number,
): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError('weld missile quantity must be a positive safe integer')
  }
  if (!Number.isSafeInteger(index) || index < 0 || index >= quantity) {
    throw new RangeError('weld missile index is outside the fan')
  }
  const step = quantity < 4 ? 30 : 20
  const base = aimHeading + (quantity % 2 === 0 ? step / 2 : 0)
  const offset = index === 0
    ? 0
    : (index % 2 === 0 ? 1 : -1) * Math.ceil(index / 2) * step
  return normalizeDegrees(base + offset)
}

export function isOneShotBuild(buildId: NativeWeldBuildId): buildId is NativeWeldOneShotBuildId {
  return buildId === 1000 || buildId === 1001 || buildId === 1002 || buildId === 1009
}

export function isChannelBuild(buildId: NativeWeldBuildId): buildId is NativeWeldChannelBuildId {
  return buildId === 1003 || buildId === 1004 || buildId === 1005
}

export function isPersistentBuild(
  buildId: NativeWeldBuildId,
): buildId is NativeWeldPersistentBuildId {
  return buildId === 1006 || buildId === 1007 || buildId === 1008
}

function plan(
  buildId: NativeWeldBuildId,
  cue: NativeWeldCastCue,
  audio: {
    readonly loops?: readonly number[]
    readonly sounds?: readonly number[]
    readonly soundVariants?: readonly number[]
  } = {},
): NativeWeldAudioPlan {
  const nativeLoopIds = Object.freeze([...(audio.loops ?? [])])
  return Object.freeze({
    buildId,
    cue,
    loop: nativeLoopIds.length > 0,
    nativeLoopIds,
    nativeSoundIds: Object.freeze([...(audio.sounds ?? [])]),
    nativeSoundVariantIds: Object.freeze([...(audio.soundVariants ?? [])]),
  })
}

function underpoweredWeldVector(
  buildId: NativeWeldOneShotBuildId,
  source: readonly number[],
  underpowered: boolean,
): readonly number[] {
  if (!underpowered) return Object.freeze([...source])
  const values = [...source]
  switch (buildId) {
    case 1000:
      values[3] = 1
      values[4] = Math.fround(0.8)
      values[5] = 0
      values[6] = 0
      values[7] = 0
      values[8] = 0
      break
    case 1001:
      values[3] = 1
      values[4] = Math.fround(0.8)
      values[5] = 0
      values[6] = 0
      break
    case 1002:
      values[3] = 1
      values[4] = Math.fround(0.8)
      values[5] = 0
      values[6] = 1
      break
    case 1009:
      values[2] = 0
      values[3] = 1
      values[4] = 0
      break
  }
  return Object.freeze(values)
}

function weldActorLightRegistration(input: {
  readonly id: number
  readonly registerLightProvider?: RegisterNativeLightProvider
}): NativeLightProviderRegistration {
  return input.registerLightProvider?.('actor') ?? Object.freeze({
    managerLane: 'actor',
    registrationOrdinal: input.id,
  })
}

function nativeBallLightningMovementSpeed(
  baseSpeed: number,
  acceleration: number,
): number {
  return Math.min(
    NATIVE_WELD_BALL_LIGHTNING_SPEED_CAP,
    Math.fround(Math.fround(acceleration + 1) * baseSpeed),
  )
}

/** Private GroundSpark xorshift/multiply word, including native signed abs. */
export function nativeGroundSparkPrivateWord(source: number): number {
  let value = (source ^ (source << 21)) >>> 0
  value = (value ^ (value >>> 11)) >>> 0
  value = Math.imul((value ^ (value << 4)) >>> 0, NATIVE_WELD_GROUND_SPARK_PRIVATE_MULTIPLIER) >>> 0
  return Math.abs(value | 0) >>> 0
}

function signedHeadingDelta(current: number, next: number): number {
  return ((next - current + 540) % 360) - 180
}

function rebuildNativeWeldHailstonesRocks(
  actor: NativeWeldHailstonesState,
  scale: number,
  sourceRng: NativeRngState,
): {
  readonly rng: NativeRngState
  readonly rocks: readonly NativeWeldHailstoneRockState[]
} {
  const desiredCount = Math.floor(Math.max(
    1,
    Math.fround(Math.fround(Math.fround(actor.pushback * 3 + 20) * scale) * scale),
  ))
  if (desiredCount <= actor.rocks.length) {
    return { rng: sourceRng, rocks: actor.rocks }
  }
  let rng = sourceRng
  const rocks = [...actor.rocks]
  while (rocks.length < desiredCount) {
    const sprite = drawNativeInteger(rng, 3)
    rng = sprite.state
    const x = drawNativeFloat(rng, 50, true)
    rng = x.state
    const y = drawNativeFloat(rng, 50, true)
    rng = y.state
    const z = drawNativeFloat(rng, 50, true)
    rng = z.state
    const length = Math.hypot(x.value, y.value, z.value)
    const unit = length > 0
      ? { x: x.value / length, y: y.value / length, z: z.value / length }
      : { x: 0, y: 0, z: 0 }
    let radialScale = 40
    if (rocks.length === 0) {
      const radial = drawNativeFloat(rng, 10)
      rng = radial.state
      radialScale = radial.value
    }
    const visual = drawNativeFloat(rng, Math.fround(0.75))
    rng = visual.state
    rocks.push(Object.freeze({
      damageRemaining: 0,
      decay: 1,
      localPosition: Object.freeze({
        x: Math.fround(unit.x * radialScale),
        y: Math.fround(unit.y * radialScale),
        z: Math.fround(unit.z * radialScale),
      }),
      phase: 0,
      releaseOffset: null,
      spriteRecord: (168 + sprite.value) as 168 | 169 | 170,
      visualScale: Math.min(1, Math.fround(Math.fround(visual.value + 0.5) * 0.2)),
    }))
  }
  return { rng, rocks: Object.freeze(rocks) }
}

function nativeWeldHailstoneReleaseHeight(z: number, decay: number): number {
  const fallingHeight = Math.fround(50 - z * 2.5)
  return Math.fround(z + Math.fround(fallingHeight - z) * decay)
}

function nativeWeldEtherealBoulderSplit(
  actor: NativeWeldEtherealBoulderState,
): readonly Readonly<{
  direction: Vector2
  origin: Vector2
  speedFactor: number
  visualScaleFactor: number
}>[] {
  const direction = actor.direction
  const perpendicular = Object.freeze({ x: direction.y, y: -direction.x })
  const heading = actorHeadingFromVector(direction.x, direction.y)
  const piece = (
    along: number,
    across: number,
    headingOffset: number,
    speedFactor: number,
    visualScaleFactor: number,
  ) => Object.freeze({
    direction: Object.freeze(directionFromHeading(heading + headingOffset)),
    origin: Object.freeze({
      x: Math.fround(actor.origin.x + direction.x * along + perpendicular.x * across),
      y: Math.fround(actor.origin.y + direction.y * along + perpendicular.y * across),
    }),
    speedFactor: Math.fround(speedFactor),
    visualScaleFactor: Math.fround(visualScaleFactor),
  })
  switch (actor.quantity) {
    case 1:
      return Object.freeze([piece(0, 0, 0, actor.speedFactor, 0.75)])
    case 2:
      return Object.freeze([
        piece(0, 30, 0, actor.speedFactor, 0.75),
        piece(0, -30, 10, 1, 0.75),
      ])
    case 3:
      return Object.freeze([
        piece(30, 0, 0, actor.speedFactor, 0.75),
        piece(0, 30, -10, 0.95, 0.7125),
        piece(0, -30, 10, 0.95, 0.7125),
      ])
    case 4:
      return Object.freeze([
        piece(30, 0, 0, actor.speedFactor, 0.75),
        piece(0, 30, -10, 0.95, 0.7125),
        piece(0, -30, 10, 0.95, 0.7125),
        piece(-15, 0, 0, 0.9, 0.675),
      ])
  }
  throw new RangeError(`native Ethereal Boulder quantity ${actor.quantity} is outside 1..4`)
}

function normalizeDegrees(value: number): number {
  return Math.fround(((value % 360) + 360) % 360)
}
