import type { GameAudioDirector } from './game-audio-director.ts'

export const BONEYARD_WEATHER_AUDIO_CUE = 'rainfall-loop' as const
export const BONEYARD_WEATHER_AUDIO_OWNER = 'boneyard-weather:rainfall'

export interface BoneyardWeatherAudioRequest {
  readonly cue: typeof BONEYARD_WEATHER_AUDIO_CUE
  readonly gain: number
}

export function nativeBoneyardWeatherAudioRequest(
  environmentMode: number,
): BoneyardWeatherAudioRequest {
  return {
    cue: BONEYARD_WEATHER_AUDIO_CUE,
    gain: environmentMode === 1 ? 0.4 : environmentMode === 2 ? 1 : 0,
  }
}

export class BoneyardWeatherAudioSynchronizer {
  private readonly audio: Pick<GameAudioDirector, 'startLoop' | 'stopLoop'>
  private activeGain: number | null = null

  constructor(audio: Pick<GameAudioDirector, 'startLoop' | 'stopLoop'>) {
    this.audio = audio
  }

  update(environmentMode: number): BoneyardWeatherAudioRequest {
    const request = nativeBoneyardWeatherAudioRequest(environmentMode)
    if (request.gain > 0) {
      this.audio.startLoop(request.cue, BONEYARD_WEATHER_AUDIO_OWNER, {
        volume: request.gain,
      })
      this.activeGain = request.gain
    } else if (this.activeGain !== null) {
      this.audio.stopLoop(BONEYARD_WEATHER_AUDIO_CUE, BONEYARD_WEATHER_AUDIO_OWNER)
      this.activeGain = null
    }
    return request
  }

  destroy(): void {
    if (this.activeGain === null) return
    this.audio.stopLoop(BONEYARD_WEATHER_AUDIO_CUE, BONEYARD_WEATHER_AUDIO_OWNER)
    this.activeGain = null
  }
}
