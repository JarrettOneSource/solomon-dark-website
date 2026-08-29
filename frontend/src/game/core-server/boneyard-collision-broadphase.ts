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

export interface CollisionBroadphaseSelection {
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
const MAXIMUM_INDEXED_CELLS_PER_PRIMITIVE = 4_096
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

  selectBounds(
    minimumX: number,
    minimumY: number,
    maximumX: number,
    maximumY: number,
  ): CollisionBroadphaseSelection {
    this.selection.circleIndices = this.circles.selectBounds(
      minimumX,
      minimumY,
      maximumX,
      maximumY,
    )
    this.selection.polygonIndices = this.polygons.selectBounds(
      minimumX,
      minimumY,
      maximumX,
      maximumY,
    )
    this.selection.segmentIndices = this.segments.selectBounds(
      minimumX,
      minimumY,
      maximumX,
      maximumY,
    )
    return this.selection
  }
}

class PrimitiveCellGrid {
  private readonly columns = new Map<number, Map<number, PrimitiveCell>>()
  private epoch = 0
  private readonly globalIndices: number[] = []
  private readonly marks: Uint32Array
  private readonly scratch: number[] = []

  constructor(bounds: readonly PrimitiveBounds[]) {
    this.marks = new Uint32Array(bounds.length)
    for (const [index, primitive] of bounds.entries()) this.insert(index, primitive)
  }

  select(center: Readonly<BoneyardPoint>, radius: number): readonly number[] {
    return this.selectCells(
      cellCoordinate(center.x - radius),
      cellCoordinate(center.y - radius),
      cellCoordinate(center.x + radius),
      cellCoordinate(center.y + radius),
    )
  }

  selectBounds(
    minimumX: number,
    minimumY: number,
    maximumX: number,
    maximumY: number,
  ): readonly number[] {
    return this.selectCells(
      cellCoordinate(minimumX),
      cellCoordinate(minimumY),
      cellCoordinate(maximumX),
      cellCoordinate(maximumY),
    )
  }

  private selectCells(
    minimumCellX: number,
    minimumCellY: number,
    maximumCellX: number,
    maximumCellY: number,
  ): readonly number[] {
    if (
      this.globalIndices.length === 0
      && minimumCellX === maximumCellX
      && minimumCellY === maximumCellY
    ) {
      return this.cell(minimumCellX, minimumCellY)?.indices ?? EMPTY_INDICES
    }

    this.advanceEpoch()
    this.scratch.length = 0
    for (const index of this.globalIndices) this.append(index)
    const columnSpan = maximumCellX - minimumCellX + 1
    if (columnSpan <= this.columns.size) {
      for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
        const column = this.columns.get(cellX)
        if (column) this.selectColumn(column, minimumCellY, maximumCellY)
      }
    } else {
      for (const [cellX, column] of this.columns) {
        if (cellX < minimumCellX || cellX > maximumCellX) continue
        this.selectColumn(column, minimumCellY, maximumCellY)
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

  private selectColumn(
    column: ReadonlyMap<number, PrimitiveCell>,
    minimumCellY: number,
    maximumCellY: number,
  ): void {
    const rowSpan = maximumCellY - minimumCellY + 1
    if (rowSpan <= column.size) {
      for (let cellY = minimumCellY; cellY <= maximumCellY; cellY += 1) {
        const cell = column.get(cellY)
        if (cell) this.appendCell(cell)
      }
      return
    }
    for (const [cellY, cell] of column) {
      if (cellY >= minimumCellY && cellY <= maximumCellY) this.appendCell(cell)
    }
  }

  private appendCell(cell: PrimitiveCell): void {
    for (const index of cell.indices) this.append(index)
  }

  private append(index: number): void {
    if (this.marks[index] === this.epoch) return
    this.marks[index] = this.epoch
    this.scratch.push(index)
  }

  private insert(index: number, bounds: PrimitiveBounds): void {
    const minimumCellX = cellCoordinate(bounds.minimumX)
    const maximumCellX = cellCoordinate(bounds.maximumX)
    const minimumCellY = cellCoordinate(bounds.minimumY)
    const maximumCellY = cellCoordinate(bounds.maximumY)
    const columnSpan = maximumCellX - minimumCellX + 1
    const rowSpan = maximumCellY - minimumCellY + 1
    if (
      !Number.isSafeInteger(minimumCellX)
      || !Number.isSafeInteger(maximumCellX)
      || !Number.isSafeInteger(minimumCellY)
      || !Number.isSafeInteger(maximumCellY)
      || columnSpan <= 0
      || rowSpan <= 0
      || columnSpan > MAXIMUM_INDEXED_CELLS_PER_PRIMITIVE
      || rowSpan > MAXIMUM_INDEXED_CELLS_PER_PRIMITIVE
      || columnSpan * rowSpan > MAXIMUM_INDEXED_CELLS_PER_PRIMITIVE
    ) {
      this.globalIndices.push(index)
      return
    }
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
