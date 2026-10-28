import type { GameSaveCheckpoint } from './game-save-contract.ts'
import type { GameSaveStore, StoredGameSave } from './game-save-store.ts'

export type { GameSaveStore, StoredGameSave } from './game-save-store.ts'

interface AcceptedGameSaveCheckpoint {
  readonly document: string
  readonly outcome: Promise<void>
  settled: boolean
}

interface PersistenceWaiter {
  readonly reject: (error: Error) => void
  readonly resolve: () => void
}

interface PendingPersistence {
  document: string
  readonly waiters: PersistenceWaiter[]
}

export class GameSaveCoordinator {
  private record: StoredGameSave | null = null
  private streamId: number | null = null
  private streamSealed = false
  private lastSequence = 0
  private lastOutcome: Promise<void> = Promise.resolve()
  private readonly accepted = new Map<number, AcceptedGameSaveCheckpoint>()
  private activePersistence: Promise<void> | null = null
  private pendingPersistence: PendingPersistence | null = null
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
    let resolve!: () => void
    let reject!: (error: Error) => void
    const outcome = new Promise<void>((resolveOutcome, rejectOutcome) => {
      resolve = resolveOutcome
      reject = rejectOutcome
    })
    const waiter = { reject, resolve }
    if (this.pendingPersistence) {
      this.pendingPersistence.document = document
      this.pendingPersistence.waiters.push(waiter)
    } else {
      this.pendingPersistence = { document, waiters: [waiter] }
    }
    this.lastOutcome = outcome
    void outcome.catch(() => {})
    this.startPersistence()
    return outcome
  }

  current(): StoredGameSave | null {
    return this.record
  }

  idle(): Promise<void> {
    return this.lastOutcome
  }

  private startPersistence(): void {
    if (this.activePersistence) return
    const active = this.drainPersistence()
    this.activePersistence = active
    void active.finally(() => {
      if (this.activePersistence !== active) return
      this.activePersistence = null
      if (this.pendingPersistence) this.startPersistence()
    })
  }

  private async drainPersistence(): Promise<void> {
    while (this.pendingPersistence) {
      const pending = this.pendingPersistence
      this.pendingPersistence = null
      try {
        if (this.record?.document !== pending.document) {
          this.record = await this.store.write(
            pending.document,
            this.record?.revision ?? 0,
          )
          this.onChange(this.record)
        }
        for (const waiter of pending.waiters) waiter.resolve()
      } catch (error) {
        const failure = error instanceof Error ? error : new Error('Game save failed.')
        this.onError(failure)
        for (const waiter of pending.waiters) waiter.reject(failure)
      }
    }
  }

  private pruneAccepted(): void {
    for (const [sequence, checkpoint] of this.accepted) {
      if (checkpoint.settled && sequence !== this.lastSequence) {
        this.accepted.delete(sequence)
      }
    }
  }
}
