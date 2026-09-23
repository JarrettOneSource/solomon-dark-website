import { MAX_WEB_GAME_SAVE_BYTES } from '../save/game-save-contract.ts'
import { byteLimitedString } from './codecs/values.ts'
import type { ClientSaveCheckpointChunkAckMessage } from './game-client-messages.ts'
import type { ServerSaveCheckpointChunkMessage, ServerSaveCheckpointMessage } from './game-server-messages.ts'

export const SAVE_CHECKPOINT_CHUNK_CHARACTERS = 8 * 1024
export const SAVE_CHECKPOINT_CHUNK_WINDOW = 4
export const SAVE_CHECKPOINT_STREAM_THRESHOLD = 64 * 1024

interface SendingCheckpoint {
  readonly message: ServerSaveCheckpointMessage
  readonly outstanding: Set<number>
  sentOffset: number
  acknowledgedOffset: number
}

/** The gameplay stream carries only a bounded amount of background save data. */
export class GameSaveCheckpointSender {
  private sequence = 0
  private current: SendingCheckpoint | null = null
  private pending: ServerSaveCheckpointMessage | null = null
  private readonly send: (message: ServerSaveCheckpointMessage | ServerSaveCheckpointChunkMessage) => void

  constructor(send: (message: ServerSaveCheckpointMessage | ServerSaveCheckpointChunkMessage) => void) {
    this.send = send
  }

  publish(message: ServerSaveCheckpointMessage, mode: 'background' | 'atomic'): void {
    if (message.sequence <= this.sequence) throw new Error('Checkpoint publication sequence must advance')
    this.sequence = message.sequence
    if (mode === 'atomic' || message.save.length <= SAVE_CHECKPOINT_STREAM_THRESHOLD) {
      this.current = null
      this.pending = null
      this.send(message)
      return
    }
    if (this.current) {
      this.pending = message
      return
    }
    this.start(message)
  }

  private start(message: ServerSaveCheckpointMessage): void {
    this.current = { message, outstanding: new Set(), sentOffset: 0, acknowledgedOffset: 0 }
    this.pump()
  }

  acknowledge(message: ClientSaveCheckpointChunkAckMessage): void {
    if (message.sequence > this.sequence) throw new Error('Checkpoint acknowledgment refers to an unsent sequence')
    if (!this.current) return
    const transfer = this.current
    if (message.sequence < transfer.message.sequence) return
    if (message.sequence > transfer.message.sequence) throw new Error('Checkpoint acknowledgment refers to a queued sequence')
    if (message.nextOffset <= transfer.acknowledgedOffset) return
    if (!transfer.outstanding.has(message.nextOffset)) throw new Error('Checkpoint acknowledgment exceeds a sent chunk')
    transfer.acknowledgedOffset = message.nextOffset
    for (const offset of transfer.outstanding) {
      if (offset <= message.nextOffset) transfer.outstanding.delete(offset)
    }
    if (message.nextOffset === transfer.message.save.length) {
      this.current = null
      const next = this.pending
      this.pending = null
      if (next) this.start(next)
    } else this.pump()
  }

  close(): void {
    this.current = null
    this.pending = null
  }

  private pump(): void {
    const transfer = this.current
    if (!transfer) return
    while (transfer.outstanding.size < SAVE_CHECKPOINT_CHUNK_WINDOW
      && transfer.sentOffset < transfer.message.save.length) {
      const offset = transfer.sentOffset
      const data = transfer.message.save.slice(offset, offset + SAVE_CHECKPOINT_CHUNK_CHARACTERS)
      transfer.sentOffset += data.length
      transfer.outstanding.add(transfer.sentOffset)
      this.send({ type: 'server-save-checkpoint-chunk', data, offset,
        totalLength: transfer.message.save.length, reason: transfer.message.reason,
        sequence: transfer.message.sequence })
    }
  }
}

interface ReceivingCheckpoint {
  readonly sequence: number
  readonly reason: ServerSaveCheckpointMessage['reason']
  readonly totalLength: number
  readonly parts: string[]
  nextOffset: number
}

/** Partial saves remain private to this assembler until their final chunk. */
export class GameSaveCheckpointReceiver {
  private sequence = 0
  private current: ReceivingCheckpoint | null = null

  acceptComplete(message: ServerSaveCheckpointMessage): void {
    if (message.sequence <= this.sequence) return
    this.sequence = message.sequence
    if (this.current && this.current.sequence <= message.sequence) this.current = null
  }

  acceptChunk(message: ServerSaveCheckpointChunkMessage): ServerSaveCheckpointMessage | null {
    if (message.sequence <= this.sequence) return null
    if (this.current && message.sequence < this.current.sequence) return null
    if (!this.current || message.sequence > this.current.sequence) {
      if (message.offset !== 0) throw new Error('Checkpoint transfer is missing its first chunk')
      this.current = { sequence: message.sequence, reason: message.reason,
        totalLength: message.totalLength, parts: [], nextOffset: 0 }
    }
    const transfer = this.current
    if (message.reason !== transfer.reason || message.totalLength !== transfer.totalLength
      || message.offset !== transfer.nextOffset || message.data.length === 0
      || message.offset + message.data.length > transfer.totalLength) {
      throw new Error('Checkpoint chunk does not match its pending transfer')
    }
    transfer.parts.push(message.data)
    transfer.nextOffset += message.data.length
    if (transfer.nextOffset !== transfer.totalLength) return null
    const save = byteLimitedString(transfer.parts.join(''), 'save', MAX_WEB_GAME_SAVE_BYTES)
    this.current = null
    this.sequence = message.sequence
    return { type: 'server-save-checkpoint', save, reason: message.reason, sequence: message.sequence }
  }

  close(): void {
    this.current = null
  }
}
