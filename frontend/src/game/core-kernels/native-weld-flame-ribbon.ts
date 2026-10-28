/**
 * Flame factory 0x531F00 / retained record-25 builder 0x52E020.
 * Report 116 contract v2 and its recovered-contract addendum pin these stores.
 * This is a static-source projection, not a clean-retail runtime golden trace.
 * Birth sampling belongs to the authoritative caller; this module has no RNG
 * dependency and never substitutes actor IDs or render time for retained data.
 */
export interface NativeFlameLashPoint {
  readonly x: number
  readonly y: number
}

export interface NativeFlameLashFactoryInput {
  readonly start: NativeFlameLashPoint
  readonly control: NativeFlameLashPoint
  readonly end: NativeFlameLashPoint
  readonly offset: NativeFlameLashPoint
}

export interface NativeFlameLashFactoryGeometry {
  readonly kind: 'short' | 'long'
  readonly start: NativeFlameLashPoint
  readonly control: NativeFlameLashPoint
  /** Factory extension before the body-only offset. */
  readonly extendedEnd: NativeFlameLashPoint
  readonly bodyEnd: NativeFlameLashPoint
  readonly span: number
  readonly splitBounds: Readonly<{ x: number; y: number; width: number; height: number }>
}

export interface NativeFlameLashRibbonInput extends NativeFlameLashFactoryInput {
  readonly width: number
  readonly weak: boolean
  /** Retained birth quality, not the live split-painter quality. */
  readonly enhancedEffects: boolean
  readonly phaseDegrees: number
  /** The retained f32(.75 + Float(.25)); null only on the long branch. */
  readonly shortWidthFactor: number | null
}

export interface NativeFlameLashRibbon {
  readonly record: 25
  readonly kind: NativeFlameLashFactoryGeometry['kind']
  readonly vertices: Float32Array
  readonly indices: Uint16Array
  /** Absolute UVs on the 2048-square BadGuys atlas. */
  readonly uvs: Float32Array
  /** Native packed ARGB, including transparent long caps. */
  readonly colors: Uint32Array
  readonly parameters: Float32Array
}

type SplinePoints = readonly [NativeFlameLashPoint, NativeFlameLashPoint, NativeFlameLashPoint]
type AxisCoefficients = readonly [
  readonly [number, number, number, number],
  readonly [number, number, number, number],
]

const f32 = Math.fround
const NORMAL_DELTA = f32(.001)
// Math+4, bytes da 0f 49 40, not Math.fround(Math.PI). Ledger 297:1866–1877.
const NATIVE_PI = 3.141592502593994
const FLOAT_BITS = new DataView(new ArrayBuffer(4))
const RECORD25_U_LEFT = .859375
const RECORD25_U_RIGHT = .86865234375
const RECORD25_V_TOP = .728515625
const RECORD25_V_BOTTOM = .73828125

export function nativeFlameLashBirthPhase(birthTick: number): number {
  // 0x5321C1–0x5321DD: integer multiplication/overflow precedes float storage.
  return f32(Math.imul(birthTick, -3))
}

export function nativeFlameLashFactoryGeometry(
  input: NativeFlameLashFactoryInput,
): NativeFlameLashFactoryGeometry {
  const start = storedPoint(input.start)
  const control = storedPoint(input.control)
  const end = storedPoint(input.end)
  const direction = normalized(difference(end, control))
  const extension = scaled(direction, 15)
  const extendedEnd = added(end, extension)
  const bodyEnd = added(extendedEnd, storedPoint(input.offset))
  const span = length(difference(bodyEnd, start))
  // Native Rect(S.x,S.y,1,1), union zero-size M and Eprime, then pad 100.
  // O and displaced mesh extrema are intentionally absent from this owner.
  const left = Math.min(start.x, control.x, extendedEnd.x)
  const top = Math.min(start.y, control.y, extendedEnd.y)
  const right = Math.max(f32(start.x + 1), control.x, extendedEnd.x)
  const bottom = Math.max(f32(start.y + 1), control.y, extendedEnd.y)
  return {
    kind: span < 75 ? 'short' : 'long',
    start,
    control,
    extendedEnd,
    bodyEnd,
    span,
    splitBounds: {
      x: f32(left - 100), y: f32(top - 100),
      width: f32(f32(right - left) + 200), height: f32(f32(bottom - top) + 200),
    },
  }
}

/** Ordered birth-only membership; each returned point needs its own radius word. */
export function nativeFlameLashPathPoints(
  geometry: NativeFlameLashFactoryGeometry,
  maximumPoints = 1_024,
): readonly NativeFlameLashPoint[] {
  requireBudget(maximumPoints)
  const points: NativeFlameLashPoint[] = []
  const consider = (candidate: NativeFlameLashPoint) => {
    const delta = difference(candidate, geometry.start)
    if (f32(delta.x * delta.x + delta.y * delta.y) >= 48_400) {
      if (points.length >= maximumPoints) throw new RangeError('Flame path exceeds its point budget')
      points.push({ x: candidate.x, y: f32(candidate.y + 35) })
    }
  }
  for (const [start, end] of [
    [geometry.start, geometry.control],
    [geometry.control, geometry.extendedEnd],
  ] as const) {
    const delta = difference(end, start)
    let remaining = length(delta)
    if (!Number.isFinite(remaining)) throw new RangeError('Invalid Flame path length')
    const step = scaled(normalized(delta), 100)
    let current = start
    while (remaining > 50) {
      consider(current)
      const next = added(current, step)
      const nextRemaining = f32(remaining - 100)
      // Valid transported coordinates must be able to make the native step.
      // Fail closed rather than hang on overflow or unrepresentable progress.
      if (nextRemaining === remaining || (next.x === current.x && next.y === current.y)) {
        throw new RangeError('Flame path cannot advance at float32 precision')
      }
      current = next
      remaining = nextRemaining
    }
    // Each leg explicitly considers its endpoint. Never deduplicate the M
    // endpoint followed by the second leg's first sample.
    consider(end)
  }
  return points
}

/** Website resource admission only; the numeric recurrence is the native one. */
export function nativeFlameLashRibbonPairCount(
  geometry: NativeFlameLashFactoryGeometry,
  enhancedEffects: boolean,
  maximumPairs = 4_096,
): number {
  requireBudget(maximumPairs)
  if (geometry.kind === 'short') {
    if (maximumPairs < 3) throw new RangeError('Flame ribbon exceeds its pair budget')
    return 3
  }
  return parameterSamples(geometry.start, geometry.control, enhancedEffects ? 7 : 30, maximumPairs).length
}

export function nativeFlameLashSplinePoint(points: SplinePoints, parameter: number): NativeFlameLashPoint {
  return splinePoint(splineAxes(points), f32(parameter))
}

export function nativeFlameLashSplineNormal(points: SplinePoints, parameter: number): NativeFlameLashPoint {
  return splineNormal(splineAxes(points), f32(parameter))
}

/** Private builder stream. Signed remainders and INT_MIN survive the abs step. */
export function nativeFlameLashPrivateSample(state: number): {
  angleDegrees: number
  radius: number
  nextState: number
} {
  const seed = state | 0
  // 0x52EC3F–0x52EC69: no intermediate float store between divide and *65.
  const angleMagnitude = f32((seed % 360_000) / 360_000 * 65)
  const signState = signedAbs32(mix32(seed))
  const radiusState = signedAbs32(mix32(signState))
  return {
    // 0x52EC81–0x52ECA3: signed remainder compared with +1, not != 0.
    angleDegrees: signState % 2 === 1 ? f32(-angleMagnitude) : angleMagnitude,
    radius: f32((radiusState % 360_000) / 360_000 * 5),
    nextState: signedAbs32(mix32(radiusState)),
  }
}

export function buildNativeFlameLashRibbon(input: NativeFlameLashRibbonInput): NativeFlameLashRibbon {
  const geometry = nativeFlameLashFactoryGeometry(input)
  const short = geometry.kind === 'short'
  if (short && (input.shortWidthFactor === null || !Number.isFinite(input.shortWidthFactor))) {
    throw new RangeError('Short Flame geometry requires its retained birth width factor')
  }
  const parameters = short
    ? Float32Array.from([0, 1, 2])
    : parameterSamples(geometry.start, geometry.control, input.enhancedEffects ? 7 : 30)
  const pairCount = parameters.length
  if (pairCount * 2 > 65_536) throw new RangeError('Flame ribbon exceeds native uint16 vertex indices')
  const vertices = new Float32Array(pairCount * 4)
  const uvs = new Float32Array(pairCount * 4)
  const colors = new Uint32Array(pairCount * 2)
  const indices = new Uint16Array((pairCount - 1) * 6)
  const bodyColor = input.weak ? 0x7fffffff : 0xffffffff
  const width = f32(input.width)

  if (short) {
    const delta = difference(geometry.bodyEnd, geometry.start)
    const normal = normalized({ x: delta.y, y: f32(-delta.x) })
    const halfWidth = f32(f32(f32(width * 65) * .5) * f32(input.shortWidthFactor!))
    const middle = scaled(added(geometry.start, geometry.bodyEnd), .5)
    for (const [pair, center] of [geometry.start, middle, geometry.bodyEnd].entries()) {
      writePair(vertices, pair, center, normal, halfWidth)
      writeStyle(uvs, colors, pair, bodyColor, pair === 1)
    }
  } else {
    const axes = splineAxes([geometry.start, geometry.control, geometry.bodyEnd])
    const phase = f32(input.phaseDegrees)
    let privateState = Math.trunc(phase) | 0
    const baseHalfWidth = f32(f32(width * 100) * .5)
    const amplitude = geometry.span < 250 ? f32(geometry.span / 250 * 16) : 16
    for (let pair = 0; pair < pairCount; pair += 1) {
      const parameter = parameters[pair]!
      const normal = splineNormal(axes, parameter)
      const first = pair === 0
      const last = pair === pairCount - 1
      if (first || last) {
        const center = first ? geometry.start : geometry.bodyEnd
        const shift = first ? scaled({ x: normal.y, y: f32(-normal.x) }, 25) : undefined
        writePair(vertices, pair, center, normal, baseHalfWidth, shift)
        writeStyle(uvs, colors, pair, 0, false)
        continue
      }
      // 0x52EA4A–0x52EC2E stores the degree/radian/sine and vector products;
      // combining these as one scalar displacement would lose those stores.
      const envelope = sineDegrees(f32(parameter / 2 * 180))
      let center = splinePoint(axes, parameter)
      const primarySine = sineDegrees(f32(parameter * 360 + phase))
      center = added(center, scaled(scaled(scaled(normal, primarySine), amplitude), envelope))
      const secondarySine = sineDegrees(f32(phase * 2.5 - parameter * 90))
      center = added(center, scaled(scaled(scaled(normal, secondarySine), 8), envelope))
      const sample = nativeFlameLashPrivateSample(privateState)
      privateState = sample.nextState
      const jitter = scaled(scaled(directionDegrees(sample.angleDegrees), sample.radius), envelope)
      center = added(center, jitter)
      const halfWidth = f32(((1 - envelope) * .75 + .5) * baseHalfWidth)
      writePair(vertices, pair, center, normal, halfWidth)
      writeStyle(uvs, colors, pair, bodyColor, true)
    }
  }
  for (let pair = 0; pair < pairCount - 1; pair += 1) {
    const left = pair * 2
    indices.set([left, left + 1, left + 2, left + 2, left + 1, left + 3], pair * 6)
  }
  return { record: 25, kind: geometry.kind, vertices, indices, uvs, colors, parameters }
}

function storedPoint(point: NativeFlameLashPoint): NativeFlameLashPoint {
  const x = f32(point.x)
  const y = f32(point.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('Flame coordinates must be finite float32 values')
  return { x, y }
}

function added(a: NativeFlameLashPoint, b: NativeFlameLashPoint): NativeFlameLashPoint {
  return { x: f32(a.x + b.x), y: f32(a.y + b.y) }
}

function difference(a: NativeFlameLashPoint, b: NativeFlameLashPoint): NativeFlameLashPoint {
  return { x: f32(a.x - b.x), y: f32(a.y - b.y) }
}

function scaled(point: NativeFlameLashPoint, scale: number): NativeFlameLashPoint {
  return { x: f32(point.x * scale), y: f32(point.y * scale) }
}

function length(point: NativeFlameLashPoint): number {
  const squaredLength = f32(point.x * point.x + point.y * point.y)
  return f32(Math.sqrt(squaredLength))
}

function normalized(point: NativeFlameLashPoint): NativeFlameLashPoint {
  const magnitude = length(point)
  if (magnitude === 0) return { x: 0, y: 0 }
  const reciprocal = f32(1 / magnitude)
  return scaled(point, reciprocal)
}

function splineAxes(points: SplinePoints): readonly [AxisCoefficients, AxisCoefficients] {
  return [
    splineAxis(f32(points[0].x), f32(points[1].x), f32(points[2].x)),
    splineAxis(f32(points[0].y), f32(points[1].y), f32(points[2].y)),
  ]
}

function splineAxis(p0: number, p1: number, p2: number): AxisCoefficients {
  // Native named stores; Horner intermediates below deliberately stay unrounded.
  const firstForward = f32((p1 - p0) * 3 * .25)
  const secondForward = f32(((p2 - p0) * 3 - firstForward) * .25)
  const thirdForward = f32(((p2 - p1) * 3 - secondForward) * .25)
  const thirdTangent = thirdForward
  const secondTangent = f32(secondForward - thirdTangent * .25)
  const firstTangent = f32(firstForward - secondTangent * .25)
  return [
    [p0, firstTangent, f32(3 * (p1 - p0) - 2 * firstTangent - secondTangent),
      f32(2 * (p0 - p1) + firstTangent + secondTangent)],
    [p1, secondTangent, f32(3 * (p2 - p1) - 2 * secondTangent - thirdTangent),
      f32(2 * (p1 - p2) + secondTangent + thirdTangent)],
  ]
}

function splinePoint(axes: readonly [AxisCoefficients, AxisCoefficients], parameter: number): NativeFlameLashPoint {
  const segment = parameter < 1 ? 0 : 1
  const local = parameter >= 2 ? 1 : f32(parameter - segment)
  const evaluate = (axis: AxisCoefficients) => {
    if (parameter < 0) return axis[0][0]
    const [p, a, b, c] = axis[segment]
    return f32(p + local * (a + local * (b + local * c)))
  }
  return { x: evaluate(axes[0]), y: evaluate(axes[1]) }
}

function splineNormal(axes: readonly [AxisCoefficients, AxisCoefficients], parameter: number): NativeFlameLashPoint {
  const currentParameter = Math.max(parameter, NORMAL_DELTA)
  const previousParameter = f32(currentParameter - NORMAL_DELTA)
  const delta = difference(splinePoint(axes, currentParameter), splinePoint(axes, previousParameter))
  return normalized({ x: delta.y, y: f32(-delta.x) })
}

function parameterSamples(
  start: NativeFlameLashPoint, control: NativeFlameLashPoint, spacing: number, maximumPairs = 4_096,
): Float32Array {
  const delta = difference(control, start)
  const squaredDistance = f32(delta.x * delta.x + delta.y * delta.y)
  const halfSquaredDistance = f32(squaredDistance * .5)
  FLOAT_BITS.setFloat32(0, squaredDistance, true)
  const bits = FLOAT_BITS.getUint32(0, true)
  FLOAT_BITS.setUint32(0, (0x5f3759df - (bits >>> 1)) >>> 0, true)
  const estimate = FLOAT_BITS.getFloat32(0, true)
  const inverseDistance = f32(estimate * (1.5 - estimate * halfSquaredDistance * estimate))
  const firstLegDistance = f32(1 / inverseDistance)
  const ratio = f32(firstLegDistance / spacing)
  const step = Math.min(.5, f32(2 / ratio))
  if (!(step > 0) || !Number.isFinite(step)) throw new RangeError('Invalid Flame first-leg sample step')
  const parameters: number[] = []
  // 0x52E9F3–0x52EA06 compares against the un-stored (2-step).
  for (let parameter = 0; parameter < 2 - step; parameter = f32(parameter + step)) {
    parameters.push(parameter)
    if (parameters.length >= maximumPairs) throw new RangeError('Flame ribbon exceeds its pair budget')
  }
  parameters.push(2)
  return Float32Array.from(parameters)
}

function requireBudget(budget: number): void {
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > 32_768) {
    throw new RangeError('Flame geometry budget must be an integer in [1,32768]')
  }
}

function mix32(state: number): number {
  let word = state | 0
  word ^= word << 21
  word ^= word >>> 11
  word ^= word << 4
  return Math.imul(word, 0x0a67cfcf)
}

function signedAbs32(value: number): number {
  return value < 0 ? (-value) | 0 : value
}

function sineDegrees(degrees: number): number {
  return f32(Math.sin(f32(degrees * NATIVE_PI / 180)))
}

function directionDegrees(degrees: number): NativeFlameLashPoint {
  const radians = f32(degrees * NATIVE_PI / 180)
  return { x: f32(Math.sin(radians)), y: f32(-Math.cos(radians)) }
}

function writePair(
  vertices: Float32Array, pair: number, center: NativeFlameLashPoint,
  normal: NativeFlameLashPoint, halfWidth: number, shift?: NativeFlameLashPoint,
): void {
  const lateral = scaled(normal, halfWidth)
  const left = added(center, lateral)
  const right = difference(center, lateral)
  const shiftedLeft = shift ? added(left, shift) : left
  const shiftedRight = shift ? added(right, shift) : right
  vertices.set([shiftedLeft.x, shiftedLeft.y, shiftedRight.x, shiftedRight.y], pair * 4)
}

function writeStyle(uvs: Float32Array, colors: Uint32Array, pair: number, color: number, bottom: boolean): void {
  const v = bottom ? RECORD25_V_BOTTOM : RECORD25_V_TOP
  uvs.set([RECORD25_U_LEFT, v, RECORD25_U_RIGHT, v], pair * 4)
  colors.fill(color, pair * 2, pair * 2 + 2)
}
