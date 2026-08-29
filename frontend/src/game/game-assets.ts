import {
  createMenu,
  loader,
  mainMenu,
  matchLoading,
} from '../lib/assets.ts'
import { NATIVE_UI_ATLAS_SOURCES } from './native-ui/native-ui-assets.ts'
import {
  GAME_RESIDENT_AUDIO_SOURCES,
  loadGameAudioAsset,
} from './game-audio-browser.ts'
import {
  collectAssetSources,
  loadAssetBatches,
  type StagedAssetProgress,
} from './game-asset-readiness.ts'

export const LOADER_ASSET_SOURCES = collectAssetSources(loader)
export const LOADER_COMPOSITED_ASSET_SOURCES = LOADER_ASSET_SOURCES
export const TITLE_COMPOSITED_ASSET_SOURCES = collectAssetSources({
  button: mainMenu.button,
  buttonCorner: mainMenu.buttonCorner,
  buttonHover: mainMenu.buttonHover,
  buttonRail: mainMenu.buttonRail,
  flourish: mainMenu.flourish,
  hallOfFameBackground: mainMenu.hallOfFameBackground,
  logo: mainMenu.logo,
  text: mainMenu.text,
})
export const TITLE_STOCK_ASSET_SOURCES = [
  NATIVE_UI_ATLAS_SOURCES.Title,
  NATIVE_UI_ATLAS_SOURCES.UI,
] as const
export const TITLE_STOCK_POINT_ASSET_SOURCES = [NATIVE_UI_ATLAS_SOURCES.Fonts] as const
export const TITLE_GAME_ASSET_SOURCES = collectAssetSources({
  composites: TITLE_COMPOSITED_ASSET_SOURCES,
  point: TITLE_STOCK_POINT_ASSET_SOURCES,
  stock: TITLE_STOCK_ASSET_SOURCES,
})
export const CREATE_COMPOSITED_ASSET_SOURCES = collectAssetSources({
  nameCaption: createMenu.textNameCaption,
  nameClear: createMenu.textNameClear,
})
export const CREATE_STOCK_ASSET_SOURCES = [
  NATIVE_UI_ATLAS_SOURCES.Create,
  NATIVE_UI_ATLAS_SOURCES.UI,
] as const
export const CREATE_STOCK_POINT_ASSET_SOURCES = [NATIVE_UI_ATLAS_SOURCES.Fonts] as const
export const CREATE_GAME_ASSET_SOURCES = collectAssetSources({
  composites: CREATE_COMPOSITED_ASSET_SOURCES,
  point: CREATE_STOCK_POINT_ASSET_SOURCES,
  stock: CREATE_STOCK_ASSET_SOURCES,
})
export const MATCH_LOADING_GAME_ASSET_SOURCES = collectAssetSources(matchLoading)
export const GAME_STARTUP_IMAGE_SOURCES = collectAssetSources([
  LOADER_ASSET_SOURCES,
  TITLE_GAME_ASSET_SOURCES,
  MATCH_LOADING_GAME_ASSET_SOURCES,
])
export const GAME_STARTUP_ASSET_SOURCES = [
  ...GAME_STARTUP_IMAGE_SOURCES,
  ...GAME_RESIDENT_AUDIO_SOURCES,
]

const imagePromises = new Map<string, Promise<HTMLImageElement>>()

export type GameStartupStage = 'audio' | 'loader' | 'title' | 'transition'
export type GameStartupProgress = StagedAssetProgress<GameStartupStage>

export function initialGameStartupProgress(): GameStartupProgress {
  const allSources = new Set([
    ...GAME_STARTUP_ASSET_SOURCES,
  ])
  return {
    activeSource: GAME_STARTUP_ASSET_SOURCES[0] ?? null,
    completed: 0,
    stage: LOADER_ASSET_SOURCES.length > 0 ? 'loader' : 'title',
    total: allSources.size,
  }
}

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

export function loadGameStartupAssets(
  onProgress: (progress: GameStartupProgress) => void,
): Promise<void> {
  return loadAssetBatches<GameStartupStage>([
    {
      load: loadGameImage,
      sources: LOADER_ASSET_SOURCES,
      stage: 'loader',
    },
    {
      load: loadGameImage,
      sources: TITLE_GAME_ASSET_SOURCES,
      stage: 'title',
    },
    {
      load: loadGameImage,
      sources: MATCH_LOADING_GAME_ASSET_SOURCES,
      stage: 'transition',
    },
    {
      load: loadGameAudioAsset,
      sources: GAME_RESIDENT_AUDIO_SOURCES,
      stage: 'audio',
    },
  ], onProgress)
}

export function gameStartupStageLabel(progress: GameStartupProgress): string {
  if (!progress.activeSource) return 'Finishing startup'
  if (progress.stage === 'loader') return 'Preparing loading screen'
  if (progress.stage === 'title') return 'Loading title artwork'
  if (progress.stage === 'transition') return 'Preparing match loading screen'
  return 'Loading game audio'
}

export function releaseGameImages(sources: readonly string[]): void {
  for (const source of sources) imagePromises.delete(source)
}
