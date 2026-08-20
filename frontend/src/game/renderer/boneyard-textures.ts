import { Texture } from 'pixi.js'

import solomonEncounterSource from '../../assets/game/anim-solomon-encounter.png'
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
  gridFrames,
  playerWorldAssetSources,
  stripFrames,
  type PlayerWorldTextures,
} from './world-player-textures.ts'
import { NATIVE_ENEMY_ASSET_SOURCES } from './native-enemy-assets.ts'
import { NATIVE_LOOT_ASSET_SOURCES } from './native-loot-assets.ts'

export interface BoneyardWorldTextures extends PlayerWorldTextures {
  assetSources: readonly string[]
  base: Readonly<Record<string, Texture>>
  graveDirt: Texture
  lantern: Texture
  levelUpSparkle: Texture
  regionLightGlyph: Texture
  solomonDialogueBody: readonly Texture[]
  solomonDialogueMouth: readonly (readonly Texture[])[]
  solomonDig: readonly Texture[]
  solomonShadow: Texture
  solomonWalk: readonly (readonly Texture[])[]
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
  const solomonShadowSource = spriteRefFor('DeadHawg', 13)?.src
  if (!solomonShadowSource) {
    throw new Error('Boneyard DeadHawg record 13 is unavailable.')
  }
  const liftedSourceSet = new Set([
    ...fenceSources,
    ...NATIVE_ENEMY_ASSET_SOURCES,
    ...NATIVE_LOOT_ASSET_SOURCES,
    solomonShadowSource,
  ])
  const sources = [...new Set([
    ...playerWorldAssetSources(),
    ...fenceSources,
    ...NATIVE_ENEMY_ASSET_SOURCES,
    ...NATIVE_LOOT_ASSET_SOURCES,
    boneyard.graveDirt,
    boneyard.lantern,
    boneyard.levelUpSparkle,
    boneyard.solomonDig,
    solomonEncounterSource,
    solomonShadowSource,
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
  const solomonEncounter = gridFrames(
    texture(solomonEncounterSource),
    15,
    10,
    200,
    200,
  )

  return {
    ...createPlayerWorldTextures(texture),
    assetSources: sources,
    base,
    graveDirt: texture(boneyard.graveDirt),
    lantern: texture(boneyard.lantern),
    levelUpSparkle: texture(boneyard.levelUpSparkle),
    regionLightGlyph: texture(regionLightRef.src),
    solomonDialogueBody: solomonEncounter[0],
    solomonDialogueMouth: solomonEncounter.slice(1, 4),
    solomonDig: stripFrames(texture(boneyard.solomonDig), 18, 200, 200, 'horizontal'),
    solomonShadow: texture(solomonShadowSource),
    solomonWalk: solomonEncounter.slice(4, 10),
  }
}

export function destroyBoneyardWorldTextures(textures: BoneyardWorldTextures): void {
  destroyPlayerWorldTextureFrames(textures)
  const derived = new Set<Texture>(textures.solomonDig)
  textures.solomonDialogueBody.forEach((frame) => derived.add(frame))
  textures.solomonDialogueMouth.forEach((row) => (
    row.forEach((frame) => derived.add(frame))
  ))
  textures.solomonWalk.forEach((row) => (
    row.forEach((frame) => derived.add(frame))
  ))
  for (const frame of derived) frame.destroy(false)
  for (const texture of Object.values(textures.base)) texture.destroy(true)
}
