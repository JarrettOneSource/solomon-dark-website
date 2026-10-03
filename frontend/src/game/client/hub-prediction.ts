import { resolveActorMotion, type ActorPhysicsWorld } from '../core-kernels/actor-physics.ts'
import {
  HUB_FIXED_ACTOR_COLLISION_LAYOUT,
  HUB_STORY_OFFICE_POLISHER_ACTOR,
  hubFixedActor,
  planHubParticipantMovement,
  stepHubParticipantMovement,
  type HubRegionPhysicsBody,
} from '../core-kernels/hub-participant-movement.ts'
import {
  createHubParticipantState,
  isHubRegionTraversable,
  moveWithHubRegionCollisionState,
  type HubParticipantState,
} from '../core-kernels/hub-regions.ts'
import {
  PLAYER_CHARACTER_PHYSICS,
  commitPlayerCharacterTick,
  planPlayerCharacterTick,
  type PlayerCharacterInput,
  type PlayerCharacterMovementPlan,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { Vector2 } from '../core-kernels/vector.ts'

export interface HubCharacterPrediction {
  collisionRngState: number
  participant: HubParticipantState
  player: PlayerCharacterState
}

export interface HubCharacterPredictionOptions {
  /** Mirrors the host's pending College admission for the local player. */
  readonly collegeIntroPending?: boolean
  /** The server still holds the College walker until its renderer reported ready. */
  readonly collegeIntroWaiting?: boolean
  /** The immovable Skorcha body currently present in the latest Hub snapshot. */
  readonly skorchaPosition?: Readonly<Vector2> | null
}

const LOCAL_PLAYER_BODY_ID = 'player-local'

/**
 * Scripted Hub movement ignores the region walls on the server, so the only
 * things that can stop a College walker or a portal transition are the fixed
 * actors of its region (the Archchancellor's desk, the Office polisher).
 */
const SCRIPTED_PHYSICS_WORLD: ActorPhysicsWorld = {
  canPlace: () => true,
  move: (_bodyId, position, delta) => ({
    x: position.x + delta.x,
    y: position.y + delta.y,
  }),
}

function resolveFixedActorMovement(
  previous: PlayerCharacterState,
  plan: PlayerCharacterMovementPlan,
  participant: Readonly<HubParticipantState>,
  collegeIntroPending: boolean,
  world: ActorPhysicsWorld,
  skorchaPosition: Readonly<Vector2> | null,
): Vector2 {
  const bodies: HubRegionPhysicsBody[] = [{
    delta: plan.delta,
    id: LOCAL_PLAYER_BODY_ID,
    position: previous.position,
    region: participant.region,
    ...PLAYER_CHARACTER_PHYSICS,
  }]
  for (const actor of HUB_FIXED_ACTOR_COLLISION_LAYOUT) {
    if (actor.region === participant.region) bodies.push(actor)
  }
  if (collegeIntroPending && participant.region === 'office') {
    bodies.push(HUB_STORY_OFFICE_POLISHER_ACTOR)
  }
  if (skorchaPosition && participant.region === 'courtyard') {
    bodies.push(hubFixedActor('skorcha', 'courtyard', skorchaPosition.x, skorchaPosition.y, 10))
  }
  const resolved = resolveActorMotion(bodies, world, () => true)
  const player = resolved.find((body) => body.id === LOCAL_PLAYER_BODY_ID)
  if (!player) throw new Error('Hub prediction lost the local player body')
  return player.position
}

export function predictPlayerCharacterInHub(
  previous: PlayerCharacterState,
  input: PlayerCharacterInput,
  collisionRngState: number,
  movementScale: number,
  participant: Readonly<HubParticipantState> = createHubParticipantState(),
  options: HubCharacterPredictionOptions = {},
): HubCharacterPrediction {
  const collegeIntroPending = options.collegeIntroPending ?? false
  const collegeIntroWaiting = options.collegeIntroWaiting ?? false
  const movement = planHubParticipantMovement(previous, participant, collegeIntroWaiting)
  let nextCollisionRngState = collisionRngState
  const plan = movement.plan ?? planPlayerCharacterTick(previous, input, movementScale)
  const world: ActorPhysicsWorld = movement.plan ? SCRIPTED_PHYSICS_WORLD : {
    canPlace: (_id, position, radius) => isHubRegionTraversable(participant.region, position, radius),
    move: (_id, position, delta, radius) => {
      const moved = moveWithHubRegionCollisionState(
        participant.region,
        position,
        delta,
        radius,
        nextCollisionRngState,
      )
      nextCollisionRngState = moved.rngState
      return moved.position
    },
  }
  const committed = commitPlayerCharacterTick(previous, plan, resolveFixedActorMovement(
    previous,
    plan,
    participant,
    collegeIntroPending,
    world,
    options.skorchaPosition ?? null,
  ))
  const stepped = stepHubParticipantMovement(
    participant,
    committed,
    movement.collegeTarget,
    { collegeIntroPending, collegeIntroWaiting },
  )
  return {
    collisionRngState: nextCollisionRngState,
    participant: stepped.participant,
    player: stepped.player,
  }
}
