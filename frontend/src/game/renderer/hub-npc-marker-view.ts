import { Container, Rectangle, Sprite, Texture } from 'pixi.js'

import nativeFontData from '../../assets/game/hub-npc-font-group-1.json' with { type: 'json' }
import { hub } from '../../lib/assets.ts'
import {
  NATIVE_HUB_NPC_CATALOG,
  type NativeHubNpcMarkerSide,
  type NativeHubNpcMarkerStyle,
} from '../core-kernels/native-hub-npc.ts'
import { nativeSpriteRecordTexture } from './native-sprite-record-texture.ts'

interface NativeMarkerFontGlyph {
  readonly advance: number
  readonly atlasHeight: number
  readonly atlasWidth: number
  readonly atlasX: number
  readonly atlasY: number
  readonly centerX: number
  readonly centerY: number
  readonly glyphId: number
  readonly offsetX: number
  readonly offsetY: number
}

interface NativeMarkerFontData {
  readonly glyphs: Readonly<Record<string, NativeMarkerFontGlyph>>
  readonly header: readonly number[]
  readonly kerning: Readonly<Record<string, number>>
}

const MARKER_FONT = nativeFontData as NativeMarkerFontData

export function courtyardMarkerSource(
  style: NativeHubNpcMarkerStyle,
  side: NativeHubNpcMarkerSide,
): string {
  return hub.markers.courtyard[style][side]
}

export class HubWalkToTalkView {
  readonly container = new Container({ label: 'native-walk-to-talk-callout' })
  private readonly glyphTextures = new Map<string, Texture>()

  constructor(fontAtlas: Texture, arrowTexture: Texture) {
    this.container.eventMode = 'none'
    const contract = NATIVE_HUB_NPC_CATALOG.markers.walkToTalk
    const target = NATIVE_HUB_NPC_CATALOG.interactions[contract.target].geometry.position
    const arrow = new Sprite(arrowTexture)
    arrow.anchor.set(0.5)
    arrow.position.set(
      target.x + contract.arrowOffset.x,
      target.y + contract.arrowOffset.y,
    )
    arrow.rotation = contract.arrowRotationDegrees * Math.PI / 180
    arrow.eventMode = 'none'
    const text = this.buildText(fontAtlas, contract.text)
    text.position.set(
      target.x + contract.textOffset.x,
      target.y + contract.textOffset.y,
    )
    this.container.addChild(arrow, text)
  }

  destroy(): void {
    this.container.destroy({ children: true })
    for (const texture of this.glyphTextures.values()) texture.destroy(false)
    this.glyphTextures.clear()
  }

  private buildText(fontAtlas: Texture, value: string): Container {
    const contract = NATIVE_HUB_NPC_CATALOG.markers.walkToTalk
    const result = new Container({ label: 'native-walk-to-talk-text' })
    result.eventMode = 'none'
    const lines = value.split('\n').map(layoutMarkerLine)
    const lineHeight = MARKER_FONT.header[2] ?? 28
    const top = -((lines.length - 1) * lineHeight) / 2
    const tint = rgbaTint(contract.textColor)
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex]!
      const lineY = top + lineIndex * lineHeight
      for (const radius of contract.outlineRadii) {
        for (let degrees = 0; degrees < 360; degrees += contract.outlineStepDegrees) {
          const radians = degrees * Math.PI / 180
          this.addLine(
            result,
            fontAtlas,
            line,
            -line.advance / 2 + Math.cos(radians) * radius,
            lineY + Math.sin(radians) * radius,
            0x000000,
          )
        }
      }
      this.addLine(result, fontAtlas, line, -line.advance / 2, lineY, tint)
    }
    return result
  }

  private addLine(
    target: Container,
    fontAtlas: Texture,
    line: MarkerLine,
    offsetX: number,
    offsetY: number,
    tint: number,
  ): void {
    for (const glyph of line.glyphs) {
      const sprite = new Sprite(this.glyphTexture(fontAtlas, glyph))
      sprite.anchor.set(0.5)
      sprite.position.set(
        offsetX + glyph.left + glyph.width / 2,
        offsetY + glyph.top + glyph.height / 2,
      )
      sprite.tint = tint
      sprite.eventMode = 'none'
      target.addChild(sprite)
    }
  }

  private glyphTexture(fontAtlas: Texture, glyph: MarkerGlyph): Texture {
    const existing = this.glyphTextures.get(glyph.character)
    if (existing) return existing
    const texture = nativeSpriteRecordTexture({
      source: fontAtlas.source,
      frame: new Rectangle(glyph.atlasX, glyph.atlasY, glyph.width, glyph.height),
    })
    this.glyphTextures.set(glyph.character, texture)
    return texture
  }
}

interface MarkerGlyph {
  readonly atlasX: number
  readonly atlasY: number
  readonly character: string
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
}

interface MarkerLine {
  readonly advance: number
  readonly glyphs: readonly MarkerGlyph[]
}

function layoutMarkerLine(value: string): MarkerLine {
  const glyphs: MarkerGlyph[] = []
  let cursor = 0
  let previousGlyphId: number | null = null
  for (const character of value) {
    const glyph = MARKER_FONT.glyphs[character]
    if (glyph) {
      if (previousGlyphId !== null) {
        cursor += MARKER_FONT.kerning[`${previousGlyphId}:${glyph.glyphId}`] ?? 0
      }
      glyphs.push({
        atlasX: glyph.atlasX,
        atlasY: glyph.atlasY,
        character,
        height: glyph.atlasHeight,
        left: cursor + glyph.offsetX - glyph.atlasWidth / 2 + glyph.centerX,
        top: glyph.offsetY - glyph.atlasHeight / 2 + glyph.centerY,
        width: glyph.atlasWidth,
      })
      cursor += glyph.advance
    } else if (character === ' ') {
      cursor += MARKER_FONT.header[1] ?? 4
    }
    previousGlyphId = character.codePointAt(0) ?? null
  }
  return { advance: cursor, glyphs }
}

function rgbaTint(color: readonly [number, number, number, number]): number {
  const red = Math.round(color[0] * 255)
  const green = Math.round(color[1] * 255)
  const blue = Math.round(color[2] * 255)
  return (red << 16) | (green << 8) | blue
}
