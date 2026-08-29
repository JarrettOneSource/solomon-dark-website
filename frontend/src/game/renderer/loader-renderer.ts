import { Container, Graphics, Sprite, type Application, type Texture } from 'pixi.js'

import { loader } from '../../lib/assets.ts'
import { LOADER_COMPOSITED_ASSET_SOURCES } from '../game-assets.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
} from './game-webgl.ts'
import {
  fixedGamePresentationResolution,
  gameViewportAnchoredBounds,
  type FixedGameViewportLayout,
} from './game-viewport.ts'
import {
  LOADER_BACKGROUND,
  LOADER_FILL_BOUNDS,
  LOADER_FILL_CLIP,
  LOADER_FRAME_BOUNDS,
  LOADER_LOGO_BOUNDS,
  LOADER_RENDER_HEIGHT,
  LOADER_RENDER_WIDTH,
  LOADER_URL_BOUNDS,
  loaderFillWidth,
} from './loader-render-contract.ts'

export interface LoaderRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  render(progress: number): void
  resize(viewport: FixedGameViewportLayout, devicePixelRatio?: number): void
}

interface LoaderRendererOptions {
  devicePixelRatio?: number
  viewport: FixedGameViewportLayout
}

export async function createLoaderRenderer(
  options: LoaderRendererOptions,
): Promise<LoaderRenderer> {
  const textures = await loadGameTextureMap({
    composited: LOADER_COMPOSITED_ASSET_SOURCES,
  })
  const resolution = fixedGamePresentationResolution(
    options.devicePixelRatio ?? window.devicePixelRatio,
    options.viewport.displayScale,
  )
  let gpu
  try {
    gpu = await createGameWebGlApplication({
      className: 'native-loader-canvas',
      height: options.viewport.height,
      resolution,
      width: options.viewport.width,
    })
  } catch (error) {
    textures.destroy()
    throw error
  }

  const { application, canvas } = gpu
  const texture = (source: string) => textureFrom(textures.textures, source)
  canvas.dataset.compositedTextureAddress = texture(loader.logo).source.addressMode
  canvas.dataset.compositedTextureAlpha = texture(loader.logo).source.alphaMode
  const root = new Container({ label: 'native-loader' })
  root.eventMode = 'none'
  root.sortableChildren = true
  application.stage.addChild(root)

  const background = new Graphics()
  background.zIndex = 0
  const content = new Container({ label: 'native-loader-content' })
  content.eventMode = 'none'
  content.zIndex = 1
  root.addChild(background, content)

  content.addChild(stageSprite(texture(loader.logo), LOADER_LOGO_BOUNDS))
  content.addChild(stageSprite(texture(loader.url), LOADER_URL_BOUNDS))
  content.addChild(stageSprite(texture(loader.frame), LOADER_FRAME_BOUNDS))
  const fill = stageSprite(texture(loader.fill), LOADER_FILL_BOUNDS)
  const fillMask = new Graphics()
  fill.mask = fillMask
  content.addChild(fill, fillMask)

  let currentResolution = resolution
  let currentViewport = options.viewport
  let destroyed = false
  const diagnostics = {
    contentX: 0,
    contentY: 0,
    frameCount: 0,
    progress: 0,
    viewportHeight: options.viewport.height,
    viewportWidth: options.viewport.width,
  }
  Object.defineProperty(canvas, '__sdrLoaderFrame', {
    configurable: false,
    enumerable: false,
    value: diagnostics,
    writable: false,
  })

  const renderer: LoaderRenderer = {
    canvas,
    render(progress) {
      if (destroyed) return
      const width = loaderFillWidth(progress)
      fillMask.clear().rect(
        LOADER_FILL_CLIP.x,
        LOADER_FILL_CLIP.y,
        width,
        LOADER_FILL_CLIP.height,
      ).fill(0xffffff)
      application.render()
      diagnostics.frameCount += 1
      diagnostics.progress = width / LOADER_FILL_CLIP.width
      canvas.dataset.progress = `${diagnostics.progress}`
    },
    resize(viewport, nextDevicePixelRatio = window.devicePixelRatio) {
      if (destroyed) return
      const nextResolution = fixedGamePresentationResolution(
        nextDevicePixelRatio,
        viewport.displayScale,
      )
      if (nextResolution === currentResolution
        && viewport.width === currentViewport.width
        && viewport.height === currentViewport.height) return
      currentResolution = nextResolution
      currentViewport = viewport
      applyLoaderViewport(
        application,
        background,
        content,
        viewport,
        currentResolution,
        diagnostics,
      )
      canvas.dataset.resolution = `${currentResolution}`
      application.render()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      application.stage.removeChild(root)
      root.destroy({ children: true })
      textures.destroy()
      application.destroy({ removeView: true })
      canvas.remove()
    },
  }
  applyLoaderViewport(
    application,
    background,
    content,
    options.viewport,
    resolution,
    diagnostics,
  )
  renderer.render(0)
  return renderer
}

function applyLoaderViewport(
  application: Application,
  background: Graphics,
  content: Container,
  viewport: FixedGameViewportLayout,
  resolution: number,
  diagnostics: {
    contentX: number
    contentY: number
    viewportHeight: number
    viewportWidth: number
  },
): void {
  application.renderer.resize(viewport.width, viewport.height, resolution)
  background.clear().rect(0, 0, viewport.width, viewport.height).fill(LOADER_BACKGROUND)
  const bounds = gameViewportAnchoredBounds(
    viewport,
    LOADER_RENDER_WIDTH,
    LOADER_RENDER_HEIGHT,
    'center',
    'center',
  )
  content.position.set(bounds.x, bounds.y)
  diagnostics.contentX = bounds.x
  diagnostics.contentY = bounds.y
  diagnostics.viewportHeight = viewport.height
  diagnostics.viewportWidth = viewport.width
  const canvas = application.canvas as HTMLCanvasElement
  canvas.dataset.viewportHeight = `${viewport.height}`
  canvas.dataset.viewportWidth = `${viewport.width}`
}

function stageSprite(
  texture: Texture,
  bounds: { height: number; width: number; x: number; y: number },
): Sprite {
  const sprite = new Sprite(texture)
  sprite.eventMode = 'none'
  sprite.position.set(bounds.x, bounds.y)
  sprite.width = bounds.width
  sprite.height = bounds.height
  return sprite
}
