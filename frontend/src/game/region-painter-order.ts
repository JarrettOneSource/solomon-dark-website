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

function validateEntry(entry: NativeRegionPainterInsertion): void {
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
