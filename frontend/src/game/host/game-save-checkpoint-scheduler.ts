export interface GameSaveCheckpointPublishReceipt {
  readonly documentBytes: number
  readonly published: boolean
}

export interface GameSaveCheckpointBatchReceipt {
  readonly elapsedMs: number
  readonly maximumSynchronousPublishMs: number
  readonly publishedBytes: number
  readonly publishedCount: number
  readonly requestCount: number
  readonly sources: readonly string[]
  readonly synchronousPublishMs: number
  readonly targetRequestCount: number
}

interface PendingCheckpointTarget {
  source: string
}

interface CheckpointBatch {
  maximumSynchronousPublishMs: number
  publishedBytes: number
  publishedCount: number
  requestCount: number
  readonly sources: Set<string>
  readonly startedAtMs: number
  synchronousPublishMs: number
  targetRequestCount: number
}

interface GameSaveCheckpointSchedulerOptions {
  readonly onBatch: (receipt: GameSaveCheckpointBatchReceipt) => void
  readonly onError: (playerId: string, error: Error) => void
  readonly publish: (
    playerId: string,
    source: string,
  ) => GameSaveCheckpointPublishReceipt
}

/**
 * Coalesces replaceable progress per owner and yields between expensive save
 * projections. Forced leave, deployment, and Game Over writes bypass this
 * scheduler and retain their existing synchronous acknowledgement contract.
 */
export class GameSaveCheckpointScheduler {
  private batch: CheckpointBatch | null = null
  private closed = false
  private drainHandle: ReturnType<typeof setImmediate> | null = null
  private readonly onBatch: GameSaveCheckpointSchedulerOptions['onBatch']
  private readonly onError: GameSaveCheckpointSchedulerOptions['onError']
  private readonly pending = new Map<string, PendingCheckpointTarget>()
  private readonly publish: GameSaveCheckpointSchedulerOptions['publish']

  constructor(options: GameSaveCheckpointSchedulerOptions) {
    this.onBatch = options.onBatch
    this.onError = options.onError
    this.publish = options.publish
  }

  enqueue(playerIds: Iterable<string>, source: string): void {
    if (this.closed) return
    const targets = [...new Set(playerIds)]
    if (targets.length === 0) return
    const batch = this.batch ??= {
      maximumSynchronousPublishMs: 0,
      publishedBytes: 0,
      publishedCount: 0,
      requestCount: 0,
      sources: new Set(),
      startedAtMs: performance.now(),
      synchronousPublishMs: 0,
      targetRequestCount: 0,
    }
    batch.requestCount += 1
    batch.sources.add(source)
    batch.targetRequestCount += targets.length
    for (const playerId of targets) {
      this.pending.set(playerId, { source })
    }
    this.scheduleDrain()
  }

  cancel(playerId: string): void {
    this.pending.delete(playerId)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    if (this.drainHandle !== null) clearImmediate(this.drainHandle)
    this.drainHandle = null
    this.pending.clear()
    this.batch = null
  }

  private scheduleDrain(): void {
    if (this.closed || this.drainHandle !== null) return
    this.drainHandle = setImmediate(() => this.drainOne())
  }

  private drainOne(): void {
    this.drainHandle = null
    if (this.closed) return
    const next = this.pending.entries().next()
    if (next.done) {
      this.finishBatch()
      return
    }
    const [playerId, pending] = next.value
    this.pending.delete(playerId)
    const startedAtMs = performance.now()
    try {
      const receipt = this.publish(playerId, pending.source)
      const synchronousPublishMs = performance.now() - startedAtMs
      if (this.batch) {
        this.batch.synchronousPublishMs += synchronousPublishMs
        this.batch.maximumSynchronousPublishMs = Math.max(
          this.batch.maximumSynchronousPublishMs,
          synchronousPublishMs,
        )
        if (receipt.published) {
          this.batch.publishedCount += 1
          this.batch.publishedBytes += receipt.documentBytes
        }
      }
    } catch (error) {
      this.onError(
        playerId,
        error instanceof Error ? error : new Error('Scheduled game checkpoint failed.'),
      )
    }
    if (this.pending.size > 0) this.scheduleDrain()
    else this.finishBatch()
  }

  private finishBatch(): void {
    const batch = this.batch
    this.batch = null
    if (!batch) return
    this.onBatch({
      elapsedMs: Math.max(0, performance.now() - batch.startedAtMs),
      maximumSynchronousPublishMs: batch.maximumSynchronousPublishMs,
      publishedBytes: batch.publishedBytes,
      publishedCount: batch.publishedCount,
      requestCount: batch.requestCount,
      sources: [...batch.sources].sort(),
      synchronousPublishMs: batch.synchronousPublishMs,
      targetRequestCount: batch.targetRequestCount,
    })
  }
}
