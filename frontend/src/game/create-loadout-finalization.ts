import { NATIVE_CREATE_RANDOMIZE_FINALIZE_MS } from './core-kernels/native-create-loadout.ts'
import type { PlayerCharacterConfig } from './core-kernels/player-character.ts'
import { CREATE_DISCIPLINE_FINALIZE_MS } from './game-audio-native.ts'

export interface CreateLoadoutCommit {
  readonly config: PlayerCharacterConfig
  readonly kind: 'manual' | 'randomize'
  readonly startedAtMs: number
}

/** One cancellable Create commit, shared by the manual and native dice inputs. */
export function startCreateLoadoutFinalization(options: CreateLoadoutCommit & {
  requestFrame: (callback: (time: number) => void) => number
  cancelFrame: (handle: number) => void
  onManualFinalize: () => void
  onStart: (config: PlayerCharacterConfig) => Promise<boolean>
  onRelease: () => void
}): () => void {
  const config = { ...options.config }
  const duration = options.kind === 'randomize'
    ? NATIVE_CREATE_RANDOMIZE_FINALIZE_MS
    : CREATE_DISCIPLINE_FINALIZE_MS
  let active = true
  let frame = 0
  const update = (now: number) => {
    if (!active) return
    if (now - options.startedAtMs < duration) {
      frame = options.requestFrame(update)
      return
    }
    frame = 0
    if (options.kind === 'manual') options.onManualFinalize()
    void Promise.resolve().then(() => {
      if (!active) return true
      return options.onStart(config)
    }).then((started) => {
      if (active && !started) options.onRelease()
    }, () => {
      if (active) options.onRelease()
    })
  }
  frame = options.requestFrame(update)
  return () => {
    active = false
    if (frame !== 0) options.cancelFrame(frame)
  }
}
