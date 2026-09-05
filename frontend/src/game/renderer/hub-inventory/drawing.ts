import {
  type NativeUiTextRun,
  nativeUiRecord,
  wrapNativeUiTextRuns,
} from '../../native-ui/core.ts'
import { nativeUiPixiFor } from '../../native-ui/pixi.ts'
import { hubChatTextRuns } from '../hub-inventory-render-contract.ts'
import {
  type AtlasName,
  type FontName,
  type RenderContext,
} from './model.ts'
import {
  Container,
  Sprite,
  Texture,
} from 'pixi.js'

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

export function atlasTexture(context: RenderContext, atlas: AtlasName, record: number): Texture {
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
    font: fontName,
    lineHeight: options.lineHeight,
    maxWidth: options.maxWidth,
    scale: options.scale,
    text,
    tint: options.tint,
    x,
    y,
  }))
}

export function addBitmapTextRuns(
  context: RenderContext,
  layer: Container,
  runs: readonly NativeUiTextRun[],
  font: FontName,
  x: number,
  y: number,
  tint: number,
): void {
  layer.addChild(nativeUiPixiFor(context.textures).textRuns({ font, runs, tint, x, y }))
}

export function addChatBitmapText(
  context: RenderContext,
  layer: Container,
  source: string,
  x: number,
  y: number,
  options: {
    readonly lineHeight: number
    readonly maxWidth: number
    readonly tint: number
  },
): number {
  const lines = wrapNativeUiTextRuns(hubChatTextRuns(source), 'menu', options.maxWidth)
  lines.forEach((line, lineIndex) => {
    layer.addChild(nativeUiPixiFor(context.textures).textRuns({
      font: 'menu',
      runs: line,
      tint: options.tint,
      x,
      y: y + lineIndex * options.lineHeight,
    }))
  })
  return lines.length
}
