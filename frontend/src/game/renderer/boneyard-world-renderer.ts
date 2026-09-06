import { Application, Container, Graphics, MeshSimple, Sprite } from 'pixi.js'
import 'pixi.js/unsafe-eval'
import type { Camera } from '../../editor/render.ts'
import { nativeBoneyardMainLayers } from '../../editor/render.ts'
import { NATIVE_TUTORIAL_CAMERA_TARGET, nativeTutorialCameraBounds } from '../core-kernels/native-tutorial.ts'
import { cameraZoomForFov, DEFAULT_GAME_SETTINGS, gameLightQuality, NATIVE_BROWSER_ENHANCED_EFFECTS } from '../game-settings.ts'
import type { BoneyardEnemyEventSnapshot, GameSnapshot, ProtocolPlayerState } from '../protocol/game-state.ts'
import type { GameWorldSpeech } from '../world-speech-presentation.ts'
import { BoneyardDynamicScene } from './boneyard-dynamic-scene.ts'
import { NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX, nativeArenaDisplacementCoverPlan } from './boneyard-lighting.ts'
import { BoneyardRegionLightField } from './boneyard-region-light-field.ts'
import type { BoneyardSpectatorCameraState } from './boneyard-render-contract.ts'
import { BONEYARD_CAMERA_ZOOM, boneyardCamera, boneyardCameraFocus, boneyardSpectatorCameraState, boneyardSpectatorStatus, boneyardVisibleWorldBounds, INITIAL_BONEYARD_SPECTATOR_CAMERA_STATE, isBoneyardSpectatorStatusSnapshot } from './boneyard-render-contract.ts'
import { createBoneyardRendererDiagnostics, updateBoneyardRendererDiagnostics } from './boneyard-renderer-diagnostics.ts'
import type { BoneyardWorldRenderer, BoneyardWorldRendererOptions, StaticWorldBuild } from './boneyard-renderer-model.ts'
import { requireBoneyardSnapshot } from './boneyard-renderer-model.ts'
import { editorDocument, loadStaticPainterImages } from './boneyard-static-layout.ts'
import { BoneyardResidentVisibility, buildStaticWorld, destroyResidentTexture } from './boneyard-static-world.ts'
import { destroyBoneyardWorldTextures, loadBoneyardWorldTextures } from './boneyard-textures.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import { gameViewportWorldZoom } from './game-viewport.ts'
import { initialHubResolution } from './hub-render-contract.ts'
import { NATIVE_LEVEL_UP_PRESENTATION_DURATION_MS, skillPickerWorldPresentationFrame } from './level-up-presentation.ts'
import { loadModPresentationTextures } from './mod-presentation-assets.ts'
import type { NativeArenaRenderPipeline } from './native-arena-render-pipeline.ts'
import { installNativeArenaRenderPipeline } from './native-arena-render-pipeline.ts'
import { NativeCrowBlindnessView } from './native-crow-blindness-view.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { NativeEnemyWorldFeedbackPresentation, nativeEnemyWorldFeedbackTransform } from './native-enemy-world-feedback.ts'
import { installNativeFixedFunctionRenderPipeline } from './native-fixed-function-render-pipeline.ts'
import { NativeSecondaryScreenFeedbackPresentation, nativeSecondaryWorldShake, presentNativeSecondaryScreenOverlay } from './native-secondary-presentation.ts'
import { NativeWorldNameplateLayer, projectNativeWorldPoint } from './native-world-nameplate.ts'
import { NativeWorldSpeechLayer } from './native-world-speech.ts'
import { PLAYER_CHARACTER_ATLAS_SOURCES } from './player-character-atlas.ts'
function drawSecondaryScreenFlash(
  graphic: Graphics,
  viewport: GameViewportLayout,
): void {
  graphic.clear()
    .rect(0, 0, viewport.width, viewport.height)
    .fill({ color: 0xffffff })
}

function drawArenaDisplacementCover(
  graphic: Graphics,
  canvas: HTMLCanvasElement,
  displacement: Readonly<{ x: number; y: number }>,
  viewport: Readonly<{ height: number; width: number }>,
  complexLighting: boolean,
  worldTransform: Readonly<{
    position: Readonly<{ x: number; y: number }>
    scale: number
  }>,
): void {
  const plan = nativeArenaDisplacementCoverPlan(
    displacement,
    viewport,
    complexLighting,
  )
  graphic.clear()
  graphic.visible = plan !== null
  canvas.dataset.displacementCoverRectangles = JSON.stringify(plan?.rectangles ?? [])
  canvas.dataset.displacementCoverVisible = `${plan !== null}`
  if (plan === null) {
    graphic.position.set(0, 0)
    return
  }
  graphic.position.set(0, 0)
  for (const rectangle of plan.rectangles) {
    graphic.rect(
      (plan.position.x + rectangle.x - worldTransform.position.x) / worldTransform.scale,
      (plan.position.y + rectangle.y - worldTransform.position.y) / worldTransform.scale,
      rectangle.width / worldTransform.scale,
      rectangle.height / worldTransform.scale,
    )
  }
  graphic.fill({ color: 0x000000 })
}

export async function createBoneyardWorldRenderer(
  options: BoneyardWorldRendererOptions,
): Promise<BoneyardWorldRenderer> {
  requireBoneyardSnapshot(options.initialSnapshot, options.boneyard.runId)
  const [textures, , modTextures] = await Promise.all([
    loadBoneyardWorldTextures(),
    loadStaticPainterImages(),
    loadModPresentationTextures(options.modAssets),
  ])
  const application = new Application()
  const devicePixelRatio = options.devicePixelRatio ?? window.devicePixelRatio
  let viewport = options.viewport
  let settings = options.settings ?? DEFAULT_GAME_SETTINGS
  let worldZoom = gameViewportWorldZoom(viewport)
  let cameraZoom = cameraZoomForFov(BONEYARD_CAMERA_ZOOM, settings.cameraFovPercent)
    * worldZoom
  let lightQuality = gameLightQuality(settings)
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
    installNativeFixedFunctionRenderPipeline(application.renderer, {
      installTextureAlphaShaders: false,
    })
    for (const source of PLAYER_CHARACTER_ATLAS_SOURCES) {
      application.renderer.texture.initSource(textures.base[source].source)
    }
  } catch (error) {
    if (application.renderer) application.destroy({ removeView: true })
    destroyBoneyardWorldTextures(textures)
    modTextures.destroy()
    throw error
  }
  application.stop()
  let arenaRenderPipeline: NativeArenaRenderPipeline
  try {
    arenaRenderPipeline = installNativeArenaRenderPipeline(application.renderer)
  } catch (error) {
    application.destroy({ removeView: true })
    destroyBoneyardWorldTextures(textures)
    modTextures.destroy()
    throw error
  }

  const document = editorDocument(options.boneyard)
  const world = new Container({ isRenderGroup: true, label: 'boneyard-world' })
  world.sortableChildren = true
  application.stage.addChild(world)
  const worldNameplates = new NativeWorldNameplateLayer(textures.fontAtlas)
  const worldSpeech = new NativeWorldSpeechLayer(textures.fontAtlas)
  application.stage.addChild(worldNameplates.container, worldSpeech.container)

  let staticWorld: StaticWorldBuild | null = null
  try {
    staticWorld = await buildStaticWorld(
      document,
      options.boneyard.scene,
      world,
      {
        ground: textures.ground,
        roads: textures.roads,
      },
      options.initialSnapshot.world.kind === 'boneyard'
        ? options.initialSnapshot.world.arenaTransition?.combatBounds
          ?? (options.initialSnapshot.world.tutorial === null
            ? null
            : NATIVE_TUTORIAL_CAMERA_TARGET)
        : null,
    )
  } catch (error) {
    application.stage.removeChild(world, worldNameplates.container, worldSpeech.container)
    worldNameplates.destroy()
    worldSpeech.destroy()
    world.destroy({ children: true })
    arenaRenderPipeline.destroy()
    application.destroy({ removeView: true })
    destroyBoneyardWorldTextures(textures)
    modTextures.destroy()
    throw error
  }

  const mainLayers = nativeBoneyardMainLayers(document)
  const scene = new BoneyardDynamicScene(
    options.boneyard,
    world,
    application.renderer,
    textures,
    mainLayers,
    staticWorld.mainResidents,
    staticWorld.shadowCasters,
    staticWorld.treeInputs,
    staticWorld.treeResidents,
    staticWorld.buildingResidents,
    staticWorld.wallResidents,
    options.initialSnapshot,
    modTextures,
    options.modCatalog,
  )
  const regionLightField = new BoneyardRegionLightField(
    world,
    textures.regionLightGlyph,
    viewport,
    initialResolution,
    lightQuality,
  )
  const displacementCover = new Graphics({ label: 'native-arena-displacement-cover' })
  displacementCover.eventMode = 'none'
  displacementCover.visible = false
  displacementCover.zIndex = NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX
  world.addChild(displacementCover)
  const secondaryScreenFlash = new Graphics({ label: 'native-secondary-screen-flash' })
  secondaryScreenFlash.eventMode = 'none'
  secondaryScreenFlash.visible = false
  drawSecondaryScreenFlash(secondaryScreenFlash, viewport)
  application.stage.addChild(secondaryScreenFlash)
  const crowBlindness = new NativeCrowBlindnessView(application.stage,
    textures.base[nativeEnemySpriteRecord('DeadHawg', 1).source]!)
  const visibility = new BoneyardResidentVisibility(staticWorld.activeResidents)
  const worldFeedback = new NativeEnemyWorldFeedbackPresentation(
    options.initialSnapshot.tick,
    options.initialSnapshot.world.enemyWorldFeedback,
    Math.max(0, ...options.initialSnapshot.world.enemyEvents.map(({ eventId }) => eventId)),
  )
  const now = options.now ?? (() => performance.now())
  const secondaryScreenFeedback = new NativeSecondaryScreenFeedbackPresentation(
    options.initialSnapshot.tick,
    `boneyard:${options.boneyard.runId}`,
  )
  const pendingEnemyScreenEvents: BoneyardEnemyEventSnapshot[] = []
  const canvas = application.canvas as HTMLCanvasElement
  canvas.className = 'boneyard-world-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.gameRenderer = 'pixi-webgl'
  canvas.dataset.arenaSaturation = 'native-fragment-0.65'
  canvas.dataset.arenaTextureAlpha = 'native-npm+composite-pma'
  canvas.dataset.arenaBaseRenderer = 'retail-editor-field-capture+native-road-layout'
  canvas.dataset.arenaGroundRenderer = 'retail-editor-field-capture-web-override'
  canvas.dataset.buildingLighting = 'native-elevated-vertex-grid'
  canvas.dataset.buildingLightingGrid = NATIVE_BROWSER_ENHANCED_EFFECTS ? '3x3' : '2x2'
  canvas.dataset.wallLighting = 'native-endpoint-vertex-gradient'
  canvas.dataset.complexShadows = 'native-indexed-owner-mesh'
  canvas.dataset.treeComplexShadowOutline = 'native-main-variant-table'
  canvas.dataset.rendererName = application.renderer.name
  canvas.dataset.resolution = `${initialResolution}`
  canvas.dataset.regionLightComposite = 'multiply-pre-main'
  canvas.dataset.regionLightEntry = 'DeadHawg:18'
  canvas.dataset.regionLighting = 'native-region-field+object-scalar'
  canvas.dataset.roadActiveMeshCount = `${staticWorld.surface.activeRoadMeshCount}`
  canvas.dataset.roadIndexCount = `${staticWorld.surface.roadIndexCount}`
  canvas.dataset.roadMeshCount = `${staticWorld.surface.roadMeshCount}`
  canvas.dataset.roadRenderer = 'native-indexed-owner-mesh'
  canvas.dataset.roadVertexCount = `${staticWorld.surface.roadVertexCount}`
  canvas.dataset.staticCulling = 'exact-world-bounds'
  canvas.dataset.staticOffCameraCleanup = 'pending'
  canvas.dataset.staticPaintCount = `${staticWorld.staticPaintCount}`
  canvas.dataset.playerTextureAlpha = textures.players.air.robe[0]![0]!.source.alphaMode
  canvas.dataset.solomonTextureAlpha = textures.solomonDig[0]!.source.alphaMode
  canvas.dataset.combatTextureAlpha = textures.levelUpSparkle.source.alphaMode
  canvas.dataset.playerTextureAddress = textures.players.air.robe[0]![0]!.source.addressMode
  canvas.dataset.solomonTextureAddress = textures.solomonDig[0]!.source.addressMode
  canvas.dataset.combatTextureAddress = textures.levelUpSparkle.source.addressMode
  canvas.dataset.weatherSplashAsset = 'DeadHawg:24'
  canvas.dataset.weatherSplashBlend = 'add'
  canvas.dataset.weatherStreakRenderer = 'pixi-particle-batch'
  canvas.dataset.displacementCoverRectangles = '[]'
  canvas.dataset.displacementCoverVisible = 'false'
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  canvas.dataset.viewportHeight = `${viewport.height}`
  canvas.dataset.viewportWidth = `${viewport.width}`

  let destroyed = false
  let frameCount = 0
  let currentWorldDisplacement: Readonly<{ x: number; y: number }> = { x: 0, y: 0 }
  let worldSpeeches: readonly GameWorldSpeech[] = []
  let armedLevelUpPresentationId: number | null = null
  let lastLevelUpPresentationId: number | null = null
  let levelUpPresentationStartedAt: number | null = null
  let resolution = initialResolution
  let spectatorCamera: BoneyardSpectatorCameraState =
    INITIAL_BONEYARD_SPECTATOR_CAMERA_STATE
  const frameDiagnostics = createBoneyardRendererDiagnostics(
    canvas, staticWorld, regionLightField, options.initialSnapshot, options.boneyard.scene.environmentMode, world, mainLayers.length,
  )
  const rendererPixelProbesEnabled = import.meta.env.DEV || (
    globalThis as typeof globalThis & { __sdrRendererPixelProbes?: boolean }
  ).__sdrRendererPixelProbes === true
  if (rendererPixelProbesEnabled) {
    const weatherSplashRoot = world.children.find(
      ({ label }) => label === 'native-boneyard-weather-splashes',
    )
    if (!(weatherSplashRoot instanceof Container)) {
      throw new Error('Boneyard weather splash root is unavailable.')
    }
    Object.defineProperty(canvas, '__sdrWeatherSplashPixelProbe', {
      configurable: false,
      enumerable: false,
      value: {
        blendModes: () => [...new Set(
          weatherSplashRoot.children.map(({ blendMode }) => blendMode),
        )].sort(),
        render: (renderable: boolean) => {
          weatherSplashRoot.renderable = renderable
          application.render()
        },
        renderable: () => weatherSplashRoot.renderable,
        scaleMode: () => (
          (weatherSplashRoot.children[0] as Sprite | undefined)?.texture.source.style.scaleMode
          ?? null
        ),
        splashViewCount: () => weatherSplashRoot.children.length,
      },
      writable: false,
    })
    const seekerRoot = world.children.find(({ label }) => label === 'hagatha-seeker')
    if (!(seekerRoot instanceof Container)) {
      throw new Error('Hagatha Seeker root is unavailable.')
    }
    Object.defineProperty(canvas, '__sdrSeekerPixelProbe', {
      configurable: false,
      enumerable: false,
      value: {
        alphaMode: () => (
          (seekerRoot.children[0] as MeshSimple | undefined)?.texture.source.alphaMode
          ?? null
        ),
        meshAlphas: () => seekerRoot.children.map(({ alpha }) => alpha),
        meshCount: () => seekerRoot.children.length,
        meshVertices: () => seekerRoot.children.map(child => (
          [...(child as MeshSimple).vertices]
        )),
        renderCurrent: () => application.render(),
        renderIsolated: (renderable: boolean) => {
          const stageRenderable = application.stage.children.map(child => child.renderable)
          const worldRenderable = world.children.map(child => child.renderable)
          try {
            for (const child of application.stage.children) child.renderable = child === world
            for (const child of world.children) child.renderable = child === seekerRoot
            seekerRoot.renderable = renderable
            application.render()
          } finally {
            application.stage.children.forEach((child, index) => {
              child.renderable = stageRenderable[index]!
            })
            world.children.forEach((child, index) => {
              child.renderable = worldRenderable[index]!
            })
          }
        },
        scaleMode: () => (
          (seekerRoot.children[0] as MeshSimple | undefined)?.texture.source.style.scaleMode
          ?? null
        ),
        worldTransform: () => ({
          scale: world.scale.x,
          x: world.position.x,
          y: world.position.y,
        }),
      },
      writable: false,
    })
  }

  const cameraFocusFor = (
    snapshot: GameSnapshot,
    advance = false,
  ) => {
    requireBoneyardSnapshot(snapshot, options.boneyard.runId)
    spectatorCamera = boneyardSpectatorCameraState(
      snapshot,
      options.playerId,
      spectatorCamera,
      advance,
    )
    return boneyardCameraFocus(
      snapshot,
      options.playerId,
      spectatorCamera,
      options.boneyard.scene.spawn,
    )
  }

  const cameraFor = (snapshot: GameSnapshot): Camera => {
    requireBoneyardSnapshot(snapshot, options.boneyard.runId)
    const focus = cameraFocusFor(snapshot)
    const tutorialCameraBounds = snapshot.world.kind === 'boneyard'
      && snapshot.world.tutorial !== null
      ? nativeTutorialCameraBounds(snapshot.world.tutorial)
      : null
    return boneyardCamera(
      focus.position,
      tutorialCameraBounds
        ?? snapshot.world.arenaTransition?.cameraBounds
        ?? options.boneyard.scene.bounds,
      viewport,
      cameraZoom,
    )
  }

  const renderer: BoneyardWorldRenderer = {
    canvas,
    camera: cameraFor,
    consumeEnemyEvent(event) {
      if (destroyed || event.runId !== options.boneyard.runId) return
      worldFeedback.consume(event)
      if (event.screenFlash !== undefined) pendingEnemyScreenEvents.push(event)
      scene.consumeEnemyEvent(event)
    },
    cycleSpectatorTarget(snapshot) {
      if (destroyed) return false
      requireBoneyardSnapshot(snapshot, options.boneyard.runId)
      const localPlayer = snapshot.players[options.playerId]
      const active = snapshot.run.phase === 'active'
        && snapshot.run.runId !== null
        && localPlayer?.progression.lifeState === 'spectating'
      cameraFocusFor(snapshot, active)
      return active
    },
    render(snapshot) {
      if (destroyed) return
      const currentStaticWorld = staticWorld
      if (currentStaticWorld === null) return
      requireBoneyardSnapshot(snapshot, options.boneyard.runId)
      const player = snapshot.players[options.playerId]
      if (!player) return
      frameCount += 1
      const cameraFocus = cameraFocusFor(snapshot)
      const tutorialCameraBounds = snapshot.world.tutorial === null
        ? null
        : nativeTutorialCameraBounds(snapshot.world.tutorial)
      const camera = boneyardCamera(
        cameraFocus.position,
        tutorialCameraBounds
          ?? snapshot.world.arenaTransition?.cameraBounds
          ?? options.boneyard.scene.bounds,
        viewport,
        cameraZoom,
      )
      if (
        snapshot.world.arenaTransition?.phase === 'sealed'
        || (
          snapshot.world.tutorial?.cameraLockTriggered === true
          && snapshot.world.tutorial.cameraLockTicksRemaining === 0
        )
      ) {
        currentStaticWorld.applyOffCameraCleanup()
      }
      const visibleWorld = boneyardVisibleWorldBounds(camera, viewport, 0)
      visibility.update(camera, viewport)
      const frameAt = now()
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
      const worldPresentationFrame = skillPickerWorldPresentationFrame(
        snapshot.tick,
        frameCount,
        snapshot.levelUpBarrier !== null,
      )
      const painter = scene.update(
        snapshot,
        options.playerId,
        worldPresentationFrame,
        visibility.visibleMainResidents,
        armedLevelUpPresentationId === null
          ? null
          : {
              elapsedMs: levelUpPresentationElapsedMs,
              playerScreenY: player.position.y - (
                camera.y - viewport.height / (2 * camera.zoom)
              ),
              presentationId: armedLevelUpPresentationId,
            },
        camera,
        viewport,
        settings,
      )
      regionLightField.setCompositeZIndex(
        painter.weatherLightingOrder.lightCompositeZIndex,
      )
      displacementCover.zIndex = painter.weatherLightingOrder.lightCompositeZIndex
      regionLightField.render(
        application.renderer,
        scene.lights.index.acceptedSources,
        camera,
        viewport,
      )
      for (const event of pendingEnemyScreenEvents.splice(0)) {
        secondaryScreenFeedback.consumeEnemy(event, { cameraCenter: { x: camera.x, y: camera.y },
          localPlayerAlternate: player.progression.lifeState !== 'alive', visibleWorldWidth: visibleWorld.w })
      }
      for (const event of snapshot.secondaryAbilities.events) {
        secondaryScreenFeedback.consume(event, {
          cameraCenter: { x: camera.x, y: camera.y },
          localPlayerAlternate: player.progression.lifeState !== 'alive',
          visibleWorldWidth: visibleWorld.w,
        })
      }
      for (const effect of snapshot.primarySpells.transients) {
        if (effect.kind === 'ether-blast') {
          secondaryScreenFeedback.consumePrimaryEtherBlast(effect, {
            cameraCenter: { x: camera.x, y: camera.y },
            localPlayerAlternate: player.progression.lifeState !== 'alive',
            visibleWorldWidth: visibleWorld.w,
          })
          continue
        }
        if (effect.kind === 'weld-meteor') {
          if (effect.phase !== 'impact' || effect.cameraDisplacement === null) continue
          secondaryScreenFeedback.consumePrimaryCameraDisplacement({
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
        ) secondaryScreenFeedback.consumePrimaryCameraMagnitude({
          eventId: effect.id,
          magnitude: Math.fround(0.1),
          tick: snapshot.tick - effect.releaseAgeTicks,
          worldKey: effect.worldKey,
        })
      }
      const sampledFeedback = worldFeedback.sample(snapshot.tick)
      const sampledSecondaryCameraMagnitude = secondaryScreenFeedback.sampleCameraMagnitude(
        snapshot.tick,
      )
      const sampledSecondaryCameraDisplacement = secondaryScreenFeedback.sampleCameraDisplacement(
        snapshot.tick,
      )
      const feedbackMagnitude = settings.zoomEffects ? sampledFeedback.magnitude : 0
      const secondaryCameraMagnitude = settings.zoomEffects
        ? sampledSecondaryCameraMagnitude
        : 0
      const secondaryCameraDisplacement = settings.zoomEffects
        ? sampledSecondaryCameraDisplacement
        : { x: 0, y: 0 }
      currentWorldDisplacement = settings.zoomEffects
        ? nativeSecondaryWorldShake(
            snapshot.secondaryAbilities.actors,
            `boneyard:${snapshot.world.runId}`,
            secondaryCameraDisplacement,
          )
        : { x: 0, y: 0 }
      const worldTransform = nativeEnemyWorldFeedbackTransform(
        camera,
        viewport,
        player.position,
        Math.max(feedbackMagnitude, secondaryCameraMagnitude),
      )
      world.scale.set(worldTransform.scale)
      world.position.set(
        worldTransform.position.x + currentWorldDisplacement.x,
        worldTransform.position.y + currentWorldDisplacement.y,
      )
      drawArenaDisplacementCover(
        displacementCover,
        canvas,
        currentWorldDisplacement,
        viewport,
        settings.complexLighting,
        { position: world.position, scale: world.scale.x },
      )
      const worldScreenTransform = {
        position: { x: world.position.x, y: world.position.y },
        scale: worldTransform.scale,
      }
      const visiblePlayers = visibleBoneyardPlayers(snapshot)
      worldNameplates.update(
        visiblePlayers,
        options.playerId,
        (point) => projectNativeWorldPoint(
          point,
          worldScreenTransform,
          viewport,
        ),
        { renderable: true },
      )
      const worldSpeechDiagnostics = worldSpeech.update(
        worldSpeeches,
        visiblePlayers,
        frameAt,
        (point) => projectNativeWorldPoint(point, worldScreenTransform, viewport),
        { renderable: true },
      )
      canvas.dataset.worldSpeechActiveCount = `${worldSpeechDiagnostics.activeCount}`
      canvas.dataset.worldSpeechAlphas = worldSpeechDiagnostics.alphas.join(',')
      canvas.dataset.worldSpeechCount = `${worldSpeechDiagnostics.visibleCount}`
      canvas.dataset.worldSpeechMaximumAlpha = `${worldSpeechDiagnostics.maximumAlpha}`
      canvas.dataset.worldSpeechPlayerIds = worldSpeechDiagnostics.playerIds.join(',')
      canvas.dataset.worldSpeechSequences = worldSpeechDiagnostics.sequences.join(',')
      const screenOverlay = presentNativeSecondaryScreenOverlay(
        secondaryScreenFeedback.sample(snapshot.tick),
        settings.reducedScreenFlashes,
      )
      secondaryScreenFlash.alpha = screenOverlay?.alpha ?? 0
      secondaryScreenFlash.tint = screenOverlay?.color ?? 0xffffff
      secondaryScreenFlash.visible = screenOverlay !== null
      crowBlindness.update(snapshot.players[options.playerId]!.lighting.blindnessTicksRemaining,
        frameAt, viewport)
      application.render()
      updateBoneyardRendererDiagnostics({
        frameDiagnostics, canvas, cameraFocus, camera, frameCount, painter, snapshot,
        scene, visibility, localPlayerId: options.playerId, viewport, currentStaticWorld,
        spectatorCamera, feedbackMagnitude, secondaryCameraMagnitude, regionLightField,
        currentWorldDisplacement, screenOverlay,
      })
    },
    resize(nextViewport, nextDevicePixelRatio = window.devicePixelRatio) {
      if (destroyed) return
      const nextResolution = initialHubResolution({
        devicePixelRatio: nextDevicePixelRatio,
        displayScale: nextViewport.displayScale,
      })
      const nextWorldZoom = gameViewportWorldZoom(nextViewport)
      if (
        nextResolution === resolution
        && nextWorldZoom === worldZoom
        && nextViewport.height === viewport.height
        && nextViewport.width === viewport.width
      ) return
      viewport = nextViewport
      resolution = nextResolution
      if (nextWorldZoom !== worldZoom) {
        worldZoom = nextWorldZoom
        cameraZoom = cameraZoomForFov(BONEYARD_CAMERA_ZOOM, settings.cameraFovPercent)
          * worldZoom
        canvas.dataset.cameraZoom = `${cameraZoom}`
      }
      application.renderer.resize(viewport.width, viewport.height, resolution)
      regionLightField.resize(viewport, resolution)
      frameDiagnostics.regionLightLogicalSide = regionLightField.targetLogicalSide
      frameDiagnostics.regionLightPhysicalSide = regionLightField.targetPhysicalSide
      drawSecondaryScreenFlash(secondaryScreenFlash, viewport)
      drawArenaDisplacementCover(
        displacementCover,
        canvas,
        currentWorldDisplacement,
        viewport,
        settings.complexLighting,
        { position: world.position, scale: world.scale.x },
      )
      canvas.dataset.resolution = `${resolution}`
      canvas.dataset.viewportHeight = `${viewport.height}`
      canvas.dataset.viewportWidth = `${viewport.width}`
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
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
    setSettings(nextSettings) {
      if (destroyed) return
      settings = nextSettings
      cameraZoom = cameraZoomForFov(BONEYARD_CAMERA_ZOOM, settings.cameraFovPercent)
        * worldZoom
      lightQuality = gameLightQuality(settings)
      regionLightField.setQuality(lightQuality, viewport, resolution)
      if (!settings.zoomEffects) {
        currentWorldDisplacement = { x: 0, y: 0 }
        frameDiagnostics.worldShakeX = 0
        frameDiagnostics.worldShakeY = 0
        canvas.dataset.worldShakeX = '0'
        canvas.dataset.worldShakeY = '0'
      }
      drawArenaDisplacementCover(
        displacementCover,
        canvas,
        currentWorldDisplacement,
        viewport,
        settings.complexLighting,
        { position: world.position, scale: world.scale.x },
      )
      frameDiagnostics.regionLightLogicalSide = regionLightField.targetLogicalSide
      frameDiagnostics.regionLightPhysicalSide = regionLightField.targetPhysicalSide
      canvas.dataset.cameraZoom = `${cameraZoom}`
      canvas.dataset.complexLighting = `${settings.complexLighting}`
      canvas.dataset.complexShadowsEnabled = `${settings.complexShadows}`
      canvas.dataset.lightQuality = `${lightQuality}`
      canvas.dataset.multipleShadows = `${settings.multipleShadows}`
      canvas.dataset.reducedScreenFlashes = `${settings.reducedScreenFlashes}`
      canvas.dataset.zoomEffects = `${settings.zoomEffects}`
    },
    setWorldSpeeches(speeches) {
      if (destroyed || speeches === worldSpeeches) return
      worldSpeeches = speeches
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      spectatorCamera = INITIAL_BONEYARD_SPECTATOR_CAMERA_STATE
      application.stage.removeChild(world, worldNameplates.container, worldSpeech.container)
      worldNameplates.destroy()
      worldSpeech.destroy()
      application.stage.removeChild(secondaryScreenFlash)
      world.removeChild(displacementCover)
      displacementCover.destroy()
      scene.destroy()
      regionLightField.destroy()
      secondaryScreenFlash.destroy()
      staticWorld?.surface.destroy()
      for (const resident of staticWorld?.residents ?? []) destroyResidentTexture(resident)
      staticWorld = null
      world.destroy({ children: true })
      destroyBoneyardWorldTextures(textures)
      modTextures.destroy()
      arenaRenderPipeline.destroy()
      crowBlindness.destroy()
      application.destroy({ removeView: true })
      canvas.remove()
    },
    spectatorStatus(snapshot) {
      if (destroyed || !isBoneyardSpectatorStatusSnapshot(snapshot)) return null
      cameraFocusFor(snapshot)
      return boneyardSpectatorStatus(snapshot, options.playerId, spectatorCamera)
    },
  }

  renderer.setSettings(options.settings ?? DEFAULT_GAME_SETTINGS)
  renderer.render(options.initialSnapshot)
  return renderer
}

function visibleBoneyardPlayers(
  snapshot: GameSnapshot,
): Readonly<Record<string, ProtocolPlayerState>> {
  if (snapshot.materializingPlayerIds.length === 0) return snapshot.players
  const materializing = new Set(snapshot.materializingPlayerIds)
  return Object.fromEntries(Object.entries(snapshot.players).filter(([playerId]) => (
    !materializing.has(playerId)
  )))
}
