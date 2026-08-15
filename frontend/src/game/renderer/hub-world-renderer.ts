// Installs Pixi's static CSP-safe sync paths; this module removes the need for eval.
import 'pixi.js/unsafe-eval'
import { Application, Sprite, Texture } from 'pixi.js'
import type { HubPresentationFrame } from '../client/hub-presentation-timeline.ts'
import {
  HUB_CAMERA_SCALE,
  hubRegionCameraOrigin,
} from '../core-kernels/hub-math.ts'
import type { HubRegionId } from '../core-kernels/hub-regions.ts'
import { hubSouthernCameraTranslation } from '../hub-camera-presentation.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import { initialHubResolution } from './hub-render-contract.ts'
import {
  destroyHubWorldTextureFrames,
  hubDeferredAnimationTextures,
  loadHubWorldTextures,
} from './hub-textures.ts'
import { HubPrivateRoomScene } from './hub-private-room-scene.ts'
import { HubWorldScene } from './hub-world-scene.ts'

export interface HubRendererDiagnostics {
  averageFrameMs: number
  frameCount: number
  region: HubRegionId
  renderer: string
  resolution: number
  studentCount: number
  tick: number
}

interface HubFrameDiagnostics {
  astronomerRenderable: boolean
  astronomerTelescopeFrame: number
  cameraRenderGroupCount: number
  frameCount: number
  fadeAlpha: number
  hostPlayerId: string | null
  localPlayerId: string
  orbSpriteCount: number
  playerCount: number
  playerAttachmentPose: number
  playerHeadingIndex: number
  playerMoving: boolean
  playerPositions: Record<string, { x: number; y: number }>
  playerWalkPose: number
  playerX: number
  playerY: number
  primarySpellCount: number
  primarySpellKinds: readonly string[]
  pooledStudentViewCount: number
  southernArchitectureCount: number
  southernArtRenderable: boolean
  southernChildCount: number
  studentCount: number
  studentOutsideViewCount: number
  studentViewCreationCount: number
  studentViewReuseCount: number
  studentVisibleCandidateCount: number
  teacherFrame: number
  tick: number
  transitionPhase: 'incoming' | 'outgoing' | null
}

export interface HubWorldRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  render(snapshot: HubPresentationFrame): void
  resize(viewport: GameViewportLayout, devicePixelRatio?: number): void
}

interface HubWorldRendererOptions {
  devicePixelRatio?: number
  initialSnapshot: HubPresentationFrame
  now?: () => number
  onDiagnostics?: (diagnostics: HubRendererDiagnostics) => void
  playerId: string
  viewport: GameViewportLayout
}

const DIAGNOSTIC_WINDOW_FRAMES = 120

export async function createHubWorldRenderer(
  options: HubWorldRendererOptions,
): Promise<HubWorldRenderer> {
  const textures = await loadHubWorldTextures()
  const application = new Application()
  const devicePixelRatio = options.devicePixelRatio ?? window.devicePixelRatio
  let viewport = options.viewport
  const initialResolution = initialHubResolution({
    devicePixelRatio,
    displayScale: viewport.displayScale,
  })
  try {
    await application.init({
      antialias: false,
      autoDensity: true,
      autoStart: false,
      background: 0x000000,
      height: viewport.height,
      powerPreference: 'high-performance',
      preference: 'webgl',
      preferWebGLVersion: 2,
      resolution: initialResolution,
      roundPixels: false,
      width: viewport.width,
    })
    if (!application.renderer.name.toLowerCase().includes('webgl')) {
      throw new Error('WebGL is unavailable; the CPU canvas fallback is not supported.')
    }
    for (const texture of hubDeferredAnimationTextures(textures)) {
      application.renderer.texture.initSource(texture.source)
    }
  } catch (error) {
    if (application.renderer) application.destroy({ removeView: true })
    destroyHubWorldTextureFrames(textures)
    throw error
  }
  application.stop()
  const courtyardScene = new HubWorldScene(textures, options.initialSnapshot.tick)
  const privateRoomScene = new HubPrivateRoomScene(textures)
  courtyardScene.stage.scale.set(HUB_CAMERA_SCALE)
  privateRoomScene.world.scale.set(HUB_CAMERA_SCALE)
  application.stage.addChild(courtyardScene.stage, privateRoomScene.world)
  const fadeCover = new Sprite(Texture.WHITE)
  fadeCover.tint = 0x000000
  fadeCover.width = viewport.width
  fadeCover.height = viewport.height
  fadeCover.alpha = 0
  fadeCover.eventMode = 'none'
  application.stage.addChild(fadeCover)
  const canvas = application.canvas as HTMLCanvasElement
  canvas.className = 'hub-world-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.gameRenderer = 'pixi-webgl'
  canvas.dataset.staticCulling = 'none'
  canvas.dataset.studentCulling = 'instrumentation-only'
  canvas.dataset.textureSources = JSON.stringify(textures.assetSources)
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  canvas.dataset.viewportHeight = `${viewport.height}`
  canvas.dataset.viewportWidth = `${viewport.width}`

  const now = options.now ?? (() => performance.now())
  let destroyed = false
  let previousFrameAt = now()
  let frameCount = 0
  let frameTimeTotal = 0
  let resolution = initialResolution
  const frameDiagnostics: HubFrameDiagnostics = {
    astronomerRenderable: true,
    astronomerTelescopeFrame: 0,
    cameraRenderGroupCount: courtyardScene.cameraRenderGroupCount
      + Number(privateRoomScene.world.isRenderGroup),
    frameCount: 0,
    fadeAlpha: 0,
    hostPlayerId: options.initialSnapshot.hostPlayerId,
    localPlayerId: options.playerId,
    orbSpriteCount: 0,
    playerCount: Object.keys(options.initialSnapshot.players).length,
    playerAttachmentPose: 0,
    playerHeadingIndex: 0,
    playerMoving: false,
    playerPositions: {},
    playerWalkPose: 0,
    playerX: Number.NaN,
    playerY: Number.NaN,
    primarySpellCount: 0,
    primarySpellKinds: [],
    pooledStudentViewCount: 0,
    southernArchitectureCount: courtyardScene.southernArchitectureCount,
    southernArtRenderable: true,
    southernChildCount: courtyardScene.southernChildCount,
    studentCount: 0,
    studentOutsideViewCount: 0,
    studentViewCreationCount: 0,
    studentViewReuseCount: 0,
    studentVisibleCandidateCount: 0,
    teacherFrame: 0,
    tick: options.initialSnapshot.tick,
    transitionPhase: null,
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
      region: snapshot.world.participants[options.playerId]?.region ?? 'courtyard',
      renderer: application.renderer.name,
      resolution,
      studentCount: courtyardScene.studentCount,
      tick: snapshot.tick,
    })
  }

  const updateFrameDiagnostics = (snapshot: HubPresentationFrame) => {
    const player = snapshot.players[options.playerId]
    const participant = snapshot.world.participants[options.playerId]
    frameDiagnostics.astronomerRenderable = courtyardScene.astronomerRenderable
    frameDiagnostics.astronomerTelescopeFrame = courtyardScene.astronomerTelescopeFrame
    frameDiagnostics.frameCount = frameCount
    frameDiagnostics.fadeAlpha = participant?.transition?.alpha ?? 0
    frameDiagnostics.hostPlayerId = snapshot.hostPlayerId
    frameDiagnostics.playerCount = Object.keys(snapshot.players).length
    const currentScene = participant?.region === 'courtyard'
      ? courtyardScene
      : privateRoomScene
    frameDiagnostics.primarySpellCount = currentScene.primarySpellCount
    frameDiagnostics.primarySpellKinds = currentScene.primarySpellKinds
    frameDiagnostics.pooledStudentViewCount = courtyardScene.pooledStudentViewCount
    frameDiagnostics.southernArchitectureCount = courtyardScene.southernArchitectureCount
    frameDiagnostics.southernArtRenderable = courtyardScene.southernArtRenderable
    frameDiagnostics.southernChildCount = courtyardScene.southernChildCount
    frameDiagnostics.studentCount = courtyardScene.studentCount
    frameDiagnostics.studentViewCreationCount = courtyardScene.studentViewCreationCount
    frameDiagnostics.studentViewReuseCount = courtyardScene.studentViewReuseCount
    frameDiagnostics.teacherFrame = courtyardScene.teacherFrame
    frameDiagnostics.tick = snapshot.tick
    frameDiagnostics.transitionPhase = participant?.transition?.phase ?? null
    for (const playerId of Object.keys(frameDiagnostics.playerPositions)) {
      if (!snapshot.players[playerId]) delete frameDiagnostics.playerPositions[playerId]
    }
    for (const [playerId, state] of Object.entries(snapshot.players)) {
      const position = frameDiagnostics.playerPositions[playerId] ??= { x: 0, y: 0 }
      position.x = state.position.x
      position.y = state.position.y
    }
    if (!player) return
    frameDiagnostics.playerX = player.position.x
    frameDiagnostics.playerY = player.position.y
    frameDiagnostics.playerHeadingIndex = player.headingIndex
    frameDiagnostics.playerMoving = Math.hypot(player.velocity.x, player.velocity.y) > 0.01
    const playerView = participant?.region === 'courtyard'
      ? courtyardScene.player(options.playerId)
      : privateRoomScene.player(options.playerId)
    if (!playerView) return
    frameDiagnostics.playerAttachmentPose = playerView.attachmentPose
    frameDiagnostics.playerWalkPose = playerView.walkPose
    frameDiagnostics.orbSpriteCount = playerView.orbSpriteCount
  }

  const renderer: HubWorldRenderer = {
    canvas,
    render(snapshot) {
      if (destroyed) return
      const player = snapshot.players[options.playerId]
      const participant = snapshot.world.participants[options.playerId]
      if (!player || !participant) return
      const frameAt = now()
      frameTimeTotal += Math.max(0, frameAt - previousFrameAt)
      previousFrameAt = frameAt
      frameCount += 1
      courtyardScene.update(snapshot, frameCount)
      privateRoomScene.update(snapshot, options.playerId, frameCount)
      const inCourtyard = participant.region === 'courtyard'
      courtyardScene.stage.visible = inCourtyard
      privateRoomScene.world.visible = !inCourtyard
      const camera = hubRegionCameraOrigin(participant.region, player.position, viewport)
      if (inCourtyard) {
        courtyardScene.world.position.set(-camera.x, -camera.y)
        const southernTranslation = hubSouthernCameraTranslation(camera, {
          height: viewport.height / HUB_CAMERA_SCALE,
          width: viewport.width / HUB_CAMERA_SCALE,
        })
        courtyardScene.southern.position.copyFrom(southernTranslation)
        if (frameCount === 1 || frameCount % DIAGNOSTIC_WINDOW_FRAMES === 0) {
          const view = {
            height: viewport.height / HUB_CAMERA_SCALE,
            width: viewport.width / HUB_CAMERA_SCALE,
          }
          const visible = courtyardScene.countVisibleStudents(snapshot, camera, view)
          frameDiagnostics.studentVisibleCandidateCount = visible
          frameDiagnostics.studentOutsideViewCount = snapshot.world.students.length - visible
        }
      } else {
        privateRoomScene.world.position.set(
          -camera.x * HUB_CAMERA_SCALE,
          -camera.y * HUB_CAMERA_SCALE,
        )
        frameDiagnostics.studentVisibleCandidateCount = 0
        frameDiagnostics.studentOutsideViewCount = snapshot.world.students.length
      }
      fadeCover.alpha = participant.transition?.alpha ?? 0
      canvas.dataset.hubRegion = participant.region
      canvas.dataset.transitionAlpha = `${fadeCover.alpha}`
      canvas.dataset.transitionPhase = participant.transition?.phase ?? 'none'
      application.render()
      updateFrameDiagnostics(snapshot)
      if (frameCount % DIAGNOSTIC_WINDOW_FRAMES !== 0) return
      const averageFrameMs = frameTimeTotal / DIAGNOSTIC_WINDOW_FRAMES
      frameTimeTotal = 0
      publishDiagnostics(snapshot, averageFrameMs)
    },
    resize(nextViewport, nextDevicePixelRatio = window.devicePixelRatio) {
      if (destroyed) return
      const nextResolution = initialHubResolution({
        devicePixelRatio: nextDevicePixelRatio,
        displayScale: nextViewport.displayScale,
      })
      if (
        nextResolution === resolution
        && nextViewport.height === viewport.height
        && nextViewport.width === viewport.width
      ) return
      viewport = nextViewport
      resolution = nextResolution
      application.renderer.resize(viewport.width, viewport.height, resolution)
      fadeCover.width = viewport.width
      fadeCover.height = viewport.height
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      canvas.dataset.viewportHeight = `${viewport.height}`
      canvas.dataset.viewportWidth = `${viewport.width}`
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      application.stage.removeChild(courtyardScene.stage, privateRoomScene.world, fadeCover)
      courtyardScene.destroy()
      privateRoomScene.destroy()
      fadeCover.destroy()
      destroyHubWorldTextureFrames(textures)
      application.destroy({ removeView: true })
      canvas.remove()
    },
  }

  courtyardScene.update(options.initialSnapshot, frameCount)
  privateRoomScene.update(options.initialSnapshot, options.playerId, frameCount)
  renderer.render(options.initialSnapshot)
  publishDiagnostics(options.initialSnapshot, 0)
  return renderer
}
