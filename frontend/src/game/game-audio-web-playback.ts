import type {
  GameAudioPlayback,
  GameAudioPlaybackOptions,
} from './game-audio-director.ts'
import type { NativeSoundVoicePool } from './game-audio-native-sound-voice-pool.ts'

interface OwnedBufferSource {
  gain: GainNode
  source: AudioBufferSourceNode
}

export type CreateNativeSoundVoicePool = (
  destination: AudioNode,
) => NativeSoundVoicePool

export function createWebAudioPlayback(
  context: AudioContext,
  residentBuffers: ReadonlyMap<string, AudioBuffer>,
  createNativeSoundVoices?: CreateNativeSoundVoicePool,
): GameAudioPlayback {
  const channels = new Map<string, OwnedBufferSource>()
  const oneShots = new Set<OwnedBufferSource>()
  const masterGain = context.createGain()
  let nativeSoundVoices: NativeSoundVoicePool | null = null
  masterGain.connect(context.destination)

  const release = (owned: OwnedBufferSource) => {
    owned.source.onended = null
    owned.source.disconnect()
    owned.gain.disconnect()
  }

  const stop = (owned: OwnedBufferSource) => {
    owned.source.onended = null
    owned.source.stop()
    release(owned)
  }

  const makeSource = (
    source: string,
    options: GameAudioPlaybackOptions,
  ): OwnedBufferSource => {
    const buffer = residentBuffers.get(source)
    if (!buffer) throw new Error(`game audio buffer was not loaded: ${source}`)
    const bufferSource = context.createBufferSource()
    const gain = context.createGain()
    bufferSource.buffer = buffer
    bufferSource.loop = options.loop ?? false
    bufferSource.playbackRate.value = options.playbackRate
    gain.gain.value = options.volume
    bufferSource.connect(gain)
    gain.connect(masterGain)
    return { gain, source: bufferSource }
  }

  const start = (owned: OwnedBufferSource, options: GameAudioPlaybackOptions) => {
    const offsetSeconds = options.offsetSeconds ?? 0
    if (offsetSeconds > 0) owned.source.start(0, offsetSeconds)
    else owned.source.start()
  }

  return {
    destroy() {
      for (const owned of oneShots) stop(owned)
      oneShots.clear()
      for (const owned of channels.values()) stop(owned)
      channels.clear()
      nativeSoundVoices?.destroy()
      nativeSoundVoices = null
      masterGain.disconnect()
      if (context.state === 'running') void context.suspend().catch(() => {})
    },
    play(source, options) {
      if (options.maximumVoices !== undefined) {
        if (!createNativeSoundVoices) {
          throw new Error('native sound voice pool was not configured')
        }
        nativeSoundVoices ??= createNativeSoundVoices(masterGain)
        nativeSoundVoices.play(source, options)
        return
      }
      const owned = makeSource(source, options)
      oneShots.add(owned)
      owned.source.onended = () => {
        oneShots.delete(owned)
        release(owned)
      }
      start(owned, options)
    },
    restart(key, source, options) {
      const current = channels.get(key)
      if (current) stop(current)
      const owned = makeSource(source, options)
      channels.set(key, owned)
      owned.source.onended = () => {
        if (channels.get(key) === owned) channels.delete(key)
        release(owned)
      }
      start(owned, options)
    },
    setMasterVolume(volume) {
      masterGain.gain.value = volume
    },
    setVolume(key, volume) {
      const owned = channels.get(key)
      if (owned) owned.gain.gain.value = volume
    },
    stop(key) {
      const owned = channels.get(key)
      if (!owned) return
      channels.delete(key)
      stop(owned)
    },
    unlock() {
      if (context.state !== 'running' && context.state !== 'closed') {
        void context.resume().catch(() => {})
      }
    },
  }
}
