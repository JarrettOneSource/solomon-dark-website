import { Container, Graphics, Sprite, Texture } from 'pixi.js'

import { layoutNativeUiText, nativeUiGlyphInkBounds, type NativeUiGlyphLayout } from '../native-ui/core.ts'
import { nativeUiGlyphRecordTexture } from '../native-ui/native-ui-glyph-texture.ts'
import type { ProtocolPlayerState } from '../protocol/game-state.ts'

export type WorldNameplateElement = ProtocolPlayerState['config']['element']

/**
 * Website visual override for the floating multiplayer nameplate (see
 * docs/game-native-parity-re.md, "Multiplayer world nameplates and health
 * bars"). The native semantics are untouched: remote players only, the
 * authoritative unsmoothed health ratio, an empty rail at zero health, and a
 * world anchor 45 units above the actor. The plaque itself is a gilded
 * chamfered plate with the health rail recessed into its foot and the
 * wizard's element set as a pair of gems on the frame.
 *
 * All geometry is in whole screen pixels relative to the projected anchor so
 * the 1px frame, rail and gems stay crisp without antialiasing. The font ink
 * extents were measured from the group-6 atlas alpha channel: capitals span
 * -19..+6 atlas units and small capitals -15..0, so names are centred on the
 * capital box and every plate shares one baseline.
 */
export const WORLD_NAMEPLATE_STYLE = Object.freeze({
  chamfer: 3,
  emptyAlpha: 0.94,
  emptyColor: 0x2b1312,
  fillAlpha: 1,
  fillColor: 0xb9342c,
  fillShadeAlpha: 0.9,
  fillShadeColor: 0x8a241f,
  fontCapBottom: 6,
  fontCapTop: -19,
  frameAlpha: 0.92,
  frameColor: 0xc8a862,
  frameSheenAlpha: 0.22,
  frameSheenColor: 0xf0d491,
  gemCoreAlpha: 0.85,
  gemCoreColor: 0xffffff,
  gemGlowAlpha: 0.26,
  gemGlowReach: 5,
  gemReach: 3,
  glyphScale: 0.56,
  highlightAlpha: 0.9,
  highlightColor: 0xe78369,
  horizontalPadding: 9,
  minimumWidth: 56,
  nameWorldOffsetY: -45,
  plateAlpha: 0.9,
  plateBottomOffset: 8,
  plateColor: 0x0f0c13,
  plateHeight: 24,
  plateSheenAlpha: 0.035,
  plateSheenColor: 0xffffff,
  plateSheenRows: 4,
  railBottomGap: 1,
  railChannelAlpha: 0.55,
  railChannelColor: 0x000000,
  railHeight: 4,
  railInset: 3,
  shadowAlpha: 0.45,
  shadowColor: 0x000000,
  textShadowAlpha: 0.5,
  textShadowColor: 0x000000,
  textShadowOffsetY: 1,
  textTint: 0xefe3c6,
} as const)

export const WORLD_NAMEPLATE_ELEMENT_ACCENTS: Readonly<Record<WorldNameplateElement, number>> = Object.freeze({
  air: 0xd9f3ff,
  earth: 0x86d65e,
  ether: 0xc97cff,
  fire: 0xff8436,
  water: 0x55b8ff,
})

export interface NativeWorldNameplateItem {
  readonly element: WorldNameplateElement
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

/** Plate rows relative to the anchor; shared by the layout and the drawing. */
export const WORLD_NAMEPLATE_GEOMETRY = Object.freeze((() => {
  const style = WORLD_NAMEPLATE_STYLE
  const plateTop = style.plateBottomOffset - style.plateHeight
  const plateBottom = style.plateBottomOffset
  const railBottom = plateBottom - 1 - style.railBottomGap
  const railTop = railBottom - style.railHeight
  const nameTop = plateTop + 1
  const nameBottom = railTop - 1
  return {
    nameBottom,
    nameCenterY: (nameTop + nameBottom) / 2,
    nameTop,
    plateBottom,
    plateTop,
    railBottom,
    railTop,
  }
})())

export interface WorldNameplateVisualLayout {
  /** Capital-letter ink box in plate space; centred on the name area. */
  readonly capBox: Readonly<{ bottom: number; top: number }>
  readonly glyphBounds: Readonly<{ left: number; right: number }>
  readonly glyphOffsetX: number
  readonly glyphOffsetY: number
  readonly glyphs: readonly NativeUiGlyphLayout[]
  readonly width: number
}

export function worldNameplateVisualLayout(displayName: string): WorldNameplateVisualLayout {
  const style = WORLD_NAMEPLATE_STYLE
  const nativeLayout = layoutNativeUiText({ align: 'left', font: 'world-and-roster', scale: style.glyphScale, text: displayName, x: 0, y: 0 })
  let left = 0
  let right = nativeLayout.width
  for (const glyph of nativeLayout.glyphs) {
    const ink = nativeUiGlyphInkBounds(glyph)
    left = Math.min(left, ink.left)
    right = Math.max(right, ink.left + ink.width)
  }
  const glyphOffsetX = -(left + right) / 2
  const capTop = style.fontCapTop * style.glyphScale
  const capBottom = style.fontCapBottom * style.glyphScale
  const glyphOffsetY = WORLD_NAMEPLATE_GEOMETRY.nameCenterY - (capTop + capBottom) / 2
  return {
    capBox: {
      bottom: capBottom + glyphOffsetY,
      top: capTop + glyphOffsetY,
    },
    glyphBounds: {
      left: left + glyphOffsetX,
      right: right + glyphOffsetX,
    },
    glyphOffsetX,
    glyphOffsetY,
    glyphs: nativeLayout.glyphs,
    width: Math.max(
      style.minimumWidth,
      2 * Math.ceil((right - left + style.horizontalPadding * 2) / 2),
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
        element: player.config.element,
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
      view.update(item.name, item.healthRatio, item.element)
      const screenPoint = project({
        x: item.position.x,
        y: item.position.y + WORLD_NAMEPLATE_STYLE.nameWorldOffsetY,
      })
      const visible = options.renderable !== false && screenPoint !== null
      view.container.visible = visible
      view.container.renderable = visible
      // Whole-pixel placement keeps the hairline frame and glyphs crisp.
      if (screenPoint !== null) {
        view.container.position.set(Math.round(screenPoint.x), Math.round(screenPoint.y))
      }
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

function chamferedPlate(
  graphics: Graphics,
  halfWidth: number,
  top: number,
  height: number,
  chamfer: number,
): Graphics {
  const bottom = top + height
  return graphics.poly([
    -halfWidth + chamfer, top,
    halfWidth - chamfer, top,
    halfWidth, top + chamfer,
    halfWidth, bottom - chamfer,
    halfWidth - chamfer, bottom,
    -halfWidth + chamfer, bottom,
    -halfWidth, bottom - chamfer,
    -halfWidth, top + chamfer,
  ], true)
}

function diamond(graphics: Graphics, x: number, y: number, reach: number): Graphics {
  return graphics.poly([
    x - reach, y,
    x, y - reach,
    x + reach, y,
    x, y + reach,
  ], true)
}

class NativeWorldNameplateView {
  readonly container = new Container({ label: 'native-world-nameplate' })
  private readonly plate = new Graphics({ label: 'world-nameplate-plate' })
  private readonly rail = new Graphics({ label: 'native-world-health-bar' })
  private readonly name = new Container({ label: 'native-world-name' })
  private readonly fontAtlas: Texture
  private readonly glyphTextures = new Map<string, Texture>()
  private displayName = ''
  private plateKey = ''
  private railKey = ''

  constructor(fontAtlas: Texture) {
    this.fontAtlas = fontAtlas
    this.container.eventMode = 'none'
    this.name.eventMode = 'none'
    this.plate.eventMode = 'none'
    this.rail.eventMode = 'none'
    this.container.addChild(this.plate, this.rail, this.name)
  }

  update(displayName: string, healthRatio: number, element: WorldNameplateElement): void {
    const layout = worldNameplateVisualLayout(displayName)
    const width = layout.width
    if (displayName !== this.displayName) {
      this.displayName = displayName
      this.name.removeChildren().forEach((child) => child.destroy())
      for (const glyph of layout.glyphs) {
        this.addGlyph(glyph, layout.glyphOffsetX, layout.glyphOffsetY, true)
      }
      for (const glyph of layout.glyphs) {
        this.addGlyph(glyph, layout.glyphOffsetX, layout.glyphOffsetY, false)
      }
    }

    const plateKey = `${width}:${element}`
    if (plateKey !== this.plateKey) {
      this.plateKey = plateKey
      this.drawPlate(width, element)
    }
    const railKey = `${width}:${healthRatio}`
    if (railKey !== this.railKey) {
      this.railKey = railKey
      this.drawRail(width, healthRatio)
    }
  }

  destroy(): void {
    this.container.destroy({ children: true })
    for (const texture of this.glyphTextures.values()) texture.destroy(false)
    this.glyphTextures.clear()
  }

  private drawPlate(width: number, element: WorldNameplateElement): void {
    const style = WORLD_NAMEPLATE_STYLE
    const geometry = WORLD_NAMEPLATE_GEOMETRY
    const halfWidth = width / 2
    const plate = this.plate.clear()

    // Drop shadow: one pixel proud of the frame and one pixel lower.
    chamferedPlate(plate, halfWidth + 1, geometry.plateTop, style.plateHeight + 2, style.chamfer + 1)
      .fill({ color: style.shadowColor, alpha: style.shadowAlpha })

    // Gilded frame, then the dark plate inset one pixel inside it.
    chamferedPlate(plate, halfWidth, geometry.plateTop, style.plateHeight, style.chamfer)
      .fill({ color: style.frameColor, alpha: style.frameAlpha })
    chamferedPlate(plate, halfWidth - 1, geometry.plateTop + 1, style.plateHeight - 2, style.chamfer)
      .fill({ color: style.plateColor, alpha: style.plateAlpha })

    // Bevel: a bright hairline under the top edge and a faint sheen below it.
    const sheenLeft = -halfWidth + 1 + style.chamfer
    const sheenWidth = width - 2 - style.chamfer * 2
    plate
      .rect(sheenLeft, geometry.plateTop + 1, sheenWidth, 1)
      .fill({ color: style.frameSheenColor, alpha: style.frameSheenAlpha })
      .rect(sheenLeft, geometry.plateTop + 2, sheenWidth, style.plateSheenRows)
      .fill({ color: style.plateSheenColor, alpha: style.plateSheenAlpha })

    // Recessed channel the health rail sits in.
    const railLeft = -halfWidth + 1 + style.railInset
    const railWidth = width - 2 - style.railInset * 2
    plate
      .rect(railLeft - 1, geometry.railTop - 1, railWidth + 2, style.railHeight + 2)
      .fill({ color: style.railChannelColor, alpha: style.railChannelAlpha })

    // Element gems set into the frame at the name's mid-height.
    const accent = WORLD_NAMEPLATE_ELEMENT_ACCENTS[element]
    const gemY = Math.round(geometry.nameCenterY)
    for (const gemX of [-halfWidth, halfWidth]) {
      diamond(plate, gemX, gemY, style.gemGlowReach)
        .fill({ color: accent, alpha: style.gemGlowAlpha })
      diamond(plate, gemX, gemY, style.gemReach)
        .fill({ color: accent, alpha: 1 })
      plate
        .rect(gemX - 1, gemY - 1, 1, 1)
        .fill({ color: style.gemCoreColor, alpha: style.gemCoreAlpha })
    }
  }

  private drawRail(width: number, healthRatio: number): void {
    const style = WORLD_NAMEPLATE_STYLE
    const geometry = WORLD_NAMEPLATE_GEOMETRY
    const railLeft = -width / 2 + 1 + style.railInset
    const railWidth = width - 2 - style.railInset * 2
    const fillWidth = Math.round(railWidth * Math.min(1, Math.max(0, healthRatio)))
    const rail = this.rail.clear()
      .rect(railLeft, geometry.railTop, railWidth, style.railHeight)
      .fill({ color: style.emptyColor, alpha: style.emptyAlpha })
    if (fillWidth <= 0) return
    rail
      .rect(railLeft, geometry.railTop, fillWidth, style.railHeight)
      .fill({ color: style.fillColor, alpha: style.fillAlpha })
      .rect(railLeft, geometry.railTop, fillWidth, 1)
      .fill({ color: style.highlightColor, alpha: style.highlightAlpha })
      .rect(railLeft, geometry.railBottom - 1, fillWidth, 1)
      .fill({ color: style.fillShadeColor, alpha: style.fillShadeAlpha })
  }

  private addGlyph(
    glyph: NativeUiGlyphLayout,
    glyphOffsetX: number,
    glyphOffsetY: number,
    shadow: boolean,
  ): void {
    const style = WORLD_NAMEPLATE_STYLE
    const texture = this.glyphTexture(glyph)
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.position.set(
      glyph.centerX + glyphOffsetX,
      glyph.centerY + glyphOffsetY + (shadow ? style.textShadowOffsetY : 0),
    )
    sprite.scale.set(style.glyphScale)
    sprite.tint = shadow ? style.textShadowColor : style.textTint
    sprite.alpha = shadow ? style.textShadowAlpha : 1
    sprite.eventMode = 'none'
    this.name.addChild(sprite)
  }

  private glyphTexture(
    glyph: NativeUiGlyphLayout,
  ): Texture {
    const existing = this.glyphTextures.get(glyph.character)
    if (existing) return existing
    const texture = nativeUiGlyphRecordTexture(this.fontAtlas.source, glyph)
    this.glyphTextures.set(glyph.character, texture)
    return texture
  }
}
