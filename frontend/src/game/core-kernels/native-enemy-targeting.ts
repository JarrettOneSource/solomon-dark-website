import { actorHeadingFromVector } from './actor-heading.ts'
import type { BoneyardPoint } from './boneyard.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeFloatRange,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'

export type NativeRangedRangeMode = 0 | 1 | 2 | 3
export type NativeArcherAccuracyMode = 0 | 1 | 2 | 3
export type NativeArcherMultiArrowMode = 0 | 1 | 2 | 3
export type NativeArcherArrowType = 'fire' | 'normal' | 'poison'

export const NATIVE_ARCHER_RANGE_BASE = 280
export const NATIVE_ARCHER_RANGE_RANDOM_MAXIMUM = 170
export const NATIVE_MAGE_RANGE_BASE = 312
export const NATIVE_MAGE_RANGE_RANDOM_MAXIMUM = 150
export const NATIVE_RANGED_RANGE_DOWN_DIVISOR = 1.8
export const NATIVE_RANGED_RANGE_UP_FACTOR = Math.fround(1.5)

export const NATIVE_ARCHER_PRIVATE_SEED_BOUND = 1_000_000
export const NATIVE_ARCHER_LEAD_SPEED_DIVISOR = 6
export const NATIVE_ARCHER_SCATTER_RADIUS = 75
export const NATIVE_ARCHER_FAN_STEP_DEG = 10
export const NATIVE_ARCHER_FAN_JITTER_MINIMUM = 0.9
export const NATIVE_ARCHER_FAN_JITTER_MAXIMUM = 1.1
export const NATIVE_ARCHER_MULTI_ARROW_THRESHOLDS = Object.freeze([
  0,
  15,
  50,
  100,
] as const)

export const NATIVE_ARROW_FORWARD_ORIGIN = 30
export const NATIVE_ARROW_SPEED_BASE = 5.7
export const NATIVE_ARROW_SPEED_RANDOM_MAXIMUM = Math.fround(0.6)
export const NATIVE_ARROW_LIFETIME_BASE = 100
export const NATIVE_ARROW_LIFETIME_RANDOM_MAXIMUM = 100

export interface NativeRangedRangeConstruction {
  readonly range: number
  readonly rangeEasyPending: boolean
  readonly rngState: NativeRngState
}

export interface NativeArcherVolleyRequest {
  readonly accuracyMode: NativeArcherAccuracyMode
  readonly arrowType: NativeArcherArrowType
  readonly extraArrows: number
  readonly multiArrowMode: NativeArcherMultiArrowMode
  readonly origin: Readonly<BoneyardPoint>
  readonly privateSeed: number
  readonly targetPosition: Readonly<BoneyardPoint>
  readonly targetVelocityPerTick: Readonly<BoneyardPoint>
}

export interface NativeArcherArrowBirth {
  readonly arrowType: NativeArcherArrowType
  readonly headingDeg: number
  readonly lifetimeTicks: number
  readonly position: Readonly<BoneyardPoint>
  readonly speed: number
  readonly visualHeadingDeg: number
}

export interface NativeArcherVolley {
  readonly aimOffsetRadius: number
  readonly arrows: readonly NativeArcherArrowBirth[]
  readonly effectiveAccuracyMode: 0 | 1 | 2
  readonly sharedRngState: NativeRngState
  readonly shotPitch: number
}

export function constructNativeRangedAttackRange(
  family: 'archer' | 'mage',
  mode: NativeRangedRangeMode,
  sourceRngState: NativeRngState,
): NativeRangedRangeConstruction {
  const base = family === 'archer'
    ? NATIVE_ARCHER_RANGE_BASE
    : NATIVE_MAGE_RANGE_BASE
  const maximum = family === 'archer'
    ? NATIVE_ARCHER_RANGE_RANDOM_MAXIMUM
    : NATIVE_MAGE_RANGE_RANDOM_MAXIMUM
  const draw = drawNativeFloat(sourceRngState, maximum)
  const nativeBase = Math.fround(base + draw.value)
  return {
    range: applyNativeRangedRangeMode(nativeBase, mode),
    rangeEasyPending: mode === 3,
    rngState: draw.state,
  }
}

export function applyNativeRangedRangeMode(
  range: number,
  mode: NativeRangedRangeMode,
): number {
  const nativeRange = Math.fround(range)
  switch (mode) {
    case 0: return nativeRange
    case 1:
    case 3:
      return Math.fround(nativeRange / NATIVE_RANGED_RANGE_DOWN_DIVISOR)
    case 2:
      return Math.fround(nativeRange * NATIVE_RANGED_RANGE_UP_FACTOR)
  }
}

export function restoreNativeRangeEasyAfterVolley(
  range: number,
  pending: boolean,
): Readonly<{ pending: boolean; range: number }> {
  if (!pending) return Object.freeze({ pending, range })
  return Object.freeze({
    pending: false,
    range: Math.fround(Math.fround(range) * NATIVE_RANGED_RANGE_DOWN_DIVISOR),
  })
}

export function nativeArcherFanOffset(arrowIndex: number): number {
  if (!Number.isSafeInteger(arrowIndex) || arrowIndex < 0) {
    throw new RangeError('Archer fan index must be a non-negative safe integer')
  }
  if (arrowIndex === 0) return 0
  const magnitude = Math.ceil(arrowIndex / 2) * NATIVE_ARCHER_FAN_STEP_DEG
  return arrowIndex % 2 === 1 ? -magnitude : magnitude
}

export function buildNativeArcherVolley(
  request: NativeArcherVolleyRequest,
  sourceSharedRngState: NativeRngState,
): NativeArcherVolley {
  validateVolleyRequest(request)

  const pitch = drawNativeFloat(
    sourceSharedRngState,
    Math.fround(0.1),
    true,
  )
  let sharedRngState = pitch.state
  let effectiveAccuracyMode: 0 | 1 | 2
  if (request.accuracyMode === 3) {
    const selected = drawNativeInteger(sharedRngState, 3)
    sharedRngState = selected.state
    effectiveAccuracyMode = selected.value as 0 | 1 | 2
  } else {
    effectiveAccuracyMode = request.accuracyMode
  }

  let privateRngState = createNativeRng(request.privateSeed)
  const dx = Math.fround(request.origin.x - request.targetPosition.x)
  const dy = Math.fround(request.origin.y - request.targetPosition.y)
  const sourceTargetDistance = Math.fround(Math.hypot(dx, dy))
  let aimPoint: BoneyardPoint = {
    x: Math.fround(request.targetPosition.x),
    y: Math.fround(request.targetPosition.y),
  }
  let aimOffsetRadius = 0
  if (effectiveAccuracyMode === 1) {
    const leadTicks = Math.fround(
      sourceTargetDistance / NATIVE_ARCHER_LEAD_SPEED_DIVISOR,
    )
    aimPoint = {
      x: Math.fround(
        aimPoint.x + Math.fround(leadTicks * request.targetVelocityPerTick.x),
      ),
      y: Math.fround(
        aimPoint.y + Math.fround(leadTicks * request.targetVelocityPerTick.y),
      ),
    }
  } else if (effectiveAccuracyMode === 2) {
    const radius = drawNativeFloat(privateRngState, NATIVE_ARCHER_SCATTER_RADIUS)
    const heading = drawNativeFloat(radius.state, 360)
    privateRngState = heading.state
    aimOffsetRadius = radius.value
    const vector = headingVector(heading.value)
    aimPoint = {
      x: Math.fround(aimPoint.x + Math.fround(radius.value * vector.x)),
      y: Math.fround(aimPoint.y + Math.fround(radius.value * vector.y)),
    }
  }

  let extraArrowCount = 0
  const threshold = NATIVE_ARCHER_MULTI_ARROW_THRESHOLDS[request.multiArrowMode]
  if (threshold > 0) {
    const gate = drawNativeInteger(privateRngState, 100)
    privateRngState = gate.state
    if (gate.value <= threshold) extraArrowCount = request.extraArrows
  }

  const baseHeading = nativeHeading(
    aimPoint.x - request.origin.x,
    aimPoint.y - request.origin.y,
  )
  const arrows: NativeArcherArrowBirth[] = []
  for (let arrowIndex = 0; arrowIndex <= extraArrowCount; arrowIndex += 1) {
    const fanOffset = nativeArcherFanOffset(arrowIndex)
    let jitteredFanOffset = 0
    if (fanOffset !== 0) {
      const fan = drawNativeFloatRange(
        privateRngState,
        Math.fround(fanOffset * NATIVE_ARCHER_FAN_JITTER_MINIMUM),
        Math.fround(fanOffset * NATIVE_ARCHER_FAN_JITTER_MAXIMUM),
      )
      privateRngState = fan.state
      jitteredFanOffset = fan.value
    }
    const headingDeg = positiveDegrees(Math.fround(baseHeading + jitteredFanOffset))
    const vector = headingVector(headingDeg)
    const speedDraw = drawNativeFloat(
      privateRngState,
      NATIVE_ARROW_SPEED_RANDOM_MAXIMUM,
    )
    privateRngState = speedDraw.state
    const speed = Math.fround(NATIVE_ARROW_SPEED_BASE + speedDraw.value)
    const lifetimeDraw = drawNativeFloat(
      privateRngState,
      NATIVE_ARROW_LIFETIME_RANDOM_MAXIMUM,
    )
    privateRngState = lifetimeDraw.state
    const lifetimeTicks = roundToNearestEven(
      (
        sourceTargetDistance
        + NATIVE_ARROW_LIFETIME_BASE
        + lifetimeDraw.value
      ) / speed,
    )
    arrows.push(Object.freeze({
      arrowType: request.arrowType,
      headingDeg,
      lifetimeTicks,
      position: Object.freeze({
        x: Math.fround(
          request.origin.x + Math.fround(vector.x * NATIVE_ARROW_FORWARD_ORIGIN),
        ),
        y: Math.fround(
          request.origin.y + Math.fround(vector.y * NATIVE_ARROW_FORWARD_ORIGIN),
        ),
      }),
      speed,
      visualHeadingDeg: headingDeg,
    }))
  }

  return Object.freeze({
    aimOffsetRadius,
    arrows: Object.freeze(arrows),
    effectiveAccuracyMode,
    sharedRngState,
    shotPitch: Math.fround(1 + pitch.value),
  })
}

function headingVector(headingDeg: number): BoneyardPoint {
  const radians = headingDeg * Math.PI / 180
  return {
    x: Math.fround(Math.sin(radians)),
    y: Math.fround(-Math.cos(radians)),
  }
}

function nativeHeading(x: number, y: number): number {
  return Math.fround(actorHeadingFromVector(Math.fround(x), Math.fround(y)))
}

function positiveDegrees(value: number): number {
  return Math.fround(((value % 360) + 360) % 360)
}

function roundToNearestEven(value: number): number {
  const floor = Math.floor(value)
  const fraction = value - floor
  if (fraction < 0.5) return floor
  if (fraction > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}

function validateVolleyRequest(request: NativeArcherVolleyRequest): void {
  if (
    !Number.isSafeInteger(request.extraArrows)
    || request.extraArrows < 0
    || request.extraArrows > 8
  ) throw new RangeError('Archer extra-arrow count must be within 0..8')
  if (
    !Number.isSafeInteger(request.privateSeed)
    || request.privateSeed < 0
    || request.privateSeed >= NATIVE_ARCHER_PRIVATE_SEED_BOUND
  ) throw new RangeError('Archer private seed must be within the native bound')
  for (const [label, point] of [
    ['origin', request.origin],
    ['target position', request.targetPosition],
    ['target velocity', request.targetVelocityPerTick],
  ] as const) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new RangeError(`Archer ${label} must be finite`)
    }
  }
}
