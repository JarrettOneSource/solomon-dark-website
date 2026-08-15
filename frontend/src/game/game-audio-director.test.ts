import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GameAudioDirector,
  type GameAudioPlayback,
  type GameAudioPlaybackOptions,
  type GameMusicChannel,
} from './game-audio-director.ts'
import type { GameAudioSources } from './game-audio-native.ts'
import './game-audio-web-playback.test.ts'
import './player-footstep-audio.test.ts'
import './primary-spell-audio.test.ts'

const SOURCES = {
  loops: {
    'gather-rocks-loop': 'gather.wav',
    'ice-loop': 'ice-loop.wav',
    'lightning-loop': 'lightning-loop.wav',
    'rolling-stone-loop': 'rolling.wav',
  },
  music: {
    academy: 'academy.mp3',
    combat: 'combat.mp3',
    death: 'death.mp3',
    prelude: 'prelude.mp3',
    selection: 'selection.mp3',
    solomondarktheme: 'theme.mp3',
  },
  sounds: {
    click: 'click.wav',
    'fireball-hit': 'fireball-hit.wav',
    'ice-start': 'ice.wav',
    'lightning-start': 'lightning.wav',
    'magic-missile': 'magic.wav',
    'pick-skill': 'pick.wav',
    'rock-hit': 'rock.wav',
    'skeleton-die': 'skeleton.wav',
    'start-boulder': 'boulder.wav',
    'step-1': 'step1.wav',
    'step-2': 'step2.wav',
    summon: 'summon.wav',
    'throw-fire': 'fire.wav',
  },
  streams: {
    'catch-it': 'catch.wav',
    'choose-element': 'choose.wav',
    'death-guitar': 'death-guitar.wav',
    'solomon-get-him-boys': 'get-him-boys.wav',
    'solomon-hello-1': 'hello-1.wav',
    'solomon-hello-2': 'hello-2.wav',
    'solomon-hello-3': 'hello-3.wav',
    'solomon-hello-4': 'hello-4.wav',
    'solomon-laugh-1': 'laugh-1.wav',
    'start-cast': 'start.wav',
  },
} as const satisfies GameAudioSources

class FakeAudio {
  currentTime = 0
  loop = false
  muted = false
  pauseCalls = 0
  paused = true
  playCalls = 0
  preload = ''
  rejectNextPlay = false
  src: string
  volume = 1

  constructor(source: string) {
    this.src = source
  }

  pause(): void {
    this.pauseCalls += 1
    this.paused = true
  }

  play(): Promise<void> {
    this.playCalls += 1
    if (this.rejectNextPlay) {
      this.rejectNextPlay = false
      this.paused = true
      return Promise.reject(new Error('autoplay blocked'))
    }
    this.paused = false
    return Promise.resolve()
  }
}

interface PlaybackCall {
  key?: string
  options: GameAudioPlaybackOptions
  source: string
}

class FakePlayback implements GameAudioPlayback {
  destroyCalls = 0
  readonly plays: PlaybackCall[] = []
  readonly restarts: PlaybackCall[] = []
  readonly stops: string[] = []
  unlockCalls = 0

  destroy(): void {
    this.destroyCalls += 1
  }

  play(source: string, options: GameAudioPlaybackOptions): void {
    this.plays.push({ options, source })
  }

  restart(
    key: string,
    source: string,
    options: GameAudioPlaybackOptions,
  ): void {
    this.restarts.push({ key, options, source })
  }

  stop(key: string): void {
    this.stops.push(key)
  }

  unlock(): void {
    this.unlockCalls += 1
  }
}

class FakeFrames {
  currentTime = 0
  private callbacks = new Map<number, FrameRequestCallback>()
  private nextHandle = 1

  now = () => this.currentTime

  request = (callback: FrameRequestCallback): number => {
    const handle = this.nextHandle
    this.nextHandle += 1
    this.callbacks.set(handle, callback)
    return handle
  }

  cancel = (handle: number): void => {
    this.callbacks.delete(handle)
  }

  runAt(time: number): void {
    this.currentTime = time
    const callbacks = [...this.callbacks.values()]
    this.callbacks.clear()
    for (const callback of callbacks) callback(time)
  }
}

function fixture(options: {
  rejectSources?: ReadonlySet<string>
} = {}) {
  const created: FakeAudio[] = []
  const frames = new FakeFrames()
  const playback = new FakePlayback()
  const director = new GameAudioDirector(SOURCES, {
    cancelFrame: frames.cancel,
    createMusicChannel: (source) => {
      const audio = new FakeAudio(source)
      audio.rejectNextPlay = options.rejectSources?.has(source) ?? false
      created.push(audio)
      return audio as unknown as GameMusicChannel
    },
    now: frames.now,
    playback,
    requestFrame: frames.request,
  })
  return { created, director, frames, playback }
}

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

test('crossfades the recovered scene tracks at their native tick durations', async () => {
  const { created, director, frames } = fixture()
  director.setScene('title')
  await flushPromises()

  const title = created[0]
  assert.equal(title.src, 'theme.mp3')
  assert.equal(title.loop, true)
  frames.runAt(500)
  assert.equal(title.volume, 0.5)
  frames.runAt(1_000)
  assert.equal(title.volume, 1)

  director.setScene('create')
  await flushPromises()
  const selection = created[1]
  assert.equal(selection.src, 'selection.mp3')
  frames.runAt(1_500)
  assert.equal(selection.volume, 0.5)
  assert.equal(title.volume, 0.5)
  frames.runAt(2_000)
  assert.equal(selection.volume, 1)
  assert.equal(title.paused, true)

  director.setScene('hub')
  await flushPromises()
  const academy = created[2]
  frames.runAt(2_010)
  assert.equal(academy.volume, 0.5)
  frames.runAt(2_020)
  assert.equal(academy.volume, 1)
  assert.equal(selection.paused, true)

  director.setScene('boneyard')
  await flushPromises()
  const prelude = created[3]
  assert.equal(prelude.src, 'prelude.mp3')
  frames.runAt(2_520)
  assert.equal(prelude.volume, 0.5)
  assert.equal(academy.volume, 0.5)
  frames.runAt(3_020)
  assert.equal(prelude.volume, 1)
  assert.equal(academy.paused, true)

  director.setScene('boneyard-combat')
  await flushPromises()
  const combat = created[4]
  assert.equal(combat.src, 'combat.mp3')
  frames.runAt(3_520)
  assert.equal(combat.volume, 0.5)
  frames.runAt(4_020)
  assert.equal(combat.volume, 1)

  director.setScene('game-over')
  await flushPromises()
  const death = created[5]
  assert.equal(death.src, 'death.mp3')
  frames.runAt(4_020)
  assert.equal(death.volume, 1)
})

test('holds a blocked scene at its beginning and retries on unlock', async () => {
  const { created, director, frames } = fixture({ rejectSources: new Set(['theme.mp3']) })
  director.setScene('title')
  await flushPromises()
  assert.equal(created[0].paused, true)
  assert.equal(created[0].currentTime, 0)

  director.unlock()
  await flushPromises()
  assert.equal(created[0].playCalls, 2)
  frames.runAt(1_000)
  assert.equal(created[0].volume, 1)
})

test('overlaps Sound instances and reuses restartable SoundStream channels', async () => {
  const { created, director, playback } = fixture()
  director.playSound('click', { playbackRate: 1.05, volume: 0.5 })
  director.playSound('click')
  assert.equal(created.length, 0)
  assert.deepEqual(playback.plays, [
    {
      options: { playbackRate: 1.05, volume: 0.5 },
      source: 'click.wav',
    },
    {
      options: { playbackRate: 1, volume: 1 },
      source: 'click.wav',
    },
  ])

  director.playStream('start-cast')
  director.playStream('start-cast')
  assert.deepEqual(playback.restarts.slice(0, 2), [
    {
      key: 'stream:start-cast',
      options: { playbackRate: 1, volume: 1 },
      source: 'start.wav',
    },
    {
      key: 'stream:start-cast',
      options: { playbackRate: 1, volume: 1 },
      source: 'start.wav',
    },
  ])
  director.pauseStream('start-cast')
  director.stopStream('start-cast')
  assert.deepEqual(playback.stops, ['stream:start-cast', 'stream:start-cast'])

  director.playStream('solomon-hello-1')
  director.playStream('solomon-laugh-1')
  director.stopStreams(['solomon-hello-1', 'solomon-laugh-1'])
  assert.deepEqual(playback.stops.slice(-2), [
    'stream:solomon-hello-1',
    'stream:solomon-laugh-1',
  ])

  director.destroy()
  assert.equal(playback.destroyCalls, 1)
  assert.equal(created.length, 0)
  await flushPromises()
})

test('balances one native loop channel across independent semantic owners', async () => {
  const { created, director, playback } = fixture()
  director.startLoop('lightning-loop', 'player:a')
  director.startLoop('lightning-loop', 'player:a')
  director.startLoop('lightning-loop', 'player:b')
  assert.equal(created.length, 0)
  assert.deepEqual(playback.restarts, [{
    key: 'loop:lightning-loop',
    options: { loop: true, playbackRate: 1, volume: 1 },
    source: 'lightning-loop.wav',
  }])

  director.stopLoop('lightning-loop', 'player:a')
  assert.deepEqual(playback.stops, [])
  director.stopLoop('lightning-loop', 'player:b')
  assert.deepEqual(playback.stops, ['loop:lightning-loop'])
  await flushPromises()
})
