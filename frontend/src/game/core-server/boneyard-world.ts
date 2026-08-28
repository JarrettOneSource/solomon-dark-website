import { actorHeadingFromVector, actorHeadingIndex } from '../core-kernels/actor-heading.ts'
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
  boneyardArenaTransitionSafetyClear,
  boneyardActiveBounds,
  createBoneyardArenaTransition,
  startBoneyardArenaTransition,
  stepBoneyardArenaTransition,
  type BoneyardArenaTransitionState,
} from '../core-kernels/boneyard-arena-transition.ts'
import {
  createSolomonEncounter,
  isSolomonPlayerLocked,
  nativeSolomonEscapePathTarget,
  nativeSolomonEscapeTarget,
  NATIVE_SOLOMON_COLLISION_RADIUS,
  NATIVE_SOLOMON_ESCAPE_PATH_MARGIN,
  NATIVE_SOLOMON_ESCAPE_ROUTE_ARRIVAL_DISTANCE_SQUARED,
  NATIVE_SOLOMON_NAVIGATION_CLEARANCE,
  stepSolomonEncounter,
  type BoneyardSolomonEncounterState,
} from '../core-kernels/boneyard-encounter.ts'
import {
  STOCK_TUTORIAL_BONEYARD_ID,
  NATIVE_TUTORIAL_CAMERA_TARGET,
  createNativeTutorialState,
  nativeTutorialAmuletItem,
  nativeTutorialCameraBounds,
  nativeTutorialDialogueTicks,
  nativeTutorialEnemyCameraPositionIsAllowed,
  nativeTutorialEnemySpawnPositionIsAllowed,
  nativeTutorialHealthPotionItem,
  nativeTutorialPlayerMovementPaused,
  type NativeTutorialState,
} from '../core-kernels/native-tutorial.ts'
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
import {
  NATIVE_LANTERN_LIGHT_MIN_INTENSITY,
  NATIVE_LANTERN_LIGHT_RADIUS,
  NATIVE_PLAYER_LIGHT_OFFSET,
  NATIVE_PLAYER_LIGHT_RADIUS,
  nativeBoneyardRadialLightScalar,
  type NativeBoneyardRadialLight,
} from '../core-kernels/native-boneyard-lighting.ts'
import type {
  NativeLightProviderRegistration,
  RegisterNativeLightProvider,
} from '../core-kernels/native-light-provider-order.ts'
import type {
  NativeSecondaryKnockbackContact,
  NativeSecondarySceneryTarget,
  NativeSecondaryTargetEffectState,
} from '../core-kernels/native-secondary-abilities.ts'
import { RETAIL_BONEYARD_EXPERIENCE_RECIPE_SCALAR } from '../core-kernels/player-progression.ts'
import {
  NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS,
  NATIVE_LOOT_DEFAULT_MODIFIERS,
  type NativeLootModifiers,
  type NativeLootPlacement,
} from '../core-kernels/native-loot.ts'
import {
  createBoneyardWaveDirector,
  startBoneyardWaveDirector,
  stepBoneyardWaveDirector,
  type BoneyardEnemySpawnIntent,
  type BoneyardWaveDirectorState,
} from '../core-kernels/boneyard-wave-director.ts'
import type { NativeHallOfFameRunState } from '../core-kernels/hall-of-fame-score.ts'
import type { HubEconomyState, HubInventoryItem } from '../core-kernels/hub-economy.ts'
import type { BoneyardWaveEnemyToken } from '../core-kernels/boneyard-wave-schema.ts'
import {
  applyNativeEnemyWorldFeedback,
  createNativeEnemyWorldFeedbackState,
  nativeEnemyWorldFeedbackImpulses,
  stepNativeEnemyWorldFeedback,
  type NativeEnemyWorldFeedbackKernelState,
} from '../core-kernels/native-enemy-world-feedback.ts'
import {
  boneyardSpawnPositionIsOffscreen,
  boneyardBodyCollisionSourceIds,
  canPlaceBoneyardBody,
  clipBoneyardSegment,
  createBoneyardCollisionWorld,
  firstBoneyardLineObstruction,
  firstBoneyardPathBlockProgress,
  resolveNativeBoneyardSpawnPosition,
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
import { findBoneyardEnemyRoute } from './boneyard-enemy-navigation.ts'
import {
  createBoneyardLootStore,
  materializeBoneyardEnemyLoot,
  retireBoneyardGoodiesOutsideBounds,
  spawnBoneyardCustomLootItems,
  rollBoneyardLootSeed,
  stepBoneyardLootStore,
  type BoneyardLootEvent,
  type BoneyardLootPickup,
  type BoneyardLootStore,
} from './boneyard-loot-store.ts'

export interface BoneyardPlayerCombatStatus {
  readonly alive: boolean
  readonly collisionEnabled: boolean
  readonly eligible: boolean
  readonly movementScale: number
  readonly inventoryHasHealthPotion?: boolean
  readonly level?: number
  readonly lootModifiers?: NativeLootModifiers
  readonly ownedRecipeIndexes?: readonly number[]
  readonly advancedUnlocks?: readonly boolean[]
}

export interface BoneyardSummonTarget {
  readonly collisionRadius: number
  readonly id: string
  readonly position: Readonly<BoneyardPoint>
}

export interface BoneyardWorldState {
  arenaTransition: BoneyardArenaTransitionState | null
  bounds: BoneyardBounds
  collision: BoneyardCollisionWorld
  earthquakeSceneryTargets: readonly NativeSecondarySceneryTarget[]
  primarySceneryTargets: readonly PrimarySpellTarget[]
  encounter: BoneyardSolomonEncounterState | null
  enemies: BoneyardEnemyStore
  enemyWorldFeedback: NativeEnemyWorldFeedbackKernelState
  enemyEvents: readonly BoneyardEnemySemanticEvent[]
  gateLeaves: readonly BoneyardGateLeafState[]
  kind: 'boneyard'
  lanternLightRegistration: NativeLightProviderRegistration | null
  lanternPosition: Readonly<BoneyardPoint> | null
  hallOfFameRuns: Readonly<Record<string, NativeHallOfFameRunState>>
  loot: BoneyardLootStore
  lootEvents: readonly BoneyardLootEvent[]
  playerOuchDeadlineTick: number
  runId: string
  scenerySpellTargets: readonly PrimarySpellTarget[]
  spawn: { x: number; y: number; facingDeg: number }
  tutorial: NativeTutorialState | null
  tutorialProfileEconomy: HubEconomyState | null
  waves: BoneyardWaveDirectorState | null
}

export interface BoneyardWorldTickResult {
  enemyEvents: readonly BoneyardEnemySemanticEvent[]
  lootEvents: readonly BoneyardLootEvent[]
  lootPickups: readonly BoneyardLootPickup[]
  movementContactsByPlayerId: Readonly<
    Record<string, readonly BoneyardPlayerMovementContact[]>
  >
  movementEpochActiveByPlayerId: Readonly<Record<string, boolean>>
  playerDamage: readonly BoneyardEnemyPlayerDamage[]
  players: Readonly<Record<string, PlayerCharacterState>>
  rewards: readonly BoneyardEnemyReward[]
  world: BoneyardWorldState
}

export interface BoneyardPlayerMovementContact {
  readonly bodyId: string
  readonly staffHostile: boolean
}

export function createBoneyardWorld(
  loaded: LoadedBoneyard,
  lanternLightRegistration: NativeLightProviderRegistration | null = null,
): BoneyardWorldState {
  const tutorial = loaded.choice.id === STOCK_TUTORIAL_BONEYARD_ID
  const ownsRetailEncounter = loaded.choice.source === 'default'
    && loaded.scene.solomonDig !== null
    && !tutorial
  const ownsSolomonEncounter = loaded.choice.source === 'default'
    && loaded.scene.solomonDig !== null
  return {
    arenaTransition: ownsRetailEncounter
      ? createBoneyardArenaTransition(loaded.scene.bounds, loaded.scene.spawn)
      : null,
    bounds: { ...loaded.scene.bounds },
    collision: createBoneyardCollisionWorld(loaded.scene),
    earthquakeSceneryTargets: loaded.scene.objects.map((object, id) => Object.freeze({
      id,
      position: Object.freeze({ ...object.pos }),
      typeId: object.typeId,
    })),
    primarySceneryTargets: loaded.scene.objects.flatMap((object, registrationOrder) => {
      const bodyRadius = fireballSceneryRadius(object.typeId)
      return bodyRadius === null ? [] : [Object.freeze({
        active: true,
        actorFlags: 0x4,
        attachment: Object.freeze({ x: 0, y: 0 }),
        bodyRadius,
        cellBindingOrder: registrationOrder,
        id: `scenery:${object.eid}`,
        kind: object.typeId === 2029 ? 'gravestone' as const : 'scenery' as const,
        nativePriority: 1000,
        pendingRemove: false,
        position: Object.freeze({ ...object.pos }),
        registrationOrder,
      })]
    }),
    encounter: ownsSolomonEncounter
      ? createSolomonEncounter(loaded.scene.solomonDig!, loaded.seed, tutorial
          ? { dialogueMode: 'tutorial', tutorialDialogueTicks: nativeTutorialDialogueTicks() }
          : undefined)
      : null,
    enemies: createBoneyardEnemyStore(loaded.seed, loaded.scene.objects.length),
    enemyWorldFeedback: createNativeEnemyWorldFeedbackState(),
    enemyEvents: [],
    gateLeaves: createBoneyardGateLeaves(loaded.scene.fences, loaded.seed),
    kind: 'boneyard',
    lanternLightRegistration,
    lanternPosition: loaded.scene.solomonDig === null
      ? null
      : Object.freeze({ ...loaded.scene.solomonDig.lanternPosition }),
    hallOfFameRuns: {},
    loot: createBoneyardLootStore(
      loaded.seed,
      loaded.scene.objects
        .filter(({ typeId }) => typeId === 2061)
        .map((object) => ({
          eid: object.eid,
          position: Object.freeze({ ...object.pos }),
          subtype: 0,
        })),
    ),
    lootEvents: [],
    playerOuchDeadlineTick: 0,
    runId: loaded.runId,
    scenerySpellTargets: loaded.scene.objects.flatMap((object, registrationOrder) => (
      object.typeId === 2029 ? [{
        active: true,
        actorFlags: 0x4,
        attachment: { x: 0, y: 0 },
        bodyRadius: 0,
        cellBindingOrder: registrationOrder,
        id: `scenery:${object.eid}`,
        kind: 'gravestone' as const,
        nativePriority: 1000,
        pendingRemove: false,
        position: { ...object.pos },
        registrationOrder,
      }] : []
    )),
    spawn: { ...loaded.scene.spawn },
    tutorial: tutorial
      ? createNativeTutorialState(loaded.scene.spawn, 0, loaded.seed)
      : null,
    tutorialProfileEconomy: null,
    waves: ownsRetailEncounter ? createBoneyardWaveDirector(loaded.seed) : null,
  }
}

function fireballSceneryRadius(typeId: number): number | null {
  switch (typeId) {
    case 2001: return 8
    case 2009: return 1
    case 2029: return 0.01
    case 2040: return 1
    case 2061: return 20
    default: return null
  }
}

export function boneyardPrimarySpellTargets(
  world: BoneyardWorldState,
): readonly PrimarySpellTarget[] {
  const actors = world.enemies.actors
    .map((enemy) => ({
      active: enemy.lifeState === 'alive',
      actorFlags: enemy.config.enemyToken === 'COFFIN' ? 0 : 0x2,
      attachment: { x: 0, y: 0 },
      bodyRadius: enemy.config.collisionRadius,
      cellBindingOrder: enemy.nativeCellBindingOrder,
      headingDeg: enemy.headingDeg,
      id: `enemy:${enemy.id}`,
      kind: 'enemy' as const,
      nativePriority: 0,
      pendingRemove: false,
      position: { ...enemy.position },
      registrationOrder: enemy.nativeRegistrationOrder,
    }))
  const maggots = world.enemies.maggots
    .map((enemy) => ({
      active: enemy.lifeState === 'alive' && enemy.combatActive,
      actorFlags: 0x2,
      attachment: { x: 0, y: 0 },
      bodyRadius: enemy.collisionRadius,
      cellBindingOrder: enemy.nativeCellBindingOrder,
      headingDeg: enemy.headingDeg,
      id: `enemy:${enemy.id}`,
      kind: 'enemy' as const,
      nativePriority: 0,
      pendingRemove: false,
      position: { ...enemy.position },
      registrationOrder: enemy.nativeRegistrationOrder,
    }))
  const enemies: PrimarySpellTarget[] = [...actors, ...maggots]
  return [...world.primarySceneryTargets, ...enemies]
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
  abilityEffects: Readonly<Record<number, NativeSecondaryTargetEffectState>> = {},
  summons: readonly BoneyardSummonTarget[] = [],
  externalSpawnIntents: readonly BoneyardEnemySpawnIntent[] = [],
  customLoot?: (input: Readonly<{
    actorSeed: number
    enemyToken: BoneyardWaveEnemyToken
  }>) => readonly HubInventoryItem[],
  hostileScenePaused = false,
): BoneyardWorldTickResult {
  let arenaTransition = world.arenaTransition === null
    ? null
    : stepBoneyardArenaTransition(world.arenaTransition)
  let activeBounds = arenaTransition === null
    ? world.bounds
    : boneyardActiveBounds(arenaTransition)
  const tutorialMovementPaused = world.tutorial !== null
    && nativeTutorialPlayerMovementPaused(world.tutorial)
  const plans = Object.entries(players).map(([playerId, player]) => {
    const locked = tutorialMovementPaused || (
      world.encounter !== null
      && isSolomonPlayerLocked(world.encounter, playerId)
    )
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
  const movementContactPlayerIds = new Map<string, string>(
    collisionPlans.flatMap(({ plan, playerId }) => (
      plan.movementActive ? [[`player-${playerId}`, playerId] as const] : []
    )),
  )
  const staffHostileBodyIds = new Set([
    ...world.enemies.actors.flatMap((actor) => (
      actor.lifeState === 'alive' && actor.config.enemyToken !== 'COFFIN'
        ? [`enemy-${actor.id}`]
        : []
    )),
    ...world.enemies.maggots.flatMap((maggot) => (
      maggot.lifeState === 'alive' && maggot.combatActive
        ? [`enemy-${maggot.id}`]
        : []
    )),
  ])
  const movementContactsByPlayerId: Record<string, BoneyardPlayerMovementContact[]> =
    Object.fromEntries(plans.map(({ playerId }) => [playerId, []]))
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
    undefined,
    (moverId, otherId) => {
      const playerId = movementContactPlayerIds.get(moverId)
      if (playerId !== undefined) {
        movementContactsByPlayerId[playerId]!.push(Object.freeze({
          bodyId: otherId,
          staffHostile: staffHostileBodyIds.has(otherId),
        }))
      }
    },
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
  const collisionResolvedEnemies = hostileScenePaused
    ? world.enemies
    : commitBoneyardEnemyCollisionPositions(world.enemies, resolvedPositions)
  const livingPlayers = Object.fromEntries(Object.entries(nextPlayers).filter(([playerId]) => {
    const combat = playerCombat[playerId]
    return combat?.alive === true && combat.eligible
  }))
  const lootParticipants = Object.entries(nextPlayers).map(([playerId, player]) => {
    const combat = playerCombat[playerId]
    return {
      advancedUnlocks: combat?.advancedUnlocks ?? new Array<boolean>(8).fill(false),
      alive: combat?.alive ?? false,
      connected: true,
      headingIndex: player.headingIndex,
      level: combat?.level ?? 1,
      modifiers: combat?.lootModifiers ?? NATIVE_LOOT_DEFAULT_MODIFIERS,
      ownedRecipeIndexes: combat?.ownedRecipeIndexes ?? [],
      playerId,
      position: player.position,
    }
  })
  const lootPlacement = createNativeLootPlacement(
    activeBounds,
    collision,
    nextPlayers,
    collisionResolvedEnemies,
  )
  const lootStep = stepBoneyardLootStore(world.loot, {
    participants: lootParticipants,
    placement: lootPlacement,
    tick,
  })
  let loot = lootStep.store
  const encounterSource = world.encounter?.phase === 'escaping'
    ? prepareSolomonEscapeNavigation(
        world.encounter,
        world.bounds,
        collision,
        world.collision,
      )
    : world.encounter
  let encounter = encounterSource === null
    ? null
    : stepSolomonEncounter(encounterSource, livingPlayers, tick)
  if (encounterSource?.phase === 'escaping' && encounter !== null) {
    encounter = resolveSolomonEscapeMovement(
      encounterSource,
      encounter,
      world.bounds,
      collision,
    )
  }
  let waves = world.waves
  let tutorial = world.tutorial
  let wavesStarted = false
  let pendingExternalSpawnIntents = externalSpawnIntents
  let enemyWorldFeedback = stepNativeEnemyWorldFeedback(world.enemyWorldFeedback)
  if (waves !== null && encounter !== null) {
    if (encounter.runEventId > (world.encounter?.runEventId ?? 0)) {
      waves = startBoneyardWaveDirector(waves)
      wavesStarted = true
    }
  }
  if (
    arenaTransition?.phase === 'open'
    && waves !== null
    && waves.phase !== 'dormant'
    && boneyardArenaTransitionSafetyClear(arenaTransition.combatBounds, [
      ...Object.entries(nextPlayers).flatMap(([playerId, player]) => {
        const combat = playerCombat[playerId]
        return combat?.alive === true && combat.eligible
          ? [{ position: player.position, radius: PLAYER_CHARACTER_RADIUS }]
          : []
      }),
      ...collisionResolvedEnemies.actors.map((actor) => ({
        position: actor.position,
        radius: actor.config.collisionRadius,
      })),
      ...collisionResolvedEnemies.maggots.map((maggot) => ({
        position: maggot.position,
        radius: maggot.collisionRadius,
      })),
      ...loot.actors.filter(({ kind }) => kind === 'sack').map((actor) => ({
        position: actor.position,
        radius: NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS,
      })),
    ])
  ) {
    arenaTransition = startBoneyardArenaTransition(arenaTransition)
    activeBounds = boneyardActiveBounds(arenaTransition)
  }
  const spawnBounds = arenaTransition !== null
    && waves !== null
    && waves.phase !== 'dormant'
    ? arenaTransition.combatBounds
    : activeBounds
  const dynamicBodies = boneyardCombatBodies(
    nextPlayers,
    collisionResolvedEnemies,
    playerCombat,
  )
  const spawnLightSources = boneyardSpawnLightSources(
    world,
    nextPlayers,
    collisionResolvedEnemies,
  )
  const spawnPolicyFocuses = Object.values(livingPlayers).map(({ position }) => position)
  if (spawnPolicyFocuses.length === 0) {
    spawnPolicyFocuses.push({
      x: activeBounds.x + activeBounds.w / 2,
      y: activeBounds.y + activeBounds.h / 2,
    })
  }
  const spawnCameraBounds = tutorial === null
    ? activeBounds
    : nativeTutorialCameraBounds(tutorial) ?? activeBounds
  const tutorialAtEnemyStep = tutorial
  const tutorialSpawnDomain = tutorialAtEnemyStep === null
    ? null
    : (candidate: Readonly<BoneyardPoint>, radius: number) => (
        nativeTutorialEnemySpawnPositionIsAllowed(candidate, radius)
        && (
          !tutorialAtEnemyStep.cameraLockTriggered
          || nativeTutorialEnemyCameraPositionIsAllowed(candidate, radius)
        )
      )
  const enemyStep = stepBoneyardEnemyStore(collisionResolvedEnemies, {
    abilityEffects,
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
    navigation: {
      findRoute: ({ bodyRadius, end, navigationClearance, start }) => (
        findBoneyardEnemyRoute({
          bodyRadius,
          bounds: activeBounds,
          clearance: navigationClearance,
          end,
          start,
          // Stock builds the three Arena NavMeshes once from Region geometry;
          // moving gate leaves remain final movement-collision owners.
          world: world.collision,
        })
      ),
      isPathClear: ({ end, radius, start }) => firstBoneyardPathBlockProgress(
        { ...start },
        { ...end },
        activeBounds,
        collision,
        radius,
      ) === null,
    },
    paused: hostileScenePaused,
    players: Object.fromEntries([
      ...Object.entries(nextPlayers).map(([playerId, player]) => {
        const combat = playerCombat[playerId]
        return [playerId, {
          alive: combat?.alive ?? false,
          collisionRadius: PLAYER_CHARACTER_RADIUS,
          connected: true,
          eligible: combat?.eligible ?? false,
          headingDeg: player.headingIndex * 15,
          position: player.position,
          velocityPerTick: {
            x: player.velocity.x * PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
            y: player.velocity.y * PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
          },
        }] as const
      }),
      ...summons.map((summon) => [summon.id, {
        alive: true,
        collisionRadius: summon.collisionRadius,
        connected: true,
        eligible: true,
        headingDeg: 0,
        position: summon.position,
        velocityPerTick: { x: 0, y: 0 },
      }] as const),
    ]),
    resolveMovement: ({ actorId, delta, position, purpose, radius }) => {
      if (purpose === 'spawn-placement') {
        return resolveBoneyardSpawnPosition(
          position,
          spawnBounds,
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
    resolveSpawnPlacement: ({ actorId: _actorId, position, positionPolicy, radius, rngState }) => (
      resolveNativeBoneyardSpawnPosition(
        { ...position },
        spawnBounds,
        collision,
        radius,
        positionPolicy ?? 'direct',
        rngState,
        {
          ...(tutorialSpawnDomain === null ? {} : { acceptsDomain: tutorialSpawnDomain }),
          isOffscreen: (candidate) => boneyardSpawnPositionIsOffscreen(
            candidate,
            spawnCameraBounds,
            spawnPolicyFocuses,
          ),
          lightAt: (candidate) => nativeBoneyardRadialLightScalar(
            candidate,
            spawnLightSources,
          ),
          ...(tutorial?.cameraLockTriggered === true
            ? { retryBounds: NATIVE_TUTORIAL_CAMERA_TARGET }
            : {}),
        },
      )
    ),
    resolveSpawnIntents: (liveEnemyCount) => {
      const external = pendingExternalSpawnIntents
      pendingExternalSpawnIntents = []
      if (
        waves === null
        || encounter === null
        || wavesStarted
        || waves.phase === 'dormant'
      ) return external
      const result = stepBoneyardWaveDirector(waves, {
        bounds: spawnBounds,
        liveEnemyCount,
        players: livingPlayers,
        tick,
      })
      waves = result.director
      return [...external, ...result.spawnIntents]
    },
    registerLightProvider,
    registerProjectileLightProvider,
    retirementObserver: {
      onTerminalOutput: (output, outputCount) => {
        for (const intensity of nativeEnemyWorldFeedbackImpulses(output, outputCount)) {
          enemyWorldFeedback = applyNativeEnemyWorldFeedback(enemyWorldFeedback, intensity)
        }
      },
    },
    rollLootSeed: () => {
      const rolled = rollBoneyardLootSeed(loot)
      loot = rolled.store
      return rolled.seed
    },
    tick,
  })
  const authorityId = Object.keys(nextPlayers)[0]
  const authorityCombat = authorityId === undefined ? undefined : playerCombat[authorityId]
  const badguyCountBeforeDeaths = collisionResolvedEnemies.actors.length
  for (const [rewardIndex, reward] of enemyStep.rewards.entries()) {
    const materialized = materializeBoneyardEnemyLoot(loot, {
      actorSeed: reward.lootSource.actorSeed,
      advancedUnlocks: authorityCombat?.advancedUnlocks ?? new Array<boolean>(8).fill(false),
      arena: {
        disableMask: 0,
        itemLevelMaximum: 100,
        itemLevelMinimum: 0,
        level: waves?.waveOrdinal ?? tutorial?.waveOrdinal ?? 0,
        mode: 0,
        specialSuppression: false,
      },
      inventoryHasHealthPotion: authorityCombat?.inventoryHasHealthPotion ?? false,
      modifiers: authorityCombat?.lootModifiers ?? NATIVE_LOOT_DEFAULT_MODIFIERS,
      nearbyMaskTwoCount: nearbyNativeMaskTwoCount(
        collisionResolvedEnemies,
        reward.actorId,
        reward.lootSource.position,
      ),
      ownedRecipeIndexes: authorityCombat?.ownedRecipeIndexes ?? [],
      participantLevel: authorityCombat?.level ?? 1,
      participantSlot: reward.lootSource.participantSlot,
      placement: createNativeLootPlacement(
        activeBounds,
        collision,
        nextPlayers,
        enemyStep.store,
      ),
      policies: reward.lootSource.policies
        ?? { gold: 0, item: 0, orb: 0, potion: 0, powerup: 0, specificItem: 0 },
      position: reward.lootSource.position,
      sceneForcesHealthPotion: false,
      tick,
      worldBadguyCount: Math.max(0, badguyCountBeforeDeaths - rewardIndex),
      worldHasHealthPotionSack: loot.actors.some(({ item, kind }) => (
        kind === 'sack'
        && item?.nativeTypeId === 7001
        && item.nativeSubtype === 0
      )),
    })
    loot = materialized.store
    if (reward.lootSource.recipeUid === 10051 && tutorial?.itemDropArmed) {
      loot = spawnBoneyardCustomLootItems(
        loot,
        [nativeTutorialAmuletItem()],
        reward.lootSource.position,
        tick,
      ).store
      tutorial = { ...tutorial, itemDropArmed: false }
    } else if (reward.lootSource.recipeUid === 10065 && tutorial !== null) {
      loot = spawnBoneyardCustomLootItems(
        loot,
        [nativeTutorialHealthPotionItem()],
        reward.lootSource.position,
        tick,
      ).store
    }
    const customItems = customLoot?.({
      actorSeed: reward.lootSource.actorSeed,
      enemyToken: reward.lootSource.enemyToken,
    }) ?? []
    if (customItems.length > 0) {
      loot = spawnBoneyardCustomLootItems(
        loot,
        customItems,
        reward.lootSource.position,
        tick,
      ).store
    }
  }
  const knockback = applyBoneyardPlayerKnockbacks(
    nextPlayers,
    enemyStep.store,
    enemyStep.playerKnockbacks,
    playerCombat,
    activeBounds,
    collision,
  )
  const cleanupBounds = arenaTransition?.phase === 'sealed'
    ? arenaTransition.combatBounds
    : tutorial?.cameraLockTriggered === true
      && tutorial.cameraLockTicksRemaining === 0
      ? NATIVE_TUTORIAL_CAMERA_TARGET
      : null
  if (cleanupBounds !== null) {
    loot = retireBoneyardGoodiesOutsideBounds(loot, cleanupBounds)
  }
  const earthquakeSceneryTargets = cleanupBounds === null
    ? world.earthquakeSceneryTargets
    : world.earthquakeSceneryTargets.filter(({ position }) => (
        pointInsideBounds(position, cleanupBounds)
      ))
  const primarySceneryTargets = cleanupBounds === null
    ? world.primarySceneryTargets
    : world.primarySceneryTargets.filter(({ position }) => (
        pointInsideBounds(position, cleanupBounds)
      ))
  const scenerySpellTargets = cleanupBounds === null
    ? world.scenerySpellTargets
    : world.scenerySpellTargets.filter(({ position }) => (
        pointInsideBounds(position, cleanupBounds)
      ))
  return {
    enemyEvents: enemyStep.events,
    lootEvents: lootStep.events,
    lootPickups: lootStep.pickups,
    movementContactsByPlayerId: Object.freeze(Object.fromEntries(
      Object.entries(movementContactsByPlayerId).map(([playerId, contacts]) => [
        playerId,
        Object.freeze(contacts),
      ]),
    )),
    movementEpochActiveByPlayerId: Object.freeze(Object.fromEntries(
      plans.map(({ collisionEnabled, plan, playerId }) => [
        playerId,
        collisionEnabled && plan.movementActive,
      ]),
    )),
    playerDamage: enemyStep.playerDamage,
    players: knockback.players,
    rewards: enemyStep.rewards,
    world: {
      ...world,
      arenaTransition,
      earthquakeSceneryTargets,
      encounter,
      enemies: knockback.enemies,
      enemyWorldFeedback,
      gateLeaves,
      loot,
      primarySceneryTargets,
      scenerySpellTargets,
      tutorial,
      waves,
    },
  }
}

function prepareSolomonEscapeNavigation(
  source: BoneyardSolomonEncounterState,
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
  navigationCollision: BoneyardCollisionWorld,
): BoneyardSolomonEncounterState {
  const escapeTarget = source.escapeTarget ?? nativeSolomonEscapeTarget(
    source.position,
    source.headingDeg,
    bounds,
  )
  const escapeCollisionSourceIds = source.escapeTarget === null
    ? boneyardBodyCollisionSourceIds(
        source.position,
        collision,
        NATIVE_SOLOMON_COLLISION_RADIUS,
      )
    : source.escapeCollisionSourceIds
  const pathTarget = nativeSolomonEscapePathTarget(
    source.position,
    escapeTarget,
    bounds,
  )
  const traversalBounds = solomonEscapeTraversalBounds(bounds)
  const ignoredSourceIds = new Set(escapeCollisionSourceIds)
  const directPathBlockProgress = firstBoneyardPathBlockProgress(
    source.position,
    pathTarget,
    traversalBounds,
    collision,
    NATIVE_SOLOMON_COLLISION_RADIUS,
    ignoredSourceIds,
  )
  const route = directPathBlockProgress === null
    ? null
    : findBoneyardEnemyRoute({
        bodyRadius: NATIVE_SOLOMON_COLLISION_RADIUS,
        bounds: traversalBounds,
        clearance: NATIVE_SOLOMON_NAVIGATION_CLEARANCE,
        end: pathTarget,
        ignoredSourceIds,
        start: source.position,
        world: navigationCollision,
      })
  const goal = solomonEscapeRouteGoal(
    source.position,
    pathTarget,
    route,
    traversalBounds,
    collision,
    ignoredSourceIds,
  )
  return {
    ...source,
    escapeCollisionSourceIds,
    escapeTarget,
    headingDeg: actorHeadingFromVector(
      goal.x - source.position.x,
      goal.y - source.position.y,
    ),
  }
}

function resolveSolomonEscapeMovement(
  source: BoneyardSolomonEncounterState,
  next: BoneyardSolomonEncounterState,
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
): BoneyardSolomonEncounterState {
  const ignoredSourceIds = source.escapeCollisionSourceIds.length === 0
    ? undefined
    : new Set(source.escapeCollisionSourceIds)
  const pathTarget = source.escapeTarget === null
    ? null
    : nativeSolomonEscapePathTarget(source.position, source.escapeTarget, bounds)
  const pathTargetReached = pathTarget !== null
    && squaredDistance(source.position, pathTarget)
      <= NATIVE_SOLOMON_ESCAPE_ROUTE_ARRIVAL_DISTANCE_SQUARED
  const position = pathTargetReached
    ? source.position
    : resolveBoneyardMovement(
        source.position,
        next.position,
        solomonEscapeTraversalBounds(bounds),
        collision,
        NATIVE_SOLOMON_COLLISION_RADIUS,
        ignoredSourceIds,
      )
  if (next.phase === 'gone') return { ...next, position }
  const activeCollisionSourceIds = new Set(boneyardBodyCollisionSourceIds(
    position,
    collision,
    NATIVE_SOLOMON_COLLISION_RADIUS,
  ))
  const escapeCollisionSourceIds = source.escapeCollisionSourceIds.filter((sourceId) => (
    activeCollisionSourceIds.has(sourceId)
  ))
  return {
    ...next,
    escapeCollisionSourceIds,
    position,
  }
}

function solomonEscapeRouteGoal(
  position: Readonly<BoneyardPoint>,
  pathTarget: Readonly<BoneyardPoint>,
  route: readonly Readonly<BoneyardPoint>[] | null,
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
  ignoredSourceIds: ReadonlySet<string>,
): Readonly<BoneyardPoint> {
  if (route === null || route.length < 2) return pathTarget
  let goal = route[1]!
  for (let index = 2; index < route.length; index += 1) {
    const candidate = route[index]!
    if (firstBoneyardLineObstruction(
      position,
      candidate,
      bounds,
      collision,
      undefined,
      0,
      ignoredSourceIds,
    ) !== null) break
    goal = candidate
  }
  return goal
}

function solomonEscapeTraversalBounds(
  bounds: Readonly<BoneyardBounds>,
): BoneyardBounds {
  // The shared resolver insets by body radius; compensate so Solomon's center
  // can reach the native state-4 rectangle expanded by 50.
  const padding = NATIVE_SOLOMON_ESCAPE_PATH_MARGIN + NATIVE_SOLOMON_COLLISION_RADIUS
  return {
    h: bounds.h + padding * 2,
    w: bounds.w + padding * 2,
    x: bounds.x - padding,
    y: bounds.y - padding,
  }
}

function squaredDistance(
  left: Readonly<BoneyardPoint>,
  right: Readonly<BoneyardPoint>,
): number {
  const dx = right.x - left.x
  const dy = right.y - left.y
  return dx * dx + dy * dy
}

function pointInsideBounds(
  point: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
): boolean {
  return point.x >= bounds.x
    && point.y >= bounds.y
    && point.x <= bounds.x + bounds.w
    && point.y <= bounds.y + bounds.h
}

function boneyardSpawnLightSources(
  world: BoneyardWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  enemies: BoneyardEnemyStore,
): readonly NativeBoneyardRadialLight[] {
  const sources: NativeBoneyardRadialLight[] = []
  for (const player of Object.values(players)) {
    const heading = player.headingIndex * 15 * Math.PI / 180
    sources.push({
      intensity: 1,
      position: {
        x: player.position.x + Math.sin(heading) * NATIVE_PLAYER_LIGHT_OFFSET,
        y: player.position.y - Math.cos(heading) * NATIVE_PLAYER_LIGHT_OFFSET,
      },
      radius: NATIVE_PLAYER_LIGHT_RADIUS,
    })
  }
  if (world.lanternPosition !== null) {
    sources.push({
      intensity: NATIVE_LANTERN_LIGHT_MIN_INTENSITY,
      position: world.lanternPosition,
      radius: NATIVE_LANTERN_LIGHT_RADIUS,
    })
  }
  for (const actor of enemies.actors) {
    if (actor.lighting.providerCopies === 0) continue
    const radius = (() => {
      switch (actor.config.enemyToken) {
        case 'IMP': return 0.35
        case 'DEMON': return 1.75
        case 'COFFIN': return 0.65
        case 'SKELETON':
        case 'SKELETONARCHER':
        case 'SKELETONMAGE':
        case 'WRAITH': return 0.5
        case 'ZOMBIE': return 0
      }
    })()
    if (radius > 0) {
      sources.push({ intensity: 1, position: actor.position, radius })
    }
  }
  return sources
}

function createNativeLootPlacement(
  bounds: BoneyardBounds,
  collision: BoneyardCollisionWorld,
  players: Readonly<Record<string, PlayerCharacterState>>,
  enemies: BoneyardEnemyStore,
): NativeLootPlacement {
  const bodies = [
    ...Object.values(players).map(({ position }) => ({
      position,
      radius: PLAYER_CHARACTER_RADIUS,
    })),
    ...enemies.actors.map((actor) => ({
      position: actor.position,
      radius: actor.config.collisionRadius,
    })),
    ...enemies.maggots.map((actor) => ({
      position: actor.position,
      radius: actor.collisionRadius,
    })),
  ]
  const placement: NativeLootPlacement = {
    canPlace: (position, radius, avoidActors) => {
      if (!canPlaceBoneyardBody(position, bounds, collision, radius)) return false
      if (!avoidActors) return true
      for (const body of bodies) {
        const horizontal = radius + body.radius
        const vertical = horizontal * 0.8
        const dx = position.x - body.position.x
        const dy = position.y - body.position.y
        if (dx * dx / (horizontal * horizontal) + dy * dy / (vertical * vertical) < 1) {
          return false
        }
      }
      return true
    },
  }
  return Object.freeze(placement)
}

function nearbyNativeMaskTwoCount(
  enemies: BoneyardEnemyStore,
  excludedActorId: number,
  position: Readonly<BoneyardPoint>,
): number {
  const radiusSquared = 250 * 250
  const within = (candidate: Readonly<BoneyardPoint>) => {
    const dx = candidate.x - position.x
    const dy = candidate.y - position.y
    return dx * dx + dy * dy < radiusSquared
  }
  return enemies.actors.filter((actor) => (
    actor.id !== excludedActorId
    && within(actor.position)
  )).length + enemies.maggots.filter((actor) => (
    actor.id !== excludedActorId
    && within(actor.position)
  )).length
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

export function applyBoneyardSecondaryEnemyKnockbacks(
  world: BoneyardWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  knockbacks: readonly NativeSecondaryKnockbackContact[],
  playerCombat: Readonly<Record<string, BoneyardPlayerCombatStatus>>,
): BoneyardWorldState {
  if (knockbacks.length === 0) return world
  const collision = withBoneyardGateCollision(world.collision, world.gateLeaves)
  let bodies = boneyardCombatBodies(players, world.enemies, playerCombat)
  for (const knockback of knockbacks) {
    const moverId = `enemy-${knockback.targetId}`
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
          world.bounds,
          collision,
          radius,
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
    bodies = new Map(resolved.map((body) => [body.id, body]))
  }
  return {
    ...world,
    enemies: commitBoneyardEnemyCollisionPositions(
      world.enemies,
      new Map([...bodies.values()].map((body) => [body.id, body.position])),
    ),
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
