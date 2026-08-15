import {
  GAME_SCENE_MUSIC,
  NATIVE_AUDIO_TICK_MS,
  type GameAudioScene,
  type GameAudioSources,
  type GameLoopCue,
  type GameSoundCue,
  type GameStreamCue,
} from './game-audio-native.ts'

export type GameMusicChannel = Pick<
  HTMLAudioElement,
  | 'currentTime'
  | 'loop'
  | 'muted'
  | 'pause'
  | 'paused'
  | 'play'
  | 'preload'
  | 'src'
  | 'volume'
>

export interface GameAudioPlaybackOptions {
  loop?: boolean
  playbackRate: number
  volume: number
}

export interface GameAudioPlayback {
  destroy(): void
  play(source: string, options: GameAudioPlaybackOptions): void
  restart(key: string, source: string, options: GameAudioPlaybackOptions): void
  setVolume(key: string, volume: number): void
  stop(key: string): void
  unlock(): void
}

export interface GameAudioDirectorOptions {
  cancelFrame?: (handle: number) => void
  createMusicChannel: (source: string) => GameMusicChannel
  now?: () => number
  playback: GameAudioPlayback
  requestFrame?: (callback: FrameRequestCallback) => number
}

export interface PlaySoundOptions {
  playbackRate?: number
  volume?: number
}

const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

export class GameAudioDirector {
  private cancelFrame: (handle: number) => void
  private createMusicChannel: (source: string) => GameMusicChannel
  private currentMusic: GameMusicChannel | null = null
  private fadeFrame = 0
  private generation = 0
  private musicScene: GameAudioScene | null = null
  private loops = new Map<GameLoopCue, Map<string, Required<PlaySoundOptions>>>()
  private now: () => number
  private outgoingMusic: GameMusicChannel | null = null
  private playback: GameAudioPlayback
  private requestFrame: (callback: FrameRequestCallback) => number
  private readonly sources: GameAudioSources

  constructor(
    sources: GameAudioSources,
    options: GameAudioDirectorOptions,
  ) {
    this.sources = sources
    this.createMusicChannel = options.createMusicChannel
    this.playback = options.playback
    this.now = options.now ?? (() => performance.now())
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback))
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle))
  }

  setScene(scene: GameAudioScene): void {
    if (scene === this.musicScene && this.currentMusic) return

    this.cancelMusicFade()
    this.stopAndReset(this.outgoingMusic)
    this.outgoingMusic = this.currentMusic
    this.currentMusic = this.makeMusicChannel(
      this.sources.music[GAME_SCENE_MUSIC[scene].cue],
    )
    this.currentMusic.currentTime = 0
    this.currentMusic.loop = true
    this.currentMusic.volume = 0
    this.musicScene = scene
    this.generation += 1

    void this.startCurrentMusic(this.generation)
  }

  unlock(): void {
    this.playback.unlock()
    if (this.currentMusic?.paused) {
      this.currentMusic.currentTime = 0
      void this.startCurrentMusic(this.generation)
    }
  }

  startLoop(
    cue: GameLoopCue,
    owner: string,
    options: PlaySoundOptions = {},
  ): void {
    let owners = this.loops.get(cue)
    const next = {
      playbackRate: options.playbackRate ?? 1,
      volume: clampUnit(options.volume ?? 1),
    }
    if (!owners) {
      owners = new Map()
      this.loops.set(cue, owners)
    }
    const current = owners.get(owner)
    if (current?.playbackRate === next.playbackRate) {
      if (current.volume !== next.volume) {
        this.playback.setVolume(loopKey(cue, owner), next.volume)
        owners.set(owner, next)
      }
      return
    }
    this.playback.restart(loopKey(cue, owner), this.sources.loops[cue], {
      loop: true,
      ...next,
    })
    owners.set(owner, next)
  }

  stopLoop(cue: GameLoopCue, owner: string): void {
    const owners = this.loops.get(cue)
    if (!owners || !owners.delete(owner)) return
    this.playback.stop(loopKey(cue, owner))
    if (owners.size === 0) this.loops.delete(cue)
  }

  stopLoopsForOwner(owner: string): void {
    for (const cue of this.loops.keys()) this.stopLoop(cue, owner)
  }

  playSound(cue: GameSoundCue, options: PlaySoundOptions = {}): void {
    this.playback.play(this.sources.sounds[cue], {
      playbackRate: options.playbackRate ?? 1,
      volume: clampUnit(options.volume ?? 1),
    })
  }

  playStream(cue: GameStreamCue, options: PlaySoundOptions = {}): void {
    this.playback.restart(streamKey(cue), this.sources.streams[cue], {
      playbackRate: options.playbackRate ?? 1,
      volume: clampUnit(options.volume ?? 1),
    })
  }

  pauseStream(cue: GameStreamCue): void {
    this.playback.stop(streamKey(cue))
  }

  stopStream(cue: GameStreamCue): void {
    this.playback.stop(streamKey(cue))
  }

  stopStreams(cues: readonly GameStreamCue[]): void {
    for (const cue of cues) this.stopStream(cue)
  }

  destroy(): void {
    this.generation += 1
    this.cancelMusicFade()
    this.stopAndReset(this.currentMusic)
    this.stopAndReset(this.outgoingMusic)
    this.currentMusic = null
    this.outgoingMusic = null
    this.musicScene = null
    this.loops.clear()
    this.playback.destroy()
  }

  private makeMusicChannel(source: string): GameMusicChannel {
    const channel = this.createMusicChannel(source)
    channel.preload = 'auto'
    return channel
  }

  private async startCurrentMusic(generation: number): Promise<void> {
    const incoming = this.currentMusic
    const scene = this.musicScene
    if (!incoming || !scene || generation !== this.generation) return
    incoming.muted = false
    try {
      await incoming.play()
    } catch {
      if (generation !== this.generation || incoming !== this.currentMusic) return
      incoming.pause()
      incoming.currentTime = 0
      return
    }
    if (generation !== this.generation || incoming !== this.currentMusic) {
      incoming.pause()
      return
    }
    this.beginMusicFade(incoming, this.outgoingMusic, GAME_SCENE_MUSIC[scene].transitionTicks)
  }

  private beginMusicFade(
    incoming: GameMusicChannel,
    outgoing: GameMusicChannel | null,
    transitionTicks: number,
  ): void {
    const startedAt = this.now()
    const durationMs = transitionTicks * NATIVE_AUDIO_TICK_MS
    const incomingStart = incoming.volume
    const outgoingStart = outgoing?.volume ?? 0
    const step = (now: number) => {
      if (incoming !== this.currentMusic) return
      const progress = durationMs === 0 ? 1 : clampUnit((now - startedAt) / durationMs)
      incoming.volume = incomingStart + (1 - incomingStart) * progress
      if (outgoing) outgoing.volume = outgoingStart * (1 - progress)
      if (progress < 1) {
        this.fadeFrame = this.requestFrame(step)
        return
      }
      if (outgoing) this.stopAndReset(outgoing)
      if (this.outgoingMusic === outgoing) this.outgoingMusic = null
      this.fadeFrame = 0
    }
    this.fadeFrame = this.requestFrame(step)
  }

  private cancelMusicFade(): void {
    if (!this.fadeFrame) return
    this.cancelFrame(this.fadeFrame)
    this.fadeFrame = 0
  }

  private stopAndReset(channel: GameMusicChannel | null): void {
    if (!channel) return
    channel.pause()
    channel.currentTime = 0
  }
}

function loopKey(cue: GameLoopCue, owner: string): string {
  return `loop:${cue}:${owner}`
}

function streamKey(cue: GameStreamCue): string {
  return `stream:${cue}`
}
