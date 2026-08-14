import type { Vector2 } from '../core-kernels/vector.ts'
import { StableSpatialGrid } from '../core-kernels/dynamic-actor-grid.ts'
import type { HubStudentState } from './hub-students.ts'

const STUDENT_NEIGHBOR_CELL_SIZE = 64

export interface HubStudentNeighborQuery {
  candidateIndices(position: Vector2, radius: number): readonly number[]
}

export class HubStudentNeighborGrid implements HubStudentNeighborQuery {
  private readonly grid = new StableSpatialGrid(STUDENT_NEIGHBOR_CELL_SIZE)

  rebuild(students: readonly HubStudentState[]): void {
    this.grid.rebuild(students.length, (index) => {
      const position = students[index].position
      return {
        maximumX: position.x,
        maximumY: position.y,
        minimumX: position.x,
        minimumY: position.y,
      }
    })
  }

  candidateIndices(position: Vector2, radius: number): readonly number[] {
    return this.grid.query({
      maximumX: position.x + radius,
      maximumY: position.y + radius,
      minimumX: position.x - radius,
      minimumY: position.y - radius,
    })
  }
}
