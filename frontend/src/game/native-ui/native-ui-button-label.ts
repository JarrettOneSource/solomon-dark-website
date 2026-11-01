import { layoutNativeUiText, nativeUiGlyphInkBounds } from './native-ui-text.ts'

export const NATIVE_UI_BUTTON = Object.freeze({
  disabledAlpha: 0.5,
  idleRecord: 101,
  labelYOffset: 9,
  minWidth: 140,
  pressedOffset: 6,
  pressedRecord: 102,
  surround: 6,
  surroundEndRecord: 54,
  surroundEdgeUvOrigin: 0.95,
  textTint: 0xd9ba70,
})

// Nontransparent right edge (exclusive) of every UI.54 row, measured from the
// 70x85 source at (679,394). Atlas SHA-256:
// 37d5e8fc543af12a9d8019e738dbe1e29b648211144a3782c3a32e71f76cd2eb.
// The empty space around a skull remains available to the label.
const SURROUND_INK_RIGHT = [
  70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 54, 54, 53, 53, 51, 48,
  48, 47, 43, 42, 42, 42, 42, 39, 37, 38, 38, 38, 39, 39, 39, 39, 39,
  39, 39, 39, 39, 38, 38, 39, 40, 40, 41, 41, 41, 41, 41, 41, 42, 49,
  49, 49, 50, 50, 50, 50, 50, 51, 51, 54, 57, 57, 57, 57, 58, 62, 63,
  63, 66, 68, 68, 68, 68, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70,
] as const

/** Fits full menu-face ink inside the mirrored skulls, reserving press motion. */
export function nativeUiButtonLabelScale(
  label: string,
  width: number,
  height: number,
  scale: number,
): number {
  const { surround, labelYOffset, pressedOffset } = NATIVE_UI_BUTTON
  const glyphs = layoutNativeUiText({ font: 'menu', text: label, x: 0, y: labelYOffset }).glyphs
  if (glyphs.length === 0) return scale
  let reach = 0
  let top = 0
  let bottom = 0
  for (const glyph of glyphs) {
    const ink = nativeUiGlyphInkBounds(glyph)
    reach = Math.max(reach, -ink.left, ink.left + ink.width)
    top = Math.min(top, ink.top)
    bottom = Math.max(bottom, ink.top + ink.height)
  }
  // Include the button centre so a smaller label's entire vertical band remains
  // inside this envelope. Fit once for both resting and pressed states.
  const centre = height / scale / 2 + surround
  const firstRow = Math.max(0, Math.floor(centre + top))
  const lastRow = Math.min(SURROUND_INK_RIGHT.length, Math.ceil(centre + bottom + pressedOffset))
  let endInk = 0
  for (let row = firstRow; row < lastRow; row += 1) {
    endInk = Math.max(endInk, SURROUND_INK_RIGHT[row]!)
  }
  const halfWidth = width / scale / 2 - Math.max(0, endInk - surround) - pressedOffset
  if (halfWidth <= 0) throw new RangeError('native UI button has no room for label ink')
  return scale * Math.min(1, halfWidth / reach)
}
