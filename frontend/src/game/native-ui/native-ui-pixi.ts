import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js'

import { textureFrom, type GameTextureMap } from '../renderer/game-webgl.ts'
import {
  nativeStockPointTextureFromImage,
} from '../renderer/native-fixed-function-render-pipeline.ts'
import { nativeSpriteRecordTexture } from '../renderer/native-sprite-record-texture.ts'
import { nativeUiAtlasSource } from './native-ui-assets.ts'
import {
  nativeUiFont,
  nativeUiRecord,
  type NativeUiAtlasName,
  type NativeUiFontName,
  type NativeUiGlyphRecord,
} from './native-ui-catalog.ts'
import { nativeUiGlyphRecordTexture } from './native-ui-glyph-texture.ts'
import type {
  NativeUiFragment,
  NativeUiNineSliceNode,
  NativeUiNode,
  NativeUiSliceNode,
  NativeUiSpriteNode,
  NativeUiTileNode,
} from './native-ui-plan.ts'
import { layoutNativeUiText, type NativeUiTextSpec } from './native-ui-text.ts'

export interface NativeUiPixiAdapter {
  destroy(): void
  glyph(font: NativeUiFontName, codePoint: number): Sprite
  render(fragment: NativeUiFragment, label?: string): Container
  slice(
    atlas: NativeUiAtlasName,
    record: number,
    sourceUv: readonly [left: number, top: number, right: number, bottom: number],
  ): Texture
  sprite(spec: NativeUiSpriteNode): Sprite
  text(spec: NativeUiTextSpec, label?: string): Container
  texture(atlas: NativeUiAtlasName, record: number): Texture
}

const SHARED_ADAPTERS = new WeakMap<GameTextureMap, NativeUiPixiAdapter>()

export function nativeUiPixiFor(textures: GameTextureMap): NativeUiPixiAdapter {
  const existing = SHARED_ADAPTERS.get(textures)
  if (existing) return existing
  const created = createNativeUiPixiAdapter(textures)
  SHARED_ADAPTERS.set(textures, created)
  return created
}

export function destroyNativeUiPixiFor(textures: GameTextureMap): void {
  const adapter = SHARED_ADAPTERS.get(textures)
  if (!adapter) return
  SHARED_ADAPTERS.delete(textures)
  adapter.destroy()
}

export function createNativeUiPixiAdapter(textures: GameTextureMap): NativeUiPixiAdapter {
  const derived = new Map<string, Texture>()
  const pointFilteredAtlases = new Map<NativeUiAtlasName, Texture>()
  let destroyed = false

  const assertLive = (): void => {
    if (destroyed) throw new Error('native UI Pixi adapter is destroyed')
  }

  const texture = (atlas: NativeUiAtlasName, record: number): Texture => {
    assertLive()
    const key = `${atlas}.${record}`
    const cached = derived.get(key)
    if (cached) return cached
    const definition = nativeUiRecord(atlas, record)
    const source = textureFrom(textures.textures, nativeUiAtlasSource(atlas))
    const [x, y, width, height] = definition.frame
    const [logicalWidth, logicalHeight] = definition.logicalSize
    const [trimX, trimY] = definition.trimOrigin
    const result = nativeSpriteRecordTexture({
      frame: new Rectangle(x, y, width, height),
      orig: new Rectangle(0, 0, logicalWidth, logicalHeight),
      source: source.source,
      trim: new Rectangle(trimX, trimY, width, height),
    })
    derived.set(key, result)
    return result
  }

  const sliceTexture = (
    atlas: NativeUiAtlasName,
    record: number,
    sourceUv: readonly [left: number, top: number, right: number, bottom: number],
  ): Texture => {
    assertLive()
    const [left, top, right, bottom] = sourceUv
    if (
      !sourceUv.every(Number.isFinite)
      || left < 0
      || top < 0
      || right > 1
      || bottom > 1
      || right <= left
      || bottom <= top
    ) throw new RangeError('native UI slice UV must be an ordered unit rectangle')
    const key = `${atlas}.${record}:slice:${left},${top},${right},${bottom}`
    const cached = derived.get(key)
    if (cached) return cached
    const definition = nativeUiRecord(atlas, record)
    const source = textureFrom(textures.textures, nativeUiAtlasSource(atlas))
    const [x, y, width, height] = definition.frame
    const sliceWidth = width * (right - left)
    const sliceHeight = height * (bottom - top)
    const result = nativeSpriteRecordTexture({
      frame: new Rectangle(x, y, width, height),
      orig: new Rectangle(0, 0, sliceWidth, sliceHeight),
      source: source.source,
      sourceUv,
    })
    derived.set(key, result)
    return result
  }

  const glyphTexture = (atlas: NativeUiAtlasName, glyph: NativeUiGlyphRecord): Texture => {
    assertLive()
    const [x, y, width, height] = glyph.frame
    const key = `${atlas}.glyph.${glyph.record}.${x}.${y}.${width}.${height}`
    const cached = derived.get(key)
    if (cached) return cached
    let source = pointFilteredAtlases.get(atlas)
    if (!source) {
      const linearSource = textureFrom(textures.textures, nativeUiAtlasSource(atlas))
      const image = linearSource.source.resource
      if (!(image instanceof HTMLImageElement)) {
        throw new Error(`native ${atlas} font atlas is not image-backed`)
      }
      source = nativeStockPointTextureFromImage(image)
      pointFilteredAtlases.set(atlas, source)
    }
    const result = nativeUiGlyphRecordTexture(source.source, glyph)
    derived.set(key, result)
    return result
  }

  const sprite = (spec: NativeUiSpriteNode): Sprite => {
    const definition = nativeUiRecord(spec.atlas, spec.record)
    const result = new Sprite(texture(spec.atlas, spec.record))
    const [anchorX, anchorY] = spec.anchor ?? [0, 0]
    result.anchor.set(anchorX, anchorY)
    result.position.set(spec.x, spec.y)
    result.rotation = spec.rotation ?? 0
    result.tint = spec.tint ?? 0xffffff
    result.alpha = spec.alpha ?? 1
    result.eventMode = 'none'
    const scale = spec.scale ?? 1
    const scaleX = (spec.width === undefined ? scale : spec.width / definition.logicalSize[0])
      * (spec.mirrorX ? -1 : 1)
    const scaleY = (spec.height === undefined ? scale : spec.height / definition.logicalSize[1])
      * (spec.mirrorY ? -1 : 1)
    result.scale.set(scaleX, scaleY)
    if (spec.label) result.label = spec.label
    return result
  }

  const text = (spec: NativeUiTextSpec, label = spec.text): Container => {
    assertLive()
    const layout = layoutNativeUiText(spec)
    const font = nativeUiFont(spec.font)
    const result = new Container({ label })
    result.eventMode = 'none'
    for (const glyph of layout.glyphs) {
      const glyphSprite = new Sprite(glyphTexture(font.atlas, glyph))
      glyphSprite.anchor.set(0.5)
      glyphSprite.position.set(glyph.centerX, glyph.centerY)
      glyphSprite.scale.set(glyph.scale)
      glyphSprite.tint = glyph.tint
      glyphSprite.alpha = glyph.alpha
      glyphSprite.eventMode = 'none'
      result.addChild(glyphSprite)
    }
    return result
  }

  const glyph = (fontName: NativeUiFontName, codePoint: number): Sprite => {
    assertLive()
    const font = nativeUiFont(fontName)
    const definition = font.glyphs[`${codePoint}`]
    if (!definition) throw new RangeError(`native ${fontName} font has no glyph ${codePoint}`)
    const result = new Sprite(glyphTexture(font.atlas, definition))
    result.eventMode = 'none'
    return result
  }

  const renderNode = (layer: Container, node: NativeUiNode): void => {
    switch (node.kind) {
      case 'clip': {
        const label = node.label ?? 'native-ui-clip'
        const content = new Container({ label })
        content.eventMode = 'none'
        for (const child of node.nodes) renderNode(content, child)
        const mask = new Graphics()
          .rect(node.bounds.left, node.bounds.top, node.bounds.width, node.bounds.height)
          .fill({ color: 0xffffff })
        mask.label = `${label}:mask`
        mask.eventMode = 'none'
        content.mask = mask
        layer.addChild(content, mask)
        return
      }
      case 'solid': {
        const graphic = new Graphics()
          .rect(node.bounds.left, node.bounds.top, node.bounds.width, node.bounds.height)
          .fill({ color: node.color })
        graphic.alpha = node.alpha ?? 1
        graphic.eventMode = 'none'
        if (node.label) graphic.label = node.label
        layer.addChild(graphic)
        return
      }
      case 'sprite':
        layer.addChild(sprite(node))
        return
      case 'slice':
        layer.addChild(renderSlice(node))
        return
      case 'tile':
        layer.addChild(renderTile(node))
        return
      case 'nine-slice':
        layer.addChild(renderNineSlice(node))
        return
      case 'text':
        layer.addChild(text(node.text, node.label))
        return
    }
  }

  const renderSlice = (node: NativeUiSliceNode): Sprite => {
    const result = new Sprite(sliceTexture(node.atlas, node.record, node.sourceUv))
    result.position.set(
      node.bounds.left + (node.mirrorX ? node.bounds.width : 0),
      node.bounds.top + (node.mirrorY ? node.bounds.height : 0),
    )
    result.width = node.bounds.width
    result.height = node.bounds.height
    if (node.mirrorX) result.scale.x *= -1
    if (node.mirrorY) result.scale.y *= -1
    result.alpha = node.alpha ?? 1
    result.tint = node.tint ?? 0xffffff
    result.eventMode = 'none'
    if (node.label) result.label = node.label
    return result
  }

  const renderTile = (node: NativeUiTileNode): Container => {
    const result = new Container({ label: node.label ?? `${node.atlas}.${node.record}:tile` })
    result.alpha = node.alpha ?? 1
    result.eventMode = 'none'
    const definition = nativeUiRecord(node.atlas, node.record)
    const scale = node.scale ?? 1
    const tileWidth = definition.logicalSize[0] * scale
    const tileHeight = definition.logicalSize[1] * scale
    for (let tileY = 0; tileY < node.bounds.height; tileY += tileHeight) {
      for (let tileX = 0; tileX < node.bounds.width; tileX += tileWidth) {
        const visibleWidth = Math.min(tileWidth, node.bounds.width - tileX)
        const visibleHeight = Math.min(tileHeight, node.bounds.height - tileY)
        const child = visibleWidth === tileWidth && visibleHeight === tileHeight
          ? sprite({
              atlas: node.atlas,
              kind: 'sprite',
              record: node.record,
              scale,
              tint: node.tint,
              x: node.bounds.left + tileX,
              y: node.bounds.top + tileY,
            })
          : renderSlice({
              atlas: node.atlas,
              bounds: {
                height: visibleHeight,
                left: node.bounds.left + tileX,
                top: node.bounds.top + tileY,
                width: visibleWidth,
              },
              kind: 'slice',
              record: node.record,
              sourceUv: [0, 0, visibleWidth / tileWidth, visibleHeight / tileHeight],
              tint: node.tint,
            })
        result.addChild(child)
      }
    }
    return result
  }

  const renderNineSlice = (node: NativeUiNineSliceNode): Container => {
    if (!Number.isFinite(node.edgeUvOrigin) || node.edgeUvOrigin <= 0 || node.edgeUvOrigin >= 1) {
      throw new RangeError('native UI nine-slice edge origin must be within (0, 1)')
    }
    const definition = nativeUiRecord(node.atlas, node.record)
    const [cornerWidth, cornerHeight] = definition.logicalSize
    if (node.bounds.width < cornerWidth * 2 || node.bounds.height < cornerHeight * 2) {
      throw new RangeError('native UI nine-slice bounds are smaller than two corners')
    }
    const result = new Container({ label: node.label ?? `${node.atlas}.${node.record}:nine-slice` })
    result.alpha = node.alpha ?? 1
    result.eventMode = 'none'
    const right = node.bounds.left + node.bounds.width
    const bottom = node.bounds.top + node.bounds.height
    const middleWidth = node.bounds.width - cornerWidth * 2
    const middleHeight = node.bounds.height - cornerHeight * 2
    result.addChild(
      sprite({ atlas: node.atlas, kind: 'sprite', record: node.record, tint: node.tint, x: node.bounds.left, y: node.bounds.top }),
      sprite({ atlas: node.atlas, kind: 'sprite', mirrorX: true, record: node.record, tint: node.tint, x: right, y: node.bounds.top }),
      sprite({ atlas: node.atlas, kind: 'sprite', mirrorY: true, record: node.record, tint: node.tint, x: node.bounds.left, y: bottom }),
      sprite({ atlas: node.atlas, kind: 'sprite', mirrorX: true, mirrorY: true, record: node.record, tint: node.tint, x: right, y: bottom }),
      renderSlice({
        atlas: node.atlas,
        bounds: { height: cornerHeight, left: node.bounds.left + cornerWidth, top: node.bounds.top, width: middleWidth },
        kind: 'slice',
        record: node.record,
        sourceUv: [node.edgeUvOrigin, 0, 1, 1],
        tint: node.tint,
      }),
      renderSlice({
        atlas: node.atlas,
        bounds: { height: cornerHeight, left: node.bounds.left + cornerWidth, top: bottom - cornerHeight, width: middleWidth },
        kind: 'slice',
        mirrorY: true,
        record: node.record,
        sourceUv: [node.edgeUvOrigin, 0, 1, 1],
        tint: node.tint,
      }),
      renderSlice({
        atlas: node.atlas,
        bounds: { height: middleHeight, left: node.bounds.left, top: node.bounds.top + cornerHeight, width: cornerWidth },
        kind: 'slice',
        record: node.record,
        sourceUv: [0, node.edgeUvOrigin, 1, 1],
        tint: node.tint,
      }),
      renderSlice({
        atlas: node.atlas,
        bounds: { height: middleHeight, left: right - cornerWidth, top: node.bounds.top + cornerHeight, width: cornerWidth },
        kind: 'slice',
        mirrorX: true,
        record: node.record,
        sourceUv: [0, node.edgeUvOrigin, 1, 1],
        tint: node.tint,
      }),
      renderSlice({
        atlas: node.atlas,
        bounds: { height: middleHeight, left: node.bounds.left + cornerWidth, top: node.bounds.top + cornerHeight, width: middleWidth },
        kind: 'slice',
        record: node.record,
        sourceUv: [node.edgeUvOrigin, node.edgeUvOrigin, 1, 1],
        tint: node.tint,
      }),
    )
    return result
  }

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      for (const item of derived.values()) item.destroy(false)
      derived.clear()
      for (const item of pointFilteredAtlases.values()) item.destroy(true)
      pointFilteredAtlases.clear()
    },
    glyph,
    render(fragment, label = 'native-ui-plan') {
      assertLive()
      const result = new Container({ label })
      result.eventMode = 'none'
      result.alpha = 'opacity' in fragment && typeof fragment.opacity === 'number'
        ? fragment.opacity
        : 1
      for (const node of fragment.nodes) renderNode(result, node)
      return result
    },
    slice: sliceTexture,
    sprite,
    text,
    texture,
  }
}
