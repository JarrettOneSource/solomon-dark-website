import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import type {
  BoneyardCollisionCircle,
  BoneyardCollisionPolygon,
  BoneyardCollisionSegment,
  BoneyardCollisionWorld,
} from './boneyard-collision.ts'

interface PrimitiveBounds {
  readonly maximumX: number
  readonly maximumY: number
  readonly minimumX: number
  readonly minimumY: number
}

interface CollisionBroadphaseSelection {
  circleIndices: readonly number[]
  polygonIndices: readonly number[]
  segmentIndices: readonly number[]
}

interface MutableCollisionBroadphaseSelection {
  circleIndices: readonly number[]
  polygonIndices: readonly number[]
  segmentIndices: readonly number[]
}

interface PrimitiveCell {
  readonly indices: number[]
}

const COLLISION_BROADPHASE_CELL_SIZE = 128
const EMPTY_INDICES: readonly number[] = Object.freeze([])

/**
 * Representation-only broadphase for immutable Boneyard collision geometry.
 * Candidate indices always return in source-array order; the collision owner
 * retains every strict comparison, first-contact rule, and response formula.
 */
export class BoneyardCollisionBroadphase {
  private readonly circles: PrimitiveCellGrid
  private readonly polygons: PrimitiveCellGrid
  private readonly segments: PrimitiveCellGrid
  private readonly selection: MutableCollisionBroadphaseSelection = {
    circleIndices: EMPTY_INDICES,
    polygonIndices: EMPTY_INDICES,
    segmentIndices: EMPTY_INDICES,
  }

  constructor(world: BoneyardCollisionWorld) {
    this.circles = new PrimitiveCellGrid(world.circles.map(circleBounds))
    this.polygons = new PrimitiveCellGrid(world.polygons.map(polygonBounds))
    this.segments = new PrimitiveCellGrid(world.segments.map(segmentBounds))
  }

  select(center: Readonly<BoneyardPoint>, radius: number): CollisionBroadphaseSelection {
    this.selection.circleIndices = this.circles.select(center, radius)
    this.selection.polygonIndices = this.polygons.select(center, radius)
    this.selection.segmentIndices = this.segments.select(center, radius)
    return this.selection
  }
}

class PrimitiveCellGrid {
  private readonly columns = new Map<number, Map<number, PrimitiveCell>>()
  private epoch = 0
  private readonly marks: Uint32Array
  private readonly scratch: number[] = []

  constructor(bounds: readonly PrimitiveBounds[]) {
    this.marks = new Uint32Array(bounds.length)
    for (const [index, primitive] of bounds.entries()) this.insert(index, primitive)
  }

  select(center: Readonly<BoneyardPoint>, radius: number): readonly number[] {
    const minimumCellX = cellCoordinate(center.x - radius)
    const maximumCellX = cellCoordinate(center.x + radius)
    const minimumCellY = cellCoordinate(center.y - radius)
    const maximumCellY = cellCoordinate(center.y + radius)
    if (minimumCellX === maximumCellX && minimumCellY === maximumCellY) {
      return this.cell(minimumCellX, minimumCellY)?.indices ?? EMPTY_INDICES
    }

    this.advanceEpoch()
    this.scratch.length = 0
    for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
      const column = this.columns.get(cellX)
      if (!column) continue
      for (let cellY = minimumCellY; cellY <= maximumCellY; cellY += 1) {
        const cell = column.get(cellY)
        if (!cell) continue
        for (const index of cell.indices) {
          if (this.marks[index] === this.epoch) continue
          this.marks[index] = this.epoch
          this.scratch.push(index)
        }
      }
    }
    this.scratch.sort(ascendingNumber)
    return this.scratch
  }

  private advanceEpoch(): void {
    this.epoch = (this.epoch + 1) >>> 0
    if (this.epoch !== 0) return
    this.marks.fill(0)
    this.epoch = 1
  }

  private cell(cellX: number, cellY: number): PrimitiveCell | undefined {
    return this.columns.get(cellX)?.get(cellY)
  }

  private insert(index: number, bounds: PrimitiveBounds): void {
    const minimumCellX = cellCoordinate(bounds.minimumX)
    const maximumCellX = cellCoordinate(bounds.maximumX)
    const minimumCellY = cellCoordinate(bounds.minimumY)
    const maximumCellY = cellCoordinate(bounds.maximumY)
    for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
      let column = this.columns.get(cellX)
      if (!column) {
        column = new Map()
        this.columns.set(cellX, column)
      }
      for (let cellY = minimumCellY; cellY <= maximumCellY; cellY += 1) {
        let cell = column.get(cellY)
        if (!cell) {
          cell = { indices: [] }
          column.set(cellY, cell)
        }
        cell.indices.push(index)
      }
    }
  }
}

function circleBounds(circle: BoneyardCollisionCircle): PrimitiveBounds {
  return {
    maximumX: circle.center.x + circle.radius,
    maximumY: circle.center.y + circle.radius,
    minimumX: circle.center.x - circle.radius,
    minimumY: circle.center.y - circle.radius,
  }
}

function polygonBounds(polygon: BoneyardCollisionPolygon): PrimitiveBounds {
  let minimumX = Number.POSITIVE_INFINITY
  let minimumY = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY
  for (const point of polygon.points) {
    minimumX = Math.min(minimumX, point.x)
    minimumY = Math.min(minimumY, point.y)
    maximumX = Math.max(maximumX, point.x)
    maximumY = Math.max(maximumY, point.y)
  }
  return { maximumX, maximumY, minimumX, minimumY }
}

function segmentBounds(segment: BoneyardCollisionSegment): PrimitiveBounds {
  return {
    maximumX: Math.max(segment.start.x, segment.end.x) + segment.radius,
    maximumY: Math.max(segment.start.y, segment.end.y) + segment.radius,
    minimumX: Math.min(segment.start.x, segment.end.x) - segment.radius,
    minimumY: Math.min(segment.start.y, segment.end.y) - segment.radius,
  }
}

function cellCoordinate(value: number): number {
  return Math.floor(value / COLLISION_BROADPHASE_CELL_SIZE)
}

function ascendingNumber(left: number, right: number): number {
  return left - right
}
