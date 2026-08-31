import {
  buildNativeRegionPainterOrder,
  NativeRegionPainterPlanner,
  type NativeRegionManagerLane,
  type NativeRegionPainterEntry,
  type NativeRegionPainterInsertion,
  type NativeRegionPainterPlannerEntry,
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

interface RetainedStaticPainterEntry {
  readonly id: string
  insertions?: readonly NativeRegionPainterInsertion[]
  readonly registration: {
    managerLane: 'scenery'
    registrationOrdinal: number
  }
  sortBias: number
  staticLayer: StaticPainterLayer
  readonly visible: true
  worldY: number
}

interface MutableBoneyardPainterOrder extends BoneyardPainterOrder {
  orderedLayers: PositionedDynamicLayer[]
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

/**
 * Boneyard-owned retained adapter around the shared Region planner.
 * Its result is consumed synchronously and mutates on the next build.
 */
export class BoneyardPainterOrderPlanner {
  private readonly bandPool: StaticPainterBand[] = []
  private readonly bands: StaticPainterBand[] = []
  private readonly dynamicLayers: PositionedDynamicLayer[] = []
  private readonly entries: NativeRegionPainterPlannerEntry[] = []
  private readonly positionedPool: PositionedDynamicLayer[] = []
  private readonly proxyLayers: PositionedDynamicLayer[] = []
  private readonly region = new NativeRegionPainterPlanner()
  private readonly result: MutableBoneyardPainterOrder = {
    bands: this.bands,
    dynamicLayers: this.dynamicLayers,
    foregroundZIndex: 1,
    orderedLayers: [],
    proxyLayers: this.proxyLayers,
  }
  private readonly staticEntries: (RetainedStaticPainterEntry | undefined)[] = []

  build({
    referenceY,
    staticLayers,
    dynamicLayers,
  }: {
    referenceY: number
    staticLayers: readonly StaticPainterLayer[]
    dynamicLayers: readonly DynamicPainterLayer[]
  }): BoneyardPainterOrder {
    this.entries.length = 0
    this.bands.length = 0
    this.dynamicLayers.length = 0
    this.proxyLayers.length = 0

    for (const layer of staticLayers) {
      let entry = this.staticEntries[layer.layerIndex]
      if (!entry) {
        entry = {
          id: `static:${layer.layerIndex}`,
          insertions: layer.insertions,
          registration: {
            managerLane: 'scenery',
            registrationOrdinal: layer.sourceOrder,
          },
          sortBias: layer.sortBias,
          staticLayer: layer,
          visible: true,
          worldY: layer.worldY,
        }
        this.staticEntries[layer.layerIndex] = entry
      } else {
        entry.insertions = layer.insertions
        entry.registration.registrationOrdinal = layer.sourceOrder
        entry.sortBias = layer.sortBias
        entry.staticLayer = layer
        entry.worldY = layer.worldY
      }
      this.entries.push(entry)
    }
    for (const layer of dynamicLayers) this.entries.push(layer)

    const regionOrder = this.region.build(this.entries, referenceY)
    this.result.orderedLayers = regionOrder.orderedLayers as PositionedDynamicLayer[]
    let pendingStatic: StaticPainterBand | null = null
    let zIndex = 1
    let positionedCount = 0

    for (let index = 0; index < regionOrder.orderedLayers.length; index += 1) {
      const positioned = regionOrder.orderedLayers[index]!
      const root = this.region.rootEntryAt(index)
      const insertion = this.region.isInsertionAt(index)
      if (!insertion && isRetainedStaticPainterEntry(root)) {
        if (!pendingStatic) {
          const bandIndex = this.bands.length
          const band = this.bandPool[bandIndex] ?? {
            id: `static-${bandIndex}`,
            layerIndexes: [],
            row: 0,
            zIndex: 0,
          }
          band.layerIndexes.length = 0
          band.row = positioned.row
          band.zIndex = zIndex
          this.bandPool[bandIndex] = band
          pendingStatic = band
        }
        pendingStatic.layerIndexes.push(root.staticLayer.layerIndex)
        continue
      }

      if (pendingStatic) {
        this.bands.push(pendingStatic)
        pendingStatic = null
        zIndex += 1
      }

      const output = this.positionedPool[positionedCount] ?? { id: '', row: 0, zIndex: 0 }
      positionedCount += 1
      output.id = positioned.id
      output.row = positioned.row
      output.zIndex = zIndex
      this.positionedPool[positionedCount - 1] = output

      if (isRetainedStaticPainterEntry(root)) {
        if (!positioned.id.startsWith('proxy:')) {
          throw new Error(`unknown Boneyard dynamic painter ${positioned.id}`)
        }
        this.proxyLayers.push(output)
        zIndex += 1
        continue
      }
      if (insertion) this.proxyLayers.push(output)
      this.dynamicLayers.push(output)
      zIndex += 1
    }
    if (pendingStatic) {
      this.bands.push(pendingStatic)
      zIndex += 1
    }

    for (let index = positionedCount; index < this.positionedPool.length; index += 1) {
      this.positionedPool[index]!.id = ''
    }
    this.result.foregroundZIndex = zIndex
    return this.result
  }

  clear(): void {
    this.region.clear()
    this.entries.length = 0
    this.bands.length = 0
    this.dynamicLayers.length = 0
    this.proxyLayers.length = 0
    this.staticEntries.length = 0
    for (const band of this.bandPool) band.layerIndexes.length = 0
    this.bandPool.length = 0
    for (const positioned of this.positionedPool) positioned.id = ''
    this.positionedPool.length = 0
    this.result.foregroundZIndex = 1
    this.result.orderedLayers = []
  }
}

function isRetainedStaticPainterEntry(
  entry: NativeRegionPainterPlannerEntry,
): entry is RetainedStaticPainterEntry {
  return 'staticLayer' in entry
}

function registration(
  managerLane: NativeRegionManagerLane,
  registrationOrdinal: number,
) {
  return { managerLane, registrationOrdinal }
}
