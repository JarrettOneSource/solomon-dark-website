export interface NativeSplinePoint {
  readonly x: number
  readonly y: number
}

interface NativeSplineAxis {
  readonly points: readonly number[]
  readonly coefficients: readonly [number, number, number][]
}

export interface NativeNaturalSpline {
  readonly extent: number
  readonly x: NativeSplineAxis
  readonly y: NativeSplineAxis
}

function compileAxis(points: readonly number[]): NativeSplineAxis {
  if (points.length < 2) throw new Error('a native spline needs at least two points')

  const segments = points.length - 1
  const alpha = new Float64Array(points.length)
  for (let index = 1; index < segments; index += 1) {
    alpha[index] = 3 * (points[index + 1] - points[index])
      - 3 * (points[index] - points[index - 1])
  }

  const lower = new Float64Array(points.length)
  const ratio = new Float64Array(points.length)
  const solution = new Float64Array(points.length)
  lower[0] = 1
  for (let index = 1; index < segments; index += 1) {
    lower[index] = 4 - ratio[index - 1]
    ratio[index] = 1 / lower[index]
    solution[index] = (alpha[index] - solution[index - 1]) / lower[index]
  }
  lower[segments] = 1

  const curvature = new Float64Array(points.length)
  const coefficients: [number, number, number][] = Array.from(
    { length: segments },
    () => [0, 0, 0],
  )
  for (let index = segments - 1; index >= 0; index -= 1) {
    curvature[index] = solution[index] - ratio[index] * curvature[index + 1]
    const linear = points[index + 1] - points[index]
      - (curvature[index + 1] + 2 * curvature[index]) / 3
    coefficients[index] = [
      linear,
      curvature[index],
      (curvature[index + 1] - curvature[index]) / 3,
    ]
  }
  return { coefficients, points }
}

function evaluateAxis(axis: NativeSplineAxis, cursor: number): number {
  if (cursor <= 0) return axis.points[0]
  const maximum = axis.points.length - 1
  if (cursor >= maximum) return axis.points[maximum]
  const segment = Math.floor(cursor)
  const progress = cursor - segment
  const [linear, quadratic, cubic] = axis.coefficients[segment]
  return axis.points[segment]
    + progress * (linear + progress * (quadratic + progress * cubic))
}

export function compileNativeNaturalSpline(
  points: readonly NativeSplinePoint[],
): NativeNaturalSpline {
  return {
    extent: points.length - 1,
    x: compileAxis(points.map((point) => point.x)),
    y: compileAxis(points.map((point) => point.y)),
  }
}

export function evaluateNativeNaturalSpline(
  spline: NativeNaturalSpline,
  cursor: number,
): NativeSplinePoint {
  return {
    x: evaluateAxis(spline.x, cursor),
    y: evaluateAxis(spline.y, cursor),
  }
}
