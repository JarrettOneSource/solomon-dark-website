import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GameAudioDirector,
  type GameAudioChannel,
} from './game-audio-director.ts'
import type { GameAudioSources } from './game-audio-native.ts'

const SOURCES = {
  music: {
    academy: 'academy.mp3',
    selection: 'selection.mp3',
    solomondarktheme: 'theme.mp3',
  },
  sounds: {
    click: 'click.wav',
    'ice-start': 'ice.wav',
    'lightning-start': 'lightning.wav',
    'magic-missile': 'magic.wav',
    'pick-skill': 'pick.wav',
    'rock-hit': 'rock.wav',
    'step-1': 'step1.wav',
    'step-2': 'step2.wav',
    summon: 'summon.wav',
    'throw-fire': 'fire.wav',
  },
  streams: {
    'catch-it': 'catch.wav',
    'choose-element': 'choose.wav',
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
  playbackRate = 1
  preload = ''
  rejectNextPlay = false
  src: string
  volume = 1
  private listeners = new Map<string, Set<() => void>>()

  constructor(source: string) {
    this.src = source
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener)
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

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener()
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
  const director = new GameAudioDirector(SOURCES, {
    cancelFrame: frames.cancel,
    createAudio: (source) => {
      const audio = new FakeAudio(source)
      audio.rejectNextPlay = options.rejectSources?.has(source) ?? false
      created.push(audio)
      return audio as unknown as GameAudioChannel
    },
    now: frames.now,
    requestFrame: frames.request,
  })
  return { created, director, frames }
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
  const { created, director } = fixture()
  director.playSound('click', { playbackRate: 1.05, volume: 0.5 })
  director.playSound('click')
  assert.equal(created.length, 2)
  assert.notEqual(created[0], created[1])
  assert.equal(created[0].volume, 0.5)
  assert.equal(created[0].playbackRate, 1.05)

  director.playStream('start-cast')
  const stream = created[2]
  stream.currentTime = 0.75
  director.playStream('start-cast')
  assert.equal(created.length, 3)
  assert.equal(stream.currentTime, 0)
  assert.equal(stream.playCalls, 2)
  assert.equal(stream.pauseCalls, 1)
  director.pauseStream('start-cast')
  assert.equal(stream.paused, true)

  created[0].emit('ended')
  director.destroy()
  assert.equal(created[1].paused, true)
  await flushPromises()
})
