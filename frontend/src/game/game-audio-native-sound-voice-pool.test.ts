import assert from 'node:assert/strict'
import test from 'node:test'

import { RetainedNativeSoundVoicePool } from './game-audio-native-sound-voice-pool.ts'

class FakePort {
  closeCalls = 0
  readonly messages: unknown[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  readonly transfers: Transferable[][] = []

  close(): void {
    this.closeCalls += 1
  }

  postMessage(message: unknown, transfer: Transferable[] = []): void {
    this.messages.push(message)
    this.transfers.push(transfer)
  }

  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent)
  }
}

class FakeNode {
  disconnectCalls = 0
  readonly port = new FakePort()

  disconnect(): void {
    this.disconnectCalls += 1
  }
}

test('retains ten native channels per sample and reopens only the ended slot', () => {
  const node = new FakeNode()
  const pool = new RetainedNativeSoundVoicePool(
    node as unknown as AudioWorkletNode,
    new Map<string, AudioBuffer>([
      ['hail-0.wav', audioBuffer([0, 0.5, -0.5, 0])],
      ['hail-1.wav', audioBuffer([0, 0.25, -0.25, 0])],
    ]),
  )
  const play = (source = 'hail-0.wav') => pool.play(source, {
    maximumVoices: 10,
    playbackRate: 1.1,
    volume: 0.5,
  })

  for (let voice = 0; voice < 10; voice += 1) assert.equal(play(), true)
  assert.equal(play(), false)
  assert.equal(node.port.messages.length, 11)
  assert.deepEqual(node.port.messages[0], {
    bufferId: 1,
    channels: [new Float32Array([0, 0.5, -0.5, 0])],
    sampleRate: 48_000,
    type: 'register-buffer',
  })
  assert.equal(node.port.transfers[0].length, 1)

  node.port.emit({ bufferId: 1, generation: 1, slot: 0, type: 'voice-ended' })
  assert.equal(play(), true)
  assert.deepEqual(node.port.messages.at(-1), {
    bufferId: 1,
    generation: 2,
    playbackRate: 1.1,
    slot: 0,
    type: 'play',
    volume: 0.5,
  })
  node.port.emit({ bufferId: 1, generation: 1, slot: 0, type: 'voice-ended' })
  assert.equal(play(), false)

  for (let voice = 0; voice < 10; voice += 1) assert.equal(play('hail-1.wav'), true)
  assert.equal(play('hail-1.wav'), false)
  assert.equal(node.port.messages.filter((message) => (
    (message as { type?: string }).type === 'register-buffer'
  )).length, 2)

  pool.destroy()
  pool.destroy()
  assert.deepEqual(node.port.messages.at(-1), { type: 'destroy' })
  assert.equal(node.port.closeCalls, 1)
  assert.equal(node.disconnectCalls, 1)
})

test('rejects missing buffers and inconsistent limits for one native sample', () => {
  const pool = new RetainedNativeSoundVoicePool(
    new FakeNode() as unknown as AudioWorkletNode,
    new Map([['hail.wav', audioBuffer([0, 1, 0])]]),
  )
  assert.throws(() => pool.play('missing.wav', {
    maximumVoices: 10,
    playbackRate: 1,
    volume: 1,
  }), /was not loaded/)
  assert.equal(pool.play('hail.wav', {
    maximumVoices: 10,
    playbackRate: 1,
    volume: 1,
  }), true)
  assert.throws(() => pool.play('hail.wav', {
    maximumVoices: 9,
    playbackRate: 1,
    volume: 1,
  }), /changed its native voice limit/)
})

function audioBuffer(samples: readonly number[]): AudioBuffer {
  const channel = new Float32Array(samples)
  return {
    duration: channel.length / 48_000,
    getChannelData: () => channel,
    numberOfChannels: 1,
    sampleRate: 48_000,
  } as unknown as AudioBuffer
}
