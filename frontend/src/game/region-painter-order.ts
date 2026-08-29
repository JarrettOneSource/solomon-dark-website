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

interface QueuedRegionPainterEntry extends NativeRegionPainterInsertion {
  readonly row: number
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
  requireFinite(referenceY, 'reference Y')
  const knownIds = new Set<string>()
  const registrations = new Map<string, string>()
  const rows = new Map<number, QueuedRegionPainterEntry[]>()
  const pendingRows: number[] = []

  const append = (
    entry: NativeRegionPainterInsertion,
    currentRow: number | null,
  ): void => {
    validateEntry(entry)
    if (knownIds.has(entry.id)) {
      throw new Error(`duplicate native Region painter id ${entry.id}`)
    }
    knownIds.add(entry.id)
    const row = nativeRegionPainterRow(entry.worldY, entry.sortBias, referenceY)
    if (currentRow !== null && row < currentRow) {
      throw new Error(
        `native Region painter ${entry.id} cannot insert into a Region row that already painted`,
      )
    }
    let bucket = rows.get(row)
    if (!bucket) {
      bucket = []
      rows.set(row, bucket)
      insertSortedUnique(pendingRows, row)
    }
    bucket.push({ ...entry, row })
  }

  const gathered = entries
    .map((entry, sourceOrder) => ({ entry, sourceOrder }))
    .sort((left, right) => (
      MANAGER_LANE_ORDER[left.entry.registration.managerLane]
      - MANAGER_LANE_ORDER[right.entry.registration.managerLane]
      || left.entry.registration.registrationOrdinal
      - right.entry.registration.registrationOrdinal
      || left.sourceOrder - right.sourceOrder
    ))

  for (const { entry } of gathered) {
    validateRegistration(entry.registration)
    const registrationKey = (
      `${entry.registration.managerLane}:${entry.registration.registrationOrdinal}`
    )
    const registeredId = registrations.get(registrationKey)
    if (registeredId !== undefined) {
      throw new Error(
        `duplicate native ${entry.registration.managerLane} registration ordinal ${entry.registration.registrationOrdinal} for ${registeredId} and ${entry.id}`,
      )
    }
    registrations.set(registrationKey, entry.id)
    append(entry, null)
  }

  const orderedLayers: PositionedNativeRegionPainterLayer[] = []
  let zIndex = 1
  while (pendingRows.length > 0) {
    const row = pendingRows.shift()!
    const bucket = rows.get(row)
    if (!bucket) throw new Error(`native Region row ${row} disappeared during flush`)
    for (let index = 0; index < bucket.length; index += 1) {
      const entry = bucket[index]!
      if (entry.visible) {
        orderedLayers.push(Object.freeze({ id: entry.id, row, zIndex }))
        zIndex += 1
      }
      for (const insertion of entry.insertions ?? []) append(insertion, row)
    }
    rows.delete(row)
  }

  return Object.freeze({
    orderedLayers: Object.freeze(orderedLayers),
    queueEndZIndex: zIndex,
  })
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
