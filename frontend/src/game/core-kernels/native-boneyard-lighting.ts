import type { BoneyardPoint } from './boneyard.ts'

export interface NativeBoneyardRadialLight {
  readonly intensity: number
  readonly position: Readonly<BoneyardPoint>
  readonly radius: number
}

export const NATIVE_LIGHT_INNER_DISTANCE = 75
export const NATIVE_LIGHT_OUTER_DISTANCE = 145
export const NATIVE_LIGHT_VERTICAL_SCALE = 0.85
export const NATIVE_PLAYER_LIGHT_RADIUS = 2.5999999046325684
export const NATIVE_PLAYER_LIGHT_OFFSET = 15
export const NATIVE_LANTERN_LIGHT_RADIUS = 0.65
export const NATIVE_LANTERN_LIGHT_BASE_INTENSITY = 0.55
export const NATIVE_LANTERN_LIGHT_FLICKER = 0.2

const NATIVE_LIGHT_FALLOFF_SQUARED = (
  NATIVE_LIGHT_OUTER_DISTANCE ** 2 - NATIVE_LIGHT_INNER_DISTANCE ** 2
)

export function nativeBoneyardRadialLightContribution(
  position: Readonly<BoneyardPoint>,
  source: NativeBoneyardRadialLight,
): number {
  const dx = (position.x - source.position.x) / source.radius
  const dy = (
    (position.y - source.position.y)
    / (NATIVE_LIGHT_VERTICAL_SCALE * source.radius)
  )
  const distanceSquared = dx * dx + dy * dy
  if (distanceSquared >= NATIVE_LIGHT_OUTER_DISTANCE ** 2) return 0
  return distanceSquared < NATIVE_LIGHT_INNER_DISTANCE ** 2
    ? source.intensity
    : source.intensity * (
        1
        - (distanceSquared - NATIVE_LIGHT_INNER_DISTANCE ** 2)
          / NATIVE_LIGHT_FALLOFF_SQUARED
      )
}

export function nativeBoneyardRadialLightScalar(
  position: Readonly<BoneyardPoint>,
  sources: readonly NativeBoneyardRadialLight[],
): number {
  let scalar = 0
  for (const source of sources) {
    scalar = Math.max(
      scalar,
      nativeBoneyardRadialLightContribution(position, source),
    )
  }
  return scalar
}
