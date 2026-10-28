import {
  actorHeadingFromVector,
  actorHeadingIndex,
} from '../core-kernels/actor-heading.ts'
import {
  COMPILED_HUB_STUDENT_SPLINES,
  evaluateHubStudentSpline,
} from './hub-student-splines.ts'
import {
  createHubStudentState,
  hubStudentStaticCollisionEnabled,
  HubStudentPopulationState,
  type HubStudentRouteEndBehavior,
  type HubStudentState,
} from './hub-students.ts'

export interface HubStudentFixtureOptions {
  count: number
  routeEndBehavior?: HubStudentRouteEndBehavior
  seed?: number
}

export function createHubStudentFixture(
  options: HubStudentFixtureOptions,
): HubStudentState[] {
  const count = validCount(options.count)
  let rngState = options.seed ?? 0x51d07e57
  const students = new Array<HubStudentState>(count)
  for (let index = 0; index < count; index += 1) {
    const pathId = index % COMPILED_HUB_STUDENT_SPLINES.length
    const desiredSpeed = 0.6 + (index % 8) * 0.04
    const created = createHubStudentState(index, pathId, rngState, desiredSpeed)
    rngState = created.rngState
    const spline = COMPILED_HUB_STUDENT_SPLINES[pathId]
    const pathSpan = Math.max(0.01, spline.points.length - 1.01)
    const pathCursor = (0.15 + fractional(index * 0.6180339887498949) * 0.7) * pathSpan
    const position = evaluateHubStudentSpline(pathId, pathCursor)
    const nextPosition = evaluateHubStudentSpline(
      pathId,
      Math.min(pathSpan, pathCursor + 0.01),
    )
    const heading = actorHeadingFromVector(
      nextPosition.x - position.x,
      nextPosition.y - position.y,
    )
    students[index] = {
      ...created,
      heading,
      headingIndex: actorHeadingIndex(heading),
      pathCursor,
      position,
      staticCollisionEnabled: hubStudentStaticCollisionEnabled(position),
      tick: index % 900,
    }
  }
  return students
}

export function createHubStudentFixturePopulation(
  options: HubStudentFixtureOptions,
): HubStudentPopulationState {
  const students = createHubStudentFixture(options)
  return new HubStudentPopulationState({
    nextId: students.length,
    rarePathDenominator: 20,
    routeEndBehavior: options.routeEndBehavior,
    rngState: options.seed ?? 0x51d07e57,
    spawningEnabled: false,
    spawnRequestPending: false,
    spawnTickerCounter: 0,
    students,
  })
}

function validCount(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 16_384) {
    throw new RangeError('Student fixture count must be an integer within 0..16384')
  }
  return value
}

function fractional(value: number): number {
  return value - Math.floor(value)
}
