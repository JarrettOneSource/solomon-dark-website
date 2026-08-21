export interface PartyPlayerProfile {
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
