import { Rectangle, Texture } from 'pixi.js'

import type {
  ModConsumableContent,
  ModItemContent,
  ModSpriteFrame,
} from '../core-kernels/hub-economy.ts'
import { loadGameImage, releaseGameImages } from '../game-assets.ts'
import type { GameModAsset } from '../protocol/game-protocol.ts'
import { gameContentUrl } from '../game-content-cache.ts'

export interface ModPresentationTextures {
  destroy(): void
  iconTrim(content: ModItemContent): Texture | null
  spriteFrame(
    cacheKey: string,
    modId: string,
    imagePath: string,
    frame: ModSpriteFrame,
  ): Texture
  texture(content: ModConsumableContent | ModItemContent): Texture
  wearable(content: ModItemContent): ModWearableTextureFrames | null
}

export interface ModWearableTextureFrames {
  readonly primary: readonly (readonly Texture[])[]
  readonly secondary: readonly (readonly Texture[])[] | null
  readonly slot: NonNullable<ModItemContent['wearable']>['slot']
}

export async function loadModPresentationTextures(
  assets: readonly GameModAsset[],
): Promise<ModPresentationTextures> {
  const sources = assets.filter(asset => asset.kind === 'image').map(asset => ({
    key: assetKey(asset.modId, asset.path),
    source: gameContentUrl(asset),
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
  const wearableFrames = new Map<string, ModWearableTextureFrames>()
  const derived = new Set<Texture>()
  let destroyed = false
  const base = (modId: string, path: string, field: string): Texture => {
    const value = bases.get(assetKey(modId, path))
    if (!value) throw new Error(`${field} is unavailable: ${modId}:${path}`)
    return value
  }
  const iconTexture = (
    content: ModConsumableContent | ModItemContent,
    icon: ModConsumableContent['icon'] | ModItemContent['icon'],
    suffix: string,
    imagePath = icon.imagePath,
  ): Texture => {
    const key = `${content.contentId}:${suffix}`
    const cached = frames.get(key)
    if (cached) return cached
    const source = base(content.modId, imagePath, 'mod icon asset')
    const record = icon.frame
    const texture = new Texture({
      frame: new Rectangle(record.x, record.y, record.width, record.height),
      orig: new Rectangle(0, 0, record.logicalWidth, record.logicalHeight),
      source: source.source,
      trim: new Rectangle(
        (record.logicalWidth - record.width) / 2 + record.centerOffsetX,
        (record.logicalHeight - record.height) / 2 + record.centerOffsetY,
        record.width,
        record.height,
      ),
    })
    frames.set(key, texture)
    derived.add(texture)
    return texture
  }
  const actorSheet = (
    modId: string,
    path: string,
    maximumRows: number,
  ): Readonly<{ source: Texture, rows: number }> => {
    const source = base(modId, path, 'mod wearable asset')
    const columns = source.width / 170
    const rows = source.height / 170
    if (columns !== 24 || !Number.isInteger(rows) || rows < 1 || rows > maximumRows) {
      throw new Error(`mod wearable asset has invalid geometry: ${modId}:${path}`)
    }
    source.source.style.scaleMode = 'nearest'
    return { rows, source }
  }
  const actorFrames = (
    sheet: Readonly<{ source: Texture, rows: number }>,
  ): readonly (readonly Texture[])[] => {
    return Object.freeze(Array.from({ length: 24 }, (_, heading) => Object.freeze(
      Array.from({ length: sheet.rows }, (_, pose) => {
        const texture = new Texture({
          frame: new Rectangle(heading * 170, pose * 170, 170, 170),
          orig: new Rectangle(0, 0, 170, 170),
          source: sheet.source.source,
        })
        derived.add(texture)
        return texture
      }),
    )))
  }
  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      for (const texture of derived) texture.destroy(false)
      for (const texture of bases.values()) texture.destroy(true)
      derived.clear()
      frames.clear()
      wearableFrames.clear()
      bases.clear()
      releaseGameImages(sources.map(({ source }) => source))
    },
    iconTrim(content) {
      if (destroyed) throw new Error('mod presentation textures are destroyed')
      return content.iconTrimImagePath
        ? iconTexture(content, content.icon, 'icon-trim', content.iconTrimImagePath)
        : null
    },
    spriteFrame(cacheKey, modId, imagePath, frame) {
      if (destroyed) throw new Error('mod presentation textures are destroyed')
      const key = `sprite:${cacheKey}`
      const cached = frames.get(key)
      if (cached) return cached
      const source = base(modId, imagePath, 'mod sprite asset')
      const texture = new Texture({
        frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
        orig: new Rectangle(0, 0, frame.logicalWidth, frame.logicalHeight),
        source: source.source,
        trim: new Rectangle(
          (frame.logicalWidth - frame.width) / 2 + frame.centerOffsetX,
          (frame.logicalHeight - frame.height) / 2 + frame.centerOffsetY,
          frame.width,
          frame.height,
        ),
      })
      frames.set(key, texture)
      derived.add(texture)
      return texture
    },
    texture(content) {
      if (destroyed) throw new Error('mod presentation textures are destroyed')
      return iconTexture(content, content.icon, 'icon')
    },
    wearable(content) {
      if (destroyed) throw new Error('mod presentation textures are destroyed')
      const wearable = content.wearable
      if (!wearable) return null
      const cached = wearableFrames.get(content.contentId)
      if (cached) return cached
      const maximumRows = wearable.slot === 'hat' ? 1 : wearable.slot === 'robe' ? 5 : 10
      const primarySheet = actorSheet(content.modId, wearable.wornImagePath, maximumRows)
      const secondarySheet = wearable.wornTrimImagePath
        ? actorSheet(content.modId, wearable.wornTrimImagePath, maximumRows)
        : null
      if (secondarySheet && secondarySheet.rows !== primarySheet.rows) {
        throw new Error(`mod wearable layers have different pose counts: ${content.modId}:${content.key}`)
      }
      const primary = actorFrames(primarySheet)
      const secondary = secondarySheet ? actorFrames(secondarySheet) : null
      const result = Object.freeze({ primary, secondary, slot: wearable.slot })
      wearableFrames.set(content.contentId, result)
      return result
    },
  }
}

function assetKey(modId: string, path: string): string {
  return `${modId.toLowerCase()}\0${path.toLowerCase()}`
}

export function modWearableFrame(
  textures: ModWearableTextureFrames,
  layer: 'primary' | 'secondary',
  heading: number,
  pose: number,
): Texture {
  const bank = layer === 'primary' ? textures.primary : textures.secondary
  const poses = bank?.[heading]
  if (!poses || poses.length === 0) throw new RangeError(`Missing mod wearable ${layer} frame`)
  return poses[Math.min(pose, poses.length - 1)]!
}
