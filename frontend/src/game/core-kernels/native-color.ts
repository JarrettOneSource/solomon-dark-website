/** RGBA::Desaturate 0x0040FC60, followed by its channel clamp 0x0040F770. */
export function nativeDesaturateColor(color: readonly [number, number, number, number], amount: number):
  readonly [number, number, number, number] {
  const luminance = Math.fround(color[0] * .3086000084877014
    + color[1] * .6093999743461609 + color[2] * .0820000022649765)
  const base = luminance * amount
  const mix = (channel: number) => Math.min(1, Math.max(0, Math.fround(base + channel * (1 - amount))))
  return [mix(color[0]), mix(color[1]), mix(color[2]), Math.min(1, Math.max(0, color[3]))]
}
