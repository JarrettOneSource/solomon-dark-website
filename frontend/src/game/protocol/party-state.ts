/**
 * Self-reported social identity a client presents in its hello. The host
 * attaches it verbatim to the player's projected profile; it never gates
 * gameplay authority.
 */
export interface PlayerSocialProfile {
  readonly accountUsername: string | null
  readonly highestWave: number | null
  readonly totalPlaytimeMs: number | null
}

export interface PartyPlayerProfile extends PlayerSocialProfile {
  readonly displayName: string
  readonly playerId: string
}

export interface PartyMembership {
  readonly id: string
  readonly joinCode: string
  readonly leaderPlayerId: string
  readonly listingId: string
  readonly memberPlayerIds: readonly string[]
  readonly visibility: PartyVisibility
}

export const PARTY_VISIBILITIES = ['public', 'invite-only', 'private'] as const
export type PartyVisibility = typeof PARTY_VISIBILITIES[number]

export interface PartyInvitationView {
  readonly id: string
  readonly inviter: PartyPlayerProfile
  readonly partyId: string
}

export interface PartyJoinRequester {
  readonly accountUsername: string | null
  readonly displayName: string
  readonly requesterId: string
}

export interface PartyJoinRequestView {
  readonly id: string
  readonly requester: PartyJoinRequester
}

export interface LocalPartyState {
  readonly hubPlayers: readonly PartyPlayerProfile[]
  readonly invitations: readonly PartyInvitationView[]
  readonly joinRequests: readonly PartyJoinRequestView[]
  readonly party: PartyMembership
  readonly revision: number
}
