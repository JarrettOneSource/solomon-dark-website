import {
  drawNativeFloat,
  drawNativeFloatRange,
  type NativeRngState,
} from './native-rng.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_HURRICANE_CHARGE_PER_TICK = 0.001500000013038516
export const NATIVE_HURRICANE_RELEASE_PER_TICK = 0.029999999329447746
export const NATIVE_HURRICANE_CONTACT_RADIUS = 280
export const NATIVE_HURRICANE_FULL_FORCE_RADIUS = 100
export const NATIVE_HURRICANE_FALLOFF_WIDTH = 180
export const NATIVE_HURRICANE_FORCE_PER_TICK = 1.5
export const NATIVE_HURRICANE_DEFAULT_MOVEMENT_STEP = 10
export const NATIVE_HURRICANE_CONTACT_COOLDOWN = 100
export const NATIVE_HURRICANE_LOW_CHARGE_THRESHOLD = 0.5
export const NATIVE_HURRICANE_LANE_COUNT = 8

const HURRICANE_FLOAT_BITS = new DataView(new ArrayBuffer(4))

export interface NativeHurricaneChargeTick {
  readonly contactCharge: number
  readonly nextCharge: number
  readonly refreshed: boolean
}

export interface NativeHurricaneLane {
  readonly angleDegrees: number
  readonly angularVelocityDegrees: number
  readonly radius: number
  readonly verticalOffset: number
}

export interface NativeHurricanePresentationProgram {
  readonly lanes: readonly NativeHurricaneLane[]
  readonly phaseDegrees: number
}

export interface NativeHurricanePresentationResult {
  readonly program: NativeHurricanePresentationProgram
  readonly rng: NativeRngState
}

export interface NativeHurricaneDamageResult {
  readonly damage: number
  readonly rng: NativeRngState
  readonly suppressHitSound: boolean
}

/** PlayerWizard +0x310 early-tick decay followed by the later Lightning refresh. */
export function nativeHurricaneChargeTick(
  charge: number,
  wasRefreshed: boolean,
  enabled: boolean,
  lightningActive: boolean,
): NativeHurricaneChargeTick {
  if (!Number.isFinite(charge) || charge < 0 || charge > 1) {
    throw new RangeError('Hurricane charge must be within [0,1]')
  }
  if (!enabled) return Object.freeze({ contactCharge: 0, nextCharge: 0, refreshed: false })
  const contactCharge = wasRefreshed
    ? Math.fround(charge)
    : Math.max(0, Math.fround(charge - NATIVE_HURRICANE_RELEASE_PER_TICK))
  return Object.freeze({
    contactCharge,
    nextCharge: lightningActive
      ? Math.min(1, Math.fround(contactCharge + NATIVE_HURRICANE_CHARGE_PER_TICK))
      : contactCharge,
    refreshed: lightningActive,
  })
}

/** PlayerWizard 0x00528DA0: exactly two float draws for each of eight lanes. */
export function createNativeHurricanePresentation(
  sourceRng: NativeRngState,
): NativeHurricanePresentationResult {
  let rng = sourceRng
  let angularVelocityDegrees = Math.fround(10)
  let radius = Math.fround(1.5)
  const lanes: NativeHurricaneLane[] = []
  for (let index = 0; index < NATIVE_HURRICANE_LANE_COUNT; index += 1) {
    const angle = drawNativeFloat(rng, 360)
    rng = angle.state
    const verticalOffset = drawNativeFloat(rng, 15)
    rng = verticalOffset.state
    lanes.push(Object.freeze({
      angleDegrees: angle.value,
      angularVelocityDegrees,
      radius,
      verticalOffset: verticalOffset.value,
    }))
    angularVelocityDegrees = Math.fround(angularVelocityDegrees * 0.75)
    radius = Math.fround(radius * 1.2000000476837158)
  }
  return Object.freeze({
    program: Object.freeze({ lanes: Object.freeze(lanes), phaseDegrees: 0 }),
    rng,
  })
}

/** PlayerWizard 0x00548B00/0x00528E30: one phase word, then deterministic lanes. */
export function stepNativeHurricanePresentation(
  source: NativeHurricanePresentationProgram,
  charge: number,
  sourceRng: NativeRngState,
): NativeHurricanePresentationResult {
  if (!Number.isFinite(charge) || charge <= 0 || charge > 1) {
    throw new RangeError('active Hurricane charge must be within (0,1]')
  }
  if (source.lanes.length !== NATIVE_HURRICANE_LANE_COUNT) {
    throw new RangeError('Hurricane presentation must own eight lanes')
  }
  const phaseStep = drawNativeFloatRange(sourceRng, 2, 3)
  const lanes = source.lanes.map((lane) => Object.freeze({
    ...lane,
    angleDegrees: Math.fround(
      lane.angleDegrees + lane.angularVelocityDegrees * charge * 0.75,
    ),
  }))
  return Object.freeze({
    program: Object.freeze({
      lanes: Object.freeze(lanes),
      phaseDegrees: Math.fround(source.phaseDegrees + phaseStep.value * charge),
    }),
    rng: phaseStep.state,
  })
}

export function nativeHurricaneMovementDue(
  objectSerial: number,
  tick: number,
  movementStep = NATIVE_HURRICANE_DEFAULT_MOVEMENT_STEP,
): boolean {
  if (!Number.isSafeInteger(objectSerial) || objectSerial < 0) {
    throw new RangeError('Hurricane target serial must be a non-negative safe integer')
  }
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('Hurricane tick must be a non-negative safe integer')
  }
  if (!Number.isSafeInteger(movementStep) || movementStep < 1) {
    throw new RangeError('Hurricane movement step must be a positive safe integer')
  }
  return objectSerial % movementStep === tick % movementStep
}

/** Badguy 0x0047CB20 clockwise tangent and native fast-distance falloff. */
export function nativeHurricaneOrbitForce(
  source: Readonly<Vector2>,
  target: Readonly<Vector2>,
  charge: number,
  movementStep = NATIVE_HURRICANE_DEFAULT_MOVEMENT_STEP,
): Readonly<Vector2> | null {
  if (!Number.isFinite(charge) || charge <= 0 || charge > 1) {
    throw new RangeError('active Hurricane charge must be within (0,1]')
  }
  if (!Number.isSafeInteger(movementStep) || movementStep < 1) {
    throw new RangeError('Hurricane movement step must be a positive safe integer')
  }
  const dx = Math.fround(source.x - target.x)
  const dy = Math.fround(source.y - target.y)
  const distanceSquared = Math.fround(dx * dx + dy * dy)
  if (distanceSquared >= NATIVE_HURRICANE_CONTACT_RADIUS ** 2) return null
  if (distanceSquared === 0) return Object.freeze({ x: 0, y: 0 })

  const distance = nativeHurricaneFastDistance(distanceSquared)
  const falloff = Math.fround(1 - Math.min(
    1,
    Math.max(0, Math.fround(distance - NATIVE_HURRICANE_FULL_FORCE_RADIUS))
      / NATIVE_HURRICANE_FALLOFF_WIDTH,
  ))
  const tangentLength = Math.sqrt(distanceSquared)
  const magnitude = movementStep * charge * NATIVE_HURRICANE_FORCE_PER_TICK * falloff
  return Object.freeze({
    x: Math.fround(dy / tangentLength * magnitude),
    y: Math.fround(-dx / tangentLength * magnitude),
  })
}

export function drawNativeHurricaneDamage(
  sourceRng: NativeRngState,
  charge: number,
  minimum: number,
  maximum: number,
): NativeHurricaneDamageResult {
  if (!Number.isFinite(charge) || charge <= 0 || charge > 1) {
    throw new RangeError('active Hurricane charge must be within (0,1]')
  }
  const draw = drawNativeFloatRange(sourceRng, minimum, maximum)
  return Object.freeze({
    damage: Math.fround(charge * charge * charge * draw.value),
    rng: draw.state,
    suppressHitSound: charge < NATIVE_HURRICANE_LOW_CHARGE_THRESHOLD,
  })
}

function nativeHurricaneFastDistance(distanceSquared: number): number {
  const half = Math.fround(distanceSquared * 0.5)
  let estimate = floatFromBits(0x5f3759df - (floatBits(distanceSquared) >>> 1))
  estimate = Math.fround((1.5 - estimate * estimate * half) * estimate)
  return Math.fround(1 / estimate)
}

function floatBits(value: number): number {
  HURRICANE_FLOAT_BITS.setFloat32(0, value, true)
  return HURRICANE_FLOAT_BITS.getUint32(0, true)
}

function floatFromBits(value: number): number {
  HURRICANE_FLOAT_BITS.setUint32(0, value >>> 0, true)
  return HURRICANE_FLOAT_BITS.getFloat32(0, true)
}
