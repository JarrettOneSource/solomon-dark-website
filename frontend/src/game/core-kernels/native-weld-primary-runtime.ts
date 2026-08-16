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
  readonly startCueId: number | null
}

const WELD_AUDIO_PLANS: Readonly<Record<NativeWeldBuildId, NativeWeldAudioPlan>> = {
  1000: plan(1000, 'burning-bolt'),
  1001: plan(1001, 'frost-missile'),
  1002: plan(1002, 'ball-lightning'),
  1003: plan(1003, 'flame-lash-loop', [157], 33),
  1004: plan(1004, 'blizzard-beam-loop', [160], 44),
  1005: plan(1005, 'steam-jet-loop', [172, 157]),
  1006: plan(1006, 'ethereal-boulder-loop', [159]),
  1007: plan(1007, 'meteor-swarm-loop', [165]),
  1008: plan(1008, 'hailstones-loop', [160, 159]),
  1009: plan(1009, 'crawling-shock'),
}

export interface NativeWeldProjectileState {
  readonly ageTicks: number
  readonly buildId: NativeWeldOneShotBuildId
  readonly charge: 1
  readonly contactsRemaining: number
  readonly damage: number
  readonly direction: Vector2
  readonly flightTicks: number
  readonly headingDegrees: number
  readonly hitTargetIds: readonly string[]
  readonly id: number
  readonly kind: 'weld'
  readonly lightRegistration: NativeLightProviderRegistration
  readonly ownerId: string
  readonly phase: 'flight'
  readonly position: Vector2
  readonly presentationSeed: number | null
  readonly projectileIndex: number
  readonly speed: number
  readonly targetId: string | null
  readonly turnAccumulator: number
  readonly turnInput: number
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
  readonly lightRegistration?: null
  readonly origin: Vector2
  readonly ownerId: string
  readonly vector: readonly number[]
  readonly worldKey: string
}

export interface NativeWeldChannelActorState extends NativeWeldOwnedActorBase {
  readonly buildId: NativeWeldChannelBuildId
  readonly kind: 'weld-channel'
  readonly targetId: string | null
  readonly variant: number
}

export interface NativeWeldPersistentActorState extends NativeWeldOwnedActorBase {
  readonly buildId: NativeWeldPersistentBuildId
  readonly kind: 'weld-persistent'
  readonly pulseSequence: number
}

export interface NativeWeldMeteorActorState extends NativeWeldOwnedActorBase {
  readonly buildId: 1007
  readonly damage: number
  readonly fallScalar: number
  readonly impactDue: boolean
  readonly impactTicksRemaining: number
  readonly kind: 'weld-meteor'
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
  const quantity = profile.buildId === 1009 ? 3 : Math.round(profile.vector.values[3]!)
  let groundSparkMotionScale = 1
  if (profile.buildId === 1009) {
    const draw = drawNativeFloat(rng, Math.fround(0.05))
    rng = draw.state
    groundSparkMotionScale = Math.fround(1 + draw.value)
  }
  const projectiles: NativeWeldProjectileState[] = []
  for (let index = 0; index < quantity; index += 1) {
    const headingDegrees = profile.buildId === 1009
      ? normalizeDegrees(aimHeading + (index === 0 ? 0 : index === 1 ? -30 : 30))
      : nativeWeldMissileFanHeading(aimHeading, quantity, index)
    const direction = directionFromHeading(headingDegrees)
    const speedFactor = profile.buildId === 1009
      ? Math.fround(profile.vector.values[5]! * groundSparkMotionScale)
      : profile.vector.values[4]!
    const speed = Math.fround(3 * speedFactor)
    const target = profile.buildId === 1009
      ? null
      : selectEtherPrimaryTarget({
          aimDirection: direction,
          origin: input.origin,
          targets: input.targets,
        })
    let presentationSeed: number | null = null
    if (profile.buildId === 1000) {
      const seed = drawNativeInteger(rng, 100_000)
      rng = seed.state
      presentationSeed = seed.value
    }
    projectiles.push(Object.freeze({
      ageTicks: 0,
      buildId: profile.buildId,
      charge: 1,
      contactsRemaining: profile.buildId === 1009
        ? Math.round(profile.vector.values[4]!) + 1
        : 1,
      damage: damage.value,
      direction,
      flightTicks: 0,
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
      position: Object.freeze(profile.buildId === 1009
        ? { x: input.origin.x, y: Math.fround(input.origin.y + 15) }
        : { ...input.origin }),
      presentationSeed,
      projectileIndex: index,
      speed,
      targetId: target?.id ?? null,
      turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
      turnInput: profile.buildId === 1009
        ? 0
        : Math.fround(
            2 * profile.vector.values[4]! * 0.75 ** Math.ceil(index / 2),
          ),
      vector: Object.freeze([...profile.vector.values]),
      velocity: Object.freeze({ x: direction.x * speed, y: direction.y * speed }),
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
    return Object.freeze({
      ...projectile,
      ageTicks: projectile.ageTicks + 1,
      flightTicks: projectile.flightTicks + 1,
      position,
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
  const advanced = advanceEtherPrimaryHoming({
    headingDegrees: projectile.headingDegrees,
    movementScalar: 1,
    position: projectile.position,
    speed: projectile.speed,
    targetPosition: target?.position ?? null,
    turnAccumulator: projectile.turnAccumulator,
    turnInput: projectile.turnInput,
  })
  return Object.freeze({
    ...projectile,
    ageTicks: projectile.ageTicks + 1,
    direction: advanced.direction,
    flightTicks: projectile.flightTicks + 1,
    headingDegrees: advanced.headingDegrees,
    position: advanced.position,
    targetId: target?.id ?? null,
    turnAccumulator: advanced.turnAccumulator,
    velocity: Object.freeze({
      x: advanced.direction.x * projectile.speed,
      y: advanced.direction.y * projectile.speed,
    }),
  })
}

export function createNativeWeldChannelActor(input: {
  readonly buildId: NativeWeldChannelBuildId
  readonly direction: Vector2
  readonly id: number
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
    id: input.id,
    kind: 'weld-channel',
    lightRegistration: null,
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
  readonly tick: number
  readonly vector: readonly number[]
  readonly worldKey: string
}): NativeWeldPersistentActorState {
  return Object.freeze({
    ageTicks: 0,
    birthTick: input.tick,
    buildId: input.buildId,
    direction: Object.freeze({ ...input.direction }),
    id: input.id,
    kind: 'weld-persistent',
    lightRegistration: null,
    origin: Object.freeze({ ...input.origin }),
    ownerId: input.ownerId,
    pulseSequence: 0,
    vector: Object.freeze([...input.vector]),
    worldKey: input.worldKey,
  })
}

export function updateNativeWeldPersistentActor(
  actor: NativeWeldPersistentActorState,
  origin: Vector2,
  direction: Vector2,
): NativeWeldPersistentActorState {
  return Object.freeze({
    ...actor,
    ageTicks: actor.ageTicks + 1,
    direction: Object.freeze({ ...direction }),
    origin: Object.freeze({ ...origin }),
    pulseSequence: actor.pulseSequence + 1,
  })
}

export function createNativeWeldMeteor(input: {
  readonly damage: number
  readonly direction: Vector2
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly presentationPhase: number
  readonly privateSeed: number
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
    fallScalar: Math.fround(1 + input.presentationPhase),
    id: input.id,
    impactDue: false,
    impactTicksRemaining: NATIVE_WELD_METEOR_IMPACT_TICKS,
    kind: 'weld-meteor',
    lightRegistration: null,
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
  return actor
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
  nativeLoopIds: readonly number[] = [],
  startCueId: number | null = null,
): NativeWeldAudioPlan {
  return Object.freeze({
    buildId,
    cue,
    loop: nativeLoopIds.length > 0,
    nativeLoopIds: Object.freeze([...nativeLoopIds]),
    startCueId,
  })
}

function normalizeDegrees(value: number): number {
  return Math.fround(((value % 360) + 360) % 360)
}
