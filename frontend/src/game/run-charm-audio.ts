import type { GameAudioDirector } from './game-audio-director.ts'
import { nativePlayerCharmLossStreamRequest } from './game-audio-native.ts'
import type { BoneyardEnemyEventSnapshot } from './protocol/game-state.ts'

/** The session event lane already suppresses historical and repeated events. */
export function subscribeRunCharmLossAudio(
  audio: Pick<GameAudioDirector, 'playStream' | 'stopStream'>,
  playerId: string,
  runId: string,
  subscribe: (listener: (event: BoneyardEnemyEventSnapshot) => void) => () => void,
): () => void {
  const unsubscribe = subscribe(event => {
    if (event.runId !== runId) return
    const request = nativePlayerCharmLossStreamRequest(event, playerId)
    if (request) audio.playStream(request.cue, request)
  })
  return () => {
    unsubscribe()
    audio.stopStream('lose-reverie')
  }
}
