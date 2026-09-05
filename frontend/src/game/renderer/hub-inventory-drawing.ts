import { Container, Graphics, NineSliceSprite, Sprite, Texture } from 'pixi.js'
import {
  nativeUiFont,
  nativeUiKerning,
  nativeUiRecord,
  NATIVE_UI_BUTTON,
  nativeUiRect,
  planNativeUiButtonChrome,
  type NativeUiFontName,
  type NativeUiAtlasRecord,
} from '../native-ui/core.ts'
import { nativeUiPixiFor } from '../native-ui/pixi.ts'
import { HUB_CHAT_INLINE_EMPHASIS, HUB_INVENTORY_INFO_FRAME, HUB_MSGBOX_ART } from './hub-inventory-render-contract.ts'
import type { RenderContext } from './hub-inventory-render-model.ts'

type AtlasName = 'Inventory' | 'Library' | 'Skills' | 'UI'

export type FontName = 'body' | 'medium' | 'menu' | 'skill' | 'special-uppercase'

export function addNativeButton(
  context: RenderContext,
  layer: Container,
  id: string,
  label: string,
  [left, top, width, height]: readonly [number, number, number, number],
  pressed: boolean,
  labelCenterX: number,
  labelBaselineY: number,
): number {
  const chrome = planNativeUiButtonChrome({
    bounds: nativeUiRect(left, top, width, height),
    id,
    state: pressed ? 'pressed' : 'idle',
  })
  layer.addChild(nativeUiPixiFor(context.textures).render(chrome, `${id}:chrome`))
  const copyOffset = pressed ? NATIVE_UI_BUTTON.pressedOffset : 0
  addBitmapText(
    context,
    layer,
    label,
    'menu',
    labelCenterX + copyOffset,
    labelBaselineY + copyOffset,
    { tint: HUB_MSGBOX_ART.primaryButtonTextTint },
  )
  return copyOffset
}

export function addHorizontalChain(context: RenderContext, layer: Container, x: number, y: number, width: number): void {
  addTiledAtlas(context, layer, 'UI', 10, x, y, width, 24, 1.25)
}

export function addInventoryInfoFrame(
  context: RenderContext,
  layer: Container,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  layer.addChild(new Graphics()
    .rect(x, y, width, height)
    .fill({ color: HUB_INVENTORY_INFO_FRAME.fillTint }))
  const frame = new NineSliceSprite({
    bottomHeight: HUB_INVENTORY_INFO_FRAME.sourceThird,
    height,
    leftWidth: HUB_INVENTORY_INFO_FRAME.sourceThird,
    rightWidth: HUB_INVENTORY_INFO_FRAME.sourceThird,
    texture: atlasTexture(context, 'Inventory', HUB_INVENTORY_INFO_FRAME.frameRecord),
    topHeight: HUB_INVENTORY_INFO_FRAME.sourceThird,
    width,
  })
  frame.label = 'native-inventory-info-frame'
  frame.position.set(x, y)
  layer.addChild(frame)
}

export function addPrimitiveFrame(layer: Container, x: number, y: number, width: number, height: number): void {
  layer.addChild(new Graphics().rect(x, y, width, height).stroke({ color: 0x000000, width: 2 }))
  layer.addChild(new Graphics().rect(x + 1, y + 1, width - 2, height - 2).stroke({
    color: 0xeadab3,
    width: 1,
  }))
  layer.addChild(new Graphics().rect(x + 2, y + 2, width - 4, height - 4).stroke({
    color: 0xd8ba70,
    width: 1,
  }))
  layer.addChild(new Graphics().rect(x + 3, y + 3, width - 6, height - 6).stroke({
    color: 0x15130b,
    width: 1,
  }))
}

export function addAtlasSprite(
  context: RenderContext,
  layer: Container,
  atlas: AtlasName,
  record: number,
  x: number,
  y: number,
  options: { readonly anchor?: number; readonly scale?: number } = {},
): Sprite {
  const sprite = new Sprite(atlasTexture(context, atlas, record))
  sprite.anchor.set(options.anchor ?? 0)
  sprite.position.set(x, y)
  sprite.scale.set(options.scale ?? 1)
  layer.addChild(sprite)
  return sprite
}

export function addCenteredAtlasSprite(
  context: RenderContext,
  layer: Container,
  atlas: AtlasName,
  record: number,
  centerX: number,
  centerY: number,
  scaleX = 1,
  scaleY = scaleX,
): Sprite {
  const sprite = addAtlasSprite(context, layer, atlas, record, centerX, centerY, { anchor: 0.5 })
  sprite.scale.set(scaleX, scaleY)
  return sprite
}

export function addNativeNineSlice(
  context: RenderContext,
  layer: Container,
  atlas: AtlasName,
  record: number,
  x: number,
  y: number,
  width: number,
  height: number,
  edgeUvOrigin: number,
  fill = true,
): void {
  const definition = nativeUiRecord(atlas, record)
  const [cornerWidth, cornerHeight] = definition.logicalSize
  const middleWidth = width - cornerWidth * 2
  const middleHeight = height - cornerHeight * 2

  addAtlasSprite(context, layer, atlas, record, x, y)
  const topRight = addAtlasSprite(context, layer, atlas, record, x + width, y)
  topRight.scale.x = -1
  const bottomLeft = addAtlasSprite(context, layer, atlas, record, x, y + height)
  bottomLeft.scale.y = -1
  const bottomRight = addAtlasSprite(context, layer, atlas, record, x + width, y + height)
  bottomRight.scale.set(-1, -1)

  const horizontalEdge = atlasSliceTexture(context, atlas, record, edgeUvOrigin, 0, 1, 1)
  const verticalEdge = atlasSliceTexture(context, atlas, record, 0, edgeUvOrigin, 1, 1)
  const center = atlasSliceTexture(context, atlas, record, edgeUvOrigin, edgeUvOrigin, 1, 1)
  addStretchedTexture(layer, horizontalEdge, x + cornerWidth, y, middleWidth, cornerHeight)
  addStretchedTexture(layer, horizontalEdge, x + cornerWidth, y + height - cornerHeight, middleWidth, cornerHeight, false, true)
  addStretchedTexture(layer, verticalEdge, x, y + cornerHeight, cornerWidth, middleHeight)
  addStretchedTexture(layer, verticalEdge, x + width - cornerWidth, y + cornerHeight, cornerWidth, middleHeight, true)
  if (fill) addStretchedTexture(layer, center, x + cornerWidth, y + cornerHeight, middleWidth, middleHeight)
}

function addStretchedTexture(
  layer: Container,
  texture: Texture,
  x: number,
  y: number,
  width: number,
  height: number,
  flipX = false,
  flipY = false,
): Sprite {
  const sprite = new Sprite(texture)
  sprite.position.set(x, y)
  sprite.width = width
  sprite.height = height
  if (flipX) {
    sprite.x += width
    sprite.scale.x *= -1
  }
  if (flipY) {
    sprite.y += height
    sprite.scale.y *= -1
  }
  layer.addChild(sprite)
  return sprite
}

export function addTiledAtlas(
  context: RenderContext,
  layer: Container,
  atlas: AtlasName,
  record: number,
  x: number,
  y: number,
  width: number,
  height: number,
  scale = 1,
): void {
  const definition = nativeUiRecord(atlas, record)
  const tileWidth = definition.logicalSize[0] * scale
  const tileHeight = definition.logicalSize[1] * scale
  for (let tileY = 0; tileY < height; tileY += tileHeight) {
    for (let tileX = 0; tileX < width; tileX += tileWidth) {
      const visibleWidth = Math.min(tileWidth, width - tileX)
      const visibleHeight = Math.min(tileHeight, height - tileY)
      if (visibleWidth === tileWidth && visibleHeight === tileHeight) {
        addAtlasSprite(context, layer, atlas, record, x + tileX, y + tileY, { scale })
        continue
      }
      const texture = atlasSliceTexture(
        context,
        atlas,
        record,
        0,
        0,
        visibleWidth / tileWidth,
        visibleHeight / tileHeight,
      )
      addStretchedTexture(layer, texture, x + tileX, y + tileY, visibleWidth, visibleHeight)
    }
  }
}

export function addRepeatedAtlas(
  context: RenderContext,
  layer: Container,
  atlas: AtlasName,
  record: number,
  x: number,
  y: number,
  width: number,
  height: number,
  columns: number,
  rows: number,
): Sprite[] {
  const sprites: Sprite[] = []
  const definition = nativeUiRecord(atlas, record)
  const [tileWidth, tileHeight] = definition.logicalSize
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const offsetX = column * tileWidth
      const offsetY = row * tileHeight
      const visibleWidth = Math.min(tileWidth, width - offsetX)
      const visibleHeight = Math.min(tileHeight, height - offsetY)
      if (visibleWidth <= 0 || visibleHeight <= 0) continue
      const texture = visibleWidth === tileWidth && visibleHeight === tileHeight
        ? atlasTexture(context, atlas, record)
        : atlasSliceTexture(
            context,
            atlas,
            record,
            0,
            0,
            visibleWidth / tileWidth,
            visibleHeight / tileHeight,
          )
      const sprite = addStretchedTexture(
        layer,
        texture,
        x + offsetX,
        y + offsetY,
        visibleWidth,
        visibleHeight,
      )
      sprites.push(sprite)
    }
  }
  return sprites
}

function atlasTexture(context: RenderContext, atlas: AtlasName, record: number): Texture {
  return nativeUiPixiFor(context.textures).texture(atlas, record)
}

function atlasSliceTexture(
  context: RenderContext,
  atlas: AtlasName,
  record: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): Texture {
  return nativeUiPixiFor(context.textures).slice(atlas, record, [left, top, right, bottom])
}

export function addBitmapText(
  context: RenderContext,
  layer: Container,
  text: string,
  fontName: FontName,
  x: number,
  y: number,
  options: {
    readonly align?: 'center' | 'left' | 'right'
    readonly lineHeight?: number
    readonly maxWidth?: number
    readonly scale?: number
    readonly tint?: number
  } = {},
): void {
  layer.addChild(nativeUiPixiFor(context.textures).text({
    align: options.align,
    font: nativeUiFontName(fontName),
    lineHeight: options.lineHeight,
    maxWidth: options.maxWidth,
    scale: options.scale,
    text,
    tint: options.tint,
    x,
    y,
  }))
}

interface BitmapTextRun {
  readonly advanceScale?: number
  readonly italic?: boolean
  readonly offsetX?: number
  readonly offsetY?: number
  readonly scale?: number
  readonly text: string
}

export function addBitmapTextRuns(
  context: RenderContext,
  layer: Container,
  runs: readonly BitmapTextRun[],
  fontName: FontName,
  x: number,
  y: number,
  tint: number,
): void {
  const nativeFontName = nativeUiFontName(fontName)
  const font = nativeUiFont(nativeFontName)
  let cursor = x
  let previous = -1
  for (const run of runs) {
    const scale = run.scale ?? 1
    const advanceScale = run.advanceScale ?? scale
    for (const character of run.text) {
      const code = character.codePointAt(0)!
      if (character === ' ') {
        cursor += font.spaceAdvance * advanceScale
        previous = code
        continue
      }
      const glyph = font.glyphs[`${code}`]
      if (!glyph?.metrics) continue
      cursor += nativeUiKerning(nativeFontName, previous, code) * advanceScale
      const sprite = nativeUiPixiFor(context.textures).glyph(nativeFontName, code)
      sprite.anchor.set(0.5)
      sprite.scale.set(scale)
      if (run.italic) applyExactTextItalic(sprite, glyph)
      sprite.tint = tint
      sprite.position.set(
        cursor + glyph.metrics[1] * scale + (run.offsetX ?? 0),
        y + glyph.metrics[2] * scale + (run.offsetY ?? 0),
      )
      layer.addChild(sprite)
      cursor += glyph.metrics[0] * advanceScale
      previous = code
    }
  }
}

function nativeUiFontName(fontName: FontName): NativeUiFontName {
  return fontName === 'skill' ? 'skill-uppercase' : fontName
}

export function applyExactTextItalic(sprite: Sprite, glyph: NativeUiAtlasRecord): void {
  const glyphHeight = glyph.frame[3]
  if (glyphHeight <= 0) return
  const totalDelta = HUB_CHAT_INLINE_EMPHASIS.glyphTopDelta
    - HUB_CHAT_INLINE_EMPHASIS.glyphBottomDelta
  const italicAngle = Math.atan(totalDelta / glyphHeight)
  sprite.skew.x = -italicAngle
  sprite.scale.y /= Math.cos(italicAngle)
}
