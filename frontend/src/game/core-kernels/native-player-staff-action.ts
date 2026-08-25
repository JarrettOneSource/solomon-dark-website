import { actorHeadingFromVector } from './actor-heading.ts'
import { NATIVE_ACTOR_SEPARATION_EPSILON } from './actor-physics.ts'
import {
  advanceNativeRngWords,
  drawNativeFloat,
  drawNativeInteger,
  drawNativeSign,
  type NativeRngState,
} from './native-rng.ts'
import type { WizardElement } from './player-character.ts'
import {
  resolvePlayerStaffAttack,
  type PlayerSkillDerivedStats,
  type PlayerStaffAttackOutcome,
  type PlayerStaffDamageLane,
} from './player-skill-runtime.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_STAFF_ADMISSION_HEADING_DEGREES = 50
export const NATIVE_STAFF_MELEE_MARKER_PROGRESS = 3
export const NATIVE_STAFF_MELEE_END_PROGRESS = 8
export const NATIVE_STAFF_MELEE_BASE_PROGRESS = 0.10000000149011612
export const NATIVE_STAFF_MELEE_ACCELERATION = 1.350000023841858
export const NATIVE_STAFF_SPIN_COUNTDOWN = 360
export const NATIVE_STAFF_SPIN_STEP_DEGREES = 20
export const NATIVE_STAFF_WHIRL_RADIUS = 100
export const NATIVE_STAFF_KNOCKBACK_STEP = 10
export const NATIVE_STAFF_KNOCKBACK_DAZZLE_TICKS = 200
export const NATIVE_STAFF_CONTACT_EVENT_TICKS = 40
export const NATIVE_STAFF_CONTACT_KNOCKBACK_TICKS = 5
export const NATIVE_STAFF_CONTACT_KNOCKBACK_STEP = 6
export const NATIVE_STAFF_PIKE_BREAK_RNG_WORDS = 50
export const NATIVE_STAFF_PIKE_BREAK_LIFETIME_TICKS = 100

const STAFF_MELEE_POSE_PROGRAMS = Object.freeze({
  primary: Object.freeze([0, 4, 5, 6, 6, 6, 6, 6, 6]),
  secondary: Object.freeze([0, 1, 2, 3, 3, 3, 3, 3, 3]),
}) satisfies Readonly<Record<PlayerStaffDamageLane, readonly number[]>>

const STAFF_NORMAL_POLYGON = Object.freeze([
  Object.freeze({ x: -40, y: -70 }),
  Object.freeze({ x: 40, y: -70 }),
  Object.freeze({ x: 30, y: 0 }),
  Object.freeze({ x: -30, y: 0 }),
])
const STAFF_CRITICAL_POLYGON = Object.freeze([
  Object.freeze({ x: -60, y: -105 }),
  Object.freeze({ x: 60, y: -105 }),
  Object.freeze({ x: 45, y: 0 }),
  Object.freeze({ x: -45, y: 0 }),
])

interface NativePlayerStaffActionBase {
  readonly ageTicks: number
  readonly contactSequence: number
  readonly headingDegrees: number
  readonly id: number
  readonly origin: Readonly<Vector2>
  readonly outcome: PlayerStaffAttackOutcome
  readonly ownerId: string
  readonly swooshPitch: number
  readonly worldKey: string
}

export interface NativePlayerStaffMeleeAction extends NativePlayerStaffActionBase {
  readonly actionTimingFactor: number
  readonly baseProgressPerTick: number
  readonly kind: 'player-staff-melee'
  readonly lane: PlayerStaffDamageLane
  readonly progress: number
}

export interface NativePlayerStaffSpinAction extends NativePlayerStaffActionBase {
  readonly countdown: number
  readonly kind: 'player-staff-spin'
  readonly turnSign: -1 | 1
}

export type NativePlayerStaffAction =
  | NativePlayerStaffMeleeAction
  | NativePlayerStaffSpinAction

export type NativeStaffProcSound =
  | 'critical-hit'
  | 'disable-enemy'
  | 'knockback'
  | 'spin-attack'

export interface NativePlayerStaffContactEvent {
  readonly ageTicks: number
  readonly id: number
  readonly kind: 'player-staff-contact'
  readonly impactSoundPitches: readonly number[]
  readonly origin: Readonly<Vector2>
  readonly outcome: PlayerStaffAttackOutcome
  readonly ownerId: string
  readonly procSound: NativeStaffProcSound | null
  readonly procSoundPitches: readonly number[]
  readonly pikeBreakSoundIndexes: readonly number[]
  readonly swooshPitch: number
  readonly targetIds: readonly string[]
  readonly worldKey: string
}

export interface NativePlayerStaffContactKnockback {
  readonly ageTicks: number
  readonly delta: Readonly<Vector2>
  readonly id: number
  readonly kind: 'player-staff-contact-knockback'
  readonly ownerId: string
  readonly remainingTicks: number
  readonly targetId: string
  readonly worldKey: string
}

export interface NativePlayerStaffPikeBreakVfx {
  readonly ageTicks: number
  readonly headingDegrees: number
  readonly id: number
  readonly kind: 'player-staff-pike-break'
  readonly ownerId: string
  readonly position: Readonly<Vector2>
  readonly presentationRng: NativeRngState
  readonly targetId: string
  readonly worldKey: string
}

export interface NativePlayerStaffSmokeVfx {
  readonly ageTicks: number
  readonly alpha: number
  readonly alphaLoss: number
  readonly angularVelocityDegrees: number
  readonly entry: 15
  readonly id: number
  readonly kind: 'player-staff-smoke'
  readonly ownerId: string
  readonly position: Readonly<Vector2>
  readonly rotationDegrees: number
  readonly scale: number
  readonly worldKey: string
}

export interface NativePlayerStaffMoveFadeVfx {
  readonly ageTicks: number
  readonly alpha: number
  readonly alphaLoss: number
  readonly entry: 40 | 45
  readonly id: number
  readonly kind: 'player-staff-move-fade'
  readonly ownerId: string
  readonly position: Readonly<Vector2>
  readonly rotationDegrees: number
  readonly scale: number
  readonly tint: number
  readonly velocity: Readonly<Vector2>
  readonly velocityFactor: number
  readonly worldKey: string
}

export interface NativePlayerStaffPerspectiveVfx {
  readonly ageTicks: number
  readonly alpha: number
  readonly alphaLoss: number
  readonly entry: 88
  readonly id: number
  readonly kind: 'player-staff-perspective-fade'
  readonly ownerId: string
  readonly position: Readonly<Vector2>
  readonly rotationDegrees: number
  readonly scale: number
  readonly tint: number
  readonly worldKey: string
}

export type NativePlayerStaffVfx =
  | NativePlayerStaffSmokeVfx
  | NativePlayerStaffMoveFadeVfx
  | NativePlayerStaffPerspectiveVfx

export interface NativeStaffKnockbackActor {
  readonly ageTicks: number
  readonly arcDegrees: number
  readonly id: number
  readonly kind: 'player-staff-knockback'
  readonly origin: Readonly<Vector2>
  readonly ownerId: string
  readonly remainingDistance: number
  readonly targetIds: readonly string[]
  readonly worldKey: string
}

export type NativePlayerStaffTransient =
  | NativePlayerStaffAction
  | NativePlayerStaffContactEvent
  | NativePlayerStaffContactKnockback
  | NativePlayerStaffPikeBreakVfx
  | NativePlayerStaffVfx
  | NativeStaffKnockbackActor

export function isNativePlayerStaffTransient(
  value: { readonly kind: string },
): value is NativePlayerStaffTransient {
  return value.kind === 'player-staff-melee'
    || value.kind === 'player-staff-spin'
    || value.kind === 'player-staff-contact'
    || value.kind === 'player-staff-contact-knockback'
    || value.kind === 'player-staff-pike-break'
    || value.kind === 'player-staff-smoke'
    || value.kind === 'player-staff-move-fade'
    || value.kind === 'player-staff-perspective-fade'
    || value.kind === 'player-staff-knockback'
}

export interface NativePlayerStaffActionSpawn {
  readonly action: NativePlayerStaffAction
  readonly rng: NativeRngState
}

export interface NativePlayerStaffActionStep {
  readonly action: NativePlayerStaffAction | null
  readonly contact: boolean
  readonly sample: NativePlayerStaffAction
}

export interface NativeStaffTarget {
  readonly collisionRadius: number
  readonly id: string
  readonly position: Readonly<Vector2>
}

export interface NativeStaffPhysicalTarget extends NativeStaffTarget {
  readonly pike: boolean
}

export interface NativeStaffPhysicalImpact {
  readonly contactKnockbackDelta: Readonly<Vector2> | null
  readonly pikeBreakPresentationRng: NativeRngState | null
  readonly soundPitch: number
  readonly targetId: string
  readonly verticalVelocity: number
}

export interface NativeStaffPhysicalContactResult {
  readonly impacts: readonly NativeStaffPhysicalImpact[]
  readonly rng: NativeRngState
}

export interface NativeStaffContactPresentation {
  readonly event: NativePlayerStaffContactEvent
  readonly nextId: number
  readonly rng: NativeRngState
  readonly vfx: readonly NativePlayerStaffVfx[]
}

export interface NativeStaffKnockbackStep {
  readonly actor: NativeStaffKnockbackActor | null
  readonly dazzledTargetIds: readonly string[]
  readonly displacements: readonly Readonly<{
    delta: Readonly<Vector2>
    targetId: string
  }>[]
  readonly headingPerturbations: readonly Readonly<{
    headingDegrees: number
    targetId: string
  }>[]
  readonly rng: NativeRngState
}

export function createNativePlayerStaffAction(
  input: Readonly<{
    derived: PlayerSkillDerivedStats
    headingDegrees: number
    id: number
    lane: PlayerStaffDamageLane
    origin: Readonly<Vector2>
    ownerId: string
    worldKey: string
  }>,
  sourceRng: NativeRngState,
): NativePlayerStaffActionSpawn {
  const attack = resolvePlayerStaffAttack(
    input.derived,
    sourceRng,
  )
  if (attack.outcome === 'whirl') {
    const direction = drawNativeSign(attack.rng, 1)
    return Object.freeze({
      action: Object.freeze({
        ageTicks: 0,
        contactSequence: 0,
        countdown: NATIVE_STAFF_SPIN_COUNTDOWN,
        headingDegrees: normalizedDegrees(input.headingDegrees),
        id: input.id,
        kind: 'player-staff-spin',
        origin: Object.freeze({ ...input.origin }),
        outcome: attack.outcome,
        ownerId: input.ownerId,
        swooshPitch: 1,
        turnSign: direction.value < 0 ? -1 : 1,
        worldKey: input.worldKey,
      }),
      rng: direction.state,
    })
  }

  const jitter = drawNativeFloat(attack.rng, 0.05)
  const acceleration = drawNativeInteger(jitter.state, 8)
  const baseProgressPerTick = Math.fround(
    Math.fround(NATIVE_STAFF_MELEE_BASE_PROGRESS + jitter.value)
      * (acceleration.value === 2 ? NATIVE_STAFF_MELEE_ACCELERATION : 1),
  )
  return Object.freeze({
    action: Object.freeze({
      actionTimingFactor: attack.actionTimingFactor,
      ageTicks: 0,
      baseProgressPerTick,
      contactSequence: 0,
      headingDegrees: normalizedDegrees(input.headingDegrees),
      id: input.id,
      kind: 'player-staff-melee',
      lane: input.lane,
      origin: Object.freeze({ ...input.origin }),
      outcome: attack.outcome,
      ownerId: input.ownerId,
      progress: 0,
      swooshPitch: Math.fround(
        (baseProgressPerTick - NATIVE_STAFF_MELEE_BASE_PROGRESS) + 1,
      ),
      worldKey: input.worldKey,
    }),
    rng: acceleration.state,
  })
}

export function stepNativePlayerStaffAction(
  source: NativePlayerStaffAction,
  ownerPosition: Readonly<Vector2>,
): NativePlayerStaffActionStep {
  if (source.kind === 'player-staff-spin') {
    const countdown = source.countdown - NATIVE_STAFF_SPIN_STEP_DEGREES
    const sample: NativePlayerStaffSpinAction = Object.freeze({
      ...source,
      ageTicks: source.ageTicks + 1,
      contactSequence: source.contactSequence + (countdown <= 0 ? 1 : 0),
      countdown,
      headingDegrees: normalizedDegrees(
        source.headingDegrees + source.turnSign * NATIVE_STAFF_SPIN_STEP_DEGREES,
      ),
      origin: Object.freeze({ ...ownerPosition }),
    })
    return Object.freeze({
      action: countdown <= 0 ? null : sample,
      contact: countdown <= 0,
      sample,
    })
  }

  const progress = Math.fround(
    source.progress + source.baseProgressPerTick * source.actionTimingFactor,
  )
  const contact = source.contactSequence === 0
    && source.progress < NATIVE_STAFF_MELEE_MARKER_PROGRESS
    && progress >= NATIVE_STAFF_MELEE_MARKER_PROGRESS
  const sample: NativePlayerStaffMeleeAction = Object.freeze({
    ...source,
    ageTicks: source.ageTicks + 1,
    contactSequence: source.contactSequence + (contact ? 1 : 0),
    origin: Object.freeze({ ...ownerPosition }),
    progress,
  })
  return Object.freeze({
    action: progress > NATIVE_STAFF_MELEE_END_PROGRESS ? null : sample,
    contact,
    sample,
  })
}

export function nativePlayerStaffActionPose(source: NativePlayerStaffAction): number {
  if (source.kind === 'player-staff-spin') return 3
  const program = STAFF_MELEE_POSE_PROGRAMS[source.lane]
  return program[Math.min(program.length - 1, Math.max(0, Math.floor(source.progress)))]!
}

export function nativeStaffAdmissionTarget(
  player: Readonly<{
    collisionRadius: number
    headingDegrees: number
    position: Readonly<Vector2>
  }>,
  targets: readonly NativeStaffTarget[],
): NativeStaffTarget | null {
  for (const target of targets) {
    const deltaX = target.position.x - player.position.x
    const deltaY = target.position.y - player.position.y
    const reach = player.collisionRadius
      + target.collisionRadius
      + NATIVE_ACTOR_SEPARATION_EPSILON
    if (deltaX * deltaX + deltaY * deltaY > reach * reach) continue
    const targetHeading = actorHeadingFromVector(deltaX, deltaY)
    if (absoluteHeadingDelta(player.headingDegrees, targetHeading)
      < NATIVE_STAFF_ADMISSION_HEADING_DEGREES) return target
  }
  return null
}

export function nativeStaffPhysicalContactTargets<T extends NativeStaffTarget>(
  player: Readonly<{
    collisionRadius: number
    headingDegrees: number
    position: Readonly<Vector2>
  }>,
  targets: readonly T[],
): readonly T[] {
  return Object.freeze(targets.filter((target) => {
    const deltaX = target.position.x - player.position.x
    const deltaY = target.position.y - player.position.y
    const reach = player.collisionRadius
      + target.collisionRadius
      + NATIVE_ACTOR_SEPARATION_EPSILON
    if (deltaX * deltaX + deltaY * deltaY > reach * reach) return false
    return absoluteHeadingDelta(
      player.headingDegrees,
      actorHeadingFromVector(deltaX, deltaY),
    ) < NATIVE_STAFF_ADMISSION_HEADING_DEGREES
  }))
}

export function resolveNativeStaffPhysicalContacts(
  action: NativePlayerStaffAction,
  targets: readonly NativeStaffPhysicalTarget[],
  element: WizardElement,
  etherKnockbackChance: number,
  sourceRng: NativeRngState,
): NativeStaffPhysicalContactResult {
  let rng = sourceRng
  const impacts: NativeStaffPhysicalImpact[] = []
  for (const target of targets) {
    const vertical = drawNativeFloat(rng, 1)
    const pitch = drawNativeFloat(vertical.state, 0.1, true)
    rng = pitch.state
    let contactKnockbackDelta: Readonly<Vector2> | null = null
    let pikeBreakPresentationRng: NativeRngState | null = null
    if (element === 'ether') {
      const chance = drawNativeFloat(rng, 200)
      rng = chance.state
      if (chance.value > 0 && chance.value <= etherKnockbackChance) {
        contactKnockbackDelta = Object.freeze(directionWithMagnitude(
          action.origin,
          target.position,
          NATIVE_STAFF_CONTACT_KNOCKBACK_STEP,
        ))
        if (target.pike) {
          pikeBreakPresentationRng = rng
          rng = advanceNativeRngWords(rng, NATIVE_STAFF_PIKE_BREAK_RNG_WORDS)
        }
      }
    }
    impacts.push(Object.freeze({
      contactKnockbackDelta,
      pikeBreakPresentationRng,
      soundPitch: Math.fround(1 + pitch.value),
      targetId: target.id,
      verticalVelocity: Math.fround(-(1 + vertical.value)),
    }))
  }
  return Object.freeze({ impacts: Object.freeze(impacts), rng })
}

export function nativeStaffDamageTargets<T extends NativeStaffTarget>(
  action: NativePlayerStaffAction,
  targets: readonly T[],
): readonly T[] {
  if (action.outcome === 'whirl') {
    return Object.freeze(targets.filter((target) => circleContains(
      action.origin,
      NATIVE_STAFF_WHIRL_RADIUS,
      target,
    )))
  }
  const polygon = action.outcome === 'critical-hit'
    ? STAFF_CRITICAL_POLYGON
    : STAFF_NORMAL_POLYGON
  return Object.freeze(targets.filter((target) => pointInStaffPolygon(
    action.origin,
    action.headingDegrees,
    target.position,
    polygon,
  )))
}

export function nativeStaffKnockbackTargets<T extends NativeStaffTarget>(
  action: NativePlayerStaffAction,
  targets: readonly T[],
): readonly T[] {
  const arcDegrees = nativeStaffKnockbackArc(action.outcome)
  if (arcDegrees === null) return Object.freeze([])
  if (arcDegrees >= 360) {
    return Object.freeze(targets.filter((target) => circleContains(
      action.origin,
      NATIVE_STAFF_WHIRL_RADIUS,
      target,
    )))
  }
  const radians = action.headingDegrees * Math.PI / 180
  const angleOrigin = {
    x: action.origin.x - Math.sin(radians) * 25,
    y: action.origin.y + Math.cos(radians) * 25,
  }
  return Object.freeze(targets.filter((target) => {
    const dx = target.position.x - action.origin.x
    const dy = target.position.y - action.origin.y
    if (dx * dx + dy * dy >= NATIVE_STAFF_WHIRL_RADIUS ** 2) return false
    const heading = actorHeadingFromVector(
      target.position.x - angleOrigin.x,
      target.position.y - angleOrigin.y,
    )
    return absoluteHeadingDelta(action.headingDegrees, heading) < arcDegrees * 0.5
  }))
}

export function nativeStaffContactDamagePerTarget(
  damage: number,
  targetCount: number,
  radial: boolean,
): number {
  if (!Number.isFinite(damage) || damage < 0) {
    throw new RangeError('staff damage must be finite and non-negative')
  }
  if (!Number.isSafeInteger(targetCount) || targetCount <= 0) {
    throw new RangeError('staff target count must be a positive safe integer')
  }
  return radial ? damage : Math.min(damage, 2 * damage / targetCount)
}

export function createNativeStaffKnockback(
  id: number,
  action: NativePlayerStaffAction,
  targetIds: readonly string[],
  pushStrengthFactor = 1,
): NativeStaffKnockbackActor | null {
  if (!Number.isFinite(pushStrengthFactor) || pushStrengthFactor < 0) {
    throw new RangeError('staff push-strength factor must be finite and non-negative')
  }
  const arcDegrees = nativeStaffKnockbackArc(action.outcome)
  const nativeDistance = nativeStaffKnockbackDistance(action.outcome)
  const remainingDistance = nativeDistance === null
    ? null
    : Math.fround(nativeDistance * pushStrengthFactor)
  return arcDegrees === null || remainingDistance === null
    ? null
    : Object.freeze({
        ageTicks: 0,
        arcDegrees,
        id,
        kind: 'player-staff-knockback',
        origin: Object.freeze({ ...action.origin }),
        ownerId: action.ownerId,
        remainingDistance,
        targetIds: Object.freeze([...targetIds]),
        worldKey: action.worldKey,
      })
}

export function createNativeStaffContactPresentation(
  firstId: number,
  action: NativePlayerStaffAction,
  targetIds: readonly string[],
  targetMean: Readonly<Vector2>,
  elementTint: number,
  sourceRng: NativeRngState,
  impactSoundPitches: readonly number[] = [],
  pikeBreakSoundIndexes: readonly number[] = [],
): NativeStaffContactPresentation {
  let rng = sourceRng
  let nextId = firstId
  let procSound: NativeStaffProcSound | null = null
  let procSoundPitches: readonly number[] = Object.freeze([])
  const vfx: NativePlayerStaffVfx[] = []
  if (targetIds.length > 0) {
    if (action.outcome === 'knockback' || action.outcome === 'critical-hit') {
      const pitch = drawNativeFloat(rng, 0.1, true)
      rng = pitch.state
      procSound = action.outcome === 'knockback' ? 'knockback' : 'critical-hit'
      procSoundPitches = Object.freeze([Math.fround(1 + pitch.value)])
      const smoke = createNativeStaffSmoke(nextId, action, rng)
      nextId += 1
      rng = smoke.rng
      vfx.push(smoke.vfx)
      if (action.outcome === 'critical-hit') {
        vfx.push(createNativeStaffCriticalFade(nextId, action, elementTint))
        nextId += 1
      }
    } else if (action.outcome === 'disabling-hit') {
      procSound = 'disable-enemy'
      procSoundPitches = Object.freeze([1])
      const particles = createNativeStaffDisableParticles(
        nextId,
        action,
        targetMean,
        elementTint,
        rng,
      )
      nextId = particles.nextId
      rng = particles.rng
      vfx.push(...particles.vfx)
    } else if (action.outcome === 'whirl') {
      procSound = 'spin-attack'
      procSoundPitches = Object.freeze([1, Math.fround(0.9), Math.fround(1.1)])
      const rotation = drawNativeFloat(rng, 360)
      rng = rotation.state
      vfx.push(Object.freeze({
        ageTicks: 0,
        alpha: Math.fround(1.25),
        alphaLoss: Math.fround(0.1),
        entry: 88,
        id: nextId,
        kind: 'player-staff-perspective-fade',
        ownerId: action.ownerId,
        position: Object.freeze({ ...action.origin }),
        rotationDegrees: rotation.value,
        scale: 3,
        tint: elementTint,
        worldKey: action.worldKey,
      }))
      nextId += 1
    }
  }
  return Object.freeze({
    event: Object.freeze({
      ageTicks: 0,
      id: nextId,
      impactSoundPitches: Object.freeze([...impactSoundPitches]),
      kind: 'player-staff-contact',
      origin: Object.freeze({ ...action.origin }),
      outcome: action.outcome,
      ownerId: action.ownerId,
      procSound,
      procSoundPitches,
      pikeBreakSoundIndexes: Object.freeze([...pikeBreakSoundIndexes]),
      swooshPitch: action.swooshPitch,
      targetIds: Object.freeze([...targetIds]),
      worldKey: action.worldKey,
    }),
    nextId: nextId + 1,
    rng,
    vfx: Object.freeze(vfx),
  })
}

export function createNativeStaffContactKnockback(
  id: number,
  action: NativePlayerStaffAction,
  targetId: string,
  delta: Readonly<Vector2>,
): NativePlayerStaffContactKnockback {
  return Object.freeze({
    ageTicks: 0,
    delta: Object.freeze({ ...delta }),
    id,
    kind: 'player-staff-contact-knockback',
    ownerId: action.ownerId,
    remainingTicks: NATIVE_STAFF_CONTACT_KNOCKBACK_TICKS,
    targetId,
    worldKey: action.worldKey,
  })
}

export function createNativeStaffPikeBreakVfx(
  id: number,
  action: NativePlayerStaffAction,
  target: NativeStaffTarget,
  presentationRng: NativeRngState,
  headingDegrees: number,
): NativePlayerStaffPikeBreakVfx {
  return Object.freeze({
    ageTicks: 0,
    headingDegrees: normalizedDegrees(headingDegrees),
    id,
    kind: 'player-staff-pike-break',
    ownerId: action.ownerId,
    position: Object.freeze({ ...target.position }),
    presentationRng,
    targetId: target.id,
    worldKey: action.worldKey,
  })
}

export function stepNativeStaffContactKnockback(
  source: NativePlayerStaffContactKnockback,
  targetExists: boolean,
): Readonly<{
  actor: NativePlayerStaffContactKnockback | null
  displacement: Readonly<Vector2> | null
}> {
  if (!targetExists) return Object.freeze({ actor: null, displacement: null })
  const remainingTicks = source.remainingTicks - 1
  return Object.freeze({
    actor: remainingTicks <= 0
      ? null
      : Object.freeze({
          ...source,
          ageTicks: source.ageTicks + 1,
          remainingTicks,
        }),
    displacement: Object.freeze({ ...source.delta }),
  })
}

export function stepNativeStaffPikeBreakVfx(
  source: NativePlayerStaffPikeBreakVfx,
): NativePlayerStaffPikeBreakVfx | null {
  const ageTicks = source.ageTicks + 1
  return ageTicks >= NATIVE_STAFF_PIKE_BREAK_LIFETIME_TICKS
    ? null
    : Object.freeze({ ...source, ageTicks })
}

export function stepNativePlayerStaffVfx(
  source: NativePlayerStaffVfx,
): NativePlayerStaffVfx | null {
  const alpha = Math.fround(source.alpha - source.alphaLoss)
  if (alpha <= 0) return null
  if (source.kind === 'player-staff-smoke') {
    return Object.freeze({
      ...source,
      ageTicks: source.ageTicks + 1,
      alpha,
      rotationDegrees: normalizedDegrees(
        source.rotationDegrees + source.angularVelocityDegrees,
      ),
    })
  }
  if (source.kind === 'player-staff-move-fade') {
    return Object.freeze({
      ...source,
      ageTicks: source.ageTicks + 1,
      alpha,
      position: Object.freeze({
        x: Math.fround(source.position.x + source.velocity.x),
        y: Math.fround(source.position.y + source.velocity.y),
      }),
      velocity: Object.freeze({
        x: Math.fround(source.velocity.x * source.velocityFactor),
        y: Math.fround(source.velocity.y * source.velocityFactor),
      }),
    })
  }
  return Object.freeze({ ...source, ageTicks: source.ageTicks + 1, alpha })
}

export function stepNativeStaffContactEvent(
  source: NativePlayerStaffContactEvent,
): NativePlayerStaffContactEvent | null {
  return source.ageTicks + 1 >= NATIVE_STAFF_CONTACT_EVENT_TICKS
    ? null
    : Object.freeze({ ...source, ageTicks: source.ageTicks + 1 })
}

export function stepNativeStaffKnockback(
  source: NativeStaffKnockbackActor,
  positions: Readonly<Record<string, Readonly<Vector2>>>,
  sourceRng: NativeRngState,
): NativeStaffKnockbackStep {
  const distance = Math.min(source.remainingDistance, NATIVE_STAFF_KNOCKBACK_STEP)
  const displacements = source.targetIds.flatMap((targetId) => {
    const target = positions[targetId]
    if (target === undefined) return []
    const deltaX = target.x - source.origin.x
    const deltaY = target.y - source.origin.y
    const length = Math.hypot(deltaX, deltaY)
    return [{
      delta: Object.freeze(length === 0
        ? { x: 0, y: 0 }
        : { x: deltaX / length * distance, y: deltaY / length * distance }),
      targetId,
    }]
  })
  const remainingDistance = source.remainingDistance - distance
  if (remainingDistance > 0) {
    return Object.freeze({
      actor: Object.freeze({
        ...source,
        ageTicks: source.ageTicks + 1,
        remainingDistance,
      }),
      dazzledTargetIds: Object.freeze([]),
      displacements: Object.freeze(displacements),
      headingPerturbations: Object.freeze([]),
      rng: sourceRng,
    })
  }
  let rng = sourceRng
  const headingPerturbations = source.targetIds.flatMap((targetId) => {
    if (positions[targetId] === undefined) return []
    const heading = drawNativeFloat(rng, 45, true)
    rng = heading.state
    return [{ headingDegrees: heading.value, targetId }]
  })
  return Object.freeze({
    actor: null,
    dazzledTargetIds: Object.freeze(source.targetIds.filter((targetId) => (
      positions[targetId] !== undefined
    ))),
    displacements: Object.freeze(displacements),
    headingPerturbations: Object.freeze(headingPerturbations),
    rng,
  })
}

function createNativeStaffSmoke(
  id: number,
  action: NativePlayerStaffAction,
  sourceRng: NativeRngState,
): Readonly<{ rng: NativeRngState; vfx: NativePlayerStaffSmokeVfx }> {
  const discardedLoss = drawNativeFloat(sourceRng, 0.05)
  const angular = drawNativeFloat(discardedLoss.state, 2)
  const radians = action.headingDegrees * Math.PI / 180
  return Object.freeze({
    rng: angular.state,
    vfx: Object.freeze({
      ageTicks: 0,
      alpha: 1,
      alphaLoss: Math.fround(0.05),
      angularVelocityDegrees: Math.fround((angular.value + 2) / 3),
      entry: 15,
      id,
      kind: 'player-staff-smoke',
      ownerId: action.ownerId,
      position: Object.freeze({
        x: Math.fround(action.origin.x + Math.sin(radians) * 25),
        y: Math.fround(action.origin.y - Math.cos(radians) * 25),
      }),
      rotationDegrees: 0,
      scale: 8,
      worldKey: action.worldKey,
    }),
  })
}

function createNativeStaffDisableParticles(
  firstId: number,
  action: NativePlayerStaffAction,
  targetMean: Readonly<Vector2>,
  tint: number,
  sourceRng: NativeRngState,
): Readonly<{
  nextId: number
  rng: NativeRngState
  vfx: readonly NativePlayerStaffMoveFadeVfx[]
}> {
  const initialAngle = drawNativeFloat(sourceRng, 360)
  let angle = initialAngle.value
  let rng = initialAngle.state
  const vfx: NativePlayerStaffMoveFadeVfx[] = []
  for (let index = 0; index < 50; index += 1) {
    const angleStep = drawNativeInteger(rng, 5)
    const speed = drawNativeFloat(angleStep.state, 3)
    const scale = drawNativeFloat(speed.state, 0.75)
    rng = scale.state
    angle = Math.fround(angle + angleStep.value + 20)
    const radians = angle * Math.PI / 180
    const velocity = {
      x: Math.fround(Math.sin(radians) * (speed.value + 3)),
      y: Math.fround(-Math.cos(radians) * (speed.value + 3)),
    }
    vfx.push(Object.freeze({
      ageTicks: 0,
      alpha: Math.fround(1.5),
      alphaLoss: Math.fround(0.05),
      entry: 45,
      id: firstId + index,
      kind: 'player-staff-move-fade',
      ownerId: action.ownerId,
      position: Object.freeze({
        x: Math.fround(targetMean.x + velocity.x * 3),
        y: Math.fround(targetMean.y + velocity.y * 3),
      }),
      rotationDegrees: angle,
      scale: Math.fround(scale.value + 0.25),
      tint,
      velocity: Object.freeze(velocity),
      velocityFactor: Math.fround(0.92),
      worldKey: action.worldKey,
    }))
  }
  return Object.freeze({ nextId: firstId + 50, rng, vfx: Object.freeze(vfx) })
}

function createNativeStaffCriticalFade(
  id: number,
  action: NativePlayerStaffAction,
  tint: number,
): NativePlayerStaffMoveFadeVfx {
  const radians = action.headingDegrees * Math.PI / 180
  return Object.freeze({
    ageTicks: 0,
    alpha: 2,
    alphaLoss: Math.fround(0.25),
    entry: 40,
    id,
    kind: 'player-staff-move-fade',
    ownerId: action.ownerId,
    position: Object.freeze({ x: action.origin.x, y: action.origin.y - 15 }),
    rotationDegrees: action.headingDegrees,
    scale: 4,
    tint,
    velocity: Object.freeze({
      x: Math.fround(Math.sin(radians) * 5),
      y: Math.fround(-Math.cos(radians) * 5),
    }),
    velocityFactor: 1,
    worldKey: action.worldKey,
  })
}

function nativeStaffKnockbackArc(outcome: PlayerStaffAttackOutcome): number | null {
  if (outcome === 'knockback') return 80
  if (outcome === 'critical-hit') return 60
  if (outcome === 'whirl') return 365
  return null
}

function nativeStaffKnockbackDistance(outcome: PlayerStaffAttackOutcome): number | null {
  if (outcome === 'knockback') return 150
  if (outcome === 'critical-hit' || outcome === 'whirl') return 50
  return null
}

function pointInStaffPolygon(
  origin: Readonly<Vector2>,
  headingDegrees: number,
  point: Readonly<Vector2>,
  polygon: readonly Readonly<Vector2>[],
): boolean {
  const radians = headingDegrees * Math.PI / 180
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  const localX = dx * Math.cos(radians) + dy * Math.sin(radians)
  const localY = -dx * Math.sin(radians) + dy * Math.cos(radians)
  const far = polygon[0]!
  const farRight = polygon[1]!
  const near = polygon[3]!
  if (!(localY > far.y && localY < near.y)) return false
  const progress = (localY - far.y) / (near.y - far.y)
  const halfWidth = farRight.x + (Math.abs(near.x) - farRight.x) * progress
  return Math.abs(localX) < halfWidth
}

function circleContains(
  origin: Readonly<Vector2>,
  radius: number,
  target: NativeStaffTarget,
): boolean {
  const dx = target.position.x - origin.x
  const dy = target.position.y - origin.y
  return dx * dx + dy * dy < radius * radius + target.collisionRadius ** 2
}

function directionWithMagnitude(
  origin: Readonly<Vector2>,
  target: Readonly<Vector2>,
  magnitude: number,
): Vector2 {
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const length = Math.hypot(dx, dy)
  return length === 0
    ? { x: 0, y: 0 }
    : {
        x: Math.fround(dx / length * magnitude),
        y: Math.fround(dy / length * magnitude),
      }
}

function absoluteHeadingDelta(first: number, second: number): number {
  return Math.abs(((second - first + 540) % 360) - 180)
}

function normalizedDegrees(value: number): number {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}
