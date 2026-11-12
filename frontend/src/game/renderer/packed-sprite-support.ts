import { Rectangle } from 'pixi.js'

/** Include the packed zero gutter where the original logical image was transparent. */
export function packedSpriteSupport(trim: Rectangle, original: Rectangle): Rectangle {
  const left = Math.max(0, trim.x - 1)
  const top = Math.max(0, trim.y - 1)
  const right = Math.min(original.width, trim.right + 1)
  const bottom = Math.min(original.height, trim.bottom + 1)
  return new Rectangle(left, top, right - left, bottom - top)
}
