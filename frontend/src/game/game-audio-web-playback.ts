import type {
  GameAudioPlayback,
  GameAudioPlaybackOptions,
} from './game-audio-director.ts'

interface OwnedBufferSource {
  gain: GainNode
  source: AudioBufferSourceNode
}

export function createWebAudioPlayback(
  context: AudioContext,
  residentBuffers: ReadonlyMap<string, AudioBuffer>,
): GameAudioPlayback {
  const channels = new Map<string, OwnedBufferSource>()
  const oneShots = new Set<OwnedBufferSource>()

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
    gain.connect(context.destination)
    return { gain, source: bufferSource }
  }

  return {
    destroy() {
      for (const owned of oneShots) stop(owned)
      oneShots.clear()
      for (const owned of channels.values()) stop(owned)
      channels.clear()
      if (context.state === 'running') void context.suspend().catch(() => {})
    },
    play(source, options) {
      const owned = makeSource(source, options)
      oneShots.add(owned)
      owned.source.onended = () => {
        oneShots.delete(owned)
        release(owned)
      }
      owned.source.start()
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
      owned.source.start()
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
