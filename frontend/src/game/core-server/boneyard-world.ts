import { actorHeadingIndex } from '../core-kernels/actor-heading.ts'
import { resolveActorMotion } from '../core-kernels/actor-physics.ts'
import type { BoneyardBounds, LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  applyBoneyardGateContact,
  createBoneyardGateLeaves,
  stepBoneyardGateLeaf,
  type BoneyardGateLeafState,
} from '../core-kernels/boneyard-gate.ts'
import {
  PLAYER_CHARACTER_PHYSICS,
  PLAYER_CHARACTER_RADIUS,
  commitPlayerCharacterTick,
  createPlayerCharacter,
  planPlayerCharacterTick,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import {
  canPlaceBoneyardBody,
  createBoneyardCollisionWorld,
  resolveBoneyardMovement,
  touchingBoneyardGateLeaves,
  withBoneyardGateCollision,
  type BoneyardCollisionWorld,
} from './boneyard-collision.ts'

export interface BoneyardWorldState {
  bounds: BoneyardBounds
  collision: BoneyardCollisionWorld
  gateLeaves: readonly BoneyardGateLeafState[]
  kind: 'boneyard'
  runId: string
  spawn: { x: number; y: number; facingDeg: number }
}

export interface BoneyardWorldTickResult {
  players: Readonly<Record<string, PlayerCharacterState>>
  world: BoneyardWorldState
}

export function createBoneyardWorld(loaded: LoadedBoneyard): BoneyardWorldState {
  return {
    bounds: { ...loaded.scene.bounds },
    collision: createBoneyardCollisionWorld(loaded.scene),
    gateLeaves: createBoneyardGateLeaves(loaded.scene.fences, loaded.seed),
    kind: 'boneyard',
    runId: loaded.runId,
    spawn: { ...loaded.scene.spawn },
  }
}

export function spawnPlayerCharacterInBoneyard(
  config: PlayerCharacterConfig,
  world: BoneyardWorldState,
): PlayerCharacterState {
  return {
    ...createPlayerCharacter(config, { x: world.spawn.x, y: world.spawn.y }),
    headingIndex: actorHeadingIndex(world.spawn.facingDeg),
  }
}

export function placePlayersInBoneyard(
  players: Readonly<Record<string, PlayerCharacterState>>,
  world: BoneyardWorldState,
): Readonly<Record<string, PlayerCharacterState>> {
  return Object.fromEntries(Object.entries(players).map(([playerId, player]) => [
    playerId,
    spawnPlayerCharacterInBoneyard(player.config, world),
  ]))
}

export function stepBoneyardWorldTick(
  world: BoneyardWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  inputs: Readonly<Record<string, PlayerCharacterInput>>,
): BoneyardWorldTickResult {
  const plans = Object.entries(players).map(([playerId, player]) => {
    const plan = planPlayerCharacterTick(
      player,
      inputs[playerId] ?? { movement: { x: 0, y: 0 } },
    )
    const requested = {
      x: player.position.x + plan.delta.x,
      y: player.position.y + plan.delta.y,
    }
    return { plan, player, playerId, requested }
  })

  let gateLeaves = world.gateLeaves
  for (const { plan, requested } of plans) {
    const contacts = touchingBoneyardGateLeaves(
      requested,
      gateLeaves,
      PLAYER_CHARACTER_RADIUS,
    )
    if (contacts.length === 0) continue
    const nextLeaves = [...gateLeaves]
    for (const index of contacts) {
      nextLeaves[index] = applyBoneyardGateContact(nextLeaves[index], plan.delta)
    }
    gateLeaves = nextLeaves
  }
  gateLeaves = gateLeaves.map(stepBoneyardGateLeaf)
  const collision = withBoneyardGateCollision(world.collision, gateLeaves)
  const resolvedBodies = resolveActorMotion(
    plans.map(({ plan, player, playerId }) => ({
      delta: plan.delta,
      id: `player-${playerId}`,
      position: player.position,
      ...PLAYER_CHARACTER_PHYSICS,
    })),
    {
      canPlace: (_bodyId, position, radius) => (
        canPlaceBoneyardBody(position, world.bounds, collision, radius)
      ),
      move: (_bodyId, position, delta, radius) => resolveBoneyardMovement(
        position,
        { x: position.x + delta.x, y: position.y + delta.y },
        world.bounds,
        collision,
        radius,
      ),
    },
    () => true,
  )
  const resolvedPositions = new Map(
    resolvedBodies.map((body) => [body.id, body.position]),
  )

  const nextPlayers = Object.fromEntries(plans.map(({ plan, player, playerId }) => {
    const position = resolvedPositions.get(`player-${playerId}`)
    if (!position) throw new Error(`Boneyard world lost player character ${playerId}`)
    return [
      playerId,
      commitPlayerCharacterTick(player, plan, position),
    ]
  }))
  return {
    players: nextPlayers,
    world: gateLeaves === world.gateLeaves ? world : { ...world, gateLeaves },
  }
}
