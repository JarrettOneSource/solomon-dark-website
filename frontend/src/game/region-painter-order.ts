export const NATIVE_REGION_MANAGER_LANES = [
  'actor',
  'scenery',
  'transient',
] as const

export type NativeRegionManagerLane = typeof NATIVE_REGION_MANAGER_LANES[number]

export interface NativeRegionPainterRegistration {
  readonly managerLane: NativeRegionManagerLane
  readonly registrationOrdinal: number
}

export interface NativeRegionPainterInsertion {
  readonly id: string
  readonly insertions?: readonly NativeRegionPainterInsertion[]
  readonly sortBias: number
  readonly visible: boolean
  readonly worldY: number
}

export interface NativeRegionPainterEntry extends NativeRegionPainterInsertion {
  readonly registration: NativeRegionPainterRegistration
}

export interface PositionedNativeRegionPainterLayer {
  readonly id: string
  readonly row: number
  readonly zIndex: number
}

export interface NativeRegionPainterOrder {
  readonly orderedLayers: readonly PositionedNativeRegionPainterLayer[]
  readonly queueEndZIndex: number
}

interface GatheredRegionPainterEntry {
  entry: NativeRegionPainterEntry
  sourceOrder: number
}

interface ReusablePositionedRegionPainterLayer {
  id: string
  row: number
  zIndex: number
}

export type NativeRegionPainterPlannerEntry = Omit<NativeRegionPainterEntry, 'visible'> & {
  readonly visible?: boolean
}

interface NativeRegionPainterRootSlot {
  entry: NativeRegionPainterPlannerEntry | null
  sourceOrder: number
}

interface NativeRegionPainterQueuedSlot {
  entry: NativeRegionPainterInsertion | NativeRegionPainterPlannerEntry | null
  root: NativeRegionPainterPlannerEntry | null
  row: number
}

interface MutablePositionedNativeRegionPainterLayer {
  id: string
  row: number
  zIndex: number
}

interface MutableNativeRegionPainterOrder {
  orderedLayers: MutablePositionedNativeRegionPainterLayer[]
  queueEndZIndex: number
}

const MANAGER_LANE_ORDER: Readonly<Record<NativeRegionManagerLane, number>> = {
  actor: 0,
  scenery: 1,
  transient: 2,
}

export function nativeRegionPainterRow(
  worldY: number,
  sortBias: number,
  referenceY: number,
): number {
  requireFinite(worldY, 'world Y')
  requireFinite(sortBias, 'sort bias')
  requireFinite(referenceY, 'reference Y')
  const relative = Math.trunc(worldY) + Math.trunc(sortBias) - Math.trunc(referenceY)
  const row = Math.trunc(relative / 2)
  return row === 0 ? 0 : row
}

export function buildNativeRegionPainterOrder({
  entries,
  referenceY,
}: {
  readonly entries: readonly NativeRegionPainterEntry[]
  readonly referenceY: number
}): NativeRegionPainterOrder {
  const order = new NativeRegionPainterOrderPlanner().build({ entries, referenceY })
  for (const positioned of order.orderedLayers) Object.freeze(positioned)
  Object.freeze(order.orderedLayers)
  return Object.freeze(order)
}

/**
 * Frame-local native Region queue. Its returned rows are reused by the next
 * build, so persistent consumers must use buildNativeRegionPainterOrder.
 */
export class NativeRegionPainterOrderPlanner {
  private readonly bucketPool: NativeRegionPainterInsertion[][] = []
  private readonly gathered: GatheredRegionPainterEntry[] = []
  private readonly gatheredPool: GatheredRegionPainterEntry[] = []
  private readonly knownIds = new Set<string>()
  private readonly orderedLayers: ReusablePositionedRegionPainterLayer[] = []
  private readonly pendingRows: number[] = []
  private readonly positionedPool: ReusablePositionedRegionPainterLayer[] = []
  private readonly registrations: Record<
    NativeRegionManagerLane,
    Map<number, string>
  > = {
    actor: new Map(),
    scenery: new Map(),
    transient: new Map(),
  }
  private readonly result: {
    orderedLayers: ReusablePositionedRegionPainterLayer[]
    queueEndZIndex: number
  } = {
    orderedLayers: this.orderedLayers,
    queueEndZIndex: 1,
  }
  private readonly rows = new Map<number, NativeRegionPainterInsertion[]>()
  private referenceY = 0

  build({
    entries,
    referenceY,
  }: {
    readonly entries: readonly NativeRegionPainterEntry[]
    readonly referenceY: number
  }): NativeRegionPainterOrder {
    requireFinite(referenceY, 'reference Y')
    this.reset()
    this.referenceY = referenceY

    for (let sourceOrder = 0; sourceOrder < entries.length; sourceOrder += 1) {
      const entry = entries[sourceOrder]!
      const gathered = this.gatheredPool.pop() ?? { entry, sourceOrder }
      gathered.entry = entry
      gathered.sourceOrder = sourceOrder
      this.gathered.push(gathered)
    }
    this.gathered.sort(compareGatheredEntries)

    for (const { entry } of this.gathered) {
      validateRegistration(entry.registration)
      const laneRegistrations = this.registrations[entry.registration.managerLane]
      const registeredId = laneRegistrations.get(entry.registration.registrationOrdinal)
      if (registeredId !== undefined) {
        throw new Error(
          `duplicate native ${entry.registration.managerLane} registration ordinal ${entry.registration.registrationOrdinal} for ${registeredId} and ${entry.id}`,
        )
      }
      laneRegistrations.set(entry.registration.registrationOrdinal, entry.id)
      this.append(entry, null)
    }

    let pendingIndex = 0
    let zIndex = 1
    while (pendingIndex < this.pendingRows.length) {
      const row = this.pendingRows[pendingIndex++]!
      const bucket = this.rows.get(row)
      if (!bucket) throw new Error(`native Region row ${row} disappeared during flush`)
      for (let index = 0; index < bucket.length; index += 1) {
        const entry = bucket[index]!
        if (entry.visible) {
          const positionedIndex = this.orderedLayers.length
          let positioned = this.positionedPool[positionedIndex]
          if (!positioned) {
            positioned = { id: entry.id, row, zIndex }
            this.positionedPool.push(positioned)
          } else {
            positioned.id = entry.id
            positioned.row = row
            positioned.zIndex = zIndex
          }
          this.orderedLayers.push(positioned)
          zIndex += 1
        }
        for (const insertion of entry.insertions ?? []) this.append(insertion, row)
      }
      this.rows.delete(row)
      bucket.length = 0
      this.bucketPool.push(bucket)
    }

    this.result.queueEndZIndex = zIndex
    return this.result
  }

  private append(
    entry: NativeRegionPainterInsertion,
    currentRow: number | null,
  ): void {
    validateEntry(entry)
    if (this.knownIds.has(entry.id)) {
      throw new Error(`duplicate native Region painter id ${entry.id}`)
    }
    this.knownIds.add(entry.id)
    const row = nativeRegionPainterRow(entry.worldY, entry.sortBias, this.referenceY)
    if (currentRow !== null && row < currentRow) {
      throw new Error(
        `native Region painter ${entry.id} cannot insert into a Region row that already painted`,
      )
    }
    let bucket = this.rows.get(row)
    if (!bucket) {
      bucket = this.bucketPool.pop() ?? []
      this.rows.set(row, bucket)
      insertSortedUnique(this.pendingRows, row)
    }
    bucket.push(entry)
  }

  private reset(): void {
    for (const bucket of this.rows.values()) {
      bucket.length = 0
      this.bucketPool.push(bucket)
    }
    this.rows.clear()
    this.knownIds.clear()
    this.registrations.actor.clear()
    this.registrations.scenery.clear()
    this.registrations.transient.clear()
    this.pendingRows.length = 0
    this.orderedLayers.length = 0
    for (const gathered of this.gathered) this.gatheredPool.push(gathered)
    this.gathered.length = 0
  }
}

function compareGatheredEntries(
  left: GatheredRegionPainterEntry,
  right: GatheredRegionPainterEntry,
): number {
  return (
    MANAGER_LANE_ORDER[left.entry.registration.managerLane]
    - MANAGER_LANE_ORDER[right.entry.registration.managerLane]
    || left.entry.registration.registrationOrdinal
    - right.entry.registration.registrationOrdinal
    || left.sourceOrder - right.sourceOrder
  )
}

/**
 * Retained synchronous planner for presentation-cadence Region ordering.
 * Results remain valid only until the next build or clear call.
 */
export class NativeRegionPainterPlanner {
  private activeQueuedSlotCount = 0
  private activeRootSlotCount = 0
  private readonly bucketPool: NativeRegionPainterQueuedSlot[][] = []
  private readonly entryByPlacement: (
    | NativeRegionPainterInsertion
    | NativeRegionPainterPlannerEntry
  )[] = []
  private readonly knownIds = new Set<string>()
  private readonly laneNeedsSort: [boolean, boolean, boolean] = [false, false, false]
  private readonly orderedLayers: MutablePositionedNativeRegionPainterLayer[] = []
  private readonly pendingRows: number[] = []
  private readonly placementPool: MutablePositionedNativeRegionPainterLayer[] = []
  private readonly queuedSlotPool: NativeRegionPainterQueuedSlot[] = []
  private readonly result: MutableNativeRegionPainterOrder = {
    orderedLayers: this.orderedLayers,
    queueEndZIndex: 1,
  }
  private readonly rootByPlacement: NativeRegionPainterPlannerEntry[] = []
  private readonly rootsByLane: [
    NativeRegionPainterRootSlot[],
    NativeRegionPainterRootSlot[],
    NativeRegionPainterRootSlot[],
  ] = [[], [], []]
  private readonly rootSlotPool: NativeRegionPainterRootSlot[] = []
  private readonly rows = new Map<number, NativeRegionPainterQueuedSlot[]>()
  private retainedQueuedSlotCount = 0
  private retainedRootSlotCount = 0

  build(
    entries: readonly NativeRegionPainterPlannerEntry[],
    referenceY: number,
  ): NativeRegionPainterOrder {
    this.beginBuild()
    requireFinite(referenceY, 'reference Y')
    const referenceIntegerY = Math.trunc(referenceY)

    for (let sourceOrder = 0; sourceOrder < entries.length; sourceOrder += 1) {
      const entry = entries[sourceOrder]!
      validateEntry(entry)
      validateRegistration(entry.registration)
      const slot = this.acquireRootSlot(entry, sourceOrder)
      const laneIndex = MANAGER_LANE_ORDER[entry.registration.managerLane]
      const roots = this.rootsByLane[laneIndex]!
      const previous = roots[roots.length - 1]?.entry
      if (
        previous
        && previous.registration.registrationOrdinal
          > entry.registration.registrationOrdinal
      ) {
        this.laneNeedsSort[laneIndex] = true
      }
      roots.push(slot)
    }

    for (let laneIndex = 0; laneIndex < this.rootsByLane.length; laneIndex += 1) {
      const roots = this.rootsByLane[laneIndex]!
      if (this.laneNeedsSort[laneIndex]) roots.sort(compareRootSlots)
      let previous: NativeRegionPainterPlannerEntry | null = null
      for (const slot of roots) {
        const entry = slot.entry!
        if (
          previous !== null
          && previous.registration.registrationOrdinal
            === entry.registration.registrationOrdinal
        ) {
          throw new Error(
            `duplicate native ${entry.registration.managerLane} registration ordinal ${entry.registration.registrationOrdinal} for ${previous.id} and ${entry.id}`,
          )
        }
        this.append(entry, entry, null, referenceIntegerY)
        previous = entry
      }
    }

    let zIndex = 1
    let pendingRowIndex = 0
    while (pendingRowIndex < this.pendingRows.length) {
      const row = this.pendingRows[pendingRowIndex]!
      pendingRowIndex += 1
      const bucket = this.rows.get(row)
      if (!bucket) throw new Error(`native Region row ${row} disappeared during flush`)
      for (let index = 0; index < bucket.length; index += 1) {
        const slot = bucket[index]!
        const entry = slot.entry!
        if (entry.visible ?? true) {
          this.appendPlacement(entry, slot.root!, row, zIndex)
          zIndex += 1
        }
        for (const insertion of entry.insertions ?? []) {
          this.append(insertion, slot.root!, row, referenceIntegerY)
        }
      }
      this.rows.delete(row)
      bucket.length = 0
      this.bucketPool.push(bucket)
    }

    this.releaseUnusedSlotReferences()
    this.result.queueEndZIndex = zIndex
    return this.result
  }

  clear(): void {
    this.beginBuild()
    for (let index = 0; index < this.retainedRootSlotCount; index += 1) {
      this.rootSlotPool[index]!.entry = null
    }
    for (let index = 0; index < this.retainedQueuedSlotCount; index += 1) {
      const slot = this.queuedSlotPool[index]!
      slot.entry = null
      slot.root = null
    }
    this.retainedRootSlotCount = 0
    this.retainedQueuedSlotCount = 0
    this.entryByPlacement.length = 0
    this.rootByPlacement.length = 0
    this.orderedLayers.length = 0
    for (const placement of this.placementPool) placement.id = ''
    this.placementPool.length = 0
    this.queuedSlotPool.length = 0
    this.rootSlotPool.length = 0
    this.bucketPool.length = 0
    this.result.queueEndZIndex = 1
  }

  rootEntryAt(index: number): NativeRegionPainterPlannerEntry {
    const entry = this.rootByPlacement[index]
    if (!entry) throw new RangeError(`native Region root placement ${index} is unavailable`)
    return entry
  }

  isInsertionAt(index: number): boolean {
    return this.entryAt(index) !== this.rootEntryAt(index)
  }

  private entryAt(
    index: number,
  ): NativeRegionPainterInsertion | NativeRegionPainterPlannerEntry {
    const entry = this.entryByPlacement[index]
    if (!entry) throw new RangeError(`native Region placement ${index} is unavailable`)
    return entry
  }

  private acquireRootSlot(
    entry: NativeRegionPainterPlannerEntry,
    sourceOrder: number,
  ): NativeRegionPainterRootSlot {
    const index = this.activeRootSlotCount
    this.activeRootSlotCount += 1
    const slot = this.rootSlotPool[index] ?? { entry: null, sourceOrder: 0 }
    slot.entry = entry
    slot.sourceOrder = sourceOrder
    this.rootSlotPool[index] = slot
    this.retainedRootSlotCount = Math.max(this.retainedRootSlotCount, this.activeRootSlotCount)
    return slot
  }

  private append(
    entry: NativeRegionPainterInsertion | NativeRegionPainterPlannerEntry,
    root: NativeRegionPainterPlannerEntry,
    currentRow: number | null,
    referenceIntegerY: number,
  ): void {
    validateEntry(entry)
    if (this.knownIds.has(entry.id)) {
      throw new Error(`duplicate native Region painter id ${entry.id}`)
    }
    this.knownIds.add(entry.id)
    const row = nativeRegionPainterRowFromIntegerReference(
      entry.worldY,
      entry.sortBias,
      referenceIntegerY,
    )
    if (currentRow !== null && row < currentRow) {
      throw new Error(
        `native Region painter ${entry.id} cannot insert into a Region row that already painted`,
      )
    }
    let bucket = this.rows.get(row)
    if (!bucket) {
      bucket = this.bucketPool.pop() ?? []
      this.rows.set(row, bucket)
      insertSortedUnique(this.pendingRows, row)
    }
    const index = this.activeQueuedSlotCount
    this.activeQueuedSlotCount += 1
    const slot = this.queuedSlotPool[index] ?? { entry: null, root: null, row: 0 }
    slot.entry = entry
    slot.root = root
    slot.row = row
    this.queuedSlotPool[index] = slot
    this.retainedQueuedSlotCount = Math.max(
      this.retainedQueuedSlotCount,
      this.activeQueuedSlotCount,
    )
    bucket.push(slot)
  }

  private appendPlacement(
    entry: NativeRegionPainterInsertion | NativeRegionPainterPlannerEntry,
    root: NativeRegionPainterPlannerEntry,
    row: number,
    zIndex: number,
  ): void {
    const index = this.orderedLayers.length
    const placement = this.placementPool[index] ?? { id: '', row: 0, zIndex: 0 }
    placement.id = entry.id
    placement.row = row
    placement.zIndex = zIndex
    this.placementPool[index] = placement
    this.orderedLayers.push(placement)
    this.entryByPlacement.push(entry)
    this.rootByPlacement.push(root)
  }

  private beginBuild(): void {
    this.activeRootSlotCount = 0
    this.activeQueuedSlotCount = 0
    for (const roots of this.rootsByLane) roots.length = 0
    this.laneNeedsSort.fill(false)
    for (const bucket of this.rows.values()) {
      bucket.length = 0
      this.bucketPool.push(bucket)
    }
    this.rows.clear()
    this.pendingRows.length = 0
    this.knownIds.clear()
    this.orderedLayers.length = 0
    this.entryByPlacement.length = 0
    this.rootByPlacement.length = 0
    this.result.queueEndZIndex = 1
  }

  private releaseUnusedSlotReferences(): void {
    for (
      let index = this.activeRootSlotCount;
      index < this.retainedRootSlotCount;
      index += 1
    ) {
      this.rootSlotPool[index]!.entry = null
    }
    for (
      let index = this.activeQueuedSlotCount;
      index < this.retainedQueuedSlotCount;
      index += 1
    ) {
      const slot = this.queuedSlotPool[index]!
      slot.entry = null
      slot.root = null
    }
    this.retainedRootSlotCount = this.activeRootSlotCount
    this.retainedQueuedSlotCount = this.activeQueuedSlotCount
  }
}

function compareRootSlots(
  left: NativeRegionPainterRootSlot,
  right: NativeRegionPainterRootSlot,
): number {
  return left.entry!.registration.registrationOrdinal
    - right.entry!.registration.registrationOrdinal
    || left.sourceOrder - right.sourceOrder
}

function nativeRegionPainterRowFromIntegerReference(
  worldY: number,
  sortBias: number,
  referenceIntegerY: number,
): number {
  const relative = Math.trunc(worldY) + Math.trunc(sortBias) - referenceIntegerY
  const row = Math.trunc(relative / 2)
  return row === 0 ? 0 : row
}

function validateEntry(entry: Pick<NativeRegionPainterInsertion, 'id' | 'sortBias' | 'worldY'>): void {
  if (entry.id.length === 0) throw new Error('native Region painter id must not be empty')
  requireFinite(entry.worldY, `${entry.id} world Y`)
  requireFinite(entry.sortBias, `${entry.id} sort bias`)
}

function validateRegistration(registration: NativeRegionPainterRegistration): void {
  if (!NATIVE_REGION_MANAGER_LANES.includes(registration.managerLane)) {
    throw new Error(`unsupported native Region manager lane ${registration.managerLane}`)
  }
  if (!Number.isSafeInteger(registration.registrationOrdinal)
      || registration.registrationOrdinal < 0) {
    throw new RangeError('native Region registration ordinal must be nonnegative')
  }
}

function requireFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${field} must be finite`)
}

function insertSortedUnique(values: number[], value: number): void {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (values[middle]! < value) low = middle + 1
    else high = middle
  }
  if (values[low] !== value) values.splice(low, 0, value)
}
