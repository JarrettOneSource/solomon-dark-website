import { BONEYARD_SPRITE_SOURCES } from '../editor/assets.ts'
import { STAGE_TEXTURES } from '../editor/render.ts'
import {
  boneyard,
  createMenu,
  elementVfx,
  hub,
  loader,
  mainMenu,
  menuSolomon,
  playerCharacter,
} from '../lib/assets.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import { GAME_AUDIO_SOURCES } from './game-audio-assets.ts'
import {
  collectAssetSources,
  loadAssetBatch,
  type AssetProgress,
} from './game-asset-readiness.ts'

export const LOADER_ASSET_SOURCES = collectAssetSources(loader)

export const GAME_RESIDENT_IMAGE_SOURCES = collectAssetSources({
  boneyard,
  boneyardSprites: BONEYARD_SPRITE_SOURCES,
  boneyardTextures: STAGE_TEXTURES,
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

export function hubGameAssetSources(element: WizardElement): string[] {
  return collectAssetSources({
    astronomer: hub.astronomer,
    courtyard: hub.courtyard,
    rooms: hub.rooms,
    seals: hub.seals,
    foreground: hub.foreground,
    southern: hub.southern,
    fountainParticle: hub.fountainParticle,
    tent: hub.tent,
    player: {
      staffBack: playerCharacter.staffBack,
      robeDynamic: playerCharacter.robeDynamic[element],
      robeFixed: playerCharacter.robeFixed[element],
      staffFront: playerCharacter.staffFront,
      head: playerCharacter.head[element],
    },
    markers: {
      help: hub.markers.help.right,
      talk: hub.markers.talk.right,
    },
    props: hub.props,
    npcs: hub.npcs,
    elementVfx: elementVfxSources(element),
  })
}

export function loadHubGameAssets(
  element: WizardElement,
  onProgress: (progress: AssetProgress) => void = () => undefined,
): Promise<void> {
  return loadAssetBatch(hubGameAssetSources(element), loadGameImage, onProgress)
}

export function releaseGameImages(sources: readonly string[]): void {
  for (const source of sources) imagePromises.delete(source)
}

function elementVfxSources(element: WizardElement): readonly string[] {
  switch (element) {
    case 'air': return [elementVfx.common.core, elementVfx.frames.air]
    case 'earth': return [elementVfx.common.core, elementVfx.frames.earth]
    case 'ether': return [elementVfx.common.core, elementVfx.common.ray, elementVfx.common.spark]
    case 'fire': return [elementVfx.common.core, elementVfx.frames.fire]
    case 'water': return [elementVfx.common.core, elementVfx.common.ray, elementVfx.frames.water]
  }
}
