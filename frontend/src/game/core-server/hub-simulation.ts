import {
  HUB_PLAYER_RADIUS,
  HUB_SPAWN,
  hubHeadingIndex,
  hubMovementTick,
  isHubTraversable,
  type HubPoint,
} from '../core-kernels/hub-math.ts'
import { resolveHubActorMotion, type HubPhysicsBody } from '../core-kernels/hub-physics.ts'
import { moveWithHubCollisionState } from '../core-kernels/hub-collision.ts'
import {
  reconcileHubPlayer,
  type HubPlayerState,
} from '../core-kernels/hub-player.ts'
import {
  createHubAmbientState,
  stepHubAmbient,
  type HubAmbientState,
} from './hub-ambient.ts'
import {
  commitHubStudentRoute,
  createHubStudentPopulation,
  HUB_STUDENT_FIXED_TICK_SECONDS,
  planHubStudentRoute,
  stepHubStudentPopulation,
  type HubStudentPopulationState,
  type HubStudentState,
} from './hub-students.ts'

export type HubPlayerId = string

export interface HubSimulationState {
  ambient: HubAmbientState
  collisionRngState: number
  players: Readonly<Record<HubPlayerId, HubPlayerState>>
  studentPopulation: HubStudentPopulationState
  students: HubStudentState[]
  tick: number
}

export type HubPlayerInputs = Readonly<Record<HubPlayerId, HubPoint>>

export const HUB_DEFAULT_PLAYER_ID = 'local-player'
export const HUB_FIXED_TICK_SECONDS = HUB_STUDENT_FIXED_TICK_SECONDS
export const HUB_TICK_RATE = 1 / HUB_FIXED_TICK_SECONDS

export const HUB_PLAYER_PHYSICS = {
  pushResistance: 10,
  pushStrength: 12,
  radius: HUB_PLAYER_RADIUS,
} as const

const HUB_FIXED_ACTORS: readonly HubPhysicsBody[] = [
  { id: 'perk-witch', position: { x: 1340, y: 280 }, delta: { x: 0, y: 0 }, radius: 15, pushResistance: 90, pushStrength: 0, pushEnabled: false, driven: false },
  { id: 'potion-trader', position: { x: 1397, y: 664 }, delta: { x: 0, y: 0 }, radius: 30, pushResistance: 90, pushStrength: 0, pushEnabled: false, driven: false },
  { id: 'annalist', position: { x: 895.5, y: 455.5 }, delta: { x: 0, y: 0 }, radius: 8, pushResistance: 90, pushStrength: 0, pushEnabled: false, driven: false },
  { id: 'items-trader', position: { x: 1700.5, y: 449.5 }, delta: { x: 0, y: 0 }, radius: 25, pushResistance: 90, pushStrength: 0, pushEnabled: false, driven: false },
  { id: 'teacher', position: { x: 576.5, y: 710.5 }, delta: { x: 0, y: 0 }, radius: 25, pushResistance: 90, pushStrength: 0, pushEnabled: false, driven: false },
]

function createHubPlayer(position: HubPoint): HubPlayerState {
  return {
    gaitDegrees: 0,
    headingIndex: hubHeadingIndex(180),
    position: { ...position },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  }
}

export function createHubSimulation(
  playerIds: readonly HubPlayerId[] = [HUB_DEFAULT_PLAYER_ID],
): HubSimulationState {
  const studentPopulation = createHubStudentPopulation()
  const players: Record<HubPlayerId, HubPlayerState> = {}
  playerIds.forEach((playerId) => {
    players[playerId] = createHubPlayer(HUB_SPAWN)
  })
  return {
    ambient: createHubAmbientState(),
    collisionRngState: 0x51a7c011,
    players,
    studentPopulation,
    students: studentPopulation.students,
    tick: 0,
  }
}

export function addHubPlayer(
  state: HubSimulationState,
  playerId: HubPlayerId,
): HubSimulationState {
  if (state.players[playerId]) return state
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: createHubPlayer(HUB_SPAWN),
    },
  }
}

export function removeHubPlayer(
  state: HubSimulationState,
  playerId: HubPlayerId,
): HubSimulationState {
  if (!state.players[playerId]) return state
  const players = { ...state.players }
  delete players[playerId]
  return { ...state, players }
}

export function getHubPlayer(
  state: HubSimulationState,
  playerId = HUB_DEFAULT_PLAYER_ID,
): HubPlayerState {
  const player = state.players[playerId]
  if (!player) throw new Error(`hub simulation has no player ${playerId}`)
  return player
}

function moveActorAgainstHub(
  bodyId: string,
  position: HubPoint,
  delta: HubPoint,
  radius: number,
  studentStaticCollision: ReadonlyMap<string, boolean>,
  moveStatic: (position: HubPoint, delta: HubPoint, radius: number) => HubPoint,
): HubPoint {
  if (studentStaticCollision.get(bodyId) === false) {
    return { x: position.x + delta.x, y: position.y + delta.y }
  }
  return moveStatic(position, delta, radius)
}

function canPlaceActor(
  bodyId: string,
  position: HubPoint,
  radius: number,
  studentStaticCollision: ReadonlyMap<string, boolean>,
): boolean {
  if (studentStaticCollision.get(bodyId) === false) return true
  return isHubTraversable(position, radius)
}

export { reconcileHubPlayer }
export type { HubPlayerState }

export function stepHubSimulationTick(
  state: HubSimulationState,
  inputs: HubPlayerInputs,
): HubSimulationState {
  const playerMovements = new Map(
    Object.entries(state.players).map(([playerId, player]) => [
      playerId,
      hubMovementTick(player.velocity, inputs[playerId] ?? { x: 0, y: 0 }),
    ]),
  )
  const studentPlans = state.students.map((student) => (
    planHubStudentRoute(student, state.students, HUB_FIXED_TICK_SECONDS)
  ))
  const studentStaticCollision = new Map(
    studentPlans.map(({ state: student }) => [
      `student-${student.id}`,
      student.staticCollisionEnabled,
    ]),
  )
  let collisionRngState = state.collisionRngState
  const moveStatic = (position: HubPoint, delta: HubPoint, radius: number): HubPoint => {
    const moved = moveWithHubCollisionState(
      position,
      delta,
      radius,
      collisionRngState,
    )
    collisionRngState = moved.rngState
    return moved.position
  }
  const bodies: HubPhysicsBody[] = [
    ...Object.entries(state.players).map(([playerId, player]) => ({
      delta: playerMovements.get(playerId)!.delta,
      id: `player-${playerId}`,
      position: player.position,
      ...HUB_PLAYER_PHYSICS,
    })),
    ...studentPlans.map(({ delta, state: student }) => ({
      delta,
      id: `student-${student.id}`,
      position: student.position,
      ...student.profile,
    })),
    ...HUB_FIXED_ACTORS,
  ]
  const resolvedBodies = resolveHubActorMotion(
    bodies,
    {
      canPlace: (bodyId, position, radius) => (
        canPlaceActor(bodyId, position, radius, studentStaticCollision)
      ),
      move: (bodyId, position, delta, radius) => (
        moveActorAgainstHub(
          bodyId,
          position,
          delta,
          radius,
          studentStaticCollision,
          moveStatic,
        )
      ),
    },
    // The native dynamic grid includes every collision-enabled actor. Student
    // proximity slowdown is an additional steering input, not a replacement
    // for actor-to-actor circle response.
    () => true,
  )
  const positions = new Map(resolvedBodies.map((body) => [body.id, body.position]))

  const players: Record<HubPlayerId, HubPlayerState> = {}
  for (const [playerId, player] of Object.entries(state.players)) {
    const position = positions.get(`player-${playerId}`)
    if (!position) throw new Error(`hub simulation lost player ${playerId}`)
    const movement = playerMovements.get(playerId)!
    players[playerId] = reconcileHubPlayer(
      player,
      position,
      movement.requestedVelocity,
      movement.delta,
      movement.retainedVelocity,
    )
  }

  const students = studentPlans.map(({ state: student }) => {
    const position = positions.get(`student-${student.id}`)
    if (!position) throw new Error(`hub simulation lost Student ${student.id}`)
    return commitHubStudentRoute(student, position)
  })
  const studentPopulation = stepHubStudentPopulation(
    state.studentPopulation,
    students,
  )
  return {
    ambient: stepHubAmbient(state.ambient),
    collisionRngState,
    players,
    studentPopulation,
    students: studentPopulation.students,
    tick: state.tick + 1,
  }
}

export function stepHubSimulation(
  source: HubSimulationState,
  inputs: HubPlayerInputs,
  elapsedSeconds: number,
): HubSimulationState {
  let state = {
    ...source,
    studentPopulation: {
      ...source.studentPopulation,
      accumulatorSeconds: source.studentPopulation.accumulatorSeconds + elapsedSeconds,
    },
  }
  while (state.studentPopulation.accumulatorSeconds >= HUB_FIXED_TICK_SECONDS) {
    state = stepHubSimulationTick({
      ...state,
      studentPopulation: {
        ...state.studentPopulation,
        accumulatorSeconds:
          state.studentPopulation.accumulatorSeconds - HUB_FIXED_TICK_SECONDS,
      },
    }, inputs)
  }
  return state
}

export function stepSinglePlayerHubSimulation(
  source: HubSimulationState,
  input: HubPoint,
  elapsedSeconds: number,
  playerId = HUB_DEFAULT_PLAYER_ID,
): HubSimulationState {
  return stepHubSimulation(source, { [playerId]: input }, elapsedSeconds)
}
