import type { Vec2 } from '../../editor/model.ts'
import type { Camera } from '../../editor/render.ts'
import type {
  BoneyardEnemyDeathEffectSnapshot,
  BoneyardEnemySnapshot,
  GameSnapshot,
} from '../protocol/game-state.ts'
import { BoneyardDynamicScene } from './boneyard-dynamic-scene.ts'
import { NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX } from './boneyard-lighting.ts'
import { BoneyardRegionLightField } from './boneyard-region-light-field.ts'
import { type BoneyardSpectatorCameraState, boneyardCameraFocus } from './boneyard-render-contract.ts'
import type {
  BoneyardPainterFrame,
  BoneyardSceneSnapshot,
  StaticWorldBuild,
} from './boneyard-renderer-model.ts'
import type { BoneyardSolomonClipRect } from './boneyard-solomon-render.ts'
import { BoneyardResidentVisibility } from './boneyard-static-world.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import {
  NATIVE_PLAYER_MAGIC_SHIELD,
  presentNativeSecondaryScreenOverlay,
} from './native-secondary-presentation.ts'
import type { NativeSecondaryDiagnosticSample } from './native-secondary-world-view.ts'
import { Container } from 'pixi.js'

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
  enemyDeathEffectSamples: EnemyDeathEffectDiagnosticSample[]
  enemyDeathEffectVisibleCount: number
  enemyFamilies: string
  fadedTreeCount: number
  enemySamples: EnemyDiagnosticSample[]
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
  lanternWorldX: number
  lanternWorldY: number
  lanternLightX: number
  lanternLightY: number
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

export function createBoneyardRendererDiagnostics(
  canvas: HTMLCanvasElement,
  staticWorld: StaticWorldBuild,
  regionLightField: BoneyardRegionLightField,
  initialSnapshot: GameSnapshot,
  environmentMode: number,
  world: Container,
  staticLayerCount: number,
): BoneyardRendererFrameDiagnostics {
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
    lanternWorldX: Number.NaN,
    lanternWorldY: Number.NaN,
    lanternLightX: Number.NaN,
    lanternLightY: Number.NaN,
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
    staticLayerCount,
    staticPaintCount: staticWorld.staticPaintCount,
    tick: initialSnapshot.tick,
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
    runId: initialSnapshot.run.runId,
    runPhase: initialSnapshot.run.phase,
    spectatorTargetPlayerId: null,
    visibleMainLayerCount: 0,
    visibleOversizedResidentCount: 0,
    visibleResidentCount: 0,
    weatherDropCount: 0,
    weatherMode: environmentMode,
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
  return frameDiagnostics
}

interface BoneyardRendererDiagnosticFrame {
  frameDiagnostics: BoneyardRendererFrameDiagnostics
  canvas: HTMLCanvasElement
  cameraFocus: ReturnType<typeof boneyardCameraFocus>
  camera: Camera
  frameCount: number
  painter: BoneyardPainterFrame
  snapshot: BoneyardSceneSnapshot
  scene: BoneyardDynamicScene
  visibility: BoneyardResidentVisibility
  localPlayerId: string
  viewport: GameViewportLayout
  currentStaticWorld: StaticWorldBuild
  spectatorCamera: BoneyardSpectatorCameraState
  feedbackMagnitude: number
  secondaryCameraMagnitude: number
  regionLightField: BoneyardRegionLightField
  currentWorldDisplacement: Readonly<Vec2>
  screenOverlay: ReturnType<typeof presentNativeSecondaryScreenOverlay>
}

export function updateBoneyardRendererDiagnostics(input: BoneyardRendererDiagnosticFrame): void {
  const { frameDiagnostics, canvas, cameraFocus, camera, frameCount, painter, snapshot,
    scene, visibility, localPlayerId, viewport, currentStaticWorld, spectatorCamera,
    feedbackMagnitude, secondaryCameraMagnitude, regionLightField, currentWorldDisplacement,
    screenOverlay } = input
  const player = snapshot.players[localPlayerId]!
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
      frameDiagnostics.enemyAuxiliaryEffectCount = scene.enemies.auxiliaryEffectCount
      frameDiagnostics.enemyAuxiliaryEffectLanes = (scene.enemies.painterLayers().map(({ lane }) => lane))
      frameDiagnostics.enemyCount = scene.enemies.size
      const combatBounds = snapshot.world.arenaTransition?.combatBounds
      frameDiagnostics.enemyOutsideCombatBoundsCount = combatBounds === undefined
        ? 0
        : snapshot.world.enemies.filter(({ position }) => (
            position.x < combatBounds.x
            || position.y < combatBounds.y
            || position.x > combatBounds.x + combatBounds.w
            || position.y > combatBounds.y + combatBounds.h
          )).length
      frameDiagnostics.enemyDeathEffectCount = scene.enemyDeathEffects.size
      frameDiagnostics.enemyDeathEffectVisibleCount = scene.enemyDeathEffects.visibleSize
      frameDiagnostics.enemyDeathEffectCulledCount = (
        scene.enemyDeathEffects.size - scene.enemyDeathEffects.visibleSize
      )
      updateEnemyDeathEffectDiagnosticSamples(
        frameDiagnostics.enemyDeathEffectSamples,
        snapshot.world.deathEffects,
      )
      frameDiagnostics.enemyFamilies = scene.visibleEnemyFamilies
      frameDiagnostics.fadedTreeCount = painter.fadedTreeCount
      updateEnemyDiagnosticSamples(frameDiagnostics.enemySamples, snapshot.world.enemies, scene)
      frameDiagnostics.enemyProjectileCount = scene.enemyProjectiles.size
      frameDiagnostics.enemyProjectileEffectCount = scene.enemyProjectileEffects.size
      frameDiagnostics.enemyProjectileEffectIds = scene.enemyProjectileEffects.ids
      frameDiagnostics.enemyProjectileIds = scene.enemyProjectiles.ids
      frameDiagnostics.foregroundZIndex = painter.foregroundZIndex
      frameDiagnostics.gateLeafCount = snapshot.world.gateLeaves.length
      frameDiagnostics.goodieCount = scene.goodies.size
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
      frameDiagnostics.lanternWorldX = painter.lanternWorldX
      frameDiagnostics.lanternWorldY = painter.lanternWorldY
      frameDiagnostics.lanternLightX = painter.lanternLightX
      frameDiagnostics.lanternLightY = painter.lanternLightY
      frameDiagnostics.lanternPainterRow = painter.lanternPainterRow
      frameDiagnostics.lanternZIndex = painter.lanternZIndex
      frameDiagnostics.levelUpParticleCount = scene.levelUp.particleCount
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
      frameDiagnostics.maggotCulledCount = (scene.maggots.size - scene.maggots.visibleSize)
      frameDiagnostics.maggotCount = scene.maggots.size
      frameDiagnostics.maggotVisibleCount = scene.maggots.visibleSize
      frameDiagnostics.lootCount = scene.loot.size
      frameDiagnostics.modEffectCount = scene.modEffects.size
      frameDiagnostics.mageLightningCount = scene.mageLightningPulses.size
      frameDiagnostics.minMainLightScalar = painter.minMainLightScalar
      frameDiagnostics.minTreeAlpha = painter.minTreeAlpha
      frameDiagnostics.minTreeLightScalar = painter.minTreeLightScalar
      frameDiagnostics.monumentVisibleCount = painter.monumentVisibleCount
      frameDiagnostics.painterBandCount = painter.painterBandCount
      frameDiagnostics.painterOrder = painter.painterOrder
      frameDiagnostics.painterProxyOrder = painter.painterProxyOrder
      frameDiagnostics.playerCount = scene.players.size
      frameDiagnostics.playerDeathBurstCount = scene.playerDeathBursts.size
      frameDiagnostics.playerDeathWeaponCount = scene.playerDeathWeapons.size
      frameDiagnostics.playerLightRadius = painter.playerLightRadius
      frameDiagnostics.playerLightRasterRadius = painter.playerLightRasterRadius
      frameDiagnostics.playerSamples = Object.entries(snapshot.players).map(([id, sample]) => ({
        displayName: sample.config.displayName,
        id,
        lifeState: sample.progression.lifeState,
        x: sample.position.x,
        y: sample.position.y,
      }))
      frameDiagnostics.primarySpellCount = scene.primarySpells.count
      frameDiagnostics.primarySpellPainterDepths = scene.primarySpells.painterDepths
      frameDiagnostics.primaryHailMeshCount = scene.primarySpells.hailMeshCount
      frameDiagnostics.primaryHailMeshRunCount = scene.primarySpells.hailMeshRunCount
      frameDiagnostics.primarySpellKinds = scene.primarySpells.kinds
      frameDiagnostics.primaryWaterAuraMeshCount = scene.primarySpells.waterAuraMeshCount
      frameDiagnostics.primaryWaterMeshActorCount = scene.primarySpells.waterMeshActorCount
      frameDiagnostics.primaryWaterMeshNormalFrostCount = (
        scene.primarySpells.waterMeshNormalFrostCount
      )
      frameDiagnostics.primaryWaterMeshRunCount = scene.primarySpells.waterMeshRunCount
      frameDiagnostics.playerScreenX = (player.position.x - camera.x) * camera.zoom
        + viewport.width / 2
      frameDiagnostics.playerScreenY = (player.position.y - camera.y) * camera.zoom
        + viewport.height / 2
      frameDiagnostics.playerHeadingIndex = player.headingIndex
      frameDiagnostics.playerWalkPose = scene.playerWalkPose(localPlayerId)
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
      const playerView = scene.player(localPlayerId)
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
      frameDiagnostics.seekerSegmentCount = scene.seeker.segmentCount
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
      const solomonDirt = (scene.solomon?.dirt ?? null)
      frameDiagnostics.solomonDirtAgeTicks = solomonDirt?.state.ageTicks ?? null
      frameDiagnostics.solomonDirtAlpha = solomonDirt?.state.alpha ?? 0
      frameDiagnostics.solomonDirtCount = (scene.solomon?.dirtCount ?? 0)
      frameDiagnostics.solomonDirtEventId = solomonDirt?.eventId ?? 0
      frameDiagnostics.solomonDirtHeadingDegrees = solomonDirt?.state.headingDegrees ?? 0
      frameDiagnostics.solomonDirtPassCount = (scene.solomon?.dirtPassCount ?? 0)
      frameDiagnostics.solomonDirtX = solomonDirt?.state.position.x ?? Number.NaN
      frameDiagnostics.solomonDirtY = solomonDirt?.state.position.y ?? Number.NaN
      frameDiagnostics.solomonBodyOffsetY = (scene.solomon?.bodyOffsetY ?? 0)
      frameDiagnostics.solomonBodyTint = (scene.solomon?.bodyTint ?? 0xffffff)
      frameDiagnostics.solomonClipRectWorld = (scene.solomon?.clipRectWorld ?? null)
      frameDiagnostics.solomonDirtTint = (scene.solomon?.dirtTint ?? 0xffffff)
      frameDiagnostics.solomonFrame = (scene.solomon?.frame ?? 0)
      frameDiagnostics.solomonGraveMarkTint = (scene.solomon?.graveMarkTint ?? 0xffffff)
      frameDiagnostics.solomonGraveMarkPassCount = (scene.solomon?.graveMarkPassCount ?? 0)
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
      frameDiagnostics.weatherDropCount = scene.weather.activeDropCount
      frameDiagnostics.weatherMode = scene.boneyard.scene.environmentMode
      frameDiagnostics.weatherSplashCount = scene.weather.activeSplashCount
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
      frameDiagnostics.secondaryAbilityCount = scene.secondaryAbilities.count
      frameDiagnostics.secondaryAbilityKinds = scene.secondaryAbilities.kinds
      frameDiagnostics.secondaryAbilityPrimitiveCount = scene.secondaryAbilities.primitiveCount
      frameDiagnostics.secondaryAbilitySamples = scene.secondaryAbilities.diagnosticSamples
      frameDiagnostics.secondaryScreenFlashAlpha = screenOverlay?.alpha ?? 0
      frameDiagnostics.secondaryScreenFlashColor = screenOverlay?.color ?? 0xffffff
      canvas.dataset.enemyCount = `${scene.enemies.size}`
      canvas.dataset.enemyAuxiliaryEffectCount = `${scene.enemies.auxiliaryEffectCount}`
      canvas.dataset.enemyAuxiliaryEffectLanes = (scene.enemies.painterLayers().map(({ lane }) => lane)).join(',')
      canvas.dataset.enemyDeathEffectCount = `${scene.enemyDeathEffects.size}`
      canvas.dataset.enemyDeathEffectVisibleCount = `${scene.enemyDeathEffects.visibleSize}`
      canvas.dataset.enemyDeathEffectCulledCount = `${
        scene.enemyDeathEffects.size - scene.enemyDeathEffects.visibleSize
      }`
      canvas.dataset.complexShadowCasterCount = `${painter.complexShadowCasterCount}`
      canvas.dataset.complexShadowQuadCount = `${painter.complexShadowQuadCount}`
      canvas.dataset.complexShadowRecordCount = `${painter.complexShadowRecordCount}`
      canvas.dataset.enemyFamilies = scene.visibleEnemyFamilies
      canvas.dataset.fadedTreeCount = `${painter.fadedTreeCount}`
      canvas.dataset.minTreeAlpha = `${painter.minTreeAlpha}`
      canvas.dataset.minTreeLightScalar = `${painter.minTreeLightScalar}`
      canvas.dataset.enemyProjectileCount = `${scene.enemyProjectiles.size}`
      canvas.dataset.maggotCulledCount = `${(scene.maggots.size - scene.maggots.visibleSize)}`
      canvas.dataset.maggotCount = `${scene.maggots.size}`
      canvas.dataset.maggotVisibleCount = `${scene.maggots.visibleSize}`
      canvas.dataset.lootCount = `${scene.loot.size}`
      canvas.dataset.modEffectCount = `${scene.modEffects.size}`
      canvas.dataset.goodieCount = `${scene.goodies.size}`
      canvas.dataset.mageLightningCount = `${scene.mageLightningPulses.size}`
      canvas.dataset.playerDeathBurstCount = `${scene.playerDeathBursts.size}`
      canvas.dataset.seekerSegmentCount = `${scene.seeker.segmentCount}`
      canvas.dataset.worldFeedbackMagnitude = `${feedbackMagnitude}`
      canvas.dataset.secondaryCameraMagnitude = `${secondaryCameraMagnitude}`
      canvas.dataset.worldShakeX = `${currentWorldDisplacement.x}`
      canvas.dataset.worldShakeY = `${currentWorldDisplacement.y}`
      canvas.dataset.secondaryScreenFlashAlpha = `${screenOverlay?.alpha ?? 0}`
      canvas.dataset.solomonGraveMarkPassCount = `${(scene.solomon?.graveMarkPassCount ?? 0)}`
      canvas.dataset.weatherDropCount = `${scene.weather.activeDropCount}`
      canvas.dataset.weatherMode = `${scene.boneyard.scene.environmentMode}`
      canvas.dataset.weatherSplashCount = `${scene.weather.activeSplashCount}`
      canvas.dataset.weatherSplashZIndex = `${painter.weatherLightingOrder.splashZIndex}`
      canvas.dataset.weatherStreakZIndex = `${painter.weatherLightingOrder.streakZIndex}`
      canvas.dataset.wallVisibleCount = `${painter.wallVisibleCount}`
      canvas.dataset.regionLightCompositeZIndex = `${
        painter.weatherLightingOrder.lightCompositeZIndex
      }`
 }
