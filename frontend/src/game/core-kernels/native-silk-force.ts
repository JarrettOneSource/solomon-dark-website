import type { Vector2 } from './vector.ts'
import { evaluateNativeNaturalSpline } from '../native-natural-spline.ts'
import { directionFromHeading } from './primary-spell-targeting.ts'
import { drawNativeFloat, type NativeRngState } from './native-rng.ts'
import type { NativeSilkState } from './native-silk.ts'

export interface NativeFadeLineState {
  readonly start: Readonly<Vector2>
  readonly middle: Readonly<Vector2>
  readonly end: Readonly<Vector2>
  readonly velocity: Readonly<Vector2>
  readonly opacity: number
  readonly opacityLossPerTick: number
}

export interface NativeFadeLineActor {
  readonly id: number
  readonly spawnTick: number
  readonly state: NativeFadeLineState
}

/** Silk::Force 0x005F92C0 transfers illuminated trail segments to Anim_FadeLine. */
export function createNativeSilkFragments(
  silk: NativeSilkState,
  forceDirection: Readonly<Vector2>,
  lightAt: (position: Readonly<Vector2>) => number,
  sourceRng: NativeRngState,
): Readonly<{ fragments: readonly NativeFadeLineState[]; rngState: NativeRngState }> {
  const fragments: NativeFadeLineState[] = []
  let rngState = sourceRng
  const lower = Math.max(0, silk.phase - 16)
  const step = Math.fround(4 / silk.waveScale) * 0.4000000059604645
  const heading = Math.atan2(forceDirection.x, -forceDirection.y) * 180 / Math.PI
  for (let cursor = silk.phase; cursor > lower; cursor = Math.fround(cursor - step)) {
    const start = fragmentPoint(silk, cursor)
    const end = fragmentPoint(silk, Math.fround(cursor - step))
    const middle = fragmentPoint(silk, Math.fround(cursor - step * 0.5))
    const endpointMean = {
      x: Math.fround((start.x + end.x) * 0.5),
      y: Math.fround((start.y + end.y) * 0.5),
    }
    const light = lightAt(endpointMean)
    if (light <= 0) continue
    const falloff = Math.fround(1 - Math.min(1, Math.hypot(
      endpointMean.x - silk.position.x, endpointMean.y - silk.position.y,
    ) / 300))
    const angle = drawNativeFloat(rngState, 5, true)
    const direction = directionFromHeading(Math.fround(heading + angle.value))
    const speed = drawNativeFloat(angle.state, 0.09999990463256836)
    const opacity = drawNativeFloat(speed.state, Math.fround(0.55))
    const loss = drawNativeFloat(opacity.state, Math.fround(0.05))
    rngState = loss.state
    const magnitude = Math.fround(1.9500000476837158 + speed.value)
    fragments.push({
      start, middle, end,
      velocity: {
        x: Math.fround(Math.fround(falloff * direction.x) * magnitude),
        y: Math.fround(Math.fround(falloff * direction.y) * magnitude),
      },
      opacity: Math.fround(Math.fround(Math.fround(0.95) + opacity.value) * light * Math.fround(0.35)),
      opacityLossPerTick: Math.fround((Math.fround(0.2) - loss.value) * Math.fround(0.1)),
    })
  }
  return { fragments, rngState }
}

/** Anim_FadeLine::Tick 0x004557A0 has constant velocity and linear opacity loss. */
export function stepNativeFadeLine(source: NativeFadeLineState): NativeFadeLineState | null {
  const opacity = Math.fround(source.opacity - source.opacityLossPerTick)
  if (opacity <= 0) return null
  const translate = (point: Readonly<Vector2>): Vector2 => ({
    x: Math.fround(point.x + source.velocity.x),
    y: Math.fround(point.y + source.velocity.y),
  })
  return {
    ...source, opacity,
    start: translate(source.start), middle: translate(source.middle), end: translate(source.end),
  }
}

function fragmentPoint(silk: NativeSilkState, phase: number): Vector2 {
  const center = evaluateNativeNaturalSpline(silk.center, phase)
  const wave = evaluateNativeNaturalSpline(silk.wave, phase)
  return {
    x: Math.fround(center.x + Math.fround(wave.x * silk.waveScale) - silk.height),
    y: Math.fround(center.y + Math.fround(wave.y * silk.waveScale) - silk.height),
  }
}
