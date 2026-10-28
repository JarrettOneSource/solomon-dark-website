import { byteLimitedString } from './codecs/values.ts'

export const GAME_STRING_CHUNK_CHARACTERS = 8 * 1024
export const GAME_STRING_CHUNK_WINDOW = 4
export const GAME_STRING_STREAM_THRESHOLD = 64 * 1024

/** Offsets count UTF-16 code units; joining retains split surrogate pairs. */
export interface GameStringChunk {
  readonly data: string
  readonly offset: number
  readonly totalLength: number
}

/** Acknowledgements keep large logical messages from filling the gameplay socket. */
export class GameStringSender {
  private data: string
  private readonly send: (chunk: GameStringChunk) => void
  private readonly outstanding = new Set<number>()
  private acknowledgedOffset = 0
  private sentOffset = 0
  private closed = false
  private pumping = false

  constructor(data: string, send: (chunk: GameStringChunk) => void) {
    if (data.length === 0) throw new Error('String transfer cannot be empty')
    this.data = data
    this.send = send
  }

  start(): void {
    this.pump()
  }

  acknowledge(nextOffset: number): 'stale' | 'advanced' | 'complete' {
    if (this.closed || nextOffset <= this.acknowledgedOffset) return 'stale'
    if (!this.outstanding.has(nextOffset)) {
      throw new Error('String acknowledgement exceeds a sent chunk')
    }
    this.acknowledgedOffset = nextOffset
    for (const offset of this.outstanding) {
      if (offset <= nextOffset) this.outstanding.delete(offset)
    }
    if (nextOffset === this.data.length) {
      this.close()
      return 'complete'
    }
    this.pump()
    return 'advanced'
  }

  close(): void {
    this.closed = true
    this.data = ''
    this.outstanding.clear()
  }

  private pump(): void {
    if (this.closed || this.pumping) return
    this.pumping = true
    try {
      while (!this.closed && this.outstanding.size < GAME_STRING_CHUNK_WINDOW
        && this.sentOffset < this.data.length) {
        const offset = this.sentOffset
        const data = this.data.slice(offset, offset + GAME_STRING_CHUNK_CHARACTERS)
        this.sentOffset += data.length
        this.outstanding.add(this.sentOffset)
        this.send({ data, offset, totalLength: this.data.length })
      }
    } finally {
      this.pumping = false
    }
  }
}

interface ReceivingString {
  readonly totalLength: number
  readonly parts: string[]
  nextOffset: number
}

/** Nothing is exposed until the complete ordered string passes its byte bound. */
export class GameStringReceiver {
  private current: ReceivingString | null = null
  private readonly maximumBytes: number
  private readonly field: string

  constructor(maximumBytes: number, field = 'transferred string') {
    this.maximumBytes = maximumBytes
    this.field = field
  }

  accept(chunk: GameStringChunk): string | null {
    if (!Number.isSafeInteger(chunk.totalLength) || chunk.totalLength < 1
      || chunk.totalLength > this.maximumBytes || !Number.isSafeInteger(chunk.offset)
      || chunk.offset < 0 || chunk.data.length === 0
      || chunk.data.length > GAME_STRING_CHUNK_CHARACTERS) {
      throw new Error('String chunk exceeds its transfer bounds')
    }
    if (!this.current) {
      if (chunk.offset !== 0) throw new Error('String transfer is missing its first chunk')
      this.current = { totalLength: chunk.totalLength, parts: [], nextOffset: 0 }
    }
    const transfer = this.current
    if (chunk.totalLength !== transfer.totalLength || chunk.offset !== transfer.nextOffset
      || chunk.offset + chunk.data.length > transfer.totalLength) {
      throw new Error('String chunk does not match its pending transfer')
    }
    transfer.parts.push(chunk.data)
    transfer.nextOffset += chunk.data.length
    if (transfer.nextOffset !== transfer.totalLength) return null
    const value = byteLimitedString(transfer.parts.join(''), this.field, this.maximumBytes)
    this.close()
    return value
  }

  close(): void {
    this.current = null
  }
}
