import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import type { BoneyardEnemySpawnIntent } from '../core-kernels/boneyard-wave-director.ts'
import {
  archiveHubMemorialPortrait,
  copyHubMemorialState,
  type HubMemorialPlayerProfile,
  type HubMemorialState,
} from '../core-kernels/hub-memorial.ts'
import { drawNativeInteger } from '../core-kernels/native-rng.ts'
import type { SharedPlayerLevelMilestone } from '../core-kernels/player-progression.ts'
import { playerLivingNativeEquipmentAppearance } from '../core-kernels/player-equipment-appearance.ts'
import type {
  PlayerCharacterConfig,
  PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  addPlayerCharacter,
  confirmGameSimulationLoadout,
  continueGameSimulationOver,
  createGameSimulation,
  enterBoneyardWorld,
  mergeGameSimulationPlayersIntoHub,
  partitionGameSimulationPlayers,
  removePlayerCharacter,
  rejoinGameSimulationPlayer,
  stepGameSimulationTick,
  type GameSimulationState,
  type DetachedGameSimulationPlayer,
  type GameSimulationExtensions,
  type PlayerId,
} from '../core-server/game-simulation.ts'
import {
  acceptPartyInvitation,
  clearPartyInvitations,
  createPartySystem,
  denyPartyInvitation,
  invitePartyPlayer,
  joinPartyPlayer,
  kickPartyPlayer,
  leaveParty,
  partyForPlayer,
  registerPartyPlayer,
  removePartyPlayer,
  type PartyActionRejection,
  type PartyIdentity,
  type PartySystemState,
} from './party-system.ts'
import { createGameSnapshot } from './game-snapshot.ts'

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
  | 'not-in-hub'
  | 'not-leader'
  | 'run-unavailable'

export interface SharedWorldActionResult {
  readonly accepted: boolean
  readonly reason: SharedWorldActionRejection | null
  readonly state: SharedGameWorldsState
}

export function createSharedGameWorlds(
  hubSeed = 0,
  hub?: GameSimulationState,
  memorial?: HubMemorialState,
): SharedGameWorldsState {
  const initialHub = hub ?? createGameSimulation({}, {
    gameRngSeed: hubSeed,
    hubTraderAnimationSeed: hubSeed,
  })
  if (initialHub.world.kind !== 'hub') {
    throw new Error('shared-game initial state is not a Hub world')
  }
  return {
    hub: memorial === undefined
      ? initialHub
      : {
          ...initialHub,
          world: {
            ...initialHub.world,
            memorial: copyHubMemorialState(memorial),
          },
        },
    parties: createPartySystem(),
    runs: [],
  }
}

export function addSharedHubPlayer(
  state: SharedGameWorldsState,
  playerId: PlayerId,
  config: PlayerCharacterConfig,
  partyIdentity: PartyIdentity,
): SharedGameWorldsState {
  if (sharedGameStateForPlayer(state, playerId)) return state
  return {
    ...state,
    hub: addPlayerCharacter(state.hub, playerId, config),
    parties: registerPartyPlayer(state.parties, playerId, partyIdentity),
  }
}

export function restoreSharedGamePlayer(
  state: SharedGameWorldsState,
  restoredState: GameSimulationState,
  loadedBoneyard: LoadedBoneyard | null,
  playerId: PlayerId,
  partyIdentity: PartyIdentity,
): SharedGameWorldsState {
  if (
    sharedGameStateForPlayer(state, playerId)
    || restoredState.playerEntities.identities.length !== 1
    || restoredState.playerEntities.identities[0]?.playerId !== playerId
  ) throw new Error('shared-game restore requires one unique matching player')
  const parties = registerPartyPlayer(state.parties, playerId, partyIdentity)
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
  return releaseSharedGamePlayer(state, playerId, true)
}

/** Detach one actor while retaining its durable party membership and leader role. */
export function detachSharedGamePlayer(
  state: SharedGameWorldsState,
  playerId: PlayerId,
): SharedGameWorldsState {
  return releaseSharedGamePlayer(state, playerId, false)
}

function releaseSharedGamePlayer(
  state: SharedGameWorldsState,
  playerId: PlayerId,
  removeMembership: boolean,
): SharedGameWorldsState {
  const inHub = state.hub.playerEntities.identities.some(({ playerId: id }) => id === playerId)
  let hub = inHub ? removePlayerCharacter(state.hub, playerId) : state.hub
  const runs: SharedPartyRun[] = []
  for (const run of state.runs) {
    if (!run.state.playerEntities.identities.some(({ playerId: id }) => id === playerId)) {
      runs.push(run)
      continue
    }
    const nextState = removePlayerCharacter(run.state, playerId)
    if (nextState.playerEntities.identities.length === 0) {
      continue
    }
    if (nextState.run.phase === 'hub') {
      hub = mergeGameSimulationPlayersIntoHub(hub, nextState)
      continue
    }
    runs.push({ ...run, state: nextState })
  }
  return {
    ...state,
    hub,
    parties: removeMembership ? removePartyPlayer(state.parties, playerId) : state.parties,
    runs,
  }
}

export function rejoinSharedPartyRunPlayer(
  state: SharedGameWorldsState,
  detachedState: DetachedGameSimulationPlayer,
  playerId: PlayerId,
  partyId: string,
  partyIdentity: PartyIdentity,
  maximumMembers: number,
  milestone: SharedPlayerLevelMilestone | null,
): SharedWorldActionResult {
  const existingParty = partyForPlayer(state.parties, playerId)
  if (
    sharedGameStateForPlayer(state, playerId)
    || (existingParty !== null && existingParty.id !== partyId)
  ) {
    return rejected(state, 'already-in-party')
  }
  const run = state.runs.find(candidate => (
    candidate.partyId === partyId
    && candidate.loadedBoneyard.runId === detachedState.runId
    && candidate.state.run.phase === 'active'
  ))
  if (!run) return rejected(state, 'run-unavailable')

  let parties = state.parties
  if (existingParty === null) {
    const registered = registerPartyPlayer(parties, playerId, partyIdentity)
    const joined = joinPartyPlayer(registered, playerId, partyId, maximumMembers)
    if (!joined.accepted) return rejected(state, joined.reason!)
    parties = joined.state
  }
  let rejoinedState: GameSimulationState
  try {
    rejoinedState = rejoinGameSimulationPlayer(
      run.state,
      detachedState,
      playerId,
      milestone,
    )
  } catch {
    return rejected(state, 'run-unavailable')
  }
  return accepted({
    ...state,
    parties,
    runs: state.runs.map(candidate => candidate === run
      ? { ...candidate, state: rejoinedState }
      : candidate),
  })
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

export function joinSharedPartyPlayer(
  state: SharedGameWorldsState,
  playerId: PlayerId,
  partyId: string,
  maximumMembers: number,
): SharedWorldActionResult {
  if (!hubHasPlayer(state, playerId)) return rejected(state, 'not-in-hub')
  const result = joinPartyPlayer(state.parties, playerId, partyId, maximumMembers)
  return result.accepted
    ? accepted({ ...state, parties: result.state })
    : rejected(state, result.reason!)
}

export function leaveSharedParty(
  state: SharedGameWorldsState,
  playerId: PlayerId,
  partyIdentity: PartyIdentity,
): SharedWorldActionResult {
  if (!hubHasPlayer(state, playerId)) return rejected(state, 'not-in-hub')
  const result = leaveParty(state.parties, playerId, partyIdentity)
  return result.accepted
    ? accepted({ ...state, parties: result.state })
    : rejected(state, result.reason!)
}

export function kickSharedPartyPlayer(
  state: SharedGameWorldsState,
  leaderPlayerId: PlayerId,
  targetPlayerId: PlayerId,
  partyIdentity: PartyIdentity,
): SharedWorldActionResult {
  if (!hubHasPlayer(state, leaderPlayerId) || !hubHasPlayer(state, targetPlayerId)) {
    return rejected(state, 'not-in-hub')
  }
  const result = kickPartyPlayer(
    state.parties,
    leaderPlayerId,
    targetPlayerId,
    partyIdentity,
  )
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
    || state.hub.world.participants[playerId]?.transition !== null
  ))) return rejected(state, 'run-unavailable')

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
  playerId: PlayerId,
  selection: Pick<PlayerCharacterConfig, 'discipline' | 'displayName' | 'element'>,
): SharedWorldActionResult {
  const hubConfirmed = confirmGameSimulationLoadout(state.hub, playerId, selection)
  if (hubConfirmed) return accepted({ ...state, hub: hubConfirmed })
  const party = partyForPlayer(state.parties, playerId)
  if (!party) return rejected(state, 'run-unavailable')
  const run = state.runs.find(({ partyId }) => partyId === party.id)
  if (!run) return rejected(state, 'run-unavailable')
  const confirmed = confirmGameSimulationLoadout(run.state, playerId, selection)
  if (!confirmed) return rejected(state, 'run-unavailable')
  if (confirmed.run.phase !== 'hub') {
    return accepted({
      ...state,
      runs: state.runs.map((candidate) => (
        candidate.partyId === party.id ? { ...candidate, state: confirmed } : candidate
      )),
    })
  }
  return accepted({
    ...state,
    hub: mergeGameSimulationPlayersIntoHub(state.hub, confirmed),
    runs: state.runs.filter(({ partyId }) => partyId !== party.id),
  })
}

export function continueSharedPartyGameOver(
  state: SharedGameWorldsState,
  playerId: PlayerId,
  runId: string,
  eventId: number,
): SharedWorldActionResult {
  const party = partyForPlayer(state.parties, playerId)
  if (!party) return rejected(state, 'run-unavailable')
  const run = state.runs.find(({ partyId }) => partyId === party.id)
  if (
    !run
    || !run.state.playerEntities.identities.some(({ playerId: id }) => id === playerId)
  ) return rejected(state, 'run-unavailable')
  const continued = continueGameSimulationOver(run.state, runId, eventId)
  if (!continued) return rejected(state, 'run-unavailable')
  return accepted({
    ...state,
    runs: state.runs.map((candidate) => (
      candidate.partyId === party.id ? { ...candidate, state: continued } : candidate
    )),
  })
}

export function stepSharedGameWorlds(
  state: SharedGameWorldsState,
  inputs: Readonly<Record<PlayerId, PlayerCharacterInput>>,
  pausedPartyIds: ReadonlySet<string> = new Set(),
  enemySpawnIntents: ReadonlyMap<string, readonly BoneyardEnemySpawnIntent[]> = new Map(),
  extensions: ReadonlyMap<string, GameSimulationExtensions> = new Map(),
  collegeIntroReadyPlayerIds: ReadonlySet<PlayerId> | null = null,
  memorialProfiles: ReadonlyMap<PlayerId, HubMemorialPlayerProfile> = new Map(),
  memorialEligiblePlayerIds: ReadonlySet<PlayerId> | null = null,
  onMemorialStateChanged?: (state: HubMemorialState) => void,
): SharedGameWorldsState {
  if (state.hub.world.kind !== 'hub') {
    throw new Error('shared-game Hub owner is not a Hub world')
  }
  const hub = stepGameSimulationTick(state.hub, inputsForState(state.hub, inputs), {
    ...(collegeIntroReadyPlayerIds === null ? {} : { collegeIntroReadyPlayerIds }),
  })
  if (hub.world.kind !== 'hub') throw new Error('shared-game Hub stepped out of its world')
  let memorial = hub.world.memorial
  const runs = state.runs.map((run): SharedPartyRun => {
    if (pausedPartyIds.has(run.partyId)) return run
    const previous = run.state
    let next = stepGameSimulationTick(
      previous,
      inputsForState(previous, inputs),
      {
        ...(collegeIntroReadyPlayerIds === null ? {} : { collegeIntroReadyPlayerIds }),
        enemySpawnIntents: enemySpawnIntents.get(run.partyId) ?? [],
        extensions: extensions.get(run.partyId),
      },
    )
    const previousWorld = previous.world
    const nextWorld = next.world
    if (
      previousWorld.kind === 'boneyard'
      && nextWorld.kind === 'boneyard'
      && previousWorld.runId === nextWorld.runId
    ) {
      const completedPlayerIds = Object.keys(nextWorld.hallOfFameRuns)
        .filter((playerId) => (
          previousWorld.hallOfFameRuns[playerId]?.elapsedTicks === null
          && nextWorld.hallOfFameRuns[playerId]?.elapsedTicks !== null
        ))
        .sort()
      if (completedPlayerIds.length > 0) {
        const snapshot = createGameSnapshot(next, null)
        for (const playerId of completedPlayerIds) {
          if (memorialEligiblePlayerIds && !memorialEligiblePlayerIds.has(playerId)) continue
          if (snapshot.world.kind !== 'boneyard') break
          const player = snapshot.players[playerId]
          const completed = snapshot.world.hallOfFameRuns[playerId]
          if (
            !player
            || !completed
            || completed.elapsedTicks === null
            || completed.portraitHeadingIndex === null
            || completed.portraitScale === null
          ) continue
          const marker = drawNativeInteger(next.gameRng, 5)
          next = { ...next, gameRng: marker.state }
          memorial = archiveHubMemorialPortrait(memorial, {
            accountUsername: memorialProfiles.get(playerId)?.accountUsername ?? null,
            awesomeness: completed.awesomeness,
            awesomestKill: completed.awesomestKill,
            capturedAtTick: next.tick,
            config: player.config,
            elapsedTicks: completed.elapsedTicks,
            equipment: playerLivingNativeEquipmentAppearance(
              player.config.element,
              player.economy.equipment,
            ),
            headingIndex: completed.portraitHeadingIndex,
            level: player.progression.level,
            monstersKilled: completed.monstersKilled,
            playerId,
            portraitScale: completed.portraitScale,
            runId: nextWorld.runId,
            wave: nextWorld.waves?.waveOrdinal ?? 0,
          }, marker.value)
        }
      }
    }
    return { ...run, state: next }
  })
  const nextState = {
    ...state,
    hub: { ...hub, world: { ...hub.world, memorial } },
    runs,
  }
  if (memorial !== hub.world.memorial) onMemorialStateChanged?.(memorial)
  return nextState
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
