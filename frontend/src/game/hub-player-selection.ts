import type { HubGameSnapshot } from './client/hub-presentation-timeline.ts'
import type { Vector2 } from './core-kernels/vector.ts'

export const HUB_PLAYER_SELECTION_HALF_WIDTH = 45
export const HUB_PLAYER_SELECTION_TOP = 110
export const HUB_PLAYER_SELECTION_BOTTOM = 30
export const HUB_CONTROLLER_PLAYER_INTERACTION_RADIUS = 120

export function selectHubPlayerAtPoint(
  snapshot: HubGameSnapshot,
  localPlayerId: string,
  point: Vector2,
): string | null {
  const localRegion = snapshot.world.participants[localPlayerId]?.region
  if (!localRegion || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  let selected: { playerId: string; y: number; order: number } | null = null
  let order = 0
  for (const [playerId, player] of Object.entries(snapshot.players)) {
    const candidateOrder = order
    order += 1
    if (
      playerId === localPlayerId
      || snapshot.world.participants[playerId]?.region !== localRegion
      || point.x < player.position.x - HUB_PLAYER_SELECTION_HALF_WIDTH
      || point.x > player.position.x + HUB_PLAYER_SELECTION_HALF_WIDTH
      || point.y < player.position.y - HUB_PLAYER_SELECTION_TOP
      || point.y > player.position.y + HUB_PLAYER_SELECTION_BOTTOM
    ) continue
    if (
      selected === null
      || player.position.y > selected.y
      || (player.position.y === selected.y && candidateOrder > selected.order)
    ) {
      selected = { order: candidateOrder, playerId, y: player.position.y }
    }
  }
  return selected?.playerId ?? null
}

export function nearestHubPlayer(
  snapshot: HubGameSnapshot,
  localPlayerId: string,
  maximumDistance = HUB_CONTROLLER_PLAYER_INTERACTION_RADIUS,
): string | null {
  const local = snapshot.players[localPlayerId]
  const localRegion = snapshot.world.participants[localPlayerId]?.region
  if (!local || !localRegion || !(maximumDistance > 0) || !Number.isFinite(maximumDistance)) {
    return null
  }
  let nearest: { distanceSquared: number; playerId: string } | null = null
  for (const [playerId, player] of Object.entries(snapshot.players)) {
    if (playerId === localPlayerId || snapshot.world.participants[playerId]?.region !== localRegion) {
      continue
    }
    const dx = player.position.x - local.position.x
    const dy = player.position.y - local.position.y
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared > maximumDistance * maximumDistance) continue
    if (!nearest || distanceSquared < nearest.distanceSquared) {
      nearest = { distanceSquared, playerId }
    }
  }
  return nearest?.playerId ?? null
}
