import {
  resolveActorMotion,
  resolveUnpushedMoverMotion,
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
  nativeTutorialHostileScenePaused,
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
  planPlayerCharacterTick,
  type PlayerCharacterInput,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { PrimarySpellTarget } from '../core-kernels/primary-spell-targeting.ts'
import { nativeBoneyardRadialLightScalar } from '../core-kernels/native-boneyard-lighting.ts'
import type {
  NativeWorldManagerRegistration,
  RegisterNativeWorldPainter,
} from '../core-kernels/native-world-manager-order.ts'
import type {
  NativeSecondarySceneryTarget,
  NativeSecondaryTargetEffectState,
} from '../core-kernels/native-secondary-abilities.ts'
import { RETAIL_BONEYARD_EXPERIENCE_RECIPE_SCALAR } from '../core-kernels/player-progression.ts'
import {
  NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS,
  NATIVE_LOOT_DEFAULT_MODIFIERS,
  type NativeLootModifiers,
} from '../core-kernels/native-loot.ts'
import {
  createBoneyardWaveDirector,
  startBoneyardWaveDirector,
  stepBoneyardSlumpgutTrigger,
  stepBoneyardWaveDirector,
  type BoneyardEnemySpawnIntent,
  type BoneyardWaveDirectorState,
} from '../core-kernels/boneyard-wave-director.ts'
import type { NativeHallOfFameRunState } from '../core-kernels/hall-of-fame-score.ts'
import type {
  HubEconomyState,
  HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
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
  canPlaceBoneyardBody,
  clipBoneyardSegment,
  createBoneyardCollisionWorld,
  firstBoneyardPathBlockProgress,
  resolveNativeBoneyardSpawnPosition,
  resolveBoneyardMovement,
  resolveBoneyardSpawnPosition,
  touchingBoneyardGateLeaves,
  withBoneyardGateCollision,
  type BoneyardCollisionWorld,
} from './boneyard-collision.ts'
import {
  boneyardEnemyActorFlags,
  boneyardEnemyCollisionRadius,
  createBoneyardEnemyStore,
  stepBoneyardEnemyStore,
  type BoneyardEnemyPlayerDamage,
  type BoneyardEnemyReward,
  type BoneyardEnemySemanticEvent,
  type BoneyardEnemyStore,
} from './boneyard-enemy-store.ts'
import {
  boneyardNavigationMeshIsPrepared,
  findBoneyardEnemyRoute,
  NATIVE_BADGUY_NAVIGATION_CLEARANCE,
  NATIVE_DEMON_NAVIGATION_CLEARANCE,
  prepareBoneyardNavigationMesh,
} from './boneyard-enemy-navigation.ts'
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
import {
  prepareSolomonEscapeNavigation,
  resolveSolomonEscapeMovement,
  solomonEscapeTraversalBounds,
  boneyardSpawnLightSources,
  createBoneyardSceneryTargets,
  createNativeLootPlacement,
  nearbyNativeMaskTwoCount,
  applyBoneyardPlayerKnockbacks,
  boneyardCombatBodies,
  boneyardLanternBodies,
  NATIVE_LANTERN_BODY_ID,
  boneyardEnemyBodies,
  commitBoneyardEnemyCollisionPositions,
  enemyCollisionBody,
  retainInsideBounds,
} from './boneyard-world-placement.ts'

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
  lanternLightRegistration: NativeWorldManagerRegistration | null
  lanternPosition: Readonly<BoneyardPoint> | null
  hallOfFameRuns: Readonly<Record<string, NativeHallOfFameRunState>>
  loot: BoneyardLootStore
  lootEvents: readonly BoneyardLootEvent[]
  playerOuchDeadlineTick: number
  runId: string
  scenerySpellTargets: readonly PrimarySpellTarget[]
  solomonPainterRegistration: NativeWorldManagerRegistration | null
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
  lanternLightRegistration: NativeWorldManagerRegistration | null = null,
  solomonPainterRegistration: NativeWorldManagerRegistration | null = null,
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
    ...createBoneyardSceneryTargets(loaded.scene.objects),
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
      loaded.scene.objects.flatMap((object, sceneryRegistrationOrdinal) => (
        object.typeId === 2061 ? [{
          eid: object.eid,
          position: Object.freeze({ ...object.pos }),
          sceneryRegistrationOrdinal,
          subtype: 0,
        }] : []
      )),
    ),
    lootEvents: [],
    playerOuchDeadlineTick: 0,
    runId: loaded.runId,
    solomonPainterRegistration,
    spawn: { ...loaded.scene.spawn },
    tutorial: tutorial
      ? createNativeTutorialState(loaded.scene.spawn, 0, loaded.seed)
      : null,
    tutorialProfileEconomy: null,
    waves: ownsRetailEncounter
      ? createBoneyardWaveDirector(loaded.seed, undefined, {
          sourceSha256: loaded.sourceSha256,
        })
      : null,
  }
}

export interface BoneyardWorldNavigationPreparation {
  readonly bounds: Readonly<BoneyardBounds>
  readonly clearance: number
}

export function boneyardWorldNavigationPreparations(
  world: BoneyardWorldState,
): readonly BoneyardWorldNavigationPreparation[] {
  const hostileBounds = world.arenaTransition?.combatBounds ?? world.bounds
  const preparations: BoneyardWorldNavigationPreparation[] = [
    { bounds: hostileBounds, clearance: NATIVE_BADGUY_NAVIGATION_CLEARANCE },
    { bounds: hostileBounds, clearance: NATIVE_DEMON_NAVIGATION_CLEARANCE },
  ]
  if (world.encounter !== null) {
    preparations.push({
      bounds: solomonEscapeTraversalBounds(world.bounds),
      clearance: NATIVE_SOLOMON_NAVIGATION_CLEARANCE,
    })
  }
  return Object.freeze(preparations)
}

export function boneyardWorldNavigationIsPrepared(world: BoneyardWorldState): boolean {
  return boneyardWorldNavigationPreparations(world).every(({ bounds, clearance }) => (
    boneyardNavigationMeshIsPrepared(bounds, world.collision, clearance)
  ))
}

export function prepareBoneyardWorldNavigation(world: BoneyardWorldState): void {
  for (const { bounds, clearance } of boneyardWorldNavigationPreparations(world)) {
    prepareBoneyardNavigationMesh(bounds, world.collision, clearance)
  }
}

export function boneyardPrimarySpellTargets(
  world: BoneyardWorldState,
): readonly PrimarySpellTarget[] {
  const actors = world.enemies.actors
    .map((enemy) => ({
      active: enemy.lifeState === 'alive',
      actorFlags: boneyardEnemyActorFlags(enemy),
      attachment: { x: 0, y: 0 },
      bodyRadius: boneyardEnemyCollisionRadius(enemy),
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

export function stepBoneyardWorldTick(
  world: BoneyardWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  inputs: Readonly<Record<string, PlayerCharacterInput>>,
  playerCombat: Readonly<Record<string, BoneyardPlayerCombatStatus>>,
  tick: number,
  registerWorldPainter?: RegisterNativeWorldPainter,
  registerProjectileWorldPainter?: RegisterNativeWorldPainter,
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
    && nativeTutorialHostileScenePaused(world.tutorial)
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
      (boneyardEnemyActorFlags(actor) & 0x2) !== 0
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
      ...boneyardLanternBodies(world.lanternPosition),
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
  const lanternPosition = resolvedPositions.get(NATIVE_LANTERN_BODY_ID) ?? world.lanternPosition

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
  )
  const lootStep = stepBoneyardLootStore(world.loot, {
    participants: lootParticipants,
    placement: lootPlacement,
    registerWorldPainter,
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
      ...collisionResolvedEnemies.actors
        .filter((actor) => boneyardEnemyActorFlags(actor) !== 0)
        .map((actor) => ({
          position: actor.position,
          radius: boneyardEnemyCollisionRadius(actor),
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
  const dynamicBodies = [...boneyardCombatBodies(
    nextPlayers,
    collisionResolvedEnemies,
    playerCombat,
    lanternPosition,
  ).values()]
  const dynamicBodyIndices = new Map(dynamicBodies.map((body, index) => [body.id, index]))
  const enemyPhysicsWorld = {
    canPlace: (_bodyId: string, candidate: BoneyardPoint, candidateRadius: number) => (
      canPlaceBoneyardBody(candidate, activeBounds, collision, candidateRadius)
    ),
    move: (
      _bodyId: string,
      current: BoneyardPoint,
      movement: BoneyardPoint,
      movementRadius: number,
    ) => resolveBoneyardMovement(
      current,
      { x: current.x + movement.x, y: current.y + movement.y },
      activeBounds,
      collision,
      movementRadius,
    ),
  }
  const spawnLightSources = boneyardSpawnLightSources(
    { ...world, lanternPosition },
    nextPlayers,
    collisionResolvedEnemies,
  )
  const spawnPolicyFocuses = Object.values(livingPlayers)
    .map(({ position }) => position)
    .filter((position) => (
      position.x >= spawnBounds.x
      && position.y >= spawnBounds.y
      && position.x <= spawnBounds.x + spawnBounds.w
      && position.y <= spawnBounds.y + spawnBounds.h
    ))
  if (spawnPolicyFocuses.length === 0) {
    spawnPolicyFocuses.push({
      x: spawnBounds.x + spawnBounds.w / 2,
      y: spawnBounds.y + spawnBounds.h / 2,
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
      let moverIndex = dynamicBodyIndices.get(moverId)
      if (moverIndex === undefined) {
        moverIndex = dynamicBodies.length
        dynamicBodies.push(enemyCollisionBody(moverId, position, radius))
        dynamicBodyIndices.set(moverId, moverIndex)
      }
      // Enemy bodies never push, so the shared solver reduces to one swept root
      // move plus ascending pair separation. The kernel fast path keeps that
      // arithmetic while skipping the per-move crowd clone.
      const mover = dynamicBodies[moverIndex]!
      mover.position = resolveUnpushedMoverMotion(
        dynamicBodies,
        moverIndex,
        delta,
        enemyPhysicsWorld,
      )
      return mover.position
    },
    resolveSpawnPlacement: ({
      actorId: _actorId,
      navigationClearance,
      position,
      positionPolicy,
      radius,
      reachabilityRadius,
      rngState,
    }) => (
      resolveNativeBoneyardSpawnPosition(
        { ...position },
        spawnBounds,
        collision,
        radius,
        positionPolicy ?? 'direct',
        rngState,
        {
          acceptsDomain: (candidate, candidateRadius) => (
            (tutorialSpawnDomain === null
              || tutorialSpawnDomain(candidate, candidateRadius))
            && spawnPolicyFocuses.some((focus) => (
              findBoneyardEnemyRoute({
                bodyRadius: reachabilityRadius,
                bounds: spawnBounds,
                clearance: navigationClearance,
                end: focus,
                start: candidate,
                world: collision,
              }) !== null
            ))
          ),
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
    resolveSpawnIntents: (liveEnemyCount, liveZombieCount, liveBossCount) => {
      const external = pendingExternalSpawnIntents
      pendingExternalSpawnIntents = []
      if (
        waves === null
        || encounter === null
        || hostileScenePaused
      ) return external
      const context = {
        bounds: spawnBounds,
        liveEnemyCount,
        liveBossCount,
        liveZombieCount,
        players: livingPlayers,
        tick,
      }
      const result = wavesStarted
        ? stepBoneyardSlumpgutTrigger(waves, context)
        : stepBoneyardWaveDirector(waves, context)
      waves = result.director
      return [...external, ...result.spawnIntents]
    },
    registerWorldPainter,
    registerProjectileWorldPainter,
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
  const badguyCountBeforeDeaths = collisionResolvedEnemies.actors.length
  for (const [rewardIndex, reward] of enemyStep.rewards.entries()) {
    const rewardCombat = reward.playerId === null
      ? undefined
      : playerCombat[reward.playerId]
    const materialized = materializeBoneyardEnemyLoot(loot, {
      actorSeed: reward.lootSource.actorSeed,
      advancedUnlocks: rewardCombat?.advancedUnlocks ?? new Array<boolean>(8).fill(false),
      arena: {
        disableMask: 0,
        itemLevelMaximum: 100,
        itemLevelMinimum: 0,
        level: waves?.waveOrdinal ?? tutorial?.waveOrdinal ?? 0,
        mode: 0,
        specialSuppression: false,
      },
      inventoryHasHealthPotion: rewardCombat?.inventoryHasHealthPotion ?? false,
      modifiers: rewardCombat?.lootModifiers ?? NATIVE_LOOT_DEFAULT_MODIFIERS,
      nearbyMaskTwoCount: nearbyNativeMaskTwoCount(
        collisionResolvedEnemies,
        reward.actorId,
        reward.lootSource.position,
      ),
      onDeathProgram: reward.lootSource.onDeathProgram,
      ownedRecipeIndexes: rewardCombat?.ownedRecipeIndexes ?? [],
      participantLevel: rewardCombat?.level ?? 1,
      participantSlot: reward.lootSource.participantSlot,
      placement: createNativeLootPlacement(
        activeBounds,
        collision,
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
    }, registerWorldPainter)
    loot = materialized.store
    if (reward.lootSource.recipeUid === 10051 && tutorial?.itemDropArmed) {
      loot = spawnBoneyardCustomLootItems(
        loot,
        [nativeTutorialAmuletItem()],
        reward.lootSource.position,
        tick,
        registerWorldPainter,
      ).store
      tutorial = { ...tutorial, itemDropArmed: false }
    } else if (reward.lootSource.recipeUid === 10065 && tutorial !== null) {
      loot = spawnBoneyardCustomLootItems(
        loot,
        [nativeTutorialHealthPotionItem()],
        reward.lootSource.position,
        tick,
        registerWorldPainter,
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
        registerWorldPainter,
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
    lanternPosition,
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
    : retainInsideBounds(world.earthquakeSceneryTargets, cleanupBounds)
  const primarySceneryTargets = cleanupBounds === null
    ? world.primarySceneryTargets
    : retainInsideBounds(world.primarySceneryTargets, cleanupBounds)
  const scenerySpellTargets = cleanupBounds === null
    ? world.scenerySpellTargets
    : retainInsideBounds(world.scenerySpellTargets, cleanupBounds)
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
      lanternPosition: knockback.lanternPosition,
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
