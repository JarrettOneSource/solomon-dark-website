import type { Vec2 } from '../../editor/model.ts'

export interface NativeBoneyardLightSource {
  intensity: number
  position: Vec2
  radius: number
}

interface NativePlayerLightOwner {
  headingIndex: number
  position: Vec2
}

export const NATIVE_LIGHT_INNER_DISTANCE = 75
export const NATIVE_LIGHT_OUTER_DISTANCE = 145
export const NATIVE_LIGHT_VERTICAL_SCALE = 0.85
export const NATIVE_PLAYER_LIGHT_RADIUS = 2.6
export const NATIVE_PLAYER_LIGHT_OFFSET = 15
export const NATIVE_LANTERN_LIGHT_RADIUS = 0.65
export const NATIVE_LANTERN_LIGHT_MIN_INTENSITY = 0.55
export const NATIVE_LANTERN_LIGHT_FLICKER = 0.2

const NATIVE_LIGHT_FALLOFF_SQUARED = (
  NATIVE_LIGHT_OUTER_DISTANCE ** 2 - NATIVE_LIGHT_INNER_DISTANCE ** 2
)

export function nativePlayerLightSource(
  player: NativePlayerLightOwner,
): NativeBoneyardLightSource {
  const heading = player.headingIndex * 15 * Math.PI / 180
  return {
    intensity: 1,
    position: {
      x: player.position.x + Math.sin(heading) * NATIVE_PLAYER_LIGHT_OFFSET,
      y: player.position.y - Math.cos(heading) * NATIVE_PLAYER_LIGHT_OFFSET,
    },
    radius: NATIVE_PLAYER_LIGHT_RADIUS,
  }
}

export function nativeLanternLightSource(
  position: Vec2,
  presentationFrame: number,
): NativeBoneyardLightSource {
  return {
    intensity: NATIVE_LANTERN_LIGHT_MIN_INTENSITY
      + presentationRandom(presentationFrame) * NATIVE_LANTERN_LIGHT_FLICKER,
    position,
    radius: NATIVE_LANTERN_LIGHT_RADIUS,
  }
}

export function nativeBoneyardLightScalar(
  position: Vec2,
  sources: readonly NativeBoneyardLightSource[],
): number {
  let scalar = 0
  for (const source of sources) {
    const dx = (position.x - source.position.x) / source.radius
    const dy = (
      (position.y - source.position.y)
      / (NATIVE_LIGHT_VERTICAL_SCALE * source.radius)
    )
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared >= NATIVE_LIGHT_OUTER_DISTANCE ** 2) continue
    const contribution = distanceSquared < NATIVE_LIGHT_INNER_DISTANCE ** 2
      ? source.intensity
      : source.intensity * (
          1
          - (distanceSquared - NATIVE_LIGHT_INNER_DISTANCE ** 2)
            / NATIVE_LIGHT_FALLOFF_SQUARED
        )
    scalar = Math.max(scalar, contribution)
  }
  return scalar
}

export function nativeBoneyardLightTint(scalar: number): number {
  const lane = Math.round(Math.max(0, Math.min(1, scalar)) * 255)
  return lane * 0x010101
}

function presentationRandom(frame: number): number {
  let value = (Math.trunc(frame) ^ 0x9e3779b9) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000
}
