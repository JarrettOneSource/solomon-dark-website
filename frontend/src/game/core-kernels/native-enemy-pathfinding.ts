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
  readonly movementPerTick: number
  readonly radialDirection: -1 | 0 | 1
  readonly statusFactor: number
  readonly tangentDirection: -1 | 0 | 1
  readonly targetHeadingDeg: number
  readonly targetPosition: Readonly<BoneyardPoint> | null
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
      speedFactor: 1,
      stalledMovementTicks: 0,
      turnFactor: 1,
      wanderHeadingDeg: wander.value,
    }),
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

function nativeEnemySteeringGoal(
  state: NativeEnemyPathState,
  request: NativeEnemySteeringRequest,
): BoneyardPoint {
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
  const delta = positiveModulo(target - current + 180, 360) - 180
  if (Math.abs(delta) < 1 || Math.abs(delta) >= 359) return current
  return positiveModulo(current + Math.sign(delta) * Math.min(Math.abs(delta), maximumStep), 360)
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
