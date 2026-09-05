import { Container, Sprite, Texture } from 'pixi.js'

import { layoutNativeUiText, nativeUiFont, type NativeUiTextLayout, type NativeUiGlyphLayout } from '../native-ui/core.ts'
import { nativeUiGlyphRecordTexture } from '../native-ui/native-ui-glyph-texture.ts'
import { hub } from '../../lib/assets.ts'
import {
  NATIVE_HUB_NPC_CATALOG,
  type NativeHubNpcMarkerSide,
  type NativeHubNpcMarkerStyle,
} from '../core-kernels/native-hub-npc.ts'

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
    const lines = value.split('\n').map(text => layoutNativeUiText({ align: 'left', font: 'medium', text, x: 0, y: 0 }))
    const lineHeight = nativeUiFont('medium').metrics[2]
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
            -line.width / 2 + Math.cos(radians) * radius,
            lineY + Math.sin(radians) * radius,
            0x000000,
          )
        }
      }
      this.addLine(result, fontAtlas, line, -line.width / 2, lineY, tint)
    }
    return result
  }

  private addLine(
    target: Container,
    fontAtlas: Texture,
    line: NativeUiTextLayout,
    offsetX: number,
    offsetY: number,
    tint: number,
  ): void {
    for (const glyph of line.glyphs) {
      const sprite = new Sprite(this.glyphTexture(fontAtlas, glyph))
      sprite.anchor.set(0.5)
      sprite.position.set(
        offsetX + glyph.centerX,
        offsetY + glyph.centerY,
      )
      sprite.tint = tint
      sprite.eventMode = 'none'
      target.addChild(sprite)
    }
  }

  private glyphTexture(fontAtlas: Texture, glyph: NativeUiGlyphLayout): Texture {
    const existing = this.glyphTextures.get(glyph.character)
    if (existing) return existing
    const texture = nativeUiGlyphRecordTexture(fontAtlas.source, glyph)
    this.glyphTextures.set(glyph.character, texture)
    return texture
  }
}

function rgbaTint(color: readonly [number, number, number, number]): number {
  const red = Math.round(color[0] * 255)
  const green = Math.round(color[1] * 255)
  const blue = Math.round(color[2] * 255)
  return (red << 16) | (green << 8) | blue
}
