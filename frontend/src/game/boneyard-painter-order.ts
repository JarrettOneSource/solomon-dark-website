import {
  buildNativeRegionPainterOrder,
  nativeRegionPainterRow,
  type NativeRegionManagerLane,
  type NativeRegionPainterEntry,
  type NativeRegionPainterInsertion,
  type NativeRegionPainterRegistration,
} from './region-painter-order.ts'

export interface StaticPainterLayer {
  layerIndex: number
  worldY: number
  sortBias: number
  sourceOrder: number
  insertions?: readonly NativeRegionPainterInsertion[]
}

export interface DynamicPainterLayer {
  id: string
  insertions?: readonly NativeRegionPainterInsertion[]
  queueFamily: 'ordinary-dynamic' | 'scenery' | 'zanim'
  registration: NativeRegionPainterRegistration
  visible?: boolean
  worldY: number
  sortBias: number
}

export interface StaticPainterBand {
  id: string
  layerIndexes: number[]
  row: number
  zIndex: number
}

export interface PositionedDynamicLayer {
  id: string
  row: number
  zIndex: number
}

export interface BoneyardPainterOrder {
  bands: StaticPainterBand[]
  dynamicLayers: PositionedDynamicLayer[]
  foregroundZIndex: number
  orderedLayers: readonly PositionedDynamicLayer[]
  proxyLayers: PositionedDynamicLayer[]
}

export function nativePainterRow(worldY: number, sortBias: number, referenceY: number): number {
  return nativeRegionPainterRow(worldY, sortBias, referenceY)
}

export function buildBoneyardPainterOrder({
  referenceY,
  staticLayers,
  dynamicLayers,
}: {
  referenceY: number
  staticLayers: readonly StaticPainterLayer[]
  dynamicLayers: readonly DynamicPainterLayer[]
}): BoneyardPainterOrder {
  const staticById = new Map<string, StaticPainterLayer>(staticLayers.map((layer) => [
    `static:${layer.layerIndex}`,
    layer,
  ] as const))
  const dynamicById = new Map<string, DynamicPainterLayer>(
    dynamicLayers.map((layer) => [layer.id, layer] as const),
  )
  const insertionIds = new Set<string>()
  const collectInsertionIds = (
    insertions: readonly NativeRegionPainterInsertion[] = [],
  ): void => {
    for (const insertion of insertions) {
      insertionIds.add(insertion.id)
      collectInsertionIds(insertion.insertions)
    }
  }
  for (const layer of dynamicLayers) collectInsertionIds(layer.insertions)
  const order = buildNativeRegionPainterOrder({
    referenceY,
    entries: [
      ...staticLayers.map((layer): NativeRegionPainterEntry => ({
        id: `static:${layer.layerIndex}`,
        registration: registration('scenery', layer.sourceOrder),
        insertions: layer.insertions,
        sortBias: layer.sortBias,
        visible: true,
        worldY: layer.worldY,
      })),
      ...dynamicLayers.map((layer): NativeRegionPainterEntry => ({
        id: layer.id,
        insertions: layer.insertions,
        registration: layer.registration,
        sortBias: layer.sortBias,
        visible: layer.visible ?? true,
        worldY: layer.worldY,
      })),
    ],
  })

  const bands: StaticPainterBand[] = []
  const positionedDynamics: PositionedDynamicLayer[] = []
  const positionedProxies: PositionedDynamicLayer[] = []
  let pendingStatic: StaticPainterBand | null = null
  let zIndex = 1

  const flushStatic = () => {
    if (!pendingStatic) return
    bands.push(pendingStatic)
    pendingStatic = null
    zIndex += 1
  }

  for (const positioned of order.orderedLayers) {
    const staticLayer = staticById.get(positioned.id)
    if (staticLayer) {
      pendingStatic ??= {
        id: `static-${bands.length}`,
        layerIndexes: [],
        row: positioned.row,
        zIndex,
      }
      pendingStatic.layerIndexes.push(staticLayer.layerIndex)
      continue
    }

    flushStatic()
    if (!dynamicById.has(positioned.id) && !insertionIds.has(positioned.id)) {
      if (!positioned.id.startsWith('proxy:')) {
        throw new Error(`unknown Boneyard dynamic painter ${positioned.id}`)
      }
      positionedProxies.push({ id: positioned.id, row: positioned.row, zIndex })
      zIndex += 1
      continue
    }
    if (insertionIds.has(positioned.id)) {
      positionedProxies.push({ id: positioned.id, row: positioned.row, zIndex })
    }
    positionedDynamics.push({ id: positioned.id, row: positioned.row, zIndex })
    zIndex += 1
  }
  flushStatic()

  return {
    bands,
    dynamicLayers: positionedDynamics,
    foregroundZIndex: zIndex,
    orderedLayers: order.orderedLayers,
    proxyLayers: positionedProxies,
  }
}

function registration(
  managerLane: NativeRegionManagerLane,
  registrationOrdinal: number,
) {
  return { managerLane, registrationOrdinal }
}
