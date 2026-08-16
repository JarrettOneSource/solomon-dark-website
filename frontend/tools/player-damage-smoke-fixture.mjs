import { Application, Texture } from 'pixi.js'

import { loadGameImage, releaseGameImages } from '../src/game/game-assets.ts'
import {
  createPlayerWorldTextures,
  destroyPlayerWorldTextureFrames,
  playerWorldAssetSources,
} from '../src/game/renderer/world-player-textures.ts'

export { Application }

export async function loadPlayerProofTextures() {
  const sources = playerWorldAssetSources()
  const images = await Promise.all(sources.map(async (source) => [
    source,
    await loadGameImage(source),
  ]))
  const base = Object.fromEntries(images.map(([source, image]) => [
    source,
    Texture.from(image, true),
  ]))
  releaseGameImages(sources)
  const textures = createPlayerWorldTextures((source) => base[source])
  return {
    destroy() {
      destroyPlayerWorldTextureFrames(textures)
      for (const texture of Object.values(base)) texture.destroy(true)
    },
    textures,
  }
}
