// Installs Pixi's static CSP-safe sync paths; this module removes the need for eval.
import 'pixi.js/unsafe-eval'
import {
  Application,
  BufferImageSource,
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
  drawNativeBoneyardProxyBand,
  drawNativeBoneyardMainBand,
  drawNativeBoneyardPreMainWallBand,
  drawNativeBoneyardPostRoadBase,
  NATIVE_BONEYARD_POST_ROAD_TEXTURES,
  nativeBoneyardProxyLayers,
  nativeBoneyardMainLayers,
  nativeBoneyardPreMainWallLayers,
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
  BoneyardPainterOrderPlanner,
  type DynamicPainterLayer,
  type StaticPainterLayer,
} from '../boneyard-painter-order.ts'
import type { NativeRegionPainterInsertion } from '../region-painter-order.ts'
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
import {
  nativeSecondaryTargetMaterialTint,
  type NativeSecondaryTargetEffectState,
} from '../core-kernels/native-secondary-abilities.ts'
import {
  NATIVE_TUTORIAL_CAMERA_TARGET,
  nativeTutorialCameraBounds,
} from '../core-kernels/native-tutorial.ts'
import {
  mergeNativeWorldManagerOwners,
  type NativeWorldManagerRegistration,
} from '../core-kernels/native-world-manager-order.ts'
import type { GameSnapshot, LoadedBoneyard } from '../protocol/game-protocol.ts'
import {
  DEFAULT_GAME_SETTINGS,
  NATIVE_BROWSER_ENHANCED_EFFECTS,
  cameraZoomForFov,
  gameLightQuality,
  type GameSettings,
} from '../game-settings.ts'
import { playerStaffActionPose } from '../player-character-presentation.ts'
import type {
  BoneyardEnemyDeathEffectSnapshot,
  BoneyardEnemySnapshot,
  BoneyardEnemyEventSnapshot,
  BoneyardSolomonSnapshot,
  ProtocolPlayerState,
} from '../protocol/game-state.ts'
import { PlayerWorldView } from './hub-actors.ts'
import {
  boneyardSolomonPainterLayers,
  boneyardSolomonVisualState,
  type BoneyardSolomonClipRect,
} from './boneyard-solomon-render.ts'
import {
  NATIVE_SOLOMON_DIRT_DRAW_PASSES,
  NATIVE_SOLOMON_DIRT_VISIBLE_TICKS,
  nativeSolomonDirtDrawOperations,
  nativeSolomonDirtEventDelta,
  nativeSolomonDirtStateAt,
  type NativeSolomonDirtState,
} from './boneyard-solomon-dirt-presentation.ts'
import { gameViewportWorldZoom, type GameViewportLayout } from './game-viewport.ts'
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
  isBoneyardSpectatorStatusSnapshot,
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
  NativeBoneyardSurfaceView,
  type NativeBoneyardSurfaceTextures,
} from './native-boneyard-surface-view.ts'
import {
  NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX,
  NativeBoneyardLightIndex,
  NATIVE_PLAYER_LIGHT_RADIUS,
  nativeArenaDisplacementCoverPlan,
  nativeBoulderLightSource,
  nativeBoneyardLightScalar,
  nativeBoneyardSurfaceLightScalar,
  nativeBoneyardLightTint,
  nativeBoneyardWeatherLightingOrder,
  nativeLanternLightSource,
  nativeEnemyLightSources,
  nativeEnemyProjectileEffectLightProvider,
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
  type NativeBoneyardWeatherLightingOrder,
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
import { NativeHagathaSeekerView } from './native-hagatha-seeker-view.ts'
import type { ModConsumableCatalogEntry } from '../core-kernels/hub-economy.ts'
import type { GameWorldSpeech } from '../world-speech-presentation.ts'
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
  nativeEnemyDeathEffectPainterLane,
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
  nativeFireEmberLightSource,
  nativeFireExplosionLightSource,
  nativeFireGoodImpLightSource,
  nativeFireImpactLightSource,
} from './primary-spell-fire-native.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'
import {
  NativeSecondaryWorldView,
  type NativeSecondaryDiagnosticSample,
} from './native-secondary-world-view.ts'
import {
  NATIVE_PLAYER_MAGIC_SHIELD,
  NativeSecondaryScreenFeedbackPresentation,
  nativeRegionPointGain,
  nativeSecondaryWorldShake,
  presentNativeSecondaryScreenOverlay,
} from './native-secondary-presentation.ts'
import { PlayerDeathBurstViews } from './player-death-burst-view.ts'
import { PlayerDeathWeaponViews } from './player-death-weapon-view.ts'
import {
  NATIVE_LEVEL_UP_PRESENTATION_DURATION_MS,
  nativeLevelUpPresentationFrame,
  skillPickerWorldPresentationFrame,
} from './level-up-presentation.ts'
import { installNativeFixedFunctionRenderPipeline } from './native-fixed-function-render-pipeline.ts'
import { PLAYER_CHARACTER_ATLAS_SOURCES } from './player-character-atlas.ts'
import { NativeLevelUpWorldView } from './level-up-world-view.ts'
import {
  NativeWorldNameplateLayer,
  projectNativeWorldPoint,
} from './native-world-nameplate.ts'
import { NativeWorldSpeechLayer } from './native-world-speech.ts'
import { NativeBoneyardWeatherView } from './native-boneyard-weather-view.ts'
import {
  installNativeArenaRenderPipeline,
  type NativeArenaRenderPipeline,
} from './native-arena-render-pipeline.ts'
import {
  createNativeBuildingSurfaceMesh,
  createNativeWallSurfaceMesh,
  type NativeStaticSurfaceMesh,
} from './boneyard-building-surface-view.ts'
import {
  nativeBuildingLightGrid,
  nativeWallSurfaceVertexWeights,
  writeNativeWallVertexScalars,
} from './boneyard-static-surface-lighting.ts'
import {
  cropBoneyardStaticPixels,
  type BoneyardStaticPixelRegion,
} from './boneyard-static-pixels.ts'
import {
  boneyardOffCameraCleanupPlan,
  boneyardTransformedArtBounds,
} from './boneyard-off-camera-cleanup.ts'

interface EnemyDeathEffectDiagnosticSample {
  ageTicks: number
  alpha: number
  entry: number
  id: number
  kind: string
  ownerActorId: number
  x: number
  y: number
}

interface EnemyDiagnosticSample {
  action: string | null
  actionProgress: number
  bodyEntry: number | null
  bodyPose: number
  currentHealth: number
  enemyToken: string
  gaitPose: number
  headFacingOffset: number
  hitFlash: number
  id: number
  lifeState: string
  limbsEntry: number | null
  maximumHealth: number
  renderedScale: number | null
  scale: number
  x: number
  y: number
}

interface BoneyardRendererFrameDiagnostics {
  activeStaticPainterLayerCount: number
  arenaTransitionPhase: string
  buildingBaseRoofColorMismatchCount: number
  buildingCount: number
  buildingVertexLightMaximum: number
  buildingVertexLightMinimum: number
  buildingVisibleCount: number
  cameraFocusX: number
  cameraFocusY: number
  complexShadowActiveMeshCount: number
  complexShadowAllocatedQuadCapacity: number
  complexShadowCasterCount: number
  complexShadowPooledMeshCount: number
  complexShadowQuadCount: number
  complexShadowRecordCount: number
  complexShadowZOrderMismatchCount: number
  enemyAuxiliaryEffectCount: number
  enemyAuxiliaryEffectLanes: readonly string[]
  enemyCount: number
  enemyOutsideCombatBoundsCount: number
  enemyDeathEffectCulledCount: number
  enemyDeathEffectCount: number
  enemyDeathEffectSamples: readonly EnemyDeathEffectDiagnosticSample[]
  enemyDeathEffectVisibleCount: number
  enemyFamilies: string
  fadedTreeCount: number
  enemySamples: readonly EnemyDiagnosticSample[]
  enemyProjectileCount: number
  enemyProjectileEffectCount: number
  enemyProjectileEffectIds: readonly number[]
  enemyProjectileIds: readonly number[]
  frameCount: number
  foregroundZIndex: number
  gateLeafCount: number
  goodieCount: number
  goodiePainterRegistrations: readonly Readonly<{
    id: number
    sceneryRegistrationOrdinal: number
  }>[]
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
  lanternPainterRow: number
  lanternZIndex: number
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
  maggotCulledCount: number
  maggotCount: number
  maggotVisibleCount: number
  lootCount: number
  modEffectCount: number
  mageLightningCount: number
  minMainLightScalar: number
  minTreeAlpha: number
  minTreeLightScalar: number
  monumentVisibleCount: number
  orbSpriteCount: number
  offCameraCleanupApplied: boolean
  painterBandCount: number
  painterOrder: readonly Readonly<{ id: string; row: number; zIndex: number }>[]
  painterProxyOrder: readonly Readonly<{ id: string; row: number; zIndex: number }>[]
  playerAttachmentPose: number
  playerCount: number
  playerDamageX4Alpha: number
  playerDamageX4Alphas: Record<string, number>
  playerDamageX4SpriteCount: number
  playerDamageX4SpriteCounts: Record<string, number>
  playerDamageX4TicksRemaining: number
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
  playerElementEffectPrimaryId: number | null
  playerElementEffectPrimaryIds: Record<string, number | null>
  playerElementEffectScale: number
  playerEnchantStaffActive: boolean
  playerEnchantStaffActives: Record<string, boolean>
  playerEnchantStaffAlpha: number
  playerEnchantStaffAuraRecord: number | null
  playerEnchantStaffAuraRecords: Record<string, number | null>
  playerEnchantStaffTint: number | null
  playerEnchantStaffTints: Record<string, number | null>
  seekerSegmentCount: number
  playerHeadingIndex: number
  playerLightRadius: number
  playerLightRasterRadius: number
  playerMagicShieldAlpha: number
  playerMagicShieldScale: number
  playerMagicShieldVisible: boolean
  playerMaterialTint: number
  playerHardenLayerCount: number
  playerOrdinaryWeaponVisible: boolean
  playerRobeFixedPose: number
  playerSamples: readonly Readonly<{
    displayName: string
    id: string
    lifeState: string
    x: number
    y: number
  }>[]
  primarySpellCount: number
  primarySpellPainterDepths: Readonly<Record<string, number>>
  primaryHailMeshCount: number
  primaryHailMeshRunCount: number
  primarySpellKinds: readonly string[]
  primaryWaterAuraMeshCount: number
  primaryWaterMeshActorCount: number
  primaryWaterMeshNormalFrostCount: number
  primaryWaterMeshRunCount: number
  playerScreenX: number
  playerScreenY: number
  playerWalkPose: number
  playerUnselectedPrimaryAttachment: boolean
  playerUnselectedRobeAttachmentVisible: boolean
  playerWeaponScale: number
  playerX: number
  playerY: number
  solomonDirtAgeTicks: number | null
  solomonDirtAlpha: number
  solomonDirtCount: number
  solomonDirtEventId: number
  solomonDirtHeadingDegrees: number
  solomonDirtPassCount: number
  solomonDirtX: number
  solomonDirtY: number
  solomonBodyOffsetY: number
  solomonBodyTint: number
  solomonClipRectWorld: BoneyardSolomonClipRect | null
  solomonDirtTint: number
  solomonFrame: number
  solomonGraveMarkTint: number
  solomonGraveMarkPassCount: number
  solomonPainterRow: number
  solomonZIndex: number
  staticLayerCount: number
  staticPaintCount: number
  tick: number
  treeAlphaMismatchCount: number
  treeCount: number
  treeProxyResidentCount: number
  treeTintMismatchCount: number
  residentCount: number
  retiredStaticResidentCount: number
  retiredStaticSourceCount: number
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
  weatherSplashZIndex: number
  weatherStreakZIndex: number
  wallCount: number
  wallVertexLightMaximum: number
  wallVertexLightMinimum: number
  wallVisibleCount: number
  worldFeedbackMagnitude: number
  worldShakeX: number
  worldShakeY: number
}

function updateEnemyDeathEffectDiagnosticSamples(
  target: EnemyDeathEffectDiagnosticSample[],
  effects: readonly BoneyardEnemyDeathEffectSnapshot[],
): void {
  target.length = effects.length
  for (let index = 0; index < effects.length; index += 1) {
    const effect = effects[index]!
    const sample = target[index] ?? {
      ageTicks: 0,
      alpha: 0,
      entry: 0,
      id: 0,
      kind: '',
      ownerActorId: 0,
      x: 0,
      y: 0,
    }
    sample.ageTicks = effect.ageTicks
    sample.alpha = effect.alpha
    sample.entry = effect.entry
    sample.id = effect.id
    sample.kind = effect.kind
    sample.ownerActorId = effect.ownerActorId
    sample.x = effect.position.x
    sample.y = effect.position.y + effect.height
    target[index] = sample
  }
}

function updateEnemyDiagnosticSamples(
  target: EnemyDiagnosticSample[],
  enemies: readonly BoneyardEnemySnapshot[],
  scene: BoneyardDynamicScene,
): void {
  target.length = enemies.length
  for (let index = 0; index < enemies.length; index += 1) {
    const enemy = enemies[index]!
    const sample = target[index] ?? {
      action: null,
      actionProgress: 0,
      bodyEntry: null,
      bodyPose: 0,
      currentHealth: 0,
      enemyToken: '',
      gaitPose: 0,
      headFacingOffset: 0,
      hitFlash: 0,
      id: 0,
      lifeState: '',
      limbsEntry: null,
      maximumHealth: 0,
      renderedScale: null,
      scale: 0,
      x: 0,
      y: 0,
    }
    sample.action = enemy.animation.action
    sample.actionProgress = enemy.animation.actionProgress
    sample.bodyEntry = scene.enemyBodyEntry(enemy.id)
    sample.bodyPose = enemy.animation.bodyPose
    sample.currentHealth = enemy.currentHealth
    sample.enemyToken = enemy.enemyToken
    sample.gaitPose = enemy.animation.gaitPose
    sample.headFacingOffset = enemy.animation.headFacingOffset
    sample.hitFlash = enemy.animation.hitFlash
    sample.id = enemy.id
    sample.lifeState = enemy.animation.state
    sample.limbsEntry = scene.enemyLimbsEntry(enemy.id)
    sample.maximumHealth = enemy.maximumHealth
    sample.renderedScale = scene.enemyScale(enemy.id)
    sample.scale = enemy.scale
    sample.x = enemy.position.x
    sample.y = enemy.position.y
    target[index] = sample
  }
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
  setWorldSpeeches(speeches: readonly GameWorldSpeech[]): void
  spectatorStatus(snapshot: GameSnapshot): BoneyardSpectatorStatusPresentation | null
}

export type BoneyardWorldPresentationSettings = Pick<
  GameSettings,
  | 'cameraFovPercent'
  | 'complexLighting'
  | 'complexShadows'
  | 'lightQualityPercent'
  | 'multipleShadows'
  | 'reducedScreenFlashes'
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
  cleanupSourceKey: string | null
  mainLayerIndex: number | null
  pixels: Uint8ClampedArray
  shadowCaster: NativeBoneyardComplexShadowCaster | null
  sprite: Container
  surfaceMesh: NativeStaticSurfaceMesh | null
  texture: Texture
}

interface BuildingResidents {
  main: ResidentTexture & { surfaceMesh: NativeStaticSurfaceMesh }
  roof: ResidentTexture & { surfaceMesh: NativeStaticSurfaceMesh }
  samplePoints: readonly Vec2[]
  scalars: Float32Array
}

interface WallResident {
  end: Vec2
  resident: ResidentTexture & { surfaceMesh: NativeStaticSurfaceMesh }
  scalars: Float32Array
  start: Vec2
  vertexWeights: Float32Array
}

interface TreeResidents {
  proxy: ResidentTexture
  main: ResidentTexture
}

interface StaticWorldBuild {
  activeResidents: ResidentTexture[]
  applyOffCameraCleanup(): void
  buildingResidents: ReadonlyMap<string, BuildingResidents>
  mainResidents: ReadonlyMap<number, ResidentTexture>
  residents: ResidentTexture[]
  offCameraCleanupApplied: boolean
  retiredStaticResidentCount: number
  retiredStaticSourceCount: number
  shadowCasters: readonly BoneyardComplexShadowStaticCaster[]
  staticPaintCount: number
  surface: NativeBoneyardSurfaceView
  treeInputs: readonly NativeTreeOcclusionInput[]
  treeResidents: ReadonlyMap<string, TreeResidents>
  wallResidents: ReadonlyMap<number, WallResident>
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
  const enemyDeathEffectSamples: EnemyDeathEffectDiagnosticSample[] = []
  const enemySamples: EnemyDiagnosticSample[] = []
  const frameDiagnostics: BoneyardRendererFrameDiagnostics = {
    activeStaticPainterLayerCount: 0,
    arenaTransitionPhase: 'none',
    buildingBaseRoofColorMismatchCount: 0,
    buildingCount: staticWorld.buildingResidents.size,
    buildingVertexLightMaximum: 0,
    buildingVertexLightMinimum: 0,
    buildingVisibleCount: 0,
    cameraFocusX: Number.NaN,
    cameraFocusY: Number.NaN,
    complexShadowActiveMeshCount: 0,
    complexShadowAllocatedQuadCapacity: 0,
    complexShadowCasterCount: 0,
    complexShadowPooledMeshCount: 0,
    complexShadowQuadCount: 0,
    complexShadowRecordCount: 0,
    complexShadowZOrderMismatchCount: 0,
    enemyAuxiliaryEffectCount: 0,
    enemyAuxiliaryEffectLanes: [],
    enemyCount: 0,
    enemyOutsideCombatBoundsCount: 0,
    enemyDeathEffectCulledCount: 0,
    enemyDeathEffectCount: 0,
    enemyDeathEffectSamples,
    enemyDeathEffectVisibleCount: 0,
    enemyFamilies: '',
    fadedTreeCount: 0,
    enemySamples,
    enemyProjectileCount: 0,
    enemyProjectileEffectCount: 0,
    enemyProjectileEffectIds: [],
    enemyProjectileIds: [],
    frameCount: 0,
    foregroundZIndex: 0,
    gateLeafCount: 0,
    goodieCount: 0,
    goodiePainterRegistrations: [],
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
    lanternPainterRow: Number.NaN,
    lanternZIndex: Number.NaN,
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
    maggotCulledCount: 0,
    maggotCount: 0,
    maggotVisibleCount: 0,
    lootCount: 0,
    modEffectCount: 0,
    mageLightningCount: 0,
    minMainLightScalar: 0,
    minTreeAlpha: 1,
    minTreeLightScalar: 0,
    monumentVisibleCount: 0,
    orbSpriteCount: 0,
    offCameraCleanupApplied: false,
    painterBandCount: 0,
    painterOrder: [],
    painterProxyOrder: [],
    playerAttachmentPose: 0,
    playerCount: 0,
    playerDamageX4Alpha: 0,
    playerDamageX4Alphas: {},
    playerDamageX4SpriteCount: 0,
    playerDamageX4SpriteCounts: {},
    playerDamageX4TicksRemaining: 0,
    playerDeathColorLayerCount: 0,
    playerDeathFrame: null,
    playerDeathFrameSamples: [],
    playerDeathShadowLayerCount: 0,
    playerDeathBurstCount: 0,
    playerDeathWeaponCount: 0,
    playerElementEffectPrimaryId: null,
    playerElementEffectPrimaryIds: {},
    playerElementEffectScale: 1,
    playerEnchantStaffActive: false,
    playerEnchantStaffActives: {},
    playerEnchantStaffAlpha: 0,
    playerEnchantStaffAuraRecord: null,
    playerEnchantStaffAuraRecords: {},
    playerEnchantStaffTint: null,
    playerEnchantStaffTints: {},
    seekerSegmentCount: 0,
    playerHeadingIndex: 0,
    playerLightRadius: 0,
    playerLightRasterRadius: 0,
    playerMagicShieldAlpha: 0,
    playerMagicShieldScale: NATIVE_PLAYER_MAGIC_SHIELD.scale,
    playerMagicShieldVisible: false,
    playerMaterialTint: 0xffffff,
    playerHardenLayerCount: 0,
    playerOrdinaryWeaponVisible: false,
    playerRobeFixedPose: 0,
    playerSamples: [],
    primarySpellCount: 0,
    primarySpellPainterDepths: {},
    primaryHailMeshCount: 0,
    primaryHailMeshRunCount: 0,
    primarySpellKinds: [],
    primaryWaterAuraMeshCount: 0,
    primaryWaterMeshActorCount: 0,
    primaryWaterMeshNormalFrostCount: 0,
    primaryWaterMeshRunCount: 0,
    playerScreenX: Number.NaN,
    playerScreenY: Number.NaN,
    playerWalkPose: 0,
    playerUnselectedPrimaryAttachment: false,
    playerUnselectedRobeAttachmentVisible: false,
    playerWeaponScale: 1,
    playerX: Number.NaN,
    playerY: Number.NaN,
    solomonDirtAgeTicks: null,
    solomonDirtAlpha: 0,
    solomonDirtCount: 0,
    solomonDirtEventId: 0,
    solomonDirtHeadingDegrees: 0,
    solomonDirtPassCount: 0,
    solomonDirtX: Number.NaN,
    solomonDirtY: Number.NaN,
    solomonBodyOffsetY: 0,
    solomonBodyTint: 0xffffff,
    solomonClipRectWorld: null,
    solomonDirtTint: 0xffffff,
    solomonFrame: 0,
    solomonGraveMarkTint: 0xffffff,
    solomonGraveMarkPassCount: 0,
    solomonPainterRow: Number.NaN,
    solomonZIndex: Number.NaN,
    staticLayerCount: mainLayers.length,
    staticPaintCount: staticWorld.staticPaintCount,
    tick: options.initialSnapshot.tick,
    treeAlphaMismatchCount: 0,
    treeCount: staticWorld.treeInputs.length,
    treeProxyResidentCount: staticWorld.treeResidents.size,
    treeTintMismatchCount: 0,
    residentCount: staticWorld.activeResidents.length,
    retiredStaticResidentCount: 0,
    retiredStaticSourceCount: 0,
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
    weatherSplashZIndex: Number.NaN,
    weatherStreakZIndex: Number.NaN,
    wallCount: staticWorld.wallResidents.size,
    wallVertexLightMaximum: 0,
    wallVertexLightMinimum: 0,
    wallVisibleCount: 0,
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
        scene.currentLightSources,
        camera,
        viewport,
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
      frameDiagnostics.buildingBaseRoofColorMismatchCount = (
        painter.buildingBaseRoofColorMismatchCount
      )
      frameDiagnostics.buildingCount = painter.buildingCount
      frameDiagnostics.buildingVertexLightMaximum = painter.buildingVertexLightMaximum
      frameDiagnostics.buildingVertexLightMinimum = painter.buildingVertexLightMinimum
      frameDiagnostics.buildingVisibleCount = painter.buildingVisibleCount
      frameDiagnostics.complexShadowActiveMeshCount = painter.complexShadowActiveMeshCount
      frameDiagnostics.complexShadowAllocatedQuadCapacity = painter.complexShadowAllocatedQuadCapacity
      frameDiagnostics.complexShadowCasterCount = painter.complexShadowCasterCount
      frameDiagnostics.complexShadowPooledMeshCount = painter.complexShadowPooledMeshCount
      frameDiagnostics.complexShadowQuadCount = painter.complexShadowQuadCount
      frameDiagnostics.complexShadowRecordCount = painter.complexShadowRecordCount
      frameDiagnostics.complexShadowZOrderMismatchCount = painter.complexShadowZOrderMismatchCount
      frameDiagnostics.enemyAuxiliaryEffectCount = scene.enemyAuxiliaryEffectCount
      frameDiagnostics.enemyAuxiliaryEffectLanes = scene.enemyAuxiliaryEffectLanes
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
      frameDiagnostics.enemyDeathEffectVisibleCount = scene.visibleEnemyDeathEffectCount
      frameDiagnostics.enemyDeathEffectCulledCount = (
        scene.enemyDeathEffectCount - scene.visibleEnemyDeathEffectCount
      )
      updateEnemyDeathEffectDiagnosticSamples(
        enemyDeathEffectSamples,
        snapshot.world.deathEffects,
      )
      frameDiagnostics.enemyFamilies = scene.enemyFamilies
      frameDiagnostics.fadedTreeCount = painter.fadedTreeCount
      updateEnemyDiagnosticSamples(enemySamples, snapshot.world.enemies, scene)
      frameDiagnostics.enemyProjectileCount = scene.enemyProjectileCount
      frameDiagnostics.enemyProjectileEffectCount = scene.enemyProjectileEffectCount
      frameDiagnostics.enemyProjectileEffectIds = scene.enemyProjectileEffectIds
      frameDiagnostics.enemyProjectileIds = scene.enemyProjectileIds
      frameDiagnostics.foregroundZIndex = painter.foregroundZIndex
      frameDiagnostics.gateLeafCount = snapshot.world.gateLeaves.length
      frameDiagnostics.goodieCount = scene.goodieCount
      frameDiagnostics.goodiePainterRegistrations = snapshot.world.goodies.map((goodie) => ({
        id: goodie.id,
        sceneryRegistrationOrdinal: goodie.sceneryRegistrationOrdinal,
      }))
      frameDiagnostics.culledResidentCount = visibility.culledResidentCount
      frameDiagnostics.localPlayerDeathTick = player.progression.deathTick
      frameDiagnostics.localPlayerHealth = player.progression.currentHealth
      frameDiagnostics.localPlayerLifeState = player.progression.lifeState
      frameDiagnostics.localPlayerMana = player.progression.currentMana
      frameDiagnostics.localPlayerPainterRow = painter.localPlayerPainterRow
      frameDiagnostics.localPlayerZIndex = painter.localPlayerZIndex
      frameDiagnostics.lanternLightIntensity = painter.lanternLightIntensity
      frameDiagnostics.lanternPainterRow = painter.lanternPainterRow
      frameDiagnostics.lanternZIndex = painter.lanternZIndex
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
      frameDiagnostics.maggotCulledCount = scene.maggotCulledCount
      frameDiagnostics.maggotCount = scene.maggotCount
      frameDiagnostics.maggotVisibleCount = scene.maggotVisibleCount
      frameDiagnostics.lootCount = scene.lootCount
      frameDiagnostics.modEffectCount = scene.modEffectCount
      frameDiagnostics.mageLightningCount = scene.mageLightningCount
      frameDiagnostics.minMainLightScalar = painter.minMainLightScalar
      frameDiagnostics.minTreeAlpha = painter.minTreeAlpha
      frameDiagnostics.minTreeLightScalar = painter.minTreeLightScalar
      frameDiagnostics.monumentVisibleCount = painter.monumentVisibleCount
      frameDiagnostics.painterBandCount = painter.painterBandCount
      frameDiagnostics.painterOrder = painter.painterOrder
      frameDiagnostics.painterProxyOrder = painter.painterProxyOrder
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
      frameDiagnostics.primarySpellPainterDepths = scene.primarySpellPainterDepths
      frameDiagnostics.primaryHailMeshCount = scene.primaryHailMeshCount
      frameDiagnostics.primaryHailMeshRunCount = scene.primaryHailMeshRunCount
      frameDiagnostics.primarySpellKinds = scene.primarySpellKinds
      frameDiagnostics.primaryWaterAuraMeshCount = scene.primaryWaterAuraMeshCount
      frameDiagnostics.primaryWaterMeshActorCount = scene.primaryWaterMeshActorCount
      frameDiagnostics.primaryWaterMeshNormalFrostCount = (
        scene.primaryWaterMeshNormalFrostCount
      )
      frameDiagnostics.primaryWaterMeshRunCount = scene.primaryWaterMeshRunCount
      frameDiagnostics.playerScreenX = (player.position.x - camera.x) * camera.zoom
        + viewport.width / 2
      frameDiagnostics.playerScreenY = (player.position.y - camera.y) * camera.zoom
        + viewport.height / 2
      frameDiagnostics.playerHeadingIndex = player.headingIndex
      frameDiagnostics.playerWalkPose = scene.playerWalkPose(options.playerId)
      frameDiagnostics.playerElementEffectPrimaryIds = Object.fromEntries(
        Object.keys(snapshot.players).map((playerId) => [
          playerId,
          scene.player(playerId)?.elementEffectPrimaryId ?? null,
        ]),
      )
      frameDiagnostics.playerEnchantStaffActives = Object.fromEntries(
        Object.keys(snapshot.players).map((playerId) => [
          playerId,
          scene.player(playerId)?.enchantStaffActive ?? false,
        ]),
      )
      frameDiagnostics.playerEnchantStaffAuraRecords = Object.fromEntries(
        Object.keys(snapshot.players).map((playerId) => [
          playerId,
          scene.player(playerId)?.enchantStaffAuraRecord ?? null,
        ]),
      )
      frameDiagnostics.playerEnchantStaffTints = Object.fromEntries(
        Object.keys(snapshot.players).map((playerId) => [
          playerId,
          scene.player(playerId)?.enchantStaffTint ?? null,
        ]),
      )
      frameDiagnostics.playerDamageX4Alphas = Object.fromEntries(
        Object.keys(snapshot.players).map((playerId) => [
          playerId,
          scene.player(playerId)?.damageX4Alpha ?? 0,
        ]),
      )
      frameDiagnostics.playerDamageX4SpriteCounts = Object.fromEntries(
        Object.keys(snapshot.players).map((playerId) => [
          playerId,
          scene.player(playerId)?.damageX4SpriteCount ?? 0,
        ]),
      )
      const playerView = scene.player(options.playerId)
      frameDiagnostics.playerAttachmentPose = playerView?.attachmentPose ?? 0
      frameDiagnostics.playerDamageX4Alpha = playerView?.damageX4Alpha ?? 0
      frameDiagnostics.playerDamageX4SpriteCount = playerView?.damageX4SpriteCount ?? 0
      frameDiagnostics.playerDamageX4TicksRemaining = player.progression.damageX4TicksRemaining
      frameDiagnostics.playerElementEffectPrimaryId = playerView?.elementEffectPrimaryId ?? null
      frameDiagnostics.playerElementEffectScale = playerView?.elementEffectScale ?? 1
      frameDiagnostics.playerEnchantStaffActive = playerView?.enchantStaffActive ?? false
      frameDiagnostics.playerEnchantStaffAlpha = playerView?.enchantStaffAlpha ?? 0
      frameDiagnostics.playerEnchantStaffAuraRecord = playerView?.enchantStaffAuraRecord ?? null
      frameDiagnostics.playerEnchantStaffTint = playerView?.enchantStaffTint ?? null
      frameDiagnostics.seekerSegmentCount = scene.seekerSegmentCount
      frameDiagnostics.orbSpriteCount = playerView?.orbSpriteCount ?? 0
      frameDiagnostics.offCameraCleanupApplied = currentStaticWorld.offCameraCleanupApplied
      frameDiagnostics.playerWeaponScale = playerView?.weaponScale ?? 1
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
      frameDiagnostics.playerMagicShieldAlpha = playerView?.magicShieldAlpha ?? 0
      frameDiagnostics.playerMagicShieldScale = playerView?.magicShieldScale ?? NATIVE_PLAYER_MAGIC_SHIELD.scale
      frameDiagnostics.playerMagicShieldVisible = playerView?.magicShieldVisible ?? false
      frameDiagnostics.playerHardenLayerCount = playerView?.hardenLayerCount ?? 0
      frameDiagnostics.playerMaterialTint = playerView?.materialTint ?? 0xffffff
      frameDiagnostics.playerOrdinaryWeaponVisible =
        playerView?.ordinaryWeaponVisible ?? false
      frameDiagnostics.playerRobeFixedPose = playerView?.robeFixedPose ?? 0
      frameDiagnostics.playerUnselectedPrimaryAttachment =
        playerView?.unselectedPrimaryAttachment ?? false
      frameDiagnostics.playerUnselectedRobeAttachmentVisible =
        playerView?.unselectedRobeAttachmentVisible ?? false
      frameDiagnostics.playerX = player.position.x
      frameDiagnostics.playerY = player.position.y
      frameDiagnostics.residentCount = currentStaticWorld.activeResidents.length
      frameDiagnostics.retiredStaticResidentCount = currentStaticWorld.retiredStaticResidentCount
      frameDiagnostics.retiredStaticSourceCount = currentStaticWorld.retiredStaticSourceCount
      frameDiagnostics.runGameOverExitTicks = snapshot.run.gameOverExitTicks
      frameDiagnostics.runGameOverTicks = snapshot.run.gameOverTicks
      frameDiagnostics.runId = snapshot.run.runId
      frameDiagnostics.runPhase = snapshot.run.phase
      frameDiagnostics.spectatorTargetPlayerId = spectatorCamera.targetPlayerId
      const solomonDirt = scene.solomonDirt
      frameDiagnostics.solomonDirtAgeTicks = solomonDirt?.state.ageTicks ?? null
      frameDiagnostics.solomonDirtAlpha = solomonDirt?.state.alpha ?? 0
      frameDiagnostics.solomonDirtCount = scene.solomonDirtCount
      frameDiagnostics.solomonDirtEventId = solomonDirt?.eventId ?? 0
      frameDiagnostics.solomonDirtHeadingDegrees = solomonDirt?.state.headingDegrees ?? 0
      frameDiagnostics.solomonDirtPassCount = scene.solomonDirtPassCount
      frameDiagnostics.solomonDirtX = solomonDirt?.state.position.x ?? Number.NaN
      frameDiagnostics.solomonDirtY = solomonDirt?.state.position.y ?? Number.NaN
      frameDiagnostics.solomonBodyOffsetY = scene.solomonBodyOffsetY
      frameDiagnostics.solomonBodyTint = scene.solomonBodyTint
      frameDiagnostics.solomonClipRectWorld = scene.solomonClipRectWorld
      frameDiagnostics.solomonDirtTint = scene.solomonDirtTint
      frameDiagnostics.solomonFrame = scene.solomonFrame
      frameDiagnostics.solomonGraveMarkTint = scene.solomonGraveMarkTint
      frameDiagnostics.solomonGraveMarkPassCount = scene.solomonGraveMarkPassCount
      frameDiagnostics.solomonPainterRow = painter.solomonPainterRow
      frameDiagnostics.solomonZIndex = painter.solomonZIndex
      frameDiagnostics.tick = snapshot.tick
      frameDiagnostics.treeAlphaMismatchCount = painter.treeAlphaMismatchCount
      frameDiagnostics.treeCount = painter.treeCount
      frameDiagnostics.treeProxyResidentCount = painter.treeProxyResidentCount
      frameDiagnostics.treeTintMismatchCount = painter.treeTintMismatchCount
      frameDiagnostics.visibleMainLayerCount = visibility.visibleMainResidents.length
      frameDiagnostics.visibleOversizedResidentCount = visibility.visibleOversizedResidentCount
      frameDiagnostics.visibleResidentCount = visibility.visibleResidentCount
      canvas.dataset.staticOffCameraCleanup = currentStaticWorld.offCameraCleanupApplied
        ? 'applied'
        : 'pending'
      canvas.dataset.roadActiveMeshCount = `${currentStaticWorld.surface.activeRoadMeshCount}`
      frameDiagnostics.weatherDropCount = scene.weatherDropCount
      frameDiagnostics.weatherMode = scene.weatherMode
      frameDiagnostics.weatherSplashCount = scene.weatherSplashCount
      frameDiagnostics.weatherSplashZIndex = painter.weatherLightingOrder.splashZIndex
      frameDiagnostics.weatherStreakZIndex = painter.weatherLightingOrder.streakZIndex
      frameDiagnostics.wallCount = painter.wallCount
      frameDiagnostics.wallVertexLightMaximum = painter.wallVertexLightMaximum
      frameDiagnostics.wallVertexLightMinimum = painter.wallVertexLightMinimum
      frameDiagnostics.wallVisibleCount = painter.wallVisibleCount
      frameDiagnostics.worldFeedbackMagnitude = feedbackMagnitude
      frameDiagnostics.regionLightCompositeZIndex = (
        painter.weatherLightingOrder.lightCompositeZIndex
      )
      frameDiagnostics.regionLightLogicalSide = regionLightField.targetLogicalSide
      frameDiagnostics.regionLightPhysicalSide = regionLightField.targetPhysicalSide
      frameDiagnostics.worldShakeX = currentWorldDisplacement.x
      frameDiagnostics.worldShakeY = currentWorldDisplacement.y
      frameDiagnostics.secondaryAbilityCount = scene.secondaryAbilityCount
      frameDiagnostics.secondaryAbilityKinds = scene.secondaryAbilityKinds
      frameDiagnostics.secondaryAbilityPrimitiveCount = scene.secondaryAbilityPrimitiveCount
      frameDiagnostics.secondaryAbilitySamples = scene.secondaryAbilitySamples
      frameDiagnostics.secondaryScreenFlashAlpha = screenOverlay?.alpha ?? 0
      frameDiagnostics.secondaryScreenFlashColor = screenOverlay?.color ?? 0xffffff
      canvas.dataset.enemyCount = `${scene.enemyCount}`
      canvas.dataset.enemyAuxiliaryEffectCount = `${scene.enemyAuxiliaryEffectCount}`
      canvas.dataset.enemyAuxiliaryEffectLanes = scene.enemyAuxiliaryEffectLanes.join(',')
      canvas.dataset.enemyDeathEffectCount = `${scene.enemyDeathEffectCount}`
      canvas.dataset.enemyDeathEffectVisibleCount = `${scene.visibleEnemyDeathEffectCount}`
      canvas.dataset.enemyDeathEffectCulledCount = `${
        scene.enemyDeathEffectCount - scene.visibleEnemyDeathEffectCount
      }`
      canvas.dataset.complexShadowCasterCount = `${painter.complexShadowCasterCount}`
      canvas.dataset.complexShadowQuadCount = `${painter.complexShadowQuadCount}`
      canvas.dataset.complexShadowRecordCount = `${painter.complexShadowRecordCount}`
      canvas.dataset.enemyFamilies = scene.enemyFamilies
      canvas.dataset.fadedTreeCount = `${painter.fadedTreeCount}`
      canvas.dataset.minTreeAlpha = `${painter.minTreeAlpha}`
      canvas.dataset.minTreeLightScalar = `${painter.minTreeLightScalar}`
      canvas.dataset.enemyProjectileCount = `${scene.enemyProjectileCount}`
      canvas.dataset.maggotCulledCount = `${scene.maggotCulledCount}`
      canvas.dataset.maggotCount = `${scene.maggotCount}`
      canvas.dataset.maggotVisibleCount = `${scene.maggotVisibleCount}`
      canvas.dataset.lootCount = `${scene.lootCount}`
      canvas.dataset.modEffectCount = `${scene.modEffectCount}`
      canvas.dataset.goodieCount = `${scene.goodieCount}`
      canvas.dataset.mageLightningCount = `${scene.mageLightningCount}`
      canvas.dataset.playerDeathBurstCount = `${scene.playerDeathBurstCount}`
      canvas.dataset.seekerSegmentCount = `${scene.seekerSegmentCount}`
      canvas.dataset.worldFeedbackMagnitude = `${feedbackMagnitude}`
      canvas.dataset.secondaryCameraMagnitude = `${secondaryCameraMagnitude}`
      canvas.dataset.worldShakeX = `${currentWorldDisplacement.x}`
      canvas.dataset.worldShakeY = `${currentWorldDisplacement.y}`
      canvas.dataset.secondaryScreenFlashAlpha = `${screenOverlay?.alpha ?? 0}`
      canvas.dataset.solomonGraveMarkPassCount = `${scene.solomonGraveMarkPassCount}`
      canvas.dataset.weatherDropCount = `${scene.weatherDropCount}`
      canvas.dataset.weatherMode = `${scene.weatherMode}`
      canvas.dataset.weatherSplashCount = `${scene.weatherSplashCount}`
      canvas.dataset.weatherSplashZIndex = `${painter.weatherLightingOrder.splashZIndex}`
      canvas.dataset.weatherStreakZIndex = `${painter.weatherLightingOrder.streakZIndex}`
      canvas.dataset.wallVisibleCount = `${painter.wallVisibleCount}`
      canvas.dataset.regionLightCompositeZIndex = `${
        painter.weatherLightingOrder.lightCompositeZIndex
      }`
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

interface BoneyardPainterFrame {
  activeStaticPainterLayerCount: number
  buildingBaseRoofColorMismatchCount: number
  buildingCount: number
  buildingVertexLightMaximum: number
  buildingVertexLightMinimum: number
  buildingVisibleCount: number
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
  lanternPainterRow: number
  lanternZIndex: number
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
  monumentVisibleCount: number
  painterBandCount: number
  painterOrder: readonly Readonly<{ id: string; row: number; zIndex: number }>[]
  painterProxyOrder: readonly Readonly<{ id: string; row: number; zIndex: number }>[]
  playerLightRadius: number
  playerLightRasterRadius: number
  treeAlphaMismatchCount: number
  treeCount: number
  treeProxyResidentCount: number
  treeTintMismatchCount: number
  solomonPainterRow: number
  solomonZIndex: number
  weatherLightingOrder: NativeBoneyardWeatherLightingOrder
  wallCount: number
  wallVertexLightMaximum: number
  wallVertexLightMinimum: number
  wallVisibleCount: number
}

interface RegisteredBoneyardLightProviderOwner {
  registration: NativeWorldManagerRegistration
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
  private readonly buildingResidents: ReadonlyMap<string, BuildingResidents>
  private readonly complexShadows: BoneyardComplexShadowPresentation
  private readonly collisionWorld: BoneyardCollisionWorld
  private readonly dynamicLayers: DynamicPainterLayer[] = []
  private readonly enemies: NativeEnemyViews
  private readonly enemyLightRegistrations = new Map<
    number,
    NativeWorldManagerRegistration
  >()
  private readonly enemyDeathEffects: NativeEnemyDeathEffectViews
  private readonly enemyProjectileEffects: NativeEnemyProjectileEffectViews
  private readonly enemyProjectiles: NativeEnemyProjectileViews
  private readonly earthquakeTreeWobbles = new Map<string, number>()
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
  private readonly painterOrderPlanner = new BoneyardPainterOrderPlanner()
  private readonly players = new Map<string, PlayerWorldView>()
  private readonly playerDeathBursts: PlayerDeathBurstViews
  private readonly playerDeathWeapons: PlayerDeathWeaponViews
  private readonly maggots: NativeMaggotViews
  private readonly loot: NativeLootViews
  private readonly modEffects: ModConsumableEffectViews
  private readonly modTextures: ModPresentationTextures
  private readonly mageLightningPulses: NativeMageLightningPulseViews
  private readonly primarySpells: PrimarySpellWorldView
  private readonly secondaryAbilities: NativeSecondaryWorldView
  private readonly secondaryEffectsByTarget = new Map<
    number,
    NativeSecondaryTargetEffectState
  >()
  private readonly seeker: NativeHagathaSeekerView
  private readonly positionedDynamics = new Map<string, { row: number; zIndex: number }>()
  private readonly root: Container
  private readonly solomon: BoneyardSolomonView | null
  private readonly staticPainterLayers: StaticPainterLayer[]
  private readonly textures: BoneyardWorldTextures
  private readonly treeOcclusion: BoneyardTreeOcclusionPresentation
  private readonly treeResidents: ReadonlyMap<string, TreeResidents>
  private readonly wallResidents: ReadonlyMap<number, WallResident>
  private readonly visibleShadowDepthOwners: ContainerChild[] = []
  private readonly weather: NativeBoneyardWeather
  private readonly weatherView: NativeBoneyardWeatherView
  private visibleEnemyFamilies = ''

  private readonly renderer: Application['renderer']

  constructor(
    boneyard: LoadedBoneyard,
    root: Container,
    renderer: Application['renderer'],
    textures: BoneyardWorldTextures,
    mainLayers: readonly MainLayer[],
    mainResidents: ReadonlyMap<number, ResidentTexture>,
    shadowCasters: readonly BoneyardComplexShadowStaticCaster[],
    treeInputs: readonly NativeTreeOcclusionInput[],
    treeResidents: ReadonlyMap<string, TreeResidents>,
    buildingResidents: ReadonlyMap<string, BuildingResidents>,
    wallResidents: ReadonlyMap<number, WallResident>,
    initialSnapshot: GameSnapshot,
    modTextures: ModPresentationTextures,
    modCatalog: readonly ModConsumableCatalogEntry[],
  ) {
    this.boneyard = boneyard
    this.renderer = renderer
    this.collisionWorld = createBoneyardCollisionWorld(boneyard.scene)
    this.lightIndex = new NativeBoneyardLightIndex({
      height: boneyard.scene.bounds.h,
      width: boneyard.scene.bounds.w,
    })
    this.root = root
    this.textures = textures
    this.modTextures = modTextures
    this.mainLayers = mainLayers
    this.mainResidents = mainResidents
    this.complexShadows = new BoneyardComplexShadowPresentation(root, shadowCasters)
    this.treeOcclusion = new BoneyardTreeOcclusionPresentation(
      treeInputs,
      initialSnapshot.tick,
    )
    this.treeResidents = treeResidents
    this.buildingResidents = buildingResidents
    this.wallResidents = wallResidents
    const preWorld = new Container({ label: 'boneyard-direct-pre-world' })
    preWorld.eventMode = 'none'
    preWorld.sortableChildren = true
    preWorld.zIndex = NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX / 2
    root.addChild(preWorld)
    this.primarySpells = PrimarySpellWorldView.forBoneyard(root, textures)
    this.secondaryAbilities = new NativeSecondaryWorldView(root, textures, renderer, {
      preWorldRoot: preWorld,
    })
    this.staticPainterLayers = mainLayers.map((layer, layerIndex) => ({
      layerIndex,
      worldY: layer.worldY,
      sortBias: layer.sortBias,
      sourceOrder: layer.sourceOrder,
      insertions: nativeStaticProxyInsertions(layer),
    }))
    this.movingGatePainterLayers = this.staticPainterLayers.filter((layer) => (
      isMovingGateBody(this.mainLayers[layer.layerIndex])
    ))
    this.gates = new BoneyardGateViews(root, textures)
    this.goodies = new NativeGoodieViews(root, textures)
    this.enemies = new NativeEnemyViews(root, textures, preWorld)
    this.enemyDeathEffects = new NativeEnemyDeathEffectViews(root, textures, preWorld)
    this.enemyProjectileEffects = new NativeEnemyProjectileEffectViews(root, textures)
    this.enemyProjectiles = new NativeEnemyProjectileViews(root, textures)
    this.maggots = new NativeMaggotViews(root, textures)
    this.loot = new NativeLootViews(root, textures, modTextures, modCatalog)
    this.seeker = new NativeHagathaSeekerView(root)
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
    const materializingPlayerIds = new Set(snapshot.materializingPlayerIds)
    for (const playerId in snapshot.players) {
      if (materializingPlayerIds.has(playerId)) continue
      const player = snapshot.players[playerId]
      livePlayerIds.add(playerId)
      let view = this.players.get(playerId)
      if (!view) {
        view = new PlayerWorldView(player.config.element, this.textures, this.modTextures, this.renderer, true)
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
    const pointGainAt = (position: Readonly<{ x: number, y: number }>): number => (
      nativeRegionPointGain(
        position,
        { x: camera.x, y: camera.y },
        weatherBounds.w,
        localPlayer.progression.lifeState !== 'alive',
      )
    )
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
      pointGainAt,
    )
    this.secondaryAbilities.update(
      snapshot.secondaryAbilities,
      `boneyard:${snapshot.world.runId}`,
      presentationFrame,
      pointGainAt,
    )
    this.gates.update(snapshot.world.gateLeaves)
    this.goodies.update(snapshot.world.goodies, snapshot.tick)
    this.enemies.update(enemySnapshots, snapshot.tick)
    const visibleWorldBounds = boneyardVisibleWorldBounds(camera, viewport)
    this.enemyDeathEffects.update(
      snapshot.world.deathEffects,
      visibleWorldBounds,
    )
    this.enemyProjectileEffects.update(snapshot.world.enemyProjectileEffects)
    this.enemyProjectiles.update(snapshot.world.enemyProjectiles, snapshot.tick)
    this.maggots.update(snapshot.world.maggots, visibleWorldBounds)
    const visibleMaggots = this.maggots.visibleSnapshots
    this.loot.update(snapshot.world.loot)
    this.seeker.update(snapshot, localPlayerId)
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
      if (materializingPlayerIds.has(playerId)) continue
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
    for (const effect of snapshot.world.enemyProjectileEffects) {
      const candidate = nativeEnemyProjectileEffectLightProvider(effect)
      if (!candidate) continue
      const registration = requiredLightRegistration(
        effect.lightRegistration,
        `enemy projectile effect ${effect.id}`,
      )
      if (registration.managerLane !== candidate.lane) {
        throw new Error(`enemy projectile effect ${effect.id} changed native light-manager lane`)
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
        effect.kind === 'fire-ember'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: [nativeFireEmberLightSource(effect, presentationFrame)],
        })
        continue
      }
      if (
        effect.kind === 'fire-explosion'
        && effect.worldKey === `boneyard:${snapshot.world.runId}`
      ) {
        const source = nativeFireExplosionLightSource(
          effect,
          this.primarySpells.fireExplosionPointGain(effect.id)
            ?? pointGainAt(effect.origin),
          settings.multipleShadows,
        )
        lightProviderOwners.push({
          registration: effect.lightRegistration,
          sources: source === null ? [] : [source],
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
      const pointGain = actor.kind === 'ring-fire-explosion'
        ? (this.secondaryAbilities.fireExplosionPointGain(actor.id)
          ?? pointGainAt(actor.position))
        : 1
      const source = nativeSecondaryProviderLightSource(
        actor,
        presentationFrame,
        settings.multipleShadows,
        pointGain,
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
    for (const owner of mergeNativeWorldManagerOwners(
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
    const enemyLightRegistrations = this.enemyLightRegistrations
    enemyLightRegistrations.clear()
    for (const enemy of snapshot.world.enemies) {
      enemyLightRegistrations.set(enemy.id, enemy.lightRegistration)
    }
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
    lightMiscBatches.sort((first, second) => (
      first.miscLightAppendOrdinal - second.miscLightAppendOrdinal
      || first.birthTick - second.birthTick
      || first.id - second.id
    ))
    for (const batch of mergeNativeWorldManagerOwners(
      [lightMiscBatches],
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
    let monumentVisibleCount = 0
    for (const resident of visibleMainResidents) {
      const layerIndex = resident.mainLayerIndex
      if (layerIndex === null) continue
      const layer = this.mainLayers[layerIndex]
      if (isBuildingLayer(layer)) continue
      if (layer.kind === 'object' && layer.object.typeId === NATIVE.monument) {
        monumentVisibleCount += 1
      }
      const scalar = worldLightScalar(layer.pos)
      resident.sprite.tint = nativeBoneyardLightTint(scalar)
      maxMainLightScalar = Math.max(maxMainLightScalar, scalar)
      minMainLightScalar = Math.min(minMainLightScalar, scalar)
    }
    let buildingBaseRoofColorMismatchCount = 0
    let buildingVertexLightMaximum = 0
    let buildingVertexLightMinimum = 1
    let buildingVisibleCount = 0
    for (const building of this.buildingResidents.values()) {
      if (!building.main.sprite.renderable) continue
      buildingVisibleCount += 1
      for (let index = 0; index < building.samplePoints.length; index += 1) {
        const scalar = settings.complexLighting
          ? nativeBoneyardSurfaceLightScalar(
              building.samplePoints[index]!,
              this.lightIndex,
            )
          : 1
        building.scalars[index] = scalar
        buildingVertexLightMaximum = Math.max(buildingVertexLightMaximum, scalar)
        buildingVertexLightMinimum = Math.min(buildingVertexLightMinimum, scalar)
        maxMainLightScalar = Math.max(maxMainLightScalar, scalar)
        minMainLightScalar = Math.min(minMainLightScalar, scalar)
      }
      building.main.surfaceMesh.update(building.scalars)
      building.roof.surfaceMesh.update(building.scalars)
      building.main.sprite.tint = 0xffffff
      building.roof.sprite.tint = 0xffffff
      if (!equalBytes(
        building.main.surfaceMesh.colors,
        building.roof.surfaceMesh.colors,
      )) {
        buildingBaseRoofColorMismatchCount += 1
      }
    }
    let wallVertexLightMaximum = 0
    let wallVertexLightMinimum = 1
    let wallVisibleCount = 0
    for (const wall of this.wallResidents.values()) {
      if (!wall.resident.sprite.renderable) continue
      wallVisibleCount += 1
      const startScalar = settings.complexLighting
        ? nativeBoneyardSurfaceLightScalar(wall.start, this.lightIndex)
        : 1
      const endScalar = settings.complexLighting
        ? nativeBoneyardSurfaceLightScalar(wall.end, this.lightIndex)
        : 1
      writeNativeWallVertexScalars(
        wall.scalars,
        wall.vertexWeights,
        startScalar,
        endScalar,
      )
      wall.resident.surfaceMesh.update(wall.scalars)
      wall.resident.sprite.tint = 0xffffff
      for (const scalar of wall.scalars) {
        wallVertexLightMaximum = Math.max(wallVertexLightMaximum, scalar)
        wallVertexLightMinimum = Math.min(wallVertexLightMinimum, scalar)
        maxMainLightScalar = Math.max(maxMainLightScalar, scalar)
        minMainLightScalar = Math.min(minMainLightScalar, scalar)
      }
    }
    const treePresentations = this.treeOcclusion.update(
      snapshot.tick,
      localPlayer.position,
    )
    const earthquakeTreeWobbles = this.earthquakeTreeWobbles
    earthquakeTreeWobbles.clear()
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
      tree.proxy.sprite.alpha = presentation.alpha
      tree.main.sprite.tint = tint
      tree.proxy.sprite.tint = tint
      const wobbleRadians = (earthquakeTreeWobbles.get(presentation.eid) ?? 0)
        * Math.PI / 180
      for (const resident of [tree.main, tree.proxy]) {
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
      if (tree.main.sprite.alpha !== tree.proxy.sprite.alpha) {
        treeAlphaMismatchCount += 1
      }
      if (tree.main.sprite.tint !== tree.proxy.sprite.tint) {
        treeTintMismatchCount += 1
      }
    }
    for (const [id, view] of this.players) {
      const player = snapshot.players[id]
      if (!player) continue
      view.setWorldTint(nativeBoneyardLightTint(worldLightScalar(player.position)))
    }
    const playerDeathWeaponPainterLayers = this.playerDeathWeapons.painterLayers()
    const primarySpellPainterLayers = this.primarySpells.painterLayers()
    const secondaryAbilityPainterLayers = this.secondaryAbilities.painterLayers()
    for (const layer of playerDeathWeaponPainterLayers) {
      this.playerDeathWeapons.setTint(
        layer.playerId,
        nativeBoneyardLightTint(worldLightScalar(layer.position)),
      )
    }
    for (const layer of primarySpellPainterLayers) {
      if (!layer.regionLightPoint) continue
      this.primarySpells.setTint(
        layer.id,
        nativeBoneyardLightTint(worldLightScalar(layer.regionLightPoint)),
      )
    }
    for (const layer of secondaryAbilityPainterLayers) {
      if (!layer.regionLightPoint) continue
      this.secondaryAbilities.setTint(
        layer.id,
        nativeBoneyardLightTint(worldLightScalar(layer.regionLightPoint)),
      )
    }
    const secondaryEffectsByTarget = this.secondaryEffectsByTarget
    secondaryEffectsByTarget.clear()
    for (const effect of snapshot.secondaryAbilities.targetEffects) {
      if (effect.worldKey === `boneyard:${snapshot.world.runId}`) {
        secondaryEffectsByTarget.set(effect.targetId, effect)
      }
    }
    for (const enemy of enemySnapshots) {
      const lightTint = nativeBoneyardLightTint(worldLightScalar(enemy.position))
      this.enemies.setTint(enemy.id, nativeSecondaryTargetMaterialTint(
        lightTint,
        secondaryEffectsByTarget.get(enemy.id),
      ))
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
    for (const maggot of visibleMaggots) {
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
        : { bodyTint: 0xffffff, dirtTint: 0xffffff, lanternTint: 0xffffff })
    }

    const gateLeaves = this.gateLeaves
    gateLeaves.clear()
    for (const leaf of snapshot.world.gateLeaves) {
      gateLeaves.set(`${leaf.fenceEid}:${leaf.side}`, leaf)
    }
    const dynamicLayers = this.dynamicLayers
    dynamicLayers.length = 0
    const enemyAuxiliaryPainterLayers = this.enemies.painterLayers()
    for (const playerId in snapshot.players) {
      if (materializingPlayerIds.has(playerId)) continue
      const player = snapshot.players[playerId]
      dynamicLayers.push({
        id: `player:${playerId}`,
        queueFamily: 'ordinary-dynamic',
        registration: player.lighting.lightRegistration,
        worldY: player.position.y,
        sortBias: boneyardPlayerSortBias(player),
      })
    }
    for (const layer of playerDeathWeaponPainterLayers) {
      const playerId = layer.id.slice('player-death-weapon:'.length)
      const registration = snapshot.players[playerId]
        ?.lighting.deathWeaponPainterRegistration
      if (!registration) {
        throw new Error(`death weapon ${playerId} lost its painter registration`)
      }
      dynamicLayers.push({
        id: layer.id,
        queueFamily: 'ordinary-dynamic',
        registration,
        worldY: layer.worldY,
        sortBias: 0,
      })
    }
    for (const layer of primarySpellPainterLayers) {
      if (layer.lane !== 'world-sorted' || layer.queueFamily === null) continue
      dynamicLayers.push(layer as DynamicPainterLayer)
    }
    for (const layer of mageLightningPainterLayers) {
      if (layer.lane !== 'world-sorted' || layer.queueFamily === null) continue
      if (layer.registration === null || layer.registration === undefined) {
        throw new Error(`Mage lightning painter ${layer.id} lost its registration`)
      }
      dynamicLayers.push({
        id: layer.id,
        insertions: layer.insertions,
        queueFamily: layer.queueFamily,
        registration: layer.registration,
        worldY: layer.worldY,
        sortBias: layer.sortBias,
        visible: layer.visible,
      })
    }
    for (const layer of secondaryAbilityPainterLayers) {
      if (layer.lane !== 'world-sorted' || layer.queueFamily === null) continue
      if (layer.registration === null || layer.registration === undefined) {
        throw new Error(`secondary painter ${layer.id} lost its manager registration`)
      }
      dynamicLayers.push(layer as DynamicPainterLayer)
    }
    for (const enemy of enemySnapshots) {
      dynamicLayers.push(nativeEnemyPainterLayer(enemy))
    }
    for (const actor of snapshot.world.loot) {
      dynamicLayers.push(nativeLootPainterLayer(actor))
    }
    for (const goodie of snapshot.world.goodies) {
      dynamicLayers.push(nativeGoodiePainterLayer(goodie))
    }
    for (const effect of snapshot.world.deathEffects) {
      if (!this.enemyDeathEffects.isVisible(effect.id)) continue
      if (nativeEnemyDeathEffectPainterLane(effect) !== 'world-sorted') continue
      dynamicLayers.push(nativeEnemyDeathEffectPainterLayer(effect))
    }
    for (const projectile of snapshot.world.enemyProjectiles) {
      dynamicLayers.push({
        id: `enemy-projectile:${projectile.id}`,
        queueFamily: 'ordinary-dynamic',
        registration: projectile.painterRegistration,
        worldY: projectile.position.y,
        sortBias: 0,
      })
    }
    for (const effect of snapshot.world.enemyProjectileEffects) {
      dynamicLayers.push(nativeEnemyProjectileEffectPainterLayer(effect))
    }
    for (const layer of enemyAuxiliaryPainterLayers) {
      if (layer.lane !== 'world-sorted' || layer.queueFamily === null) continue
      if (layer.registration === null) {
        throw new Error(`enemy auxiliary painter ${layer.id} lost its registration`)
      }
      dynamicLayers.push({
        id: layer.id,
        queueFamily: layer.queueFamily,
        registration: layer.registration,
        worldY: layer.worldY,
        sortBias: layer.sortBias,
      })
    }
    for (const maggot of visibleMaggots) {
      dynamicLayers.push({
        id: `maggot:${maggot.id}`,
        queueFamily: 'ordinary-dynamic',
        registration: maggot.lightRegistration,
        worldY: maggot.position.y,
        sortBias: 0,
      })
    }
    if (dig) {
      if (
        snapshot.world.lanternLightRegistration === null
        || snapshot.world.solomonPainterRegistration === null
      ) {
        throw new Error('Solomon set piece lost its native painter registrations')
      }
      dynamicLayers.push(...boneyardSolomonPainterLayers(
        dig,
        snapshot.world.encounter,
        snapshot.world.lanternLightRegistration,
        snapshot.world.solomonPainterRegistration,
      ))
    }
    const activeStaticPainterLayers = this.activeStaticPainterLayers
    activeStaticPainterLayers.length = 0
    const visibleShadowDepthOwners = this.visibleShadowDepthOwners
    visibleShadowDepthOwners.length = 0
    for (const resident of visibleMainResidents) {
      const layerIndex = resident.mainLayerIndex
      if (layerIndex === null) continue
      const mainLayer = this.mainLayers[layerIndex]
      if (mainLayer.kind === 'object' && mainLayer.object.typeId === NATIVE.goodie) {
        continue
      }
      const layer = this.staticPainterLayers[layerIndex]!
      layer.worldY = runtimeMainWorldY(this.mainLayers[layer.layerIndex], gateLeaves)
      activeStaticPainterLayers.push(layer)
      if (resident.shadowCaster) visibleShadowDepthOwners.push(resident.sprite)
    }
    for (const layer of this.movingGatePainterLayers) {
      layer.worldY = runtimeMainWorldY(this.mainLayers[layer.layerIndex], gateLeaves)
      activeStaticPainterLayers.push(layer)
    }
    const order = this.painterOrderPlanner.build({
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
      if (layer.id.startsWith('mage-lightning:')) {
        this.mageLightningPulses.setDepth(layer.id, layer.zIndex)
      }
    }
    for (const layer of order.proxyLayers) {
      if (layer.id.startsWith('proxy:tree:')) {
        const resident = this.treeResidents.get(layer.id.slice('proxy:tree:'.length))
        if (resident) resident.proxy.sprite.zIndex = layer.zIndex
      } else if (layer.id.startsWith('proxy:building:')) {
        const resident = this.buildingResidents.get(
          layer.id.slice('proxy:building:'.length),
        )
        if (resident) resident.roof.sprite.zIndex = layer.zIndex
      }
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
    this.seeker.setDepth(
      (positionedDynamics.get(`player:${localPlayerId}`)?.zIndex ?? 1) + 0.25,
    )
    this.primarySpells.applyBoneyardPainterDepths(
      order.dynamicLayers,
      order.foregroundZIndex + 0.5,
    )
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
    for (const layer of secondaryAbilityPainterLayers) {
      this.secondaryAbilities.setDepth(
        layer.id,
        layer.lane === 'pre-world-queue'
          ? 0.5
          : positionedDynamics.get(layer.id)?.zIndex ?? 1,
      )
      applyInsertedPainterDepths(
        layer.insertions,
        positionedDynamics,
        (id, depth) => this.secondaryAbilities.setDepth(id, depth),
      )
    }
    for (const enemy of enemySnapshots) {
      this.enemies.setDepth(
        enemy.id,
        positionedDynamics.get(`enemy:${enemy.id}`)?.zIndex ?? 1,
      )
    }
    for (const layer of enemyAuxiliaryPainterLayers) {
      const depth = layer.lane === 'pre-world-queue'
        ? 0.5
        : layer.lane === 'post-world-queue'
          ? order.foregroundZIndex + 0.25
          : positionedDynamics.get(layer.id)?.zIndex ?? 1
      this.enemies.setAuxiliaryEffectDepth(layer.eventId, depth)
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
        order.foregroundZIndex + 0.75,
      )
    }
    for (const goodie of snapshot.world.goodies) {
      this.goodies.setDepth(
        goodie.id,
        positionedDynamics.get(`goodie:${goodie.id}`)?.zIndex ?? 1,
      )
    }
    for (const effect of snapshot.world.deathEffects) {
      if (!this.enemyDeathEffects.isVisible(effect.id)) continue
      const lane = nativeEnemyDeathEffectPainterLane(effect)
      this.enemyDeathEffects.setDepth(
        effect.id,
        lane === 'pre-world-queue'
          ? 0.5
          : lane === 'post-world-queue'
            ? order.foregroundZIndex + 0.25
            : positionedDynamics.get(`enemy-death-effect:${effect.id}`)?.zIndex ?? 1,
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
    for (const maggot of visibleMaggots) {
      this.maggots.setDepth(
        maggot.id,
        positionedDynamics.get(`maggot:${maggot.id}`)?.zIndex ?? 1,
      )
    }
    const solomonPainter = positionedDynamics.get('solomon-actor')
    const lanternPainter = positionedDynamics.get('lantern')
    this.solomon?.setActorDepth(solomonPainter?.zIndex ?? 1)
    this.solomon?.setLanternDepth(lanternPainter?.zIndex ?? 1)
    const weatherLightingOrder = nativeBoneyardWeatherLightingOrder(
      order.foregroundZIndex,
      settings.complexLighting,
    )
    this.weatherView.setDepth(weatherLightingOrder)
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
      buildingBaseRoofColorMismatchCount,
      buildingCount: this.buildingResidents.size,
      buildingVertexLightMaximum,
      buildingVertexLightMinimum: buildingVisibleCount > 0
        ? buildingVertexLightMinimum
        : 0,
      buildingVisibleCount,
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
      lanternPainterRow: lanternPainter?.row ?? Number.NaN,
      lanternZIndex: lanternPainter?.zIndex ?? Number.NaN,
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
      monumentVisibleCount,
      painterBandCount: order.bands.length,
      painterOrder: order.orderedLayers,
      painterProxyOrder: order.proxyLayers,
      playerLightRadius: localPlayerLight?.radius ?? 0,
      playerLightRasterRadius: localPlayerLight?.rasterScale ?? 0,
      treeAlphaMismatchCount,
      treeCount: treePresentations.length,
      treeProxyResidentCount: this.treeResidents.size,
      treeTintMismatchCount,
      solomonPainterRow: solomonPainter?.row ?? Number.NaN,
      solomonZIndex: solomonPainter?.zIndex ?? Number.NaN,
      weatherLightingOrder,
      wallCount: this.wallResidents.size,
      wallVertexLightMaximum,
      wallVertexLightMinimum: wallVisibleCount > 0 ? wallVertexLightMinimum : 0,
      wallVisibleCount,
    }
  }

  get playerCount(): number {
    return this.players.size
  }

  get enemyCount(): number {
    return this.enemies.size
  }

  enemyBodyEntry(id: number): number | null {
    return this.enemies.bodyEntry(id)
  }

  enemyLimbsEntry(id: number): number | null {
    return this.enemies.limbsEntry(id)
  }

  enemyScale(id: number): number | null {
    return this.enemies.scale(id)
  }

  get enemyAuxiliaryEffectCount(): number {
    return this.enemies.auxiliaryEffectCount
  }

  get enemyAuxiliaryEffectLanes(): readonly string[] {
    return this.enemies.painterLayers().map(({ lane }) => lane)
  }

  get enemyDeathEffectCount(): number {
    return this.enemyDeathEffects.size
  }

  get visibleEnemyDeathEffectCount(): number {
    return this.enemyDeathEffects.visibleSize
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

  get maggotVisibleCount(): number {
    return this.maggots.visibleSize
  }

  get maggotCulledCount(): number {
    return this.maggots.size - this.maggots.visibleSize
  }

  get lootCount(): number {
    return this.loot.size
  }

  get seekerSegmentCount(): number {
    return this.seeker.segmentCount
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

  get primarySpellPainterDepths() {
    return this.primarySpells.painterDepths
  }

  get primaryHailMeshCount(): number {
    return this.primarySpells.hailMeshCount
  }

  get primaryHailMeshRunCount(): number {
    return this.primarySpells.hailMeshRunCount
  }

  get primarySpellKinds(): readonly string[] {
    return this.primarySpells.kinds
  }

  get primaryWaterMeshActorCount(): number {
    return this.primarySpells.waterMeshActorCount
  }

  get primaryWaterAuraMeshCount(): number {
    return this.primarySpells.waterAuraMeshCount
  }

  get primaryWaterMeshNormalFrostCount(): number {
    return this.primarySpells.waterMeshNormalFrostCount
  }

  get primaryWaterMeshRunCount(): number {
    return this.primarySpells.waterMeshRunCount
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

  get solomonBodyOffsetY(): number {
    return this.solomon?.bodyOffsetY ?? 0
  }

  get solomonBodyTint(): number {
    return this.solomon?.bodyTint ?? 0xffffff
  }

  get solomonClipRectWorld(): BoneyardSolomonClipRect | null {
    return this.solomon?.clipRectWorld ?? null
  }

  get solomonDirtTint(): number {
    return this.solomon?.dirtTint ?? 0xffffff
  }

  get solomonGraveMarkTint(): number {
    return this.solomon?.graveMarkTint ?? 0xffffff
  }

  get solomonGraveMarkPassCount(): number {
    return this.solomon?.graveMarkPassCount ?? 0
  }

  get solomonDirtCount(): number {
    return this.solomon?.dirtCount ?? 0
  }

  get solomonDirtPassCount(): number {
    return this.solomon?.dirtPassCount ?? 0
  }

  get solomonDirt() {
    return this.solomon?.dirt ?? null
  }

  destroy(): void {
    this.painterOrderPlanner.clear()
    this.complexShadows.destroy()
    this.primarySpells.destroy()
    this.secondaryAbilities.destroy()
    this.enemies.destroy()
    this.enemyDeathEffects.destroy()
    this.enemyProjectileEffects.destroy()
    this.enemyProjectiles.destroy()
    this.maggots.destroy()
    this.loot.destroy()
    this.seeker.destroy()
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
  private readonly dirtRoot = new Container({ label: 'solomon-flydirt' })
  private readonly dirtViews = new Map<number, BoneyardSolomonDirtView>()
  private readonly digState: SolomonDigState
  private readonly graveMark: Sprite
  private readonly lantern: Sprite
  private readonly mouth: Sprite
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private currentFrame = 2
  private currentClipRectWorld: BoneyardSolomonClipRect | null = null
  private lastDigEventId: number | null = null

  constructor(
    boneyard: LoadedBoneyard,
    root: Container,
    textures: BoneyardWorldTextures,
  ) {
    const state = boneyard.scene.solomonDig!
    this.root = root
    this.textures = textures
    this.digState = state
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
    this.graveMark = plantedSprite(
      textures.solomonGraveMark,
      requiredSpriteRef(13),
      { x: -10, y: -113 },
    )
    this.graveMark.zIndex = 2
    this.dirtRoot.zIndex = 3
    this.actorRoot.position.set(state.position.x, state.position.y)
    this.actorRoot.sortableChildren = true
    this.actorRoot.addChild(
      this.body,
      this.mouth,
      this.graveMark,
      this.clipMask,
      this.dirtRoot,
    )
    root.addChild(this.actorRoot, this.lantern)
  }

  update(encounter: BoneyardSolomonSnapshot | null, tick: number): void {
    if (encounter === null) {
      this.clearDirt()
      this.lastDigEventId = null
      const programIndex = Math.floor(tick / this.digState.ticksPerFrame)
        % this.digState.frameProgram.length
      const frame = this.digState.frameProgram[programIndex]
      this.currentFrame = frame + 2
      this.body.texture = this.textures.solomonDig[frame]
      this.actorRoot.position.set(this.digState.position.x, this.digState.position.y)
      this.actorRoot.visible = true
      this.body.position.y = 5
      this.currentClipRectWorld = {
        height: 100,
        width: 200,
        x: this.digState.position.x - 100,
        y: this.digState.position.y - 100,
      }
      this.clipMask.clear().rect(-100, -100, 200, 100).fill(0xffffff)
      this.body.mask = this.clipMask
      this.mouth.mask = null
      this.mouth.visible = false
      this.graveMark.visible = true
      return
    }
    this.updateDirt(encounter, tick)
    const visual = boneyardSolomonVisualState(encounter, this.digState, tick)
    this.currentClipRectWorld = visual.clipRectWorld
    this.currentFrame = visual.nativeBodyRecord
    this.actorRoot.position.set(
      encounter.position.x,
      encounter.position.y,
    )
    this.actorRoot.visible = visual.visible
    if (!visual.visible) return
    this.body.position.y = visual.offsetY
    this.mouth.position.y = visual.offsetY
    if (visual.clipRectWorld === null) {
      this.body.mask = null
      this.mouth.mask = null
      this.clipMask.clear()
    } else {
      const clipLeft = visual.clipRectWorld.x - encounter.position.x
      const clipTop = visual.clipRectWorld.y - encounter.position.y
      this.clipMask.clear().rect(
        clipLeft,
        clipTop,
        visual.clipRectWorld.width,
        visual.clipRectWorld.height,
      ).fill(0xffffff)
      this.body.mask = this.clipMask
      this.mouth.mask = this.clipMask
    }
    this.graveMark.visible = visual.graveMarkVisible
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

  get bodyOffsetY(): number {
    return this.body.position.y
  }

  get bodyTint(): number {
    return this.body.tint
  }

  get clipRectWorld(): BoneyardSolomonClipRect | null {
    return this.currentClipRectWorld
  }

  get dirtTint(): number {
    return this.dirtRoot.tint
  }

  get graveMarkTint(): number {
    return this.graveMark.tint
  }

  get dirtCount(): number {
    return this.dirtViews.size
  }

  get dirtPassCount(): number {
    return this.dirtViews.size * NATIVE_SOLOMON_DIRT_DRAW_PASSES
  }

  get graveMarkPassCount(): number {
    return Number(this.actorRoot.visible && this.graveMark.visible)
  }

  get dirt(): Readonly<{
    eventId: number
    state: NativeSolomonDirtState
  }> | null {
    let latest: BoneyardSolomonDirtView | null = null
    for (const view of this.dirtViews.values()) {
      if (latest === null || view.eventId > latest.eventId) latest = view
    }
    if (latest === null || latest.state === null) return null
    return { eventId: latest.eventId, state: latest.state }
  }

  setActorDepth(depth: number): void {
    this.actorRoot.zIndex = depth
  }

  setActorRenderable(renderable: boolean): void {
    this.actorRoot.renderable = renderable
  }

  setLanternDepth(depth: number): void {
    this.lantern.zIndex = depth
  }

  setLighting(lighting: NativeSolomonSetPieceLighting): void {
    this.body.tint = lighting.bodyTint
    this.graveMark.tint = lighting.bodyTint
    this.dirtRoot.tint = lighting.dirtTint
    this.mouth.tint = lighting.bodyTint
    this.lantern.tint = lighting.lanternTint
  }

  destroy(): void {
    this.clearDirt()
    this.root.removeChild(this.actorRoot, this.lantern)
    this.actorRoot.destroy({ children: true })
    this.lantern.destroy()
  }

  private updateDirt(encounter: BoneyardSolomonSnapshot, tick: number): void {
    const delta = nativeSolomonDirtEventDelta(
      this.lastDigEventId,
      encounter.digEvents,
    )
    this.lastDigEventId = delta.eventId
    for (const event of delta.events) {
      const ageTicks = Math.floor(tick - event.tick)
      if (ageTicks >= 0 && ageTicks < NATIVE_SOLOMON_DIRT_VISIBLE_TICKS) {
        this.dirtViews.set(event.id, new BoneyardSolomonDirtView(
          this.dirtRoot,
          this.textures.solomonFlydirt,
          event.id,
          event.tick,
          encounter.position,
        ))
      }
    }

    for (const [eventId, view] of this.dirtViews) {
      if (view.update(tick, encounter.position)) continue
      view.destroy()
      this.dirtViews.delete(eventId)
    }
  }

  private clearDirt(): void {
    for (const view of this.dirtViews.values()) view.destroy()
    this.dirtViews.clear()
  }
}

class BoneyardSolomonDirtView {
  readonly eventId: number
  state: NativeSolomonDirtState | null = null

  private readonly birthPosition: Readonly<{ x: number; y: number }>
  private readonly birthTick: number
  private readonly root: Container
  private readonly sprites: readonly Sprite[]

  constructor(
    root: Container,
    texture: Texture,
    eventId: number,
    birthTick: number,
    birthPosition: Readonly<{ x: number; y: number }>,
  ) {
    this.root = root
    this.eventId = eventId
    this.birthTick = birthTick
    this.birthPosition = { ...birthPosition }
    this.sprites = Array.from(
      { length: NATIVE_SOLOMON_DIRT_DRAW_PASSES },
      () => {
        const sprite = new Sprite(texture)
        sprite.anchor.set(0.5)
        root.addChild(sprite)
        return sprite
      },
    )
  }

  update(
    tick: number,
    actorPosition: Readonly<{ x: number; y: number }>,
  ): boolean {
    const ageTicks = Math.floor(tick - this.birthTick)
    if (ageTicks < 0) return true
    const state = nativeSolomonDirtStateAt(this.birthPosition, ageTicks)
    this.state = state
    if (state === null) return false
    const operations = nativeSolomonDirtDrawOperations(state)
    for (let index = 0; index < this.sprites.length; index += 1) {
      const sprite = this.sprites[index]!
      const operation = operations[index]!
      sprite.alpha = operation.alpha
      sprite.position.set(
        operation.position.x - actorPosition.x,
        operation.position.y - actorPosition.y,
      )
      sprite.rotation = operation.headingDegrees * Math.PI / 180
    }
    return true
  }

  destroy(): void {
    this.root.removeChild(...this.sprites)
    for (const sprite of this.sprites) sprite.destroy()
    this.state = null
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
  scene: LoadedBoneyard['scene'],
  root: Container,
  surfaceTextures: NativeBoneyardSurfaceTextures,
  cleanupBounds: Readonly<BoneyardBounds> | null,
): Promise<StaticWorldBuild> {
  const base = new Container({ label: 'boneyard-base' })
  base.zIndex = 0
  root.addChild(base)
  const residents: ResidentTexture[] = []
  const activeResidents: ResidentTexture[] = []
  const visualBoundsBySource = new Map<string, BoneyardBounds>()
  const buildingMainResidents = new Map<string, {
    resident: BuildingResidents['main']
    samplePoints: readonly Vec2[]
  }>()
  const buildingResidents = new Map<string, BuildingResidents>()
  const mainResidents = new Map<number, ResidentTexture>()
  const shadowCasters: BoneyardComplexShadowStaticCaster[] = []
  const treeMainResidents = new Map<string, ResidentTexture>()
  const treeInputs: NativeTreeOcclusionInput[] = []
  const treeResidents = new Map<string, TreeResidents>()
  const wallResidents = new Map<number, WallResident>()
  const residentScratch = documentNodeCanvas(0, 0)
  const surface = new NativeBoneyardSurfaceView(base, scene, surfaceTextures)
  let staticPaintCount = 0
  let fullBaseResidents: ResidentTexture[] = []
  let cleanupPlan: ReturnType<typeof boneyardOffCameraCleanupPlan> | null = null
  const mainLayers = nativeBoneyardMainLayers(document)
  const wallLayers = nativeBoneyardPreMainWallLayers(document)
  const wallSourceKeys = new Set(wallLayers.map((layer) => `fence:${layer.fence.eid}`))
  try {
    fullBaseResidents = await buildTiledStaticLayer(
      document,
      base,
      true,
      (context, width, height, camera) => {
        drawNativeBoneyardPostRoadBase(
          context,
          width,
          height,
          camera,
          document,
          [],
          wallSourceKeys,
        )
        staticPaintCount += 1
      },
    )
    residents.push(...fullBaseResidents)
    activeResidents.push(...fullBaseResidents)

    for (let layerIndex = 0; layerIndex < wallLayers.length; layerIndex += 1) {
      const layer = wallLayers[layerIndex]!
      const resident = buildPreMainWallResident(
        document,
        layer,
        layerIndex,
        mainLayers.length + layerIndex,
        residentScratch,
      )
      staticPaintCount += 1
      if (resident) {
        base.addChild(resident.sprite)
        residents.push(resident)
        activeResidents.push(resident)
        const shadowCaster = resident.shadowCaster
        if (shadowCaster?.program?.kind !== 'wall') {
          throw new Error(`Wall ${layer.fence.eid} lost its native shadow program.`)
        }
        shadowCasters.push({ caster: shadowCaster, depthOwner: resident.sprite })
        wallResidents.set(layerIndex, {
          end: { ...shadowCaster.program.end },
          resident: resident as WallResident['resident'],
          scalars: new Float32Array(4),
          start: { ...shadowCaster.program.start },
          vertexWeights: nativeWallSurfaceVertexWeights(
            resident,
            shadowCaster.program.start,
            shadowCaster.program.end,
          ),
        })
      }
      if (layerIndex % 12 === 11) await nextFrame()
    }

    for (let layerIndex = 0; layerIndex < mainLayers.length; layerIndex += 1) {
      const layer = mainLayers[layerIndex]
      if (isMovingGateBody(layer)) continue
      const resident = buildMainLayerResident(document, layer, layerIndex, residentScratch)
      staticPaintCount += 1
      if (resident) {
        resident.cleanupSourceKey = layer.kind === 'object'
          ? `object:${layer.object.eid}`
          : null
        mergeCleanupSourceBounds(visualBoundsBySource, resident)
        if (layer.kind === 'object' && layer.object.typeId === NATIVE.goodie) {
          resident.sprite.alpha = 0
        }
        root.addChild(resident.sprite)
        residents.push(resident)
        activeResidents.push(resident)
        mainResidents.set(layerIndex, resident)
        if (resident.shadowCaster) {
          shadowCasters.push({ caster: resident.shadowCaster, depthOwner: resident.sprite })
        }
        if (layer.kind === 'object' && layer.object.typeId === NATIVE.tree) {
          treeMainResidents.set(layer.object.eid, resident)
        }
        if (layer.kind === 'object' && layer.object.typeId === NATIVE.building) {
          if (!resident.surfaceMesh) {
            throw new Error(`Building ${layer.object.eid} main art is not a surface mesh.`)
          }
          const sprite = spriteRefFor(layer.atlas, layer.atlasEntry)
          if (!sprite) throw new Error(`Building ${layer.object.eid} has no native base glyph.`)
          buildingMainResidents.set(layer.object.eid, {
            resident: resident as BuildingResidents['main'],
            samplePoints: nativeBuildingLightGrid({
              enhancedEffects: NATIVE_BROWSER_ENHANCED_EFFECTS,
              position: layer.object.pos,
              sprite,
              variant: layer.object.variant ?? 0,
            }),
          })
        }
      }
      if (layerIndex % 12 === 11) await nextFrame()
    }

    const proxyLayers = nativeBoneyardProxyLayers(document)
    for (let layerIndex = 0; layerIndex < proxyLayers.length; layerIndex += 1) {
      const layer = proxyLayers[layerIndex]
      const resident = buildProxyLayerResident(
        document,
        layer,
        layerIndex,
        residentScratch,
      )
      staticPaintCount += 1
      if (resident) {
        resident.cleanupSourceKey = `object:${layer.object.eid}`
        mergeCleanupSourceBounds(visualBoundsBySource, resident)
        root.addChild(resident.sprite)
        residents.push(resident)
        activeResidents.push(resident)
        if (layer.object.typeId === NATIVE.tree) {
          const main = treeMainResidents.get(layer.object.eid)
          if (!main) {
            throw new Error(`Tree ${layer.object.eid} has proxy art without main art.`)
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
          treeResidents.set(object.eid, { proxy: resident, main })
        }
        if (layer.object.typeId === NATIVE.building) {
          const main = buildingMainResidents.get(layer.object.eid)
          if (!main) {
            throw new Error(`Building ${layer.object.eid} has roof art without main art.`)
          }
          if (!resident.surfaceMesh) {
            throw new Error(`Building ${layer.object.eid} roof art is not a surface mesh.`)
          }
          buildingResidents.set(layer.object.eid, {
            main: main.resident,
            roof: resident as BuildingResidents['roof'],
            samplePoints: main.samplePoints,
            scalars: new Float32Array(main.samplePoints.length),
          })
        }
      }
      if (layerIndex % 12 === 11) await nextFrame()
    }

    if (cleanupBounds !== null) {
      for (const source of document.sprites) {
        const sprite = source as typeof source & { deadHawgEntry?: number }
        const ref = spriteRefFor('DeadHawg', sprite.deadHawgEntry ?? 114 + sprite.atlasEntry)
        if (ref === null) continue
        const scale = Number.isFinite(sprite.s1) ? Math.max(0, sprite.s1) : 1
        visualBoundsBySource.set(
          `sprite:${sprite.eid}`,
          boneyardTransformedArtBounds(
            sprite.pos,
            ref,
            Number.isFinite(sprite.s0) ? sprite.s0 : 0,
            scale * ((sprite.flags & 1) !== 0 ? 0.8 : 1),
            scale,
          ),
        )
      }
      cleanupPlan = boneyardOffCameraCleanupPlan(
        document,
        cleanupBounds,
        visualBoundsBySource,
      )
    }
  } catch (error) {
    surface.destroy()
    for (const resident of residents) destroyResidentTexture(resident)
    throw error
  }
  if (buildingResidents.size !== buildingMainResidents.size) {
    surface.destroy()
    for (const resident of residents) destroyResidentTexture(resident)
    throw new Error('A native Building main resident has no roof resident.')
  }
  const build: StaticWorldBuild = {
    activeResidents,
    applyOffCameraCleanup: () => {
      if (
        build.offCameraCleanupApplied
        || cleanupPlan === null
      ) return
      repaintCleanedBase(
        document,
        fullBaseResidents,
        new Set([...wallSourceKeys, ...cleanupPlan.retiredSourceKeys]),
      )
      surface.applyOffCameraCleanup(cleanupPlan.retiredSourceKeys)
      let retiredStaticResidentCount = 0
      const retainedResidents = activeResidents.filter((resident) => {
        const retired = resident.cleanupSourceKey !== null
          && cleanupPlan!.retiredSourceKeys.has(resident.cleanupSourceKey)
        if (!retired) return true
        resident.sprite.renderable = false
        retiredStaticResidentCount += 1
        return false
      })
      activeResidents.splice(
        0,
        activeResidents.length,
        ...retainedResidents,
      )
      build.offCameraCleanupApplied = true
      build.retiredStaticResidentCount = retiredStaticResidentCount
      build.retiredStaticSourceCount = cleanupPlan.retiredSourceKeys.size
    },
    buildingResidents,
    mainResidents,
    offCameraCleanupApplied: false,
    residents,
    retiredStaticResidentCount: 0,
    retiredStaticSourceCount: 0,
    shadowCasters,
    staticPaintCount,
    surface,
    treeInputs,
    treeResidents,
    wallResidents,
  }
  return build
}

function repaintCleanedBase(
  document: EditorDoc,
  residents: readonly ResidentTexture[],
  retiredSourceKeys: ReadonlySet<string>,
): void {
  const canvas = documentNodeCanvas(0, 0)
  for (const resident of residents) {
    resizeCanvas(canvas, resident.w, resident.h)
    const context = canvas.getContext('2d', { alpha: true })
    if (context === null) {
      throw new Error('Boneyard cleanup base could not reacquire Canvas2D.')
    }
    try {
      drawNativeBoneyardPostRoadBase(
        context,
        resident.w,
        resident.h,
        {
          x: resident.x + resident.w / 2,
          y: resident.y + resident.h / 2,
          zoom: 1,
        },
        document,
        [],
        retiredSourceKeys,
      )
      resident.pixels.set(context.getImageData(0, 0, resident.w, resident.h).data)
    } finally {
      releaseCanvas(canvas)
    }
    resident.texture.source.update()
  }
}

function mergeCleanupSourceBounds(
  boundsBySource: Map<string, BoneyardBounds>,
  resident: ResidentTexture,
): void {
  const key = resident.cleanupSourceKey
  if (key === null) return
  const current = boundsBySource.get(key)
  if (current === undefined) {
    boundsBySource.set(key, {
      h: resident.h,
      w: resident.w,
      x: resident.x,
      y: resident.y,
    })
    return
  }
  const x = Math.min(current.x, resident.x)
  const y = Math.min(current.y, resident.y)
  boundsBySource.set(key, {
    x,
    y,
    w: Math.max(current.x + current.w, resident.x + resident.w) - x,
    h: Math.max(current.y + current.h, resident.y + resident.h) - y,
  })
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
  const canvas = documentNodeCanvas(0, 0)
  for (const tile of boneyardStaticTiles(document.meta.bounds)) {
    const width = Math.ceil(tile.w)
    const height = Math.ceil(tile.h)
    resizeCanvas(canvas, width, height)
    const context = canvas.getContext('2d', { alpha, willReadFrequently: true })
    if (!context) throw new Error('Boneyard static tile could not acquire Canvas2D.')
    paint(
      context,
      width,
      height,
      { x: tile.x + width / 2, y: tile.y + height / 2, zoom: 1 },
    )
    const pixels = consumePaintedCanvas(canvas, alpha)
    if (pixels) {
      const resident = residentTexture(pixels, tile.x + pixels.x, tile.y + pixels.y)
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
  canvas: HTMLCanvasElement,
): ResidentTexture | null {
  const bounds = mainLayerCaptureBounds(layer)
  resizeCanvas(canvas, bounds.w, bounds.h)
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
  const pixels = consumePaintedCanvas(canvas, true)
  if (!pixels) return null
  const x = bounds.x + pixels.x
  const y = bounds.y + pixels.y
  const resident = isBuildingLayer(layer)
    ? buildingSurfaceResidentTexture(pixels, x, y, layerIndex)
    : residentTexture(pixels, x, y, layerIndex)
  resident.shadowCaster = nativeBoneyardMainLayerShadowCaster(
    document,
    layer,
    layerIndex,
  )
  return resident
}

function buildPreMainWallResident(
  document: EditorDoc,
  layer: Extract<MainLayer, { kind: 'fence' }>,
  wallLayerIndex: number,
  shadowLayerIndex: number,
  canvas: HTMLCanvasElement,
): ResidentTexture | null {
  const bounds = mainLayerCaptureBounds(layer)
  resizeCanvas(canvas, bounds.w, bounds.h)
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!context) throw new Error('Boneyard Wall layer could not acquire Canvas2D.')
  drawNativeBoneyardPreMainWallBand(
    context,
    bounds.w,
    bounds.h,
    {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
      zoom: 1,
    },
    document,
    [wallLayerIndex],
  )
  const pixels = consumePaintedCanvas(canvas, true)
  if (!pixels) return null
  const resident = wallSurfaceResidentTexture(
    pixels,
    bounds.x + pixels.x,
    bounds.y + pixels.y,
  )
  resident.shadowCaster = nativeBoneyardMainLayerShadowCaster(
    document,
    layer,
    shadowLayerIndex,
  )
  return resident
}

function buildProxyLayerResident(
  document: EditorDoc,
  layer: ObjectSpriteLayer,
  layerIndex: number,
  canvas: HTMLCanvasElement,
): ResidentTexture | null {
  const bounds = objectLayerCaptureBounds(layer)
  resizeCanvas(canvas, bounds.w, bounds.h)
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!context) throw new Error('Boneyard proxy layer could not acquire Canvas2D.')
  drawNativeBoneyardProxyBand(
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
  const pixels = consumePaintedCanvas(canvas, true)
  if (!pixels) return null
  return layer.object.typeId === NATIVE.building
    ? buildingSurfaceResidentTexture(
        pixels,
        bounds.x + pixels.x,
        bounds.y + pixels.y,
      )
    : residentTexture(pixels, bounds.x + pixels.x, bounds.y + pixels.y)
}

function objectLayerCaptureBounds(
  layer: ObjectSpriteLayer,
): { h: number; w: number; x: number; y: number } {
  const ref = spriteRefFor(layer.atlas, layer.atlasEntry)
  if (!ref) {
    throw new Error(`Missing ${layer.atlas}:${layer.atlasEntry} proxy art.`)
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

function consumePaintedCanvas(
  canvas: HTMLCanvasElement,
  crop: boolean,
): BoneyardStaticPixelRegion | null {
  try {
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
    if (!context) throw new Error('Boneyard texture pixels could not reacquire Canvas2D.')
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    return crop
      ? cropBoneyardStaticPixels(pixels, canvas.width, canvas.height)
      : {
          height: canvas.height,
          pixels: new Uint8ClampedArray(pixels),
          width: canvas.width,
          x: 0,
          y: 0,
        }
  } finally {
    releaseCanvas(canvas)
  }
}

function residentTexture(
  source: BoneyardStaticPixelRegion,
  x: number,
  y: number,
  mainLayerIndex: number | null = null,
): ResidentTexture {
  const texture = residentPixelTexture(source)
  const sprite = new Sprite(texture)
  sprite.position.set(x, y)
  sprite.eventMode = 'none'
  return {
    cleanupSourceKey: null,
    h: source.height,
    mainLayerIndex,
    pixels: source.pixels,
    shadowCaster: null,
    sprite,
    surfaceMesh: null,
    texture,
    w: source.width,
    x,
    y,
  }
}

function buildingSurfaceResidentTexture(
  source: BoneyardStaticPixelRegion,
  x: number,
  y: number,
  mainLayerIndex: number | null = null,
): ResidentTexture {
  const texture = residentPixelTexture(source)
  const surfaceMesh = createNativeBuildingSurfaceMesh(
    texture,
    source.width,
    source.height,
    NATIVE_BROWSER_ENHANCED_EFFECTS,
  )
  surfaceMesh.mesh.position.set(x, y)
  surfaceMesh.mesh.label = mainLayerIndex === null
    ? 'native-building-roof'
    : 'native-building-base'
  return {
    cleanupSourceKey: null,
    h: source.height,
    mainLayerIndex,
    pixels: source.pixels,
    shadowCaster: null,
    sprite: surfaceMesh.mesh,
    surfaceMesh,
    texture,
    w: source.width,
    x,
    y,
  }
}

function wallSurfaceResidentTexture(
  source: BoneyardStaticPixelRegion,
  x: number,
  y: number,
  mainLayerIndex: number | null = null,
): ResidentTexture {
  const texture = residentPixelTexture(source)
  const surfaceMesh = createNativeWallSurfaceMesh(
    texture,
    source.width,
    source.height,
  )
  surfaceMesh.mesh.position.set(x, y)
  surfaceMesh.mesh.label = 'native-wall-body'
  return {
    cleanupSourceKey: null,
    h: source.height,
    mainLayerIndex,
    pixels: source.pixels,
    shadowCaster: null,
    sprite: surfaceMesh.mesh,
    surfaceMesh,
    texture,
    w: source.width,
    x,
    y,
  }
}

function residentPixelTexture(source: BoneyardStaticPixelRegion): Texture {
  return new Texture({
    source: new BufferImageSource({
      alphaMode: 'no-premultiply-alpha',
      format: 'rgba8unorm',
      height: source.height,
      resource: source.pixels,
      scaleMode: 'linear',
      width: source.width,
    }),
  })
}

function destroyResidentTexture(resident: ResidentTexture): void {
  resident.surfaceMesh?.destroy()
  resident.texture.destroy(true)
  resident.pixels = EMPTY_RESIDENT_PIXELS
}

const EMPTY_RESIDENT_PIXELS = new Uint8ClampedArray(0)

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function applyInsertedPainterDepths(
  insertions: readonly NativeRegionPainterInsertion[] | undefined,
  positioned: ReadonlyMap<string, { row: number; zIndex: number }>,
  setDepth: (id: string, depth: number) => void,
): void {
  for (const insertion of insertions ?? []) {
    const layer = positioned.get(insertion.id)
    if (!layer) {
      throw new Error(`inserted native painter ${insertion.id} lost its queue depth`)
    }
    setDepth(insertion.id, layer.zIndex)
    applyInsertedPainterDepths(insertion.insertions, positioned, setDepth)
  }
}

function isBuildingLayer(layer: MainLayer): boolean {
  return layer.kind === 'object' && layer.object.typeId === NATIVE.building
}

function nativeStaticProxyInsertions(layer: MainLayer) {
  if (layer.kind !== 'object') return undefined
  if (layer.object.typeId === NATIVE.tree) {
    const object = layer.object as typeof layer.object & {
      secondaryVisible?: boolean
    }
    if ((object.variant ?? 0) >= 6 || object.secondaryVisible === false) return undefined
    return Object.freeze([Object.freeze({
      id: `proxy:tree:${object.eid}`,
      sortBias: 0,
      visible: true,
      worldY: layer.worldY + 100,
    })])
  }
  if (layer.object.typeId === NATIVE.building) {
    return Object.freeze([Object.freeze({
      id: `proxy:building:${layer.object.eid}`,
      sortBias: 0,
      visible: true,
      worldY: layer.worldY + 200,
    })])
  }
  return undefined
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
  await Promise.all([...new Set([
    ...BONEYARD_SPRITE_SOURCES,
    ...NATIVE_BONEYARD_POST_ROAD_TEXTURES,
  ])]
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

function visibleBoneyardPlayers(
  snapshot: GameSnapshot,
): Readonly<Record<string, ProtocolPlayerState>> {
  if (snapshot.materializingPlayerIds.length === 0) return snapshot.players
  const materializing = new Set(snapshot.materializingPlayerIds)
  return Object.fromEntries(Object.entries(snapshot.players).filter(([playerId]) => (
    !materializing.has(playerId)
  )))
}

function requiredLightRegistration(
  registration: NativeWorldManagerRegistration | null,
  owner: string,
): NativeWorldManagerRegistration {
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

function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0
  canvas.height = 0
}

function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  canvas.width = width
  canvas.height = height
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
