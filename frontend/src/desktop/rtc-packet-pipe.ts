import { GAME_WEBSOCKET_MAX_PAYLOAD_BYTES } from '../game/protocol/game-protocol-contract.ts'

const FRAGMENT_BYTES = 16 * 1024
const HIGH_WATER_BYTES = 512 * 1024
const MAX_QUEUE_BYTES = GAME_WEBSOCKET_MAX_PAYLOAD_BYTES * 2

/** Ordered SCTP messages frame the existing JSON protocol without changing it. */
export class RtcPacketPipe {
  readonly channel: RTCDataChannel
  onPacket: (packet: string) => void = () => {}
  onControl: (message: Record<string, unknown>) => void = () => {}
  onClosed: (reason: string) => void = () => {}
  private queue: (Uint8Array | string)[] = []
  private queuedBytes = 0
  private fragments: Uint8Array[] = []
  private fragmentBytes = 0
  private fragmentTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false

  constructor(channel: RTCDataChannel) {
    this.channel = channel
    channel.binaryType = 'arraybuffer'
    channel.bufferedAmountLowThreshold = HIGH_WATER_BYTES / 2
    channel.addEventListener('bufferedamountlow', () => this.flush())
    channel.addEventListener('open', () => this.flush())
    channel.addEventListener('message', event => {
      try { this.receive(event.data) }
      catch (error) { this.close(error instanceof Error ? error.message : 'Invalid peer message') }
    })
    channel.addEventListener('close', () => this.close('Peer connection closed'))
    channel.addEventListener('error', () => this.close('Peer connection failed'))
  }

  send(packet: string): void {
    if (!packet.length) throw new Error('Peer game messages cannot be empty')
    const bytes = new TextEncoder().encode(packet)
    if (bytes.length > GAME_WEBSOCKET_MAX_PAYLOAD_BYTES) throw new Error('Peer game message is too large')
    this.reserve(bytes.length + Math.ceil(bytes.length / (FRAGMENT_BYTES - 1)))
    for (let offset = 0; offset < bytes.length; offset += FRAGMENT_BYTES - 1) {
      const payload = bytes.subarray(offset, offset + FRAGMENT_BYTES - 1)
      const frame = new Uint8Array(payload.length + 1)
      frame[0] = offset + payload.length === bytes.length ? 1 : 0
      frame.set(payload, 1)
      this.queue.push(frame)
    }
    this.flush()
  }

  control(message: Record<string, unknown>): void {
    const text = JSON.stringify(message)
    if (text.length > 4096) throw new Error('Peer control message is too large')
    this.reserve(new TextEncoder().encode(text).length)
    this.queue.push(text)
    this.flush()
  }

  close(reason = 'Peer session ended'): void {
    if (this.closed) return
    this.closed = true
    if (this.fragmentTimer) clearTimeout(this.fragmentTimer)
    this.queue = []
    this.fragments = []
    this.queuedBytes = 0
    this.fragmentBytes = 0
    this.channel.close()
    this.onClosed(reason)
  }

  private reserve(bytes: number): void {
    if (this.closed || this.channel.readyState === 'closed' || this.channel.readyState === 'closing') {
      throw new Error('Peer transport is closed')
    }
    if (this.queuedBytes + bytes > MAX_QUEUE_BYTES) {
      this.close('Peer receiver cannot keep up')
      throw new Error('Peer send queue is full')
    }
    this.queuedBytes += bytes
  }

  private flush(): void {
    try {
      while (this.channel.readyState === 'open' && this.queue.length
        && this.channel.bufferedAmount < HIGH_WATER_BYTES) {
        const frame = this.queue.shift()!
        if (typeof frame === 'string') {
          this.channel.send(frame)
          this.queuedBytes -= new TextEncoder().encode(frame).length
        } else {
          this.channel.send(frame as Uint8Array<ArrayBuffer>)
          this.queuedBytes -= frame.byteLength
        }
      }
    } catch {
      this.close('Peer send failed')
    }
  }

  private receive(data: unknown): void {
    if (this.closed) return
    if (typeof data === 'string') {
      if (data.length > 4096) throw new Error('Peer control message is too large')
      const message: unknown = JSON.parse(data)
      if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('Invalid peer control')
      this.onControl(message as Record<string, unknown>)
      return
    }
    if (!(data instanceof ArrayBuffer) || data.byteLength < 2 || data.byteLength > FRAGMENT_BYTES) {
      throw new Error('Invalid peer fragment')
    }
    const frame = new Uint8Array(data)
    if (frame[0] !== 0 && frame[0] !== 1) throw new Error('Invalid peer fragment marker')
    this.fragmentBytes += frame.byteLength - 1
    if (this.fragmentBytes > GAME_WEBSOCKET_MAX_PAYLOAD_BYTES) throw new Error('Peer game message is too large')
    this.fragments.push(frame.subarray(1))
    this.fragmentTimer ??= setTimeout(() => this.close('Peer message transfer timed out'), 30_000)
    if (frame[0] === 0) return
    clearTimeout(this.fragmentTimer)
    this.fragmentTimer = null
    const packet = new Uint8Array(this.fragmentBytes)
    let offset = 0
    for (const fragment of this.fragments) { packet.set(fragment, offset); offset += fragment.length }
    this.fragments = []
    this.fragmentBytes = 0
    this.onPacket(new TextDecoder('utf-8', { fatal: true }).decode(packet))
  }
}
