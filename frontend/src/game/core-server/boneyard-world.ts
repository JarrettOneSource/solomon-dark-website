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
  boneyardActiveBounds,
  createBoneyardArenaTransition,
  startBoneyardArenaTransition,
  stepBoneyardArenaTransition,
  type BoneyardArenaTransitionState,
} from '../core-kernels/boneyard-arena-transition.ts'
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
  PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
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
import type {
  NativeLightProviderRegistration,
  RegisterNativeLightProvider,
} from '../core-kernels/native-light-provider-order.ts'
import { RETAIL_BONEYARD_EXPERIENCE_RECIPE_SCALAR } from '../core-kernels/player-progression.ts'
import {
  createBoneyardWaveDirector,
  startBoneyardWaveDirector,
  stepBoneyardWaveDirector,
  type BoneyardWaveDirectorState,
} from '../core-kernels/boneyard-wave-director.ts'
import {
  canPlaceBoneyardBody,
  clipBoneyardSegment,
  createBoneyardCollisionWorld,
  firstBoneyardPathBlockProgress,
  resolveBoneyardMovement,
  resolveBoneyardSpawnPosition,
  touchingBoneyardGateLeaves,
  withBoneyardGateCollision,
  type BoneyardCollisionWorld,
} from './boneyard-collision.ts'
import {
  createBoneyardEnemyStore,
  stepBoneyardEnemyStore,
  type BoneyardEnemyPlayerDamage,
  type BoneyardEnemyPlayerKnockback,
  type BoneyardEnemyReward,
  type BoneyardEnemySemanticEvent,
  type BoneyardEnemyStore,
} from './boneyard-enemy-store.ts'

export interface BoneyardPlayerCombatStatus {
  readonly alive: boolean
  readonly collisionEnabled: boolean
  readonly eligible: boolean
  readonly movementScale: number
}

export interface BoneyardWorldState {
  arenaTransition: BoneyardArenaTransitionState | null
  bounds: BoneyardBounds
  collision: BoneyardCollisionWorld
  encounter: BoneyardSolomonEncounterState | null
  enemies: BoneyardEnemyStore
  enemyEvents: readonly BoneyardEnemySemanticEvent[]
  gateLeaves: readonly BoneyardGateLeafState[]
  kind: 'boneyard'
  lanternLightRegistration: NativeLightProviderRegistration | null
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

export function createBoneyardWorld(
  loaded: LoadedBoneyard,
  lanternLightRegistration: NativeLightProviderRegistration | null = null,
): BoneyardWorldState {
  const ownsRetailEncounter = loaded.choice.source === 'default'
    && loaded.scene.solomonDig !== null
  return {
    arenaTransition: ownsRetailEncounter
      ? createBoneyardArenaTransition(loaded.scene.bounds, loaded.scene.spawn)
      : null,
    bounds: { ...loaded.scene.bounds },
    collision: createBoneyardCollisionWorld(loaded.scene),
    encounter: ownsRetailEncounter
      ? createSolomonEncounter(loaded.scene.solomonDig!, loaded.seed)
      : null,
    enemies: createBoneyardEnemyStore(loaded.seed),
    enemyEvents: [],
    gateLeaves: createBoneyardGateLeaves(loaded.scene.fences, loaded.seed),
    kind: 'boneyard',
    lanternLightRegistration,
    runId: loaded.runId,
    scenerySpellTargets: loaded.scene.objects
      .filter(({ typeId }) => typeId === 2029)
      .map((object, registrationOrder) => ({
        active: true,
        actorFlags: 0x4,
        attachment: { x: 0, y: 0 },
        bodyRadius: 0,
        id: `scenery:${object.eid}`,
        kind: 'gravestone' as const,
        nativePriority: 1000,
        pendingRemove: false,
        position: { ...object.pos },
        registrationOrder,
      })),
    spawn: { ...loaded.scene.spawn },
    waves: ownsRetailEncounter ? createBoneyardWaveDirector(loaded.seed) : null,
  }
}

export function boneyardPrimarySpellTargets(
  world: BoneyardWorldState,
): readonly PrimarySpellTarget[] {
  const enemyRegistrationBase = world.scenerySpellTargets.length
  const actors = world.enemies.actors
    .filter((enemy) => enemy.lifeState === 'alive')
    .map((enemy) => ({
      active: true,
      actorFlags: enemy.config.enemyToken === 'COFFIN' ? 0 : 0x2,
      attachment: { x: 0, y: 0 },
      bodyRadius: enemy.config.collisionRadius,
      id: `enemy:${enemy.id}`,
      kind: 'enemy' as const,
      nativePriority: 0,
      pendingRemove: false,
      position: { ...enemy.position },
    }))
  const maggots = world.enemies.maggots
    .filter((enemy) => enemy.lifeState === 'alive')
    .map((enemy) => ({
      active: true,
      actorFlags: 0x2,
      attachment: { x: 0, y: 0 },
      bodyRadius: enemy.collisionRadius,
      id: `enemy:${enemy.id}`,
      kind: 'enemy' as const,
      nativePriority: 0,
      pendingRemove: false,
      position: { ...enemy.position },
    }))
  const enemies: PrimarySpellTarget[] = [...actors, ...maggots].map((enemy, index) => ({
    ...enemy,
    registrationOrder: enemyRegistrationBase + index,
  }))
  return [...world.scenerySpellTargets, ...enemies]
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
  registerLightProvider?: RegisterNativeLightProvider,
  registerProjectileLightProvider?: RegisterNativeLightProvider,
): BoneyardWorldTickResult {
  let arenaTransition = world.arenaTransition === null
    ? null
    : stepBoneyardArenaTransition(world.arenaTransition)
  let activeBounds = arenaTransition === null
    ? world.bounds
    : boneyardActiveBounds(arenaTransition)
  const plans = Object.entries(players).map(([playerId, player]) => {
    const locked = world.encounter !== null
      && isSolomonPlayerLocked(world.encounter, playerId)
    const plan = planPlayerCharacterTick(
      locked ? { velocity: { x: 0, y: 0 } } : player,
      locked
        ? createIdlePlayerCharacterInput()
        : inputs[playerId] ?? createIdlePlayerCharacterInput(),
      locked ? 0 : (playerCombat[playerId]?.movementScale ?? 1),
    )
    const requested = {
      x: player.position.x + plan.delta.x,
      y: player.position.y + plan.delta.y,
    }
    return {
      collisionEnabled: playerCombat[playerId]?.collisionEnabled ?? true,
      plan,
      player,
      playerId,
      requested,
    }
  })
  const collisionPlans = plans.filter(({ collisionEnabled }) => collisionEnabled)

  let gateLeaves = world.gateLeaves
  for (const { plan, requested } of collisionPlans) {
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
    [
      ...collisionPlans.map(({ plan, player, playerId }) => ({
        delta: plan.delta,
        id: `player-${playerId}`,
        position: player.position,
        ...PLAYER_CHARACTER_PHYSICS,
      })),
      ...boneyardEnemyBodies(world.enemies),
    ],
    {
      canPlace: (_bodyId, position, radius) => (
        canPlaceBoneyardBody(position, activeBounds, collision, radius)
      ),
      move: (_bodyId, position, delta, radius) => resolveBoneyardMovement(
        position,
        { x: position.x + delta.x, y: position.y + delta.y },
        activeBounds,
        collision,
        radius,
      ),
    },
    () => true,
  )
  const resolvedPositions = new Map(
    resolvedBodies.map((body) => [body.id, body.position]),
  )

  const nextPlayers = Object.fromEntries(plans.map(({
    collisionEnabled,
    plan,
    player,
    playerId,
  }) => {
    const position = collisionEnabled
      ? resolvedPositions.get(`player-${playerId}`)
      : player.position
    if (!position) throw new Error(`Boneyard world lost player character ${playerId}`)
    return [
      playerId,
      commitPlayerCharacterTick(player, plan, position),
    ]
  }))
  const collisionResolvedEnemies = commitBoneyardEnemyCollisionPositions(
    world.enemies,
    resolvedPositions,
  )
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
        activeBounds,
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
      if (arenaTransition !== null) {
        arenaTransition = startBoneyardArenaTransition(arenaTransition)
        activeBounds = boneyardActiveBounds(arenaTransition)
      }
    }
  }
  const dynamicBodies = boneyardCombatBodies(
    nextPlayers,
    collisionResolvedEnemies,
    playerCombat,
  )
  const enemyStep = stepBoneyardEnemyStore(collisionResolvedEnemies, {
    arenaScalars: { experience: RETAIL_BONEYARD_EXPERIENCE_RECIPE_SCALAR },
    clipSpellSegment: ({ end, start }) => clipBoneyardSegment(
      start,
      end,
      activeBounds,
      collision,
    ),
    firstProjectileWorldContact: ({ end, radius, start }) => (
      firstBoneyardPathBlockProgress(
        start,
        end,
        activeBounds,
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
        velocityPerTick: {
          x: player.velocity.x * PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
          y: player.velocity.y * PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
        },
      }]
    })),
    resolveMovement: ({ actorId, delta, position, purpose, radius }) => {
      if (purpose === 'spawn-placement') {
        return resolveBoneyardSpawnPosition(
          position,
          activeBounds,
          collision,
          radius,
        )
      }
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
            activeBounds,
            collision,
            candidateRadius,
          ),
          move: (_bodyId, current, movement, movementRadius) => resolveBoneyardMovement(
            current,
            { x: current.x + movement.x, y: current.y + movement.y },
            activeBounds,
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
        bounds: activeBounds,
        liveEnemyCount,
        players: livingPlayers,
        tick,
      })
      waves = result.director
      return result.spawnIntents
    },
    registerLightProvider,
    registerProjectileLightProvider,
    tick,
  })
  const knockback = applyBoneyardPlayerKnockbacks(
    nextPlayers,
    enemyStep.store,
    enemyStep.playerKnockbacks,
    playerCombat,
    activeBounds,
    collision,
  )
  return {
    enemyEvents: enemyStep.events,
    playerDamage: enemyStep.playerDamage,
    players: knockback.players,
    rewards: enemyStep.rewards,
    world: {
      ...world,
      arenaTransition,
      encounter,
      enemies: knockback.enemies,
      gateLeaves,
      waves,
    },
  }
}

function applyBoneyardPlayerKnockbacks(
  players: Readonly<Record<string, PlayerCharacterState>>,
  enemies: BoneyardEnemyStore,
  knockbacks: readonly BoneyardEnemyPlayerKnockback[],
  playerCombat: Readonly<Record<string, BoneyardPlayerCombatStatus>>,
  bounds: BoneyardBounds,
  collision: BoneyardCollisionWorld,
): Readonly<{
  enemies: BoneyardEnemyStore
  players: Readonly<Record<string, PlayerCharacterState>>
}> {
  if (knockbacks.length === 0) return { enemies, players }
  let bodies = boneyardCombatBodies(players, enemies, playerCombat)
  for (const knockback of knockbacks) {
    const moverId = `player-${knockback.playerId}`
    if (!bodies.has(moverId)) continue
    const resolved = resolveActorMotion(
      [...bodies.values()].map((body) => ({
        ...body,
        delta: body.id === moverId ? { ...knockback.delta } : { x: 0, y: 0 },
        driven: body.id === moverId,
      })),
      {
        canPlace: (_bodyId, position, radius) => canPlaceBoneyardBody(
          position,
          bounds,
          collision,
          radius,
        ),
        move: (_bodyId, position, delta, radius) => resolveBoneyardMovement(
          position,
          { x: position.x + delta.x, y: position.y + delta.y },
          bounds,
          collision,
          radius,
        ),
      },
      () => true,
    )
    bodies = new Map(resolved.map((body) => [body.id, body]))
  }

  const positions = new Map(
    [...bodies.values()].map((body) => [body.id, body.position]),
  )
  return {
    enemies: commitBoneyardEnemyCollisionPositions(enemies, positions),
    players: Object.fromEntries(Object.entries(players).map(([playerId, player]) => {
      const position = positions.get(`player-${playerId}`)
      return [
        playerId,
        position === undefined
          ? player
          : { ...player, position: { ...position } },
      ]
    })),
  }
}

function boneyardCombatBodies(
  players: Readonly<Record<string, PlayerCharacterState>>,
  enemies: BoneyardEnemyStore,
  playerCombat: Readonly<Record<string, BoneyardPlayerCombatStatus>>,
): Map<string, ActorPhysicsBody> {
  return new Map([
    ...Object.entries(players)
      .filter(([playerId]) => playerCombat[playerId]?.collisionEnabled ?? true)
      .map(([playerId, player]): [string, ActorPhysicsBody] => [
        `player-${playerId}`,
        {
          ...PLAYER_CHARACTER_PHYSICS,
          delta: { x: 0, y: 0 },
          driven: false,
          id: `player-${playerId}`,
          position: { ...player.position },
        },
      ]),
    ...boneyardEnemyBodies(enemies).map((body): [string, ActorPhysicsBody] => [
      body.id,
      body,
    ]),
  ])
}

function boneyardEnemyBodies(
  enemies: BoneyardEnemyStore,
): ActorPhysicsBody[] {
  return [
    ...enemies.actors
      .filter((actor) => actor.lifeState === 'alive')
      .map((actor) => {
        const id = `enemy-${actor.id}`
        return enemyCollisionBody(id, actor.position, actor.config.collisionRadius)
      }),
    ...enemies.maggots
      .filter((maggot) => maggot.lifeState === 'alive')
      .map((maggot) => {
        const id = `enemy-${maggot.id}`
        return enemyCollisionBody(id, maggot.position, maggot.collisionRadius)
      }),
  ]
}

function commitBoneyardEnemyCollisionPositions(
  enemies: BoneyardEnemyStore,
  resolvedPositions: ReadonlyMap<string, Readonly<BoneyardPoint>>,
): BoneyardEnemyStore {
  return {
    ...enemies,
    actors: enemies.actors.map((actor) => {
      const position = resolvedPositions.get(`enemy-${actor.id}`)
      return position === undefined
        ? actor
        : { ...actor, position: Object.freeze({ ...position }) }
    }),
    maggots: enemies.maggots.map((maggot) => {
      const position = resolvedPositions.get(`enemy-${maggot.id}`)
      return position === undefined
        ? maggot
        : { ...maggot, position: Object.freeze({ ...position }) }
    }),
  }
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
