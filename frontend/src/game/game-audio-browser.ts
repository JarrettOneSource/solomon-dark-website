import { collectAssetSources } from './game-asset-readiness.ts'
import { GAME_AUDIO_SOURCES } from './game-audio-assets.ts'
import { GameAudioDirector } from './game-audio-director.ts'
import { createWebAudioPlayback } from './game-audio-web-playback.ts'

const GAME_BUFFERED_AUDIO_SOURCES = collectAssetSources({
  loops: GAME_AUDIO_SOURCES.loops,
  sounds: GAME_AUDIO_SOURCES.sounds,
  streams: GAME_AUDIO_SOURCES.streams,
})
const GAME_MUSIC_SOURCES = collectAssetSources(GAME_AUDIO_SOURCES.music)
export const GAME_RESIDENT_AUDIO_SOURCES = [
  ...GAME_BUFFERED_AUDIO_SOURCES,
  ...GAME_MUSIC_SOURCES,
]

const bufferedSources = new Set(GAME_BUFFERED_AUDIO_SOURCES)
const musicSources = new Set(GAME_MUSIC_SOURCES)
const bufferPromises = new Map<string, Promise<AudioBuffer>>()
const buffers = new Map<string, AudioBuffer>()
const musicPromises = new Map<string, Promise<HTMLAudioElement>>()
const musicChannels = new Map<string, HTMLAudioElement>()
let audioContext: AudioContext | null = null

export function loadGameAudioAsset(
  source: string,
): Promise<AudioBuffer | HTMLAudioElement> {
  if (bufferedSources.has(source)) return loadAudioBuffer(source)
  if (musicSources.has(source)) return loadMusicChannel(source)
  return Promise.reject(new Error(`unknown game audio asset: ${source}`))
}

export function createBrowserGameAudioDirector(): GameAudioDirector {
  const context = residentAudioContext()
  return new GameAudioDirector(GAME_AUDIO_SOURCES, {
    createMusicChannel: (source) => {
      const channel = musicChannels.get(source)
      if (!channel) throw new Error(`game music was not loaded: ${source}`)
      return channel
    },
    playback: createWebAudioPlayback(context, buffers),
  })
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

function loadMusicChannel(source: string): Promise<HTMLAudioElement> {
  const cached = musicPromises.get(source)
  if (cached) return cached

  const promise = new Promise<HTMLAudioElement>((resolve, reject) => {
    const audio = new Audio(source)
    audio.preload = 'auto'
    const cleanup = () => {
      audio.removeEventListener('loadeddata', handleLoaded)
      audio.removeEventListener('error', handleError)
    }
    const handleLoaded = () => {
      cleanup()
      musicChannels.set(source, audio)
      resolve(audio)
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

function residentAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext({ latencyHint: 'interactive' })
  }
  return audioContext
}
