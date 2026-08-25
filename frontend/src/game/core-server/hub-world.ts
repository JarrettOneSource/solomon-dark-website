import { resolveActorMotion, type ActorPhysicsBody } from '../core-kernels/actor-physics.ts'
import { DynamicActorGrid } from '../core-kernels/dynamic-actor-grid.ts'
import {
  HUB_PRIVATE_ROOM_IDS,
  HUB_PRIVATE_ROOM_LAYOUTS,
  type HubPrivateRoomLayoutDefinition,
} from '../core-kernels/hub-private-room-layout.ts'
import {
  createHubMemorialState,
  type HubMemorialState,
} from '../core-kernels/hub-memorial.ts'
import {
  HUB_COLLEGE_INTRO_FADE_RATE,
  HUB_INCOMING_FADE_RATES,
  HUB_OUTGOING_FADE_RATE,
  beginHubTransition,
  createHubCollegeIntroParticipantState,
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
  PLAYER_CHARACTER_PHYSICS,
  commitPlayerCharacterTick,
  planPlayerCharacterTick,
  type PlayerCharacterInput,
  type PlayerCharacterMovementPlan,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { NativeRngState } from '../core-kernels/native-rng.ts'
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
  type HubStudentRoutePlan,
  type HubStudentState,
} from './hub-students.ts'
import { HubStudentNeighborGrid } from './hub-student-grid.ts'
import {
  createHubSkorchaPopulation,
  scheduleHubSkorchaPopulation,
  stepHubSkorchaSchedule,
  type HubSkorchaState,
} from './hub-skorcha.ts'

export interface HubWorldState {
  ambient: HubAmbientState
  collisionRngState: number
  kind: 'hub'
  memorial: HubMemorialState
  participants: Readonly<Record<string, HubParticipantState>>
  runtime: HubWorldRuntime
  skorchaHiddenTicks: number | null
  skorcha: HubSkorchaState | null
  skorchaPopulationRng: NativeRngState
  skorchaTransitionTicksRemaining: number
  skorchaVisibleTicks: number | null
  studentPopulation: HubStudentPopulationState
  traderAnimationSeed: number
}

export class HubWorldRuntime {
  readonly actorGrid = new DynamicActorGrid(128)
  readonly bodies: RegionPhysicsBody[] = []
  readonly bodyRegions = new Map<string, HubRegionId>()
  readonly playerPlans = new Map<string, PlayerCharacterMovementPlan>()
  readonly positions = new Map<string, Vector2>()
  readonly staticCollisionEnabled = new Map<string, boolean>()
  readonly studentPlans: HubStudentRoutePlan[] = []
  readonly studentStates: HubStudentState[] = []
  readonly studentNeighbors = new HubStudentNeighborGrid()
}

export interface HubWorldTickResult {
  players: Readonly<Record<string, PlayerCharacterState>>
  world: HubWorldState
}

export interface HubWorldOptions {
  memorial?: HubMemorialState
  skorcha?: HubSkorchaState | null
  skorchaHiddenTicks?: number
  skorchaVisibleTicks?: number
  studentPopulation?: HubStudentPopulationState
  traderAnimationSeed?: number
}

export const DEFAULT_HUB_TRADER_ANIMATION_SEED = 0x5eedc0de

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

function privateRoomFixedActors(): readonly RegionPhysicsBody[] {
  const bodies: RegionPhysicsBody[] = []
  for (const region of HUB_PRIVATE_ROOM_IDS) {
    const layout: HubPrivateRoomLayoutDefinition = HUB_PRIVATE_ROOM_LAYOUTS[region]
    for (const [id, actor] of Object.entries(layout.actors)) {
      const { position, radius } = actor.collider
      bodies.push(fixedActor(id, region, position.x, position.y, radius))
    }
    for (const prop of layout.props) {
      const { position, radius } = prop.collider
      bodies.push(fixedActor(prop.id, region, position.x, position.y, radius))
    }
  }
  return bodies
}

export const HUB_FIXED_ACTOR_COLLISION_LAYOUT: readonly RegionPhysicsBody[] = [
  fixedActor('perk-witch', 'courtyard', 1340, 280, 15),
  fixedActor('potion-trader', 'courtyard', 1397, 664, 30),
  fixedActor('annalist', 'courtyard', 895.5, 455.5, 8),
  fixedActor('items-trader', 'courtyard', 1700.5, 449.5, 25),
  fixedActor('teacher', 'courtyard', 576.5, 710.5, 25),
  ...privateRoomFixedActors(),
]

export function createHubWorld(
  playerIds: readonly string[] = [],
  options: HubWorldOptions = {},
): HubWorldState {
  const studentPopulation = options.studentPopulation ?? createHubStudentPopulation()
  const traderAnimationSeed = options.traderAnimationSeed ?? DEFAULT_HUB_TRADER_ANIMATION_SEED
  const initialPopulation = createHubSkorchaPopulation(traderAnimationSeed)
  const skorchaSchedule = scheduleHubSkorchaPopulation({
    rng: initialPopulation.rng,
    skorcha: options.skorcha === undefined ? initialPopulation.skorcha : options.skorcha,
  }, {
    hiddenTicks: options.skorchaHiddenTicks,
    visibleTicks: options.skorchaVisibleTicks,
  })
  return {
    ambient: createHubAmbientState(),
    collisionRngState: 0x51a7c011,
    kind: 'hub',
    memorial: options.memorial ?? createHubMemorialState(),
    participants: Object.fromEntries(
      playerIds.map((playerId) => [playerId, createHubParticipantState()]),
    ),
    runtime: new HubWorldRuntime(),
    skorchaHiddenTicks: options.skorchaHiddenTicks ?? null,
    skorcha: skorchaSchedule.skorcha,
    skorchaPopulationRng: skorchaSchedule.rng,
    skorchaTransitionTicksRemaining: skorchaSchedule.transitionTicksRemaining,
    skorchaVisibleTicks: options.skorchaVisibleTicks ?? null,
    studentPopulation,
    traderAnimationSeed,
  }
}

export function addHubParticipant(
  world: HubWorldState,
  playerId: string,
  participant: HubParticipantState = createHubParticipantState(),
): HubWorldState {
  if (world.participants[playerId]) return world
  return {
    ...world,
    participants: {
      ...world.participants,
      [playerId]: {
        region: participant.region,
        transition: participant.transition === null
          ? null
          : {
              ...participant.transition,
              scriptedTarget: { ...participant.transition.scriptedTarget },
            },
      },
    },
  }
}

export function beginHubCollegeIntro(
  world: HubWorldState,
  playerId: string,
): HubWorldState {
  const participant = world.participants[playerId]
  if (!participant) return world
  if (participant.transition?.phase === 'college-intro') return world
  const next = {
    ...world,
    participants: {
      ...world.participants,
      [playerId]: createHubCollegeIntroParticipantState(),
    },
  }
  return next
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

export function confirmHubCollegeIntroLoadout(
  world: HubWorldState,
  playerId: string,
): HubWorldState {
  const participant = world.participants[playerId]
  if (participant?.transition?.phase !== 'college-loadout') return world
  return {
    ...world,
    participants: {
      ...world.participants,
      [playerId]: {
        ...participant,
        transition: { ...participant.transition, phase: 'incoming' },
      },
    },
  }
}

export function hubSpawnPoint(): Vector2 {
  return { ...HUB_SPAWN }
}

export function stepHubWorldTick(
  world: HubWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  inputs: Readonly<Record<string, PlayerCharacterInput>>,
  movementScales: Readonly<Record<string, number>>,
  collegeIntroReadyPlayerIds: ReadonlySet<string> | null = null,
  collegeIntroPendingPlayerIds: ReadonlySet<string> | null = null,
): HubWorldTickResult {
  const participants = reconcileParticipants(world.participants, players)
  const skorchaSchedule = stepHubSkorchaSchedule({
    rng: world.skorchaPopulationRng,
    skorcha: world.skorcha,
    transitionTicksRemaining: world.skorchaTransitionTicksRemaining,
  }, {
    hiddenTicks: world.skorchaHiddenTicks ?? undefined,
    visibleTicks: world.skorchaVisibleTicks ?? undefined,
  })
  const runtime = world.runtime
  const playerPlans = runtime.playerPlans
  playerPlans.clear()
  const playerEntries = Object.entries(players)
  for (const [playerId, player] of playerEntries) {
    const transition = participants[playerId].transition
    const collegeIntroWaiting = transition?.phase === 'college-intro'
      && collegeIntroReadyPlayerIds !== null
      && !collegeIntroReadyPlayerIds.has(playerId)
    const collegeLoadoutWaiting = transition?.phase === 'college-loadout'
    playerPlans.set(
      playerId,
      collegeIntroWaiting || collegeLoadoutWaiting
        ? planHubScriptedMovement(player, player.position, 1)
        : transition
        ? planHubScriptedMovement(
            player,
            transition.scriptedTarget,
            transition.scriptedSpeed,
          )
        : planPlayerCharacterTick(
            player,
            inputs[playerId] ?? { movement: { x: 0, y: 0 } },
            movementScales[playerId] ?? 1,
          ),
    )
  }

  const currentStudents = world.studentPopulation.store.states(runtime.studentStates)
  runtime.studentNeighbors.rebuild(currentStudents)
  const studentPlans = runtime.studentPlans
  studentPlans.length = currentStudents.length
  for (let index = 0; index < currentStudents.length; index += 1) {
    studentPlans[index] = planHubStudentRoute(
      currentStudents[index],
      currentStudents,
      HUB_STUDENT_FIXED_TICK_SECONDS,
      runtime.studentNeighbors,
      world.studentPopulation.routeEndBehavior,
    )
  }
  const staticCollisionEnabled = runtime.staticCollisionEnabled
  staticCollisionEnabled.clear()
  for (const [playerId] of playerEntries) {
    staticCollisionEnabled.set(
      `player-${playerId}`,
      participants[playerId].transition === null,
    )
  }
  for (const { state: student } of studentPlans) {
    staticCollisionEnabled.set(
      `student-${student.id}`,
      student.staticCollisionEnabled,
    )
  }

  const bodyRegions = runtime.bodyRegions
  bodyRegions.clear()
  const bodies = runtime.bodies
  bodies.length = 0
  for (const [playerId, player] of playerEntries) {
    bodies.push({
      delta: playerPlans.get(playerId)!.delta,
      id: `player-${playerId}`,
      position: player.position,
      region: participants[playerId].region,
      ...PLAYER_CHARACTER_PHYSICS,
    })
  }
  for (const { delta, state: student } of studentPlans) {
    bodies.push({
      delta,
      id: `student-${student.id}`,
      position: student.position,
      region: 'courtyard',
      ...student.profile,
    })
  }
  bodies.push(...HUB_FIXED_ACTOR_COLLISION_LAYOUT)
  if (collegeIntroPendingPlayerIds && [...collegeIntroPendingPlayerIds].some((playerId) => (
    participants[playerId]?.region === 'office'
  ))) {
    bodies.push(fixedActor('story-office-polisher', 'office', 566, 735, 15))
  }
  if (skorchaSchedule.skorcha !== null) {
    bodies.push(fixedActor(
      'skorcha',
      'courtyard',
      skorchaSchedule.skorcha.position.x,
      skorchaSchedule.skorcha.position.y,
      10,
    ))
  }
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
    (mover, other) => {
      if (mover.id === 'story-office-polisher' || other.id === 'story-office-polisher') {
        const playerBody = mover.id.startsWith('player-') ? mover : other
        if (!playerBody.id.startsWith('player-')) return false
        return collegeIntroPendingPlayerIds?.has(playerBody.id.slice('player-'.length))
          === true
      }
      return bodyRegions.get(mover.id) === bodyRegions.get(other.id)
    },
    runtime.actorGrid,
  )
  const positions = runtime.positions
  positions.clear()
  for (const body of resolvedBodies) positions.set(body.id, body.position)

  const nextPlayers: Record<string, PlayerCharacterState> = {}
  for (const [playerId, player] of playerEntries) {
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
    const collegeIntroWaiting = participant.transition?.phase === 'college-intro'
      && collegeIntroReadyPlayerIds !== null
      && !collegeIntroReadyPlayerIds.has(playerId)
    const stepped = collegeIntroWaiting
      ? { participant, player }
      : stepParticipantTransition(
          participant,
          player,
          collegeIntroPendingPlayerIds?.has(playerId) === true,
        )
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
      memorial: world.memorial,
      participants: nextParticipants,
      runtime,
      skorcha: skorchaSchedule.skorcha,
      skorchaHiddenTicks: world.skorchaHiddenTicks,
      skorchaPopulationRng: skorchaSchedule.rng,
      skorchaTransitionTicksRemaining: skorchaSchedule.transitionTicksRemaining,
      skorchaVisibleTicks: world.skorchaVisibleTicks,
      studentPopulation,
      traderAnimationSeed: world.traderAnimationSeed,
    },
  }
}

function stepParticipantTransition(
  participant: HubParticipantState,
  player: PlayerCharacterState,
  collegeIntroPending: boolean,
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
  if (transition.phase === 'college-intro') {
    const alpha = transition.alpha <= HUB_COLLEGE_INTRO_FADE_RATE
      ? 0
      : transition.alpha - HUB_COLLEGE_INTRO_FADE_RATE
    if (alpha > 0) {
      return {
        participant: {
          ...participant,
          transition: { ...transition, alpha },
        },
        player,
      }
    }
    return {
      participant: { ...participant, transition: null },
      player,
    }
  }
  if (transition.phase === 'college-loadout') return { participant, player }
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
          phase: collegeIntroPending
            && transition.sourceRegion === 'office'
            && transition.destination === 'courtyard'
            ? 'college-loadout'
            : 'incoming',
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
