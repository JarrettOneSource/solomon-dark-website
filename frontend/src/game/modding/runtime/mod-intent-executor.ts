import type { LuaConsoleObject } from '../../protocol/game-protocol.ts'
import type { ModIntent } from './mod-rule-engine.ts'
import type { ModStateScope } from './mod-state-store.ts'

const MAXIMUM_ATOMIC_INTENTS = 256

export interface ModIntentExecutionContext {
  readonly context: LuaConsoleObject
  readonly scope: ModStateScope
  readonly tick: number
}

export interface ModIntentTransaction {
  commit(): void
  rollback(reason: string): void
}

export interface ModIntentAdapter {
  prepare(
    intents: readonly ModIntent[],
    context: ModIntentExecutionContext,
  ): ModIntentTransaction
}

export interface ModIntentExecutionResult {
  readonly accepted: boolean
  readonly error: string | null
  readonly intentCount: number
}

export class ModIntentExecutor {
  readonly #adapter: ModIntentAdapter

  constructor(adapter: ModIntentAdapter) {
    this.#adapter = adapter
  }

  execute(
    intents: readonly ModIntent[],
    context: ModIntentExecutionContext,
  ): ModIntentExecutionResult {
    if (intents.length > MAXIMUM_ATOMIC_INTENTS) {
      return Object.freeze({
        accepted: false,
        error: `atomic mod intent batch exceeds ${MAXIMUM_ATOMIC_INTENTS}`,
        intentCount: intents.length,
      })
    }
    const sequences = new Set<number>()
    for (const intent of intents) {
      if (intent.scope.kind !== context.scope.kind || intent.scope.id !== context.scope.id) {
        return Object.freeze({
          accepted: false,
          error: `mod intent ${intent.sequence} belongs to another scope`,
          intentCount: intents.length,
        })
      }
      if (sequences.has(intent.sequence)) {
        return Object.freeze({
          accepted: false,
          error: `mod intent sequence is duplicated: ${intent.sequence}`,
          intentCount: intents.length,
        })
      }
      sequences.add(intent.sequence)
    }
    let transaction: ModIntentTransaction | null = null
    try {
      transaction = this.#adapter.prepare(intents, context)
      transaction.commit()
      return Object.freeze({ accepted: true, error: null, intentCount: intents.length })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      try {
        transaction?.rollback(reason)
      } catch {
        // A rollback failure cannot replace the original transaction error.
      }
      return Object.freeze({ accepted: false, error: reason, intentCount: intents.length })
    }
  }
}
