import type { ActorPhysicsBody } from './actor-physics.ts'

export interface SpatialBounds {
  maximumX: number
  maximumY: number
  minimumX: number
  minimumY: number
}

export interface ActorMotionBroadphase {
  readonly revision: number
  candidateIndices(bodyIndex: number, bodies: readonly ActorPhysicsBody[]): readonly number[]
  rebuild(bodies: readonly ActorPhysicsBody[]): void
  update(bodyIndex: number, bodies: readonly ActorPhysicsBody[]): void
}

interface CellRange {
  maximumX: number
  maximumY: number
  minimumX: number
  minimumY: number
}

export class StableSpatialGrid {
  private readonly cellSize: number
  private readonly cells = new Map<number, Map<number, number[]>>()
  private readonly candidateIndicesBuffer: number[] = []
  private candidateMarks = new Uint32Array(0)
  private generation = 0
  private gridRevision = 0
  private readonly memberships: Array<CellRange | undefined> = []

  constructor(cellSize: number) {
    if (!(cellSize > 0) || !Number.isFinite(cellSize)) {
      throw new RangeError('spatial grid cellSize must be positive and finite')
    }
    this.cellSize = cellSize
  }

  get revision(): number {
    return this.gridRevision
  }

  rebuild(count: number, boundsAt: (index: number) => SpatialBounds): void {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('spatial grid count must be a nonnegative integer')
    }
    this.cells.clear()
    this.gridRevision += 1
    this.memberships.length = count
    if (this.candidateMarks.length < count) this.candidateMarks = new Uint32Array(count)
    for (let index = 0; index < count; index += 1) {
      const range = this.cellRange(boundsAt(index))
      this.memberships[index] = range
      this.insert(index, range)
    }
  }

  update(index: number, bounds: SpatialBounds): void {
    const previous = this.memberships[index]
    if (!previous) throw new RangeError(`spatial grid index ${index} is not active`)
    const next = this.cellRange(bounds)
    if (sameRange(previous, next)) return
    this.remove(index, previous)
    this.memberships[index] = next
    this.insert(index, next)
    this.gridRevision += 1
  }

  query(bounds: SpatialBounds): readonly number[] {
    const range = this.cellRange(bounds)
    this.candidateIndicesBuffer.length = 0
    this.generation = this.generation === 0xffff_ffff ? 1 : this.generation + 1
    if (this.generation === 1) this.candidateMarks.fill(0)
    for (let cellY = range.minimumY; cellY <= range.maximumY; cellY += 1) {
      for (let cellX = range.minimumX; cellX <= range.maximumX; cellX += 1) {
        const entries = this.cells.get(cellY)?.get(cellX)
        if (!entries) continue
        for (const index of entries) {
          if (this.candidateMarks[index] === this.generation) continue
          this.candidateMarks[index] = this.generation
          this.candidateIndicesBuffer.push(index)
        }
      }
    }
    this.candidateIndicesBuffer.sort(numericAscending)
    return this.candidateIndicesBuffer
  }

  private cellRange(bounds: SpatialBounds): CellRange {
    if (
      !Number.isFinite(bounds.minimumX)
      || !Number.isFinite(bounds.minimumY)
      || !Number.isFinite(bounds.maximumX)
      || !Number.isFinite(bounds.maximumY)
      || bounds.minimumX > bounds.maximumX
      || bounds.minimumY > bounds.maximumY
    ) throw new RangeError('spatial bounds must be finite and ordered')
    return {
      maximumX: Math.floor(bounds.maximumX / this.cellSize),
      maximumY: Math.floor(bounds.maximumY / this.cellSize),
      minimumX: Math.floor(bounds.minimumX / this.cellSize),
      minimumY: Math.floor(bounds.minimumY / this.cellSize),
    }
  }

  private insert(index: number, range: CellRange): void {
    for (let cellY = range.minimumY; cellY <= range.maximumY; cellY += 1) {
      let row = this.cells.get(cellY)
      if (!row) {
        row = new Map()
        this.cells.set(cellY, row)
      }
      for (let cellX = range.minimumX; cellX <= range.maximumX; cellX += 1) {
        let entries = row.get(cellX)
        if (!entries) {
          entries = []
          row.set(cellX, entries)
        }
        entries.push(index)
      }
    }
  }

  private remove(index: number, range: CellRange): void {
    for (let cellY = range.minimumY; cellY <= range.maximumY; cellY += 1) {
      const row = this.cells.get(cellY)
      if (!row) continue
      for (let cellX = range.minimumX; cellX <= range.maximumX; cellX += 1) {
        const entries = row.get(cellX)
        if (!entries) continue
        const entryIndex = entries.indexOf(index)
        if (entryIndex >= 0) entries.splice(entryIndex, 1)
        if (entries.length === 0) row.delete(cellX)
      }
      if (row.size === 0) this.cells.delete(cellY)
    }
  }
}

export class DynamicActorGrid implements ActorMotionBroadphase {
  private readonly grid: StableSpatialGrid

  constructor(cellSize: number) {
    this.grid = new StableSpatialGrid(cellSize)
  }

  get revision(): number {
    return this.grid.revision
  }

  rebuild(bodies: readonly ActorPhysicsBody[]): void {
    this.grid.rebuild(bodies.length, (index) => bodyBounds(bodies[index]))
  }

  update(bodyIndex: number, bodies: readonly ActorPhysicsBody[]): void {
    this.grid.update(bodyIndex, bodyBounds(bodies[bodyIndex]))
  }

  candidateIndices(
    bodyIndex: number,
    bodies: readonly ActorPhysicsBody[],
  ): readonly number[] {
    return this.grid.query(bodyBounds(bodies[bodyIndex]))
  }
}

export function actorGridCellSize(bodies: readonly ActorPhysicsBody[]): number {
  let maximumRadius = 16
  for (const body of bodies) maximumRadius = Math.max(maximumRadius, body.radius)
  return maximumRadius * 2
}

function bodyBounds(body: Readonly<ActorPhysicsBody>): SpatialBounds {
  return {
    maximumX: body.position.x + body.radius,
    maximumY: body.position.y + body.radius,
    minimumX: body.position.x - body.radius,
    minimumY: body.position.y - body.radius,
  }
}

function sameRange(first: CellRange, second: CellRange): boolean {
  return first.minimumX === second.minimumX
    && first.minimumY === second.minimumY
    && first.maximumX === second.maximumX
    && first.maximumY === second.maximumY
}

function numericAscending(first: number, second: number): number {
  return first - second
}
