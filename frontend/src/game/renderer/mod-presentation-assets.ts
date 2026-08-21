import { Rectangle, Texture } from 'pixi.js'

import type { ModConsumableContent } from '../core-kernels/hub-economy.ts'
import { loadGameImage, releaseGameImages } from '../game-assets.ts'
import type { GameModAsset } from '../protocol/game-protocol.ts'

export interface ModPresentationTextures {
  destroy(): void
  texture(content: ModConsumableContent): Texture
}

export async function loadModPresentationTextures(
  assets: readonly GameModAsset[],
): Promise<ModPresentationTextures> {
  const sources = assets.map(asset => ({
    key: assetKey(asset.modId, asset.path),
    source: `data:image/png;base64,${asset.bytesBase64}`,
  }))
  const images = await Promise.all(sources.map(async asset => ({
    ...asset,
    image: await loadGameImage(asset.source),
  })))
  const bases = new Map(images.map(asset => [
    asset.key,
    Texture.from(asset.image, true),
  ]))
  const frames = new Map<string, Texture>()
  let destroyed = false
  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      for (const texture of frames.values()) texture.destroy()
      for (const texture of bases.values()) texture.destroy(true)
      frames.clear()
      bases.clear()
      releaseGameImages(sources.map(({ source }) => source))
    },
    texture(content) {
      if (destroyed) throw new Error('mod presentation textures are destroyed')
      const cached = frames.get(content.contentId)
      if (cached) return cached
      const base = bases.get(assetKey(content.modId, content.icon.imagePath))
      if (!base) {
        throw new Error(`mod icon asset is unavailable: ${content.modId}:${content.icon.imagePath}`)
      }
      const record = content.icon.frame
      const texture = new Texture({
        frame: new Rectangle(record.x, record.y, record.width, record.height),
        orig: new Rectangle(0, 0, record.logicalWidth, record.logicalHeight),
        source: base.source,
        trim: new Rectangle(
          (record.logicalWidth - record.width) / 2 + record.centerOffsetX,
          (record.logicalHeight - record.height) / 2 + record.centerOffsetY,
          record.width,
          record.height,
        ),
      })
      frames.set(content.contentId, texture)
      return texture
    },
  }
}

function assetKey(modId: string, path: string): string {
  return `${modId.toLowerCase()}\0${path.toLowerCase()}`
}
