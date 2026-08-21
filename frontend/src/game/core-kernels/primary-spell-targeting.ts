import { actorHeadingFromVector } from './actor-heading.ts'
import type { Vector2 } from './vector.ts'

export const AIR_PRIMARY_CONE_HALF_ANGLE_DEGREES = 15
export const AIR_PRIMARY_RETAIN_DOT = Math.fround(0.71)
export const AIR_PRIMARY_TARGET_Y_OFFSET = -20
export const ETHER_PRIMARY_PROBE_DISTANCE = 100
export const ETHER_PRIMARY_TARGET_DISTANCE_SQUARED = Math.fround(999_999)
export const ETHER_PRIMARY_INITIAL_TURN = Math.fround(0.01)
export const ETHER_PRIMARY_TURN_INPUT = 2
export const ETHER_PRIMARY_TURN_FAST_STEP = 0.05000000074505806
export const ETHER_PRIMARY_TURN_SLOW_STEP = 0.0020000000949949026
export const ETHER_PRIMARY_TURN_THRESHOLD = 1
export const ETHER_PRIMARY_TURN_CAP = 10
export const NATIVE_PRIMARY_ACTOR_CELL_SIZE = 100
export const NATIVE_PRIMARY_HOSTILE_FLAG = 0x2

const AIR_PRIMARY_CONE_DOT = Math.cos(
  AIR_PRIMARY_CONE_HALF_ANGLE_DEGREES * Math.PI / 180,
)

export type PrimarySpellTargetKind = 'enemy' | 'gravestone' | 'scenery'

/** A live world actor eligible for one or more native primary queries. */
export interface PrimarySpellTarget {
  active: boolean
  actorFlags: number
  attachment: Vector2
  bodyRadius: number
  id: string
  kind: PrimarySpellTargetKind
  nativePriority: number
  pendingRemove: boolean
  position: Vector2
  registrationOrder: number
}

export interface NativePrimaryPointContactQuery {
  actorMask: number
  position: Vector2
  queryRadius: number
  targets: readonly PrimarySpellTarget[]
}

export interface NativePrimaryConeQuery {
  actorMask: number
  aimDirection: Vector2
  halfAngleDegrees: number
  hasLineOfSight: (target: PrimarySpellTarget) => boolean
  origin: Vector2
  reach: number
  targets: readonly PrimarySpellTarget[]
}

export interface AirPrimaryTargetQuery {
  aimDirection: Vector2
  hasLineOfSight: (target: PrimarySpellTarget) => boolean
  maxRange: number
  origin: Vector2
  previousTargetId: string | null
  targets: readonly PrimarySpellTarget[]
}

export interface EtherPrimaryTargetQuery {
  aimDirection: Vector2
  origin: Vector2
  targets: readonly PrimarySpellTarget[]
}

export interface EtherPrimaryHomingInput {
  headingDegrees: number
  movementScalar: number
  position: Vector2
  speed: number
  targetPosition: Vector2 | null
  turnAccumulator: number
  turnInput: number
}

export interface EtherPrimaryHomingResult {
  direction: Vector2
  headingDegrees: number
  position: Vector2
  turnAccumulator: number
}

export function selectAirPrimaryTarget(
  query: AirPrimaryTargetQuery,
): PrimarySpellTarget | null {
  const aim = normalized(query.aimDirection)
  const maxDistanceSquared = query.maxRange * query.maxRange
  let selected: PrimarySpellTarget | null = null
  let selectedDistanceSquared = Number.POSITIVE_INFINITY

  for (const target of nativeBroadphaseOrder(
    query.origin,
    query.maxRange,
    query.targets,
  )) {
    if (!nativePrimaryTargetEligible(target, 0x6)) continue
    const delta = subtract(target.position, query.origin)
    const distanceSquared = squaredLength(delta)
    if (distanceSquared >= maxDistanceSquared || distanceSquared === 0) continue
    const inverseDistance = 1 / Math.sqrt(distanceSquared)
    if ((delta.x * aim.x + delta.y * aim.y) * inverseDistance < AIR_PRIMARY_CONE_DOT) {
      continue
    }
    if (!query.hasLineOfSight(target)) continue
    if (
      selected === null
      || target.nativePriority < selected.nativePriority
      || (
        target.nativePriority === selected.nativePriority
        && distanceSquared < selectedDistanceSquared
      )
    ) {
      selected = target
      selectedDistanceSquared = distanceSquared
    }
  }
  if (selected) return selected

  const previous = query.previousTargetId === null
    ? undefined
    : query.targets.find(({ id }) => id === query.previousTargetId)
  if (!previous || !nativePrimaryTargetEligible(previous, 0x6)) return null
  const retainedDirection = normalized(subtract(previous.position, query.origin))
  return dot(aim, retainedDirection) >= AIR_PRIMARY_RETAIN_DOT ? previous : null
}

export function airPrimaryBoltGeometry(
  source: Vector2,
  aimDirection: Vector2,
  endpoint: Vector2,
): { endpoint: Vector2, midpoint: Vector2, source: Vector2 } {
  const aim = normalized(aimDirection)
  const halfDistance = Math.hypot(
    endpoint.x - source.x,
    endpoint.y - source.y,
  ) * 0.5
  return {
    endpoint: { ...endpoint },
    midpoint: {
      x: source.x + aim.x * halfDistance,
      y: source.y + aim.y * halfDistance,
    },
    source: { ...source },
  }
}

export function primarySpellTargetPoint(target: PrimarySpellTarget): Vector2 {
  return {
    x: target.position.x + target.attachment.x,
    y: target.position.y + target.attachment.y + AIR_PRIMARY_TARGET_Y_OFFSET,
  }
}

export function selectEtherPrimaryTarget(
  query: EtherPrimaryTargetQuery,
): PrimarySpellTarget | null {
  const aim = normalized(query.aimDirection)
  const probe = {
    x: query.origin.x + aim.x * ETHER_PRIMARY_PROBE_DISTANCE,
    y: query.origin.y + aim.y * ETHER_PRIMARY_PROBE_DISTANCE,
  }
  let selected: PrimarySpellTarget | null = null
  let selectedDistanceSquared = ETHER_PRIMARY_TARGET_DISTANCE_SQUARED
  for (const target of nativeBroadphaseOrder(
    probe,
    Math.sqrt(ETHER_PRIMARY_TARGET_DISTANCE_SQUARED),
    query.targets,
  )) {
    if (
      target.kind !== 'enemy'
      || !target.active
      || (target.actorFlags & NATIVE_PRIMARY_HOSTILE_FLAG) === 0
    ) continue
    const distanceSquared = squaredLength(subtract(target.position, probe))
    if (distanceSquared >= selectedDistanceSquared) continue
    selected = target
    selectedDistanceSquared = distanceSquared
  }
  return selected
}

export function firstNativePrimaryPointContact(
  query: NativePrimaryPointContactQuery,
): PrimarySpellTarget | null {
  const cellX = nativeCellCoordinate(query.position.x)
  const cellY = nativeCellCoordinate(query.position.y)
  for (const target of nativeRegistrationOrder(query.targets)) {
    if (!nativePrimaryTargetEligible(target, query.actorMask)) continue
    if (
      nativeCellCoordinate(target.position.x) !== cellX
      || nativeCellCoordinate(target.position.y) !== cellY
    ) continue
    const radius = query.queryRadius + target.bodyRadius
    if (squaredLength(subtract(target.position, query.position)) < radius * radius) {
      return target
    }
  }
  return null
}

export function nativePrimaryConeTargets(
  query: NativePrimaryConeQuery,
): PrimarySpellTarget[] {
  const aim = normalized(query.aimDirection)
  const reachSquared = query.reach * query.reach
  const coneDot = Math.cos(query.halfAngleDegrees * Math.PI / 180)
  return nativeBroadphaseOrder(query.origin, query.reach, query.targets).filter((target) => {
    if (!nativePrimaryTargetEligible(target, query.actorMask)) return false
    const delta = subtract(target.position, query.origin)
    const distanceSquared = squaredLength(delta)
    if (distanceSquared === 0 || distanceSquared >= reachSquared) return false
    if ((delta.x * aim.x + delta.y * aim.y) / Math.sqrt(distanceSquared) < coneDot) {
      return false
    }
    return query.hasLineOfSight(target)
  })
}

export function nativePrimaryRootTargets(
  origin: Vector2,
  reach: number,
  actorMask: number,
  targets: readonly PrimarySpellTarget[],
): PrimarySpellTarget[] {
  const reachSquared = reach * reach
  return nativeBroadphaseOrder(origin, reach, targets).filter((target) => (
    nativePrimaryTargetEligible(target, actorMask)
    && squaredLength(subtract(target.position, origin)) < reachSquared
  ))
}

export function nativePrimaryTargetEligible(
  target: PrimarySpellTarget,
  actorMask: number,
): boolean {
  return target.active
    && !target.pendingRemove
    && (target.actorFlags & actorMask) !== 0
}

export function advanceEtherPrimaryHoming(
  input: EtherPrimaryHomingInput,
): EtherPrimaryHomingResult {
  const heading = normalizeDegrees(Math.fround(input.headingDegrees))
  const oldDirection = directionFromHeading(heading)
  const distance = Math.fround(input.movementScalar * input.speed)
  const position = {
    x: Math.fround(input.position.x + oldDirection.x * distance),
    y: Math.fround(input.position.y + oldDirection.y * distance),
  }
  if (!input.targetPosition) {
    return {
      direction: oldDirection,
      headingDegrees: heading,
      position,
      turnAccumulator: Math.fround(input.turnAccumulator),
    }
  }

  const desired = actorHeadingFromVector(
    input.targetPosition.x - position.x,
    input.targetPosition.y - position.y,
  )
  const turnDirection = nativeHeadingTurnDirection(heading, desired)
  const turnAccumulator = Math.fround(input.turnAccumulator)
  const turn = Math.fround(
    input.turnInput
    * turnAccumulator
    * input.movementScalar
    * turnDirection,
  )
  const headingDegrees = normalizeDegrees(Math.fround(heading + turn))
  const step = turnAccumulator > ETHER_PRIMARY_TURN_THRESHOLD
    ? ETHER_PRIMARY_TURN_SLOW_STEP
    : ETHER_PRIMARY_TURN_FAST_STEP

  return {
    direction: directionFromHeading(headingDegrees),
    headingDegrees,
    position,
    turnAccumulator: Math.min(
      ETHER_PRIMARY_TURN_CAP,
      Math.fround(turnAccumulator + step),
    ),
  }
}

export function nativeHeadingTurnDirection(current: number, desired: number): -1 | 0 | 1 {
  const normalizedCurrent = normalizeDegrees(current)
  const normalizedDesired = normalizeDegrees(desired)
  const gap = Math.abs(normalizedCurrent - normalizedDesired)
  if (gap <= 1 || gap >= 359) return 0
  if (normalizedDesired <= normalizedCurrent) {
    return normalizedCurrent - normalizedDesired <= 180 ? -1 : 1
  }
  return normalizedDesired - normalizedCurrent > 180 ? -1 : 1
}

export function directionFromHeading(headingDegrees: number): Vector2 {
  const radians = headingDegrees * Math.PI / 180
  return { x: Math.sin(radians), y: -Math.cos(radians) }
}

function normalized(vector: Vector2): Vector2 {
  const length = Math.hypot(vector.x, vector.y)
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: -1 }
}

function subtract(left: Vector2, right: Vector2): Vector2 {
  return { x: left.x - right.x, y: left.y - right.y }
}

function squaredLength(vector: Vector2): number {
  return vector.x * vector.x + vector.y * vector.y
}

function dot(left: Vector2, right: Vector2): number {
  return left.x * right.x + left.y * right.y
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

function nativeRegistrationOrder(
  targets: readonly PrimarySpellTarget[],
): PrimarySpellTarget[] {
  return [...targets].sort((left, right) => (
    left.registrationOrder - right.registrationOrder
  ))
}

function nativeBroadphaseOrder(
  origin: Vector2,
  reach: number,
  targets: readonly PrimarySpellTarget[],
): PrimarySpellTarget[] {
  const minX = Math.fround(origin.x - reach)
  const minY = Math.fround(origin.y - reach)
  const diameter = Math.fround(reach + reach)
  const minCellX = nativeCellCoordinate(minX)
  const minCellY = nativeCellCoordinate(minY)
  const maxCellX = nativeCellCoordinate(Math.fround(minX + diameter))
  const maxCellY = nativeCellCoordinate(Math.fround(minY + diameter))
  return targets.filter((target) => {
    const cellX = nativeCellCoordinate(target.position.x)
    const cellY = nativeCellCoordinate(target.position.y)
    return cellX >= minCellX
      && cellX <= maxCellX
      && cellY >= minCellY
      && cellY <= maxCellY
  }).sort((left, right) => {
    const leftCellX = nativeCellCoordinate(left.position.x)
    const rightCellX = nativeCellCoordinate(right.position.x)
    if (leftCellX !== rightCellX) return leftCellX - rightCellX
    const leftCellY = nativeCellCoordinate(left.position.y)
    const rightCellY = nativeCellCoordinate(right.position.y)
    return leftCellY - rightCellY || left.registrationOrder - right.registrationOrder
  })
}

function nativeCellCoordinate(position: number): number {
  return Math.trunc(Math.fround(position / NATIVE_PRIMARY_ACTOR_CELL_SIZE))
}
