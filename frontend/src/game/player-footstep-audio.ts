import type { GameAudioDirector } from './game-audio-director.ts'
import {
  nativeFootstepCue,
  newNativeFootstepTick,
  type GameSoundCue,
} from './game-audio-native.ts'
import { playerAudioAttenuation } from './game-audio-spatial.ts'
import type { GameSnapshot } from './protocol/game-state.ts'

export interface PlayerFootstepAudioEvent {
  cue: GameSoundCue
  playerId: string
  tick: number
  volume: number
}

export type PlayerFootstepAudioObserver = (
  event: PlayerFootstepAudioEvent,
) => void

export class PlayerFootstepAudioSynchronizer {
  private readonly audio: GameAudioDirector
  private readonly localPlayerId: string
  private readonly observe: PlayerFootstepAudioObserver | undefined
  private previous: GameSnapshot

  constructor(
    audio: GameAudioDirector,
    localPlayerId: string,
    initialSnapshot: GameSnapshot,
    observe?: PlayerFootstepAudioObserver,
  ) {
    this.audio = audio
    this.localPlayerId = localPlayerId
    this.observe = observe
    this.previous = initialSnapshot
  }

  update(snapshot: GameSnapshot): PlayerFootstepAudioEvent[] {
    const events: PlayerFootstepAudioEvent[] = []
    for (const [playerId, player] of Object.entries(snapshot.players)) {
      const attenuation = playerAudioAttenuation(
        snapshot,
        this.localPlayerId,
        playerId,
      )
      if (attenuation === null) continue
      const tick = newNativeFootstepTick(this.previous.players[playerId], player)
      if (tick === undefined) continue
      const event = {
        cue: nativeFootstepCue(tick, playerId),
        playerId,
        tick,
        volume: 0.5 * attenuation,
      } as const
      this.observe?.(event)
      this.audio.playSound(event.cue, { volume: event.volume })
      events.push(event)
    }
    this.previous = snapshot
    return events
  }
}
