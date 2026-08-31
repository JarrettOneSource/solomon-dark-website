import assert from 'node:assert/strict'
import test from 'node:test'

import { createWebAudioPlayback } from './game-audio-web-playback.ts'

class FakeAudioParam {
  value = 1
}

class FakeGain {
  readonly gain = new FakeAudioParam()
  connectedTo: unknown = null
  disconnected = false

  connect(destination: unknown): unknown {
    this.connectedTo = destination
    return destination
  }

  disconnect(): void {
    this.disconnected = true
  }
}

class FakeBufferSource {
  buffer: AudioBuffer | null = null
  connectedTo: unknown = null
  disconnected = false
  loop = false
  onended: (() => void) | null = null
  readonly playbackRate = new FakeAudioParam()
  readonly startOffsets: Array<readonly [number | undefined, number | undefined]> = []
  startCalls = 0
  stopCalls = 0

  connect(destination: unknown): unknown {
    this.connectedTo = destination
    return destination
  }

  disconnect(): void {
    this.disconnected = true
  }

  start(when?: number, offset?: number): void {
    this.startCalls += 1
    this.startOffsets.push([when, offset])
  }

  stop(): void {
    this.stopCalls += 1
  }
}

class FakeAudioContext {
  readonly destination = {}
  readonly gains: FakeGain[] = []
  resumeCalls = 0
  readonly sources: FakeBufferSource[] = []
  state: AudioContextState = 'suspended'
  suspendCalls = 0

  createBufferSource(): FakeBufferSource {
    const source = new FakeBufferSource()
    this.sources.push(source)
    return source
  }

  createGain(): FakeGain {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }

  async resume(): Promise<void> {
    this.resumeCalls += 1
    this.state = 'running'
  }

  async suspend(): Promise<void> {
    this.suspendCalls += 1
    this.state = 'suspended'
  }
}

class FakeNativeSoundVoicePool {
  destroyCalls = 0
  readonly plays: Array<Readonly<{
    options: Readonly<{ maximumVoices?: number; playbackRate: number; volume: number }>
    source: string
  }>> = []

  destroy(): void {
    this.destroyCalls += 1
  }

  play(
    source: string,
    options: Readonly<{
      maximumVoices?: number
      playbackRate: number
      volume: number
    }>,
  ): boolean {
    this.plays.push({ options, source })
    return true
  }
}

test('reuses resident buffers across overlapping low-latency one-shots', async () => {
  const context = new FakeAudioContext()
  const click = {} as AudioBuffer
  const playback = createWebAudioPlayback(
    context as unknown as AudioContext,
    new Map([['click.wav', click]]),
  )

  playback.unlock()
  await Promise.resolve()
  assert.equal(context.resumeCalls, 1)
  assert.equal(context.state, 'running')

  playback.play('click.wav', { playbackRate: 1.05, volume: 0.5 })
  playback.play('click.wav', { playbackRate: 1, volume: 1 })
  assert.equal(context.sources.length, 2)
  assert.notEqual(context.sources[0], context.sources[1])
  assert.equal(context.sources[0].buffer, click)
  assert.equal(context.sources[1].buffer, click)
  assert.equal(context.sources[0].playbackRate.value, 1.05)
  assert.equal(context.gains[1].gain.value, 0.5)
  assert.equal(context.gains[1].connectedTo, context.gains[0])
  playback.setMasterVolume(0.25)
  assert.equal(context.gains[0].gain.value, 0.25)
  assert.equal(context.sources[0].startCalls, 1)
  assert.equal(context.sources[1].startCalls, 1)

  context.sources[0].onended?.()
  assert.equal(context.sources[0].disconnected, true)
  assert.equal(context.gains[1].disconnected, true)

  playback.destroy()
  await Promise.resolve()
  assert.equal(context.sources[1].stopCalls, 1)
  assert.equal(context.suspendCalls, 1)
  assert.equal(context.gains[0].disconnected, true)
})

test('restarts keyed streams and stops keyed loops without touching other channels', () => {
  const context = new FakeAudioContext()
  const buffers = new Map<string, AudioBuffer>([
    ['stream.wav', {} as AudioBuffer],
    ['loop.wav', {} as AudioBuffer],
  ])
  const playback = createWebAudioPlayback(
    context as unknown as AudioContext,
    buffers,
  )

  playback.restart('stream:voice', 'stream.wav', {
    offsetSeconds: 1.25,
    playbackRate: 1,
    volume: 0.75,
  })
  playback.restart('loop:spell', 'loop.wav', {
    loop: true,
    playbackRate: 0.95,
    volume: 0.25,
  })
  const firstStream = context.sources[0]
  const loop = context.sources[1]
  assert.equal(loop.loop, true)
  assert.equal(loop.playbackRate.value, 0.95)
  assert.equal(context.gains[2].gain.value, 0.25)
  playback.setVolume('loop:spell', 0.5)
  assert.equal(context.gains[2].gain.value, 0.5)
  assert.equal(loop.stopCalls, 0)
  assert.deepEqual(firstStream.startOffsets, [[0, 1.25]])

  playback.restart('stream:voice', 'stream.wav', {
    playbackRate: 1.1,
    volume: 1,
  })
  assert.equal(firstStream.stopCalls, 1)
  assert.equal(loop.stopCalls, 0)
  assert.equal(context.sources[2].playbackRate.value, 1.1)

  playback.stop('loop:spell')
  assert.equal(loop.stopCalls, 1)
  playback.stop('loop:spell')
  assert.equal(loop.stopCalls, 1)

  playback.destroy()
  assert.equal(context.sources[2].stopCalls, 1)
})

test('routes capped native samples through one retained voice pool', () => {
  const context = new FakeAudioContext()
  const nativeVoices = new FakeNativeSoundVoicePool()
  let voicePoolCreations = 0
  const playback = createWebAudioPlayback(
    context as unknown as AudioContext,
    new Map<string, AudioBuffer>([
      ['hail-0.wav', {} as AudioBuffer],
      ['hail-1.wav', {} as AudioBuffer],
    ]),
    (destination) => {
      voicePoolCreations += 1
      assert.equal(destination, context.gains[0])
      return nativeVoices
    },
  )

  for (let voice = 0; voice < 11; voice += 1) {
    playback.play('hail-0.wav', {
      maximumVoices: 10,
      playbackRate: 1,
      volume: 1,
    })
  }
  assert.equal(voicePoolCreations, 1)
  assert.equal(nativeVoices.plays.length, 11)
  assert.equal(context.sources.length, 0)
  assert.equal(context.gains.length, 1)

  playback.play('hail-0.wav', { playbackRate: 1, volume: 1 })
  playback.play('hail-0.wav', { playbackRate: 1, volume: 1 })
  assert.equal(context.sources.length, 2)

  playback.destroy()
  assert.equal(nativeVoices.destroyCalls, 1)
})

test('rejects playback for an asset absent from the resident bank', () => {
  const context = new FakeAudioContext()
  const playback = createWebAudioPlayback(
    context as unknown as AudioContext,
    new Map(),
  )
  assert.throws(
    () => playback.play('missing.wav', { playbackRate: 1, volume: 1 }),
    /game audio buffer was not loaded/,
  )
})
