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

export type NativeRegionPainterPlannerEntry = Omit<NativeRegionPainterEntry, 'visible'> & {
  readonly visible?: boolean
}

interface NativeRegionPainterQueuedSlot {
  entry: NativeRegionPainterInsertion | NativeRegionPainterPlannerEntry | null
  root: NativeRegionPainterPlannerEntry | null
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
  const order = new NativeRegionPainterPlanner().build(entries, referenceY)
  for (const positioned of order.orderedLayers) Object.freeze(positioned)
  Object.freeze(order.orderedLayers)
  return Object.freeze(order)
}

/**
 * Retained synchronous planner for presentation-cadence Region ordering.
 * Results remain valid only until the next build or clear call.
 */
export class NativeRegionPainterPlanner {
  private activeQueuedSlotCount = 0
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
    NativeRegionPainterPlannerEntry[],
    NativeRegionPainterPlannerEntry[],
    NativeRegionPainterPlannerEntry[],
  ] = [[], [], []]
  private readonly rows = new Map<number, NativeRegionPainterQueuedSlot[]>()
  private retainedQueuedSlotCount = 0

  build(
    entries: readonly NativeRegionPainterPlannerEntry[],
    referenceY: number,
  ): NativeRegionPainterOrder {
    this.beginBuild()
    requireFinite(referenceY, 'reference Y')
    const referenceIntegerY = Math.trunc(referenceY)

    for (const entry of entries) {
      validateRegistration(entry.registration)
      const laneIndex = MANAGER_LANE_ORDER[entry.registration.managerLane]
      const roots = this.rootsByLane[laneIndex]!
      const previous = roots[roots.length - 1]
      if (
        previous
        && previous.registration.registrationOrdinal
          > entry.registration.registrationOrdinal
      ) {
        this.laneNeedsSort[laneIndex] = true
      }
      roots.push(entry)
    }

    for (let laneIndex = 0; laneIndex < this.rootsByLane.length; laneIndex += 1) {
      const roots = this.rootsByLane[laneIndex]!
      if (this.laneNeedsSort[laneIndex]) roots.sort(compareRoots)
      let previous: NativeRegionPainterPlannerEntry | null = null
      for (const entry of roots) {
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

    this.pendingRows.sort((left, right) => left - right)
    let zIndex = 1
    let pendingRowIndex = 0
    while (pendingRowIndex < this.pendingRows.length) {
      const row = this.pendingRows[pendingRowIndex]!
      pendingRowIndex += 1
      const bucket = this.rows.get(row)!
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
    this.retainedQueuedSlotCount = 0
    this.placementPool.length = 0
    this.queuedSlotPool.length = 0
    this.bucketPool.length = 0
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
      if (currentRow === null) this.pendingRows.push(row)
      else insertSortedRow(this.pendingRows, row)
    }
    const index = this.activeQueuedSlotCount
    this.activeQueuedSlotCount += 1
    const slot = this.queuedSlotPool[index] ?? { entry: null, root: null }
    slot.entry = entry
    slot.root = root
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
      let index = this.activeQueuedSlotCount;
      index < this.retainedQueuedSlotCount;
      index += 1
    ) {
      const slot = this.queuedSlotPool[index]!
      slot.entry = null
      slot.root = null
    }
    this.retainedQueuedSlotCount = this.activeQueuedSlotCount
  }
}

function compareRoots(
  left: NativeRegionPainterPlannerEntry,
  right: NativeRegionPainterPlannerEntry,
): number {
  return left.registration.registrationOrdinal - right.registration.registrationOrdinal
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

function insertSortedRow(values: number[], value: number): void {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (values[middle]! < value) low = middle + 1
    else high = middle
  }
  values.splice(low, 0, value)
}
