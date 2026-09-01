import {
  NativeRegionPainterOrderPlanner,
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

interface ReusableNativeRegionPainterEntry {
  id: string
  insertions: readonly NativeRegionPainterInsertion[] | undefined
  registration: NativeRegionPainterRegistration
  sortBias: number
  visible: boolean
  worldY: number
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
  const order = new BoneyardPainterOrderPlanner().build({
    referenceY,
    staticLayers,
    dynamicLayers,
  })
  for (const positioned of order.orderedLayers) Object.freeze(positioned)
  Object.freeze(order.orderedLayers)
  return order
}

/** Frame-local Boneyard adapter over the retained native Region queue. */
export class BoneyardPainterOrderPlanner {
  private readonly bandPool: StaticPainterBand[] = []
  private readonly bands: StaticPainterBand[] = []
  private readonly dynamicIds = new Set<string>()
  private readonly dynamicPool: PositionedDynamicLayer[] = []
  private readonly dynamics: PositionedDynamicLayer[] = []
  private readonly insertionIds = new Set<string>()
  private readonly nativeEntries: ReusableNativeRegionPainterEntry[] = []
  private readonly nativeEntryPool: ReusableNativeRegionPainterEntry[] = []
  private readonly nativePlanner = new NativeRegionPainterOrderPlanner()
  private readonly proxyOnlyPool: PositionedDynamicLayer[] = []
  private readonly proxies: PositionedDynamicLayer[] = []
  private readonly result: BoneyardPainterOrder = {
    bands: this.bands,
    dynamicLayers: this.dynamics,
    foregroundZIndex: 1,
    orderedLayers: [],
    proxyLayers: this.proxies,
  }
  private readonly sceneryRegistrations = new Map<number, NativeRegionPainterRegistration>()
  private readonly staticById = new Map<string, StaticPainterLayer>()
  private readonly staticIds = new Map<number, string>()

  build({
    referenceY,
    staticLayers,
    dynamicLayers,
  }: {
    referenceY: number
    staticLayers: readonly StaticPainterLayer[]
    dynamicLayers: readonly DynamicPainterLayer[]
  }): BoneyardPainterOrder {
    this.staticById.clear()
    this.dynamicIds.clear()
    this.insertionIds.clear()
    this.bands.length = 0
    this.dynamics.length = 0
    this.proxies.length = 0
    for (const entry of this.nativeEntries) this.nativeEntryPool.push(entry)
    this.nativeEntries.length = 0

    for (const layer of staticLayers) {
      const id = this.staticId(layer.layerIndex)
      this.staticById.set(id, layer)
      this.writeEntry(
        id,
        layer.insertions,
        this.sceneryRegistration(layer.sourceOrder),
        layer.sortBias,
        true,
        layer.worldY,
      )
    }
    for (const layer of dynamicLayers) {
      this.dynamicIds.add(layer.id)
      this.collectInsertionIds(layer.insertions)
      this.writeEntry(
        layer.id,
        layer.insertions,
        layer.registration,
        layer.sortBias,
        layer.visible ?? true,
        layer.worldY,
      )
    }

    const nativeOrder = this.nativePlanner.build({
      entries: this.nativeEntries,
      referenceY,
    })
    let pendingStatic: StaticPainterBand | null = null
    let proxyOnlyCount = 0
    let zIndex = 1

    for (const positioned of nativeOrder.orderedLayers) {
      const staticLayer = this.staticById.get(positioned.id)
      if (staticLayer) {
        if (!pendingStatic) {
          const bandIndex = this.bands.length
          pendingStatic = this.bandPool[bandIndex]
          if (!pendingStatic) {
            pendingStatic = {
              id: `static-${bandIndex}`,
              layerIndexes: [],
              row: positioned.row,
              zIndex,
            }
            this.bandPool.push(pendingStatic)
          } else {
            pendingStatic.layerIndexes.length = 0
            pendingStatic.row = positioned.row
            pendingStatic.zIndex = zIndex
          }
        }
        pendingStatic.layerIndexes.push(staticLayer.layerIndex)
        continue
      }

      if (pendingStatic) {
        this.bands.push(pendingStatic)
        pendingStatic = null
        zIndex += 1
      }
      const insertion = this.insertionIds.has(positioned.id)
      if (!this.dynamicIds.has(positioned.id) && !insertion) {
        if (!positioned.id.startsWith('proxy:')) {
          throw new Error(`unknown Boneyard dynamic painter ${positioned.id}`)
        }
        const proxy = this.positioned(
          this.proxyOnlyPool,
          proxyOnlyCount++,
          positioned.id,
          positioned.row,
          zIndex,
        )
        this.proxies.push(proxy)
        zIndex += 1
        continue
      }
      const dynamic = this.positioned(
        this.dynamicPool,
        this.dynamics.length,
        positioned.id,
        positioned.row,
        zIndex,
      )
      if (insertion) this.proxies.push(dynamic)
      this.dynamics.push(dynamic)
      zIndex += 1
    }
    if (pendingStatic) {
      this.bands.push(pendingStatic)
      zIndex += 1
    }

    this.result.foregroundZIndex = zIndex
    this.result.orderedLayers = nativeOrder.orderedLayers
    return this.result
  }

  private collectInsertionIds(
    insertions: readonly NativeRegionPainterInsertion[] = [],
  ): void {
    for (const insertion of insertions) {
      this.insertionIds.add(insertion.id)
      this.collectInsertionIds(insertion.insertions)
    }
  }

  private positioned(
    pool: PositionedDynamicLayer[],
    index: number,
    id: string,
    row: number,
    zIndex: number,
  ): PositionedDynamicLayer {
    let positioned = pool[index]
    if (!positioned) {
      positioned = { id, row, zIndex }
      pool.push(positioned)
    } else {
      positioned.id = id
      positioned.row = row
      positioned.zIndex = zIndex
    }
    return positioned
  }

  private sceneryRegistration(sourceOrder: number): NativeRegionPainterRegistration {
    let registration = this.sceneryRegistrations.get(sourceOrder)
    if (!registration) {
      registration = {
        managerLane: 'scenery',
        registrationOrdinal: sourceOrder,
      }
      this.sceneryRegistrations.set(sourceOrder, registration)
    }
    return registration
  }

  private staticId(layerIndex: number): string {
    let id = this.staticIds.get(layerIndex)
    if (!id) {
      id = `static:${layerIndex}`
      this.staticIds.set(layerIndex, id)
    }
    return id
  }

  private writeEntry(
    id: string,
    insertions: readonly NativeRegionPainterInsertion[] | undefined,
    registration: NativeRegionPainterRegistration,
    sortBias: number,
    visible: boolean,
    worldY: number,
  ): void {
    const entry = this.nativeEntryPool.pop() ?? {
      id,
      insertions,
      registration,
      sortBias,
      visible,
      worldY,
    }
    entry.id = id
    entry.insertions = insertions
    entry.registration = registration
    entry.sortBias = sortBias
    entry.visible = visible
    entry.worldY = worldY
    this.nativeEntries.push(entry)
  }
}
