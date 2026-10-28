/** Skill-cache refresh 0x00662BCA and Water handler 0x005447AA. */
export const NATIVE_COLD_AURA_PERIOD_TICKS = 6
const INITIAL_ALPHA = Math.fround(0.5)
const SCALE_PER_TICK = Math.fround(1.015)
const RED_LOSS_PER_TICK = Math.fround(0.02)
// Anim_Fade 0x00452E20, followed by the stores at 0x00544831/0x00544839.
const BASE_ALPHA_LOSS = Math.fround(Math.fround(Math.fround(0.1) * Math.fround(0.1)) * 0.5)

/** The native +0x8B0 cache is authored feet / 7, not a world-space radius. */
export function nativeColdAuraRadiusScale(feet: number): number {
  return Math.fround(feet / 7)
}

/** The radius argument pushed by the six-tick Water target query. */
export function nativeColdAuraQueryRadius(radiusScale: number): number {
  return Math.fround(radiusScale * 120)
}

export function nativeColdAuraAlphaDecay(radiusScale: number): number {
  if (!Number.isFinite(radiusScale) || radiusScale <= 0) {
    throw new RangeError('Cold Aura radius scale must be positive and finite')
  }
  // Preserve both float stores at 0x005448A5 and 0x005448B3.
  const decay = Math.fround(Math.fround(BASE_ALPHA_LOSS / radiusScale) * 1.25)
  validateAlphaDecay(decay)
  return decay
}

/** 0x0045AFB0 retires after repeated float32 subtraction, not ceil(alpha/loss). */
export function nativeColdAuraLifetimeTicks(alphaDecay: number): number {
  validateAlphaDecay(alphaDecay)
  let alpha = INITIAL_ALPHA
  let ticks = 0
  while (alpha > 0) {
    alpha = Math.fround(alpha - alphaDecay)
    ticks += 1
  }
  return ticks
}

export interface NativeColdAuraVisualState {
  readonly alpha: number
  readonly red: number
  readonly rotationDegrees: number
  readonly scale: number
}

/** Reconstruct the actor's float stores; interpolated ages select a native tick. */
export function nativeColdAuraVisualState(state: Readonly<{
  ageTicks: number
  alphaDecay: number
  initialRotationDegrees: number
  rotationStepDegrees: number
}>): NativeColdAuraVisualState {
  validateAlphaDecay(state.alphaDecay)
  let alpha = INITIAL_ALPHA
  let red = Math.fround(1)
  let rotationDegrees = Math.fround(state.initialRotationDegrees)
  let scale = Math.fround(1)
  const age = Math.max(0, Math.trunc(state.ageTicks))
  for (let tick = 0; tick < age && alpha > 0; tick += 1) {
    alpha = Math.fround(alpha - state.alphaDecay)
    scale = Math.fround(scale * SCALE_PER_TICK)
    rotationDegrees = Math.fround(rotationDegrees + state.rotationStepDegrees)
    red = Math.max(0, Math.fround(red - RED_LOSS_PER_TICK))
  }
  return { alpha: Math.max(0, alpha), red, rotationDegrees, scale }
}

function validateAlphaDecay(decay: number): void {
  if (!Number.isFinite(decay) || decay <= 0 || Math.fround(INITIAL_ALPHA - decay) === INITIAL_ALPHA) {
    throw new RangeError('Cold Aura alpha decay must make finite native progress')
  }
}
