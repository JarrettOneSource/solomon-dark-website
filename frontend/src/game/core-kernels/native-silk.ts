import { compileNativeNaturalSpline, evaluateNativeNaturalSpline, type NativeNaturalSpline } from '../native-natural-spline.ts'
import type { BoneyardPoint } from './boneyard.ts'
import { drawNativeFloat, drawNativeFloatRange, drawNativeInteger, type NativeRngState } from './native-rng.ts'

export interface NativeSilkState {
  readonly forceAccumulator: number
  readonly ageTicks: number
  readonly phase: number
  readonly ended: boolean
  readonly position: Readonly<BoneyardPoint>
  readonly center: NativeNaturalSpline
  readonly wave: NativeNaturalSpline
  readonly height: number
  readonly alpha: number
  readonly waveScale: number
  readonly drift: Readonly<BoneyardPoint>
  readonly driftVelocity: Readonly<BoneyardPoint>
  readonly cocoonHealth: number
}

export interface NativeSilkTarget {
  readonly position: Readonly<BoneyardPoint>
  readonly velocityPerTick: Readonly<BoneyardPoint>
}

export interface NativeSilkCreation {
  readonly state: NativeSilkState
  readonly rngState: NativeRngState
  readonly soundIndex: number
  readonly soundPitch: number
  readonly soundPosition: Readonly<BoneyardPoint>
}

/** Silk constructor + initialize, 0x005F05D0/0x005F0790; both complete QuickSplines. */
export function createNativeSilk(
  position: Readonly<BoneyardPoint>,
  target: NativeSilkTarget,
  cocoonHealth: number,
  sourceRng: NativeRngState,
): NativeSilkCreation {
  const heightDraw = drawNativeFloat(sourceRng, 10)
  const unusedDraw = drawNativeFloat(heightDraw.state, 2)
  const lead = drawNativeFloatRange(unusedDraw.state, Math.fround(2.7), Math.fround(2.9))
  const distanceToTarget = Math.hypot(target.position.x - position.x, target.position.y - position.y)
  const aimed = {
    x: target.position.x + distanceToTarget / lead.value * target.velocityPerTick.x,
    y: target.position.y + distanceToTarget / lead.value * target.velocityPerTick.y,
  }
  const dx = aimed.x - position.x
  const dy = aimed.y - position.y
  const distance = Math.hypot(dx, dy)
  const direction = distance === 0 ? { x: 0, y: 0 } : { x: dx / distance, y: dy / distance }
  const extra = drawNativeFloat(lead.state, 300)
  const length = distance + 100 + extra.value
  const waves = drawNativeFloat(extra.state, 12)
  let rngState = waves.state
  const center: BoneyardPoint[] = []
  const wave: BoneyardPoint[] = []
  for (let t = 0; t < 1; t = Math.fround(t + Math.fround(0.05))) {
    center.push({
      x: Math.fround(position.x + length * direction.x * t),
      y: Math.fround(position.y + length * direction.y * t),
    })
    const amplitude = drawNativeFloat(rngState, 5)
    rngState = amplitude.state
    const offset = Math.sin(t * (20 + waves.value) * Math.PI) * (5 + amplitude.value)
    wave.push({ x: Math.fround(direction.y * offset), y: Math.fround(-direction.x * offset) })
  }
  const drift = drawNativeFloat(rngState, 2)
  const pitch = drawNativeFloat(drift.state, Math.fround(0.15000003576278687))
  const sound = drawNativeInteger(pitch.state, 3)
  return {
    state: {
      forceAccumulator: 0, ageTicks: 0, phase: 0, ended: false, position: { ...position },
      center: compileNativeNaturalSpline(center), wave: compileNativeNaturalSpline(wave),
      height: Math.fround(18 + heightDraw.value), alpha: 1, waveScale: 0.5,
      drift: { x: 0, y: 0 },
      driftVelocity: {
        x: Math.fround((drift.value - 1) * direction.y / 6),
        y: Math.fround(-(drift.value - 1) * direction.x / 6),
      },
      cocoonHealth,
    },
    rngState: sound.state,
    soundIndex: sound.value,
    soundPitch: Math.fround(Math.fround(0.95) + pitch.value),
    soundPosition: { x: position.x + direction.x * length * 0.5, y: position.y + direction.y * length * 0.5 },
  }
}

export function stepNativeSilk(source: NativeSilkState): NativeSilkState | null {
  const ageTicks = source.ageTicks + 1
  if (!source.ended && ageTicks % 4 === 0) return { ...source, ageTicks }
  let phase = source.phase
  let position = source.position
  let ended = source.ended
  const height = Math.fround(source.height * Math.fround(ended ? 0.98 : 0.995))
  let alpha = source.alpha
  let driftVelocity = source.driftVelocity
  if (!ended) {
    phase = Math.fround(phase + Math.fround(0.15))
    ended = phase > source.wave.extent
    const center = evaluateNativeNaturalSpline(source.center, phase)
    const wave = evaluateNativeNaturalSpline(source.wave, phase)
    position = { x: Math.fround(center.x + wave.x), y: Math.fround(center.y + wave.y) }
  } else {
    if (height < 0.25) alpha = Math.fround(alpha - Math.fround(0.01))
    if (alpha <= 0) return null
    const damping = Math.fround(height <= 1 ? 0.98 : 1.01)
    driftVelocity = {
      x: Math.fround(driftVelocity.x * damping),
      y: Math.fround(driftVelocity.y * damping),
    }
  }
  return {
    ...source, ageTicks, phase, position, ended, height, alpha, driftVelocity,
    drift: {
      x: Math.fround(source.drift.x + driftVelocity.x),
      y: Math.fround(source.drift.y + driftVelocity.y),
    },
    waveScale: phase > source.wave.extent / 3
      ? Math.fround(source.waveScale * Math.fround(0.995)) : source.waveScale,
  }
}
