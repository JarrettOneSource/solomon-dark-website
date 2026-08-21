import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'

import {
  layoutNativeAllyName,
  type NativeAllyNameGlyph,
} from '../ally-hud.ts'
import type { ProtocolPlayerState } from '../protocol/game-state.ts'

export const WORLD_NAMEPLATE_STYLE = Object.freeze({
  barHeight: 5,
  barTopOffset: 12,
  emptyColor: 0x2b1312,
  emptyAlpha: 0.94,
  fillColor: 0xb9342c,
  fillAlpha: 1,
  glyphScale: 0.5,
  highlightColor: 0xe78369,
  highlightAlpha: 0.9,
  horizontalPadding: 7,
  minimumWidth: 42,
  nameWorldOffsetY: -45,
  plateAlpha: 0.86,
  plateBorderAlpha: 0.9,
  plateBorderColor: 0x806a45,
  plateColor: 0x15110e,
  plateHeight: 15,
  plateTopOffset: -3,
  textTint: 0xf0dfb0,
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

export interface WorldNameplateVisualLayout {
  readonly glyphBounds: Readonly<{ left: number; right: number }>
  readonly glyphOffsetX: number
  readonly glyphs: readonly NativeAllyNameGlyph[]
  readonly width: number
}

export function worldNameplateVisualLayout(displayName: string): WorldNameplateVisualLayout {
  const nativeLayout = layoutNativeAllyName(displayName, WORLD_NAMEPLATE_STYLE.glyphScale)
  let left = 0
  let right = nativeLayout.advance
  for (const glyph of nativeLayout.glyphs) {
    left = Math.min(left, glyph.left)
    right = Math.max(right, glyph.left + glyph.width)
  }
  const glyphOffsetX = -(left + right) / 2
  return {
    glyphBounds: {
      left: left + glyphOffsetX,
      right: right + glyphOffsetX,
    },
    glyphOffsetX,
    glyphs: nativeLayout.glyphs,
    width: Math.max(
      WORLD_NAMEPLATE_STYLE.minimumWidth,
      Math.ceil(right - left + WORLD_NAMEPLATE_STYLE.horizontalPadding * 2),
    ),
  }
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
        y: item.position.y + WORLD_NAMEPLATE_STYLE.nameWorldOffsetY,
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
  private readonly plate = new Graphics({ label: 'world-nameplate-plate' })
  private readonly name = new Container({ label: 'native-world-name' })
  private readonly fontAtlas: Texture
  private readonly glyphTextures = new Map<string, Texture>()
  private displayName = ''

  constructor(fontAtlas: Texture) {
    this.fontAtlas = fontAtlas
    this.container.eventMode = 'none'
    this.name.eventMode = 'none'
    this.bar.eventMode = 'none'
    this.container.addChild(this.plate, this.name, this.bar)
  }

  update(displayName: string, healthRatio: number): void {
    const layout = worldNameplateVisualLayout(displayName)
    const width = layout.width
    if (displayName !== this.displayName) {
      this.displayName = displayName
      this.name.removeChildren().forEach((child) => child.destroy())
      for (const glyph of layout.glyphs) this.addGlyph(glyph, layout.glyphOffsetX)
    }

    this.plate.clear()
      .rect(
        -width / 2,
        WORLD_NAMEPLATE_STYLE.plateTopOffset,
        width,
        WORLD_NAMEPLATE_STYLE.plateHeight,
      )
      .fill({
        color: WORLD_NAMEPLATE_STYLE.plateColor,
        alpha: WORLD_NAMEPLATE_STYLE.plateAlpha,
      })
      .stroke({
        color: WORLD_NAMEPLATE_STYLE.plateBorderColor,
        alpha: WORLD_NAMEPLATE_STYLE.plateBorderAlpha,
        width: 1,
      })

    const innerWidth = width - 2
    const fillWidth = innerWidth * Math.min(1, Math.max(0, healthRatio))
    this.bar.clear()
      .rect(-width / 2, WORLD_NAMEPLATE_STYLE.barTopOffset, width, WORLD_NAMEPLATE_STYLE.barHeight)
      .fill({
        color: WORLD_NAMEPLATE_STYLE.plateBorderColor,
        alpha: WORLD_NAMEPLATE_STYLE.plateBorderAlpha,
      })
      .rect(
        -width / 2 + 1,
        WORLD_NAMEPLATE_STYLE.barTopOffset + 1,
        innerWidth,
        WORLD_NAMEPLATE_STYLE.barHeight - 2,
      )
      .fill({
        color: WORLD_NAMEPLATE_STYLE.emptyColor,
        alpha: WORLD_NAMEPLATE_STYLE.emptyAlpha,
      })
    if (fillWidth <= 0) return
    this.bar
      .rect(
        -width / 2 + 1,
        WORLD_NAMEPLATE_STYLE.barTopOffset + 1,
        fillWidth,
        WORLD_NAMEPLATE_STYLE.barHeight - 2,
      )
      .fill({
        color: WORLD_NAMEPLATE_STYLE.fillColor,
        alpha: WORLD_NAMEPLATE_STYLE.fillAlpha,
      })
      .rect(
        -width / 2 + 1,
        WORLD_NAMEPLATE_STYLE.barTopOffset + 1,
        fillWidth,
        1,
      )
      .fill({
        color: WORLD_NAMEPLATE_STYLE.highlightColor,
        alpha: WORLD_NAMEPLATE_STYLE.highlightAlpha,
      })
  }

  destroy(): void {
    this.container.destroy({ children: true })
    for (const texture of this.glyphTextures.values()) texture.destroy(false)
    this.glyphTextures.clear()
  }

  private addGlyph(glyph: NativeAllyNameGlyph, glyphOffsetX: number): void {
    const atlasWidth = glyph.width / WORLD_NAMEPLATE_STYLE.glyphScale
    const atlasHeight = glyph.height / WORLD_NAMEPLATE_STYLE.glyphScale
    const texture = this.glyphTexture(glyph, atlasWidth, atlasHeight)
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.position.set(
      glyph.left + glyph.width / 2 + glyphOffsetX,
      glyph.top + glyph.height / 2,
    )
    sprite.scale.set(WORLD_NAMEPLATE_STYLE.glyphScale)
    sprite.tint = WORLD_NAMEPLATE_STYLE.textTint
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
