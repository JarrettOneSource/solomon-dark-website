import type {
  LocalPartyState,
  PartyMembership,
  PartyPlayerProfile,
} from '../protocol/party-state.ts'

export interface PartyInvitation {
  readonly id: string
  readonly invitedPlayerId: string
  readonly inviterPlayerId: string
  readonly partyId: string
}

export interface PartySystemState {
  readonly invitations: readonly PartyInvitation[]
  readonly nextInvitationOrdinal: number
  readonly nextPartyOrdinal: number
  readonly parties: readonly PartyMembership[]
  readonly revision: number
}

export type PartyActionRejection =
  | 'already-in-party'
  | 'already-invited'
  | 'invitation-missing'
  | 'not-recipient'
  | 'party-full'
  | 'party-missing'
  | 'player-missing'
  | 'same-party'
  | 'self-invite'

export interface PartyActionResult {
  readonly accepted: boolean
  readonly reason: PartyActionRejection | null
  readonly state: PartySystemState
}

export function createPartySystem(): PartySystemState {
  return {
    invitations: [],
    nextInvitationOrdinal: 1,
    nextPartyOrdinal: 1,
    parties: [],
    revision: 0,
  }
}

export function registerPartyPlayer(
  state: PartySystemState,
  playerId: string,
): PartySystemState {
  if (partyForPlayer(state, playerId)) return state
  return {
    ...state,
    nextPartyOrdinal: state.nextPartyOrdinal + 1,
    parties: [...state.parties, {
      id: `party-${state.nextPartyOrdinal}`,
      leaderPlayerId: playerId,
      memberPlayerIds: [playerId],
    }],
    revision: state.revision + 1,
  }
}

export function removePartyPlayer(
  state: PartySystemState,
  playerId: string,
): PartySystemState {
  const membership = partyForPlayer(state, playerId)
  if (!membership) return state
  const remainingMemberIds = membership.memberPlayerIds.filter((id) => id !== playerId)
  const parties = state.parties.flatMap((party) => {
    if (party.id !== membership.id) return [party]
    if (remainingMemberIds.length === 0) return []
    return [{
      ...party,
      leaderPlayerId: party.leaderPlayerId === playerId
        ? remainingMemberIds[0]!
        : party.leaderPlayerId,
      memberPlayerIds: remainingMemberIds,
    }]
  })
  return {
    ...state,
    invitations: state.invitations.filter((invitation) => (
      invitation.invitedPlayerId !== playerId
      && invitation.inviterPlayerId !== playerId
      && parties.some(({ id }) => id === invitation.partyId)
    )),
    parties,
    revision: state.revision + 1,
  }
}

export function invitePartyPlayer(
  state: PartySystemState,
  inviterPlayerId: string,
  invitedPlayerId: string,
  maximumMembers: number,
): PartyActionResult {
  const inviterParty = partyForPlayer(state, inviterPlayerId)
  const invitedParty = partyForPlayer(state, invitedPlayerId)
  if (!inviterParty || !invitedParty) return rejected(state, 'player-missing')
  if (inviterPlayerId === invitedPlayerId) return rejected(state, 'self-invite')
  if (inviterParty.id === invitedParty.id) return rejected(state, 'same-party')
  if (invitedParty.memberPlayerIds.length !== 1) return rejected(state, 'already-in-party')
  if (inviterParty.memberPlayerIds.length >= maximumMembers) return rejected(state, 'party-full')
  if (state.invitations.some((invitation) => (
    invitation.partyId === inviterParty.id
    && invitation.invitedPlayerId === invitedPlayerId
  ))) return rejected(state, 'already-invited')
  return accepted({
    ...state,
    invitations: [...state.invitations, {
      id: `invite-${state.nextInvitationOrdinal}`,
      invitedPlayerId,
      inviterPlayerId,
      partyId: inviterParty.id,
    }],
    nextInvitationOrdinal: state.nextInvitationOrdinal + 1,
    revision: state.revision + 1,
  })
}

export function acceptPartyInvitation(
  state: PartySystemState,
  playerId: string,
  invitationId: string,
  maximumMembers: number,
): PartyActionResult {
  const invitation = state.invitations.find(({ id }) => id === invitationId)
  if (!invitation) return rejected(state, 'invitation-missing')
  if (invitation.invitedPlayerId !== playerId) return rejected(state, 'not-recipient')
  const sourceParty = partyForPlayer(state, playerId)
  const destination = state.parties.find(({ id }) => id === invitation.partyId)
  if (!sourceParty || !destination) return rejected(state, 'party-missing')
  if (sourceParty.id === destination.id || sourceParty.memberPlayerIds.length !== 1) {
    return rejected(state, 'already-in-party')
  }
  if (destination.memberPlayerIds.length >= maximumMembers) return rejected(state, 'party-full')
  const fillsDestination = destination.memberPlayerIds.length + 1 >= maximumMembers

  return accepted({
    ...state,
    invitations: state.invitations.filter((candidate) => (
      candidate.invitedPlayerId !== playerId
      && candidate.partyId !== sourceParty.id
      && (!fillsDestination || candidate.partyId !== destination.id)
    )),
    parties: state.parties.flatMap((party) => {
      if (party.id === sourceParty.id) return []
      if (party.id !== destination.id) return [party]
      return [{
        ...party,
        memberPlayerIds: [...party.memberPlayerIds, playerId],
      }]
    }),
    revision: state.revision + 1,
  })
}

export function denyPartyInvitation(
  state: PartySystemState,
  playerId: string,
  invitationId: string,
): PartyActionResult {
  const invitation = state.invitations.find(({ id }) => id === invitationId)
  if (!invitation) return rejected(state, 'invitation-missing')
  if (invitation.invitedPlayerId !== playerId) return rejected(state, 'not-recipient')
  return accepted({
    ...state,
    invitations: state.invitations.filter(({ id }) => id !== invitationId),
    revision: state.revision + 1,
  })
}

export function partyForPlayer(
  state: PartySystemState,
  playerId: string,
): PartyMembership | null {
  return state.parties.find(({ memberPlayerIds }) => memberPlayerIds.includes(playerId)) ?? null
}

export function clearPartyInvitations(
  state: PartySystemState,
  partyId: string,
): PartySystemState {
  const invitations = state.invitations.filter((invitation) => (
    invitation.partyId !== partyId
    && partyForPlayer(state, invitation.invitedPlayerId)?.id !== partyId
  ))
  return invitations.length === state.invitations.length
    ? state
    : { ...state, invitations, revision: state.revision + 1 }
}

export function projectPartyState(
  state: PartySystemState,
  playerId: string,
  profiles: ReadonlyMap<string, PartyPlayerProfile>,
  hubPlayerIds: ReadonlySet<string>,
): LocalPartyState {
  const party = partyForPlayer(state, playerId)
  if (!party) throw new Error(`party system has no membership for ${playerId}`)
  const profile = (id: string): PartyPlayerProfile => profiles.get(id) ?? {
    accountUsername: null,
    displayName: id,
    highestWave: null,
    playerId: id,
    totalPlaytimeMs: null,
  }
  const hubPlayers = [...hubPlayerIds]
    .sort(compareIds)
    .map(profile)
  return {
    hubPlayers,
    invitations: state.invitations
      .filter(({ invitedPlayerId }) => invitedPlayerId === playerId)
      .map((invitation) => ({
        id: invitation.id,
        inviter: profile(invitation.inviterPlayerId),
        partyId: invitation.partyId,
      })),
    party,
    revision: state.revision,
  }
}

function accepted(state: PartySystemState): PartyActionResult {
  return { accepted: true, reason: null, state }
}

function rejected(
  state: PartySystemState,
  reason: PartyActionRejection,
): PartyActionResult {
  return { accepted: false, reason, state }
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
