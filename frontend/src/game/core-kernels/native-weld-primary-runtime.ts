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
import {
  createNativeWeldMeteorImpactProgram,
  type NativeWeldMeteorDebrisSeed,
  type NativeWeldMeteorMarkerState,
  stepNativeWeldMeteorMarker,
} from './native-weld-meteor.ts'
import {
  createNativeWeldBoulderDebrisParticle,
  createNativeWeldEtherealBoulderWeakDebrisProgram,
  stepNativeWeldBoulderDebrisParticle,
  type NativeWeldBoulderDebrisParticleState,
} from './native-weld-boulder-debris.ts'
import type { NativeWeldGroundSparkFadeSeed } from './native-weld-ground-spark.ts'
import {
  stepNativeWeldSteamActor,
  type NativeWeldSteamActorState,
} from './native-weld-steam.ts'
import {
  NATIVE_WELD_HAIL_FLIGHT_SUBSTEPS,
  NATIVE_WELD_HAIL_LOOKAHEAD_DISTANCE,
  NATIVE_WELD_HAIL_SUBSTEP_DISTANCE,
  stepNativeWeldHailChild,
  type NativeWeldHailChildActorState,
} from './native-weld-hail-contact.ts'
import {
  stepNativeWeldFlameLashFade,
  type NativeWeldFlameLashFadeState,
} from './native-weld-flame-lash.ts'
import type { NativeWeldBlizzardGlowState } from './native-weld-blizzard.ts'

export {
  NATIVE_WELD_HAIL_TARGET_RADIUS_FACTOR as NATIVE_WELD_HAILSTONES_TARGET_RADIUS_FACTOR,
} from './native-weld-hail-contact.ts'

export type NativeWeldOneShotBuildId = 1000 | 1001 | 1002 | 1009
export type NativeWeldChannelBuildId = 1003 | 1004 | 1005
export type NativeWeldBeamBuildId = 1003 | 1004
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
  readonly frostPresentationLanes: readonly [
    NativeWeldFrostPresentationLane,
    NativeWeldFrostPresentationLane,
  ] | null
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

export interface NativeWeldFrostPresentationLane {
  readonly aspect: number
  readonly rotationDegrees: number
  readonly scale: number
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
  readonly buildId: NativeWeldBeamBuildId
  readonly endpoint: Vector2 | null
  readonly kind: 'weld-channel'
  readonly lightRegistration: null
  readonly midpoint: Vector2 | null
  readonly targetId: string | null
  readonly underpowered: boolean
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
  readonly shellScale: number
  readonly speedFactor: number
  readonly toughness: number
  readonly velocity: Vector2
}

export interface NativeWeldHailstoneRockState {
  readonly damageRemaining: number
  readonly decay: number
  readonly localPosition: Readonly<{ x: number; y: number; z: number }>
  readonly phase: number
  readonly rockId: number
  /** Fixed release collision offset; widening changes it, draw decay does not. */
  readonly releaseOffset: Vector2 | null
  readonly spriteRecord: 168 | 169 | 170
  readonly visualScale: number
}

export interface NativeWeldHailstonesState extends NativeWeldPersistentActorBase {
  readonly buildId: 1008
  readonly collisionRadius: number
  readonly damage: number
  readonly lightRegistration: NativeLightProviderRegistration
  readonly maximumScale: number
  readonly phase: 'flight' | 'held'
  readonly pushback: number
  readonly releaseAgeTicks: number | null
  readonly releaseFadeScale: number | null
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
  readonly bodyScale: number
  readonly buildId: 1007
  readonly cameraDisplacement: Vector2 | null
  readonly damage: number
  readonly debris: readonly NativeWeldMeteorDebrisSeed[]
  readonly fallHeadingDegrees: number
  readonly fallHeight: number
  readonly fallStep: number
  readonly impactDue: boolean
  readonly impactAgeTicks: number
  readonly impactRadiusScalar: number
  readonly impactRotationDegrees: number
  readonly impactSoundPitch: number | null
  readonly impactThrowFirePitch: number | null
  readonly impactTicksRemaining: number
  readonly kind: 'weld-meteor'
  readonly lightRegistration: NativeLightProviderRegistration
  readonly phase: 'fall' | 'impact'
  readonly position: Vector2
  readonly privateSeed: number
  readonly pulseDue: boolean
  readonly pulseSequence: number
  readonly pulseTicksRemaining: number
  readonly underpowered: boolean
}

export interface NativeWeldMeteorFlashActorState extends NativeWeldOwnedActorBase {
  readonly alpha: number
  readonly alphaStep: number
  readonly buildId: 1007
  readonly kind: 'weld-meteor-flash'
  readonly lightRegistration: null
  readonly position: Vector2
  readonly record: 15
  readonly scale: number
}

export interface NativeWeldImpactActorState extends NativeWeldOwnedActorBase {
  readonly alpha: number
  readonly boulderTerminalCharge: number | null
  readonly buildId: NativeWeldOneShotBuildId | NativeWeldPersistentBuildId
  readonly impactSoundPitch: number | null
  readonly impactSoundVariant: number | null
  readonly kind: 'weld-impact'
  readonly lightRegistration: NativeLightProviderRegistration | null
  readonly position: Vector2
  readonly presentationRotationDegrees: number | null
  readonly presentationScale: number
}

export interface NativeWeldBoulderDebrisActorState extends NativeWeldOwnedActorBase {
  readonly buildId: 1006 | 1007
  readonly debris: NativeWeldBoulderDebrisParticleState
  readonly kind: 'weld-boulder-debris'
  readonly lightRegistration: null
  readonly position: Vector2
}

export interface NativeWeldHailRockFadeActorState extends NativeWeldOwnedActorBase {
  readonly buildId: 1008
  readonly kind: 'weld-hail-rock-fade'
  readonly lightRegistration: null
  readonly position: Vector2
  readonly rotationDegrees: number
}

export interface NativeWeldFrostFadeActorState extends NativeWeldOwnedActorBase {
  readonly buildId: 1008
  readonly kind: 'weld-frost-fade'
  readonly lightRegistration: null
  readonly position: Vector2
  readonly scale: number
}

export interface NativeWeldGroundSparkFadeActorState extends NativeWeldOwnedActorBase {
  readonly alpha: number
  readonly alphaStep: number
  readonly buildId: 1009
  readonly kind: 'weld-ground-spark-fade'
  readonly lightRegistration: null
  readonly position: Vector2
  readonly record: 71 | 1836 | 1837 | 1838 | 1839
  readonly rotationDegrees: number
  readonly scale: number
}

export type NativeWeldWorldActor =
  | NativeWeldBlizzardGlowState
  | NativeWeldBoulderDebrisActorState
  | NativeWeldChannelActorState
  | NativeWeldFlameLashFadeState
  | NativeWeldFrostFadeActorState
  | NativeWeldGroundSparkFadeActorState
  | NativeWeldHailRockFadeActorState
  | NativeWeldImpactActorState
  | NativeWeldMeteorActorState
  | NativeWeldMeteorFlashActorState
  | NativeWeldMeteorMarkerState
  | NativeWeldPersistentActorState
  | NativeWeldSteamActorState
  | NativeWeldHailChildActorState

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

export const NATIVE_WELD_CHANNEL_VISIBLE_TICKS = 2
export const NATIVE_WELD_IMPACT_VISIBLE_TICKS = 20
export const NATIVE_WELD_METEOR_CADENCE_TICKS = 25
export const NATIVE_WELD_METEOR_FALL_STEP = Math.fround(0.02)
export const NATIVE_WELD_METEOR_IMPACT_TICKS = 200
export const NATIVE_WELD_METEOR_PULSE_TICKS = 10
export const NATIVE_WELD_PERSISTENT_INITIAL_SCALE = Math.fround(0.18)
export const NATIVE_WELD_HAILSTONES_SPEED = NATIVE_WELD_HAIL_SUBSTEP_DISTANCE
export const NATIVE_WELD_HAILSTONES_LOOKAHEAD = NATIVE_WELD_HAIL_LOOKAHEAD_DISTANCE
export const NATIVE_WELD_HAIL_ROCK_FADE_LIFETIME_TICKS = 400
export const NATIVE_WELD_HAIL_RELEASE_FADE_LIFETIME_TICKS = 20

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
      frostPresentationLanes: profile.buildId === 1001
        ? Object.freeze([
            Object.freeze({ aspect: 0, rotationDegrees: 0, scale: 0 }),
            Object.freeze({
              aspect: frostPulseAspect!,
              rotationDegrees: secondaryPresentationPhaseDegrees!,
              scale: 0,
            }),
          ] as const)
        : null,
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

export function stepNativeWeldProjectilePresentation(
  projectile: NativeWeldProjectileState,
  sourceRng: NativeRngState,
): {
  readonly projectile: NativeWeldProjectileState
  readonly rng: NativeRngState
} {
  if (projectile.buildId !== 1001) return { projectile, rng: sourceRng }
  let rng = sourceRng
  const lanes = projectile.frostPresentationLanes!.map((lane) => {
    let scale = Math.fround(lane.scale - Math.fround(0.01))
    let aspect = lane.aspect
    let rotationDegrees = lane.rotationDegrees
    if (scale < Math.fround(0.1)) {
      const nextAspect = drawNativeFloat(rng, Math.fround(0.25)); rng = nextAspect.state
      const nextScale = drawNativeFloat(rng, Math.fround(0.75)); rng = nextScale.state
      const nextRotation = drawNativeFloat(rng, 45); rng = nextRotation.state
      aspect = Math.fround(nextAspect.value + 0.5)
      scale = Math.fround(nextScale.value + 0.5)
      rotationDegrees = nextRotation.value
    }
    return Object.freeze({ aspect, rotationDegrees, scale })
  }) as unknown as readonly [
    NativeWeldFrostPresentationLane,
    NativeWeldFrostPresentationLane,
  ]
  return {
    projectile: Object.freeze({
      ...projectile,
      frostPresentationLanes: Object.freeze(lanes),
    }),
    rng,
  }
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
  readonly buildId: NativeWeldBeamBuildId
  readonly direction: Vector2
  readonly endpoint?: Vector2 | null
  readonly id: number
  readonly midpoint?: Vector2 | null
  readonly origin: Vector2
  readonly ownerId: string
  readonly targetId: string | null
  readonly tick: number
  readonly underpowered: boolean
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
    underpowered: input.underpowered,
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
      maximumScale: Math.fround(input.vector[4]! * 0.75),
      orientation: Object.freeze([
        ...EARTH_BOULDER_IDENTITY_ORIENTATION,
      ]) as EarthBoulderOrientation,
      phase: 'held',
      quantity: Math.max(1, Math.min(4, Math.round(input.vector[2]!))),
      remainingDamage: input.vector[0]!,
      scale: NATIVE_WELD_PERSISTENT_INITIAL_SCALE,
      shellScale: NATIVE_WELD_PERSISTENT_INITIAL_SCALE,
      speedFactor: input.vector[3]!,
      toughness: input.vector[4]!,
      velocity: Object.freeze({ x: 0, y: 0 }),
    })
  }
  if (input.buildId === 1008) {
    return Object.freeze({
      ...base,
      buildId: 1008,
      collisionRadius: 40,
      damage: input.vector[0]!,
      lightRegistration: weldActorLightRegistration(input),
      maximumScale: input.vector[3]!,
      phase: 'held',
      pushback: input.vector[4]!,
      releaseAgeTicks: null,
      releaseFadeScale: null,
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
  options: {
    readonly castProgressFactor?: number
    readonly enhancedEffects?: boolean
    readonly underpowered?: boolean
  } = {},
): {
  readonly actor: NativeWeldPersistentActorState
  readonly debris: readonly NativeWeldMeteorDebrisSeed[]
  readonly hailRockFades: readonly Readonly<{
    readonly position: Vector2
    readonly rotationDegrees: number
  }>[]
  readonly releaseRequested: boolean
  readonly rng: NativeRngState
} {
  const castProgressFactor = options.castProgressFactor ?? 1
  const enhancedEffects = options.enhancedEffects ?? true
  const underpowered = options.underpowered ?? false
  if (!Number.isFinite(castProgressFactor) || castProgressFactor <= 0) {
    throw new RangeError('weld cast progress factor must be finite and positive')
  }
  if (actor.buildId === 1006) {
    const debrisProgram = underpowered && actor.quantity > 1
      ? createNativeWeldEtherealBoulderWeakDebrisProgram({
          direction: actor.direction,
          rng: sourceRng,
          scale: actor.scale,
        })
      : { debris: Object.freeze([]), rng: sourceRng }
    const growthInput = underpowered
      ? 1
      : Math.fround(actor.vector[5]! * castProgressFactor)
    const growth = Math.fround(Math.fround(growthInput * 0.0025) * 3)
    const scale = Math.min(actor.maximumScale, Math.fround(actor.scale + growth))
    const assemblyScale = Math.floor(30 * scale) === Math.floor(30 * actor.scale)
      ? actor.assemblyScale
      : scale
    return {
      actor: Object.freeze({
        ...actor,
        ageTicks: actor.ageTicks + 1,
        assemblyScale,
        buildId: 1006,
        direction: Object.freeze({ ...direction }),
        damage: underpowered ? Math.fround(actor.vector[0]! * 0.5) : actor.damage,
        origin: Object.freeze({ ...origin }),
        orientation: Object.freeze(earthBoulderHeldOrientationStep(
          actor.orientation,
          direction,
        )),
        pulseSequence: actor.pulseSequence + 1,
        quantity: underpowered ? 1 : actor.quantity,
        remainingDamage: underpowered
          ? Math.fround(actor.remainingDamage * 0.5)
          : actor.remainingDamage,
        scale,
        shellScale: assemblyScale,
        speedFactor: underpowered ? 1 : actor.speedFactor,
      }),
      debris: debrisProgram.debris,
      hailRockFades: Object.freeze([]),
      releaseRequested: underpowered && actor.scale > Math.fround(0.3),
      rng: debrisProgram.rng,
    }
  }
  if (actor.buildId === 1008) {
    const oldBucket = roundHalfToEven(Math.fround(30 * actor.scale))
    const growthInput = underpowered && actor.scale > Math.fround(0.3)
      ? 0
      : Math.fround(Math.fround(actor.vector[2]! * castProgressFactor) * 0.5)
    const growth = Math.fround(Math.fround(growthInput * 0.0025) * 3)
    const scale = Math.min(actor.maximumScale, Math.fround(actor.scale + growth))
    let rng = sourceRng
    let rocks = actor.rocks
    let hailRockFades: readonly Readonly<{
      readonly position: Vector2
      readonly rotationDegrees: number
    }>[] = Object.freeze([])
    if (roundHalfToEven(Math.fround(30 * scale)) !== oldBucket) {
      const rebuilt = rebuildNativeWeldHailstonesRocks(
        actor,
        origin,
        scale,
        rng,
        enhancedEffects,
      )
      rocks = rebuilt.rocks
      hailRockFades = rebuilt.hailRockFades
      rng = rebuilt.rng
    }
    return {
      actor: Object.freeze({
        ...actor,
        ageTicks: actor.ageTicks + 1,
        buildId: 1008,
        damage: underpowered ? Math.fround(actor.vector[0]! * 0.5) : actor.damage,
        direction: Object.freeze({ ...direction }),
        origin: Object.freeze({ ...origin }),
        pulseSequence: actor.pulseSequence + 1,
        pushback: underpowered ? 0 : actor.vector[4]!,
        rocks,
        scale,
        widen: underpowered ? 0 : actor.vector[5]!,
      }),
      debris: Object.freeze([]),
      hailRockFades,
      releaseRequested: false,
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
    debris: Object.freeze([]),
    hailRockFades: Object.freeze([]),
    releaseRequested: false,
    rng: sourceRng,
  }
}

export function createNativeWeldBoulderDebrisActor(input: {
  readonly buildId: 1006 | 1007
  readonly debris: NativeWeldMeteorDebrisSeed
  readonly direction: Vector2
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly tick: number
  readonly vector: readonly number[]
  readonly worldKey: string
}): NativeWeldBoulderDebrisActorState {
  return Object.freeze({
    ageTicks: 0,
    birthTick: input.tick,
    buildId: input.buildId,
    debris: createNativeWeldBoulderDebrisParticle(input.debris),
    direction: Object.freeze({ ...input.direction }),
    id: input.id,
    kind: 'weld-boulder-debris',
    lightRegistration: null,
    origin: Object.freeze({ ...input.origin }),
    ownerId: input.ownerId,
    position: Object.freeze({ ...input.origin }),
    vector: Object.freeze([...input.vector]),
    worldKey: input.worldKey,
  })
}

export function createNativeWeldHailRockFadeActor(input: {
  readonly direction: Vector2
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly position: Vector2
  readonly rotationDegrees: number
  readonly tick: number
  readonly vector: readonly number[]
  readonly worldKey: string
}): NativeWeldHailRockFadeActorState {
  return Object.freeze({
    ageTicks: 0,
    birthTick: input.tick,
    buildId: 1008,
    direction: Object.freeze({ ...input.direction }),
    id: input.id,
    kind: 'weld-hail-rock-fade',
    lightRegistration: null,
    origin: Object.freeze({ ...input.origin }),
    ownerId: input.ownerId,
    position: Object.freeze({ ...input.position }),
    rotationDegrees: input.rotationDegrees,
    vector: Object.freeze([...input.vector]),
    worldKey: input.worldKey,
  })
}

export function createNativeWeldGroundSparkFadeActor(input: {
  readonly direction: Vector2
  readonly id: number
  readonly ownerId: string
  readonly seed: NativeWeldGroundSparkFadeSeed
  readonly tick: number
  readonly vector: readonly number[]
  readonly worldKey: string
}): NativeWeldGroundSparkFadeActorState {
  return Object.freeze({
    ageTicks: 0,
    alpha: input.seed.alpha,
    alphaStep: input.seed.alphaStep,
    birthTick: input.tick,
    buildId: 1009,
    direction: Object.freeze({ ...input.direction }),
    id: input.id,
    kind: 'weld-ground-spark-fade',
    lightRegistration: null,
    origin: Object.freeze({ ...input.seed.position }),
    ownerId: input.ownerId,
    position: Object.freeze({ ...input.seed.position }),
    record: input.seed.record,
    rotationDegrees: input.seed.rotationDegrees,
    scale: input.seed.scale,
    vector: Object.freeze([...input.vector]),
    worldKey: input.worldKey,
  })
}

export function releaseNativeWeldPersistentActor(input: {
  readonly actor: NativeWeldPersistentActorState
  readonly firstChildId: number
  readonly registerLightProvider?: RegisterNativeLightProvider
  readonly rng: NativeRngState
  readonly tick: number
}): {
  readonly actors: readonly NativeWeldWorldActor[]
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
      x: Math.fround(actor.origin.x - actor.direction.x * 20),
      y: Math.fround(actor.origin.y - actor.direction.y * 20),
    })
    const rocks = actor.rocks.map((rock) => Object.freeze({
      ...rock,
      damageRemaining: actor.damage,
      releaseOffset: Object.freeze({
        x: rock.localPosition.x,
        y: nativeWeldHailstoneReleaseHeight(
          rock.localPosition.y,
          rock.localPosition.z,
          rock.decay,
        ),
      }),
    }))
    return {
      actors: Object.freeze([Object.freeze({
        ...actor,
        direction: Object.freeze({ ...actor.direction }),
        origin: carrierOrigin,
        phase: 'flight',
        releaseAgeTicks: 0,
        releaseFadeScale: Math.fround(presentation.value + 0.75),
        rocks: Object.freeze(rocks),
      }), Object.freeze({
        ageTicks: 0,
        birthTick: input.tick,
        buildId: 1008,
        direction: Object.freeze({ ...actor.direction }),
        id: input.firstChildId,
        kind: 'weld-frost-fade',
        lightRegistration: null,
        origin: carrierOrigin,
        ownerId: actor.ownerId,
        position: Object.freeze({
          x: carrierOrigin.x,
          y: Math.fround(carrierOrigin.y - 20),
        }),
        scale: Math.fround(Math.fround(presentation.value + 0.75) * 5),
        vector: Object.freeze([...actor.vector]),
        worldKey: actor.worldKey,
      })]),
      nextId: input.firstChildId + 1,
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
      maximumScale: actor.scale,
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
    }))),
    nextId: input.firstChildId + split.length - 1,
    rng: input.rng,
  }
}

export function retainNativeWeldPersistentActorContacts(
  actor: NativeWeldEtherealBoulderState,
  hitTargetIds: readonly string[],
  remainingDamage: number,
  scale: number,
): NativeWeldEtherealBoulderState | null {
  if (remainingDamage <= 0) return null
  return Object.freeze({
    ...actor,
    hitTargetIds: Object.freeze([...hitTargetIds]),
    remainingDamage,
    scale,
    shellScale: scale,
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
  readonly bodyScale: number
  readonly cameraDisplacement?: null
  readonly damage: number
  readonly direction: Vector2
  readonly fallHeadingDegrees: number
  readonly fallHeight: number
  readonly fallStep: number
  readonly id: number
  readonly impactTicks: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly position: Vector2
  readonly privateSeed: number
  readonly registerLightProvider?: RegisterNativeLightProvider
  readonly tick: number
  readonly underpowered: boolean
  readonly vector: readonly number[]
  readonly worldKey: string
}): NativeWeldMeteorActorState {
  return Object.freeze({
    ageTicks: 0,
    birthTick: input.tick,
    bodyScale: input.bodyScale,
    buildId: 1007,
    cameraDisplacement: null,
    damage: input.damage,
    debris: Object.freeze([]),
    direction: Object.freeze({ ...input.direction }),
    fallHeadingDegrees: input.fallHeadingDegrees,
    fallHeight: input.fallHeight,
    fallStep: input.fallStep,
    id: input.id,
    impactDue: false,
    impactAgeTicks: 0,
    impactRadiusScalar: 1,
    impactRotationDegrees: 0,
    impactSoundPitch: null,
    impactThrowFirePitch: null,
    impactTicksRemaining: input.impactTicks,
    kind: 'weld-meteor',
    lightRegistration: input.registerLightProvider?.('actor') ?? Object.freeze({
      managerLane: 'actor',
      registrationOrdinal: input.id,
    }),
    origin: Object.freeze({ ...input.origin }),
    ownerId: input.ownerId,
    position: Object.freeze({ ...input.position }),
    privateSeed: input.privateSeed,
    phase: 'fall',
    pulseDue: false,
    pulseSequence: 0,
    pulseTicksRemaining: NATIVE_WELD_METEOR_PULSE_TICKS,
    underpowered: input.underpowered,
    vector: Object.freeze([...input.vector]),
    worldKey: input.worldKey,
  })
}

export function createNativeWeldMeteorFlash(input: {
  readonly actor: NativeWeldMeteorActorState
  readonly id: number
  readonly tick: number
}): NativeWeldMeteorFlashActorState {
  return Object.freeze({
    ageTicks: 0,
    alpha: 2,
    alphaStep: Math.fround(0.1),
    birthTick: input.tick,
    buildId: 1007,
    direction: Object.freeze({ ...input.actor.direction }),
    id: input.id,
    kind: 'weld-meteor-flash',
    lightRegistration: null,
    origin: Object.freeze({ ...input.actor.position }),
    ownerId: input.actor.ownerId,
    position: Object.freeze({ ...input.actor.position }),
    record: 15,
    scale: 6,
    vector: Object.freeze([...input.actor.vector]),
    worldKey: input.actor.worldKey,
  })
}

export function stepNativeWeldWorldActor(
  actor: NativeWeldWorldActor,
  sourceRng: NativeRngState,
  canAdvance: (
    actor: NativeWeldPersistentActorState,
    from: Readonly<Vector2>,
    to: Readonly<Vector2>,
  ) => boolean = () => true,
): {
  readonly actor: NativeWeldWorldActor | null
  readonly debris?: readonly NativeWeldMeteorDebrisSeed[]
  readonly rng: NativeRngState
} {
  if (actor.kind === 'weld-blizzard-glow') return { actor: null, rng: sourceRng }
  if (actor.kind === 'weld-flame-lash-fade') {
    return { actor: stepNativeWeldFlameLashFade(actor), rng: sourceRng }
  }
  if (
    actor.kind === 'weld-hail-flash'
    || actor.kind === 'weld-hail-knockback'
    || actor.kind === 'weld-hail-line'
    || actor.kind === 'weld-hail-terrain-bouncer'
    || actor.kind === 'weld-hail-terrain-particle'
  ) {
    return stepNativeWeldHailChild(actor, sourceRng)
  }
  if (actor.kind === 'weld-boulder-debris') {
    const stepped = stepNativeWeldBoulderDebrisParticle(
      actor.debris,
      actor.birthTick + actor.ageTicks + 1,
      sourceRng,
    )
    return {
      actor: stepped.particle === null
        ? null
        : Object.freeze({
            ...actor,
            ageTicks: actor.ageTicks + 1,
            debris: stepped.particle,
          }),
      rng: stepped.rng,
    }
  }
  if (actor.kind === 'weld-hail-rock-fade') {
    return {
      actor: actor.ageTicks + 1 < NATIVE_WELD_HAIL_ROCK_FADE_LIFETIME_TICKS
        ? Object.freeze({ ...actor, ageTicks: actor.ageTicks + 1 })
        : null,
      rng: sourceRng,
    }
  }
  if (actor.kind === 'weld-frost-fade') {
    return {
      actor: actor.ageTicks + 1 < NATIVE_WELD_HAIL_RELEASE_FADE_LIFETIME_TICKS
        ? Object.freeze({ ...actor, ageTicks: actor.ageTicks + 1 })
        : null,
      rng: sourceRng,
    }
  }
  if (actor.kind === 'weld-ground-spark-fade') {
    const alpha = Math.fround(actor.alpha - actor.alphaStep)
    return {
      actor: alpha > 0
        ? Object.freeze({ ...actor, ageTicks: actor.ageTicks + 1, alpha })
        : null,
      rng: sourceRng,
    }
  }
  if (actor.kind === 'weld-meteor-marker') {
    return { actor: stepNativeWeldMeteorMarker(actor), rng: sourceRng }
  }
  if (actor.kind === 'weld-meteor-flash') {
    const alpha = Math.fround(actor.alpha - actor.alphaStep)
    return {
      actor: alpha > 0
        ? Object.freeze({ ...actor, ageTicks: actor.ageTicks + 1, alpha })
        : null,
      rng: sourceRng,
    }
  }
  if (actor.kind === 'weld-channel') {
    return {
      actor: actor.ageTicks + 1 < NATIVE_WELD_CHANNEL_VISIBLE_TICKS
        ? Object.freeze({ ...actor, ageTicks: actor.ageTicks + 1 })
        : null,
      rng: sourceRng,
    }
  }
  if (actor.kind === 'weld-steam') {
    return { actor: stepNativeWeldSteamActor(actor), rng: sourceRng }
  }
  if (actor.kind === 'weld-impact') {
    const alpha = actor.alpha > 0
      ? Math.fround(actor.alpha - Math.fround(0.1))
      : 0
    return {
      actor: actor.ageTicks + 1 < NATIVE_WELD_IMPACT_VISIBLE_TICKS && alpha >= 0
        ? Object.freeze({ ...actor, ageTicks: actor.ageTicks + 1, alpha })
        : null,
      rng: sourceRng,
    }
  }
  if (actor.kind === 'weld-meteor') {
    if (actor.phase === 'fall') {
      const fallHeight = Math.fround(actor.fallHeight - actor.fallStep)
      if (fallHeight > 0) {
        return {
          actor: Object.freeze({
            ...actor,
            ageTicks: actor.ageTicks + 1,
            fallHeight,
          }),
          rng: sourceRng,
        }
      }
      const impact = createNativeWeldMeteorImpactProgram({
        bodyScale: actor.bodyScale,
        rng: sourceRng,
        underpowered: actor.underpowered,
      })
      return {
        actor: Object.freeze({
          ...actor,
          ageTicks: actor.ageTicks + 1,
          cameraDisplacement: impact.cameraDisplacement,
          debris: Object.freeze([]),
          fallHeight,
          impactDue: true,
          impactRadiusScalar: impact.impactRadiusScalar,
          impactRotationDegrees: impact.impactRotationDegrees,
          impactSoundPitch: impact.impactSoundPitch,
          impactThrowFirePitch: impact.impactThrowFirePitch,
          phase: 'impact',
        }),
        debris: impact.debris,
        rng: impact.rng,
      }
    }
    const impactTicksRemaining = actor.impactTicksRemaining - 1
    if (impactTicksRemaining <= 0) return { actor: null, rng: sourceRng }
    const pulseTicksRemaining = actor.pulseTicksRemaining - 1
    const pulseDue = pulseTicksRemaining === 0
    return {
      actor: Object.freeze({
        ...actor,
        ageTicks: actor.ageTicks + 1,
        impactAgeTicks: actor.impactAgeTicks + 1,
        impactDue: false,
        impactTicksRemaining,
        pulseDue,
        pulseSequence: pulseDue ? actor.pulseSequence + 1 : actor.pulseSequence,
        pulseTicksRemaining: pulseDue
          ? NATIVE_WELD_METEOR_PULSE_TICKS
          : pulseTicksRemaining,
      }),
      rng: sourceRng,
    }
  }
  if (actor.phase === 'held') return { actor, rng: sourceRng }
  if (actor.buildId === 1006) {
    const lifetimeTicksRemaining = actor.lifetimeTicksRemaining - 1
    if (lifetimeTicksRemaining <= 0) return { actor: null, rng: sourceRng }
    const origin = Object.freeze({
      x: Math.fround(actor.origin.x + actor.velocity.x),
      y: Math.fround(actor.origin.y + actor.velocity.y),
    })
    if (!canAdvance(actor, actor.origin, origin)) return { actor: null, rng: sourceRng }
    return {
      actor: Object.freeze({
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
      }),
      rng: sourceRng,
    }
  }
  const lookahead = Object.freeze({
    x: Math.fround(actor.origin.x + actor.direction.x * NATIVE_WELD_HAILSTONES_LOOKAHEAD),
    y: Math.fround(actor.origin.y + actor.direction.y * NATIVE_WELD_HAILSTONES_LOOKAHEAD),
  })
  if (!canAdvance(actor, actor.origin, lookahead)) return { actor: null, rng: sourceRng }
  let origin = actor.origin
  let rocks = actor.rocks
  let collisionRadius = actor.collisionRadius
  for (let substep = 0; substep < NATIVE_WELD_HAIL_FLIGHT_SUBSTEPS; substep += 1) {
    origin = Object.freeze({
      x: Math.fround(origin.x + actor.direction.x * NATIVE_WELD_HAILSTONES_SPEED),
      y: Math.fround(origin.y + actor.direction.y * NATIVE_WELD_HAILSTONES_SPEED),
    })
    if (actor.widen > 0) {
      collisionRadius = Math.fround(collisionRadius + actor.widen)
      rocks = Object.freeze(rocks.map((rock) => widenNativeWeldHailstoneRock(
        rock,
        actor.widen,
      )))
    }
  }
  return {
    actor: Object.freeze({
      ...actor,
      ageTicks: actor.ageTicks + 1,
      collisionRadius,
      origin,
      releaseAgeTicks: actor.releaseAgeTicks! + 1,
      rocks: Object.freeze(rocks.map((rock) => {
        const decay = Math.fround(rock.decay * Math.fround(0.95))
        return Object.freeze({
          ...rock,
          decay,
          phase: Math.min(1, Math.fround(rock.phase + Math.fround(0.025))),
        })
      })),
    }),
    rng: sourceRng,
  }
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
  origin: Vector2,
  scale: number,
  sourceRng: NativeRngState,
  enhancedEffects: boolean,
): {
  readonly rng: NativeRngState
  readonly hailRockFades: readonly Readonly<{
    readonly position: Vector2
    readonly rotationDegrees: number
  }>[]
  readonly rocks: readonly NativeWeldHailstoneRockState[]
} {
  const desiredCount = roundHalfToEven(Math.max(
    1,
    Math.fround(Math.fround(Math.fround(actor.widen * 3 + 20) * scale) * scale),
  ))
  if (desiredCount <= actor.rocks.length) {
    return { hailRockFades: Object.freeze([]), rng: sourceRng, rocks: actor.rocks }
  }
  let rng = sourceRng
  const hailRockFades: Array<Readonly<{
    readonly position: Vector2
    readonly rotationDegrees: number
  }>> = []
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
    if (enhancedEffects) {
      const rotation = drawNativeFloat(rng, 20)
      rng = rotation.state
      hailRockFades.push(Object.freeze({
        position: Object.freeze({
          x: Math.fround(origin.x + unit.x * radialScale * 1.5),
          y: Math.fround(
            origin.y + unit.z * radialScale * Math.fround(0.8) * 1.5,
          ),
        }),
        rotationDegrees: rotation.value,
      }))
    }
    rocks.push(Object.freeze({
      damageRemaining: 0,
      decay: 1,
      localPosition: Object.freeze({
        x: Math.fround(unit.x * radialScale),
        y: Math.fround(unit.y * radialScale),
        z: Math.fround(unit.z * radialScale),
      }),
      phase: 0,
      rockId: rocks.length,
      releaseOffset: null,
      spriteRecord: (168 + sprite.value) as 168 | 169 | 170,
      visualScale: Math.min(1, Math.fround(Math.fround(visual.value + 0.5) * 0.2)),
    }))
  }
  return {
    hailRockFades: Object.freeze(hailRockFades),
    rng,
    rocks: Object.freeze(rocks),
  }
}

export function nativeWeldHailstoneDrawOffset(
  rock: NativeWeldHailstoneRockState,
): Vector2 {
  return Object.freeze({
    x: rock.localPosition.x,
    y: nativeWeldHailstoneReleaseHeight(
      rock.localPosition.y,
      rock.localPosition.z,
      rock.decay,
    ),
  })
}

export function nativeWeldHailstoneFlightContactSubsteps(
  actor: NativeWeldHailstonesState,
): readonly Readonly<{
  readonly origin: Vector2
  readonly releaseOffsets: Readonly<Record<number, Vector2>>
}>[] {
  if (actor.phase !== 'flight') return Object.freeze([])
  return Object.freeze(Array.from(
    { length: NATIVE_WELD_HAIL_FLIGHT_SUBSTEPS },
    (_, index) => {
      const remaining = NATIVE_WELD_HAIL_FLIGHT_SUBSTEPS - index - 1
      return Object.freeze({
        origin: Object.freeze({
          x: Math.fround(
            actor.origin.x
              - actor.direction.x * NATIVE_WELD_HAIL_SUBSTEP_DISTANCE * remaining,
          ),
          y: Math.fround(
            actor.origin.y
              - actor.direction.y * NATIVE_WELD_HAIL_SUBSTEP_DISTANCE * remaining,
          ),
        }),
        releaseOffsets: Object.freeze(Object.fromEntries(actor.rocks.map((rock) => {
          const releaseOffset = rock.releaseOffset
          if (!releaseOffset) {
            throw new Error('released Hailstone is missing its native collision offset')
          }
          if (actor.widen <= 0 || remaining === 0) {
            return [rock.rockId, Object.freeze({ ...releaseOffset })]
          }
          const length = Math.hypot(rock.localPosition.x, rock.localPosition.y)
          const x = length > 0 ? rock.localPosition.x / length : 0
          const y = length > 0 ? rock.localPosition.y / length : 0
          return [rock.rockId, Object.freeze({
            x: Math.fround(releaseOffset.x - x * actor.widen * remaining),
            y: Math.fround(releaseOffset.y - y * actor.widen * remaining),
          })]
        }))),
      })
    },
  ))
}

function widenNativeWeldHailstoneRock(
  rock: NativeWeldHailstoneRockState,
  amount: number,
): NativeWeldHailstoneRockState {
  if (!rock.releaseOffset) return rock
  const length = Math.hypot(rock.localPosition.x, rock.localPosition.y)
  if (length <= 0) return rock
  const x = Math.fround(rock.localPosition.x / length * amount)
  const y = Math.fround(rock.localPosition.y / length * amount)
  return Object.freeze({
    ...rock,
    localPosition: Object.freeze({
      x: Math.fround(rock.localPosition.x + x),
      y: Math.fround(rock.localPosition.y + y),
      z: rock.localPosition.z,
    }),
    releaseOffset: Object.freeze({
      x: Math.fround(rock.releaseOffset.x + x),
      y: Math.fround(rock.releaseOffset.y + y),
    }),
  })
}

function nativeWeldHailstoneReleaseHeight(
  y: number,
  z: number,
  decay: number,
): number {
  const fallingHeight = Math.fround(50 - z * Math.fround(0.8))
  return Math.fround(y + Math.fround(fallingHeight - y) * decay)
}

function roundHalfToEven(value: number): number {
  const floor = Math.floor(value)
  const fraction = value - floor
  if (fraction < 0.5) return floor
  if (fraction > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}

function nativeWeldEtherealBoulderSplit(
  actor: NativeWeldEtherealBoulderState,
): readonly Readonly<{
  direction: Vector2
  origin: Vector2
  speedFactor: number
}>[] {
  const direction = actor.direction
  const perpendicular = Object.freeze({ x: direction.y, y: -direction.x })
  const heading = actorHeadingFromVector(direction.x, direction.y)
  const piece = (
    along: number,
    across: number,
    headingOffset: number,
    speedFactor: number,
  ) => Object.freeze({
    direction: Object.freeze(directionFromHeading(heading + headingOffset)),
    origin: Object.freeze({
      x: Math.fround(actor.origin.x + direction.x * along + perpendicular.x * across),
      y: Math.fround(actor.origin.y + direction.y * along + perpendicular.y * across),
    }),
    speedFactor: Math.fround(speedFactor),
  })
  switch (actor.quantity) {
    case 1:
      return Object.freeze([piece(0, 0, 0, actor.speedFactor)])
    case 2:
      return Object.freeze([
        piece(0, 30, 0, actor.speedFactor),
        piece(0, -30, 10, 1),
      ])
    case 3:
      return Object.freeze([
        piece(30, 0, 0, actor.speedFactor),
        piece(0, 30, -10, 0.95),
        piece(0, -30, 10, 0.95),
      ])
    case 4:
      return Object.freeze([
        piece(30, 0, 0, actor.speedFactor),
        piece(0, 30, -10, 0.95),
        piece(0, -30, 10, 0.95),
        piece(-15, 0, 0, 0.9),
      ])
  }
  throw new RangeError(`native Ethereal Boulder quantity ${actor.quantity} is outside 1..4`)
}

function normalizeDegrees(value: number): number {
  return Math.fround(((value % 360) + 360) % 360)
}
