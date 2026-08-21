import type { PartyMembership } from '../protocol/party-state.ts'

export interface PublicPartyDirectoryEntry {
  readonly boneyardName: string | null
  readonly id: string
  readonly leader: string
  readonly maxMembers: number
  readonly memberCount: number
  readonly members: readonly string[]
  readonly status: 'hub' | 'playing'
}

interface PublicPartyDirectorySource {
  readonly memberships: readonly PartyMembership[]
  readonly runs: readonly {
    readonly boneyardName: string
    readonly partyId: string
  }[]
}

export function projectPublicPartyDirectory(
  source: PublicPartyDirectorySource,
  displayNames: ReadonlyMap<string, string>,
  maxMembers: number,
): readonly PublicPartyDirectoryEntry[] {
  const runsByParty = new Map(source.runs.map(run => [run.partyId, run]))
  return source.memberships.flatMap((party) => {
    if (party.memberPlayerIds.length < 2) return []
    const leader = displayNames.get(party.leaderPlayerId)
    if (leader === undefined) return []
    const members: string[] = []
    for (const playerId of party.memberPlayerIds) {
      const displayName = displayNames.get(playerId)
      if (displayName === undefined) return []
      members.push(displayName)
    }
    const run = runsByParty.get(party.id)
    return [{
      boneyardName: run?.boneyardName ?? null,
      id: party.id,
      leader,
      maxMembers,
      memberCount: members.length,
      members,
      status: run ? 'playing' as const : 'hub' as const,
    }]
  })
}
