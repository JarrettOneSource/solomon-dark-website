import type { GameSaveCheckpoint } from './game-save-contract.ts'
import type { GameSaveStore, StoredGameSave } from './game-save-store.ts'

export type { GameSaveStore, StoredGameSave } from './game-save-store.ts'

export class GameSaveCoordinator {
  private record: StoredGameSave | null = null
  private lastSequence = 0
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

  accept(checkpoint: GameSaveCheckpoint): void {
    if (checkpoint.sequence <= this.lastSequence) return
    this.lastSequence = checkpoint.sequence
    this.pending = this.pending.then(async () => {
      if (checkpoint.document === null) {
        if (this.record !== null) await this.store.clear(this.record.revision)
        this.record = null
        this.onChange(null)
        return
      }
      if (this.record?.document === checkpoint.document) return
      this.record = await this.store.write(
        checkpoint.document,
        this.record?.revision ?? 0,
      )
      this.onChange(this.record)
    }).catch((error: unknown) => {
      this.onError(error instanceof Error ? error : new Error('Game save failed.'))
    })
  }

  current(): StoredGameSave | null {
    return this.record
  }

  idle(): Promise<void> {
    return this.pending
  }
}
