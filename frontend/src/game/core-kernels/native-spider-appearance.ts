import type { BoneyardPoint } from './boneyard.ts'

export interface NativeSpiderAppearance {
  readonly bodyHeadingDeg: number
  readonly outlineAlpha: number
  readonly outlineTint: number
}

export interface NativeSpiderOutlineTarget {
  readonly position: Readonly<BoneyardPoint>
  readonly primaryTint: number
}

export function nativeSpiderAppearance(
  bodyHeadingDeg: number,
  position: Readonly<BoneyardPoint>,
  exposure: number,
  target: NativeSpiderOutlineTarget | null,
): NativeSpiderAppearance {
  const distance = target === null ? Infinity : Math.hypot(
    target.position.x - position.x, target.position.y - position.y,
  )
  return {
    bodyHeadingDeg: ((bodyHeadingDeg % 360) + 360) % 360,
    outlineAlpha: target !== null && exposure > 0.5 && distance < 175
      ? 1 - Math.max(0, distance - 125) / 50 : 0,
    outlineTint: target?.primaryTint ?? 0,
  }
}
