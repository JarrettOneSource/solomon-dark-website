import { Texture } from 'pixi.js'

import { spriteRefFor } from '../../editor/assets.ts'
import { liftedSpriteSource } from '../../editor/lifted-sprite.ts'
import { boneyard } from '../../lib/assets.ts'
import { loadGameImage, releaseGameImages } from '../game-assets.ts'
import {
  NATIVE_REGION_LIGHT_ATLAS,
  NATIVE_REGION_LIGHT_ENTRY,
} from './boneyard-lighting.ts'
import {
  createPlayerWorldTextures,
  destroyPlayerWorldTextureFrames,
  playerWorldAssetSources,
  stripFrames,
  type PlayerWorldTextures,
} from './world-player-textures.ts'
import { NATIVE_ENEMY_ASSET_SOURCES } from './native-enemy-assets.ts'

export interface BoneyardWorldTextures extends PlayerWorldTextures {
  assetSources: readonly string[]
  base: Readonly<Record<string, Texture>>
  graveDirt: Texture
  lantern: Texture
  regionLightGlyph: Texture
  solomonDig: readonly Texture[]
}

export async function loadBoneyardWorldTextures(): Promise<BoneyardWorldTextures> {
  const regionLightRef = spriteRefFor(
    NATIVE_REGION_LIGHT_ATLAS,
    NATIVE_REGION_LIGHT_ENTRY,
  )
  if (!regionLightRef) throw new Error('Native Region light glyph is missing.')
  const fenceSources = [3, 7, 8, 36].flatMap((entry) => {
    const ref = spriteRefFor('DeadHawg', entry)
    return ref ? [ref.src] : []
  })
  fenceSources.push(regionLightRef.src)
  const liftedSourceSet = new Set([
    ...fenceSources,
    ...NATIVE_ENEMY_ASSET_SOURCES,
  ])
  const sources = [...new Set([
    ...playerWorldAssetSources(),
    ...fenceSources,
    ...NATIVE_ENEMY_ASSET_SOURCES,
    boneyard.graveDirt,
    boneyard.lantern,
    boneyard.solomonDig,
  ])]
  let images: readonly (readonly [string, HTMLImageElement])[]
  try {
    images = await Promise.all(sources.map(async (source) => [
      source,
      await loadGameImage(source),
    ] as const))
  } catch (error) {
    releaseGameImages(sources)
    throw error
  }

  const loaded: Array<readonly [string, Texture]> = []
  try {
    for (const [source, image] of images) {
      loaded.push([
        source,
        Texture.from(liftedSourceSet.has(source) ? liftedSpriteSource(image) : image, true),
      ])
    }
  } catch (error) {
    for (const [, texture] of loaded) texture.destroy(true)
    releaseGameImages(sources)
    throw error
  }
  releaseGameImages(sources)
  const base = Object.fromEntries(loaded) as Record<string, Texture>
  const texture = (source: string): Texture => {
    const result = base[source]
    if (!result) throw new Error(`Boneyard texture was not loaded: ${source}`)
    return result
  }

  return {
    ...createPlayerWorldTextures(texture),
    assetSources: sources,
    base,
    graveDirt: texture(boneyard.graveDirt),
    lantern: texture(boneyard.lantern),
    regionLightGlyph: texture(regionLightRef.src),
    solomonDig: stripFrames(texture(boneyard.solomonDig), 18, 200, 200, 'horizontal'),
  }
}

export function destroyBoneyardWorldTextures(textures: BoneyardWorldTextures): void {
  destroyPlayerWorldTextureFrames(textures)
  for (const frame of textures.solomonDig) frame.destroy(false)
  for (const texture of Object.values(textures.base)) texture.destroy(true)
}
