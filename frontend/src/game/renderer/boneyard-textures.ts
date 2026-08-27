import type { Texture } from 'pixi.js'

import solomonEncounterSource from '../../assets/game/anim-solomon-encounter.png'
import { spriteRefFor } from '../../editor/assets.ts'
import { boneyard } from '../../lib/assets.ts'
import { loadGameTextureEntries } from './game-webgl.ts'
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
import {
  BONEYARD_COMBAT_ATLAS_SOURCES,
  boneyardCombatAtlasSourceIsPacked,
  createBoneyardCombatAtlas,
  type BoneyardCombatAtlas,
} from './boneyard-combat-atlas.ts'
import { boneyardCombatAssetSource } from './boneyard-combat-asset-source.ts'
import { nativeArenaTextureFromImage } from './native-arena-render-pipeline.ts'

export interface BoneyardWorldTextures extends PlayerWorldTextures {
  assetSources: readonly string[]
  base: Readonly<Record<string, Texture>>
  combatAtlas: BoneyardCombatAtlas
  graveDirt: Texture
  lantern: Texture
  levelUpSparkle: Texture
  regionLightGlyph: Texture
  solomonDialogueBody: readonly Texture[]
  solomonDialogueMouth: readonly (readonly Texture[])[]
  solomonDig: readonly Texture[]
  solomonFlydirt: Texture
  solomonShadow: Texture
  solomonWalk: readonly (readonly Texture[])[]
  weatherSplash: Texture
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
  const weatherSplashSource = spriteRefFor('DeadHawg', 24)?.src
  if (!weatherSplashSource) {
    throw new Error('Boneyard DeadHawg record 24 is unavailable.')
  }
  const requestedSources = [...new Set([
    ...playerWorldAssetSources(),
    ...fenceSources,
    ...NATIVE_ENEMY_ASSET_SOURCES,
    ...NATIVE_LOOT_ASSET_SOURCES,
    boneyard.graveDirt,
    boneyard.lantern,
    boneyardCombatAssetSource(boneyard.levelUpSparkle),
    boneyard.solomonDig,
    boneyard.solomonFlydirt,
    solomonEncounterSource,
    solomonShadowSource,
    weatherSplashSource,
  ])]
  const packedSources = requestedSources.filter(boneyardCombatAtlasSourceIsPacked)
  const sources = [
    ...requestedSources.filter((source) => !boneyardCombatAtlasSourceIsPacked(source)),
    ...BONEYARD_COMBAT_ATLAS_SOURCES,
  ]
  const combatPageSources = new Set<string>(BONEYARD_COMBAT_ATLAS_SOURCES)
  const loaded = await loadGameTextureEntries(sources, (source, image) => (
    nativeArenaTextureFromImage(
      image,
      combatPageSources.has(source) ? 'repeat' : 'clamp-to-edge',
    )
  ))
  const base = Object.fromEntries(loaded) as Record<string, Texture>
  const texture = (source: string): Texture => {
    const result = base[boneyardCombatAssetSource(source)]
    if (!result) throw new Error(`Boneyard texture was not loaded: ${source}`)
    return result
  }
  let combatAtlas: BoneyardCombatAtlas
  try {
    combatAtlas = createBoneyardCombatAtlas(texture)
    for (const source of packedSources) base[source] = combatAtlas.single(source)
  } catch (error) {
    for (const [, loadedTexture] of loaded) loadedTexture.destroy(true)
    throw error
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
    combatAtlas,
    graveDirt: texture(boneyard.graveDirt),
    lantern: texture(boneyard.lantern),
    levelUpSparkle: texture(boneyard.levelUpSparkle),
    regionLightGlyph: texture(regionLightRef.src),
    solomonDialogueBody: solomonEncounter[0],
    solomonDialogueMouth: solomonEncounter.slice(1, 4),
    solomonDig: stripFrames(texture(boneyard.solomonDig), 18, 200, 200, 'horizontal'),
    solomonFlydirt: texture(boneyard.solomonFlydirt),
    solomonShadow: texture(solomonShadowSource),
    solomonWalk: solomonEncounter.slice(4, 10),
    weatherSplash: texture(weatherSplashSource),
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
  textures.combatAtlas.destroy()
  for (const source of textures.assetSources) textures.base[source].destroy(true)
}
