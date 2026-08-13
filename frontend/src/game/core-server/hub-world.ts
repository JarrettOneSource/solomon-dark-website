import { resolveActorMotion, type ActorPhysicsBody } from '../core-kernels/actor-physics.ts'
import { moveWithHubCollisionState } from '../core-kernels/hub-collision.ts'
import { HUB_SPAWN, isHubTraversable } from '../core-kernels/hub-math.ts'
import {
  PLAYER_CHARACTER_RADIUS,
  commitPlayerCharacterTick,
  planPlayerCharacterTick,
  type PlayerCharacterInput,
  type PlayerCharacterMovementPlan,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
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
} from './hub-students.ts'

export interface HubWorldState {
  ambient: HubAmbientState
  collisionRngState: number
  kind: 'hub'
  studentPopulation: HubStudentPopulationState
}

export interface HubWorldTickResult {
  players: Readonly<Record<string, PlayerCharacterState>>
  world: HubWorldState
}

export const HUB_PLAYER_CHARACTER_PHYSICS = {
  pushResistance: 10,
  pushStrength: 12,
  radius: PLAYER_CHARACTER_RADIUS,
} as const

const HUB_FIXED_ACTORS: readonly ActorPhysicsBody[] = [
  { id: 'perk-witch', position: { x: 1340, y: 280 }, delta: { x: 0, y: 0 }, radius: 15, pushResistance: 90, pushStrength: 0, pushEnabled: false, driven: false },
  { id: 'potion-trader', position: { x: 1397, y: 664 }, delta: { x: 0, y: 0 }, radius: 30, pushResistance: 90, pushStrength: 0, pushEnabled: false, driven: false },
  { id: 'annalist', position: { x: 895.5, y: 455.5 }, delta: { x: 0, y: 0 }, radius: 8, pushResistance: 90, pushStrength: 0, pushEnabled: false, driven: false },
  { id: 'items-trader', position: { x: 1700.5, y: 449.5 }, delta: { x: 0, y: 0 }, radius: 25, pushResistance: 90, pushStrength: 0, pushEnabled: false, driven: false },
  { id: 'teacher', position: { x: 576.5, y: 710.5 }, delta: { x: 0, y: 0 }, radius: 25, pushResistance: 90, pushStrength: 0, pushEnabled: false, driven: false },
]

export function createHubWorld(): HubWorldState {
  const studentPopulation = createHubStudentPopulation()
  return {
    ambient: createHubAmbientState(),
    collisionRngState: 0x51a7c011,
    kind: 'hub',
    studentPopulation,
  }
}

export function hubSpawnPoint(): Vector2 {
  return { ...HUB_SPAWN }
}

export function stepHubWorldTick(
  world: HubWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  inputs: Readonly<Record<string, PlayerCharacterInput>>,
): HubWorldTickResult {
  const playerPlans = new Map<string, PlayerCharacterMovementPlan>(
    Object.entries(players).map(([playerId, player]) => [
      playerId,
      planPlayerCharacterTick(
        player,
        inputs[playerId] ?? { movement: { x: 0, y: 0 } },
      ),
    ]),
  )
  const currentStudents = world.studentPopulation.students
  const studentPlans = currentStudents.map((student) => (
    planHubStudentRoute(
      student,
      currentStudents,
      HUB_STUDENT_FIXED_TICK_SECONDS,
    )
  ))
  const studentStaticCollision = new Map(
    studentPlans.map(({ state: student }) => [
      `student-${student.id}`,
      student.staticCollisionEnabled,
    ]),
  )
  let collisionRngState = world.collisionRngState
  const moveStatic = (
    position: Vector2,
    delta: Vector2,
    radius: number,
  ): Vector2 => {
    const moved = moveWithHubCollisionState(
      position,
      delta,
      radius,
      collisionRngState,
    )
    collisionRngState = moved.rngState
    return moved.position
  }
  const bodies: ActorPhysicsBody[] = [
    ...Object.entries(players).map(([playerId, player]) => ({
      delta: playerPlans.get(playerId)!.delta,
      id: `player-${playerId}`,
      position: player.position,
      ...HUB_PLAYER_CHARACTER_PHYSICS,
    })),
    ...studentPlans.map(({ delta, state: student }) => ({
      delta,
      id: `student-${student.id}`,
      position: student.position,
      ...student.profile,
    })),
    ...HUB_FIXED_ACTORS,
  ]
  const resolvedBodies = resolveActorMotion(
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

  const nextPlayers: Record<string, PlayerCharacterState> = {}
  for (const [playerId, player] of Object.entries(players)) {
    const position = positions.get(`player-${playerId}`)
    if (!position) throw new Error(`Hub world lost player character ${playerId}`)
    nextPlayers[playerId] = commitPlayerCharacterTick(
      player,
      playerPlans.get(playerId)!,
      position,
    )
  }

  const students = studentPlans.map(({ state: student }) => {
    const position = positions.get(`student-${student.id}`)
    if (!position) throw new Error(`Hub world lost Student ${student.id}`)
    return commitHubStudentRoute(student, position)
  })
  const studentPopulation = stepHubStudentPopulation(
    world.studentPopulation,
    students,
  )
  return {
    players: nextPlayers,
    world: {
      ambient: stepHubAmbient(world.ambient),
      collisionRngState,
      kind: 'hub',
      studentPopulation,
    },
  }
}

function moveActorAgainstHub(
  bodyId: string,
  position: Vector2,
  delta: Vector2,
  radius: number,
  studentStaticCollision: ReadonlyMap<string, boolean>,
  moveStatic: (position: Vector2, delta: Vector2, radius: number) => Vector2,
): Vector2 {
  if (studentStaticCollision.get(bodyId) === false) {
    return { x: position.x + delta.x, y: position.y + delta.y }
  }
  return moveStatic(position, delta, radius)
}

function canPlaceActor(
  bodyId: string,
  position: Vector2,
  radius: number,
  studentStaticCollision: ReadonlyMap<string, boolean>,
): boolean {
  if (studentStaticCollision.get(bodyId) === false) return true
  return isHubTraversable(position, radius)
}
