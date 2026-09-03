import type {
  NativeUiPartyMenuMember,
  NativeUiPartyMenuRequest,
  NativeUiPartyMenuTag,
  NativeUiPartyMenuVisibilityOption,
} from './native-ui/core.ts'
import type { GameSessionKind } from './protocol/game-protocol.ts'
import {
  PARTY_VISIBILITIES,
  type LocalPartyState,
  type PartyVisibility,
} from './protocol/party-state.ts'

const VISIBILITY_LABELS: Readonly<Record<PartyVisibility, string>> = Object.freeze({
  'invite-only': 'INVITE ONLY',
  private: 'PRIVATE',
  public: 'PUBLIC',
})

export const PARTY_MENU_VISIBILITY_OPTIONS: readonly NativeUiPartyMenuVisibilityOption[] = Object.freeze(
  PARTY_VISIBILITIES.map(id => Object.freeze({ id, label: VISIBILITY_LABELS[id] })),
)

/** What the stock party menu shows for one player's view of their party. */
export interface PartyMenuModel {
  /** Join code for the Settings tab; only the leader sees it. */
  readonly code: string | null
  readonly leader: boolean
  readonly leaveLabel: string | null
  readonly members: readonly NativeUiPartyMenuMember[]
  readonly requests: readonly NativeUiPartyMenuRequest[]
  readonly visibility: PartyVisibility
  readonly visibilityOptions: readonly NativeUiPartyMenuVisibilityOption[]
}

export function partyMenuModel(
  state: LocalPartyState,
  playerId: string,
  sessionKind: GameSessionKind,
): PartyMenuModel {
  const leader = state.party.leaderPlayerId === playerId
  return {
    code: leader ? state.party.joinCode : null,
    leader,
    leaveLabel: partyMenuLeaveLabel(state.party.memberPlayerIds.length, sessionKind),
    members: state.party.memberPlayerIds.map((id) => {
      const roster = state.partyRoster.find(player => player.playerId === id)
      const tags: NativeUiPartyMenuTag[] = []
      if (id === playerId) tags.push('you')
      if (id === state.party.leaderPlayerId) tags.push('leader')
      if (roster && !roster.connected) tags.push('offline')
      return {
        id,
        name: partyMemberDisplayName(state, id),
        removable: leader && id !== playerId,
        tags,
      }
    }),
    requests: leader
      ? state.joinRequests.map(request => ({ id: request.id, name: request.requester.displayName }))
      : [],
    visibility: state.party.visibility,
    visibilityOptions: PARTY_MENU_VISIBILITY_OPTIONS,
  }
}

/**
 * A college session always offers the way out; a hub party only once there is
 * somebody else in it, since leaving a solo party is a no-op.
 */
export function partyMenuLeaveLabel(memberCount: number, sessionKind: GameSessionKind): string | null {
  if (sessionKind === 'private-college') return 'LEAVE COLLEGE'
  return memberCount > 1 ? 'LEAVE PARTY' : null
}

export function partyMemberDisplayName(state: LocalPartyState, id: string): string {
  return state.hubPlayers.find(player => player.playerId === id)?.displayName
    ?? state.partyRoster.find(player => player.playerId === id)?.displayName
    ?? id
}

export function partyMenuVisibility(id: string): PartyVisibility | null {
  return (PARTY_VISIBILITIES as readonly string[]).includes(id) ? id as PartyVisibility : null
}
