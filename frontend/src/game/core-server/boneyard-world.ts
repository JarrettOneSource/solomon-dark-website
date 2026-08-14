import { actorHeadingIndex } from '../core-kernels/actor-heading.ts'
import {
  resolveActorMotion,
  type ActorPhysicsBody,
} from '../core-kernels/actor-physics.ts'
import type {
  BoneyardBounds,
  BoneyardPoint,
  LoadedBoneyard,
} from '../core-kernels/boneyard.ts'
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
  startBoneyardWaveDirector,
  stepBoneyardWaveDirector,
  type BoneyardWaveDirectorState,
} from '../core-kernels/boneyard-wave-director.ts'
import {
  canPlaceBoneyardBody,
  createBoneyardCollisionWorld,
  firstBoneyardPathBlockProgress,
  resolveBoneyardMovement,
  touchingBoneyardGateLeaves,
  withBoneyardGateCollision,
  type BoneyardCollisionWorld,
} from './boneyard-collision.ts'
import {
  createBoneyardEnemyStore,
  stepBoneyardEnemyStore,
  type BoneyardEnemyPlayerDamage,
  type BoneyardEnemyReward,
  type BoneyardEnemySemanticEvent,
  type BoneyardEnemyStore,
} from './boneyard-enemy-store.ts'

export interface BoneyardPlayerCombatStatus {
  readonly alive: boolean
  readonly eligible: boolean
}

export interface BoneyardWorldState {
  bounds: BoneyardBounds
  collision: BoneyardCollisionWorld
  encounter: BoneyardSolomonEncounterState | null
  enemies: BoneyardEnemyStore
  enemyEvents: readonly BoneyardEnemySemanticEvent[]
  gateLeaves: readonly BoneyardGateLeafState[]
  kind: 'boneyard'
  runId: string
  scenerySpellTargets: readonly PrimarySpellTarget[]
  spawn: { x: number; y: number; facingDeg: number }
  waves: BoneyardWaveDirectorState | null
}

export interface BoneyardWorldTickResult {
  enemyEvents: readonly BoneyardEnemySemanticEvent[]
  playerDamage: readonly BoneyardEnemyPlayerDamage[]
  players: Readonly<Record<string, PlayerCharacterState>>
  rewards: readonly BoneyardEnemyReward[]
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
    enemies: createBoneyardEnemyStore(loaded.seed),
    enemyEvents: [],
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

export function boneyardPrimarySpellTargets(
  world: BoneyardWorldState,
): readonly PrimarySpellTarget[] {
  const enemies: PrimarySpellTarget[] = [
    ...world.enemies.actors,
    ...world.enemies.maggots,
  ]
    .filter((enemy) => enemy.lifeState === 'alive')
    .map((enemy) => ({
      airPriority: 0,
      attachment: { x: 0, y: 0 },
      id: `enemy:${enemy.id}`,
      kind: 'enemy',
      position: { ...enemy.position },
    }))
  return [...enemies, ...world.scenerySpellTargets]
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
  playerCombat: Readonly<Record<string, BoneyardPlayerCombatStatus>>,
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
  const livingPlayers = Object.fromEntries(Object.entries(nextPlayers).filter(([playerId]) => {
    const combat = playerCombat[playerId]
    return combat?.alive === true && combat.eligible
  }))
  let encounter = world.encounter === null
    ? null
    : stepSolomonEncounter(world.encounter, livingPlayers)
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
  let wavesStarted = false
  if (waves !== null && encounter !== null) {
    if (encounter.runEventId > (world.encounter?.runEventId ?? 0)) {
      waves = startBoneyardWaveDirector(waves)
      wavesStarted = true
    }
  }
  const dynamicBodies = boneyardCombatBodies(nextPlayers, world.enemies)
  const enemyStep = stepBoneyardEnemyStore(world.enemies, {
    firstProjectileWorldContact: ({ end, radius, start }) => (
      firstBoneyardPathBlockProgress(
        start,
        end,
        world.bounds,
        collision,
        radius,
      )
    ),
    players: Object.fromEntries(Object.entries(nextPlayers).map(([playerId, player]) => {
      const combat = playerCombat[playerId]
      return [playerId, {
        alive: combat?.alive ?? false,
        collisionRadius: PLAYER_CHARACTER_RADIUS,
        connected: true,
        eligible: combat?.eligible ?? false,
        position: player.position,
      }]
    })),
    resolveMovement: ({ actorId, delta, position, radius }) => {
      const moverId = `enemy-${actorId}`
      if (!dynamicBodies.has(moverId)) {
        dynamicBodies.set(moverId, enemyCollisionBody(moverId, position, radius))
      }
      const resolved = resolveActorMotion(
        [...dynamicBodies.values()].map((body) => ({
          ...body,
          delta: body.id === moverId ? { ...delta } : { x: 0, y: 0 },
          driven: body.id === moverId,
        })),
        {
          canPlace: (_bodyId, candidate, candidateRadius) => canPlaceBoneyardBody(
            candidate,
            world.bounds,
            collision,
            candidateRadius,
          ),
          move: (_bodyId, current, movement, movementRadius) => resolveBoneyardMovement(
            current,
            { x: current.x + movement.x, y: current.y + movement.y },
            world.bounds,
            collision,
            movementRadius,
          ),
        },
        () => true,
      )
      for (const body of resolved) dynamicBodies.set(body.id, body)
      const mover = dynamicBodies.get(moverId)
      if (!mover) throw new Error(`Boneyard collision lost enemy actor ${actorId}`)
      return mover.position
    },
    resolveSpawnIntents: (liveEnemyCount) => {
      if (
        waves === null
        || encounter === null
        || wavesStarted
        || waves.phase === 'dormant'
        || Object.keys(livingPlayers).length === 0
      ) return []
      const result = stepBoneyardWaveDirector(waves, {
        bounds: world.bounds,
        liveEnemyCount,
        players: livingPlayers,
        tick,
      })
      waves = result.director
      return result.spawnIntents
    },
    tick,
  })
  return {
    enemyEvents: enemyStep.events,
    playerDamage: enemyStep.playerDamage,
    players: nextPlayers,
    rewards: enemyStep.rewards,
    world: {
      ...world,
      encounter,
      enemies: enemyStep.store,
      gateLeaves,
      waves,
    },
  }
}

function boneyardCombatBodies(
  players: Readonly<Record<string, PlayerCharacterState>>,
  enemies: BoneyardEnemyStore,
): Map<string, ActorPhysicsBody> {
  return new Map([
    ...Object.entries(players).map(([playerId, player]): [string, ActorPhysicsBody] => [
      `player-${playerId}`,
      {
        ...PLAYER_CHARACTER_PHYSICS,
        delta: { x: 0, y: 0 },
        driven: false,
        id: `player-${playerId}`,
        position: { ...player.position },
      },
    ]),
    ...enemies.actors.map((actor): [string, ActorPhysicsBody] => {
      const id = `enemy-${actor.id}`
      return [id, enemyCollisionBody(id, actor.position, actor.config.collisionRadius)]
    }),
    ...enemies.maggots.map((maggot): [string, ActorPhysicsBody] => {
      const id = `enemy-${maggot.id}`
      return [id, enemyCollisionBody(id, maggot.position, maggot.collisionRadius)]
    }),
  ])
}

function enemyCollisionBody(
  id: string,
  position: Readonly<BoneyardPoint>,
  radius: number,
): ActorPhysicsBody {
  return {
    delta: { x: 0, y: 0 },
    driven: false,
    id,
    position: { ...position },
    pushEnabled: false,
    pushResistance: 0,
    pushStrength: 0,
    radius,
  }
}
