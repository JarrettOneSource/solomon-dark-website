import type { BoneyardPoint } from './boneyard.ts'
import {
  drawNativeFloat,
  drawNativeInteger,
  drawNativeSign,
  type NativeRngState,
} from './native-rng.ts'

export type NativeEnemyPathfindingMode = 0 | 1 | 2 | 3

export interface NativeEnemyPathState {
  readonly baseTurnRate: number
  readonly flankAngleDeg: number
  readonly flankRadius: number
  readonly flankTicksRemaining: number
  readonly reorientationTicksRemaining: number
  readonly routePreviousVector: Readonly<BoneyardPoint> | null
  readonly routeRefreshTicksRemaining: number
  readonly routeTicksRemaining: number
  readonly routeWaypointIndex: 0 | 1
  readonly routeWaypoints: readonly [
    Readonly<BoneyardPoint>,
    Readonly<BoneyardPoint>,
  ] | null
  readonly speedFactor: number
  readonly stalledMovementTicks: number
  readonly turnFactor: number
  readonly wanderHeadingDeg: number
}

export interface NativeEnemyPathConstruction {
  readonly rngState: NativeRngState
  readonly state: NativeEnemyPathState
}

export interface NativeEnemySteeringRequest {
  readonly actorHeadingDeg: number
  readonly actorPosition: Readonly<BoneyardPoint>
  readonly cadenceTicks: number
  readonly goalPosition?: Readonly<BoneyardPoint>
  readonly movementPerTick: number
  readonly radialDirection: -1 | 0 | 1
  readonly statusFactor: number
  readonly tangentDirection: -1 | 0 | 1
  readonly targetHeadingDeg: number
  readonly targetPosition: Readonly<BoneyardPoint> | null
}

export interface NativeEnemyPathGoalRequest {
  readonly actorPosition: Readonly<BoneyardPoint>
  readonly bodyRadius: number
  readonly cadenceTicks: number
  readonly directPathClear: (
    start: Readonly<BoneyardPoint>,
    end: Readonly<BoneyardPoint>,
  ) => boolean
  readonly findRoute: (
    start: Readonly<BoneyardPoint>,
    end: Readonly<BoneyardPoint>,
    clearance: number,
    bodyRadius: number,
  ) => readonly Readonly<BoneyardPoint>[] | null
  readonly navigationClearance: number
  readonly rawGoal: Readonly<BoneyardPoint>
  readonly targetPosition: Readonly<BoneyardPoint> | null
  readonly targetRefreshTicks: number
}

export interface NativeEnemyPathGoalResult {
  readonly goal: Readonly<BoneyardPoint>
  readonly state: NativeEnemyPathState
  readonly turnAround: boolean
}

export interface NativeEnemySteeringResult {
  readonly delta: Readonly<BoneyardPoint>
  readonly headingDeg: number
  readonly state: NativeEnemyPathState
}

export interface NativeEnemyPathRecoveryRequest {
  readonly flankingEnabled: boolean
  readonly requestedDistance: number
  readonly statusFactor: number
  readonly tick: number
  readonly traveledDistance: number
}

export interface NativeEnemyPathRecoveryResult {
  readonly rngState: NativeRngState
  readonly state: NativeEnemyPathState
  readonly triggeredState0D: boolean
}

export interface NativeEnemyReorientationResult {
  readonly headingDeg: number
  readonly state: NativeEnemyPathState
}

export const NATIVE_ENEMY_PATH_BASE_REPATH_TICKS = 100
export const NATIVE_ENEMY_FLANK_TICKS = Object.freeze({ minimum: 200, randomCount: 201 })
export const NATIVE_ENEMY_FLANK_SPEED_FACTOR = 1.5
export const NATIVE_ENEMY_FLANK_TURN_FACTOR = Math.fround(1.4)
export const NATIVE_ENEMY_PATH_FACTOR_DECAY = 0.995
export const NATIVE_ENEMY_STALLED_REROUTE_TICKS = 25
export const NATIVE_ENEMY_STALLED_STATE_ROLL_COUNT = 15
export const NATIVE_ENEMY_STALLED_STATE_ROLL_WINNER = 3
export const NATIVE_ENEMY_PERIODIC_REROUTE_TICKS = 20
export const NATIVE_ENEMY_PERIODIC_REROUTE_ROLL_COUNT = 150
export const NATIVE_ENEMY_PERIODIC_REROUTE_ROLL_WINNER = 23
export const NATIVE_ENEMY_REORIENTATION_TICKS = Object.freeze({
  minimum: 50,
  randomCount: 50,
})
export const NATIVE_ENEMY_WANDER_DISTANCE = 10_000
export const NATIVE_ENEMY_APPROACH_OFFSET_DISTANCE = 300
export const NATIVE_ENEMY_APPROACH_OFFSET_FULL_DISTANCE = 500

export function createNativeEnemyPathState(
  sourceRngState: NativeRngState,
): NativeEnemyPathConstruction {
  const wander = drawNativeFloat(sourceRngState, 360)
  const turn = drawNativeFloat(wander.state, Math.fround(0.5))
  const flankMagnitude = drawNativeFloat(turn.state, 90)
  const flankAngle = drawNativeSign(flankMagnitude.state, flankMagnitude.value)
  const flankRadius = drawNativeFloat(flankAngle.state, 100)
  return {
    rngState: flankRadius.state,
    state: Object.freeze({
      baseTurnRate: Math.fround(Math.fround(0.5) + turn.value),
      flankAngleDeg: flankAngle.value,
      flankRadius: flankRadius.value,
      flankTicksRemaining: 0,
      reorientationTicksRemaining: 0,
      routePreviousVector: null,
      routeRefreshTicksRemaining: 0,
      routeTicksRemaining: 0,
      routeWaypointIndex: 0,
      routeWaypoints: null,
      speedFactor: 1,
      stalledMovementTicks: 0,
      turnFactor: 1,
      wanderHeadingDeg: wander.value,
    }),
  }
}

export function resolveNativeEnemyPathGoal(
  source: NativeEnemyPathState,
  request: NativeEnemyPathGoalRequest,
): NativeEnemyPathGoalResult {
  validatePathGoalRequest(request)
  const active = resolveActiveRoute(source, request)
  if (active !== null) return active

  const routeRefreshTicksRemaining = Math.max(
    0,
    source.routeRefreshTicksRemaining - request.cadenceTicks,
  )
  if (routeRefreshTicksRemaining > 0) {
    return {
      goal: Object.freeze({ ...request.rawGoal }),
      state: Object.freeze({ ...source, routeRefreshTicksRemaining }),
      turnAround: false,
    }
  }

  const routeGoal = request.targetPosition ?? request.rawGoal
  if (request.directPathClear(request.actorPosition, routeGoal)) {
    return {
      goal: Object.freeze({ ...routeGoal }),
      state: clearRoute(source, request.targetRefreshTicks),
      turnAround: false,
    }
  }

  const route = request.findRoute(
    request.actorPosition,
    routeGoal,
    request.navigationClearance,
    request.bodyRadius,
  )
  if (route === null || route.length < 3) {
    return {
      goal: Object.freeze({ ...routeGoal }),
      state: clearRoute(source, 0),
      turnAround: true,
    }
  }

  const first = Object.freeze({ ...route[1]! })
  const second = Object.freeze({ ...route[2]! })
  const routeWaypoints: [Readonly<BoneyardPoint>, Readonly<BoneyardPoint>] = [
    first,
    second,
  ]
  const previous = vectorFromWaypoint(request.actorPosition, first)
  return {
    goal: first,
    state: Object.freeze({
      ...source,
      flankTicksRemaining: 0,
      routePreviousVector: Object.freeze(previous),
      routeRefreshTicksRemaining: 0,
      routeTicksRemaining: request.targetRefreshTicks,
      routeWaypointIndex: 0,
      routeWaypoints: Object.freeze(routeWaypoints),
    }),
    turnAround: false,
  }
}

export function nativeEnemyTargetRefreshTicks(
  mode: NativeEnemyPathfindingMode,
): number {
  switch (mode) {
    case 0: return NATIVE_ENEMY_PATH_BASE_REPATH_TICKS * 10
    case 1: return NATIVE_ENEMY_PATH_BASE_REPATH_TICKS * 3
    case 2: return NATIVE_ENEMY_PATH_BASE_REPATH_TICKS
    case 3: return 10
  }
}

export function clearNativeEnemyRoute(
  source: NativeEnemyPathState,
): NativeEnemyPathState {
  return clearRoute(source, 0)
}

export function buildNativeEnemySteering(
  source: NativeEnemyPathState,
  request: NativeEnemySteeringRequest,
): NativeEnemySteeringResult {
  if (!Number.isSafeInteger(request.cadenceTicks) || request.cadenceTicks < 1) {
    throw new RangeError('enemy steering cadence must be a positive safe integer')
  }
  let headingDeg = request.actorHeadingDeg
  let flankTicksRemaining = source.flankTicksRemaining
  let x = 0
  let y = 0
  for (let tick = 0; tick < request.cadenceTicks; tick += 1) {
    const actorPosition = {
      x: request.actorPosition.x + x,
      y: request.actorPosition.y + y,
    }
    const goal = nativeEnemySteeringGoal(
      { ...source, flankTicksRemaining },
      { ...request, actorPosition },
    )
    const desiredHeading = headingTo(actorPosition, goal, headingDeg)
    headingDeg = turnTowardHeading(
      headingDeg,
      desiredHeading,
      source.baseTurnRate * source.turnFactor * request.statusFactor,
    )
    const radians = headingDeg * Math.PI / 180
    x += Math.sin(radians) * request.movementPerTick
    y -= Math.cos(radians) * request.movementPerTick
    if (flankTicksRemaining > 0) flankTicksRemaining -= 1
  }
  return {
    delta: Object.freeze({ x, y }),
    headingDeg,
    state: flankTicksRemaining === source.flankTicksRemaining
      ? source
      : Object.freeze({ ...source, flankTicksRemaining }),
  }
}

export function stepNativeEnemyPathRecovery(
  source: NativeEnemyPathState,
  sourceRngState: NativeRngState,
  request: NativeEnemyPathRecoveryRequest,
): NativeEnemyPathRecoveryResult {
  if (!Number.isFinite(request.statusFactor) || request.statusFactor <= 0) {
    throw new RangeError('enemy path recovery status factor must be positive and finite')
  }
  let state = source
  let rngState = sourceRngState
  let triggeredState0D = false
  const stalled = request.requestedDistance > 0
    && request.traveledDistance <= request.requestedDistance * 0.25
  if (stalled) {
    const stalledMovementTicks = Math.min(
      101,
      state.stalledMovementTicks + 1,
    )
    state = Object.freeze({ ...state, stalledMovementTicks })
    if (stalledMovementTicks === NATIVE_ENEMY_STALLED_REROUTE_TICKS) {
      const branch = drawNativeInteger(
        rngState,
        NATIVE_ENEMY_STALLED_STATE_ROLL_COUNT,
      )
      rngState = branch.state
      if (branch.value === NATIVE_ENEMY_STALLED_STATE_ROLL_WINNER) {
        const duration = drawNativeInteger(
          rngState,
          NATIVE_ENEMY_REORIENTATION_TICKS.randomCount,
        )
        rngState = duration.state
        triggeredState0D = true
        state = Object.freeze({
          ...state,
          reorientationTicksRemaining: roundToNearestEven(
            (NATIVE_ENEMY_REORIENTATION_TICKS.minimum + duration.value)
              / request.statusFactor,
          ),
        })
      } else {
        const selected = selectNativeEnemyFlank(
          state,
          rngState,
          request.flankingEnabled,
        )
        state = Object.freeze({ ...selected.state, stalledMovementTicks: 0 })
        rngState = selected.rngState
      }
    }
  } else if (state.stalledMovementTicks > 0) {
    state = Object.freeze({
      ...state,
      stalledMovementTicks: state.stalledMovementTicks - 1,
    })
  }

  if (request.tick % NATIVE_ENEMY_PERIODIC_REROUTE_TICKS === 0) {
    const periodic = drawNativeInteger(
      rngState,
      NATIVE_ENEMY_PERIODIC_REROUTE_ROLL_COUNT,
    )
    rngState = periodic.state
    if (periodic.value === NATIVE_ENEMY_PERIODIC_REROUTE_ROLL_WINNER) {
      const selected = selectNativeEnemyFlank(
        state,
        rngState,
        request.flankingEnabled,
      )
      state = selected.state
      rngState = selected.rngState
    }
  }

  if (state.flankTicksRemaining <= 0) {
    const speedFactor = Math.max(1, state.speedFactor * NATIVE_ENEMY_PATH_FACTOR_DECAY)
    const turnFactor = Math.max(1, state.turnFactor * NATIVE_ENEMY_PATH_FACTOR_DECAY)
    if (speedFactor !== state.speedFactor || turnFactor !== state.turnFactor) {
      state = Object.freeze({ ...state, speedFactor, turnFactor })
    }
  }
  return { rngState, state, triggeredState0D }
}

export function stepNativeEnemyReorientation(
  source: NativeEnemyPathState,
  actorHeadingDeg: number,
  actorPosition: Readonly<BoneyardPoint>,
  targetPosition: Readonly<BoneyardPoint> | null,
): NativeEnemyReorientationResult {
  if (source.reorientationTicksRemaining <= 0) {
    return { headingDeg: actorHeadingDeg, state: source }
  }
  if (targetPosition === null) {
    return {
      headingDeg: actorHeadingDeg,
      state: Object.freeze({ ...source, reorientationTicksRemaining: 0 }),
    }
  }
  return {
    headingDeg: headingTo(actorPosition, targetPosition, actorHeadingDeg),
    state: Object.freeze({
      ...source,
      reorientationTicksRemaining: source.reorientationTicksRemaining - 1,
    }),
  }
}

export function selectNativeEnemyFlank(
  source: NativeEnemyPathState,
  sourceRngState: NativeRngState,
  flankingEnabled: boolean,
): NativeEnemyPathRecoveryResult {
  const wander = drawNativeFloat(sourceRngState, 360)
  let state: NativeEnemyPathState = Object.freeze({
    ...source,
    wanderHeadingDeg: wander.value,
  })
  let rngState = wander.state
  if (flankingEnabled) {
    const duration = drawNativeInteger(rngState, NATIVE_ENEMY_FLANK_TICKS.randomCount)
    rngState = duration.state
    state = Object.freeze({
      ...state,
      flankTicksRemaining: NATIVE_ENEMY_FLANK_TICKS.minimum + duration.value,
      speedFactor: NATIVE_ENEMY_FLANK_SPEED_FACTOR,
      turnFactor: NATIVE_ENEMY_FLANK_TURN_FACTOR,
    })
  }
  return { rngState, state, triggeredState0D: false }
}

export function nativeEnemySteeringGoal(
  state: NativeEnemyPathState,
  request: NativeEnemySteeringRequest,
): BoneyardPoint {
  if (request.goalPosition !== undefined) return { ...request.goalPosition }
  const target = request.targetPosition
  if (target === null) {
    return offsetPoint(
      request.actorPosition,
      state.wanderHeadingDeg,
      NATIVE_ENEMY_WANDER_DISTANCE,
    )
  }
  if (request.radialDirection !== 1 || request.tangentDirection !== 0) {
    const dx = target.x - request.actorPosition.x
    const dy = target.y - request.actorPosition.y
    const length = Math.hypot(dx, dy)
    if (length === 0) return { ...request.actorPosition }
    const unitX = dx / length
    const unitY = dy / length
    return {
      x: request.actorPosition.x + (
        unitX * request.radialDirection - unitY * request.tangentDirection
      ) * NATIVE_ENEMY_WANDER_DISTANCE,
      y: request.actorPosition.y + (
        unitY * request.radialDirection + unitX * request.tangentDirection
      ) * NATIVE_ENEMY_WANDER_DISTANCE,
    }
  }
  if (state.flankTicksRemaining > 0) {
    return offsetPoint(
      target,
      request.targetHeadingDeg + state.flankAngleDeg,
      state.flankRadius,
    )
  }
  const targetDistance = Math.hypot(
    target.x - request.actorPosition.x,
    target.y - request.actorPosition.y,
  )
  return offsetPoint(
    target,
    state.wanderHeadingDeg,
    Math.min(targetDistance / NATIVE_ENEMY_APPROACH_OFFSET_FULL_DISTANCE, 1)
      * NATIVE_ENEMY_APPROACH_OFFSET_DISTANCE,
  )
}

function offsetPoint(
  point: Readonly<BoneyardPoint>,
  headingDeg: number,
  distance: number,
): BoneyardPoint {
  const radians = headingDeg * Math.PI / 180
  return {
    x: point.x + Math.sin(radians) * distance,
    y: point.y - Math.cos(radians) * distance,
  }
}

function headingTo(
  source: Readonly<BoneyardPoint>,
  target: Readonly<BoneyardPoint>,
  fallback: number,
): number {
  const dx = target.x - source.x
  const dy = target.y - source.y
  return dx === 0 && dy === 0
    ? fallback
    : positiveModulo(Math.atan2(dx, -dy) * 180 / Math.PI, 360)
}

function turnTowardHeading(
  current: number,
  target: number,
  maximumStep: number,
): number {
  const normalizedCurrent = positiveModulo(current, 360)
  const normalizedTarget = positiveModulo(target, 360)
  const separation = Math.abs(normalizedCurrent - normalizedTarget)
  if (separation < 1 || separation >= 359) return normalizedCurrent
  const direction = normalizedTarget <= normalizedCurrent
    ? normalizedCurrent - normalizedTarget <= 180 ? -1 : 1
    : normalizedTarget - normalizedCurrent > 180 ? -1 : 1
  return positiveModulo(normalizedCurrent + direction * maximumStep, 360)
}

function resolveActiveRoute(
  source: NativeEnemyPathState,
  request: NativeEnemyPathGoalRequest,
): NativeEnemyPathGoalResult | null {
  if (source.routeWaypoints === null || source.routeTicksRemaining <= 0) return null
  const waypoint = source.routeWaypoints[source.routeWaypointIndex]
  const current = vectorFromWaypoint(request.actorPosition, waypoint)
  const previous = source.routePreviousVector ?? current
  const dot = current.x * previous.x + current.y * previous.y
  if (dot > 100) {
    return {
      goal: waypoint,
      state: Object.freeze({
        ...source,
        routePreviousVector: Object.freeze(current),
        routeRefreshTicksRemaining: 0,
        routeTicksRemaining: Math.max(
          0,
          source.routeTicksRemaining - request.cadenceTicks,
        ),
      }),
      turnAround: false,
    }
  }
  if (source.routeWaypointIndex === 0) {
    const nextWaypoint = source.routeWaypoints[1]
    const nextVector = vectorFromWaypoint(request.actorPosition, nextWaypoint)
    return resolveNativeEnemyPathGoal(Object.freeze({
      ...source,
      routePreviousVector: Object.freeze(nextVector),
      routeRefreshTicksRemaining: 0,
      routeTicksRemaining: request.targetRefreshTicks,
      routeWaypointIndex: 1,
    }), request)
  }
  return null
}

function clearRoute(
  source: NativeEnemyPathState,
  routeRefreshTicksRemaining: number,
): NativeEnemyPathState {
  return Object.freeze({
    ...source,
    routePreviousVector: null,
    routeRefreshTicksRemaining,
    routeTicksRemaining: 0,
    routeWaypointIndex: 0,
    routeWaypoints: null,
  })
}

function vectorFromWaypoint(
  actorPosition: Readonly<BoneyardPoint>,
  waypoint: Readonly<BoneyardPoint>,
): BoneyardPoint {
  return {
    x: actorPosition.x - waypoint.x,
    y: actorPosition.y - waypoint.y,
  }
}

function validatePathGoalRequest(request: NativeEnemyPathGoalRequest): void {
  if (!Number.isSafeInteger(request.cadenceTicks) || request.cadenceTicks < 1) {
    throw new RangeError('enemy route cadence must be a positive safe integer')
  }
  if (
    !Number.isSafeInteger(request.targetRefreshTicks)
    || request.targetRefreshTicks < 1
  ) throw new RangeError('enemy route refresh must be a positive safe integer')
  if (!Number.isFinite(request.navigationClearance) || request.navigationClearance <= 0) {
    throw new RangeError('enemy navigation clearance must be positive and finite')
  }
  if (!Number.isFinite(request.bodyRadius) || request.bodyRadius < 0) {
    throw new RangeError('enemy route body radius must be non-negative and finite')
  }
  for (const [label, point] of [
    ['actor position', request.actorPosition],
    ['raw goal', request.rawGoal],
    ...(request.targetPosition === null
      ? []
      : [['target position', request.targetPosition]] as const),
  ] as const) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new RangeError(`enemy ${label} must be finite`)
    }
  }
}

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}

function roundToNearestEven(value: number): number {
  const floor = Math.floor(value)
  const fraction = value - floor
  if (fraction < 0.5) return floor
  if (fraction > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}
