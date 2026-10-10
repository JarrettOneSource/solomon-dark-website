import { CanvasTextMetrics, Text } from 'pixi.js'
import { nativeUiFont } from '../../native-ui/core.ts'

export const SACK_NAME_BROWSER_TEXT_LABEL = 'sack-name-browser-fallback'

/** Browser typography is limited to custom Sack names the stock atlas cannot draw. */
export function createBrowserSackName(name: string, tint: number, maxWidth: number, wrap = false): {
  readonly baselineOffset: number
  readonly text: Text
} {
  const fontSize = nativeUiFont('menu').metrics[0]
  const text = new Text({
    eventMode: 'none', label: SACK_NAME_BROWSER_TEXT_LABEL, text: name,
    style: {
      fontFamily: ['Arial', 'sans-serif'], fontSize, lineHeight: fontSize,
      fill: tint, wordWrap: wrap, wordWrapWidth: maxWidth, breakWords: true,
    },
  })
  const metrics = CanvasTextMetrics.measureText(name, text.style)
  const scale = !wrap && text.width > maxWidth ? maxWidth / text.width : 1
  text.scale.set(scale)
  return { baselineOffset: metrics.fontProperties.ascent * scale, text }
}
