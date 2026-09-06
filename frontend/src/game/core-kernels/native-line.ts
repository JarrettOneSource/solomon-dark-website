import type { Vector2 } from './vector.ts'

/** The shared native line quad, 0x00455840 / 0x005E4510 -> 0x0041FB90. */
export function nativeLineVertices(
  start: Readonly<Vector2>, end: Readonly<Vector2>, width: number,
): readonly number[] {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (!(length > 0) || !Number.isFinite(width) || width <= 0) {
    throw new RangeError('Native line requires distinct endpoints and positive width')
  }
  const px = -dy / length * width * 0.5
  const py = dx / length * width * 0.5
  return [
    start.x - px, start.y - py, start.x + px, start.y + py,
    end.x - px, end.y - py, end.x + px, end.y + py,
  ].map(Math.fround)
}

/** Native float colours are truncated and packed into eight-bit vertex channels. */
export function nativeLineColor(red: number, green: number, blue: number, alpha: number): number {
  const channel = (value: number) => Math.trunc(Math.fround(value) * 255) & 0xff
  return (channel(red) | channel(green) << 8 | channel(blue) << 16 | channel(alpha) << 24) >>> 0
}
