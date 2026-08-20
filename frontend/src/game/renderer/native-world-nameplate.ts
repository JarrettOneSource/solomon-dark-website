import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'

import {
  layoutNativeAllyName,
  type NativeAllyNameGlyph,
} from '../ally-hud.ts'
import type { ProtocolPlayerState } from '../protocol/game-state.ts'

export const NATIVE_WORLD_NAMEPLATE = Object.freeze({
  barHeight: 7,
  barTopOffset: 17,
  emptyColor: 0x360d0d,
  emptyAlpha: 220 / 255,
  fillColor: 0xbe1f18,
  fillAlpha: 240 / 255,
  glyphScale: 0.5,
  highlightColor: 0xff694e,
  highlightAlpha: 210 / 255,
  minimumBarWidth: 64,
  nameWorldOffsetY: -45,
  borderColor: 0x0c0606,
  borderAlpha: 235 / 255,
} as const)

export interface NativeWorldNameplateItem {
  readonly healthRatio: number
  readonly id: string
  readonly name: string
  readonly position: Readonly<{ x: number; y: number }>
}

export interface NativeWorldScreenTransform {
  readonly position: Readonly<{ x: number; y: number }>
  readonly scale: number
}

export interface NativeWorldScreenViewport {
  readonly height: number
  readonly width: number
}

export interface NativeWorldScreenPoint {
  readonly x: number
  readonly y: number
}

type WorldPlayer = Pick<ProtocolPlayerState, 'config' | 'position' | 'progression'>

const NATIVE_NAMEPLATE_WHITESPACE = /\s/u

export function nativeWorldNameplateHealthRatio(
  currentHealth: number,
  maximumHealth: number,
): number | null {
  if (
    !Number.isFinite(currentHealth)
    || !Number.isFinite(maximumHealth)
    || maximumHealth <= 0
  ) return null
  return Math.min(1, Math.max(0, currentHealth / maximumHealth))
}

export function nativeWorldNameplateWidth(displayName: string): number {
  let width = 0
  for (const char of displayName) {
    width += NATIVE_NAMEPLATE_WHITESPACE.test(char) ? 4 : 8
  }
  return Math.max(NATIVE_WORLD_NAMEPLATE.minimumBarWidth, width)
}

export function deriveNativeWorldNameplateItems(
  players: Readonly<Record<string, WorldPlayer>>,
  localPlayerId: string,
  includePlayer: (playerId: string, player: WorldPlayer) => boolean = () => true,
): NativeWorldNameplateItem[] {
  return Object.entries(players)
    .filter(([playerId, player]) => (
      playerId !== localPlayerId
      && includePlayer(playerId, player)
      && player.config.displayName.length > 0
      && Number.isFinite(player.position.x)
      && Number.isFinite(player.position.y)
    ))
    .sort(([leftId], [rightId]) => (
      leftId < rightId ? -1 : leftId > rightId ? 1 : 0
    ))
    .flatMap(([id, player]) => {
      const healthRatio = nativeWorldNameplateHealthRatio(
        player.progression.currentHealth,
        player.progression.maximumHealth,
      )
      return healthRatio === null ? [] : [{
        healthRatio,
        id,
        name: player.config.displayName,
        position: { ...player.position },
      }]
    })
}

export function projectNativeWorldPoint(
  point: Readonly<{ x: number; y: number }>,
  transform: NativeWorldScreenTransform,
  viewport: NativeWorldScreenViewport,
): NativeWorldScreenPoint | null {
  if (
    !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
    || !Number.isFinite(transform.position.x)
    || !Number.isFinite(transform.position.y)
    || !Number.isFinite(transform.scale)
    || transform.scale <= 0
    || !Number.isFinite(viewport.width)
    || !Number.isFinite(viewport.height)
    || viewport.width <= 0
    || viewport.height <= 0
  ) return null

  const projected = {
    x: transform.position.x + point.x * transform.scale,
    y: transform.position.y + point.y * transform.scale,
  }
  return projected.x < 0
    || projected.x > viewport.width
    || projected.y < 0
    || projected.y > viewport.height
    ? null
    : projected
}

export class NativeWorldNameplateLayer {
  readonly container = new Container({ label: 'native-world-nameplates' })
  private readonly views = new Map<string, NativeWorldNameplateView>()
  private readonly fontAtlas: Texture

  constructor(fontAtlas: Texture) {
    this.fontAtlas = fontAtlas
    this.container.eventMode = 'none'
  }

  update(
    players: Readonly<Record<string, WorldPlayer>>,
    localPlayerId: string,
    project: (point: Readonly<{ x: number; y: number }>) => NativeWorldScreenPoint | null,
    options: {
      includePlayer?: (playerId: string, player: WorldPlayer) => boolean
      renderable?: boolean
    } = {},
  ): void {
    const items = deriveNativeWorldNameplateItems(
      players,
      localPlayerId,
      options.includePlayer,
    )
    const live = new Set<string>()
    for (const item of items) {
      live.add(item.id)
      let view = this.views.get(item.id)
      if (!view) {
        view = new NativeWorldNameplateView(this.fontAtlas)
        this.views.set(item.id, view)
        this.container.addChild(view.container)
      }
      view.update(item.name, item.healthRatio)
      const screenPoint = project({
        x: item.position.x,
        y: item.position.y + NATIVE_WORLD_NAMEPLATE.nameWorldOffsetY,
      })
      const visible = options.renderable !== false && screenPoint !== null
      view.container.visible = visible
      view.container.renderable = visible
      if (screenPoint !== null) view.container.position.set(screenPoint.x, screenPoint.y)
    }

    for (const [playerId, view] of this.views) {
      if (live.has(playerId)) continue
      this.views.delete(playerId)
      this.container.removeChild(view.container)
      view.destroy()
    }
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

class NativeWorldNameplateView {
  readonly container = new Container({ label: 'native-world-nameplate' })
  private readonly bar = new Graphics({ label: 'native-world-health-bar' })
  private readonly name = new Container({ label: 'native-world-name' })
  private readonly fontAtlas: Texture
  private readonly glyphTextures = new Map<string, Texture>()
  private displayName = ''

  constructor(fontAtlas: Texture) {
    this.fontAtlas = fontAtlas
    this.container.eventMode = 'none'
    this.name.eventMode = 'none'
    this.bar.eventMode = 'none'
    this.container.addChild(this.name, this.bar)
  }

  update(displayName: string, healthRatio: number): void {
    const width = nativeWorldNameplateWidth(displayName)
    if (displayName !== this.displayName) {
      this.displayName = displayName
      this.name.removeChildren().forEach((child) => child.destroy())
      const layout = layoutNativeAllyName(
        displayName,
        NATIVE_WORLD_NAMEPLATE.glyphScale,
      )
      for (const glyph of layout.glyphs) this.addGlyph(glyph, width)
    }

    const innerWidth = width - 2
    const fillWidth = innerWidth * Math.min(1, Math.max(0, healthRatio))
    this.bar.clear()
      .rect(-width / 2, NATIVE_WORLD_NAMEPLATE.barTopOffset, width, NATIVE_WORLD_NAMEPLATE.barHeight)
      .fill({
        color: NATIVE_WORLD_NAMEPLATE.borderColor,
        alpha: NATIVE_WORLD_NAMEPLATE.borderAlpha,
      })
      .rect(
        -width / 2 + 1,
        NATIVE_WORLD_NAMEPLATE.barTopOffset + 1,
        innerWidth,
        NATIVE_WORLD_NAMEPLATE.barHeight - 2,
      )
      .fill({
        color: NATIVE_WORLD_NAMEPLATE.emptyColor,
        alpha: NATIVE_WORLD_NAMEPLATE.emptyAlpha,
      })
    if (fillWidth <= 0) return
    this.bar
      .rect(
        -width / 2 + 1,
        NATIVE_WORLD_NAMEPLATE.barTopOffset + 1,
        fillWidth,
        NATIVE_WORLD_NAMEPLATE.barHeight - 2,
      )
      .fill({
        color: NATIVE_WORLD_NAMEPLATE.fillColor,
        alpha: NATIVE_WORLD_NAMEPLATE.fillAlpha,
      })
      .rect(
        -width / 2 + 1,
        NATIVE_WORLD_NAMEPLATE.barTopOffset + 1,
        fillWidth,
        1,
      )
      .fill({
        color: NATIVE_WORLD_NAMEPLATE.highlightColor,
        alpha: NATIVE_WORLD_NAMEPLATE.highlightAlpha,
      })
  }

  destroy(): void {
    this.container.destroy({ children: true })
    for (const texture of this.glyphTextures.values()) texture.destroy(false)
    this.glyphTextures.clear()
  }

  private addGlyph(glyph: NativeAllyNameGlyph, nameWidth: number): void {
    const atlasWidth = glyph.width / NATIVE_WORLD_NAMEPLATE.glyphScale
    const atlasHeight = glyph.height / NATIVE_WORLD_NAMEPLATE.glyphScale
    const texture = this.glyphTexture(glyph, atlasWidth, atlasHeight)
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.position.set(
      -nameWidth / 2 + glyph.left + glyph.width / 2,
      glyph.top + glyph.height / 2,
    )
    sprite.scale.set(NATIVE_WORLD_NAMEPLATE.glyphScale)
    sprite.tint = 0xffffff
    sprite.eventMode = 'none'
    this.name.addChild(sprite)
  }

  private glyphTexture(
    glyph: NativeAllyNameGlyph,
    atlasWidth: number,
    atlasHeight: number,
  ): Texture {
    const existing = this.glyphTextures.get(glyph.char)
    if (existing) return existing
    const texture = new Texture({
      source: this.fontAtlas.source,
      frame: new Rectangle(glyph.atlasX, glyph.atlasY, atlasWidth, atlasHeight),
    })
    this.glyphTextures.set(glyph.char, texture)
    return texture
  }
}
