import { Container, Graphics } from 'pixi.js'

import { nativeSkillRoot } from '../core-kernels/player-progression.ts'
import { nativeUiFont } from '../native-ui/native-ui-catalog.ts'
import { nativeUiPixiFor } from '../native-ui/native-ui-pixi.ts'
import {
  measureNativeUiText,
  wrapNativeUiText,
} from '../native-ui/native-ui-text.ts'
import {
  nativeSkillBookTooltipLines,
  type NativeSkillBookRow,
  type NativeSkillBookTooltipLine,
  type NativeSkillBookTooltipLineKind,
} from '../skill-book-model.ts'
import type { GameTextureMap } from './game-webgl.ts'
import {
  NATIVE_SKILL_HOVER_BOX,
  NATIVE_SKILL_SCREEN_SIZE,
  measureNativeSkillExactText,
  nativeSkillExactTextRuns,
  nativeSkillPageTint,
} from './skill-book-render-contract.ts'

export interface NativeSkillHoverBoxPresentation {
  readonly lines?: readonly NativeSkillBookTooltipLine[]
  readonly row: NativeSkillBookRow
  readonly sourceX: number
  readonly sourceY: number
}

export function drawNativeSkillHoverBox(
  layer: Container,
  textures: GameTextureMap,
  presentation: NativeSkillHoverBoxPresentation,
): Container | null {
  const semanticLines = presentation.lines ?? nativeSkillBookTooltipLines(presentation.row)
  if (semanticLines.length === 0) return null
  const rendered = semanticLines.map((line) => {
    const sources = line.kind === 'description'
      ? wrapNativeUiText(line.text, 'body', NATIVE_SKILL_HOVER_BOX.contentMaxWidth)
      : line.text.split('\n')
    return { kind: line.kind, sources }
  })
  const contentWidth = Math.min(
    NATIVE_SKILL_HOVER_BOX.contentMaxWidth,
    Math.max(0, ...rendered.flatMap(({ sources }) => sources.map(measureNativeSkillExactText))),
  )
  const lineHeight = nativeUiFont('body').metrics[0]
  const contentHeight = rendered.reduce((height, { sources }, index) => (
    height
    + sources.length * lineHeight
    + (index === rendered.length - 1 ? 0 : NATIVE_SKILL_HOVER_BOX.lineGap)
  ), 0)
  const width = contentWidth + NATIVE_SKILL_HOVER_BOX.contentMargin * 2
  const height = contentHeight + NATIVE_SKILL_HOVER_BOX.contentMargin * 2
  const margin = NATIVE_SKILL_HOVER_BOX.viewportMargin
  const x = Math.max(
    margin,
    Math.min(
      NATIVE_SKILL_SCREEN_SIZE.width - margin - width,
      presentation.sourceX - width / 2,
    ),
  )
  let y = presentation.sourceY - NATIVE_SKILL_HOVER_BOX.sourceGap - height
  if (y < margin) y = presentation.sourceY + NATIVE_SKILL_HOVER_BOX.sourceGap
  y = Math.max(margin, Math.min(NATIVE_SKILL_SCREEN_SIZE.height - margin - height, y))

  const info = new Container()
  info.label = 'native-skill-hover-box'
  info.position.set(x, y)
  info.addChild(new Graphics()
    .rect(0, 0, width, height)
    .fill(0x000000)
    .stroke({ color: 0xffffff, width: 1 }))
  let cursorY = NATIVE_SKILL_HOVER_BOX.contentMargin
  for (const { kind, sources } of rendered) {
    for (const source of sources) {
      addNativeExactTextLine(
        info,
        textures,
        source,
        NATIVE_SKILL_HOVER_BOX.contentMargin,
        cursorY,
        nativeHoverLineTint(kind, presentation.row),
      )
      cursorY += lineHeight
    }
    cursorY += NATIVE_SKILL_HOVER_BOX.lineGap
  }
  layer.addChild(info)
  return info
}

function nativeHoverLineTint(
  kind: NativeSkillBookTooltipLineKind,
  row: NativeSkillBookRow,
): number {
  if (kind === 'boost') return 0xff80ff
  if (kind === 'bonus') return 0xd9ba70
  if (kind === 'title') return nativeSkillPageTint(nativeSkillRoot(row.id))
  if (kind === 'category') return dimTint(nativeSkillPageTint(nativeSkillRoot(row.id)), 0.75)
  return 0xbfbfbf
}

function dimTint(tint: number, amount: number): number {
  const red = Math.round(((tint >> 16) & 0xff) * amount)
  const green = Math.round(((tint >> 8) & 0xff) * amount)
  const blue = Math.round((tint & 0xff) * amount)
  return (red << 16) | (green << 8) | blue
}

function addNativeExactTextLine(
  layer: Container,
  textures: GameTextureMap,
  source: string,
  x: number,
  y: number,
  tint: number,
): void {
  let cursor = x
  for (const run of nativeSkillExactTextRuns(source)) {
    const text = nativeUiPixiFor(textures).text({
      align: 'left',
      font: 'body',
      scale: run.scale,
      text: run.text,
      tint,
      x: cursor + run.offsetX,
      y: y + run.offsetY,
    })
    if (run.italic) text.skew.x = -Math.atan(0.125)
    layer.addChild(text)
    cursor += measureNativeUiText(run.text, 'body', run.scale)
  }
}
