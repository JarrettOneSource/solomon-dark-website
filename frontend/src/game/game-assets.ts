import {
  createMenu,
  elementVfx,
  hub,
  loader,
  mainMenu,
  menuSolomon,
  playerCharacter,
} from '../lib/assets'
import { GAME_AUDIO_SOURCES } from './game-audio-assets.ts'
import { collectAssetSources, loadAssetBatch, type AssetProgress } from './game-asset-readiness'

export const LOADER_ASSET_SOURCES = collectAssetSources(loader)

export const GAME_RESIDENT_IMAGE_SOURCES = collectAssetSources({
  createMenu,
  elementVfx,
  hub,
  mainMenu,
  menuSolomon,
  playerCharacter,
})
export const GAME_RESIDENT_AUDIO_SOURCES = collectAssetSources(GAME_AUDIO_SOURCES)
export const GAME_RESIDENT_ASSET_SOURCES = [
  ...GAME_RESIDENT_IMAGE_SOURCES,
  ...GAME_RESIDENT_AUDIO_SOURCES,
]

const imagePromises = new Map<string, Promise<HTMLImageElement>>()
const audioPromises = new Map<string, Promise<HTMLAudioElement>>()
const audioSources = new Set(GAME_RESIDENT_AUDIO_SOURCES)

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

export function loadGameAudio(source: string): Promise<HTMLAudioElement> {
  const cached = audioPromises.get(source)
  if (cached) return cached

  const promise = new Promise<HTMLAudioElement>((resolve, reject) => {
    const audio = new Audio(source)
    audio.preload = 'auto'
    const cleanup = () => {
      audio.removeEventListener('loadeddata', handleLoaded)
      audio.removeEventListener('error', handleError)
    }
    const handleLoaded = () => {
      cleanup()
      resolve(audio)
    }
    const handleError = () => {
      cleanup()
      reject(new Error(`could not load game audio: ${source}`))
    }
    audio.addEventListener('loadeddata', handleLoaded)
    audio.addEventListener('error', handleError)
    audio.load()
  })
  audioPromises.set(source, promise)
  return promise
}

export function loadResidentGameAssets(
  onProgress: (progress: AssetProgress) => void,
): Promise<void> {
  return loadAssetBatch(
    GAME_RESIDENT_ASSET_SOURCES,
    (source) => audioSources.has(source) ? loadGameAudio(source) : loadGameImage(source),
    onProgress,
  )
}
