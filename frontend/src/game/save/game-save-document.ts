import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import type { PlayerCharacterConfig } from '../core-kernels/player-character.ts'
import {
  createNativeUnforgeBonuses,
  hubEconomyInventoryIsValid,
  type HubEconomyState,
} from '../core-kernels/hub-economy.ts'
import {
  applyNativeHagathaPurchaseRuntime,
  createNativeHagathaRuntimeState,
} from '../core-kernels/native-hagatha-effects.ts'
import {
  nativeWeldBuild,
  nativeWeldComponentRanksForBuild,
} from '../core-kernels/player-progression.ts'
import type { GameContentIdentity, LuaConsoleValue } from '../protocol/game-protocol.ts'
import {
  removePlayerCharacter,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import {
  HubStudentPopulationState,
  type HubStudentPopulationOptions,
} from '../core-server/hub-students.ts'
import { HubWorldRuntime, type HubWorldState } from '../core-server/hub-world.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import {
  MAX_WEB_GAME_SAVE_JSON_DEPTH,
  MAX_WEB_GAME_SAVE_JSON_NODES,
  MAX_WEB_GAME_SAVE_BYTES,
  WEB_GAME_SAVE_SCHEMA_VERSION,
  type GameSaveIntegrity,
  onlyKeys,
  parseGameSaveDocument,
  record,
} from './game-save-contract.ts'

export interface CreateGameSaveDocumentOptions {
  readonly integrity: GameSaveIntegrity
  readonly loadedBoneyard: LoadedBoneyard | null
  readonly mods: readonly GameContentIdentity[]
  readonly modState: Readonly<Record<string, Readonly<Record<string, LuaConsoleValue>>>>
  readonly playerId: string
  readonly state: GameSimulationState
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
const HUB_WORLD_KEYS = [
  'ambient',
  'collisionRngState',
  'kind',
  'participants',
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
  let ownerState = options.state
  for (const { playerId } of options.state.playerEntities.identities) {
    if (playerId !== options.playerId) {
      ownerState = removePlayerCharacter(ownerState, playerId)
    }
  }
  const ownerIndex = ownerState.playerEntities.identities.findIndex(
    ({ playerId }) => playerId === options.playerId,
  )
  if (ownerIndex < 0 || ownerState.playerEntities.identities.length !== 1) {
    throw new Error('game save owner is absent from authoritative state')
  }
  if (!hubEconomyInventoryIsValid(ownerState.playerEntities.economies[ownerIndex]!)) {
    throw new Error('game save owner inventory is invalid')
  }
  if (ownerState.run.phase === 'game-over' || ownerState.run.phase === 'loadout') {
    throw new Error(`game save cannot checkpoint ${ownerState.run.phase}`)
  }
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
  const document = JSON.stringify({
    integrity: options.integrity,
    loadedBoneyard: options.loadedBoneyard,
    mods: options.mods,
    modState: options.modState,
    schemaVersion: WEB_GAME_SAVE_SCHEMA_VERSION,
    simulation,
    summary: {
      character,
      phase: ownerState.run.phase,
      playerId: options.playerId,
      savedAtTick: ownerState.tick,
      worldKind: ownerState.world.kind,
    },
  })
  if (encoder.encode(document).byteLength > MAX_WEB_GAME_SAVE_BYTES) {
    throw new Error('game save exceeds its size limit')
  }
  return document
}

export function restoreGameSaveDocument(document: string): RestoredGameSaveDocument {
  const parsed = parseGameSaveDocument(document)
  assertBoundedJsonTree(JSON.parse(document))
  const rawState = record(parsed.simulation, 'game save simulation')
  const modIds = new Set(parsed.mods.map(mod => mod.id.toLowerCase()))
  if (Object.keys(parsed.modState).some(modId => !modIds.has(modId.toLowerCase()))) {
    throw new Error('game save state belongs to an inactive mod')
  }
  onlyKeys(rawState, 'game save simulation', SIMULATION_KEYS)
  const playerEntities = validatePlayerStore(rawState.playerEntities, parsed.summary.playerId)
  const rawRun = record(rawState.run, 'game save run')
  if (rawRun.phase !== parsed.summary.phase) throw new Error('game save phase summary drifted')
  if (!Number.isSafeInteger(rawState.tick) || Number(rawState.tick) < 0) {
    throw new Error('game save simulation tick is invalid')
  }
  if (
    !Number.isSafeInteger(rawState.hallOfFameClockStartedAtTick)
    || Number(rawState.hallOfFameClockStartedAtTick) < 0
    || Number(rawState.hallOfFameClockStartedAtTick) > Number(rawState.tick)
  ) throw new Error('game save Hall clock is invalid')
  if (rawState.tick !== parsed.summary.savedAtTick) throw new Error('game save tick summary drifted')
  if (!Array.isArray(rawState.modEffects) || rawState.modEffects.length !== 0) {
    throw new Error('game save may not persist active mod effects')
  }
  if (rawState.nextModConsumableUseId !== 1) {
    throw new Error('game save mod consumable sequence is invalid')
  }
  const rawWorld = record(rawState.world, 'game save world')
  if (rawWorld.kind !== parsed.summary.worldKind) throw new Error('game save world summary drifted')

  let world: GameSimulationState['world']
  let loadedBoneyard: LoadedBoneyard | null
  if (rawWorld.kind === 'hub') {
    if (parsed.loadedBoneyard !== null) throw new Error('Hub game save carries a Boneyard')
    onlyKeys(rawWorld, 'game save Hub world', HUB_WORLD_KEYS)
    const participants = record(rawWorld.participants, 'game save Hub participants')
    if (
      Object.keys(participants).length !== 1
      || !(parsed.summary.playerId in participants)
    ) throw new Error('game save owner is not the sole Hub participant')
    const population = parseHubStudentPopulation(rawWorld.studentPopulation)
    world = {
      ...rawWorld,
      kind: 'hub',
      participants: participants as HubWorldState['participants'],
      runtime: new HubWorldRuntime(),
      studentPopulation: new HubStudentPopulationState(population),
    } as HubWorldState
    loadedBoneyard = null
  } else if (rawWorld.kind === 'boneyard') {
    loadedBoneyard = parseLoadedBoneyard(parsed.loadedBoneyard)
    if (
      rawWorld.runId !== loadedBoneyard.runId
      || rawRun.runId !== loadedBoneyard.runId
      || rawRun.phase !== 'active'
    ) throw new Error('game save Boneyard run ownership is inconsistent')
    world = rawWorld as unknown as GameSimulationState['world']
  } else {
    throw new Error('game save world kind is invalid')
  }

  const state = {
    ...rawState,
    accumulatorSeconds: 0,
    playerEntities,
    run: rawRun,
    tick: Number(rawState.tick),
    world,
  } as unknown as GameSimulationState
  const config = state.playerEntities.configs[0]
  if (!sameCharacter(config, parsed.summary.character)) {
    throw new Error('game save owner character summary drifted')
  }
  createGameSnapshot(state, parsed.summary.playerId)
  return {
    integrity: parsed.integrity,
    loadedBoneyard,
    mods: parsed.mods,
    modState: parsed.modState,
    playerId: parsed.summary.playerId,
    state,
  }
}

function serializeHubWorld(world: HubWorldState): Omit<HubWorldState, 'runtime' | 'studentPopulation'> & {
  studentPopulation: HubStudentPopulationOptions
} {
  return {
    ambient: world.ambient,
    collisionRngState: world.collisionRngState,
    kind: 'hub',
    participants: world.participants,
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
