import type { BoneyardPoint } from './boneyard.ts'

export interface NativeBoneyardRadialLight {
  readonly intensity: number
  readonly position: Readonly<BoneyardPoint>
  readonly radius: number
}

export const NATIVE_LIGHT_INNER_DISTANCE = 75
export const NATIVE_LIGHT_OUTER_DISTANCE = 145
export const NATIVE_LIGHT_VERTICAL_SCALE = Math.fround(0.85)
export const NATIVE_PLAYER_LIGHT_RADIUS = 2.5999999046325684
export const NATIVE_PLAYER_LIGHT_OFFSET = 15
export const NATIVE_LANTERN_LIGHT_RADIUS = 0.65
export const NATIVE_LANTERN_LIGHT_BASE_INTENSITY = 0.55
export const NATIVE_LANTERN_LIGHT_FLICKER = 0.2

export interface NativeBoneyardLightQuery {
  /** Arena's unpadded camera rectangle origin, before raster quality/zoom. */
  readonly cameraOrigin?: Readonly<BoneyardPoint>
  readonly ambient?: number
}

export interface NativeBoneyardLightFactorPair {
  readonly radial: number
  readonly elevated: number
}

const f32 = Math.fround

/** Shared PC24 contribution used by 0057F0E0 and 0057E640; ledger052. */
export function nativeBoneyardSourceLightFactors(
  position: Readonly<BoneyardPoint>,
  source: NativeBoneyardRadialLight,
  query?: NativeBoneyardLightQuery,
): NativeBoneyardLightFactorPair {
  const cameraX = f32(query?.cameraOrigin?.x ?? 0)
  const cameraY = f32(query?.cameraOrigin?.y ?? 0)
  const rootX = f32(f32(position.x) - cameraX)
  const rootY = f32(f32(position.y) - cameraY)
  const sourceX = f32(f32(source.position.x) - cameraX)
  const sourceY = f32(f32(source.position.y) - cameraY)
  const radius = f32(source.radius)
  const dx = f32(f32(rootX - sourceX) / radius)
  const gap = f32(rootY - sourceY)
  const dy = f32(f32(gap / NATIVE_LIGHT_VERTICAL_SCALE) / radius)
  const distanceSquared = f32(f32(dx * dx) + f32(dy * dy))
  if (distanceSquared >= 21_025) return { radial: 0, elevated: 0 }
  const intensity = f32(source.intensity)
  const radial = distanceSquared < 5_625 ? intensity
    : f32(f32(1 - f32(f32(distanceSquared - 5_625) / 15_400)) * intensity)
  // Height uses the unnormalized query gap, not radius-scaled elliptical Y.
  const height = rootY <= sourceY ? 1
    : Math.max(0, f32(1 - f32(f32(gap * 1.5) / NATIVE_LIGHT_OUTER_DISTANCE)))
  return { radial, elevated: f32(radial * height) }
}

export function nativeBoneyardRadialLightContribution(
  position: Readonly<BoneyardPoint>,
  source: NativeBoneyardRadialLight,
  query?: NativeBoneyardLightQuery,
): number {
  return nativeBoneyardSourceLightFactors(position, source, query).radial
}

export function nativeBoneyardRadialLightScalar(
  position: Readonly<BoneyardPoint>,
  sources: readonly NativeBoneyardRadialLight[],
  query?: NativeBoneyardLightQuery,
): number {
  let scalar = f32(query?.ambient ?? 0)
  for (const source of sources) {
    scalar = Math.max(scalar, nativeBoneyardRadialLightContribution(position, source, query))
  }
  return scalar
}
