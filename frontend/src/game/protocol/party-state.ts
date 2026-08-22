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
  readonly leaderPlayerId: string
  readonly memberPlayerIds: readonly string[]
}

export interface PartyInvitationView {
  readonly id: string
  readonly inviter: PartyPlayerProfile
  readonly partyId: string
}

export interface LocalPartyState {
  readonly hubPlayers: readonly PartyPlayerProfile[]
  readonly invitations: readonly PartyInvitationView[]
  readonly party: PartyMembership
  readonly revision: number
}
