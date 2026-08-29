import assert from 'node:assert/strict'
import test from 'node:test'

import { createMediaElementGain } from './media-element-gain.ts'

class FakeAudioParam {
  value = 1
}

class FakeAudioNode {
  connectCalls: unknown[] = []
  disconnectCalls = 0

  connect(destination: unknown): unknown {
    this.connectCalls.push(destination)
    return destination
  }

  disconnect(): void {
    this.disconnectCalls += 1
  }
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam()
}

class FakeAudioContext {
  readonly destination = {}
  readonly gain = new FakeGainNode()
  readonly source = new FakeAudioNode()
  media: HTMLMediaElement | null = null

  createGain(): GainNode {
    return this.gain as unknown as GainNode
  }

  createMediaElementSource(media: HTMLMediaElement): MediaElementAudioSourceNode {
    this.media = media
    return this.source as unknown as MediaElementAudioSourceNode
  }
}

test('controls iOS media through a reconnectable Web Audio gain', () => {
  const context = new FakeAudioContext()
  const media = Object.defineProperty({}, 'volume', {
    configurable: true,
    get: () => 1,
    set: () => {},
  }) as HTMLMediaElement
  const output = createMediaElementGain(context as unknown as AudioContext, media)

  assert.equal(context.media, media)
  assert.deepEqual(context.source.connectCalls, [context.gain])
  assert.deepEqual(context.gain.connectCalls, [context.destination])

  output.volume = 0.25
  assert.equal(media.volume, 1, 'the iOS media property stays fixed at full volume')
  assert.equal(context.gain.gain.value, 0.25)
  output.volume = -1
  assert.equal(context.gain.gain.value, 0)
  output.volume = 2
  assert.equal(context.gain.gain.value, 1)

  output.disconnect()
  output.disconnect()
  assert.equal(context.source.disconnectCalls, 1)
  assert.equal(context.gain.disconnectCalls, 1)

  output.volume = 0.4
  assert.equal(context.gain.gain.value, 0.4)
  assert.equal(context.source.connectCalls.length, 2)
  assert.equal(context.gain.connectCalls.length, 2)
})
