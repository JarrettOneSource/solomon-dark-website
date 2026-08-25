import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { DEFAULT_BONEYARD_ENEMY_LOOT_POLICIES } from '../core-kernels/boneyard-enemy-config.ts'
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
  type HubEconomyState,
} from '../core-kernels/hub-economy.ts'
import {
  applyNativeHagathaPurchaseRuntime,
  createNativeHagathaRuntimeState,
  type NativeHagathaRuntimeState,
} from '../core-kernels/native-hagatha-effects.ts'
import {
  createNativeRng,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import {
  NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS,
  NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
} from '../core-kernels/native-tutorial.ts'
import {
  nativeWeldBuild,
  nativeWeldComponentRanksForBuild,
  type PlayerSkillBookComponent,
  type PlayerStatBookComponent,
} from '../core-kernels/player-progression.ts'
import {
  createPlayerSkillRuntime,
  refreshPlayerSkillRuntime,
  type PlayerSkillRuntimeComponent,
} from '../core-kernels/player-skill-runtime.ts'
import { createNativeHallOfFameRun } from '../core-kernels/hall-of-fame-score.ts'
import {
  NATIVE_HUB_HELP_ROW_COUNT,
  NATIVE_HUB_NPC_CATALOG,
  createNativeHubNpcState,
  nativeBoastDefinition,
  type NativeHubNpcState,
} from '../core-kernels/native-hub-npc.ts'
import type { GameContentIdentity, LuaConsoleValue } from '../protocol/game-protocol.ts'
import {
  gameSimulationDurableProfileEconomy,
  gameSimulationRetiredWizardEconomy,
  removePlayerCharacter,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import {
  autofillPlayerEntitySkillSelections,
  replacePlayerCharacter,
  replacePlayerEconomy,
} from '../core-server/player-entity-store.ts'
import {
  type HubStudentPopulationOptions,
} from '../core-server/hub-students.ts'
import type { HubSkorchaState } from '../core-server/hub-skorcha.ts'
import { createHubWorld, hubSpawnPoint, type HubWorldState } from '../core-server/hub-world.ts'
import { createBoneyardWorld, type BoneyardWorldState } from '../core-server/boneyard-world.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import {
  MAX_WEB_GAME_SAVE_JSON_DEPTH,
  MAX_WEB_GAME_SAVE_JSON_NODES,
  MAX_WEB_GAME_SAVE_BYTES,
  WEB_GAME_SAVE_SCHEMA_VERSION,
  type GameSaveIntegrity,
  type ParsedGameSaveContinuation,
  onlyKeys,
  parseGameSaveDocument,
  record,
} from './game-save-contract.ts'

export interface CreateGameSaveDocumentOptions {
  readonly integrity: GameSaveIntegrity
  readonly loadedBoneyard: LoadedBoneyard | null
  readonly mods: readonly GameContentIdentity[]
  readonly modState: Readonly<Record<string, Readonly<Record<string, LuaConsoleValue>>>>
  readonly partyRejoinToken?: string | null
  readonly playerId: string
  readonly state: GameSimulationState
}

export interface CreateGameProfileSaveDocumentOptions {
  readonly integrity: GameSaveIntegrity
  readonly mods: readonly GameContentIdentity[]
  readonly modState: Readonly<Record<string, Readonly<Record<string, LuaConsoleValue>>>>
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
}

export interface RestoredGameSaveDocument {
  readonly integrity: GameSaveIntegrity
  readonly loadedBoneyard: LoadedBoneyard | null
  readonly mods: readonly GameContentIdentity[]
  readonly modState: Readonly<Record<string, Readonly<Record<string, LuaConsoleValue>>>>
  readonly playerId: string
  readonly state: GameSimulationState
}

const SIMULATION_KEYS = [
  'accumulatorSeconds',
  'combatRng',
  'gameRng',
  'hallOfFameClockStartedAtTick',
  'levelUpBarrier',
  'lightProviderOrder',
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
  ...PLAYER_STORE_KEYS,
] as const
const ECONOMY_KEYS = [
  'actionFeedback',
  'backpack',
  'charmCapacity',
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
const encoder = new TextEncoder()

export function createGameSaveDocument(
  options: CreateGameSaveDocumentOptions,
): string {
  const { ownerIndex, ownerState } = ownerProjection(options.state, options.playerId)
  if (ownerState.run.phase === 'game-over' || ownerState.run.phase === 'loadout') {
    throw new Error(`game save cannot checkpoint ${ownerState.run.phase}`)
  }
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
  const simulation = {
    ...ownerState,
    accumulatorSeconds: 0,
    modEffects: [],
    nextModConsumableUseId: 1,
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
    profile: {
      economy: gameSimulationRetiredWizardEconomy(ownerState, options.playerId),
      hagathaRuntime: ownerState.playerEntities.progressions[ownerIndex]!.hagathaRuntime,
    },
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
  if (encoder.encode(encoded).byteLength > MAX_WEB_GAME_SAVE_BYTES) {
    throw new Error('game save exceeds its size limit')
  }
  return encoded
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
    if (continuation.loadedBoneyard !== null) throw new Error('Hub game save carries a Boneyard')
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
    parseHubStudentPopulation(rawWorld.studentPopulation)
    if (rawWorld.skorcha !== undefined) parseHubSkorcha(rawWorld.skorcha)
    const hubSeed = drawNativeInteger(
      parseNativeRng(rawState.gameRng, 'game save game RNG'),
      0x40000000,
    )
    rawState.gameRng = hubSeed.state
    const config = playerEntities.configs[0]!
    playerEntities = replacePlayerCharacter(
      playerEntities,
      continuation.summary.playerId,
      createPlayerCharacter(config, hubSpawnPoint()),
    )
    world = createHubWorld([continuation.summary.playerId], {
      traderAnimationSeed: hubSeed.value,
    })
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
  let concentrationRng = state.secondaryAbilities.rng
  for (const { playerId } of state.playerEntities.identities) {
    const autofilled = autofillPlayerEntitySkillSelections(
      state.playerEntities,
      playerId,
      concentrationRng,
    )
    state = { ...state, playerEntities: autofilled.store }
    concentrationRng = autofilled.rng
  }
  state = {
    ...state,
    secondaryAbilities: { ...state.secondaryAbilities, rng: concentrationRng },
  }
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
      transferCarriedItems: false,
    })
  }
  const hagathaRuntime = parsed.profile.hagathaRuntime === undefined
    ? applyNativeHagathaPurchaseRuntime(
        createNativeHagathaRuntimeState(),
        economy.ownedPerkSelectors,
      )
    : parseHagathaRuntime(parsed.profile.hagathaRuntime, 0)
  return {
    continuation: parsed.continuation,
    economy,
    hagathaRuntime,
    integrity: parsed.integrity,
    mods: parsed.mods,
    modState: parsed.modState,
  }
}

export function hydrateGameSaveProfile(
  state: GameSimulationState,
  playerId: string,
  profile: RestoredGameSaveProfile,
): GameSimulationState {
  const economyStore = replacePlayerEconomy(state.playerEntities, playerId, profile.economy)
  if (economyStore === state.playerEntities) {
    throw new Error('game save profile owner is absent from the fresh game')
  }
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
    'playerOfferRng',
  ])
  const gameRng = source.gameRng ?? source.playerOfferRng
  if (gameRng === undefined) throw new Error('game save simulation is missing its game RNG')
  return {
    accumulatorSeconds: source.accumulatorSeconds,
    combatRng: source.combatRng ?? createNativeRng(0),
    gameRng,
    hallOfFameClockStartedAtTick: source.hallOfFameClockStartedAtTick ?? 0,
    levelUpBarrier: source.levelUpBarrier,
    lightProviderOrder: source.lightProviderOrder,
    modEffects: source.modEffects ?? [],
    nextLevelUpBarrierId: source.nextLevelUpBarrierId,
    nextModConsumableUseId: source.nextModConsumableUseId ?? 1,
    playerEntities: normalizePlayerStore(source.playerEntities, sourceSchemaVersion),
    primarySpells: source.primarySpells,
    run: normalizeRun(source.run),
    secondaryAbilities: source.secondaryAbilities,
    tick: source.tick,
    world: normalizeWorld(source.world, loadedBoneyardValue, playerId, sourceSchemaVersion),
  }
}

function normalizePlayerStore(
  value: unknown,
  sourceSchemaVersion: number,
): GameSimulationState['playerEntities'] {
  const source = record(value, 'game save players')
  rejectUnexpectedKeys(source, 'game save players', LEGACY_PLAYER_STORE_KEYS)
  if (
    !Array.isArray(source.configs)
    || !Array.isArray(source.economies)
    || !Array.isArray(source.primaryCasts)
    || !Array.isArray(source.skillBooks)
    || !Array.isArray(source.statBooks)
  ) throw new Error('game save player components are invalid')
  const count = source.configs.length
  if (
    source.economies.length !== count
    || source.primaryCasts.length !== count
    || source.skillBooks.length !== count
    || source.statBooks.length !== count
  ) throw new Error('game save player component cardinality drifted')

  const economies = source.economies.map(value => normalizeEconomy(value, sourceSchemaVersion))
  const primaryCasts: PlayerPrimaryCastState[] = []
  const skillBooks: PlayerSkillBookComponent[] = []
  const skillRuntimes: PlayerSkillRuntimeComponent[] = []
  const persistedRuntimes = Array.isArray(source.skillRuntimes) ? source.skillRuntimes : null
  if (persistedRuntimes && persistedRuntimes.length !== count) {
    throw new Error('game save skill runtime cardinality drifted')
  }
  for (let index = 0; index < count; index += 1) {
    const legacyBook = record(source.skillBooks[index], `game save skill book ${index}`)
    let skillBook = normalizeSkillBook(legacyBook, index)
    const statBook = source.statBooks[index] as PlayerStatBookComponent
    const economy = economies[index]!
    let runtime: PlayerSkillRuntimeComponent
    if (persistedRuntimes) {
      runtime = persistedRuntimes[index] as PlayerSkillRuntimeComponent
    } else {
      const created = createPlayerSkillRuntime(skillBook, statBook, economy)
      skillBook = created.skillBook
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
    primaryCasts.push(normalizePrimaryCast(source.primaryCasts[index], refreshed.skillBook))
    skillBooks.push(refreshed.skillBook)
    skillRuntimes.push(refreshed.runtime)
  }

  return {
    ...source,
    economies,
    primaryCasts,
    skillBooks,
    skillRuntimes,
  } as unknown as GameSimulationState['playerEntities']
}

function normalizeEconomy(value: unknown, sourceSchemaVersion: number): HubEconomyState {
  const source = record(value, 'game save player economy')
  rejectUnexpectedKeys(source, 'game save player economy', ECONOMY_KEYS)
  const feedback = source.actionFeedback && typeof source.actionFeedback === 'object'
    && !('unforgeOutcome' in source.actionFeedback)
    ? { ...source.actionFeedback, unforgeOutcome: null }
    : source.actionFeedback
  const restored = {
    ...source,
    actionFeedback: feedback,
    npc: normalizeNativeHubNpcState(source.npc, sourceSchemaVersion >= 11),
    tutorialPending: source.tutorialPending === true,
    unforgeBonuses: source.unforgeBonuses ?? createNativeUnforgeBonuses(),
  } as unknown as HubEconomyState
  if (!hubEconomyInventoryIsValid(restored)) {
    throw new Error('game save player economy inventory is invalid')
  }
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
  const skillQuickbar = Array.isArray(source.skillQuickbar)
    ? source.skillQuickbar
    : array(source.secondaryBelt, 'game save secondary belt')
  if (skillQuickbar.length !== 8) throw new Error('game save skill quickbar is invalid')
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
    skillQuickbar: skillQuickbar as unknown as PlayerSkillBookComponent['skillQuickbar'],
    weldBuildId,
    weldComponentRanks,
  }
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
  if (source.kind !== 'boneyard') return source
  const loadedBoneyard = parseLoadedBoneyard(loadedBoneyardValue)
  const defaults = createBoneyardWorld(loadedBoneyard)
  const enemies = record(source.enemies, 'game save Boneyard enemies')
  const enemyActors = array(enemies.actors, 'game save Boneyard enemy actors').map(
    (value, index) => {
      const actor = record(value, `game save Boneyard enemy actor ${index}`)
      const config = record(actor.config, `game save Boneyard enemy config ${index}`)
      return {
        ...actor,
        config: {
          ...config,
          lootPolicies: config.lootPolicies ?? DEFAULT_BONEYARD_ENEMY_LOOT_POLICIES,
          recipeName: config.recipeName ?? null,
          recipeUid: config.recipeUid ?? null,
        },
      }
    },
  )
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
        return {
          ...state,
          cameraLockAgeTicks: 'cameraLockAgeTicks' in state
            ? state.cameraLockAgeTicks
            : legacyCameraAge,
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
        },
  } as unknown as BoneyardWorldState
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
    const restored = {
      ...economy,
      actionFeedback: feedback,
      npc: normalizeNativeHubNpcState(economy.npc, true),
      tutorialPending: economy.tutorialPending === true,
      unforgeBonuses: economy.unforgeBonuses ?? createNativeUnforgeBonuses(),
    } as unknown as HubEconomyState
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
  return {
    ...store,
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
  const selected = boast.selected
  const helpFlags = state.helpFlags === undefined
    ? acknowledgedHelpFlags()
    : array(state.helpFlags, 'game save Hub NPC help flags')
  if (
    (selected !== null && (typeof selected !== 'number' || nativeBoastDefinition(selected) === null))
    || typeof boast.failed !== 'boolean'
    || !Number.isSafeInteger(boast.failureSequence)
    || Number(boast.failureSequence) < 0
    || Number(boast.failureSequence) > 1
    || typeof boast.succeeded !== 'boolean'
    || boast.failed !== (boast.failureSequence === 1)
    || (boast.failed === true && boast.succeeded === true)
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
