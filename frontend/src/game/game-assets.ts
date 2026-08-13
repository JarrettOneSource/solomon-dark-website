import {
  createMenu,
  elementVfx,
  hub,
  loader,
  mainMenu,
  menuSolomon,
  playerCharacter,
} from '../lib/assets'
import { collectAssetSources, loadAssetBatch, type AssetProgress } from './game-asset-readiness'

export const LOADER_ASSET_SOURCES = collectAssetSources(loader)

export const GAME_RESIDENT_ASSET_SOURCES = collectAssetSources({
  createMenu,
  elementVfx,
  hub,
  mainMenu,
  menuSolomon,
  playerCharacter,
})

const imagePromises = new Map<string, Promise<HTMLImageElement>>()

export function loadGameImage(source: string): Promise<HTMLImageElement> {
  const cached = imagePromises.get(source)
  if (cached) return cached

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = async () => {
      try {
        await image.decode()
      } catch {
        // A successful load is authoritative. Chromium may reject decode()
        // for a resource it has already decoded and discarded in headless or
        // memory-constrained sessions.
      }
      resolve(image)
    }
    image.onerror = () => reject(new Error(`could not load game asset: ${source}`))
    image.src = source
  })
  imagePromises.set(source, promise)
  return promise
}

export function loadLoaderAssets(): Promise<void> {
  return Promise.all(LOADER_ASSET_SOURCES.map(loadGameImage)).then(() => undefined)
}

export function loadResidentGameAssets(
  onProgress: (progress: AssetProgress) => void,
): Promise<void> {
  return loadAssetBatch(GAME_RESIDENT_ASSET_SOURCES, loadGameImage, onProgress)
}
