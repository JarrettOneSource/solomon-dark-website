import type { PartyMembership } from '../protocol/party-state.ts'

/**
 * One connected participant's live location, projected for the developer-only
 * presence directory. Unlike the public party directory this includes every
 * participant — humans and bots, solo or grouped, private parties included —
 * so it must only ever be served to authenticated developer accounts.
 */
export interface HostPresenceEntry {
  readonly accountUsername: string | null
  readonly activity: 'boneyard' | 'hub'
  readonly boneyardName: string | null
  readonly bot: boolean
  readonly developer: boolean
  readonly displayName: string
  readonly partyLeader: string | null
  readonly partySize: number | null
  readonly waveNumber: number | null
}

export interface HostPresenceParticipant {
  readonly accountUsername: string | null
  readonly bot: boolean
  readonly developer: boolean
  readonly displayName: string
  readonly playerId: string
}

export interface HostPresenceWorlds {
  readonly hubPlayerIds: readonly string[]
  readonly runs: readonly {
    readonly boneyardName: string
    readonly playerIds: readonly string[]
    readonly waveNumber: number
  }[]
}

export function projectHostPresence(
  participants: readonly HostPresenceParticipant[],
  worlds: HostPresenceWorlds,
  memberships: readonly PartyMembership[],
): readonly HostPresenceEntry[] {
  const displayNames = new Map(participants.map(
    participant => [participant.playerId, participant.displayName],
  ))
  const hubPlayerIds = new Set(worlds.hubPlayerIds)
  const runsByPlayer = new Map<string, HostPresenceWorlds['runs'][number]>()
  for (const run of worlds.runs) {
    for (const playerId of run.playerIds) runsByPlayer.set(playerId, run)
  }
  // Every participant owns a singleton party from registration; only real
  // groups (two or more members) count as "in a party" here.
  const partiesByPlayer = new Map<string, PartyMembership>()
  for (const membership of memberships) {
    if (membership.memberPlayerIds.length < 2) continue
    for (const playerId of membership.memberPlayerIds) partiesByPlayer.set(playerId, membership)
  }
  return participants.flatMap((participant) => {
    const run = runsByPlayer.get(participant.playerId)
    if (!run && !hubPlayerIds.has(participant.playerId)) return []
    const membership = partiesByPlayer.get(participant.playerId)
    const leaderName = membership === undefined
      ? undefined
      : displayNames.get(membership.leaderPlayerId)
    return [{
      accountUsername: participant.accountUsername,
      activity: run ? 'boneyard' as const : 'hub' as const,
      boneyardName: run?.boneyardName ?? null,
      bot: participant.bot,
      developer: participant.developer,
      displayName: participant.displayName,
      partyLeader: leaderName ?? null,
      partySize: membership !== undefined && leaderName !== undefined
        ? membership.memberPlayerIds.length
        : null,
      waveNumber: run?.waveNumber ?? null,
    }]
  })
}
