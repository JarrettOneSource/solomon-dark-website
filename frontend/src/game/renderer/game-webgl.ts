// Installs Pixi's static CSP-safe shader paths; no runtime eval is required.
import 'pixi.js/unsafe-eval'
import { Application, Texture } from 'pixi.js'

import { hub } from '../../lib/assets.ts'
import {
  loadGameImage,
  releaseGameImages,
} from '../game-assets.ts'
import { mapAssetSources } from '../game-asset-readiness.ts'
import {
  installNativeFixedFunctionRenderPipeline,
  nativeCompositedTextureFromImage,
  nativeStockPointTextureFromImage,
  nativeStockTextureFromImage,
} from './native-fixed-function-render-pipeline.ts'

export interface GameWebGlApplication {
  application: Application
  canvas: HTMLCanvasElement
}

export interface GameTextureMap {
  sources: readonly string[]
  textures: Readonly<Record<string, Texture>>
  destroy(): void
}

interface GameWebGlApplicationOptions {
  backgroundAlpha?: number
  className: string
  height: number
  resolution: number
  width: number
}

interface GameTextureLoadOptions {
  compositedSources?: readonly string[]
  pointSources?: readonly string[]
}

export async function createGameWebGlApplication({
  backgroundAlpha = 1,
  className,
  height,
  resolution,
  width,
}: GameWebGlApplicationOptions): Promise<GameWebGlApplication> {
  const application = new Application()
  try {
    await application.init({
      antialias: false,
      autoDensity: true,
      autoStart: false,
      background: 0x000000,
      backgroundAlpha,
      height,
      powerPreference: 'high-performance',
      preference: 'webgl',
      preferWebGLVersion: 2,
      resolution,
      roundPixels: false,
      width,
    })
    if (!application.renderer.name.toLowerCase().includes('webgl')) {
      throw new Error('WebGL is unavailable; the CPU canvas fallback is not supported.')
    }
    installNativeFixedFunctionRenderPipeline(application.renderer, {
      preserveBrowserCompositingAlpha: backgroundAlpha === 0,
    })
  } catch (error) {
    if (application.renderer) application.destroy({ removeView: true })
    throw error
  }
  application.stop()
  const canvas = application.canvas as HTMLCanvasElement
  canvas.className = className
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.gameRenderer = 'pixi-webgl'
  canvas.dataset.rendererName = application.renderer.name
  canvas.dataset.resolution = `${resolution}`
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  return { application, canvas }
}

export async function loadGameTextureMap(
  requestedSources: readonly string[],
  options: GameTextureLoadOptions = {},
): Promise<GameTextureMap> {
  const sources = [...new Set(requestedSources)]
  const entries = await loadGameTextureEntries(sources, options)
  const textures = Object.fromEntries(entries) as Record<string, Texture>
  let destroyed = false
  return {
    sources,
    textures,
    destroy() {
      if (destroyed) return
      destroyed = true
      for (const texture of Object.values(textures)) texture.destroy(true)
    },
  }
}

export async function loadGameTextureEntries(
  requestedSources: readonly string[],
  options: GameTextureLoadOptions = {},
): Promise<Array<readonly [string, Texture]>> {
  const sources = [...new Set(requestedSources)]
  const compositedSources = new Set(options.compositedSources ?? [])
  const pointSources = new Set([hub.hud.fontAtlas, ...(options.pointSources ?? [])])
  const entries: Array<readonly [string, Texture]> = []
  try {
    await mapAssetSources(sources, async (source) => {
      try {
        const image = await loadGameImage(source)
        const texture = pointSources.has(source)
          ? nativeStockPointTextureFromImage(image)
          : compositedSources.has(source)
            ? nativeCompositedTextureFromImage(image)
            : nativeStockTextureFromImage(image)
        const entry = [source, texture] as const
        entries.push(entry)
        return entry
      } finally {
        releaseGameImages([source])
      }
    })
  } catch (error) {
    for (const [, texture] of entries) texture.destroy(true)
    releaseGameImages(sources)
    throw error
  }
  return entries
}

export function textureFrom(
  textures: Readonly<Record<string, Texture>>,
  source: string,
): Texture {
  const texture = textures[source]
  if (!texture) throw new Error(`Game texture was not loaded: ${source}`)
  return texture
}
