// Installs Pixi's static CSP-safe sync paths; this module removes the need for eval.
import 'pixi.js/unsafe-eval'
import {
  Application,
  Container,
  Graphics,
  MeshSimple,
  Sprite,
  Texture,
  type ContainerChild,
} from 'pixi.js'

import {
  BONEYARD_SPRITE_SOURCES,
  spriteImage,
  spriteRefFor,
} from '../../editor/assets.ts'
import { NATIVE, type EditorDoc, type SpriteRef, type Vec2 } from '../../editor/model.ts'
import type { MainLayer, ObjectSpriteLayer } from '../../editor/native-render-plan.ts'
import {
  drawNativeBoneyardBase,
  drawNativeBoneyardForegroundBand,
  drawNativeBoneyardMainBand,
  nativeBoneyardForegroundLayers,
  nativeBoneyardMainLayers,
  STAGE_TEXTURES,
  type Camera,
} from '../../editor/render.ts'
import {
  nativeGateArtVertices,
  nativeGateLeaf,
  nativeGateHingeArtPosition,
  nativeGatePainterRoot,
  nativeGateRules,
  NATIVE_GATE_ART_INDICES,
  NATIVE_GATE_ART_UVS,
  type NativeGateLeaf,
} from '../../editor/native-fence-geometry.ts'
import {
  buildBoneyardPainterOrder,
  type DynamicPainterLayer,
  type StaticPainterLayer,
} from '../boneyard-painter-order.ts'
import type {
  BoneyardGateLeafSnapshot,
  SolomonDigState,
} from '../core-kernels/boneyard.ts'
import {
  boneyardBodyCollides,
  createBoneyardCollisionWorld,
  withBoneyardGateCollision,
  type BoneyardCollisionWorld,
} from '../core-server/boneyard-collision.ts'
import {
  NativeBoneyardWeather,
} from '../core-kernels/native-boneyard-weather.ts'
import { nativeSecondaryTargetMaterialTint } from '../core-kernels/native-secondary-abilities.ts'
import {
  mergeNativeLightProviderOwners,
  type NativeLightProviderRegistration,
} from '../core-kernels/native-light-provider-order.ts'
import type { GameSnapshot, LoadedBoneyard } from '../protocol/game-protocol.ts'
import {
  DEFAULT_GAME_SETTINGS,
  cameraZoomForFov,
  gameLightQuality,
  type GameSettings,
} from '../game-settings.ts'
import { playerStaffActionPose } from '../player-character-presentation.ts'
import type {
  BoneyardEnemySnapshot,
  BoneyardEnemyEventSnapshot,
  BoneyardSolomonSnapshot,
} from '../protocol/game-state.ts'
import { PlayerWorldView } from './hub-actors.ts'
import { boneyardSolomonVisualState } from './boneyard-solomon-render.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import { initialHubResolution } from './hub-render-contract.ts'
import {
  BONEYARD_CAMERA_ZOOM,
  INITIAL_BONEYARD_SPECTATOR_CAMERA_STATE,
  type BoneyardBounds,
  boneyardCamera,
  boneyardCameraFocus,
  boneyardPlayerSortBias,
  boneyardResidentIsVisible,
  boneyardSpectatorCameraState,
  boneyardSpectatorStatus,
  boneyardStaticTiles,
  boneyardVisibleWorldBounds,
  type BoneyardSpectatorCameraState,
  type BoneyardSpectatorStatusPresentation,
} from './boneyard-render-contract.ts'
import {
  destroyBoneyardWorldTextures,
  loadBoneyardWorldTextures,
  type BoneyardWorldTextures,
} from './boneyard-textures.ts'
import {
  NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX,
  NativeBoneyardLightIndex,
  NATIVE_PLAYER_LIGHT_RADIUS,
  nativeBoulderLightSource,
  nativeBoneyardLightScalar,
  nativeBoneyardLightTint,
  nativeLanternLightSource,
  nativeEnemyLightSources,
  nativeEnemyProjectileLightProvider,
  nativeMissileLightSource,
  nativePlayerLightSource,
  nativeSecondaryMiscLightSource,
  nativeSecondaryProviderLightSource,
  nativeSolomonSetPieceLighting,
  nativeWeldProjectileLightSource,
  nativeWeldMeteorLightSource,
  nativeWeldRockLightSource,
  type NativeBoneyardLightSource,
  type NativeSolomonSetPieceLighting,
} from './boneyard-lighting.ts'
import {
  BoneyardComplexShadowPresentation,
  type BoneyardComplexShadowStaticCaster,
} from './boneyard-complex-shadow-presentation.ts'
import type { NativeBoneyardComplexShadowCaster } from './boneyard-complex-shadows.ts'
import { nativeBoneyardMainLayerShadowCaster } from './boneyard-shadow-casters.ts'
import { BoneyardRegionLightField } from './boneyard-region-light-field.ts'
import {
  BoneyardTreeOcclusionPresentation,
  type NativeTreeOcclusionInput,
} from './boneyard-tree-occlusion.ts'
import { NativeEnemyViews } from './native-enemy-view.ts'
import { NativeEnemyDeathEffectViews } from './native-enemy-death-effect-view.ts'
import {
  NativeEnemyWorldFeedbackPresentation,
  nativeEnemyWorldFeedbackTransform,
} from './native-enemy-world-feedback.ts'
import { NativeEnemyProjectileViews } from './native-enemy-projectile-view.ts'
import { NativeEnemyProjectileEffectViews } from './native-enemy-projectile-effect-view.ts'
import { NativeMaggotViews } from './native-maggot-view.ts'
import { NativeGoodieViews, NativeLootViews } from './native-loot-view.ts'
import type { ModConsumableCatalogEntry } from '../core-kernels/hub-economy.ts'
import type { GameModAsset } from '../protocol/game-protocol.ts'
import {
  loadModPresentationTextures,
  type ModPresentationTextures,
} from './mod-presentation-assets.ts'
import { ModConsumableEffectViews } from './mod-consumable-effect-view.ts'
import { modConsumableEffectId as modEffectId } from './mod-consumable-effect-presentation.ts'
import {
  nativeGoodiePainterLayer,
  nativeLootPainterLayer,
} from './native-loot-presentation.ts'
import {
  NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_OFFSET,
  NativeMageLightningPulseViews,
  nativeMageLightningTargetContactDepths,
} from './native-mage-lightning-pulse-view.ts'
import {
  nativeEnemyDeathEffectPainterLayer,
} from './native-enemy-death-effect-presentation.ts'
import {
  nativeEnemyPainterLayer,
} from './native-enemy-presentation.ts'
import {
  nativeEnemyProjectileEffectPainterLayer,
} from './native-enemy-projectile-effect-presentation.ts'
import {
  buildNativeAirContactLightSource,
  buildNativeAirPathLightSources,
} from './primary-spell-air-native.ts'
import {
  etherPrimaryImpactLightSource,
} from './primary-spell-ether-native.ts'
import {
  nativeFireballLightSource,
  nativeFireGoodImpLightSource,
  nativeFireImpactLightSource,
} from './primary-spell-fire-native.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'
import {
  NativeSecondaryWorldView,
  type NativeSecondaryDiagnosticSample,
} from './native-secondary-world-view.ts'
import {
  NativeSecondaryScreenFeedbackPresentation,
  nativeSecondaryWorldShake,
} from './native-secondary-presentation.ts'
import { PlayerDeathBurstViews } from './player-death-burst-view.ts'
import { PlayerDeathWeaponViews } from './player-death-weapon-view.ts'
import {
  NATIVE_LEVEL_UP_PRESENTATION_DURATION_MS,
  nativeLevelUpPresentationFrame,
} from './level-up-presentation.ts'
import { NativeLevelUpWorldView } from './level-up-world-view.ts'
import {
  NativeWorldNameplateLayer,
  projectNativeWorldPoint,
} from './native-world-nameplate.ts'
import { NativeBoneyardWeatherView } from './native-boneyard-weather-view.ts'

interface BoneyardRendererFrameDiagnostics {
  activeStaticPainterLayerCount: number
  arenaTransitionPhase: string
  cameraFocusX: number
  cameraFocusY: number
  complexShadowActiveMeshCount: number
  complexShadowAllocatedQuadCapacity: number
  complexShadowCasterCount: number
  complexShadowPooledMeshCount: number
  complexShadowQuadCount: number
  complexShadowRecordCount: number
  complexShadowZOrderMismatchCount: number
  enemyAttackEffectCount: number
  enemyCount: number
  enemyOutsideCombatBoundsCount: number
  enemyDeathEffectCount: number
  enemyDeathEffectSamples: readonly Readonly<{
    ageTicks: number
    alpha: number
    entry: number
    id: number
    kind: string
    ownerActorId: number
    x: number
    y: number
  }>[]
  enemyFamilies: string
  fadedTreeCount: number
  enemySamples: readonly Readonly<{
    action: string | null
    currentHealth: number
    headFacingOffset: number
    hitFlash: number
    id: number
    lifeState: string
    maximumHealth: number
    x: number
    y: number
  }>[]
  enemyProjectileCount: number
  enemyProjectileEffectCount: number
  enemyProjectileEffectIds: readonly number[]
  enemyProjectileIds: readonly number[]
  frameCount: number
  foregroundZIndex: number
  gateLeafCount: number
  goodieCount: number
  cameraSubjectPlayerId: string | null
  cameraX: number
  cameraY: number
  cameraZoom: number
  cameraRenderGroup: boolean
  culledResidentCount: number
  localPlayerDeathTick: number
  localPlayerHealth: number
  localPlayerLifeState: string
  localPlayerMana: number
  localPlayerPainterRow: number
  localPlayerZIndex: number
  lanternLightIntensity: number
  levelUpParticleCount: number
  lightMiscTailCandidateCount: number
  lightActiveBucketCount: number
  lightAllocatedBucketCount: number
  lightIndexedSourceReferenceCount: number
  lightProviderCandidateCount: number
  lightSourceCount: number
  mainAboveLocal: boolean
  mainBelowLocal: boolean
  maxDynamicZIndex: number
  maxMainLightScalar: number
  maxMainZIndex: number
  maggotCount: number
  lootCount: number
  modEffectCount: number
  mageLightningCount: number
  minMainLightScalar: number
  minTreeAlpha: number
  minTreeLightScalar: number
  painterBandCount: number
  playerAttachmentPose: number
  playerCount: number
  playerDeathColorLayerCount: number
  playerDeathFrame: number | null
  playerDeathFrameSamples: readonly Readonly<{
    colorLayerCount: number
    deathTick: number
    frame: number
    shadowLayerCount: number
  }>[]
  playerDeathShadowLayerCount: number
  playerDeathBurstCount: number
  playerDeathWeaponCount: number
  playerLightRadius: number
  playerLightRasterRadius: number
  playerMagicShieldScale: number
  playerMagicShieldVisible: boolean
  playerMaterialTint: number
  playerSamples: readonly Readonly<{
    displayName: string
    id: string
    lifeState: string
    x: number
    y: number
  }>[]
  primarySpellCount: number
  primarySpellKinds: readonly string[]
  playerScreenX: number
  playerScreenY: number
  playerWalkPose: number
  playerX: number
  playerY: number
  solomonFrame: number
  staticLayerCount: number
  staticPaintCount: number
  tick: number
  treeAlphaMismatchCount: number
  treeCount: number
  treeForegroundResidentCount: number
  treeTintMismatchCount: number
  residentCount: number
  regionLightCompositeZIndex: number
  regionLightLogicalSide: number
  regionLightPhysicalSide: number
  runGameOverExitTicks: number | null
  secondaryAbilityCount: number
  secondaryAbilityKinds: readonly string[]
  secondaryAbilityPrimitiveCount: number
  secondaryAbilitySamples: readonly NativeSecondaryDiagnosticSample[]
  secondaryScreenFlashAlpha: number
  secondaryScreenFlashColor: number
  runGameOverTicks: number
  runId: string | null
  runPhase: string
  spectatorTargetPlayerId: string | null
  visibleMainLayerCount: number
  visibleOversizedResidentCount: number
  visibleResidentCount: number
  weatherDropCount: number
  weatherMode: number
  weatherSplashCount: number
  worldFeedbackMagnitude: number
  worldShakeX: number
  worldShakeY: number
}

export interface BoneyardWorldRenderer {
  readonly canvas: HTMLCanvasElement
  camera(snapshot: GameSnapshot): Camera
  consumeEnemyEvent(event: BoneyardEnemyEventSnapshot): void
  cycleSpectatorTarget(snapshot: GameSnapshot): boolean
  destroy(): void
  render(snapshot: GameSnapshot): void
  resize(viewport: GameViewportLayout, devicePixelRatio?: number): void
  setLevelUpPresentation(presentationId: number | null): void
  setSettings(settings: BoneyardWorldPresentationSettings): void
  spectatorStatus(snapshot: GameSnapshot): BoneyardSpectatorStatusPresentation | null
}

export type BoneyardWorldPresentationSettings = Pick<
  GameSettings,
  | 'cameraFovPercent'
  | 'complexLighting'
  | 'complexShadows'
  | 'lightQualityPercent'
  | 'multipleShadows'
  | 'zoomEffects'
>

interface BoneyardWorldRendererOptions {
  boneyard: LoadedBoneyard
  devicePixelRatio?: number
  initialSnapshot: GameSnapshot
  modAssets: readonly GameModAsset[]
  modCatalog: readonly ModConsumableCatalogEntry[]
  now?: () => number
  playerId: string
  settings?: BoneyardWorldPresentationSettings
  viewport: GameViewportLayout
}

interface ResidentTexture extends BoneyardBounds {
  mainLayerIndex: number | null
  shadowCaster: NativeBoneyardComplexShadowCaster | null
  sprite: Sprite
  texture: Texture
}

interface TreeResidents {
  foreground: ResidentTexture
  main: ResidentTexture
}

interface StaticWorldBuild {
  foreground: Container
  mainResidents: ReadonlyMap<number, ResidentTexture>
  residents: ResidentTexture[]
  shadowCasters: readonly BoneyardComplexShadowStaticCaster[]
  staticPaintCount: number
  treeInputs: readonly NativeTreeOcclusionInput[]
  treeResidents: ReadonlyMap<string, TreeResidents>
}

class BoneyardResidentVisibility {
  private readonly residents: readonly ResidentTexture[]
  readonly visibleMainResidents: ResidentTexture[] = []
  culledResidentCount = 0
  visibleOversizedResidentCount = 0
  visibleResidentCount = 0

  constructor(residents: readonly ResidentTexture[]) {
    this.residents = residents
  }

  update(camera: Camera, viewport: GameViewportLayout): void {
    const view = boneyardVisibleWorldBounds(camera, viewport)
    this.culledResidentCount = 0
    this.visibleMainResidents.length = 0
    this.visibleOversizedResidentCount = 0
    this.visibleResidentCount = 0
    for (const resident of this.residents) {
      const visible = boneyardResidentIsVisible(resident, view)
      resident.sprite.renderable = visible
      if (!visible) {
        this.culledResidentCount += 1
        continue
      }
      this.visibleResidentCount += 1
      if (resident.w > view.w || resident.h > view.h) {
        this.visibleOversizedResidentCount += 1
      }
      if (resident.mainLayerIndex !== null) this.visibleMainResidents.push(resident)
    }
  }
}

function drawSecondaryScreenFlash(
  graphic: Graphics,
  viewport: GameViewportLayout,
): void {
  graphic.clear()
    .rect(0, 0, viewport.width, viewport.height)
    .fill({ color: 0xffffff })
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
  let cameraZoom = cameraZoomForFov(BONEYARD_CAMERA_ZOOM, settings.cameraFovPercent)
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
  } catch (error) {
    if (application.renderer) application.destroy({ removeView: true })
    destroyBoneyardWorldTextures(textures)
    modTextures.destroy()
    throw error
  }
  application.stop()

  const document = editorDocument(options.boneyard)
  const world = new Container({ isRenderGroup: true, label: 'boneyard-world' })
  world.sortableChildren = true
  application.stage.addChild(world)
  const worldNameplates = new NativeWorldNameplateLayer(textures.fontAtlas)
  application.stage.addChild(worldNameplates.container)

  let staticWorld: StaticWorldBuild | null = null
  try {
    staticWorld = await buildStaticWorld(document, world)
  } catch (error) {
    application.stage.removeChild(world, worldNameplates.container)
    worldNameplates.destroy()
    world.destroy({ children: true })
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
    staticWorld.foreground,
    staticWorld.shadowCasters,
    staticWorld.treeInputs,
    staticWorld.treeResidents,
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
  const secondaryScreenFlash = new Graphics({ label: 'native-secondary-screen-flash' })
  secondaryScreenFlash.eventMode = 'none'
  secondaryScreenFlash.visible = false
  drawSecondaryScreenFlash(secondaryScreenFlash, viewport)
  application.stage.addChild(secondaryScreenFlash)
  const visibility = new BoneyardResidentVisibility(staticWorld.residents)
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
  const canvas = application.canvas as HTMLCanvasElement
  canvas.className = 'boneyard-world-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.gameRenderer = 'pixi-webgl'
  canvas.dataset.complexShadows = 'native-indexed-owner-mesh'
  canvas.dataset.treeComplexShadowOutline = 'native-main-variant-table'
  canvas.dataset.rendererName = application.renderer.name
  canvas.dataset.resolution = `${initialResolution}`
  canvas.dataset.regionLightComposite = 'multiply-pre-main'
  canvas.dataset.regionLightEntry = 'DeadHawg:18'
  canvas.dataset.regionLighting = 'native-region-field+object-scalar'
  canvas.dataset.staticCulling = 'exact-world-bounds'
  canvas.dataset.staticPaintCount = `${staticWorld.staticPaintCount}`
  canvas.dataset.weatherSplashAsset = 'DeadHawg:24'
  canvas.dataset.weatherStreakRenderer = 'pixi-particle-batch'
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  canvas.dataset.viewportHeight = `${viewport.height}`
  canvas.dataset.viewportWidth = `${viewport.width}`

  let destroyed = false
  let frameCount = 0
  let armedLevelUpPresentationId: number | null = null
  let lastLevelUpPresentationId: number | null = null
  let levelUpPresentationStartedAt: number | null = null
  let resolution = initialResolution
  let spectatorCamera: BoneyardSpectatorCameraState =
    INITIAL_BONEYARD_SPECTATOR_CAMERA_STATE
  const frameDiagnostics: BoneyardRendererFrameDiagnostics = {
    activeStaticPainterLayerCount: 0,
    arenaTransitionPhase: 'none',
    cameraFocusX: Number.NaN,
    cameraFocusY: Number.NaN,
    complexShadowActiveMeshCount: 0,
    complexShadowAllocatedQuadCapacity: 0,
    complexShadowCasterCount: 0,
    complexShadowPooledMeshCount: 0,
    complexShadowQuadCount: 0,
    complexShadowRecordCount: 0,
    complexShadowZOrderMismatchCount: 0,
    enemyAttackEffectCount: 0,
    enemyCount: 0,
    enemyOutsideCombatBoundsCount: 0,
    enemyDeathEffectCount: 0,
    enemyDeathEffectSamples: [],
    enemyFamilies: '',
    fadedTreeCount: 0,
    enemySamples: [],
    enemyProjectileCount: 0,
    enemyProjectileEffectCount: 0,
    enemyProjectileEffectIds: [],
    enemyProjectileIds: [],
    frameCount: 0,
    foregroundZIndex: 0,
    gateLeafCount: 0,
    goodieCount: 0,
    cameraSubjectPlayerId: null,
    cameraX: Number.NaN,
    cameraY: Number.NaN,
    cameraZoom: Number.NaN,
    cameraRenderGroup: world.isRenderGroup,
    culledResidentCount: 0,
    localPlayerDeathTick: 0,
    localPlayerHealth: 0,
    localPlayerLifeState: 'alive',
    localPlayerMana: 0,
    localPlayerPainterRow: 0,
    localPlayerZIndex: 0,
    lanternLightIntensity: 0,
    levelUpParticleCount: 0,
    lightMiscTailCandidateCount: 0,
    lightActiveBucketCount: 0,
    lightAllocatedBucketCount: 0,
    lightIndexedSourceReferenceCount: 0,
    lightProviderCandidateCount: 0,
    lightSourceCount: 0,
    mainAboveLocal: false,
    mainBelowLocal: false,
    maxDynamicZIndex: 0,
    maxMainLightScalar: 0,
    maxMainZIndex: 0,
    maggotCount: 0,
    lootCount: 0,
    modEffectCount: 0,
    mageLightningCount: 0,
    minMainLightScalar: 0,
    minTreeAlpha: 1,
    minTreeLightScalar: 0,
    painterBandCount: 0,
    playerAttachmentPose: 0,
    playerCount: 0,
    playerDeathColorLayerCount: 0,
    playerDeathFrame: null,
    playerDeathFrameSamples: [],
    playerDeathShadowLayerCount: 0,
    playerDeathBurstCount: 0,
    playerDeathWeaponCount: 0,
    playerLightRadius: 0,
    playerLightRasterRadius: 0,
    playerMagicShieldScale: 1.5,
    playerMagicShieldVisible: false,
    playerMaterialTint: 0xffffff,
    playerSamples: [],
    primarySpellCount: 0,
    primarySpellKinds: [],
    playerScreenX: Number.NaN,
    playerScreenY: Number.NaN,
    playerWalkPose: 0,
    playerX: Number.NaN,
    playerY: Number.NaN,
    solomonFrame: 0,
    staticLayerCount: mainLayers.length,
    staticPaintCount: staticWorld.staticPaintCount,
    tick: options.initialSnapshot.tick,
    treeAlphaMismatchCount: 0,
    treeCount: staticWorld.treeInputs.length,
    treeForegroundResidentCount: staticWorld.treeResidents.size,
    treeTintMismatchCount: 0,
    residentCount: staticWorld.residents.length,
    regionLightCompositeZIndex: NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX,
    regionLightLogicalSide: regionLightField.targetLogicalSide,
    regionLightPhysicalSide: regionLightField.targetPhysicalSide,
    runGameOverExitTicks: null,
    secondaryAbilityCount: 0,
    secondaryAbilityKinds: [],
    secondaryAbilityPrimitiveCount: 0,
    secondaryAbilitySamples: [],
    secondaryScreenFlashAlpha: 0,
    secondaryScreenFlashColor: 0xffffff,
    runGameOverTicks: 0,
    runId: options.initialSnapshot.run.runId,
    runPhase: options.initialSnapshot.run.phase,
    spectatorTargetPlayerId: null,
    visibleMainLayerCount: 0,
    visibleOversizedResidentCount: 0,
    visibleResidentCount: 0,
    weatherDropCount: 0,
    weatherMode: options.boneyard.scene.environmentMode,
    weatherSplashCount: 0,
    worldFeedbackMagnitude: 0,
    worldShakeX: 0,
    worldShakeY: 0,
  }
  Object.defineProperty(canvas, '__sdrBoneyardFrame', {
    configurable: false,
    enumerable: false,
    value: frameDiagnostics,
    writable: false,
  })

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
    return boneyardCamera(
      focus.position,
      snapshot.world.arenaTransition?.cameraBounds ?? options.boneyard.scene.bounds,
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
      requireBoneyardSnapshot(snapshot, options.boneyard.runId)
      const player = snapshot.players[options.playerId]
      if (!player) return
      frameCount += 1
      const cameraFocus = cameraFocusFor(snapshot)
      const camera = boneyardCamera(
        cameraFocus.position,
        snapshot.world.arenaTransition?.cameraBounds ?? options.boneyard.scene.bounds,
        viewport,
        cameraZoom,
      )
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
      const painter = scene.update(
        snapshot,
        options.playerId,
        frameCount,
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
      regionLightField.setCompositeZIndex(settings.complexLighting
        ? NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX
        : painter.foregroundZIndex - 0.25)
      regionLightField.render(
        application.renderer,
        scene.currentLightSources,
        camera,
      )
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
      const sampledWorldShake = nativeSecondaryWorldShake(
        snapshot.secondaryAbilities.actors,
        `boneyard:${snapshot.world.runId}`,
      )
      const sampledSecondaryCameraMagnitude = secondaryScreenFeedback.sampleCameraMagnitude(
        snapshot.tick,
      )
      const sampledSecondaryCameraDisplacement = secondaryScreenFeedback.sampleCameraDisplacement(
        snapshot.tick,
      )
      const feedbackMagnitude = settings.zoomEffects ? sampledFeedback.magnitude : 0
      const worldShake = settings.zoomEffects
        ? sampledWorldShake
        : { magnitude: 0, x: 0, y: 0 }
      const secondaryCameraMagnitude = settings.zoomEffects
        ? sampledSecondaryCameraMagnitude
        : 0
      const secondaryCameraDisplacement = settings.zoomEffects
        ? sampledSecondaryCameraDisplacement
        : { x: 0, y: 0 }
      const worldTransform = nativeEnemyWorldFeedbackTransform(
        camera,
        viewport,
        player.position,
        Math.max(feedbackMagnitude, worldShake.magnitude, secondaryCameraMagnitude),
      )
      world.scale.set(worldTransform.scale)
      world.position.set(
        worldTransform.position.x + worldShake.x + secondaryCameraDisplacement.x,
        worldTransform.position.y + worldShake.y + secondaryCameraDisplacement.y,
      )
      worldNameplates.update(
        snapshot.players,
        options.playerId,
        (point) => projectNativeWorldPoint(
          point,
          {
            position: {
              x: worldTransform.position.x + worldShake.x,
              y: worldTransform.position.y + worldShake.y,
            },
            scale: worldTransform.scale,
          },
          viewport,
        ),
        { renderable: true },
      )
      const screenOverlay = secondaryScreenFeedback.sample(snapshot.tick)
      secondaryScreenFlash.alpha = screenOverlay?.alpha ?? 0
      secondaryScreenFlash.tint = screenOverlay?.color ?? 0xffffff
      secondaryScreenFlash.visible = screenOverlay !== null
      application.render()

      frameDiagnostics.cameraFocusX = cameraFocus.position.x
      frameDiagnostics.cameraFocusY = cameraFocus.position.y
      frameDiagnostics.cameraSubjectPlayerId = cameraFocus.playerId
      frameDiagnostics.cameraX = camera.x
      frameDiagnostics.cameraY = camera.y
      frameDiagnostics.cameraZoom = camera.zoom
      frameDiagnostics.frameCount = frameCount
      frameDiagnostics.activeStaticPainterLayerCount = painter.activeStaticPainterLayerCount
      frameDiagnostics.arenaTransitionPhase = snapshot.world.arenaTransition?.phase ?? 'none'
      frameDiagnostics.complexShadowActiveMeshCount = painter.complexShadowActiveMeshCount
      frameDiagnostics.complexShadowAllocatedQuadCapacity = painter.complexShadowAllocatedQuadCapacity
      frameDiagnostics.complexShadowCasterCount = painter.complexShadowCasterCount
      frameDiagnostics.complexShadowPooledMeshCount = painter.complexShadowPooledMeshCount
      frameDiagnostics.complexShadowQuadCount = painter.complexShadowQuadCount
      frameDiagnostics.complexShadowRecordCount = painter.complexShadowRecordCount
      frameDiagnostics.complexShadowZOrderMismatchCount = painter.complexShadowZOrderMismatchCount
      frameDiagnostics.enemyAttackEffectCount = scene.enemyAttackEffectCount
      frameDiagnostics.enemyCount = scene.enemyCount
      const combatBounds = snapshot.world.arenaTransition?.combatBounds
      frameDiagnostics.enemyOutsideCombatBoundsCount = combatBounds === undefined
        ? 0
        : snapshot.world.enemies.filter(({ position }) => (
            position.x < combatBounds.x
            || position.y < combatBounds.y
            || position.x > combatBounds.x + combatBounds.w
            || position.y > combatBounds.y + combatBounds.h
          )).length
      frameDiagnostics.enemyDeathEffectCount = scene.enemyDeathEffectCount
      frameDiagnostics.enemyDeathEffectSamples = snapshot.world.deathEffects.map((effect) => ({
        ageTicks: effect.ageTicks,
        alpha: effect.alpha,
        entry: effect.entry,
        id: effect.id,
        kind: effect.kind,
        ownerActorId: effect.ownerActorId,
        x: effect.position.x,
        y: effect.position.y + effect.height,
      }))
      frameDiagnostics.enemyFamilies = scene.enemyFamilies
      frameDiagnostics.fadedTreeCount = painter.fadedTreeCount
      frameDiagnostics.enemySamples = snapshot.world.enemies.map((enemy) => ({
        action: enemy.animation.action,
        currentHealth: enemy.currentHealth,
        headFacingOffset: enemy.animation.headFacingOffset,
        hitFlash: enemy.animation.hitFlash,
        id: enemy.id,
        lifeState: enemy.animation.state,
        maximumHealth: enemy.maximumHealth,
        x: enemy.position.x,
        y: enemy.position.y,
      }))
      frameDiagnostics.enemyProjectileCount = scene.enemyProjectileCount
      frameDiagnostics.enemyProjectileEffectCount = scene.enemyProjectileEffectCount
      frameDiagnostics.enemyProjectileEffectIds = scene.enemyProjectileEffectIds
      frameDiagnostics.enemyProjectileIds = scene.enemyProjectileIds
      frameDiagnostics.foregroundZIndex = painter.foregroundZIndex
      frameDiagnostics.gateLeafCount = snapshot.world.gateLeaves.length
      frameDiagnostics.goodieCount = scene.goodieCount
      frameDiagnostics.culledResidentCount = visibility.culledResidentCount
      frameDiagnostics.localPlayerDeathTick = player.progression.deathTick
      frameDiagnostics.localPlayerHealth = player.progression.currentHealth
      frameDiagnostics.localPlayerLifeState = player.progression.lifeState
      frameDiagnostics.localPlayerMana = player.progression.currentMana
      frameDiagnostics.localPlayerPainterRow = painter.localPlayerPainterRow
      frameDiagnostics.localPlayerZIndex = painter.localPlayerZIndex
      frameDiagnostics.lanternLightIntensity = painter.lanternLightIntensity
      frameDiagnostics.levelUpParticleCount = scene.levelUpParticleCount
      frameDiagnostics.lightMiscTailCandidateCount = painter.lightMiscTailCandidateCount
      frameDiagnostics.lightActiveBucketCount = painter.lightActiveBucketCount
      frameDiagnostics.lightAllocatedBucketCount = painter.lightAllocatedBucketCount
      frameDiagnostics.lightIndexedSourceReferenceCount = painter.lightIndexedSourceReferenceCount
      frameDiagnostics.lightProviderCandidateCount = painter.lightProviderCandidateCount
      frameDiagnostics.lightSourceCount = painter.lightSourceCount
      frameDiagnostics.mainAboveLocal = painter.mainAboveLocal
      frameDiagnostics.mainBelowLocal = painter.mainBelowLocal
      frameDiagnostics.maxDynamicZIndex = painter.maxDynamicZIndex
      frameDiagnostics.maxMainLightScalar = painter.maxMainLightScalar
      frameDiagnostics.maxMainZIndex = painter.maxMainZIndex
      frameDiagnostics.maggotCount = scene.maggotCount
      frameDiagnostics.lootCount = scene.lootCount
      frameDiagnostics.modEffectCount = scene.modEffectCount
      frameDiagnostics.mageLightningCount = scene.mageLightningCount
      frameDiagnostics.minMainLightScalar = painter.minMainLightScalar
      frameDiagnostics.minTreeAlpha = painter.minTreeAlpha
      frameDiagnostics.minTreeLightScalar = painter.minTreeLightScalar
      frameDiagnostics.painterBandCount = painter.painterBandCount
      frameDiagnostics.playerCount = scene.playerCount
      frameDiagnostics.playerDeathBurstCount = scene.playerDeathBurstCount
      frameDiagnostics.playerDeathWeaponCount = scene.playerDeathWeaponCount
      frameDiagnostics.playerLightRadius = painter.playerLightRadius
      frameDiagnostics.playerLightRasterRadius = painter.playerLightRasterRadius
      frameDiagnostics.playerSamples = Object.entries(snapshot.players).map(([id, sample]) => ({
        displayName: sample.config.displayName,
        id,
        lifeState: sample.progression.lifeState,
        x: sample.position.x,
        y: sample.position.y,
      }))
      frameDiagnostics.primarySpellCount = scene.primarySpellCount
      frameDiagnostics.primarySpellKinds = scene.primarySpellKinds
      frameDiagnostics.playerScreenX = (player.position.x - camera.x) * camera.zoom
        + viewport.width / 2
      frameDiagnostics.playerScreenY = (player.position.y - camera.y) * camera.zoom
        + viewport.height / 2
      frameDiagnostics.playerWalkPose = scene.playerWalkPose(options.playerId)
      const playerView = scene.player(options.playerId)
      frameDiagnostics.playerAttachmentPose = playerView?.attachmentPose ?? 0
      const deathFrame = playerView?.deathFrame ?? null
      frameDiagnostics.playerDeathColorLayerCount = playerView?.deathColorLayerCount ?? 0
      frameDiagnostics.playerDeathFrame = deathFrame
      frameDiagnostics.playerDeathShadowLayerCount = playerView?.deathShadowLayerCount ?? 0
      if (
        deathFrame !== null
        && frameDiagnostics.playerDeathFrameSamples.at(-1)?.frame !== deathFrame
      ) {
        frameDiagnostics.playerDeathFrameSamples = [
          ...frameDiagnostics.playerDeathFrameSamples,
          {
            colorLayerCount: playerView?.deathColorLayerCount ?? 0,
            deathTick: player.progression.deathTick,
            frame: deathFrame,
            shadowLayerCount: playerView?.deathShadowLayerCount ?? 0,
          },
        ]
      }
      frameDiagnostics.playerMagicShieldScale = playerView?.magicShieldScale ?? 1.5
      frameDiagnostics.playerMagicShieldVisible = playerView?.magicShieldVisible ?? false
      frameDiagnostics.playerMaterialTint = playerView?.materialTint ?? 0xffffff
      frameDiagnostics.playerX = player.position.x
      frameDiagnostics.playerY = player.position.y
      frameDiagnostics.runGameOverExitTicks = snapshot.run.gameOverExitTicks
      frameDiagnostics.runGameOverTicks = snapshot.run.gameOverTicks
      frameDiagnostics.runId = snapshot.run.runId
      frameDiagnostics.runPhase = snapshot.run.phase
      frameDiagnostics.spectatorTargetPlayerId = spectatorCamera.targetPlayerId
      frameDiagnostics.solomonFrame = scene.solomonFrame
      frameDiagnostics.tick = snapshot.tick
      frameDiagnostics.treeAlphaMismatchCount = painter.treeAlphaMismatchCount
      frameDiagnostics.treeCount = painter.treeCount
      frameDiagnostics.treeForegroundResidentCount = painter.treeForegroundResidentCount
      frameDiagnostics.treeTintMismatchCount = painter.treeTintMismatchCount
      frameDiagnostics.visibleMainLayerCount = visibility.visibleMainResidents.length
      frameDiagnostics.visibleOversizedResidentCount = visibility.visibleOversizedResidentCount
      frameDiagnostics.visibleResidentCount = visibility.visibleResidentCount
      frameDiagnostics.weatherDropCount = scene.weatherDropCount
      frameDiagnostics.weatherMode = scene.weatherMode
      frameDiagnostics.weatherSplashCount = scene.weatherSplashCount
      frameDiagnostics.worldFeedbackMagnitude = feedbackMagnitude
      frameDiagnostics.regionLightLogicalSide = regionLightField.targetLogicalSide
      frameDiagnostics.regionLightPhysicalSide = regionLightField.targetPhysicalSide
      frameDiagnostics.worldShakeX = worldShake.x
      frameDiagnostics.worldShakeY = worldShake.y
      frameDiagnostics.secondaryAbilityCount = scene.secondaryAbilityCount
      frameDiagnostics.secondaryAbilityKinds = scene.secondaryAbilityKinds
      frameDiagnostics.secondaryAbilityPrimitiveCount = scene.secondaryAbilityPrimitiveCount
      frameDiagnostics.secondaryAbilitySamples = scene.secondaryAbilitySamples
      frameDiagnostics.secondaryScreenFlashAlpha = screenOverlay?.alpha ?? 0
      frameDiagnostics.secondaryScreenFlashColor = screenOverlay?.color ?? 0xffffff
      canvas.dataset.enemyCount = `${scene.enemyCount}`
      canvas.dataset.enemyAttackEffectCount = `${scene.enemyAttackEffectCount}`
      canvas.dataset.enemyDeathEffectCount = `${scene.enemyDeathEffectCount}`
      canvas.dataset.complexShadowCasterCount = `${painter.complexShadowCasterCount}`
      canvas.dataset.complexShadowQuadCount = `${painter.complexShadowQuadCount}`
      canvas.dataset.complexShadowRecordCount = `${painter.complexShadowRecordCount}`
      canvas.dataset.enemyFamilies = scene.enemyFamilies
      canvas.dataset.fadedTreeCount = `${painter.fadedTreeCount}`
      canvas.dataset.minTreeAlpha = `${painter.minTreeAlpha}`
      canvas.dataset.minTreeLightScalar = `${painter.minTreeLightScalar}`
      canvas.dataset.enemyProjectileCount = `${scene.enemyProjectileCount}`
      canvas.dataset.maggotCount = `${scene.maggotCount}`
      canvas.dataset.lootCount = `${scene.lootCount}`
      canvas.dataset.modEffectCount = `${scene.modEffectCount}`
      canvas.dataset.goodieCount = `${scene.goodieCount}`
      canvas.dataset.mageLightningCount = `${scene.mageLightningCount}`
      canvas.dataset.playerDeathBurstCount = `${scene.playerDeathBurstCount}`
      canvas.dataset.worldFeedbackMagnitude = `${feedbackMagnitude}`
      canvas.dataset.secondaryCameraMagnitude = `${secondaryCameraMagnitude}`
      canvas.dataset.worldShakeX = `${worldShake.x}`
      canvas.dataset.worldShakeY = `${worldShake.y}`
      canvas.dataset.secondaryScreenFlashAlpha = `${screenOverlay?.alpha ?? 0}`
      canvas.dataset.weatherDropCount = `${scene.weatherDropCount}`
      canvas.dataset.weatherMode = `${scene.weatherMode}`
      canvas.dataset.weatherSplashCount = `${scene.weatherSplashCount}`
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
      regionLightField.resize(viewport, resolution)
      drawSecondaryScreenFlash(secondaryScreenFlash, viewport)
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
      lightQuality = gameLightQuality(settings)
      regionLightField.setQuality(lightQuality, viewport, resolution)
      canvas.dataset.cameraZoom = `${cameraZoom}`
      canvas.dataset.complexLighting = `${settings.complexLighting}`
      canvas.dataset.complexShadowsEnabled = `${settings.complexShadows}`
      canvas.dataset.lightQuality = `${lightQuality}`
      canvas.dataset.multipleShadows = `${settings.multipleShadows}`
      canvas.dataset.zoomEffects = `${settings.zoomEffects}`
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      spectatorCamera = INITIAL_BONEYARD_SPECTATOR_CAMERA_STATE
      application.stage.removeChild(world, worldNameplates.container)
      worldNameplates.destroy()
      application.stage.removeChild(secondaryScreenFlash)
      scene.destroy()
      regionLightField.destroy()
      secondaryScreenFlash.destroy()
      for (const resident of staticWorld?.residents ?? []) resident.texture.destroy(true)
      staticWorld = null
      world.destroy({ children: true })
      destroyBoneyardWorldTextures(textures)
      modTextures.destroy()
      application.destroy({ removeView: true })
      canvas.remove()
    },
    spectatorStatus(snapshot) {
      if (destroyed) return null
      cameraFocusFor(snapshot)
      return boneyardSpectatorStatus(snapshot, options.playerId, spectatorCamera)
    },
  }

  renderer.setSettings(options.settings ?? DEFAULT_GAME_SETTINGS)
  renderer.render(options.initialSnapshot)
  return renderer
}

interface BoneyardPainterFrame {
  activeStaticPainterLayerCount: number
  complexShadowActiveMeshCount: number
  complexShadowAllocatedQuadCapacity: number
  complexShadowCasterCount: number
  complexShadowPooledMeshCount: number
  complexShadowQuadCount: number
  complexShadowRecordCount: number
  complexShadowZOrderMismatchCount: number
  fadedTreeCount: number
  foregroundZIndex: number
  localPlayerPainterRow: number
  localPlayerZIndex: number
  lanternLightIntensity: number
  lightMiscTailCandidateCount: number
  lightActiveBucketCount: number
  lightAllocatedBucketCount: number
  lightIndexedSourceReferenceCount: number
  lightProviderCandidateCount: number
  lightSourceCount: number
  mainAboveLocal: boolean
  mainBelowLocal: boolean
  maxDynamicZIndex: number
  maxMainLightScalar: number
  maxMainZIndex: number
  minMainLightScalar: number
  minTreeAlpha: number
  minTreeLightScalar: number
  painterBandCount: number
  playerLightRadius: number
  playerLightRasterRadius: number
  treeAlphaMismatchCount: number
  treeCount: number
  treeForegroundResidentCount: number
  treeTintMismatchCount: number
}

interface RegisteredBoneyardLightProviderOwner {
  registration: NativeLightProviderRegistration
  sources: readonly NativeBoneyardLightSource[]
}

interface RegisteredBoneyardMiscLightBatch extends RegisteredBoneyardLightProviderOwner {
  birthTick: number
  id: number
  miscLightAppendOrdinal: number
}

class BoneyardDynamicScene {
  private readonly activeStaticPainterLayers: StaticPainterLayer[] = []
  private readonly boneyard: LoadedBoneyard
  private readonly complexShadows: BoneyardComplexShadowPresentation
  private readonly collisionWorld: BoneyardCollisionWorld
  private readonly dynamicLayers: DynamicPainterLayer[] = []
  private readonly enemies: NativeEnemyViews
  private readonly enemyDeathEffects: NativeEnemyDeathEffectViews
  private readonly enemyProjectileEffects: NativeEnemyProjectileEffectViews
  private readonly enemyProjectiles: NativeEnemyProjectileViews
  private readonly foreground: Container
  private readonly gateLeaves = new Map<string, BoneyardGateLeafSnapshot>()
  private readonly gateShadowDepthOwners = new Map<string, ContainerChild>()
  private readonly gates: BoneyardGateViews
  private readonly goodies: NativeGoodieViews
  private readonly lightMiscBatches: RegisteredBoneyardMiscLightBatch[] = []
  private readonly lightProviderOwners: RegisteredBoneyardLightProviderOwner[] = []
  private readonly lightSourceCandidates: NativeBoneyardLightSource[] = []
  private readonly lightMiscTailCandidates: NativeBoneyardLightSource[] = []
  private readonly lightIndex: NativeBoneyardLightIndex
  private readonly levelUp: NativeLevelUpWorldView
  private readonly livePlayerIds = new Set<string>()
  private readonly mainLayers: readonly MainLayer[]
  private readonly mainResidents: ReadonlyMap<number, ResidentTexture>
  private readonly movingGatePainterLayers: readonly StaticPainterLayer[]
  private readonly players = new Map<string, PlayerWorldView>()
  private readonly playerDeathBursts: PlayerDeathBurstViews
  private readonly playerDeathWeapons: PlayerDeathWeaponViews
  private readonly maggots: NativeMaggotViews
  private readonly loot: NativeLootViews
  private readonly modEffects: ModConsumableEffectViews
  private readonly mageLightningPulses: NativeMageLightningPulseViews
  private readonly primarySpells: PrimarySpellWorldView
  private readonly secondaryAbilities: NativeSecondaryWorldView
  private readonly positionedDynamics = new Map<string, { row: number; zIndex: number }>()
  private readonly root: Container
  private readonly solomon: BoneyardSolomonView | null
  private readonly staticPainterLayers: StaticPainterLayer[]
  private readonly textures: BoneyardWorldTextures
  private readonly treeOcclusion: BoneyardTreeOcclusionPresentation
  private readonly treeResidents: ReadonlyMap<string, TreeResidents>
  private readonly visibleShadowDepthOwners: ContainerChild[] = []
  private readonly weather: NativeBoneyardWeather
  private readonly weatherView: NativeBoneyardWeatherView
  private visibleEnemyFamilies = ''

  constructor(
    boneyard: LoadedBoneyard,
    root: Container,
    renderer: Application['renderer'],
    textures: BoneyardWorldTextures,
    mainLayers: readonly MainLayer[],
    mainResidents: ReadonlyMap<number, ResidentTexture>,
    foreground: Container,
    shadowCasters: readonly BoneyardComplexShadowStaticCaster[],
    treeInputs: readonly NativeTreeOcclusionInput[],
    treeResidents: ReadonlyMap<string, TreeResidents>,
    initialSnapshot: GameSnapshot,
    modTextures: ModPresentationTextures,
    modCatalog: readonly ModConsumableCatalogEntry[],
  ) {
    this.boneyard = boneyard
    this.collisionWorld = createBoneyardCollisionWorld(boneyard.scene)
    this.lightIndex = new NativeBoneyardLightIndex({
      height: boneyard.scene.bounds.h,
      width: boneyard.scene.bounds.w,
    })
    this.root = root
    this.textures = textures
    this.mainLayers = mainLayers
    this.mainResidents = mainResidents
    this.foreground = foreground
    this.complexShadows = new BoneyardComplexShadowPresentation(root, shadowCasters)
    this.treeOcclusion = new BoneyardTreeOcclusionPresentation(
      treeInputs,
      initialSnapshot.tick,
    )
    this.treeResidents = treeResidents
    this.primarySpells = new PrimarySpellWorldView(root, textures)
    this.secondaryAbilities = new NativeSecondaryWorldView(root, textures, renderer)
    this.staticPainterLayers = mainLayers.map((layer, layerIndex) => ({
      layerIndex,
      worldY: layer.worldY,
      sortBias: layer.sortBias,
      sourceOrder: layer.sourceOrder,
    }))
    this.movingGatePainterLayers = this.staticPainterLayers.filter((layer) => (
      isMovingGateBody(this.mainLayers[layer.layerIndex])
    ))
    this.gates = new BoneyardGateViews(root, textures)
    this.goodies = new NativeGoodieViews(root, textures)
    this.enemies = new NativeEnemyViews(root, textures)
    this.enemyDeathEffects = new NativeEnemyDeathEffectViews(root, textures)
    this.enemyProjectileEffects = new NativeEnemyProjectileEffectViews(root, textures)
    this.enemyProjectiles = new NativeEnemyProjectileViews(root, textures)
    this.maggots = new NativeMaggotViews(root, textures)
    this.loot = new NativeLootViews(root, textures, modTextures, modCatalog)
    this.modEffects = new ModConsumableEffectViews(root, textures)
    this.mageLightningPulses = new NativeMageLightningPulseViews(
      root,
      textures.primarySpells.air,
    )
    this.playerDeathBursts = new PlayerDeathBurstViews(root, textures, initialSnapshot)
    this.playerDeathWeapons = new PlayerDeathWeaponViews(root, textures, initialSnapshot)
    this.levelUp = new NativeLevelUpWorldView(textures.levelUpSparkle)
    root.addChild(this.levelUp.container)
    this.weather = new NativeBoneyardWeather({
      enhancedEffects: true,
      initialTick: initialSnapshot.tick,
      mode: boneyard.scene.environmentMode,
    })
    this.weatherView = new NativeBoneyardWeatherView(
      root,
      textures.weatherSplash,
      this.weather,
    )
    this.solomon = boneyard.scene.solomonDig
      ? new BoneyardSolomonView(boneyard, root, textures)
      : null
  }

  consumeEnemyEvent(event: BoneyardEnemyEventSnapshot): void {
    this.enemies.consumeEvent(event)
  }

  update(
    snapshot: GameSnapshot,
    localPlayerId: string,
    presentationFrame: number,
    visibleMainResidents: readonly ResidentTexture[],
    levelUpPresentation: {
      elapsedMs: number
      playerScreenY: number
      presentationId: number
    } | null,
    camera: Camera,
    viewport: GameViewportLayout,
    settings: BoneyardWorldPresentationSettings,
  ): BoneyardPainterFrame {
    requireBoneyardSnapshot(snapshot, this.boneyard.runId)
    const enemySnapshots = nativeEnemySnapshots(snapshot)
    const livePlayerIds = this.livePlayerIds
    livePlayerIds.clear()
    for (const playerId in snapshot.players) {
      const player = snapshot.players[playerId]
      livePlayerIds.add(playerId)
      let view = this.players.get(playerId)
      if (!view) {
        view = new PlayerWorldView(player.config.element, this.textures)
        this.players.set(playerId, view)
        this.root.addChild(view.container)
      }
      view.setSecondaryState(snapshot.secondaryAbilities.players[playerId], snapshot.tick)
      view.update(
        player,
        snapshot.tick,
        playerStaffActionPose(
          snapshot.primarySpells.transients,
          playerId,
          `boneyard:${this.boneyard.runId}`,
        ),
      )
    }
    for (const [playerId, view] of this.players) {
      if (livePlayerIds.has(playerId)) continue
      this.root.removeChild(view.container)
      view.destroy()
      this.players.delete(playerId)
    }
    const localPlayer = snapshot.players[localPlayerId]
    if (!localPlayer) throw new Error('Boneyard renderer lost its local player.')
    const weatherBounds = boneyardVisibleWorldBounds(camera, viewport, 0)
    const weatherCollisionWorld = withBoneyardGateCollision(
      this.collisionWorld,
      snapshot.world.gateLeaves,
    )
    this.weather.advanceTo(
      snapshot.tick,
      weatherBounds,
      viewport.height / camera.zoom,
      (position, radius) => boneyardBodyCollides(
        position,
        weatherCollisionWorld,
        radius,
      ),
    )
    const levelUpFrame = levelUpPresentation === null
      ? null
      : nativeLevelUpPresentationFrame(
          levelUpPresentation.presentationId,
          levelUpPresentation.elapsedMs,
          levelUpPresentation.playerScreenY,
        )
    this.primarySpells.update(
      snapshot.primarySpells,
      `boneyard:${snapshot.world.runId}`,
      presentationFrame,
    )
    this.secondaryAbilities.update(
      snapshot.secondaryAbilities,
      `boneyard:${snapshot.world.runId}`,
      presentationFrame,
    )
    this.gates.update(snapshot.world.gateLeaves)
    this.goodies.update(snapshot.world.goodies, snapshot.tick)
    this.enemies.update(enemySnapshots, snapshot.tick)
    this.enemyDeathEffects.update(snapshot.world.deathEffects)
    this.enemyProjectileEffects.update(snapshot.world.enemyProjectileEffects)
    this.enemyProjectiles.update(snapshot.world.enemyProjectiles, snapshot.tick)
    this.maggots.update(snapshot.world.maggots)
    this.loot.update(snapshot.world.loot)
    this.modEffects.update(snapshot)
    this.mageLightningPulses.update(
      snapshot.world.mageLightningPulses,
      snapshot.tick,
      (playerId) => snapshot.players[playerId]?.position ?? null,
    )
    const mageLightningPainterLayers = this.mageLightningPulses.painterLayers()
    this.playerDeathBursts.update(snapshot)
    this.playerDeathWeapons.update(snapshot)
    this.visibleEnemyFamilies = [...new Set(
      enemySnapshots.map((enemy) => enemy.enemyToken),
    )].sort().join(',')
    this.solomon?.update(snapshot.world.encounter, snapshot.tick)

    const dig = this.boneyard.scene.solomonDig
    const lanternLight = dig
      ? nativeLanternLightSource(
          dig.lanternPosition,
          presentationFrame,
          settings.multipleShadows,
        )
      : null
    const lightProviderOwners = this.lightProviderOwners
    lightProviderOwners.length = 0
    const lightSourceCandidates = this.lightSourceCandidates
    lightSourceCandidates.length = 0
    let localPlayerLight: NativeBoneyardLightSource | null = null
    for (const playerId in snapshot.players) {
      const player = snapshot.players[playerId]
      const playerLight = nativePlayerLightSource({
        ...player,
        id: playerId,
      }, presentationFrame, playerId === localPlayerId)
      if (playerLight) {
        if (playerId === localPlayerId) localPlayerLight = playerLight
        if (playerId === localPlayerId && levelUpFrame?.emitting) {
          playerLight.radius = (
            (1 + player.lighting.overlayEffectPhase) * NATIVE_PLAYER_LIGHT_RADIUS
            + (levelUpFrame.lightRadius - 2.6)
          )
        }
        lightProviderOwners.push({
          registration: player.lighting.lightRegistration,
          sources: [playerLight],
        })
      }
    }
    for (const enemy of snapshot.world.enemies) {
      const sources = nativeEnemyLightSources(
        enemy,
        presentationFrame,
        settings.multipleShadows,
      )
      if (sources.length === 0) continue
      lightProviderOwners.push({
        registration: requiredLightRegistration(
          enemy.lightRegistration,
          `enemy ${enemy.id}`,
        ),
        sources,
      })
    }
    for (const spell of snapshot.primarySpells.projectiles) {
      if (spell.worldKey !== `boneyard:${snapshot.world.runId}`) continue
      let source: NativeBoneyardLightSource
      switch (spell.kind) {
        case 'earth':
          source = nativeBoulderLightSource(spell, settings.multipleShadows)
          break
        case 'ether':
          source = nativeMissileLightSource(
            spell,
            presentationFrame,
            settings.multipleShadows,
          )
          break
        case 'fire':
          source = nativeFireballLightSource(
            spell,
            presentationFrame,
            settings.multipleShadows,
          )
          break
        case 'weld':
          source = nativeWeldProjectileLightSource(
            spell,
            presentationFrame,
            settings.multipleShadows,
          )
          break
      }
      lightProviderOwners.push({
        registration: spell.lightRegistration,
        sources: [source],
      })
    }
    for (const projectile of snapshot.world.enemyProjectiles) {
      const candidate = nativeEnemyProjectileLightProvider(
        projectile,
        presentationFrame,
        settings.multipleShadows,
      )
      if (!candidate) continue
      const registration = requiredLightRegistration(
        projectile.lightRegistration,
        `enemy projectile ${projectile.id}`,
      )
      if (registration.managerLane !== candidate.lane) {
        throw new Error(`enemy projectile ${projectile.id} changed native light-manager lane`)
      }
      lightProviderOwners.push({ registration, sources: [candidate.source] })
    }
    for (const effect of snapshot.primarySpells.transients) {
      if (
        effect.kind === 'weld-meteor'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        const source = nativeWeldMeteorLightSource(effect)
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: source === null ? [] : [source],
        })
        continue
      }
      if (
        effect.kind === 'weld-persistent'
        && (effect.buildId === 1006 || effect.buildId === 1008)
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [nativeWeldRockLightSource(effect, settings.multipleShadows)],
        })
        continue
      }
      if (
        effect.kind === 'fire-good-imp'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [nativeFireGoodImpLightSource(effect, presentationFrame)],
        })
        continue
      }
      if (
        effect.kind === 'ether-impact'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [etherPrimaryImpactLightSource(effect)],
        })
        continue
      }
      if (
        effect.kind === 'fire-impact'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [nativeFireImpactLightSource(effect)],
        })
        continue
      }
      if (
        effect.kind !== 'air'
        || effect.worldKey !== `boneyard:${snapshot.world.runId}`
      ) continue
      const contactLight = buildNativeAirContactLightSource({
        ageTicks: effect.ageTicks,
        endpoint: {
          x: effect.endpoint.x - effect.origin.x,
          y: effect.endpoint.y - effect.origin.y,
        },
        id: effect.id,
        origin: effect.origin,
        underpowered: effect.underpowered,
      })
      if (contactLight) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [contactLight],
        })
      }
    }
    for (const actor of snapshot.secondaryAbilities.actors) {
      if (actor.worldKey !== `boneyard:${snapshot.world.runId}`) continue
      const source = nativeSecondaryProviderLightSource(
        actor,
        presentationFrame,
        settings.multipleShadows,
      )
      if (!source) continue
      lightProviderOwners.push({
        registration: requiredLightRegistration(
          actor.lightRegistration,
          `secondary ${actor.kind} ${actor.id}`,
        ),
        sources: [source],
      })
    }
    if (lanternLight) {
      lightProviderOwners.push({
        registration: requiredLightRegistration(
          snapshot.world.lanternLightRegistration,
          'Lantern',
        ),
        sources: [lanternLight],
      })
    }
    for (const owner of mergeNativeLightProviderOwners(
      [lightProviderOwners],
      ({ registration }) => registration,
    )) {
      lightSourceCandidates.push(...owner.sources)
    }
    const lightProviderCandidateCount = lightSourceCandidates.length
    const lightMiscBatches = this.lightMiscBatches
    lightMiscBatches.length = 0
    const lightMiscTailCandidates = this.lightMiscTailCandidates
    lightMiscTailCandidates.length = 0
    for (const effect of snapshot.primarySpells.transients) {
      if (
        effect.kind !== 'air'
        || effect.ageTicks !== 0
        || effect.worldKey !== `boneyard:${snapshot.world.runId}`
      ) continue
      const pathSources = buildNativeAirPathLightSources({
        birthTick: effect.birthTick,
        endpoint: effect.endpoint,
        id: effect.id,
        midpoint: effect.midpoint,
        origin: effect.origin,
        weakCast: effect.underpowered,
      })
      if (pathSources.length === 0) continue
      const owner = snapshot.players[effect.ownerId]
      if (!owner) throw new Error(`Air MiscLight owner ${effect.ownerId} is unavailable`)
      lightMiscBatches.push({
        birthTick: effect.birthTick,
        id: effect.id,
        miscLightAppendOrdinal: 0,
        registration: owner.lighting.lightRegistration,
        sources: pathSources,
      })
    }
    for (const actor of snapshot.secondaryAbilities.actors) {
      if (actor.worldKey !== `boneyard:${snapshot.world.runId}`) continue
      const source = nativeSecondaryMiscLightSource(actor)
      if (!source) continue
      if (actor.miscLightAppendOrdinal === null) {
        throw new Error(`secondary ${actor.kind} ${actor.id} lost its MiscLight append order`)
      }
      lightMiscBatches.push({
        birthTick: snapshot.tick - actor.ageTicks,
        id: actor.id,
        miscLightAppendOrdinal: actor.miscLightAppendOrdinal,
        registration: requiredLightRegistration(
          actor.lightRegistration,
          `secondary ${actor.kind} ${actor.id}`,
        ),
        sources: [source],
      })
    }
    const enemyLightRegistrations = new Map(snapshot.world.enemies.map((enemy) => [
      enemy.id,
      enemy.lightRegistration,
    ]))
    for (const batch of this.mageLightningPulses.pathLightBatches) {
      const miscLightAppendOrdinal = snapshot.secondaryAbilities.actors.reduce(
        (nextOrdinal, actor) => (
          actor.targetId === batch.ownerActorId
          && actor.worldKey === `boneyard:${snapshot.world.runId}`
          && nativeSecondaryMiscLightSource(actor) !== null
            ? Math.max(nextOrdinal, (actor.miscLightAppendOrdinal ?? -1) + 1)
            : nextOrdinal
        ),
        0,
      )
      lightMiscBatches.push({
        birthTick: batch.birthTick,
        id: batch.id,
        miscLightAppendOrdinal,
        registration: requiredLightRegistration(
          enemyLightRegistrations.get(batch.ownerActorId) ?? null,
          `Mage Air factory ${batch.ownerActorId}`,
        ),
        sources: batch.sources,
      })
    }
    const appendOrderedMiscBatches = lightMiscBatches.toSorted((first, second) => (
      first.miscLightAppendOrdinal - second.miscLightAppendOrdinal
      || first.birthTick - second.birthTick
      || first.id - second.id
    ))
    for (const batch of mergeNativeLightProviderOwners(
      [appendOrderedMiscBatches],
      ({ registration }) => registration,
    )) {
      if (batch.registration.managerLane !== 'actor') {
        throw new Error('MiscLight creator is not an actor-manager owner')
      }
      lightMiscTailCandidates.push(...batch.sources)
    }
    const lightMiscTailCandidateCount = lightMiscTailCandidates.length
    const lightSources = this.lightIndex.rebuild(
      lightSourceCandidates,
      lightMiscTailCandidates,
      { camera, viewport },
      gameLightQuality(settings),
    )
    const worldLightScalar = (position: Vec2) => settings.complexLighting
      ? nativeBoneyardLightScalar(position, this.lightIndex)
      : 1
    this.weatherView.update(worldLightScalar)
    let maxMainLightScalar = 0
    let minMainLightScalar = 1
    for (const resident of visibleMainResidents) {
      const layerIndex = resident.mainLayerIndex
      if (layerIndex === null) continue
      const scalar = worldLightScalar(this.mainLayers[layerIndex].pos)
      resident.sprite.tint = nativeBoneyardLightTint(scalar)
      maxMainLightScalar = Math.max(maxMainLightScalar, scalar)
      minMainLightScalar = Math.min(minMainLightScalar, scalar)
    }
    const treePresentations = this.treeOcclusion.update(
      snapshot.tick,
      localPlayer.position,
    )
    const earthquakeTreeWobbles = new Map<string, number>()
    for (const actor of snapshot.secondaryAbilities.actors) {
      if (
        actor.kind !== 'earthquake-scenery-wobble'
        || actor.worldKey !== `boneyard:${this.boneyard.runId}`
        || actor.targetId === null
      ) continue
      const object = this.boneyard.scene.objects[actor.targetId]
      if (object) earthquakeTreeWobbles.set(object.eid, actor.phase)
    }
    let fadedTreeCount = 0
    let minTreeAlpha = 1
    let minTreeLightScalar = 1
    let treeAlphaMismatchCount = 0
    let treeTintMismatchCount = 0
    for (const presentation of treePresentations) {
      const tree = this.treeResidents.get(presentation.eid)
      if (!tree) continue
      const scalar = worldLightScalar(presentation.position)
      const tint = nativeBoneyardLightTint(scalar)
      tree.main.sprite.alpha = presentation.alpha
      tree.foreground.sprite.alpha = presentation.alpha
      tree.main.sprite.tint = tint
      tree.foreground.sprite.tint = tint
      const wobbleRadians = (earthquakeTreeWobbles.get(presentation.eid) ?? 0)
        * Math.PI / 180
      for (const resident of [tree.main, tree.foreground]) {
        resident.sprite.pivot.set(
          presentation.position.x - resident.x,
          presentation.position.y - resident.y,
        )
        resident.sprite.position.set(
          presentation.position.x,
          presentation.position.y,
        )
        resident.sprite.rotation = wobbleRadians
      }
      if (presentation.alpha < 1) fadedTreeCount += 1
      minTreeAlpha = Math.min(minTreeAlpha, presentation.alpha)
      minTreeLightScalar = Math.min(minTreeLightScalar, scalar)
      if (tree.main.sprite.alpha !== tree.foreground.sprite.alpha) {
        treeAlphaMismatchCount += 1
      }
      if (tree.main.sprite.tint !== tree.foreground.sprite.tint) {
        treeTintMismatchCount += 1
      }
    }
    for (const [id, view] of this.players) {
      const player = snapshot.players[id]
      if (!player) continue
      view.setWorldTint(nativeBoneyardLightTint(worldLightScalar(player.position)))
    }
    for (const layer of this.playerDeathWeapons.painterLayers()) {
      this.playerDeathWeapons.setTint(
        layer.playerId,
        nativeBoneyardLightTint(worldLightScalar(layer.position)),
      )
    }
    for (const layer of this.primarySpells.painterLayers()) {
      if (!layer.regionLightPoint) continue
      this.primarySpells.setTint(
        layer.id,
        nativeBoneyardLightTint(worldLightScalar(layer.regionLightPoint)),
      )
    }
    for (const layer of this.secondaryAbilities.painterLayers()) {
      if (!layer.regionLightPoint) continue
      this.secondaryAbilities.setTint(
        layer.id,
        nativeBoneyardLightTint(worldLightScalar(layer.regionLightPoint)),
      )
    }
    const secondaryEffectsByTarget = new Map(
      snapshot.secondaryAbilities.targetEffects
        .filter(({ worldKey }) => worldKey === `boneyard:${snapshot.world.runId}`)
        .map((effect) => [effect.targetId, effect] as const),
    )
    for (const enemy of enemySnapshots) {
      const lightTint = nativeBoneyardLightTint(worldLightScalar(enemy.position))
      this.enemies.setTint(enemy.id, nativeSecondaryTargetMaterialTint(
        lightTint,
        secondaryEffectsByTarget.get(enemy.id),
      ))
    }
    for (const effect of snapshot.world.deathEffects) {
      this.enemyDeathEffects.setWorldTint(
        effect.id,
        nativeBoneyardLightTint(worldLightScalar(effect.position)),
      )
    }
    for (const actor of snapshot.world.loot) {
      this.loot.setTint(actor.id, nativeBoneyardLightTint(worldLightScalar(actor.position)))
    }
    for (const effect of snapshot.modEffects) {
      const player = snapshot.players[effect.playerId]
      if (!player) continue
      this.modEffects.setTint(modEffectId(effect), nativeBoneyardLightTint(
        nativeBoneyardLightScalar(player.position, this.lightIndex),
      ))
    }
    for (const goodie of snapshot.world.goodies) {
      this.goodies.setTint(
        goodie.id,
        nativeBoneyardLightTint(worldLightScalar(goodie.position)),
      )
    }
    for (const projectile of snapshot.world.enemyProjectiles) {
      this.enemyProjectiles.setTint(
        projectile.id,
        nativeBoneyardLightTint(worldLightScalar(projectile.position)),
      )
    }
    for (const effect of snapshot.world.enemyProjectileEffects) {
      this.enemyProjectileEffects.setWorldTint(
        effect.id,
        nativeBoneyardLightTint(worldLightScalar(effect.position)),
      )
    }
    for (const maggot of snapshot.world.maggots) {
      this.maggots.setTint(
        maggot.id,
        nativeBoneyardLightTint(worldLightScalar(maggot.position)),
      )
    }
    for (const leaf of snapshot.world.gateLeaves) {
      const position = nativeGatePainterRoot(leaf.hinge, leaf.tip)
      this.gates.setTint(
        leaf.fenceEid,
        leaf.side,
        nativeBoneyardLightTint(worldLightScalar(position)),
      )
    }
    if (dig) {
      const solomonPosition = snapshot.world.encounter?.position ?? dig.position
      this.solomon?.setLighting(settings.complexLighting
        ? nativeSolomonSetPieceLighting(
            solomonPosition,
            dig.lanternPosition,
            this.lightIndex,
          )
        : { digRootTint: 0xffffff, lanternTint: 0xffffff })
    }

    const gateLeaves = this.gateLeaves
    gateLeaves.clear()
    for (const leaf of snapshot.world.gateLeaves) {
      gateLeaves.set(`${leaf.fenceEid}:${leaf.side}`, leaf)
    }
    const dynamicLayers = this.dynamicLayers
    dynamicLayers.length = 0
    for (const playerId in snapshot.players) {
      const player = snapshot.players[playerId]
      dynamicLayers.push({
        id: `player:${playerId}`,
        queueFamily: 'ordinary-dynamic',
        worldY: player.position.y,
        sortBias: boneyardPlayerSortBias(player),
        sourceOrder: dynamicLayers.length,
      })
    }
    for (const layer of this.playerDeathWeapons.painterLayers()) {
      dynamicLayers.push({
        id: layer.id,
        queueFamily: 'ordinary-dynamic',
        worldY: layer.worldY,
        sortBias: 0,
        sourceOrder: dynamicLayers.length,
      })
    }
    for (const layer of this.primarySpells.painterLayers()) {
      if (layer.lane !== 'world-sorted' || layer.queueFamily === null) continue
      dynamicLayers.push({
        ...layer,
        queueFamily: layer.queueFamily,
        sourceOrder: dynamicLayers.length,
      })
    }
    for (const layer of mageLightningPainterLayers) {
      if (layer.lane !== 'world-sorted' || layer.queueFamily === null) continue
      dynamicLayers.push({
        id: layer.id,
        queueFamily: layer.queueFamily,
        worldY: layer.worldY,
        sortBias: layer.sortBias,
        sourceOrder: dynamicLayers.length,
      })
    }
    for (const layer of this.secondaryAbilities.painterLayers()) {
      dynamicLayers.push({
        ...layer,
        sourceOrder: dynamicLayers.length,
      })
    }
    for (const enemy of enemySnapshots) {
      dynamicLayers.push(nativeEnemyPainterLayer(enemy, dynamicLayers.length))
    }
    for (const actor of snapshot.world.loot) {
      dynamicLayers.push(nativeLootPainterLayer(actor, dynamicLayers.length))
    }
    for (const goodie of snapshot.world.goodies) {
      dynamicLayers.push(nativeGoodiePainterLayer(goodie, dynamicLayers.length))
    }
    dynamicLayers.push(...this.modEffects.painterLayers(snapshot, dynamicLayers.length))
    for (const effect of snapshot.world.deathEffects) {
      dynamicLayers.push(nativeEnemyDeathEffectPainterLayer(effect, dynamicLayers.length))
    }
    for (const projectile of snapshot.world.enemyProjectiles) {
      dynamicLayers.push({
        id: `enemy-projectile:${projectile.id}`,
        queueFamily: 'ordinary-dynamic',
        worldY: projectile.position.y,
        sortBias: 0,
        sourceOrder: dynamicLayers.length,
      })
    }
    for (const effect of snapshot.world.enemyProjectileEffects) {
      dynamicLayers.push(nativeEnemyProjectileEffectPainterLayer(
        effect,
        dynamicLayers.length,
      ))
    }
    for (const maggot of snapshot.world.maggots) {
      dynamicLayers.push({
        id: `maggot:${maggot.id}`,
        queueFamily: 'ordinary-dynamic',
        worldY: maggot.position.y,
        sortBias: 0,
        sourceOrder: dynamicLayers.length,
      })
    }
    if (dig) {
      dynamicLayers.push({
        id: 'solomon-grave',
        queueFamily: 'ordinary-dynamic',
        worldY: dig.position.y,
        sortBias: 0,
        sourceOrder: dynamicLayers.length,
      })
      if (snapshot.world.encounter?.phase !== 'gone') {
        dynamicLayers.push({
          id: 'solomon-actor',
          queueFamily: 'ordinary-dynamic',
          worldY: snapshot.world.encounter?.position.y ?? dig.position.y,
          sortBias: 0,
          sourceOrder: dynamicLayers.length,
        })
      }
      dynamicLayers.push({
        id: 'lantern',
        queueFamily: 'ordinary-dynamic',
        worldY: dig.lanternPosition.y,
        sortBias: 0,
        sourceOrder: dynamicLayers.length,
      })
    }
    const activeStaticPainterLayers = this.activeStaticPainterLayers
    activeStaticPainterLayers.length = 0
    const visibleShadowDepthOwners = this.visibleShadowDepthOwners
    visibleShadowDepthOwners.length = 0
    for (const resident of visibleMainResidents) {
      const layerIndex = resident.mainLayerIndex
      if (layerIndex === null) continue
      const layer = this.staticPainterLayers[layerIndex]!
      layer.worldY = runtimeMainWorldY(this.mainLayers[layer.layerIndex], gateLeaves)
      activeStaticPainterLayers.push(layer)
      if (resident.shadowCaster) visibleShadowDepthOwners.push(resident.sprite)
    }
    for (const layer of this.movingGatePainterLayers) {
      layer.worldY = runtimeMainWorldY(this.mainLayers[layer.layerIndex], gateLeaves)
      activeStaticPainterLayers.push(layer)
    }
    const order = buildBoneyardPainterOrder({
      referenceY: localPlayer.position.y,
      staticLayers: activeStaticPainterLayers,
      dynamicLayers,
    })
    let maxMainZIndex = 0
    let minMainZIndex = Number.POSITIVE_INFINITY
    const gateShadowDepthOwners = this.gateShadowDepthOwners
    gateShadowDepthOwners.clear()
    for (const band of order.bands) {
      band.layerIndexes.forEach((layerIndex, position) => {
        const depth = band.zIndex + ((position + 1) / (band.layerIndexes.length + 1)) * 0.5
        maxMainZIndex = Math.max(maxMainZIndex, depth)
        minMainZIndex = Math.min(minMainZIndex, depth)
        const resident = this.mainResidents.get(layerIndex)
        if (resident?.sprite.renderable) resident.sprite.zIndex = depth
        const layer = this.mainLayers[layerIndex]
        if (isMovingGateBody(layer)) {
          this.gates.setDepth(layer.fence.eid, layer.pieceIndex, depth)
          const depthOwner = this.gates.depthOwner(layer.fence.eid, layer.pieceIndex)
          if (depthOwner) {
            gateShadowDepthOwners.set(
              `${layer.fence.eid}:${layer.pieceIndex}`,
              depthOwner,
            )
          }
        }
      })
    }
    const positionedDynamics = this.positionedDynamics
    positionedDynamics.clear()
    let maxDynamicZIndex = 0
    for (const layer of order.dynamicLayers) {
      positionedDynamics.set(layer.id, layer)
      maxDynamicZIndex = Math.max(maxDynamicZIndex, layer.zIndex)
    }
    for (const [id, view] of this.players) {
      const depth = positionedDynamics.get(`player:${id}`)?.zIndex ?? 1
      view.setDepth(depth)
      this.playerDeathBursts.setDepth(id, depth)
      this.playerDeathWeapons.setDepth(
        id,
        positionedDynamics.get(`player-death-weapon:${id}`)?.zIndex ?? depth,
      )
    }
    for (const layer of this.primarySpells.painterLayers()) {
      this.primarySpells.setDepth(
        layer.id,
        layer.lane === 'post-world-queue'
          ? order.foregroundZIndex + 0.5
          : positionedDynamics.get(layer.id)?.zIndex ?? 1,
      )
    }
    const targetContactDepths = nativeMageLightningTargetContactDepths(
      mageLightningPainterLayers,
      Object.keys(snapshot.players),
      order.foregroundZIndex,
    )
    for (const layer of mageLightningPainterLayers) {
      layer.container.zIndex = layer.lane === 'post-main-overlay'
        ? targetContactDepths.get(layer.id) ?? (
            order.foregroundZIndex + NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_OFFSET
          )
        : positionedDynamics.get(layer.id)?.zIndex ?? 1
    }
    this.primarySpells.promoteOwnerOverlays((ownerId) => (
      positionedDynamics.get(`player:${ownerId}`)?.zIndex
    ))
    for (const layer of this.secondaryAbilities.painterLayers()) {
      this.secondaryAbilities.setDepth(
        layer.id,
        positionedDynamics.get(layer.id)?.zIndex ?? 1,
      )
    }
    for (const enemy of enemySnapshots) {
      this.enemies.setDepth(
        enemy.id,
        positionedDynamics.get(`enemy:${enemy.id}`)?.zIndex ?? 1,
      )
    }
    for (const actor of snapshot.world.loot) {
      this.loot.setDepth(
        actor.id,
        positionedDynamics.get(`loot:${actor.id}`)?.zIndex ?? 1,
      )
    }
    for (const effect of snapshot.modEffects) {
      const id = modEffectId(effect)
      this.modEffects.setDepth(
        id,
        positionedDynamics.get(id)?.zIndex ?? 1,
      )
    }
    for (const goodie of snapshot.world.goodies) {
      this.goodies.setDepth(
        goodie.id,
        positionedDynamics.get(`goodie:${goodie.id}`)?.zIndex ?? 1,
      )
    }
    for (const effect of snapshot.world.deathEffects) {
      this.enemyDeathEffects.setDepth(
        effect.id,
        positionedDynamics.get(`enemy-death-effect:${effect.id}`)?.zIndex ?? 1,
      )
    }
    for (const projectile of snapshot.world.enemyProjectiles) {
      this.enemyProjectiles.setDepth(
        projectile.id,
        positionedDynamics.get(`enemy-projectile:${projectile.id}`)?.zIndex ?? 1,
      )
    }
    for (const effect of snapshot.world.enemyProjectileEffects) {
      this.enemyProjectileEffects.setDepth(
        effect.id,
        positionedDynamics.get(`enemy-projectile-effect:${effect.id}`)?.zIndex ?? 1,
      )
    }
    for (const maggot of snapshot.world.maggots) {
      this.maggots.setDepth(
        maggot.id,
        positionedDynamics.get(`maggot:${maggot.id}`)?.zIndex ?? 1,
      )
    }
    this.solomon?.setGraveDepth(positionedDynamics.get('solomon-grave')?.zIndex ?? 1)
    this.solomon?.setActorDepth(positionedDynamics.get('solomon-actor')?.zIndex ?? 1)
    this.solomon?.setLanternDepth(positionedDynamics.get('lantern')?.zIndex ?? 1)
    this.foreground.zIndex = order.foregroundZIndex
    this.weatherView.setDepth(order.foregroundZIndex + 0.5)
    const complexShadows = this.complexShadows.render(
      this.lightIndex,
      presentationFrame,
      snapshot.world.gateLeaves,
      gateShadowDepthOwners,
      visibleShadowDepthOwners,
      settings.complexLighting && settings.complexShadows,
    )
    const localPainter = positionedDynamics.get(`player:${localPlayerId}`)
    const localPlayerZIndex = localPainter?.zIndex ?? 1
    this.levelUp.update(
      levelUpFrame,
      localPlayer.position,
      localPlayerZIndex + 0.1,
    )
    return {
      activeStaticPainterLayerCount: activeStaticPainterLayers.length,
      complexShadowActiveMeshCount: complexShadows.activeMeshCount,
      complexShadowAllocatedQuadCapacity: complexShadows.allocatedQuadCapacity,
      complexShadowCasterCount: complexShadows.casterCount,
      complexShadowPooledMeshCount: complexShadows.pooledMeshCount,
      complexShadowQuadCount: complexShadows.quadCount,
      complexShadowRecordCount: complexShadows.recordCount,
      complexShadowZOrderMismatchCount: complexShadows.zOrderMismatchCount,
      fadedTreeCount,
      foregroundZIndex: order.foregroundZIndex,
      localPlayerPainterRow: localPainter?.row ?? 0,
      localPlayerZIndex,
      lanternLightIntensity: lanternLight?.intensity ?? 0,
      lightMiscTailCandidateCount,
      lightActiveBucketCount: this.lightIndex.activeBucketCount,
      lightAllocatedBucketCount: this.lightIndex.allocatedBucketCount,
      lightIndexedSourceReferenceCount: this.lightIndex.indexedSourceReferenceCount,
      lightProviderCandidateCount,
      lightSourceCount: lightSources.length,
      mainAboveLocal: maxMainZIndex > localPlayerZIndex,
      mainBelowLocal: minMainZIndex < localPlayerZIndex,
      maxDynamicZIndex,
      maxMainLightScalar,
      maxMainZIndex,
      minMainLightScalar: visibleMainResidents.length > 0 ? minMainLightScalar : 0,
      minTreeAlpha,
      minTreeLightScalar: treePresentations.length > 0 ? minTreeLightScalar : 0,
      painterBandCount: order.bands.length,
      playerLightRadius: localPlayerLight?.radius ?? 0,
      playerLightRasterRadius: localPlayerLight?.rasterScale ?? 0,
      treeAlphaMismatchCount,
      treeCount: treePresentations.length,
      treeForegroundResidentCount: this.treeResidents.size,
      treeTintMismatchCount,
    }
  }

  get playerCount(): number {
    return this.players.size
  }

  get enemyCount(): number {
    return this.enemies.size
  }

  get enemyAttackEffectCount(): number {
    return this.enemies.attackBurstCount
  }

  get enemyDeathEffectCount(): number {
    return this.enemyDeathEffects.size
  }

  get mageLightningCount(): number {
    return this.mageLightningPulses.size
  }

  get enemyFamilies(): string {
    return this.visibleEnemyFamilies
  }

  get enemyProjectileCount(): number {
    return this.enemyProjectiles.size
  }

  get enemyProjectileEffectCount(): number {
    return this.enemyProjectileEffects.size
  }

  get enemyProjectileEffectIds(): readonly number[] {
    return this.enemyProjectileEffects.ids
  }

  get enemyProjectileIds(): readonly number[] {
    return this.enemyProjectiles.ids
  }

  get maggotCount(): number {
    return this.maggots.size
  }

  get lootCount(): number {
    return this.loot.size
  }

  get modEffectCount(): number {
    return this.modEffects.size
  }

  get goodieCount(): number {
    return this.goodies.size
  }

  get weatherDropCount(): number {
    return this.weather.activeDropCount
  }

  get weatherMode(): number {
    return this.boneyard.scene.environmentMode
  }

  get weatherSplashCount(): number {
    return this.weather.activeSplashCount
  }

  get playerDeathBurstCount(): number {
    return this.playerDeathBursts.size
  }

  get playerDeathWeaponCount(): number {
    return this.playerDeathWeapons.size
  }

  get currentLightSources(): readonly NativeBoneyardLightSource[] {
    return this.lightIndex.acceptedSources
  }

  get levelUpParticleCount(): number {
    return this.levelUp.particleCount
  }

  get primarySpellCount(): number {
    return this.primarySpells.count
  }

  get primarySpellKinds(): readonly string[] {
    return this.primarySpells.kinds
  }

  get secondaryAbilityCount(): number {
    return this.secondaryAbilities.count
  }

  get secondaryAbilityKinds(): readonly string[] {
    return this.secondaryAbilities.kinds
  }

  get secondaryAbilityPrimitiveCount(): number {
    return this.secondaryAbilities.primitiveCount
  }

  get secondaryAbilitySamples() {
    return this.secondaryAbilities.diagnosticSamples
  }

  player(playerId: string): PlayerWorldView | undefined {
    return this.players.get(playerId)
  }

  playerWalkPose(playerId: string): number {
    return this.players.get(playerId)?.walkPose ?? 0
  }

  get solomonFrame(): number {
    return this.solomon?.frame ?? 0
  }

  destroy(): void {
    this.complexShadows.destroy()
    this.primarySpells.destroy()
    this.secondaryAbilities.destroy()
    this.enemies.destroy()
    this.enemyDeathEffects.destroy()
    this.enemyProjectileEffects.destroy()
    this.enemyProjectiles.destroy()
    this.maggots.destroy()
    this.loot.destroy()
    this.modEffects.destroy()
    this.goodies.destroy()
    this.mageLightningPulses.destroy()
    this.playerDeathBursts.destroy()
    this.playerDeathWeapons.destroy()
    this.root.removeChild(this.levelUp.container)
    this.levelUp.destroy()
    this.gates.destroy()
    this.weatherView.destroy()
    this.solomon?.destroy()
    for (const view of this.players.values()) view.destroy()
    this.players.clear()
  }
}

class BoneyardSolomonView {
  private readonly actorRoot = new Container({ label: 'solomon-actor' })
  private readonly body: Sprite
  private readonly clipMask = new Graphics()
  private readonly digState: SolomonDigState
  private readonly graveDirt: Sprite
  private readonly lantern: Sprite
  private readonly mouth: Sprite
  private readonly root: Container
  private readonly shadow: Sprite
  private readonly textures: BoneyardWorldTextures
  private currentFrame = 2

  constructor(
    boneyard: LoadedBoneyard,
    root: Container,
    textures: BoneyardWorldTextures,
  ) {
    const state = boneyard.scene.solomonDig!
    this.root = root
    this.textures = textures
    this.digState = state
    this.graveDirt = new Sprite(textures.graveDirt)
    this.graveDirt.position.set(
      state.gravePosition.x - 16,
      state.gravePosition.y + 105,
    )
    this.lantern = new Sprite(textures.lantern)
    this.lantern.position.set(
      state.lanternPosition.x - 14.5,
      state.lanternPosition.y - 22.5,
    )
    this.body = new Sprite(textures.solomonDig[0])
    this.body.anchor.set(0.5)
    this.mouth = new Sprite(textures.solomonDialogueMouth[0][0])
    this.mouth.anchor.set(0.5)
    this.mouth.zIndex = 1
    this.mouth.visible = false
    this.shadow = plantedSprite(
      textures.solomonShadow,
      requiredSpriteRef(13),
      { x: -10, y: -113 },
    )
    this.actorRoot.position.set(state.position.x, state.position.y)
    this.actorRoot.sortableChildren = true
    this.actorRoot.addChild(this.shadow, this.body, this.mouth, this.clipMask)
    root.addChild(this.graveDirt, this.actorRoot, this.lantern)
  }

  update(encounter: BoneyardSolomonSnapshot | null, tick: number): void {
    if (encounter === null) {
      const programIndex = Math.floor(tick / this.digState.ticksPerFrame)
        % this.digState.frameProgram.length
      const frame = this.digState.frameProgram[programIndex]
      this.currentFrame = frame + 2
      this.body.texture = this.textures.solomonDig[frame]
      this.actorRoot.position.set(this.digState.position.x, this.digState.position.y)
      this.actorRoot.visible = true
      this.body.mask = null
      this.mouth.mask = null
      this.clipMask.clear()
      this.mouth.visible = false
      this.shadow.visible = true
      return
    }
    const visual = boneyardSolomonVisualState(encounter, this.digState, tick)
    this.currentFrame = visual.nativeBodyRecord
    this.actorRoot.position.set(
      encounter.position.x,
      encounter.position.y,
    )
    this.actorRoot.visible = visual.visible
    if (!visual.visible) return
    this.body.position.y = visual.offsetY
    this.mouth.position.y = visual.offsetY
    if (visual.clipBottomWorldY === null) {
      this.body.mask = null
      this.mouth.mask = null
      this.clipMask.clear()
    } else {
      const clipLeft = this.digState.position.x - encounter.position.x - 1000
      const clipTop = visual.clipBottomWorldY - encounter.position.y - 1000
      this.clipMask.clear().rect(clipLeft, clipTop, 2000, 1000).fill(0xffffff)
      this.body.mask = this.clipMask
      this.mouth.mask = this.clipMask
    }
    this.shadow.visible = visual.shadowVisible
    if (visual.bodyBank === 'dig') {
      this.body.texture = this.textures.solomonDig[visual.bodyPose]
    } else if (visual.bodyBank === 'dialogue') {
      this.body.texture = this.textures.solomonDialogueBody[visual.direction]
    } else {
      this.body.texture = this.textures.solomonWalk[visual.bodyPose][visual.direction]
    }
    this.mouth.visible = visual.mouthPose !== null
    if (visual.mouthPose !== null) {
      this.mouth.texture = this.textures.solomonDialogueMouth[visual.mouthPose][visual.direction]
    }
  }

  get frame(): number {
    return this.currentFrame
  }

  setActorDepth(depth: number): void {
    this.actorRoot.zIndex = depth
  }

  setActorRenderable(renderable: boolean): void {
    this.actorRoot.renderable = renderable
  }

  setGraveDepth(depth: number): void {
    this.graveDirt.zIndex = depth
  }

  setLanternDepth(depth: number): void {
    this.lantern.zIndex = depth
  }

  setLighting(lighting: NativeSolomonSetPieceLighting): void {
    this.body.tint = lighting.digRootTint
    this.mouth.tint = lighting.digRootTint
    this.lantern.tint = lighting.lanternTint
  }

  destroy(): void {
    this.root.removeChild(this.graveDirt, this.actorRoot, this.lantern)
    this.graveDirt.destroy()
    this.actorRoot.destroy({ children: true })
    this.lantern.destroy()
  }
}

class BoneyardGateViews {
  private readonly leaves = new Map<string, BoneyardGateLeafView>()
  private readonly liveLeafIds = new Set<string>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
  ) {
    this.root = root
    this.textures = textures
  }

  update(leaves: readonly BoneyardGateLeafSnapshot[]): void {
    const live = this.liveLeafIds
    live.clear()
    for (const state of leaves) {
      const key = `${state.fenceEid}:${state.side}`
      live.add(key)
      let view = this.leaves.get(key)
      if (!view) {
        view = new BoneyardGateLeafView(this.root, this.textures)
        this.leaves.set(key, view)
      }
      view.update(state)
    }
    for (const [key, view] of this.leaves) {
      if (live.has(key)) continue
      view.destroy()
      this.leaves.delete(key)
    }
  }

  setDepth(fenceEid: string, side: number, depth: number): void {
    this.leaves.get(`${fenceEid}:${side}`)?.setDepth(depth)
  }

  depthOwner(fenceEid: string, side: number): ContainerChild | null {
    return this.leaves.get(`${fenceEid}:${side}`)?.container ?? null
  }

  setTint(fenceEid: string, side: number, tint: number): void {
    this.leaves.get(`${fenceEid}:${side}`)?.setTint(tint)
  }

  destroy(): void {
    for (const view of this.leaves.values()) view.destroy()
    this.leaves.clear()
    this.liveLeafIds.clear()
  }
}

class BoneyardGateLeafView {
  readonly container = new Container({ label: 'gate-leaf' })
  private readonly gateLeaf: MeshSimple
  private readonly gateVertices = new Float32Array(8)
  private readonly hinge: Sprite
  private readonly lines = new Graphics()
  private readonly root: Container

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    const leafRef = requiredSpriteRef(7)
    const hingeRef = requiredSpriteRef(8)
    const leafTexture = requiredTexture(textures, leafRef)
    const hingeTexture = requiredTexture(textures, hingeRef)
    this.gateLeaf = new MeshSimple({
      texture: leafTexture,
      vertices: this.gateVertices,
      uvs: new Float32Array(NATIVE_GATE_ART_UVS),
      indices: new Uint32Array(NATIVE_GATE_ART_INDICES),
      topology: 'triangle-list',
    })
    this.hinge = plantedSprite(hingeTexture, hingeRef, { x: 0, y: 0 })
    this.gateLeaf.eventMode = 'none'
    this.gateLeaf.zIndex = 0
    this.hinge.zIndex = 1
    this.lines.zIndex = 2
    this.container.sortableChildren = true
    this.container.addChild(this.gateLeaf, this.hinge, this.lines)
    root.addChild(this.container)
  }

  update(state: BoneyardGateLeafSnapshot): void {
    const leaf = nativeGateLeaf(state.hinge, state.tip)
    nativeGateArtVertices(leaf, this.gateVertices)
    const hingeArt = nativeGateHingeArtPosition(leaf)
    this.hinge.position.set(hingeArt.x, hingeArt.y)
    drawGateLines(this.lines, leaf)
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setTint(tint: number): void {
    this.container.tint = tint
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

function drawGateLines(graphics: Graphics, leaf: NativeGateLeaf): void {
  const [tipRule, centerRule] = nativeGateRules(leaf)
  graphics.clear()
  graphics
    .moveTo(tipRule.start.x, tipRule.start.y)
    .lineTo(tipRule.end.x, tipRule.end.y)
    .moveTo(centerRule.start.x, centerRule.start.y)
    .lineTo(centerRule.end.x, centerRule.end.y)
    .stroke({ color: 0x000000, width: 3 })
}

async function buildStaticWorld(
  document: EditorDoc,
  root: Container,
): Promise<StaticWorldBuild> {
  const base = new Container({ label: 'boneyard-base' })
  const foreground = new Container({ label: 'boneyard-foreground' })
  base.zIndex = 0
  root.addChild(base, foreground)
  const residents: ResidentTexture[] = []
  const mainResidents = new Map<number, ResidentTexture>()
  const shadowCasters: BoneyardComplexShadowStaticCaster[] = []
  const treeMainResidents = new Map<string, ResidentTexture>()
  const treeInputs: NativeTreeOcclusionInput[] = []
  const treeResidents = new Map<string, TreeResidents>()
  let staticPaintCount = 0
  try {
    residents.push(...await buildTiledStaticLayer(
      document,
      base,
      false,
      (context, width, height, camera) => {
        drawNativeBoneyardBase(context, width, height, camera, document)
        staticPaintCount += 1
      },
    ))

    const mainLayers = nativeBoneyardMainLayers(document)
    for (let layerIndex = 0; layerIndex < mainLayers.length; layerIndex += 1) {
      const layer = mainLayers[layerIndex]
      if (isMovingGateBody(layer)) continue
      const resident = buildMainLayerResident(document, layer, layerIndex)
      staticPaintCount += 1
      if (resident) {
        if (layer.kind === 'object' && layer.object.typeId === NATIVE.goodie) {
          resident.sprite.alpha = 0
        }
        root.addChild(resident.sprite)
        residents.push(resident)
        mainResidents.set(layerIndex, resident)
        if (resident.shadowCaster) {
          shadowCasters.push({ caster: resident.shadowCaster, depthOwner: resident.sprite })
        }
        if (layer.kind === 'object' && layer.object.typeId === NATIVE.tree) {
          treeMainResidents.set(layer.object.eid, resident)
        }
      }
      if (layerIndex % 12 === 11) await nextFrame()
    }

    const foregroundLayers = nativeBoneyardForegroundLayers(document)
    for (let layerIndex = 0; layerIndex < foregroundLayers.length; layerIndex += 1) {
      const layer = foregroundLayers[layerIndex]
      const resident = buildForegroundLayerResident(document, layer, layerIndex)
      staticPaintCount += 1
      if (resident) {
        foreground.addChild(resident.sprite)
        residents.push(resident)
        if (layer.object.typeId === NATIVE.tree) {
          const main = treeMainResidents.get(layer.object.eid)
          if (!main) {
            throw new Error(`Tree ${layer.object.eid} has foreground art without main art.`)
          }
          const object = layer.object as typeof layer.object & {
            secondaryVariant?: number
            secondaryVisible?: boolean
          }
          treeInputs.push({
            eid: object.eid,
            mainVariant: object.variant ?? 0,
            position: { ...object.pos },
            secondaryVariant: object.secondaryVariant ?? layer.atlasEntry - 243,
            secondaryVisible: object.secondaryVisible !== false,
          })
          treeResidents.set(object.eid, { foreground: resident, main })
        }
      }
      if (layerIndex % 12 === 11) await nextFrame()
    }
  } catch (error) {
    for (const resident of residents) resident.texture.destroy(true)
    throw error
  }
  return {
    foreground,
    mainResidents,
    residents,
    shadowCasters,
    staticPaintCount,
    treeInputs,
    treeResidents,
  }
}

async function buildTiledStaticLayer(
  document: EditorDoc,
  target: Container,
  alpha: boolean,
  paint: (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    camera: Camera,
  ) => void,
): Promise<ResidentTexture[]> {
  const residents: ResidentTexture[] = []
  for (const tile of boneyardStaticTiles(document.meta.bounds)) {
    const width = Math.ceil(tile.w)
    const height = Math.ceil(tile.h)
    const canvas = documentNodeCanvas(width, height)
    const context = canvas.getContext('2d', { alpha, willReadFrequently: alpha })
    if (!context) throw new Error('Boneyard static tile could not acquire Canvas2D.')
    paint(
      context,
      width,
      height,
      { x: tile.x + width / 2, y: tile.y + height / 2, zoom: 1 },
    )
    const crop = alpha ? cropTransparentCanvas(canvas) : { canvas, x: 0, y: 0 }
    if (crop) {
      const resident = residentTexture(crop.canvas, tile.x + crop.x, tile.y + crop.y)
      target.addChild(resident.sprite)
      residents.push(resident)
    }
    await nextFrame()
  }
  return residents
}

function buildMainLayerResident(
  document: EditorDoc,
  layer: MainLayer,
  layerIndex: number,
): ResidentTexture | null {
  const bounds = mainLayerCaptureBounds(layer)
  const canvas = documentNodeCanvas(bounds.w, bounds.h)
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!context) throw new Error('Boneyard painter layer could not acquire Canvas2D.')
  drawNativeBoneyardMainBand(
    context,
    bounds.w,
    bounds.h,
    {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
      zoom: 1,
    },
    document,
    [layerIndex],
  )
  const crop = cropTransparentCanvas(canvas)
  if (!crop) return null
  const x = bounds.x + crop.x
  const y = bounds.y + crop.y
  const resident = residentTexture(crop.canvas, x, y, layerIndex)
  resident.shadowCaster = nativeBoneyardMainLayerShadowCaster(
    document,
    layer,
    layerIndex,
  )
  return resident
}

function buildForegroundLayerResident(
  document: EditorDoc,
  layer: ObjectSpriteLayer,
  layerIndex: number,
): ResidentTexture | null {
  const bounds = objectLayerCaptureBounds(layer)
  const canvas = documentNodeCanvas(bounds.w, bounds.h)
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!context) throw new Error('Boneyard foreground layer could not acquire Canvas2D.')
  drawNativeBoneyardForegroundBand(
    context,
    bounds.w,
    bounds.h,
    {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
      zoom: 1,
    },
    document,
    [layerIndex],
  )
  const crop = cropTransparentCanvas(canvas)
  return crop
    ? residentTexture(crop.canvas, bounds.x + crop.x, bounds.y + crop.y)
    : null
}

function objectLayerCaptureBounds(
  layer: ObjectSpriteLayer,
): { h: number; w: number; x: number; y: number } {
  const ref = spriteRefFor(layer.atlas, layer.atlasEntry)
  if (!ref) {
    throw new Error(`Missing ${layer.atlas}:${layer.atlasEntry} foreground art.`)
  }
  return {
    x: Math.floor(layer.pos.x - ref.anchorX) - 1,
    y: Math.floor(layer.pos.y - ref.anchorY) - 1,
    w: Math.ceil(ref.w) + 2,
    h: Math.ceil(ref.h) + 2,
  }
}

function mainLayerCaptureBounds(layer: MainLayer): { h: number; w: number; x: number; y: number } {
  const ref = layer.kind === 'object'
    ? spriteRefFor(layer.atlas, layer.atlasEntry)
    : layer.part === 'post'
      ? spriteRefFor('DeadHawg', 36 + (layer.postVariant ?? 0))
      : null
  if (ref) {
    return {
      x: Math.floor(layer.pos.x - ref.anchorX) - 1,
      y: Math.floor(layer.pos.y - ref.anchorY) - 1,
      w: Math.ceil(ref.w) + 2,
      h: Math.ceil(ref.h) + 2,
    }
  }

  const points = layer.kind === 'fence' ? layer.fence.points : [layer.pos]
  const minX = Math.min(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxX = Math.max(...points.map((point) => point.x))
  const maxY = Math.max(...points.map((point) => point.y))
  const margin = 256
  const x = Math.floor(minX - margin)
  const y = Math.floor(minY - margin)
  return {
    x,
    y,
    w: Math.max(1, Math.ceil(maxX + margin) - x),
    h: Math.max(1, Math.ceil(maxY + margin) - y),
  }
}

function cropTransparentCanvas(
  canvas: HTMLCanvasElement,
): { canvas: HTMLCanvasElement; x: number; y: number } | null {
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!context) throw new Error('Boneyard texture crop could not acquire Canvas2D.')
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < minX || maxY < minY) return null
  const cropped = documentNodeCanvas(maxX - minX + 1, maxY - minY + 1)
  const croppedContext = cropped.getContext('2d', { alpha: true })
  if (!croppedContext) throw new Error('Boneyard cropped texture could not acquire Canvas2D.')
  croppedContext.drawImage(
    canvas,
    minX,
    minY,
    cropped.width,
    cropped.height,
    0,
    0,
    cropped.width,
    cropped.height,
  )
  return {
    canvas: cropped,
    x: minX,
    y: minY,
  }
}

function residentTexture(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  mainLayerIndex: number | null = null,
): ResidentTexture {
  const texture = Texture.from(canvas, true)
  texture.source.style.scaleMode = 'nearest'
  const sprite = new Sprite(texture)
  sprite.position.set(x, y)
  sprite.eventMode = 'none'
  return {
    h: canvas.height,
    mainLayerIndex,
    shadowCaster: null,
    sprite,
    texture,
    w: canvas.width,
    x,
    y,
  }
}

function isMovingGateBody(layer: MainLayer | undefined): layer is Extract<MainLayer, { kind: 'fence' }> {
  return Boolean(
    layer
    && layer.kind === 'fence'
    && layer.part === 'body'
    && (layer.fence.segmentCode ?? layer.fence.style ?? 0) === 2,
  )
}

function runtimeMainWorldY(
  layer: MainLayer,
  gateLeaves: ReadonlyMap<string, BoneyardGateLeafSnapshot>,
): number {
  if (!isMovingGateBody(layer)) return layer.worldY
  const leaf = gateLeaves.get(`${layer.fence.eid}:${layer.pieceIndex}`)
  return leaf ? nativeGatePainterRoot(leaf.hinge, leaf.tip).y : layer.worldY
}

function editorDocument(loaded: LoadedBoneyard): EditorDoc {
  const scene = loaded.scene
  return {
    meta: { name: scene.name, bounds: { ...scene.bounds } },
    objects: scene.objects.map((object) => ({ ...object, pos: { ...object.pos } })),
    sprites: scene.sprites.map((sprite) => ({ ...sprite, pos: { ...sprite.pos } })),
    roads: scene.roads.map((road) => ({
      ...road,
      points: road.points.map((point) => ({ ...point })),
      ...(road.quad ? { quad: road.quad.map((point) => ({ ...point })) } : {}),
    })),
    fences: scene.fences.map((fence) => ({
      ...fence,
      points: fence.points.map((point) => ({ ...point })),
    })),
    terrain: scene.terrain.map(({ points, ...terrain }) => ({
      ...terrain,
      ...(points ? { points: points.map((point) => ({ ...point })) } : {}),
    })),
    opaque: [],
    hasTimeline: false,
    spawn: { ...scene.spawn },
  }
}

async function loadStaticPainterImages(): Promise<void> {
  await Promise.all([...new Set([...BONEYARD_SPRITE_SOURCES, ...STAGE_TEXTURES])]
    .map(loadStaticPainterImage))
}

function loadStaticPainterImage(source: string): Promise<void> {
  const image = spriteImage(source)
  if (image.complete && image.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const loaded = () => {
      cleanup()
      resolve()
    }
    const failed = () => {
      cleanup()
      reject(new Error(`could not load Boneyard painter asset: ${source}`))
    }
    const cleanup = () => {
      image.removeEventListener('load', loaded)
      image.removeEventListener('error', failed)
    }
    image.addEventListener('load', loaded)
    image.addEventListener('error', failed)
  })
}

function plantedSprite(texture: Texture, ref: SpriteRef, position: Vec2): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(ref.anchorX / ref.w, ref.anchorY / ref.h)
  sprite.position.set(position.x, position.y)
  sprite.eventMode = 'none'
  return sprite
}

function requiredSpriteRef(entry: number): SpriteRef {
  const ref = spriteRefFor('DeadHawg', entry)
  if (!ref) throw new Error(`Boneyard DeadHawg record ${entry} is unavailable.`)
  return ref
}

function requiredTexture(textures: BoneyardWorldTextures, ref: SpriteRef): Texture {
  const texture = textures.base[ref.src]
  if (!texture) throw new Error(`Boneyard texture was not loaded: ${ref.src}`)
  return texture
}

function nativeEnemySnapshots(snapshot: GameSnapshot): readonly BoneyardEnemySnapshot[] {
  return snapshot.world.kind === 'boneyard' ? snapshot.world.enemies : []
}

function requiredLightRegistration(
  registration: NativeLightProviderRegistration | null,
  owner: string,
): NativeLightProviderRegistration {
  if (registration === null) {
    throw new Error(`${owner} emitted a light without native manager registration`)
  }
  return registration
}

function requireBoneyardSnapshot(snapshot: GameSnapshot, runId: string): asserts snapshot is GameSnapshot & {
  world: Extract<GameSnapshot['world'], { kind: 'boneyard' }>
} {
  if (snapshot.world.kind !== 'boneyard' || snapshot.world.runId !== runId) {
    throw new Error('Boneyard renderer received a snapshot for another scene.')
  }
}

function documentNodeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = window.document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
