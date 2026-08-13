import { resolveActorMotion, type ActorPhysicsBody } from '../core-kernels/actor-physics.ts'
import {
  HUB_INCOMING_FADE_RATES,
  HUB_OUTGOING_FADE_RATE,
  beginHubTransition,
  createHubParticipantState,
  hubIncomingPlacement,
  hubPortalAt,
  isHubRegionTraversable,
  moveWithHubRegionCollisionState,
  planHubScriptedMovement,
  type HubParticipantState,
  type HubRegionId,
} from '../core-kernels/hub-regions.ts'
import { HUB_SPAWN } from '../core-kernels/hub-math.ts'
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
  participants: Readonly<Record<string, HubParticipantState>>
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

interface RegionPhysicsBody extends ActorPhysicsBody {
  region: HubRegionId
}

function fixedActor(
  id: string,
  region: HubRegionId,
  x: number,
  y: number,
  radius: number,
): RegionPhysicsBody {
  return {
    delta: { x: 0, y: 0 },
    driven: false,
    id,
    position: { x, y },
    pushEnabled: false,
    pushResistance: 90,
    pushStrength: 0,
    radius,
    region,
  }
}

const MORTUARY_PAINTINGS = [
  [512, 697],
  [350, 683],
  [673, 683],
  [744, 540],
  [590, 540],
  [434, 540],
  [279, 540],
  [354, 400],
  [512, 400],
  [670, 400],
] as const

export const HUB_FIXED_ACTOR_COLLISION_LAYOUT: readonly RegionPhysicsBody[] = [
  fixedActor('perk-witch', 'courtyard', 1340, 280, 15),
  fixedActor('potion-trader', 'courtyard', 1397, 664, 30),
  fixedActor('annalist', 'courtyard', 895.5, 455.5, 8),
  fixedActor('items-trader', 'courtyard', 1700.5, 449.5, 25),
  fixedActor('teacher', 'courtyard', 576.5, 710.5, 25),
  fixedActor('memorator', 'mortuary', 628, 770, 25),
  ...MORTUARY_PAINTINGS.map(([x, y], index) => (
    fixedActor(`painting-${index}`, 'mortuary', x, y - 2, 40)
  )),
  fixedActor('librarian', 'library', 512, 595, 55),
  fixedActor('dowser', 'library', 900, 642.5, 25),
  fixedActor('library-prop-0', 'library', 239.5, 788, 40),
  fixedActor('library-prop-1', 'library', 258.5, 678.5, 40),
  fixedActor('library-prop-2', 'library', 762, 732.5, 40),
  fixedActor('library-prop-3', 'library', 831, 620.5, 40),
  fixedActor('storeroom-prop-0', 'storeroom', 538, 324, 40),
  fixedActor('storeroom-prop-1', 'storeroom', 537.5, 434, 40),
  fixedActor('storeroom-prop-2', 'storeroom', 536, 542.5, 40),
  fixedActor('arch-chancellor', 'office', 514, 467, 55),
  fixedActor('office-prop-0', 'office', 517.5, 681, 40),
]

export function createHubWorld(
  playerIds: readonly string[] = [],
): HubWorldState {
  const studentPopulation = createHubStudentPopulation()
  return {
    ambient: createHubAmbientState(),
    collisionRngState: 0x51a7c011,
    kind: 'hub',
    participants: Object.fromEntries(
      playerIds.map((playerId) => [playerId, createHubParticipantState()]),
    ),
    studentPopulation,
  }
}

export function addHubParticipant(
  world: HubWorldState,
  playerId: string,
): HubWorldState {
  if (world.participants[playerId]) return world
  return {
    ...world,
    participants: {
      ...world.participants,
      [playerId]: createHubParticipantState(),
    },
  }
}

export function removeHubParticipant(
  world: HubWorldState,
  playerId: string,
): HubWorldState {
  if (!world.participants[playerId]) return world
  const participants = { ...world.participants }
  delete participants[playerId]
  return { ...world, participants }
}

export function hubSpawnPoint(): Vector2 {
  return { ...HUB_SPAWN }
}

export function stepHubWorldTick(
  world: HubWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  inputs: Readonly<Record<string, PlayerCharacterInput>>,
): HubWorldTickResult {
  const participants = reconcileParticipants(world.participants, players)
  const playerPlans = new Map<string, PlayerCharacterMovementPlan>()
  for (const [playerId, player] of Object.entries(players)) {
    const transition = participants[playerId].transition
    playerPlans.set(
      playerId,
      transition
        ? planHubScriptedMovement(
            player,
            transition.scriptedTarget,
            transition.scriptedSpeed,
          )
        : planPlayerCharacterTick(
            player,
            inputs[playerId] ?? { movement: { x: 0, y: 0 } },
          ),
    )
  }

  const currentStudents = world.studentPopulation.students
  const studentPlans = currentStudents.map((student) => (
    planHubStudentRoute(
      student,
      currentStudents,
      HUB_STUDENT_FIXED_TICK_SECONDS,
    )
  ))
  const staticCollisionEnabled = new Map<string, boolean>([
    ...Object.keys(players).map((playerId) => [
      `player-${playerId}`,
      participants[playerId].transition === null,
    ] as const),
    ...studentPlans.map(({ state: student }) => [
      `student-${student.id}`,
      student.staticCollisionEnabled,
    ] as const),
  ])

  const bodyRegions = new Map<string, HubRegionId>()
  const bodies: RegionPhysicsBody[] = [
    ...Object.entries(players).map(([playerId, player]) => ({
      delta: playerPlans.get(playerId)!.delta,
      id: `player-${playerId}`,
      position: player.position,
      region: participants[playerId].region,
      ...HUB_PLAYER_CHARACTER_PHYSICS,
    })),
    ...studentPlans.map(({ delta, state: student }) => ({
      delta,
      id: `student-${student.id}`,
      position: student.position,
      region: 'courtyard' as const,
      ...student.profile,
    })),
    ...HUB_FIXED_ACTOR_COLLISION_LAYOUT,
  ]
  for (const body of bodies) bodyRegions.set(body.id, body.region)

  let collisionRngState = world.collisionRngState
  const moveStatic = (
    region: HubRegionId,
    position: Vector2,
    delta: Vector2,
    radius: number,
  ): Vector2 => {
    const moved = moveWithHubRegionCollisionState(
      region,
      position,
      delta,
      radius,
      collisionRngState,
    )
    collisionRngState = moved.rngState
    return moved.position
  }

  const resolvedBodies = resolveActorMotion(
    bodies,
    {
      canPlace: (bodyId, position, radius) => {
        if (staticCollisionEnabled.get(bodyId) === false) return true
        const region = bodyRegions.get(bodyId)
        if (!region) throw new Error(`Hub world lost region for ${bodyId}`)
        return isHubRegionTraversable(region, position, radius)
      },
      move: (bodyId, position, delta, radius) => {
        if (staticCollisionEnabled.get(bodyId) === false) {
          return { x: position.x + delta.x, y: position.y + delta.y }
        }
        const region = bodyRegions.get(bodyId)
        if (!region) throw new Error(`Hub world lost region for ${bodyId}`)
        return moveStatic(region, position, delta, radius)
      },
    },
    (mover, other) => bodyRegions.get(mover.id) === bodyRegions.get(other.id),
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

  const nextParticipants: Record<string, HubParticipantState> = {}
  for (const [playerId, participant] of Object.entries(participants)) {
    const player = nextPlayers[playerId]
    if (!player) continue
    const stepped = stepParticipantTransition(participant, player)
    nextParticipants[playerId] = stepped.participant
    nextPlayers[playerId] = stepped.player
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
      participants: nextParticipants,
      studentPopulation,
    },
  }
}

function stepParticipantTransition(
  participant: HubParticipantState,
  player: PlayerCharacterState,
): { participant: HubParticipantState; player: PlayerCharacterState } {
  if (!participant.transition) {
    const portal = hubPortalAt(participant.region, player.position)
    return {
      participant: portal
        ? beginHubTransition(participant, portal, player.position)
        : participant,
      player,
    }
  }

  const transition = participant.transition
  if (transition.phase === 'outgoing') {
    if (transition.alpha < 1) {
      const alpha = Math.min(1, transition.alpha + HUB_OUTGOING_FADE_RATE)
      return {
        participant: {
          ...participant,
          transition: { ...transition, alpha },
        },
        player,
      }
    }
    const incoming = hubIncomingPlacement(
      transition.sourceRegion,
      transition.destination,
    )
    return {
      participant: {
        region: transition.destination,
        transition: {
          alpha: 1,
          destination: transition.destination,
          phase: 'incoming',
          scriptedSpeed: incoming.scriptedSpeed,
          scriptedTarget: incoming.scriptedTarget,
          sourceRegion: transition.sourceRegion,
        },
      },
      player: {
        ...player,
        position: incoming.position,
        velocity: { x: 0, y: 0 },
      },
    }
  }

  const fadeRate = HUB_INCOMING_FADE_RATES[participant.region]
  const targetReached = distanceSquared(player.position, transition.scriptedTarget) < 0.01
  if (transition.alpha === 0 && targetReached) {
    return {
      participant: { ...participant, transition: null },
      player,
    }
  }
  const alpha = Math.max(0, transition.alpha - fadeRate)
  return {
    participant: {
      ...participant,
      transition: { ...transition, alpha },
    },
    player,
  }
}

function reconcileParticipants(
  source: Readonly<Record<string, HubParticipantState>>,
  players: Readonly<Record<string, PlayerCharacterState>>,
): Record<string, HubParticipantState> {
  return Object.fromEntries(
    Object.keys(players).map((playerId) => [
      playerId,
      source[playerId] ?? createHubParticipantState(),
    ]),
  )
}

function distanceSquared(first: Vector2, second: Vector2): number {
  const dx = first.x - second.x
  const dy = first.y - second.y
  return dx * dx + dy * dy
}
