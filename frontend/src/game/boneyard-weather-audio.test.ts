import assert from 'node:assert/strict'
import test from 'node:test'

import type { GameLoopCue } from './game-audio-native.ts'
import {
  BONEYARD_WEATHER_AUDIO_OWNER,
  BoneyardWeatherAudioSynchronizer,
  nativeBoneyardWeatherArenaFade,
  nativeBoneyardWeatherAudioRequest,
} from './boneyard-weather-audio.ts'

class RecordingAudio {
  readonly starts: readonly { cue: GameLoopCue; owner: string; volume?: number }[] = []
  readonly stops: readonly { cue: GameLoopCue; owner: string }[] = []

  startLoop(cue: GameLoopCue, owner: string, options: { volume?: number } = {}): void {
    ;(this.starts as { cue: GameLoopCue; owner: string; volume?: number }[]).push({
      cue,
      owner,
      volume: options.volume,
    })
  }

  stopLoop(cue: GameLoopCue, owner: string): void {
    ;(this.stops as { cue: GameLoopCue; owner: string }[]).push({ cue, owner })
  }
}

test('native weather audio uses the shared rainfall loop and mode gains', () => {
  assert.deepEqual(nativeBoneyardWeatherAudioRequest(0), {
    cue: 'rainfall-loop',
    gain: 0,
  })
  assert.deepEqual(nativeBoneyardWeatherAudioRequest(1), {
    cue: 'rainfall-loop',
    gain: 0.4,
  })
  assert.deepEqual(nativeBoneyardWeatherAudioRequest(2), {
    cue: 'rainfall-loop',
    gain: 1,
  })
  assert.equal(nativeBoneyardWeatherArenaFade(null, null), 0)
  assert.equal(nativeBoneyardWeatherArenaFade(10, 'input'), 0.5)
  assert.equal(nativeBoneyardWeatherArenaFade(125, 'automatic'), 0.5)
  assert.deepEqual(nativeBoneyardWeatherAudioRequest(1, 0.5), {
    cue: 'rainfall-loop',
    gain: 0.2,
  })
  assert.equal(nativeBoneyardWeatherAudioRequest(2, 1).gain, 0)
  assert.equal(nativeBoneyardWeatherAudioRequest(3).gain, 0)
})

test('weather audio owns one channel separately from right-click rain owners', () => {
  const audio = new RecordingAudio()
  const synchronizer = new BoneyardWeatherAudioSynchronizer(audio)
  synchronizer.update(1)
  synchronizer.update(2, 0.5)
  synchronizer.update(0)
  synchronizer.destroy()
  assert.deepEqual(audio.starts, [
    { cue: 'rainfall-loop', owner: BONEYARD_WEATHER_AUDIO_OWNER, volume: 0.4 },
    { cue: 'rainfall-loop', owner: BONEYARD_WEATHER_AUDIO_OWNER, volume: 0.5 },
  ])
  assert.deepEqual(audio.stops, [{ cue: 'rainfall-loop', owner: BONEYARD_WEATHER_AUDIO_OWNER }])
})
