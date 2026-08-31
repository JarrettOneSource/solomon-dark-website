import type { BoneyardPoint } from './boneyard.ts'

export const NATIVE_WRAITH_COLLISION_RADIUS = 15
export const NATIVE_WRAITH_CONTACT_DISTANCE = 40
export const NATIVE_WRAITH_CONTACT_COOLDOWN_TICKS = 50
export const NATIVE_WRAITH_FLYBY_DISTANCE = 300
export const NATIVE_WRAITH_FLYBY_TICKS = Object.freeze({
  minimum: 200,
  randomCount: 601,
})
export const NATIVE_WRAITH_MOVEMENT_SUBSTEPS = 2

const BASE_SPEED_FACTOR = 0.8
const INITIAL_SPEED_MULTIPLIER = 25
const CONTACT_SPEED_MULTIPLIER = 50
const MOVEMENT_FACTOR = 0.25
const NO_TARGET_DISTANCE = 10_000
const NO_TARGET_HEADING_PER_TICK = 225
const TURN_CHANGE_PER_TICK = 2
const MINIMUM_TURN_GAIN = 1.5
const CONTACT_TURN_GAIN_MINIMUM = 7
const CONTACT_TURN_GAIN_RANGE = 5
const FAST_SPEED_LOSS_PER_TICK = 1
const SLOW_SPEED_LOSS_PER_TICK = 0.025

export interface NativeWraithFlightState {
  readonly baseFlybySpeed: number
  readonly contactCooldownTicks: number
  readonly currentSpeed: number
  readonly currentTurnGain: number
  readonly flybyTicksRemaining: number
  readonly restingSpeed: number
  readonly targetTurnGain: number
}

export interface NativeWraithMovementRequest {
  readonly actorAgeTicks: number
  readonly actorHeadingDeg: number
  readonly actorPosition: Readonly<BoneyardPoint>
  readonly pathSpeedFactor: number
  readonly pathTurnFactor: number
  readonly state: NativeWraithFlightState
  readonly statusFactor: number
  readonly targetPosition: Readonly<BoneyardPoint> | null
}

export interface NativeWraithMovementResult {
  readonly delta: Readonly<BoneyardPoint>
  readonly headingDeg: number
}

export function createNativeWraithFlightState(
  chaseSpeed: number,
  restingSpeedUnit: number,
  initialSpeedUnit: number,
  flybyTickOffset: number,
): NativeWraithFlightState {
  requirePositive(chaseSpeed, 'Wraith chase speed')
  requireUnit(restingSpeedUnit, 'Wraith resting-speed draw')
  requireUnit(initialSpeedUnit, 'Wraith initial-speed draw')
  requireIntegerRange(
    flybyTickOffset,
    0,
    NATIVE_WRAITH_FLYBY_TICKS.randomCount - 1,
    'Wraith flyby draw',
  )
  const baseFlybySpeed = Math.fround(chaseSpeed * BASE_SPEED_FACTOR)
  return Object.freeze({
    baseFlybySpeed,
    contactCooldownTicks: 0,
    currentSpeed: Math.fround(
      baseFlybySpeed * INITIAL_SPEED_MULTIPLIER * (1 + initialSpeedUnit * 2),
    ),
    currentTurnGain: 1.5,
    flybyTicksRemaining: NATIVE_WRAITH_FLYBY_TICKS.minimum + flybyTickOffset,
    restingSpeed: Math.fround(baseFlybySpeed * restingSpeedUnit * 10),
    targetTurnGain: 3,
  })
}

export function stepNativeWraithFlightClock(
  source: NativeWraithFlightState,
): NativeWraithFlightState {
  const flybyTicksRemaining = Math.max(0, source.flybyTicksRemaining - 1)
  let currentTurnGain = source.currentTurnGain
  if (currentTurnGain < source.targetTurnGain) {
    currentTurnGain = Math.fround(currentTurnGain + TURN_CHANGE_PER_TICK)
  } else if (source.targetTurnGain < currentTurnGain) {
    currentTurnGain = Math.fround(currentTurnGain - TURN_CHANGE_PER_TICK)
  }

  let contactCooldownTicks = source.contactCooldownTicks
  let currentSpeed = source.currentSpeed
  let targetTurnGain = source.targetTurnGain
  if (contactCooldownTicks > 0) {
    contactCooldownTicks -= 1
  } else if (flybyTicksRemaining > 0) {
    if (source.restingSpeed * 2 < currentSpeed) {
      currentSpeed = Math.fround(currentSpeed - FAST_SPEED_LOSS_PER_TICK)
    }
    targetTurnGain = Math.max(
      MINIMUM_TURN_GAIN,
      Math.fround(targetTurnGain - TURN_CHANGE_PER_TICK),
    )
  } else {
    targetTurnGain = Math.fround(targetTurnGain + TURN_CHANGE_PER_TICK)
  }
  if (source.restingSpeed < currentSpeed) {
    currentSpeed = Math.fround(currentSpeed - SLOW_SPEED_LOSS_PER_TICK)
  }
  return Object.freeze({
    ...source,
    contactCooldownTicks,
    currentSpeed,
    currentTurnGain,
    flybyTicksRemaining,
    targetTurnGain,
  })
}

export function resetNativeWraithFlightAfterContact(
  source: NativeWraithFlightState,
  flybyTickOffset: number,
  turnGainUnit: number,
): NativeWraithFlightState {
  requireIntegerRange(
    flybyTickOffset,
    0,
    NATIVE_WRAITH_FLYBY_TICKS.randomCount - 1,
    'Wraith contact flyby draw',
  )
  requireUnit(turnGainUnit, 'Wraith contact turn draw')
  return Object.freeze({
    ...source,
    contactCooldownTicks: NATIVE_WRAITH_CONTACT_COOLDOWN_TICKS,
    currentSpeed: Math.fround(source.baseFlybySpeed * CONTACT_SPEED_MULTIPLIER),
    currentTurnGain: 1,
    flybyTicksRemaining: NATIVE_WRAITH_FLYBY_TICKS.minimum + flybyTickOffset,
    targetTurnGain: Math.fround(
      CONTACT_TURN_GAIN_MINIMUM + turnGainUnit * CONTACT_TURN_GAIN_RANGE,
    ),
  })
}

export function nativeWraithMovement(
  request: NativeWraithMovementRequest,
): NativeWraithMovementResult {
  requireIntegerRange(request.actorAgeTicks, 0, Number.MAX_SAFE_INTEGER, 'Wraith age')
  requirePositive(request.pathSpeedFactor, 'Wraith path speed factor')
  requirePositive(request.pathTurnFactor, 'Wraith path turn factor')
  requirePositive(request.statusFactor, 'Wraith status factor')

  const targetBearingDeg = request.targetPosition === null
    ? null
    : headingTo(request.actorPosition, request.targetPosition, request.actorHeadingDeg)
  const goal = request.targetPosition === null
    ? offsetPoint(
        request.actorPosition,
        request.actorAgeTicks * NO_TARGET_HEADING_PER_TICK,
        NO_TARGET_DISTANCE,
      )
    : request.state.flybyTicksRemaining > 0
      ? offsetPoint(request.targetPosition, targetBearingDeg!, NATIVE_WRAITH_FLYBY_DISTANCE)
      : request.targetPosition
  const desiredHeadingDeg = headingTo(
    request.actorPosition,
    goal,
    request.actorHeadingDeg,
  )
  const turnStep = request.pathTurnFactor
    * request.state.currentTurnGain
    * request.statusFactor
  const movement = request.pathSpeedFactor
    * request.state.currentSpeed
    * request.statusFactor
    * MOVEMENT_FACTOR
  let headingDeg = request.actorHeadingDeg
  let x = 0
  let y = 0
  for (let step = 0; step < NATIVE_WRAITH_MOVEMENT_SUBSTEPS; step += 1) {
    headingDeg = turnTowardHeading(headingDeg, desiredHeadingDeg, turnStep)
    const radians = headingDeg * Math.PI / 180
    x = Math.fround(x + Math.fround(Math.sin(radians) * movement))
    y = Math.fround(y - Math.fround(Math.cos(radians) * movement))
  }
  return Object.freeze({
    delta: Object.freeze({ x, y }),
    headingDeg,
  })
}

export function nativeWraithContactContains(
  wraithPosition: Readonly<BoneyardPoint>,
  targetPosition: Readonly<BoneyardPoint>,
): boolean {
  const x = wraithPosition.x - targetPosition.x
  const y = wraithPosition.y - targetPosition.y
  return x * x + y * y < NATIVE_WRAITH_CONTACT_DISTANCE ** 2
}

export function nativeWraithContactActionProgress(
  contactCooldownTicks: number,
): number {
  requireIntegerRange(
    contactCooldownTicks,
    0,
    NATIVE_WRAITH_CONTACT_COOLDOWN_TICKS,
    'Wraith contact cooldown',
  )
  return contactCooldownTicks === 0
    ? 0
    : NATIVE_WRAITH_CONTACT_COOLDOWN_TICKS - contactCooldownTicks
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
  const x = target.x - source.x
  const y = target.y - source.y
  return x === 0 && y === 0
    ? positiveModulo(fallback, 360)
    : positiveModulo(Math.atan2(x, -y) * 180 / Math.PI, 360)
}

function turnTowardHeading(current: number, target: number, step: number): number {
  const normalizedCurrent = positiveModulo(current, 360)
  const normalizedTarget = positiveModulo(target, 360)
  const separation = Math.abs(normalizedCurrent - normalizedTarget)
  if (separation < 1 || separation >= 359) return normalizedCurrent
  const direction = normalizedTarget <= normalizedCurrent
    ? normalizedCurrent - normalizedTarget <= 180 ? -1 : 1
    : normalizedTarget - normalizedCurrent > 180 ? -1 : 1
  return positiveModulo(Math.fround(normalizedCurrent + direction * step), 360)
}

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}

function requirePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive`)
}

function requireUnit(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(`${label} must be within [0,1)`)
  }
}

function requireIntegerRange(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be within [${minimum},${maximum}]`)
  }
}
