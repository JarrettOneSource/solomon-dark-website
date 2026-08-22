import {
  clampAllyHudHealthRatio,
  deriveGolemAllyHudRows,
  type AllyHudRow,
} from './ally-hud.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import type { GameSnapshot } from './protocol/game-protocol.ts'
import type { LocalPartyState, PartyInvitationView } from './protocol/party-state.ts'

/**
 * One roster: the party list and the ally health bars are the same people, so
 * the HUD shows them once. Every party member is a row; rows in the local
 * world carry live health, rows elsewhere are "away".
 */
export type PartyRosterPresence = 'present' | 'fallen' | 'away'

export interface PartyRosterRow {
  readonly displayName: string
  readonly element: WizardElement | null
  readonly healthRatio: number | null
  readonly id: string
  readonly isLeader: boolean
  readonly isSelf: boolean
  readonly kind: 'golem' | 'player'
  readonly playerId: string | null
  readonly presence: PartyRosterPresence
}

export interface PartyRosterModel {
  /** Compact strip rows: party members in this world (never self) plus friendly golems. */
  readonly allies: readonly PartyRosterRow[]
  readonly invitations: readonly PartyInvitationView[]
  /** Every party member in join order (self included) for the expanded sheet. */
  readonly members: readonly PartyRosterRow[]
  readonly partyId: string | null
  readonly size: number
}

export interface PartyRosterInput {
  readonly additionalRows?: readonly AllyHudRow[]
  readonly partyState: LocalPartyState | null
  readonly playerId: string
  readonly snapshot: GameSnapshot
}

const EMPTY_ROWS: readonly AllyHudRow[] = []

export function snapshotAllyWorldKey(snapshot: GameSnapshot, playerId: string): string {
  return snapshot.world.kind === 'boneyard'
    ? `boneyard:${snapshot.world.runId}`
    : `hub:${snapshot.world.participants[playerId]?.region ?? 'courtyard'}`
}

function rowFromAllyHudRow(row: AllyHudRow): PartyRosterRow {
  const healthRatio = clampAllyHudHealthRatio(row.healthRatio)
  return row.identity.kind === 'player'
    ? {
        displayName: row.identity.displayName,
        element: row.identity.element,
        healthRatio,
        id: row.id,
        isLeader: false,
        isSelf: false,
        kind: 'player',
        playerId: row.id,
        presence: 'present',
      }
    : {
        displayName: 'Golem',
        element: null,
        healthRatio,
        id: row.id,
        isLeader: false,
        isSelf: false,
        kind: 'golem',
        playerId: null,
        presence: 'present',
      }
}

function memberRow(
  snapshot: GameSnapshot,
  playerId: string,
  memberId: string,
  partyState: LocalPartyState | null,
): PartyRosterRow {
  const player = snapshot.players[memberId]
  const profile = partyState?.hubPlayers.find((candidate) => candidate.playerId === memberId)
  const base = {
    displayName: player?.config.displayName ?? profile?.displayName ?? memberId,
    id: memberId,
    isLeader: partyState?.party.leaderPlayerId === memberId,
    isSelf: memberId === playerId,
    kind: 'player' as const,
    playerId: memberId,
  }
  if (!player) {
    return { ...base, element: null, healthRatio: null, presence: 'away' }
  }
  const healthRatio = clampAllyHudHealthRatio(
    player.progression.currentHealth / player.progression.maximumHealth,
  )
  if (snapshot.world.kind === 'hub') {
    const sameRegion = snapshot.world.participants[memberId]?.region
      === snapshot.world.participants[playerId]?.region
    return {
      ...base,
      element: player.config.element,
      healthRatio: sameRegion ? healthRatio : null,
      presence: sameRegion ? 'present' : 'away',
    }
  }
  const alive = player.progression.lifeState === 'alive' && player.progression.currentHealth > 0
  return {
    ...base,
    element: player.config.element,
    healthRatio: alive ? healthRatio : 0,
    presence: alive ? 'present' : 'fallen',
  }
}

export function buildPartyRoster({
  additionalRows = EMPTY_ROWS,
  partyState,
  playerId,
  snapshot,
}: PartyRosterInput): PartyRosterModel {
  const companionRows = [
    ...deriveGolemAllyHudRows(
      snapshot.secondaryAbilities.actors,
      snapshotAllyWorldKey(snapshot, playerId),
    ),
    ...additionalRows,
  ].map(rowFromAllyHudRow)

  if (partyState === null) {
    // Without party authority every other wizard in this world fights beside you.
    const allies = Object.keys(snapshot.players)
      .sort()
      .filter((id) => id !== playerId)
      .map((id) => memberRow(snapshot, playerId, id, null))
      .filter((row) => row.presence !== 'away')
    return {
      allies: [...allies, ...companionRows],
      invitations: [],
      members: [],
      partyId: null,
      size: 0,
    }
  }

  const members = partyState.party.memberPlayerIds.map((memberId) => (
    memberRow(snapshot, playerId, memberId, partyState)
  ))
  return {
    allies: [
      ...members.filter((row) => !row.isSelf && row.presence !== 'away'),
      ...companionRows,
    ],
    invitations: partyState.invitations,
    members,
    partyId: partyState.party.id,
    size: members.length,
  }
}

/** Rows that fit the compact strip and how many party rows it had to hide. */
export function compactPartyRosterRows(
  allies: readonly PartyRosterRow[],
  rowLimit: number,
): { hiddenCount: number; rows: readonly PartyRosterRow[] } {
  const limit = Math.max(0, Math.floor(rowLimit))
  if (allies.length <= limit) return { hiddenCount: 0, rows: allies }
  // Keep one line for the "+N" pill by surrendering the last visible row.
  const visible = Math.max(0, limit - 1)
  return { hiddenCount: allies.length - visible, rows: allies.slice(0, visible) }
}

export function partyRosterRowsEqual(
  left: readonly PartyRosterRow[],
  right: readonly PartyRosterRow[],
): boolean {
  return left.length === right.length && left.every((row, index) => {
    const other = right[index]
    return other !== undefined
      && row.displayName === other.displayName
      && row.element === other.element
      && row.healthRatio === other.healthRatio
      && row.id === other.id
      && row.isLeader === other.isLeader
      && row.isSelf === other.isSelf
      && row.kind === other.kind
      && row.playerId === other.playerId
      && row.presence === other.presence
  })
}

export function partyRosterModelsEqual(
  left: PartyRosterModel,
  right: PartyRosterModel,
): boolean {
  return left.partyId === right.partyId
    && left.size === right.size
    && left.invitations === right.invitations
    && partyRosterRowsEqual(left.allies, right.allies)
    && partyRosterRowsEqual(left.members, right.members)
}

/** Rows the compact strip shows before folding the rest behind the party pill. */
export function compactPartyRosterRowLimit(touch: boolean, uiScale: number): number {
  if (!touch) return 6
  return uiScale > 1.2 ? 1 : 3
}

/** The space the compact strip measures for its rows, in the strip's own px. */
export interface CompactPartyRosterSpace {
  /** The strip's column box: from its top edge down to the HUD zone reserved below it. */
  readonly availableHeight: number
  /** What the pills, the error line, and pending invitations already take, each with its column gap. */
  readonly fixedHeight: number
  readonly rowGap: number
  readonly rowHeight: number
}

/**
 * Ally rows that stack under the pills. The strip's box stops above the
 * movement joystick (touch) or the chat (mouse), so a party that outgrows the
 * screen folds behind the "+N more" pill instead of sliding under its
 * neighbour; a strip without layout fits nothing.
 */
export function compactPartyRosterRowsThatFit(space: CompactPartyRosterSpace): number {
  const pitch = space.rowHeight + space.rowGap
  if (!(pitch > 0)) return 0
  return Math.max(0, Math.floor((space.availableHeight - space.fixedHeight + space.rowGap) / pitch))
}
