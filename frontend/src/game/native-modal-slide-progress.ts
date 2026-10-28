export type NativeModalSlideKind = 'inventory' | 'skills'

export interface NativeModalSlideProgressSnapshot {
  readonly inventory: number
  readonly skills: number
  readonly skillViewportOffsetX: number
}

const INITIAL_SNAPSHOT: NativeModalSlideProgressSnapshot = Object.freeze({
  inventory: 0,
  skills: 0,
  skillViewportOffsetX: 0,
})

let snapshot = INITIAL_SNAPSHOT
const listeners = new Set<() => void>()

export function nativeModalSlideProgressSnapshot(): NativeModalSlideProgressSnapshot {
  return snapshot
}

export function initialNativeModalSlideProgressSnapshot(): NativeModalSlideProgressSnapshot {
  return INITIAL_SNAPSHOT
}

export function setNativeModalSlideProgress(kind: NativeModalSlideKind, progress: number): void {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError('native modal slide progress must be within [0, 1]')
  }
  if (snapshot[kind] === progress) return
  snapshot = Object.freeze({ ...snapshot, [kind]: progress })
  for (const listener of listeners) listener()
}

export function subscribeNativeModalSlideProgress(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The optional book and tutorial overlay share one native content transform. */
export function setNativeSkillViewportOffsetX(offset: number): void {
  if (snapshot.skillViewportOffsetX === offset) return
  snapshot = Object.freeze({ ...snapshot, skillViewportOffsetX: offset })
  for (const listener of listeners) listener()
}
