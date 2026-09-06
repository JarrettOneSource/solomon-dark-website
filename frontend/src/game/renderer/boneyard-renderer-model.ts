import type { Vec2 } from '../../editor/model.ts'
import type { Camera } from '../../editor/render.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import type { ModConsumableCatalogEntry } from '../core-kernels/hub-economy.ts'
import type { GameSettings } from '../game-settings.ts'
import type { GameModAsset } from '../protocol/game-mod-contract.ts'
import type { BoneyardEnemyEventSnapshot, GameSnapshot } from '../protocol/game-state.ts'
import type { GameWorldSpeech } from '../world-speech-presentation.ts'
import type { NativeStaticSurfaceMesh } from './boneyard-building-surface-view.ts'
import type { BoneyardComplexShadowStaticCaster } from './boneyard-complex-shadow-presentation.ts'
import type { NativeBoneyardComplexShadowCaster } from './boneyard-complex-shadows.ts'
import type { NativeBoneyardWeatherLightingOrder } from './boneyard-lighting.ts'
import type {
  BoneyardBounds,
  BoneyardSpectatorStatusPresentation,
} from './boneyard-render-contract.ts'
import type { NativeTreeOcclusionInput } from './boneyard-tree-occlusion.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import { NativeBoneyardSurfaceView } from './native-boneyard-surface-view.ts'
import { Container, Texture } from 'pixi.js'

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

export interface BoneyardWorldRendererOptions {
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

export interface ResidentTexture extends BoneyardBounds {
  cleanupSourceKey: string | null
  mainLayerIndex: number | null
  pixels: Uint8ClampedArray
  shadowCaster: NativeBoneyardComplexShadowCaster | null
  sprite: Container
  surfaceMesh: NativeStaticSurfaceMesh | null
  texture: Texture
}

export interface BuildingResidents {
  main: ResidentTexture & { surfaceMesh: NativeStaticSurfaceMesh }
  roof: ResidentTexture & { surfaceMesh: NativeStaticSurfaceMesh }
  samplePoints: readonly Vec2[]
  scalars: Float32Array
}

export interface WallResident {
  end: Vec2
  resident: ResidentTexture & { surfaceMesh: NativeStaticSurfaceMesh }
  scalars: Float32Array
  start: Vec2
  vertexWeights: Float32Array
}

export interface TreeResidents {
  proxy: ResidentTexture
  main: ResidentTexture
}

export interface StaticWorldBuild {
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

export interface BoneyardPainterFrame {
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
  lanternWorldX: number
  lanternWorldY: number
  lanternLightX: number
  lanternLightY: number
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

export function requireBoneyardSnapshot(snapshot: GameSnapshot, runId: string): asserts snapshot is GameSnapshot & {
  world: Extract<GameSnapshot['world'], { kind: 'boneyard' }>
} {
  if (snapshot.world.kind !== 'boneyard' || snapshot.world.runId !== runId) {
    throw new Error('Boneyard renderer received a snapshot for another scene.')
  }
}

export type BoneyardSceneSnapshot = GameSnapshot & {
  world: Extract<GameSnapshot["world"], { kind: "boneyard" }>
}
