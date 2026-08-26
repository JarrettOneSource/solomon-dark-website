// Installs Pixi's static CSP-safe sync paths; this module removes the need for eval.
import 'pixi.js/unsafe-eval'
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { HubPresentationFrame } from '../client/hub-presentation-timeline.ts'
import {
  DEFAULT_GAME_SETTINGS,
  cameraZoomForFov,
  type GameSettings,
} from '../game-settings.ts'
import {
  HUB_CAMERA_SCALE,
  hubRegionCameraOrigin,
} from '../core-kernels/hub-math.ts'
import type {
  HubRegionId,
  HubTransitionPhase,
} from '../core-kernels/hub-regions.ts'
import type { GameWorldSpeech } from '../world-speech-presentation.ts'
import { deriveHubPlayerActivityItems } from '../hub-player-activity.ts'
import { hubSouthernCameraTranslation } from '../hub-camera-presentation.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import {
  HUB_DIAGNOSTIC_WINDOW_FRAMES,
  hubStudentVisibilityDiagnosticsDue,
  initialHubResolution,
} from './hub-render-contract.ts'
import type { NativeSecondaryDiagnosticSample } from './native-secondary-world-view.ts'
import {
  destroyHubWorldTextureFrames,
  hubDeferredAnimationTextures,
  loadHubWorldTextures,
} from './hub-textures.ts'
import { HubPrivateRoomScene } from './hub-private-room-scene.ts'
import { HubWorldScene } from './hub-world-scene.ts'
import {
  NATIVE_LEVEL_UP_PRESENTATION_DURATION_MS,
  skillPickerWorldPresentationFrame,
} from './level-up-presentation.ts'
import {
  NativeSecondaryScreenFeedbackPresentation,
  nativeRegionPointGain,
} from './native-secondary-presentation.ts'
import {
  NativeWorldNameplateLayer,
  projectNativeWorldPoint,
} from './native-world-nameplate.ts'
import { NativeWorldSpeechLayer } from './native-world-speech.ts'
import { HubPlayerActivityLayer } from './hub-player-activity-layer.ts'
import {
  hubNpcDirectionalHintFrame,
  hubNpcOnboardingPlan,
  type HubNpcMarkerSurface,
} from './hub-npc-marker-presentation.ts'
import { NATIVE_HUB_NPC_CATALOG } from '../core-kernels/native-hub-npc.ts'
import { hub } from '../../lib/assets.ts'
import type { GameModAsset } from '../protocol/game-protocol.ts'
import { loadModPresentationTextures } from './mod-presentation-assets.ts'

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
  collegePathCursor: number | null
  frameCount: number
  fadeAlpha: number
  hostPlayerId: string | null
  localPlayerId: string
  levelUpParticleCount: number
  orbSpriteCount: number
  playerCount: number
  playerAttachmentPose: number
  playerElementEffectPrimaryId: number | null
  playerElementEffectPrimaryIds: Record<string, number | null>
  playerElementEffectScale: number
  playerHeadingIndex: number
  playerMagicShieldScale: number
  playerMagicShieldVisible: boolean
  playerMaterialTint: number
  playerMoving: boolean
  playerPositions: Record<string, { x: number; y: number }>
  playerScreenPositions: Record<string, { x: number; y: number }>
  playerWalkPose: number
  playerWeaponScale: number
  playerX: number
  playerY: number
  primarySpellCount: number
  primarySpellKinds: readonly string[]
  secondaryAbilityCount: number
  secondaryAbilityKinds: readonly string[]
  secondaryAbilityPrimitiveCount: number
  secondaryAbilitySamples: readonly NativeSecondaryDiagnosticSample[]
  secondaryScreenFlashAlpha: number
  secondaryScreenFlashColor: number
  skorcha: {
    dismissalIndex: number
    gesture: number
    hatFrame: number
    variant: number
    x: number
    y: number
  } | null
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
  transitionPhase: HubTransitionPhase | null
}

export interface HubWorldRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  render(snapshot: HubPresentationFrame): void
  resize(viewport: GameViewportLayout, devicePixelRatio?: number): void
  setLevelUpPresentation(presentationId: number | null): void
  setSettings(settings: HubWorldPresentationSettings): void
  setUiSurface(surface: HubNpcMarkerSurface): void
  setWorldSpeeches(speeches: readonly GameWorldSpeech[]): void
}

export type HubWorldPresentationSettings = Pick<
  GameSettings,
  'cameraFovPercent' | 'zoomEffects'
>

interface HubWorldRendererOptions {
  devicePixelRatio?: number
  initialSnapshot: HubPresentationFrame
  modAssets?: readonly GameModAsset[]
  now?: () => number
  onDiagnostics?: (diagnostics: HubRendererDiagnostics) => void
  playerId: string
  settings?: HubWorldPresentationSettings
  viewport: GameViewportLayout
}

export async function createHubWorldRenderer(
  options: HubWorldRendererOptions,
): Promise<HubWorldRenderer> {
  const [textures, modTextures] = await Promise.all([
    loadHubWorldTextures(),
    loadModPresentationTextures(options.modAssets ?? []),
  ])
  const application = new Application()
  const devicePixelRatio = options.devicePixelRatio ?? window.devicePixelRatio
  let viewport = options.viewport
  let baseCameraScale = cameraZoomForFov(
    HUB_CAMERA_SCALE,
    options.settings?.cameraFovPercent ?? DEFAULT_GAME_SETTINGS.cameraFovPercent,
  )
  let zoomEffects = options.settings?.zoomEffects ?? DEFAULT_GAME_SETTINGS.zoomEffects
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
    modTextures.destroy()
    throw error
  }
  application.stop()
  const traderAnimationSeed = options.initialSnapshot.world.traderAnimationSeed
  const courtyardScene = new HubWorldScene(
    textures,
    options.initialSnapshot.tick,
    traderAnimationSeed,
    application.renderer,
    modTextures,
  )
  const privateRoomScene = new HubPrivateRoomScene(
    textures,
    traderAnimationSeed,
    application.renderer,
    modTextures,
  )
  courtyardScene.stage.scale.set(baseCameraScale)
  privateRoomScene.world.scale.set(baseCameraScale)
  const worldNameplates = new NativeWorldNameplateLayer(textures.fontAtlas)
  const playerActivities = new HubPlayerActivityLayer()
  const worldSpeech = new NativeWorldSpeechLayer(textures.fontAtlas)
  const npcDirectionalHintLayer = new Container({ label: 'native-npc-directional-hints' })
  npcDirectionalHintLayer.eventMode = 'none'
  const npcDirectionalHints = Array.from({ length: 2 }, () => {
    const sprite = new Sprite(textures.base[hub.markers.onboarding.directional])
    sprite.anchor.set(0.5)
    sprite.eventMode = 'none'
    sprite.visible = false
    npcDirectionalHintLayer.addChild(sprite)
    return sprite
  })
  application.stage.addChild(
    courtyardScene.stage,
    privateRoomScene.world,
    npcDirectionalHintLayer,
    worldNameplates.container,
    playerActivities.container,
    worldSpeech.container,
  )
  const secondaryScreenFlash = new Graphics({ label: 'native-secondary-screen-flash' })
  secondaryScreenFlash.eventMode = 'none'
  secondaryScreenFlash.visible = false
  drawSecondaryScreenFlash(secondaryScreenFlash, viewport)
  application.stage.addChild(secondaryScreenFlash)
  const secondaryScreenFeedback = new Map<
    HubRegionId,
    NativeSecondaryScreenFeedbackPresentation
  >()
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
  let armedLevelUpPresentationId: number | null = null
  let lastLevelUpPresentationId: number | null = null
  let levelUpPresentationStartedAt: number | null = null
  let resolution = initialResolution
  let sampledStudentCount = -1
  let worldSpeeches: readonly GameWorldSpeech[] = []
  let markerSurface: HubNpcMarkerSurface = null
  const frameDiagnostics: HubFrameDiagnostics = {
    astronomerRenderable: true,
    astronomerTelescopeFrame: 0,
    cameraRenderGroupCount: courtyardScene.cameraRenderGroupCount
      + Number(privateRoomScene.world.isRenderGroup),
    collegePathCursor: options.initialSnapshot.world.participants[options.playerId]
      ?.collegeIntro?.pathCursor ?? null,
    frameCount: 0,
    fadeAlpha: 0,
    hostPlayerId: options.initialSnapshot.hostPlayerId,
    localPlayerId: options.playerId,
    levelUpParticleCount: 0,
    orbSpriteCount: 0,
    playerCount: Object.keys(options.initialSnapshot.players).length,
    playerAttachmentPose: 0,
    playerElementEffectPrimaryId: null,
    playerElementEffectPrimaryIds: {},
    playerElementEffectScale: 1,
    playerHeadingIndex: 0,
    playerMagicShieldScale: 1.5,
    playerMagicShieldVisible: false,
    playerMaterialTint: 0xffffff,
    playerMoving: false,
    playerPositions: {},
    playerScreenPositions: {},
    playerWalkPose: 0,
    playerWeaponScale: 1,
    playerX: Number.NaN,
    playerY: Number.NaN,
    primarySpellCount: 0,
    primarySpellKinds: [],
    secondaryAbilityCount: 0,
    secondaryAbilityKinds: [],
    secondaryAbilityPrimitiveCount: 0,
    secondaryAbilitySamples: [],
    secondaryScreenFlashAlpha: 0,
    secondaryScreenFlashColor: 0xffffff,
    skorcha: options.initialSnapshot.world.skorcha === null ? null : {
      dismissalIndex: options.initialSnapshot.world.skorcha.dismissalIndex,
      gesture: options.initialSnapshot.world.skorcha.gesture,
      hatFrame: options.initialSnapshot.world.skorcha.hatFrame,
      variant: options.initialSnapshot.world.skorcha.variant,
      x: options.initialSnapshot.world.skorcha.position.x,
      y: options.initialSnapshot.world.skorcha.position.y,
    },
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
    frameDiagnostics.collegePathCursor = participant?.collegeIntro?.pathCursor ?? null
    frameDiagnostics.hostPlayerId = snapshot.hostPlayerId
    frameDiagnostics.playerCount = Object.keys(snapshot.players).length
    const currentScene = participant?.region === 'courtyard'
      ? courtyardScene
      : privateRoomScene
    frameDiagnostics.primarySpellCount = currentScene.primarySpellCount
    frameDiagnostics.primarySpellKinds = currentScene.primarySpellKinds
    frameDiagnostics.levelUpParticleCount = currentScene.levelUpParticleCount
    frameDiagnostics.secondaryAbilityCount = currentScene.secondaryAbilityCount
    frameDiagnostics.secondaryAbilityKinds = currentScene.secondaryAbilityKinds
    frameDiagnostics.secondaryAbilityPrimitiveCount = currentScene.secondaryAbilityPrimitiveCount
    frameDiagnostics.secondaryAbilitySamples = currentScene.secondaryAbilitySamples
    frameDiagnostics.skorcha = snapshot.world.skorcha === null ? null : {
      dismissalIndex: snapshot.world.skorcha.dismissalIndex,
      gesture: snapshot.world.skorcha.gesture,
      hatFrame: snapshot.world.skorcha.hatFrame,
      variant: snapshot.world.skorcha.variant,
      x: snapshot.world.skorcha.position.x,
      y: snapshot.world.skorcha.position.y,
    }
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
    frameDiagnostics.playerElementEffectPrimaryIds = Object.fromEntries(
      Object.keys(snapshot.players).map((playerId) => {
        const region = snapshot.world.participants[playerId]?.region
        const view = region === 'courtyard'
          ? courtyardScene.player(playerId)
          : privateRoomScene.player(playerId)
        return [playerId, view?.elementEffectPrimaryId ?? null]
      }),
    )
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
    frameDiagnostics.playerElementEffectPrimaryId = playerView.elementEffectPrimaryId
    frameDiagnostics.playerElementEffectScale = playerView.elementEffectScale
    frameDiagnostics.playerMagicShieldScale = playerView.magicShieldScale
    frameDiagnostics.playerMagicShieldVisible = playerView.magicShieldVisible
    frameDiagnostics.playerMaterialTint = playerView.materialTint
    frameDiagnostics.playerWalkPose = playerView.walkPose
    frameDiagnostics.playerWeaponScale = playerView.weaponScale
    frameDiagnostics.orbSpriteCount = playerView.orbSpriteCount
  }

  const renderer: HubWorldRenderer = {
    canvas,
    render(snapshot) {
      if (destroyed) return
      const player = snapshot.players[options.playerId]
      const participant = snapshot.world.participants[options.playerId]
      if (!player || !participant) return
      const camera = hubRegionCameraOrigin(
        participant.region,
        player.position,
        viewport,
        baseCameraScale,
      )
      for (const playerId of Object.keys(frameDiagnostics.playerScreenPositions)) {
        if (snapshot.world.participants[playerId]?.region !== participant.region) {
          delete frameDiagnostics.playerScreenPositions[playerId]
        }
      }
      for (const [playerId, remote] of Object.entries(snapshot.players)) {
        if (snapshot.world.participants[playerId]?.region !== participant.region) continue
        const position = frameDiagnostics.playerScreenPositions[playerId] ??= { x: 0, y: 0 }
        position.x = (remote.position.x - camera.x) * baseCameraScale
        position.y = (remote.position.y - camera.y) * baseCameraScale
      }
      const frameAt = now()
      frameTimeTotal += Math.max(0, frameAt - previousFrameAt)
      previousFrameAt = frameAt
      frameCount += 1
      if (
        armedLevelUpPresentationId !== null
        && levelUpPresentationStartedAt === null
      ) levelUpPresentationStartedAt = frameAt
      const levelUpPresentationElapsedMs = levelUpPresentationStartedAt === null
        ? 0
        : frameAt - levelUpPresentationStartedAt
      if (
        armedLevelUpPresentationId !== null
        && levelUpPresentationElapsedMs >= NATIVE_LEVEL_UP_PRESENTATION_DURATION_MS
      ) {
        armedLevelUpPresentationId = null
        levelUpPresentationStartedAt = null
        canvas.dataset.levelUpPresentationId = 'none'
      }
      const levelUpPresentation = armedLevelUpPresentationId === null
        ? null
        : {
            elapsedMs: levelUpPresentationElapsedMs,
            playerScreenY: player.position.y - camera.y,
            presentationId: armedLevelUpPresentationId,
          }
      const worldPresentationFrame = skillPickerWorldPresentationFrame(
        snapshot.tick,
        frameCount,
        snapshot.levelUpBarrier !== null,
      )
      const visibleWorldWidth = viewport.width / baseCameraScale
      const pointGainAt = (position: Readonly<{ x: number, y: number }>): number => (
        nativeRegionPointGain(
          position,
          {
            x: camera.x + visibleWorldWidth / 2,
            y: camera.y + viewport.height / baseCameraScale / 2,
          },
          visibleWorldWidth,
          player.progression.lifeState !== 'alive',
        )
      )
      courtyardScene.update(
        snapshot,
        options.playerId,
        worldPresentationFrame,
        levelUpPresentation,
        pointGainAt,
        markerSurface,
      )
      privateRoomScene.update(
        snapshot,
        options.playerId,
        worldPresentationFrame,
        levelUpPresentation,
        pointGainAt,
        markerSurface,
      )
      const inCourtyard = participant.region === 'courtyard'
      courtyardScene.stage.visible = inCourtyard
      privateRoomScene.world.visible = !inCourtyard
      if (inCourtyard) {
        courtyardScene.world.position.set(-camera.x, -camera.y)
        const southernTranslation = hubSouthernCameraTranslation(camera, {
          height: viewport.height / baseCameraScale,
          width: viewport.width / baseCameraScale,
        })
        courtyardScene.southern.position.copyFrom(southernTranslation)
        const studentCount = snapshot.world.students.length
        if (hubStudentVisibilityDiagnosticsDue(
          frameCount,
          studentCount,
          sampledStudentCount,
        )) {
          const view = {
            height: viewport.height / baseCameraScale,
            width: viewport.width / baseCameraScale,
          }
          const visible = courtyardScene.countVisibleStudents(snapshot, camera, view)
          frameDiagnostics.studentVisibleCandidateCount = visible
          frameDiagnostics.studentOutsideViewCount = studentCount - visible
          sampledStudentCount = studentCount
        }
      } else {
        privateRoomScene.world.position.set(
          -camera.x * baseCameraScale,
          -camera.y * baseCameraScale,
        )
        frameDiagnostics.studentVisibleCandidateCount = 0
        frameDiagnostics.studentOutsideViewCount = snapshot.world.students.length
        sampledStudentCount = snapshot.world.students.length
      }
      let screenFeedback = secondaryScreenFeedback.get(participant.region)
      if (!screenFeedback) {
        screenFeedback = new NativeSecondaryScreenFeedbackPresentation(
          snapshot.tick,
          `hub:${participant.region}`,
        )
        secondaryScreenFeedback.set(participant.region, screenFeedback)
      }
      for (const event of snapshot.secondaryAbilities.events) {
        screenFeedback.consume(event, {
          cameraCenter: {
            x: camera.x + visibleWorldWidth / 2,
            y: camera.y + viewport.height / baseCameraScale / 2,
          },
          localPlayerAlternate: player.progression.lifeState !== 'alive',
          visibleWorldWidth,
        })
      }
      for (const effect of snapshot.primarySpells.transients) {
        if (effect.kind === 'ether-blast') {
          screenFeedback.consumePrimaryEtherBlast(effect, {
            cameraCenter: {
              x: camera.x + visibleWorldWidth / 2,
              y: camera.y + viewport.height / baseCameraScale / 2,
            },
            localPlayerAlternate: player.progression.lifeState !== 'alive',
            visibleWorldWidth,
          })
          continue
        }
        if (effect.kind === 'weld-meteor') {
          if (effect.phase !== 'impact' || effect.cameraDisplacement === null) continue
          screenFeedback.consumePrimaryCameraDisplacement({
            displacement: effect.cameraDisplacement,
            eventId: effect.id,
            tick: snapshot.tick - effect.impactAgeTicks,
            worldKey: effect.worldKey,
          })
          continue
        }
        if (
          effect.kind === 'weld-persistent'
          && effect.buildId === 1008
          && effect.phase === 'flight'
          && effect.releaseAgeTicks !== null
        ) screenFeedback.consumePrimaryCameraMagnitude({
          eventId: effect.id,
          magnitude: Math.fround(0.1),
          tick: snapshot.tick - effect.releaseAgeTicks,
          worldKey: effect.worldKey,
        })
      }
      const screenOverlay = screenFeedback.sample(snapshot.tick)
      const secondaryCameraMagnitude = zoomEffects
        ? screenFeedback.sampleCameraMagnitude(snapshot.tick)
        : 0
      const secondaryCameraDisplacement = zoomEffects
        ? screenFeedback.sampleCameraDisplacement(snapshot.tick)
        : { x: 0, y: 0 }
      const feedbackCameraScale = baseCameraScale * (1 + secondaryCameraMagnitude)
      if (inCourtyard) {
        courtyardScene.stage.scale.set(feedbackCameraScale)
        courtyardScene.stage.position.set(
          (baseCameraScale - feedbackCameraScale) * (player.position.x - camera.x)
            + secondaryCameraDisplacement.x,
          (baseCameraScale - feedbackCameraScale) * (player.position.y - camera.y)
            + secondaryCameraDisplacement.y,
        )
      } else {
        privateRoomScene.world.scale.set(feedbackCameraScale)
        privateRoomScene.world.position.set(
          baseCameraScale * (player.position.x - camera.x)
            - feedbackCameraScale * player.position.x
            + secondaryCameraDisplacement.x,
          baseCameraScale * (player.position.y - camera.y)
            - feedbackCameraScale * player.position.y
            + secondaryCameraDisplacement.y,
        )
      }
      const worldNameplateTransform = {
        position: {
          x: (player.position.x - camera.x) * baseCameraScale
            - feedbackCameraScale * player.position.x,
          y: (player.position.y - camera.y) * baseCameraScale
            - feedbackCameraScale * player.position.y,
        },
        scale: feedbackCameraScale,
      }
      const onboarding = participant.region === 'courtyard'
        ? hubNpcOnboardingPlan(player.economy.npc.helpFlags, snapshot.tick, markerSurface)
        : []
      const directional = onboarding.filter(plan => plan.kind === 'directional')
      for (let index = 0; index < npcDirectionalHints.length; index += 1) {
        const sprite = npcDirectionalHints[index]!
        const plan = directional[index]
        sprite.visible = plan !== undefined
        if (!plan) continue
        const actor = NATIVE_HUB_NPC_CATALOG.interactions[plan.target].geometry.position
        const worldPoint = {
          x: actor.x + plan.offset.x,
          y: actor.y + plan.offset.y,
        }
        const target = {
          x: worldNameplateTransform.position.x + worldPoint.x * worldNameplateTransform.scale,
          y: worldNameplateTransform.position.y + worldPoint.y * worldNameplateTransform.scale,
        }
        const frame = hubNpcDirectionalHintFrame(target, viewport)
        sprite.position.copyFrom(frame.position)
        sprite.rotation = frame.rotationRadians
      }
      canvas.dataset.npcDirectionalHintCount = `${directional.length}`
      canvas.dataset.npcHelpFlags = player.economy.npc.helpFlags.map(Number).join('')
      canvas.dataset.npcMarkerIds = (
        participant.region === 'courtyard'
          ? courtyardScene.visibleMarkerIds
          : privateRoomScene.visibleMarkerIds
      ).join(',')
      canvas.dataset.npcWalkToTalkVisible = `${onboarding.some(
        plan => plan.kind === 'walk-to-talk',
      )}`
      worldNameplates.update(
        snapshot.players,
        options.playerId,
        (point) => projectNativeWorldPoint(
          point,
          worldNameplateTransform,
          viewport,
        ),
        {
          includePlayer: (playerId) => (
            snapshot.world.participants[playerId]?.region === participant.region
          ),
          renderable: true,
        },
      )
      const activityDiagnostics = playerActivities.update(
        deriveHubPlayerActivityItems(
          snapshot.players,
          snapshot.world.participants,
          participant.region,
        ),
        (point) => projectNativeWorldPoint(
          point,
          worldNameplateTransform,
          viewport,
        ),
      )
      canvas.dataset.hubActivityCount = `${activityDiagnostics.visibleCount}`
      canvas.dataset.hubActivityPlayerIds = activityDiagnostics.playerIds.join(',')
      canvas.dataset.hubActivityStates = activityDiagnostics.activities.join(',')
      const worldSpeechDiagnostics = worldSpeech.update(
        worldSpeeches,
        snapshot.players,
        frameAt,
        (point) => projectNativeWorldPoint(
          point,
          worldNameplateTransform,
          viewport,
        ),
        {
          includePlayer: (playerId) => (
            snapshot.world.participants[playerId]?.region === participant.region
          ),
          renderable: true,
        },
      )
      canvas.dataset.worldSpeechActiveCount = `${worldSpeechDiagnostics.activeCount}`
      canvas.dataset.worldSpeechAlphas = worldSpeechDiagnostics.alphas.join(',')
      canvas.dataset.worldSpeechCount = `${worldSpeechDiagnostics.visibleCount}`
      canvas.dataset.worldSpeechMaximumAlpha = `${worldSpeechDiagnostics.maximumAlpha}`
      canvas.dataset.worldSpeechPlayerIds = worldSpeechDiagnostics.playerIds.join(',')
      canvas.dataset.worldSpeechSequences = worldSpeechDiagnostics.sequences.join(',')
      secondaryScreenFlash.alpha = screenOverlay?.alpha ?? 0
      secondaryScreenFlash.tint = screenOverlay?.color ?? 0xffffff
      secondaryScreenFlash.visible = screenOverlay !== null
      frameDiagnostics.secondaryScreenFlashAlpha = screenOverlay?.alpha ?? 0
      frameDiagnostics.secondaryScreenFlashColor = screenOverlay?.color ?? 0xffffff
      canvas.dataset.secondaryScreenFlashAlpha = `${screenOverlay?.alpha ?? 0}`
      canvas.dataset.secondaryScreenFlashColor = `${screenOverlay?.color ?? 0xffffff}`
      canvas.dataset.secondaryCameraMagnitude = `${secondaryCameraMagnitude}`
      fadeCover.alpha = participant.transition?.alpha ?? 0
      canvas.dataset.hubRegion = participant.region
      canvas.dataset.transitionAlpha = `${fadeCover.alpha}`
      canvas.dataset.transitionPhase = participant.transition?.phase ?? 'none'
      canvas.dataset.levelUpDynamicSuppressed = 'false'
      canvas.dataset.levelUpParticleCount = `${frameDiagnostics.levelUpParticleCount}`
      canvas.dataset.skorchaPresent = snapshot.world.skorcha === null ? 'false' : 'true'
      canvas.dataset.skorchaVariant = snapshot.world.skorcha === null
        ? ''
        : `${snapshot.world.skorcha.variant}`
      canvas.dataset.memorialNextAge = `${snapshot.world.memorial.nextAge}`
      canvas.dataset.memorialRenderedPortraits = `${privateRoomScene.memorialPortraitCount}`
      canvas.dataset.memorialPortraits = JSON.stringify(snapshot.world.memorial.slots.map(
        ({ portrait, portraitId }, slot) => ({
          name: portrait?.config.displayName ?? null,
          portraitId,
          slot,
        }),
      ))
      application.render()
      updateFrameDiagnostics(snapshot)
      if (frameCount % HUB_DIAGNOSTIC_WINDOW_FRAMES !== 0) return
      const averageFrameMs = frameTimeTotal / HUB_DIAGNOSTIC_WINDOW_FRAMES
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
      drawSecondaryScreenFlash(secondaryScreenFlash, viewport)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      canvas.dataset.viewportHeight = `${viewport.height}`
      canvas.dataset.viewportWidth = `${viewport.width}`
    },
    setLevelUpPresentation(presentationId) {
      if (destroyed) return
      if (
        presentationId !== null
        && presentationId !== lastLevelUpPresentationId
      ) {
        armedLevelUpPresentationId = presentationId
        lastLevelUpPresentationId = presentationId
        levelUpPresentationStartedAt = null
      }
      canvas.dataset.levelUpPresentationId = armedLevelUpPresentationId === null
        ? 'none'
        : `${armedLevelUpPresentationId}`
      canvas.dataset.levelUpDynamicSuppressed = 'false'
    },
    setSettings(settings) {
      if (destroyed) return
      baseCameraScale = cameraZoomForFov(HUB_CAMERA_SCALE, settings.cameraFovPercent)
      zoomEffects = settings.zoomEffects
      canvas.dataset.cameraZoom = `${baseCameraScale}`
      canvas.dataset.zoomEffects = `${zoomEffects}`
    },
    setUiSurface(surface) {
      if (destroyed) return
      markerSurface = surface
      canvas.dataset.npcMarkerSurface = surface ?? 'none'
    },
    setWorldSpeeches(speeches) {
      if (destroyed || speeches === worldSpeeches) return
      worldSpeeches = speeches
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      application.stage.removeChild(
        courtyardScene.stage,
        privateRoomScene.world,
        npcDirectionalHintLayer,
        worldNameplates.container,
        playerActivities.container,
        worldSpeech.container,
        secondaryScreenFlash,
        fadeCover,
      )
      courtyardScene.destroy()
      privateRoomScene.destroy()
      npcDirectionalHintLayer.destroy({ children: true })
      worldNameplates.destroy()
      playerActivities.destroy()
      worldSpeech.destroy()
      secondaryScreenFeedback.clear()
      secondaryScreenFlash.destroy()
      fadeCover.destroy()
      destroyHubWorldTextureFrames(textures)
      modTextures.destroy()
      application.destroy({ removeView: true })
      canvas.remove()
    },
  }

  courtyardScene.update(options.initialSnapshot, options.playerId, frameCount)
  privateRoomScene.update(options.initialSnapshot, options.playerId, frameCount)
  renderer.setSettings(options.settings ?? DEFAULT_GAME_SETTINGS)
  renderer.render(options.initialSnapshot)
  publishDiagnostics(options.initialSnapshot, 0)
  return renderer
}

function drawSecondaryScreenFlash(
  graphic: Graphics,
  viewport: GameViewportLayout,
): void {
  graphic.clear()
    .rect(0, 0, viewport.width, viewport.height)
    .fill({ color: 0xffffff })
}
