import type {
  LocalPartyState,
  PartyJoinRequester,
  PartyMembership,
  PartyPlayerProfile,
  PartyRosterPlayer,
  PartyVisibility,
} from '../protocol/party-state.ts'

export interface PartyIdentity {
  readonly id: string
  readonly joinCode: string
  readonly listingId: string
}

export interface PartyInvitation {
  readonly id: string
  readonly invitedPlayerId: string
  readonly inviterPlayerId: string
  readonly partyId: string
}

export interface PartyJoinRequest {
  readonly id: string
  readonly partyId: string
  readonly requester: PartyJoinRequester
}

export interface PartySystemState {
  readonly invitations: readonly PartyInvitation[]
  readonly joinRequests: readonly PartyJoinRequest[]
  readonly nextInvitationOrdinal: number
  readonly parties: readonly PartyMembership[]
  readonly revision: number
}

export type PartyActionRejection =
  | 'already-in-party'
  | 'already-invited'
  | 'already-requested'
  | 'invitation-missing'
  | 'not-leader'
  | 'not-recipient'
  | 'party-full'
  | 'party-missing'
  | 'party-private'
  | 'player-missing'
  | 'request-missing'
  | 'same-party'
  | 'self-invite'
  | 'self-kick'

export interface PartyActionResult {
  readonly accepted: boolean
  readonly reason: PartyActionRejection | null
  readonly state: PartySystemState
}

const MAX_PENDING_JOIN_REQUESTS = 16

export function createPartySystem(): PartySystemState {
  return {
    invitations: [],
    joinRequests: [],
    nextInvitationOrdinal: 1,
    parties: [],
    revision: 0,
  }
}

export function registerPartyPlayer(
  state: PartySystemState,
  playerId: string,
  identity: PartyIdentity,
): PartySystemState {
  if (partyForPlayer(state, playerId)) return state
  return changed(state, { parties: [...state.parties, membership(identity, playerId)] })
}

/** Restore one signed recovery membership around the already registered claimant. */
export function restorePartyMembership(
  state: PartySystemState,
  claimantPlayerId: string,
  memberPlayerIds: readonly string[],
  leaderPlayerId: string,
  visibility: PartyVisibility,
): PartySystemState {
  const claimantParty = partyForPlayer(state, claimantPlayerId)
  if (!claimantParty) throw new Error('party recovery claimant is not registered')
  if (
    memberPlayerIds.length < 1
    || new Set(memberPlayerIds).size !== memberPlayerIds.length
    || !memberPlayerIds.includes(claimantPlayerId)
    || !memberPlayerIds.includes(leaderPlayerId)
  ) throw new Error('party recovery membership is invalid')
  for (const playerId of memberPlayerIds) {
    const existing = partyForPlayer(state, playerId)
    if (existing && existing.id !== claimantParty.id) {
      throw new Error(`party recovery player ${playerId} already belongs to another party`)
    }
  }
  return changed(state, {
    invitations: state.invitations.filter(invitation => (
      invitation.partyId !== claimantParty.id
      && !memberPlayerIds.includes(invitation.invitedPlayerId)
      && !memberPlayerIds.includes(invitation.inviterPlayerId)
    )),
    joinRequests: state.joinRequests.filter(request => request.partyId !== claimantParty.id),
    parties: state.parties.map(party => party.id === claimantParty.id
      ? {
          ...party,
          leaderPlayerId,
          memberPlayerIds: [...memberPlayerIds],
          visibility,
        }
      : party),
  })
}

export function removePartyPlayer(
  state: PartySystemState,
  playerId: string,
): PartySystemState {
  const active = partyForPlayer(state, playerId)
  if (!active) return state
  const remainingMemberIds = active.memberPlayerIds.filter((id) => id !== playerId)
  const parties = state.parties.flatMap((party) => {
    if (party.id !== active.id) return [party]
    if (remainingMemberIds.length === 0) return []
    return [{
      ...party,
      leaderPlayerId: party.leaderPlayerId === playerId
        ? remainingMemberIds[0]!
        : party.leaderPlayerId,
      memberPlayerIds: remainingMemberIds,
    }]
  })
  return changed(state, {
    invitations: retainLiveInvitations(state.invitations, parties, playerId),
    joinRequests: state.joinRequests.filter(({ partyId }) => (
      parties.some(({ id }) => id === partyId)
    )),
    parties,
  })
}

export function leaveParty(
  state: PartySystemState,
  playerId: string,
  identity: PartyIdentity,
): PartyActionResult {
  const source = partyForPlayer(state, playerId)
  if (!source) return rejected(state, 'player-missing')
  if (source.memberPlayerIds.length === 1) return accepted(state)
  return accepted(registerPartyPlayer(removePartyPlayer(state, playerId), playerId, identity))
}

export function kickPartyPlayer(
  state: PartySystemState,
  leaderPlayerId: string,
  targetPlayerId: string,
  identity: PartyIdentity,
): PartyActionResult {
  const party = partyForPlayer(state, leaderPlayerId)
  if (!party) return rejected(state, 'party-missing')
  if (party.leaderPlayerId !== leaderPlayerId) return rejected(state, 'not-leader')
  if (targetPlayerId === leaderPlayerId) return rejected(state, 'self-kick')
  if (!party.memberPlayerIds.includes(targetPlayerId)) return rejected(state, 'player-missing')
  return accepted(registerPartyPlayer(
    removePartyPlayer(state, targetPlayerId),
    targetPlayerId,
    identity,
  ))
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
  if (inviterParty.leaderPlayerId !== inviterPlayerId) return rejected(state, 'not-leader')
  if (inviterPlayerId === invitedPlayerId) return rejected(state, 'self-invite')
  if (inviterParty.id === invitedParty.id) return rejected(state, 'same-party')
  if (invitedParty.memberPlayerIds.length !== 1) return rejected(state, 'already-in-party')
  if (partySize(state, inviterParty.id) >= maximumMembers) {
    return rejected(state, 'party-full')
  }
  if (state.invitations.some((invitation) => (
    invitation.partyId === inviterParty.id
    && invitation.invitedPlayerId === invitedPlayerId
  ))) return rejected(state, 'already-invited')
  return accepted(changed(state, {
    invitations: [...state.invitations, {
      id: `invite-${state.nextInvitationOrdinal}`,
      invitedPlayerId,
      inviterPlayerId,
      partyId: inviterParty.id,
    }],
    nextInvitationOrdinal: state.nextInvitationOrdinal + 1,
  }))
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
  return joinPartyPlayer(state, playerId, invitation.partyId, maximumMembers)
}

export function joinPartyPlayer(
  state: PartySystemState,
  playerId: string,
  destinationPartyId: string,
  maximumMembers: number,
): PartyActionResult {
  const sourceParty = partyForPlayer(state, playerId)
  const destination = state.parties.find(({ id }) => id === destinationPartyId)
  if (!sourceParty || !destination) return rejected(state, 'party-missing')
  if (sourceParty.id === destination.id || sourceParty.memberPlayerIds.length !== 1) {
    return rejected(state, 'already-in-party')
  }
  if (partySize(state, destination.id) >= maximumMembers) {
    return rejected(state, 'party-full')
  }
  const fillsDestination = destination.memberPlayerIds.length + 1 >= maximumMembers
  return accepted(changed(state, {
    invitations: state.invitations.filter((candidate) => (
      candidate.invitedPlayerId !== playerId
      && candidate.partyId !== sourceParty.id
      && (!fillsDestination || candidate.partyId !== destination.id)
    )),
    joinRequests: state.joinRequests.filter((candidate) => (
      candidate.requester.requesterId !== playerId
      && candidate.partyId !== sourceParty.id
      && (!fillsDestination || candidate.partyId !== destination.id)
    )),
    parties: state.parties.flatMap((party) => {
      if (party.id === sourceParty.id) return []
      if (party.id !== destination.id) return [party]
      return [{ ...party, memberPlayerIds: [...party.memberPlayerIds, playerId] }]
    }),
  }))
}

export function denyPartyInvitation(
  state: PartySystemState,
  playerId: string,
  invitationId: string,
): PartyActionResult {
  const invitation = state.invitations.find(({ id }) => id === invitationId)
  if (!invitation) return rejected(state, 'invitation-missing')
  if (invitation.invitedPlayerId !== playerId) return rejected(state, 'not-recipient')
  return accepted(changed(state, {
    invitations: state.invitations.filter(({ id }) => id !== invitationId),
  }))
}

export function setPartyVisibility(
  state: PartySystemState,
  leaderPlayerId: string,
  visibility: PartyVisibility,
): PartyActionResult {
  const party = partyForPlayer(state, leaderPlayerId)
  if (!party) return rejected(state, 'party-missing')
  if (party.leaderPlayerId !== leaderPlayerId) return rejected(state, 'not-leader')
  if (party.visibility === visibility) return accepted(state)
  return accepted(changed(state, {
    joinRequests: visibility === 'private'
      ? state.joinRequests.filter(({ partyId }) => partyId !== party.id)
      : state.joinRequests,
    parties: state.parties.map(candidate => candidate.id === party.id
      ? { ...candidate, visibility }
      : candidate),
  }))
}

export function rotatePartyJoinCode(
  state: PartySystemState,
  leaderPlayerId: string,
  joinCode: string,
): PartyActionResult {
  const party = partyForPlayer(state, leaderPlayerId)
  if (!party) return rejected(state, 'party-missing')
  if (party.leaderPlayerId !== leaderPlayerId) return rejected(state, 'not-leader')
  if (party.joinCode === joinCode) return accepted(state)
  return accepted(changed(state, {
    parties: state.parties.map(candidate => candidate.id === party.id
      ? { ...candidate, joinCode }
      : candidate),
  }))
}

export function requestPartyJoin(
  state: PartySystemState,
  partyId: string,
  request: Readonly<{ id: string; requester: PartyJoinRequester }>,
  maximumMembers: number,
): PartyActionResult {
  const party = state.parties.find(candidate => candidate.id === partyId)
  if (!party) return rejected(state, 'party-missing')
  if (party.visibility === 'private') return rejected(state, 'party-private')
  if (partySize(state, party.id) >= maximumMembers) return rejected(state, 'party-full')
  if (state.joinRequests.some(candidate => (
    candidate.partyId === party.id
    && candidate.requester.requesterId === request.requester.requesterId
  ))) return rejected(state, 'already-requested')
  if (state.joinRequests.filter(candidate => candidate.partyId === party.id).length
    >= MAX_PENDING_JOIN_REQUESTS) return rejected(state, 'party-full')
  return accepted(changed(state, {
    joinRequests: [...state.joinRequests, { ...request, partyId }],
  }))
}

export function decidePartyJoinRequest(
  state: PartySystemState,
  leaderPlayerId: string,
  requestId: string,
): PartyActionResult {
  const request = state.joinRequests.find(({ id }) => id === requestId)
  if (!request) return rejected(state, 'request-missing')
  const party = state.parties.find(({ id }) => id === request.partyId)
  if (!party) return rejected(state, 'party-missing')
  if (party.leaderPlayerId !== leaderPlayerId) return rejected(state, 'not-leader')
  return accepted(changed(state, {
    joinRequests: state.joinRequests.filter(({ id }) => id !== requestId),
  }))
}

export function partyForPlayer(
  state: PartySystemState,
  playerId: string,
): PartyMembership | null {
  return state.parties.find(({ memberPlayerIds }) => memberPlayerIds.includes(playerId)) ?? null
}

export function partyByJoinCode(
  state: PartySystemState,
  joinCode: string,
): PartyMembership | null {
  return state.parties.find(party => party.joinCode === joinCode) ?? null
}

export function partyByListingId(
  state: PartySystemState,
  listingId: string,
): PartyMembership | null {
  return state.parties.find(party => party.listingId === listingId) ?? null
}

export function clearPartyInvitations(
  state: PartySystemState,
  partyId: string,
): PartySystemState {
  const invitations = state.invitations.filter((invitation) => (
    invitation.partyId !== partyId
    && partyForPlayer(state, invitation.invitedPlayerId)?.id !== partyId
  ))
  const joinRequests = state.joinRequests.filter(request => request.partyId !== partyId)
  return invitations.length === state.invitations.length
    && joinRequests.length === state.joinRequests.length
    ? state
    : changed(state, { invitations, joinRequests })
}

export function projectPartyState(
  state: PartySystemState,
  playerId: string,
  profiles: ReadonlyMap<string, PartyPlayerProfile>,
  hubPlayerIds: ReadonlySet<string>,
  roster: ReadonlyMap<string, PartyRosterPlayer>,
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
  const hubPlayers = [...hubPlayerIds].sort(compareIds).map(profile)
  const partyRoster = party.memberPlayerIds.map(memberPlayerId => {
    const row = roster.get(memberPlayerId)
    if (!row) throw new Error(`party roster has no state for ${memberPlayerId}`)
    return row
  })
  return {
    hubPlayers,
    invitations: state.invitations
      .filter(({ invitedPlayerId }) => invitedPlayerId === playerId)
      .map((invitation) => ({
        id: invitation.id,
        inviter: profile(invitation.inviterPlayerId),
        partyId: invitation.partyId,
      })),
    joinRequests: party.leaderPlayerId === playerId
      ? state.joinRequests
          .filter(({ partyId }) => partyId === party.id)
          .map(({ id, requester }) => ({ id, requester }))
      : [],
    party,
    partyRoster,
    revision: state.revision,
  }
}

function membership(identity: PartyIdentity, playerId: string): PartyMembership {
  return {
    ...identity,
    leaderPlayerId: playerId,
    memberPlayerIds: [playerId],
    visibility: 'private',
  }
}

function partySize(state: PartySystemState, partyId: string): number {
  const party = state.parties.find(candidate => candidate.id === partyId)
  return party?.memberPlayerIds.length ?? 0
}

function retainLiveInvitations(
  invitations: readonly PartyInvitation[],
  parties: readonly PartyMembership[],
  removedPlayerId: string,
): readonly PartyInvitation[] {
  return invitations.filter((invitation) => (
    invitation.invitedPlayerId !== removedPlayerId
    && invitation.inviterPlayerId !== removedPlayerId
    && parties.some(({ id }) => id === invitation.partyId)
  ))
}

function changed(
  state: PartySystemState,
  patch: Partial<Omit<PartySystemState, 'revision'>>,
): PartySystemState {
  return { ...state, ...patch, revision: state.revision + 1 }
}

function accepted(state: PartySystemState): PartyActionResult {
  return { accepted: true, reason: null, state }
}

function rejected(state: PartySystemState, reason: PartyActionRejection): PartyActionResult {
  return { accepted: false, reason, state }
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
