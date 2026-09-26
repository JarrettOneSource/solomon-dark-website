import { nativeUiFont, wrapNativeUiMsgBoxText } from '../native-ui/core.ts'
import type { NativeSkillBookTooltipLine } from '../skill-book-model.ts'
import {
  NATIVE_SKILL_HOVER_BOX,
  NATIVE_SKILL_SCREEN_SIZE,
  measureNativeSkillExactText,
} from './skill-book-render-contract.ts'

export function nativeSkillHoverBoxLayout(
  semanticLines: readonly NativeSkillBookTooltipLine[],
  sourceX: number,
  sourceY: number,
) {
  const rendered = semanticLines.map((line) => {
    // Skills_Wizard prepares descriptions at 380; HoverBox then admits every
    // semantic line through its independent 400-pixel DataLine boundary.
    const text = line.kind === 'description'
      ? wrapNativeUiMsgBoxText(line.text, 'body', NATIVE_SKILL_HOVER_BOX.descriptionWrapWidth).join('\n')
      : line.text
    const sources = measureNativeSkillExactText(text) > NATIVE_SKILL_HOVER_BOX.lineWrapWidth
      ? wrapNativeUiMsgBoxText(text, 'body', NATIVE_SKILL_HOVER_BOX.lineWrapWidth)
      : text.split('\n')
    return { kind: line.kind, sources }
  })
  const contentWidth = Math.max(0,
    ...rendered.flatMap(({ sources }) => sources.map(measureNativeSkillExactText)))
  const lineHeight = nativeUiFont('body').metrics[0]
  const contentHeight = rendered.reduce((height, { sources }, index) => (
    height + sources.length * lineHeight
    + (index === rendered.length - 1 ? 0 : NATIVE_SKILL_HOVER_BOX.lineGap)
  ), 0)
  const width = contentWidth + NATIVE_SKILL_HOVER_BOX.contentMargin * 2
  const height = contentHeight + NATIVE_SKILL_HOVER_BOX.contentMargin * 2
  const margin = NATIVE_SKILL_HOVER_BOX.viewportMargin
  const x = Math.max(margin, Math.min(
    NATIVE_SKILL_SCREEN_SIZE.width - margin - width, sourceX - width / 2,
  ))
  let y = sourceY - NATIVE_SKILL_HOVER_BOX.sourceGap - height
  if (y < margin) y = sourceY + NATIVE_SKILL_HOVER_BOX.sourceGap
  y = Math.max(margin, Math.min(NATIVE_SKILL_SCREEN_SIZE.height - margin - height, y))
  return { rendered, contentWidth, width, height, x, y, lineHeight }
}
