/** Native textured modulation multiplies RGB and preserves authored alpha. */
export function nativeUiTintMatrix(tint: number): readonly number[] {
  if (!Number.isInteger(tint) || tint < 0 || tint > 0xffffff) {
    throw new RangeError('native UI tint must be a 24-bit RGB color')
  }
  return [
    (tint >>> 16) / 255, 0, 0, 0, 0,
    0, ((tint >>> 8) & 0xff) / 255, 0, 0, 0,
    0, 0, (tint & 0xff) / 255, 0, 0,
    0, 0, 0, 1, 0,
  ]
}
