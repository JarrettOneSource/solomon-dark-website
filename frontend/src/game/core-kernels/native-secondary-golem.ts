import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_GOLEM_RADIUS = 30
export const NATIVE_GOLEM_PLACEMENT_RADIUS = 25
export const NATIVE_GOLEM_REFLECT_DISTANCE_SQUARED = 6_400
export const NATIVE_GOLEM_DEATH_DURATION_TICKS = 134
export const NATIVE_GOLEM_DEATH_PRESENTATION_RNG_DRAWS = 273

const TARGET_DISTANCE_SQUARED = 999_999
const TARGET_POLL_TICKS = 50
const ORBIT_DISTANCE = 80
const ATTACK_REACH_PADDING = 20
const ATTACK_IMPACT_TICK = 37
const ATTACK_DURATION_MAXIMUM = 90
const ATTACK_DURATION_RANDOM_COUNT = 20
const KNOCKBACK_RANGE = 50
const KNOCKBACK_ARC_DEGREES = 90
const KNOCKBACK_IMPULSE = 120
const PROVOKE_ROLL_MAXIMUM = 70
const POST_ATTACK_PROVOKE_ROLL_BOUND = 75
const PROVOKE_ROLL_BOUND = 1_200
const PROVOKE_DURATION_TICKS = 151
const MOVEMENT_PER_TICK = 0.5

export type NativeGolemPhase = 'active' | 'assembly' | 'attack' | 'provoke'

export interface NativeSecondaryGolemState {
  readonly actionHeadingOffsetDegrees: number
  readonly actionDurationTicks: number
  readonly actionTick: number
  readonly currentHealth: number
  readonly damageMaximum: number
  readonly iron: boolean
  readonly gaitTick: number
  readonly leftConnectorOffset: Vector2
  readonly leftFoot: Vector2
  readonly leftFootBob: Vector2
  readonly leftFootNext: Vector2
  readonly leftFootPrevious: Vector2
  readonly leftFootProgress: number
  readonly leftFootRotationDegrees: number
  readonly leftLimbMode: number
  readonly maximumHealth: number
  readonly orbitDirection: number
  readonly orbitHeadingRadians: number | null
  readonly phase: NativeGolemPhase
  readonly poseVariant: 0 | 1
  readonly provokeRollBound: number
  readonly reflectFactor: number
  readonly rightConnectorOffset: Vector2
  readonly rightFoot: Vector2
  readonly rightFootBob: Vector2
  readonly rightFootNext: Vector2
  readonly rightFootPrevious: Vector2
  readonly rightFootProgress: number
  readonly rightFootRotationDegrees: number
  readonly rightLimbMode: number
  readonly targetPollTicksRemaining: number
}

export interface NativeGolemKernelActor {
  readonly ageTicks: number
  readonly damageMinimum: number
  readonly golem: NativeSecondaryGolemState
  readonly id: number
  readonly ownerId: string
  readonly position: Vector2
  readonly rotationRadians: number
  readonly targetId: number | null
}

export interface NativeGolemKernelTarget {
  readonly id: number
  readonly position: Vector2
  readonly radius: number
}

export interface NativeGolemContact {
  readonly damage: number
  readonly impulse: number
  readonly targetIds: readonly number[]
}

export interface NativeGolemKernelStepResult {
  readonly actor: NativeGolemKernelActor
  readonly assemblyMilestone: NativeGolemAssemblyMilestone | null
  readonly contact: NativeGolemContact | null
  readonly footstep: boolean
  readonly provokeStarted: boolean
  readonly rng: NativeRngState
}

export type NativeGolemAssemblyMilestone = 0 | 50 | 100 | 200

export function nativeInitialGolemArticulation(
  position: Vector2,
  rotationRadians: number,
  resolveFootTarget: (current: Vector2, requested: Vector2) => Vector2 = (_current, requested) => requested,
): Pick<
  NativeSecondaryGolemState,
  | 'actionHeadingOffsetDegrees'
  | 'gaitTick'
  | 'leftConnectorOffset'
  | 'leftFoot'
  | 'leftFootBob'
  | 'leftFootNext'
  | 'leftFootPrevious'
  | 'leftFootProgress'
  | 'leftFootRotationDegrees'
  | 'leftLimbMode'
  | 'rightConnectorOffset'
  | 'rightFoot'
  | 'rightFootBob'
  | 'rightFootNext'
  | 'rightFootPrevious'
  | 'rightFootProgress'
  | 'rightFootRotationDegrees'
  | 'rightLimbMode'
> {
  const leftRequested = nativeGolemFootTarget(position, rotationRadians, 0, -19)
  const rightRequested = nativeGolemFootTarget(position, rotationRadians, 1, -19)
  const leftFoot = resolveFootTarget(position, leftRequested)
  const rightFoot = resolveFootTarget(position, rightRequested)
  return {
    actionHeadingOffsetDegrees: 0,
    gaitTick: 0,
    leftConnectorOffset: { x: 0, y: 0 },
    leftFoot,
    leftFootBob: { x: 0, y: 0 },
    leftFootNext: { ...leftFoot },
    leftFootPrevious: { ...leftFoot },
    leftFootProgress: 1,
    leftFootRotationDegrees: 0,
    leftLimbMode: 0,
    rightConnectorOffset: { x: 0, y: 0 },
    rightFoot,
    rightFootBob: { x: 0, y: 0 },
    rightFootNext: { ...rightFoot },
    rightFootPrevious: { ...rightFoot },
    rightFootProgress: 1,
    rightFootRotationDegrees: 0,
    rightLimbMode: 0,
  }
}

export function stepNativeSecondaryGolem(
  source: NativeGolemKernelActor,
  context: Readonly<{
    ownerPosition: Vector2 | null
    resolveFootTarget?: (current: Vector2, requested: Vector2) => Vector2
    resolveMovement: (requestedPosition: Vector2) => Vector2
    rng: NativeRngState
    targets: readonly NativeGolemKernelTarget[]
  }>,
): NativeGolemKernelStepResult {
  const resolveFootTarget = context.resolveFootTarget
    ?? ((_current: Vector2, requested: Vector2) => requested)
  const assembling = source.ageTicks < 201
  let actor: NativeGolemKernelActor = {
    ...source,
    ageTicks: source.ageTicks + (assembling ? 2 : 1),
    golem: {
      ...source.golem,
      phase: assembling
        ? 'assembly'
        : source.golem.phase === 'assembly'
          ? 'active'
          : source.golem.phase,
    },
  }
  const assemblyMilestone: NativeGolemAssemblyMilestone | null = assembling && (
    source.ageTicks === 0
    || source.ageTicks === 50
    || source.ageTicks === 100
    || source.ageTicks === 200
  ) ? source.ageTicks : null
  if (assembling) {
    const leftFoot = resolveFootTarget(
      actor.golem.leftFoot,
      nativeGolemFootTarget(actor.position, actor.rotationRadians, 0, 0),
    )
    const rightFoot = resolveFootTarget(
      actor.golem.rightFoot,
      nativeGolemFootTarget(actor.position, actor.rotationRadians, 1, 0),
    )
    actor = withGolem(actor, {
      ...actor.golem,
      leftFoot,
      leftFootBob: { x: 0, y: 0 },
      rightFoot,
      rightFootBob: { x: 0, y: 0 },
    })
    return {
      actor,
      assemblyMilestone,
      contact: null,
      footstep: false,
      provokeStarted: false,
      rng: context.rng,
    }
  }

  let rng = context.rng
  if (actor.golem.phase === 'provoke') {
    const actionTick = actor.golem.actionTick + 1
    if (actionTick < actor.golem.actionDurationTicks) {
      return result(actor, {
        ...actor.golem,
        actionTick,
      }, rng, resolveFootTarget)
    }
    actor = withGolem(actor, {
      ...actor.golem,
      actionDurationTicks: 0,
      actionTick: 0,
      phase: 'active',
    })
  }

  if (actor.golem.phase === 'attack') {
    const actionTick = actor.golem.actionTick + 1
    let contact: NativeGolemContact | null = null
    if (actionTick === ATTACK_IMPACT_TICK) {
      const damageDraw = drawNativeFloat(
        rng,
        actor.golem.damageMaximum - actor.damageMinimum,
      )
      rng = damageDraw.state
      const targetIds = nativeGolemContactTargets(actor, context.targets)
      if (targetIds.length > 0) {
        contact = Object.freeze({
          damage: actor.damageMinimum + damageDraw.value,
          impulse: KNOCKBACK_IMPULSE,
          targetIds,
        })
      }
    }
    if (actionTick < actor.golem.actionDurationTicks) {
      return activeResult(
        withGolem(actor, { ...actor.golem, actionTick }),
        rng,
        contact,
        false,
        resolveFootTarget,
      )
    }
    actor = withGolem(actor, {
      ...actor.golem,
      actionDurationTicks: 0,
      actionTick: 0,
      phase: 'active',
      provokeRollBound: POST_ATTACK_PROVOKE_ROLL_BOUND,
    })
    const provoked = maybeStartProvoke(actor, rng)
    return activeResult(
      provoked.actor,
      provoked.rng,
      contact,
      provoked.started,
      resolveFootTarget,
    )
  }

  const eligibleTargets = context.targets.filter(({ position }) => (
    squaredDistance(position, actor.position) < TARGET_DISTANCE_SQUARED
  ))
  let target = eligibleTargets.find(({ id }) => id === actor.targetId) ?? null
  let targetPollTicksRemaining = actor.golem.targetPollTicksRemaining
  if (target === null) {
    targetPollTicksRemaining -= 1
    if (targetPollTicksRemaining < 1) {
      target = nearestTarget(actor.position, eligibleTargets)
      targetPollTicksRemaining = TARGET_POLL_TICKS
    }
  }
  actor = {
    ...actor,
    golem: { ...actor.golem, targetPollTicksRemaining },
    targetId: target?.id ?? null,
  }

  if (target !== null) {
    const distance = Math.hypot(
      target.position.x - actor.position.x,
      target.position.y - actor.position.y,
    )
    if (distance < target.radius + NATIVE_GOLEM_RADIUS + ATTACK_REACH_PADDING) {
      const durationDraw = drawNativeInteger(rng, ATTACK_DURATION_RANDOM_COUNT)
      return activeResult(
        {
          ...actor,
          golem: {
            ...actor.golem,
            actionDurationTicks: ATTACK_DURATION_MAXIMUM - durationDraw.value,
            actionTick: 0,
            phase: 'attack',
            poseVariant: (1 - actor.golem.poseVariant) as 0 | 1,
          },
          rotationRadians: nativeHeading(actor.position, target.position),
        },
        durationDraw.state,
        null,
        false,
        resolveFootTarget,
      )
    }
  }

  let desired = target?.position ?? null
  if (desired === null && context.ownerPosition !== null) {
    let orbitHeadingRadians = actor.golem.orbitHeadingRadians
    let orbitDirection = actor.golem.orbitDirection
    if (squaredDistance(actor.position, context.ownerPosition) > 90 * 90) {
      orbitHeadingRadians = null
    }
    if (orbitHeadingRadians === null) {
      orbitHeadingRadians = nativeHeading(context.ownerPosition, actor.position)
      const directionDraw = drawNativeFloat(rng, 1, true)
      rng = directionDraw.state
      orbitDirection = directionDraw.value
    }
    desired = {
      x: context.ownerPosition.x + Math.sin(orbitHeadingRadians) * ORBIT_DISTANCE,
      y: context.ownerPosition.y - Math.cos(orbitHeadingRadians) * ORBIT_DISTANCE,
    }
    if (squaredDistance(actor.position, desired) < 20 * 20) {
      orbitHeadingRadians = normalizeRadians(
        orbitHeadingRadians + orbitDirection * ATTACK_REACH_PADDING * Math.PI / 180,
      )
    }
    actor = withGolem(actor, {
      ...actor.golem,
      orbitDirection,
      orbitHeadingRadians,
    })
  }

  if (desired !== null) {
    const dx = desired.x - actor.position.x
    const dy = desired.y - actor.position.y
    const distance = Math.hypot(dx, dy)
    if (distance > 0) {
      const requestedPosition = {
        x: actor.position.x + dx / distance * MOVEMENT_PER_TICK,
        y: actor.position.y + dy / distance * MOVEMENT_PER_TICK,
      }
      const position = context.resolveMovement(requestedPosition)
      actor = {
        ...actor,
        position: { ...position },
        rotationRadians: nativeHeading(actor.position, position),
      }
    }
  }

  const provoked = maybeStartProvoke(actor, rng)
  return activeResult(
    provoked.actor,
    provoked.rng,
    null,
    provoked.started,
    resolveFootTarget,
  )
}

export function damageNativeSecondaryGolem(
  actor: NativeGolemKernelActor,
  damage: Readonly<{
    primaryDamage: number
    reflectablePhysicalSourceInRange: boolean
    secondaryDamage: number
  }>,
): Readonly<{
  actor: NativeGolemKernelActor | null
  ignored: boolean
  killed: boolean
  reflectedDamage: number
}> {
  if (!Number.isFinite(damage.primaryDamage) || damage.primaryDamage < 0) {
    throw new RangeError('Golem incoming primary damage must be finite and non-negative')
  }
  if (!Number.isFinite(damage.secondaryDamage) || damage.secondaryDamage < 0) {
    throw new RangeError('Golem incoming secondary damage must be finite and non-negative')
  }
  if (actor.ageTicks < 400) {
    return { actor, ignored: true, killed: false, reflectedDamage: 0 }
  }
  const currentHealth = actor.golem.currentHealth
    - damage.primaryDamage
    - damage.secondaryDamage
  const killed = currentHealth <= 0
  return {
    actor: killed
      ? null
      : withGolem(actor, { ...actor.golem, currentHealth }),
    ignored: false,
    killed,
    reflectedDamage: damage.reflectablePhysicalSourceInRange
      ? damage.primaryDamage * actor.golem.reflectFactor
      : 0,
  }
}

/**
 * Golem::DeathEffect 0x00619730 consumes the full visual construction stream:
 * 30 shuffle draws, seven draws for each of 30 rock bouncers, then three
 * draws for the unbind star. Presentation replays from the pre-consumption
 * state while simulation advances past all 273 draws.
 */
export function consumeNativeGolemDeathPresentationRng(
  source: NativeRngState,
): NativeRngState {
  let rng = source
  for (let index = 0; index < 30; index += 1) rng = drawNativeInteger(rng, 30).state
  for (let index = 0; index < 30; index += 1) {
    rng = drawNativeFloat(rng, 3).state
    rng = drawNativeFloat(rng, 20).state
    rng = drawNativeFloat(rng, 360).state
    rng = drawNativeFloat(rng, 10).state
    rng = drawNativeFloat(rng, 1).state
    rng = drawNativeFloat(rng, 10).state
    rng = drawNativeFloat(rng, 20, true).state
  }
  rng = drawNativeFloat(rng, 360).state
  rng = drawNativeFloat(rng, 5).state
  rng = drawNativeInteger(rng, 10).state
  return rng
}

function maybeStartProvoke(
  actor: NativeGolemKernelActor,
  rng: NativeRngState,
): Readonly<{ actor: NativeGolemKernelActor; rng: NativeRngState; started: boolean }> {
  const provoke = drawNativeInteger(rng, actor.golem.provokeRollBound)
  if (provoke.value !== PROVOKE_ROLL_MAXIMUM
    && actor.golem.provokeRollBound !== 0) {
    return { actor, rng: provoke.state, started: false }
  }
  return {
    actor: withGolem(actor, {
      ...actor.golem,
      actionDurationTicks: PROVOKE_DURATION_TICKS,
      actionTick: 0,
      phase: 'provoke',
      provokeRollBound: PROVOKE_ROLL_BOUND,
    }),
    rng: provoke.state,
    started: true,
  }
}

function nativeGolemContactTargets(
  actor: NativeGolemKernelActor,
  targets: readonly NativeGolemKernelTarget[],
): readonly number[] {
  const direction = {
    x: Math.sin(actor.rotationRadians),
    y: -Math.cos(actor.rotationRadians),
  }
  const origin = {
    x: actor.position.x + direction.x * ATTACK_REACH_PADDING,
    y: actor.position.y + direction.y * ATTACK_REACH_PADDING,
  }
  const minimumDot = Math.cos(KNOCKBACK_ARC_DEGREES * Math.PI / 360)
  return Object.freeze(targets.filter((target) => {
    const dx = target.position.x - origin.x
    const dy = target.position.y - origin.y
    const distance = Math.hypot(dx, dy)
    if (distance > KNOCKBACK_RANGE + target.radius) return false
    if (distance === 0) return true
    return (dx / distance) * direction.x + (dy / distance) * direction.y >= minimumDot
  }).map(({ id }) => id))
}

function advanceGolemArticulation(
  source: NativeGolemKernelActor,
  sourceRng: NativeRngState,
  resolveFootTarget: (current: Vector2, requested: Vector2) => Vector2,
): Readonly<{
  actor: NativeGolemKernelActor
  footstep: boolean
  rng: NativeRngState
}> {
  const gaitTick = source.golem.gaitTick + 1
  let rng = sourceRng
  let footstep = false
  let leftRotationDegrees = source.golem.leftFootRotationDegrees
  let rightRotationDegrees = source.golem.rightFootRotationDegrees

  const advanceFoot = (
    side: 0 | 1,
    current: Vector2,
    previous: Vector2,
    next: Vector2,
    sourceProgress: number,
  ): Readonly<{
    current: Vector2
    next: Vector2
    previous: Vector2
    progress: number
  }> => {
    let footPrevious = previous
    let footNext = next
    let progress = sourceProgress
    if (gaitTick % 100 === side * 50) {
      footPrevious = { ...current }
      footNext = resolveFootTarget(
        current,
        nativeGolemFootTarget(
          source.position,
          source.rotationRadians,
          side,
          -19,
        ),
      )
      progress = 0
    }
    if (progress < 1) {
      const advanced = Math.fround(
        Math.fround(progress + Math.fround(0.015)) * Math.fround(1.06),
      )
      if (advanced > 1) {
        footstep = true
        const pitch = drawNativeFloat(rng, 0.1)
        const leftRotation = drawNativeFloat(pitch.state, 8, true)
        const rightRotation = drawNativeFloat(leftRotation.state, 8, true)
        rng = rightRotation.state
        leftRotationDegrees = leftRotation.value
        rightRotationDegrees = rightRotation.value
      }
      progress = Math.min(1, advanced)
    }
    return {
      current: {
        x: Math.fround(footPrevious.x + progress * (footNext.x - footPrevious.x)),
        y: Math.fround(footPrevious.y + progress * (footNext.y - footPrevious.y)),
      },
      next: footNext,
      previous: footPrevious,
      progress,
    }
  }

  const left = advanceFoot(
    0,
    source.golem.leftFoot,
    source.golem.leftFootPrevious,
    source.golem.leftFootNext,
    source.golem.leftFootProgress,
  )
  const right = advanceFoot(
    1,
    source.golem.rightFoot,
    source.golem.rightFootPrevious,
    source.golem.rightFootNext,
    source.golem.rightFootProgress,
  )
  const bob = Math.fround(
    -Math.sin(gaitTick * 3.6 * Math.PI / 180) * 3,
  )
  return {
    actor: withGolem(source, nativeGolemPoseState({
      ...source.golem,
      gaitTick,
      leftFoot: left.current,
      leftFootBob: { x: 0, y: bob },
      leftFootNext: left.next,
      leftFootPrevious: left.previous,
      leftFootProgress: left.progress,
      leftFootRotationDegrees: leftRotationDegrees,
      rightFoot: right.current,
      rightFootBob: { x: 0, y: bob },
      rightFootNext: right.next,
      rightFootPrevious: right.previous,
      rightFootProgress: right.progress,
      rightFootRotationDegrees: rightRotationDegrees,
    })),
    footstep,
    rng,
  }
}

function nativeGolemPoseState(
  source: NativeSecondaryGolemState,
): NativeSecondaryGolemState {
  if (source.phase === 'attack') {
    const selectedLeft = source.poseVariant === 0
    if (source.actionTick <= ATTACK_IMPACT_TICK) {
      return {
        ...source,
        actionHeadingOffsetDegrees: source.actionTick < 25
          ? selectedLeft ? -38 : 38
          : 0,
        leftConnectorOffset: { x: 0, y: 0 },
        leftLimbMode: selectedLeft ? 1 : 0,
        rightConnectorOffset: { x: 0, y: 0 },
        rightLimbMode: selectedLeft ? 0 : 1,
      }
    }
    return {
      ...source,
      actionHeadingOffsetDegrees: selectedLeft ? 47 : -47,
      leftConnectorOffset: { x: 0, y: 0 },
      leftLimbMode: selectedLeft ? 2 : 1,
      rightConnectorOffset: { x: 0, y: 0 },
      rightLimbMode: selectedLeft ? 1 : 2,
    }
  }
  if (source.phase === 'provoke' && source.actionTick > 100) {
    return {
      ...source,
      actionHeadingOffsetDegrees: 0,
      leftConnectorOffset: { x: 0, y: -12 },
      leftLimbMode: 3,
      rightConnectorOffset: { x: 0, y: -12 },
      rightLimbMode: 3,
    }
  }
  return {
    ...source,
    actionHeadingOffsetDegrees: 0,
    leftConnectorOffset: { x: 0, y: 0 },
    leftLimbMode: 0,
    rightConnectorOffset: { x: 0, y: 0 },
    rightLimbMode: 0,
  }
}

function nativeGolemFootTarget(
  position: Vector2,
  rotationRadians: number,
  side: 0 | 1,
  forward: number,
): Vector2 {
  const full = Math.PI * 2
  const normalized = (rotationRadians % full + full) % full
  const facing = Math.round(normalized / full * 16) % 16
  const radians = facing * full / 16
  const forwardX = Math.sin(radians)
  const forwardY = -Math.cos(radians)
  const lateralX = forwardY
  const lateralY = -forwardX
  const lateral = side === 0 ? -10 : 10
  return {
    x: Math.fround(position.x + forwardX * forward + lateralX * lateral),
    y: Math.fround(position.y + forwardY * forward + lateralY * lateral),
  }
}

function nearestTarget(
  origin: Vector2,
  targets: readonly NativeGolemKernelTarget[],
): NativeGolemKernelTarget | null {
  let nearest: NativeGolemKernelTarget | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const target of targets) {
    const distance = squaredDistance(origin, target.position)
    if (distance >= nearestDistance) continue
    nearest = target
    nearestDistance = distance
  }
  return nearest
}

function nativeHeading(origin: Vector2, target: Vector2): number {
  return normalizeRadians(Math.atan2(target.x - origin.x, -(target.y - origin.y)))
}

function normalizeRadians(radians: number): number {
  const full = Math.PI * 2
  return (radians % full + full) % full
}

function squaredDistance(left: Vector2, right: Vector2): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function withGolem(
  actor: NativeGolemKernelActor,
  golem: NativeSecondaryGolemState,
): NativeGolemKernelActor {
  return { ...actor, golem }
}

function result(
  actor: NativeGolemKernelActor,
  golem: NativeSecondaryGolemState,
  rng: NativeRngState,
  resolveFootTarget: (current: Vector2, requested: Vector2) => Vector2,
): NativeGolemKernelStepResult {
  return activeResult(withGolem(actor, golem), rng, null, false, resolveFootTarget)
}

function activeResult(
  source: NativeGolemKernelActor,
  sourceRng: NativeRngState,
  contact: NativeGolemContact | null,
  provokeStarted: boolean,
  resolveFootTarget: (current: Vector2, requested: Vector2) => Vector2,
): NativeGolemKernelStepResult {
  const articulated = advanceGolemArticulation(source, sourceRng, resolveFootTarget)
  return {
    actor: articulated.actor,
    assemblyMilestone: null,
    contact,
    footstep: articulated.footstep,
    provokeStarted,
    rng: articulated.rng,
  }
}
