import { resolveActorMotion } from '../core-kernels/actor-physics.ts'
import { DynamicActorGrid } from '../core-kernels/dynamic-actor-grid.ts'
import {
  createHubMemorialState,
  type HubMemorialState,
} from '../core-kernels/hub-memorial.ts'
import {
  HUB_FIXED_ACTOR_COLLISION_LAYOUT,
  HUB_STORY_OFFICE_POLISHER_ACTOR,
  hubFixedActor,
  planHubParticipantMovement,
  stepHubParticipantMovement,
  type HubCollegePathTarget,
  type HubRegionPhysicsBody,
} from '../core-kernels/hub-participant-movement.ts'
import {
  createHubCollegeIntroParticipantState,
  createHubParticipantState,
  isHubRegionTraversable,
  moveWithHubRegionCollisionState,
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

export { HUB_FIXED_ACTOR_COLLISION_LAYOUT }

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
  readonly bodies: HubRegionPhysicsBody[] = []
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

interface HubActorPairMember {
  readonly id: string
  readonly region: HubRegionId
}

export function hubParticipantOnboardingCollisionBypassActive(
  participant: Readonly<HubParticipantState>,
  collegeIntroPending: boolean,
): boolean {
  if (!collegeIntroPending) return false
  if (participant.collegeIntro !== null) return true
  if (participant.region === 'office') return true
  return participant.transition?.phase === 'college-loadout'
}

export function hubDynamicActorPairCollides(
  mover: Readonly<HubActorPairMember>,
  other: Readonly<HubActorPairMember>,
  onboardingPlayerIds: ReadonlySet<string>,
  collegeIntroPendingPlayerIds: ReadonlySet<string> | null,
): boolean {
  if (mover.region !== other.region) return false
  if (mover.id === 'story-office-polisher' || other.id === 'story-office-polisher') {
    const playerBody = mover.id.startsWith('player-') ? mover : other
    if (!playerBody.id.startsWith('player-')) return false
    return collegeIntroPendingPlayerIds?.has(playerBody.id.slice('player-'.length)) === true
  }
  const onboardingBody = mover.id.startsWith('player-')
      && onboardingPlayerIds.has(mover.id.slice('player-'.length))
    ? mover
    : other.id.startsWith('player-')
      && onboardingPlayerIds.has(other.id.slice('player-'.length))
      ? other
      : null
  if (onboardingBody !== null) {
    const counterpart = onboardingBody === mover ? other : mover
    if (counterpart.id.startsWith('player-') || counterpart.id.startsWith('student-')) {
      return false
    }
  }
  return true
}

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
        collegeIntro: participant.collegeIntro === null
          ? null
          : { ...participant.collegeIntro },
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
  if (participant.collegeIntro !== null) return world
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
  const collegePathTargets = new Map<string, HubCollegePathTarget>()
  const playerEntries = Object.entries(players)
  for (const [playerId, player] of playerEntries) {
    const participant = participants[playerId]
    const collegeIntroWaiting = participant.collegeIntro !== null
      && collegeIntroReadyPlayerIds !== null
      && !collegeIntroReadyPlayerIds.has(playerId)
    const movement = planHubParticipantMovement(player, participant, collegeIntroWaiting)
    if (movement.collegeTarget) collegePathTargets.set(playerId, movement.collegeTarget)
    playerPlans.set(
      playerId,
      movement.plan ?? planPlayerCharacterTick(
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
      participants[playerId].transition === null
        && participants[playerId].collegeIntro === null,
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
    bodies.push(HUB_STORY_OFFICE_POLISHER_ACTOR)
  }
  if (skorchaSchedule.skorcha !== null) {
    bodies.push(hubFixedActor(
      'skorcha',
      'courtyard',
      skorchaSchedule.skorcha.position.x,
      skorchaSchedule.skorcha.position.y,
      10,
    ))
  }
  for (const body of bodies) bodyRegions.set(body.id, body.region)
  const onboardingCollisionBypassPlayerIds = new Set(
    Object.entries(participants).flatMap(([playerId, participant]) => (
      hubParticipantOnboardingCollisionBypassActive(
        participant,
        collegeIntroPendingPlayerIds?.has(playerId) === true,
      ) ? [playerId] : []
    )),
  )

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
    (mover, other) => hubDynamicActorPairCollides(
      { id: mover.id, region: bodyRegions.get(mover.id)! },
      { id: other.id, region: bodyRegions.get(other.id)! },
      onboardingCollisionBypassPlayerIds,
      collegeIntroPendingPlayerIds,
    ),
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
    const stepped = stepHubParticipantMovement(
      participant,
      player,
      collegePathTargets.get(playerId) ?? null,
      {
        collegeIntroPending: collegeIntroPendingPlayerIds?.has(playerId) === true,
        collegeIntroWaiting: participant.collegeIntro !== null
          && collegeIntroReadyPlayerIds !== null
          && !collegeIntroReadyPlayerIds.has(playerId),
      },
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
