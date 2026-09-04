import { collectAssetSources } from './game-asset-readiness.ts'
import { GAME_AUDIO_SOURCES } from './game-audio-assets.ts'
import {
  GameAudioDirector,
  type GameMusicChannel,
} from './game-audio-director.ts'
import { createWebAudioPlayback } from './game-audio-web-playback.ts'
import { createBrowserNativeSoundVoicePool } from './game-audio-native-sound-voice-pool.ts'
import nativeSoundVoicePoolWorklet from './game-audio-native-sound-voice-pool.worklet.js?url&no-inline'
import { createMediaElementGain } from '../lib/media-element-gain.ts'

const NATIVE_SOUND_VOICE_POOL_WORKLET = nativeSoundVoicePoolWorklet

const GAME_BUFFERED_AUDIO_SOURCES = collectAssetSources({
  loops: GAME_AUDIO_SOURCES.loops,
  sounds: GAME_AUDIO_SOURCES.sounds,
  streams: GAME_AUDIO_SOURCES.streams,
})
const GAME_MUSIC_SOURCES = collectAssetSources(GAME_AUDIO_SOURCES.music)
export const GAME_RESIDENT_AUDIO_SOURCES = [
  ...GAME_BUFFERED_AUDIO_SOURCES,
  ...GAME_MUSIC_SOURCES,
  NATIVE_SOUND_VOICE_POOL_WORKLET,
]

const bufferedSources = new Set(GAME_BUFFERED_AUDIO_SOURCES)
const musicSources = new Set(GAME_MUSIC_SOURCES)
const bufferPromises = new Map<string, Promise<AudioBuffer>>()
const buffers = new Map<string, AudioBuffer>()
const musicPromises = new Map<string, Promise<GameMusicChannel>>()
const musicChannels = new Map<string, GameMusicChannel>()
let audioContext: AudioContext | null = null
let nativeSoundVoicePoolReady = false
let nativeSoundVoicePoolPromise: Promise<void> | null = null

export function loadGameAudioAsset(
  source: string,
): Promise<AudioBuffer | GameMusicChannel | void> {
  if (bufferedSources.has(source)) return loadAudioBuffer(source)
  if (musicSources.has(source)) return loadMusicChannel(source)
  if (source === NATIVE_SOUND_VOICE_POOL_WORKLET) {
    return loadNativeSoundVoicePoolWorklet()
  }
  return Promise.reject(new Error(`unknown game audio asset: ${source}`))
}

export function loadModGameAudioAsset(source: string): Promise<AudioBuffer> {
  return loadAudioBuffer(source)
}

export function createBrowserGameAudioDirector(): GameAudioDirector {
  const context = residentAudioContext()
  if (!nativeSoundVoicePoolReady) {
    throw new Error('native sound voice pool was not loaded during game startup')
  }
  return new GameAudioDirector(GAME_AUDIO_SOURCES, {
    createMusicChannel: (source) => {
      const channel = musicChannels.get(source)
      return channel ?? createBrowserMusicChannel(context, new Audio(source))
    },
    mediaSession: navigator.mediaSession,
    playback: createWebAudioPlayback(
      context,
      buffers,
      (destination) => createBrowserNativeSoundVoicePool(
        context,
        destination,
        buffers,
      ),
    ),
  })
}

function loadNativeSoundVoicePoolWorklet(): Promise<void> {
  if (nativeSoundVoicePoolPromise) return nativeSoundVoicePoolPromise
  nativeSoundVoicePoolPromise = residentAudioContext().audioWorklet
    .addModule(NATIVE_SOUND_VOICE_POOL_WORKLET)
    .then(() => {
      nativeSoundVoicePoolReady = true
    })
  return nativeSoundVoicePoolPromise
}

function loadAudioBuffer(source: string): Promise<AudioBuffer> {
  const cached = bufferPromises.get(source)
  if (cached) return cached

  const promise = fetch(source)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`could not load game audio: ${source}`)
      }
      return response.arrayBuffer()
    })
    .then((contents) => residentAudioContext().decodeAudioData(contents))
    .then((buffer) => {
      buffers.set(source, buffer)
      return buffer
    })
  bufferPromises.set(source, promise)
  return promise
}

function loadMusicChannel(source: string): Promise<GameMusicChannel> {
  const cached = musicPromises.get(source)
  if (cached) return cached

  const promise = new Promise<GameMusicChannel>((resolve, reject) => {
    const audio = new Audio(source)
    audio.preload = 'auto'
    const cleanup = () => {
      audio.removeEventListener('loadeddata', handleLoaded)
      audio.removeEventListener('error', handleError)
    }
    const handleLoaded = () => {
      cleanup()
      const channel = createBrowserMusicChannel(residentAudioContext(), audio)
      musicChannels.set(source, channel)
      resolve(channel)
    }
    const handleError = () => {
      cleanup()
      reject(new Error(`could not load game audio: ${source}`))
    }
    audio.addEventListener('loadeddata', handleLoaded)
    audio.addEventListener('error', handleError)
    audio.load()
  })
  musicPromises.set(source, promise)
  return promise
}

function createBrowserMusicChannel(
  context: AudioContext,
  media: HTMLAudioElement,
): GameMusicChannel {
  const output = createMediaElementGain(context, media)
  return {
    get currentTime() { return media.currentTime },
    set currentTime(value) { media.currentTime = value },
    disconnect: output.disconnect,
    get loop() { return media.loop },
    set loop(value) { media.loop = value },
    get muted() { return media.muted },
    set muted(value) { media.muted = value },
    pause: () => media.pause(),
    get paused() { return media.paused },
    play: () => {
      output.connect()
      return media.play()
    },
    get preload() { return media.preload },
    set preload(value) { media.preload = value },
    get src() { return media.src },
    set src(value) { media.src = value },
    get volume() { return output.volume },
    set volume(value) { output.volume = value },
  }
}

function residentAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext({ latencyHint: 'interactive' })
  }
  return audioContext
}
