import type { Vector2 } from './vector.ts'

/** Stock Math+4, initialized from the actual 007DE8A8 float32 operand. */
export const NATIVE_GROUND_PI = 3.141592502593994

export interface NativeGroundGlyphPlan {
  readonly position: Readonly<Vector2>
  readonly scaleX: number
  readonly scaleY: number
  readonly alpha: number
}

interface GroundActor {
  readonly position: Readonly<Vector2>
  readonly headingDegrees: number
  readonly scale: number
}

interface GroundPlayer extends GroundActor {
  readonly lifeState: 'alive' | 'lethal-pending' | 'dying' | 'spectating'
  readonly deathTick: number
  readonly corpseConsumed: boolean
}

export function nativeGroundHeadingVector(degrees: number): Readonly<Vector2> {
  const radians = Math.fround(Math.fround(degrees) * NATIVE_GROUND_PI / 180)
  return { x: Math.fround(Math.sin(radians)), y: -Math.fround(Math.cos(radians)) }
}

function ordinaryGlyph(actor: GroundActor, distance: number, multiplier: number, alpha: number): NativeGroundGlyphPlan {
  const direction = nativeGroundHeadingVector(actor.headingDegrees)
  const scale = Math.fround(actor.scale * multiplier)
  return {
    position: {
      x: Math.fround(actor.position.x - Math.fround(direction.x * distance)),
      y: Math.fround(actor.position.y - Math.fround(direction.y * distance)),
    },
    scaleX: scale,
    scaleY: scale,
    alpha,
  }
}

export function nativePlayerGroundGlyph(player: GroundPlayer, specialSurface: boolean): NativeGroundGlyphPlan | null {
  const terminal = player.lifeState === 'dying' || player.lifeState === 'spectating'
  if (player.corpseConsumed || terminal && player.deathTick > 150) return null
  return specialSurface
    ? ordinaryGlyph(player, 2, 1.2000000476837158, 0.5)
    : ordinaryGlyph(player, 5, 1.25, 1)
}

export function nativeStudentGroundGlyph(student: {
  readonly position: Readonly<Vector2>
  readonly heading: number
  readonly scale: number
}): NativeGroundGlyphPlan {
  return ordinaryGlyph({ ...student, headingDegrees: student.heading }, 5, 1.25, 1)
}

export function nativeNpcGroundGlyph(
  position: Readonly<Vector2>,
  offset: Readonly<Vector2>,
  alpha = 1,
): NativeGroundGlyphPlan {
  return {
    position: { x: Math.fround(position.x + offset.x), y: Math.fround(position.y + offset.y) },
    scaleX: 1.25,
    scaleY: 1.0499999523162842,
    alpha,
  }
}

// Constructed by 005BF6A0 after the five 3C-byte objects are initialized.
// Preserve authored order: 00405160 closes the last-to-first edge itself.
const COMPACT_SURFACE_POINTS: readonly (readonly Readonly<Vector2>[])[] = ([
  [[-24, -25], [2, -37], [41, -6], [32, 12], [9, 21], [-5, 37], [-24, 42], [-45, 26], [-37, 6], [-14, -3]],
  [[13.5, -8.5], [23.5, 14.5], [4.5, 31.5], [-22.5, -0.5], [-10.5, -29.5], [5.5, -31.5]],
  [[-3, -38], [38, -19], [47, 0], [41, 19], [5, 38], [-41, 24], [-42, -7]],
  [[7.5, 20], [-29.5, 3], [-28.5, -14], [-12.5, -15], [5.5, -21], [30.5, -4], [28.5, 14]],
  [[-3.5, -107], [35.5, -98], [77.5, -64], [106.5, -3], [100.5, 34], [39.5, 97], [-1.5, 108], [-64.5, 91], [-91.5, 61], [-107.5, 1], [-73.5, -70]],
] as const).map(points => points.map(([x, y]) => ({ x, y })))

export function nativeCompactSurfaceContains(selector: number, point: Readonly<Vector2>): boolean {
  const points = COMPACT_SURFACE_POINTS[selector - 25]
  if (points === undefined) return false
  const x = Math.fround(point.x)
  const y = Math.fround(point.y)
  let inside = false
  let previous = points[points.length - 1]!
  for (const current of points) {
    if ((current.y > y) !== (previous.y > y)
      && x < current.x + (y - current.y) * (previous.x - current.x) / (previous.y - current.y)) {
      inside = !inside
    }
    previous = current
  }
  return inside
}
