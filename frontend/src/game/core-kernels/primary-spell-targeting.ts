import { actorHeadingFromVector } from './actor-heading.ts'
import { lineBoundsExitObstruction } from './line-obstruction.ts'
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
export const NATIVE_FIREBALL_HOSTILE_CORRIDOR_HALF_WIDTH = 20
export const NATIVE_FIREBALL_SCENERY_EXCEPTION_DISTANCE_SQUARED = 2
export const NATIVE_MAGIC_MISSILE_BIRTH_TERRAIN_EXCLUSION_MASK = 0x380
export const NATIVE_PRIMARY_FLIGHT_TERRAIN_EXCLUSION_MASK = 0x700
export const NATIVE_PRIMARY_ACTOR_CELL_SIZE = 100
export const NATIVE_PRIMARY_DIRECTIONAL_APEX_OFFSET = 30
export const NATIVE_PRIMARY_HOSTILE_FLAG = 0x2
export const NATIVE_PRIMARY_POLYGON_BROADPHASE_PADDING = 25

const AIR_PRIMARY_CONE_DOT = Math.cos(
  AIR_PRIMARY_CONE_HALF_ANGLE_DEGREES * Math.PI / 180,
)

export type PrimarySpellTargetKind = 'enemy' | 'gravestone' | 'projectile' | 'scenery'

/** A live world actor eligible for one or more native primary queries. */
export interface PrimarySpellTarget {
  active: boolean
  actorFlags: number
  attachment: Vector2
  bodyRadius: number
  cellBindingOrder: number
  headingDeg?: number
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

export interface NativeFireballPointContactQuery extends NativePrimaryPointContactQuery {
  direction: Vector2
  hostileCorridorLength: number
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

export interface NativePrimaryPolygonQuery {
  actorMask: number
  polygon: readonly Readonly<Vector2>[]
  targets: readonly PrimarySpellTarget[]
}

export interface NativePrimaryWorldBounds {
  readonly h: number
  readonly w: number
  readonly x: number
  readonly y: number
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

export interface EtherPrimaryTargetPointQuery {
  excludedTargetId?: string | null
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

export interface EtherPrimaryTrackingInput extends Omit<
  EtherPrimaryHomingInput,
  'targetPosition'
> {
  reacquiresTarget: boolean
  targetId: string | null
  targets: readonly PrimarySpellTarget[]
}

export interface EtherPrimaryTrackingResult extends EtherPrimaryHomingResult {
  reacquiresTarget: boolean
  targetId: string | null
}

export function selectAirPrimaryTarget(
  query: AirPrimaryTargetQuery,
): PrimarySpellTarget | null {
  const aim = normalized(query.aimDirection)
  const angleOrigin = directionalApex(query.origin, aim)
  const maxDistanceSquared = query.maxRange * query.maxRange
  let selected: PrimarySpellTarget | null = null
  let selectedDistanceSquared = Number.POSITIVE_INFINITY

  for (const target of nativeBroadphaseOrder(
    query.origin,
    query.maxRange,
    query.targets,
  )) {
    if (!nativePrimaryTargetEligible(target, 0x6)) continue
    const rangeDelta = subtract(target.position, query.origin)
    const distanceSquared = squaredLength(rangeDelta)
    if (distanceSquared >= maxDistanceSquared || distanceSquared === 0) continue
    const angleDelta = subtract(target.position, angleOrigin)
    const angleDistanceSquared = squaredLength(angleDelta)
    if (angleDistanceSquared === 0) continue
    const inverseAngleDistance = 1 / Math.sqrt(angleDistanceSquared)
    if (
      (angleDelta.x * aim.x + angleDelta.y * aim.y) * inverseAngleDistance
      < AIR_PRIMARY_CONE_DOT
    ) {
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
  return selectEtherPrimaryTargetAtPoint({
    origin: probe,
    targets: query.targets,
  })
}

export function selectEtherPrimaryTargetAtPoint(
  query: EtherPrimaryTargetPointQuery,
): PrimarySpellTarget | null {
  let selected: PrimarySpellTarget | null = null
  let selectedDistanceSquared = ETHER_PRIMARY_TARGET_DISTANCE_SQUARED
  for (const target of nativeRegistrationOrder(query.targets)) {
    if (
      target.id === query.excludedTargetId
      || (target.actorFlags & NATIVE_PRIMARY_HOSTILE_FLAG) === 0
    ) continue
    const distanceSquared = squaredLength(subtract(target.position, query.origin))
    if (distanceSquared >= selectedDistanceSquared) continue
    selected = target
    selectedDistanceSquared = distanceSquared
  }
  return selected
}

export function firstNativePrimaryPointContact(
  query: NativePrimaryPointContactQuery,
): PrimarySpellTarget | null {
  const cellX = nativePrimaryCellCoordinate(query.position.x)
  const cellY = nativePrimaryCellCoordinate(query.position.y)
  for (const target of nativeCellBindingOrder(query.targets)) {
    if (!nativePrimaryTargetEligible(target, query.actorMask)) continue
    if (
      nativePrimaryCellCoordinate(target.position.x) !== cellX
      || nativePrimaryCellCoordinate(target.position.y) !== cellY
    ) continue
    const radius = query.queryRadius + target.bodyRadius
    if (squaredLength(subtract(target.position, query.position)) < radius * radius) {
      return target
    }
  }
  return null
}

export function firstNativeFireballPointContact(
  query: NativeFireballPointContactQuery,
): PrimarySpellTarget | null {
  const contact = firstNativePrimaryPointContact(query)
  if (contact === null || (contact.actorFlags & NATIVE_PRIMARY_HOSTILE_FLAG) !== 0) {
    return contact
  }
  const contactDelta = subtract(contact.position, query.position)
  if (squaredLength(contactDelta) < NATIVE_FIREBALL_SCENERY_EXCEPTION_DISTANCE_SQUARED) {
    return contact
  }
  if (!Number.isFinite(query.hostileCorridorLength) || query.hostileCorridorLength <= 0) {
    throw new RangeError('Fireball hostile corridor length must be positive and finite')
  }
  const direction = normalized(query.direction)
  if (squaredLength(direction) === 0) return contact
  const side = {
    x: Math.fround(direction.y * NATIVE_FIREBALL_HOSTILE_CORRIDOR_HALF_WIDTH),
    y: Math.fround(-direction.x * NATIVE_FIREBALL_HOSTILE_CORRIDOR_HALF_WIDTH),
  }
  const far = {
    x: Math.fround(query.position.x + direction.x * query.hostileCorridorLength),
    y: Math.fround(query.position.y + direction.y * query.hostileCorridorLength),
  }
  const polygon = [
    { x: Math.fround(query.position.x + side.x), y: Math.fround(query.position.y + side.y) },
    { x: Math.fround(query.position.x - side.x), y: Math.fround(query.position.y - side.y) },
    { x: Math.fround(far.x - side.x), y: Math.fround(far.y - side.y) },
    { x: Math.fround(far.x + side.x), y: Math.fround(far.y + side.y) },
  ]
  const hostileAhead = query.targets.some((target) => (
    nativePrimaryTargetEligible(target, NATIVE_PRIMARY_HOSTILE_FLAG)
    && nativePointInPolygon(target.position, polygon)
  ))
  return hostileAhead ? null : contact
}

export function nativePrimaryConeTargets(
  query: NativePrimaryConeQuery,
): PrimarySpellTarget[] {
  const aim = normalized(query.aimDirection)
  const angleOrigin = directionalApex(query.origin, aim)
  const reachSquared = query.reach * query.reach
  const coneDot = Math.cos(query.halfAngleDegrees * Math.PI / 180)
  return nativeBroadphaseOrder(query.origin, query.reach, query.targets).filter((target) => {
    if (!nativePrimaryTargetEligible(target, query.actorMask)) return false
    const rangeDelta = subtract(target.position, query.origin)
    const distanceSquared = squaredLength(rangeDelta)
    if (distanceSquared === 0 || distanceSquared >= reachSquared) return false
    const angleDelta = subtract(target.position, angleOrigin)
    const angleDistanceSquared = squaredLength(angleDelta)
    if (
      angleDistanceSquared === 0
      || (angleDelta.x * aim.x + angleDelta.y * aim.y)
        / Math.sqrt(angleDistanceSquared) < coneDot
    ) {
      return false
    }
    return query.hasLineOfSight(target)
  })
}

export function nativePrimaryPolygonTargets(
  query: NativePrimaryPolygonQuery,
): PrimarySpellTarget[] {
  if (query.polygon.length < 3) return []
  let minimumX = Number.POSITIVE_INFINITY
  let minimumY = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY
  for (const point of query.polygon) {
    minimumX = Math.min(minimumX, point.x)
    minimumY = Math.min(minimumY, point.y)
    maximumX = Math.max(maximumX, point.x)
    maximumY = Math.max(maximumY, point.y)
  }
  return nativeCellRangeOrder({
    maximumX: Math.fround(maximumX + NATIVE_PRIMARY_POLYGON_BROADPHASE_PADDING),
    maximumY: Math.fround(maximumY + NATIVE_PRIMARY_POLYGON_BROADPHASE_PADDING),
    minimumX: Math.fround(minimumX - NATIVE_PRIMARY_POLYGON_BROADPHASE_PADDING),
    minimumY: Math.fround(minimumY - NATIVE_PRIMARY_POLYGON_BROADPHASE_PADDING),
    targets: query.targets,
  }).filter((target) => (
    nativePrimaryTargetEligible(target, query.actorMask)
    && nativePointInPolygon(target.position, query.polygon)
  ))
}

export function nativePrimaryViewBounds(input: Readonly<{
  bounds: NativePrimaryWorldBounds
  focus: Vector2
  padding: number
  scale: number
  viewportHeight: number
  viewportWidth: number
}>): NativePrimaryWorldBounds {
  const viewWidth = Math.fround(input.viewportWidth / input.scale)
  const viewHeight = Math.fround(input.viewportHeight / input.scale)
  const cameraX = clampViewAxis(input.focus.x, input.bounds.x, input.bounds.w, viewWidth)
  const cameraY = clampViewAxis(input.focus.y, input.bounds.y, input.bounds.h, viewHeight)
  return {
    x: Math.fround(cameraX - viewWidth / 2 - input.padding),
    y: Math.fround(cameraY - viewHeight / 2 - input.padding),
    w: Math.fround(viewWidth + input.padding * 2),
    h: Math.fround(viewHeight + input.padding * 2),
  }
}

export function nativePrimaryViewRayEndpoint(input: Readonly<{
  direction: Vector2
  start: Vector2
  view: NativePrimaryWorldBounds
}>): Vector2 {
  const far = {
    x: Math.fround(input.start.x + Math.fround(input.direction.x * 100_000)),
    y: Math.fround(input.start.y + Math.fround(input.direction.y * 100_000)),
  }
  const endpoint = lineBoundsExitObstruction(input.start, far, input.view)?.point ?? far
  return { x: Math.fround(endpoint.x), y: Math.fround(endpoint.y) }
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

export function advanceEtherPrimaryTracking(
  input: EtherPrimaryTrackingInput,
): EtherPrimaryTrackingResult {
  const resolvedTarget = input.targetId === null
    ? undefined
    : input.targets.find(({ id }) => id === input.targetId)
  if (resolvedTarget) {
    const advanced = advanceEtherPrimaryHoming({
      ...input,
      targetPosition: resolvedTarget.position,
    })
    return {
      ...advanced,
      reacquiresTarget: input.reacquiresTarget,
      targetId: resolvedTarget.active ? resolvedTarget.id : null,
    }
  }

  const advanced = advanceEtherPrimaryHoming({
    ...input,
    targetPosition: null,
  })
  if (input.targetId !== null && input.reacquiresTarget) {
    const replacement = selectEtherPrimaryTargetAtPoint({
      origin: advanced.position,
      targets: input.targets,
    })
    return {
      ...advanced,
      reacquiresTarget: replacement !== null,
      targetId: replacement?.id ?? null,
    }
  }
  return {
    ...advanced,
    reacquiresTarget: input.reacquiresTarget,
    targetId: null,
  }
}

export function nativeMissileFanHeading(
  aimHeading: number,
  quantity: number,
  index: number,
): number {
  validateMissileFanIndex(quantity, index)
  const step = quantity < 4 ? 30 : 20
  const base = aimHeading + (quantity % 2 === 0 ? step / 2 : 0)
  const tier = Math.ceil(index / 2)
  const offset = (index % 2 === 0 ? 1 : -1) * tier * step
  return Math.fround(normalizeDegrees(base + offset))
}

export function nativeMissileFanTurnScale(index: number): number {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError('missile index must be a non-negative safe integer')
  }
  return 0.75 ** Math.ceil(index / 2)
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

function validateMissileFanIndex(quantity: number, index: number): void {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError('missile quantity must be a positive safe integer')
  }
  if (!Number.isSafeInteger(index) || index < 0 || index >= quantity) {
    throw new RangeError('missile index is outside the fan')
  }
}

function nativeRegistrationOrder(
  targets: readonly PrimarySpellTarget[],
): PrimarySpellTarget[] {
  return [...targets].sort((left, right) => (
    left.registrationOrder - right.registrationOrder
  ))
}

function nativeCellBindingOrder(
  targets: readonly PrimarySpellTarget[],
): PrimarySpellTarget[] {
  return [...targets].sort((left, right) => (
    left.cellBindingOrder - right.cellBindingOrder
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
  return nativeCellRangeOrder({
    maximumX: Math.fround(minX + diameter),
    maximumY: Math.fround(minY + diameter),
    minimumX: minX,
    minimumY: minY,
    targets,
  })
}

function nativeCellRangeOrder(input: Readonly<{
  maximumX: number
  maximumY: number
  minimumX: number
  minimumY: number
  targets: readonly PrimarySpellTarget[]
}>): PrimarySpellTarget[] {
  const minCellX = nativePrimaryCellCoordinate(input.minimumX)
  const minCellY = nativePrimaryCellCoordinate(input.minimumY)
  const maxCellX = nativePrimaryCellCoordinate(input.maximumX)
  const maxCellY = nativePrimaryCellCoordinate(input.maximumY)
  const grid = input.targets.filter((target) => {
    if ((target.actorFlags & 0x180) !== 0) return false
    const cellX = nativePrimaryCellCoordinate(target.position.x)
    const cellY = nativePrimaryCellCoordinate(target.position.y)
    return cellX >= minCellX
      && cellX <= maxCellX
      && cellY >= minCellY
      && cellY <= maxCellY
  }).sort((left, right) => {
    const leftCellX = nativePrimaryCellCoordinate(left.position.x)
    const rightCellX = nativePrimaryCellCoordinate(right.position.x)
    if (leftCellX !== rightCellX) return leftCellX - rightCellX
    const leftCellY = nativePrimaryCellCoordinate(left.position.y)
    const rightCellY = nativePrimaryCellCoordinate(right.position.y)
    return leftCellY - rightCellY || left.cellBindingOrder - right.cellBindingOrder
  })
  const special = nativeRegistrationOrder(input.targets.filter((target) => (
    (target.actorFlags & 0x180) !== 0
  )))
  return [...grid, ...special]
}

export function nativePrimaryCellCoordinate(position: number): number {
  return Math.trunc(Math.fround(position / NATIVE_PRIMARY_ACTOR_CELL_SIZE))
}

function nativePointInPolygon(
  point: Readonly<Vector2>,
  polygon: readonly Readonly<Vector2>[],
): boolean {
  let inside = false
  let previous = polygon.at(-1)
  if (!previous) return false
  for (const current of polygon) {
    if (
      (point.y < current.y) !== (point.y < previous.y)
      && point.x < (
        (previous.x - current.x) * (point.y - current.y)
        / (previous.y - current.y)
        + current.x
      )
    ) inside = !inside
    previous = current
  }
  return inside
}

function directionalApex(origin: Readonly<Vector2>, direction: Readonly<Vector2>): Vector2 {
  return {
    x: Math.fround(origin.x - direction.x * NATIVE_PRIMARY_DIRECTIONAL_APEX_OFFSET),
    y: Math.fround(origin.y - direction.y * NATIVE_PRIMARY_DIRECTIONAL_APEX_OFFSET),
  }
}

function clampViewAxis(focus: number, origin: number, size: number, viewSize: number): number {
  if (size <= viewSize) return Math.fround(origin + size / 2)
  const halfView = viewSize / 2
  return Math.fround(Math.min(origin + size - halfView, Math.max(origin + halfView, focus)))
}
