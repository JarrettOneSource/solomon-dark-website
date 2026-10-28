/** Native Imp bodies are four complete 12-facing pose banks. */
export const NATIVE_IMP_BODY_POSE_COUNT = 4
/** BadGuys 333..342 are the ten recovered Imp upper-effect records. */
export const NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT = 10

export interface NativeImpFlightState {
  readonly baseHorizontalSpeed: number
  readonly bodyRotationDeg: number
  readonly bodyVariant: number
  readonly effectAlpha: number
  readonly effectPhase: number
  readonly horizontalSpeed: number
  readonly verticalOffset: number
  readonly verticalVelocity: number
}

export interface NativeImpFlightStep {
  readonly bounced: boolean
  readonly state: NativeImpFlightState
}

/** Constructor 0x00473E30, restricted to fields consumed by renderer 0x00492E10. */
export function createNativeImpFlightState(
  random: () => number,
  baseHorizontalSpeed: number,
): NativeImpFlightState {
  requirePositiveFinite(baseHorizontalSpeed, 'Imp base horizontal speed')
  const effectPhase = random() * NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT
  const bodyVariant = randomInteger(random, NATIVE_IMP_BODY_POSE_COUNT)
  const bodyRotationDeg = signedRandom(random, 45)
  return {
    baseHorizontalSpeed,
    bodyRotationDeg,
    bodyVariant,
    effectAlpha: 0,
    effectPhase,
    horizontalSpeed: baseHorizontalSpeed,
    verticalOffset: 0,
    verticalVelocity: 0,
  }
}

/** Fixed-tick flight fields from Imp::Tick 0x00485DC0. */
export function stepNativeImpFlight(
  source: NativeImpFlightState,
  random: () => number,
): NativeImpFlightStep {
  requirePositiveFinite(source.baseHorizontalSpeed, 'Imp base horizontal speed')
  requirePositiveFinite(source.horizontalSpeed, 'Imp horizontal speed')

  let effectPhase = positiveModulo(
    source.effectPhase + Math.abs(source.horizontalSpeed) * 0.25,
    NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT,
  )
  let verticalOffset = source.verticalOffset + source.verticalVelocity
  let verticalVelocity = source.verticalVelocity + 0.4
  let effectAlpha = Math.max(0, source.effectAlpha - 0.05)
  let horizontalSpeed = source.horizontalSpeed
  let bodyRotationDeg = source.bodyRotationDeg
  let bodyVariant = source.bodyVariant
  let bounced = false

  if (verticalOffset > 0) {
    bounced = true
    horizontalSpeed = source.baseHorizontalSpeed * (1 + random() * 1.5)
    verticalOffset = 0
    verticalVelocity = -(3 + random() * 3)
    bodyVariant = randomInteger(random, NATIVE_IMP_BODY_POSE_COUNT)
    bodyRotationDeg = signedRandom(random, 60)
    effectAlpha = 1
    if (randomInteger(random, 20) === 3) verticalVelocity *= 1.5
  }

  return {
    bounced,
    state: {
      baseHorizontalSpeed: source.baseHorizontalSpeed,
      bodyRotationDeg,
      bodyVariant,
      effectAlpha,
      effectPhase,
      horizontalSpeed,
      verticalOffset,
      verticalVelocity,
    },
  }
}

export function nativeImpEffectFrame(effectPhase: number): number {
  if (!Number.isFinite(effectPhase)) {
    throw new RangeError('Imp effect phase must be finite')
  }
  return Math.min(
    NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT - 1,
    Math.max(0, Math.trunc(effectPhase)),
  )
}

function randomInteger(random: () => number, count: number): number {
  return Math.min(count - 1, Math.floor(random() * count))
}

function signedRandom(random: () => number, magnitude: number): number {
  const value = random() * magnitude
  return random() < 0.5 ? -value : value
}

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}

function requirePositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive`)
  }
}
