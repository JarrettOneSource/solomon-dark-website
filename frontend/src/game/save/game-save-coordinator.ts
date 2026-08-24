import type { GameSaveCheckpoint } from './game-save-contract.ts'
import type { GameSaveStore, StoredGameSave } from './game-save-store.ts'

export type { GameSaveStore, StoredGameSave } from './game-save-store.ts'

interface AcceptedGameSaveCheckpoint {
  readonly document: string
  readonly outcome: Promise<void>
  settled: boolean
}

export class GameSaveCoordinator {
  private record: StoredGameSave | null = null
  private streamId: number | null = null
  private streamSealed = false
  private lastSequence = 0
  private lastOutcome: Promise<void> = Promise.resolve()
  private readonly accepted = new Map<number, AcceptedGameSaveCheckpoint>()
  private pending: Promise<void> = Promise.resolve()
  private readonly store: GameSaveStore
  private readonly onChange: (record: StoredGameSave | null) => void
  private readonly onError: (error: Error) => void

  constructor(
    store: GameSaveStore,
    onChange: (record: StoredGameSave | null) => void,
    onError: (error: Error) => void = () => {},
  ) {
    this.store = store
    this.onChange = onChange
    this.onError = onError
  }

  async load(): Promise<StoredGameSave | null> {
    this.record = await this.store.read()
    this.onChange(this.record)
    return this.record
  }

  accept(checkpoint: GameSaveCheckpoint): Promise<void> {
    if (this.streamId !== null && checkpoint.streamId < this.streamId) {
      return Promise.reject(new Error(
        `Game save checkpoint stream ${checkpoint.streamId} is stale.`,
      ))
    }
    if (checkpoint.streamId !== this.streamId) {
      this.streamId = checkpoint.streamId
      this.streamSealed = false
      this.lastSequence = 0
      this.accepted.clear()
    }
    if (this.streamSealed) {
      return Promise.reject(new Error(
        `Game save checkpoint stream ${checkpoint.streamId} is retired.`,
      ))
    }
    const previous = this.accepted.get(checkpoint.sequence)
    if (previous) {
      if (previous.document !== checkpoint.document) {
        return Promise.reject(new Error(
          `Game save checkpoint ${checkpoint.sequence} changed within one stream.`,
        ))
      }
      return previous.outcome
    }
    if (checkpoint.sequence <= this.lastSequence) {
      return Promise.reject(new Error(
        `Game save checkpoint ${checkpoint.sequence} arrived out of order.`,
      ))
    }
    this.lastSequence = checkpoint.sequence
    this.pruneAccepted()
    const outcome = this.persist(checkpoint.document)
    const accepted = {
      document: checkpoint.document,
      outcome,
      settled: false,
    }
    this.accepted.set(checkpoint.sequence, accepted)
    void outcome.finally(() => {
      accepted.settled = true
      this.pruneAccepted()
    }).catch(() => {})
    return outcome
  }

  replace(document: string): Promise<void> {
    this.streamSealed = this.streamId !== null
    this.accepted.clear()
    return this.persist(document)
  }

  private persist(document: string): Promise<void> {
    const operation = this.pending.then(async () => {
      if (this.record?.document === document) return
      this.record = await this.store.write(
        document,
        this.record?.revision ?? 0,
      )
      this.onChange(this.record)
    })
    this.lastOutcome = operation.catch((error: unknown) => {
      const failure = error instanceof Error ? error : new Error('Game save failed.')
      this.onError(failure)
      throw failure
    })
    void this.lastOutcome.catch(() => {})
    this.pending = this.lastOutcome.catch(() => {})
    return this.lastOutcome
  }

  current(): StoredGameSave | null {
    return this.record
  }

  idle(): Promise<void> {
    return this.lastOutcome
  }

  private pruneAccepted(): void {
    for (const [sequence, checkpoint] of this.accepted) {
      if (checkpoint.settled && sequence !== this.lastSequence) {
        this.accepted.delete(sequence)
      }
    }
  }
}
