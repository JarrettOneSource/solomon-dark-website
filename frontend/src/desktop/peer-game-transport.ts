import type { GameTransport, GameTransportClose } from '../game/client/game-transport.ts'
import type { RtcPacketPipe } from './rtc-packet-pipe.ts'

export class PeerGameTransport implements GameTransport {
  readyState: GameTransport['readyState'] = 'connecting'
  private readonly pipe: RtcPacketPipe
  private readonly id = crypto.randomUUID()
  private readonly messages = new Set<(packet: string) => void>()
  private readonly closes = new Set<(event: GameTransportClose) => void>()
  private resolveOpen: (() => void) | null = null
  private rejectOpen: ((error: Error) => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(pipe: RtcPacketPipe) { this.pipe = pipe }

  async open(): Promise<GameTransport> {
    await new Promise<void>((resolve, reject) => {
      this.resolveOpen = resolve
      this.rejectOpen = reject
      this.timer = setTimeout(() => this.close(4000, 'Peer host connection timed out'), 15_000)
      this.pipe.control({ type: 'open', connectionId: this.id })
    })
    return this
  }

  acceptControl(message: Record<string, unknown>): void {
    if (message.connectionId !== this.id || this.readyState === 'closed') return
    if (message.type === 'opened' && this.readyState === 'connecting') {
      this.readyState = 'open'
      if (this.timer) clearTimeout(this.timer)
      this.resolveOpen?.()
      this.resolveOpen = null
      this.rejectOpen = null
    } else if (message.type === 'closed') {
      this.end(typeof message.code === 'number' ? message.code : 4001,
        typeof message.reason === 'string' ? message.reason : 'Peer host disconnected')
    }
  }

  acceptPacket(packet: string): void {
    if (this.readyState === 'open') for (const listener of this.messages) listener(packet)
  }

  close(code = 1000, reason = 'Session destroyed'): void {
    if (this.readyState === 'closed') return
    this.end(code, reason)
    if (this.pipe.channel.readyState === 'open') {
      try { this.pipe.control({ type: 'close', connectionId: this.id }) }
      catch { this.pipe.close('Peer connection closed') }
    }
  }

  private end(code: number, reason: string): void {
    if (this.readyState === 'closed') return
    this.readyState = 'closed'
    if (this.timer) clearTimeout(this.timer)
    this.rejectOpen?.(new Error(reason))
    this.resolveOpen = null
    this.rejectOpen = null
    for (const listener of this.closes) listener({ code, reason, wasClean: code === 1000 })
  }

  send(packet: string): void {
    if (this.readyState !== 'open') throw new Error('Peer game transport is not open')
    this.pipe.send(packet)
  }
  onMessage(listener: (packet: string) => void): () => void {
    this.messages.add(listener)
    return () => this.messages.delete(listener)
  }
  onClose(listener: (event: GameTransportClose) => void): () => void {
    this.closes.add(listener)
    return () => this.closes.delete(listener)
  }
}
