import { actorHeadingIndex } from '../core-kernels/actor-heading.ts'
import { resolveActorMotion } from '../core-kernels/actor-physics.ts'
import type { BoneyardBounds, LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  createSolomonEncounter,
  isSolomonPlayerLocked,
  stepSolomonEncounter,
  type BoneyardSolomonEncounterState,
} from '../core-kernels/boneyard-encounter.ts'
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
  createIdlePlayerCharacterInput,
  createPlayerCharacter,
  planPlayerCharacterTick,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { PrimarySpellTarget } from '../core-kernels/primary-spell-targeting.ts'
import {
  createBoneyardWaveDirector,
  retireBoneyardEnemy,
  startBoneyardWaveDirector,
  stepBoneyardWaveDirector,
  type BoneyardWaveDirectorState,
} from '../core-kernels/boneyard-wave-director.ts'
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
  encounter: BoneyardSolomonEncounterState | null
  gateLeaves: readonly BoneyardGateLeafState[]
  kind: 'boneyard'
  runId: string
  scenerySpellTargets: readonly PrimarySpellTarget[]
  spawn: { x: number; y: number; facingDeg: number }
  waves: BoneyardWaveDirectorState | null
}

export interface BoneyardWorldTickResult {
  players: Readonly<Record<string, PlayerCharacterState>>
  world: BoneyardWorldState
}

export function createBoneyardWorld(loaded: LoadedBoneyard): BoneyardWorldState {
  const ownsRetailEncounter = loaded.choice.source === 'default'
    && loaded.scene.solomonDig !== null
  return {
    bounds: { ...loaded.scene.bounds },
    collision: createBoneyardCollisionWorld(loaded.scene),
    encounter: ownsRetailEncounter
      ? createSolomonEncounter(loaded.scene.solomonDig!, loaded.seed)
      : null,
    gateLeaves: createBoneyardGateLeaves(loaded.scene.fences, loaded.seed),
    kind: 'boneyard',
    runId: loaded.runId,
    scenerySpellTargets: loaded.scene.objects
      .filter(({ typeId }) => typeId === 2029)
      .map((object) => ({
        airPriority: 1000,
        attachment: { x: 0, y: 0 },
        id: `scenery:${object.eid}`,
        kind: 'gravestone' as const,
        position: { ...object.pos },
      })),
    spawn: { ...loaded.scene.spawn },
    waves: ownsRetailEncounter ? createBoneyardWaveDirector(loaded.seed) : null,
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
  tick: number,
): BoneyardWorldTickResult {
  const plans = Object.entries(players).map(([playerId, player]) => {
    const locked = world.encounter !== null
      && isSolomonPlayerLocked(world.encounter, playerId)
    const plan = planPlayerCharacterTick(
      locked ? { velocity: { x: 0, y: 0 } } : player,
      locked
        ? createIdlePlayerCharacterInput()
        : inputs[playerId] ?? createIdlePlayerCharacterInput(),
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
  let encounter = world.encounter === null
    ? null
    : stepSolomonEncounter(world.encounter, nextPlayers)
  if (world.encounter?.phase === 'escaping' && encounter !== null) {
    encounter = {
      ...encounter,
      position: resolveBoneyardMovement(
        world.encounter.position,
        encounter.position,
        world.bounds,
        collision,
        PLAYER_CHARACTER_RADIUS,
      ),
    }
  }
  let waves = world.waves
  if (waves !== null && encounter !== null) {
    if (encounter.runEventId > (world.encounter?.runEventId ?? 0)) {
      waves = startBoneyardWaveDirector(waves)
    } else if (waves.phase !== 'dormant') {
      const beforeNextEnemyId = waves.nextEnemyId
      waves = stepBoneyardWaveDirector(
        waves,
        nextPlayers,
        world.bounds,
        tick,
      )
      if (waves.nextEnemyId > beforeNextEnemyId) {
        waves = {
          ...waves,
          enemies: waves.enemies.map((enemy) => {
            if (enemy.id < beforeNextEnemyId) return enemy
            const target = nextPlayers[enemy.targetPlayerId]
            if (!target) return enemy
            return {
              ...enemy,
              position: resolveBoneyardMovement(
                target.position,
                enemy.position,
                world.bounds,
                collision,
                PLAYER_CHARACTER_RADIUS,
              ),
            }
          }),
        }
      }
    }
  }
  return {
    players: nextPlayers,
    world: {
      ...world,
      encounter,
      gateLeaves,
      waves,
    },
  }
}

export function retireBoneyardWorldEnemy(
  world: BoneyardWorldState,
  enemyId: number,
): BoneyardWorldState {
  if (world.waves === null) return world
  const waves = retireBoneyardEnemy(world.waves, enemyId)
  return waves === world.waves ? world : { ...world, waves }
}
