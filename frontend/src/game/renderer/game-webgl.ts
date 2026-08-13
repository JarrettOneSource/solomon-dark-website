// Installs Pixi's static CSP-safe shader paths; no runtime eval is required.
import 'pixi.js/unsafe-eval'
import { Application, Texture } from 'pixi.js'

import { loadGameImage } from '../game-assets.ts'

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
  className: string
  height: number
  resolution: number
  width: number
}

export async function createGameWebGlApplication({
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
  const images = await Promise.all(sources.map(async (source) => [
    source,
    await loadGameImage(source),
  ] as const))
  const entries: Array<readonly [string, Texture]> = []
  try {
    for (const [source, image] of images) {
      entries.push([source, Texture.from(image, true)])
    }
  } catch (error) {
    for (const [, texture] of entries) texture.destroy(true)
    throw error
  }
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

export function textureFrom(
  textures: Readonly<Record<string, Texture>>,
  source: string,
): Texture {
  const texture = textures[source]
  if (!texture) throw new Error(`Game texture was not loaded: ${source}`)
  return texture
}
