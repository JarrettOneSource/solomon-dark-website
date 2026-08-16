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
  readonly actionDurationTicks: number
  readonly actionTick: number
  readonly currentHealth: number
  readonly damageMaximum: number
  readonly iron: boolean
  readonly maximumHealth: number
  readonly orbitDirection: number
  readonly orbitHeadingRadians: number | null
  readonly phase: NativeGolemPhase
  readonly poseVariant: 0 | 1
  readonly provokeRollBound: number
  readonly reflectFactor: number
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
  readonly assemblyImpact: boolean
  readonly contact: NativeGolemContact | null
  readonly provokeStarted: boolean
  readonly rng: NativeRngState
}

export function stepNativeSecondaryGolem(
  source: NativeGolemKernelActor,
  context: Readonly<{
    ownerPosition: Vector2 | null
    resolveMovement: (requestedPosition: Vector2) => Vector2
    rng: NativeRngState
    targets: readonly NativeGolemKernelTarget[]
  }>,
): NativeGolemKernelStepResult {
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
  const assemblyImpact = assembling && (
    source.ageTicks === 0
    || source.ageTicks === 50
    || source.ageTicks === 100
    || source.ageTicks === 200
  )
  if (assembling) {
    return {
      actor,
      assemblyImpact,
      contact: null,
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
      }, rng)
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
      return {
        actor: withGolem(actor, { ...actor.golem, actionTick }),
        assemblyImpact: false,
        contact,
        provokeStarted: false,
        rng,
      }
    }
    actor = withGolem(actor, {
      ...actor.golem,
      actionDurationTicks: 0,
      actionTick: 0,
      phase: 'active',
      provokeRollBound: POST_ATTACK_PROVOKE_ROLL_BOUND,
    })
    const provoked = maybeStartProvoke(actor, rng)
    return {
      actor: provoked.actor,
      assemblyImpact: false,
      contact,
      provokeStarted: provoked.started,
      rng: provoked.rng,
    }
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
      return {
        actor: {
          ...actor,
          golem: {
            ...actor.golem,
            actionDurationTicks: ATTACK_DURATION_MAXIMUM - durationDraw.value,
            actionTick: 0,
            phase: 'attack',
          },
          rotationRadians: nativeHeading(actor.position, target.position),
        },
        assemblyImpact: false,
        contact: null,
        provokeStarted: false,
        rng: durationDraw.state,
      }
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
  return {
    actor: provoked.actor,
    assemblyImpact: false,
    contact: null,
    provokeStarted: provoked.started,
    rng: provoked.rng,
  }
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
): NativeGolemKernelStepResult {
  return {
    actor: withGolem(actor, golem),
    assemblyImpact: false,
    contact: null,
    provokeStarted: false,
    rng,
  }
}
