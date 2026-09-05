import { Application, Texture } from 'pixi.js'

import { loadGameImage, releaseGameImages } from '../src/game/game-assets.ts'
import {
  BONEYARD_COMBAT_ATLAS_SOURCES,
  boneyardCombatAtlasSourceIsPacked,
  createBoneyardCombatAtlas,
} from '../src/game/renderer/boneyard-combat-atlas.ts'
import {
  createPlayerWorldTextures,
  destroyPlayerWorldTextureFrames,
  playerWorldAssetSources,
} from '../src/game/renderer/world-player-textures.ts'

export { Application }

export async function loadPlayerProofTextures() {
  const sources = [...new Set([
    ...BONEYARD_COMBAT_ATLAS_SOURCES,
    ...playerWorldAssetSources().filter(source => !boneyardCombatAtlasSourceIsPacked(source)),
  ])]
  const images = await Promise.all(sources.map(async (source) => [
    source,
    await loadGameImage(source),
  ]))
  const base = Object.fromEntries(images.map(([source, image]) => [
    source,
    Texture.from(image, true),
  ]))
  releaseGameImages(sources)
  const combatAtlas = createBoneyardCombatAtlas(source => base[source])
  const textures = createPlayerWorldTextures(source => (
    boneyardCombatAtlasSourceIsPacked(source) ? combatAtlas.single(source) : base[source]
  ))
  return {
    destroy() {
      destroyPlayerWorldTextureFrames(textures)
      combatAtlas.destroy()
      for (const texture of Object.values(base)) texture.destroy(true)
    },
    textures,
  }
}
