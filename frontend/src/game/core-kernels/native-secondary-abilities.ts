import {
  advanceNativeRngWords,
  drawNativeFloat,
  drawNativeFloatRange,
  drawNativeInteger,
  drawNativeSign,
  createNativeRng,
  type NativeRngState,
} from './native-rng.ts'
import type { PlayerBeltComponent } from './native-belt.ts'
import {
  type PlayerCharacterInput,
  type PlayerCharacterState,
  type WizardElement,
} from './player-character.ts'
import { actorHeadingIndex, actorHeadingVector } from './actor-heading.ts'
import {
  activePlayerWeldBuildId,
  effectiveElementalPrimarySkillRankStats,
  effectiveSecondaryAbilityRankStats,
  nativeSkillCategory,
  nativeWeldBuild,
  playerStatBook,
  type NativeSecondaryAbilityRankStats,
  type PlayerSkillBookComponent,
} from './player-progression.ts'
import {
  NATIVE_SECONDARY_ABILITY_IDS,
  type NativeSecondaryAbilityId,
} from './native-secondary-ability-contract.ts'
import {
  resolveNativeSkillDamageValue,
  resolveNativeSkillManaCostValue,
  type NativeOffensiveSpellFactors,
} from './native-offensive-resolution.ts'
import {
  nativeSkillClass,
  type PlayerFlashResponse,
} from './player-skill-runtime.ts'
import { applyNativeEquipmentTransform } from './native-equipment-effects.ts'
import {
  NATIVE_GOLEM_DEATH_DURATION_TICKS,
  NATIVE_GOLEM_RADIUS,
  consumeNativeGolemDeathPresentationRng,
  damageNativeSecondaryGolem as damageNativeSecondaryGolemActor,
  nativeInitialGolemArticulation,
  stepNativeSecondaryGolem,
  type NativeSecondaryGolemState,
} from './native-secondary-golem.ts'
import {
  NATIVE_ETHER_BOLT_LIFETIME_TICKS,
  NATIVE_LEVIATHAN_LIFETIME_TICKS,
  NATIVE_LEVIATHAN_TARGET_RANGE,
  createNativeLeviathanBirth,
  nativeLeviathanActive,
  nativeLeviathanAppendageLocalRoot,
  nativeLeviathanAppendagePresentationRoot,
  nativeLeviathanCurrentScale,
  nativeLeviathanHeadingDegrees,
  nativeLeviathanHeadingVector,
  nativeLeviathanInsideTargetLane,
  nativeLeviathanMuzzlePosition,
  nativeLeviathanPhase,
} from './native-secondary-leviathan.ts'
import {
  createNativeWorldManagerOrder,
  type NativeWorldManagerLane,
  type NativeWorldManagerRegistration,
  type RegisterNativeWorldPainter,
} from './native-world-manager-order.ts'
import type { Vector2 } from './vector.ts'
import {
  createNativeFireDetonation,
  stepNativeFireEmber,
  type NativeFireEmberContact,
} from './primary-spell-fire-effects.ts'

export type {
  NativeGolemPhase,
  NativeSecondaryGolemState,
} from './native-secondary-golem.ts'

export const NATIVE_SECONDARY_ACTOR_KINDS = Object.freeze([
  'leviathan', 'leviathan-appendage', 'leviathan-mote', 'ether-bolt', 'ether-fade', 'phase-burst',
  'plane-orb-shot', 'plane-orb-particle',
  'moving-fire', 'shockwave', 'fire-patch', 'fire-burn', 'fire-burn-flame',
  'ether-burn', 'ether-burn-flare',
  'storm-cloud', 'storm-drop', 'storm-strike',
  'prismatic-wave', 'freeze-wave', 'freeze-wave-visual', 'ice-blast',
  'frost-burn-flare',
  'earthquake', 'earthquake-scenery-wobble', 'earthquake-quake', 'earthquake-dust',
  'earthquake-debris', 'golem',
  'golem-death',
  'teleport-burst', 'magic-circle', 'magic-circle-player-flash', 'magic-trap', 'magic-trap-shimmer',
  'magic-trap-burst', 'electric-burn',
  'flash-response-fade', 'flash-response-grow',
  'dampen-wave', 'dampened-projectile', 'shield-break', 'shield-explosion', 'acid-rain', 'acid-drop',
  'mindblast-burst', 'mindblast-shockwave',
  'ring-fire-explosion', 'ring-fire-fragment',
  'acid-splash', 'ether-drain', 'ether-drain-cloud', 'ether-drain-debris',
  'ether-drain-capture-flare', 'comet', 'comet-trail', 'comet-impact', 'comet-debris', 'turn-undead',
] as const)

export const NATIVE_SECONDARY_MOVEMENT_MODIFIER_KINDS = Object.freeze([
  'cold-slow', 'circle-slow', 'frozen', 'stun', 'dazzle',
] as const)

export type NativeSecondaryActorKind = typeof NATIVE_SECONDARY_ACTOR_KINDS[number]
export type NativeSecondaryMovementModifierKind =
  typeof NATIVE_SECONDARY_MOVEMENT_MODIFIER_KINDS[number]

export const NATIVE_SECONDARY_AUDIO_CUES = Object.freeze([
  'leviathan-roar', 'planewalker-on', 'planewalker-off', 'phase',
  'big-fire', 'nuke', 'ignite', 'magic-storm', 'lightning-start', 'thunder',
  'prismatic-shock', 'ring-of-ice', 'quake-cracks', 'quake-crack-small',
  'golem-provoke', 'knockback-golem', 'stone-step', 'golem-die', 'stone-break',
  'flame-lash-start', 'flash-spell', 'rock-hit',
  'stoneskin-on', 'stoneskin', 'teleport', 'magic-circle', 'set-trap', 'trap',
  'magic-missile', 'throw-fire', 'ice-start', 'start-boulder',
  'flash', 'dampen', 'magic-shield-up', 'hit-shield', 'pop-shield',
  'magic-shield-explode', 'acid-sizzle', 'fireball-hit', 'distort-reality',
  'comet-whistle', 'explode-steam', 'level-up', 'mindstar', 'fizzle',
  'plane-cross-loop', 'low-fire-loop', 'rainfall-loop', 'steady-wind-loop',
  'earthquake-loop', 'comet-loop', 'electric-loop',
] as const)

export type NativeSecondaryAudioCue = typeof NATIVE_SECONDARY_AUDIO_CUES[number]
export type NativeSecondaryDamageKind = 'acid' | 'fire' | 'ice' | 'lightning' | 'magic' | 'physical'
export const NATIVE_SECONDARY_EVENT_KINDS = Object.freeze([
  'cast', 'fizzle', 'impact', 'loop-start', 'loop-stop', 'overload', 'pulse',
  'shield-break', 'shield-hit', 'toggle-off', 'toggle-on', 'whistle',
] as const)
export type NativeSecondaryEventKind = typeof NATIVE_SECONDARY_EVENT_KINDS[number]
export const NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS = 150
export const NATIVE_SECONDARY_CONSTRUCTOR_COOLDOWN_TICKS: Readonly<
  Record<NativeSecondaryAbilityId, number>
> = Object.freeze({
  11: 833,
  12: 2_500,
  15: 833,
  21: 2_500,
  23: 50,
  27: 1_250,
  30: 1_250,
  35: 2_500,
  41: 2_500,
  45: 2_500,
  46: 10_000,
  48: 2_500,
  49: 2_500,
  50: 625,
  51: 2_000,
  54: 2_500,
  72: 2_500,
  73: 277,
  74: 3_750,
  76: 1_250,
  77: 1_875,
  78: 50,
  79: 50,
})

export interface NativeSecondaryActorState {
  readonly ageTicks: number
  readonly alpha: number
  readonly damage: number
  readonly enhanced: boolean
  readonly endpoint: Vector2
  readonly frame: number
  readonly freezeTicks: number
  readonly golem: NativeSecondaryGolemState | null
  readonly hitTargetIds: readonly number[]
  readonly id: number
  readonly kind: NativeSecondaryActorKind
  readonly lifetimeTicks: number
  readonly lightRegistration: NativeWorldManagerRegistration | null
  readonly midpoint: Vector2
  readonly miscLightAppendOrdinal: number | null
  readonly ownerId: string
  readonly painterRegistrations?: readonly NativeWorldManagerRegistration[]
  readonly phase: number
  readonly position: Vector2
  readonly presentationRng: NativeRngState | null
  readonly quantity: number
  readonly radius: number
  readonly rank: number
  readonly rotationRadians: number
  readonly scale: number
  readonly skillId: NativeSecondaryAbilityId | 14 | 22 | 53 | null
  readonly slowFactor: number
  readonly targetId: number | null
  readonly variant: number
  readonly velocity: Vector2
  readonly worldKey: string
}

export interface NativeSecondaryEventState {
  readonly actorId: number | null
  readonly cameraDisplacement: Vector2 | null
  readonly cameraMagnitude: number
  readonly cue: NativeSecondaryAudioCue | null
  readonly eventId: number
  readonly kind: NativeSecondaryEventKind
  readonly ownerId: string
  readonly pitch: number
  readonly position: Vector2
  readonly screenFlash: NativeSecondaryScreenFlashState | null
  readonly skillId: NativeSecondaryAbilityId | 22 | 53 | null
  readonly tick: number
  readonly worldKey: string
}

export interface NativeSecondaryScreenFlashState {
  readonly alpha: number
  readonly blue: number
  readonly decayPerTick: number
  readonly green: number
  readonly pointAttenuated: boolean
  readonly red: number
}

type NativeSecondaryEventSeed = Omit<
  NativeSecondaryEventState,
  'cameraDisplacement' | 'cameraMagnitude' | 'eventId' | 'screenFlash'
> & {
  readonly cameraDisplacement?: Vector2 | null
  readonly cameraMagnitude?: number
  readonly screenFlash?: NativeSecondaryScreenFlashState | null
}

export interface NativeSecondaryPlayerState {
  readonly castSequence: number
  readonly castSpinTicksRemaining: number
  readonly cooldownMaximumTicksBySkill: readonly number[]
  readonly cooldownTicksBySkill: readonly number[]
  readonly firewalker: boolean
  readonly fizzleSequence: number
  readonly globalCooldownTicks: number
  readonly heldSlot: number | null
  readonly lastSkillId: NativeSecondaryAbilityId | null
  readonly magicShieldAbsorb: number
  readonly magicShieldExplosionDamage: number
  readonly magicShieldMaximum: number
  readonly magicShieldPulseTicks: number
  readonly mindstar: boolean
  readonly planeOrbHeld: boolean
  readonly planewalkerTicksRemaining: number
  readonly regenerate: boolean
  readonly reservedMana: number
  readonly staffCastTicksRemaining: number
  readonly stoneskinTicksRemaining: number
}

export interface NativeSecondaryElectricBurnEffectState {
  readonly arcCount: number
  readonly damagePerTick: number
  readonly ownerId: string
  readonly sourceActorId: number
  readonly stunFactor: number
  readonly ticks: number
}

export interface NativeSecondarySteamedEffectState {
  readonly damagePerTick: number
  readonly emberDamage: number
  readonly emberFragments: number
  readonly explodeDamage: number
  readonly explodeRadius: number
  readonly ownerId: string
  readonly sourceActorId: number
  readonly ticks: number
}

export interface NativeSecondaryTargetEffectState {
  readonly circleSlowFactor: number
  readonly circleSlowTicks: number
  readonly coldSlowFactor: number
  readonly coldSlowMaterial: boolean
  readonly coldSlowTicks: number
  readonly dazzleMaximumTicks: number
  readonly dazzleTicks: number
  readonly disruptedTicks: number
  readonly electricBurn: NativeSecondaryElectricBurnEffectState | null
  readonly fleeTicks: number
  readonly frostBurnDamagePerTick: number
  readonly frostBurnOwnerId: string | null
  readonly frostBurnSkillId: 35 | 76 | null
  readonly frostBurnSourceActorId: number | null
  readonly frostBurnTicks: number
  readonly frozenTicks: number
  readonly frozenTimeScale: number
  readonly movementModifierOrder: readonly NativeSecondaryMovementModifierKind[]
  readonly prismaticTicks: number
  readonly stunFactor: number
  readonly stunTicks: number
  readonly steamed: NativeSecondarySteamedEffectState | null
  readonly targetId: number
  readonly timeScale: number
  readonly weakenFactor: number
  readonly worldKey: string
}

export type NativeSecondaryTargetEffectPatch = Partial<Omit<
  NativeSecondaryTargetEffectState,
  'movementModifierOrder' | 'targetId' | 'timeScale' | 'worldKey'
>>

export interface NativeSecondarySimulationState {
  readonly actors: readonly NativeSecondaryActorState[]
  readonly events: readonly NativeSecondaryEventState[]
  readonly firewalkerGeometrySequence: number
  readonly nextActorId: number
  readonly nextEventId: number
  readonly players: Readonly<Record<string, NativeSecondaryPlayerState>>
  readonly rng: NativeRngState
  readonly targetEffects: readonly NativeSecondaryTargetEffectState[]
}

export interface NativeSecondaryTarget {
  readonly family: string
  readonly id: number
  readonly lightRegistration: NativeWorldManagerRegistration
  readonly nativeFlags?: number
  readonly position: Vector2
  readonly radius: number
  readonly scale: number
  readonly shieldHealth: number
}

export interface NativeSecondarySceneryTarget {
  readonly id: number
  readonly position: Vector2
  readonly typeId: number
}

export interface NativeSecondaryPlayerAuthority {
  readonly belt: PlayerBeltComponent
  readonly character: PlayerCharacterState
  readonly coldSlowFactor: number
  readonly currentMana: number
  readonly eligible: boolean
  readonly enhancedEffects: boolean
  readonly explosiveShieldDamage: number
  readonly explosiveShieldRawManaCost: number
  readonly fireBurnDamage: number
  readonly freezeDurationMultiplier: number
  readonly focusInstantRechargeChancePercent: number
  readonly golemIron: boolean
  readonly golemRawManaCost: number
  readonly golemReflectFactor: number
  readonly input: PlayerCharacterInput
  readonly maximumMana: number
  readonly magicStormDurationBonusTicks: number
  readonly magicStormFrequencyFactor: number
  readonly magicStormRawManaCost: number
  readonly maximumGolem: boolean
  readonly maximumLeviathan: boolean
  readonly maximumMagicStorm: boolean
  readonly maximumRingOfFire: boolean
  readonly maximumRingOfIce: boolean
  readonly manaRecoveryPerTick: number
  readonly offensiveFactors: NativeOffensiveSpellFactors
  readonly secondaryRechargeFactor: number
  readonly skillBook: PlayerSkillBookComponent
  readonly worldKey: string
}

export interface NativeSecondaryDampenCandidates {
  readonly casterTargetIds: readonly number[]
  readonly projectiles: readonly NativeSecondaryDampenProjectileCandidate[]
  readonly shieldTargetIds: readonly number[]
}

export interface NativeSecondaryDampenProjectileCandidate {
  readonly ageTicks: number
  readonly headingDegrees: number
  readonly id: number
  readonly kind: 'firebolt' | 'guided-missile'
  readonly payload: 'cold' | 'fire' | 'poison'
  readonly position: Vector2
  readonly visualPhaseDegrees: number
  readonly visualScale: number
}

export interface NativeSecondaryPositionResult {
  readonly position: Vector2
  readonly rng: NativeRngState
}

export interface NativeSecondaryTickContext {
  readonly dampenCandidates: (
    worldKey: string,
    origin: Vector2,
  ) => NativeSecondaryDampenCandidates
  readonly phasingDestination: (
    playerId: string,
    origin: Vector2,
    direction: Vector2,
  ) => Vector2 | null
  readonly golemMovement: (
    playerId: string,
    worldKey: string,
    origin: Vector2,
    requestedPosition: Vector2,
    radius: number,
  ) => Vector2
  readonly golemFootPlacement?: (
    playerId: string,
    worldKey: string,
    currentPosition: Vector2,
    requestedPosition: Vector2,
  ) => Vector2
  readonly golemPlacement: (
    playerId: string,
    worldKey: string,
    requestedPosition: Vector2,
    rng: NativeRngState,
  ) => NativeSecondaryPositionResult
  readonly effectPositionBlocked?: (
    worldKey: string,
    position: Vector2,
  ) => boolean
  readonly lineObstruction?: (
    worldKey: string,
    start: Vector2,
    end: Vector2,
  ) => boolean
  readonly players: Readonly<Record<string, NativeSecondaryPlayerAuthority>>
  readonly registerWorldPainter?: RegisterNativeWorldPainter
  readonly sceneryTargets?: (
    worldKey: string,
    center: Vector2,
    radius: number,
  ) => readonly NativeSecondarySceneryTarget[]
  readonly teleportDestination: (
    playerId: string,
    rng: NativeRngState,
  ) => NativeSecondaryPositionResult
  readonly target: (
    worldKey: string,
    targetId: number,
  ) => NativeSecondaryTarget | null
  readonly targets: (
    worldKey: string,
    center: Vector2,
    radius: number,
  ) => readonly NativeSecondaryTarget[]
  readonly tick: number
}

export interface NativeSecondaryDamageContact {
  readonly amount: number
  readonly kind: NativeSecondaryDamageKind
  readonly ownerId: string
  readonly sourceActorId: number
  readonly targetId: number
}

export interface NativeSecondaryKnockbackContact {
  readonly delta: Vector2
  readonly sourceActorId: number
  readonly targetId: number
}

export interface NativeSecondaryHeadingPerturbation {
  readonly deltaDegrees: number
  readonly targetId: number
}

export interface NativeSecondarySteamedPulse {
  readonly emberDamage: number
  readonly emberFragments: number
  readonly explodeDamage: number
  readonly explodeRadius: number
  readonly position: Vector2
  readonly sourcePlayerId: string
  readonly targetId: number
  readonly worldKey: string
}

export interface NativeSecondaryTickResult {
  readonly damage: readonly NativeSecondaryDamageContact[]
  readonly dispelledShieldTargetIds: readonly number[]
  readonly disruptedTargetIds: readonly number[]
  readonly manaRecovered: Readonly<Record<string, number>>
  readonly manaUnderflowPlayerIds: readonly string[]
  readonly manaSpent: Readonly<Record<string, number>>
  readonly healthRecovered: Readonly<Record<string, number>>
  readonly headingPerturbations: readonly NativeSecondaryHeadingPerturbation[]
  readonly facingHeadingIndexes: Readonly<Record<string, number>>
  readonly knockbacks: readonly NativeSecondaryKnockbackContact[]
  readonly relocatedPlayers: Readonly<Record<string, Vector2>>
  readonly removedProjectileIds: readonly number[]
  readonly overloadedPlayerIds: readonly string[]
  readonly primaryOverridePlayerIds: readonly string[]
  readonly staffCastPulsePlayerIds: readonly string[]
  readonly state: NativeSecondarySimulationState
  readonly steamedPulses: readonly NativeSecondarySteamedPulse[]
}

interface NativeFireBurnRequest {
  readonly actor: NativeSecondaryActorState
  readonly damage: number
  readonly target: NativeSecondaryTarget
}

export interface NativeSecondaryFireBurnInput {
  readonly damage: number
  readonly ownerId: string
  readonly rank: number
  readonly skillId: NativeSecondaryAbilityId | 22
  readonly target: NativeSecondaryTarget
  readonly worldKey: string
}

export interface NativeSecondaryEtherBurnInput {
  readonly ownerId: string
  readonly rank: number
  readonly target: NativeSecondaryTarget
  readonly worldKey: string
}

interface NativeElectricBurnRequest {
  readonly actor: NativeSecondaryActorState
  readonly damage: number
  readonly target: NativeSecondaryTarget
}

export interface NativeSecondaryPlayerDamageResult {
  readonly absorbedDamage: number
  readonly healthDamage: number
  readonly state: NativeSecondarySimulationState
}

export interface NativePlayerMindblastTriggerResult {
  readonly directDamage: number
  readonly directRadius: number
  readonly state: NativeSecondarySimulationState
}

export interface NativeSecondaryGolemDamageResult {
  readonly ignored: boolean
  readonly killed: boolean
  readonly ownerId: string | null
  readonly reflectedDamage: number
  readonly state: NativeSecondarySimulationState
}

const PLAYER_SKILL_COUNT = 83
const PLANE_ORB_DAMAGE_RANK_IDS = Object.freeze([
  8, 10, 9, 13, 14, 15, 12,
] as const)
const EVENT_RETENTION_TICKS = 200
const EVENT_CAPACITY = 512
const ZERO = Object.freeze({ x: 0, y: 0 })
const FIRE_FRAME_COUNT = 32
const FIRE_PHASE_STEP = Math.fround(0.25)
const MOVING_FIRE_PHASE_STEP = Math.fround(0.12)
const FIRE_LIFE_PER_TICK = Math.fround(0.01)
const FIRE_SCALE_IN_PER_TICK = Math.fround(0.05)
const MOVING_FIRE_VELOCITY_GROWTH = Math.fround(1.01)
const RING_FIRE_INITIAL_LIFE = Math.fround(
  Math.fround(0.7) * Math.fround(1.5),
)
const FIRE_WALL_INITIAL_LIFE = Math.fround(7)
const FIRE_BURN_LIFETIME_TICKS = 200
const FIRE_BURN_FADE_TICKS = 50
const FIRE_BURN_FLAME_ALPHA = Math.fround(0.125)
const FIRE_BURN_FLAME_ALPHA_LOSS = Math.fround(0.01)
const FIRE_BURN_FLAME_LIFETIME_TICKS = 13
export const NATIVE_ETHER_BURN_LIFETIME_TICKS = 300
const ETHER_BURN_FADE_TICKS = 50
const ETHER_BURN_FLARE_ALPHA = Math.fround(0.125)
const ETHER_BURN_FLARE_ALPHA_LOSS = Math.fround(0.01)
const ETHER_BURN_FLARE_LIFETIME_TICKS = 13
const SHOCKWAVE_INITIAL_LIFE = Math.fround(1.155)
const SHOCKWAVE_EXPLOSIVE_SHIELD_LIFE = Math.fround(0.35)
const SHOCKWAVE_RADIUS_GROWTH_PER_TICK = Math.fround(6)
const FREEZE_WAVE_INITIAL_LIFE = Math.fround(0.924)
const WAVE_LIFE_PER_TICK = Math.fround(0.01)
const SHOCKWAVE_FADE_THRESHOLD = Math.fround(0.12375)
const SHOCKWAVE_EXPLOSIVE_SHIELD_FADE_THRESHOLD = Math.fround(0.0375)
const FREEZE_WAVE_FADE_THRESHOLD = Math.fround(0.12375)
const WAVE_FADE_FACTOR = Math.fround(0.899999976)
const ACID_RAIN_INITIAL_SCALE = Math.fround(0.01)
const STORM_QUERY_RADIUS = 500
const STORM_FADE_PER_TICK = 0.01
const STORM_ALPHA_GAIN_PER_TICK = 0.05
const STORM_SCALE_FACTOR = 1.2
const STORM_FLASH_DECAY_PER_TICK = 0.10000000149011612
const STORM_AMBIENT_FLASH_ROLL_COUNT = 1_000
const STORM_AMBIENT_FLASH_ROLL = 3
const STORM_AMBIENT_THUNDER_VOLUME_JITTER = 0.35
const TORNADO_MOVEMENT_PER_TICK = Math.fround(0.349999994)
const FREEZE_WAVE_RADIUS_PER_TICK = 6
const FROZEN_THAW_TICKS = 200
const FROZEN_TIME_SCALE_GAIN = Math.fround(0.005)
const FROST_BURN_DAMAGE_PER_TICK = Math.fround(0.01)
const FROST_BURN_FLARE_ALPHA_LOSS = Math.fround(0.05)
const FROST_BURN_FLARE_DAMPING = Math.fround(0.96)
const FROST_BURN_FLARE_LIFETIME_TICKS = 20
const RING_FIRE_EXPLOSION_RADIUS = 165
const RING_FIRE_EXPLOSION_DAMAGE_FACTOR = Math.fround(0.5)
const RING_FIRE_EXPLOSION_LIFETIME_TICKS = 37
const RING_FIRE_FRAGMENT_LIFETIME_TICKS = 400
const ACID_RAIN_ACTIVE_TICKS = 1_500
const ACID_RAIN_INITIAL_PULSE_DELAY_TICKS = 50
const ACID_RAIN_PULSE_INTERVAL_TICKS = 25
const ACID_RAIN_MAXIMUM_LIFETIME_TICKS = 3_600
const ACID_RAIN_ATTACK_RADIUS = 200
const ACID_RAIN_ATTACK_RADIUS_SQUARED = ACID_RAIN_ATTACK_RADIUS * ACID_RAIN_ATTACK_RADIUS
const ACID_RAIN_DROP_HEIGHT = -175
const ACID_RAIN_DROP_FALL_PER_TICK = 20
const ACID_RAIN_DROP_VELOCITY_GAIN = 4
const ACID_RAIN_DROP_GROUND_SCALE_FACTOR = 1.100000023841858
const ACID_RAIN_SPLASH_LIFE = Math.fround(0.25)
const ACID_RAIN_SPLASH_LIFE_PER_TICK = Math.fround(0.0125)
const ACID_RAIN_SPLASH_VELOCITY_DAMPING = Math.fround(0.95)
const ETHER_DRAIN_SCALE_IN_PER_TICK = Math.fround(0.025)
const ETHER_DRAIN_SCALE_IN_INTENSITY_PER_TICK = Math.fround(0.005)
const ETHER_DRAIN_ACTIVE_INTENSITY_PER_TICK = Math.fround(0.01)
const ETHER_DRAIN_SCALE_OUT_PER_TICK = Math.fround(0.05)
const ETHER_DRAIN_ACTIVE_COUNTDOWN_TICKS = 1_000
const ETHER_DRAIN_SCALE_OUT_COUNTDOWN_TICKS = 100
const ETHER_DRAIN_GAMEPLAY_CUTOFF_TICKS = 50
const ETHER_DRAIN_CANDIDATE_REFRESH_TICKS = 100
const ETHER_DRAIN_BROAD_QUERY_RADIUS = 1_024
const ETHER_DRAIN_BROAD_VERTICAL_SCALE = Math.fround(0.8)
const ETHER_DRAIN_PRESSURE_RADIUS_SQUARED = 512 * 512
const ETHER_DRAIN_CONTACT_RADIUS_SQUARED = 20 * 20
const ETHER_DRAIN_CONTACT_DOUBLE_RADIUS_SQUARED = 15 * 15
const ETHER_DRAIN_CONTACT_QUADRUPLE_RADIUS_SQUARED = 10 * 10
const ETHER_DRAIN_CAPTURE_PULSE = Math.fround(2)
const ETHER_DRAIN_CAPTURE_PULSE_LOSS = Math.fround(0.1)
const ETHER_DRAIN_CLOUD_TERMINAL_PHASE = 180
const ETHER_DRAIN_DEBRIS_DISTANCE = Math.fround(1_024)
const ETHER_DRAIN_DEBRIS_SPEED_GAIN = Math.fround(0.05)
const COMET_FALL_TICKS = 400
const COMET_WARNING_TICKS_REMAINING = 175
const COMET_TRAIL_LIFE_PER_TICK = Math.fround(0.025)
const STORM_DROP_HEIGHT = -175
const STORM_DROP_FALL_PER_TICK = 20
const STORM_DROP_VELOCITY_GAIN = 4
const STORM_DROP_GROUND_SCALE_FACTOR = Math.fround(1.1)
const FREEZE_WAVE_VISUAL_LIFETIME_TICKS = 175
const FREEZE_WAVE_NORMAL_SNOW_COUNT = 100
const FREEZE_WAVE_ENHANCED_SNOW_COUNT = 200
const COMET_IMPACT_LIFETIME_TICKS = 1_000
const COMET_DEBRIS_GRAVITY = Math.fround(0.4)
const COMET_DEBRIS_DAMPING = Math.fround(0.65)
const COMET_DEBRIS_SETTLE_VELOCITY = Math.fround(-0.75)
const COMET_DEBRIS_LIFE_PER_TICK = Math.fround(0.015)
const EARTHQUAKE_QUERY_RADIUS = 512
const EARTHQUAKE_PHASE_START = Math.fround(-5)
const EARTHQUAKE_PHASE_PER_TICK = Math.fround(0.05)
const EARTHQUAKE_OVERLAY_START = Math.fround(2)
const EARTHQUAKE_PULSE_PERIOD_TICKS = 30
const EARTHQUAKE_QUAKE_LIFETIME_TICKS = 180
const EARTHQUAKE_QUAKE_PHASE_PER_TICK = Math.fround(2)
const EARTHQUAKE_QUAKE_SCALE_PER_TICK = Math.fround(0.005)
const EARTHQUAKE_QUAKE_ALPHA_FACTOR = Math.fround(0.95)
const EARTHQUAKE_DUST_LIFETIME_TICKS = 360
const EARTHQUAKE_DUST_PHASE_PER_TICK = Math.fround(0.5)
const EARTHQUAKE_DEBRIS_GRAVITY = Math.fround(0.4)
const EARTHQUAKE_DEBRIS_BOUNCE_DAMPING = Math.fround(0.3)
const EARTHQUAKE_DEBRIS_PLANAR_DAMPING = Math.fround(0.65)
const EARTHQUAKE_DEBRIS_SETTLE_VELOCITY = Math.fround(-0.75)
const EARTHQUAKE_DEBRIS_BASE_ALPHA_LOSS = Math.fround(0.015)
const EARTHQUAKE_DEBRIS_ALPHA_LOSS = Math.fround(0.025)
const PRISMATIC_QUERY_RADIUS = 350
const PRISMATIC_EMISSION_TICKS = 100
const PRISMATIC_RNG_WORDS_PER_EMISSION = 19
const PRISMATIC_PRESENTATION_LIFETIME_TICKS = 167
const PRISMATIC_ALPHA_GAIN_PER_TICK = Math.fround(0.025)
const PRISMATIC_RADIUS_GROWTH_PER_TICK = Math.fround(0.065)
const PRISMATIC_RADIUS_SHRINK_PER_TICK = Math.fround(0.075)
const MAGIC_CIRCLE_NATIVE_LIFETIME_TICKS = 1_500
const MAGIC_CIRCLE_PRESENTATION_LIFETIME_TICKS = 1_519
const MAGIC_CIRCLE_HALF_WIDTH = 210
const MAGIC_CIRCLE_HALF_HEIGHT = 168
const MAGIC_CIRCLE_RING_RNG_WORDS_PER_CHILD = 5
const MAGIC_CIRCLE_PLAYER_FLASH_ALPHA_LOSS = Math.fround(0.05)
const MAGIC_CIRCLE_PLAYER_FLASH_SCALE_FACTOR = Math.fround(1.1)
const DAMPEN_MOVE_FADE_CHILDREN = 360
const DAMPEN_ADDITIVE_CHILDREN = 30
const DAMPEN_RNG_WORDS_PER_MOVE_FADE = 8
const DAMPEN_RNG_WORDS_PER_ADDITIVE = 3
const DAMPEN_PRESENTATION_RNG_WORDS = (
  DAMPEN_MOVE_FADE_CHILDREN * DAMPEN_RNG_WORDS_PER_MOVE_FADE
  + DAMPEN_ADDITIVE_CHILDREN * DAMPEN_RNG_WORDS_PER_ADDITIVE
)
const DAMPEN_PRESENTATION_LIFETIME_TICKS = 100
const DAMPEN_PROJECTILE_FLYOUT_LIFETIME_TICKS = DAMPEN_PRESENTATION_LIFETIME_TICKS
const DAMPEN_PROJECTILE_FLYOUT_SPEED = Math.fround(40)
const MAGIC_SHIELD_BREAK_CHILDREN = 20
const MAGIC_SHIELD_BREAK_ALPHA_LOSS = Math.fround(0.05)
const MAGIC_SHIELD_BREAK_LIFETIME_TICKS = 26
const MAGIC_SHIELD_EXPLOSION_CONTACT_RADIUS = 110
const MAGIC_SHIELD_EXPLOSION_PRESENTATION_RNG_WORDS = 502
const MAGIC_SHIELD_EXPLOSION_PRESENTATION_LIFETIME_TICKS = 116
const MAGIC_SHIELD_EXPLOSION_SHOCKWAVE_LIFETIME_TICKS = 36
export const NATIVE_MINDBLAST_DIRECT_RADIUS = 495
export const NATIVE_MINDBLAST_PRESENTATION_RNG_WORDS = 502
export const NATIVE_MINDBLAST_BURST_LIFETIME_TICKS = 230
export const NATIVE_MINDBLAST_SHOCKWAVE_LIFETIME_TICKS = 36
export const NATIVE_MINDBLAST_SHOCKWAVE_GROWTH = Math.fround(8)
const MAGIC_TRAP_CHARGE_PER_TICK = Math.fround(1 / (8 * 100))
const MAGIC_TRAP_ARMING_HALF_EXTENT = 65
const MAGIC_TRAP_PAYLOAD_HALF_EXTENT = 150
const MAGIC_TRAP_SHIMMER_INITIAL = Math.fround(3)
const MAGIC_TRAP_SHIMMER_FACTOR = Math.fround(0.8999999761581421)
const MAGIC_TRAP_SHIMMER_CUTOFF = Math.fround(0.10000000149011612)
const MAGIC_TRAP_SHIMMER_ALPHA_LOSS = Math.fround(0.05)
const MAGIC_TRAP_SHIMMER_LIFETIME_TICKS = 20
const MAGIC_TRAP_TRIGGER_PRESENTATION_RNG_WORDS = 502
const MAGIC_TRAP_TRIGGER_PRESENTATION_LIFETIME_TICKS = 116
const MAGIC_TRAP_ELECTRIC_BURN_LIFETIME_TICKS = 100
const MAGIC_TRAP_ELECTRIC_BURN_LIGHT_BASE_RADIUS = Math.fround(0.5)
const MAGIC_TRAP_ELECTRIC_BURN_LIGHT_INTENSITY = Math.fround(1)
const MAGIC_TRAP_ELECTRIC_BURN_LIGHT_JITTER = Math.fround(0.25)
const MAGIC_TRAP_ELECTRIC_BURN_CONTACT_SCALAR_BASE = Math.fround(0.25)
const MAGIC_TRAP_ELECTRIC_BURN_CONTACT_SCALAR_JITTER = Math.fround(0.5)
const MAGIC_TRAP_SELECTOR_SKILL_IDS = Object.freeze([8, 16, 24, 32, 40] as const)

function consumeMagicCircleVisualTick(
  source: NativeRngState,
  globalTick: number,
): { readonly intensity: number; readonly rng: NativeRngState } {
  const light = drawNativeFloat(source, 0.25, true)
  const childCount = 1 + (globalTick & 1)
  return {
    intensity: Math.fround(0.75 + light.value),
    rng: advanceNativeRngWords(
      light.state,
      childCount * MAGIC_CIRCLE_RING_RNG_WORDS_PER_CHILD,
    ),
  }
}

function drawMagicCirclePlayerFlash(
  source: NativeRngState,
): {
  readonly alpha: number
  readonly rng: NativeRngState
  readonly rotationRadians: number
  readonly scale: number
} {
  const rotation = drawNativeFloat(source, 360)
  const scale = drawNativeFloat(rotation.state, 1)
  const life = drawNativeFloat(scale.state, 0.25)
  return {
    alpha: Math.fround(0.5 + life.value),
    rng: life.state,
    rotationRadians: rotation.value * Math.PI / 180,
    scale: Math.fround(1 + scale.value * 0.65),
  }
}

function screenFlash(
  red: number,
  green: number,
  blue: number,
  decayPerTick: number,
  pointAttenuated: boolean,
  alpha = 1,
): NativeSecondaryScreenFlashState {
  return Object.freeze({
    alpha: Math.fround(alpha),
    blue: Math.fround(blue),
    decayPerTick: Math.fround(decayPerTick),
    green: Math.fround(green),
    pointAttenuated,
    red: Math.fround(red),
  })
}

const REGION_FLASH_FIRE = screenFlash(1, 0.5, 0, 0.1, true)
const REGION_FLASH_MAGIC_CIRCLE = screenFlash(0.75, 1, 1, 0.1, true)
const REGION_FLASH_MAGIC_SHIELD_APPLY = screenFlash(0.5, 1, 1, 0.1, true)
const REGION_FLASH_MAGIC_SHIELD_EXPLODE = screenFlash(0.5, 1, 1, 0.05, true)
const REGION_FLASH_MINDSTAR = screenFlash(0, 0.5, 1, 0.1, true)
const REGION_FLASH_PLANES = screenFlash(1, 0.5, 1, 0.05, true)
const REGION_FLASH_PLANEWALKER = screenFlash(1, 0, 1, 0.1, false)
const REGION_FLASH_PLANE_ORB = screenFlash(1, 0, 1, 0.1, false, 0.1)
const REGION_FLASH_PHASING = screenFlash(0, 1, 1, 0.025, true)
const REGION_FLASH_RING_FIRE = screenFlash(1, 0.5, 0, 0.01, true)
const REGION_FLASH_RING_ICE = screenFlash(0.9, 1, 1, 0.01, true)
const REGION_FLASH_STONESKIN = screenFlash(1, 1, 1, 0.1, false)
const REGION_FLASH_TELEPORT_DESTINATION = screenFlash(1, 1, 1, 0.025, true)
const REGION_FLASH_TELEPORT_SOURCE = screenFlash(1, 1, 1, 0.025, false)
const REGION_FLASH_EARTHQUAKE = screenFlash(0.8, 1, 0.8, 0.025, false)
const REGION_FLASH_COMET = screenFlash(1, 1, 1, 0.005, false)
const REGION_FLASH_RESPONSE = screenFlash(1, 1, 1, 0.05, true)
const PRISMATIC_REGION_FLASH_COLORS = Object.freeze([
  Object.freeze([1, 0, 0] as const),
  Object.freeze([1, 0.5, 0] as const),
  Object.freeze([1, 1, 0] as const),
  Object.freeze([0, 1, 0] as const),
  Object.freeze([0, 1, 1] as const),
])
const MAGIC_TRAP_SELECTOR_COLORS = Object.freeze([
  Object.freeze([1, 0.1, 1] as const),
  Object.freeze([1, 0.35, 0.1] as const),
  Object.freeze([0.1, 1, 1] as const),
  Object.freeze([0.1, 0.5, 1] as const),
  Object.freeze([0.1, 1, 0.1] as const),
  Object.freeze([1, 0.5, 0.1] as const),
  Object.freeze([0.1, 0.5, 0.5] as const),
  Object.freeze([0.75, 0.75, 0.75] as const),
  Object.freeze([1, 1, 1] as const),
])

interface FreezeWaveProgramSeed {
  readonly enhanced: boolean
  readonly freezeTicks: number
  readonly maximumRingOfIce: boolean
  readonly ownerId: string
  readonly position: Vector2
  readonly rank: number
  readonly skillId: 35 | 76
  readonly worldKey: string
}

function spawnFreezeWaveProgram(
  source: NativeSecondarySimulationState,
  sourceRng: NativeRngState,
  seed: FreezeWaveProgramSeed,
): { readonly rng: NativeRngState; readonly state: NativeSecondarySimulationState } {
  const presentationRng = sourceRng
  let rng = sourceRng
  for (let index = 0; index < 3; index += 1) {
    rng = drawNativeFloat(rng, 360).state
  }
  const snowCount = seed.enhanced
    ? FREEZE_WAVE_ENHANCED_SNOW_COUNT
    : FREEZE_WAVE_NORMAL_SNOW_COUNT
  for (let index = 0; index < snowCount; index += 1) {
    rng = drawNativeFloat(rng, 360).state
    rng = drawNativeFloat(rng, 10).state
    rng = drawNativeFloat(rng, 40).state
    rng = drawNativeFloat(rng, 4).state
    rng = drawNativeFloat(rng, 250).state
    rng = drawNativeFloat(rng, 0.5).state
    rng = drawNativeFloat(rng, 360).state
    rng = drawNativeFloat(rng, 1.5).state
  }
  let state = spawn(source, actorSeed({
    freezeTicks: seed.freezeTicks,
    kind: 'freeze-wave',
    lifetimeTicks: 93,
    ownerId: seed.ownerId,
    phase: FREEZE_WAVE_INITIAL_LIFE,
    position: seed.position,
    radius: 75,
    rank: seed.rank,
    skillId: seed.skillId,
    variant: seed.maximumRingOfIce ? 1 : 0,
    worldKey: seed.worldKey,
  }))
  state = spawn(state, actorSeed({
    enhanced: seed.enhanced,
    kind: 'freeze-wave-visual',
    lifetimeTicks: FREEZE_WAVE_VISUAL_LIFETIME_TICKS,
    ownerId: seed.ownerId,
    position: seed.position,
    presentationRng,
    rank: seed.rank,
    skillId: seed.skillId,
    worldKey: seed.worldKey,
  }))
  return { rng, state: { ...state, rng } }
}

export function createNativeSecondarySimulation(seed = 0): NativeSecondarySimulationState {
  return {
    actors: [],
    events: [],
    firewalkerGeometrySequence: 0,
    nextActorId: 1,
    nextEventId: 1,
    players: {},
    rng: createNativeRng(seed),
    targetEffects: [],
  }
}

export function spawnNativeScriptFires(
  source: NativeSecondarySimulationState,
  ownerId: string,
  worldKey: string,
  fires: readonly Readonly<{
    damage: number
    lifetimeTicks: number
    position: Vector2
    radius: number
  }>[],
  registerWorldPainter: RegisterNativeWorldPainter,
): NativeSecondarySimulationState {
  let state = source
  for (const fire of fires) {
    const phase = drawNativeFloat(state.rng, FIRE_FRAME_COUNT)
    const mirror = drawNativeSign(phase.state, 1)
    const registration = registerWorldPainter('actor')
    state = spawn({ ...state, rng: mirror.state }, actorSeed({
      damage: fire.damage,
      enhanced: true,
      kind: 'fire-patch',
      lifetimeTicks: fire.lifetimeTicks,
      lightRegistration: registration,
      ownerId,
      painterRegistrations: Object.freeze([registration]),
      phase: phase.value,
      position: Object.freeze({ ...fire.position }),
      quantity: mirror.value,
      radius: 0,
      scale: Math.fround(fire.radius / 100),
      skillId: 73,
      slowFactor: Math.fround(fire.lifetimeTicks * FIRE_LIFE_PER_TICK),
      worldKey,
    }))
  }
  return state
}

export function createNativeSecondaryPlayerState(): NativeSecondaryPlayerState {
  return {
    castSequence: 0,
    castSpinTicksRemaining: 0,
    cooldownMaximumTicksBySkill: Object.freeze(new Array<number>(PLAYER_SKILL_COUNT).fill(0)),
    cooldownTicksBySkill: Object.freeze(new Array<number>(PLAYER_SKILL_COUNT).fill(0)),
    firewalker: false,
    fizzleSequence: 0,
    globalCooldownTicks: 0,
    heldSlot: null,
    lastSkillId: null,
    magicShieldAbsorb: 0,
    magicShieldExplosionDamage: 0,
    magicShieldMaximum: 0,
    magicShieldPulseTicks: 0,
    mindstar: false,
    planeOrbHeld: false,
    planewalkerTicksRemaining: 0,
    regenerate: false,
    reservedMana: 0,
    staffCastTicksRemaining: 0,
    stoneskinTicksRemaining: 0,
  }
}

export function applyNativeUnforgeCooldownRejuvenation(
  source: NativeSecondarySimulationState,
  playerId: string,
): NativeSecondarySimulationState {
  const player = source.players[playerId]
  if (!player) return source
  return {
    ...source,
    players: {
      ...source.players,
      [playerId]: {
        ...player,
        cooldownTicksBySkill: Object.freeze(player.cooldownTicksBySkill.map((ticks, skillId) => (
          nativeSkillCategory(skillId) === 2 ? 0 : ticks
        ))),
        globalCooldownTicks: 0,
      },
    },
  }
}

export function nativeSecondaryManaCeiling(
  maximumMana: number,
  player: Pick<NativeSecondaryPlayerState, 'reservedMana'>,
): number {
  return Math.max(0, maximumMana - player.reservedMana)
}

export function nativeSecondaryManaReserve(
  player: Pick<NativeSecondaryPlayerState, 'firewalker' | 'mindstar' | 'regenerate'>,
  authority: Pick<NativeSecondaryPlayerAuthority, 'maximumMana' | 'skillBook'>,
): number {
  let reservedMana = player.firewalker
    ? effectiveSecondaryAbilityRankStats(authority.skillBook, 23).values.mHoard ?? 0
    : 0
  if (player.mindstar) {
    const stats = effectiveSecondaryAbilityRankStats(authority.skillBook, 78).values
    reservedMana += authority.maximumMana * (stats.mHoard ?? 0) / 100
  }
  if (player.regenerate) {
    const stats = effectiveSecondaryAbilityRankStats(authority.skillBook, 79).values
    reservedMana += authority.maximumMana * (stats.mHoard ?? 0) / 100
  }
  return reservedMana
}

export function nativeSecondaryStaffCastDurationTicks(
  skillBook: PlayerSkillBookComponent,
): number {
  const fasterCaster = effectiveSkillNumericValue(skillBook, 70, 'mValue')
  const progressFactor = Math.fround(1 + fasterCaster / 100)
  const progressPerTick = Math.fround(Math.fround(0.1) * progressFactor)
  let progress = Math.fround(0)
  let ticks = 0
  do {
    progress = Math.fround(progress + progressPerTick)
    ticks += 1
  } while (progress <= 5)
  return ticks
}

export function nativeSecondaryCooldownCapacityTicks(
  skillBook: PlayerSkillBookComponent,
  skillId: NativeSecondaryAbilityId,
): number {
  if (skillId === 15 || skillId === 48) {
    return Math.round(effectiveSkillNumericValue(skillBook, skillId, 'mCooldown') * 100)
  }
  return NATIVE_SECONDARY_CONSTRUCTOR_COOLDOWN_TICKS[skillId]
}

export function nativePlaneOrbDamage(
  skillBook: PlayerSkillBookComponent,
): number {
  return 2 * PLANE_ORB_DAMAGE_RANK_IDS.reduce(
    (total, skillId) => total + (skillBook.effectiveRanks[skillId] ?? 0),
    0,
  ) / 100
}

export function nativeSecondaryTargetEffect(
  state: NativeSecondarySimulationState,
  worldKey: string,
  targetId: number,
): NativeSecondaryTargetEffectState | null {
  return state.targetEffects.find((effect) => (
    effect.worldKey === worldKey && effect.targetId === targetId
  )) ?? null
}

export function nativeSecondaryTargetMaterialTint(
  worldTint: number,
  effect: NativeSecondaryTargetEffectState | null | undefined,
): number {
  if (!effect) return worldTint
  let redFactor = 1
  let greenFactor = 1
  const blueFactor = 1
  if (effect.coldSlowTicks > 0 && effect.coldSlowMaterial) {
    redFactor = Math.fround(redFactor * Math.fround(0.75))
  }
  if (effect.frozenTicks > 0) {
    const thawUpdates = Math.max(0, Math.min(
      FROZEN_THAW_TICKS,
      Math.round(effect.frozenTimeScale / FROZEN_TIME_SCALE_GAIN),
    ))
    let frozenRed = Math.fround(0.15)
    let frozenGreen = Math.fround(0.5)
    for (let update = 0; update < thawUpdates; update += 1) {
      frozenRed = Math.fround(frozenRed + Math.fround(0.00425))
      frozenGreen = Math.fround(frozenGreen + Math.fround(0.0025))
    }
    redFactor = Math.fround(redFactor * Math.fround((1 + frozenRed) * 0.5))
    greenFactor = Math.fround(greenFactor * Math.fround((1 + frozenGreen) * 0.5))
  }
  const channel = (shift: number, factor: number): number => Math.max(
    0,
    Math.min(255, Math.round((worldTint >> shift & 0xff) * factor)),
  )
  return (channel(16, redFactor) << 16)
    | (channel(8, greenFactor) << 8)
    | channel(0, blueFactor)
}

export function removeNativeSecondaryOwner(
  source: NativeSecondarySimulationState,
  playerId: string,
): NativeSecondarySimulationState {
  if (!Object.hasOwn(source.players, playerId)
    && !source.actors.some(({ ownerId }) => ownerId === playerId)
    && !source.targetEffects.some(({ electricBurn, frostBurnOwnerId, steamed }) => (
      frostBurnOwnerId === playerId
      || electricBurn?.ownerId === playerId
      || steamed?.ownerId === playerId
    ))) return source
  const players = { ...source.players }
  delete players[playerId]
  return {
    ...source,
    actors: source.actors.filter(({ ownerId }) => ownerId !== playerId),
    players,
    targetEffects: source.targetEffects.flatMap((effect) => {
      const next = {
        ...effect,
        electricBurn: effect.electricBurn?.ownerId === playerId ? null : effect.electricBurn,
        frostBurnDamagePerTick: effect.frostBurnOwnerId === playerId
          ? 0
          : effect.frostBurnDamagePerTick,
        frostBurnOwnerId: effect.frostBurnOwnerId === playerId ? null : effect.frostBurnOwnerId,
        frostBurnSkillId: effect.frostBurnOwnerId === playerId ? null : effect.frostBurnSkillId,
        frostBurnSourceActorId: effect.frostBurnOwnerId === playerId
          ? null
          : effect.frostBurnSourceActorId,
        frostBurnTicks: effect.frostBurnOwnerId === playerId ? 0 : effect.frostBurnTicks,
        steamed: effect.steamed?.ownerId === playerId ? null : effect.steamed,
      }
      return hasTargetEffect(next) ? [next] : []
    }),
  }
}

export function resetNativeSecondaryWorld(
  source: NativeSecondarySimulationState,
): NativeSecondarySimulationState {
  return {
    ...source,
    actors: [],
    events: [],
    players: Object.fromEntries(Object.keys(source.players).map((playerId) => [
      playerId,
      createNativeSecondaryPlayerState(),
    ])),
    targetEffects: [],
  }
}

export function applyNativeSecondaryPlayerDamage(
  source: NativeSecondarySimulationState,
  playerId: string,
  amount: number,
  tick: number,
  position: Vector2,
  worldKey: string,
): NativeSecondaryPlayerDamageResult {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError('secondary player damage must be finite and non-negative')
  }
  const current = source.players[playerId]
  if (!current || amount === 0) return { absorbedDamage: 0, healthDamage: amount, state: source }
  if (current.stoneskinTicksRemaining > 0) {
    return { absorbedDamage: amount, healthDamage: 0, state: source }
  }
  if (current.magicShieldAbsorb <= 0) {
    return { absorbedDamage: 0, healthDamage: amount, state: source }
  }

  const remaining = Math.max(0, current.magicShieldAbsorb - amount)
  const broke = remaining === 0
  const hitPitch = drawNativeFloat(source.rng, 0.05)
  let next: NativeSecondarySimulationState = {
    ...source,
    rng: hitPitch.state,
    players: {
      ...source.players,
      [playerId]: {
        ...current,
        magicShieldAbsorb: remaining,
        magicShieldExplosionDamage: broke ? 0 : current.magicShieldExplosionDamage,
        magicShieldMaximum: broke ? 0 : current.magicShieldMaximum,
        magicShieldPulseTicks: broke ? 0 : 40,
      },
    },
  }
  next = emit(next, {
    actorId: null,
    cue: 'hit-shield',
    kind: 'shield-hit',
    ownerId: playerId,
    pitch: Math.fround(0.8 + hitPitch.value),
    position,
    skillId: 54,
    tick,
    worldKey,
  })
  if (broke) {
    next = emit(next, {
      actorId: null,
      cue: 'pop-shield',
      kind: 'shield-break',
      ownerId: playerId,
      pitch: Math.fround(0.8),
      position,
      skillId: 54,
      tick,
      worldKey,
    })
    for (let index = 0; index < MAGIC_SHIELD_BREAK_CHILDREN; index += 1) {
      const rotation = drawNativeFloat(next.rng, 360)
      const alpha = drawNativeFloat(rotation.state, 0.75)
      const scale = drawNativeFloat(alpha.state, 0.25)
      next = { ...next, rng: scale.state }
      next = spawn(next, actorSeed({
        alpha: Math.fround(0.5 + alpha.value),
        kind: 'shield-break',
        ownerId: playerId,
        position: { x: position.x, y: position.y - 35 },
        rotationRadians: rotation.value * Math.PI / 180,
        scale: Math.fround(2 + scale.value),
        skillId: 54,
        lifetimeTicks: MAGIC_SHIELD_BREAK_LIFETIME_TICKS,
        variant: index,
        worldKey,
      }))
    }
    if (current.magicShieldExplosionDamage > 0) {
      const presentationRng = next.rng
      next = {
        ...next,
        rng: advanceNativeRngWords(
          next.rng,
          MAGIC_SHIELD_EXPLOSION_PRESENTATION_RNG_WORDS,
        ),
      }
      next = spawn(next, actorSeed({
        damage: current.magicShieldExplosionDamage,
        kind: 'shield-explosion',
        lifetimeTicks: MAGIC_SHIELD_EXPLOSION_PRESENTATION_LIFETIME_TICKS,
        ownerId: playerId,
        position,
        presentationRng,
        radius: MAGIC_SHIELD_EXPLOSION_CONTACT_RADIUS,
        skillId: 54,
        worldKey,
      }))
      next = spawn(next, actorSeed({
        kind: 'shockwave',
        lifetimeTicks: MAGIC_SHIELD_EXPLOSION_SHOCKWAVE_LIFETIME_TICKS,
        ownerId: playerId,
        phase: SHOCKWAVE_EXPLOSIVE_SHIELD_LIFE,
        position,
        quantity: SHOCKWAVE_RADIUS_GROWTH_PER_TICK,
        radius: 75,
        skillId: 54,
        slowFactor: SHOCKWAVE_EXPLOSIVE_SHIELD_FADE_THRESHOLD,
        variant: 1,
        worldKey,
      }))
      next = emit(next, {
        actorId: null,
        cameraMagnitude: 1.25,
        cue: 'magic-shield-explode',
        kind: 'impact',
        ownerId: playerId,
        pitch: 1,
        position,
        screenFlash: REGION_FLASH_MAGIC_SHIELD_EXPLODE,
        skillId: 54,
        tick,
        worldKey,
      })
    }
  }
  return { absorbedDamage: amount, healthDamage: 0, state: next }
}

export function applyNativeSecondaryGolemDamage(
  source: NativeSecondarySimulationState,
  actorId: number,
  damage: Readonly<{
    primaryDamage: number
    reflectablePhysicalSourceInRange: boolean
    secondaryDamage: number
  }>,
  tick: number,
): NativeSecondaryGolemDamageResult {
  const actor = source.actors.find(({ id, kind }) => id === actorId && kind === 'golem')
  if (!actor || actor.golem === null) {
    return { ignored: true, killed: false, ownerId: null, reflectedDamage: 0, state: source }
  }
  const received = damageNativeSecondaryGolemActor({
    ageTicks: actor.ageTicks,
    damageMinimum: actor.damage,
    golem: actor.golem,
    id: actor.id,
    ownerId: actor.ownerId,
    position: actor.position,
    rotationRadians: actor.rotationRadians,
    targetId: actor.targetId,
  }, damage)
  if (received.ignored) {
    return {
      ignored: true,
      killed: false,
      ownerId: actor.ownerId,
      reflectedDamage: 0,
      state: source,
    }
  }
  if (received.actor !== null) {
    return {
      ignored: false,
      killed: false,
      ownerId: actor.ownerId,
      reflectedDamage: received.reflectedDamage,
      state: {
        ...source,
        actors: source.actors.map((candidate) => candidate.id === actor.id
          ? {
              ...candidate,
              golem: received.actor!.golem,
              quantity: received.actor!.golem.currentHealth,
            }
          : candidate),
      },
    }
  }

  const presentationRng = source.rng
  let state: NativeSecondarySimulationState = {
    ...source,
    actors: source.actors.filter(({ id }) => id !== actor.id),
    rng: consumeNativeGolemDeathPresentationRng(source.rng),
  }
  const deathId = state.nextActorId
  state = spawn(state, actorSeed({
    enhanced: actor.golem.iron,
    kind: 'golem-death',
    lifetimeTicks: NATIVE_GOLEM_DEATH_DURATION_TICKS,
    ownerId: actor.ownerId,
    position: actor.position,
    presentationRng,
    skillId: 45,
    variant: actor.golem.iron ? 1 : 0,
    worldKey: actor.worldKey,
  }))
  const death = state.actors.find(({ id }) => id === deathId)!
  for (const cue of [
    'stone-break',
    'flame-lash-start',
    'golem-die',
    'rock-hit',
  ] as const) {
    state = emit(state, eventSeed(death, tick, cue, 'impact'))
  }
  return {
    ignored: false,
    killed: true,
    ownerId: actor.ownerId,
    reflectedDamage: received.reflectedDamage,
    state,
  }
}

export function stepNativeSecondaryAbilities(
  source: NativeSecondarySimulationState,
  context: NativeSecondaryTickContext,
): NativeSecondaryTickResult {
  if (!Number.isSafeInteger(context.tick) || context.tick < 0) {
    throw new RangeError('secondary tick must be a non-negative safe integer')
  }
  let state: NativeSecondarySimulationState = {
    ...source,
    events: source.events.filter(({ tick }) => tick >= context.tick - EVENT_RETENTION_TICKS),
    targetEffects: source.targetEffects.flatMap((effect) => {
      const circleSlowTicks = Math.max(0, effect.circleSlowTicks - 1)
      const coldSlowTicks = Math.max(0, effect.coldSlowTicks - 1)
      const dazzleTicks = Math.max(0, effect.dazzleTicks - 1)
      const dazzleMaximumTicks = effect.dazzleTicks > 1
        ? effect.dazzleMaximumTicks
        : 0
      const frozenTicks = Math.max(0, effect.frozenTicks - 1)
      const frostBurnTicks = Math.max(0, effect.frostBurnTicks - 1)
      const stunTicks = Math.max(0, effect.stunTicks - 1)
      const electricBurn = effect.electricBurn === null
        ? null
        : effect.electricBurn.ticks > 1
          ? Object.freeze({ ...effect.electricBurn, ticks: effect.electricBurn.ticks - 1 })
          : null
      const steamed = effect.steamed === null
        ? null
        : effect.steamed.ticks > 1
          ? Object.freeze({ ...effect.steamed, ticks: effect.steamed.ticks - 1 })
          : null
      const frozenTimeScale = frozenTicks === 0
        ? 1
        : frozenTicks <= FROZEN_THAW_TICKS
          ? Math.fround(Math.min(1, effect.frozenTimeScale + FROZEN_TIME_SCALE_GAIN))
          : effect.frozenTimeScale
      const circleSlowFactor = circleSlowTicks > 0 ? effect.circleSlowFactor : 1
      const coldSlowFactor = coldSlowTicks > 0 ? effect.coldSlowFactor : 1
      const stunFactor = stunTicks > 0 ? effect.stunFactor : 1
      const dazzleFactor = nativeDazzleTimeScale(
        dazzleTicks,
        dazzleMaximumTicks,
      )
      const movementModifierOrder = effect.movementModifierOrder.filter((kind) => {
        switch (kind) {
          case 'cold-slow': return coldSlowTicks > 0
          case 'circle-slow': return circleSlowTicks > 0
          case 'frozen': return frozenTicks > 0
          case 'stun': return stunTicks > 0
          case 'dazzle': return dazzleTicks > 0
        }
      })
      const next = {
        ...effect,
        circleSlowFactor,
        circleSlowTicks,
        coldSlowFactor,
        coldSlowMaterial: coldSlowTicks > 0 && effect.coldSlowMaterial,
        coldSlowTicks,
        dazzleMaximumTicks,
        dazzleTicks,
        disruptedTicks: Math.max(0, effect.disruptedTicks - 1),
        electricBurn,
        fleeTicks: Math.max(0, effect.fleeTicks - 1),
        frostBurnDamagePerTick: frostBurnTicks > 0 ? effect.frostBurnDamagePerTick : 0,
        frostBurnOwnerId: frostBurnTicks > 0 ? effect.frostBurnOwnerId : null,
        frostBurnSkillId: frostBurnTicks > 0 ? effect.frostBurnSkillId : null,
        frostBurnSourceActorId: frostBurnTicks > 0 ? effect.frostBurnSourceActorId : null,
        frostBurnTicks,
        frozenTicks,
        frozenTimeScale,
        movementModifierOrder,
        prismaticTicks: Math.max(0, effect.prismaticTicks - 1),
        stunFactor,
        stunTicks,
        steamed,
        timeScale: composeNativeSecondaryTimeScale(movementModifierOrder, {
          'circle-slow': circleSlowFactor,
          'cold-slow': coldSlowFactor,
          dazzle: dazzleFactor,
          frozen: frozenTicks > 0 ? frozenTimeScale : 1,
          stun: stunFactor,
        }),
      }
      return hasTargetEffect(next) ? [next] : []
    }),
  }
  let rng = state.rng
  const actorsAtStepStart = state.actors
  const damage: NativeSecondaryDamageContact[] = []
  const knockbacks: NativeSecondaryKnockbackContact[] = []
  const disruptedTargetIds = new Set<number>()
  const manaRecovered: Record<string, number> = {}
  const manaSpent: Record<string, number> = {}
  const healthRecovered: Record<string, number> = {}
  const headingPerturbations: NativeSecondaryHeadingPerturbation[] = []
  const steamedPulses: NativeSecondarySteamedPulse[] = []
  const facingHeadingIndexes: Record<string, number> = {}
  const relocatedPlayers: Record<string, Vector2> = {}
  const removedProjectileIds = new Set<number>()
  const dispelledShieldTargetIds = new Set<number>()
  const overloadedPlayerIds = new Set<string>()
  const manaUnderflowPlayerIds = new Set<string>()
  const primaryOverridePlayerIds = new Set<string>()
  const staffCastPulsePlayerIds = new Set<string>()
  const advancedActors: NativeSecondaryActorState[] = []
  const earthquakeWobblePhases = new Map<number, number>()
  const earthquakeSceneryPhases = new Map<string, number>()
  const sourceActorsById = new Map(actorsAtStepStart.map((actor) => [actor.id, actor] as const))
  for (const actor of actorsAtStepStart) {
    if (actor.kind !== 'earthquake-scenery-wobble' || actor.targetId === null) continue
    earthquakeSceneryPhases.set(
      `${actor.worldKey}:${actor.targetId}`,
      actor.phase,
    )
  }
  const fireBurnRequests: NativeFireBurnRequest[] = []
  const electricBurnRequests: NativeElectricBurnRequest[] = []
  const etherDrainPulseParentIds = new Set<number>()
  const leviathanParents = new Map(actorsAtStepStart
    .filter(({ kind }) => kind === 'leviathan')
    .map((actor) => [actor.id, actor] as const))
  const lastLeviathanAppendageIdByParent = new Map<number, number>()
  for (const candidate of actorsAtStepStart) {
    if (candidate.kind !== 'leviathan-appendage') continue
    const parentId = candidate.hitTargetIds[0]
    if (parentId !== undefined) lastLeviathanAppendageIdByParent.set(parentId, candidate.id)
  }

  const addDamage = (
    actor: NativeSecondaryActorState,
    target: NativeSecondaryTarget,
    amount: number,
    kind: NativeSecondaryDamageKind,
  ): void => {
    if (!(amount > 0)) return
    const effect = nativeSecondaryTargetEffect(state, actor.worldKey, target.id)
    damage.push({
      amount: kind === 'lightning' && (effect?.prismaticTicks ?? 0) > 0 ? amount * 2 : amount,
      kind,
      ownerId: actor.ownerId,
      sourceActorId: actor.id,
      targetId: target.id,
    })
  }
  const candidates = (actor: NativeSecondaryActorState, radius = actor.radius) => (
    stableTargets(context.targets(actor.worldKey, actor.position, radius))
  )

  for (const effect of source.targetEffects) {
    if (effect.electricBurn !== null) {
      const sourceTarget = context.target(effect.worldKey, effect.targetId)
      if (sourceTarget) {
        const arcTargets = [...context.targets(effect.worldKey, sourceTarget.position, 200)]
          .map((target, registrationOrder) => ({ registrationOrder, target }))
          .filter(({ target }) => target.id !== sourceTarget.id)
          .sort((left, right) => (
            squaredDistance(left.target.position, sourceTarget.position)
              - squaredDistance(right.target.position, sourceTarget.position)
            || left.registrationOrder - right.registrationOrder
          ))
          .slice(0, effect.electricBurn.arcCount)
          .map(({ target }) => target)
        for (const target of [sourceTarget, ...arcTargets]) {
          const targetEffect = nativeSecondaryTargetEffect(state, effect.worldKey, target.id)
          damage.push({
            amount: effect.electricBurn.damagePerTick
              * ((targetEffect?.prismaticTicks ?? 0) > 0 ? 2 : 1),
            kind: 'lightning',
            ownerId: effect.electricBurn.ownerId,
            sourceActorId: effect.electricBurn.sourceActorId,
            targetId: target.id,
          })
          if (effect.electricBurn.stunFactor < 1) {
            state = mergeEffect(state, effect.worldKey, target.id, {
              stunFactor: effect.electricBurn.stunFactor,
              stunTicks: 25,
            })
          }
        }
      }
    }
    if (effect.steamed !== null) {
      const target = context.target(effect.worldKey, effect.targetId)
      if (target) {
        damage.push({
          amount: effect.steamed.damagePerTick,
          kind: 'fire',
          ownerId: effect.steamed.ownerId,
          sourceActorId: effect.steamed.sourceActorId,
          targetId: target.id,
        })
        steamedPulses.push(Object.freeze({
          emberDamage: effect.steamed.emberDamage,
          emberFragments: effect.steamed.emberFragments,
          explodeDamage: effect.steamed.explodeDamage,
          explodeRadius: effect.steamed.explodeRadius,
          position: Object.freeze({ ...target.position }),
          sourcePlayerId: effect.steamed.ownerId,
          targetId: target.id,
          worldKey: effect.worldKey,
        }))
      }
    }
    if (effect.frostBurnTicks <= 0
      || effect.frostBurnOwnerId === null
      || effect.frostBurnSkillId === null
      || effect.frostBurnSourceActorId === null) continue
    const target = context.target(effect.worldKey, effect.targetId)
    if (!target) continue
    damage.push({
      amount: effect.frostBurnDamagePerTick,
      kind: 'ice',
      ownerId: effect.frostBurnOwnerId,
      sourceActorId: effect.frostBurnSourceActorId,
      targetId: target.id,
    })
    const gate = drawNativeInteger(rng, 2)
    rng = gate.state
    if (gate.value !== 1) continue
    const record = drawNativeInteger(rng, 2)
    const rotation = drawNativeFloat(record.state, 360)
    const scale = drawNativeFloat(rotation.state, 0.5)
    const radius = drawNativeFloat(scale.state, 10)
    const offsetDirection = drawNativeUnitVector(radius.state)
    const vertical = drawNativeFloat(offsetDirection.rng, 35)
    const speed = drawNativeFloat(vertical.state, 1)
    const velocityDirection = drawNativeUnitVector(speed.state)
    const alpha = drawNativeFloat(velocityDirection.rng, 0.5)
    rng = alpha.state
    state = spawn(state, actorSeed({
      alpha: Math.fround(1 - alpha.value),
      frame: 10 + record.value,
      kind: 'frost-burn-flare',
      lifetimeTicks: FROST_BURN_FLARE_LIFETIME_TICKS,
      ownerId: effect.frostBurnOwnerId,
      position: {
        x: Math.fround(target.position.x + offsetDirection.value.x * radius.value),
        y: Math.fround(
          target.position.y - vertical.value + offsetDirection.value.y * radius.value,
        ),
      },
      quantity: 0x408080,
      rotationRadians: rotation.value * Math.PI / 180,
      scale: Math.fround(0.5 + scale.value),
      skillId: effect.frostBurnSkillId,
      targetId: target.id,
      velocity: {
        x: Math.fround(velocityDirection.value.x * (0.5 + speed.value)),
        y: Math.fround(velocityDirection.value.y * (0.5 + speed.value)),
      },
      worldKey: effect.worldKey,
    }))
  }

  for (const sourceActor of actorsAtStepStart) {
    const owner = context.players[sourceActor.ownerId]
    if (!owner || owner.worldKey !== sourceActor.worldKey) continue
    let actor = advanceActor(sourceActor)
    let retain = actor.ageTicks < actor.lifetimeTicks

    switch (actor.kind) {
      case 'leviathan': {
        const currentScale = nativeLeviathanCurrentScale(actor.ageTicks)
        actor = {
          ...actor,
          phase: nativeLeviathanPhase(actor.ageTicks),
          scale: Math.fround(actor.slowFactor * currentScale),
        }
        if (actor.ageTicks === 1) {
          state = emit(state, {
            ...eventSeed(actor, context.tick, null, 'pulse'),
            screenFlash: REGION_FLASH_PLANES,
          })
        }
        break
      }
      case 'leviathan-appendage': {
        const parentId = actor.hitTargetIds[0]
        const parent = parentId === undefined
          ? undefined
          : leviathanParents.get(parentId)
        if (!parent) {
          retain = false
          break
        }
        const parentAge = parent.ageTicks + 1
        const currentScale = nativeLeviathanCurrentScale(parentAge)
        const compositeScale = Math.fround(parent.slowFactor * currentScale)
        let spinDegrees = actor.velocity.x
        let headingDegrees = actor.rotationRadians * 180 / Math.PI
        let deployment = actor.slowFactor
        let recoil = actor.midpoint
        let bank = actor.phase
        let countdown = actor.quantity
        let targetId = actor.targetId
        let depthKey = actor.frame - 100

        if (nativeLeviathanActive(parentAge)) {
          spinDegrees = Math.fround(spinDegrees + actor.velocity.y)
          recoil = {
            x: Math.fround(recoil.x * Math.fround(0.8999999761581421)),
            y: Math.fround(recoil.y * Math.fround(0.8999999761581421)),
          }
          const wander = drawNativeFloat(rng, 5.800000190734863)
          rng = wander.state
          headingDegrees = Math.fround(
            headingDegrees + Math.fround(0.20000000298023224) + wander.value,
          )
          if (headingDegrees > 360) headingDegrees = Math.fround(headingDegrees - 360)
          const preDecrementRemaining = 1_640 - parentAge + 1
          deployment = preDecrementRemaining > 15
            ? Math.fround(deployment * Math.fround(0.949999988079071))
            : Math.fround(deployment + Math.fround(0.07000000029802322))
          depthKey = Math.round(nativeLeviathanHeadingVector(headingDegrees).y * 100)

          if (deployment < Math.fround(0.05000000074505806)) {
            const queryOrigin = {
              x: Math.fround(parent.position.x + actor.endpoint.x),
              y: Math.fround(parent.position.y + actor.endpoint.y),
            }
            if (targetId === null) {
              targetId = nearestNativeLeviathanTarget(
                queryOrigin,
                headingDegrees,
                stableTargets(context.targets(
                  actor.worldKey,
                  queryOrigin,
                  NATIVE_LEVIATHAN_TARGET_RANGE,
                )),
                context,
                actor.worldKey,
              )?.id ?? null
            } else {
              const target = context.target(actor.worldKey, targetId)
              if (!target) {
                targetId = null
              } else {
                headingDegrees = nativeLeviathanHeadingDegrees(queryOrigin, target.position)
                countdown -= 1
                if (countdown < 1) {
                  const localRoot = nativeLeviathanAppendageLocalRoot(
                    actor.endpoint,
                    recoil,
                    spinDegrees,
                    deployment,
                  )
                  const muzzle = nativeLeviathanMuzzlePosition(
                    parent.position,
                    localRoot,
                    bank,
                    headingDegrees,
                    actor.radius,
                  )
                  const direction = nativeLeviathanHeadingVector(headingDegrees)
                  state = spawnEtherFade(
                    state, actor, muzzle, 1, 1.5, 0.05, 0, context.tick,
                  )
                  state = spawn(state, actorSeed({
                    alpha: 1,
                    damage: actor.damage,
                    kind: 'ether-bolt',
                    lifetimeTicks: NATIVE_ETHER_BOLT_LIFETIME_TICKS,
                    ownerId: actor.ownerId,
                    position: { x: muzzle.x, y: Math.fround(muzzle.y + 25) },
                    quantity: 100,
                    radius: 10,
                    rank: actor.rank,
                    rotationRadians: headingDegrees * Math.PI / 180,
                    skillId: 11,
                    velocity: {
                      x: Math.fround(direction.x * 10),
                      y: Math.fround(direction.y * 10),
                    },
                    worldKey: actor.worldKey,
                  }))
                  const cooldown = drawNativeInteger(rng, 26); rng = cooldown.state
                  const toggleBank = drawNativeInteger(rng, 2); rng = toggleBank.state
                  countdown = 75 + cooldown.value
                  if (toggleBank.value === 1) bank = bank === 0 ? 1 : 0
                  recoil = {
                    x: Math.fround(direction.x * 10),
                    y: Math.fround(direction.y * 10),
                  }
                }
              }
            }
          }
        }

        const localRoot = nativeLeviathanAppendageLocalRoot(
          actor.endpoint,
          recoil,
          spinDegrees,
          deployment,
        )
        actor = {
          ...actor,
          frame: depthKey + 100,
          midpoint: recoil,
          phase: bank,
          position: nativeLeviathanAppendagePresentationRoot(
            parent.position,
            compositeScale,
            localRoot,
          ),
          quantity: countdown,
          rotationRadians: headingDegrees * Math.PI / 180,
          scale: compositeScale,
          slowFactor: deployment,
          targetId,
          velocity: { x: spinDegrees, y: actor.velocity.y },
        }
        retain = parentAge < NATIVE_LEVIATHAN_LIFETIME_TICKS
        if (
          parentId !== undefined
          && lastLeviathanAppendageIdByParent.get(parentId) === actor.id
          && parent.enhanced
        ) {
          const mote = spawnLeviathanEnhancedMote(
            state,
            parent,
            currentScale,
            rng,
          )
          state = mote.state
          rng = mote.rng
        }
        break
      }
      case 'ether-bolt': {
        const quantity = sourceActor.quantity - 1
        const alpha = quantity < 1
          ? Math.fround(sourceActor.alpha - Math.fround(0.009999999776482582))
          : sourceActor.alpha
        actor = { ...actor, alpha, quantity }
        const target = candidates(actor, actor.radius)[0]
        if (target) {
          state = spawnEtherFade(
            state, actor, actor.position, 2, 2, 0.1, 1, context.tick,
          )
          addDamage(actor, target, actor.damage, 'magic')
          retain = false
        } else {
          retain = alpha > 0
        }
        break
      }
      case 'ether-fade':
        break
      case 'leviathan-mote': {
        const alpha = Math.fround(sourceActor.alpha - sourceActor.slowFactor)
        actor = {
          ...actor,
          alpha,
          velocity: {
            x: Math.fround(sourceActor.velocity.x * Math.fround(0.95)),
            y: Math.fround(sourceActor.velocity.y * Math.fround(0.95)),
          },
        }
        retain = alpha > 0
        break
      }
      case 'plane-orb-shot': {
        const travelScale = sourceActor.phase + 1
        const position = {
          x: Math.fround(
            sourceActor.position.x + travelScale * sourceActor.velocity.x,
          ),
          y: Math.fround(
            sourceActor.position.y + travelScale * sourceActor.velocity.y,
          ),
        }
        if (actor.ageTicks < 1_000) {
          const acceleration = Math.fround(
            sourceActor.phase * Math.fround(0.980000019),
          )
          const scale = Math.min(
            sourceActor.slowFactor,
            Math.fround(sourceActor.scale + Math.fround(0.01)),
          )
          const quantity = sourceActor.quantity + 1 >= 6
            ? 0
            : sourceActor.quantity + 1
          actor = {
            ...actor,
            phase: acceleration,
            position,
            quantity,
            radius: Math.fround(2 * scale),
            scale,
          }
          if (actor.enhanced) {
            const mote = spawnPlaneOrbEnhancedMote(state, actor, rng)
            state = mote.state
            rng = mote.rng
          }
          if (quantity === 0) {
            const queryPosition = {
              x: actor.position.x,
              y: Math.fround(actor.position.y - 15),
            }
            for (const target of stableTargets(
              context.targets(actor.worldKey, queryPosition, actor.radius),
            )) {
              addDamage(actor, target, actor.damage * 5, 'magic')
            }
          }
        } else {
          actor = {
            ...actor,
            position,
            scale: Math.max(0, Math.fround(
              sourceActor.scale - Math.fround(0.02),
            )),
          }
          retain = actor.scale > 0
        }
        break
      }
      case 'plane-orb-particle': {
        const alpha = Math.fround(sourceActor.alpha - sourceActor.slowFactor)
        actor = {
          ...actor,
          alpha: Math.max(0, alpha),
          position: {
            x: Math.fround(sourceActor.position.x + sourceActor.velocity.x),
            y: Math.fround(sourceActor.position.y + sourceActor.velocity.y),
          },
          velocity: {
            x: Math.fround(sourceActor.velocity.x * Math.fround(0.95)),
            y: Math.fround(sourceActor.velocity.y * Math.fround(0.95)),
          },
        }
        retain = alpha > 0
        break
      }
      case 'moving-fire':
      case 'fire-patch': {
        const remainingLife = Math.fround(
          sourceActor.slowFactor - FIRE_LIFE_PER_TICK,
        )
        const phase = wrapPhase(Math.fround(
          sourceActor.phase + (actor.kind === 'moving-fire'
            ? MOVING_FIRE_PHASE_STEP
            : FIRE_PHASE_STEP),
        ), FIRE_FRAME_COUNT)
        actor = {
          ...actor,
          frame: 46 + roundToNearestEven(phase),
          phase,
          radius: Math.min(1, Math.fround(
            sourceActor.radius + FIRE_SCALE_IN_PER_TICK,
          )),
          slowFactor: remainingLife,
          velocity: actor.kind === 'moving-fire'
            ? {
                x: Math.fround(
                  sourceActor.velocity.x * MOVING_FIRE_VELOCITY_GROWTH,
                ),
                y: Math.fround(
                  sourceActor.velocity.y * MOVING_FIRE_VELOCITY_GROWTH,
                ),
              }
            : sourceActor.velocity,
        }
        retain = remainingLife > 0
        if (actor.enhanced && actor.damage > 0 && context.tick % 3 === 0) {
          const contactRadius = Math.fround(32 * actor.scale)
          for (const target of candidates(actor, contactRadius)) {
            if (length(actor.position, target.position) >= contactRadius) continue
            const response = drawNativeFloat(rng, 0.5)
            rng = response.state
            fireBurnRequests.push({
              actor,
              damage: owner.fireBurnDamage,
              target,
            })
            addDamage(actor, target, nativeFireContactDamage(actor.damage), 'fire')
          }
        }
        break
      }
      case 'shockwave':
      case 'mindblast-shockwave': {
        const radiusGrowth = sourceActor.quantity
        if (!(radiusGrowth > 0)) {
          throw new Error(`${actor.kind} ${actor.id} lost its native radius growth`)
        }
        const remainingLife = Math.fround(sourceActor.phase - WAVE_LIFE_PER_TICK)
        if (remainingLife <= 0) {
          retain = false
          break
        }
        const alpha = remainingLife < sourceActor.slowFactor
          ? Math.fround(sourceActor.alpha * WAVE_FADE_FACTOR)
          : sourceActor.alpha
        actor = {
          ...actor,
          alpha,
          phase: remainingLife,
          radius: Math.fround(sourceActor.radius + radiusGrowth),
          scale: Math.fround(1 + actor.ageTicks * 0.08),
        }
        if (actor.ageTicks % 10 === 0) {
          const hit = new Set(actor.hitTargetIds)
          for (const target of candidates(actor)) {
            if (hit.has(target.id)) continue
            hit.add(target.id)
            if (actor.kind === 'shockwave') {
              addDamage(actor, target, actor.damage, 'fire')
              fireBurnRequests.push({
                actor,
                damage: owner.fireBurnDamage,
                target,
              })
            }
            state = mergeEffect(state, actor.worldKey, target.id, { dazzleTicks: 400 })
            if (actor.kind === 'shockwave' && actor.skillId === 21 && actor.variant === 1) {
              const explosion = spawnMaximumRingFireExplosion(
                state,
                rng,
                actor,
                target,
                context.tick,
                owner.fireBurnDamage,
              )
              state = explosion.state
              rng = explosion.rng
              for (const splashTarget of stableTargets(context.targets(
                actor.worldKey,
                target.position,
                RING_FIRE_EXPLOSION_RADIUS,
              ))) {
                addDamage(explosion.actor, splashTarget, explosion.actor.damage, 'fire')
              }
              const consumedFragmentIds = new Set<number>()
              for (const contact of explosion.contacts) {
                if (consumedFragmentIds.has(contact.spellId)) continue
                const fragment = state.actors.find(({ id, kind }) => (
                  id === contact.spellId && kind === 'ring-fire-fragment'
                ))
                if (!fragment) continue
                const contactTarget = stableTargets(context.targets(
                  contact.worldKey,
                  contact.position,
                  contact.radius,
                ))[0]
                if (!contactTarget) continue
                const contactActor = { ...fragment, position: contact.position }
                addDamage(contactActor, contactTarget, contact.amount, 'fire')
                fireBurnRequests.push({
                  actor: contactActor,
                  damage: contact.burnDamage,
                  target: contactTarget,
                })
                consumedFragmentIds.add(contact.spellId)
              }
              if (consumedFragmentIds.size > 0) {
                state = {
                  ...state,
                  actors: state.actors.filter(({ id }) => !consumedFragmentIds.has(id)),
                }
              }
            }
          }
          actor = { ...actor, hitTargetIds: Object.freeze([...hit].sort((a, b) => a - b)) }
        }
        if (actor.ageTicks % 2 === 0) {
          const tracked = new Set(actor.hitTargetIds)
          for (const target of candidates(actor).filter(({ id }) => tracked.has(id))) {
            const deltaX = Math.fround(target.position.x - actor.position.x)
            const deltaY = Math.fround(target.position.y - actor.position.y)
            const distance = Math.hypot(deltaX, deltaY)
            knockbacks.push({
              delta: distance === 0
                ? ZERO
                : {
                    x: Math.fround(deltaX / distance * actor.alpha * radiusGrowth),
                    y: Math.fround(deltaY / distance * actor.alpha * radiusGrowth),
                  },
              sourceActorId: actor.id,
              targetId: target.id,
            })
          }
        }
        break
      }
      case 'freeze-wave': {
        const life = Math.fround(sourceActor.phase - WAVE_LIFE_PER_TICK)
        if (life <= 0) {
          retain = false
          break
        }
        actor = {
          ...actor,
          alpha: life < FREEZE_WAVE_FADE_THRESHOLD
            ? Math.fround(sourceActor.alpha * WAVE_FADE_FACTOR)
            : sourceActor.alpha,
          phase: life,
          radius: Math.fround(sourceActor.radius + FREEZE_WAVE_RADIUS_PER_TICK),
        }
        if (actor.ageTicks % 10 === 0) {
          const hit = new Set(sourceActor.hitTargetIds)
          for (const target of candidates(actor)) {
            if (hit.has(target.id)) continue
            hit.add(target.id)
            const coldSlow = ((target.nativeFlags ?? 0) & 0x40) !== 0
            state = mergeEffect(state, actor.worldKey, target.id, coldSlow
              ? {
                  coldSlowFactor: owner.coldSlowFactor,
                  coldSlowMaterial: true,
                  coldSlowTicks: actor.freezeTicks,
                }
              : {
                  frozenTicks: actor.freezeTicks,
                  frozenTimeScale: 0,
                })
            if (actor.variant === 1) {
              state = mergeEffect(state, actor.worldKey, target.id, {
                frostBurnDamagePerTick: FROST_BURN_DAMAGE_PER_TICK,
                frostBurnOwnerId: actor.ownerId,
                frostBurnSkillId: actor.skillId === 76 ? 76 : 35,
                frostBurnSourceActorId: actor.id,
                frostBurnTicks: actor.freezeTicks * 100,
              })
            }
          }
          actor = { ...actor, hitTargetIds: Object.freeze([...hit].sort((a, b) => a - b)) }
        }
        break
      }
      case 'freeze-wave-visual':
        break
      case 'frost-burn-flare': {
        const alpha = Math.fround(sourceActor.alpha - FROST_BURN_FLARE_ALPHA_LOSS)
        actor = {
          ...actor,
          alpha: Math.max(0, alpha),
          position: {
            x: Math.fround(sourceActor.position.x + sourceActor.velocity.x),
            y: Math.fround(sourceActor.position.y + sourceActor.velocity.y),
          },
          velocity: {
            x: Math.fround(sourceActor.velocity.x * FROST_BURN_FLARE_DAMPING),
            y: Math.fround(sourceActor.velocity.y * FROST_BURN_FLARE_DAMPING),
          },
        }
        retain = alpha > 0
        break
      }
      case 'ring-fire-explosion': {
        retain = actor.ageTicks < actor.lifetimeTicks
        break
      }
      case 'ring-fire-fragment': {
        actor = { ...actor, ...stepRingFireFragment(sourceActor) }
        if (actor.variant !== 0) {
          retain = actor.alpha > 0
          break
        }
        const target = candidates(actor).find(({ id }) => !actor.hitTargetIds.includes(id))
        if (target) {
          addDamage(actor, target, actor.damage, 'fire')
          fireBurnRequests.push({ actor, damage: owner.fireBurnDamage, target })
          retain = false
        } else {
          retain = actor.alpha > 0
        }
        break
      }
      case 'fire-burn': {
        const target = actor.targetId === null
          ? null
          : context.target(actor.worldKey, actor.targetId)
        if (!target) {
          retain = false
          break
        }
        const remainingTicks = actor.lifetimeTicks - actor.ageTicks + 1
        const fade = remainingTicks < FIRE_BURN_FADE_TICKS
          ? Math.fround(remainingTicks / FIRE_BURN_FADE_TICKS)
          : 1
        addDamage(actor, target, actor.damage, 'fire')
        const flameScale = drawNativeFloat(rng, 0.25)
        const lightRadius = drawNativeFloat(flameScale.state, 0.1)
        rng = lightRadius.state
        state = spawn(state, actorSeed({
          alpha: Math.fround(fade * FIRE_BURN_FLAME_ALPHA),
          frame: 333 + Math.floor(context.tick / 3) % 10,
          kind: 'fire-burn-flame',
          lifetimeTicks: FIRE_BURN_FLAME_LIFETIME_TICKS,
          ownerId: actor.ownerId,
          position: {
            x: target.position.x,
            y: Math.fround(target.position.y - 15),
          },
          rank: actor.rank,
          scale: Math.fround((1 + flameScale.value) * target.scale),
          skillId: actor.skillId,
          targetId: target.id,
          worldKey: actor.worldKey,
        }))
        actor = {
          ...actor,
          alpha: fade,
          lightRegistration: target.lightRegistration,
          position: target.position,
          radius: Math.fround(0.1 + lightRadius.value),
          scale: target.scale,
        }
        retain = actor.ageTicks < actor.lifetimeTicks
        break
      }
      case 'fire-burn-flame': {
        actor = {
          ...actor,
          alpha: Math.max(0, Math.fround(
            sourceActor.alpha - FIRE_BURN_FLAME_ALPHA_LOSS,
          )),
          frame: sourceActor.frame,
        }
        retain = actor.alpha > 0
        break
      }
      case 'ether-burn': {
        const target = actor.targetId === null
          ? null
          : context.target(actor.worldKey, actor.targetId)
        if (!target) {
          retain = false
          break
        }
        const remainingTicks = actor.lifetimeTicks - actor.ageTicks + 1
        const fade = remainingTicks < ETHER_BURN_FADE_TICKS
          ? Math.fround(remainingTicks / ETHER_BURN_FADE_TICKS)
          : 1
        const flareScale = drawNativeFloat(rng, Math.fround(0.25), true)
        const lightRadius = drawNativeFloat(flareScale.state, Math.fround(0.1))
        rng = lightRadius.state
        state = spawn(state, actorSeed({
          alpha: Math.fround(fade * ETHER_BURN_FLARE_ALPHA),
          frame: 246 + Math.floor(context.tick / 6) % 5,
          kind: 'ether-burn-flare',
          lifetimeTicks: ETHER_BURN_FLARE_LIFETIME_TICKS,
          ownerId: actor.ownerId,
          position: {
            x: target.position.x,
            y: Math.fround(target.position.y - 15),
          },
          rank: actor.rank,
          scale: Math.fround((1 + flareScale.value) * target.scale),
          skillId: 14,
          targetId: target.id,
          worldKey: actor.worldKey,
        }))
        actor = {
          ...actor,
          alpha: fade,
          lightRegistration: target.lightRegistration,
          position: target.position,
          radius: Math.fround(0.1 + lightRadius.value),
          scale: target.scale,
        }
        retain = actor.ageTicks < actor.lifetimeTicks
        break
      }
      case 'ether-burn-flare': {
        actor = {
          ...actor,
          alpha: Math.max(0, Math.fround(
            sourceActor.alpha - ETHER_BURN_FLARE_ALPHA_LOSS,
          )),
          frame: sourceActor.frame,
        }
        retain = actor.alpha > 0
        break
      }
      case 'storm-cloud': {
        let stormFlash = sourceActor.frame
        const active = actor.ageTicks <= actor.freezeTicks
        if (!active) {
          const alpha = Math.fround(sourceActor.alpha - STORM_FADE_PER_TICK)
          actor = { ...actor, alpha }
          retain = alpha > 0
        } else {
          const drops = Math.trunc((actor.enhanced ? 5 : 2) / (actor.variant === 1 ? 2 : 1))
          for (let index = 0; index < drops; index += 1) {
            const distance = drawNativeFloat(rng, 200)
            const direction = drawNativeUnitVector(distance.state)
            rng = direction.rng
            state = spawn(state, actorSeed({
              kind: 'storm-drop',
              lifetimeTicks: 64,
              ownerId: actor.ownerId,
              phase: STORM_DROP_HEIGHT,
              position: {
                x: Math.fround(
                  sourceActor.position.x + direction.value.x * distance.value,
                ),
                y: Math.fround(
                  sourceActor.position.y + direction.value.y * distance.value * 0.8,
                ),
              },
              scale: Math.fround(0.1),
              skillId: 27,
              variant: index,
              worldKey: actor.worldKey,
            }))
          }
          let position = sourceActor.position
          let rotationRadians = sourceActor.rotationRadians
          if (sourceActor.variant === 1) {
            const turn = drawNativeFloat(rng, 2)
            rng = turn.state
            rotationRadians = normalizeRadians(
              sourceActor.rotationRadians + turn.value * Math.PI / 180,
            )
            position = {
              x: Math.fround(
                sourceActor.position.x
                  + Math.cos(rotationRadians) * TORNADO_MOVEMENT_PER_TICK,
              ),
              y: Math.fround(
                sourceActor.position.y
                  + Math.sin(rotationRadians) * TORNADO_MOVEMENT_PER_TICK,
              ),
            }
          }
          let strikeCountdown = sourceActor.quantity - 1
          actor = {
            ...actor,
            alpha: Math.min(1, Math.fround(
              sourceActor.alpha + STORM_ALPHA_GAIN_PER_TICK,
            )),
            position,
            quantity: strikeCountdown,
            rotationRadians,
            scale: Math.min(1, Math.fround(sourceActor.scale * STORM_SCALE_FACTOR)),
          }
          if (strikeCountdown <= 0) {
            const reset = drawNativeInteger(rng, 91)
            rng = reset.state
            strikeCountdown = Math.max(
              1,
              Math.trunc((30 + reset.value) / actor.slowFactor),
            )
            actor = { ...actor, quantity: strikeCountdown }

            const target = randomTarget(candidates(actor, STORM_QUERY_RADIUS), rng)
            rng = target.rng
            if (target.value) {
              const sourceDistance = drawNativeFloat(rng, 100)
              const sourceDirection = drawNativeUnitVector(sourceDistance.state)
              const midpointDistance = drawNativeFloat(sourceDirection.rng, 200)
              const midpointDirection = drawNativeUnitVector(midpointDistance.state)
              const damage = drawNativeFloat(
                midpointDirection.rng,
                Math.max(0, actor.phase - actor.damage),
              )
              rng = damage.state
              const origin = {
                x: Math.fround(
                  actor.position.x + sourceDirection.value.x * sourceDistance.value,
                ),
                y: Math.fround(
                  actor.position.y - 175
                    + sourceDirection.value.y * sourceDistance.value,
                ),
              }
              const midpoint = {
                x: Math.fround(
                  actor.position.x
                    + midpointDirection.value.x * midpointDistance.value,
                ),
                y: Math.fround(
                  actor.position.y - 90
                    + midpointDirection.value.y * midpointDistance.value,
                ),
              }
              const endpoint = {
                x: Math.fround(target.value.position.x),
                y: Math.fround(target.value.position.y - 15),
              }
              stormFlash = 1
              addDamage(
                actor,
                target.value,
                Math.fround(actor.damage + damage.value),
                'lightning',
              )
              const strikeId = state.nextActorId
              state = spawn(state, actorSeed({
                endpoint,
                kind: 'storm-strike',
                lifetimeTicks: 1,
                midpoint,
                ownerId: actor.ownerId,
                phase: context.tick,
                position: origin,
                skillId: 27,
                targetId: target.value.id,
                worldKey: actor.worldKey,
              }))
              for (const cue of ['lightning-start', 'thunder'] as const) {
                state = emit(state, {
                  actorId: strikeId,
                  cue,
                  kind: 'impact',
                  ownerId: actor.ownerId,
                  pitch: 1,
                  position: endpoint,
                  skillId: 27,
                  tick: context.tick,
                  worldKey: actor.worldKey,
                })
              }
            }
          }
        }

        actor = {
          ...actor,
          frame: Math.max(0, Math.fround(
            stormFlash - STORM_FLASH_DECAY_PER_TICK,
          )),
        }
        const ambientFlash = drawNativeInteger(rng, STORM_AMBIENT_FLASH_ROLL_COUNT)
        rng = ambientFlash.state
        if (ambientFlash.value === STORM_AMBIENT_FLASH_ROLL) {
          const volumeJitter = drawNativeFloat(rng, STORM_AMBIENT_THUNDER_VOLUME_JITTER)
          rng = volumeJitter.state
          actor = { ...actor, frame: 1 }
          state = emit(state, eventSeed(actor, context.tick, 'thunder', 'pulse'))
        }
        break
      }
      case 'prismatic-wave':
        if (actor.ageTicks <= PRISMATIC_EMISSION_TICKS) {
          rng = advanceNativeRngWords(rng, PRISMATIC_RNG_WORDS_PER_EMISSION)
          actor = {
            ...actor,
            alpha: Math.min(1, Math.fround(
              sourceActor.alpha + PRISMATIC_ALPHA_GAIN_PER_TICK,
            )),
            phase: Math.fround(sourceActor.phase + sourceActor.slowFactor * 6),
            position: {
              x: owner.character.position.x,
              y: owner.character.position.y - 25,
            },
            scale: Math.fround(sourceActor.scale + (
              sourceActor.ageTicks < 50
                ? PRISMATIC_RADIUS_GROWTH_PER_TICK
                : -PRISMATIC_RADIUS_SHRINK_PER_TICK
            )),
          }
        } else {
          actor = { ...actor, alpha: 0 }
        }
        break
      case 'earthquake':
        {
          const preDecrementRemaining = Math.max(
            0,
            sourceActor.lifetimeTicks - sourceActor.ageTicks,
          )
          const postDecrementRemaining = Math.max(0, preDecrementRemaining - 1)
          const intensity = Math.fround(
            Math.min(preDecrementRemaining, 200) / 200,
          )
          if (sourceActor.ageTicks === 0) {
            state = emit(state, eventSeed(actor, context.tick, 'rock-hit', 'pulse'))
            state = emit(state, eventSeed(actor, context.tick, 'quake-cracks', 'pulse'))
          }
          const horizontal = drawNativeFloat(rng, 3, true)
          rng = horizontal.state
          const previousPhase = sourceActor.phase
          const phase = Math.fround(previousPhase + EARTHQUAKE_PHASE_PER_TICK)
          let greenOverlay = Math.max(
            0,
            Math.fround(sourceActor.quantity - EARTHQUAKE_PHASE_PER_TICK),
          )
          if ((previousPhase < 0.6 && phase > 0.6)
            || (previousPhase < 3 && phase > 3)) greenOverlay = 1
          if (previousPhase < 3 && phase > 3) {
            state = emit(state, eventSeed(
              actor,
              context.tick,
              'quake-crack-small',
              'pulse',
            ))
          }
          actor = {
            ...actor,
            alpha: intensity,
            frame: sourceActor.frame,
            phase,
            quantity: greenOverlay,
            velocity: {
              x: horizontal.value,
              y: Math.fround(
                Math.sin(preDecrementRemaining * 20 * Math.PI / 180)
                  * 10 * intensity,
              ),
            },
          }

          if (postDecrementRemaining % EARTHQUAKE_PULSE_PERIOD_TICKS === 0) {
            if (intensity >= 0.99) {
              const quake = spawnEarthquakeQuake(state, rng, actor, intensity)
              state = quake.state
              rng = quake.rng
            }
            const targets = candidates(actor, EARTHQUAKE_QUERY_RADIUS).filter((target) => (
              squaredDistance(actor.position, target.position)
                < EARTHQUAKE_QUERY_RADIUS * EARTHQUAKE_QUERY_RADIUS
            ))
            const shuffled = shuffleFixedBound(targets, rng)
            rng = shuffled.rng
            for (const target of shuffled.values.slice(
              0,
              Math.floor(shuffled.values.length / 2),
            )) {
              disruptedTargetIds.add(target.id)
              const pauseGate = drawNativeInteger(rng, 2)
              rng = pauseGate.state
              let disruptedTicks = 1
              if (pauseGate.value === 1) {
                const pause = drawNativeInteger(rng, 50)
                rng = pause.state
                const timeScale = nativeSecondaryTargetEffect(
                  state,
                  actor.worldKey,
                  target.id,
                )?.timeScale ?? 1
                disruptedTicks = Math.round(
                  (50 + pause.value) / Math.max(Number.EPSILON, timeScale),
                )
              }
              const heading = drawNativeSign(rng, 15)
              rng = heading.state
              headingPerturbations.push(Object.freeze({
                deltaDegrees: heading.value,
                targetId: target.id,
              }))
              state = mergeEffect(state, actor.worldKey, target.id, {
                disruptedTicks,
              })
            }
          }

          const sceneryIndex = sourceActor.frame
          const sceneryActorId = sourceActor.hitTargetIds[sceneryIndex]
          const sceneryActor = sceneryActorId === undefined
            ? undefined
            : sourceActorsById.get(sceneryActorId)
          if (sceneryActor?.kind !== 'earthquake-scenery-wobble'
            || sceneryActor.targetId === null) {
            actor = { ...actor, frame: 0 }
          } else {
            const key = `${actor.worldKey}:${sceneryActor.targetId}`
            const currentPhase = earthquakeSceneryPhases.get(key) ?? sceneryActor.phase
            const multiplierDraw = drawNativeSign(rng, 1)
            const adjustment = drawNativeFloat(multiplierDraw.state, 1.5)
            rng = adjustment.state
            const multiplier = currentPhase < -2
              ? 1
              : currentPhase > 2
                ? -1
                : multiplierDraw.value
            const nextPhase = Math.fround(
              currentPhase + Math.fround(adjustment.value * multiplier),
            )
            earthquakeSceneryPhases.set(key, nextPhase)
            earthquakeWobblePhases.set(sceneryActor.id, nextPhase)
            actor = { ...actor, frame: sceneryIndex + 1 }

            if (actor.enhanced) {
              const dustGate = drawNativeInteger(rng, 30)
              rng = dustGate.state
              if (dustGate.value === 1) {
                const dust = spawnEarthquakeDust(state, rng, actor, sceneryActor)
                state = dust.state
                rng = dust.rng
              }
            }
          }

          const debrisGate = drawNativeInteger(rng, 15)
          rng = debrisGate.state
          if (debrisGate.value === 1) {
            const debris = spawnEarthquakeDebris(state, rng, actor)
            state = debris.state
            rng = debris.rng
          }
        }
        break
      case 'earthquake-scenery-wobble':
        actor = {
          ...actor,
          frame: 0,
          phase: earthquakeWobblePhases.get(actor.id) ?? sourceActor.phase,
        }
        retain = true
        break
      case 'earthquake-quake': {
        const phase = Math.fround(
          sourceActor.phase + EARTHQUAKE_QUAKE_PHASE_PER_TICK,
        )
        let alpha = sourceActor.alpha
        let scaleX = Math.fround(
          sourceActor.scale + EARTHQUAKE_QUAKE_SCALE_PER_TICK,
        )
        let scaleY = Math.fround(
          sourceActor.slowFactor + EARTHQUAKE_QUAKE_SCALE_PER_TICK,
        )
        if (Math.abs(Math.sin(phase * Math.PI / 180)) < 0.01) {
          const jump = drawNativeFloat(rng, 0.75)
          rng = jump.state
          const delta = Math.fround(0.25 + jump.value)
          scaleX = Math.fround(scaleX + delta)
          scaleY = Math.fround(scaleY + delta)
          alpha = Math.fround(alpha * EARTHQUAKE_QUAKE_ALPHA_FACTOR)
        }
        actor = { ...actor, alpha, phase, scale: scaleX, slowFactor: scaleY }
        retain = phase < 360
        break
      }
      case 'earthquake-dust': {
        const phase = Math.fround(
          sourceActor.phase + EARTHQUAKE_DUST_PHASE_PER_TICK,
        )
        actor = {
          ...actor,
          alpha: Math.fround(
            Math.abs(Math.sin(phase * Math.PI / 180)) * sourceActor.quantity,
          ),
          phase,
          position: {
            x: Math.fround(sourceActor.position.x + sourceActor.velocity.x),
            y: Math.fround(sourceActor.position.y + sourceActor.velocity.y),
          },
        }
        retain = phase < 180
        break
      }
      case 'earthquake-debris': {
        let alpha = sourceActor.alpha
        let bounceSeed = sourceActor.quantity
        let height = sourceActor.phase
        let position = sourceActor.position
        let rotationStep = sourceActor.endpoint.y
        let rotationRadians = sourceActor.rotationRadians
        let verticalVelocity = sourceActor.endpoint.x
        let velocity = sourceActor.velocity
        const baseReturnedEarly = height !== 0 && context.tick % 3 === 0
        if (!baseReturnedEarly) {
          if (height !== 0) {
            position = {
              x: Math.fround(position.x + velocity.x),
              y: Math.fround(position.y + velocity.y),
            }
            height = Math.fround(height + verticalVelocity)
            verticalVelocity = Math.fround(
              verticalVelocity + EARTHQUAKE_DEBRIS_GRAVITY,
            )
            if (height > 0) {
              if (context.effectPositionBlocked?.(actor.worldKey, position)) {
                retain = false
              }
              const spin = drawNativeFloat(rng, 10)
              rng = spin.state
              rotationStep = Math.fround(1 + spin.value)
              bounceSeed = Math.fround(
                bounceSeed * EARTHQUAKE_DEBRIS_BOUNCE_DAMPING,
              )
              verticalVelocity = bounceSeed
              const planarDamping = drawNativeInteger(rng, 2)
              rng = planarDamping.state
              if (planarDamping.value === 1) {
                velocity = {
                  x: Math.fround(
                    velocity.x * EARTHQUAKE_DEBRIS_PLANAR_DAMPING,
                  ),
                  y: Math.fround(
                    velocity.y * EARTHQUAKE_DEBRIS_PLANAR_DAMPING,
                  ),
                }
              }
              if (verticalVelocity > EARTHQUAKE_DEBRIS_SETTLE_VELOCITY) {
                bounceSeed = 0
                rotationStep = 0
                verticalVelocity = 0
                velocity = ZERO
              }
              height = verticalVelocity
              actor = { ...actor, frame: sourceActor.frame + 1 }
            }
            rotationRadians = Math.fround(
              rotationRadians + rotationStep * Math.PI / 180,
            )
          }
          alpha = Math.fround(alpha - EARTHQUAKE_DEBRIS_BASE_ALPHA_LOSS)
        }
        alpha = Math.fround(alpha - EARTHQUAKE_DEBRIS_ALPHA_LOSS)
        actor = {
          ...actor,
          alpha: Math.max(0, alpha),
          endpoint: { x: verticalVelocity, y: rotationStep },
          phase: height,
          position,
          quantity: bounceSeed,
          rotationRadians,
          velocity,
        }
        retain = retain && alpha > 0
        break
      }
      case 'golem': {
        if (sourceActor.golem === null) {
          throw new Error(`Golem actor ${sourceActor.id} has no Golem state`)
        }
        const stepped = stepNativeSecondaryGolem({
          ageTicks: sourceActor.ageTicks,
          damageMinimum: sourceActor.damage,
          golem: sourceActor.golem,
          id: sourceActor.id,
          ownerId: sourceActor.ownerId,
          position: sourceActor.position,
          rotationRadians: sourceActor.rotationRadians,
          targetId: sourceActor.targetId,
        }, {
          ownerPosition: owner.character.position,
          resolveFootTarget: (currentPosition, requestedPosition) => (
            context.golemFootPlacement?.(
              sourceActor.ownerId,
              sourceActor.worldKey,
              currentPosition,
              requestedPosition,
            ) ?? requestedPosition
          ),
          resolveMovement: (requestedPosition) => context.golemMovement(
            sourceActor.ownerId,
            sourceActor.worldKey,
            sourceActor.position,
            requestedPosition,
            NATIVE_GOLEM_RADIUS,
          ),
          rng,
          targets: stableTargets(context.targets(
            sourceActor.worldKey,
            sourceActor.position,
            1_000,
          )),
        })
        rng = stepped.rng
        actor = {
          ...actor,
          ageTicks: stepped.actor.ageTicks,
          frame: sourceActor.frame + 1,
          golem: stepped.actor.golem,
          position: stepped.actor.position,
          rotationRadians: stepped.actor.rotationRadians,
          targetId: stepped.actor.targetId,
        }
        if (stepped.assemblyMilestone !== null) {
          state = emit(state, eventSeed(actor, context.tick, 'quake-crack-small', 'pulse'))
          state = emit(state, {
            ...eventSeed(
              actor,
              context.tick,
              stepped.assemblyMilestone === 0 ? 'flame-lash-start' : 'rock-hit',
              'pulse',
            ),
            pitch: stepped.assemblyMilestone === 0 ? 0.8 : 1,
          })
        }
        if (stepped.provokeStarted) {
          state = emit(state, eventSeed(actor, context.tick, 'golem-provoke', 'pulse'))
        }
        if (stepped.footstep) {
          state = emit(state, eventSeed(actor, context.tick, 'stone-step', 'pulse'))
        }
        if (stepped.contact !== null) {
          state = emit(state, eventSeed(actor, context.tick, 'knockback-golem', 'impact'))
          for (const targetId of stepped.contact.targetIds) {
            const target = context.target(actor.worldKey, targetId)
            if (target === null) continue
            addDamage(actor, target, stepped.contact.damage, 'physical')
            const direction = unit(actor.position, target.position)
            knockbacks.push(Object.freeze({
              delta: {
                x: direction.x * stepped.contact.impulse,
                y: direction.y * stepped.contact.impulse,
              },
              sourceActorId: actor.id,
              targetId,
            }))
          }
        }
        retain = true
        break
      }
      case 'magic-circle':
        if (actor.ageTicks < MAGIC_CIRCLE_NATIVE_LIFETIME_TICKS) {
          const visualTick = consumeMagicCircleVisualTick(rng, context.tick)
          rng = visualTick.rng
          actor = { ...actor, alpha: visualTick.intensity }
        } else {
          actor = { ...actor, alpha: 0 }
        }
        if (actor.ageTicks < MAGIC_CIRCLE_NATIVE_LIFETIME_TICKS
          && actor.ageTicks % 10 === 0) {
          if (insideRectangle(
            actor.position,
            owner.character.position,
            MAGIC_CIRCLE_HALF_WIDTH,
            MAGIC_CIRCLE_HALF_HEIGHT,
          )) {
            manaRecovered[actor.ownerId] = (manaRecovered[actor.ownerId] ?? 0)
              + actor.quantity * 2
            const flash = drawMagicCirclePlayerFlash(rng)
            rng = flash.rng
            state = spawn(state, actorSeed({
              alpha: flash.alpha,
              kind: 'magic-circle-player-flash',
              lifetimeTicks: 100,
              ownerId: actor.ownerId,
              position: {
                x: owner.character.position.x,
                y: owner.character.position.y - 15,
              },
              rotationRadians: flash.rotationRadians,
              scale: flash.scale,
              skillId: 49,
              worldKey: actor.worldKey,
            }))
          }
          for (const target of candidates(actor, Math.hypot(
            MAGIC_CIRCLE_HALF_WIDTH,
            MAGIC_CIRCLE_HALF_HEIGHT,
          ))) {
            if (!insideRectangle(
              actor.position,
              target.position,
              MAGIC_CIRCLE_HALF_WIDTH,
              MAGIC_CIRCLE_HALF_HEIGHT,
            )) continue
            state = mergeEffect(state, actor.worldKey, target.id, {
              circleSlowFactor: Math.max(0, 1 - actor.slowFactor),
              circleSlowTicks: 20,
            })
          }
        }
        if (actor.ageTicks === 2) {
          state = emit(state, {
            ...eventSeed(actor, context.tick, 'magic-circle', 'pulse'),
            screenFlash: REGION_FLASH_MAGIC_CIRCLE,
          })
        }
        break
      case 'magic-circle-player-flash': {
        const alpha = Math.fround(
          sourceActor.alpha - MAGIC_CIRCLE_PLAYER_FLASH_ALPHA_LOSS,
        )
        actor = {
          ...actor,
          alpha,
          position: {
            x: owner.character.position.x,
            y: owner.character.position.y - 15,
          },
          scale: Math.fround(
            sourceActor.scale * MAGIC_CIRCLE_PLAYER_FLASH_SCALE_FACTOR,
          ),
        }
        retain = alpha > 0
        break
      }
      case 'magic-trap':
        {
          let frame = Math.fround(sourceActor.frame + Math.fround(0.25))
          if (frame >= 8) frame = Math.fround(frame - 8)
          const charge = Math.min(
            1,
            Math.fround(sourceActor.scale + MAGIC_TRAP_CHARGE_PER_TICK),
          )
          actor = { ...actor, frame, scale: charge }
          if (actor.ageTicks % 25 === 0) {
            const armed = candidates(
              actor,
              Math.hypot(MAGIC_TRAP_ARMING_HALF_EXTENT, MAGIC_TRAP_ARMING_HALF_EXTENT),
            ).some(({ position }) => insideRectangle(
              actor.position,
              position,
              MAGIC_TRAP_ARMING_HALF_EXTENT,
              MAGIC_TRAP_ARMING_HALF_EXTENT,
            ))
            if (armed) {
              const presentationRng = rng
              rng = advanceNativeRngWords(
                rng,
                MAGIC_TRAP_TRIGGER_PRESENTATION_RNG_WORDS,
              )
              state = spawn(state, actorSeed({
                kind: 'magic-trap-burst',
                lifetimeTicks: MAGIC_TRAP_TRIGGER_PRESENTATION_LIFETIME_TICKS,
                ownerId: actor.ownerId,
                position: actor.position,
                presentationRng,
                skillId: 50,
                variant: actor.variant,
                worldKey: actor.worldKey,
              }))
              state = emit(state, {
                ...eventSeed(actor, context.tick, 'trap', 'impact'),
                cameraMagnitude: 1.25,
                screenFlash: magicTrapScreenFlash(actor.variant, 0.05, true),
              })
              const amount = Math.fround(actor.damage * charge)
              const targets = candidates(
                actor,
                Math.hypot(MAGIC_TRAP_PAYLOAD_HALF_EXTENT, MAGIC_TRAP_PAYLOAD_HALF_EXTENT),
              ).filter(({ position }) => insideRectangle(
                actor.position,
                position,
                MAGIC_TRAP_PAYLOAD_HALF_EXTENT,
                MAGIC_TRAP_PAYLOAD_HALF_EXTENT,
              ))
              for (const target of targets) {
                if (actor.variant === 2) {
                  electricBurnRequests.push({ actor, damage: amount, target })
                  continue
                }
                addDamage(actor, target, amount, elementDamage(actor.variant))
                if (actor.variant === 3) {
                  state = mergeEffect(state, actor.worldKey, target.id, {
                    coldSlowTicks: Math.max(50, Math.trunc(400 * charge)),
                    coldSlowMaterial: true,
                    coldSlowFactor: actor.slowFactor,
                  })
                }
                if (actor.variant === 1) {
                  fireBurnRequests.push({
                    actor,
                    damage: owner.fireBurnDamage,
                    target,
                  })
                }
              }
              retain = false
            }
          }
          let shimmer = Math.fround(sourceActor.phase * MAGIC_TRAP_SHIMMER_FACTOR)
          if (shimmer < MAGIC_TRAP_SHIMMER_CUTOFF) shimmer = 0
          actor = { ...actor, phase: shimmer }
          if (shimmer > 0) {
            const rotation = drawNativeFloat(rng, 360)
            const alpha = drawNativeFloat(rotation.state, 0.25)
            rng = alpha.state
            state = spawn(state, actorSeed({
              alpha: Math.fround(0.75 + alpha.value),
              kind: 'magic-trap-shimmer',
              lifetimeTicks: MAGIC_TRAP_SHIMMER_LIFETIME_TICKS,
              ownerId: actor.ownerId,
              position: actor.position,
              rotationRadians: rotation.value * Math.PI / 180,
              scale: Math.fround(shimmer * Math.fround(3)),
              skillId: 50,
              variant: actor.variant,
              worldKey: actor.worldKey,
            }))
          }
        }
        break
      case 'magic-trap-shimmer': {
        const alpha = Math.fround(sourceActor.alpha - MAGIC_TRAP_SHIMMER_ALPHA_LOSS)
        actor = { ...actor, alpha }
        retain = alpha > 0
        break
      }
      case 'electric-burn': {
        const target = actor.targetId === null
          ? null
          : context.target(actor.worldKey, actor.targetId)
        if (!target) {
          retain = false
          break
        }
        const light = drawNativeFloat(
          rng,
          MAGIC_TRAP_ELECTRIC_BURN_LIGHT_JITTER,
          true,
        )
        const scalarGate = drawNativeInteger(light.state, 3)
        let contactScalar = MAGIC_TRAP_ELECTRIC_BURN_CONTACT_SCALAR_BASE
        rng = scalarGate.state
        if (scalarGate.value === 1) {
          const scalar = drawNativeFloat(
            rng,
            MAGIC_TRAP_ELECTRIC_BURN_CONTACT_SCALAR_JITTER,
          )
          rng = scalar.state
          contactScalar = Math.fround(
            MAGIC_TRAP_ELECTRIC_BURN_CONTACT_SCALAR_BASE + scalar.value,
          )
        }
        actor = {
          ...actor,
          alpha: MAGIC_TRAP_ELECTRIC_BURN_LIGHT_INTENSITY,
          lightRegistration: target.lightRegistration,
          phase: contactScalar,
          position: target.position,
          radius: Math.fround(
            MAGIC_TRAP_ELECTRIC_BURN_LIGHT_BASE_RADIUS + light.value,
          ),
        }
        addDamage(actor, target, actor.damage, 'lightning')
        break
      }
      case 'acid-rain': {
        const active = actor.ageTicks <= ACID_RAIN_ACTIVE_TICKS
        const residueAlphaBeforeFade = sourceActor.scale >= 1
          && sourceActor.ageTicks < ACID_RAIN_ACTIVE_TICKS
          ? Math.min(1, sourceActor.alpha + 0.005)
          : sourceActor.alpha
        if (!active) {
          const cloudAlpha = Math.max(0, sourceActor.phase - 0.01)
          const residueAlpha = cloudAlpha > 0
            ? residueAlphaBeforeFade
            : Math.max(0, residueAlphaBeforeFade - 0.0005)
          actor = { ...actor, alpha: residueAlpha, phase: cloudAlpha }
          retain = cloudAlpha > 0 || residueAlpha > 0
          break
        }

        const drops = actor.enhanced ? 5 : 2
        for (let index = 0; index < drops; index += 1) {
          const distance = drawNativeFloat(rng, 200)
          const direction = drawNativeUnitVector(distance.state)
          rng = direction.rng
          state = spawn(state, actorSeed({
            kind: 'acid-drop',
            lifetimeTicks: 64,
            ownerId: actor.ownerId,
            phase: ACID_RAIN_DROP_HEIGHT,
            position: {
              x: Math.fround(
                actor.position.x + direction.value.x * distance.value,
              ),
              y: Math.fround(
                actor.position.y + direction.value.y * distance.value * 0.8,
              ),
            },
            scale: Math.fround(0.1),
            skillId: 72,
            variant: index,
            worldKey: actor.worldKey,
          }))
        }

        const splashGate = drawNativeInteger(rng, 4)
        rng = splashGate.state
        if (splashGate.value === 3) {
          const discardedRotation = drawNativeFloat(rng, 360)
          const rotation = drawNativeFloat(discardedRotation.state, 360)
          const splashScale = drawNativeFloat(rotation.state, Math.fround(0.75))
          const distance = drawNativeFloat(splashScale.state, 200)
          const direction = drawNativeUnitVector(distance.state)
          rng = direction.rng
          state = spawn(state, actorSeed({
            alpha: ACID_RAIN_SPLASH_LIFE,
            kind: 'acid-splash',
            lifetimeTicks: 21,
            ownerId: actor.ownerId,
            position: {
              x: Math.fround(
                actor.position.x + direction.value.x * distance.value,
              ),
              y: Math.fround(
                actor.position.y + direction.value.y * distance.value,
              ),
            },
            rotationRadians: rotation.value * Math.PI / 180,
            scale: Math.fround(
              Math.fround(Math.fround(0.75) + splashScale.value) * 0.5,
            ),
            skillId: 72,
            velocity: { x: 0, y: Math.fround(-1.5) },
            worldKey: actor.worldKey,
          }))
        }

        const scale = Math.min(1, Math.fround(
          sourceActor.scale * STORM_SCALE_FACTOR,
        ))
        let pulseCountdown = sourceActor.quantity
        if (scale >= 1) pulseCountdown -= 1
        if (scale >= 1 && pulseCountdown <= 0) {
          const all = candidates(actor, ACID_RAIN_ATTACK_RADIUS).filter((target) => (
            squaredDistance(actor.position, target.position)
              < ACID_RAIN_ATTACK_RADIUS_SQUARED
          ))
          const shuffled = shuffleFixedBound(all, rng)
          rng = shuffled.rng
          const count = all.length === 0 ? 0 : Math.floor(all.length / 3) + 1
          for (const target of shuffled.values.slice(0, count)) {
            addDamage(actor, target, actor.damage, 'acid')
          }
          if (count > 0) {
            const soundGate = drawNativeInteger(rng, 2)
            rng = soundGate.state
            if (soundGate.value === 1) {
              const soundGain = drawNativeFloat(rng, Math.fround(0.5))
              const soundPitch = drawNativeFloat(
                soundGain.state,
                Math.fround(0.45),
              )
              rng = soundPitch.state
              state = emit(state, {
                ...eventSeed(actor, context.tick, 'acid-sizzle', 'pulse'),
                pitch: Math.fround(0.8 + soundPitch.value),
              })
            }
          }
          pulseCountdown = ACID_RAIN_PULSE_INTERVAL_TICKS
        }
        actor = {
          ...actor,
          alpha: residueAlphaBeforeFade,
          phase: Math.min(1, Math.fround(sourceActor.phase + 0.05)),
          quantity: pulseCountdown,
          scale,
        }
        break
      }
      case 'storm-drop':
      case 'acid-drop': {
        const fallPerTick = actor.kind === 'storm-drop'
          ? STORM_DROP_FALL_PER_TICK
          : ACID_RAIN_DROP_FALL_PER_TICK
        const velocityGain = actor.kind === 'storm-drop'
          ? STORM_DROP_VELOCITY_GAIN
          : ACID_RAIN_DROP_VELOCITY_GAIN
        const groundScaleFactor = actor.kind === 'storm-drop'
          ? STORM_DROP_GROUND_SCALE_FACTOR
          : ACID_RAIN_DROP_GROUND_SCALE_FACTOR
        const height = Math.min(
          0,
          sourceActor.phase + fallPerTick,
        )
        const groundScale = height >= 0
          ? Math.fround(
              sourceActor.scale * groundScaleFactor,
            )
          : sourceActor.scale
        if (height >= 0 && groundScale >= 1) {
          retain = false
          break
        }
        actor = {
          ...actor,
          phase: height,
          quantity: Math.fround(
            sourceActor.quantity + velocityGain,
          ),
          scale: groundScale,
        }
        break
      }
      case 'acid-splash': {
        const life = Math.fround(
          sourceActor.alpha - ACID_RAIN_SPLASH_LIFE_PER_TICK,
        )
        if (life <= 0) {
          retain = false
          break
        }
        actor = {
          ...actor,
          alpha: life,
          velocity: {
            x: Math.fround(
              sourceActor.velocity.x * ACID_RAIN_SPLASH_VELOCITY_DAMPING,
            ),
            y: Math.fround(
              sourceActor.velocity.y * ACID_RAIN_SPLASH_VELOCITY_DAMPING,
            ),
          },
        }
        break
      }
      case 'ether-drain': {
        const phaseAtEntry = sourceActor.phase
        let activeCountdown = sourceActor.freezeTicks
        let intensity = sourceActor.alpha
        let phase = phaseAtEntry
        let refreshCountdown = sourceActor.quantity
        let scale = sourceActor.scale
        if (phaseAtEntry === 0) {
          refreshCountdown -= 5
          scale = Math.fround(sourceActor.scale + ETHER_DRAIN_SCALE_IN_PER_TICK)
          if (scale >= 1) {
            scale = 1
            phase = 1
          }
          intensity = Math.min(1, Math.fround(
            sourceActor.alpha + ETHER_DRAIN_SCALE_IN_INTENSITY_PER_TICK,
          ))
        } else if (phaseAtEntry === 1) {
          activeCountdown -= 1
          intensity = Math.min(1, Math.fround(
            sourceActor.alpha + ETHER_DRAIN_ACTIVE_INTENSITY_PER_TICK,
          ))
          if (activeCountdown < 1) {
            activeCountdown = ETHER_DRAIN_SCALE_OUT_COUNTDOWN_TICKS
            phase = 2
            refreshCountdown = ETHER_DRAIN_CANDIDATE_REFRESH_TICKS
          }
        } else {
          activeCountdown = Math.max(0, activeCountdown - 1)
          refreshCountdown -= 10
          scale = Math.fround(sourceActor.scale - ETHER_DRAIN_SCALE_OUT_PER_TICK)
          intensity = Math.max(0, Math.fround(
            sourceActor.alpha - ETHER_DRAIN_SCALE_OUT_PER_TICK,
          ))
          if (scale <= 0) retain = false
        }
        actor = {
          ...actor,
          alpha: intensity,
          freezeTicks: activeCountdown,
          phase,
          rotationRadians: sourceActor.rotationRadians + scale * 2 * Math.PI / 180,
          scale: Math.max(0, scale),
          slowFactor: Math.max(0, Math.fround(
            sourceActor.slowFactor - ETHER_DRAIN_CAPTURE_PULSE_LOSS,
          )),
        }
        if (actor.ageTicks === 1) {
          state = emit(state, {
            ...eventSeed(actor, context.tick, null, 'pulse'),
            screenFlash: REGION_FLASH_PLANES,
          })
        }

        if (phaseAtEntry === 1 && activeCountdown > ETHER_DRAIN_GAMEPLAY_CUTOFF_TICKS) {
          const cloudGate = drawNativeInteger(rng, actor.enhanced ? 3 : 5)
          rng = cloudGate.state
          if (cloudGate.value === 1) {
            const cloud = spawnEtherDrainCloud(state, actor, rng)
            state = cloud.state
            rng = cloud.rng
          }
          const debrisGate = drawNativeInteger(rng, 50)
          rng = debrisGate.state
          if (debrisGate.value === 1) {
            const debris = spawnEtherDrainDebris(state, actor, rng)
            state = debris.state
            rng = debris.rng
          }
        }

        refreshCountdown -= 1
        if (refreshCountdown < 1) {
          const retainedIds = candidates(actor, ETHER_DRAIN_BROAD_QUERY_RADIUS)
            .filter((target) => {
              const dx = Math.fround(target.position.x - actor.position.x)
              const dy = Math.fround(
                Math.fround(target.position.y - actor.position.y)
                / ETHER_DRAIN_BROAD_VERTICAL_SCALE,
              )
              return Math.fround(dx * dx + dy * dy)
                < ETHER_DRAIN_BROAD_QUERY_RADIUS * ETHER_DRAIN_BROAD_QUERY_RADIUS
            })
            .map(({ id }) => id)
          actor = {
            ...actor,
            hitTargetIds: Object.freeze(retainedIds),
          }
          refreshCountdown = ETHER_DRAIN_CANDIDATE_REFRESH_TICKS
        }
        actor = { ...actor, quantity: refreshCountdown }

        if (phase !== 2 && activeCountdown > ETHER_DRAIN_GAMEPLAY_CUTOFF_TICKS) {
          for (const targetId of actor.hitTargetIds) {
            const target = context.target(actor.worldKey, targetId)
            if (!target) continue
            const dx = Math.fround(actor.position.x - target.position.x)
            const dy = Math.fround(actor.position.y - target.position.y)
            const distanceSquared = Math.fround(dx * dx + dy * dy)
            if (distanceSquared > ETHER_DRAIN_PRESSURE_RADIUS_SQUARED) continue
            const falloff = Math.max(
              0.1,
              1 - distanceSquared / ETHER_DRAIN_PRESSURE_RADIUS_SQUARED,
            )
            if (distanceSquared > 0) {
              const inverseDistance = 1 / Math.sqrt(distanceSquared)
              knockbacks.push({
                delta: {
                  x: dx * inverseDistance * intensity * 1.1 * falloff,
                  y: dy * inverseDistance * intensity * 1.1 * falloff,
                },
                sourceActorId: actor.id,
                targetId: target.id,
              })
            }
            if (distanceSquared < ETHER_DRAIN_CONTACT_RADIUS_SQUARED) {
              let multiplier = 1
              if (distanceSquared < ETHER_DRAIN_CONTACT_DOUBLE_RADIUS_SQUARED) multiplier *= 2
              if (distanceSquared < ETHER_DRAIN_CONTACT_QUADRUPLE_RADIUS_SQUARED) multiplier *= 2
              if (((target.nativeFlags ?? 0) & 1) !== 0) multiplier *= 2
              addDamage(actor, target, actor.damage / 100 * multiplier, 'magic')
              const contactLane = drawNativeFloat(rng, Math.fround(0.5))
              rng = contactLane.state
            }
          }
        }
        break
      }
      case 'ether-drain-cloud': {
        const phase = Math.fround(sourceActor.phase + sourceActor.slowFactor)
        actor = {
          ...actor,
          phase,
          position: {
            x: Math.fround(sourceActor.position.x + sourceActor.velocity.x * sourceActor.quantity),
            y: Math.fround(sourceActor.position.y + sourceActor.velocity.y * sourceActor.quantity),
          },
        }
        retain = phase <= ETHER_DRAIN_CLOUD_TERMINAL_PHASE
        break
      }
      case 'ether-drain-debris': {
        const oscillationRotation = drawNativeFloat(rng, 17)
        const speedGate = drawNativeInteger(oscillationRotation.state, 100)
        const spriteRotation = drawNativeFloat(speedGate.state, 5)
        rng = spriteRotation.state
        const remainingDistance = Math.fround(
          sourceActor.quantity - sourceActor.slowFactor,
        )
        let speed = Math.fround(
          sourceActor.slowFactor + ETHER_DRAIN_DEBRIS_SPEED_GAIN,
        )
        if (speedGate.value === 3) speed = Math.fround(speed * Math.fround(0.5))
        const oscillationDegrees = Math.fround(
          sourceActor.phase + 3 + oscillationRotation.value,
        )
        const rotationRadians = normalizeRadians(
          sourceActor.rotationRadians + (3 + spriteRotation.value) * Math.PI / 180,
        )
        const perpendicularDistance = Math.fround(
          Math.sin(oscillationDegrees * Math.PI / 180) * remainingDistance / 7,
        )
        actor = {
          ...actor,
          phase: oscillationDegrees,
          position: {
            x: Math.fround(
              sourceActor.endpoint.x
              + remainingDistance * sourceActor.velocity.x
              + perpendicularDistance * sourceActor.velocity.y,
            ),
            y: Math.fround(
              sourceActor.endpoint.y
              + remainingDistance * sourceActor.velocity.y
              - perpendicularDistance * sourceActor.velocity.x,
            ),
          },
          quantity: remainingDistance,
          rotationRadians,
          slowFactor: speed,
        }
        if (remainingDistance <= 0) {
          const parentId = sourceActor.hitTargetIds[0]
          if (parentId !== undefined) etherDrainPulseParentIds.add(parentId)
          retain = false
        }
        break
      }
      case 'ether-drain-capture-flare':
        actor = {
          ...actor,
          alpha: Math.max(0, Math.fround(
            sourceActor.alpha - ETHER_DRAIN_SCALE_OUT_PER_TICK,
          )),
        }
        retain = actor.alpha > 0
        break
      case 'comet': {
        const trailBrightness = drawNativeFloat(rng, Math.fround(0.5))
        const trailRotation = drawNativeFloat(trailBrightness.state, 360)
        const trailRotationDirection = drawNativeInteger(trailRotation.state, 2)
        const trailScale = drawNativeFloat(
          trailRotationDirection.state,
          Math.fround(0.5),
        )
        rng = trailScale.state
        state = spawn(state, actorSeed({
          alpha: Math.fround(0.5 + trailBrightness.value),
          kind: 'comet-trail',
          lifetimeTicks: 21,
          ownerId: actor.ownerId,
          phase: Math.fround(
            Math.fround(0.5) * Math.fround(0.5 + trailScale.value),
          ),
          position: actor.position,
          quantity: trailRotationDirection.value === 1
            ? Math.fround(0.99)
            : Math.fround(1.015),
          rotationRadians: trailRotation.value * Math.PI / 180,
          scale: Math.fround(2.5),
          skillId: 76,
          worldKey: actor.worldKey,
        }))

        const remainingTicks = COMET_FALL_TICKS - actor.ageTicks
        if (sourceActor.variant === 0
          && remainingTicks < COMET_WARNING_TICKS_REMAINING) {
          actor = { ...actor, variant: 1 }
          state = emit(
            state,
            eventSeed(actor, context.tick, 'comet-whistle', 'whistle'),
          )
        }
        if (remainingTicks <= 0) {
          for (const target of candidates(actor, 400)) addDamage(actor, target, actor.damage, 'ice')
          const freezeWave = spawnFreezeWaveProgram(state, rng, {
            enhanced: actor.enhanced,
            freezeTicks: actor.freezeTicks,
            maximumRingOfIce: actor.quantity === 1,
            ownerId: actor.ownerId,
            position: actor.position,
            rank: actor.rank,
            skillId: 76,
            worldKey: actor.worldKey,
          })
          state = freezeWave.state
          rng = freezeWave.rng
          state = spawn(state, actorSeed({
            kind: 'comet-impact',
            lifetimeTicks: COMET_IMPACT_LIFETIME_TICKS,
            ownerId: actor.ownerId,
            position: actor.position,
            rank: actor.rank,
            skillId: 76,
            worldKey: actor.worldKey,
          }))
          const initialAngle = drawNativeFloat(rng, 360)
          rng = initialAngle.state
          let accumulatedAngle = 0
          do {
            const verticalVelocity = drawNativeFloat(rng, 3)
            const height = drawNativeFloat(verticalVelocity.state, 20)
            const rotation = drawNativeFloat(height.state, 360)
            const rotationVelocity = drawNativeFloat(rotation.state, 10)
            const record = drawNativeInteger(rotationVelocity.state, 5)
            const scale = drawNativeFloat(record.state, 0.25, true)
            const radialOffset = drawNativeFloat(scale.state, 10)
            const horizontalSpeed = drawNativeFloat(radialOffset.state, 2.5)
            const life = drawNativeFloat(horizontalSpeed.state, 1, true)
            const angleStep = drawNativeFloat(life.state, 3, true)
            rng = angleStep.state

            const directionRadians = (initialAngle.value + accumulatedAngle) * Math.PI / 180
            const direction = {
              x: Math.cos(directionRadians),
              y: -Math.sin(directionRadians),
            }
            const speed = Math.fround(0.5 + horizontalSpeed.value)
            const bounceVelocity = Math.fround(
              Math.fround(-(2 + verticalVelocity.value)) * 1.25,
            )
            const distance = Math.fround(80 + radialOffset.value)
            state = spawn(state, actorSeed({
              alpha: Math.fround(1.5 * Math.fround(1 + life.value)),
              endpoint: { x: bounceVelocity, y: bounceVelocity },
              kind: 'comet-debris',
              lifetimeTicks: COMET_IMPACT_LIFETIME_TICKS,
              ownerId: actor.ownerId,
              phase: Math.fround(-height.value),
              position: {
                x: Math.fround(actor.position.x + direction.x * distance),
                y: Math.fround(actor.position.y + direction.y * distance),
              },
              rank: actor.rank,
              rotationRadians: rotation.value * Math.PI / 180,
              scale: Math.fround(0.8 + scale.value),
              skillId: 76,
              slowFactor: (1 + rotationVelocity.value) * Math.PI / 180,
              variant: record.value,
              velocity: {
                x: Math.fround(direction.x * 1.5 * speed),
                y: Math.fround(direction.y * speed),
              },
              worldKey: actor.worldKey,
            }))
            accumulatedAngle = Math.fround(
              accumulatedAngle + 8 + angleStep.value,
            )
          } while (accumulatedAngle < 360)
          state = emit(state, {
            ...eventSeed(actor, context.tick, 'explode-steam', 'impact'),
            screenFlash: REGION_FLASH_COMET,
          })
          state = emit(state, eventSeed(actor, context.tick, 'magic-shield-explode', 'impact'))
          state = emit(state, eventSeed(actor, context.tick, 'big-fire', 'impact'))
          state = emit(state, eventSeed(actor, context.tick, 'ring-of-ice', 'impact'))
          retain = false
        }
        break
      }
      case 'comet-trail': {
        const life = Math.fround(
          sourceActor.phase - COMET_TRAIL_LIFE_PER_TICK,
        )
        if (life <= 0) {
          retain = false
          break
        }
        actor = {
          ...actor,
          phase: life,
          rotationRadians: Math.fround(
            sourceActor.rotationRadians * sourceActor.quantity,
          ),
        }
        break
      }
      case 'comet-impact':
        break
      case 'comet-debris': {
        if (sourceActor.phase !== 0 && context.tick % 3 === 0) break
        let position = sourceActor.position
        let velocity = sourceActor.velocity
        let height = sourceActor.phase
        let verticalVelocity = sourceActor.endpoint.x
        let bounceVelocity = sourceActor.endpoint.y
        let rotationVelocity = sourceActor.slowFactor
        if (sourceActor.phase !== 0) {
          position = {
            x: Math.fround(sourceActor.position.x + sourceActor.velocity.x),
            y: Math.fround(sourceActor.position.y + sourceActor.velocity.y),
          }
          height = Math.fround(sourceActor.phase + sourceActor.endpoint.x)
          verticalVelocity = Math.fround(
            sourceActor.endpoint.x + COMET_DEBRIS_GRAVITY,
          )
          if (height > 0) {
            const rotationSpeed = drawNativeFloat(rng, 10)
            const horizontalDamping = drawNativeInteger(rotationSpeed.state, 2)
            rng = horizontalDamping.state
            rotationVelocity = (1 + rotationSpeed.value) * Math.PI / 180
            bounceVelocity = Math.fround(
              sourceActor.endpoint.y * COMET_DEBRIS_DAMPING,
            )
            verticalVelocity = bounceVelocity
            if (horizontalDamping.value === 1) {
              velocity = {
                x: Math.fround(sourceActor.velocity.x * COMET_DEBRIS_DAMPING),
                y: Math.fround(sourceActor.velocity.y * COMET_DEBRIS_DAMPING),
              }
            }
            if (COMET_DEBRIS_SETTLE_VELOCITY < verticalVelocity) {
              bounceVelocity = 0
              verticalVelocity = 0
              velocity = ZERO
              rotationVelocity = 0
            }
            height = verticalVelocity
          }
        }
        const life = Math.fround(sourceActor.alpha - COMET_DEBRIS_LIFE_PER_TICK)
        actor = {
          ...actor,
          alpha: Math.max(0, life),
          endpoint: { x: verticalVelocity, y: bounceVelocity },
          phase: height,
          position,
          rotationRadians: normalizeRadians(
            sourceActor.rotationRadians + rotationVelocity,
          ),
          slowFactor: rotationVelocity,
          velocity,
        }
        retain = life > 0
        break
      }
      case 'phase-burst':
        actor = {
          ...actor,
          alpha: Math.max(0, Math.fround(
            sourceActor.alpha - Math.fround(0.05),
          )),
        }
        break
      case 'ice-blast':
      case 'storm-strike':
      case 'turn-undead':
        actor = {
          ...actor,
          alpha: Math.max(0, actor.alpha - 0.05),
          scale: actor.scale * 1.1,
        }
        break
      case 'magic-trap-burst':
      case 'dampen-wave':
      case 'mindblast-burst':
        break
      case 'dampened-projectile':
        actor = {
          ...actor,
          position: {
            x: Math.fround(sourceActor.position.x + sourceActor.velocity.x),
            y: Math.fround(sourceActor.position.y + sourceActor.velocity.y),
          },
        }
        break
      case 'flash-response-grow':
        actor = {
          ...actor,
          alpha: Math.max(0, Math.fround(sourceActor.alpha - Math.fround(0.05))),
          scale: Math.fround(sourceActor.scale * Math.fround(1.05)),
        }
        retain = actor.alpha > 0
        break
      case 'flash-response-fade':
        actor = {
          ...actor,
          alpha: Math.max(0, Math.fround(sourceActor.alpha - Math.fround(0.05))),
        }
        retain = actor.alpha > 0
        break
      case 'shield-break':
        actor = {
          ...actor,
          alpha: Math.max(0, Math.fround(sourceActor.alpha - MAGIC_SHIELD_BREAK_ALPHA_LOSS)),
        }
        retain = actor.alpha > 0
        break
      case 'teleport-burst':
        actor = {
          ...actor,
          alpha: Math.max(0, Math.fround(
            sourceActor.alpha - Math.fround(0.1),
          )),
          scale: Math.fround(
            sourceActor.scale * (sourceActor.variant === 0
              ? Math.fround(1.1)
              : Math.fround(0.96)),
          ),
        }
        break
      case 'shield-explosion':
        if (actor.ageTicks === 1) {
          for (const target of candidates(actor, MAGIC_SHIELD_EXPLOSION_CONTACT_RADIUS)) {
            addDamage(actor, target, actor.damage, 'magic')
          }
        }
        break
    }
    if (retain) advancedActors.push(actor)
  }

  const spawnedDuringStep = state.actors.filter(({ id }) => id >= source.nextActorId)
  state = { ...state, actors: [...advancedActors, ...spawnedDuringStep], rng }
  if (earthquakeWobblePhases.size > 0) {
    state = {
      ...state,
      actors: state.actors.map((candidate) => {
        const phase = earthquakeWobblePhases.get(candidate.id)
        return phase === undefined ? candidate : Object.freeze({ ...candidate, phase })
      }),
    }
  }
  if (etherDrainPulseParentIds.size > 0) {
    state = {
      ...state,
      actors: state.actors.map((candidate) => (
        candidate.kind === 'ether-drain'
          && etherDrainPulseParentIds.has(candidate.id)
          ? Object.freeze({ ...candidate, slowFactor: ETHER_DRAIN_CAPTURE_PULSE })
          : candidate
      )),
    }
  }
  for (const request of fireBurnRequests) {
    state = applyFireBurnRequest(state, request)
  }
  for (const request of electricBurnRequests) {
    state = applyElectricBurnRequest(state, request)
  }
  const playerStates: Record<string, NativeSecondaryPlayerState> = {}
  for (const [playerId, authority] of Object.entries(context.players).sort(([a], [b]) => a.localeCompare(b))) {
    let player = state.players[playerId] ?? createNativeSecondaryPlayerState()
    if (
      authority.eligible
      && player.staffCastTicksRemaining > 0
      && player.staffCastTicksRemaining === nativeSecondaryStaffCastDurationTicks(
        authority.skillBook,
      )
      && source.events.some((event) => (
        event.ownerId === playerId
        && event.tick === context.tick - 1
      ))
    ) staffCastPulsePlayerIds.add(playerId)
    const planewalkerWasActive = player.planewalkerTicksRemaining > 0
    const stoneskinWasActive = player.stoneskinTicksRemaining > 0
    player = stepPlayerState(player, authority)
    player = recalculateReserve(player, authority)
    if (planewalkerWasActive && player.planewalkerTicksRemaining === 0) {
      state = emit(state, {
        actorId: null,
        cue: 'planewalker-off',
        kind: 'toggle-off',
        ownerId: playerId,
        pitch: 1,
        position: authority.character.position,
        skillId: 12,
        tick: context.tick,
        worldKey: authority.worldKey,
      })
    }
    if (stoneskinWasActive && player.stoneskinTicksRemaining === 0) {
      state = emit(state, {
        actorId: null,
        cue: 'stoneskin',
        kind: 'pulse',
        ownerId: playerId,
        pitch: 1,
        position: authority.character.position,
        skillId: 46,
        tick: context.tick,
        worldKey: authority.worldKey,
      })
    }
    if (!authority.eligible || player.reservedMana > authority.maximumMana) {
      const overloaded = player.firewalker || player.mindstar || player.regenerate
      player = clearPlayerToggles(player)
      if (overloaded && authority.eligible) {
        overloadedPlayerIds.add(playerId)
        state = emit(state, {
          actorId: null,
          cue: 'fizzle',
          kind: 'overload',
          ownerId: playerId,
          pitch: 1,
          position: authority.character.position,
          skillId: player.lastSkillId ?? 78,
          tick: context.tick,
          worldKey: authority.worldKey,
        })
      }
    }

    if (player.regenerate && authority.eligible) healthRecovered[playerId] = 1.5 / 100
    if (player.planewalkerTicksRemaining > 0 && authority.eligible) {
      primaryOverridePlayerIds.add(playerId)
      const rawPrimaryHeld = authority.input.cast.primary && authority.input.aim !== null
      if (rawPrimaryHeld && !player.planeOrbHeld) {
        const aim = authority.input.aim ?? authority.character.position
        const direction = unit(authority.character.position, aim)
        const maximumScale = drawNativeFloat(state.rng, 1.5)
        state = { ...state, rng: maximumScale.state }
        state = spawn(state, actorSeed({
          damage: resolveNativeSkillDamageValue(
            80,
            nativePlaneOrbDamage(authority.skillBook),
            authority.offensiveFactors,
          ),
          enhanced: authority.enhancedEffects,
          kind: 'plane-orb-shot',
          lifetimeTicks: 1_125,
          ownerId: playerId,
          phase: 1,
          position: authority.character.position,
          radius: 1,
          rotationRadians: Math.atan2(direction.y, direction.x),
          scale: 0.5,
          skillId: 12,
          slowFactor: 1 + maximumScale.value,
          velocity: { x: direction.x * 1.75, y: direction.y * 1.75 },
          worldKey: authority.worldKey,
        }))
        state = spawnPlaneOrbBirthParticles(
          state,
          playerId,
          authority.character.position,
          authority.worldKey,
        )
        state = emit(state, castEvent(
          playerId, 12, authority, context.tick, 'cast', 'distort-reality',
        ))
        state = emit(state, {
          ...castEvent(
            playerId, 12, authority, context.tick, 'pulse', 'lightning-start',
          ),
          pitch: 2,
          screenFlash: REGION_FLASH_PLANE_ORB,
        })
      }
      player = { ...player, planeOrbHeld: rawPrimaryHeld }
    } else if (player.planeOrbHeld) {
      player = { ...player, planeOrbHeld: false }
    }
    if (player.firewalker && authority.eligible && context.tick % 10 === 0) {
      const geometrySequence = state.firewalkerGeometrySequence
      state = spawnFirewalkerPatch(
        state,
        playerId,
        authority,
        geometrySequence === 0,
      )
      state = {
        ...state,
        firewalkerGeometrySequence: (geometrySequence + 1) % 3,
      }
    }

    const slot = authority.input.cast.quickbar
    const pressed = slot !== null && slot !== player.heldSlot
    if (pressed) {
      const entry = authority.belt[slot]
      const quickbarSkillId = entry?.kind === 'skill' ? entry.skillId : null
      if (quickbarSkillId !== null && nativeSkillCategory(quickbarSkillId) === 2) {
        const skillId = quickbarSkillId as NativeSecondaryAbilityId
        const cast = castAbility(state, player, playerId, skillId, authority, context)
        state = cast.state
        player = cast.player
        if (cast.manaRecovered > 0) {
          manaRecovered[playerId] = (manaRecovered[playerId] ?? 0) + cast.manaRecovered
        }
        if (cast.manaUnderflow) manaUnderflowPlayerIds.add(playerId)
        if (cast.manaSpent > 0) manaSpent[playerId] = cast.manaSpent
        if (cast.relocated) relocatedPlayers[playerId] = cast.relocated
        if (cast.facingHeadingIndex !== null) {
          facingHeadingIndexes[playerId] = cast.facingHeadingIndex
        }
        cast.removedProjectileIds.forEach((id) => removedProjectileIds.add(id))
        cast.disruptedTargetIds.forEach((id) => disruptedTargetIds.add(id))
        cast.dispelledShieldTargetIds.forEach((id) => dispelledShieldTargetIds.add(id))
      }
    }
    if (player.reservedMana > authority.maximumMana) {
      const overloaded = player.firewalker || player.mindstar || player.regenerate
      player = clearPlayerToggles(player)
      if (overloaded) {
        overloadedPlayerIds.add(playerId)
        state = emit(state, {
          actorId: null,
          cue: 'fizzle',
          kind: 'overload',
          ownerId: playerId,
          pitch: 1,
          position: authority.character.position,
          skillId: player.lastSkillId ?? 78,
          tick: context.tick,
          worldKey: authority.worldKey,
        })
      }
    }
    if (player.planewalkerTicksRemaining > 0 && authority.eligible) {
      primaryOverridePlayerIds.add(playerId)
    }
    player = { ...player, heldSlot: slot }
    playerStates[playerId] = player
  }
  state = {
    ...state,
    players: playerStates,
    events: state.events.length <= EVENT_CAPACITY
      ? state.events
      : state.events.slice(-EVENT_CAPACITY),
  }
  state = enrollNativeSecondaryLightOwners(state, context)
  return {
    damage: Object.freeze(damage),
    dispelledShieldTargetIds: Object.freeze([...dispelledShieldTargetIds].sort((a, b) => a - b)),
    disruptedTargetIds: Object.freeze([...disruptedTargetIds].sort((a, b) => a - b)),
    facingHeadingIndexes: Object.freeze(facingHeadingIndexes),
    headingPerturbations: Object.freeze(headingPerturbations),
    healthRecovered: Object.freeze(healthRecovered),
    knockbacks: Object.freeze(knockbacks),
    manaRecovered: Object.freeze(manaRecovered),
    manaUnderflowPlayerIds: Object.freeze([...manaUnderflowPlayerIds].sort()),
    manaSpent: Object.freeze(manaSpent),
    overloadedPlayerIds: Object.freeze([...overloadedPlayerIds].sort()),
    primaryOverridePlayerIds: Object.freeze([...primaryOverridePlayerIds].sort()),
    relocatedPlayers: Object.freeze(relocatedPlayers),
    removedProjectileIds: Object.freeze([...removedProjectileIds].sort((a, b) => a - b)),
    staffCastPulsePlayerIds: Object.freeze([...staffCastPulsePlayerIds].sort()),
    state,
    steamedPulses: Object.freeze(steamedPulses),
  }
}

interface CastResult {
  readonly dispelledShieldTargetIds: readonly number[]
  readonly disruptedTargetIds: readonly number[]
  readonly manaRecovered: number
  readonly manaUnderflow: boolean
  readonly manaSpent: number
  readonly facingHeadingIndex: number | null
  readonly player: NativeSecondaryPlayerState
  readonly relocated: Vector2 | null
  readonly removedProjectileIds: readonly number[]
  readonly state: NativeSecondarySimulationState
}

function resolvedSecondaryAbilityRankStats(
  authority: Pick<NativeSecondaryPlayerAuthority, 'offensiveFactors' | 'skillBook'>,
  skillId: NativeSecondaryAbilityId,
): NativeSecondaryAbilityRankStats {
  const ranked = effectiveSecondaryAbilityRankStats(authority.skillBook, skillId)
  const values = Object.fromEntries(Object.entries(ranked.values).map(([property, value]) => {
    if (property === 'mDamage' || property === 'mDamage1' || property === 'mDamage2') {
      return [property, resolveNativeSkillDamageValue(
        skillId,
        value,
        authority.offensiveFactors,
      )]
    }
    return [property, value]
  }))
  return Object.freeze({ ...ranked, values: Object.freeze(values) })
}

export function nativeSecondaryAbilityManaCost(
  authority: Pick<NativeSecondaryPlayerAuthority,
    | 'explosiveShieldRawManaCost'
    | 'golemRawManaCost'
    | 'magicStormRawManaCost'
    | 'offensiveFactors'
    | 'skillBook'
  >,
  skillId: NativeSecondaryAbilityId,
): number {
  const values = resolvedSecondaryAbilityRankStats(
    authority,
    skillId,
  ).values
  let rawCost = values.mManaCost ?? 0
  if (skillId === 27) rawCost += authority.magicStormRawManaCost
  if (skillId === 45) rawCost += authority.golemRawManaCost
  if (skillId === 54) rawCost += authority.explosiveShieldRawManaCost
  return resolveNativeSkillManaCostValue(skillId, rawCost, authority.offensiveFactors)
}

function castAbility(
  source: NativeSecondarySimulationState,
  player: NativeSecondaryPlayerState,
  playerId: string,
  skillId: NativeSecondaryAbilityId,
  authority: NativeSecondaryPlayerAuthority,
  context: NativeSecondaryTickContext,
): CastResult {
  const none = (
    state = source,
    nextPlayer = player,
    manaUnderflow = false,
  ): CastResult => ({
    dispelledShieldTargetIds: [], disruptedTargetIds: [], manaRecovered: 0, manaUnderflow,
    manaSpent: 0, player: nextPlayer,
    facingHeadingIndex: null, relocated: null, removedProjectileIds: [], state,
  })
  if (!authority.eligible) {
    return none(fizzle(source, playerId, skillId, authority, context.tick), {
      ...player, fizzleSequence: player.fizzleSequence + 1, lastSkillId: skillId,
    })
  }
  if (
    player.staffCastTicksRemaining > 0
    || player.castSpinTicksRemaining > 0
    || player.globalCooldownTicks > 0
  ) return none()
  if ((player.cooldownTicksBySkill[skillId] ?? 0) > 0) {
    return none(fizzle(source, playerId, skillId, authority, context.tick), {
      ...player, fizzleSequence: player.fizzleSequence + 1, lastSkillId: skillId,
    })
  }
  const ranked = resolvedSecondaryAbilityRankStats(authority, skillId)
  const v = ranked.values
  const cost = nativeSecondaryAbilityManaCost(authority, skillId)
  const cooldownCapacityTicks = nativeSecondaryCooldownCapacityTicks(
    authority.skillBook,
    skillId,
  )
  const togglingOff = skillId === 12 && player.planewalkerTicksRemaining > 0
    || skillId === 23 && player.firewalker
    || skillId === 78 && player.mindstar
    || skillId === 79 && player.regenerate
  if (!togglingOff && cost > authority.currentMana) {
    return none(fizzle(source, playerId, skillId, authority, context.tick), {
      ...player, fizzleSequence: player.fizzleSequence + 1, lastSkillId: skillId,
    }, true)
  }
  const origin = authority.character.position
  const aim = authority.input.aim ?? origin
  const direction = unit(origin, aim)
  let state = source
  let nextPlayer: NativeSecondaryPlayerState = {
    ...player,
    castSequence: player.castSequence + 1,
    lastSkillId: skillId,
  }
  let manaSpent = cost
  let castManaRecovered = 0
  let relocated: Vector2 | null = null
  let facingHeadingIndex: number | null = null
  let removedProjectileIds: readonly number[] = []
  let disruptedTargetIds: readonly number[] = []
  let dispelledShieldTargetIds: readonly number[] = []
  let postCastCue: NativeSecondaryAudioCue | null = null
  const spawnActor = (seed: Partial<NativeSecondaryActorState> & Pick<NativeSecondaryActorState, 'kind' | 'skillId'>) => {
    state = spawn(state, actorSeed({
      ...seed,
      ownerId: playerId,
      position: seed.position ?? aim,
      rank: ranked.rank,
      worldKey: authority.worldKey,
    }))
  }

  switch (skillId) {
    case 11: {
      const birth = createNativeLeviathanBirth(
        state.rng,
        v.mQuantity,
        authority.maximumLeviathan,
      )
      state = { ...state, rng: birth.rng }
      const damage = v.mDamage * (authority.maximumLeviathan ? 2 : 1)
      const parentId = state.nextActorId
      spawnActor({
        damage,
        enhanced: authority.enhancedEffects,
        kind: 'leviathan',
        lifetimeTicks: NATIVE_LEVIATHAN_LIFETIME_TICKS,
        position: aim,
        quantity: birth.quantity,
        radius: Math.fround(birth.maximumScale * 30),
        rotationRadians: birth.rotationRadians,
        skillId,
        scale: 0,
        slowFactor: birth.maximumScale,
      })
      for (let index = 0; index < birth.appendages.length; index += 1) {
        const appendage = birth.appendages[index]!
        spawnActor({
          damage,
          endpoint: appendage.baseOffset,
          frame: Math.round(
            nativeLeviathanHeadingVector(appendage.headingDegrees).y * 100,
          ) + 100,
          hitTargetIds: [parentId],
          kind: 'leviathan-appendage',
          lifetimeTicks: NATIVE_LEVIATHAN_LIFETIME_TICKS,
          phase: appendage.bank,
          position: aim,
          quantity: appendage.countdown,
          radius: appendage.spriteScale,
          rotationRadians: appendage.headingDegrees * Math.PI / 180,
          scale: 0,
          skillId,
          slowFactor: 1,
          variant: index,
          velocity: {
            x: appendage.spinDegrees,
            y: appendage.spinStepDegrees,
          },
        })
      }
      break
    }
    case 12:
      if (player.planewalkerTicksRemaining > 0) {
        manaSpent = 0
        nextPlayer = { ...nextPlayer, planewalkerTicksRemaining: 0, planeOrbHeld: false }
        state = emit(state, castEvent(
          playerId,
          skillId,
          authority,
          context.tick,
          'toggle-off',
          'planewalker-off',
        ))
        nextPlayer = startStaffCast(nextPlayer, authority.skillBook)
        ;({ player: nextPlayer, state } = withCooldown(
          state,
          nextPlayer,
          skillId,
          cooldownCapacityTicks,
          authority,
        ))
        return none(state, nextPlayer)
      }
      nextPlayer = {
        ...nextPlayer,
        planewalkerTicksRemaining: Math.max(
          nextPlayer.planewalkerTicksRemaining,
          Math.round(v.mDuration * 100),
        ),
      }
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'pulse', null),
        screenFlash: REGION_FLASH_PLANEWALKER,
      })
      break
    case 15: {
      const phasingDirection = actorHeadingVector(authority.character.headingIndex)
      relocated = context.phasingDestination(playerId, origin, phasingDirection)
      if (!relocated) {
        nextPlayer = startStaffCast(nextPlayer, authority.skillBook)
        ;({ player: nextPlayer, state } = withCooldown(
          state,
          nextPlayer,
          skillId,
          cooldownCapacityTicks,
          authority,
        ))
        return {
          dispelledShieldTargetIds,
          disruptedTargetIds,
          facingHeadingIndex: null,
          manaRecovered: castManaRecovered,
          manaUnderflow: false,
          manaSpent,
          player: nextPlayer,
          relocated: null,
          removedProjectileIds,
          state,
        }
      }
      const phaseMarker = {
        x: Math.fround(origin.x + phasingDirection.x * 10),
        y: Math.fround(origin.y + phasingDirection.y * 10),
      }
      spawnActor({
        kind: 'phase-burst',
        lifetimeTicks: 20,
        position: phaseMarker,
        rotationRadians: Math.atan2(phasingDirection.y, phasingDirection.x),
        scale: 2,
        skillId,
      })
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'pulse', null),
        position: phaseMarker,
        screenFlash: REGION_FLASH_PHASING,
      })
      break
    }
    case 21:
      for (let index = 0; index < 30; index += 1) {
        const phase = drawNativeFloat(state.rng, FIRE_FRAME_COUNT); state = { ...state, rng: phase.state }
        const mirror = drawNativeSign(state.rng, 1); state = { ...state, rng: mirror.state }
        const jitter = drawNativeFloat(state.rng, 2, true); state = { ...state, rng: jitter.state }
        const radialJitter = drawNativeFloat(state.rng, 30); state = { ...state, rng: radialJitter.state }
        const radialDirection = drawNativeUnitVector(state.rng); state = { ...state, rng: radialDirection.rng }
        const speedJitter = drawNativeFloat(state.rng, 0.025); state = { ...state, rng: speedJitter.state }
        const radians = (index * 12 + jitter.value) * Math.PI / 180
        const heading = {
          x: Math.sin(radians),
          y: -Math.cos(radians),
        }
        const radialDistance = radialJitter.value
        spawnActor({
          kind: 'moving-fire',
          lifetimeTicks: nativeFireLifetimeTicks(RING_FIRE_INITIAL_LIFE),
          phase: phase.value,
          position: {
            x: Math.fround(
              origin.x + heading.x * 25
                + radialDirection.value.x * radialDistance,
            ),
            y: Math.fround(
              origin.y + heading.y * 25
                + radialDirection.value.y * radialDistance * 0.8,
            ),
          },
          quantity: mirror.value,
          radius: 0,
          rotationRadians: radians,
          scale: 2.75,
          skillId,
          slowFactor: RING_FIRE_INITIAL_LIFE,
          variant: index,
          velocity: {
            x: Math.fround(heading.x * 2.5 * (1 - speedJitter.value)),
            y: Math.fround(heading.y * 2.5 * (1 - speedJitter.value)),
          },
        })
      }
      spawnActor({
        damage: v.mDamage,
        kind: 'shockwave',
        lifetimeTicks: 116,
        phase: SHOCKWAVE_INITIAL_LIFE,
        position: origin,
        quantity: SHOCKWAVE_RADIUS_GROWTH_PER_TICK,
        radius: 75,
        skillId,
        slowFactor: SHOCKWAVE_FADE_THRESHOLD,
        variant: authority.maximumRingOfFire ? 1 : 0,
      })
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'cast', 'big-fire'),
        cameraMagnitude: 0.25,
        screenFlash: REGION_FLASH_RING_FIRE,
      })
      state = emit(state, castEvent(playerId, skillId, authority, context.tick, 'pulse', 'nuke'))
      break
    case 23: {
      manaSpent = 0
      const active = !player.firewalker
      nextPlayer = { ...nextPlayer, firewalker: active }
      nextPlayer = recalculateReserve(nextPlayer, authority)
      if (active) {
        state = spawnFirewalkerPatch(state, playerId, authority, true)
        nextPlayer = startStaffCast(nextPlayer, authority.skillBook)
        ;({ player: nextPlayer, state } = withCooldown(
          state,
          nextPlayer,
          skillId,
          cooldownCapacityTicks,
          authority,
        ))
      }
      state = emit(state, {
        ...castEvent(
          playerId,
          skillId,
          authority,
          context.tick,
          active ? 'toggle-on' : 'toggle-off',
          active ? 'ignite' : null,
        ),
        screenFlash: REGION_FLASH_FIRE,
      })
      return none(state, nextPlayer)
    }
    case 27: {
      const activeTicks = (authority.maximumMagicStorm ? 2_000 : 1_000)
        + authority.magicStormDurationBonusTicks
      const moving = (authority.skillBook.effectiveRanks[28] ?? 0) > 0
      const presentationRng = state.rng
      const visualPhase = drawNativeFloat(state.rng, 1, true)
      state = { ...state, rng: visualPhase.state }
      for (let index = 0; index < 15; index += 1) {
        const angle = drawNativeFloat(state.rng, 360)
        const speed = drawNativeFloat(angle.state, 2)
        state = { ...state, rng: speed.state }
      }
      const heading = moving ? drawNativeFloat(state.rng, 360) : null
      if (heading !== null) state = { ...state, rng: heading.state }
      spawnActor({
        alpha: 0,
        damage: v.mDamage1,
        enhanced: authority.enhancedEffects,
        freezeTicks: activeTicks,
        kind: 'storm-cloud',
        lifetimeTicks: activeTicks + 101,
        phase: v.mDamage2,
        presentationRng,
        quantity: 50,
        radius: STORM_QUERY_RADIUS,
        rotationRadians: (heading?.value ?? 0) * Math.PI / 180,
        slowFactor: authority.magicStormFrequencyFactor,
        scale: Math.fround(0.01),
        skillId,
        variant: moving ? 1 : 0,
      })
      break
    }
    case 30: {
      const angularSign = drawNativeSign(state.rng, 1)
      const flashColor = drawNativeInteger(
        angularSign.state,
        PRISMATIC_REGION_FLASH_COLORS.length,
      )
      state = { ...state, rng: flashColor.state }
      const [red, green, blue] = PRISMATIC_REGION_FLASH_COLORS[flashColor.value]!
      for (const target of stableTargets(context.targets(
        authority.worldKey,
        origin,
        PRISMATIC_QUERY_RADIUS,
      ))) {
        state = mergeEffect(state, authority.worldKey, target.id, {
          prismaticTicks: Math.round(v.mDuration * 100),
        })
      }
      spawnActor({
        alpha: 0,
        freezeTicks: Math.round(v.mDuration * 100),
        kind: 'prismatic-wave',
        lifetimeTicks: PRISMATIC_PRESENTATION_LIFETIME_TICKS,
        phase: authority.character.headingIndex * 15,
        position: { x: origin.x, y: origin.y - 25 },
        presentationRng: flashColor.state,
        radius: PRISMATIC_QUERY_RADIUS,
        scale: 2,
        skillId,
        slowFactor: angularSign.value,
      })
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'cast', 'prismatic-shock'),
        screenFlash: screenFlash(red, green, blue, 0.05, true),
      })
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'pulse', 'lightning-start'),
        pitch: 0.8,
      })
      break
    }
    case 35:
      state = spawnFreezeWaveProgram(state, state.rng, {
        enhanced: authority.enhancedEffects,
        freezeTicks: Math.trunc(v.mDamage * authority.freezeDurationMultiplier * 100),
        maximumRingOfIce: authority.maximumRingOfIce,
        ownerId: playerId,
        position: origin,
        rank: ranked.rank,
        skillId,
        worldKey: authority.worldKey,
      }).state
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'pulse', null),
        screenFlash: REGION_FLASH_RING_ICE,
      })
      break
    case 41:
      {
        const rotation = drawNativeFloat(state.rng, 360)
        state = { ...state, rng: rotation.state }
        const scenery = (context.sceneryTargets?.(
          authority.worldKey,
          origin,
          EARTHQUAKE_QUERY_RADIUS,
        ) ?? []).filter((target) => (
          squaredDistance(origin, target.position)
            < EARTHQUAKE_QUERY_RADIUS * EARTHQUAKE_QUERY_RADIUS
        ))
        const shuffledScenery = shuffleFixedBound(scenery, state.rng)
        state = { ...state, rng: shuffledScenery.rng }
        const durationTicks = Math.round(v.mDuration * 100)
        const earthquakeId = state.nextActorId
        spawnActor({
          alpha: 1,
          enhanced: authority.enhancedEffects,
          kind: 'earthquake',
          lifetimeTicks: durationTicks,
          phase: EARTHQUAKE_PHASE_START,
          position: origin,
          quantity: EARTHQUAKE_OVERLAY_START,
          radius: EARTHQUAKE_QUERY_RADIUS,
          rotationRadians: rotation.value * Math.PI / 180,
          skillId,
        })
        const sceneryActorIds: number[] = []
        for (const target of shuffledScenery.values) {
          let sceneryActor = state.actors.find((actor) => (
            actor.kind === 'earthquake-scenery-wobble'
            && actor.worldKey === authority.worldKey
            && actor.targetId === target.id
          ))
          if (!sceneryActor) {
            const sceneryActorId = state.nextActorId
            spawnActor({
              kind: 'earthquake-scenery-wobble',
              lifetimeTicks: Number.MAX_SAFE_INTEGER,
              position: target.position,
              skillId,
              targetId: target.id,
              variant: target.typeId,
            })
            sceneryActor = state.actors.find(({ id }) => id === sceneryActorId)
          }
          if (!sceneryActor) throw new Error('Earthquake lost its scenery wobble carrier')
          sceneryActorIds.push(sceneryActor.id)
        }
        state = {
          ...state,
          actors: state.actors.map((actor) => actor.id === earthquakeId
            ? Object.freeze({ ...actor, hitTargetIds: Object.freeze(sceneryActorIds) })
            : actor),
        }
        state = emit(state, {
          ...castEvent(playerId, skillId, authority, context.tick, 'pulse', null),
          screenFlash: REGION_FLASH_EARTHQUAKE,
        })
      }
      break
    case 45: {
      const owned = state.actors.filter((actor) => actor.kind === 'golem' && actor.ownerId === playerId)
      const cap = authority.maximumGolem ? 2 : 1
      if (owned.length >= cap) {
        const retired = [...owned].sort((a, b) => (
          (a.golem?.currentHealth ?? 0) - (b.golem?.currentHealth ?? 0)
          || a.id - b.id
        ))[0]!
        state = { ...state, actors: state.actors.filter(({ id }) => id !== retired.id) }
      }
      const placementSign = drawNativeSign(state.rng, 45)
      state = { ...state, rng: placementSign.state }
      const placementHeading = Math.fround(
        authority.character.headingIndex * 15 + placementSign.value,
      )
      const placementDirection = nativeHeadingVector(placementHeading)
      const requestedPosition = {
        x: Math.fround(origin.x + Math.fround(placementDirection.x * 100)),
        y: Math.fround(origin.y + Math.fround(placementDirection.y * 100)),
      }
      const placement = context.golemPlacement(
        playerId,
        authority.worldKey,
        requestedPosition,
        state.rng,
      )
      state = { ...state, rng: placement.rng }
      facingHeadingIndex = actorHeadingIndex(placementHeading)
      const pose = drawNativeInteger(state.rng, 2)
      state = { ...state, rng: pose.state }
      const golemRotationRadians = normalizeRadians(
        (placementHeading + 180) * Math.PI / 180,
      )
      spawnActor({
        damage: v.mDamage1,
        golem: Object.freeze({
          ...nativeInitialGolemArticulation(
            placement.position,
            golemRotationRadians,
            (currentPosition, requestedPosition) => context.golemFootPlacement?.(
              playerId,
              authority.worldKey,
              currentPosition,
              requestedPosition,
            ) ?? requestedPosition,
          ),
          actionDurationTicks: 0,
          actionTick: 0,
          currentHealth: v.mHP,
          damageMaximum: v.mDamage2,
          iron: authority.golemIron,
          maximumHealth: v.mHP,
          orbitDirection: 0,
          orbitHeadingRadians: null,
          phase: 'assembly',
          poseVariant: pose.value as 0 | 1,
          provokeRollBound: 0,
          reflectFactor: authority.golemReflectFactor,
          targetPollTicksRemaining: 50,
        }),
        kind: 'golem',
        lifetimeTicks: Number.MAX_SAFE_INTEGER,
        position: placement.position,
        quantity: v.mHP,
        radius: NATIVE_GOLEM_RADIUS,
        rotationRadians: golemRotationRadians,
        scale: 1,
        skillId,
        variant: authority.golemIron ? 1 : 0,
      })
      break
    }
    case 46:
      nextPlayer = { ...nextPlayer, stoneskinTicksRemaining: Math.max(nextPlayer.stoneskinTicksRemaining, Math.round(v.mDuration * 100)) }
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'cast', 'stoneskin-on'),
        screenFlash: REGION_FLASH_STONESKIN,
      })
      state = emit(state, castEvent(playerId, skillId, authority, context.tick, 'pulse', 'stoneskin'))
      break
    case 48: {
      const sourceRotation = drawNativeFloat(state.rng, 360)
      state = { ...state, rng: sourceRotation.state }
      spawnActor({
        alpha: 2,
        kind: 'teleport-burst',
        lifetimeTicks: 20,
        position: { x: origin.x, y: origin.y - 15 },
        rotationRadians: sourceRotation.value * Math.PI / 180,
        scale: 1,
        skillId,
      })
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'pulse', 'teleport'),
        position: origin,
        screenFlash: REGION_FLASH_TELEPORT_SOURCE,
      })
      const destination = context.teleportDestination(playerId, state.rng)
      state = { ...state, rng: destination.rng }
      relocated = destination.position
      const destinationRotation = drawNativeFloat(state.rng, 360)
      state = { ...state, rng: destinationRotation.state }
      spawnActor({
        alpha: 2,
        kind: 'teleport-burst',
        lifetimeTicks: 20,
        position: { x: relocated.x, y: relocated.y - 15 },
        rotationRadians: destinationRotation.value * Math.PI / 180,
        scale: 8,
        skillId,
        variant: 1,
      })
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'pulse', 'teleport'),
        position: relocated,
        screenFlash: REGION_FLASH_TELEPORT_DESTINATION,
      })
      break
    }
    case 49: {
      const presentationRng = state.rng
      const visualTick = consumeMagicCircleVisualTick(state.rng, context.tick)
      state = { ...state, rng: visualTick.rng }
      spawnActor({
        alpha: visualTick.intensity,
        kind: 'magic-circle',
        lifetimeTicks: MAGIC_CIRCLE_PRESENTATION_LIFETIME_TICKS,
        phase: context.tick,
        position: aim,
        presentationRng,
        quantity: authority.manaRecoveryPerTick,
        radius: Math.hypot(MAGIC_CIRCLE_HALF_WIDTH, MAGIC_CIRCLE_HALF_HEIGHT),
        scale: 4,
        skillId,
        slowFactor: v.mSlow / 100,
      })
      if (insideRectangle(
        aim,
        origin,
        MAGIC_CIRCLE_HALF_WIDTH,
        MAGIC_CIRCLE_HALF_HEIGHT,
      )) {
        castManaRecovered += authority.manaRecoveryPerTick * 2
        const flash = drawMagicCirclePlayerFlash(state.rng)
        state = { ...state, rng: flash.rng }
        spawnActor({
          alpha: flash.alpha,
          kind: 'magic-circle-player-flash',
          lifetimeTicks: 100,
          position: { x: origin.x, y: origin.y - 15 },
          rotationRadians: flash.rotationRadians,
          scale: flash.scale,
          skillId,
        })
      }
      for (const target of stableTargets(context.targets(
        authority.worldKey,
        aim,
        Math.hypot(MAGIC_CIRCLE_HALF_WIDTH, MAGIC_CIRCLE_HALF_HEIGHT),
      ))) {
        if (!insideRectangle(
          aim,
          target.position,
          MAGIC_CIRCLE_HALF_WIDTH,
          MAGIC_CIRCLE_HALF_HEIGHT,
        )) continue
        state = mergeEffect(state, authority.worldKey, target.id, {
          circleSlowFactor: Math.max(0, 1 - v.mSlow / 100),
          circleSlowTicks: 20,
        })
      }
      break
    }
    case 50: {
      const trapSelector = nativeMagicTrapSelector(authority, state.rng)
      const baseDamage = nativeMagicTrapBaseDamage(
        authority.skillBook,
        trapSelector.selector,
        trapSelector.rng,
      )
      state = { ...state, rng: baseDamage.rng }
      spawnActor({
        damage: Math.fround(baseDamage.value * Math.fround(v.mDamage)),
        frame: 0,
        kind: 'magic-trap',
        lifetimeTicks: Number.MAX_SAFE_INTEGER,
        phase: MAGIC_TRAP_SHIMMER_INITIAL,
        quantity: authority.fireBurnDamage,
        radius: MAGIC_TRAP_ARMING_HALF_EXTENT,
        scale: 0,
        skillId,
        slowFactor: authority.coldSlowFactor,
        variant: trapSelector.selector,
      })
      postCastCue = magicTrapPrimaryCue(trapSelector.selector)
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'pulse', null),
        position: aim,
        screenFlash: magicTrapScreenFlash(trapSelector.selector, 0.1, false),
      })
      break
    }
    case 51: {
      const actionIdentity = drawNativeInteger(state.rng, 100_000)
      state = { ...state, rng: actionIdentity.state }
      const dampen = context.dampenCandidates(authority.worldKey, origin)
      removedProjectileIds = Object.freeze(dampen.projectiles.map(({ id }) => id))
      disruptedTargetIds = dampen.casterTargetIds
      const dispelled: number[] = []
      for (const targetId of [...dampen.shieldTargetIds].sort((a, b) => a - b)) {
        const roll = drawNativeInteger(state.rng, 100)
        state = { ...state, rng: roll.state }
        if (roll.value < 0x33) dispelled.push(targetId)
      }
      dispelledShieldTargetIds = Object.freeze(dispelled)
      for (const targetId of dampen.casterTargetIds) {
        state = mergeEffect(state, authority.worldKey, targetId, { disruptedTicks: 600 })
      }
      nextPlayer = { ...nextPlayer, castSpinTicksRemaining: 73 }
      for (const projectile of dampen.projectiles) {
        spawnActor({
          frame: projectile.ageTicks,
          kind: 'dampened-projectile',
          lifetimeTicks: DAMPEN_PROJECTILE_FLYOUT_LIFETIME_TICKS,
          phase: projectile.visualPhaseDegrees,
          position: projectile.position,
          rotationRadians: projectile.headingDegrees * Math.PI / 180,
          scale: projectile.visualScale,
          skillId,
          targetId: projectile.id,
          variant: dampenedProjectileVariant(projectile),
          velocity: dampenedProjectileVelocity(origin, projectile.position),
        })
      }
      const presentationRng = state.rng
      state = {
        ...state,
        rng: advanceNativeRngWords(
          state.rng,
          DAMPEN_PRESENTATION_RNG_WORDS,
        ),
      }
      spawnActor({
        kind: 'dampen-wave',
        lifetimeTicks: DAMPEN_PRESENTATION_LIFETIME_TICKS,
        position: origin,
        presentationRng,
        skillId,
      })
      state = emit(state, castEvent(playerId, skillId, authority, context.tick, 'cast', 'flash'))
      state = emit(state, castEvent(playerId, skillId, authority, context.tick, 'pulse', 'dampen'))
      break
    }
    case 54:
      nextPlayer = {
        ...nextPlayer,
        magicShieldAbsorb: v.mAbsorb,
        magicShieldExplosionDamage: authority.explosiveShieldDamage,
        magicShieldMaximum: v.mAbsorb,
        magicShieldPulseTicks: 0,
      }
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'pulse', null),
        screenFlash: REGION_FLASH_MAGIC_SHIELD_APPLY,
      })
      break
    case 72: {
      const phase = drawNativeFloat(state.rng, 1)
      state = { ...state, rng: phase.state }
      spawnActor({
        alpha: 0,
        damage: Math.fround(v.mDamage / 6),
        enhanced: authority.enhancedEffects,
        kind: 'acid-rain',
        lifetimeTicks: ACID_RAIN_MAXIMUM_LIFETIME_TICKS,
        phase: 0,
        quantity: ACID_RAIN_INITIAL_PULSE_DELAY_TICKS,
        radius: 400,
        rotationRadians: phase.value,
        scale: ACID_RAIN_INITIAL_SCALE,
        skillId,
      })
      break
    }
    case 73: {
      const normal = { x: -direction.y, y: direction.x }
      for (let index = 0; index < 11; index += 1) {
        const offset = -150 + index * 30
        const phase = drawNativeFloat(state.rng, FIRE_FRAME_COUNT); state = { ...state, rng: phase.state }
        const mirror = drawNativeSign(state.rng, 1); state = { ...state, rng: mirror.state }
        const jitterRadius = drawNativeFloat(state.rng, 10); state = { ...state, rng: jitterRadius.state }
        const jitterDirection = drawNativeUnitVector(state.rng); state = { ...state, rng: jitterDirection.rng }
        spawnActor({
          damage: v.mDamage,
          enhanced: true,
          kind: 'fire-patch',
          lifetimeTicks: nativeFireLifetimeTicks(FIRE_WALL_INITIAL_LIFE),
          phase: phase.value,
          position: {
            x: Math.fround(
              aim.x + normal.x * offset
                + jitterDirection.value.x * jitterRadius.value,
            ),
            y: Math.fround(
              aim.y + normal.y * offset
                + jitterDirection.value.y * jitterRadius.value,
            ),
          },
          quantity: mirror.value,
          radius: 0,
          scale: Math.fround(0.8 + 0.6 * Math.sin(Math.PI * index / 10)),
          skillId,
          slowFactor: FIRE_WALL_INITIAL_LIFE,
          variant: index,
        })
      }
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'cast', 'ignite'),
        position: aim,
        screenFlash: REGION_FLASH_FIRE,
      })
      state = emit(state, castEvent(playerId, skillId, authority, context.tick, 'pulse', 'fireball-hit'))
      break
    }
    case 74:
      {
        const rotation = drawNativeFloat(state.rng, 360); state = { ...state, rng: rotation.state }
        spawnActor({
          alpha: 0,
          damage: v.mDamage,
          enhanced: authority.enhancedEffects,
          freezeTicks: ETHER_DRAIN_ACTIVE_COUNTDOWN_TICKS,
          kind: 'ether-drain',
          lifetimeTicks: 1_061,
          quantity: 0,
          radius: 512,
          rotationRadians: rotation.value * Math.PI / 180,
          scale: 0,
          skillId,
          slowFactor: 0,
        })
        state = emit(state, castEvent(playerId, skillId, authority, context.tick, 'cast', 'distort-reality'))
        state = emit(state, castEvent(playerId, skillId, authority, context.tick, 'pulse', 'lightning-start'))
      }
      break
    case 76: {
      const headingSeed = drawNativeFloat(state.rng, 1)
      state = { ...state, rng: headingSeed.state }
      spawnActor({
        damage: v.mDamage,
        enhanced: authority.enhancedEffects,
        freezeTicks: Math.trunc(v.mFreeze * authority.freezeDurationMultiplier * 100),
        kind: 'comet',
        lifetimeTicks: COMET_FALL_TICKS,
        position: aim,
        quantity: authority.maximumRingOfIce ? 1 : 0,
        radius: 400,
        rotationRadians: Math.atan2(3, headingSeed.value),
        scale: 2,
        skillId,
      })
      break
    }
    case 77:
      for (const target of stableTargets(context.targets(authority.worldKey, origin, 250))) {
        if (!['SKELETON', 'SKELETONARCHER', 'SKELETONMAGE', 'ZOMBIE'].includes(target.family)) continue
        state = mergeEffect(state, authority.worldKey, target.id, {
          fleeTicks: Math.round(v.mFlee * 100),
          weakenFactor: Math.max(0, 1 - v.mWeaken / 100),
        })
      }
      {
        let heading = drawNativeFloat(state.rng, 360); state = { ...state, rng: heading.state }
        for (let index = 0; index < 35; index += 1) {
          const scale = drawNativeFloat(state.rng, 0.5); state = { ...state, rng: scale.state }
          spawnActor({
            kind: 'turn-undead',
            lifetimeTicks: 20,
            position: origin,
            radius: 250,
            rotationRadians: heading.value * Math.PI / 180,
            scale: 1 + scale.value,
            skillId,
            variant: index,
          })
          const increment = drawNativeFloat(state.rng, 40)
          state = { ...state, rng: increment.state }
          heading = {
            ...heading,
            value: Math.fround(heading.value + 20 + increment.value),
          }
        }
      }
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'pulse', 'level-up'),
        pitch: 2,
      })
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, 'pulse', 'level-up'),
        pitch: 3,
      })
      break
    case 78:
    case 79: {
      manaSpent = 0
      const field = skillId === 78 ? 'mindstar' : 'regenerate'
      const active = !player[field]
      nextPlayer = { ...nextPlayer, [field]: active }
      nextPlayer = recalculateReserve(nextPlayer, authority)
      state = emit(state, {
        ...castEvent(playerId, skillId, authority, context.tick, active ? 'toggle-on' : 'toggle-off', 'mindstar'),
        screenFlash: skillId === 78 ? REGION_FLASH_MINDSTAR : REGION_FLASH_FIRE,
      })
      return none(state, nextPlayer)
    }
  }
  ;({ player: nextPlayer, state } = withCooldown(
    state,
    nextPlayer,
    skillId,
    cooldownCapacityTicks,
    authority,
  ))
  if (skillId !== 51) {
    nextPlayer = startStaffCast(nextPlayer, authority.skillBook)
  }
  state = emit(state, castEvent(playerId, skillId, authority, context.tick, 'cast', castCue(skillId)))
  if (postCastCue !== null) {
    state = emit(state, castEvent(
      playerId,
      skillId,
      authority,
      context.tick,
      'pulse',
      postCastCue,
    ))
  }
  return {
    dispelledShieldTargetIds,
    disruptedTargetIds,
    facingHeadingIndex,
    manaRecovered: castManaRecovered,
    manaUnderflow: false,
    manaSpent,
    player: nextPlayer,
    relocated,
    removedProjectileIds,
    state,
  }
}

function applyFireBurnRequest(
  source: NativeSecondarySimulationState,
  request: NativeFireBurnRequest,
): NativeSecondarySimulationState {
  if (request.actor.skillId === 53 || request.actor.skillId === 14) {
    throw new Error('Non-fire status actors cannot author Fire Burn')
  }
  return applyNativeSecondaryFireBurn(source, {
    damage: request.damage,
    ownerId: request.actor.ownerId,
    rank: request.actor.rank,
    skillId: request.actor.skillId ?? 22,
    target: request.target,
    worldKey: request.actor.worldKey,
  })
}

export function applyNativeSecondaryFireBurn(
  source: NativeSecondarySimulationState,
  input: NativeSecondaryFireBurnInput,
): NativeSecondarySimulationState {
  if (!(input.damage > 0)) return source
  const damage = Math.fround(input.damage / FIRE_BURN_LIFETIME_TICKS)
  const existingIndex = source.actors.findIndex((actor) => (
    actor.kind === 'fire-burn'
      && actor.worldKey === input.worldKey
      && actor.targetId === input.target.id
  ))
  if (existingIndex < 0) {
    return spawn(source, actorSeed({
      damage,
      kind: 'fire-burn',
      lightRegistration: input.target.lightRegistration,
      lifetimeTicks: FIRE_BURN_LIFETIME_TICKS,
      miscLightAppendOrdinal: 0,
      ownerId: input.ownerId,
      position: input.target.position,
      rank: input.rank,
      scale: input.target.scale,
      skillId: input.skillId,
      targetId: input.target.id,
      worldKey: input.worldKey,
    }))
  }

  const actors = [...source.actors]
  const existing = actors[existingIndex]!
  actors[existingIndex] = Object.freeze({
    ...existing,
    ageTicks: 0,
    damage: Math.max(existing.damage, damage),
    lifetimeTicks: FIRE_BURN_LIFETIME_TICKS,
    ownerId: input.ownerId,
    position: input.target.position,
    rank: input.rank,
    scale: input.target.scale,
    skillId: input.skillId,
  })
  return { ...source, actors }
}

export function applyNativeSecondaryEtherBurn(
  source: NativeSecondarySimulationState,
  input: NativeSecondaryEtherBurnInput,
): NativeSecondarySimulationState {
  const existingIndex = source.actors.findIndex((actor) => (
    actor.kind === 'ether-burn'
      && actor.worldKey === input.worldKey
      && actor.targetId === input.target.id
  ))
  if (existingIndex < 0) {
    return spawn(source, actorSeed({
      kind: 'ether-burn',
      lightRegistration: input.target.lightRegistration,
      lifetimeTicks: NATIVE_ETHER_BURN_LIFETIME_TICKS,
      miscLightAppendOrdinal: 0,
      ownerId: input.ownerId,
      position: input.target.position,
      rank: input.rank,
      scale: input.target.scale,
      skillId: 14,
      targetId: input.target.id,
      worldKey: input.worldKey,
    }))
  }

  const actors = [...source.actors]
  actors[existingIndex] = Object.freeze({
    ...actors[existingIndex]!,
    ageTicks: 0,
    lifetimeTicks: NATIVE_ETHER_BURN_LIFETIME_TICKS,
    ownerId: input.ownerId,
    position: input.target.position,
    rank: input.rank,
    scale: input.target.scale,
  })
  return { ...source, actors }
}

function applyElectricBurnRequest(
  source: NativeSecondarySimulationState,
  request: NativeElectricBurnRequest,
): NativeSecondarySimulationState {
  if (!(request.damage > 0)) return source
  const damage = Math.fround(
    request.damage / MAGIC_TRAP_ELECTRIC_BURN_LIFETIME_TICKS,
  )
  const existingIndex = source.actors.findIndex((actor) => (
    actor.kind === 'electric-burn'
      && actor.worldKey === request.actor.worldKey
      && actor.targetId === request.target.id
  ))
  if (existingIndex < 0) {
    return spawn(source, actorSeed({
      alpha: 0,
      damage,
      kind: 'electric-burn',
      lightRegistration: request.target.lightRegistration,
      lifetimeTicks: MAGIC_TRAP_ELECTRIC_BURN_LIFETIME_TICKS,
      miscLightAppendOrdinal: 0,
      ownerId: request.actor.ownerId,
      position: request.target.position,
      radius: MAGIC_TRAP_ELECTRIC_BURN_LIGHT_BASE_RADIUS,
      rank: request.actor.rank,
      skillId: request.actor.skillId,
      targetId: request.target.id,
      variant: 2,
      worldKey: request.actor.worldKey,
    }))
  }

  const actors = [...source.actors]
  const existing = actors[existingIndex]!
  const remainingTicks = Math.max(0, existing.lifetimeTicks - existing.ageTicks)
  actors[existingIndex] = Object.freeze({
    ...existing,
    ageTicks: 0,
    alpha: 0,
    damage,
    lifetimeTicks: Math.max(
      remainingTicks,
      MAGIC_TRAP_ELECTRIC_BURN_LIFETIME_TICKS,
    ),
    lightRegistration: request.target.lightRegistration,
    ownerId: request.actor.ownerId,
    phase: 0,
    position: request.target.position,
    rank: request.actor.rank,
    skillId: request.actor.skillId,
  })
  return { ...source, actors }
}

function nativeFireContactDamage(damage: number): number {
  const lane = Math.fround(
    Math.fround(Math.fround(damage / 100) * 3) * Math.fround(0.5),
  )
  return lane + lane
}

function nativeFireLifetimeTicks(initialLife: number): number {
  let remaining = Math.fround(initialLife)
  let ticks = 0
  while (remaining > 0) {
    remaining = Math.fround(remaining - FIRE_LIFE_PER_TICK)
    ticks += 1
  }
  return Math.max(1, ticks)
}

function spawnEtherDrainCloud(
  source: NativeSecondarySimulationState,
  parent: NativeSecondaryActorState,
  sourceRng: NativeRngState,
): { readonly rng: NativeRngState; readonly state: NativeSecondarySimulationState } {
  const scale = drawNativeFloat(sourceRng, Math.fround(1.5))
  const rotation = drawNativeFloat(scale.state, 360)
  const alpha = drawNativeFloat(rotation.state, Math.fround(0.15))
  const speed = drawNativeFloat(alpha.state, 3)
  const record = drawNativeInteger(speed.state, 2)
  const radialDistance = drawNativeFloat(record.state, 100)
  const radialDirection = drawNativeUnitVector(radialDistance.state)
  const position = {
    x: Math.fround(
      parent.position.x + radialDirection.value.x * radialDistance.value,
    ),
    y: Math.fround(
      parent.position.y + radialDirection.value.y * radialDistance.value,
    ),
  }
  const distance = length(position, parent.position)
  const constructorSpeed = Math.fround(5 + speed.value)
  const remainingDistance = Math.fround(distance - 20)
  const phaseStep = remainingDistance >= 0
    ? Math.max(1, 180 / (remainingDistance / constructorSpeed))
    : 10
  const direction = unit(position, parent.position)
  return {
    rng: radialDirection.rng,
    state: spawn(source, actorSeed({
      alpha: Math.fround(0.1 + alpha.value),
      endpoint: parent.position,
      kind: 'ether-drain-cloud',
      lifetimeTicks: 400,
      ownerId: parent.ownerId,
      position,
      quantity: Math.fround(constructorSpeed * Math.fround(0.5)),
      rank: parent.rank,
      rotationRadians: rotation.value * Math.PI / 180,
      scale: Math.fround(1 + scale.value),
      skillId: 74,
      slowFactor: Math.fround(phaseStep * Math.fround(0.5)),
      variant: record.value,
      velocity: direction,
      worldKey: parent.worldKey,
    })),
  }
}

function spawnEtherDrainDebris(
  source: NativeSecondarySimulationState,
  parent: NativeSecondaryActorState,
  sourceRng: NativeRngState,
): { readonly rng: NativeRngState; readonly state: NativeSecondarySimulationState } {
  const oscillationRotation = drawNativeFloat(sourceRng, 360)
  const spriteRotation = drawNativeFloat(oscillationRotation.state, 360)
  const radialDirection = drawNativeUnitVector(spriteRotation.state)
  const record = drawNativeInteger(radialDirection.rng, 3)
  const position = {
    x: Math.fround(
      parent.position.x + radialDirection.value.x * ETHER_DRAIN_DEBRIS_DISTANCE,
    ),
    y: Math.fround(
      parent.position.y + radialDirection.value.y * ETHER_DRAIN_DEBRIS_DISTANCE,
    ),
  }
  const outwardDirection = unit(parent.position, position)
  return {
    rng: record.state,
    state: spawn(source, actorSeed({
      endpoint: parent.position,
      hitTargetIds: [parent.id],
      kind: 'ether-drain-debris',
      lifetimeTicks: 0x7fff_ffff,
      ownerId: parent.ownerId,
      phase: oscillationRotation.value,
      position,
      quantity: length(parent.position, position),
      rank: parent.rank,
      rotationRadians: spriteRotation.value * Math.PI / 180,
      skillId: 74,
      slowFactor: 1,
      variant: record.value,
      velocity: outwardDirection,
      worldKey: parent.worldKey,
    })),
  }
}

function nearestNativeLeviathanTarget(
  origin: Vector2,
  headingDegrees: number,
  targets: readonly NativeSecondaryTarget[],
  context: NativeSecondaryTickContext,
  worldKey: string,
): NativeSecondaryTarget | null {
  return targets
    .filter((target) => (
      ((target.nativeFlags ?? 0x2) & 0x2) !== 0
      && nativeLeviathanInsideTargetLane(origin, headingDegrees, target.position)
      && !(context.lineObstruction?.(worldKey, origin, target.position) ?? false)
    ))
    .sort((left, right) => (
      length(origin, left.position) - length(origin, right.position)
      || left.id - right.id
    ))[0] ?? null
}

function spawnEtherFade(
  source: NativeSecondarySimulationState,
  owner: NativeSecondaryActorState,
  position: Vector2,
  initialLife: number,
  scale: number,
  decrement: number,
  lit: 0 | 1,
  tick: number,
): NativeSecondarySimulationState {
  return spawn(source, actorSeed({
    alpha: Math.fround(initialLife),
    kind: 'ether-fade',
    lifetimeTicks: 19,
    ownerId: owner.ownerId,
    position,
    quantity: tick,
    rank: owner.rank,
    scale: Math.fround(scale),
    skillId: 11,
    slowFactor: Math.fround(decrement),
    variant: lit,
    worldKey: owner.worldKey,
  }))
}

function spawnLeviathanEnhancedMote(
  source: NativeSecondarySimulationState,
  parent: NativeSecondaryActorState,
  currentScale: number,
  sourceRng: NativeRngState,
): { readonly rng: NativeRngState; readonly state: NativeSecondarySimulationState } {
  const heading = drawNativeFloat(sourceRng, 360)
  const verticalJitter = drawNativeFloat(heading.state, 5)
  const scale = drawNativeFloat(verticalJitter.state, 0.5)
  const speed = drawNativeFloat(scale.state, 3)
  const life = drawNativeFloat(speed.state, 0.15)
  const direction = nativeLeviathanHeadingVector(heading.value)
  const velocity = {
    x: Math.fround(speed.value * direction.x),
    y: Math.fround(speed.value * direction.y),
  }
  const decrement = Math.fround(
    Math.fround(0.1) * Math.fround(2 + life.value),
  )
  const birth = {
    x: Math.fround(parent.position.x + currentScale * 20 * direction.x),
    y: Math.fround(
      parent.position.y + currentScale * 20 * direction.y - verticalJitter.value,
    ),
  }
  return {
    rng: life.state,
    state: spawn(source, actorSeed({
      alpha: Math.fround(1 - decrement),
      kind: 'leviathan-mote',
      lifetimeTicks: 10,
      ownerId: parent.ownerId,
      position: {
        x: Math.fround(birth.x + velocity.x),
        y: Math.fround(birth.y + velocity.y),
      },
      quantity: Math.fround(0.5),
      rank: parent.rank,
      rotationRadians: heading.value * Math.PI / 180,
      scale: Math.fround(0.5 + scale.value),
      skillId: 11,
      slowFactor: decrement,
      variant: 11,
      velocity: {
        x: Math.fround(velocity.x * Math.fround(0.95)),
        y: Math.fround(velocity.y * Math.fround(0.95)),
      },
      worldKey: parent.worldKey,
    })),
  }
}

function spawnMaximumRingFireExplosion(
  source: NativeSecondarySimulationState,
  sourceRng: NativeRngState,
  wave: NativeSecondaryActorState,
  target: NativeSecondaryTarget,
  tick: number,
  burnDamage: number,
): Readonly<{
  actor: NativeSecondaryActorState
  contacts: readonly NativeFireEmberContact[]
  rng: NativeRngState
  state: NativeSecondarySimulationState
}> {
  const privateSeed = drawNativeInteger(sourceRng, 1_000_001)
  const detonation = createNativeFireDetonation(
    source.nextActorId + 1,
    {
      burnDamage,
      emberDamage: Math.fround(wave.damage / 3),
      emberFragments: 3,
      explodeDamage: wave.damage,
      explodeRadius: 10 + (1.5 - 1) / 0.18,
      privateSeed: privateSeed.value,
      spentEmber: Object.freeze({ kind: 'none' }),
    },
    target.position,
    wave.ownerId,
    wave.worldKey,
    privateSeed.state,
  )
  let state = spawn(source, actorSeed({
    alpha: 1,
    damage: Math.fround(wave.damage * RING_FIRE_EXPLOSION_DAMAGE_FACTOR),
    kind: 'ring-fire-explosion',
    lifetimeTicks: RING_FIRE_EXPLOSION_LIFETIME_TICKS,
    ownerId: wave.ownerId,
    position: target.position,
    presentationRng: null,
    radius: RING_FIRE_EXPLOSION_RADIUS,
    rank: wave.rank,
    rotationRadians: 0,
    scale: Math.fround(1.5),
    skillId: 21,
    targetId: target.id,
    worldKey: wave.worldKey,
  }))
  const actor = state.actors.at(-1)!
  state = emit(state, {
    ...eventSeed(actor, tick, 'fireball-hit', 'pulse'),
    pitch: detonation.soundPitch,
  })
  state = emit(state, {
    ...eventSeed(actor, tick, 'throw-fire', 'pulse'),
    pitch: Math.fround(0.8),
  })
  for (const ember of detonation.embers) {
    state = spawn(state, actorSeed({
      ageTicks: ember.ageTicks,
      alpha: ember.life,
      damage: ember.damage,
      frame: ember.phase,
      kind: 'ring-fire-fragment',
      lifetimeTicks: RING_FIRE_FRAGMENT_LIFETIME_TICKS,
      ownerId: wave.ownerId,
      phase: ember.height,
      position: ember.position,
      quantity: ember.verticalVelocity === 0 ? 1 : 0,
      radius: 7,
      rank: wave.rank,
      slowFactor: ember.verticalVelocity,
      skillId: 21,
      variant: ember.contactCadence,
      velocity: ember.horizontalVelocity,
      worldKey: wave.worldKey,
    }))
  }
  return { actor, contacts: detonation.contacts, rng: detonation.rng, state }
}

function stepRingFireFragment(
  source: Omit<NativeSecondaryActorState, 'id'>,
): Omit<NativeSecondaryActorState, 'id'> {
  const stepped = stepNativeFireEmber({
    ageTicks: source.ageTicks,
    burnDamage: 0,
    contactCadence: source.variant,
    contactDue: source.variant === 0,
    damage: source.damage,
    height: source.phase,
    horizontalVelocity: source.velocity,
    id: 1,
    life: source.alpha,
    ownerId: source.ownerId,
    phase: source.frame,
    position: source.position,
    spentEmber: Object.freeze({ kind: 'none' }),
    verticalVelocity: source.slowFactor,
    worldKey: source.worldKey,
  })
  if (!stepped.ember) return { ...source, alpha: 0 }
  const ember = stepped.ember
  return {
    ...source,
    ageTicks: ember.ageTicks,
    alpha: ember.life,
    frame: ember.phase,
    phase: ember.height,
    position: ember.position,
    quantity: ember.verticalVelocity === 0 ? 1 : 0,
    slowFactor: ember.verticalVelocity,
    variant: ember.contactCadence,
    velocity: ember.horizontalVelocity,
  }
}

function actorSeed(
  seed: Partial<NativeSecondaryActorState>
    & Pick<NativeSecondaryActorState, 'kind' | 'ownerId' | 'skillId' | 'worldKey'>,
): Omit<NativeSecondaryActorState, 'id'> {
  const { kind, ownerId, skillId, worldKey, ...patch } = seed
  return {
    ageTicks: 0,
    alpha: 1,
    damage: 0,
    enhanced: false,
    endpoint: ZERO,
    frame: 0,
    freezeTicks: 0,
    golem: null,
    hitTargetIds: [],
    kind,
    lifetimeTicks: 60,
    lightRegistration: null,
    midpoint: ZERO,
    miscLightAppendOrdinal: null,
    ownerId,
    painterRegistrations: [],
    phase: 0,
    position: ZERO,
    presentationRng: null,
    quantity: 0,
    radius: 0,
    rank: 1,
    rotationRadians: 0,
    scale: 1,
    skillId,
    slowFactor: 0,
    targetId: null,
    variant: 0,
    velocity: ZERO,
    worldKey,
    ...patch,
  }
}

function wizardElementIndex(element: WizardElement): number {
  switch (element) {
    case 'ether': return 0
    case 'fire': return 1
    case 'air': return 2
    case 'water': return 3
    case 'earth': return 4
  }
}

function dampenedProjectileVariant(
  projectile: NativeSecondaryDampenProjectileCandidate,
): 0 | 1 | 2 {
  if (projectile.kind === 'firebolt') return 0
  return projectile.payload === 'poison' ? 1 : 2
}

function dampenedProjectileVelocity(origin: Vector2, position: Vector2): Vector2 {
  const x = Math.fround(position.x - origin.x)
  const y = Math.fround(position.y - origin.y)
  const distance = Math.hypot(x, y)
  if (distance === 0) return ZERO
  return {
    x: Math.fround(x / distance * DAMPEN_PROJECTILE_FLYOUT_SPEED),
    y: Math.fround(y / distance * DAMPEN_PROJECTILE_FLYOUT_SPEED),
  }
}

export type NativeSecondaryLightDisposition =
  | 'actor-provider'
  | 'misc'
  | 'none'
  | 'transient-provider'

export function nativeSecondaryLightDisposition(
  actor: Pick<NativeSecondaryActorState, 'kind' | 'variant'>,
): NativeSecondaryLightDisposition {
  switch (actor.kind) {
    case 'leviathan':
    case 'ether-bolt':
    case 'moving-fire':
    case 'shockwave':
    case 'mindblast-shockwave':
    case 'fire-patch':
    case 'ring-fire-fragment':
    case 'storm-cloud':
    case 'freeze-wave':
    case 'golem':
    case 'magic-trap':
    case 'acid-rain':
    case 'ether-drain':
    case 'comet':
      return 'actor-provider'
    case 'ring-fire-explosion':
      return 'transient-provider'
    case 'ether-fade':
      return actor.variant === 1 ? 'transient-provider' : 'none'
    case 'magic-circle':
    case 'fire-burn':
    case 'ether-burn':
    case 'electric-burn':
      return 'misc'
    default:
      return 'none'
  }
}

export function enrollNativeSecondaryPainterOwners(
  source: NativeSecondarySimulationState,
  register: RegisterNativeWorldPainter,
): NativeSecondarySimulationState {
  const actors = source.actors.map((actor) => {
    const painterLane = nativeSecondaryPainterManagerLane(actor.kind)
    const existingPainterRegistrations = actor.painterRegistrations ?? []
    const painterRegistrations = existingPainterRegistrations.length === 0
      ? Object.freeze([register(painterLane)])
      : existingPainterRegistrations
    if (
      painterRegistrations.length !== 1
      || painterRegistrations[0]!.managerLane !== painterLane
    ) {
      throw new Error(`${actor.kind} changed native painter-manager ownership`)
    }
    return actor.painterRegistrations === painterRegistrations
      ? actor
      : Object.freeze({ ...actor, painterRegistrations })
  })
  return actors.every((actor, index) => actor === source.actors[index])
    ? source
    : { ...source, actors }
}

function enrollNativeSecondaryLightOwners(
  source: NativeSecondarySimulationState,
  context: NativeSecondaryTickContext,
): NativeSecondarySimulationState {
  const standaloneOrder = createNativeWorldManagerOrder(
    nativeSecondaryWorldManagerOrderState(source),
  )
  const register = context.registerWorldPainter ?? standaloneOrder.register
  const painterState = enrollNativeSecondaryPainterOwners(source, register)
  const nextModifierOrdinalByTarget = new Map<string, number>()
  const actors = painterState.actors.map((actor) => {
    const painterRegistration = actor.painterRegistrations![0]!
    const disposition = nativeSecondaryLightDisposition(actor)
    if (disposition === 'none') {
      if (actor.lightRegistration === null && actor.miscLightAppendOrdinal === null) {
        return actor
      }
      return Object.freeze({
        ...actor,
        lightRegistration: null,
        miscLightAppendOrdinal: null,
      })
    }

    if (
      actor.kind === 'fire-burn'
      || actor.kind === 'ether-burn'
      || actor.kind === 'electric-burn'
    ) {
      if (actor.targetId === null) {
        throw new Error(`${actor.kind} lost its target-owned light registration`)
      }
      const target = context.target(actor.worldKey, actor.targetId)
      const lightRegistration = target?.lightRegistration ?? actor.lightRegistration
      if (lightRegistration === null || lightRegistration.managerLane !== 'actor') {
        throw new Error(`${actor.kind} target is not registered in the actor light manager`)
      }
      const key = `${actor.worldKey}\u0000${actor.targetId}`
      const miscLightAppendOrdinal = nextModifierOrdinalByTarget.get(key) ?? 0
      nextModifierOrdinalByTarget.set(key, miscLightAppendOrdinal + 1)
      if (
        actor.lightRegistration === lightRegistration
        && actor.miscLightAppendOrdinal === miscLightAppendOrdinal
      ) return actor
      return Object.freeze({
        ...actor,
        lightRegistration,
        miscLightAppendOrdinal,
      })
    }

    const expectedLane: NativeWorldManagerLane = disposition === 'transient-provider'
      ? 'transient'
      : 'actor'
    const lightRegistration = actor.lightRegistration
      ?? (painterRegistration.managerLane === expectedLane
        ? painterRegistration
        : register(expectedLane))
    if (lightRegistration.managerLane !== expectedLane) {
      throw new Error(`${actor.kind} changed native light-manager lane`)
    }
    const miscLightAppendOrdinal = disposition === 'misc' ? 0 : null
    if (
      actor.lightRegistration === lightRegistration
      && actor.miscLightAppendOrdinal === miscLightAppendOrdinal
    ) return actor
    return Object.freeze({
      ...actor,
      lightRegistration,
      miscLightAppendOrdinal,
    })
  })
  return actors.every((actor, index) => actor === painterState.actors[index])
    ? painterState
    : { ...painterState, actors }
}

function nativeSecondaryWorldManagerOrderState(
  source: NativeSecondarySimulationState,
) {
  const nextRegistrationOrdinal = { actor: 0, transient: 0 }
  for (const registration of source.actors.flatMap((actor) => [
    ...(actor.painterRegistrations ?? []),
    actor.lightRegistration,
  ])) {
    if (registration === null) continue
    nextRegistrationOrdinal[registration.managerLane] = Math.max(
      nextRegistrationOrdinal[registration.managerLane],
      registration.registrationOrdinal + 1,
    )
  }
  return { nextRegistrationOrdinal }
}

export function nativeSecondaryPainterManagerLane(
  kind: NativeSecondaryActorKind,
): NativeWorldManagerLane {
  switch (kind) {
    case 'leviathan':
    case 'leviathan-appendage':
    case 'moving-fire':
    case 'fire-patch':
    case 'storm-cloud':
    case 'storm-strike':
    case 'earthquake':
    case 'golem':
    case 'golem-death':
    case 'acid-rain':
    case 'comet':
      return 'actor'
    default:
      return 'transient'
  }
}

function spawnFirewalkerPatch(
  source: NativeSecondarySimulationState,
  playerId: string,
  authority: NativeSecondaryPlayerAuthority,
  contactGeometry: boolean,
): NativeSecondarySimulationState {
  let state = source
  const phase = drawNativeFloat(state.rng, FIRE_FRAME_COUNT); state = { ...state, rng: phase.state }
  const mirror = drawNativeSign(state.rng, 1); state = { ...state, rng: mirror.state }
  const perpendicular = drawNativeFloat(state.rng, 10, true); state = { ...state, rng: perpendicular.state }
  const forward = drawNativeFloat(state.rng, 8); state = { ...state, rng: forward.state }
  const scaleDraw = drawNativeFloat(state.rng, 0.5); state = { ...state, rng: scaleDraw.state }
  const lifeDraw = drawNativeFloat(state.rng, 0.25); state = { ...state, rng: lifeDraw.state }
  const skill = resolvedSecondaryAbilityRankStats(authority, 23)
  const velocity = {
    x: authority.character.velocity.x * 0.01,
    y: authority.character.velocity.y * 0.01,
  }
  const remainingLife = Math.fround(
    (skill.values.mDuration ?? 2) * Math.fround(1.1 - lifeDraw.value),
  )
  return spawn(state, actorSeed({
    damage: skill.values.mDamage ?? 0,
    enhanced: contactGeometry,
    kind: 'fire-patch',
    lifetimeTicks: nativeFireLifetimeTicks(remainingLife),
    ownerId: playerId,
    phase: phase.value,
    position: {
      x: authority.character.position.x
        + velocity.y * perpendicular.value
        + velocity.x * forward.value,
      y: authority.character.position.y
        - velocity.x * perpendicular.value
        + velocity.y * forward.value,
    },
    quantity: mirror.value,
    rank: skill.rank,
    slowFactor: remainingLife,
    scale: 1 - scaleDraw.value,
    skillId: 23,
    worldKey: authority.worldKey,
  }))
}

function spawnPlaneOrbBirthParticles(
  source: NativeSecondarySimulationState,
  ownerId: string,
  origin: Vector2,
  worldKey: string,
): NativeSecondarySimulationState {
  let state = source
  for (let heading = 0; heading < 360; heading += 40) {
    const radius = drawNativeFloat(state.rng, 100)
    const jitter = drawNativeFloat(radius.state, 10, true)
    const scale = drawNativeFloat(jitter.state, 4)
    const speed = drawNativeFloat(scale.state, 5)
    const life = drawNativeFloat(speed.state, 0.05)
    const positionDirection = nativeHeadingVector(heading + jitter.value)
    const velocityDirection = nativeHeadingVector(heading)
    state = { ...state, rng: life.state }
    state = spawn(state, actorSeed({
      alpha: 1,
      kind: 'plane-orb-particle',
      lifetimeTicks: 200,
      ownerId,
      position: {
        x: Math.fround(origin.x + radius.value * positionDirection.x),
        y: Math.fround(origin.y + radius.value * positionDirection.y),
      },
      quantity: 0.5,
      rotationRadians: heading * Math.PI / 180,
      scale: Math.fround(1 + scale.value),
      skillId: 12,
      slowFactor: Math.fround(
        Math.fround(0.1) * Math.fround(0.1 + life.value),
      ),
      variant: 11,
      velocity: {
        x: Math.fround(-speed.value * velocityDirection.x),
        y: Math.fround(-speed.value * velocityDirection.y),
      },
      worldKey,
    }))

    for (let child = 0; child < 2; child += 1) {
      const childRadius = drawNativeFloat(state.rng, 100)
      const childJitter = drawNativeFloat(childRadius.state, 10, true)
      const childScale = drawNativeFloat(childJitter.state, 4)
      const green = drawNativeFloat(childScale.state, 0.8)
      const childSpeed = drawNativeFloat(green.state, 5)
      const childLife = drawNativeFloat(childSpeed.state, 0.25)
      const childPositionDirection = nativeHeadingVector(
        heading + childJitter.value,
      )
      state = { ...state, rng: childLife.state }
      state = spawn(state, actorSeed({
        alpha: 1,
        kind: 'plane-orb-particle',
        lifetimeTicks: 200,
        ownerId,
        position: {
          x: Math.fround(
            origin.x + childRadius.value * childPositionDirection.x,
          ),
          y: Math.fround(
            origin.y + childRadius.value * childPositionDirection.y,
          ),
        },
        quantity: Math.fround(0.5 + green.value),
        rotationRadians: heading * Math.PI / 180,
        scale: Math.fround(Math.fround(1 + childScale.value) * 0.5),
        skillId: 12,
        slowFactor: Math.fround(
          Math.fround(0.1) * Math.fround(0.25 + childLife.value),
        ),
        variant: 45,
        velocity: {
          x: Math.fround(
            -Math.fround(5 + childSpeed.value) * velocityDirection.x,
          ),
          y: Math.fround(
            -Math.fround(5 + childSpeed.value) * velocityDirection.y,
          ),
        },
        worldKey,
      }))
    }
  }
  return state
}

function spawnPlaneOrbEnhancedMote(
  source: NativeSecondarySimulationState,
  parent: NativeSecondaryActorState,
  sourceRng: NativeRngState,
): { readonly rng: NativeRngState; readonly state: NativeSecondarySimulationState } {
  const heading = drawNativeFloat(sourceRng, 360)
  const verticalJitter = drawNativeFloat(heading.state, 5)
  const scale = drawNativeFloat(verticalJitter.state, 0.5)
  const speed = drawNativeFloat(scale.state, 3)
  const life = drawNativeFloat(speed.state, 0.15)
  const direction = nativeHeadingVector(heading.value)
  const radialDistance = Math.fround(parent.scale * 20)
  return {
    rng: life.state,
    state: spawn(source, actorSeed({
      alpha: 1,
      kind: 'plane-orb-particle',
      lifetimeTicks: 200,
      ownerId: parent.ownerId,
      position: {
        x: Math.fround(parent.position.x + radialDistance * direction.x),
        y: Math.fround(
          parent.position.y + radialDistance * direction.y
            - 15 - verticalJitter.value,
        ),
      },
      quantity: 0.5,
      rotationRadians: heading.value * Math.PI / 180,
      scale: Math.fround(0.5 + scale.value),
      skillId: 12,
      slowFactor: Math.fround(
        Math.fround(0.1) * Math.fround(0.15 + life.value),
      ),
      variant: 11,
      velocity: {
        x: Math.fround(speed.value * direction.x),
        y: Math.fround(speed.value * direction.y),
      },
      worldKey: parent.worldKey,
    })),
  }
}

function spawnEarthquakeQuake(
  source: NativeSecondarySimulationState,
  sourceRng: NativeRngState,
  parent: NativeSecondaryActorState,
  intensity: number,
): { readonly rng: NativeRngState; readonly state: NativeSecondarySimulationState } {
  const rotation = drawNativeFloat(sourceRng, 360)
  const selector = drawNativeInteger(rotation.state, 4)
  const scaleX = Math.fround(2 + selector.value)
  return {
    rng: selector.state,
    state: spawn(source, actorSeed({
      alpha: Math.fround(intensity * intensity * intensity),
      kind: 'earthquake-quake',
      lifetimeTicks: EARTHQUAKE_QUAKE_LIFETIME_TICKS,
      ownerId: parent.ownerId,
      position: parent.position,
      rotationRadians: rotation.value * Math.PI / 180,
      scale: scaleX,
      skillId: 41,
      slowFactor: Math.fround(Math.fround(0.8) * scaleX),
      worldKey: parent.worldKey,
    })),
  }
}

function spawnEarthquakeDust(
  source: NativeSecondarySimulationState,
  sourceRng: NativeRngState,
  parent: NativeSecondaryActorState,
  scenery: NativeSecondaryActorState,
): { readonly rng: NativeRngState; readonly state: NativeSecondarySimulationState } {
  const velocity = drawNativeFloat(sourceRng, 0.25)
  const magnitude = drawNativeFloat(velocity.state, 0.5)
  const rotation = drawNativeFloat(magnitude.state, 360)
  const scale = drawNativeFloat(rotation.state, 2)
  const distance = drawNativeFloat(scale.state, 30)
  const direction = drawNativeUnitVector(distance.state)
  return {
    rng: direction.rng,
    state: spawn(source, actorSeed({
      enhanced: true,
      kind: 'earthquake-dust',
      lifetimeTicks: EARTHQUAKE_DUST_LIFETIME_TICKS,
      ownerId: parent.ownerId,
      position: {
        x: Math.fround(
          scenery.position.x + direction.value.x * distance.value,
        ),
        y: Math.fround(
          scenery.position.y + direction.value.y * distance.value,
        ),
      },
      quantity: Math.fround(0.5 + magnitude.value),
      rotationRadians: rotation.value * Math.PI / 180,
      scale: Math.fround(2 + scale.value),
      skillId: 41,
      targetId: scenery.targetId,
      velocity: {
        x: Math.fround((velocity.value + 0.25) / 3),
        y: 0,
      },
      worldKey: parent.worldKey,
    })),
  }
}

function spawnEarthquakeDebris(
  source: NativeSecondarySimulationState,
  sourceRng: NativeRngState,
  parent: NativeSecondaryActorState,
): { readonly rng: NativeRngState; readonly state: NativeSecondarySimulationState } {
  const directionHeading = drawNativeFloat(sourceRng, 360)
  const bounce = drawNativeFloat(directionHeading.state, 3)
  const discardedHeight = drawNativeFloat(bounce.state, 50)
  const rotation = drawNativeFloat(discardedHeight.state, 360)
  const rotationStep = drawNativeFloat(rotation.state, 10)
  const record = drawNativeInteger(rotationStep.state, 3)
  const radius = drawNativeFloat(record.state, 300)
  const direction = nativeHeadingVector(directionHeading.value)
  const bounceSeed = Math.fround(-(2 + bounce.value))
  const verticalFactor = drawNativeFloat(radius.state, 1.5)
  const verticalVelocity = Math.fround(
    Math.fround(
      Math.fround(verticalFactor.value + 0.75) * bounceSeed,
    ) * Math.fround(0.5),
  )
  const height = drawNativeFloat(verticalFactor.state, 50)
  const offset = drawNativeFloat(height.state, 15)
  const firstScale = drawNativeFloat(offset.state, 0.75)
  const firstCandidate = Math.fround(0.5 + firstScale.value)
  let rng = firstScale.state
  let actorScale = Math.fround(0.45)
  if (firstCandidate >= 0.45) {
    const secondScale = drawNativeFloat(rng, 0.75)
    rng = secondScale.state
    actorScale = Math.fround(0.5 + secondScale.value)
  }
  actorScale = Math.min(Math.fround(0.75), actorScale)
  const scaleMultiplier = drawNativeFloat(rng, 0.35)
  const speed = drawNativeFloat(scaleMultiplier.state, 1.5)
  actorScale = Math.fround(
    actorScale * Math.fround(0.3 + scaleMultiplier.value),
  )
  const planarSpeed = Math.fround(1.5 + speed.value)
  const radialDistance = Math.fround(radius.value + offset.value)
  return {
    rng: speed.state,
    state: spawn(source, actorSeed({
      alpha: parent.enhanced ? 10 : 2,
      enhanced: parent.enhanced,
      endpoint: {
        x: verticalVelocity,
        y: Math.fround(1 + rotationStep.value),
      },
      kind: 'earthquake-debris',
      lifetimeTicks: Number.MAX_SAFE_INTEGER,
      ownerId: parent.ownerId,
      phase: Math.fround(-height.value),
      position: {
        x: Math.fround(parent.position.x + direction.x * radialDistance),
        y: Math.fround(parent.position.y + direction.y * radialDistance),
      },
      quantity: bounceSeed,
      rotationRadians: rotation.value * Math.PI / 180,
      scale: actorScale,
      skillId: 41,
      variant: record.value,
      velocity: {
        x: Math.fround(direction.x * planarSpeed),
        y: Math.fround(
          Math.fround(direction.y * Math.fround(0.8)) * planarSpeed,
        ),
      },
      worldKey: parent.worldKey,
    })),
  }
}

function spawn(
  source: NativeSecondarySimulationState,
  actor: Omit<NativeSecondaryActorState, 'id'>,
): NativeSecondarySimulationState {
  return {
    ...source,
    actors: [...source.actors, Object.freeze({ ...actor, id: source.nextActorId })],
    nextActorId: source.nextActorId + 1,
  }
}

function emit(
  source: NativeSecondarySimulationState,
  event: NativeSecondaryEventSeed,
): NativeSecondarySimulationState {
  return {
    ...source,
    events: [...source.events, Object.freeze({
      ...event,
      cameraDisplacement: event.cameraDisplacement === undefined
        ? null
        : event.cameraDisplacement === null
          ? null
          : Object.freeze({ ...event.cameraDisplacement }),
      cameraMagnitude: event.cameraMagnitude ?? 0,
      eventId: source.nextEventId,
      screenFlash: event.screenFlash ?? null,
    })],
    nextEventId: source.nextEventId + 1,
  }
}

function castEvent(
  ownerId: string,
  skillId: NativeSecondaryAbilityId,
  authority: NativeSecondaryPlayerAuthority,
  tick: number,
  kind: NativeSecondaryEventKind,
  cue: NativeSecondaryAudioCue | null,
): NativeSecondaryEventSeed {
  return {
    actorId: null,
    cue,
    kind,
    ownerId,
    pitch: skillId === 77 ? 2 : 1,
    position: authority.character.position,
    skillId,
    tick,
    worldKey: authority.worldKey,
  }
}

function eventSeed(
  actor: NativeSecondaryActorState,
  tick: number,
  cue: NativeSecondaryAudioCue | null,
  kind: NativeSecondaryEventKind,
): NativeSecondaryEventSeed {
  if (actor.skillId === 14) {
    throw new Error('EtherBurn has no native semantic audio event')
  }
  return {
    actorId: actor.id, cue, kind, ownerId: actor.ownerId, pitch: 1,
    position: actor.position, skillId: actor.skillId, tick, worldKey: actor.worldKey,
  }
}

function fizzle(
  source: NativeSecondarySimulationState,
  ownerId: string,
  skillId: NativeSecondaryAbilityId,
  authority: NativeSecondaryPlayerAuthority,
  tick: number,
): NativeSecondarySimulationState {
  return emit(source, castEvent(ownerId, skillId, authority, tick, 'fizzle', 'fizzle'))
}

function advanceActor(actor: NativeSecondaryActorState): NativeSecondaryActorState {
  const advancesPosition = actor.kind !== 'plane-orb-shot'
    && actor.kind !== 'plane-orb-particle'
    && actor.kind !== 'leviathan-appendage'
    && actor.kind !== 'earthquake'
    && actor.kind !== 'earthquake-scenery-wobble'
    && actor.kind !== 'earthquake-dust'
    && actor.kind !== 'earthquake-debris'
    && actor.kind !== 'golem'
    && actor.kind !== 'acid-drop'
    && actor.kind !== 'storm-drop'
    && actor.kind !== 'comet-debris'
    && actor.kind !== 'storm-strike'
    && actor.kind !== 'ring-fire-fragment'
  const advancesAge = actor.kind !== 'golem'
  const advancesFrame = advancesAge
    && actor.kind !== 'leviathan-appendage'
    && actor.kind !== 'earthquake'
    && actor.kind !== 'earthquake-scenery-wobble'
    && actor.kind !== 'earthquake-debris'
    && actor.kind !== 'ring-fire-fragment'
  return {
    ...actor,
    ageTicks: actor.ageTicks + (advancesAge ? 1 : 0),
    frame: actor.frame + (advancesFrame ? 1 : 0),
    position: {
      x: actor.position.x + (advancesPosition ? actor.velocity.x : 0),
      y: actor.position.y + (advancesPosition ? actor.velocity.y : 0),
    },
  }
}

function stepPlayerState(
  source: NativeSecondaryPlayerState,
  authority: NativeSecondaryPlayerAuthority,
): NativeSecondaryPlayerState {
  const cooldownMaximumTicksBySkill = [...source.cooldownMaximumTicksBySkill]
  for (const skillId of NATIVE_SECONDARY_ABILITY_IDS) {
    cooldownMaximumTicksBySkill[skillId] = nativeSecondaryCooldownCapacityTicks(
      authority.skillBook,
      skillId,
    )
  }
  return {
    ...source,
    castSpinTicksRemaining: Math.max(0, source.castSpinTicksRemaining - 1),
    cooldownMaximumTicksBySkill: Object.freeze(cooldownMaximumTicksBySkill),
    cooldownTicksBySkill: Object.freeze(source.cooldownTicksBySkill.map((ticks, skillId) => (
      ticks <= 0
        ? 0
        : Math.max(
            0,
            Math.min(ticks, cooldownMaximumTicksBySkill[skillId] ?? 0)
              - nativeSecondaryRechargeFactor(authority, skillId),
          )
    ))),
    globalCooldownTicks: Math.max(0, source.globalCooldownTicks - authority.secondaryRechargeFactor),
    magicShieldPulseTicks: Math.max(0, source.magicShieldPulseTicks - 1),
    planewalkerTicksRemaining: Math.max(0, source.planewalkerTicksRemaining - 1),
    stoneskinTicksRemaining: Math.max(0, source.stoneskinTicksRemaining - 1),
    staffCastTicksRemaining: Math.max(0, source.staffCastTicksRemaining - 1),
  }
}

function nativeSecondaryRechargeFactor(
  authority: NativeSecondaryPlayerAuthority,
  skillId: number,
): number {
  const classId = nativeSkillClass(skillId)
  const classRecharge = authority.offensiveFactors.equipment?.classRecharge[classId]
  return classRecharge === undefined
    ? authority.secondaryRechargeFactor
    : Math.max(
        authority.secondaryRechargeFactor,
        applyNativeEquipmentTransform(classRecharge, 1),
      )
}

function clearPlayerToggles(source: NativeSecondaryPlayerState): NativeSecondaryPlayerState {
  return {
    ...source,
    firewalker: false,
    mindstar: false,
    regenerate: false,
    reservedMana: 0,
  }
}

function recalculateReserve(
  source: NativeSecondaryPlayerState,
  authority: NativeSecondaryPlayerAuthority,
): NativeSecondaryPlayerState {
  const reservedMana = nativeSecondaryManaReserve(source, authority)
  return reservedMana === source.reservedMana ? source : { ...source, reservedMana }
}

function withCooldown(
  state: NativeSecondarySimulationState,
  source: NativeSecondaryPlayerState,
  skillId: NativeSecondaryAbilityId,
  ticks: number,
  authority: NativeSecondaryPlayerAuthority,
): Readonly<{
  player: NativeSecondaryPlayerState
  state: NativeSecondarySimulationState
}> {
  const cooldownMaximumTicksBySkill = [...source.cooldownMaximumTicksBySkill]
  cooldownMaximumTicksBySkill[skillId] = ticks
  if (ticks > 0 && authority.focusInstantRechargeChancePercent > 0) {
    const draw = drawNativeInteger(state.rng, 100)
    state = { ...state, rng: draw.state }
    if (draw.value >= 100 - authority.focusInstantRechargeChancePercent) {
      return Object.freeze({
        player: Object.freeze({
          ...source,
          cooldownMaximumTicksBySkill: Object.freeze(cooldownMaximumTicksBySkill),
        }),
        state,
      })
    }
  }
  const cooldownTicksBySkill = [...source.cooldownTicksBySkill]
  cooldownTicksBySkill[skillId] = ticks
  for (let index = 0; index < cooldownTicksBySkill.length; index += 1) {
    if (cooldownTicksBySkill[index]! < NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS) {
      cooldownTicksBySkill[index] = 0
    }
  }
  return Object.freeze({
    player: Object.freeze({
      ...source,
      cooldownMaximumTicksBySkill: Object.freeze(cooldownMaximumTicksBySkill),
      cooldownTicksBySkill: Object.freeze(cooldownTicksBySkill),
      globalCooldownTicks: NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS,
    }),
    state,
  })
}

function startStaffCast(
  source: NativeSecondaryPlayerState,
  skillBook: PlayerSkillBookComponent,
): NativeSecondaryPlayerState {
  return {
    ...source,
    staffCastTicksRemaining: nativeSecondaryStaffCastDurationTicks(skillBook),
  }
}

function effectiveSkillNumericValue(
  skillBook: PlayerSkillBookComponent,
  skillId: number,
  property: string,
): number {
  const rank = skillBook.effectiveRanks[skillId] ?? 0
  if (rank <= 0) return 0
  const configured = playerStatBook().entries[skillId]?.numericProperties[property]
  if (configured === undefined) return 0
  if (typeof configured === 'number') return configured
  return configured[Math.min(rank, configured.length - 1)] ?? 0
}

function mergeEffect(
  source: NativeSecondarySimulationState,
  worldKey: string,
  targetId: number,
  patch: NativeSecondaryTargetEffectPatch,
): NativeSecondarySimulationState {
  const index = source.targetEffects.findIndex((effect) => (
    effect.worldKey === worldKey && effect.targetId === targetId
  ))
  const current = index < 0 ? emptyTargetEffect(worldKey, targetId) : source.targetEffects[index]!
  const circleSlowTicks = Math.max(current.circleSlowTicks, patch.circleSlowTicks ?? 0)
  const coldSlowTicks = Math.max(current.coldSlowTicks, patch.coldSlowTicks ?? 0)
  const frozenTicks = Math.max(current.frozenTicks, patch.frozenTicks ?? 0)
  const frostBurnTicks = Math.max(current.frostBurnTicks, patch.frostBurnTicks ?? 0)
  const stunTicks = Math.max(current.stunTicks, patch.stunTicks ?? 0)
  const movementModifierOrder = mergeMovementModifierOrder(current, patch)
  const next = {
    ...current,
    circleSlowFactor: patch.circleSlowTicks === undefined
      ? current.circleSlowFactor
      : Math.min(current.circleSlowFactor, patch.circleSlowFactor ?? 1),
    circleSlowTicks,
    coldSlowFactor: patch.coldSlowTicks === undefined
      ? current.coldSlowFactor
      : Math.min(current.coldSlowFactor, patch.coldSlowFactor ?? 1),
    coldSlowMaterial: patch.coldSlowTicks === undefined
      ? current.coldSlowMaterial
      : current.coldSlowTicks > (patch.coldSlowTicks ?? 0)
        ? current.coldSlowMaterial
        : current.coldSlowTicks < (patch.coldSlowTicks ?? 0)
          ? patch.coldSlowMaterial ?? current.coldSlowMaterial
          : current.coldSlowMaterial || (patch.coldSlowMaterial ?? false),
    coldSlowTicks,
    dazzleMaximumTicks: Math.max(
      current.dazzleMaximumTicks,
      patch.dazzleTicks ?? 0,
    ),
    dazzleTicks: Math.max(current.dazzleTicks, patch.dazzleTicks ?? 0),
    disruptedTicks: Math.max(current.disruptedTicks, patch.disruptedTicks ?? 0),
    electricBurn: mergeElectricBurnEffect(current.electricBurn, patch.electricBurn),
    fleeTicks: Math.max(current.fleeTicks, patch.fleeTicks ?? 0),
    frostBurnDamagePerTick: frostBurnTicks > current.frostBurnTicks
      ? patch.frostBurnDamagePerTick ?? current.frostBurnDamagePerTick
      : Math.max(current.frostBurnDamagePerTick, patch.frostBurnDamagePerTick ?? 0),
    frostBurnOwnerId: frostBurnTicks > current.frostBurnTicks
      ? patch.frostBurnOwnerId ?? current.frostBurnOwnerId
      : current.frostBurnOwnerId ?? patch.frostBurnOwnerId ?? null,
    frostBurnSkillId: frostBurnTicks > current.frostBurnTicks
      ? patch.frostBurnSkillId ?? current.frostBurnSkillId
      : current.frostBurnSkillId ?? patch.frostBurnSkillId ?? null,
    frostBurnSourceActorId: frostBurnTicks > current.frostBurnTicks
      ? patch.frostBurnSourceActorId ?? current.frostBurnSourceActorId
      : current.frostBurnSourceActorId ?? patch.frostBurnSourceActorId ?? null,
    frostBurnTicks,
    frozenTicks,
    frozenTimeScale: patch.frozenTicks === undefined
      ? current.frozenTimeScale
      : Math.min(current.frozenTimeScale, patch.frozenTimeScale ?? 0),
    movementModifierOrder,
    prismaticTicks: Math.max(current.prismaticTicks, patch.prismaticTicks ?? 0),
    stunFactor: patch.stunTicks === undefined
      ? current.stunFactor
      : Math.min(current.stunFactor, patch.stunFactor ?? 1),
    stunTicks,
    steamed: mergeSteamedEffect(current.steamed, patch.steamed),
    timeScale: 1,
    weakenFactor: patch.weakenFactor === undefined || current.weakenFactor < 1
      ? current.weakenFactor
      : patch.weakenFactor,
  }
  next.timeScale = composeNativeSecondaryTimeScale(movementModifierOrder, {
    'circle-slow': next.circleSlowTicks > 0 ? next.circleSlowFactor : 1,
    'cold-slow': next.coldSlowTicks > 0 ? next.coldSlowFactor : 1,
    dazzle: nativeDazzleTimeScale(next.dazzleTicks, next.dazzleMaximumTicks),
    frozen: next.frozenTicks > 0 ? next.frozenTimeScale : 1,
    stun: next.stunTicks > 0 ? next.stunFactor : 1,
  })
  if (index < 0) return { ...source, targetEffects: [...source.targetEffects, next] }
  const targetEffects = [...source.targetEffects]
  targetEffects[index] = next
  return { ...source, targetEffects }
}

export function applyNativeSecondaryTargetEffect(
  source: NativeSecondarySimulationState,
  worldKey: string,
  targetId: number,
  patch: NativeSecondaryTargetEffectPatch,
): NativeSecondarySimulationState {
  if (!Number.isSafeInteger(targetId) || targetId < 0) {
    throw new RangeError('target effect id must be a non-negative safe integer')
  }
  if (patch.stunTicks !== undefined && (
    !Number.isSafeInteger(patch.stunTicks) || patch.stunTicks < 0
  )) throw new RangeError('Stun duration must be a non-negative safe integer')
  if (patch.stunFactor !== undefined && (
    !Number.isFinite(patch.stunFactor) || patch.stunFactor < 0 || patch.stunFactor > 1
  )) throw new RangeError('Stun factor must be inside [0,1]')
  return mergeEffect(source, worldKey, targetId, patch)
}

export function applyNativeSecondaryDazzle(
  source: NativeSecondarySimulationState,
  worldKey: string,
  targetId: number,
  durationTicks: number,
): NativeSecondarySimulationState {
  if (!Number.isSafeInteger(targetId) || targetId < 0) {
    throw new RangeError('Dazzle target id must be a non-negative safe integer')
  }
  if (!Number.isSafeInteger(durationTicks) || durationTicks < 0) {
    throw new RangeError('Dazzle duration must be a non-negative safe integer')
  }
  return durationTicks === 0
    ? source
    : mergeEffect(source, worldKey, targetId, { dazzleTicks: durationTicks })
}

/** Materializes the complete successful row-53 response after its RNG was consumed. */
export function materializeNativePlayerFlashResponse(
  source: NativeSecondarySimulationState,
  input: Readonly<{
    ownerId: string
    position: Readonly<Vector2>
    response: PlayerFlashResponse
    targetIds: readonly number[]
    tick: number
    worldKey: string
  }>,
): NativeSecondarySimulationState {
  if (new Set(input.targetIds).size !== input.targetIds.length) {
    throw new RangeError('Flash response target ids must be unique')
  }
  let state = source
  for (const targetId of input.targetIds) {
    state = applyNativeSecondaryDazzle(
      state,
      input.worldKey,
      targetId,
      input.response.durationTicks,
    )
  }
  for (const scale of input.response.growScales) {
    if (!Number.isFinite(scale) || scale < 1 || scale > 2) {
      throw new RangeError('Flash response grow scale must be inside [1,2]')
    }
    state = spawn(state, actorSeed({
      alpha: 1,
      kind: 'flash-response-grow',
      lifetimeTicks: 20,
      ownerId: input.ownerId,
      position: input.position,
      scale,
      skillId: 53,
      worldKey: input.worldKey,
    }))
  }
  for (let index = 0; index < 4; index += 1) {
    state = spawn(state, actorSeed({
      alpha: 1,
      kind: 'flash-response-fade',
      lifetimeTicks: 20,
      ownerId: input.ownerId,
      position: {
        x: input.position.x,
        y: Math.fround(input.position.y - 25),
      },
      scale: 6,
      skillId: 53,
      worldKey: input.worldKey,
    }))
  }
  return emit(state, {
    actorId: null,
    cameraDisplacement: { ...input.response.cameraDisplacement },
    cue: 'flash-spell',
    kind: 'impact',
    ownerId: input.ownerId,
    pitch: input.response.pitch,
    position: { ...input.position },
    screenFlash: REGION_FLASH_RESPONSE,
    skillId: 53,
    tick: input.tick,
    worldKey: input.worldKey,
  })
}

export function emitNativePlayerScreenFlash(
  source: NativeSecondarySimulationState,
  event: Readonly<{
    ownerId: string
    position: Readonly<Vector2>
    screenFlash: NativeSecondaryScreenFlashState
    tick: number
    worldKey: string
  }>,
): NativeSecondarySimulationState {
  return emit(source, {
    actorId: null,
    cue: null,
    kind: 'impact',
    ownerId: event.ownerId,
    pitch: 1,
    position: { ...event.position },
    screenFlash: event.screenFlash,
    skillId: null,
    tick: event.tick,
    worldKey: event.worldKey,
  })
}

export function triggerNativePlayerMindblast(
  source: NativeSecondarySimulationState,
  input: Readonly<{
    directDamage?: number
    element: WizardElement
    level: number
    lightRegistration: NativeWorldManagerRegistration
    ownerId: string
    position: Readonly<Vector2>
    presentationScale?: number
    registerWorldPainter?: RegisterNativeWorldPainter
    worldKey: string
  }>,
): NativePlayerMindblastTriggerResult {
  if (!Number.isSafeInteger(input.level) || input.level < 1) {
    throw new RangeError('Mindblast level must be a positive safe integer')
  }
  const presentationScale = input.presentationScale ?? 9
  const directDamage = input.directDamage
    ?? (input.element === 'ether' ? input.level * 0.5 : 0)
  if (!Number.isFinite(presentationScale) || presentationScale <= 0) {
    throw new RangeError('Mindblast presentation scale must be finite and positive')
  }
  if (!Number.isFinite(directDamage) || directDamage < 0) {
    throw new RangeError('Mindblast direct damage must be finite and non-negative')
  }
  const presentationRng = source.rng
  let state: NativeSecondarySimulationState = {
    ...source,
    rng: advanceNativeRngWords(source.rng, NATIVE_MINDBLAST_PRESENTATION_RNG_WORDS),
  }
  const variant = wizardElementIndex(input.element)
  let fallbackPainterOrdinal = source.nextActorId
  const registerPainter = input.registerWorldPainter
    ?? ((managerLane: NativeWorldManagerLane) => ({
      managerLane,
      registrationOrdinal: fallbackPainterOrdinal++,
    }))
  state = spawn(state, actorSeed({
    kind: 'mindblast-burst',
    lifetimeTicks: NATIVE_MINDBLAST_BURST_LIFETIME_TICKS,
    ownerId: input.ownerId,
    painterRegistrations: Object.freeze([registerPainter('transient')]),
    position: { ...input.position },
    presentationRng,
    rank: input.level,
    scale: presentationScale,
    skillId: null,
    variant,
    worldKey: input.worldKey,
  }))
  state = spawn(state, actorSeed({
    kind: 'mindblast-shockwave',
    lifetimeTicks: NATIVE_MINDBLAST_SHOCKWAVE_LIFETIME_TICKS,
    lightRegistration: input.lightRegistration,
    ownerId: input.ownerId,
    painterRegistrations: Object.freeze([registerPainter('transient')]),
    phase: SHOCKWAVE_EXPLOSIVE_SHIELD_LIFE,
    position: { ...input.position },
    quantity: NATIVE_MINDBLAST_SHOCKWAVE_GROWTH,
    radius: 75,
    skillId: null,
    slowFactor: SHOCKWAVE_EXPLOSIVE_SHIELD_FADE_THRESHOLD,
    variant,
    worldKey: input.worldKey,
  }))
  return Object.freeze({
    directDamage,
    directRadius: Math.fround(
      NATIVE_MINDBLAST_DIRECT_RADIUS * presentationScale / 9,
    ),
    state,
  })
}

/** Advances Last Word's common Mindblast actors after the run enters Game Over. */
export function stepNativeMindblastPresentation(
  source: NativeSecondarySimulationState,
): NativeSecondarySimulationState {
  const actors = source.actors.flatMap((sourceActor): NativeSecondaryActorState[] => {
    if (sourceActor.kind !== 'mindblast-burst' && sourceActor.kind !== 'mindblast-shockwave') {
      return [sourceActor]
    }
    let actor = advanceActor(sourceActor)
    if (actor.ageTicks >= actor.lifetimeTicks) return []
    if (actor.kind === 'mindblast-shockwave') {
      const remainingLife = Math.fround(sourceActor.phase - WAVE_LIFE_PER_TICK)
      if (remainingLife <= 0) return []
      actor = {
        ...actor,
        alpha: remainingLife < sourceActor.slowFactor
          ? Math.fround(sourceActor.alpha * WAVE_FADE_FACTOR)
          : sourceActor.alpha,
        phase: remainingLife,
        radius: Math.fround(sourceActor.radius + sourceActor.quantity),
        scale: Math.fround(1 + actor.ageTicks * 0.08),
      }
    }
    return [actor]
  })
  return actors.length === source.actors.length
      && actors.every((actor, index) => actor === source.actors[index])
    ? source
    : { ...source, actors: Object.freeze(actors) }
}

function emptyTargetEffect(worldKey: string, targetId: number): NativeSecondaryTargetEffectState {
  return {
    circleSlowFactor: 1, circleSlowTicks: 0,
    coldSlowFactor: 1, coldSlowMaterial: false, coldSlowTicks: 0,
    dazzleMaximumTicks: 0, dazzleTicks: 0,
    disruptedTicks: 0, electricBurn: null, fleeTicks: 0,
    frostBurnDamagePerTick: 0, frostBurnOwnerId: null, frostBurnSkillId: null,
    frostBurnSourceActorId: null, frostBurnTicks: 0,
    frozenTicks: 0, frozenTimeScale: 1,
    movementModifierOrder: [],
    prismaticTicks: 0, stunFactor: 1, stunTicks: 0, steamed: null,
    targetId, timeScale: 1, weakenFactor: 1, worldKey,
  }
}

function hasTargetEffect(effect: NativeSecondaryTargetEffectState): boolean {
  return effect.circleSlowTicks > 0 || effect.coldSlowTicks > 0
    || effect.dazzleTicks > 0 || effect.disruptedTicks > 0
    || effect.electricBurn !== null || effect.fleeTicks > 0 || effect.frostBurnTicks > 0
    || effect.frozenTicks > 0 || effect.steamed !== null
    || effect.prismaticTicks > 0 || effect.stunTicks > 0 || effect.weakenFactor < 1
}

function nativeDazzleTimeScale(ticks: number, maximumTicks: number): number {
  return ticks <= 0 || maximumTicks <= 0
    ? 1
    : Math.max(1 / maximumTicks, 1 - ticks / maximumTicks)
}

function composeNativeSecondaryTimeScale(
  order: readonly NativeSecondaryMovementModifierKind[],
  factors: Readonly<Record<NativeSecondaryMovementModifierKind, number>>,
): number {
  return order.reduce(
    (scale, kind) => Math.fround(scale * factors[kind]),
    Math.fround(1),
  )
}

function mergeMovementModifierOrder(
  current: NativeSecondaryTargetEffectState,
  patch: NativeSecondaryTargetEffectPatch,
): readonly NativeSecondaryMovementModifierKind[] {
  const order = [...current.movementModifierOrder]
  for (const [kind, currentTicks, incomingTicks] of [
    ['cold-slow', current.coldSlowTicks, patch.coldSlowTicks],
    ['circle-slow', current.circleSlowTicks, patch.circleSlowTicks],
    ['frozen', current.frozenTicks, patch.frozenTicks],
    ['stun', current.stunTicks, patch.stunTicks],
    ['dazzle', current.dazzleTicks, patch.dazzleTicks],
  ] as const) {
    if ((incomingTicks ?? 0) > 0 && currentTicks === 0 && !order.includes(kind)) {
      order.push(kind)
    }
  }
  return Object.freeze(order)
}

function mergeElectricBurnEffect(
  current: NativeSecondaryElectricBurnEffectState | null,
  incoming: NativeSecondaryElectricBurnEffectState | null | undefined,
): NativeSecondaryElectricBurnEffectState | null {
  if (incoming === undefined) return current
  if (incoming === null) return null
  validateElectricBurnEffect(incoming)
  if (current === null) return Object.freeze({ ...incoming })
  const strongest = incoming.damagePerTick >= current.damagePerTick ? incoming : current
  return Object.freeze({
    arcCount: strongest.arcCount,
    damagePerTick: Math.max(current.damagePerTick, incoming.damagePerTick),
    ownerId: strongest.ownerId,
    sourceActorId: strongest.sourceActorId,
    stunFactor: strongest.stunFactor,
    ticks: Math.max(current.ticks, incoming.ticks),
  })
}

function mergeSteamedEffect(
  current: NativeSecondarySteamedEffectState | null,
  incoming: NativeSecondarySteamedEffectState | null | undefined,
): NativeSecondarySteamedEffectState | null {
  if (incoming === undefined) return current
  if (incoming === null) return null
  validateSteamedEffect(incoming)
  if (current === null) return Object.freeze({ ...incoming })
  const strongest = incoming.damagePerTick >= current.damagePerTick ? incoming : current
  return Object.freeze({
    damagePerTick: Math.max(current.damagePerTick, incoming.damagePerTick),
    emberDamage: Math.max(current.emberDamage, incoming.emberDamage),
    emberFragments: Math.max(current.emberFragments, incoming.emberFragments),
    explodeDamage: Math.max(current.explodeDamage, incoming.explodeDamage),
    explodeRadius: Math.max(current.explodeRadius, incoming.explodeRadius),
    ownerId: strongest.ownerId,
    sourceActorId: strongest.sourceActorId,
    ticks: Math.max(current.ticks, incoming.ticks),
  })
}

function validateElectricBurnEffect(effect: NativeSecondaryElectricBurnEffectState): void {
  if (!Number.isSafeInteger(effect.arcCount) || effect.arcCount < 0
    || !Number.isFinite(effect.damagePerTick) || effect.damagePerTick < 0
    || !Number.isSafeInteger(effect.sourceActorId) || effect.sourceActorId < 1
    || !Number.isFinite(effect.stunFactor) || effect.stunFactor < 0 || effect.stunFactor > 1
    || !Number.isSafeInteger(effect.ticks) || effect.ticks < 1
    || effect.ownerId.length === 0) {
    throw new RangeError('ElectricBurn effect is invalid')
  }
}

function validateSteamedEffect(effect: NativeSecondarySteamedEffectState): void {
  if (![effect.damagePerTick, effect.emberDamage, effect.explodeDamage, effect.explodeRadius]
    .every((value) => Number.isFinite(value) && value >= 0)
    || !Number.isSafeInteger(effect.emberFragments) || effect.emberFragments < 0
    || !Number.isSafeInteger(effect.sourceActorId) || effect.sourceActorId < 1
    || !Number.isSafeInteger(effect.ticks) || effect.ticks < 1
    || effect.ownerId.length === 0) {
    throw new RangeError('Steamed effect is invalid')
  }
}

function stableTargets(targets: readonly NativeSecondaryTarget[]): readonly NativeSecondaryTarget[] {
  return [...targets].sort((a, b) => a.id - b.id)
}

function randomTarget(
  targets: readonly NativeSecondaryTarget[],
  rng: NativeRngState,
): { rng: NativeRngState; value: NativeSecondaryTarget | null } {
  if (targets.length === 0) return { rng, value: null }
  const draw = drawNativeInteger(rng, targets.length)
  return { rng: draw.state, value: targets[draw.value] ?? null }
}

function shuffleFixedBound<T>(
  source: readonly T[],
  sourceRng: NativeRngState,
): { rng: NativeRngState; values: readonly T[] } {
  const values = [...source]
  let rng = sourceRng
  for (let index = 0; index < values.length; index += 1) {
    const selected = drawNativeInteger(rng, values.length)
    rng = selected.state
    ;[values[index], values[selected.value]] = [
      values[selected.value]!,
      values[index]!,
    ]
  }
  return { rng, values }
}

function drawNativeUnitVector(
  source: NativeRngState,
): { rng: NativeRngState; value: Vector2 } {
  const heading = drawNativeInteger(source, 100_001)
  const degrees = Math.fround(
    Math.fround(heading.value / 100_000) * 360,
  )
  return {
    rng: heading.state,
    value: nativeHeadingVector(degrees),
  }
}

function nativeHeadingVector(degrees: number): Vector2 {
  const radians = degrees * Math.PI / 180
  return {
    x: Math.fround(Math.sin(radians)),
    y: Math.fround(-Math.cos(radians)),
  }
}

function unit(from: Vector2, to: Vector2): Vector2 {
  const x = to.x - from.x
  const y = to.y - from.y
  const magnitude = Math.hypot(x, y)
  return magnitude > 0.0001 ? { x: x / magnitude, y: y / magnitude } : { x: 0, y: -1 }
}

function length(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function squaredDistance(a: Vector2, b: Vector2): number {
  const x = a.x - b.x
  const y = a.y - b.y
  return x * x + y * y
}

function wrapPhase(value: number, count: number): number {
  return value >= count ? value - count : value
}

function normalizeRadians(value: number): number {
  const full = Math.PI * 2
  return ((value % full) + full) % full
}

function roundToNearestEven(value: number): number {
  const floor = Math.floor(value)
  const fraction = value - floor
  if (fraction < 0.5) return floor
  if (fraction > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}

function nativeMagicTrapSelector(
  authority: NativeSecondaryPlayerAuthority,
  rng: NativeRngState,
): { readonly rng: NativeRngState; readonly selector: number } {
  const weldBuildId = activePlayerWeldBuildId(authority.skillBook)
  if (weldBuildId !== null) {
    const build = nativeWeldBuild(weldBuildId)
    if (build === null) throw new RangeError(`unknown native weld build ${weldBuildId}`)
    const component = drawNativeInteger(rng, build.primarySkillIds.length)
    const primarySkillId = build.primarySkillIds[component.value]!
    const selector = (MAGIC_TRAP_SELECTOR_SKILL_IDS as readonly number[]).indexOf(primarySkillId)
    if (selector < 0) {
      throw new RangeError(`weld build ${weldBuildId} has no native Magic Trap selector`)
    }
    return { rng: component.state, selector }
  }

  switch (authority.skillBook.primarySkillId) {
    case 8: return { rng, selector: 0 }
    case 16: return { rng, selector: 1 }
    case 24: return { rng, selector: 2 }
    case 32: return { rng, selector: 3 }
    case 40: return { rng, selector: 4 }
    default:
      throw new RangeError(
        `skill ${authority.skillBook.primarySkillId} has no native Magic Trap selector`,
      )
  }
}

function nativeMagicTrapBaseDamage(
  skillBook: PlayerSkillBookComponent,
  selector: number,
  rng: NativeRngState,
): { readonly rng: NativeRngState; readonly value: number } {
  const skillId = MAGIC_TRAP_SELECTOR_SKILL_IDS[selector]
  if (skillId === undefined) {
    throw new RangeError(`invalid native Magic Trap selector ${selector}`)
  }
  const stats = effectiveElementalPrimarySkillRankStats(skillBook, skillId)
  if (selector !== 0) return { rng, value: Math.fround(stats.damageMaximum) }
  const damage = drawNativeFloatRange(rng, stats.damageMinimum, stats.damageMaximum)
  return { rng: damage.state, value: damage.value }
}

function magicTrapScreenFlash(
  selector: number,
  decayPerTick: number,
  pointAttenuated: boolean,
): NativeSecondaryScreenFlashState {
  const color = MAGIC_TRAP_SELECTOR_COLORS[selector]
  if (color === undefined) throw new RangeError(`invalid native Magic Trap selector ${selector}`)
  return screenFlash(color[0], color[1], color[2], decayPerTick, pointAttenuated)
}

function magicTrapPrimaryCue(selector: number): NativeSecondaryAudioCue {
  switch (selector) {
    case 0: return 'magic-missile'
    case 1: return 'throw-fire'
    case 2: return 'lightning-start'
    case 3: return 'ice-start'
    case 4: return 'start-boulder'
    default: throw new RangeError(`invalid native Magic Trap selector ${selector}`)
  }
}

function elementDamage(index: number): NativeSecondaryDamageKind {
  return index === 1 ? 'fire' : index === 2 ? 'lightning' : index === 3 ? 'ice' : 'magic'
}

function castCue(skillId: NativeSecondaryAbilityId): NativeSecondaryAudioCue | null {
  switch (skillId) {
    case 11: return 'leviathan-roar'
    case 12: return 'planewalker-on'
    case 15: return 'phase'
    case 21: return null
    case 23: return 'ignite'
    case 27: return 'magic-storm'
    case 30: return null
    case 35: return 'ring-of-ice'
    case 41: return null
    case 45: return null
    case 46: return null
    case 48: return null
    case 49: return null
    case 50: return 'set-trap'
    case 51: return null
    case 54: return 'magic-shield-up'
    case 72: return 'magic-storm'
    case 73: return null
    case 74: return null
    case 76: return null
    case 77: return null
    case 78:
    case 79: return 'mindstar'
  }
}

function insideRectangle(
  center: Vector2,
  point: Vector2,
  halfWidth: number,
  halfHeight: number,
): boolean {
  return Math.abs(point.x - center.x) <= halfWidth
    && Math.abs(point.y - center.y) <= halfHeight
}
