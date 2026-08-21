import type { GameAudioDirector } from './game-audio-director.ts'
import { BONEYARD_GAME_OVER_EXIT_FADE_TICKS } from './core-kernels/game-run.ts'

export const BONEYARD_WEATHER_AUDIO_CUE = 'rainfall-loop' as const
export const BONEYARD_WEATHER_AUDIO_OWNER = 'boneyard-weather:rainfall'

export interface BoneyardWeatherAudioRequest {
  readonly cue: typeof BONEYARD_WEATHER_AUDIO_CUE
  readonly gain: number
}

export function nativeBoneyardWeatherAudioRequest(
  environmentMode: number,
  arenaFade: number = 0,
): BoneyardWeatherAudioRequest {
  const gain = environmentMode === 1 ? 0.4 : environmentMode === 2 ? 1 : 0
  return {
    cue: BONEYARD_WEATHER_AUDIO_CUE,
    gain: gain * (1 - clampUnit(arenaFade)),
  }
}

export function nativeBoneyardWeatherArenaFade(gameOverExitTicks: number | null): number {
  if (gameOverExitTicks === null) return 0
  return clampUnit(gameOverExitTicks / BONEYARD_GAME_OVER_EXIT_FADE_TICKS)
}

export class BoneyardWeatherAudioSynchronizer {
  private readonly audio: Pick<GameAudioDirector, 'startLoop' | 'stopLoop'>
  private activeGain: number | null = null

  constructor(audio: Pick<GameAudioDirector, 'startLoop' | 'stopLoop'>) {
    this.audio = audio
  }

  update(environmentMode: number, arenaFade: number = 0): BoneyardWeatherAudioRequest {
    const request = nativeBoneyardWeatherAudioRequest(environmentMode, arenaFade)
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

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}
