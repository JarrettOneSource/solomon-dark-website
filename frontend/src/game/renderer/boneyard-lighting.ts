import type { SpriteRef, Vec2 } from '../../editor/model.ts'

export interface NativeBoneyardLightSample {
  intensity: number
  position: Vec2
  radius: number
}

export interface NativeBoneyardLightSource extends NativeBoneyardLightSample {
  castsDirectionalShadow: boolean
}

export interface NativeSolomonSetPieceLighting {
  digRootTint: number
  lanternTint: number
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
export const NATIVE_REGION_LIGHT_ATLAS = 'DeadHawg'
export const NATIVE_REGION_LIGHT_ENTRY = 18
export const NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX = 0.5

const NATIVE_LIGHT_FALLOFF_SQUARED = (
  NATIVE_LIGHT_OUTER_DISTANCE ** 2 - NATIVE_LIGHT_INNER_DISTANCE ** 2
)

export function nativePlayerLightSource(
  player: NativePlayerLightOwner,
): NativeBoneyardLightSource {
  const heading = player.headingIndex * 15 * Math.PI / 180
  return {
    intensity: 1,
    castsDirectionalShadow: true,
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
    castsDirectionalShadow: false,
    position,
    radius: NATIVE_LANTERN_LIGHT_RADIUS,
  }
}

export function nativeAcceptedBoneyardLightSources(
  candidates: readonly NativeBoneyardLightSource[],
  accepted: NativeBoneyardLightSource[],
): readonly NativeBoneyardLightSource[] {
  accepted.length = 0
  for (const candidate of candidates) {
    const contained = !candidate.castsDirectionalShadow && accepted.some((existing) => {
      if (
        existing.intensity < candidate.intensity
        || existing.radius < candidate.radius
      ) return false
      const dx = existing.position.x - candidate.position.x
      const dy = existing.position.y - candidate.position.y
      const containmentRadius = (
        (existing.radius - candidate.radius) * NATIVE_LIGHT_OUTER_DISTANCE
      )
      return dx * dx + dy * dy < containmentRadius * containmentRadius
    })
    if (!contained) accepted.push(candidate)
  }
  return accepted
}

export function nativeBoneyardLightScalar(
  position: Vec2,
  sources: readonly NativeBoneyardLightSample[],
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

export function nativeSolomonSetPieceLighting(
  digPosition: Vec2,
  lanternPosition: Vec2,
  sources: readonly NativeBoneyardLightSample[],
): NativeSolomonSetPieceLighting {
  return {
    digRootTint: nativeBoneyardLightTint(
      nativeBoneyardLightScalar(digPosition, sources),
    ),
    lanternTint: nativeBoneyardLightTint(
      nativeBoneyardLightScalar(lanternPosition, sources),
    ),
  }
}

export function nativeRegionLightStamp(
  source: NativeBoneyardLightSample,
  screenPosition: Vec2,
  sprite: Pick<SpriteRef, 'anchorX' | 'anchorY' | 'h' | 'w'>,
  zoom: number,
): {
  alpha: number
  anchorX: number
  anchorY: number
  scale: number
  x: number
  y: number
} {
  return {
    alpha: source.intensity,
    anchorX: sprite.anchorX / sprite.w,
    anchorY: sprite.anchorY / sprite.h,
    scale: source.radius * zoom,
    x: screenPosition.x,
    y: screenPosition.y,
  }
}

function presentationRandom(frame: number): number {
  let value = (Math.trunc(frame) ^ 0x9e3779b9) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000
}
