// Installs Pixi's static CSP-safe sync paths; this module removes the need for eval.
import 'pixi.js/unsafe-eval'
import { Application } from 'pixi.js'
import type { HubPresentationFrame } from '../client/hub-presentation-timeline.ts'
import {
  HUB_CAMERA_SCALE,
  hubCameraOrigin,
} from '../core-kernels/hub-math.ts'
import {
  HUB_RENDER_HEIGHT,
  HUB_RENDER_WIDTH,
  hubDisplayScale,
  initialHubResolution,
} from './hub-render-contract.ts'
import {
  destroyHubWorldTextureFrames,
  loadHubWorldTextures,
} from './hub-textures.ts'
import { HubWorldScene } from './hub-world-scene.ts'

export interface HubRendererDiagnostics {
  averageFrameMs: number
  frameCount: number
  renderer: string
  resolution: number
  studentCount: number
  tick: number
}

interface HubFrameDiagnostics {
  frameCount: number
  orbSpriteCount: number
  playerMoving: boolean
  playerWalkPose: number
  playerX: number
  playerY: number
  studentCount: number
  teacherFrame: number
  tick: number
}

export interface HubWorldRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  render(snapshot: HubPresentationFrame): void
  resize(displayScale: number, devicePixelRatio?: number): void
}

interface HubWorldRendererOptions {
  devicePixelRatio?: number
  host: HTMLElement
  initialSnapshot: HubPresentationFrame
  now?: () => number
  onDiagnostics?: (diagnostics: HubRendererDiagnostics) => void
  playerId: string
}

const DIAGNOSTIC_WINDOW_FRAMES = 120

export async function createHubWorldRenderer(
  options: HubWorldRendererOptions,
): Promise<HubWorldRenderer> {
  const textures = await loadHubWorldTextures()
  const application = new Application()
  const devicePixelRatio = options.devicePixelRatio ?? window.devicePixelRatio
  const displayBounds = options.host.getBoundingClientRect()
  const initialResolution = initialHubResolution({
    devicePixelRatio,
    displayScale: hubDisplayScale(displayBounds.width, displayBounds.height),
  })
  try {
    await application.init({
      antialias: false,
      autoDensity: true,
      autoStart: false,
      background: 0x000000,
      height: HUB_RENDER_HEIGHT,
      powerPreference: 'high-performance',
      preference: 'webgl',
      preferWebGLVersion: 2,
      resolution: initialResolution,
      roundPixels: false,
      width: HUB_RENDER_WIDTH,
    })
    if (!application.renderer.name.toLowerCase().includes('webgl')) {
      throw new Error('WebGL is unavailable; the CPU canvas fallback is not supported.')
    }
  } catch (error) {
    if (application.renderer) application.destroy({ removeView: true })
    destroyHubWorldTextureFrames(textures)
    throw error
  }
  application.stop()
  const scene = new HubWorldScene(textures)
  scene.world.scale.set(HUB_CAMERA_SCALE)
  application.stage.addChild(scene.world)
  const canvas = application.canvas as HTMLCanvasElement
  canvas.className = 'hub-world-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.gameRenderer = 'pixi-webgl'
  canvas.dataset.textureSources = JSON.stringify(textures.assetSources)
  canvas.style.width = `${HUB_RENDER_WIDTH}px`
  canvas.style.height = `${HUB_RENDER_HEIGHT}px`

  const now = options.now ?? (() => performance.now())
  let destroyed = false
  let previousFrameAt = now()
  let frameCount = 0
  let frameTimeTotal = 0
  let resolution = initialResolution
  const frameDiagnostics: HubFrameDiagnostics = {
    frameCount: 0,
    orbSpriteCount: 0,
    playerMoving: false,
    playerWalkPose: 0,
    playerX: Number.NaN,
    playerY: Number.NaN,
    studentCount: 0,
    teacherFrame: 0,
    tick: options.initialSnapshot.tick,
  }
  Object.defineProperty(canvas, '__sdrHubFrame', {
    configurable: false,
    enumerable: false,
    value: frameDiagnostics,
    writable: false,
  })

  const publishDiagnostics = (snapshot: HubPresentationFrame, averageFrameMs: number) => {
    canvas.dataset.resolution = `${resolution}`
    canvas.dataset.rendererName = application.renderer.name
    options.onDiagnostics?.({
      averageFrameMs,
      frameCount,
      renderer: application.renderer.name,
      resolution,
      studentCount: scene.studentCount,
      tick: snapshot.tick,
    })
  }

  const updateFrameDiagnostics = (snapshot: HubPresentationFrame) => {
    const player = snapshot.players[options.playerId]
    frameDiagnostics.frameCount = frameCount
    frameDiagnostics.studentCount = scene.studentCount
    frameDiagnostics.teacherFrame = scene.teacherFrame
    frameDiagnostics.tick = snapshot.tick
    if (!player) return
    frameDiagnostics.playerX = player.position.x
    frameDiagnostics.playerY = player.position.y
    frameDiagnostics.playerMoving = Math.hypot(player.velocity.x, player.velocity.y) > 0.01
    const playerView = scene.player(options.playerId)
    if (!playerView) return
    frameDiagnostics.playerWalkPose = playerView.walkPose
    frameDiagnostics.orbSpriteCount = playerView.orbSpriteCount
  }

  const renderer: HubWorldRenderer = {
    canvas,
    render(snapshot) {
      if (destroyed) return
      const player = snapshot.players[options.playerId]
      if (!player) return
      const frameAt = now()
      frameTimeTotal += Math.max(0, frameAt - previousFrameAt)
      previousFrameAt = frameAt
      frameCount += 1
      scene.update(snapshot)
      const camera = hubCameraOrigin(player.position)
      scene.world.position.set(
        -camera.x * HUB_CAMERA_SCALE,
        -camera.y * HUB_CAMERA_SCALE,
      )
      application.render()
      updateFrameDiagnostics(snapshot)
      if (frameCount % DIAGNOSTIC_WINDOW_FRAMES !== 0) return
      const averageFrameMs = frameTimeTotal / DIAGNOSTIC_WINDOW_FRAMES
      frameTimeTotal = 0
      publishDiagnostics(snapshot, averageFrameMs)
    },
    resize(displayScale, nextDevicePixelRatio = window.devicePixelRatio) {
      if (destroyed) return
      const nextResolution = initialHubResolution({
        devicePixelRatio: nextDevicePixelRatio,
        displayScale,
      })
      if (nextResolution === resolution) return
      resolution = nextResolution
      application.renderer.resize(HUB_RENDER_WIDTH, HUB_RENDER_HEIGHT, resolution)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      application.stage.removeChild(scene.world)
      scene.destroy()
      destroyHubWorldTextureFrames(textures)
      application.destroy({ removeView: true })
      canvas.remove()
    },
  }

  scene.update(options.initialSnapshot)
  renderer.render(options.initialSnapshot)
  publishDiagnostics(options.initialSnapshot, 0)
  return renderer
}
