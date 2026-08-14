import {
  GAME_SCENE_MUSIC,
  NATIVE_AUDIO_TICK_MS,
  type GameAudioScene,
  type GameAudioSources,
  type GameLoopCue,
  type GameSoundCue,
  type GameStreamCue,
} from './game-audio-native.ts'

export type GameAudioChannel = Pick<
  HTMLAudioElement,
  | 'addEventListener'
  | 'currentTime'
  | 'loop'
  | 'muted'
  | 'pause'
  | 'paused'
  | 'play'
  | 'playbackRate'
  | 'preload'
  | 'removeEventListener'
  | 'src'
  | 'volume'
>

export interface GameAudioDirectorOptions {
  cancelFrame?: (handle: number) => void
  createAudio?: (source: string) => GameAudioChannel
  now?: () => number
  requestFrame?: (callback: FrameRequestCallback) => number
}

export interface PlaySoundOptions {
  playbackRate?: number
  volume?: number
}

const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

export class GameAudioDirector {
  private activeSounds = new Set<GameAudioChannel>()
  private cancelFrame: (handle: number) => void
  private createAudio: (source: string) => GameAudioChannel
  private currentMusic: GameAudioChannel | null = null
  private fadeFrame = 0
  private generation = 0
  private musicScene: GameAudioScene | null = null
  private loops = new Map<GameLoopCue, {
    channel: GameAudioChannel
    owners: Set<string>
  }>()
  private now: () => number
  private outgoingMusic: GameAudioChannel | null = null
  private requestFrame: (callback: FrameRequestCallback) => number
  private readonly sources: GameAudioSources
  private streams = new Map<GameStreamCue, GameAudioChannel>()

  constructor(
    sources: GameAudioSources,
    options: GameAudioDirectorOptions = {},
  ) {
    this.sources = sources
    this.createAudio = options.createAudio ?? ((source) => new Audio(source))
    this.now = options.now ?? (() => performance.now())
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback))
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle))
  }

  setScene(scene: GameAudioScene): void {
    if (scene === this.musicScene && this.currentMusic) return

    this.cancelMusicFade()
    this.outgoingMusic?.pause()
    this.outgoingMusic = this.currentMusic
    this.currentMusic = this.makeChannel(this.sources.music[GAME_SCENE_MUSIC[scene].cue])
    this.currentMusic.loop = true
    this.currentMusic.volume = 0
    this.musicScene = scene
    this.generation += 1

    void this.startCurrentMusic(this.generation)
  }

  unlock(): void {
    if (this.currentMusic?.paused) {
      this.currentMusic.currentTime = 0
      void this.startCurrentMusic(this.generation)
    }
    for (const loop of this.loops.values()) {
      if (loop.channel.paused) void loop.channel.play().catch(() => {})
    }
  }

  startLoop(
    cue: GameLoopCue,
    owner: string,
    options: PlaySoundOptions = {},
  ): void {
    let state = this.loops.get(cue)
    if (state?.owners.has(owner)) return
    if (!state) {
      const channel = this.makeChannel(this.sources.loops[cue])
      channel.loop = true
      channel.volume = clampUnit(options.volume ?? 1)
      channel.playbackRate = options.playbackRate ?? 1
      state = { channel, owners: new Set() }
      this.loops.set(cue, state)
      void channel.play().catch(() => {})
    }
    state.owners.add(owner)
  }

  stopLoop(cue: GameLoopCue, owner: string): void {
    const state = this.loops.get(cue)
    if (!state || !state.owners.delete(owner) || state.owners.size > 0) return
    this.stopAndReset(state.channel)
    this.loops.delete(cue)
  }

  stopLoopsForOwner(owner: string): void {
    for (const cue of this.loops.keys()) this.stopLoop(cue, owner)
  }

  playSound(cue: GameSoundCue, options: PlaySoundOptions = {}): void {
    const channel = this.makeChannel(this.sources.sounds[cue])
    channel.volume = clampUnit(options.volume ?? 1)
    channel.playbackRate = options.playbackRate ?? 1
    this.activeSounds.add(channel)

    const cleanup = () => {
      channel.removeEventListener('ended', cleanup)
      channel.removeEventListener('error', cleanup)
      this.activeSounds.delete(channel)
    }
    channel.addEventListener('ended', cleanup)
    channel.addEventListener('error', cleanup)
    void channel.play().catch(cleanup)
  }

  playStream(cue: GameStreamCue, options: PlaySoundOptions = {}): void {
    let channel = this.streams.get(cue)
    if (!channel) {
      channel = this.makeChannel(this.sources.streams[cue])
      this.streams.set(cue, channel)
    } else {
      channel.pause()
      channel.currentTime = 0
    }
    channel.volume = clampUnit(options.volume ?? 1)
    channel.playbackRate = options.playbackRate ?? 1
    void channel.play().catch(() => {})
  }

  pauseStream(cue: GameStreamCue): void {
    this.streams.get(cue)?.pause()
  }

  destroy(): void {
    this.generation += 1
    this.cancelMusicFade()
    this.stopAndReset(this.currentMusic)
    this.stopAndReset(this.outgoingMusic)
    this.currentMusic = null
    this.outgoingMusic = null
    this.musicScene = null
    for (const channel of this.activeSounds) this.stopAndReset(channel)
    this.activeSounds.clear()
    for (const loop of this.loops.values()) this.stopAndReset(loop.channel)
    this.loops.clear()
    for (const channel of this.streams.values()) this.stopAndReset(channel)
    this.streams.clear()
  }

  private makeChannel(source: string): GameAudioChannel {
    const channel = this.createAudio(source)
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
    incoming: GameAudioChannel,
    outgoing: GameAudioChannel | null,
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

  private stopAndReset(channel: GameAudioChannel | null): void {
    if (!channel) return
    channel.pause()
    channel.currentTime = 0
  }
}
