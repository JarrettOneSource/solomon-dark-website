import type {
  HubPlayerActivity,
  ProtocolHubParticipantState,
  ProtocolPlayerState,
} from './protocol/game-state.ts'

export const HUB_PLAYER_ACTIVITY_LABELS: Readonly<Record<HubPlayerActivity, string>> = {
  occupied: 'Occupied',
  paused: 'Paused',
}

export interface HubPlayerActivityItem {
  readonly activity: HubPlayerActivity
  readonly playerId: string
  readonly position: Readonly<{ x: number; y: number }>
}

export function hubPlayerActivityLabel(activity: HubPlayerActivity): string {
  return HUB_PLAYER_ACTIVITY_LABELS[activity]
}

export function hubPlayerActivities(
  participants: Readonly<Record<string, ProtocolHubParticipantState>>,
): Readonly<Record<string, HubPlayerActivity | null>> {
  return Object.fromEntries(Object.entries(participants).map(([playerId, participant]) => (
    [playerId, participant.activity]
  )))
}

export function sameHubPlayerActivities(
  left: Readonly<Record<string, HubPlayerActivity | null>>,
  right: Readonly<Record<string, HubPlayerActivity | null>>,
): boolean {
  const leftIds = Object.keys(left)
  const rightIds = Object.keys(right)
  return leftIds.length === rightIds.length
    && leftIds.every((playerId) => left[playerId] === right[playerId])
}

export function deriveHubPlayerActivityItems(
  players: Readonly<Record<string, ProtocolPlayerState>>,
  participants: Readonly<Record<string, ProtocolHubParticipantState>>,
  viewerRegion: ProtocolHubParticipantState['region'],
): readonly HubPlayerActivityItem[] {
  return Object.entries(participants).flatMap(([playerId, participant]) => {
    const player = players[playerId]
    return participant.activity !== null
      && participant.region === viewerRegion
      && player
      ? [{
          activity: participant.activity,
          playerId,
          position: player.position,
        }]
      : []
  }).sort((left, right) => left.playerId.localeCompare(right.playerId))
}
