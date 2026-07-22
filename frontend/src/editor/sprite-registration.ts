import type { Vec2 } from './model.ts'

/** Native Glyph_Draw positions the logical canvas around the world point. */
export function nativeSpriteAnchor(width: number, height: number, origin: Vec2): Vec2 {
  return {
    x: width / 2 - origin.x,
    y: height / 2 - origin.y,
  }
}
