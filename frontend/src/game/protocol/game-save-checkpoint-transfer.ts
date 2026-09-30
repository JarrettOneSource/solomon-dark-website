import { MAX_WEB_GAME_SAVE_BYTES } from '../save/game-save-contract.ts'
import { GAME_STRING_CHUNK_CHARACTERS, GAME_STRING_CHUNK_WINDOW, GAME_STRING_STREAM_THRESHOLD, GameStringReceiver, GameStringSender } from './game-string-transfer.ts'
import type { ClientSaveCheckpointChunkAckMessage } from './game-client-messages.ts'
import type { ServerSaveCheckpointChunkMessage, ServerSaveCheckpointMessage } from './game-server-messages.ts'

export const SAVE_CHECKPOINT_CHUNK_CHARACTERS = GAME_STRING_CHUNK_CHARACTERS
export const SAVE_CHECKPOINT_CHUNK_WINDOW = GAME_STRING_CHUNK_WINDOW
export const SAVE_CHECKPOINT_STREAM_THRESHOLD = GAME_STRING_STREAM_THRESHOLD

interface SendingCheckpoint {
  readonly message: ServerSaveCheckpointMessage
  readonly sender: GameStringSender
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
      this.current?.sender.close()
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
    const sender = new GameStringSender(message.save, chunk => this.send({
      type: 'server-save-checkpoint-chunk', ...chunk,
      reason: message.reason, sequence: message.sequence,
    }))
    this.current = { message, sender }
    sender.start()
  }

  acknowledge(message: ClientSaveCheckpointChunkAckMessage): void {
    if (message.sequence > this.sequence) throw new Error('Checkpoint acknowledgment refers to an unsent sequence')
    if (!this.current) return
    const transfer = this.current
    if (message.sequence < transfer.message.sequence) return
    if (message.sequence > transfer.message.sequence) throw new Error('Checkpoint acknowledgment refers to a queued sequence')
    if (transfer.sender.acknowledge(message.nextOffset) === 'complete') {
      this.current = null
      const next = this.pending
      this.pending = null
      if (next) this.start(next)
    }
  }

  close(): void {
    this.current?.sender.close()
    this.current = null
    this.pending = null
  }
}

interface ReceivingCheckpoint {
  readonly sequence: number
  readonly reason: ServerSaveCheckpointMessage['reason']
  readonly totalLength: number
}

/** Partial saves remain private to this assembler until their final chunk. */
export class GameSaveCheckpointReceiver {
  private sequence = 0
  private current: ReceivingCheckpoint | null = null
  private readonly receiver = new GameStringReceiver(MAX_WEB_GAME_SAVE_BYTES, 'save')

  acceptComplete(message: ServerSaveCheckpointMessage): void {
    if (message.sequence <= this.sequence) return
    this.sequence = message.sequence
    if (this.current && this.current.sequence <= message.sequence) this.close()
  }

  acceptChunk(message: ServerSaveCheckpointChunkMessage): ServerSaveCheckpointMessage | null {
    if (message.sequence <= this.sequence) return null
    if (this.current && message.sequence < this.current.sequence) return null
    if (!this.current || message.sequence > this.current.sequence) {
      if (message.offset !== 0) throw new Error('Checkpoint transfer is missing its first chunk')
      this.receiver.close()
      this.current = { sequence: message.sequence, reason: message.reason,
        totalLength: message.totalLength }
    }
    const transfer = this.current
    if (message.reason !== transfer.reason || message.totalLength !== transfer.totalLength) {
      throw new Error('Checkpoint chunk does not match its pending transfer')
    }
    const save = this.receiver.accept(message)
    if (save === null) return null
    this.current = null
    this.sequence = message.sequence
    return { type: 'server-save-checkpoint', save, reason: message.reason, sequence: message.sequence }
  }

  close(): void {
    this.receiver.close()
    this.current = null
  }
}
