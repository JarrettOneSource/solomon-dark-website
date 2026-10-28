import type { GameSnapshot } from './protocol/game-state.ts'
import { hubAudioAttenuation } from './game-audio-native.ts'

type GameAudioSpatialSnapshot = Pick<GameSnapshot, 'players' | 'world'>

export function playerAudioWorldKey(
  snapshot: GameAudioSpatialSnapshot,
  playerId: string,
): string | null {
  if (!snapshot.players[playerId]) return null
  if (snapshot.world.kind === 'boneyard') return `boneyard:${snapshot.world.runId}`
  const participant = snapshot.world.participants[playerId]
  return participant ? `hub:${participant.region}` : null
}

export function playerAudioAttenuation(
  snapshot: GameAudioSpatialSnapshot,
  listenerId: string,
  sourceId: string,
): number | null {
  const listener = snapshot.players[listenerId]
  const source = snapshot.players[sourceId]
  const listenerWorldKey = playerAudioWorldKey(snapshot, listenerId)
  if (
    !listener
    || !source
    || !listenerWorldKey
    || playerAudioWorldKey(snapshot, sourceId) !== listenerWorldKey
  ) return null
  return hubAudioAttenuation(Math.hypot(
    source.position.x - listener.position.x,
    source.position.y - listener.position.y,
  ))
}
