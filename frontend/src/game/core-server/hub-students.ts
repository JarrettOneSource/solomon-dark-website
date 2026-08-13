import {
  actorHeadingFromVector,
  actorHeadingIndex,
} from '../core-kernels/actor-heading.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import {
  COMPILED_HUB_STUDENT_SPLINES,
  evaluateHubStudentSpline,
} from './hub-student-splines.ts'

export interface HubStudentProp {
  angle: number
  paletteIndex: number
  radius: number
}

export interface HubStudentPhysicalProfile {
  pushResistance: number
  pushStrength: number
  radius: number
}

export interface HubStudentState {
  currentSpeed: number
  desiredSpeed: number
  framePhase: number
  gaitDegrees: number
  heading: number
  headingIndex: number
  id: number
  pathCursor: number
  pathId: number
  pathStep: 1 | -1
  position: Vector2
  profile: HubStudentPhysicalProfile
  props: readonly HubStudentProp[]
  reading: boolean
  retired: boolean
  rngState: number
  scale: number
  staticCollisionEnabled: boolean
  tick: number
  wander: Vector2
}

export interface HubStudentRoutePlan {
  delta: Vector2
  state: HubStudentState
}

export interface HubStudentPopulationState {
  nextId: number
  rarePathDenominator: number
  rngState: number
  spawnRequestPending: boolean
  spawnTickerCounter: number
  students: HubStudentState[]
}

const NATIVE_STUDENT_TICK_SECONDS = 0.01
const NATIVE_PATH_CURSOR_STEP = 0.1
const NATIVE_PATH_TARGET_DIVISOR = 5.5
const NATIVE_SPEED_ACCELERATION = 0.01
const NATIVE_TURN_STEP_DEGREES = 0.5
const NATIVE_ORDINARY_TURN_STEPS = 3
const NATIVE_FAST_TURN_STEPS = 9
const NATIVE_SPAWN_REQUEST_TICKS = 35
const NATIVE_RARE_PATH_DENOMINATOR = 20
const NATIVE_PRESENTATION_WARMUP_TICKS = 900
const NATIVE_STATIC_COLLISION_REFRESH_TICKS = 15

interface HubRectangle {
  height: number
  width: number
  x: number
  y: number
}

const NATIVE_COLLISION_INSET: HubRectangle = {
  x: 40,
  y: 40,
  width: 1920,
  height: 1020,
}

const NATIVE_STUDENT_DOORWAYS: readonly HubRectangle[] = [
  { x: 752, y: 134, width: 44, height: 45 },
  { x: 584, y: 34, width: 121, height: 67 },
  { x: 1288, y: 80, width: 179, height: 148 },
  { x: 1771, y: -11, width: 309, height: 255 },
]

function containsPoint(rectangle: HubRectangle, point: Vector2): boolean {
  return point.x >= rectangle.x
    && point.x <= rectangle.x + rectangle.width
    && point.y >= rectangle.y
    && point.y <= rectangle.y + rectangle.height
}

export function hubStudentStaticCollisionEnabled(position: Vector2): boolean {
  return containsPoint(NATIVE_COLLISION_INSET, position)
    && !NATIVE_STUDENT_DOORWAYS.some((doorway) => containsPoint(doorway, position))
}

function nextRandom(state: number): { state: number; value: number } {
  // Browser simulation is deterministic, while distributions and call sites
  // follow the recovered native RNG ownership.
  let value = state >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  value >>>= 0
  return { state: value || 0x6d2b79f5, value: value / 0x100000000 }
}

function randomFloat(
  state: number,
  maximum = 1,
): { state: number; value: number } {
  const sample = nextRandom(state)
  return { state: sample.state, value: sample.value * maximum }
}

function randomInteger(
  state: number,
  maximumExclusive: number,
): { state: number; value: number } {
  const sample = nextRandom(state)
  return {
    state: sample.state,
    value: Math.min(maximumExclusive - 1, Math.floor(sample.value * maximumExclusive)),
  }
}

function randomSignedFloat(
  state: number,
  maximum: number,
): { state: number; value: number } {
  const magnitude = randomFloat(state, maximum)
  const sign = nextRandom(magnitude.state)
  return {
    state: sign.state,
    value: magnitude.value * (sign.value < 0.5 ? -1 : 1),
  }
}

function approach(current: number, target: number, step: number): number {
  if (current < target) return Math.min(target, current + step)
  return Math.max(target, current - step)
}

function signedAngleDelta(current: number, target: number): number {
  return ((target - current + 540) % 360) - 180
}

function turnToward(current: number, target: number, maximumStep: number): number {
  const delta = signedAngleDelta(current, target)
  if (Math.abs(delta) <= maximumStep) return (target + 360) % 360
  return (current + Math.sign(delta) * maximumStep + 360) % 360
}

function createStudentProps(
  state: number,
): { props: HubStudentProp[]; state: number } {
  const countSample = randomInteger(state, 3)
  const props: HubStudentProp[] = []
  state = countSample.state
  for (let index = 0; index < countSample.value + 2; index += 1) {
    const palette = randomInteger(state, 5)
    const radius = randomSignedFloat(palette.state, 2)
    const angle = randomFloat(radius.state, 45)
    state = angle.state
    props.push({
      angle: angle.value + 45,
      paletteIndex: palette.value,
      radius: radius.value,
    })
  }
  return { props, state }
}

function createHubStudent(
  id: number,
  pathId: number,
  sourceState: number,
  desiredSpeed: number,
): HubStudentState {
  let state = sourceState
  const strength = randomFloat(state, 5)
  const radius = randomFloat(strength.state, 5)
  const gait = randomFloat(radius.state, 360)
  const frame = randomFloat(gait.state, 4)
  const heading = randomFloat(frame.state, 360)
  const scale = randomFloat(heading.state, 0.35)
  const reading = randomInteger(scale.state, 3)
  const props = createStudentProps(reading.state)
  state = props.state
  const position = evaluateHubStudentSpline(pathId, 0)
  const next = evaluateHubStudentSpline(pathId, 0.01)
  const initialHeading = actorHeadingFromVector(next.x - position.x, next.y - position.y)
  const actorScale = 0.75 + scale.value
  return {
    currentSpeed: desiredSpeed,
    desiredSpeed,
    framePhase: frame.value,
    gaitDegrees: gait.value,
    heading: Number.isFinite(initialHeading) ? initialHeading : heading.value,
    headingIndex: actorHeadingIndex(initialHeading),
    id,
    pathCursor: 0,
    pathId,
    pathStep: 1,
    position,
    profile: {
      pushResistance: 1,
      pushStrength: 11 + strength.value,
      radius: 12 + radius.value,
    },
    props: props.props,
    reading: reading.value === 1,
    retired: false,
    rngState: state,
    scale: actorScale,
    staticCollisionEnabled: false,
    tick: 0,
    wander: { x: 0, y: 0 },
  }
}

function spawnStudent(
  population: HubStudentPopulationState,
  pathId: number,
  desiredSpeed: number,
): HubStudentPopulationState {
  const student = createHubStudent(
    population.nextId,
    pathId,
    population.rngState,
    desiredSpeed,
  )
  return {
    ...population,
    nextId: population.nextId + 1,
    rngState: student.rngState,
    students: [...population.students, student],
  }
}

export function createHubStudentPopulation(): HubStudentPopulationState {
  let population: HubStudentPopulationState = {
    nextId: 0,
    rarePathDenominator: NATIVE_RARE_PATH_DENOMINATOR,
    rngState: 0x51d07e57,
    spawnRequestPending: true,
    spawnTickerCounter: 0,
    students: [],
  }
  // The native transition advances the already-live Courtyard before its first
  // visible frame. Warm that same lifecycle; do not manufacture a fixed roster.
  for (let tick = 0; tick < NATIVE_PRESENTATION_WARMUP_TICKS; tick += 1) {
    const students = population.students
      .map((student) => {
        const plan = stepHubStudentTick(student, population.students)
        return commitHubStudentRoute(plan.state, {
          x: plan.state.position.x + plan.delta.x,
          y: plan.state.position.y + plan.delta.y,
        })
      })
      .filter((student) => !student.retired)
    population = stepHubStudentPopulation(population, students)
  }
  return population
}

export function createHubStudents(): HubStudentState[] {
  return createHubStudentPopulation().students
}

function studentSpeedFactor(
  student: HubStudentState,
  students: readonly HubStudentState[],
): number {
  for (const other of students) {
    if (
      other.id === student.id
      || other.desiredSpeed > student.currentSpeed
      || Math.abs(signedAngleDelta(student.heading, other.heading)) > 90
    ) continue
    const radians = student.heading * Math.PI / 180
    const lookAhead = {
      x: student.position.x + Math.sin(radians) * 15,
      y: student.position.y - Math.cos(radians) * 15,
    }
    const distanceSquared = (other.position.x - lookAhead.x) ** 2
      + (other.position.y - lookAhead.y) ** 2
    if (distanceSquared < student.profile.radius ** 2) return 0.9
  }
  return 1
}

function stepHubStudentTick(
  source: HubStudentState,
  students: readonly HubStudentState[],
): HubStudentRoutePlan {
  if (source.retired) return { delta: { x: 0, y: 0 }, state: source }
  const staticCollisionEnabled = source.tick % NATIVE_STATIC_COLLISION_REFRESH_TICKS === 0
    ? hubStudentStaticCollisionEnabled(source.position)
    : source.staticCollisionEnabled
  const spline = COMPILED_HUB_STUDENT_SPLINES[source.pathId]
  if (!spline || source.pathCursor < 0 || source.pathCursor >= spline.points.length - 1) {
    return {
      delta: { x: 0, y: 0 },
      state: { ...source, retired: true, staticCollisionEnabled },
    }
  }

  let state = source.rngState
  let wander = source.wander
  const wanderRoll = randomInteger(state, 50)
  state = wanderRoll.state
  if (wanderRoll.value === 3) {
    const magnitude = randomFloat(state, source.desiredSpeed > 1 ? 30 : 20)
    const angle = randomFloat(magnitude.state, 360)
    state = angle.state
    const radians = angle.value * Math.PI / 180
    wander = {
      x: Math.sin(radians) * magnitude.value,
      y: -Math.cos(radians) * magnitude.value,
    }
  }

  let pathCursor = source.pathCursor
  let target = evaluateHubStudentSpline(source.pathId, pathCursor)
  target = { x: target.x + wander.x, y: target.y + wander.y }
  let offset = {
    x: target.x - source.position.x,
    y: target.y - source.position.y,
  }
  let distance = Math.hypot(offset.x, offset.y)
  const pushResistance = distance / NATIVE_PATH_TARGET_DIVISOR
  if (distance <= source.profile.radius * 2) {
    pathCursor += source.pathStep * NATIVE_PATH_CURSOR_STEP
    if (pathCursor < 0 || pathCursor >= spline.points.length - 1) {
      return {
        delta: { x: 0, y: 0 },
        state: {
          ...source,
          pathCursor,
          profile: { ...source.profile, pushResistance },
          retired: true,
          rngState: state,
          staticCollisionEnabled,
          tick: source.tick + 1,
          wander,
        },
      }
    }
    target = evaluateHubStudentSpline(source.pathId, pathCursor)
    target = { x: target.x + wander.x, y: target.y + wander.y }
    offset = {
      x: target.x - source.position.x,
      y: target.y - source.position.y,
    }
    distance = Math.hypot(offset.x, offset.y)
  }

  const targetHeading = distance > Number.EPSILON
    ? actorHeadingFromVector(offset.x, offset.y)
    : source.heading
  const turnSteps = source.currentSpeed > 1
    ? NATIVE_FAST_TURN_STEPS
    : NATIVE_ORDINARY_TURN_STEPS
  const heading = turnToward(
    source.heading,
    targetHeading,
    turnSteps * NATIVE_TURN_STEP_DEGREES,
  )
  const capSample = randomFloat(state, 0.25)
  state = capSample.state
  const travel = Math.min(
    distance,
    (1 + capSample.value) * source.currentSpeed * studentSpeedFactor(source, students),
  )
  const radians = heading * Math.PI / 180
  return {
    delta: {
      x: Math.sin(radians) * travel,
      y: -Math.cos(radians) * travel,
    },
    state: {
      ...source,
      currentSpeed: approach(
        source.currentSpeed,
        source.desiredSpeed,
        NATIVE_SPEED_ACCELERATION,
      ),
      heading,
      headingIndex: actorHeadingIndex(heading),
      pathCursor,
      profile: { ...source.profile, pushResistance },
      rngState: state,
      staticCollisionEnabled,
      tick: source.tick + 1,
      wander,
    },
  }
}

export function planHubStudentRoute(
  sourceStudent: HubStudentState,
  students: readonly HubStudentState[],
  _elapsedSeconds: number,
): HubStudentRoutePlan {
  return stepHubStudentTick(sourceStudent, students)
}

export function commitHubStudentRoute(
  student: HubStudentState,
  position: Vector2,
): HubStudentState {
  const movement = {
    x: position.x - student.position.x,
    y: position.y - student.position.y,
  }
  const movedDistance = Math.hypot(movement.x, movement.y)
  const framePhase = (student.framePhase + movedDistance * 0.2) % 5
  return {
    ...student,
    framePhase,
    gaitDegrees: (student.gaitDegrees + movedDistance * 6) % 360,
    headingIndex: actorHeadingIndex(student.heading),
    position,
  }
}

export function stepHubStudentPopulation(
  source: HubStudentPopulationState,
  committedStudents: readonly HubStudentState[],
): HubStudentPopulationState {
  const nextTickerCounter = source.spawnTickerCounter + 1
  const tickerElapsed = nextTickerCounter >= NATIVE_SPAWN_REQUEST_TICKS
  let population: HubStudentPopulationState = {
    ...source,
    spawnRequestPending: source.spawnRequestPending || tickerElapsed,
    spawnTickerCounter: tickerElapsed ? 0 : nextTickerCounter,
    students: committedStudents.filter((student) => !student.retired),
  }
  if (population.spawnRequestPending) {
    population = { ...population, spawnRequestPending: false }
    const divisor = population.students.length < 9
      ? 2
      : population.students.length > 25
        ? 60
        : population.students.length > 17
          ? 30
          : population.students.length > 12
            ? 15
            : 7
    const spawnRoll = randomInteger(population.rngState, Math.max(2, Math.floor(divisor / 2)))
    population = { ...population, rngState: spawnRoll.state }
    if (spawnRoll.value === 1 || population.students.length < 5) {
      const countRoll = randomInteger(population.rngState, 8)
      const speedSample = randomSignedFloat(countRoll.state, 0.1)
      const pathRoll = randomInteger(speedSample.state, 19)
      population = { ...population, rngState: pathRoll.state }
      if (pathRoll.value > 0) {
        const rareRoll = randomInteger(
          population.rngState,
          population.rarePathDenominator,
        )
        const rarePath = rareRoll.value === 3
        population = {
          ...population,
          rarePathDenominator: rarePath
            ? population.rarePathDenominator + 10
            : population.rarePathDenominator,
          rngState: rareRoll.state,
        }
        const count = rarePath ? 1 : countRoll.value === 1 ? 2 : 1
        const desiredSpeed = rarePath ? 2 : (0.5 - speedSample.value) * 1.5
        for (let index = 0; index < count; index += 1) {
          population = spawnStudent(
            population,
            pathRoll.value - 1,
            desiredSpeed,
          )
        }
      }
    }
  }
  return population
}

export const HUB_STUDENT_FIXED_TICK_SECONDS = NATIVE_STUDENT_TICK_SECONDS
export const HUB_STUDENT_SPAWN_REQUEST_TICKS = NATIVE_SPAWN_REQUEST_TICKS
export const HUB_STUDENT_STATIC_COLLISION_REFRESH_TICKS = NATIVE_STATIC_COLLISION_REFRESH_TICKS
