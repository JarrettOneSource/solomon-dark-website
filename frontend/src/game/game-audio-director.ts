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
  offsetSeconds?: number
  playbackRate: number
  volume: number
}

export interface GameAudioPlayback {
  destroy(): void
  play(source: string, options: GameAudioPlaybackOptions): void
  restart(key: string, source: string, options: GameAudioPlaybackOptions): void
  setMasterVolume(volume: number): void
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
  offsetSeconds?: number
  playbackRate?: number
  volume?: number
}

type ActiveLoopOptions = Required<Pick<
  PlaySoundOptions,
  'playbackRate' | 'volume'
>>

const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

export class GameAudioDirector {
  private cancelFrame: (handle: number) => void
  private createMusicChannel: (source: string) => GameMusicChannel
  private currentMusic: GameMusicChannel | null = null
  private fadeFrame = 0
  private generation = 0
  private musicScene: GameAudioScene | null = null
  private readonly musicChannels = new Map<string, GameMusicChannel>()
  private loops = new Map<GameLoopCue, Map<string, ActiveLoopOptions>>()
  private readonly musicEnvelopes = new Map<GameMusicChannel, number>()
  private musicVolume = 1
  private now: () => number
  private outgoingMusic: GameMusicChannel | null = null
  private readonly primedMusic = new Set<GameMusicChannel>()
  private readonly primingMusic = new Set<GameMusicChannel>()
  private playback: GameAudioPlayback
  private requestFrame: (callback: FrameRequestCallback) => number
  private soundVolume = 1
  private soundsMuted = false
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

  setVolumes(soundVolume: number, musicVolume: number): void {
    this.soundVolume = clampUnit(soundVolume)
    this.applySoundVolume()
    this.musicVolume = clampUnit(musicVolume)
    for (const channel of [this.currentMusic, this.outgoingMusic]) {
      if (channel) this.applyMusicEnvelope(channel)
    }
  }

  setSoundMuted(muted: boolean): void {
    if (this.soundsMuted === muted) return
    this.soundsMuted = muted
    this.applySoundVolume()
  }

  setScene(scene: GameAudioScene): void {
    if (scene === this.musicScene && this.currentMusic) return

    this.cancelMusicFade()
    this.stopAndReset(this.outgoingMusic)
    this.outgoingMusic = this.currentMusic
    this.currentMusic = this.musicChannel(
      this.sources.music[GAME_SCENE_MUSIC[scene].cue],
    )
    this.currentMusic.currentTime = 0
    this.currentMusic.loop = true
    this.setMusicEnvelope(this.currentMusic, 0)
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
    this.primeMusicChannels()
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
      ...(options.offsetSeconds === undefined
        ? {}
        : { offsetSeconds: Math.max(0, options.offsetSeconds) }),
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
    for (const channel of this.musicChannels.values()) this.stopAndReset(channel)
    this.currentMusic = null
    this.outgoingMusic = null
    this.musicScene = null
    this.musicChannels.clear()
    this.loops.clear()
    this.musicEnvelopes.clear()
    this.primedMusic.clear()
    this.primingMusic.clear()
    this.playback.destroy()
  }

  private makeMusicChannel(source: string): GameMusicChannel {
    const channel = this.createMusicChannel(source)
    channel.preload = 'auto'
    return channel
  }

  private musicChannel(source: string): GameMusicChannel {
    const existing = this.musicChannels.get(source)
    if (existing) return existing
    const channel = this.makeMusicChannel(source)
    this.musicChannels.set(source, channel)
    return channel
  }

  private primeMusicChannels(): void {
    for (const source of new Set(Object.values(this.sources.music))) {
      const channel = this.musicChannel(source)
      if (
        channel === this.currentMusic
        || channel === this.outgoingMusic
        || this.primedMusic.has(channel)
        || this.primingMusic.has(channel)
      ) continue
      this.primeMusicChannel(channel)
    }
  }

  private primeMusicChannel(channel: GameMusicChannel): void {
    channel.currentTime = 0
    channel.loop = true
    channel.muted = false
    channel.volume = 0
    this.primingMusic.add(channel)
    void channel.play().then(
      () => this.finishMusicPrime(channel, true),
      () => this.finishMusicPrime(channel, false),
    )
  }

  private finishMusicPrime(channel: GameMusicChannel, usable: boolean): void {
    if (!this.primingMusic.delete(channel)) return
    if (usable) this.primedMusic.add(channel)
    if (channel === this.currentMusic || channel === this.outgoingMusic) return
    this.stopAndReset(channel)
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
    this.primedMusic.add(incoming)
    this.beginMusicFade(incoming, this.outgoingMusic, GAME_SCENE_MUSIC[scene].transitionTicks)
  }

  private beginMusicFade(
    incoming: GameMusicChannel,
    outgoing: GameMusicChannel | null,
    transitionTicks: number,
  ): void {
    const startedAt = this.now()
    const durationMs = transitionTicks * NATIVE_AUDIO_TICK_MS
    const incomingStart = this.musicEnvelopes.get(incoming) ?? 0
    const outgoingStart = outgoing ? this.musicEnvelopes.get(outgoing) ?? 0 : 0
    const step = (now: number) => {
      if (incoming !== this.currentMusic) return
      const progress = durationMs === 0 ? 1 : clampUnit((now - startedAt) / durationMs)
      this.setMusicEnvelope(incoming, incomingStart + (1 - incomingStart) * progress)
      if (outgoing) this.setMusicEnvelope(outgoing, outgoingStart * (1 - progress))
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
    this.musicEnvelopes.delete(channel)
  }

  private setMusicEnvelope(channel: GameMusicChannel, envelope: number): void {
    this.musicEnvelopes.set(channel, clampUnit(envelope))
    this.applyMusicEnvelope(channel)
  }

  private applyMusicEnvelope(channel: GameMusicChannel): void {
    channel.volume = (this.musicEnvelopes.get(channel) ?? 0) * this.musicVolume
  }

  private applySoundVolume(): void {
    this.playback.setMasterVolume(this.soundsMuted ? 0 : this.soundVolume)
  }
}

function loopKey(cue: GameLoopCue, owner: string): string {
  return `loop:${cue}:${owner}`
}

function streamKey(cue: GameStreamCue): string {
  return `stream:${cue}`
}
