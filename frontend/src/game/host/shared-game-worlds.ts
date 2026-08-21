import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import type { BoneyardEnemySpawnIntent } from '../core-kernels/boneyard-wave-director.ts'
import type {
  PlayerCharacterConfig,
  PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  addPlayerCharacter,
  confirmGameSimulationLoadout,
  createGameSimulation,
  enterBoneyardWorld,
  mergeGameSimulationPlayersIntoHub,
  partitionGameSimulationPlayers,
  removePlayerCharacter,
  stepGameSimulationTick,
  type GameSimulationState,
  type GameSimulationExtensions,
  type PlayerId,
} from '../core-server/game-simulation.ts'
import {
  acceptPartyInvitation,
  clearPartyInvitations,
  createPartySystem,
  denyPartyInvitation,
  invitePartyPlayer,
  partyForPlayer,
  registerPartyPlayer,
  removePartyPlayer,
  type PartyActionRejection,
  type PartySystemState,
} from './party-system.ts'

export interface SharedPartyRun {
  readonly loadedBoneyard: LoadedBoneyard
  readonly partyId: string
  readonly state: GameSimulationState
}

export interface SharedGameWorldsState {
  readonly hub: GameSimulationState
  readonly parties: PartySystemState
  readonly runs: readonly SharedPartyRun[]
}

export type SharedWorldActionRejection = PartyActionRejection
  | 'already-running'
  | 'not-in-courtyard'
  | 'not-in-hub'
  | 'not-leader'
  | 'run-unavailable'

export interface SharedWorldActionResult {
  readonly accepted: boolean
  readonly reason: SharedWorldActionRejection | null
  readonly state: SharedGameWorldsState
}

export function createSharedGameWorlds(): SharedGameWorldsState {
  return {
    hub: createGameSimulation({}),
    parties: createPartySystem(),
    runs: [],
  }
}

export function addSharedHubPlayer(
  state: SharedGameWorldsState,
  playerId: PlayerId,
  config: PlayerCharacterConfig,
): SharedGameWorldsState {
  if (sharedGameStateForPlayer(state, playerId)) return state
  return {
    ...state,
    hub: addPlayerCharacter(state.hub, playerId, config),
    parties: registerPartyPlayer(state.parties, playerId),
  }
}

export function restoreSharedGamePlayer(
  state: SharedGameWorldsState,
  restoredState: GameSimulationState,
  loadedBoneyard: LoadedBoneyard | null,
  playerId: PlayerId,
): SharedGameWorldsState {
  if (
    sharedGameStateForPlayer(state, playerId)
    || restoredState.playerEntities.identities.length !== 1
    || restoredState.playerEntities.identities[0]?.playerId !== playerId
  ) throw new Error('shared-game restore requires one unique matching player')
  const parties = registerPartyPlayer(state.parties, playerId)
  if (restoredState.world.kind === 'hub') {
    return {
      ...state,
      hub: mergeGameSimulationPlayersIntoHub(state.hub, restoredState),
      parties,
    }
  }
  if (!loadedBoneyard || loadedBoneyard.runId !== restoredState.world.runId) {
    throw new Error('shared-game Boneyard restore requires matching loaded content')
  }
  const party = partyForPlayer(parties, playerId)!
  return {
    ...state,
    parties,
    runs: [...state.runs, {
      loadedBoneyard,
      partyId: party.id,
      state: restoredState,
    }],
  }
}

export function removeSharedGamePlayer(
  state: SharedGameWorldsState,
  playerId: PlayerId,
): SharedGameWorldsState {
  const inHub = state.hub.playerEntities.identities.some(({ playerId: id }) => id === playerId)
  const runs = state.runs.flatMap((run) => {
    if (!run.state.playerEntities.identities.some(({ playerId: id }) => id === playerId)) {
      return [run]
    }
    const nextState = removePlayerCharacter(run.state, playerId)
    return nextState.playerEntities.identities.length === 0
      ? []
      : [{ ...run, state: nextState }]
  })
  return {
    ...state,
    hub: inHub ? removePlayerCharacter(state.hub, playerId) : state.hub,
    parties: removePartyPlayer(state.parties, playerId),
    runs,
  }
}

export function inviteSharedPartyPlayer(
  state: SharedGameWorldsState,
  inviterPlayerId: PlayerId,
  invitedPlayerId: PlayerId,
  maximumMembers: number,
): SharedWorldActionResult {
  if (!hubHasPlayer(state, inviterPlayerId) || !hubHasPlayer(state, invitedPlayerId)) {
    return rejected(state, 'not-in-hub')
  }
  const result = invitePartyPlayer(
    state.parties,
    inviterPlayerId,
    invitedPlayerId,
    maximumMembers,
  )
  return result.accepted
    ? accepted({ ...state, parties: result.state })
    : rejected(state, result.reason!)
}

export function acceptSharedPartyInvitation(
  state: SharedGameWorldsState,
  playerId: PlayerId,
  invitationId: string,
  maximumMembers: number,
): SharedWorldActionResult {
  if (!hubHasPlayer(state, playerId)) return rejected(state, 'not-in-hub')
  const result = acceptPartyInvitation(
    state.parties,
    playerId,
    invitationId,
    maximumMembers,
  )
  return result.accepted
    ? accepted({ ...state, parties: result.state })
    : rejected(state, result.reason!)
}

export function denySharedPartyInvitation(
  state: SharedGameWorldsState,
  playerId: PlayerId,
  invitationId: string,
): SharedWorldActionResult {
  if (!hubHasPlayer(state, playerId)) return rejected(state, 'not-in-hub')
  const result = denyPartyInvitation(state.parties, playerId, invitationId)
  return result.accepted
    ? accepted({ ...state, parties: result.state })
    : rejected(state, result.reason!)
}

export function startSharedPartyRun(
  state: SharedGameWorldsState,
  leaderPlayerId: PlayerId,
  loadedBoneyard: LoadedBoneyard,
): SharedWorldActionResult {
  const party = partyForPlayer(state.parties, leaderPlayerId)
  if (!party || party.leaderPlayerId !== leaderPlayerId) return rejected(state, 'not-leader')
  if (state.runs.some(({ partyId }) => partyId === party.id)) {
    return rejected(state, 'already-running')
  }
  if (!party.memberPlayerIds.every((playerId) => hubHasPlayer(state, playerId))) {
    return rejected(state, 'not-in-hub')
  }
  if (party.memberPlayerIds.some((playerId) => (
    state.hub.world.kind !== 'hub'
    || state.hub.world.participants[playerId]?.region !== 'courtyard'
    || state.hub.world.participants[playerId]?.transition !== null
  ))) return rejected(state, 'not-in-courtyard')

  const partition = partitionGameSimulationPlayers(state.hub, party.memberPlayerIds)
  if (partition.selected.levelUpBarrier !== null) return rejected(state, 'run-unavailable')
  const runState = enterBoneyardWorld(partition.selected, loadedBoneyard)
  return accepted({
    hub: partition.remaining,
    parties: clearPartyInvitations(state.parties, party.id),
    runs: [...state.runs, {
      loadedBoneyard,
      partyId: party.id,
      state: runState,
    }],
  })
}

export function confirmSharedPartyLoadout(
  state: SharedGameWorldsState,
  leaderPlayerId: PlayerId,
): SharedWorldActionResult {
  const party = partyForPlayer(state.parties, leaderPlayerId)
  if (!party || party.leaderPlayerId !== leaderPlayerId) return rejected(state, 'not-leader')
  const run = state.runs.find(({ partyId }) => partyId === party.id)
  if (!run) return rejected(state, 'run-unavailable')
  const confirmed = confirmGameSimulationLoadout(run.state)
  if (!confirmed) return rejected(state, 'run-unavailable')
  return accepted({
    ...state,
    hub: mergeGameSimulationPlayersIntoHub(state.hub, confirmed),
    runs: state.runs.filter(({ partyId }) => partyId !== party.id),
  })
}

export function stepSharedGameWorlds(
  state: SharedGameWorldsState,
  inputs: Readonly<Record<PlayerId, PlayerCharacterInput>>,
  pausedPartyIds: ReadonlySet<string> = new Set(),
  enemySpawnIntents: ReadonlyMap<string, readonly BoneyardEnemySpawnIntent[]> = new Map(),
  hubPaused = false,
  extensions: ReadonlyMap<string, GameSimulationExtensions> = new Map(),
): SharedGameWorldsState {
  return {
    ...state,
    hub: hubPaused
      ? state.hub
      : stepGameSimulationTick(state.hub, inputsForState(state.hub, inputs)),
    runs: state.runs.map((run) => pausedPartyIds.has(run.partyId)
      ? run
      : {
          ...run,
          state: stepGameSimulationTick(
            run.state,
            inputsForState(run.state, inputs),
            {
              enemySpawnIntents: enemySpawnIntents.get(run.partyId) ?? [],
              extensions: extensions.get(run.partyId),
            },
          ),
        }),
  }
}

export function sharedGameStateForPlayer(
  state: SharedGameWorldsState,
  playerId: PlayerId,
): GameSimulationState | null {
  if (hubHasPlayer(state, playerId)) return state.hub
  return state.runs.find(({ state: runState }) => (
    runState.playerEntities.identities.some(({ playerId: id }) => id === playerId)
  ))?.state ?? null
}

export function replaceSharedGameStateForPlayer(
  state: SharedGameWorldsState,
  playerId: PlayerId,
  nextState: GameSimulationState,
): SharedGameWorldsState {
  if (hubHasPlayer(state, playerId)) return { ...state, hub: nextState }
  const runIndex = state.runs.findIndex(({ state: runState }) => (
    runState.playerEntities.identities.some(({ playerId: id }) => id === playerId)
  ))
  if (runIndex < 0) throw new Error(`shared-game player ${playerId} has no world`)
  return {
    ...state,
    runs: state.runs.map((run, index) => index === runIndex ? { ...run, state: nextState } : run),
  }
}

export function sharedPartySaveStateForPlayer(
  state: SharedGameWorldsState,
  playerId: PlayerId,
): GameSimulationState | null {
  const active = sharedGameStateForPlayer(state, playerId)
  const party = partyForPlayer(state.parties, playerId)
  if (!active || !party) return null
  if (active.world.kind === 'boneyard') return active
  return partitionGameSimulationPlayers(active, party.memberPlayerIds).selected
}

export function sharedLoadedBoneyardForPlayer(
  state: SharedGameWorldsState,
  playerId: PlayerId,
): LoadedBoneyard | null {
  return state.runs.find(({ state: runState }) => (
    runState.playerEntities.identities.some(({ playerId: id }) => id === playerId)
  ))?.loadedBoneyard ?? null
}

function hubHasPlayer(state: SharedGameWorldsState, playerId: PlayerId): boolean {
  return state.hub.playerEntities.identities.some(({ playerId: id }) => id === playerId)
}

function inputsForState(
  state: GameSimulationState,
  inputs: Readonly<Record<PlayerId, PlayerCharacterInput>>,
): Readonly<Record<PlayerId, PlayerCharacterInput>> {
  return Object.fromEntries(state.playerEntities.identities.flatMap(({ playerId }) => (
    inputs[playerId] ? [[playerId, inputs[playerId]]] : []
  )))
}

function accepted(state: SharedGameWorldsState): SharedWorldActionResult {
  return { accepted: true, reason: null, state }
}

function rejected(
  state: SharedGameWorldsState,
  reason: SharedWorldActionRejection,
): SharedWorldActionResult {
  return { accepted: false, reason, state }
}
