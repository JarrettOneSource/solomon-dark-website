import { Container, Graphics } from 'pixi.js'

import { nativeSkillRoot } from '../core-kernels/player-progression.ts'
import { nativeUiPixiFor } from '../native-ui/pixi.ts'
import { measureNativeUiText } from '../native-ui/core.ts'
import {
  nativeSkillBookTooltipLines,
  type NativeSkillBookRow,
  type NativeSkillBookTooltipLine,
  type NativeSkillBookTooltipLineKind,
} from '../skill-book-model.ts'
import type { GameTextureMap } from './game-webgl.ts'
import {
  NATIVE_SKILL_HOVER_BOX,
  nativeSkillExactTextRuns,
  nativeSkillPageTint,
} from './skill-book-render-contract.ts'
import { nativeSkillHoverBoxLayout } from './native-skill-hover-box-layout.ts'

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
  const { rendered, width, height, x, y, lineHeight } = nativeSkillHoverBoxLayout(
    semanticLines, presentation.sourceX, presentation.sourceY,
  )

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
