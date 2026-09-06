import { evaluateNativeNaturalSpline } from '../native-natural-spline.ts'
import type { Vector2 } from './vector.ts'
import { nativeLineColor, nativeLineVertices } from './native-line.ts'
import { drawNativeFloat, drawNativeInteger, type NativeRngState } from './native-rng.ts'
import type { NativeSilkState } from './native-silk.ts'

export interface NativeSilkMesh {
  readonly vertices: readonly number[]
  readonly colors: readonly number[]
  readonly indices: readonly number[]
  readonly segmentCount: number
  readonly sparkleCount: number
}

export function nativeSilkCurvePoint(source: NativeSilkState, phase: number): Vector2 {
  const center = evaluateNativeNaturalSpline(source.center, phase)
  const wave = evaluateNativeNaturalSpline(source.wave, phase)
  return {
    x: Math.fround(center.x + Math.fround(wave.x * source.waveScale) + source.drift.x),
    y: Math.fround(center.y + Math.fround(wave.y * source.waveScale) + source.drift.y - source.height - 1),
  }
}

/** Silk::Render 0x00606A10 retains sixteen spline units behind the current phase. */
export function nativeSilkMesh(
  source: NativeSilkState,
  lightAt: (position: Readonly<Vector2>) => number,
  sourceRng: NativeRngState,
): NativeSilkMesh {
  const vertices: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  let rng = sourceRng
  let segmentCount = 0
  let sparkleCount = 0
  if (source.phase <= 0) return { vertices, colors, indices, segmentCount, sparkleCount }
  const lower = Math.max(0, source.phase - 16)
  const span = source.phase - lower
  const step = Math.fround(4 / source.waveScale) * Math.fround(0.1)
  const headLight = lightAt(evaluateNativeNaturalSpline(source.center, source.phase))
  const tailLight = lightAt(evaluateNativeNaturalSpline(source.center, lower))
  let cursor = source.phase
  let fraction = 1
  let firstAlpha = 0
  let secondAlpha = Math.fround(source.alpha * 0.5)
  do {
    const next = Math.fround(cursor - step)
    const headFraction = Math.fround((cursor - lower) / span)
    const tailFraction = Math.fround(Math.max(0, next - lower) / span)
    const firstLight = Math.fround(tailLight * (1 - headFraction) + headLight * headFraction)
    const secondLight = Math.fround(tailLight * (1 - tailFraction) + headLight * tailFraction)
    const first = nativeSilkCurvePoint(source, cursor)
    const second = nativeSilkCurvePoint(source, next)
    if (first.x !== second.x || first.y !== second.y) {
      append(nativeLineVertices(first, second, 2), [
        nativeLineColor(Math.fround(0.95) * firstLight, firstLight, firstLight, firstAlpha),
        nativeLineColor(Math.fround(0.95) * firstLight, firstLight, firstLight, firstAlpha),
        nativeLineColor(Math.fround(0.95) * secondLight, secondLight, secondLight, secondAlpha),
        nativeLineColor(Math.fround(0.95) * secondLight, secondLight, secondLight, secondAlpha),
      ])
    }
    const sparkle = drawNativeInteger(rng, 3)
    rng = sparkle.state
    if (sparkle.value === 1 && segmentCount > 0) {
      const alpha = drawNativeFloat(rng, Math.fround(source.alpha * fraction))
      const position = drawNativeFloat(alpha.state, 1)
      rng = position.state
      const x = first.x + (second.x - first.x) * position.value - 0.5
      const y = first.y + (second.y - first.y) * position.value - 0.5
      const color = nativeLineColor(1, 1, 1, alpha.value * firstLight)
      append([x, y, x + 1, y, x, y + 1, x + 1, y + 1], [color, color, color, color])
      sparkleCount += 1
    }
    segmentCount += 1
    firstAlpha = Math.fround(fraction * Math.fround(source.alpha * 0.5))
    fraction = Math.fround((next - lower) / span)
    secondAlpha = Math.fround(fraction * Math.fround(source.alpha * 0.5))
    cursor = next
  } while (fraction > 0 && cursor >= lower)
  return { vertices, colors, indices, segmentCount, sparkleCount }

  function append(quad: readonly number[], color: readonly number[]): void {
    const offset = vertices.length / 2
    vertices.push(...quad)
    colors.push(...color)
    indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 2, offset + 3)
  }
}
