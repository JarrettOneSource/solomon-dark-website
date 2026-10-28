import type { NativeUiCanvas } from './native-ui-canvas.ts'
import { Container, Graphics, Sprite, type Application, type Texture } from 'pixi.js'

import { loader } from '../../lib/assets.ts'
import { LOADER_COMPOSITED_ASSET_SOURCES } from '../game-assets.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
} from './game-webgl.ts'
import {
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

export interface LoaderRenderer extends NativeUiCanvas {
  render(progress: number): void
  resize(viewport: FixedGameViewportLayout): void
}

interface LoaderRendererOptions {
  viewport: FixedGameViewportLayout
}

export async function createLoaderRenderer(
  options: LoaderRendererOptions,
): Promise<LoaderRenderer> {
  const textures = await loadGameTextureMap({
    composited: LOADER_COMPOSITED_ASSET_SOURCES,
  })
  let gpu
  try {
    gpu = await createGameWebGlApplication({
      className: 'native-loader-canvas',
      height: options.viewport.height,
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
    mount: gpu.mount,
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
    resize(viewport) {
      if (destroyed) return
      if (viewport.width === currentViewport.width
        && viewport.height === currentViewport.height) return
      currentViewport = viewport
      applyLoaderViewport(
        application,
        background,
        content,
        viewport,
        diagnostics,
      )
      application.render()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      application.stage.removeChild(root)
      root.destroy({ children: true })
      textures.destroy()
      gpu.destroy()
    },
  }
  applyLoaderViewport(
    application,
    background,
    content,
    options.viewport,
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
  diagnostics: {
    contentX: number
    contentY: number
    viewportHeight: number
    viewportWidth: number
  },
): void {
  application.renderer.resize(viewport.width, viewport.height)
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
