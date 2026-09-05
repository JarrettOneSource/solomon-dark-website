import {
  playerHandSpellEmitterOffset,
  playerStaffAttachmentOffset,
  playerWandPrimaryPose,
  playerWandSpellEmitterOffset,
  type NativePlayerWeaponKind,
} from './native-player-weapon.ts'
import {
  actorHeadingFromVector,
  actorHeadingIndex,
} from './actor-heading.ts'
import {
  playerPrimaryCastOwnsFacing,
  type PlayerCharacterInput,
  type PlayerCharacterState,
  type PlayerPrimaryCastState,
  type WizardElement,
} from './player-character.ts'
import {
  NATIVE_PRIMARY_EARTH_INITIAL_CHARGE,
  type NativeAirPrimarySkillProfile,
  type NativePrimarySkillProfile,
  type NativeWaterPrimarySkillProfile,
  type NativeWeldPrimarySkillProfile,
} from './native-primary-skill-profile.ts'
import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import type { NativeHurricaneLane } from './native-hurricane.ts'
import { stepNativeHardenEffect, type NativeHardenEffect } from './native-harden-effects.ts'
import {
  advanceNativeEarthBoulderCharge,
  nativeEarthBoulderReleasedDamage,
} from './native-earth-boulder.ts'
import {
  WATER_FROST_UNDERPOWERED_PARTICLES_PER_TICK,
  waterFrostJetEmission,
  waterFrostJetLifetimeTicks,
  waterFrostJetObstruction,
  waterFrostJetParticleCount,
  waterFrostJetSpeed,
} from './primary-spell-water.ts'
import {
  earthImpactFragmentCount,
  earthImpactLifetimeTicks,
  earthVisualRandomInt,
  earthVisualUnitRandom,
} from './primary-spell-earth.ts'
import {
  EARTH_BOULDER_IDENTITY_ORIENTATION,
  earthBoulderFlightOrientationStep,
  earthBoulderHeldOrientationStep,
  type EarthBoulderOrientation,
} from './primary-spell-earth-orientation.ts'
import type { Vector2 } from './vector.ts'
import {
  spawnNativeFirePatch,
  createNativeFireDetonation,
  drawNativeFirePrivateSeed,
  spawnNativeFireGoodImp,
  stepNativeFireGoodImp,
  stepNativeFirePatch,
  stepNativeFireEmber,
  type NativeFireActorContact,
  type NativeFireEmberContact,
  type NativeFireEmberState,
  type NativeFireExplosionState,
  type NativeFireGoodImpState,
  type NativeFirePatchState,
  type NativeFireProjectilePayload,
  type NativeFireSpentEmber,
} from './primary-spell-fire-effects.ts'
import {
  NATIVE_FIRE_EXPLOSION_LIFETIME_TICKS,
  NATIVE_FIRE_IMPACT_LIFETIME_TICKS,
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from './primary-spell-fire-native.ts'
import { NATIVE_ETHER_IMPACT_VISIBLE_TICKS } from './primary-spell-ether-native.ts'
import {
  isNativePlayerStaffTransient,
  type NativePlayerStaffTransient,
} from './native-player-staff-action.ts'
import {
  AIR_PRIMARY_TARGET_Y_OFFSET,
  ETHER_PRIMARY_INITIAL_TURN,
  NATIVE_PRIMARY_CAST_TERRAIN_EXCLUSION_MASK,
  NATIVE_PRIMARY_FLIGHT_TERRAIN_EXCLUSION_MASK,
  airPrimaryBoltGeometry,
  advanceEtherPrimaryTracking,
  directionFromHeading,
  nativeMissileFanHeading,
  nativeMissileFanTurnScale,
  selectAirPrimaryTarget,
  selectEtherPrimaryTarget,
  type PrimarySpellTarget,
} from './primary-spell-targeting.ts'
import {
  createNativeWorldManagerOrder,
  registerNativeWorldPainterRoots,
  type NativeWorldPainterOwner,
  type NativeWorldManagerRegistration,
  type RegisterNativeWorldPainter,
} from './native-world-manager-order.ts'
import {
  createNativeWeldChannelActor,
  createNativeWeldBoulderDebrisActor,
  createNativeWeldGroundSparkFadeActor,
  createNativeWeldHailRockFadeActor,
  createNativeWeldMeteor,
  createNativeWeldMeteorFlash,
  createNativeWeldPersistentActor,
  drawNativeWeldDamage,
  isChannelBuild,
  isMagicMissileDerivedWeldBuild,
  isPersistentBuild,
  releaseNativeWeldPersistentActor,
  spawnNativeWeldOneShot,
  stepNativeWeldProjectile,
  stepNativeWeldProjectilePresentation,
  stepNativeWeldWorldActor,
  updateNativeWeldPersistentActor,
  type NativeWeldProjectileState,
  type NativeWeldEtherealBoulderState,
  type NativeWeldImpactActorState,
  type NativeWeldWorldActor,
} from './native-weld-primary-runtime.ts'
import type { NativeWeldBuildId } from './native-weld-primary-profile.ts'
import {
  createNativeWeldMeteorSpawnProgram,
  nativeWeldMeteorCadenceTicks,
  nativeWeldMeteorTargetPoint,
  spawnNativeWeldMeteorMarker,
  type NativeWeldMeteorDebrisSeed,
} from './native-weld-meteor.ts'
import { createNativeWeldGroundSparkFadeProgram } from './native-weld-ground-spark.ts'
import {
  createNativeWeldEtherealBoulderBreakupDebrisProgram,
  createNativeWeldBoulderDebrisParticle,
  stepNativeWeldBoulderDebrisParticle,
  type NativeWeldBoulderDebrisParticleState,
} from './native-weld-boulder-debris.ts'
import {
  createNativeWeldSteamDetonation,
  spawnNativeWeldSteamActor,
} from './native-weld-steam.ts'
import {
  createNativeWeldHailTerrainImpact,
  NATIVE_WELD_HAIL_LOOKAHEAD_DISTANCE,
} from './native-weld-hail-contact.ts'
import { createNativeWeldFlameLashFade } from './native-weld-flame-lash.ts'
import { createNativeWeldBlizzardSourceGlows } from './native-weld-blizzard.ts'
import {
  advanceNativeEtherBlastCharge,
  createNativeEtherBlastParticleProgram,
  nativeEtherBlastPulseOrigin,
  nativeEtherBlastReleaseCharges,
  NATIVE_ETHER_BLAST_PARTICLE_COUNT,
  NATIVE_ETHER_BLAST_PARTICLE_LIFETIME_TICKS,
  NATIVE_ETHER_BLAST_WEAPON_PULSE,
  NATIVE_PLAYER_WEAPON_PULSE_DECAY,
} from './native-ether-blast.ts'
import {
  NATIVE_PLAYER_STAFF_CAST_ONE_OVERLAY,
  NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY,
} from './player-lighting.ts'

export type PrimarySpellProjectileKind = 'earth' | 'ether' | 'fire' | 'weld'
export type PrimarySpellProjectilePhase = 'flight' | 'held'

interface PrimarySpellProjectileBaseState extends NativeWorldPainterOwner {
  ageTicks: number
  charge: number
  damage: number
  direction: Vector2
  flightTicks: number
  id: number
  lightRegistration: NativeWorldManagerRegistration
  ownerId: string
  phase: PrimarySpellProjectilePhase
  position: Vector2
  velocity: Vector2
  worldKey: string
}

export interface PrimarySpellEarthProjectileState extends PrimarySpellProjectileBaseState {
  assemblyCharge: number
  hitTargetIds: readonly string[]
  kind: 'earth'
  maximumCharge: number
  orientation: EarthBoulderOrientation
  remainingDamage: number
  shellCharge: number
  toughness: number
}

export interface PrimarySpellEtherProjectileState extends PrimarySpellProjectileBaseState {
  damageRetention: number
  headingDegrees: number
  kind: 'ether'
  piercesRemaining: number
  reacquiresTarget: boolean
  speed: number
  targetId: string | null
  turnInput: number
  turnAccumulator: number
  underpowered: boolean
  visualScale: number
}

export interface PrimarySpellFireProjectileState extends PrimarySpellProjectileBaseState {
  burnDamage: number
  emberDamage: number
  emberFragments: number
  explodeDamage: number
  explodeRadius: number
  kind: 'fire'
  privateSeed: number
  spentEmber: NativeFireSpentEmber
  underpowered: boolean
}

export type PrimarySpellProjectileState = (
  | PrimarySpellEarthProjectileState
  | PrimarySpellEtherProjectileState
  | PrimarySpellFireProjectileState
  | NativeWeldProjectileState
) & NativeWorldPainterOwner

interface PrimarySpellChannelTransientBase extends NativeWorldPainterOwner {
  ageTicks: number
  direction: Vector2
  id: number
  lightRegistration: NativeWorldManagerRegistration | null
  origin: Vector2
  ownerId: string
  underpowered: boolean
  variant: number
  worldKey: string
}

export interface PrimarySpellAirTransientState extends PrimarySpellChannelTransientBase {
  birthTick: number
  endpoint: Vector2
  hurricaneCharge: number
  kind: 'air'
  lightRegistration: NativeWorldManagerRegistration
  midpoint: Vector2
  targetId: string | null
}

export interface PrimarySpellWaterTransientState extends PrimarySpellChannelTransientBase {
  kind: 'water'
  lightRegistration: null
  obstructionDistance: number | null
  obstructionPoint: Vector2 | null
  speed: number
}

export type PrimarySpellChannelTransientState =
  | PrimarySpellAirTransientState
  | PrimarySpellWaterTransientState

export interface PrimarySpellChannelEmission {
  damage: number
  direction: Vector2
  endpoint: Vector2 | null
  id: number
  kind: 'air' | 'water' | 'weld'
  manaCost: number
  origin: Vector2
  ownerId: string
  primarySkill:
    | NativeAirPrimarySkillProfile
    | NativeWaterPrimarySkillProfile
    | NativeWeldPrimarySkillProfile
  queryOrigin: Vector2
  terrainContact: boolean
  underpowered: boolean
  worldKey: string
}

interface PrimarySpellOwnedTransientBase extends NativeWorldPainterOwner {
  ageTicks: number
  birthTick: number
  id: number
  ownerId: string
  worldKey: string
}

export interface PrimarySpellAirHurricaneState extends PrimarySpellOwnedTransientBase {
  charge: number
  contactCharge: number
  damageMaximum: number
  damageMinimum: number
  enhancedEffects: boolean
  kind: 'air-hurricane'
  lanes: readonly NativeHurricaneLane[]
  phaseDegrees: number
  position: Vector2
}

export interface PrimarySpellAirStormState extends PrimarySpellOwnedTransientBase {
  activeTicksRemaining: number
  alpha: number
  damageMaximum: number
  damageMinimum: number
  frequencyFactor: number
  headingDegrees: number
  kind: 'air-storm'
  moving: boolean
  position: Vector2
  scale: number
  strikeTicksRemaining: number
}

export interface PrimarySpellAirPrismaticState extends PrimarySpellOwnedTransientBase {
  durationTicks: number
  kind: 'air-prismatic'
  modifierDurationTicks: number
  origin: Vector2
  radius: number
}

export interface PrimarySpellWaterFreezeWaveState extends PrimarySpellOwnedTransientBase {
  alpha: number
  freezeDurationTicks: number
  hitTargetIds: readonly string[]
  kind: 'water-freeze-wave'
  life: number
  origin: Vector2
  radius: number
}

export interface PrimarySpellWaterAuraState extends PrimarySpellOwnedTransientBase {
  alphaDecay: number
  durationTicks: number
  initialRotationDegrees: number
  kind: 'water-aura'
  origin: Vector2
  rotationStepDegrees: number
}

export interface PrimarySpellWaterHailState extends PrimarySpellOwnedTransientBase {
  bounceProgress: number
  bounceSoundIndex: number | null
  bounceSoundPitch: number | null
  bounceSoundSequence: number
  height: number
  horizontalVelocity: Vector2
  kind: 'water-hail'
  life: number
  position: Vector2
  rotationDegrees: number
  rotationStepDegrees: number
  savedBounceVelocity: number
  scale: number
  verticalVelocity: number
}

export interface PrimarySpellEarthImpactState extends NativeWorldPainterOwner {
  ageTicks: number
  birthTick: number
  charge: number
  id: number
  kind: 'earth-impact'
  lightRegistration: null
  lifetimeTicks: number
  origin: Vector2
  ownerId: string
  worldKey: string
}

export interface PrimarySpellEarthBoulderBitState extends NativeWorldPainterOwner {
  ageTicks: number
  birthTick: number
  debris: NativeWeldBoulderDebrisParticleState
  id: number
  kind: 'earth-boulder-bit'
  lightRegistration: null
  origin: Vector2
  ownerId: string
  position: Vector2
  worldKey: string
}

export interface PrimarySpellEarthCalledRockState extends NativeWorldPainterOwner {
  ageTicks: number
  fallVelocity: number
  falling: boolean
  height: number
  id: number
  kind: 'earth-called-rock'
  lightRegistration: null
  lateralMagnitude: number
  ownerId: string
  parentId: number
  position: Vector2
  rotation: number
  rotationStep: number
  scale: number
  speed: number
  targetHeight: number
  variant: number
  worldKey: string
}

export interface PrimarySpellFireParticleState extends NativeWorldPainterOwner {
  ageTicks: number
  direction: Vector2
  id: number
  kind: 'fire'
  lightRegistration: null
  origin: Vector2
  ownerId: string
  variant: number
  worldKey: string
}

export interface PrimarySpellEtherImpactState extends NativeWorldPainterOwner {
  ageTicks: number
  birthTick: number
  id: number
  kind: 'ether-impact'
  lightRegistration: NativeWorldManagerRegistration
  origin: Vector2
  ownerId: string
  visualScale: number
  worldKey: string
}

export interface PrimarySpellEtherPierceStreakState extends NativeWorldPainterOwner {
  ageTicks: number
  headingDegrees: number
  id: number
  kind: 'ether-pierce-streak'
  origin: Vector2
  ownerId: string
  visualScale: number
  worldKey: string
}

export interface PrimarySpellEtherBlastState extends NativeWorldPainterOwner {
  ageTicks: number
  birthTick: number
  charges: number
  id: number
  kind: 'ether-blast'
  origin: Vector2
  ownerId: string
  presentationRng: NativeRngState
  worldKey: string
}

export interface PrimarySpellFireImpactState extends NativeWorldPainterOwner {
  ageTicks: number
  id: number
  kind: 'fire-impact'
  lightRegistration: NativeWorldManagerRegistration
  origin: Vector2
  ownerId: string
  worldKey: string
}

export interface PrimarySpellFireEmberState
  extends NativeFireEmberState, NativeWorldPainterOwner {
  readonly kind: 'fire-ember'
  readonly lightRegistration: NativeWorldManagerRegistration
}

export interface PrimarySpellFireExplosionState
  extends NativeFireExplosionState, NativeWorldPainterOwner {
  readonly ageTicks: number
  readonly id: number
  readonly kind: 'fire-explosion'
  readonly lightRegistration: NativeWorldManagerRegistration
  readonly soundPitch: number
}

export interface PrimarySpellFireGoodImpState
  extends NativeFireGoodImpState, NativeWorldPainterOwner {
  readonly kind: 'fire-good-imp'
  readonly lightRegistration: NativeWorldManagerRegistration
}

export type PrimarySpellFirePatchState = NativeFirePatchState

export type PrimarySpellTransientState = (
  | PrimarySpellChannelTransientState
  | PrimarySpellAirHurricaneState
  | PrimarySpellEarthBoulderBitState
  | PrimarySpellEarthCalledRockState
  | PrimarySpellEarthImpactState
  | PrimarySpellEtherImpactState
  | PrimarySpellEtherBlastState
  | PrimarySpellEtherPierceStreakState
  | PrimarySpellFireEmberState
  | PrimarySpellFireExplosionState
  | PrimarySpellFireGoodImpState
  | PrimarySpellFireImpactState
  | PrimarySpellFirePatchState
  | PrimarySpellFireParticleState
  | NativePlayerStaffTransient
  | NativeHardenEffect
  | PrimarySpellWaterAuraState
  | PrimarySpellWaterHailState
  | NativeWeldWorldActor
) & NativeWorldPainterOwner

export interface PrimarySpellSimulationState {
  nextId: number
  projectiles: readonly PrimarySpellProjectileState[]
  transients: readonly PrimarySpellTransientState[]
}

export interface PrimarySpellCastAuthority {
  weaponKind: NativePlayerWeaponKind
  alive?: boolean
  availableMana: number
  castProgressFactor: number
  eligible: boolean
  planeActive?: boolean
  primarySkill: NativePrimarySkillProfile
}

export interface PrimarySpellTickContext {
  canPlaceProjectile: (
    spell: Pick<PrimarySpellProjectileState, 'ownerId'>,
    position: Vector2,
    radius: number,
  ) => boolean
  canTraverseProjectile: (
    spell: PrimarySpellProjectileState | NativeWeldEtherealBoulderState,
    from: Vector2,
    to: Vector2,
    radius?: number,
    nativeExclusionMask?: number,
  ) => boolean
  findEnemyRoute?: (
    start: Readonly<Vector2>,
    end: Readonly<Vector2>,
    clearance: number,
    bodyRadius: number,
  ) => readonly Readonly<Vector2>[] | null
  castAuthority: Readonly<Record<string, PrimarySpellCastAuthority>>
  inputs: Readonly<Record<string, PlayerCharacterInput>>
  isEnemyPathClear?: (
    start: Readonly<Vector2>,
    end: Readonly<Vector2>,
  ) => boolean
  players: Readonly<Record<string, PlayerCharacterState>>
  previousPlayers: Readonly<Record<string, PlayerCharacterState>>
  registerWorldPainter?: RegisterNativeWorldPainter
  rng: NativeRngState
  spells: PrimarySpellSimulationState
  tick: number
  viewScale: number
  spellObstructionPoint: (
    ownerId: string,
    start: Vector2,
    end: Vector2,
    excludedSourceId: string | undefined,
    nativeExclusionMask: number,
  ) => Vector2 | null
  spellRangeEndpoint: (
    ownerId: string,
    start: Vector2,
    direction: Vector2,
    padding: number,
  ) => Vector2
  spellTargets: (ownerId: string) => readonly PrimarySpellTarget[]
  worldKeyForPlayer: (playerId: string) => string
}

export interface PrimarySpellTickResult {
  channelEmissions: readonly PrimarySpellChannelEmission[]
  fireActorContacts: readonly NativeFireActorContact[]
  manaUnderflowPlayerIds: readonly string[]
  manaSpent: Readonly<Record<string, number>>
  players: Readonly<Record<string, PlayerCharacterState>>
  rng: NativeRngState
  spells: PrimarySpellSimulationState
}

export const PRIMARY_CAST_ACTION_END_TICK = 73
export const PRIMARY_CAST_EMISSION_TICK = 18
export const PRIMARY_CAST_ETHER_ACTION_END_TICK = 55
export const PRIMARY_CAST_ETHER_EMISSION_TICK = 14
const PRIMARY_CAST_ETHER_RATE = Math.fround(0.075)
const PRIMARY_CAST_FIRE_RATE = Math.fround(PRIMARY_CAST_ETHER_RATE * 0.75)
export const PRIMARY_SPELL_AIR_REACH = 205
export const PRIMARY_SPELL_AIR_LIFETIME_TICKS = 5
export const PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS = 3
export const PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS = NATIVE_ETHER_IMPACT_VISIBLE_TICKS
export const PRIMARY_SPELL_WATER_REACH = 205
export const PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS = NATIVE_FIRE_IMPACT_LIFETIME_TICKS
export const PRIMARY_SPELL_PRISMATIC_LIFETIME_TICKS = 100
export const PRIMARY_SPELL_ETHER_COLLISION_RADIUS = 6
export const PRIMARY_SPELL_FIRE_COLLISION_RADIUS = 20
export const PRIMARY_SPELL_EARTH_INITIAL_CHARGE = NATIVE_PRIMARY_EARTH_INITIAL_CHARGE
export const PRIMARY_SPELL_EARTH_CHARGE_STEP = Math.fround(0.00125)
export const PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE = Math.fround(0.3)
export const PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE = 75

export function nativePrimaryBirthTerrainExclusionMask(
  spell: PrimarySpellProjectileState,
): number {
  if (spell.kind === 'fire') return NATIVE_PRIMARY_FLIGHT_TERRAIN_EXCLUSION_MASK
  if (spell.kind === 'ether') return NATIVE_PRIMARY_CAST_TERRAIN_EXCLUSION_MASK
  if (spell.kind === 'weld' && isMagicMissileDerivedWeldBuild(spell.buildId)) {
    return NATIVE_PRIMARY_CAST_TERRAIN_EXCLUSION_MASK
  }
  return 0
}

export function nativePrimaryFlightTerrainExclusionMask(
  spell: PrimarySpellProjectileState | NativeWeldEtherealBoulderState,
): number {
  if (spell.kind === 'fire' || spell.kind === 'ether') {
    return NATIVE_PRIMARY_FLIGHT_TERRAIN_EXCLUSION_MASK
  }
  if (spell.kind === 'weld' && isMagicMissileDerivedWeldBuild(spell.buildId)) {
    return NATIVE_PRIMARY_FLIGHT_TERRAIN_EXCLUSION_MASK
  }
  return 0
}
export const PRIMARY_SPELL_EARTH_CALLED_ROCK_INITIAL_SPEED = Math.fround(0.1)
export const PRIMARY_SPELL_EARTH_CALLED_ROCK_SPEED_MULTIPLIER = 1.100000023841858
export const PRIMARY_SPELL_EARTH_CALLED_ROCK_SPEED_CAP = 5
export const PRIMARY_SPELL_EARTH_CALLED_ROCK_REMOVE_DISTANCE = 5
export const PRIMARY_SPELL_EARTH_FIRST_TICK_CHARGE = Math.fround(
  PRIMARY_SPELL_EARTH_INITIAL_CHARGE + PRIMARY_SPELL_EARTH_CHARGE_STEP,
)
export const PRIMARY_SPELL_ETHER_UNDERPOWERED_SPEED = Math.fround(2.4)
export const PRIMARY_SPELL_ETHER_UNDERPOWERED_TURN_INPUT = Math.fround(1.2)
export const PRIMARY_SPELL_TICKS_PER_SECOND = 100
export const PRIMARY_SPELL_RANK_ONE_MANA_COSTS = {
  air: 0.12,
  earth: 0.12,
  ether: 6,
  fire: 12,
  water: 0.125,
} as const satisfies Readonly<Record<WizardElement, number>>

export function createPrimarySpellSimulation(): PrimarySpellSimulationState {
  return { nextId: 1, projectiles: [], transients: [] }
}

export function nativePrimaryPainterRegistrationContract(
  state: PrimarySpellProjectileState | PrimarySpellTransientState,
): Readonly<{ count: number; managerLane: 'actor' | 'transient' }> {
  if (
    state.kind === 'earth'
    || state.kind === 'ether'
    || (state.kind === 'fire' && 'phase' in state)
    || state.kind === 'weld'
  ) return { count: 1, managerLane: 'actor' }
  switch (state.kind) {
    case 'air':
      return { count: 3, managerLane: 'actor' }
    case 'earth-impact':
      return {
        count: earthImpactFragmentCount(state.charge),
        managerLane: 'actor',
      }
    case 'ether-blast':
      return {
        count: NATIVE_ETHER_BLAST_PARTICLE_COUNT,
        managerLane: 'transient',
      }
    case 'ether-impact':
    case 'ether-pierce-streak':
    case 'fire-explosion':
    case 'fire-impact':
    case 'harden-shard':
    case 'water':
      return { count: 1, managerLane: 'transient' }
    case 'player-staff-contact':
    case 'player-staff-contact-knockback':
    case 'player-staff-knockback':
    case 'player-staff-melee':
    case 'player-staff-spin':
      return { count: 0, managerLane: 'actor' }
    default:
      return { count: 1, managerLane: 'actor' }
  }
}

function enrollPrimarySpellPainterRegistrations(
  source: PrimarySpellSimulationState,
  registerWorldPainter: RegisterNativeWorldPainter,
): PrimarySpellSimulationState {
  const enroll = <T extends PrimarySpellProjectileState | PrimarySpellTransientState>(
    state: T,
  ): T => {
    const contract = nativePrimaryPainterRegistrationContract(state)
    const existing = 'painterRegistrations' in state
      ? state.painterRegistrations
      : undefined
    if (existing !== undefined && (
      existing.length !== contract.count
      || existing.some(({ managerLane }) => managerLane !== contract.managerLane)
    )) {
      throw new Error(`${state.kind} changed native painter-manager membership`)
    }
    if (existing !== undefined) return state
    const lightRegistration = 'lightRegistration' in state
      ? state.lightRegistration
      : null
    const painterRegistrations = contract.count === 1
      && lightRegistration?.managerLane === contract.managerLane
      ? Object.freeze([lightRegistration])
      : registerNativeWorldPainterRoots(
          registerWorldPainter,
          contract.managerLane,
          contract.count,
        )
    return Object.freeze({ ...state, painterRegistrations }) as unknown as T
  }
  const projectiles = source.projectiles.map(enroll)
  const transients = source.transients.map(enroll)
  return projectiles.every((state, index) => state === source.projectiles[index])
    && transients.every((state, index) => state === source.transients[index])
    ? source
    : { ...source, projectiles, transients }
}

function standalonePrimaryWorldManagerOrderState(source: PrimarySpellSimulationState) {
  const nextRegistrationOrdinal = { actor: 0, transient: 0 }
  for (const registration of [
    ...source.projectiles.map(({ lightRegistration }) => lightRegistration),
    ...source.projectiles.flatMap((projectile) => (
      'painterRegistrations' in projectile ? projectile.painterRegistrations ?? [] : []
    )),
    ...source.transients.flatMap((transient) => (
      'lightRegistration' in transient && transient.lightRegistration !== undefined
        ? [transient.lightRegistration]
        : []
    )),
    ...source.transients.flatMap((transient) => (
      'painterRegistrations' in transient ? transient.painterRegistrations ?? [] : []
    )),
  ]) {
    if (registration === null) continue
    nextRegistrationOrdinal[registration.managerLane] = Math.max(
      nextRegistrationOrdinal[registration.managerLane],
      registration.registrationOrdinal + 1,
    )
  }
  return { nextRegistrationOrdinal }
}

export function primaryCastPose(
  actionTick: number,
  channelActive = false,
  element: WizardElement = 'fire',
): 0 | 1 | 7 | 8 {
  if (channelActive) return actionTick <= 0 ? 0 : 7
  const actionEndTick = primaryCastActionEndTick(element)
  const emissionProgress = primaryCastEmissionProgress(element)
  const recoveryProgress = 2 / primaryCastRate(element)
  if (actionTick <= 0 || actionTick >= actionEndTick) return 0
  if (actionTick < emissionProgress) return 1
  if (actionTick < recoveryProgress) return 8
  return 7
}

export function primaryCastPresentationPose(
  cast: PlayerPrimaryCastState,
  element: WizardElement = 'fire',
): 0 | 1 | 7 | 8 {
  if (cast.oneShotAttackPoseHeld) return 8
  return primaryCastPose(cast.actionTick, cast.channelActive, element)
}

export function primaryCastActionEndTick(element: WizardElement): number {
  return element === 'ether'
    ? PRIMARY_CAST_ETHER_ACTION_END_TICK
    : PRIMARY_CAST_ACTION_END_TICK
}

export function primaryCastEmissionTick(element: WizardElement): number {
  return element === 'ether'
    ? PRIMARY_CAST_ETHER_EMISSION_TICK
    : PRIMARY_CAST_EMISSION_TICK
}

function primaryCastRate(element: WizardElement): number {
  return element === 'ether' ? PRIMARY_CAST_ETHER_RATE : PRIMARY_CAST_FIRE_RATE
}

// actionTick accumulates the live cast-speed factor in neutral-rate units.
// Dividing the native progress markers by the stored base rate preserves
// float-action crossings without mistaking capture-row indices for durations.
function primaryCastEmissionProgress(element: WizardElement): number {
  return 1 / primaryCastRate(element)
}

function primaryCastCompletionProgress(element: WizardElement): number {
  return 4 / primaryCastRate(element)
}

function primarySpellEmitter(
  player: Pick<PlayerCharacterState, 'config' | 'headingIndex' | 'position' | 'primaryCast'>,
  selectedElement: WizardElement,
  weaponKind: NativePlayerWeaponKind,
): Vector2 {
  const offset = primarySpellEmitterOffset(
    player.headingIndex,
    player.primaryCast.actionTick,
    player.primaryCast.channelActive,
    selectedElement,
    weaponKind,
  )
  return {
    x: player.position.x + offset.x,
    y: player.position.y + offset.y,
  }
}

export function primarySpellEmitterOffset(
  headingIndex: number,
  actionTick: number,
  channelActive = false,
  element: WizardElement = 'fire',
  weaponKind: NativePlayerWeaponKind = 'staff',
): Vector2 {
  if (weaponKind === null) return playerHandSpellEmitterOffset(headingIndex)
  if (weaponKind === 'wand') {
    return playerWandSpellEmitterOffset(headingIndex, playerWandPrimaryPose(actionTick, channelActive, element))
  }
  const pose = primaryCastPose(actionTick, channelActive, element)
  return playerStaffAttachmentOffset(headingIndex, pose)
}

export function stepPrimarySpells(context: PrimarySpellTickContext): PrimarySpellTickResult {
  const registerWorldPainter = context.registerWorldPainter
    ?? createNativeWorldManagerOrder(standalonePrimaryWorldManagerOrderState(context.spells)).register
  let nextId = context.spells.nextId
  let rng = context.rng
  let transients: PrimarySpellTransientState[] = []
  const advanceProjectileWithPresentation = (
    spell: PrimarySpellProjectileState,
    targets: readonly PrimarySpellTarget[],
  ): PrimarySpellProjectileState => {
    const advanced = advanceProjectile(spell, targets)
    if (advanced.kind !== 'weld') return advanced
    const presentation = stepNativeWeldProjectilePresentation(advanced, rng)
    rng = presentation.rng
    if (presentation.projectile.buildId === 1009) {
      const fadeProgram = createNativeWeldGroundSparkFadeProgram({
        projectile: presentation.projectile,
        rng,
      })
      rng = fadeProgram.rng
      for (const seed of fadeProgram.fades) {
        transients.push(createNativeWeldGroundSparkFadeActor({
          direction: presentation.projectile.direction,
          id: nextId,
          ownerId: presentation.projectile.ownerId,
          seed,
          tick: context.tick,
          vector: presentation.projectile.vector,
          worldKey: presentation.projectile.worldKey,
        }))
        nextId += 1
      }
    }
    return presentation.projectile
  }
  const existingCalledRockIds = new Set(context.spells.transients
    .filter((effect) => effect.kind === 'earth-called-rock')
    .map((effect) => effect.id))
  const fireActorContacts: NativeFireActorContact[] = []
  for (const effect of context.spells.transients) {
    if (effect.kind === 'harden-shard' || effect.kind === 'harden-burst') {
      const stepped = stepNativeHardenEffect(effect, context.tick, rng, (position) => (
        context.canPlaceProjectile(effect, position, 0)
      ))
      rng = stepped.rng
      if (stepped.effect) transients.push(stepped.effect)
    } else if (effect.kind === 'earth-boulder-bit') {
      const stepped = stepNativeWeldBoulderDebrisParticle(
        effect.debris,
        effect.birthTick + effect.ageTicks + 1,
        rng,
      )
      rng = stepped.rng
      if (stepped.particle) {
        transients.push({
          ...effect,
          ageTicks: effect.ageTicks + 1,
          debris: stepped.particle,
        })
      }
    } else if (isNativeWeldWorldActor(effect)) {
      if (
        effect.kind === 'weld-persistent'
        && effect.buildId === 1008
        && effect.phase === 'flight'
      ) {
        const lookahead = {
          x: Math.fround(
            effect.origin.x + effect.direction.x * NATIVE_WELD_HAIL_LOOKAHEAD_DISTANCE,
          ),
          y: Math.fround(
            effect.origin.y + effect.direction.y * NATIVE_WELD_HAIL_LOOKAHEAD_DISTANCE,
          ),
        }
        if (context.spellObstructionPoint(
          effect.ownerId,
          effect.origin,
          lookahead,
          undefined,
          NATIVE_PRIMARY_FLIGHT_TERRAIN_EXCLUSION_MASK,
        ) !== null) {
          const impact = createNativeWeldHailTerrainImpact({
            actor: effect,
            enhancedEffects: true,
            firstId: nextId,
            rng,
            tick: context.tick,
          })
          transients.push(...impact.actors)
          nextId = impact.nextId
          rng = impact.rng
          continue
        }
      }
      const stepped = stepNativeWeldWorldActor(effect, rng, (actor, from, to) => (
        actor.buildId !== 1006 || context.canTraverseProjectile(
          actor,
          from,
          to,
          actor.scale * PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE,
        )
      ))
      rng = stepped.rng
      if (stepped.terrainContact) {
        const terminal = createPrimarySpellWeldBoulderTerminal(
          nextId,
          stepped.terrainContact,
          context.tick,
          rng,
          registerWorldPainter,
        )
        nextId = terminal.nextId
        rng = terminal.rng
        transients.push(...terminal.transients)
      } else if (stepped.actor) {
        transients.push(stepped.actor)
        if (
          stepped.actor.kind === 'weld-meteor'
          && stepped.actor.impactDue
          && effect.kind === 'weld-meteor'
          && !effect.impactDue
        ) {
          transients.push(createNativeWeldMeteorFlash({
            actor: stepped.actor,
            id: nextId,
            tick: context.tick,
          }))
          nextId += 1
          for (const debris of stepped.debris ?? []) {
            transients.push(createNativeWeldBoulderDebrisActor({
              buildId: 1007,
              debris,
              direction: stepped.actor.direction,
              id: nextId,
              origin: stepped.actor.position,
              ownerId: stepped.actor.ownerId,
              tick: context.tick,
              vector: stepped.actor.vector,
              worldKey: stepped.actor.worldKey,
            }))
            nextId += 1
          }
        }
      }
    } else if (
      effect.kind === 'earth-called-rock'
      || isNativePlayerStaffTransient(effect)
      || effect.kind === 'air-hurricane'
      || effect.kind === 'water-hail'
    ) {
      transients.push(effect)
    } else if (effect.kind === 'fire-good-imp') {
      const stepped = stepNativeFireGoodImp(effect, {
        canOccupy: (position) => context.canPlaceProjectile(
          effect,
          position,
          effect.collisionRadius,
        ),
        ...(context.findEnemyRoute === undefined
          ? {}
          : { findRoute: context.findEnemyRoute }),
        ...(context.isEnemyPathClear === undefined
          ? {}
          : { isPathClear: context.isEnemyPathClear }),
        rng,
        targets: context.spellTargets(effect.ownerId),
      })
      rng = stepped.rng
      if (stepped.contact) fireActorContacts.push(stepped.contact)
      if (stepped.goodImp) {
        transients.push({
          ...stepped.goodImp,
          kind: 'fire-good-imp',
          lightRegistration: effect.lightRegistration,
          painterRegistrations: effect.painterRegistrations,
        })
      } else if (stepped.releaseFire) {
        const patchSpawn = spawnNativeFirePatch({
          burnDamage: effect.burnDamage,
          damage: effect.damage,
          id: nextId,
          nativeType: 'fire',
          ownerId: effect.ownerId,
          painterRegistration: registerWorldPainter('actor'),
          position: stepped.releasePosition,
          worldKey: effect.worldKey,
        }, rng)
        transients.push(patchSpawn.patch)
        rng = patchSpawn.rng
        nextId += 1
      }
    } else if (effect.kind === 'fire-patch') {
      const stepped = stepNativeFirePatch(effect, context.tick)
      if (stepped.contact) fireActorContacts.push(stepped.contact)
      if (stepped.patch) transients.push(stepped.patch)
    } else if (effect.kind === 'fire-ember') {
      const stepped = stepNativeFireEmber(effect)
      if (stepped.ember) {
        const ember = {
          ...stepped.ember,
          kind: 'fire-ember' as const,
          lightRegistration: effect.lightRegistration,
        }
        if (context.canPlaceProjectile(ember, ember.position, 7)) {
          transients.push(ember)
        } else {
          transients.push(fireImpactAt(
            nextId,
            ember.position,
            ember.ownerId,
            ember.worldKey,
            registerWorldPainter('transient'),
          ))
          nextId += 1
        }
      } else if (stepped.retirement.kind === 'immolate') {
        const soundPitch = drawNativeFloat(rng, 0.1, true)
        rng = soundPitch.state
        transients.push({
          ...stepped.retirement.explosion,
          ageTicks: 0,
          id: nextId,
          kind: 'fire-explosion',
          lightRegistration: registerWorldPainter('transient'),
          soundPitch: Math.fround(1 + soundPitch.value),
        })
        nextId += 1
      } else if (stepped.retirement.kind === 'imp') {
        const goodImpSpawn = spawnNativeFireGoodImp({
          burnDamage: stepped.retirement.burnDamage,
          damage: stepped.retirement.damage,
          id: nextId,
          lifetimeTicks: stepped.retirement.lifetimeTicks,
          ownerId: stepped.retirement.ownerId,
          position: stepped.retirement.position,
          worldKey: stepped.retirement.worldKey,
        }, rng)
        rng = goodImpSpawn.rng
        const goodImpRegistration = registerWorldPainter('actor')
        transients.push({
          ...goodImpSpawn.goodImp,
          kind: 'fire-good-imp',
          lightRegistration: goodImpRegistration,
          painterRegistrations: Object.freeze([goodImpRegistration]),
        })
        nextId += 1
        const patchSpawn = spawnNativeFirePatch({
          burnDamage: stepped.retirement.burnDamage,
          damage: stepped.retirement.damage,
          id: nextId,
          nativeType: 'fire',
          ownerId: stepped.retirement.ownerId,
          painterRegistration: registerWorldPainter('actor'),
          position: stepped.retirement.position,
          worldKey: stepped.retirement.worldKey,
        }, rng)
        transients.push(patchSpawn.patch)
        rng = patchSpawn.rng
        nextId += 1
      }
    } else if (effect.ageTicks + 1 < transientLifetime(effect)) {
      transients.push({ ...effect, ageTicks: effect.ageTicks + 1 })
    }
  }
  let projectiles: PrimarySpellProjectileState[] = []
  for (const spell of context.spells.projectiles) {
    if (spell.phase === 'held') {
      projectiles.push(advanceProjectileWithPresentation(spell, []))
      continue
    }
    if (
      (spell.kind === 'ether' || spell.kind === 'fire' || spell.kind === 'weld')
      && spell.ageTicks % 5 === 0
      && !context.canTraverseProjectile(
        spell,
        spell.position,
        {
          x: spell.position.x + spell.velocity.x * 5,
          y: spell.position.y + spell.velocity.y * 5,
        },
        0,
        nativePrimaryFlightTerrainExclusionMask(spell),
      )
    ) {
      if (spell.kind === 'fire') {
        const detonation = createPrimarySpellFireDetonation(
          nextId,
          spell,
          spell.position,
          rng,
          registerWorldPainter,
        )
        rng = detonation.rng
        fireActorContacts.push(...detonation.contacts)
        transients = [...transients, ...detonation.transients]
        nextId = detonation.nextId
      } else if (spell.kind === 'ether') {
        transients = [...transients, etherImpact(
          nextId,
          spell,
          context.tick,
          registerWorldPainter('transient'),
        )]
        nextId += 1
      } else if (spell.buildId === 1000) {
        const detonation = createPrimarySpellWeldFireDetonation(
          nextId,
          spell,
          spell.position,
          context.tick,
          rng,
          spell.presentationSeed ?? 0,
          true,
          registerWorldPainter,
        )
        rng = detonation.rng
        fireActorContacts.push(...detonation.contacts)
        transients = [...transients, ...detonation.transients]
        nextId = detonation.nextId
      } else {
        const impact = createPrimarySpellWeldImpact(nextId, spell, context.tick, rng)
        rng = impact.rng
        transients = [...transients, impact.impact]
        nextId += 1
      }
      continue
    }
    const targets = context.spellTargets(spell.ownerId)
    const advanced = advanceProjectileWithPresentation(spell, targets)
    if (
      advanced.kind === 'earth'
      && !context.canTraverseProjectile(
        advanced,
        advanced.position,
        {
          x: Math.fround(advanced.position.x + advanced.velocity.x),
          y: Math.fround(advanced.position.y + advanced.velocity.y),
        },
        advanced.charge * PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE,
      )
    ) {
      transients = [
        ...transients,
        earthImpact(nextId, advanced, context.tick, registerWorldPainter),
      ]
      nextId += 1
      continue
    }
    projectiles.push(advanced)
  }
  const manaSpent: Record<string, number> = {}
  const manaUnderflowPlayerIds = new Set<string>()
  const channelEmissions: PrimarySpellChannelEmission[] = []
  const players: Record<string, PlayerCharacterState> = { ...context.players }

  for (const spell of projectiles) {
    if (spell.kind !== 'fire' && !(spell.kind === 'weld' && spell.buildId === 1000)) continue
    transients = [...transients, createFireParticle(
      nextId,
      spell,
      registerWorldPainter,
    )]
    nextId += 1
  }

  for (const [playerId, player] of Object.entries(context.players)) {
    const previous = context.previousPlayers[playerId] ?? player
    const input = context.inputs[playerId]
    const authority = context.castAuthority[playerId]
    const primaryElement = authority?.primarySkill.kind === 'weld'
      ? null
      : authority?.primarySkill.kind ?? null
    const castClockElement = primaryElement ?? 'fire'
    const manaCost = authority
      ? primarySpellManaCost(castClockElement, authority.primarySkill)
      : 0
    let availableMana = authority?.availableMana ?? 0
    manaSpent[playerId] = 0
    const debitMana = (cost = manaCost): boolean => {
      if (cost > availableMana) manaUnderflowPlayerIds.add(playerId)
      const spent = Math.min(Math.max(0, availableMana), cost)
      availableMana = Math.max(0, availableMana - spent)
      manaSpent[playerId] += spent
      return availableMana <= 0
    }
    const spendAmount = (cost: number): boolean => {
      if (availableMana < cost) {
        manaUnderflowPlayerIds.add(playerId)
        return false
      }
      availableMana -= cost
      manaSpent[playerId] += cost
      return true
    }
    let earthAcceptedUnderpowered: boolean | null = null
    const rawHeld = input?.cast.primary === true && input.aim !== null
    const selectedPrimaryId = authority?.primarySkill.skillId
      ?? previous.primaryCast.selectedPrimaryId
    const nativeSelectedPrimaryAge = previous.primaryCast.selectedPrimaryId
      === selectedPrimaryId
      ? previous.primaryCast.selectedPrimaryAgeTicks
      : -1
    const pressed = rawHeld && !previous.primaryCast.held
    const released = !rawHeld && previous.primaryCast.held
    const oneShotPrimary = authority?.primarySkill.kind === 'weld'
      ? authority.primarySkill.castKind === 'one-shot'
      : primaryElement === 'ether' || primaryElement === 'fire'
    const castProgressFactor = authority?.castProgressFactor ?? 1
    const actionAvailable = previous.primaryCast.actionTick < 0 || (
      oneShotPrimary
      && !previous.primaryCast.channelActive
      && previous.primaryCast.actionTick > primaryCastCompletionProgress(castClockElement)
    )
    const acceptedCast = rawHeld
      && actionAvailable
      && (pressed || (oneShotPrimary && previous.primaryCast.castSequence > 0))
      && authority?.eligible === true
    const sustainedPrimary = authority?.primarySkill.kind === 'weld'
      ? authority.primarySkill.castKind !== 'one-shot'
      : primaryElement === 'air' || primaryElement === 'water' || primaryElement === 'earth'
    const aimDirection = rawHeld && input?.aim
      ? primarySpellAimDirection(player.position, input.aim, context.viewScale)
      : previous.primaryCast.aimDirection
    let primaryCast = advancePrimaryCast(
      previous.primaryCast,
      rawHeld,
      acceptedCast,
      castClockElement,
      castProgressFactor,
    )
    if (!oneShotPrimary && primaryCast.oneShotAttackPoseHeld) {
      primaryCast = { ...primaryCast, oneShotAttackPoseHeld: false }
    }
    primaryCast = {
      ...primaryCast,
      selectedPrimaryAgeTicks: nativeSelectedPrimaryAge + 1,
      selectedPrimaryId,
      weaponPulse: Math.fround(
        previous.primaryCast.weaponPulse * NATIVE_PLAYER_WEAPON_PULSE_DECAY,
      ),
    }
    const castOwnsFacing = playerPrimaryCastOwnsFacing(primaryCast)
    let nextPlayer: PlayerCharacterState = {
      ...player,
      headingIndex: castOwnsFacing
        ? actorHeadingIndex(actorHeadingFromVector(aimDirection.x, aimDirection.y))
        : player.headingIndex,
      primaryCast: { ...primaryCast, aimDirection },
    }
    const worldKey = context.worldKeyForPlayer(playerId)
    const finishEtherBlastTick = (
      sourcePlayer: PlayerCharacterState,
    ): PlayerCharacterState => {
      if (authority?.planeActive === true) {
        return {
          ...sourcePlayer,
          primaryCast: { ...sourcePlayer.primaryCast, etherBlastCharge: 0 },
        }
      }
      if (
        authority?.alive !== true
        || authority.primarySkill.kind !== 'ether'
        || authority.primarySkill.skillId !== 8
      ) return sourcePlayer
      const charge = advanceNativeEtherBlastCharge(
        sourcePlayer.primaryCast.etherBlastCharge,
        authority.primarySkill.blastChargeCapacity,
        availableMana >= manaCost,
        false,
      )
      return {
        ...sourcePlayer,
        primaryCast: {
          ...sourcePlayer.primaryCast,
          etherBlastCharge: charge.charge,
          etherBlastChargeCueSequence: charge.crossedInteger
            ? sourcePlayer.primaryCast.etherBlastChargeCueSequence + 1
            : sourcePlayer.primaryCast.etherBlastChargeCueSequence,
          weaponPulse: charge.crossedInteger
            ? NATIVE_ETHER_BLAST_WEAPON_PULSE
            : sourcePlayer.primaryCast.weaponPulse,
        },
      }
    }

    if (authority?.eligible !== true) {
      if (primaryElement === 'earth') {
        projectiles = projectiles.filter((spell) => !(
          spell.kind === 'earth'
          && spell.ownerId === playerId
          && spell.phase === 'held'
        ))
      }
      if (previous.primaryCast.channelActive) {
        transients = transients.filter((effect) => !(
          effect.kind === 'weld-persistent' && effect.ownerId === playerId
        ))
      }
      players[playerId] = finishEtherBlastTick({
        ...nextPlayer,
        primaryCast: {
          ...nextPlayer.primaryCast,
          actionTick: -1,
          channelActive: false,
          oneShotAttackPoseHeld: false,
          underpowered: false,
        },
      })
      continue
    }

    if (acceptedCast) {
      nextPlayer = {
        ...nextPlayer,
        primaryCast: {
          ...nextPlayer.primaryCast,
          lastWeldPlaybackRate: null,
          lastWeldSoundVariant: null,
        },
      }
      if (authority.primarySkill.kind === 'weld') {
        if (authority.primarySkill.castKind !== 'one-shot') {
          primaryCast = { ...nextPlayer.primaryCast, channelActive: true }
          nextPlayer = { ...nextPlayer, primaryCast }
        }
      } else {
      switch (primaryElement) {
        case 'air':
        case 'water':
          primaryCast = { ...nextPlayer.primaryCast, channelActive: true }
          nextPlayer = { ...nextPlayer, primaryCast }
          break
        case 'earth': {
          const earthSkill = authority.primarySkill
          if (earthSkill.kind !== 'earth') throw new Error('Expected an Earth skill profile')
          earthAcceptedUnderpowered = debitMana()
          let surged = false
          if (earthSkill.rockSurgeChance > 0) {
            const draw = drawNativeInteger(rng, 10_000)
            rng = draw.state
            surged = draw.value < earthSkill.rockSurgeChance * 100
              && spendAmount(earthSkill.rockSurgeManaCost)
          }
          primaryCast = {
            ...nextPlayer.primaryCast,
            actionTick: surged ? -1 : nextPlayer.primaryCast.actionTick,
            channelActive: !surged,
            emissionSequence: surged
              ? nextPlayer.primaryCast.emissionSequence + 1
              : nextPlayer.primaryCast.emissionSequence,
          }
          nextPlayer = { ...nextPlayer, primaryCast }
          const emitter = primarySpellEmitter(nextPlayer, castClockElement, authority.weaponKind)
          const initialCharge = surged
            ? earthSkill.maximumCharge
            : advanceNativeEarthBoulderCharge(
                PRIMARY_SPELL_EARTH_INITIAL_CHARGE,
                earthSkill.growthFactor,
                earthSkill.maximumCharge,
              )
          const position = surged
            ? {
                x: Math.fround(nextPlayer.position.x + aimDirection.x * 60),
                y: Math.fround(nextPlayer.position.y + aimDirection.y * 60),
              }
            : { x: emitter.x, y: emitter.y + 15 }
          const velocity = surged
            ? {
                x: Math.fround(aimDirection.x * 3),
                y: Math.fround(aimDirection.y * 3),
              }
            : { x: 0, y: 0 }
          const painterRegistration = registerWorldPainter('actor')
          projectiles = [...projectiles, {
            ageTicks: 1,
            assemblyCharge: surged ? initialCharge : PRIMARY_SPELL_EARTH_INITIAL_CHARGE,
            charge: initialCharge,
            damage: earthSkill.damageMinimum,
            direction: { ...aimDirection },
            flightTicks: surged ? 1 : 0,
            hitTargetIds: [],
            id: nextId,
            kind: 'earth',
            lightRegistration: painterRegistration,
            maximumCharge: earthSkill.maximumCharge,
            orientation: surged
              ? earthBoulderFlightOrientationStep(
                  EARTH_BOULDER_IDENTITY_ORIENTATION,
                  aimDirection,
                  velocity,
                  initialCharge,
              )
              : [...EARTH_BOULDER_IDENTITY_ORIENTATION],
            ownerId: playerId,
            painterRegistrations: Object.freeze([painterRegistration]),
            phase: surged ? 'flight' : 'held',
            position,
            remainingDamage: surged
              ? nativeEarthBoulderReleasedDamage(
                  earthSkill.damageMinimum,
                  initialCharge,
                )
              : earthSkill.damageMinimum,
            shellCharge: surged ? initialCharge : PRIMARY_SPELL_EARTH_INITIAL_CHARGE,
            toughness: earthSkill.toughness,
            velocity,
            worldKey,
          }]
          nextId += 1
          break
        }
        case 'ether':
        case 'fire':
          break
      }
      }
    }

    if (acceptedCast && sustainedPrimary) {
      nextPlayer = {
        ...nextPlayer,
        primaryCast: {
          ...nextPlayer.primaryCast,
          weaponPulse: NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY,
        },
      }
    }

    const emissionProgress = primaryCastEmissionProgress(castClockElement)
    if (
      nextPlayer.primaryCast.actionTick >= emissionProgress
      && previous.primaryCast.actionTick < emissionProgress
      && oneShotPrimary
    ) {
      if (
        primaryElement === 'ether'
        && authority.primarySkill.kind === 'ether'
        && authority.primarySkill.skillId === 8
      ) {
        const storedCharge = nextPlayer.primaryCast.etherBlastCharge
        if (storedCharge > 0) {
          const charges = nativeEtherBlastReleaseCharges(storedCharge)
          nextPlayer = {
            ...nextPlayer,
            primaryCast: { ...nextPlayer.primaryCast, etherBlastCharge: 0 },
          }
          if (charges > 0) {
            const presentationRng = rng
            const program = createNativeEtherBlastParticleProgram(rng)
            rng = program.rng
            transients.push(Object.freeze({
              ageTicks: 0,
              birthTick: context.tick,
              charges,
              id: nextId,
              kind: 'ether-blast',
              origin: nativeEtherBlastPulseOrigin(nextPlayer.position, aimDirection),
              ownerId: playerId,
              painterRegistrations: registerNativeWorldPainterRoots(
                registerWorldPainter,
                'transient',
                NATIVE_ETHER_BLAST_PARTICLE_COUNT,
              ),
              presentationRng,
              worldKey,
            }))
            nextId += 1
          }
        }
      }
      const underpowered = debitMana()
      const birth = authority.primarySkill.kind === 'weld'
        ? spawnNativeWeldOneShot({
            aimDirection,
            firstId: nextId,
            origin: primarySpellEmitter(nextPlayer, castClockElement, authority.weaponKind),
            ownerId: playerId,
            primarySkill: authority.primarySkill,
            registerWorldPainter,
            rng,
            targets: context.spellTargets(playerId),
            underpowered,
            worldKey,
          })
        : createOneShotProjectiles(
            nextId,
            playerId,
            nextPlayer,
            primaryElement as 'ether' | 'fire',
            authority.weaponKind,
            authority.primarySkill,
            worldKey,
            context.spellTargets(playerId),
            rng,
            underpowered,
            registerWorldPainter,
          )
      rng = birth.rng
      nextId += birth.projectiles.length
      for (const born of birth.projectiles) {
        if (born.kind === 'fire') {
          const birthMask = nativePrimaryBirthTerrainExclusionMask(born)
          const flightMask = nativePrimaryFlightTerrainExclusionMask(born)
          const initialClear = context.canTraverseProjectile(
            born,
            nextPlayer.position,
            born.position,
            0,
            birthMask,
          )
          const firstLookaheadClear = initialClear && context.canTraverseProjectile(
            born,
            born.position,
            {
              x: born.position.x + born.velocity.x * 5,
              y: born.position.y + born.velocity.y * 5,
            },
            0,
            flightMask,
          )
          if (initialClear && firstLookaheadClear) {
            const spell = advanceProjectileWithPresentation(born, [])
            projectiles = [...projectiles, spell]
            transients = [...transients, createFireParticle(
              nextId,
              spell,
              registerWorldPainter,
            )]
            nextId += 1
          } else {
            const detonation = createPrimarySpellFireDetonation(
              nextId,
              born,
              born.position,
              rng,
              registerWorldPainter,
            )
            rng = detonation.rng
            fireActorContacts.push(...detonation.contacts)
            transients = [...transients, ...detonation.transients]
            nextId = detonation.nextId
          }
        } else if (born.kind === 'ether') {
          const initialClear = context.canTraverseProjectile(
            born,
            nextPlayer.position,
            born.position,
            0,
            nativePrimaryBirthTerrainExclusionMask(born),
          )
          const firstLookaheadClear = initialClear && context.canTraverseProjectile(
            born,
            born.position,
            {
              x: born.position.x + born.velocity.x * 5,
              y: born.position.y + born.velocity.y * 5,
            },
            0,
            nativePrimaryFlightTerrainExclusionMask(born),
          )
          if (firstLookaheadClear) {
            const spell = advanceProjectileWithPresentation(
              born,
              context.spellTargets(playerId),
            )
            if (spell.kind !== 'ether') throw new Error('Expected an Ether projectile')
            projectiles = [...projectiles, spell]
          } else {
            transients = [...transients, etherImpact(
              nextId,
              born,
              context.tick,
              registerWorldPainter('transient'),
            )]
            nextId += 1
          }
        } else {
          const initialClear = !isMagicMissileDerivedWeldBuild(born.buildId)
            || context.canTraverseProjectile(
              born,
              nextPlayer.position,
              born.position,
              0,
              nativePrimaryBirthTerrainExclusionMask(born),
            )
          const firstLookaheadClear = initialClear && context.canTraverseProjectile(
            born,
            born.position,
            {
              x: born.position.x + born.velocity.x * 5,
              y: born.position.y + born.velocity.y * 5,
            },
            0,
            nativePrimaryFlightTerrainExclusionMask(born),
          )
          if (firstLookaheadClear) {
            const spell = advanceProjectileWithPresentation(
              born,
              context.spellTargets(playerId),
            )
            projectiles = [...projectiles, spell]
            if (spell.kind === 'weld' && spell.buildId === 1000) {
              transients = [...transients, createFireParticle(
                nextId,
                spell,
                registerWorldPainter,
              )]
              nextId += 1
            }
          } else if (born.buildId === 1000) {
            const detonation = createPrimarySpellWeldFireDetonation(
              nextId,
              born,
              born.position,
              context.tick,
              rng,
              born.presentationSeed ?? 0,
              true,
              registerWorldPainter,
            )
            rng = detonation.rng
            fireActorContacts.push(...detonation.contacts)
            transients = [...transients, ...detonation.transients]
            nextId = detonation.nextId
          } else {
            const impact = createPrimarySpellWeldImpact(nextId, born, context.tick, rng)
            rng = impact.rng
            transients = [...transients, impact.impact]
            nextId += 1
          }
        }
      }
      nextPlayer = {
        ...nextPlayer,
        primaryCast: {
          ...nextPlayer.primaryCast,
          emissionSequence: nextPlayer.primaryCast.emissionSequence + 1,
          fizzleSequence: underpowered
            ? nextPlayer.primaryCast.fizzleSequence + 1
            : nextPlayer.primaryCast.fizzleSequence,
          lastWeldSoundVariant: authority.primarySkill.kind === 'weld'
            ? birth.projectiles[0]?.kind === 'weld'
              ? birth.projectiles[0].castSoundVariant
              : null
            : null,
          lastWeldPlaybackRate: authority.primarySkill.kind === 'weld'
            ? birth.projectiles[0]?.kind === 'weld'
              ? birth.projectiles[0].castPlaybackRate
              : null
            : null,
          oneShotAttackPoseHeld: true,
          underpowered,
          weaponPulse: NATIVE_PLAYER_STAFF_CAST_ONE_OVERLAY,
        },
      }
    }

    const earthReleaseEligible = primaryElement === 'earth' && projectiles.some((spell) => (
      spell.kind === 'earth'
      && spell.ownerId === playerId
      && spell.phase === 'held'
      && spell.charge >= PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE
    ))

    if (nextPlayer.primaryCast.channelActive) {
      if (authority.primarySkill.kind === 'weld') {
        if (!rawHeld) {
          // Native persistent group/slot actors are released with the cast.
        } else {
          const underpowered = debitMana()
          const emitter = primarySpellEmitter(nextPlayer, castClockElement, authority.weaponKind)
          const buildId = authority.primarySkill.buildId
          if (isChannelBuild(buildId)) {
            const lightning = buildId === 1003
              ? createAirTransient(
                  playerId,
                  nextPlayer,
                  emitter,
                  aimDirection,
                  context,
                )
              : null
            let endpoint = lightning?.endpoint ?? null
            let terrainContact = false
            if (buildId === 1004) {
              const viewEndpoint = context.spellRangeEndpoint(
                playerId,
                emitter,
                aimDirection,
                100,
              )
              const obstruction = context.spellObstructionPoint(
                playerId,
                nextPlayer.position,
                viewEndpoint,
                undefined,
                NATIVE_PRIMARY_CAST_TERRAIN_EXCLUSION_MASK,
              )
              endpoint = obstruction ?? viewEndpoint
              terrainContact = obstruction !== null
            }
            const channelDamage = primarySpellChannelDamage(
              authority.primarySkill,
              underpowered,
            )
            channelEmissions.push({
              damage: channelDamage,
              direction: { ...aimDirection },
              endpoint,
              id: nextId,
              kind: 'weld',
              manaCost,
              origin: emitter,
              ownerId: playerId,
              primarySkill: authority.primarySkill,
              queryOrigin: { ...nextPlayer.position },
              terrainContact,
              underpowered,
              worldKey,
            })
            if (buildId === 1005) {
              const steam = spawnNativeWeldSteamActor({
                damage: channelDamage,
                direction: aimDirection,
                id: nextId,
                origin: emitter,
                ownerId: playerId,
                queryOrigin: nextPlayer.position,
                rng,
                tick: context.tick,
                underpowered,
                vector: authority.primarySkill.vector.values,
                worldKey,
                obstructionPoint: (start, end) => context.spellObstructionPoint(
                  playerId,
                  start,
                  end,
                  undefined,
                  NATIVE_PRIMARY_CAST_TERRAIN_EXCLUSION_MASK,
                ),
              })
              rng = steam.rng
              if (steam.actor) {
                transients = [...transients, steam.actor]
                nextId += 1
              }
            } else {
              const midpoint = lightning?.midpoint ?? (endpoint === null
                ? null
                : {
                    x: Math.fround((emitter.x + endpoint.x) * 0.5),
                    y: Math.fround((emitter.y + endpoint.y) * 0.5),
                  })
              const channel = createNativeWeldChannelActor({
                buildId,
                direction: aimDirection,
                endpoint,
                id: nextId,
                midpoint,
                origin: emitter,
                ownerId: playerId,
                targetId: lightning?.targetId ?? null,
                tick: context.tick,
                underpowered,
                vector: authority.primarySkill.vector.values,
                worldKey,
              })
              transients = [...transients, channel]
              nextId += 1
              if (buildId === 1003 && endpoint !== null) {
                const fade = createNativeWeldFlameLashFade({
                  direction: aimDirection,
                  id: nextId,
                  origin: endpoint,
                  ownerId: playerId,
                  rng,
                  tick: context.tick,
                  variant: 'endpoint',
                  vector: authority.primarySkill.vector.values,
                  worldKey,
                })
                rng = fade.rng
                transients = [...transients, fade.actor]
                nextId += 1
              } else if (buildId === 1004) {
                const glows = createNativeWeldBlizzardSourceGlows({
                  direction: aimDirection,
                  firstId: nextId,
                  origin: emitter,
                  ownerId: playerId,
                  rng,
                  tick: context.tick,
                  vector: authority.primarySkill.vector.values,
                  worldKey,
                })
                rng = glows.rng
                transients = [...transients, ...glows.actors]
                nextId = glows.nextId
              }
            }
            if (lightning) {
              nextPlayer = {
                ...nextPlayer,
                primaryCast: {
                  ...nextPlayer.primaryCast,
                  targetId: lightning.targetId,
                },
              }
            }
          } else if (isPersistentBuild(buildId)) {
            let meteorDamage: number | null = null
            let meteorCenter: Vector2 | null = null
            if (buildId === 1007) {
              meteorCenter = nativeWeldMeteorTargetPoint(nextPlayer.position, aimDirection)
              const marker = spawnNativeWeldMeteorMarker({
                direction: aimDirection,
                id: nextId,
                origin: meteorCenter,
                ownerId: playerId,
                rng,
                tick: context.tick,
                vector: authority.primarySkill.vector.values,
                worldKey,
              })
              rng = marker.rng
              transients = [...transients, marker.marker]
              nextId += 1
              const damage = drawNativeWeldDamage(
                rng,
                authority.primarySkill.damageMinimum,
                authority.primarySkill.damageMaximum,
              )
              rng = damage.rng
              meteorDamage = damage.value
            }
            const current = transients.find((effect): effect is Extract<
              NativeWeldWorldActor,
              { kind: 'weld-persistent' }
            > => (
              effect.kind === 'weld-persistent'
              && effect.ownerId === playerId
              && effect.buildId === buildId
              && effect.phase === 'held'
            ))
            let actor: Extract<NativeWeldWorldActor, { kind: 'weld-persistent' }>
            let boulderDebris: readonly NativeWeldMeteorDebrisSeed[] = Object.freeze([])
            let hailRockFades: readonly Readonly<{
              readonly position: Vector2
              readonly rotationDegrees: number
            }>[] = Object.freeze([])
            let releaseRequested = false
            if (current) {
              const updated = updateNativeWeldPersistentActor(
                current,
                emitter,
                aimDirection,
                rng,
                {
                  castProgressFactor: authority.castProgressFactor,
                  enhancedEffects: true,
                  underpowered,
                },
              )
              actor = updated.actor
              boulderDebris = updated.debris
              hailRockFades = updated.hailRockFades
              releaseRequested = updated.releaseRequested
              rng = updated.rng
            } else {
              actor = createNativeWeldPersistentActor({
                  buildId,
                  direction: aimDirection,
                  id: nextId,
                  origin: emitter,
                  ownerId: playerId,
                  registerWorldPainter,
                  tick: context.tick,
                  vector: authority.primarySkill.vector.values,
                  worldKey,
                })
              if (buildId === 1006 || buildId === 1008) {
                const pitch = drawNativeFloat(rng, Math.fround(0.5))
                rng = pitch.state
                nextPlayer = {
                  ...nextPlayer,
                  primaryCast: {
                    ...nextPlayer.primaryCast,
                    lastWeldPlaybackRate: Math.fround(1.5 - pitch.value),
                  },
                }
              }
            }
            if (current) {
              transients = transients.map((effect) => effect.id === current.id ? actor : effect)
            } else {
              transients = [...transients, actor]
              nextId += 1
            }
            if (boulderDebris.length > 0) {
              for (const debris of boulderDebris) {
                transients.push(createNativeWeldBoulderDebrisActor({
                  buildId: 1006,
                  debris,
                  direction: actor.direction,
                  id: nextId,
                  origin: actor.origin,
                  ownerId: actor.ownerId,
                  tick: context.tick,
                  vector: actor.vector,
                  worldKey: actor.worldKey,
                }))
                nextId += 1
              }
            }
            for (const fade of hailRockFades) {
              transients.push(createNativeWeldHailRockFadeActor({
                direction: actor.direction,
                id: nextId,
                origin: actor.origin,
                ownerId: actor.ownerId,
                position: fade.position,
                rotationDegrees: fade.rotationDegrees,
                tick: context.tick,
                vector: actor.vector,
                worldKey: actor.worldKey,
              }))
              nextId += 1
            }
            if (releaseRequested) {
              const releasedActor = releaseNativeWeldPersistentActor({
                actor,
                firstChildId: nextId,
                registerWorldPainter,
                rng,
                tick: context.tick,
              })
              rng = releasedActor.rng
              nextId = releasedActor.nextId
              transients = transients.filter((effect) => effect.id !== actor.id)
              transients.push(...releasedActor.actors)
              nextPlayer = {
                ...nextPlayer,
                primaryCast: {
                  ...nextPlayer.primaryCast,
                  actionTick: -1,
                  channelActive: false,
                  targetId: null,
                },
              }
            }
            if (
              buildId === 1007
              && nativeSelectedPrimaryAge % nativeWeldMeteorCadenceTicks(
                authority.castProgressFactor,
                underpowered,
              ) === 0
            ) {
              if (meteorDamage === null || meteorCenter === null) {
                throw new Error('Meteor Swarm construction state is unavailable')
              }
              const spawn = createNativeWeldMeteorSpawnProgram({
                aimDirection,
                center: meteorCenter,
                resolvePosition: (candidate) => context.spellObstructionPoint(
                  playerId,
                  meteorCenter!,
                  candidate,
                  undefined,
                  0,
                ) ?? candidate,
                rng,
                underpowered,
                vector: authority.primarySkill.vector.values,
              })
              rng = spawn.rng
              const vector = underpowered
                ? Object.freeze(authority.primarySkill.vector.values.map((value, index) => (
                    index >= 5 ? 0 : value
                  )))
                : authority.primarySkill.vector.values
              transients = [...transients, createNativeWeldMeteor({
                bodyScale: spawn.bodyScale,
                damage: Math.fround(meteorDamage * (underpowered ? 0.5 : 1)),
                direction: aimDirection,
                fallHeadingDegrees: spawn.fallHeadingDegrees,
                fallHeight: spawn.fallHeight,
                fallStep: spawn.fallStep,
                id: nextId,
                impactTicks: spawn.impactTicks,
                origin: spawn.position,
                ownerId: playerId,
                position: spawn.position,
                privateSeed: spawn.privateSeed,
                registerWorldPainter,
                tick: context.tick,
                underpowered,
                vector,
                worldKey,
              })]
              nextId += 1
            }
          } else {
            throw new Error(`unsupported welded primary build ${buildId}`)
          }
          nextPlayer = {
            ...nextPlayer,
            primaryCast: {
              ...nextPlayer.primaryCast,
              fizzleSequence: underpowered && context.tick % 50 === 0
                ? nextPlayer.primaryCast.fizzleSequence + 1
                : nextPlayer.primaryCast.fizzleSequence,
              underpowered,
            },
          }
        }
      } else {
      switch (primaryElement) {
        case 'air': {
          if (authority.primarySkill.kind !== 'air') {
            throw new Error('Air caster does not own an Air primary payload')
          }
          if (!rawHeld) break
          const underpowered = debitMana()
          const emitter = primarySpellEmitter(nextPlayer, castClockElement, authority.weaponKind)
          const air = createAirTransient(
            playerId,
            nextPlayer,
            emitter,
            aimDirection,
            context,
          )
          channelEmissions.push({
            damage: primarySpellChannelDamage(authority.primarySkill, underpowered),
            direction: { ...aimDirection },
            endpoint: air.endpoint,
            id: nextId,
            kind: 'air',
            manaCost,
            origin: emitter,
            ownerId: playerId,
            primarySkill: authority.primarySkill,
            queryOrigin: { ...nextPlayer.position },
            terrainContact: false,
            underpowered,
            worldKey,
          })
          const painterRegistrations = registerNativeWorldPainterRoots(
            registerWorldPainter,
            'actor',
            3,
          )
          transients = [...transients, {
            ageTicks: 0,
            birthTick: context.tick,
            direction: { ...aimDirection },
            endpoint: air.endpoint,
            hurricaneCharge: 0,
            id: nextId,
            kind: 'air',
            lightRegistration: registerWorldPainter('transient'),
            midpoint: air.midpoint,
            origin: emitter,
            ownerId: playerId,
            painterRegistrations,
            targetId: air.targetId,
            underpowered,
            variant: nextId % 4,
            worldKey,
          }]
          nextPlayer = {
            ...nextPlayer,
            primaryCast: {
              ...nextPlayer.primaryCast,
              targetId: air.targetId,
              underpowered,
            },
          }
          nextId += 1
          break
        }
        case 'water': {
          if (authority.primarySkill.kind !== 'water') {
            throw new Error('Water caster does not own a Water primary payload')
          }
          if (!rawHeld) break
          const underpowered = debitMana()
          const emitter = primarySpellEmitter(nextPlayer, castClockElement, authority.weaponKind)
          channelEmissions.push({
            damage: primarySpellChannelDamage(authority.primarySkill, underpowered),
            direction: { ...aimDirection },
            endpoint: null,
            id: nextId,
            kind: 'water',
            manaCost,
            origin: emitter,
            ownerId: playerId,
            primarySkill: authority.primarySkill,
            queryOrigin: { ...nextPlayer.position },
            terrainContact: false,
            underpowered,
            worldKey,
          })
          const widenHalfDegrees = underpowered
            ? 0
            : authority.primarySkill.widenHalfDegrees
          const particleCount = underpowered
            ? WATER_FROST_UNDERPOWERED_PARTICLES_PER_TICK
            : waterFrostJetParticleCount(widenHalfDegrees)
          const speed = waterFrostJetSpeed(widenHalfDegrees)
          const emitted = Array.from(
            { length: particleCount },
            (_, variant): PrimarySpellTransientState => {
              const id = nextId + variant
              const born = waterFrostJetEmission(
                emitter,
                aimDirection,
                context.tick,
                variant,
                id,
                particleCount,
                speed,
                widenHalfDegrees,
              )
              const obstruction = waterFrostJetObstruction(
                born,
                nextPlayer.position,
                id,
                (start, end) => context.spellObstructionPoint(
                  playerId,
                  start,
                  end,
                  undefined,
                  NATIVE_PRIMARY_CAST_TERRAIN_EXCLUSION_MASK,
                ),
                underpowered,
              )
              return {
                ageTicks: 1,
                direction: born.direction,
                id,
                kind: 'water',
                lightRegistration: null,
                obstructionDistance: obstruction?.distance ?? null,
                obstructionPoint: obstruction?.point ?? null,
                origin: born.origin,
                ownerId: playerId,
                painterRegistrations: registerNativeWorldPainterRoots(
                  registerWorldPainter,
                  'transient',
                ),
                speed: born.speed,
                underpowered,
                variant,
                worldKey,
              }
            },
          )
          transients = [...transients, ...emitted]
          nextId += emitted.length
          nextPlayer = {
            ...nextPlayer,
            primaryCast: { ...nextPlayer.primaryCast, underpowered },
          }
          break
        }
        case 'earth': {
          const earthSkill = authority.primarySkill
          if (earthSkill.kind !== 'earth') throw new Error('Expected an Earth skill profile')
          const underpowered = acceptedCast
            ? earthAcceptedUnderpowered ?? false
            : debitMana()
          projectiles = projectiles.map((spell) => {
            if (spell.kind !== 'earth' || spell.ownerId !== playerId || spell.phase !== 'held') {
              return spell
            }
            const emitter = primarySpellEmitter(nextPlayer, castClockElement, authority.weaponKind)
            const charge = acceptedCast || (!rawHeld && (
              spell.charge >= PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE
            )) || (underpowered && spell.charge > PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE)
              ? spell.charge
              : advanceNativeEarthBoulderCharge(
                  spell.charge,
                  earthSkill.growthFactor,
                  spell.maximumCharge,
                )
            const releasesThisTick = !rawHeld
              && spell.charge >= PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE
            const assemblyCharge = Math.floor(30 * spell.charge) === Math.floor(30 * charge)
              ? spell.assemblyCharge
              : charge
            return {
              ...spell,
              assemblyCharge,
              charge,
              damage: underpowered && spell.charge < 1
                ? Math.fround(spell.damage * 0.5)
                : spell.damage,
              remainingDamage: underpowered && spell.charge < 1
                ? Math.fround(spell.remainingDamage * 0.5)
                : spell.remainingDamage,
              direction: { ...aimDirection },
              orientation: releasesThisTick
                ? spell.orientation
                : earthBoulderHeldOrientationStep(spell.orientation, aimDirection),
              position: { x: emitter.x, y: emitter.y + 15 },
              shellCharge: assemblyCharge,
              worldKey,
            }
          })
          nextPlayer = {
            ...nextPlayer,
            primaryCast: {
              ...nextPlayer.primaryCast,
              fizzleSequence: underpowered && context.tick % 50 === 0
                ? nextPlayer.primaryCast.fizzleSequence + 1
                : nextPlayer.primaryCast.fizzleSequence,
              underpowered,
            },
          }
          const heldBoulder = projectiles.find((
            spell,
          ): spell is PrimarySpellEarthProjectileState => (
            spell.kind === 'earth'
            && spell.ownerId === playerId
            && spell.phase === 'held'
          ))
          if ((rawHeld || !earthReleaseEligible)
            && heldBoulder
            && heldBoulder.charge < heldBoulder.maximumCharge
            && earthCalledRockEmits(
              heldBoulder,
              context.tick,
            )) {
            transients = [...transients, createEarthCalledRock(
              nextId,
              heldBoulder,
              registerWorldPainter,
            )]
            nextId += 1
          }
          break
        }
        case 'ether':
        case 'fire':
          break
      }
      }
    }

    const shouldEndChannel = nextPlayer.primaryCast.channelActive && (
      authority.primarySkill.kind === 'weld'
        ? released
        : primaryElement === 'earth'
          ? !rawHeld && earthReleaseEligible
          : released
    )

    if (shouldEndChannel) {
      if (primaryElement === 'earth') {
        const released = releaseHeldEarthProjectiles(
          projectiles,
          playerId,
          aimDirection,
          context.canTraverseProjectile,
          context.tick,
          nextId,
          registerWorldPainter,
        )
        projectiles = released.projectiles
        transients = [...transients, ...released.impacts]
        nextId = released.nextId
        nextPlayer = {
          ...nextPlayer,
          primaryCast: {
            ...nextPlayer.primaryCast,
            emissionSequence: nextPlayer.primaryCast.emissionSequence + 1,
          },
        }
      }
      nextPlayer = {
        ...nextPlayer,
        primaryCast: {
          ...nextPlayer.primaryCast,
          actionTick: -1,
          channelActive: false,
          targetId: null,
          underpowered: false,
        },
      }
      if (authority.primarySkill.kind === 'weld') {
        const releasedWeld = releaseOwnedNativeWeldPersistentActors(
          transients,
          playerId,
          nextId,
          registerWorldPainter,
          rng,
          context.tick,
        )
        transients = releasedWeld.transients
        nextId = releasedWeld.nextId
        rng = releasedWeld.rng
      }
    }

    players[playerId] = finishEtherBlastTick(nextPlayer)
  }

  const bouldersById = new Map(projectiles
    .filter((spell) => spell.kind === 'earth')
    .map((spell) => [spell.id, spell]))
  const advancedTransients: PrimarySpellTransientState[] = []
  for (const effect of transients) {
    if (effect.kind !== 'earth-called-rock' || !existingCalledRockIds.has(effect.id)) {
      advancedTransients.push(effect)
      continue
    }
    const advanced = advanceEarthCalledRock(effect, bouldersById.get(effect.parentId))
    if (advanced) advancedTransients.push(advanced)
  }
  transients = advancedTransients

  const registeredSpells = enrollPrimarySpellPainterRegistrations(
    { nextId, projectiles, transients },
    registerWorldPainter,
  )
  return {
    channelEmissions,
    fireActorContacts,
    manaUnderflowPlayerIds: Object.freeze([...manaUnderflowPlayerIds].sort()),
    manaSpent,
    players,
    rng,
    spells: registeredSpells,
  }
}

function releaseOwnedNativeWeldPersistentActors(
  source: readonly PrimarySpellTransientState[],
  ownerId: string,
  sourceNextId: number,
  registerWorldPainter: RegisterNativeWorldPainter,
  sourceRng: NativeRngState,
  tick: number,
): {
  readonly nextId: number
  readonly rng: NativeRngState
  readonly transients: PrimarySpellTransientState[]
} {
  let nextId = sourceNextId
  let rng = sourceRng
  const transients: PrimarySpellTransientState[] = []
  const releasingHail = source.filter((effect): effect is Extract<
    NativeWeldWorldActor,
    { buildId: 1008; kind: 'weld-persistent' }
  > => (
    effect.kind === 'weld-persistent'
    && effect.buildId === 1008
    && effect.ownerId === ownerId
    && effect.phase === 'held'
  ))
  const retainedSource = source.filter((effect) => (
    effect.kind !== 'weld-hail-rock-fade'
    || !releasingHail.some((actor) => (
      effect.ownerId === actor.ownerId
      && effect.worldKey === actor.worldKey
      && effect.birthTick >= actor.birthTick
    ))
  ))
  for (const effect of retainedSource) {
    if (
      effect.kind !== 'weld-persistent'
      || effect.ownerId !== ownerId
      || effect.phase !== 'held'
    ) {
      transients.push(effect)
      continue
    }
    const released = releaseNativeWeldPersistentActor({
      actor: effect,
      firstChildId: nextId,
      registerWorldPainter,
      rng,
      tick,
    })
    nextId = released.nextId
    rng = released.rng
    transients.push(...released.actors)
  }
  return { nextId, rng, transients }
}

function releaseHeldEarthProjectiles(
  projectiles: readonly PrimarySpellProjectileState[],
  playerId: string,
  aimDirection: Vector2,
  canTraverseProjectile: PrimarySpellTickContext['canTraverseProjectile'],
  tick: number,
  sourceNextId: number,
  registerWorldPainter: RegisterNativeWorldPainter,
): {
  impacts: readonly PrimarySpellEarthImpactState[]
  nextId: number
  projectiles: PrimarySpellProjectileState[]
} {
  const impacts: PrimarySpellEarthImpactState[] = []
  const releasedProjectiles: PrimarySpellProjectileState[] = []
  let nextId = sourceNextId
  for (const spell of projectiles) {
    if (spell.kind !== 'earth' || spell.ownerId !== playerId || spell.phase !== 'held') {
      releasedProjectiles.push(spell)
      continue
    }
    const velocity = {
      x: Math.fround(aimDirection.x * 3),
      y: Math.fround(aimDirection.y * 3),
    }
    const position = {
      x: Math.fround(spell.position.x + velocity.x),
      y: Math.fround(spell.position.y + velocity.y),
    }
    const storedDelta = {
      x: Math.fround(position.x - spell.position.x),
      y: Math.fround(position.y - spell.position.y),
    }
    const releasedSpell: PrimarySpellProjectileState = {
      ...spell,
      direction: { ...aimDirection },
      flightTicks: 1,
      orientation: earthBoulderFlightOrientationStep(
        spell.orientation,
        aimDirection,
        storedDelta,
        spell.charge,
      ),
      maximumCharge: spell.charge,
      phase: 'flight',
      position,
      remainingDamage: nativeEarthBoulderReleasedDamage(
        spell.remainingDamage,
        spell.charge,
      ),
      velocity,
    }
    if (canTraverseProjectile(
      releasedSpell,
      releasedSpell.position,
      {
        x: Math.fround(releasedSpell.position.x + releasedSpell.velocity.x),
        y: Math.fround(releasedSpell.position.y + releasedSpell.velocity.y),
      },
      releasedSpell.charge * PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE,
    )) {
      releasedProjectiles.push(releasedSpell)
    } else {
      impacts.push(earthImpact(nextId, releasedSpell, tick, registerWorldPainter))
      nextId += 1
    }
  }
  return { impacts, nextId, projectiles: releasedProjectiles }
}

export function removePrimarySpellOwner(
  spells: PrimarySpellSimulationState,
  playerId: string,
): PrimarySpellSimulationState {
  return {
    ...spells,
    projectiles: spells.projectiles.filter((spell) => spell.ownerId !== playerId),
    transients: spells.transients.filter((effect) => effect.ownerId !== playerId),
  }
}

export function primarySpellAimDirection(
  playerPosition: Vector2,
  worldAim: Vector2,
  viewScale: number,
): Vector2 {
  const dx = worldAim.x - playerPosition.x
  const dy = worldAim.y - (playerPosition.y - 25 / viewScale)
  const length = Math.hypot(dx, dy)
  return length > 0.0001
    ? { x: dx / length, y: dy / length }
    : { x: 0, y: -1 }
}

function createAirTransient(
  ownerId: string,
  player: PlayerCharacterState,
  emitter: Vector2,
  aimDirection: Vector2,
  context: PrimarySpellTickContext,
): Pick<PrimarySpellAirTransientState, 'endpoint' | 'midpoint' | 'targetId'> {
  const rangeEndpoint = context.spellRangeEndpoint(
    ownerId,
    player.position,
    aimDirection,
    0,
  )
  const untargetedEndpoint = context.spellObstructionPoint(
    ownerId,
    player.position,
    rangeEndpoint,
    undefined,
    NATIVE_PRIMARY_CAST_TERRAIN_EXCLUSION_MASK,
  ) ?? rangeEndpoint
  const maxRange = Math.hypot(
    rangeEndpoint.x - player.position.x,
    rangeEndpoint.y - player.position.y,
  )
  const target = selectAirPrimaryTarget({
    aimDirection,
    hasLineOfSight: (candidate) => context.spellObstructionPoint(
      ownerId,
      player.position,
      candidate.position,
      candidate.id,
      NATIVE_PRIMARY_CAST_TERRAIN_EXCLUSION_MASK,
    ) === null,
    maxRange,
    origin: player.position,
    previousTargetId: player.primaryCast.targetId,
    targets: context.spellTargets(ownerId),
  })
  let endpoint = untargetedEndpoint
  if (target) {
    const attachment = {
      x: target.position.x + target.attachment.x,
      y: target.position.y + target.attachment.y,
    }
    const clipped = context.spellObstructionPoint(
      ownerId,
      player.position,
      attachment,
      target.id,
      NATIVE_PRIMARY_CAST_TERRAIN_EXCLUSION_MASK,
    ) ?? attachment
    endpoint = { x: clipped.x, y: clipped.y + AIR_PRIMARY_TARGET_Y_OFFSET }
  }
  const geometry = airPrimaryBoltGeometry(emitter, aimDirection, endpoint)
  return {
    endpoint: geometry.endpoint,
    midpoint: geometry.midpoint,
    targetId: target?.id ?? null,
  }
}

function advancePrimaryCast(
  previous: PlayerPrimaryCastState,
  held: boolean,
  acceptedCast: boolean,
  element: WizardElement,
  progressFactor: number,
): PlayerPrimaryCastState {
  if (!Number.isFinite(progressFactor) || progressFactor < 0) {
    throw new RangeError('primary cast progress factor must be finite and non-negative')
  }
  let actionTick = previous.actionTick
  if (actionTick >= 0) {
    if (previous.channelActive) {
      actionTick = Math.min(actionTick + progressFactor, 1)
    } else {
      // Native retains the action on the update that first exceeds progress
      // four; the following player tick observes the free slot.
      actionTick = actionTick > primaryCastCompletionProgress(element)
        ? -1
        : actionTick + progressFactor
    }
  }
  if (acceptedCast) actionTick = 0
  const oneShotAttackPoseHeld = previous.oneShotAttackPoseHeld
    && (held || actionTick >= 0)
  return {
    ...previous,
    actionTick,
    castSequence: acceptedCast ? previous.castSequence + 1 : previous.castSequence,
    held,
    oneShotAttackPoseHeld,
    underpowered: acceptedCast ? false : previous.underpowered,
  }
}

function createOneShotProjectiles(
  firstId: number,
  ownerId: string,
  player: PlayerCharacterState,
  kind: 'ether' | 'fire',
  weaponKind: NativePlayerWeaponKind,
  primarySkill: NativePrimarySkillProfile,
  worldKey: string,
  targets: readonly PrimarySpellTarget[],
  sourceRng: NativeRngState,
  underpowered: boolean,
  registerWorldPainter: RegisterNativeWorldPainter,
): { projectiles: readonly (PrimarySpellEtherProjectileState | PrimarySpellFireProjectileState)[], rng: NativeRngState } {
  if (primarySkill.kind !== kind) {
    throw new Error(`primary profile ${primarySkill.kind} cannot create ${kind}`)
  }
  const damageDraw = drawInclusiveDamage(
    sourceRng,
    primarySkill.damageMinimum,
    primarySkill.damageMaximum,
    primarySkill.damageRollCount,
  )
  const aimDirection = player.primaryCast.aimDirection
  const emitter = primarySpellEmitter(player, kind, weaponKind)
  if (kind === 'fire') {
    if (primarySkill.kind !== 'fire') throw new Error('Expected a Fire primary profile')
    const privateSeed = drawNativeFirePrivateSeed(damageDraw.rng)
    const speed = 4.5
    const spawn = {
      x: emitter.x + aimDirection.x * 20,
      y: emitter.y + 10 + aimDirection.y * 20,
    }
    const painterRegistration = registerWorldPainter('actor')
    return {
      projectiles: [{
        ageTicks: 0,
        burnDamage: underpowered ? 0 : primarySkill.burnDamage,
        charge: 1,
        damage: damageDraw.value * (underpowered ? 0.5 : 1),
        direction: { ...aimDirection },
        emberDamage: underpowered ? 0 : primarySkill.emberDamage,
        emberFragments: underpowered ? 0 : primarySkill.emberFragments,
        explodeDamage: underpowered ? 0 : primarySkill.explodeDamage,
        explodeRadius: underpowered ? 0 : primarySkill.explodeRadius,
        flightTicks: 0,
        id: firstId,
        kind: 'fire',
        lightRegistration: painterRegistration,
        ownerId,
        painterRegistrations: Object.freeze([painterRegistration]),
        phase: 'flight',
        position: spawn,
        privateSeed: privateSeed.seed,
        spentEmber: underpowered ? Object.freeze({ kind: 'none' }) : primarySkill.spentEmber,
        underpowered,
        velocity: { x: aimDirection.x * speed, y: aimDirection.y * speed },
        worldKey,
      }],
      rng: privateSeed.rng,
    }
  }
  if (primarySkill.kind !== 'ether') throw new Error('Expected an Ether primary profile')
  const aimHeading = actorHeadingFromVector(aimDirection.x, aimDirection.y)
  const quantity = underpowered ? 1 : primarySkill.quantity
  const speed = underpowered
    ? PRIMARY_SPELL_ETHER_UNDERPOWERED_SPEED
    : Math.fround(3 * primarySkill.speedFactor)
  const projectiles = Array.from({ length: quantity }, (_, index) => {
    const headingDegrees = nativeMissileFanHeading(aimHeading, quantity, index)
    const direction = directionFromHeading(headingDegrees)
    const spawn = { x: emitter.x, y: emitter.y + 10 }
    const target = selectEtherPrimaryTarget({
      aimDirection: direction,
      origin: spawn,
      targets,
    })
    const painterRegistration = registerWorldPainter('actor')
    return {
      ageTicks: 0,
      charge: 1,
      damage: damageDraw.value * (underpowered ? 0.5 : 1),
      damageRetention: underpowered ? 1 : primarySkill.damageRetention,
      direction,
      flightTicks: 0,
      headingDegrees,
      id: firstId + index,
      kind: 'ether' as const,
      lightRegistration: painterRegistration,
      ownerId,
      painterRegistrations: Object.freeze([painterRegistration]),
      phase: 'flight' as const,
      piercesRemaining: underpowered ? 0 : primarySkill.pierces,
      position: spawn,
      reacquiresTarget: underpowered ? false : primarySkill.reacquiresTarget,
      speed,
      targetId: target?.id ?? null,
      turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
      turnInput: underpowered
        ? PRIMARY_SPELL_ETHER_UNDERPOWERED_TURN_INPUT
        : Math.fround(
            2 * primarySkill.speedFactor * nativeMissileFanTurnScale(index),
          ),
      underpowered,
      velocity: { x: direction.x * speed, y: direction.y * speed },
      visualScale: 1,
      worldKey,
    }
  })
  return {
    projectiles,
    rng: damageDraw.rng,
  }
}

function drawInclusiveDamage(
  source: NativeRngState,
  minimum: number,
  maximum: number,
  count: number,
): { rng: NativeRngState, value: number } {
  if (
    !Number.isFinite(minimum)
    || !Number.isFinite(maximum)
    || maximum < minimum
    || !Number.isSafeInteger(count)
    || count < 1
  ) {
    throw new RangeError('one-shot spell damage domain is invalid')
  }
  if (count === 1) return { rng: source, value: minimum }
  const draw = drawNativeInteger(source, count)
  return {
    rng: draw.state,
    value: minimum + draw.value * (maximum - minimum) / (count - 1),
  }
}

function primarySpellManaCost(
  element: WizardElement,
  primarySkill: NativePrimarySkillProfile,
): number {
  if (primarySkill.kind === 'weld') {
    return primarySkill.castKind === 'one-shot'
      ? primarySkill.manaCost
      : primarySkill.manaCost / PRIMARY_SPELL_TICKS_PER_SECOND
  }
  return element === 'ether' || element === 'fire'
    ? primarySkill.manaCost
    : primarySkill.manaCost / PRIMARY_SPELL_TICKS_PER_SECOND
}

function primarySpellChannelDamage(
  primarySkill: NativePrimarySkillProfile,
  underpowered: boolean,
): number {
  return primarySkill.damageMinimum / PRIMARY_SPELL_TICKS_PER_SECOND
    * (underpowered ? 0.5 : 1)
}

function advanceProjectile(
  spell: PrimarySpellProjectileState,
  targets: readonly PrimarySpellTarget[],
): PrimarySpellProjectileState {
  if (spell.phase === 'held') {
    return { ...spell, ageTicks: spell.ageTicks + 1 }
  }
  if (spell.kind === 'ether') {
    const advanced = advanceEtherPrimaryTracking({
      headingDegrees: spell.headingDegrees,
      movementScalar: 1,
      position: spell.position,
      reacquiresTarget: spell.reacquiresTarget,
      speed: spell.speed,
      targetId: spell.targetId,
      targets,
      turnInput: spell.turnInput,
      turnAccumulator: spell.turnAccumulator,
    })
    return {
      ...spell,
      ageTicks: spell.ageTicks + 1,
      direction: advanced.direction,
      flightTicks: spell.flightTicks + 1,
      headingDegrees: advanced.headingDegrees,
      position: advanced.position,
      reacquiresTarget: advanced.reacquiresTarget,
      targetId: advanced.targetId,
      turnAccumulator: advanced.turnAccumulator,
      velocity: {
        x: Math.fround(advanced.direction.x * spell.speed),
        y: Math.fround(advanced.direction.y * spell.speed),
      },
    }
  }
  if (spell.kind === 'weld') return stepNativeWeldProjectile(spell, targets)
  if (spell.kind === 'earth') {
    const position = {
      x: Math.fround(spell.position.x + spell.velocity.x),
      y: Math.fround(spell.position.y + spell.velocity.y),
    }
    const storedDelta = {
      x: Math.fround(position.x - spell.position.x),
      y: Math.fround(position.y - spell.position.y),
    }
    return {
      ...spell,
      ageTicks: spell.ageTicks + 1,
      flightTicks: spell.flightTicks + 1,
      orientation: earthBoulderFlightOrientationStep(
        spell.orientation,
        spell.direction,
        storedDelta,
        spell.charge,
      ),
      position,
    }
  }
  return {
    ...spell,
    ageTicks: spell.ageTicks + 1,
    flightTicks: spell.flightTicks + 1,
    position: {
      x: spell.position.x + spell.velocity.x,
      y: spell.position.y + spell.velocity.y,
    },
  }
}

type TimedPrimarySpellTransient = Extract<
  PrimarySpellTransientState,
  { kind:
    | 'air'
    | 'earth-impact'
    | 'ether-blast'
    | 'ether-impact'
    | 'ether-pierce-streak'
    | 'fire'
    | 'fire-explosion'
    | 'fire-impact'
    | 'water'
    | 'water-aura'
  }
>

function transientLifetime(effect: TimedPrimarySpellTransient): number {
  switch (effect.kind) {
    case 'air': return effect.underpowered
      ? PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS
      : PRIMARY_SPELL_AIR_LIFETIME_TICKS
    case 'earth-impact': return effect.lifetimeTicks
    case 'ether-impact': return PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS
    case 'ether-blast': return NATIVE_ETHER_BLAST_PARTICLE_LIFETIME_TICKS
    case 'ether-pierce-streak': return 10
    case 'fire': return nativeFireParticleLifetimeTicks(effect.id)
    case 'fire-explosion': return NATIVE_FIRE_EXPLOSION_LIFETIME_TICKS
    case 'fire-impact': return PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS
    case 'water': return waterFrostJetLifetimeTicks(effect.id)
    case 'water-aura': return effect.durationTicks
  }
}

function isNativeWeldWorldActor(
  effect: PrimarySpellTransientState,
): effect is NativeWeldWorldActor {
  return effect.kind === 'weld-boulder-debris'
    || effect.kind === 'weld-blizzard-chain-frost'
    || effect.kind === 'weld-blizzard-glow'
    || effect.kind === 'weld-channel'
    || effect.kind === 'weld-frost-fade'
    || effect.kind === 'weld-flame-lash-fade'
    || effect.kind === 'weld-ground-spark-fade'
    || effect.kind === 'weld-hail-flash'
    || effect.kind === 'weld-hail-knockback'
    || effect.kind === 'weld-hail-line'
    || effect.kind === 'weld-hail-rock-fade'
    || effect.kind === 'weld-hail-terrain-bouncer'
    || effect.kind === 'weld-hail-terrain-particle'
    || effect.kind === 'weld-impact'
    || effect.kind === 'weld-meteor'
    || effect.kind === 'weld-meteor-flash'
    || effect.kind === 'weld-meteor-marker'
    || effect.kind === 'weld-persistent'
    || effect.kind === 'weld-steam'
}

export function createPrimarySpellWeldImpact(
  id: number,
  spell: Pick<
    NativeWeldProjectileState,
    'direction' | 'ownerId' | 'position' | 'vector' | 'worldKey'
  > & Readonly<{ buildId: NativeWeldImpactActorState['buildId'] }>,
  birthTick: number,
  sourceRng: NativeRngState,
): Readonly<{
  impact: Extract<NativeWeldWorldActor, { kind: 'weld-impact' }>
  rng: NativeRngState
}> {
  let rng = sourceRng
  let impactSoundPitch: number | null = null
  let impactSoundVariant: number | null = null
  let presentationRotationDegrees: number | null = null
  if (spell.buildId === 1001) {
    impactSoundPitch = Math.fround(1.5)
  } else if (spell.buildId === 1002) {
    impactSoundPitch = Math.fround(1.5)
    impactSoundVariant = 0
    const rotation = drawNativeFloat(rng, 360)
    rng = rotation.state
    presentationRotationDegrees = rotation.value
  } else if (spell.buildId === 1009) {
    const pitch = drawNativeFloat(rng, Math.fround(0.1))
    const variant = drawNativeInteger(pitch.state, 3)
    const rotation = drawNativeFloat(variant.state, 360)
    rng = rotation.state
    impactSoundPitch = Math.fround(1 + pitch.value)
    impactSoundVariant = variant.value
    presentationRotationDegrees = rotation.value
  }
  const ownsFade = spell.buildId === 1001 || spell.buildId === 1002 || spell.buildId === 1009
  return Object.freeze({
    impact: Object.freeze({
	    ageTicks: 0,
	    alpha: ownsFade ? 2 : 0,
	    birthTick,
	    boulderTerminalCharge: null,
	    buildId: spell.buildId,
    direction: Object.freeze({ ...spell.direction }),
    id,
    impactSoundPitch,
    impactSoundVariant,
    kind: 'weld-impact',
    lightRegistration: null,
    origin: Object.freeze({ ...spell.position }),
    ownerId: spell.ownerId,
    position: Object.freeze({ ...spell.position }),
    presentationRotationDegrees,
    presentationScale: ownsFade ? Math.fround(1.5) : 0,
    vector: Object.freeze([...spell.vector]),
    worldKey: spell.worldKey,
    }),
    rng,
  })
}

export function createPrimarySpellWeldBoulderTerminal(
  sourceNextId: number,
  actor: NativeWeldEtherealBoulderState,
  birthTick: number,
  sourceRng: NativeRngState,
  registerWorldPainter?: RegisterNativeWorldPainter,
): Readonly<{
  nextId: number
  rng: NativeRngState
  transients: readonly PrimarySpellTransientState[]
}> {
  const impactId = sourceNextId
  const transients: PrimarySpellTransientState[] = [Object.freeze({
    ageTicks: 0,
    alpha: 2,
    birthTick,
    boulderTerminalCharge: actor.scale,
    buildId: 1006,
    direction: Object.freeze({ ...actor.direction }),
    id: impactId,
    impactSoundPitch: null,
    impactSoundVariant: null,
    kind: 'weld-impact',
    lightRegistration: registerWorldPainter?.('transient') ?? Object.freeze({
      managerLane: 'transient',
      registrationOrdinal: impactId,
    }),
    origin: Object.freeze({ ...actor.origin }),
    ownerId: actor.ownerId,
    position: Object.freeze({ ...actor.origin }),
    presentationRotationDegrees: null,
    presentationScale: 2,
    vector: Object.freeze([...actor.vector]),
    worldKey: actor.worldKey,
  })]
  const breakup = createNativeWeldEtherealBoulderBreakupDebrisProgram({
    rng: sourceRng,
    scale: actor.scale,
  })
  let nextId = impactId + 1
  for (const debris of breakup.debris) {
    transients.push(createNativeWeldBoulderDebrisActor({
      buildId: 1006,
      debris,
      direction: actor.direction,
      id: nextId,
      origin: actor.origin,
      ownerId: actor.ownerId,
      tick: birthTick,
      vector: actor.vector,
      worldKey: actor.worldKey,
    }))
    nextId += 1
  }
  return Object.freeze({
    nextId,
    rng: breakup.rng,
    transients: Object.freeze(transients),
  })
}

/**
 * Materializes the Fire half of a welded impact without pretending that the
 * welded actor is a stock Fireball. FireMissile and Meteor store the same
 * explode/ember ABI but retain their own direct-contact damage ownership.
 */
export function createPrimarySpellWeldFireDetonation(
  sourceNextId: number,
  spell: Readonly<{
    buildId: NativeWeldBuildId
    direction: Vector2
    ownerId: string
    position: Vector2
    vector: readonly number[]
    worldKey: string
  }>,
  origin: Readonly<Vector2>,
  birthTick: number,
  sourceRng: NativeRngState,
  privateSeed = 0,
  includeImpact = true,
  registerWorldPainter?: RegisterNativeWorldPainter,
): Readonly<{
  contacts: readonly NativeFireEmberContact[]
  nextId: number
  rng: NativeRngState
  transients: readonly PrimarySpellTransientState[]
}> {
  if (spell.buildId !== 1000
    && spell.buildId !== 1003
    && spell.buildId !== 1007) {
    throw new Error(`weld build ${spell.buildId} has no Fire detonation payload`)
  }
  const payloadOffset = spell.buildId === 1000 || spell.buildId === 1007 ? 5 : 4
  const payload: NativeFireProjectilePayload = Object.freeze({
    burnDamage: 0,
    emberDamage: spell.vector[payloadOffset + 2] ?? 0,
    emberFragments: Math.max(0, Math.round(spell.vector[payloadOffset + 3] ?? 0)),
    explodeDamage: spell.vector[payloadOffset] ?? 0,
    explodeRadius: spell.vector[payloadOffset + 1] ?? 0,
    privateSeed,
    spentEmber: Object.freeze({ kind: 'none' }),
  })
  const impactProgram = includeImpact
    ? createPrimarySpellWeldImpact(
        sourceNextId,
        {
          ...spell,
          buildId: spell.buildId as NativeWeldImpactActorState['buildId'],
          position: { ...origin },
        },
        birthTick,
        sourceRng,
      )
    : null
  const impact = impactProgram === null ? [] : [impactProgram.impact]
  const impactRng = impactProgram?.rng ?? sourceRng
  const fallbackOrder = createNativeWorldManagerOrder({
    nextRegistrationOrdinal: { actor: sourceNextId, transient: sourceNextId },
  })
  const register = registerWorldPainter ?? fallbackOrder.register
  const firstEffectId = sourceNextId + impact.length
  const explosionOffset = payload.explodeRadius > 0 && payload.explodeDamage > 0 ? 1 : 0
  const detonation = createNativeFireDetonation(
    firstEffectId + explosionOffset,
    payload,
    origin,
    spell.ownerId,
    spell.worldKey,
    impactRng,
  )
  const explosion = detonation.explosion === null
    ? []
    : [{
        ...detonation.explosion,
        ageTicks: 0,
        id: firstEffectId,
        kind: 'fire-explosion' as const,
        lightRegistration: register('transient'),
        soundPitch: detonation.soundPitch,
      }]
  const embers = detonation.embers.map((ember): PrimarySpellFireEmberState => ({
    ...ember,
    kind: 'fire-ember',
    lightRegistration: register('actor'),
  }))
  return Object.freeze({
    contacts: detonation.contacts,
    nextId: detonation.nextId,
    rng: detonation.rng,
    transients: Object.freeze([...impact, ...explosion, ...embers]),
  })
}

export function createPrimarySpellWeldSteamDetonation(
  sourceNextId: number,
  pulse: Readonly<{
    emberDamage: number
    emberFragments: number
    explodeDamage: number
    explodeRadius: number
    ownerId: string
    position: Vector2
    worldKey: string
  }>,
  birthTick: number,
  sourceRng: NativeRngState,
  privateSeed: number,
  registerWorldPainter?: RegisterNativeWorldPainter,
): Readonly<{
  nextId: number
  rng: NativeRngState
  transients: readonly PrimarySpellTransientState[]
}> {
  const fallbackOrder = createNativeWorldManagerOrder({
    nextRegistrationOrdinal: { actor: sourceNextId, transient: sourceNextId },
  })
  const register = registerWorldPainter ?? fallbackOrder.register
  const detonation = createNativeWeldSteamDetonation({
    explodeDamage: pulse.explodeDamage,
    explodeRadius: pulse.explodeRadius,
    firstFragmentId: sourceNextId + 1,
    fragmentCount: pulse.emberFragments,
    fragmentDamage: pulse.emberDamage,
    origin: pulse.position,
    ownerId: pulse.ownerId,
    privateSeed,
    rng: sourceRng,
    tick: birthTick,
    worldKey: pulse.worldKey,
  })
  if (detonation.explosion === null) {
    return Object.freeze({ nextId: sourceNextId, rng: detonation.rng, transients: [] })
  }
  const explosionRegistration = register('transient')
  const explosion: PrimarySpellFireExplosionState = Object.freeze({
    ...detonation.explosion,
    ageTicks: 0,
    id: sourceNextId,
    kind: 'fire-explosion',
    lightRegistration: explosionRegistration,
    painterRegistrations: Object.freeze([explosionRegistration]),
  })
  const fragments = detonation.fragments.map((fragment) => Object.freeze({
    ...fragment,
    painterRegistrations: registerNativeWorldPainterRoots(register, 'actor'),
  }))
  return Object.freeze({
    nextId: detonation.nextId,
    rng: detonation.rng,
    transients: Object.freeze([explosion, ...fragments]),
  })
}

function etherImpact(
  id: number,
  spell: PrimarySpellProjectileState,
  birthTick: number,
  lightRegistration: NativeWorldManagerRegistration,
): PrimarySpellEtherImpactState {
  if (spell.kind !== 'ether') throw new Error('Ether impact requires an Ether projectile')
  return {
    ageTicks: 0,
    birthTick,
    id,
    kind: 'ether-impact',
    lightRegistration,
    origin: { ...spell.position },
    ownerId: spell.ownerId,
    painterRegistrations: Object.freeze([lightRegistration]),
    visualScale: spell.visualScale,
    worldKey: spell.worldKey,
  }
}

function earthImpact(
  id: number,
  spell: PrimarySpellEarthProjectileState,
  birthTick: number,
  registerWorldPainter: RegisterNativeWorldPainter,
): PrimarySpellEarthImpactState {
  const seed = {
    ageTicks: 0,
    birthTick,
    charge: spell.charge,
    id,
    kind: 'earth-impact',
    lightRegistration: null,
    lifetimeTicks: 0,
    origin: { ...spell.position },
    ownerId: spell.ownerId,
    painterRegistrations: registerNativeWorldPainterRoots(
      registerWorldPainter,
      'actor',
      earthImpactFragmentCount(spell.charge),
    ),
    worldKey: spell.worldKey,
  } satisfies PrimarySpellEarthImpactState
  return { ...seed, lifetimeTicks: earthImpactLifetimeTicks(seed) }
}

export function createPrimarySpellEarthBoulderBit(input: {
  readonly debris: NativeWeldMeteorDebrisSeed
  readonly enhancedEffects: boolean
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly registerWorldPainter?: RegisterNativeWorldPainter
  readonly tick: number
  readonly worldKey: string
}): PrimarySpellEarthBoulderBitState {
  return Object.freeze({
    ageTicks: 0,
    birthTick: input.tick,
    debris: createNativeWeldBoulderDebrisParticle(
      input.debris,
      input.enhancedEffects,
    ),
    id: input.id,
    kind: 'earth-boulder-bit',
    lightRegistration: null,
    origin: Object.freeze({ ...input.origin }),
    ownerId: input.ownerId,
    painterRegistrations: registerNativeWorldPainterRoots(
      input.registerWorldPainter
        ?? createNativeWorldManagerOrder({
          nextRegistrationOrdinal: { actor: input.id, transient: input.id },
        }).register,
      'actor',
    ),
    position: Object.freeze({ ...input.origin }),
    worldKey: input.worldKey,
  })
}

function fireImpact(
  id: number,
  spell: PrimarySpellProjectileState,
  lightRegistration: NativeWorldManagerRegistration,
): PrimarySpellFireImpactState {
  return fireImpactAt(
    id,
    spell.position,
    spell.ownerId,
    spell.worldKey,
    lightRegistration,
  )
}

function fireImpactAt(
  id: number,
  origin: Readonly<Vector2>,
  ownerId: string,
  worldKey: string,
  lightRegistration: NativeWorldManagerRegistration,
): PrimarySpellFireImpactState {
  return {
    ageTicks: 0,
    id,
    kind: 'fire-impact',
    lightRegistration,
    origin: { ...origin },
    ownerId,
    painterRegistrations: Object.freeze([lightRegistration]),
    worldKey,
  }
}

export function createPrimarySpellFireDetonation(
  sourceNextId: number,
  spell: PrimarySpellFireProjectileState,
  origin: Readonly<Vector2>,
  sourceRng: NativeRngState,
  registerWorldPainter?: RegisterNativeWorldPainter,
): Readonly<{
  contacts: readonly NativeFireEmberContact[]
  nextId: number
  rng: NativeRngState
  transients: readonly PrimarySpellTransientState[]
}> {
  const fallbackOrder = createNativeWorldManagerOrder({
    nextRegistrationOrdinal: { actor: sourceNextId, transient: sourceNextId },
  })
  const register = registerWorldPainter ?? fallbackOrder.register
  const impact = fireImpactAt(
    sourceNextId,
    origin,
    spell.ownerId,
    spell.worldKey,
    register('transient'),
  )
  const explosionOffset = spell.explodeRadius > 0 && spell.explodeDamage > 0 ? 1 : 0
  const detonation = createNativeFireDetonation(
    sourceNextId + 1 + explosionOffset,
    spell,
    origin,
    spell.ownerId,
    spell.worldKey,
    sourceRng,
  )
  const explosion = detonation.explosion === null
    ? []
    : (() => {
        const registration = register('transient')
        return [{
        ...detonation.explosion,
        ageTicks: 0,
        id: sourceNextId + 1,
        kind: 'fire-explosion' as const,
        lightRegistration: registration,
        painterRegistrations: Object.freeze([registration]),
        soundPitch: detonation.soundPitch,
      }]
      })()
  const embers = detonation.embers.map((ember): PrimarySpellFireEmberState => {
    const registration = register('actor')
    return {
      ...ember,
      kind: 'fire-ember',
      lightRegistration: registration,
      painterRegistrations: Object.freeze([registration]),
    }
  })
  return Object.freeze({
    contacts: detonation.contacts,
    nextId: detonation.nextId,
    rng: detonation.rng,
    transients: Object.freeze([impact, ...explosion, ...embers]),
  })
}

export function createPrimarySpellContactImpact(
  id: number,
  spell: PrimarySpellProjectileState,
  origin: Readonly<Vector2>,
  birthTick: number,
  sourceRng: NativeRngState,
  registerWorldPainter: RegisterNativeWorldPainter = (managerLane) => ({
    managerLane,
    registrationOrdinal: id,
  }),
): Readonly<{
  impact: PrimarySpellEarthImpactState | PrimarySpellEtherImpactState
    | PrimarySpellFireImpactState | Extract<NativeWeldWorldActor, { kind: 'weld-impact' }> | null
  rng: NativeRngState
}> {
  const contactSpell = { ...spell, position: { ...origin } }
  if (contactSpell.kind === 'earth') {
    return {
      impact: earthImpact(id, contactSpell, birthTick, registerWorldPainter),
      rng: sourceRng,
    }
  }
  if (contactSpell.kind === 'ether') {
    return {
      impact: etherImpact(id, contactSpell, birthTick, registerWorldPainter('transient')),
      rng: sourceRng,
    }
  }
  if (contactSpell.kind === 'weld') {
    return createPrimarySpellWeldImpact(id, contactSpell, birthTick, sourceRng)
  }
  return {
    impact: contactSpell.kind === 'fire'
      ? fireImpact(id, contactSpell, registerWorldPainter('transient'))
      : null,
    rng: sourceRng,
  }
}

function earthCalledRockEmits(
  boulder: PrimarySpellEarthProjectileState,
  tick: number,
): boolean {
  return boulder.charge < 0.25
    || earthVisualRandomInt(boulder.id, 0x3000 + tick, 3) === 1
}

function createEarthCalledRock(
  id: number,
  boulder: PrimarySpellEarthProjectileState,
  registerWorldPainter: RegisterNativeWorldPainter,
): PrimarySpellEarthCalledRockState {
  const angle = earthVisualUnitRandom(id, 0x4000) * Math.PI * 2
  const spawnRadius = earthVisualUnitRandom(id, 0x5000)
    * Math.max(5, Math.min(120, 50 * boulder.charge))
  return {
    ageTicks: 0,
    falling: false,
    fallVelocity: 0,
    height: -2,
    id,
    kind: 'earth-called-rock',
    lightRegistration: null,
    lateralMagnitude: Math.fround(earthVisualUnitRandom(id, 0x6000) * 4),
    ownerId: boulder.ownerId,
    parentId: boulder.id,
    painterRegistrations: registerNativeWorldPainterRoots(
      registerWorldPainter,
      'actor',
    ),
    position: {
      x: Math.fround(boulder.position.x + Math.cos(angle) * spawnRadius),
      y: Math.fround(boulder.position.y + Math.sin(angle) * spawnRadius),
    },
    rotation: Math.fround(earthVisualUnitRandom(id, 0x7000) * 360),
    rotationStep: Math.fround((earthVisualUnitRandom(id, 0x7100) * 2 - 1) * 30),
    scale: Math.fround(0.75 * Math.min(boulder.charge, 0.75)),
    speed: PRIMARY_SPELL_EARTH_CALLED_ROCK_INITIAL_SPEED,
    targetHeight: Math.fround(
      -40 - 30 * boulder.charge + earthVisualUnitRandom(id, 0x7200) * 5,
    ),
    variant: earthVisualRandomInt(id, 0x7300, 3),
    worldKey: boulder.worldKey,
  }
}

function advanceEarthCalledRock(
  rock: PrimarySpellEarthCalledRockState,
  parent: PrimarySpellEarthProjectileState | undefined,
): PrimarySpellEarthCalledRockState | null {
  if (rock.falling) {
    const height = Math.fround(rock.height + rock.fallVelocity)
    const accelerated = Math.fround(rock.fallVelocity + 1)
    const fallVelocity = height > 0 ? Math.fround(0.25) : accelerated
    if (height > 10) return null
    return { ...rock, ageTicks: rock.ageTicks + 1, fallVelocity, height }
  }

  const speed = Math.min(
    PRIMARY_SPELL_EARTH_CALLED_ROCK_SPEED_CAP,
    Math.fround(rock.speed * PRIMARY_SPELL_EARTH_CALLED_ROCK_SPEED_MULTIPLIER),
  )
  let position = rock.position
  let falling = parent?.phase !== 'held'
  if (!falling && parent) {
    const dx = parent.position.x - rock.position.x
    const dy = parent.position.y - rock.position.y
    const distance = Math.hypot(dx, dy)
    if (distance < PRIMARY_SPELL_EARTH_CALLED_ROCK_REMOVE_DISTANCE) return null
    const toward = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 }
    position = {
      x: Math.fround(rock.position.x + toward.x * speed),
      y: Math.fround(rock.position.y + toward.y * speed),
    }
    const nextDx = parent.position.x - position.x
    const nextDy = parent.position.y - position.y
    const nextDistance = Math.hypot(nextDx, nextDy)
    if (nextDistance > 0) {
      position = {
        x: Math.fround(position.x - nextDy / nextDistance * rock.lateralMagnitude),
        y: Math.fround(position.y + nextDx / nextDistance * rock.lateralMagnitude),
      }
    }
  } else {
    falling = true
  }

  const heightDirection = Math.sign(rock.targetHeight - rock.height)
  return {
    ...rock,
    ageTicks: rock.ageTicks + 1,
    falling,
    height: heightDirection === 0
      ? rock.height
      : Math.fround(rock.height + heightDirection * 1.5),
    position,
    rotation: Math.fround(rock.rotation + rock.rotationStep),
    speed,
  }
}

function createFireParticle(
  id: number,
  fireball: PrimarySpellProjectileState,
  registerWorldPainter: RegisterNativeWorldPainter,
): PrimarySpellFireParticleState {
  return {
    ageTicks: 0,
    direction: { ...fireball.direction },
    id,
    kind: 'fire',
    lightRegistration: null,
    origin: { ...fireball.position },
    ownerId: fireball.ownerId,
    painterRegistrations: registerNativeWorldPainterRoots(
      registerWorldPainter,
      'actor',
    ),
    variant: nativeFireParticleVariant(id),
    worldKey: fireball.worldKey,
  }
}
