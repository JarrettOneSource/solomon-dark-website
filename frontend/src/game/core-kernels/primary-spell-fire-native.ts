export const NATIVE_FIRE_PARTICLE_FRAME_COUNT = 4
export const NATIVE_FIRE_IMPACT_LIFETIME_TICKS = 16
export const NATIVE_FIRE_ENHANCED_EFFECTS = true
export const NATIVE_FIRE_PARTICLE_BASE_FADE_MIN = 0.05
export const NATIVE_FIRE_PARTICLE_BASE_FADE_RANGE = 0.05

export function nativeFireParticleFadeStep(id: number): number {
  const base = NATIVE_FIRE_PARTICLE_BASE_FADE_MIN
    + nativeFirePresentationRandom(id, 0, 5) * NATIVE_FIRE_PARTICLE_BASE_FADE_RANGE
  return NATIVE_FIRE_ENHANCED_EFFECTS ? base * 0.5 : base
}

export function nativeFireParticleLifetimeTicks(id: number): number {
  return Math.floor(1 / nativeFireParticleFadeStep(id)) + 1
}

export function nativeFireParticleVariant(id: number): number {
  return Math.floor(
    nativeFirePresentationRandom(id, 0, 6) * NATIVE_FIRE_PARTICLE_FRAME_COUNT,
  )
}

export function nativeFireImpactPitch(id: number): number {
  return 0.9 + nativeFirePresentationRandom(id, 0, 12) * 0.2
}

export function nativeFirePresentationRandom(
  id: number,
  sample: number,
  channel: number,
): number {
  let value = (
    Math.imul(Math.trunc(id), 0x9e3779b1)
    ^ Math.imul(Math.trunc(sample) + 1, 0x85ebca6b)
    ^ Math.imul(Math.trunc(channel) + 1, 0xc2b2ae35)
  ) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000
}
