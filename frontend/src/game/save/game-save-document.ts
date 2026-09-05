import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { DEFAULT_BONEYARD_ENEMY_LOOT_POLICIES } from '../core-kernels/boneyard-enemy-config.ts'
import {
  assertNativeDemonArticulationState,
  createNativeDemonArticulationState,
  type NativeDemonArticulationState,
} from '../core-kernels/boneyard-demon-articulation.ts'
import {
  createPlayerCharacter,
  createIdlePlayerPrimaryCast,
  type PlayerCharacterConfig,
  type PlayerPrimaryCastState,
} from '../core-kernels/player-character.ts'
import {
  archiveCompletedRunEconomy,
  createNativeUnforgeBonuses,
  hubEconomyInventoryIsValid,
  nativeHagathaBundleStateIsValid,
  normalizeHubEconomyInventorySlots,
  nativeHagathaOutcomeStateIsValid,
  type HubEconomyState,
} from '../core-kernels/hub-economy.ts'
import {
  applyNativeHagathaPurchaseRuntime,
  createNativeHagathaRuntimeState,
  removeNativeHagathaRuntime,
  type NativeHagathaRuntimeState,
} from '../core-kernels/native-hagatha-effects.ts'
import {
  createNativeRng,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import { createNativeWraithFlightState } from '../core-kernels/native-wraith-flight.ts'
import {
  nextBoneyardWaveRandom,
  randomBoneyardWaveInteger,
} from '../core-kernels/boneyard-wave-timeline.ts'
import {
  createNativeWorldManagerOrder,
  type NativeWorldManagerOrderState,
} from '../core-kernels/native-world-manager-order.ts'
import {
  NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS,
  NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  STOCK_TUTORIAL_BONEYARD_ID,
} from '../core-kernels/native-tutorial.ts'
import {
  buildPlayerSkillOffer,
  nativeWeldBuild,
  nativeWeldComponentRanksForBuild,
  isNativeBeltSkill,
  type PlayerSkillBookComponent,
  type PlayerStatBookComponent,
} from '../core-kernels/player-progression.ts'
import {
  freezeNativeBelt,
  migrateSkillQuickbarToNativeBelt,
  nativeBeltOwnedItem,
  nativeInventoryItemCanBindToBelt,
  type NativeBeltEntry,
  type NativeBeltItemTypeId,
  type PlayerBeltComponent,
} from '../core-kernels/native-belt.ts'
import {
  createPlayerSkillRuntime,
  playerSkillDerivedStats,
  refreshPlayerCombatFromSkillStats,
  refreshPlayerSkillRuntime,
  type PlayerSkillRuntimeComponent,
} from '../core-kernels/player-skill-runtime.ts'
import { createNativeHallOfFameRun } from '../core-kernels/hall-of-fame-score.ts'
import { earthImpactFragmentCount } from '../core-kernels/primary-spell-earth.ts'
import { NATIVE_ETHER_BLAST_PARTICLE_COUNT } from '../core-kernels/native-ether-blast.ts'
import {
  nativeSecondaryPainterManagerLane,
  type NativeSecondaryActorKind,
} from '../core-kernels/native-secondary-abilities.ts'
import {
  createHubCollegeIntroParticipantState,
  isHubRegionId,
  isHubTransitionEdge,
  type HubParticipantState,
  type HubParticipantTransition,
  type HubRegionId,
  type HubTransitionPhase,
} from '../core-kernels/hub-regions.ts'
import { NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS } from '../hub-painter-order.ts'
import {
  NATIVE_HUB_HELP_ROW_COUNT,
  NATIVE_HUB_NPC_CATALOG,
  createNativeHubNpcState,
  nativeBoastDefinition,
  type NativeHubNpcState,
} from '../core-kernels/native-hub-npc.ts'
import type { BoastSelection, ModBoastSelection } from '../core-kernels/boast.ts'
import type { GameContentIdentity, LuaConsoleValue } from '../protocol/game-protocol.ts'
import {
  gameSimulationDurableProfileEconomy,
  gameSimulationRetiredWizardEconomy,
  removePlayerCharacter,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import {
  autofillPlayerEntitySkillSelections,
  migratePlayerStarterEquipmentAppearance,
  replacePlayerCharacter,
  replacePlayerEconomy,
} from '../core-server/player-entity-store.ts'
import type { HubStudentPopulationOptions } from '../core-server/hub-students.ts'
import type { HubSkorchaState } from '../core-server/hub-skorcha.ts'
import { createHubWorld, type HubWorldState } from '../core-server/hub-world.ts'
import { createBoneyardWorld, type BoneyardWorldState } from '../core-server/boneyard-world.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import {
  MAX_WEB_GAME_SAVE_JSON_DEPTH,
  MAX_WEB_GAME_SAVE_JSON_NODES,
  WEB_GAME_SAVE_SCHEMA_VERSION,
  gameSaveDocumentFitsByteLimit,
  type GameSaveIntegrity,
  type ParsedGameSaveContinuation,
  onlyKeys,
  parseGameSaveDocument,
  record,
} from './game-save-contract.ts'
import type { NativeGameSaveSource } from './portable-game-profile.ts'

export interface CreateGameSaveDocumentOptions {
  readonly integrity: GameSaveIntegrity
  readonly loadedBoneyard: LoadedBoneyard | null
  readonly mods: readonly GameContentIdentity[]
  readonly modState: Readonly<Record<string, Readonly<Record<string, LuaConsoleValue>>>>
  readonly nativeSource?: NativeGameSaveSource | null
  readonly partyRejoinToken?: string | null
  readonly playerId: string
  readonly state: GameSimulationState
}

export interface CreateGameProfileSaveDocumentOptions {
  readonly integrity: GameSaveIntegrity
  readonly mods: readonly GameContentIdentity[]
  readonly modState: Readonly<Record<string, Readonly<Record<string, LuaConsoleValue>>>>
  readonly nativeSource?: NativeGameSaveSource | null
  readonly playerId: string
  readonly state: GameSimulationState
}

export interface RestoredGameSaveProfile {
  readonly continuation: ParsedGameSaveContinuation | null
  readonly economy: HubEconomyState
  readonly hagathaRuntime: NativeHagathaRuntimeState
  readonly integrity: GameSaveIntegrity
  readonly mods: readonly GameContentIdentity[]
  readonly modState: Readonly<Record<string, Readonly<Record<string, LuaConsoleValue>>>>
  readonly nativeSource: NativeGameSaveSource | null
}

export interface RestoredGameSaveDocument {
  readonly integrity: GameSaveIntegrity
  readonly loadedBoneyard: LoadedBoneyard | null
  readonly mods: readonly GameContentIdentity[]
  readonly modState: Readonly<Record<string, Readonly<Record<string, LuaConsoleValue>>>>
  readonly nativeSource: NativeGameSaveSource | null
  readonly playerId: string
  readonly state: GameSimulationState
}

const SIMULATION_KEYS = [
  'accumulatorSeconds',
  'combatRng',
  'gameRng',
  'hallOfFameClockStartedAtTick',
  'levelUpBarrier',
  'worldManagerOrder',
  'modEffects',
  'nextLevelUpBarrierId',
  'nextModConsumableUseId',
  'playerEntities',
  'primarySpells',
  'run',
  'secondaryAbilities',
  'tick',
  'world',
] as const
const PLAYER_STORE_KEYS = [
  'belts',
  'configs',
  'economies',
  'entityIds',
  'identities',
  'lightings',
  'locomotions',
  'nextEntityId',
  'primaryCasts',
  'progressions',
  'skillBooks',
  'skillRuntimes',
  'statBooks',
] as const
const LEGACY_PLAYER_STORE_KEYS = [
  'configs',
  'economies',
  'entityIds',
  'identities',
  'lightings',
  'locomotions',
  'nextEntityId',
  'primaryCasts',
  'progressions',
  'skillBooks',
  'skillRuntimes',
  'statBooks',
] as const
const ECONOMY_KEYS = [
  'actionFeedback',
  'backpack',
  'charmCapacity',
  'collegeIntroPending',
  'dowsingFee',
  'dowsingOffers',
  'equipment',
  'firstMixedSelectors',
  'fomentiusStock',
  'gold',
  'hagathaBundleSelectors',
  'nextItemId',
  'nextOfferId',
  'npc',
  'ownedPerkSelectors',
  'revision',
  'rng',
  'storage',
  'tonicPurchases',
  'tutorialPending',
  'unforgeBonuses',
] as const
const HUB_WORLD_KEYS = [
  'ambient',
  'collisionRngState',
  'kind',
  'participants',
  'skorcha',
  'studentPopulation',
  'traderAnimationSeed',
] as const
const HUB_STUDENT_POPULATION_KEYS = [
  'nextId',
  'rarePathDenominator',
  'rngState',
  'routeEndBehavior',
  'spawningEnabled',
  'spawnRequestPending',
  'spawnTickerCounter',
  'students',
] as const

export function createGameSaveDocument(
  options: CreateGameSaveDocumentOptions,
): string {
  const { ownerIndex, ownerState } = ownerProjection(options.state, options.playerId)
  if (ownerState.run.phase === 'game-over' || ownerState.run.phase === 'loadout') {
    throw new Error(`game save cannot checkpoint ${ownerState.run.phase}`)
  }
  assertLoadedBoneyardOwnership(ownerState, options.loadedBoneyard)
  const partyRejoinToken = options.partyRejoinToken ?? null
  if (
    partyRejoinToken !== null
    && (
      partyRejoinToken.length > 8_192
      || !/^sdrpr2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(partyRejoinToken)
      || ownerState.world.kind !== 'boneyard'
      || ownerState.run.phase !== 'active'
    )
  ) throw new Error('game save party rejoin token requires an active Boneyard')
  const character = ownerState.playerEntities.configs[ownerIndex]!
  const playerEntities = diskPlayerStoreProjection(ownerState.playerEntities)
  const simulation = {
    ...ownerState,
    accumulatorSeconds: 0,
    modEffects: [],
    nextModConsumableUseId: 1,
    playerEntities,
    secondaryAbilities: diskSecondaryProjection(ownerState.secondaryAbilities),
    world: ownerState.world.kind === 'hub'
      ? serializeHubWorld(ownerState.world)
      : ownerState.world,
  }
  return encodeDocument({
    continuation: {
      loadedBoneyard: options.loadedBoneyard,
      simulation,
      summary: {
        activeRun: ownerState.world.kind === 'boneyard' && ownerState.run.phase === 'active',
        character,
        partyRejoinToken,
        phase: ownerState.run.phase,
        playerId: options.playerId,
        savedAtTick: ownerState.tick,
        worldKind: ownerState.world.kind,
      },
    },
    integrity: options.integrity,
    mods: options.mods,
    modState: options.modState,
    nativeSource: options.nativeSource ?? null,
    profile: {
      economy: normalizeHubEconomyInventorySlots(
        gameSimulationRetiredWizardEconomy(ownerState, options.playerId),
      ),
      hagathaRuntime: ownerState.playerEntities.progressions[ownerIndex]!.hagathaRuntime,
    },
  })
}

export function createGameSaveSupportDocument(document: string): string {
  const restored = restoreGameSaveDocument(document)
  return createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: restored.loadedBoneyard,
    mods: restored.mods,
    modState: restored.modState,
    nativeSource: null,
    partyRejoinToken: null,
    playerId: restored.playerId,
    state: restored.state,
  })
}

export function createGameProfileSaveDocument(
  options: CreateGameProfileSaveDocumentOptions,
): string {
  const { ownerIndex, ownerState } = ownerProjection(options.state, options.playerId)
  return encodeDocument({
    continuation: null,
    integrity: options.integrity,
    mods: options.mods,
    modState: options.modState,
    nativeSource: options.nativeSource ?? null,
    profile: {
      economy: gameSimulationDurableProfileEconomy(ownerState, options.playerId),
      hagathaRuntime: ownerState.playerEntities.progressions[ownerIndex]!.hagathaRuntime,
    },
  })
}

export function retireGameSaveWizard(document: string): string {
  const restored = restoreGameSaveDocument(document)
  const ownerIndex = restored.state.playerEntities.identities.findIndex(
    identity => identity.playerId === restored.playerId,
  )
  if (ownerIndex < 0) throw new Error('game save profile owner is absent')
  const retiredEconomy = gameSimulationRetiredWizardEconomy(
    restored.state,
    restored.playerId,
  )
  return encodeDocument({
    continuation: null,
    integrity: restored.integrity,
    mods: restored.mods,
    modState: restored.modState,
    nativeSource: restored.nativeSource,
    profile: {
      economy: restored.state.world.kind === 'boneyard'
        && restored.state.world.tutorial !== null
        ? { ...retiredEconomy, tutorialPending: false }
        : retiredEconomy,
      hagathaRuntime: restored.state.playerEntities.progressions[ownerIndex]!.hagathaRuntime,
    },
  })
}

function encodeDocument(document: Omit<Record<string, unknown>, 'schemaVersion'>): string {
  const encoded = JSON.stringify({ ...document, schemaVersion: WEB_GAME_SAVE_SCHEMA_VERSION })
  if (!gameSaveDocumentFitsByteLimit(encoded)) {
    throw new Error('game save exceeds its size limit')
  }
  return encoded
}

function assertLoadedBoneyardOwnership(
  state: GameSimulationState,
  loadedBoneyard: LoadedBoneyard | null,
): void {
  if (state.world.kind === 'hub') {
    if (loadedBoneyard !== null) throw new Error('Hub game save carries a Boneyard')
    return
  }
  if (loadedBoneyard === null) {
    throw new Error('Boneyard game save is missing its loaded content')
  }
  if (
    state.run.phase !== 'active'
    || state.run.runId !== loadedBoneyard.runId
    || state.world.runId !== loadedBoneyard.runId
  ) throw new Error('Boneyard run ownership is inconsistent')
}

function isCompletedTutorialHubAttachment(
  value: unknown,
  playerEntities: GameSimulationState['playerEntities'],
  playerId: string,
  runPhase: unknown,
): boolean {
  if (runPhase !== 'hub') return false
  const ownerIndex = playerEntities.identities.findIndex(identity => (
    identity.playerId === playerId
  ))
  if (ownerIndex < 0 || playerEntities.economies[ownerIndex]?.tutorialPending !== false) {
    return false
  }
  try {
    const loadedBoneyard = parseLoadedBoneyard(value)
    return loadedBoneyard.choice.id === STOCK_TUTORIAL_BONEYARD_ID
      && loadedBoneyard.choice.name === 'Tutorial'
      && loadedBoneyard.choice.source === 'default'
      && loadedBoneyard.scene.name === 'Tutorial'
  } catch {
    return false
  }
}

function ownerProjection(
  state: GameSimulationState,
  playerId: string,
): { readonly ownerIndex: number; readonly ownerState: GameSimulationState } {
  let ownerState = state
  for (const identity of state.playerEntities.identities) {
    if (identity.playerId !== playerId) {
      ownerState = removePlayerCharacter(ownerState, identity.playerId)
    }
  }
  const ownerIndex = ownerState.playerEntities.identities.findIndex(
    identity => identity.playerId === playerId,
  )
  if (ownerIndex < 0 || ownerState.playerEntities.identities.length !== 1) {
    throw new Error('game save owner is absent from authoritative state')
  }
  if (!hubEconomyInventoryIsValid(ownerState.playerEntities.economies[ownerIndex]!)) {
    throw new Error('game save owner inventory is invalid')
  }
  return { ownerIndex, ownerState }
}

function diskPlayerStoreProjection(
  source: GameSimulationState['playerEntities'],
): GameSimulationState['playerEntities'] {
  const economies = source.economies.map(normalizeHubEconomyInventorySlots)
  const progressions = source.progressions.map(progression => Object.freeze({
    ...progression,
    damageX4TicksRemaining: 0,
    mindChugTicksRemaining: 0,
  }))
  const skillBooks: PlayerSkillBookComponent[] = []
  const skillRuntimes: PlayerSkillRuntimeComponent[] = []
  for (let index = 0; index < source.skillBooks.length; index += 1) {
    const refreshed = refreshPlayerSkillRuntime(
      {
        ...source.skillRuntimes[index]!,
        meditationActivityRampTicks: 0,
        meditationIdleElapsedTicks: 0,
        mindstarActive: false,
      },
      source.skillBooks[index]!,
      source.statBooks[index]!,
      economies[index]!,
    )
    skillBooks.push(refreshed.skillBook)
    skillRuntimes.push(refreshed.runtime)
  }
  return {
    ...source,
    economies: Object.freeze(economies),
    progressions: Object.freeze(progressions),
    skillBooks: Object.freeze(skillBooks),
    skillRuntimes: Object.freeze(skillRuntimes),
  }
}

function diskSecondaryProjection(
  source: GameSimulationState['secondaryAbilities'],
): GameSimulationState['secondaryAbilities'] {
  return {
    ...source,
    players: Object.freeze(Object.fromEntries(
      Object.entries(source.players).map(([playerId, player]) => [playerId, Object.freeze({
        ...player,
        castSpinTicksRemaining: 0,
        heldSlot: null,
        lastSkillId: null,
        mindstar: false,
        planeOrbHeld: false,
        regenerate: false,
        reservedMana: player.firewalker ? 50 : 0,
        staffCastTicksRemaining: 0,
      })]),
    )),
  }
}

function restorePendingLevelUpOffers(
  source: GameSimulationState,
  sourceSchemaVersion: number,
): GameSimulationState {
  const barrier = source.levelUpBarrier
  if (barrier === null) return source
  const progressions = [...source.playerEntities.progressions]
  let gameRng = source.gameRng
  let changed = false
  for (const playerId of barrier.pendingPlayerIds) {
    const index = source.playerEntities.identities.findIndex(
      identity => identity.playerId === playerId,
    )
    const progression = progressions[index]
    const skillBook = source.playerEntities.skillBooks[index]
    if (index < 0 || progression === undefined || skillBook === undefined) {
      throw new Error('game save level-up barrier pending player is absent')
    }
    if (progression.pendingOffer !== null) continue
    if (
      sourceSchemaVersion >= 28
      || progression.pendingLevels.length === 0
    ) {
      throw new Error('game save level-up barrier pending player has no skill offer')
    }
    const rebuilt = buildPlayerSkillOffer(
      progression,
      skillBook,
      progression.revision,
      gameRng,
    )
    progressions[index] = Object.freeze({
      ...progression,
      pendingOffer: rebuilt.offer,
    })
    gameRng = rebuilt.rng
    changed = true
  }
  return changed
    ? {
        ...source,
        gameRng,
        playerEntities: {
          ...source.playerEntities,
          progressions: Object.freeze(progressions),
        },
      }
    : source
}

export function restoreGameSaveDocument(document: string): RestoredGameSaveDocument {
  const parsed = parseGameSaveDocument(document)
  assertBoundedJsonTree(JSON.parse(document))
  const continuation = parsed.continuation
  if (continuation === null) throw new Error('game save has no resumable continuation')
  const rawState = normalizeSimulation(
    continuation.simulation,
    continuation.loadedBoneyard,
    continuation.summary.playerId,
    parsed.sourceSchemaVersion,
  )
  const modIds = new Set(parsed.mods.map(mod => mod.id.toLowerCase()))
  if (Object.keys(parsed.modState).some(modId => !modIds.has(modId.toLowerCase()))) {
    throw new Error('game save state belongs to an inactive mod')
  }
  onlyKeys(rawState, 'game save simulation', SIMULATION_KEYS)
  let playerEntities = validatePlayerStore(rawState.playerEntities, continuation.summary.playerId)
  for (const { playerId } of playerEntities.identities) {
    playerEntities = migratePlayerStarterEquipmentAppearance(playerEntities, playerId)
  }
  const rawRun = record(rawState.run, 'game save run')
  if (rawRun.phase !== continuation.summary.phase) throw new Error('game save phase summary drifted')
  if (!Number.isSafeInteger(rawState.tick) || Number(rawState.tick) < 0) {
    throw new Error('game save simulation tick is invalid')
  }
  if (
    !Number.isSafeInteger(rawState.hallOfFameClockStartedAtTick)
    || Number(rawState.hallOfFameClockStartedAtTick) < 0
    || Number(rawState.hallOfFameClockStartedAtTick) > Number(rawState.tick)
  ) throw new Error('game save Hall clock is invalid')
  if (rawState.tick !== continuation.summary.savedAtTick) {
    throw new Error('game save tick summary drifted')
  }
  if (!Array.isArray(rawState.modEffects) || rawState.modEffects.length !== 0) {
    throw new Error('game save may not persist active mod effects')
  }
  if (rawState.nextModConsumableUseId !== 1) {
    throw new Error('game save mod consumable sequence is invalid')
  }
  const rawWorld = record(rawState.world, 'game save world')
  if (rawWorld.kind !== continuation.summary.worldKind) {
    throw new Error('game save world summary drifted')
  }
  const activeRun = rawWorld.kind === 'boneyard' && rawRun.phase === 'active'
  if (continuation.summary.activeRun !== activeRun) {
    throw new Error('game save active run summary drifted')
  }

  let world: GameSimulationState['world']
  let loadedBoneyard: LoadedBoneyard | null
  if (rawWorld.kind === 'hub') {
    if (
      continuation.loadedBoneyard !== null
      && !isCompletedTutorialHubAttachment(
        continuation.loadedBoneyard,
        playerEntities,
        continuation.summary.playerId,
        rawRun.phase,
      )
    ) throw new Error('Hub game save carries a Boneyard')
    onlyKeys(
      rawWorld,
      'game save Hub world',
      parsed.sourceSchemaVersion >= 8
        ? HUB_WORLD_KEYS
        : HUB_WORLD_KEYS.filter(key => key !== 'skorcha'),
    )
    const participants = record(rawWorld.participants, 'game save Hub participants')
    if (
      Object.keys(participants).length !== 1
      || !(continuation.summary.playerId in participants)
    ) throw new Error('game save owner is not the sole Hub participant')
    let participant = parseHubParticipant(
      participants[continuation.summary.playerId],
      parsed.sourceSchemaVersion,
    )
    const legacyCollegeIntro = parsed.sourceSchemaVersion < 15
      && participant.transition?.phase === 'college-intro'
    if (legacyCollegeIntro) participant = createHubCollegeIntroParticipantState()
    parseHubStudentPopulation(rawWorld.studentPopulation)
    if (rawWorld.skorcha !== undefined) parseHubSkorcha(rawWorld.skorcha)
    const hubSeed = drawNativeInteger(
      parseNativeRng(rawState.gameRng, 'game save game RNG'),
      0x40000000,
    )
    rawState.gameRng = hubSeed.state
    const worldManagerOrder = createNativeWorldManagerOrder(
      rawState.worldManagerOrder as NativeWorldManagerOrderState,
    )
    world = createHubWorld([continuation.summary.playerId], {
      registerWorldPainter: worldManagerOrder.register,
      traderAnimationSeed: hubSeed.value,
    })
    rawState.worldManagerOrder = worldManagerOrder.state()
    world = {
      ...world,
      participants: { [continuation.summary.playerId]: participant },
    }
    if (legacyCollegeIntro) {
      const config = playerEntities.configs[0]!
      playerEntities = replacePlayerCharacter(
        playerEntities,
        continuation.summary.playerId,
        createPlayerCharacter(config, { x: 972, y: 1_044 }),
      )
    }
    loadedBoneyard = null
  } else if (rawWorld.kind === 'boneyard') {
    loadedBoneyard = parseLoadedBoneyard(continuation.loadedBoneyard)
    if (
      rawWorld.runId !== loadedBoneyard.runId
      || rawRun.runId !== loadedBoneyard.runId
      || rawRun.phase !== 'active'
    ) throw new Error('game save Boneyard run ownership is inconsistent')
    world = rawWorld as unknown as GameSimulationState['world']
  } else {
    throw new Error('game save world kind is invalid')
  }

  let state = {
    ...rawState,
    accumulatorSeconds: 0,
    playerEntities,
    run: rawRun,
    tick: Number(rawState.tick),
    world,
  } as unknown as GameSimulationState
  let selectionRng = state.gameRng
  for (const { playerId } of state.playerEntities.identities) {
    const autofilled = autofillPlayerEntitySkillSelections(
      state.playerEntities,
      playerId,
      selectionRng,
    )
    state = { ...state, playerEntities: autofilled.store }
    selectionRng = autofilled.rng
  }
  state = {
    ...state,
    gameRng: selectionRng,
  }
  state = restorePendingLevelUpOffers(state, parsed.sourceSchemaVersion)
  const config = state.playerEntities.configs[0]
  if (!sameCharacter(config, continuation.summary.character)) {
    throw new Error('game save owner character summary drifted')
  }
  createGameSnapshot(state, continuation.summary.playerId)
  return {
    integrity: parsed.integrity,
    loadedBoneyard,
    mods: parsed.mods,
    modState: parsed.modState,
    nativeSource: parsed.nativeSource,
    playerId: continuation.summary.playerId,
    state,
  }
}

export function restoreGameSaveProfile(document: string): RestoredGameSaveProfile {
  const parsed = parseGameSaveDocument(document)
  assertBoundedJsonTree(JSON.parse(document))
  let economy = normalizeEconomy(parsed.profile.economy, parsed.sourceSchemaVersion)
  if (parsed.sourceSchemaVersion < 6) {
    economy = archiveCompletedRunEconomy(economy, {
      displayName: parsed.continuation?.summary.character.displayName ?? 'Wizard',
      groundGold: 0,
      groundItems: [],
      starterElement: parsed.continuation?.summary.character.element ?? 'ether',
      transferCarriedItems: false,
    })
  }
  const parsedHagathaRuntime = parsed.profile.hagathaRuntime === undefined
    ? applyNativeHagathaPurchaseRuntime(
        createNativeHagathaRuntimeState(),
        economy.ownedPerkSelectors,
      )
    : parseHagathaRuntime(parsed.profile.hagathaRuntime, 0)
  const hagathaRuntime = normalizeHagathaRuntimeForOwnership(
    parsedHagathaRuntime,
    economy.ownedPerkSelectors,
    parsed.sourceSchemaVersion,
    0,
  )
  return {
    continuation: parsed.continuation,
    economy,
    hagathaRuntime,
    integrity: parsed.integrity,
    mods: parsed.mods,
    modState: parsed.modState,
    nativeSource: parsed.nativeSource,
  }
}

export function hydrateGameSaveProfile(
  state: GameSimulationState,
  playerId: string,
  profile: RestoredGameSaveProfile,
): GameSimulationState {
  let economyStore = replacePlayerEconomy(state.playerEntities, playerId, profile.economy)
  if (economyStore === state.playerEntities) {
    throw new Error('game save profile owner is absent from the fresh game')
  }
  economyStore = migratePlayerStarterEquipmentAppearance(economyStore, playerId)
  const ownerIndex = economyStore.identities.findIndex(identity => identity.playerId === playerId)
  const progressions = [...economyStore.progressions]
  progressions[ownerIndex] = {
    ...progressions[ownerIndex]!,
    hagathaRuntime: profile.hagathaRuntime,
  }
  const playerEntities = { ...economyStore, progressions: Object.freeze(progressions) }
  const hydrated = { ...state, playerEntities }
  createGameSnapshot(hydrated, playerId)
  return hydrated
}

function normalizeSimulation(
  value: unknown,
  loadedBoneyardValue: unknown,
  playerId: string,
  sourceSchemaVersion: number,
): Record<string, unknown> {
  const source = record(value, 'game save simulation')
  rejectUnexpectedKeys(source, 'game save simulation', [
    ...SIMULATION_KEYS,
    ...(sourceSchemaVersion < 21 ? ['lightProviderOrder'] : []),
    'playerOfferRng',
  ])
  const gameRng = source.gameRng ?? source.playerOfferRng
  if (gameRng === undefined) throw new Error('game save simulation is missing its game RNG')
  const normalized = {
    accumulatorSeconds: source.accumulatorSeconds,
    combatRng: source.combatRng ?? createNativeRng(0),
    gameRng,
    hallOfFameClockStartedAtTick: source.hallOfFameClockStartedAtTick ?? 0,
    levelUpBarrier: source.levelUpBarrier,
    worldManagerOrder: source.worldManagerOrder ?? source.lightProviderOrder,
    modEffects: source.modEffects ?? [],
    nextLevelUpBarrierId: source.nextLevelUpBarrierId,
    nextModConsumableUseId: source.nextModConsumableUseId ?? 1,
    playerEntities: normalizePlayerStore(source.playerEntities, sourceSchemaVersion),
    primarySpells: normalizePrimarySpells(source.primarySpells, sourceSchemaVersion),
    run: normalizeRun(source.run),
    secondaryAbilities: normalizeDiskSecondary(source.secondaryAbilities, sourceSchemaVersion),
    tick: source.tick,
    world: normalizeWorld(source.world, loadedBoneyardValue, playerId, sourceSchemaVersion),
  }
  const migrated = sourceSchemaVersion < 21
    ? migrateLegacyWorldPainterState(normalized, loadedBoneyardValue)
    : sourceSchemaVersion === 21
      ? migrateSchema21HubPainterState(normalized)
      : normalized
  return normalizeWorldPainterOwnership(migrated, sourceSchemaVersion < 23)
}

const SCHEMA_21_HUB_FIXED_ACTOR_PAINTER_COUNT = 11

function migrateSchema21HubPainterState(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const world = record(input.world, 'schema 21 game save world')
  if (world.kind !== 'hub') return input
  const fixedOffset = NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS.length
    - SCHEMA_21_HUB_FIXED_ACTOR_PAINTER_COUNT
  const shifted = shiftNativeActorRegistrations(input, fixedOffset) as Record<string, unknown>
  const shiftedPlayers = record(shifted.playerEntities, 'schema 21 Hub players')
  const playerOrdinals = array(shiftedPlayers.lightings, 'schema 21 Hub player lightings')
    .map((value, index) => registrationOrdinal(
      record(value, `schema 21 Hub player lighting ${index}`).lightRegistration,
      `schema 21 Hub player lighting ${index}`,
    ))
  const firstPlayerOrdinal = Math.min(...playerOrdinals)
  const initialPlayerOrdinals: number[] = []
  for (const ordinal of [...playerOrdinals].sort((left, right) => left - right)) {
    if (ordinal !== firstPlayerOrdinal + initialPlayerOrdinals.length) break
    initialPlayerOrdinals.push(ordinal)
  }
  const shiftedWorld = record(shifted.world, 'schema 21 Hub world')
  const population = record(
    shiftedWorld.studentPopulation,
    'schema 21 Hub student population',
  )
  const initialStudentOrdinals = array(population.students, 'schema 21 Hub Students')
    .map((value, index) => registrationOrdinal(
      record(value, `schema 21 Hub Student ${index}`).painterRegistration,
      `schema 21 Hub Student ${index}`,
    ))
    .filter(ordinal => ordinal < firstPlayerOrdinal)
    .sort((left, right) => left - right)
  const remap = new Map<number, number>()
  for (const [index, ordinal] of initialPlayerOrdinals.entries()) {
    remap.set(ordinal, NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS.length + index)
  }
  for (const [index, ordinal] of initialStudentOrdinals.entries()) {
    remap.set(
      ordinal,
      NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS.length + initialPlayerOrdinals.length + index,
    )
  }
  const migrated = remapNativeActorRegistrations(shifted, remap) as Record<string, unknown>
  const order = record(migrated.worldManagerOrder, 'schema 21 Hub world manager order')
  const next = record(
    order.nextRegistrationOrdinal,
    'schema 21 Hub world manager registration ordinals',
  )
  return {
    ...migrated,
    worldManagerOrder: {
      nextRegistrationOrdinal: {
        actor: finiteNumber(next.actor, 'schema 21 Hub actor registration ordinal')
          + fixedOffset,
        transient: next.transient,
      },
    },
  }
}

function registrationOrdinal(value: unknown, field: string): number {
  const registration = record(value, `${field} registration`)
  if (registration.managerLane !== 'actor') {
    throw new Error(`${field} must use the actor manager`)
  }
  return finiteNumber(registration.registrationOrdinal, `${field} registration ordinal`)
}

function migrateLegacyWorldPainterState(
  input: Record<string, unknown>,
  loadedBoneyardValue: unknown,
): Record<string, unknown> {
  const originalWorld = record(input.world, 'legacy game save world')
  const hubActorOffset = originalWorld.kind === 'hub'
    ? NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS.length
    : 0
  const shifted = shiftNativeActorRegistrations(input, hubActorOffset) as Record<string, unknown>
  const order = record(shifted.worldManagerOrder, 'legacy world manager order')
  const next = record(
    order.nextRegistrationOrdinal,
    'legacy world manager registration ordinals',
  )
  const nextOrdinal = {
    actor: finiteNumber(next.actor, 'legacy actor registration ordinal'),
    transient: finiteNumber(next.transient, 'legacy transient registration ordinal'),
  }
  nextOrdinal.actor += hubActorOffset
  const register = (managerLane: 'actor' | 'transient') => ({
    managerLane,
    registrationOrdinal: nextOrdinal[managerLane]++,
  })

  const playerEntities = record(shifted.playerEntities, 'legacy game save players')
  const progressions = array(playerEntities.progressions, 'legacy player progressions')
  const lightings = array(playerEntities.lightings, 'legacy player lightings').map(
    (value, index) => {
      const lighting = record(value, `legacy player lighting ${index}`)
      return {
        ...lighting,
        deathWeaponPainterRegistration:
          record(progressions[index], `legacy player progression ${index}`).lifeState === 'dying'
            ? register('actor')
            : null,
      }
    },
  )

  const primarySpells = record(shifted.primarySpells, 'legacy primary spells')
  const projectiles = array(primarySpells.projectiles, 'legacy primary projectiles').map(
    (value) => withLegacyPainterRegistrations(record(value, 'legacy primary projectile'), {
      count: 1,
      managerLane: 'actor',
    }, register),
  )
  const transients = array(primarySpells.transients, 'legacy primary transients').map(
    (value) => {
      const transient = record(value, 'legacy primary transient')
      return withLegacyPainterRegistrations(
        transient,
        legacyPrimaryPainterContract(transient),
        register,
      )
    },
  )

  const secondaryAbilities = record(
    shifted.secondaryAbilities,
    'legacy secondary abilities',
  )
  const secondaryActors = array(
    secondaryAbilities.actors,
    'legacy secondary actors',
  ).map((value) => {
    const actor = record(value, 'legacy secondary actor')
    return actor.painterRegistrations === undefined
      ? {
          ...actor,
          painterRegistrations: [register(nativeSecondaryPainterManagerLane(
            actor.kind as NativeSecondaryActorKind,
          ))],
        }
      : actor
  })

  const world = record(shifted.world, 'legacy game save world')
  const normalizedWorld = world.kind === 'hub'
    ? migrateLegacyHubPainterState(world, register)
    : migrateLegacyBoneyardPainterState(world, loadedBoneyardValue, register)
  return {
    ...shifted,
    playerEntities: { ...playerEntities, lightings },
    primarySpells: { ...primarySpells, projectiles, transients },
    secondaryAbilities: { ...secondaryAbilities, actors: secondaryActors },
    world: normalizedWorld,
    worldManagerOrder: {
      nextRegistrationOrdinal: nextOrdinal,
    },
  }
}

function withLegacyPainterRegistrations(
  source: Record<string, unknown>,
  contract: Readonly<{ count: number; managerLane: 'actor' | 'transient' }>,
  register: (lane: 'actor' | 'transient') => Readonly<{
    managerLane: 'actor' | 'transient'
    registrationOrdinal: number
  }>,
): Record<string, unknown> {
  if (source.painterRegistrations !== undefined) return source
  const light = source.lightRegistration
  const registrations = contract.count === 1
    && isManagerRegistration(light, contract.managerLane)
    ? [light]
    : Array.from({ length: contract.count }, () => register(contract.managerLane))
  return { ...source, painterRegistrations: registrations }
}

function normalizeWorldPainterOwnership(
  input: Record<string, unknown>,
  migrateMissing: boolean,
): Record<string, unknown> {
  const order = record(input.worldManagerOrder, 'game save world manager order')
  const next = record(
    order.nextRegistrationOrdinal,
    'game save world manager registration ordinals',
  )
  const nextRegistrationOrdinal = {
    actor: finiteNumber(next.actor, 'game save actor registration ordinal'),
    transient: finiteNumber(next.transient, 'game save transient registration ordinal'),
  }
  const register = (managerLane: 'actor' | 'transient') => ({
    managerLane,
    registrationOrdinal: nextRegistrationOrdinal[managerLane]++,
  })

  const primarySpells = record(input.primarySpells, 'game save primary spells')
  const projectiles = array(primarySpells.projectiles, 'game save primary projectiles').map(
    (value, index) => normalizePrimaryPainterOwnership(
      record(value, `game save primary projectile ${index}`),
      { count: 1, managerLane: 'actor' },
      register,
      migrateMissing,
      `game save primary projectile ${index}`,
    ),
  )
  const transients = array(primarySpells.transients, 'game save primary transients').map(
    (value, index) => {
      const transient = record(value, `game save primary transient ${index}`)
      return normalizePrimaryPainterOwnership(
        transient,
        legacyPrimaryPainterContract(transient),
        register,
        migrateMissing,
        `game save primary transient ${index}`,
      )
    },
  )

  const world = record(input.world, 'game save world')
  const normalizedWorld = world.kind === 'boneyard'
    ? normalizeBoneyardDeathEffectOwnership(world, register, migrateMissing)
    : world
  return {
    ...input,
    primarySpells: { ...primarySpells, projectiles, transients },
    world: normalizedWorld,
    worldManagerOrder: { nextRegistrationOrdinal },
  }
}

function normalizePrimaryPainterOwnership(
  source: Record<string, unknown>,
  contract: Readonly<{ count: number; managerLane: 'actor' | 'transient' }>,
  register: (lane: 'actor' | 'transient') => Readonly<{
    managerLane: 'actor' | 'transient'
    registrationOrdinal: number
  }>,
  migrateMissing: boolean,
  field: string,
): Record<string, unknown> {
  const existing = source.painterRegistrations
  if (existing !== undefined) {
    if (
      !Array.isArray(existing)
      || existing.length !== contract.count
      || existing.some(registration => (
        !isManagerRegistration(registration, contract.managerLane)
      ))
    ) throw new Error(`${field} painter registrations are invalid`)
    return source
  }
  if (!migrateMissing) throw new Error(`${field} painter registrations are missing`)
  const light = source.lightRegistration
  const painterRegistrations = contract.count === 1
    && isManagerRegistration(light, contract.managerLane)
    ? [light]
    : Array.from({ length: contract.count }, () => register(contract.managerLane))
  return { ...source, painterRegistrations }
}

function normalizeBoneyardDeathEffectOwnership(
  source: Record<string, unknown>,
  register: (lane: 'actor' | 'transient') => Readonly<{
    managerLane: 'actor' | 'transient'
    registrationOrdinal: number
  }>,
  migrateMissing: boolean,
): Record<string, unknown> {
  const enemies = record(source.enemies, 'game save Boneyard enemies')
  const deathEffects = array(enemies.deathEffects, 'game save enemy death effects').map(
    (value, index) => normalizeDeathEffectOwnership(
      record(value, `game save enemy death effect ${index}`),
      register,
      migrateMissing,
      `game save enemy death effect ${index}`,
    ),
  )
  const loot = record(source.loot, 'game save Boneyard loot')
  const lootEffects = array(loot.effects, 'game save loot effects').map(
    (value, index) => normalizeDeathEffectOwnership(
      record(value, `game save loot effect ${index}`),
      register,
      migrateMissing,
      `game save loot effect ${index}`,
    ),
  )
  return {
    ...source,
    enemies: { ...enemies, deathEffects },
    loot: { ...loot, effects: lootEffects },
  }
}

function normalizeDeathEffectOwnership(
  source: Record<string, unknown>,
  register: (lane: 'actor' | 'transient') => Readonly<{
    managerLane: 'actor' | 'transient'
    registrationOrdinal: number
  }>,
  migrateMissing: boolean,
  field: string,
): Record<string, unknown> {
  const expectedOwner = nativeDeathEffectPresentationOwner(source)
  const presentationOwner = source.presentationOwner === undefined && migrateMissing
    ? expectedOwner
    : source.presentationOwner
  if (presentationOwner !== expectedOwner) {
    throw new Error(`${field} presentation owner is invalid`)
  }
  if (presentationOwner === 'world-sorted') {
    const painterRegistration = source.painterRegistration
    if (isManagerRegistration(painterRegistration, 'actor')) {
      return { ...source, presentationOwner }
    }
    if (!migrateMissing) throw new Error(`${field} painter registration is invalid`)
    return {
      ...source,
      painterRegistration: register('actor'),
      presentationOwner,
    }
  }
  if (source.painterRegistration !== null && !migrateMissing) {
    throw new Error(`${field} direct presentation must not retain a painter registration`)
  }
  return { ...source, painterRegistration: null, presentationOwner }
}

function nativeDeathEffectPresentationOwner(
  source: Record<string, unknown>,
): 'direct-post-world' | 'pre-world-queue' | 'world-sorted' {
  const kind = String(source.kind)
  const role = String(source.role)
  if (kind === 'unbind' || role.startsWith('demon-death-fire-burst-')) {
    return 'direct-post-world'
  }
  if (kind === 'fire-array' || kind === 'late-splat' || kind === 'sprite-array') {
    return 'pre-world-queue'
  }
  return 'world-sorted'
}

function legacyPrimaryPainterContract(
  source: Record<string, unknown>,
): Readonly<{ count: number; managerLane: 'actor' | 'transient' }> {
  switch (source.kind) {
    case 'air': return { count: 3, managerLane: 'actor' }
    case 'earth-impact': return {
      count: earthImpactFragmentCount(finiteNumber(source.charge, 'legacy Earth impact charge')),
      managerLane: 'actor',
    }
    case 'ether-blast': return {
      count: NATIVE_ETHER_BLAST_PARTICLE_COUNT,
      managerLane: 'transient',
    }
    case 'ether-impact':
    case 'ether-pierce-streak':
    case 'fire-explosion':
    case 'fire-impact':
    case 'water':
      return { count: 1, managerLane: 'transient' }
    case 'player-staff-contact':
    case 'player-staff-contact-knockback':
    case 'player-staff-knockback':
    case 'player-staff-melee':
    case 'player-staff-spin':
      return { count: 0, managerLane: 'actor' }
    default:
      return { count: 1, managerLane: 'actor' }
  }
}

function migrateLegacyHubPainterState(
  source: Record<string, unknown>,
  register: (lane: 'actor' | 'transient') => Readonly<{
    managerLane: 'actor' | 'transient'
    registrationOrdinal: number
  }>,
): Record<string, unknown> {
  const studentPopulation = record(
    source.studentPopulation,
    'legacy Hub student population',
  )
  const students = array(studentPopulation.students, 'legacy Hub Students').map(
    (value) => {
      const student = record(value, 'legacy Hub Student')
      return student.painterRegistration === undefined
        ? { ...student, painterRegistration: register('actor') }
        : student
    },
  )
  return {
    ...source,
    studentPopulation: { ...studentPopulation, students },
  }
}

function migrateLegacyBoneyardPainterState(
  source: Record<string, unknown>,
  loadedBoneyardValue: unknown,
  register: (lane: 'actor' | 'transient') => Readonly<{
    managerLane: 'actor' | 'transient'
    registrationOrdinal: number
  }>,
): Record<string, unknown> {
  const enemies = record(source.enemies, 'legacy Boneyard enemies')
  const projectiles = array(enemies.projectiles, 'legacy enemy projectiles').map(
    (value) => {
      const projectile = record(value, 'legacy enemy projectile')
      return projectile.painterRegistration === undefined
        ? { ...projectile, painterRegistration: register('actor') }
        : projectile
    },
  )
  const projectileEffects = array(
    enemies.projectileEffects,
    'legacy enemy projectile effects',
  ).map((value) => {
    const effect = record(value, 'legacy enemy projectile effect')
    if (effect.painterRegistration !== undefined) return effect
    const kind = String(effect.kind)
    return {
      ...effect,
      painterRegistration: register(kind.startsWith('fire-burst-')
        ? 'transient'
        : 'actor'),
    }
  })
  const deathEffects = array(enemies.deathEffects, 'legacy enemy death effects').map(
    (value) => {
      const effect = record(value, 'legacy enemy death effect')
      if (effect.painterRegistration !== undefined) return effect
      return {
        ...effect,
        painterRegistration: String(effect.role).startsWith('demon-death-fire-burst-')
          ? null
          : register('actor'),
      }
    },
  )
  const mageLightningPulses = array(
    enemies.mageLightningPulses,
    'legacy Mage lightning pulses',
  ).map((value) => {
    const pulse = record(value, 'legacy Mage lightning pulse')
    if (pulse.painterRegistrations !== undefined) return pulse
    const contact = record(pulse.contact, 'legacy Mage lightning contact')
    return {
      ...pulse,
      painterRegistrations: Array.from(
        { length: contact.kind === 'world' ? 3 : 2 },
        () => register('actor'),
      ),
    }
  })
  const loot = record(source.loot, 'legacy Boneyard loot')
  const lootActors = array(loot.actors, 'legacy loot actors').map((value) => {
    const actor = record(value, 'legacy loot actor')
    return actor.painterRegistration === undefined
      ? { ...actor, painterRegistration: register('actor') }
      : actor
  })
  const lootEffects = array(loot.effects, 'legacy loot effects').map((value) => {
    const effect = record(value, 'legacy loot effect')
    return effect.painterRegistration === undefined
      ? { ...effect, painterRegistration: register('actor') }
      : effect
  })
  const loaded = parseLoadedBoneyard(loadedBoneyardValue)
  const sceneryOrder = new Map(loaded.scene.objects.map((object, index) => [
    object.eid,
    index,
  ]))
  const goodies = array(loot.goodies, 'legacy Goodies').map((value) => {
    const goodie = record(value, 'legacy Goodie')
    if (goodie.sceneryRegistrationOrdinal !== undefined) return goodie
    const sceneryRegistrationOrdinal = sceneryOrder.get(String(goodie.eid))
    if (sceneryRegistrationOrdinal === undefined) {
      throw new Error(`legacy Goodie ${String(goodie.eid)} is absent from its Boneyard scene`)
    }
    return { ...goodie, sceneryRegistrationOrdinal }
  })
  return {
    ...source,
    enemies: {
      ...enemies,
      deathEffects,
      mageLightningPulses,
      projectileEffects,
      projectiles,
    },
    loot: {
      ...loot,
      actors: lootActors,
      effects: lootEffects,
      goodies,
    },
    solomonPainterRegistration: source.encounter === null ? null : register('actor'),
  }
}

function shiftNativeActorRegistrations(value: unknown, offset: number): unknown {
  if (offset === 0) return value
  if (Array.isArray(value)) {
    return value.map((entry) => shiftNativeActorRegistrations(entry, offset))
  }
  if (value === null || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  if (
    source.managerLane === 'actor'
    && Number.isSafeInteger(source.registrationOrdinal)
  ) {
    return {
      ...source,
      registrationOrdinal: Number(source.registrationOrdinal) + offset,
    }
  }
  return Object.fromEntries(Object.entries(source).map(([key, entry]) => [
    key,
    shiftNativeActorRegistrations(entry, offset),
  ]))
}

function remapNativeActorRegistrations(
  value: unknown,
  ordinals: ReadonlyMap<number, number>,
): unknown {
  if (ordinals.size === 0) return value
  if (Array.isArray(value)) {
    return value.map(entry => remapNativeActorRegistrations(entry, ordinals))
  }
  if (value === null || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  if (
    source.managerLane === 'actor'
    && Number.isSafeInteger(source.registrationOrdinal)
  ) {
    const registrationOrdinal = Number(source.registrationOrdinal)
    return {
      ...source,
      registrationOrdinal: ordinals.get(registrationOrdinal) ?? registrationOrdinal,
    }
  }
  return Object.fromEntries(Object.entries(source).map(([key, entry]) => [
    key,
    remapNativeActorRegistrations(entry, ordinals),
  ]))
}

function isManagerRegistration(
  value: unknown,
  managerLane: 'actor' | 'transient',
): boolean {
  if (value === null || typeof value !== 'object') return false
  const source = value as Record<string, unknown>
  return source.managerLane === managerLane
    && Number.isSafeInteger(source.registrationOrdinal)
}

function normalizePlayerStore(
  value: unknown,
  sourceSchemaVersion: number,
): GameSimulationState['playerEntities'] {
  const source = record(value, 'game save players')
  rejectUnexpectedKeys(
    source,
    'game save players',
    sourceSchemaVersion >= 18 ? PLAYER_STORE_KEYS : LEGACY_PLAYER_STORE_KEYS,
  )
  if (
    !Array.isArray(source.configs)
    || !Array.isArray(source.economies)
    || !Array.isArray(source.primaryCasts)
    || !Array.isArray(source.skillBooks)
    || !Array.isArray(source.statBooks)
    || (sourceSchemaVersion >= 18 && !Array.isArray(source.belts))
  ) throw new Error('game save player components are invalid')
  const count = source.configs.length
  if (
    source.economies.length !== count
    || source.primaryCasts.length !== count
    || source.skillBooks.length !== count
    || source.statBooks.length !== count
    || (sourceSchemaVersion >= 18 && (source.belts as unknown[]).length !== count)
  ) throw new Error('game save player component cardinality drifted')

  const removedHagathaSelectors: number[][] = []
  const economies = source.economies.map((value, index) => normalizeEconomy(
    value,
    sourceSchemaVersion,
    (removed) => { removedHagathaSelectors[index] = removed },
  ))
  const primaryCasts: PlayerPrimaryCastState[] = []
  const belts: PlayerBeltComponent[] = []
  const skillBooks: PlayerSkillBookComponent[] = []
  const skillRuntimes: PlayerSkillRuntimeComponent[] = []
  const statBooks = source.statBooks as PlayerStatBookComponent[]
  const persistedRuntimes = Array.isArray(source.skillRuntimes) ? source.skillRuntimes : null
  if (persistedRuntimes && persistedRuntimes.length !== count) {
    throw new Error('game save skill runtime cardinality drifted')
  }
  for (let index = 0; index < count; index += 1) {
    const legacyBook = record(source.skillBooks[index], `game save skill book ${index}`)
    const legacyQuickbar = sourceSchemaVersion >= 18
      ? null
      : Array.isArray(legacyBook.skillQuickbar)
        ? legacyBook.skillQuickbar
        : array(legacyBook.secondaryBelt, 'game save secondary belt')
    let skillBook = normalizeSkillBook(legacyBook, index)
    const statBook = statBooks[index]!
    const economy = economies[index]!
    const created = createPlayerSkillRuntime(skillBook, statBook, economy)
    skillBook = created.skillBook
    let runtime: PlayerSkillRuntimeComponent
    if (persistedRuntimes) {
      const persisted = record(persistedRuntimes[index], `game save skill runtime ${index}`)
      const harden = sourceSchemaVersion < 30
        ? { armor: 0, coating: 0 }
        : record(persisted.harden, 'game save Harden state')
      const armor = finiteNumber(harden.armor, 'game save Harden armor')
      const coating = finiteNumber(harden.coating, 'game save Harden coating')
      if (armor < 0 || coating < 0 || coating > 1 || (coating === 0 && armor !== 0)) {
        throw new Error('game save Harden state is out of range')
      }
      const replacementSlot = persisted.nextConcentrationReplacementSlot
      if (replacementSlot !== 'a' && replacementSlot !== 'b') {
        throw new Error('game save concentration replacement slot is invalid')
      }
      runtime = {
        ...created.runtime,
        concentrationSkillIdA: numericOrNull(persisted.concentrationSkillIdA),
        concentrationSkillIdB: numericOrNull(persisted.concentrationSkillIdB),
        harden: { armor, coating },
        hurricaneCharge: finiteNumber(persisted.hurricaneCharge, 'game save Hurricane charge'),
        hurricaneRefreshed: persisted.hurricaneRefreshed === true,
        nextConcentrationReplacementSlot: replacementSlot,
        staffMeleeAlternate: persisted.staffMeleeAlternate === true,
      }
    } else {
      const concentrations = Array.isArray(legacyBook.concentrationSkillIds)
        ? legacyBook.concentrationSkillIds
        : []
      runtime = {
        ...created.runtime,
        concentrationSkillIdA: numericOrNull(concentrations[0]),
        concentrationSkillIdB: numericOrNull(concentrations[1]),
        nextConcentrationReplacementSlot: legacyBook.nextConcentrationSlot === 1 ? 'b' : 'a',
      }
    }
    const refreshed = refreshPlayerSkillRuntime(runtime, skillBook, statBook, economy)
    belts.push(sourceSchemaVersion >= 18
      ? normalizeSavedBelt(
          (source.belts as unknown[])[index],
          index,
          refreshed.skillBook,
          economy,
        )
      : migrateSkillQuickbarToNativeBelt(legacyQuickbar!.map((entry) => (
          entry === null ? null : finiteNumber(entry, 'game save skill quickbar entry')
        ))))
    primaryCasts.push(normalizePrimaryCast(source.primaryCasts[index], refreshed.skillBook))
    skillBooks.push(refreshed.skillBook)
    skillRuntimes.push(refreshed.runtime)
  }

  const progressions = array(source.progressions, 'game save player progressions').map(
    (value, index) => {
      const progression = record(value, `game save player progression ${index}`)
      const economy = economies[index]!
      const parsedRuntime = progression.hagathaRuntime === undefined
        ? applyNativeHagathaPurchaseRuntime(
            createNativeHagathaRuntimeState(),
            economy.ownedPerkSelectors,
          )
        : parseHagathaRuntime(progression.hagathaRuntime, index)
      const hagathaRuntime = normalizeHagathaRuntimeForOwnership(
        parsedRuntime,
        economy.ownedPerkSelectors,
        sourceSchemaVersion,
        index,
      )
      const normalized = {
        ...progression,
        disciplineOfferBias: economy.ownedPerkSelectors.includes(14),
        hagathaRuntime,
      } as unknown as GameSimulationState['playerEntities']['progressions'][number]
      if ((removedHagathaSelectors[index]?.length ?? 0) === 0) return normalized
      const derived = playerSkillDerivedStats(
        skillRuntimes[index]!,
        skillBooks[index]!,
        statBooks[index]!,
        normalized,
        economy,
      )
      return refreshPlayerCombatFromSkillStats(normalized, derived)
    },
  )

  return {
    ...source,
    belts,
    economies,
    primaryCasts,
    progressions,
    skillBooks,
    skillRuntimes,
  } as unknown as GameSimulationState['playerEntities']
}

function normalizePrimarySpells(value: unknown, sourceSchemaVersion: number): unknown {
  const source = record(value, 'game save primary spells')
  const transients = array(source.transients, 'game save primary spell transients').map(
    (value, index) => {
      const transient = record(value, `game save primary spell transient ${index}`)
      if (transient.kind !== 'water') return transient
      const speed = sourceSchemaVersion < 19 && transient.speed === undefined
        ? 4
        : finiteNumber(transient.speed, `game save Water transient ${index} speed`)
      if (speed < 4 || speed > 10) {
        throw new Error(`game save Water transient ${index} speed is invalid`)
      }
      return { ...transient, speed }
    },
  )
  return {
    ...source,
    // Older checkpoints lack Hail's native sign draw; retire those cosmetic actors.
    transients: sourceSchemaVersion < 29
      ? transients.filter(transient => transient.kind !== 'water-hail')
      : transients,
  }
}

function normalizeDiskSecondary(value: unknown, sourceSchemaVersion: number): GameSimulationState['secondaryAbilities'] {
  const source = record(value, 'game save secondary abilities')
  const players = record(source.players, 'game save secondary players')
  return {
    ...source,
    events: sourceSchemaVersion < 30
      ? array(source.events, 'game save secondary events').map(event => ({
          ...record(event, 'game save secondary event'), gain: 1,
        }))
      : source.events,
    players: Object.fromEntries(Object.entries(players).map(([playerId, value]) => {
      const player = record(value, `game save secondary player ${playerId}`)
      return [playerId, {
        ...player,
        castSpinTicksRemaining: 0,
        heldSlot: null,
        lastSkillId: null,
        mindstar: false,
        planeOrbHeld: false,
        regenerate: false,
        reservedMana: player.firewalker === true ? 50 : 0,
        staffCastTicksRemaining: 0,
      }]
    })),
  } as unknown as GameSimulationState['secondaryAbilities']
}

function repairLegacyHagathaOutcomes(
  outcomes: readonly unknown[],
  tonicPurchases: number,
  charmCapacity: number,
): Readonly<{ outcomes: readonly unknown[]; removed: readonly number[] }> {
  if (
    outcomes.length <= charmCapacity
    || !Number.isSafeInteger(tonicPurchases)
    || !Number.isSafeInteger(charmCapacity)
    || charmCapacity !== 3 + tonicPurchases * 3
    || !outcomes.every(selector => Number.isSafeInteger(selector))
    || outcomes.filter(selector => selector === 27).length !== tonicPurchases
  ) return { outcomes, removed: [] }

  const retained: number[] = []
  const removed: number[] = []
  let remainingTonics = tonicPurchases
  for (const selector of outcomes as readonly number[]) {
    if (selector === 27) {
      remainingTonics -= 1
      retained.push(selector)
    } else if (retained.length < charmCapacity - remainingTonics) {
      retained.push(selector)
    } else {
      removed.push(selector)
    }
  }
  return { outcomes: retained, removed }
}

function normalizeEconomy(
  value: unknown,
  sourceSchemaVersion: number,
  onHagathaRepair: (removed: number[]) => void = () => undefined,
): HubEconomyState {
  const source = record(value, 'game save player economy')
  rejectUnexpectedKeys(source, 'game save player economy', ECONOMY_KEYS)
  if (sourceSchemaVersion >= 13 && typeof source.collegeIntroPending !== 'boolean') {
    throw new Error('game save player economy College intro state is invalid')
  }
  const feedback = source.actionFeedback && typeof source.actionFeedback === 'object'
    && !('unforgeOutcome' in source.actionFeedback)
    ? { ...source.actionFeedback, unforgeOutcome: null }
    : source.actionFeedback
  const tonicPurchases = Number(source.tonicPurchases)
  const sourceOutcomes = Array.isArray(source.ownedPerkSelectors)
    ? [...source.ownedPerkSelectors]
    : []
  const tonicEntries = sourceOutcomes.filter(selector => selector === 27).length
  const materializedOutcomes = sourceSchemaVersion < 17
    && Number.isSafeInteger(tonicPurchases)
    && tonicPurchases > tonicEntries
    ? [...sourceOutcomes, ...Array(tonicPurchases - tonicEntries).fill(27)]
    : sourceOutcomes
  const outcomeRepair = sourceSchemaVersion < 24
    ? repairLegacyHagathaOutcomes(
        materializedOutcomes,
        tonicPurchases,
        Number(source.charmCapacity),
      )
    : { outcomes: materializedOutcomes, removed: [] }
  const sourceBundle = Array.isArray(source.hagathaBundleSelectors)
    ? [...source.hagathaBundleSelectors]
    : source.hagathaBundleSelectors
  const bundleTonics = Array.isArray(sourceBundle)
    ? sourceBundle.filter(selector => selector === 27).length
    : 0
  const bundleRepair = sourceSchemaVersion < 24 && Array.isArray(sourceBundle)
    ? repairLegacyHagathaOutcomes(sourceBundle, bundleTonics, 3 + bundleTonics * 3)
    : { outcomes: sourceBundle, removed: [] }
  const restored = normalizeHubEconomyInventorySlots({
    ...source,
    actionFeedback: feedback,
    collegeIntroPending: sourceSchemaVersion >= 13 && source.collegeIntroPending === true,
    hagathaBundleSelectors: bundleRepair.outcomes,
    npc: normalizeNativeHubNpcState(source.npc, sourceSchemaVersion >= 11),
    ownedPerkSelectors: outcomeRepair.outcomes,
    tutorialPending: source.tutorialPending === true,
    unforgeBonuses: source.unforgeBonuses ?? createNativeUnforgeBonuses(),
  } as unknown as HubEconomyState)
  if (
    !hubEconomyInventoryIsValid(restored)
    || !nativeHagathaBundleStateIsValid(restored.hagathaBundleSelectors)
    || !nativeHagathaOutcomeStateIsValid(
      restored.ownedPerkSelectors,
      restored.tonicPurchases,
      restored.charmCapacity,
    )
  ) {
    throw new Error('game save player economy inventory is invalid or Hagatha state is invalid')
  }
  onHagathaRepair([...outcomeRepair.removed])
  return restored
}

function normalizeSkillBook(
  source: Record<string, unknown>,
  index: number,
): PlayerSkillBookComponent {
  const permanentRanks = array(source.permanentRanks, 'game save permanent skill ranks')
  const effectiveRanks = array(source.effectiveRanks, 'game save effective skill ranks') as number[]
  const learnedSkillOrder = Array.isArray(source.learnedSkillOrder)
    ? source.learnedSkillOrder
    : permanentRanks.flatMap((rank, skillId) => (
        Number(rank) > 0 && skillId >= 8 && skillId <= 79 ? [skillId] : []
      ))
  const weldBuildId = numericOrNull(source.weldBuildId ?? source.activeWeldBuildId)
  const build = weldBuildId === null ? null : nativeWeldBuild(weldBuildId)
  const weldComponentRanks = source.weldComponentRanks === undefined
    ? build === null
      ? null
      : nativeWeldComponentRanksForBuild(effectiveRanks.map(Number), build)
    : source.weldComponentRanks === null
      ? null
      : parseWeldComponentRanks(source.weldComponentRanks, index)
  if ((build === null) !== (weldComponentRanks === null)) {
    throw new Error(`game save player skill book ${index} Weld cache is invalid`)
  }
  const advancedUnlocks = source.advancedUnlocks === undefined
    ? Array.from({ length: 8 }, () => false)
    : array(source.advancedUnlocks, 'game save advanced unlocks')
  if (advancedUnlocks.length !== 8 || advancedUnlocks.some(value => typeof value !== 'boolean')) {
    throw new Error('game save advanced unlocks are invalid')
  }
  return {
    advancedUnlocks: advancedUnlocks as boolean[],
    disciplineRoot: finiteNumber(source.disciplineRoot, 'game save discipline root'),
    effectiveRanks,
    elementRoot: finiteNumber(source.elementRoot, 'game save element root'),
    learnedSkillOrder: learnedSkillOrder as number[],
    permanentRanks: permanentRanks as number[],
    primarySkillId: finiteNumber(
      source.primarySkillId,
      'game save primary skill',
    ) as PlayerSkillBookComponent['primarySkillId'],
    weldBuildId,
    weldComponentRanks,
  }
}

function normalizeSavedBelt(
  value: unknown,
  playerIndex: number,
  skillBook: PlayerSkillBookComponent,
  economy: HubEconomyState,
): PlayerBeltComponent {
  const entries = array(value, `game save player belt ${playerIndex}`)
  if (entries.length !== 8) throw new Error(`game save player belt ${playerIndex} is invalid`)
  return freezeNativeBelt(entries.map((value, slot): NativeBeltEntry | null => {
    if (value === null) return null
    const field = `game save player belt ${playerIndex} slot ${slot}`
    const source = record(value, field)
    if (source.kind === 'skill') {
      rejectUnexpectedKeys(source, field, ['kind', 'skillId'])
      const skillId = finiteNumber(source.skillId, `${field} skill`)
      if (!isNativeBeltSkill(skillId) || (skillBook.permanentRanks[skillId] ?? 0) < 1) {
        throw new Error(`${field} skill is invalid`)
      }
      return Object.freeze({ kind: 'skill', skillId })
    }
    if (source.kind === 'health-potion' || source.kind === 'mana-potion') {
      rejectUnexpectedKeys(source, field, ['kind'])
      return Object.freeze({ kind: source.kind })
    }
    if (source.kind === 'item') {
      rejectUnexpectedKeys(source, field, ['itemId', 'kind', 'nativeTypeId'])
      const itemId = finiteNumber(source.itemId, `${field} item id`)
      const nativeTypeId = finiteNumber(
        source.nativeTypeId,
        `${field} item type`,
      ) as NativeBeltItemTypeId
      const item = nativeBeltOwnedItem(economy, itemId)
      if (!item || item.nativeTypeId !== nativeTypeId
        || !nativeInventoryItemCanBindToBelt(item)) {
        throw new Error(`${field} item is invalid`)
      }
      return Object.freeze({ itemId, kind: 'item', nativeTypeId })
    }
    throw new Error(`${field} kind is invalid`)
  }))
}

function normalizePrimaryCast(
  value: unknown,
  skillBook: PlayerSkillBookComponent,
): PlayerPrimaryCastState {
  const source = record(value, 'game save primary cast')
  return {
    ...createIdlePlayerPrimaryCast(),
    ...source,
    oneShotAttackPoseHeld: source.oneShotAttackPoseHeld === true,
    selectedPrimaryId: typeof source.selectedPrimaryId === 'number'
      ? source.selectedPrimaryId
      : skillBook.primarySkillId === 52
        ? skillBook.weldBuildId ?? -1
        : skillBook.primarySkillId,
  } as PlayerPrimaryCastState
}

function normalizeRun(value: unknown): Record<string, unknown> {
  const source = record(value, 'game save run')
  return {
    ...source,
    gameOverExitKind: source.gameOverExitKind ?? null,
    loadoutReadyPlayerIds: source.loadoutReadyPlayerIds ?? [],
  }
}

function normalizeWorld(
  value: unknown,
  loadedBoneyardValue: unknown,
  playerId: string,
  sourceSchemaVersion: number,
): unknown {
  const source = record(value, 'game save world')
  if (source.kind === 'hub') {
    if (sourceSchemaVersion >= 22) return source
    const ambient = record(source.ambient, 'legacy game save Hub ambient state')
    return {
      ...source,
      ambient: {
        ...ambient,
        teacherTick: 0,
        teacherWorldRelease: null,
      },
    }
  }
  if (source.kind !== 'boneyard') return source
  const loadedBoneyard = parseLoadedBoneyard(loadedBoneyardValue)
  const defaults = createBoneyardWorld(loadedBoneyard)
  const enemies = record(source.enemies, 'game save Boneyard enemies')
  let enemyRngState = finiteNumber(enemies.rngState, 'game save Boneyard enemy RNG')
  const enemyActors = array(enemies.actors, 'game save Boneyard enemy actors').map(
    (value, index) => {
      const actor = record(value, `game save Boneyard enemy actor ${index}`)
      const config = record(actor.config, `game save Boneyard enemy config ${index}`)
      let brain = actor.brain
      if (sourceSchemaVersion < 26 && config.enemyToken === 'WRAITH') {
        const visualPhase = nextBoneyardWaveRandom(enemyRngState)
        const restingSpeed = nextBoneyardWaveRandom(visualPhase.state)
        const flyby = randomBoneyardWaveInteger(restingSpeed.state, 601)
        const initialSpeed = nextBoneyardWaveRandom(flyby.state)
        enemyRngState = initialSpeed.state
        brain = {
          ...createNativeWraithFlightState(
            finiteNumber(config.chaseSpeed, `game save Wraith ${index} chase speed`),
            restingSpeed.value,
            initialSpeed.value,
            flyby.value,
          ),
          family: 'wraith',
          phase: actor.lifeState === 'alive' ? 'flight' : 'death',
        }
      }
      const savedBrain = record(brain, `game save Boneyard enemy brain ${index}`)
      const normalizedBrain = savedBrain.family === 'demon'
        ? {
            ...savedBrain,
            articulation: normalizeSavedDemonArticulation(
              savedBrain.articulation,
              actor,
              config,
              index,
              sourceSchemaVersion,
            ),
          }
        : savedBrain
      return {
        ...actor,
        brain: normalizedBrain,
        config: {
          ...config,
          classification: config.classification ?? 'normal',
          lootPolicies: config.lootPolicies ?? DEFAULT_BONEYARD_ENEMY_LOOT_POLICIES,
          onDeathProgram: config.onDeathProgram ?? null,
          recipeName: config.recipeName ?? null,
          recipeUid: config.recipeUid ?? null,
        },
      }
    },
  )
  const enemyProjectiles = array(
    enemies.projectiles,
    'game save Boneyard enemy projectiles',
  ).map((value, index) => {
    const projectile = record(value, `game save Boneyard enemy projectile ${index}`)
    const chillTumbleAccumulator = sourceSchemaVersion < 19
      && projectile.chillTumbleAccumulator === undefined
      ? 0
      : finiteNumber(
          projectile.chillTumbleAccumulator,
          `game save Boneyard enemy projectile ${index} Chill accumulator`,
        )
    if (chillTumbleAccumulator < 0 || chillTumbleAccumulator > 1) {
      throw new Error(`game save Boneyard enemy projectile ${index} Chill accumulator is invalid`)
    }
    return { ...projectile, chillTumbleAccumulator }
  })
  const encounter = source.encounter === null
    ? null
    : record(source.encounter, 'game save Boneyard Solomon encounter')
  const normalizedEncounter = encounter === null
    ? null
    : (() => {
        const legacyDigEventId = encounter.digAudioEventId
        const current = { ...encounter }
        delete current.digAudioEventId
        delete current.digAudioEvents
        return {
          ...current,
          digBodyBobAmplitude: encounter.digBodyBobAmplitude
            ?? defaults.encounter?.digBodyBobAmplitude
            ?? 5,
          digBodyOffsetY: encounter.digBodyOffsetY ?? 0,
          digEventId: encounter.digEventId ?? legacyDigEventId ?? 0,
          digEvents: encounter.digEvents ?? [],
          dialogueMode: encounter.dialogueMode ?? 'ordinary',
          escapeCollisionSourceIds: encounter.escapeCollisionSourceIds ?? [],
          escapeTarget: encounter.escapeTarget ?? null,
          tutorialDialogueTicks: encounter.tutorialDialogueTicks ?? 0,
        }
      })()
  const tutorialValue = 'tutorial' in source ? source.tutorial : defaults.tutorial
  const tutorial = tutorialValue === null
    ? null
    : (() => {
        const state = record(tutorialValue, 'game save Tutorial')
        const legacyCameraAge = state.cameraLockTriggered === true
          && typeof state.cameraLockTicksRemaining === 'number'
          && Number.isSafeInteger(state.cameraLockTicksRemaining)
          && state.cameraLockTicksRemaining > 0
          ? NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS - state.cameraLockTicksRemaining
          : state.cameraLockTriggered === true
            ? NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS
            : 0
        if (
          sourceSchemaVersion >= 16
          && typeof state.movementInstructionAcknowledged !== 'boolean'
        ) {
          throw new Error(
            'game save Tutorial movementInstructionAcknowledged must be boolean',
          )
        }
        return {
          ...state,
          cameraLockAgeTicks: 'cameraLockAgeTicks' in state
            ? state.cameraLockAgeTicks
            : legacyCameraAge,
          movementInstructionAcknowledged: sourceSchemaVersion < 16
            ? state.movementInstructionAcknowledged === true
            : state.movementInstructionAcknowledged,
          selectedSkillHudAcknowledged: state.selectedSkillHudAcknowledged === true,
        }
      })()
  const tutorialProfileEconomy = source.tutorialProfileEconomy == null
    ? null
    : normalizeEconomy(source.tutorialProfileEconomy, sourceSchemaVersion)
  if ((tutorial === null) !== (tutorialProfileEconomy === null)) {
    throw new Error('game save Tutorial profile baseline ownership is inconsistent')
  }
  const waves = source.waves === null
    ? null
    : record(source.waves, 'game save Boneyard waves')
  return {
    ...source,
    enemies: {
      ...enemies,
      actors: enemyActors,
      locomotionRngState: enemies.locomotionRngState ?? defaults.enemies.locomotionRngState,
      projectiles: enemyProjectiles,
      rngState: enemyRngState,
      steeringRngState: enemies.steeringRngState ?? defaults.enemies.steeringRngState,
    },
    encounter: normalizedEncounter,
    enemyWorldFeedback: source.enemyWorldFeedback ?? defaults.enemyWorldFeedback,
    hallOfFameRuns: source.hallOfFameRuns ?? {
      [playerId]: createNativeHallOfFameRun(0),
    },
    lanternPosition: source.lanternPosition ?? defaults.lanternPosition,
    tutorial,
    tutorialProfileEconomy,
    waves: waves === null
      ? null
      : {
          ...waves,
          openingBursts: waves.openingBursts ?? [],
          openingReleaseThreshold: waves.openingReleaseThreshold ?? 0,
          portalPhaseIndex: waves.portalPhaseIndex ?? 0,
          portalProgram: waves.portalProgram ?? defaults.waves?.portalProgram ?? null,
          portalScriptPhase: waves.portalScriptPhase
            ?? defaults.waves?.portalScriptPhase
            ?? 'retired',
          portalSpawnRemaining: waves.portalSpawnRemaining ?? 0,
          portalTicksRemaining: waves.portalTicksRemaining ?? 0,
          portalTimelinePaused: waves.portalTimelinePaused ?? false,
          slumpgutPhase: waves.slumpgutPhase ?? defaults.waves?.slumpgutPhase ?? 'eligible',
          slumpgutPollCursor: waves.slumpgutPollCursor ?? 0,
          slumpgutRecipeUid: waves.slumpgutRecipeUid ?? defaults.waves?.slumpgutRecipeUid ?? null,
          slumpgutTicksRemaining: waves.slumpgutTicksRemaining ?? 0,
        },
  } as unknown as BoneyardWorldState
}

function normalizeSavedDemonArticulation(
  value: unknown,
  actor: Record<string, unknown>,
  config: Record<string, unknown>,
  index: number,
  sourceSchemaVersion: number,
): NativeDemonArticulationState {
  if (value !== undefined) {
    assertNativeDemonArticulationState(value as NativeDemonArticulationState)
    return value as NativeDemonArticulationState
  }
  if (sourceSchemaVersion >= 27) {
    throw new Error(`game save Boneyard Demon ${index} articulation is missing`)
  }
  const position = record(actor.position, `game save Boneyard Demon ${index} position`)
  const actorId = finiteNumber(actor.id, `game save Boneyard Demon ${index} id`)
  const spawnTick = finiteNumber(
    actor.spawnTick,
    `game save Boneyard Demon ${index} spawn tick`,
  )
  if (!Number.isSafeInteger(actorId) || actorId < 1) {
    throw new Error(`game save Boneyard Demon ${index} id is invalid`)
  }
  if (!Number.isSafeInteger(spawnTick) || spawnTick < 0) {
    throw new Error(`game save Boneyard Demon ${index} spawn tick is invalid`)
  }
  return createNativeDemonArticulationState(
    actorId,
    spawnTick,
    {
      x: finiteNumber(position.x, `game save Boneyard Demon ${index} x`),
      y: finiteNumber(position.y, `game save Boneyard Demon ${index} y`),
    },
    finiteNumber(actor.headingDeg, `game save Boneyard Demon ${index} heading`),
    finiteNumber(config.scale, `game save Boneyard Demon ${index} scale`),
  )
}

function rejectUnexpectedKeys(
  source: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
): void {
  const members = new Set(allowed)
  for (const key of Object.keys(source)) {
    if (!members.has(key)) throw new Error(`${field} has unexpected field ${key}`)
  }
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field} is invalid`)
  return value
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} is invalid`)
  return value
}

function integerWithin(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${field} is invalid`)
  }
  return Number(value)
}

function numericOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function serializeHubWorld(world: HubWorldState): Omit<
  HubWorldState,
  | 'memorial'
  | 'runtime'
  | 'skorchaHiddenTicks'
  | 'skorchaPopulationRng'
  | 'skorchaTransitionTicksRemaining'
  | 'skorchaVisibleTicks'
  | 'studentPopulation'
> & {
  studentPopulation: HubStudentPopulationOptions
} {
  return {
    ambient: world.ambient,
    collisionRngState: world.collisionRngState,
    kind: 'hub',
    participants: world.participants,
    skorcha: world.skorcha === null ? null : {
      ...world.skorcha,
      position: { ...world.skorcha.position },
      rng: { ...world.skorcha.rng, words: [...world.skorcha.rng.words] },
    },
    studentPopulation: {
      nextId: world.studentPopulation.nextId,
      rarePathDenominator: world.studentPopulation.rarePathDenominator,
      rngState: world.studentPopulation.rngState,
      routeEndBehavior: world.studentPopulation.routeEndBehavior,
      spawningEnabled: world.studentPopulation.spawningEnabled,
      spawnRequestPending: world.studentPopulation.spawnRequestPending,
      spawnTickerCounter: world.studentPopulation.spawnTickerCounter,
      students: world.studentPopulation.students,
    },
    traderAnimationSeed: world.traderAnimationSeed,
  }
}

function parseHubStudentPopulation(value: unknown): HubStudentPopulationOptions {
  const population = record(value, 'game save Hub students')
  onlyKeys(population, 'game save Hub students', HUB_STUDENT_POPULATION_KEYS)
  if (!Array.isArray(population.students)) throw new Error('game save Hub students are invalid')
  return population as unknown as HubStudentPopulationOptions
}

function parseHubParticipant(
  value: unknown,
  sourceSchemaVersion: number,
): HubParticipantState {
  const source = record(value, 'game save Hub participant')
  onlyKeys(
    source,
    'game save Hub participant',
    sourceSchemaVersion >= 15
      ? ['collegeIntro', 'region', 'transition']
      : ['region', 'transition'],
  )
  const region = parseHubRegion(source.region, 'game save Hub participant region')
  const transition = source.transition === null
    ? null
    : parseHubTransition(source.transition, region)
  return {
    collegeIntro: sourceSchemaVersion >= 15
      ? parseHubCollegeIntro(source.collegeIntro, region)
      : null,
    region,
    transition,
  }
}

function parseHubCollegeIntro(
  value: unknown,
  region: HubRegionId,
): HubParticipantState['collegeIntro'] {
  if (value === null) return null
  const source = record(value, 'game save College intro')
  onlyKeys(source, 'game save College intro', [
    'contactCounter',
    'coverAlpha',
    'dialogueSequence',
    'officeSpeed',
    'pathCursor',
    'phase',
    'titleCursor',
  ])
  if (
    source.phase !== 'courtyard-walk'
    && source.phase !== 'office-walk'
    && source.phase !== 'arch-dialogue'
  ) throw new Error('game save College intro phase is invalid')
  if (
    (source.phase === 'courtyard-walk' && region !== 'courtyard')
    || (source.phase !== 'courtyard-walk' && region !== 'office')
  ) throw new Error('game save College intro region is invalid')
  const pathCursor = finiteNumber(source.pathCursor, 'game save College path cursor')
  if (pathCursor < 0 || pathCursor > (source.phase === 'courtyard-walk' ? 9 : 6)) {
    throw new Error('game save College path cursor is invalid')
  }
  const titleCursor = finiteNumber(source.titleCursor, 'game save College title cursor')
  const coverAlpha = finiteNumber(source.coverAlpha, 'game save College cover alpha')
  const officeSpeed = finiteNumber(source.officeSpeed, 'game save College Office speed')
  const contactCounter = integerWithin(
    source.contactCounter,
    'game save College contact counter',
    0,
    10,
  )
  if (
    titleCursor < 0
    || titleCursor > 5
    || coverAlpha < 0
    || coverAlpha > 1
    || officeSpeed < 0.5
    || officeSpeed > 1
    || contactCounter % 2 !== 0
  ) throw new Error('game save College intro state is invalid')
  return {
    contactCounter,
    coverAlpha,
    dialogueSequence: integerWithin(
      source.dialogueSequence,
      'game save College dialogue sequence',
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    officeSpeed,
    pathCursor,
    phase: source.phase,
    titleCursor,
  }
}

function parseHubTransition(
  value: unknown,
  region: HubRegionId,
): HubParticipantTransition {
  const source = record(value, 'game save Hub transition')
  onlyKeys(source, 'game save Hub transition', [
    'alpha',
    'destination',
    'phase',
    'scriptedSpeed',
    'scriptedTarget',
    'sourceRegion',
  ])
  if (
    source.phase !== 'college-intro'
    && source.phase !== 'college-loadout'
    && source.phase !== 'outgoing'
    && source.phase !== 'incoming'
  ) throw new Error('game save Hub transition phase is invalid')
  const destination = parseHubRegion(source.destination, 'game save Hub destination')
  const sourceRegion = parseHubRegion(source.sourceRegion, 'game save Hub source')
  const alpha = finiteNumber(source.alpha, 'game save Hub transition alpha')
  const scriptedSpeed = finiteNumber(source.scriptedSpeed, 'game save Hub transition speed')
  const target = record(source.scriptedTarget, 'game save Hub transition target')
  onlyKeys(target, 'game save Hub transition target', ['x', 'y'])
  if (
    alpha < 0
    || alpha > 1
    || scriptedSpeed <= 0
    || !isHubTransitionEdge(sourceRegion, destination)
    || ((source.phase === 'college-intro' || source.phase === 'outgoing')
      && region !== sourceRegion)
    || ((source.phase === 'college-loadout' || source.phase === 'incoming')
      && region !== destination)
  ) throw new Error('game save Hub transition is invalid')
  return {
    alpha,
    destination,
    phase: source.phase as HubTransitionPhase,
    scriptedSpeed,
    scriptedTarget: {
      x: finiteNumber(target.x, 'game save Hub transition x'),
      y: finiteNumber(target.y, 'game save Hub transition y'),
    },
    sourceRegion,
  }
}

function parseHubRegion(value: unknown, field: string): HubRegionId {
  if (typeof value !== 'string' || !isHubRegionId(value)) throw new Error(`${field} is invalid`)
  return value
}

function parseHubSkorcha(value: unknown): HubSkorchaState | null {
  if (value === null) return null
  const source = record(value, 'game save Skorcha')
  onlyKeys(source, 'game save Skorcha', [
    'dismissalIndex',
    'gesture',
    'gestureTicksRemaining',
    'hatActive',
    'hatPhaseDegrees',
    'hatRateDegreesPerTick',
    'position',
    'rng',
    'variant',
  ])
  const variant = integerWithin(source.variant, 'game save Skorcha variant', 0, 2)
  const placement = NATIVE_HUB_NPC_CATALOG.skorcha.placements[variant]!
  const position = record(source.position, 'game save Skorcha position')
  onlyKeys(position, 'game save Skorcha position', ['x', 'y'])
  const x = finiteNumber(position.x, 'game save Skorcha x')
  const y = finiteNumber(position.y, 'game save Skorcha y')
  if (x !== placement.x || y !== placement.y) {
    throw new Error('game save Skorcha placement drifted')
  }
  if (typeof source.hatActive !== 'boolean') {
    throw new Error('game save Skorcha hat state is invalid')
  }
  const hatActive = source.hatActive
  const hatPhaseDegrees = finiteNumber(
    source.hatPhaseDegrees,
    'game save Skorcha hat phase',
  )
  const hatRateDegreesPerTick = finiteNumber(
    source.hatRateDegreesPerTick,
    'game save Skorcha hat rate',
  )
  if (
    hatPhaseDegrees < 0
    || hatPhaseDegrees >= 180
    || hatRateDegreesPerTick < 0
    || hatRateDegreesPerTick > 1.8
    || (!hatActive && hatPhaseDegrees !== 0)
    || (hatActive && hatRateDegreesPerTick < 0.45)
  ) throw new Error('game save Skorcha hat state is invalid')
  return {
    dismissalIndex: integerWithin(
      source.dismissalIndex,
      'game save Skorcha dismissal',
      0,
      2,
    ) as 0 | 1 | 2,
    gesture: integerWithin(source.gesture, 'game save Skorcha gesture', 0, 2) as 0 | 1 | 2,
    gestureTicksRemaining: integerWithin(
      source.gestureTicksRemaining,
      'game save Skorcha gesture timer',
      1,
      29,
    ),
    hatActive,
    hatPhaseDegrees,
    hatRateDegreesPerTick,
    position: { x, y },
    rng: parseNativeRng(source.rng, 'game save Skorcha RNG'),
    variant: variant as 0 | 1 | 2,
  }
}

function parseNativeRng(value: unknown, field: string): NativeRngState {
  const source = record(value, field)
  onlyKeys(source, field, ['indexA', 'indexB', 'words'])
  const words = array(source.words, `${field} words`).map((word, index) => (
    integerWithin(word, `${field} words ${index}`, 0, 0x3fffffff)
  ))
  if (words.length !== 55) throw new Error(`${field} is invalid`)
  return {
    indexA: integerWithin(source.indexA, `${field} index A`, 0, 54),
    indexB: integerWithin(source.indexB, `${field} index B`, 0, 54),
    words,
  }
}

function validatePlayerStore(value: unknown, playerId: string): GameSimulationState['playerEntities'] {
  const store = record(value, 'game save players')
  onlyKeys(store, 'game save players', PLAYER_STORE_KEYS)
  const arrays = PLAYER_STORE_KEYS.filter((key) => key !== 'nextEntityId')
    .map((key) => store[key])
  if (arrays.some((entry) => !Array.isArray(entry) || entry.length !== 1)) {
    throw new Error('game save must contain exactly one owner component row')
  }
  const identities = store.identities as Array<Record<string, unknown>>
  if (identities[0]?.playerId !== playerId) throw new Error('game save owner identity drifted')
  if (!Number.isSafeInteger(store.nextEntityId) || Number(store.nextEntityId) < 1) {
    throw new Error('game save player entity sequence is invalid')
  }
  const economies = (store.economies as unknown[]).map((value, index) => {
    const economy = record(value, `game save player economy ${index}`)
    const feedback = economy.actionFeedback && typeof economy.actionFeedback === 'object'
      && !('unforgeOutcome' in economy.actionFeedback)
      ? { ...economy.actionFeedback, unforgeOutcome: null }
      : economy.actionFeedback
    const restored = normalizeHubEconomyInventorySlots({
      ...economy,
      actionFeedback: feedback,
      collegeIntroPending: economy.collegeIntroPending === true,
      npc: normalizeNativeHubNpcState(economy.npc, true),
      tutorialPending: economy.tutorialPending === true,
      unforgeBonuses: economy.unforgeBonuses ?? createNativeUnforgeBonuses(),
    } as unknown as HubEconomyState)
    if (!hubEconomyInventoryIsValid(restored)) {
      throw new Error(`game save player economy ${index} inventory is invalid`)
    }
    return restored
  })
  const progressions = (store.progressions as unknown[]).map((value, index) => {
    const progression = record(value, `game save player progression ${index}`)
    const rawRuntime = progression.hagathaRuntime
    const hagathaRuntime = rawRuntime === undefined
      ? applyNativeHagathaPurchaseRuntime(
          createNativeHagathaRuntimeState(),
          economies[index]!.ownedPerkSelectors,
        )
      : parseHagathaRuntime(rawRuntime, index)
    return { ...progression, hagathaRuntime }
  })
  const skillBooks = (store.skillBooks as unknown[]).map((value, index) => {
    const skillBook = record(value, `game save player skill book ${index}`)
    const buildId = skillBook.weldBuildId
    const build = typeof buildId === 'number' ? nativeWeldBuild(buildId) : null
    const effectiveRanks = skillBook.effectiveRanks
    if (skillBook.weldComponentRanks !== undefined) {
      const weldComponentRanks = skillBook.weldComponentRanks === null
        ? null
        : parseWeldComponentRanks(skillBook.weldComponentRanks, index)
      if ((build === null) !== (weldComponentRanks === null)) {
        throw new Error(`game save player skill book ${index} Weld cache is invalid`)
      }
      return { ...skillBook, weldComponentRanks }
    }
    return {
      ...skillBook,
      weldComponentRanks: build !== null && Array.isArray(effectiveRanks)
        ? nativeWeldComponentRanksForBuild(effectiveRanks.map(Number), build)
        : null,
    }
  })
  const belts = (store.belts as unknown[]).map((value, index) => normalizeSavedBelt(
    value,
    index,
    skillBooks[index] as unknown as PlayerSkillBookComponent,
    economies[index]!,
  ))
  return {
    ...store,
    belts,
    economies,
    progressions,
    skillBooks,
  } as unknown as GameSimulationState['playerEntities']
}

function normalizeNativeHubNpcState(
  value: unknown,
  requireHelpFlags: boolean,
): NativeHubNpcState {
  const acknowledgedHelpFlags = () => (
    Object.freeze(Array<boolean>(NATIVE_HUB_HELP_ROW_COUNT).fill(false))
  )
  if (value === undefined) {
    if (requireHelpFlags) throw new Error('game save Hub NPC state is missing')
    return { ...createNativeHubNpcState(), helpFlags: acknowledgedHelpFlags() }
  }
  const state = record(value, 'game save Hub NPC state')
  if (requireHelpFlags && state.helpFlags === undefined) {
    throw new Error('game save Hub NPC help flags are missing')
  }
  onlyKeys(
    state,
    'game save Hub NPC state',
    state.helpFlags === undefined
      ? ['boast', 'librarianLaceRead']
      : ['boast', 'helpFlags', 'librarianLaceRead'],
  )
  const boast = record(state.boast, 'game save Boast state')
  onlyKeys(boast, 'game save Boast state', [
    'failed',
    'failureSequence',
    'selected',
    'succeeded',
  ])
  const selected = savedBoastSelection(boast.selected)
  const helpFlags = state.helpFlags === undefined
    ? acknowledgedHelpFlags()
    : array(state.helpFlags, 'game save Hub NPC help flags')
  if (
    typeof boast.failed !== 'boolean'
    || !Number.isSafeInteger(boast.failureSequence)
    || Number(boast.failureSequence) < 0
    || Number(boast.failureSequence) > 1
    || typeof boast.succeeded !== 'boolean'
    || boast.failed !== (boast.failureSequence === 1)
    || (boast.failed === true && boast.succeeded === true)
    || (selected === 3 && boast.failed === true)
    || (selected === null && (boast.failed === true || boast.succeeded === true))
    || helpFlags.length !== NATIVE_HUB_HELP_ROW_COUNT
    || helpFlags.some(value => typeof value !== 'boolean')
    || typeof state.librarianLaceRead !== 'boolean'
  ) throw new Error('game save Hub NPC state is invalid')
  return {
    boast: {
      failed: boast.failed,
      failureSequence: Number(boast.failureSequence),
      selected,
      succeeded: boast.succeeded,
    } as NativeHubNpcState['boast'],
    helpFlags: helpFlags as boolean[],
    librarianLaceRead: state.librarianLaceRead,
  }
}

function savedBoastSelection(value: unknown): BoastSelection | null {
  if (value === null) return null
  if (typeof value === 'number') {
    if (nativeBoastDefinition(value) === null) throw new Error('game save Boast selection is invalid')
    return value as 0 | 1 | 2 | 3 | 4
  }
  const source = record(value, 'game save mod Boast selection')
  onlyKeys(source, 'game save mod Boast selection', ['contentId', 'kind', 'modId'])
  const selection: ModBoastSelection = {
    contentId: String(source.contentId),
    kind: source.kind as 'mod',
    modId: String(source.modId),
  }
  if (
    selection.kind !== 'mod'
    || typeof source.contentId !== 'string'
    || !/^[1-9][0-9]{0,18}$/.test(selection.contentId)
    || typeof source.modId !== 'string'
    || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(selection.modId)
  ) throw new Error('game save mod Boast selection is invalid')
  return selection
}

function parseWeldComponentRanks(value: unknown, index: number) {
  if (!Array.isArray(value) || value.length !== 6) {
    throw new Error(`game save player skill book ${index} Weld cache is invalid`)
  }
  return value.map((rank) => {
    if (!Number.isInteger(rank) || rank < 0 || rank > 255) {
      throw new Error(`game save player skill book ${index} Weld cache is invalid`)
    }
    return rank
  }) as [number, number, number, number, number, number]
}

function parseHagathaRuntime(value: unknown, index: number) {
  const runtime = record(value, `game save Hagatha runtime ${index}`)
  onlyKeys(runtime, `game save Hagatha runtime ${index}`, [
    'cheatDeathCharges',
    'reverieActive',
    'serendipityActive',
  ])
  if (
    (runtime.cheatDeathCharges !== 0 && runtime.cheatDeathCharges !== 1)
    || typeof runtime.reverieActive !== 'boolean'
    || typeof runtime.serendipityActive !== 'boolean'
  ) throw new Error(`game save Hagatha runtime ${index} is invalid`)
  return {
    cheatDeathCharges: runtime.cheatDeathCharges,
    reverieActive: runtime.reverieActive,
    serendipityActive: runtime.serendipityActive,
  }
}

function normalizeHagathaRuntimeForOwnership(
  source: NativeHagathaRuntimeState,
  ownedPerkSelectors: readonly number[],
  sourceSchemaVersion: number,
  index: number,
): NativeHagathaRuntimeState {
  let normalized = source
  for (const selector of [7, 24, 25]) {
    if (!ownedPerkSelectors.includes(selector)) {
      normalized = removeNativeHagathaRuntime(normalized, selector)
    }
  }
  if (sourceSchemaVersion >= 24 && normalized !== source) {
    throw new Error(`game save Hagatha runtime ${index} has no matching ownership`)
  }
  return normalized
}

function parseLoadedBoneyard(value: unknown): LoadedBoneyard {
  const loaded = record(value, 'game save loaded Boneyard')
  onlyKeys(loaded, 'game save loaded Boneyard', [
    'choice',
    'geometrySha256',
    'runId',
    'scene',
    'seed',
    'sourceSha256',
  ])
  if (
    typeof loaded.runId !== 'string'
    || loaded.runId.length === 0
    || typeof loaded.seed !== 'string'
    || typeof loaded.geometrySha256 !== 'string'
    || typeof loaded.sourceSha256 !== 'string'
  ) throw new Error('game save loaded Boneyard identity is invalid')
  record(loaded.choice, 'game save Boneyard choice')
  record(loaded.scene, 'game save Boneyard scene')
  return loaded as unknown as LoadedBoneyard
}

function assertBoundedJsonTree(value: unknown): void {
  let nodes = 0
  const visit = (node: unknown, depth: number): void => {
    nodes += 1
    if (nodes > MAX_WEB_GAME_SAVE_JSON_NODES) throw new Error('game save has too many values')
    if (depth > MAX_WEB_GAME_SAVE_JSON_DEPTH) throw new Error('game save is too deeply nested')
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) visit(child, depth + 1)
      return
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error(`game save has unsafe field ${key}`)
      }
      visit(child, depth + 1)
    }
  }
  visit(value, 0)
}

function sameCharacter(
  first: PlayerCharacterConfig | undefined,
  second: PlayerCharacterConfig,
): boolean {
  return first?.discipline === second.discipline
    && first.displayName === second.displayName
    && first.element === second.element
}
