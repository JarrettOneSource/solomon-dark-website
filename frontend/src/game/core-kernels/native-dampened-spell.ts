import { actorHeadingFromVector } from './actor-heading.ts'
import { drawNativeFloat, drawNativeFloatRange, drawNativeInteger, type NativeRngState } from './native-rng.ts'
import type { Vector2 } from './vector.ts'

export interface NativeDampenedSpellState {
  readonly headingDeg: number
  readonly phaseDeg: number
  readonly position: Vector2
  readonly velocity: Vector2
}

export function createNativeDampenedSpell(origin: Vector2, position: Vector2, rng: NativeRngState): {
  rng: NativeRngState; state: NativeDampenedSpellState
} {
  const phase = drawNativeFloat(rng, 360)
  const x = Math.fround(position.x - origin.x)
  const y = Math.fround(position.y - origin.y)
  const distance = Math.hypot(x, y)
  return { rng: phase.state, state: {
    headingDeg: -1,
    phaseDeg: phase.value,
    position,
    velocity: distance === 0 ? { x: 0, y: 0 } : {
      x: Math.fround(x / distance * 7), y: Math.fround(y / distance * 7),
    },
  } }
}

/** Anim_DampenedSpell 0x0045A030 emits a stationary Fade even on its final tick. */
export function stepNativeDampenedSpell(source: NativeDampenedSpellState, variant: number,
  sourceRng: NativeRngState) {
  const position = { x: Math.fround(source.position.x + source.velocity.x),
    y: Math.fround(source.position.y + source.velocity.y) }
  const state = { ...source, position, phaseDeg: Math.fround(source.phaseDeg + 5),
    headingDeg: source.headingDeg === -1
      ? actorHeadingFromVector(source.velocity.x, source.velocity.y) : source.headingDeg }
  let rng = sourceRng
  const float = (maximum: number) => {
    const draw = drawNativeFloat(rng, maximum)
    rng = draw.state
    return draw.value
  }
  let entry = 10
  let rotationDeg: number
  let scale: number
  let alphaLossPerTick: number
  let tint: number
  if (variant === 3) {
    const record = drawNativeInteger(rng, 2)
    rng = record.state
    entry += record.value
    rotationDeg = float(360)
    const size = drawNativeFloatRange(rng, Math.fround(.6), Math.fround(.8))
    rng = size.state
    scale = size.value
    alphaLossPerTick = Math.fround(Math.fround(.01) + float(Math.fround(.02)))
    tint = Math.round(float(Math.fround(.15)) * 255) << 16
  } else {
    const size = drawNativeFloatRange(rng, .5, Math.fround(.8))
    rng = size.state
    scale = size.value
    rotationDeg = float(360)
    alphaLossPerTick = Math.fround(Math.fround(.02) * Math.fround(.8))
    tint = variant === 0 ? 0xff8000 : variant === 1 ? 0x40ff40 : 0x4080ff
  }
  return { rng, state, smoke: {
    alphaLossPerTick, entry, rotationDeg, scale, tint,
    colorAlpha: variant === 0 ? .5 : 1,
    position: { x: position.x, y: Math.fround(position.y - (variant === 3 ? 0 : 15)) },
  } }
}
