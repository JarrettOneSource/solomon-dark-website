import { byteLimitedString } from './codecs/values.ts'
import { decodeServerGameMessage, encodeGameMessage } from './game-protocol.ts'
import { GAME_WEBSOCKET_MAX_PAYLOAD_BYTES } from './game-protocol-contract.ts'
import type { ServerGameMessage } from './game-server-messages.ts'
import { GameStringReceiver, GameStringSender } from './game-string-transfer.ts'

export const GAME_WELCOME_PROGRESS_TIMEOUT_MS = 5_000

/** Bootstrap owns its ordered prefix until the receiver acknowledges the whole welcome. */
export class GameWelcomeSender {
  private readonly sender: GameStringSender
  private readonly send: (payload: string) => void
  private readonly onComplete: (length: number) => void
  private readonly onTimeout: () => void
  private readonly totalLength: number
  private readonly encoder = new TextEncoder()
  private closed = false
  private queued: string[] = []
  private queuedBytes = 0
  private deadline: ReturnType<typeof globalThis.setTimeout> | null = null

  constructor(
    payload: string,
    send: (payload: string) => void,
    onComplete: (length: number) => void,
    onTimeout: () => void,
  ) {
    byteLimitedString(payload, 'welcome', GAME_WEBSOCKET_MAX_PAYLOAD_BYTES)
    this.totalLength = payload.length
    this.send = send
    this.onComplete = onComplete
    this.onTimeout = onTimeout
    this.sender = new GameStringSender(payload, chunk => send(encodeGameMessage({
      type: 'server-welcome-chunk', ...chunk,
    })))
  }

  start(): void {
    if (this.closed || this.deadline !== null) return
    this.refreshDeadline()
    this.sender.start()
  }

  defer(payload: string): void {
    if (this.closed) throw new Error('The welcome transfer is closed')
    const bytes = this.encoder.encode(payload).byteLength
    if (this.queuedBytes + bytes > GAME_WEBSOCKET_MAX_PAYLOAD_BYTES) {
      throw new Error('Welcome sideband queue exceeds its byte limit')
    }
    this.queued.push(payload)
    this.queuedBytes += bytes
  }

  acknowledge(nextOffset: number): void {
    const result = this.sender.acknowledge(nextOffset)
    if (result === 'stale') return
    if (result === 'advanced') {
      this.refreshDeadline()
      return
    }
    this.closed = true
    this.clearDeadline()
    const queued = this.queued
    this.queued = []
    this.queuedBytes = 0
    this.onComplete(this.totalLength)
    for (const payload of queued) this.send(payload)
  }

  close(): void {
    this.closed = true
    this.clearDeadline()
    this.sender.close()
    this.queued = []
    this.queuedBytes = 0
  }

  private refreshDeadline(): void {
    if (this.closed) return
    this.clearDeadline()
    this.deadline = globalThis.setTimeout(() => {
      this.close()
      this.onTimeout()
    }, GAME_WELCOME_PROGRESS_TIMEOUT_MS)
  }

  private clearDeadline(): void {
    if (this.deadline !== null) globalThis.clearTimeout(this.deadline)
    this.deadline = null
  }
}

type LogicalServerMessage = Exclude<ServerGameMessage, { readonly type: 'server-welcome-chunk' }>

type WelcomeReception =
  | { readonly message: null; readonly nextOffset: number }
  | { readonly message: LogicalServerMessage; readonly nextOffset: number | null }

export class GameWelcomeReceiver {
  private readonly receiver = new GameStringReceiver(GAME_WEBSOCKET_MAX_PAYLOAD_BYTES, 'welcome')
  private pending = false
  private complete = false

  receivePayload(
    payload: string,
    acknowledge: (payload: string) => void,
  ): LogicalServerMessage | null {
    const reception = this.receive(decodeServerGameMessage(payload))
    if (reception.nextOffset !== null) acknowledge(encodeGameMessage({
      type: 'client-welcome-chunk-ack', nextOffset: reception.nextOffset,
    }))
    return reception.message
  }

  receive(message: ServerGameMessage): WelcomeReception {
    if (message.type !== 'server-welcome-chunk') {
      if (message.type === 'server-welcome') {
        if (this.pending) throw new Error('The server interrupted its welcome transfer')
        this.complete = true
      }
      return { message, nextOffset: null }
    }
    if (this.complete) throw new Error('The server sent a welcome chunk after its welcome')
    const payload = this.receiver.accept(message)
    this.pending = payload === null
    const nextOffset = message.offset + message.data.length
    if (payload === null) return { message: null, nextOffset }
    const welcome = decodeServerGameMessage(payload)
    if (welcome.type !== 'server-welcome') throw new Error('The welcome transfer contains another message')
    this.complete = true
    return { message: welcome, nextOffset }
  }

  close(): void {
    this.receiver.close()
    this.pending = false
    this.complete = true
  }
}
