import type { NativePuppetHitState, NativeWorldPuppetHit, NativeWorldPuppetHitKind } from '../../core-kernels/native-puppet-hit.ts'
import type { NativeDemonArticulationState } from '../../core-kernels/boneyard-demon-articulation.ts'
import type { BoneyardEnemyArenaScalars, EvaluatedBoneyardEnemyConfig } from '../../core-kernels/boneyard-enemy-config-model.ts'
import type { BoneyardEnemyProjectilePayload } from '../../core-kernels/boneyard-enemy-modifiers.ts'
import type { NativeImpFlightState } from '../../core-kernels/boneyard-imp-flight.ts'
import type { NativeSkeletonHeadFacingOffset } from '../../core-kernels/boneyard-skeleton-family-animation.ts'
import type { BoneyardEnemySpawnIntent } from '../../core-kernels/boneyard-wave-director.ts'
import type { BoneyardBounds, BoneyardPoint } from '../../core-kernels/boneyard.ts'
import type { NativeArcherStrafeState } from '../../core-kernels/native-archer-strafe.ts'
import type { NativeBossNarration, NativeBossStreamCue } from '../../core-kernels/native-boss-audio.ts'
import type { NativeBossSpell } from '../../core-kernels/native-boss-spell.ts'
import type { NativeCrowState } from '../../core-kernels/native-crow.ts'
import type { NativeDeadSpiderState } from '../../core-kernels/native-dead-spider.ts'
import type { NativeDemonSkullAction, NativeDemonSkullEncounterState, NativeDemonSkullState } from '../../core-kernels/native-demon-skull.ts'
import type { NativeEnemyPathState } from '../../core-kernels/native-enemy-pathfinding.ts'
import type { NativeEnemyWorldFeedbackOutput } from '../../core-kernels/native-enemy-world-feedback.ts'
import type { NativeFacultyVoiceController } from '../../core-kernels/native-faculty-voices.ts'
import type { NativeFacultyState } from '../../core-kernels/native-faculty.ts'
import type { NativeHeartmongerState } from '../../core-kernels/native-heartmonger.ts'
import type { NativeRegionCameraShake } from '../../core-kernels/native-region-point-gain.ts'
import type { NativeRngState } from '../../core-kernels/native-rng.ts'
import type { NativeSecondaryScreenFlashState, NativeSecondaryTargetEffectState } from '../../core-kernels/native-secondary-abilities.ts'
import type { NativeFadeLineActor } from '../../core-kernels/native-silk-force.ts'
import type { NativeSilkState } from '../../core-kernels/native-silk.ts'
import type { NativeSpiderState } from '../../core-kernels/native-spider.ts'
import type { NativePortalState } from '../../core-kernels/native-survival-portal.ts'
import { nativePortalCollisionRadius } from '../../core-kernels/native-survival-portal.ts'
import type { NativeWebbedState } from '../../core-kernels/native-webbed.ts'
import type { NativeWorldManagerRegistration, RegisterNativeWorldPainter } from '../../core-kernels/native-world-manager-order.ts'
import type { NativeWraithFlightState } from '../../core-kernels/native-wraith-flight.ts'
import type { NativeFirePatchState } from '../../core-kernels/primary-spell-fire-effects.ts'
import type { PrimarySpellTarget } from '../../core-kernels/primary-spell-targeting.ts'
import type { NativeEnemyLootSeedBound } from '../boneyard-enemy-loot-seed.ts'
export type BoneyardEnemyActorId = number

export type BoneyardEnemyDeathEffectId = number

export type BoneyardEnemyProjectileId = number

export type BoneyardEnemyProjectileEffectId = number

export type BoneyardEnemyEventId = number

export type BoneyardMageLightningPulseId = number

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
  readonly aimSeed: number
  readonly attackRange: number
  readonly family: 'archer'
  readonly phase: 'range-control' | 'attack' | 'death'
  readonly rangeEasyPending: boolean
  readonly strafe: NativeArcherStrafeState
}

export interface BoneyardMageBrain extends ActionClock {
  readonly attackRange: number
  readonly castProgram: 'long' | 'short'
  readonly castRoll: number
  readonly disabledPrimaryTicks: number
  readonly family: 'mage'
  readonly lightningTargetPlayerId: string | null
  readonly lightningTargetPosition: Readonly<BoneyardPoint> | null
  readonly lightningTicksRemaining: number
  readonly phase: 'range-control' | 'cast' | 'death'
  readonly rangeEasyPending: boolean
  readonly shieldTicksRemaining: number
}

export interface BoneyardImpBrain extends NativeImpFlightState {
  readonly escapeHeadingDeg: number | null
  readonly family: 'imp'
  readonly phase: 'flight' | 'death'
  readonly visualRngState: number
}

export interface BoneyardZombieBrain {
  readonly actionProgress: number
  readonly actionRate: number
  readonly actionSwing: number
  readonly angularOffsetDeg: number
  readonly attackSide: 0 | 1
  readonly bodyPhaseDeg: number
  readonly bodyType: number
  readonly contactTargetPlayerId: string | null
  readonly family: 'zombie'
  readonly frontArmBaseRotationDeg: number
  readonly headBaseRotationDeg: number
  readonly headPhaseDeg: number
  readonly headType: number
  readonly impactStateTicksRemaining: number
  readonly markerEmitted: boolean
  readonly phase: 'approach' | 'swipe' | 'knockback' | 'death'
  readonly phaseTicksRemaining: number
  readonly rearArmBaseRotationDeg: number
  readonly verticalOffset: number
  readonly verticalVelocity: number
  readonly visualRngState: number
}

export interface BoneyardWraithBrain extends NativeWraithFlightState {
  readonly family: 'wraith'
  readonly phase: 'flight' | 'death'
}

export interface BoneyardDemonBrain {
  readonly actionProgress: number
  readonly articulation: NativeDemonArticulationState
  readonly family: 'demon'
  readonly markerEmitted: boolean
  readonly phase: 'approach' | 'bomb' | 'death'
}

export interface BoneyardCoffinBrain {
  readonly family: 'coffin'
  readonly launchRotationDeg: number
  readonly launchScale: -1 | 1
  readonly maggotCharge: number
  readonly phase: 'hidden' | 'rising' | 'holding' | 'opening' | 'open' | 'death'
  readonly phaseTick: number
  readonly phaseTicksRemaining: number
}

export interface BoneyardPortalBrain extends NativePortalState {
  readonly family: 'portal'
  readonly hurtTicksRemaining: number
  readonly phase: 'active' | 'death'
}

export interface BoneyardDemonSkullBrain extends NativeDemonSkullState {
  readonly deathCountdown: number
  readonly actions: readonly NativeDemonSkullAction[]
  readonly family: 'demon-skull'
  readonly phase: 'range-control' | 'cast' | 'death'
}

export type BoneyardDemonSkullActor = BoneyardEnemyActor & {
  readonly brain: BoneyardDemonSkullBrain
  readonly config: Extract<EvaluatedBoneyardEnemyConfig, { enemyToken: 'DEMONSKULL' }>
}


export interface BoneyardFacultyBrain extends NativeFacultyState {
  readonly family: 'faculty'
  readonly phase: 'range-control' | 'cast' | 'death'
}

export interface BoneyardHeartmongerBrain extends NativeHeartmongerState {
  readonly family: 'heartmonger'
  readonly phase: 'approach' | 'death'
  readonly legPhase: number
  readonly torsoPhase: number
}

export interface BoneyardDetachedCrow {
  readonly flight: NativeCrowState
  readonly ownerActorId: number
  readonly spawnTick: number
}

export type BoneyardEnemyBrain =
  | BoneyardSpiderBrain
  | BoneyardCocoonBrain
  | BoneyardDemonSkullBrain
  | BoneyardFacultyBrain
  | BoneyardHeartmongerBrain
  | BoneyardArcherBrain
  | BoneyardCoffinBrain
  | BoneyardDemonBrain
  | BoneyardImpBrain
  | BoneyardMageBrain
  | BoneyardPortalBrain
  | BoneyardSkeletonBrain
  | BoneyardWraithBrain
  | BoneyardZombieBrain

export interface BoneyardEnemyLightingState {
  readonly charge: number
  readonly glow: number
  readonly providerCopies: 0 | 1 | 2
}

export interface BoneyardEnemyActor {
  readonly hitFeedback: NativePuppetHitState
  readonly blizzardPushAccumulator: number
  readonly blizzardPushLastTick: number | null
  readonly bodyGaitPhase: number
  readonly bodyPose: number
  readonly brain: BoneyardEnemyBrain
  readonly config: EvaluatedBoneyardEnemyConfig
  readonly currentHealth: number
  readonly deathEpoch: number | null
  readonly deathPresentationStarted: boolean
  readonly deathStartedTick: number | null
  readonly deathTick: number
  readonly gaitPose: number
  readonly headFacingOffset: NativeSkeletonHeadFacingOffset
  readonly headingDeg: number
  readonly hurricaneContactCooldown: number
  readonly id: BoneyardEnemyActorId
  readonly lastDamagedByPlayerId: string | null
  readonly lastDamageTick: number | null
  readonly lastMovementTick: number | null
  readonly lethalMagicDamage: boolean
  readonly lifeState: 'alive' | 'dying'
  readonly lightRegistration: NativeWorldManagerRegistration
  readonly lighting: Readonly<BoneyardEnemyLightingState>
  readonly lootSeed: number
  readonly nextMovementTick: number
  readonly nextTargetRefreshTick: number
  readonly nativeCellBindingOrder: number
  readonly nativeRegistrationOrder: number
  readonly path: NativeEnemyPathState
  readonly position: Readonly<BoneyardPoint>
  readonly rewardGranted: boolean
  readonly restBodyPose: number
  readonly shieldHealth: number
  readonly shadowLateralOffset: number
  readonly shieldMaximumHealth: number
  readonly shieldPulse: number
  readonly shieldSoundCooldownTicks: number
  readonly sourceSpawnIntentId: number
  readonly spawnTick: number
  readonly staffActionFactor: number
  readonly staffMovementFactor: number
  readonly stridePhaseDeg: number
  readonly targetPlayerId: string | null
  readonly terminalEmitted: boolean
  readonly waveOrdinal: number
}

export function boneyardEnemyActorFlags(actor: BoneyardEnemyActor): 0 | 0x2 {
  if (actor.lifeState !== 'alive') return 0
  if (
    actor.brain.family === 'coffin'
    && (actor.brain.phase === 'hidden' || actor.brain.phase === 'death')
  ) return 0
  return 0x2
}

export type BoneyardEnemyProjectileKind =
  | 'arrow'
  | 'demon-bomb'
  | 'firebolt'
  | 'guided-missile'
  | 'poison-pool'

export interface BoneyardEnemyProjectileBase {
  readonly ageTicks: number
  readonly bounceVelocity: number
  readonly chillTumbleAccumulator: number
  readonly coldSlowTicks: number
  readonly contactRadius: number
  readonly damage: number
  readonly secondaryDamage: number
  readonly headingDeg: number
  readonly hitPlayerIds: readonly string[]
  readonly homing: boolean
  readonly id: BoneyardEnemyProjectileId
  readonly lastStepTick: number
  readonly lightRegistration: NativeWorldManagerRegistration | null
  readonly lifetimeTicks: number
  readonly minimumSpeed: number
  readonly nativeTypeId: 0x7da | 0x7eb | 0x7ec | 0x7f7 | 0x806
  readonly nativeCellBindingOrder: number
  readonly nativeRegistrationOrder: number
  readonly ownerActorId: BoneyardEnemyActorId
  readonly painterRegistration: NativeWorldManagerRegistration
  readonly payload: BoneyardEnemyProjectilePayload
  readonly poisonDamage: number
  readonly poisonDuration: number
  readonly position: Readonly<BoneyardPoint>
  readonly speed: number
  readonly settledTicksRemaining: number
  readonly spawnTick: number
  readonly targetPlayerId: string | null
  readonly turnSpeed: number
  readonly verticalOffset: number
  readonly verticalVelocity: number
  readonly visualPhaseDeg: number
  readonly visualScale: number
}

export type BoneyardEnemyProjectile = BoneyardEnemyProjectileBase & (
  | { readonly kind: 'arrow'; readonly velocity: Readonly<BoneyardPoint> }
  | { readonly kind: Exclude<BoneyardEnemyProjectileKind, 'arrow'> }
)

export type BoneyardEnemyProjectileEffectKind =
  | 'arrow-tumble'
  | 'demon-fire'
  | 'demon-explosion-core'
  | 'demon-explosion-array'
  | 'demon-explosion-lit-array'
  | 'poison-bubble'
  | 'fire-burst'
  | 'guided-impact'
  | 'firebolt-trail'

export interface BoneyardEnemyProjectileEffectBase {
  readonly ageTicks: number
  readonly alpha: number
  readonly alphaLossPerTick: number
  readonly angularVelocityDeg: number
  readonly atlas: 'BadGuys' | 'DeadHawg'
  readonly blendMode: 'add' | 'normal'
  readonly entry: number
  readonly id: BoneyardEnemyProjectileEffectId
  readonly lastStepTick: number
  readonly lightRegistration: NativeWorldManagerRegistration | null
  readonly lifetimeTicks: number
  readonly ownerActorId: BoneyardEnemyActorId
  readonly ownerProjectileId: BoneyardEnemyProjectileId
  readonly painterRegistration: NativeWorldManagerRegistration
  readonly phaseOriginTicks: number
  readonly position: Readonly<BoneyardPoint>
  readonly rotationDeg: number
  readonly scale: number
  readonly spawnTick: number
  readonly tint: number
  readonly velocity: Readonly<BoneyardPoint>
}

export type BoneyardEnemyProjectileEffect = BoneyardEnemyProjectileEffectBase & (
  | { readonly kind: 'demon-fire'; readonly fire: NativeFirePatchState }
  | { readonly kind: 'poison-bubble'; readonly growthPerTick: number; readonly maximumScale: number }
  | { readonly kind: Exclude<BoneyardEnemyProjectileEffectKind, 'demon-fire' | 'poison-bubble'> }
)

export interface BoneyardMaggotActor {
  readonly hitFeedback: NativePuppetHitState
  readonly blizzardPushAccumulator: number
  readonly blizzardPushLastTick: number | null
  readonly combatActive: boolean
  readonly collisionRadius: number
  readonly currentHealth: number
  readonly deathOffsets: readonly Readonly<BoneyardPoint>[]
  readonly damage: number
  readonly deathEpoch: number | null
  readonly deathStartedTick: number | null
  readonly deathTick: number
  readonly gaitPose: number
  readonly headingDeg: number
  readonly hurricaneContactCooldown: number
  readonly id: BoneyardEnemyActorId
  readonly emergenceTick: number
  readonly emergencePhase: number
  readonly launchTrajectory: 'edge' | 'lid'
  readonly launchVelocity: Readonly<BoneyardPoint>
  readonly landingBounceVelocity: number
  readonly lastAttackTick: number | null
  readonly lastDamagedByPlayerId: string | null
  readonly lastDamageTick: number | null
  readonly lastMovementTick: number | null
  readonly lifeState: 'alive' | 'dying'
  readonly lightRegistration: NativeWorldManagerRegistration
  readonly maximumHealth: number
  readonly nextAttackTick: number
  readonly nextMovementTick: number
  readonly nextTargetRefreshTick: number
  readonly nativeCellBindingOrder: number
  readonly nativeRegistrationOrder: number
  readonly ownerCoffinActorId: BoneyardEnemyActorId
  readonly path: NativeEnemyPathState
  readonly poisonDamage: number
  readonly poisonDuration: number
  readonly position: Readonly<BoneyardPoint>
  readonly movementPhase: 'crawl' | 'emerging'
  readonly spawnTick: number
  readonly staffActionFactor: number
  readonly staffMovementFactor: number
  readonly targetPlayerId: string | null
  readonly terminalEmitted: boolean
  readonly verticalOffset: number
  readonly verticalVelocity: number
  readonly visualScale: number
}

export type BoneyardEnemyDeathEffectKind =
  | 'banish'
  | 'bouncer'
  | 'smoky-bouncer'
  | 'fade'
  | 'fade-additive'
  | 'fade-perspective'
  | 'fade-perspective-clipped'
  | 'fade-scale-perspective'
  | 'fade-scale'
  | 'fire-array'
  | 'late-splat'
  | 'move-fade'
  | 'move-fade-perspective'
  | 'sprite-array'
  | 'unbind'
  | 'banish-black'
  | 'scrap'
  | 'black-smoky-bouncer'

export interface BoneyardEnemyDeathEffect {
  readonly ageTicks: number
  readonly alpha: number
  readonly alphaMultiplier: number
  readonly alphaLossPerTick: number
  readonly angularVelocityDeg: number
  readonly atlas: 'BadGuys' | 'DeadHawg' | 'Demon' | 'Unholy'
  readonly blendMode: 'add' | 'normal'
  readonly bounceRetention: number
  readonly bounceVelocity: number
  readonly entry: number
  readonly firstEntry: number
  readonly frameCount: number
  readonly framePhase: number
  readonly frameVelocity: number
  readonly frameVelocityDamping: number
  readonly frameTicks: number
  readonly height: number
  readonly id: BoneyardEnemyDeathEffectId
  readonly kind: BoneyardEnemyDeathEffectKind
  readonly lastStepTick: number
  readonly lifetimeTicks: number
  readonly ownerActorId: BoneyardEnemyActorId
  readonly opacityTimer: number
  readonly painterRegistration: NativeWorldManagerRegistration | null
  readonly presentationOwner: 'background' | 'direct-post-world' | 'pre-world-queue' | 'world-sorted' | 'late-world-overlay'
  readonly position: Readonly<BoneyardPoint>
  readonly role: string
  readonly rotationDeg: number
  readonly scale: number
  readonly scaleY: number
  readonly scaleMultiplier: number
  readonly shadow: boolean
  readonly spawnTick: number
  readonly tint: number
  readonly verticalVelocity: number
  readonly velocity: Readonly<BoneyardPoint>
  readonly velocityDamping: number
  readonly painterSortBias?: number
  readonly scrapOscillation?: Readonly<{ phaseDeg: number; stepDeg: number; amplitudeDeg: number }>
}

export interface BoneyardMageLightningWorldContact {
  readonly kind: 'world'
  readonly position: Readonly<BoneyardPoint>
}

export interface BoneyardMageLightningTargetContact {
  readonly kind: 'target-attached'
  readonly localOffset: Readonly<BoneyardPoint>
  readonly targetPlayerId: string
}

export interface BoneyardMageLightningPulse {
  readonly contact: BoneyardMageLightningTargetContact | BoneyardMageLightningWorldContact
  readonly endpoint: Readonly<BoneyardPoint>
  readonly id: BoneyardMageLightningPulseId
  readonly midpoint: Readonly<BoneyardPoint>
  readonly ownerActorId: BoneyardEnemyActorId
  readonly painterRegistrations: readonly NativeWorldManagerRegistration[]
  readonly seed: number
  readonly source: Readonly<BoneyardPoint>
  readonly tick: number
}

export type BoneyardEnemyTerminalOutput = NativeEnemyWorldFeedbackOutput

export type BoneyardEnemyDeathSound =
  | 'spider-die'
  | 'banshee-die'
  | 'coffin-break'
  | 'demon-die'
  | 'firey-death'
  | 'flash'
  | 'imp-split'
  | 'maggot-squeak-1'
  | 'maggot-squeak-2'
  | 'maggot-squish-1'
  | 'maggot-squish-2'
  | 'maggot-squish-3'
  | 'portal-die'
  | 'skeleton-die'
  | 'zombie-die'
  | 'zombie-die-groan'
  | 'zombie-poison-splat'

export type BoneyardEnemyDamageSound =
  | 'bone-crack'
  | 'hit-shield'
  | 'pop-shield'
  | 'portal-hurt'
  | 'zombie-ouch'

export type BoneyardPlayerDamageSound =
  | 'wizard-ouch-1'
  | 'wizard-ouch-2'
  | 'wizard-ouch-3'

export type BoneyardEnemyActionSound =
  | 'maggot-squish-1'
  | 'maggot-squish-2'
  | 'disintegrate'
  | 'shoot-web-1'
  | 'shoot-web-2'
  | 'shoot-web-3'
  | 'webbed-1'
  | 'webbed-2'
  | 'bite-1'
  | 'bite-2'
  | 'bite-3'
  | 'imp-vocal-1'
  | 'imp-vocal-2'
  | 'imp-vocal-3'
  | 'imp-vocal-4'
  | 'imp-vocal-5'
  | 'imp-vocal-6'
  | 'imp-vocal-7'
  | 'imp-vocal-8'
  | 'fireball-hit'
  | 'portal-open'
  | 'shoot-arrow'
  | 'magic-missile-hit'
  | 'throw-fire'
  | 'throw-spell'
  | 'spit-fire'
  | 'knock'
  | 'throw-dark'
  | 'chain-clank-1'
  | 'chain-clank-2'
  | 'spin-attack'
  | 'magic-storm'
  | 'magic-shield-explode'
  | 'distort-reality'
  | 'firey-death'
  | 'eye-laser-charge'
  | 'jaw'
  | 'skull-bite'
  | 'unholy-spits'
  | 'magic-circle'
  | 'big-fire'
  | 'banshee-die'
  | 'lightning-start'
  | 'flame-lash-start'
  | 'crow-1'
  | 'crow-2'
  | 'wings'

export type BoneyardCombatSound =
  | 'frosted'
  | 'poisoned'
  | BoneyardEnemyActionSound
  | BoneyardEnemyDamageSound
  | BoneyardEnemyDeathSound
  | BoneyardPlayerDamageSound
  | 'blind'

export type BoneyardEnemySemanticEventType =
  | 'cocoon-released'
  | 'player-status-sound'
  | 'attack-marker'
  | 'coffin-maggot-release'
  | 'enemy-action-sound'
  | 'enemy-death'
  | 'enemy-death-sound'
  | 'enemy-damage-sound'
  | 'player-damage-sound'
  | 'enemy-retired'
  | 'enemy-spawned'
  | 'enemy-terminal-output'
  | 'projectile-impact'
  | 'projectile-retired'
  | 'player-deflected'
  | 'mage-lightning-contact'
  | 'projectile-spawned'
  | 'reward'
  | 'enemy-dialogue-stop'
  | 'enemy-stream'
  | 'enemy-screen-flash'
  | 'enemy-camera-shake'

export interface BoneyardEnemySemanticEvent {
  readonly cameraShake?: NativeRegionCameraShake
  readonly actorId: BoneyardEnemyActorId
  readonly count?: number
  readonly deflectPitch?: number
  readonly eventId: BoneyardEnemyEventId
  readonly gainScale?: number
  readonly output?: BoneyardEnemyTerminalOutput
  readonly painterRegistration?: NativeWorldManagerRegistration
  readonly pitch?: number
  readonly projectileId?: BoneyardEnemyProjectileId
  readonly sound?: BoneyardCombatSound
  readonly sourcePosition?: Readonly<BoneyardPoint>
  readonly targetPlayerId?: string | null
  readonly tick: number
  readonly type: BoneyardEnemySemanticEventType
  readonly stream?: NativeBossStreamCue
  readonly screenFlashOnlyIfClear?: boolean
  readonly screenFlash?: NativeSecondaryScreenFlashState
}

export interface BoneyardEnemyPlayerDamage {
  readonly hitStrength?: number
  readonly webbedStrength?: number
  readonly actorId: BoneyardEnemyActorId
  readonly physicalDamage: number
  readonly magicDamage: number
  readonly coldSlowTicks: number
  readonly dazzleTicks: number
  readonly eventId: BoneyardEnemyEventId
  readonly poisonDamage: number
  readonly poisonDuration: number
  readonly poisonContactDamage?: number
  readonly suppressHitResponse?: boolean
  readonly suppressFlash?: boolean
  readonly playerId: string
  readonly source?: Readonly<{
    position: Readonly<BoneyardPoint>
    collisionRadius: number
    reflectableActorId: BoneyardEnemyActorId | null
  }>
  readonly manaDamageMaximumFraction?: number
  readonly tragicCircle?: boolean
  readonly crowBlindChancePercent?: number
}

export interface BoneyardEnemyPlayerKnockback {
  readonly actorId: BoneyardEnemyActorId
  readonly delta: Readonly<BoneyardPoint>
  readonly eventId: BoneyardEnemyEventId
  readonly playerId: string
}

export interface BoneyardProjectileKnockback extends BoneyardEnemyPlayerKnockback {
  readonly lastStepTick: number
  readonly remainingTicks: number
}

export interface BoneyardEnemyReward {
  readonly actorId: BoneyardEnemyActorId
  readonly eventId: BoneyardEnemyEventId
  readonly experience: number
  readonly lootSource: BoneyardEnemyLootSource
  readonly playerId: string | null
}

export interface BoneyardEnemyLootSource {
  readonly actorSeed: number
  readonly enemyToken: EvaluatedBoneyardEnemyConfig['enemyToken']
  readonly onDeathProgram: EvaluatedBoneyardEnemyConfig['onDeathProgram']
  readonly policies?: EvaluatedBoneyardEnemyConfig['lootPolicies']
  readonly participantSlot: 0
  readonly position: Readonly<BoneyardPoint>
  readonly recipeUid?: number
}

export interface BoneyardEnemyRetirement {
  readonly actorId: BoneyardEnemyActorId
  readonly eventId: BoneyardEnemyEventId
}

export interface BoneyardEnemyStore {
  readonly puppetHits: readonly NativeWorldPuppetHit[]
  readonly silkFragments: readonly NativeFadeLineActor[]
  readonly spiderRemains: readonly BoneyardSpiderRemains[]
  readonly silks: readonly BoneyardSilkActor[]
  readonly webbedPlayers: Readonly<Record<string, NativeWebbedState>>
  readonly spiderSpitTicksRemaining: number
  readonly demonSkullEncounter: NativeDemonSkullEncounterState
  readonly actors: readonly BoneyardEnemyActor[]
  readonly deathEffects: readonly BoneyardEnemyDeathEffect[]
  readonly headFacingRngState: NativeRngState
  readonly lastStepTick: number
  readonly locomotionRngState: NativeRngState
  readonly mageLightningPulses: readonly BoneyardMageLightningPulse[]
  readonly maggots: readonly BoneyardMaggotActor[]
  readonly nextActorId: BoneyardEnemyActorId
  readonly nextDeathEpoch: number
  readonly nextDeathEffectId: BoneyardEnemyDeathEffectId
  readonly nextEventId: BoneyardEnemyEventId
  readonly nextMageLightningPulseId: BoneyardMageLightningPulseId
  readonly nextNativeCellBindingOrder: number
  readonly nextNativeRegistrationOrder: number
  readonly nextProjectileId: BoneyardEnemyProjectileId
  readonly nextProjectileEffectId: BoneyardEnemyProjectileEffectId
  readonly nextSyntheticSpawnIntentId: number
  readonly projectiles: readonly BoneyardEnemyProjectile[]
  readonly projectileEffects: readonly BoneyardEnemyProjectileEffect[]
  readonly projectileKnockbacks: readonly BoneyardProjectileKnockback[]
  readonly targetCellBindings: Readonly<Record<string, BoneyardEnemyTargetCellBinding>>
  readonly rngState: number
  readonly steeringRngState: NativeRngState
  readonly featuredBossId: BoneyardEnemyActorId | null
  readonly bossNarration: NativeBossNarration
  readonly facultyVoiceController: NativeFacultyVoiceController | null
  readonly bossSpells: readonly NativeBossSpell[]
  readonly detachedCrows: readonly BoneyardDetachedCrow[]
}

export interface BoneyardPlayerDamageSoundRequest {
  readonly actorId: BoneyardEnemyActorId
  readonly currentHealth: number
  readonly playerId: string
  readonly position: Readonly<BoneyardPoint>
  readonly tick: number
}

export interface BoneyardPlayerDamageSoundResult {
  readonly deadlineTick: number
  readonly event: BoneyardEnemySemanticEvent
  readonly rng: NativeRngState
  readonly store: BoneyardEnemyStore
}

export interface BoneyardEnemyTargetCellBinding {
  readonly cellX: number
  readonly cellY: number
  readonly order: number
}

export interface BoneyardEnemyTargetCandidate {
  readonly summoned?: true
  readonly alive: boolean
  readonly collisionRadius: number
  readonly connected: boolean
  readonly eligible: boolean
  readonly headingDeg?: number
  readonly position: Readonly<BoneyardPoint>
  readonly velocityPerTick: Readonly<BoneyardPoint>
}

export type BoneyardEnemyTargets = Readonly<Record<string, BoneyardEnemyTargetCandidate>>

export interface BoneyardEnemyMovementRequest {
  readonly actorId: BoneyardEnemyActorId
  readonly delta: Readonly<BoneyardPoint>
  readonly position: Readonly<BoneyardPoint>
  readonly purpose: 'movement' | 'spawn-placement'
  readonly radius: number
  readonly requestedPosition: Readonly<BoneyardPoint>
}

export interface BoneyardEnemyNavigationPathRequest {
  readonly actorId: BoneyardEnemyActorId
  readonly bodyRadius: number
  readonly end: Readonly<BoneyardPoint>
  readonly navigationClearance: number
  readonly radius: number
  readonly start: Readonly<BoneyardPoint>
}

export interface BoneyardEnemyNavigation {
  readonly findRoute: (
    request: BoneyardEnemyNavigationPathRequest,
  ) => readonly Readonly<BoneyardPoint>[] | null
  readonly isPathClear: (
    request: BoneyardEnemyNavigationPathRequest,
  ) => boolean
}

export type ResolveBoneyardEnemyMovement = (
  request: BoneyardEnemyMovementRequest,
) => Readonly<BoneyardPoint>

export interface BoneyardEnemySpawnPlacementRequest {
  readonly actorId: BoneyardEnemyActorId
  readonly navigationClearance: number
  readonly position: Readonly<BoneyardPoint>
  readonly positionPolicy: BoneyardEnemySpawnIntent['positionPolicy']
  readonly radius: number
  readonly reachabilityRadius: number
  readonly rngState: NativeRngState
}

export interface BoneyardEnemySpawnPlacementResult {
  readonly position: Readonly<BoneyardPoint>
  readonly rngState: NativeRngState
}

export type ResolveBoneyardEnemySpawnPlacement = (
  request: BoneyardEnemySpawnPlacementRequest,
) => BoneyardEnemySpawnPlacementResult

export type BoneyardEnemyProjectileWorldContactRequest = Readonly<{
  projectileId: BoneyardEnemyProjectileId
} & (
  | { kind: 'line'; start: Readonly<BoneyardPoint>; end: Readonly<BoneyardPoint>; nativeExclusionMask: number; radius: 0 }
  | { kind: 'point'; position: Readonly<BoneyardPoint>; radius: number }
  | { kind: 'bounds' | 'view'; position: Readonly<BoneyardPoint>; margin: number }
)>

export type BoneyardEnemyProjectileWorldBlocked = (
  request: BoneyardEnemyProjectileWorldContactRequest,
) => boolean

export interface BoneyardEnemySpellSegmentRequest {
  readonly nativeExclusionMask?: number
  readonly end: Readonly<BoneyardPoint>
  readonly start: Readonly<BoneyardPoint>
}

export type ClipBoneyardEnemySpellSegment = (
  request: BoneyardEnemySpellSegmentRequest,
) => Readonly<BoneyardPoint>

export interface BoneyardEnemyLethalObserver {
  readonly attributionObserver?: BoneyardEnemyAttributionObserver
  readonly onReward: (
    request: Readonly<{
      enemy: EvaluatedBoneyardEnemyConfig
      playerId: string | null
    }>,
  ) => void
}

export interface BoneyardEnemyRetirementObserver {
  readonly onTerminalOutput: (
    output: BoneyardEnemyTerminalOutput,
    outputCount: number | undefined,
  ) => void
}

export interface BoneyardEnemyStoreStepContext {
  readonly spiderMovementView?: {
    readonly arenaBounds: Readonly<BoneyardBounds>
    readonly cameras: readonly Readonly<BoneyardBounds>[]
    readonly enhancedEffects: boolean
  }
  readonly lightAt?: (position: Readonly<BoneyardPoint>) => number
  readonly puppetTargets?: readonly BoneyardPuppetTarget[]
  readonly abilityEffects?: Readonly<Record<number, NativeSecondaryTargetEffectState>>
  readonly arenaScalars?: Partial<BoneyardEnemyArenaScalars>
  readonly clipSpellSegment?: ClipBoneyardEnemySpellSegment
  readonly projectileWorldBlocked: BoneyardEnemyProjectileWorldBlocked
  readonly navigation?: BoneyardEnemyNavigation
  readonly paused?: boolean
  readonly onProjectileExplosion?: (position: Readonly<BoneyardPoint>) => void
  readonly players: BoneyardEnemyTargets
  readonly registerWorldPainter?: RegisterNativeWorldPainter
  readonly registerProjectileWorldPainter?: RegisterNativeWorldPainter
  readonly retirementObserver?: BoneyardEnemyRetirementObserver
  readonly rollLootSeed?: (bound: NativeEnemyLootSeedBound) => number
  readonly resolveMovement: ResolveBoneyardEnemyMovement
  readonly resolveSpawnPlacement?: ResolveBoneyardEnemySpawnPlacement
  readonly resolveSpawnIntents: (
    liveEnemyCount: number,
    liveZombieCount: number,
    liveBossCount: number,
  ) => readonly BoneyardEnemySpawnIntent[]
  readonly tick: number
  readonly dialogueBusy?: boolean
  readonly nativeViewBounds?: Readonly<BoneyardBounds>
  readonly nativeVisibility?: (position: Readonly<BoneyardPoint>) => Readonly<{ admitted: boolean; intensity: number }>
  readonly projectedPointVisible?: (position: Readonly<BoneyardPoint>) => boolean
}

export interface BoneyardPuppetTarget extends PrimarySpellTarget {
  readonly hitKind: NativeWorldPuppetHitKind | null
}

export interface BoneyardEnemyStoreStepResult {
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly playerDamage: readonly BoneyardEnemyPlayerDamage[]
  readonly playerKnockbacks: readonly BoneyardEnemyPlayerKnockback[]
  readonly retired: readonly BoneyardEnemyRetirement[]
  readonly rewards: readonly BoneyardEnemyReward[]
  readonly spawnedActorIds: readonly BoneyardEnemyActorId[]
  readonly store: BoneyardEnemyStore
}

export interface DamageBoneyardEnemyRequest {
  readonly hitStrength?: number
  readonly etherDrainCapture?: boolean
  readonly magic?: boolean
  readonly actorId: BoneyardEnemyActorId
  readonly amount: number
  readonly hasMagicDamage?: boolean
  readonly attributionObserver?: BoneyardEnemyAttributionObserver
  readonly lethalObserver?: BoneyardEnemyLethalObserver
  readonly sourcePlayerId: string | null
  readonly registerWorldPainter?: RegisterNativeWorldPainter
  readonly suppressHurtSound?: boolean
  readonly tick: number
}

export interface DamageBoneyardEnemyResult {
  readonly accepted: boolean
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly healthDamage: number
  readonly killed: boolean
  readonly store: BoneyardEnemyStore
}

export interface BoneyardEnemyAttributionObserver {
  readonly onEnemyHealthDamage: (event: Readonly<{
    actorId: number
    amount: number
    maximumHealth: number
    playerId: string
  }>) => void
  readonly onEnemyKillExperience: (event: Readonly<{
    actorId: number
    amount: number
    enemyToken: string
    playerId: string
  }>) => void
  readonly onLootPickup?: (event: Readonly<{
    amount: number
    bonusKind: number | null
    itemKind: string | null
    itemName: string | null
    itemQuantity: number | null
    kind: 'bonus' | 'gold' | 'orb' | 'sack'
    orbKind: 'health' | 'mana' | null
    playerId: string
  }>) => void
}

export interface PositionBoneyardEnemyResult {
  readonly accepted: boolean
  readonly store: BoneyardEnemyStore
}

export interface TumbleBoneyardArrowResult {
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly rng: NativeRngState
  readonly store: BoneyardEnemyStore
  readonly tumbled: boolean
}

export interface WorkingStep {
  puppetHits: NativeWorldPuppetHit[]
  silkFragments: NativeFadeLineActor[]
  spiderRemains: BoneyardSpiderRemains[]
  silks: BoneyardSilkActor[]
  webbedPlayers: Record<string, NativeWebbedState>
  spiderSpitTicksRemaining: number
  demonSkullEncounter: NativeDemonSkullEncounterState
  actors: BoneyardEnemyActor[]
  deathEffects: BoneyardEnemyDeathEffect[]
  events: BoneyardEnemySemanticEvent[]
  headFacingRngState: NativeRngState
  impActorCount: number
  locomotionRngState: NativeRngState
  mageLightningPulses: BoneyardMageLightningPulse[]
  maggots: BoneyardMaggotActor[]
  nextActorId: number
  nextDeathEpoch: number
  nextDeathEffectId: number
  nextEventId: number
  nextMageLightningPulseId: number
  nextNativeCellBindingOrder: number
  nextNativeRegistrationOrder: number
  nextProjectileId: number
  nextProjectileEffectId: number
  nextSyntheticSpawnIntentId: number
  playerDamage: BoneyardEnemyPlayerDamage[]
  playerKnockbacks: BoneyardEnemyPlayerKnockback[]
  pathStatusFactors: Map<BoneyardEnemyActorId, number>
  pendingSpawnIntents: BoneyardEnemySpawnIntent[]
  projectiles: BoneyardEnemyProjectile[]
  projectileEffects: BoneyardEnemyProjectileEffect[]
  projectileKnockbacks: BoneyardProjectileKnockback[]
  targetCellBindings: Readonly<Record<string, BoneyardEnemyTargetCellBinding>>
  registerWorldPainter: RegisterNativeWorldPainter
  registerProjectileWorldPainter: RegisterNativeWorldPainter
  retired: BoneyardEnemyRetirement[]
  rewards: BoneyardEnemyReward[]
  rngState: number
  steeringRngState: NativeRngState
  spawnedActorIds: number[]
  featuredBossId: BoneyardEnemyActorId | null
  bossNarration: NativeBossNarration
  facultyVoiceController: NativeFacultyVoiceController | null
  bossSpells: NativeBossSpell[]
  detachedCrows: BoneyardDetachedCrow[]
}

export interface ActionProgram {
  markerProgress: number
  progressPerTick: number
  strictEnd: number
}

export function boneyardEnemyCollisionRadius(actor: BoneyardEnemyActor): number {
  if (actor.brain.family === 'spider') return actor.brain.attached ? 5 : 15
  return actor.brain.family === 'portal'
    ? nativePortalCollisionRadius(actor.brain)
    : actor.config.collisionRadius
}

export function validateTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('enemy store tick must be a non-negative safe integer')
  }
}

export function validatePoint(point: Readonly<BoneyardPoint>, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`${label} must contain finite coordinates`)
  }
}

export interface BoneyardSpiderBrain extends NativeSpiderState {
  readonly family: 'spider'
  readonly phase: 'active' | 'death' | 'captured'
}

export interface BoneyardCocoonBrain {
  readonly family: 'cocoon'
  readonly phase: 'active' | 'death'
  readonly ownerPlayerId: string | null
  readonly ownerPosition: Readonly<BoneyardPoint>
}

export interface BoneyardSilkActor {
  readonly nativeRegistrationOrder: number
  readonly nativeCellBindingOrder: number
  readonly id: number
  readonly ownerActorId: number
  readonly spawnTick: number
  readonly state: NativeSilkState
  readonly painterRegistration: NativeWorldManagerRegistration
}

export interface BoneyardSpiderRemains {
  readonly id: number
  readonly spawnTick: number
  readonly state: NativeDeadSpiderState
}
