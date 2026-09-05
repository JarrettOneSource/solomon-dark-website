import { Container, Graphics, Sprite, Texture } from 'pixi.js'

import { layoutNativeUiText, measureNativeUiText, type NativeUiGlyphLayout } from '../native-ui/core.ts'
import { nativeUiGlyphRecordTexture } from '../native-ui/native-ui-glyph-texture.ts'
import type { GameWorldSpeech } from '../world-speech-presentation.ts'
import type { GameChatChannel } from '../protocol/game-chat.ts'
import type { NativeWorldScreenPoint } from './native-world-nameplate.ts'

export const WORLD_SPEECH_STYLE = Object.freeze({
  anchorWorldOffsetY: -78,
  borderAlpha: 0.88,
  borderColor: 0xc8a862,
  contentMaxWidth: 240,
  fontCapBottom: 6,
  fontCapTop: -19,
  fontScale: 0.5,
  horizontalPadding: 8,
  lineHeight: 16,
  minimumWidth: 44,
  panelAlpha: 0.9,
  panelColor: 0x0f0c13,
  radius: 4,
  shadowAlpha: 0.55,
  shadowColor: 0x000000,
  shadowOffsetY: 1,
  tailHalfWidth: 5,
  tailHeight: 6,
  textColor: 0xefe3c6,
  verticalPadding: 6,
} as const)

export interface NativeWorldSpeechLine {
  readonly advance: number
  readonly glyphs: readonly NativeUiGlyphLayout[]
  readonly text: string
}

export interface NativeWorldSpeechLayout {
  readonly glyphCount: number
  readonly height: number
  readonly lines: readonly NativeWorldSpeechLine[]
  readonly width: number
}

export interface NativeWorldSpeechItem {
  readonly alpha: number
  readonly channel: GameChatChannel
  readonly playerId: string
  readonly position: Readonly<{ x: number; y: number }>
  readonly sequence: number
  readonly text: string
}

export interface NativeWorldSpeechDiagnostics {
  readonly activeCount: number
  readonly alphas: readonly number[]
  readonly maximumAlpha: number
  readonly playerIds: readonly string[]
  readonly sequences: readonly number[]
  readonly visibleCount: number
}

type WorldSpeechPlayer = Readonly<{
  position: Readonly<{ x: number; y: number }>
}>

export function layoutNativeWorldSpeech(text: string): NativeWorldSpeechLayout {
  const style = WORLD_SPEECH_STYLE
  const lines = wrapNativeWorldSpeech(text).map((lineText) => {
    const layout = layoutNativeUiText({ align: 'left', font: 'world-and-roster', scale: style.fontScale, text: lineText, x: 0, y: 0 })
    return Object.freeze({
      advance: layout.width,
      glyphs: layout.glyphs,
      text: lineText,
    })
  })
  const contentWidth = Math.max(0, ...lines.map(({ advance }) => advance))
  return Object.freeze({
    glyphCount: lines.reduce((count, line) => count + line.glyphs.length, 0),
    height: lines.length * style.lineHeight + style.verticalPadding * 2,
    lines: Object.freeze(lines),
    width: Math.max(
      style.minimumWidth,
      Math.ceil(contentWidth) + style.horizontalPadding * 2,
    ),
  })
}

export function deriveNativeWorldSpeechItems(
  speeches: readonly GameWorldSpeech[],
  players: Readonly<Record<string, WorldSpeechPlayer>>,
  nowMs: number,
  includePlayer: (playerId: string) => boolean = () => true,
): NativeWorldSpeechItem[] {
  return speeches.flatMap((speech) => {
    const sample = sampleWorldSpeech(speech, nowMs)
    const player = players[speech.playerId]
    if (
      !sample
      || !player
      || !includePlayer(speech.playerId)
      || !Number.isFinite(player.position.x)
      || !Number.isFinite(player.position.y)
      || layoutNativeWorldSpeech(speech.text).glyphCount === 0
    ) return []
    return [{
      alpha: sample.alpha,
      channel: sample.channel,
      playerId: sample.playerId,
      position: { ...player.position },
      sequence: sample.sequence,
      text: sample.text,
    }]
  }).sort((left, right) => (
    left.playerId < right.playerId ? -1 : left.playerId > right.playerId ? 1 : 0
  ))
}

function sampleWorldSpeech(
  speech: GameWorldSpeech,
  nowMs: number,
): Readonly<GameWorldSpeech & { alpha: number }> | null {
  if (nowMs >= speech.expiresAtMs) return null
  return {
    ...speech,
    alpha: nowMs <= speech.holdUntilMs
      ? 1
      : (speech.expiresAtMs - nowMs) / (speech.expiresAtMs - speech.holdUntilMs),
  }
}

export class NativeWorldSpeechLayer {
  readonly container = new Container({ label: 'native-world-speech' })
  private readonly fontAtlas: Texture
  private readonly views = new Map<string, NativeWorldSpeechView>()

  constructor(fontAtlas: Texture) {
    this.fontAtlas = fontAtlas
    this.container.eventMode = 'none'
  }

  update(
    speeches: readonly GameWorldSpeech[],
    players: Readonly<Record<string, WorldSpeechPlayer>>,
    nowMs: number,
    project: (point: Readonly<{ x: number; y: number }>) => NativeWorldScreenPoint | null,
    options: {
      includePlayer?: (playerId: string) => boolean
      renderable?: boolean
    } = {},
  ): NativeWorldSpeechDiagnostics {
    const items = deriveNativeWorldSpeechItems(
      speeches,
      players,
      nowMs,
      options.includePlayer,
    )
    const live = new Set<string>()
    const visibleItems: NativeWorldSpeechItem[] = []
    for (const item of items) {
      live.add(item.playerId)
      let view = this.views.get(item.playerId)
      if (!view) {
        view = new NativeWorldSpeechView(this.fontAtlas)
        this.views.set(item.playerId, view)
        this.container.addChild(view.container)
      }
      view.update(item.text, item.sequence, item.alpha)
      const screenPoint = project({
        x: item.position.x,
        y: item.position.y + WORLD_SPEECH_STYLE.anchorWorldOffsetY,
      })
      const visible = options.renderable !== false && screenPoint !== null
      view.container.visible = visible
      view.container.renderable = visible
      if (screenPoint !== null) {
        view.container.position.set(Math.round(screenPoint.x), Math.round(screenPoint.y))
      }
      if (visible) visibleItems.push(item)
    }

    for (const [playerId, view] of this.views) {
      if (live.has(playerId)) continue
      this.views.delete(playerId)
      this.container.removeChild(view.container)
      view.destroy()
    }

    return Object.freeze({
      activeCount: items.length,
      alphas: Object.freeze(visibleItems.map(({ alpha }) => alpha)),
      maximumAlpha: Math.max(0, ...visibleItems.map(({ alpha }) => alpha)),
      playerIds: Object.freeze(visibleItems.map(({ playerId }) => playerId)),
      sequences: Object.freeze(visibleItems.map(({ sequence }) => sequence)),
      visibleCount: visibleItems.length,
    })
  }

  destroy(): void {
    for (const view of this.views.values()) {
      this.container.removeChild(view.container)
      view.destroy()
    }
    this.views.clear()
    this.container.destroy({ children: true })
  }
}

function wrapNativeWorldSpeech(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const wordAdvance = measureWorldSpeechText(word)
    if (wordAdvance > WORLD_SPEECH_STYLE.contentMaxWidth) {
      if (current) {
        lines.push(current)
        current = ''
      }
      const pieces = breakWorldSpeechWord(word)
      lines.push(...pieces.slice(0, -1))
      current = pieces.at(-1) ?? ''
      continue
    }
    const candidate = current ? `${current} ${word}` : word
    if (current && measureWorldSpeechText(candidate) > WORLD_SPEECH_STYLE.contentMaxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current || lines.length === 0) lines.push(current)
  return lines
}

function breakWorldSpeechWord(word: string): string[] {
  const pieces: string[] = []
  let current = ''
  for (const character of word) {
    const candidate = current + character
    if (current && measureWorldSpeechText(candidate) > WORLD_SPEECH_STYLE.contentMaxWidth) {
      pieces.push(current)
      current = character
    } else {
      current = candidate
    }
  }
  if (current) pieces.push(current)
  return pieces
}

function measureWorldSpeechText(text: string): number {
  return measureNativeUiText(text, 'world-and-roster', WORLD_SPEECH_STYLE.fontScale)
}

class NativeWorldSpeechView {
  readonly container = new Container({ label: 'native-world-speech-item' })
  private readonly fontAtlas: Texture
  private readonly glyphTextures = new Map<string, Texture>()
  private readonly panel = new Graphics({ label: 'native-world-speech-panel' })
  private readonly text = new Container({ label: 'native-world-speech-text' })
  private messageKey = ''

  constructor(fontAtlas: Texture) {
    this.fontAtlas = fontAtlas
    this.container.eventMode = 'none'
    this.panel.eventMode = 'none'
    this.text.eventMode = 'none'
    this.container.addChild(this.panel, this.text)
  }

  update(text: string, sequence: number, alpha: number): void {
    const key = `${sequence}:${text}`
    if (key !== this.messageKey) {
      this.messageKey = key
      this.rebuild(text)
    }
    this.container.alpha = alpha
  }

  destroy(): void {
    this.container.destroy({ children: true })
    for (const texture of this.glyphTextures.values()) texture.destroy(false)
    this.glyphTextures.clear()
  }

  private rebuild(message: string): void {
    const style = WORLD_SPEECH_STYLE
    const layout = layoutNativeWorldSpeech(message)
    const left = -layout.width / 2
    const top = -layout.height - style.tailHeight
    this.panel.clear()
      .roundRect(left, top, layout.width, layout.height, style.radius)
      .fill({ color: style.borderColor, alpha: style.borderAlpha })
      .roundRect(left + 1, top + 1, layout.width - 2, layout.height - 2, style.radius - 1)
      .fill({ color: style.panelColor, alpha: style.panelAlpha })
      .poly([
        -style.tailHalfWidth, -style.tailHeight,
        style.tailHalfWidth, -style.tailHeight,
        0, 0,
      ], true)
      .fill({ color: style.borderColor, alpha: style.borderAlpha })
      .poly([
        -style.tailHalfWidth + 2, -style.tailHeight,
        style.tailHalfWidth - 2, -style.tailHeight,
        0, -2,
      ], true)
      .fill({ color: style.panelColor, alpha: style.panelAlpha })

    this.text.removeChildren().forEach(child => child.destroy())
    const capCenter = (style.fontCapTop + style.fontCapBottom) * style.fontScale / 2
    layout.lines.forEach((line, lineIndex) => {
      const baseline = top
        + style.verticalPadding
        + lineIndex * style.lineHeight
        + style.lineHeight / 2
        - capCenter
      for (const shadow of [true, false]) {
        for (const glyph of line.glyphs) {
          this.addGlyph(glyph, -line.advance / 2, baseline, shadow)
        }
      }
    })
  }

  private addGlyph(
    glyph: NativeUiGlyphLayout,
    offsetX: number,
    baseline: number,
    shadow: boolean,
  ): void {
    const style = WORLD_SPEECH_STYLE
    const texture = this.glyphTexture(glyph)
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.position.set(
      glyph.centerX + offsetX,
      glyph.centerY + baseline + (shadow ? style.shadowOffsetY : 0),
    )
    sprite.scale.set(style.fontScale)
    sprite.tint = shadow ? style.shadowColor : style.textColor
    sprite.alpha = shadow ? style.shadowAlpha : 1
    sprite.eventMode = 'none'
    this.text.addChild(sprite)
  }

  private glyphTexture(glyph: NativeUiGlyphLayout): Texture {
    const existing = this.glyphTextures.get(glyph.character)
    if (existing) return existing
    const texture = nativeUiGlyphRecordTexture(this.fontAtlas.source, glyph)
    this.glyphTextures.set(glyph.character, texture)
    return texture
  }
}
