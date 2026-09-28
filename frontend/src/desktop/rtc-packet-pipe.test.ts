import assert from 'node:assert/strict'
import test from 'node:test'
import { RtcPacketPipe } from './rtc-packet-pipe.ts'

class TestChannel extends EventTarget {
  readyState = 'open'
  binaryType = 'arraybuffer'
  bufferedAmount = 0
  bufferedAmountLowThreshold = 0
  sent: (string | Uint8Array)[] = []
  send(value: string | Uint8Array): void { this.sent.push(value) }
  close(): void {
    if (this.readyState === 'closed') return
    this.readyState = 'closed'
    this.dispatchEvent(new Event('close'))
  }
  receive(value: string | Uint8Array): void {
    const data = typeof value === 'string' ? value : value.slice().buffer
    this.dispatchEvent(new MessageEvent('message', { data }))
  }
}

function fixture() {
  const channel = new TestChannel()
  // This test double implements precisely the browser channel methods the pipe consumes.
  const pipe = new RtcPacketPipe(channel as unknown as RTCDataChannel)
  return { channel, pipe }
}

test('large Unicode game messages survive ordered fragmentation exactly', context => {
  const sender = fixture()
  const receiver = fixture()
  context.after(() => { sender.pipe.close(); receiver.pipe.close() })
  const packets: string[] = []
  receiver.pipe.onPacket = packet => packets.push(packet)
  const message = JSON.stringify({ data: '魔法🔥é'.repeat(40_000) })
  sender.pipe.send(message)
  assert.ok(sender.channel.sent.length > 20)
  for (const frame of sender.channel.sent) {
    assert.ok(frame instanceof Uint8Array)
    assert.ok(frame.byteLength <= 16 * 1024)
    receiver.channel.receive(frame)
  }
  assert.deepEqual(packets, [message])
  assert.equal(receiver.channel.readyState, 'open')
})

test('backpressure queues game and control messages in the same order', context => {
  const { pipe, channel } = fixture()
  context.after(() => pipe.close())
  channel.bufferedAmount = 512 * 1024
  pipe.send('first')
  pipe.control({ type: 'closed', connectionId: 'connection-1' })
  assert.deepEqual(channel.sent, [])
  channel.bufferedAmount = 0
  channel.dispatchEvent(new Event('bufferedamountlow'))
  assert.equal(channel.sent.length, 2)
  assert.ok(channel.sent[0] instanceof Uint8Array)
  assert.equal(typeof channel.sent[1], 'string')
})

test('invalid framing and oversized controls close only their peer pipe', () => {
  for (const message of [new Uint8Array([2, 97]), new Uint8Array([1, 255]), '{}'.repeat(2100)]) {
    const { channel, pipe } = fixture()
    let reason = ''
    pipe.onClosed = value => { reason = value }
    channel.receive(message)
    assert.equal(channel.readyState, 'closed')
    assert.ok(reason.length > 0)
    assert.throws(() => pipe.send('after-close'), /closed/)
  }
})
