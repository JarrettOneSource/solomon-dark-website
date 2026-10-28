import { spriteRefFor } from '../../editor/assets.ts'
import { type EditorDoc, NATIVE, type Vec2 } from '../../editor/model.ts'
import { buildNativeRenderPlan, type CompactSpriteLayer, type MainLayer, type ObjectSpriteLayer } from '../../editor/native-render-plan.ts'
import {
  type Camera,
  drawNativeBoneyardMainBand,
  drawNativeBoneyardPostRoadBase,
  drawNativeBoneyardPreMainWallBand,
  drawNativeBoneyardProxyBand,
  nativeBoneyardMainLayers,
  nativeBoneyardPreMainWallLayers,
  nativeBoneyardProxyLayers,
} from '../../editor/render.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  createNativeLitSurfaceGrid,
} from './boneyard-building-surface-view.ts'
import type { BoneyardComplexShadowStaticCaster } from './boneyard-complex-shadow-presentation.ts'
import {
  boneyardOffCameraCleanupPlan,
  boneyardTransformedArtBounds,
} from './boneyard-off-camera-cleanup.ts'
import {
  type BoneyardBounds,
  boneyardResidentIsVisible,
  boneyardStaticTiles,
  boneyardVisibleWorldBounds,
} from './boneyard-render-contract.ts'
import type {
  BuildingResidents,
  ResidentTexture,
  StaticWorldBuild,
  TreeResidents,
  WallResident,
} from './boneyard-renderer-model.ts'
import { nativeBoneyardMainLayerShadowCaster } from './boneyard-shadow-casters.ts'
import { createNativeStaticQuad } from './native-static-quad.ts'
import { destroyResidentTexture } from './boneyard-resident-lifetime.ts'
export { destroyResidentTexture } from './boneyard-resident-lifetime.ts'
import { isMovingGateBody } from './boneyard-static-layout.ts'
import { isBuildingLayer } from './boneyard-static-lighting.ts'
import { type BoneyardStaticPixelRegion, cropBoneyardStaticPixels } from './boneyard-static-pixels.ts'
import {
  nativeBuildingLightGrid,
  nativeWallSurfaceVertexWeights,
} from './boneyard-static-surface-lighting.ts'
import type { NativeTreeOcclusionInput } from './boneyard-tree-occlusion.ts'
import {
  createNativeStaticArtResident,
  createNativeStaticFenceResident,
  nativeStaticArtRecord,
  nativeStaticMainArtEntry,
  type NativeStaticArtTextures,
} from './boneyard-native-static-art.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import {
  type NativeBoneyardSurfaceTextures,
  NativeBoneyardSurfaceView,
} from './native-boneyard-surface-view.ts'
import { BufferImageSource, Container, Sprite, Texture } from 'pixi.js'

export class BoneyardResidentVisibility {
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

export async function buildStaticWorld(
  document: EditorDoc,
  scene: LoadedBoneyard['scene'],
  root: Container,
  surfaceTextures: NativeBoneyardSurfaceTextures,
  artTextures: NativeStaticArtTextures,
  cleanupBounds: Readonly<BoneyardBounds> | null,
  enhancedEffects = true,
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
    samplePointsForMode(enabled: boolean): readonly Vec2[]
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
  const placementPlan = buildNativeRenderPlan(document)
  const baseArtLayers = [...placementPlan.underlays, ...placementPlan.compact]
  const baseSkippedSourceKeys = new Set([
    ...wallLayers.map((layer) => `fence:${layer.fence.eid}`),
    // Scrub owns both shadow branches at its painter slot, never the editor oval.
    ...document.objects.filter(object => object.typeId === 2062).map(object => `object:${object.eid}`),
    // Original-record art has a retained base-band owner, never tile pixels.
    ...baseArtLayers.map(layer => `${layer.kind}:${layer.sel.eid}`),
  ])
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
          baseSkippedSourceKeys,
        )
        staticPaintCount += 1
      },
    )
    residents.push(...fullBaseResidents)
    activeResidents.push(...fullBaseResidents)

    // Native underlays precede compact decorations, as in the placement plan.
    // Generated terrain stays in its tiles. A custom/invalid source fallback
    // retains its original painter at this exact position in the base order.
    for (const layer of baseArtLayers) {
      const record = nativeStaticArtRecord(layer.atlasEntry)
      const compact = layer.kind === 'sprite' ? layer.sprite : null
      const scale = compact && Number.isFinite(compact.s1) ? Math.max(0, compact.s1) : 1
      const alpha = compact && Number.isFinite(compact.s2) ? Math.max(0, Math.min(1, compact.s2)) : 1
      if (scale <= 0 || alpha <= 0) continue
      const resident = record ? createNativeStaticArtResident(record, artTextures.glyph(record.entry), layer.pos, {
        cleanupSourceKey: `${layer.kind}:${layer.sel.eid}`,
        rotationDegrees: compact && Number.isFinite(compact.s0) ? compact.s0 : 0,
        scaleX: scale * (compact && (compact.flags & 1) !== 0 ? 0.8 : 1),
        scaleY: scale,
        alpha,
      }) : buildFallbackBaseArtResident(document, layer, residentScratch)
      if (resident === null) continue
      base.addChild(resident.sprite)
      residents.push(resident)
      activeResidents.push(resident)
      mergeCleanupSourceBounds(visualBoundsBySource, resident)
    }

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
      const resident = buildMainLayerResident(document, layer, layerIndex, residentScratch, enhancedEffects, artTextures)
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
              enhancedEffects,
              position: layer.object.pos,
              sprite,
              variant: layer.object.variant ?? 0,
            }),
            samplePointsForMode: enabled => nativeBuildingLightGrid({
              enhancedEffects: enabled,
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
        enhancedEffects,
        artTextures,
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
            enhancedEffects,
            samplePointsForMode: main.samplePointsForMode,
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
        new Set([...baseSkippedSourceKeys, ...cleanupPlan.retiredSourceKeys]),
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

function buildFallbackBaseArtResident(
  document: EditorDoc,
  layer: ObjectSpriteLayer | CompactSpriteLayer,
  canvas: HTMLCanvasElement,
): ResidentTexture | null {
  const source = layer.kind === 'object' ? layer.object : layer.sprite
  const ref = spriteRefFor(layer.atlas, layer.atlasEntry) ?? source.sprite
  if (!ref) return null
  const compact = layer.kind === 'sprite' ? layer.sprite : null
  const scale = compact && Number.isFinite(compact.s1) ? Math.max(0, compact.s1) : 1
  const bounds = boneyardTransformedArtBounds(layer.pos, ref,
    compact && Number.isFinite(compact.s0) ? compact.s0 : 0,
    scale * (compact && (compact.flags & 1) !== 0 ? 0.8 : 1), scale)
  const x = Math.floor(bounds.x) - 1, y = Math.floor(bounds.y) - 1
  const width = Math.max(1, Math.ceil(bounds.x + bounds.w) + 1 - x)
  const height = Math.max(1, Math.ceil(bounds.y + bounds.h) + 1 - y)
  resizeCanvas(canvas, width, height)
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!context) throw new Error('Boneyard fallback base art could not acquire Canvas2D.')
  drawNativeBoneyardPostRoadBase(context, width, height,
    { x: x + width / 2, y: y + height / 2, zoom: 1 }, {
      ...document,
      objects: layer.kind === 'object' ? [layer.object] : [],
      sprites: layer.kind === 'sprite' ? [layer.sprite] : [],
      fences: [], roads: [], terrain: [],
    })
  const pixels = consumePaintedCanvas(canvas, true)
  if (!pixels) return null
  const resident = residentTexture(pixels, x + pixels.x, y + pixels.y)
  resident.cleanupSourceKey = `${layer.kind}:${layer.sel.eid}`
  return resident
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
  enhancedEffects: boolean,
  artTextures: NativeStaticArtTextures,
): ResidentTexture | null {
  if (layer.kind === 'fence' && layer.brokenHalf) {
    // Borrow original pixels, including RGB beneath alpha zero; no Canvas readback.
    const texture = artTextures.glyph(3)
    const sprite = createNativeStaticQuad(texture, layer.brokenHalf)
    sprite.label = `native-broken-grate:${layer.fence.eid}:${layer.pieceIndex}`
    const points = [layer.brokenHalf.p0, layer.brokenHalf.p1, layer.brokenHalf.p2, layer.brokenHalf.p3]
    const x = Math.min(...points.map(point => point.x)), y = Math.min(...points.map(point => point.y))
    return { cleanupSourceKey: null, mainLayerIndex: layerIndex, pixels: new Uint8ClampedArray(0), ownsTexture: false,
      shadowCaster: nativeBoneyardMainLayerShadowCaster(document, layer, layerIndex),
      sprite, surfaceMesh: null, texture, x, y,
      w: Math.max(...points.map(point => point.x)) - x, h: Math.max(...points.map(point => point.y)) - y }
  }
  const entry = nativeStaticMainArtEntry(layer)
  const record = entry === null ? null : nativeStaticArtRecord(entry)
  if (layer.kind === 'object' && layer.object.typeId === 2062 && record === null) {
    throw new Error(`Scrub ${layer.object.eid} has no native glyph.`)
  }
  // Goodie's compatibility image remains hidden; its live owner is dynamic.
  if (record && !(layer.kind === 'object' && layer.object.typeId === NATIVE.goodie)) {
    const resident = createNativeStaticArtResident(record, artTextures.glyph(record.entry), layer.pos, {
      mainLayerIndex: layerIndex,
      enhancedEffects: isBuildingLayer(layer) ? enhancedEffects : undefined,
      sceneryMaterial: isBuildingLayer(layer) ? undefined
        : layer.kind === 'object' && layer.object.typeId === NATIVE.tree ? 'tree' : 'ordinary',
    })
    resident.shadowCaster = nativeBoneyardMainLayerShadowCaster(document, layer, layerIndex)
    return resident
  }
  if (layer.kind === 'fence' && layer.part === 'body'
    && [0, 4].includes(layer.fence.segmentCode ?? layer.fence.style ?? 0)) {
    const resident = createNativeStaticFenceResident(layer, layerIndex, artTextures)
    if (resident) resident.shadowCaster = nativeBoneyardMainLayerShadowCaster(document, layer, layerIndex)
    return resident
  }
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
    ? buildingSurfaceResidentTexture(pixels, x, y, layerIndex, enhancedEffects)
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
  enhancedEffects: boolean,
  artTextures: NativeStaticArtTextures,
): ResidentTexture | null {
  const record = nativeStaticArtRecord(layer.atlasEntry)
  if (record) {
    return createNativeStaticArtResident(record, artTextures.glyph(record.entry), layer.pos, {
      enhancedEffects: layer.object.typeId === NATIVE.building ? enhancedEffects : undefined,
    })
  }
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
        null,
        enhancedEffects,
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
      ? spriteRefFor('DeadHawg', (layer.postStyle === 1 ? 320 : 36) + (layer.postVariant ?? 0))
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
  mainLayerIndex: number | null,
  enhancedEffects: boolean,
): ResidentTexture {
  const texture = residentPixelTexture(source)
  const surfaceMesh = createNativeLitSurfaceGrid(
    texture,
    source.width,
    source.height,
    enhancedEffects,
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
  const surfaceMesh = createNativeLitSurfaceGrid(
    texture,
    source.width,
    source.height,
    false,
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
