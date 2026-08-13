import { Container, Graphics, Sprite, type Texture } from 'pixi.js'

import { loader } from '../../lib/assets.ts'
import { collectAssetSources } from '../game-asset-readiness.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
} from './game-webgl.ts'
import { initialHubResolution } from './hub-render-contract.ts'
import {
  LOADER_BACKGROUND,
  LOADER_FILL_CENTER,
  LOADER_FILL_CLIP,
  LOADER_FILL_SIZE,
  LOADER_FRAME_CENTER,
  LOADER_FRAME_SIZE,
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
  resize(displayScale: number, devicePixelRatio?: number): void
}

interface LoaderRendererOptions {
  devicePixelRatio?: number
  displayScale: number
}

const LOADER_ASSET_SOURCES = collectAssetSources(loader)

export async function createLoaderRenderer(
  options: LoaderRendererOptions,
): Promise<LoaderRenderer> {
  const textures = await loadGameTextureMap(LOADER_ASSET_SOURCES)
  const resolution = initialHubResolution({
    devicePixelRatio: options.devicePixelRatio ?? window.devicePixelRatio,
    displayScale: options.displayScale,
  })
  let gpu
  try {
    gpu = await createGameWebGlApplication({
      className: 'native-loader-canvas',
      height: LOADER_RENDER_HEIGHT,
      resolution,
      width: LOADER_RENDER_WIDTH,
    })
  } catch (error) {
    textures.destroy()
    throw error
  }

  const { application, canvas } = gpu
  const texture = (source: string) => textureFrom(textures.textures, source)
  const root = new Container({ label: 'native-loader' })
  root.eventMode = 'none'
  application.stage.addChild(root)

  root.addChild(new Graphics()
    .rect(0, 0, LOADER_RENDER_WIDTH, LOADER_RENDER_HEIGHT)
    .fill(LOADER_BACKGROUND))
  root.addChild(stageSprite(texture(loader.logo), LOADER_LOGO_BOUNDS))
  root.addChild(stageSprite(texture(loader.url), LOADER_URL_BOUNDS))

  const frame = centeredSprite(texture(loader.frame), LOADER_FRAME_CENTER, LOADER_FRAME_SIZE)
  frame.rotation = Math.PI / 2
  root.addChild(frame)
  const fill = centeredSprite(texture(loader.fill), LOADER_FILL_CENTER, LOADER_FILL_SIZE)
  fill.rotation = Math.PI / 2
  const fillMask = new Graphics()
  fill.mask = fillMask
  root.addChild(fill, fillMask)

  let currentResolution = resolution
  let destroyed = false
  const diagnostics = { frameCount: 0, progress: 0 }
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
    resize(displayScale, nextDevicePixelRatio = window.devicePixelRatio) {
      if (destroyed) return
      const nextResolution = initialHubResolution({
        devicePixelRatio: nextDevicePixelRatio,
        displayScale,
      })
      if (nextResolution === currentResolution) return
      currentResolution = nextResolution
      application.renderer.resize(LOADER_RENDER_WIDTH, LOADER_RENDER_HEIGHT, currentResolution)
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
  renderer.render(0)
  return renderer
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

function centeredSprite(
  texture: Texture,
  center: { x: number; y: number },
  size: { height: number; width: number },
): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.eventMode = 'none'
  sprite.position.set(center.x, center.y)
  sprite.width = size.width
  sprite.height = size.height
  return sprite
}
