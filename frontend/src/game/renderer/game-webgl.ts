// Installs Pixi's static CSP-safe shader paths; no runtime eval is required.
import 'pixi.js/unsafe-eval'
import { Application, Texture } from 'pixi.js'

import {
  loadGameImage,
  releaseGameImages,
} from '../game-assets.ts'
import { mapAssetSources } from '../game-asset-readiness.ts'

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
): Promise<GameTextureMap> {
  const sources = [...new Set(requestedSources)]
  const entries = await loadGameTextureEntries(sources)
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
  createTexture: (source: string, image: HTMLImageElement) => Texture = (
    _source,
    image,
  ) => Texture.from(image, true),
): Promise<Array<readonly [string, Texture]>> {
  const sources = [...new Set(requestedSources)]
  const entries: Array<readonly [string, Texture]> = []
  try {
    await mapAssetSources(sources, async (source) => {
      try {
        const texture = createTexture(source, await loadGameImage(source))
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
