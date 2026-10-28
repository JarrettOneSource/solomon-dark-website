import type { NativeSecondaryScreenFlashState } from './native-secondary-abilities.ts'
import type { Vector2 } from './vector.ts'

export interface NativeScreenFlashWrite {
  readonly order: number
  readonly tick: number
  readonly worldKey: string
  readonly position: Readonly<Vector2>
  readonly flash: NativeSecondaryScreenFlashState
  readonly onlyIfClear: boolean
}

export interface NativeScreenFlashState {
  readonly epoch: number
  readonly nextOrder: number
  readonly writes: readonly NativeScreenFlashWrite[]
}

export type WriteNativeScreenFlash = (write: Omit<NativeScreenFlashWrite, 'order'>) => void

export function createNativeScreenFlashes(): NativeScreenFlashState {
  return { epoch: 0, nextOrder: 1, writes: [] }
}

export function resetNativeScreenFlashes(source: NativeScreenFlashState): NativeScreenFlashState {
  const epoch = source.epoch + 1
  if (!Number.isSafeInteger(epoch)) throw new RangeError('Screen flash epoch exhausted')
  return { epoch, nextOrder: source.nextOrder, writes: [] }
}

export function copyNativeScreenFlashes(source: NativeScreenFlashState): NativeScreenFlashState {
  return { epoch: source.epoch, nextOrder: source.nextOrder, writes: source.writes.map(write => ({
    ...write, position: { ...write.position }, flash: { ...write.flash },
  })) }
}

/** One authority execution stream; source-family IDs never define precedence. */
export function createNativeScreenFlashWriter(source: NativeScreenFlashState, tick: number): {
  write: WriteNativeScreenFlash
  state: () => NativeScreenFlashState
} {
  // Preserve a past unconditional anchor for conditional writes and interpolation.
  // The longest authored flash is Comet's 200-tick fade.
  const anchors = new Map<string, number>()
  for (let index = 0; index < source.writes.length; index += 1) {
    const write = source.writes[index]!
    if (!write.onlyIfClear && write.tick < tick - 200) anchors.set(write.worldKey, write.order)
  }
  const writes = source.writes.filter(write => write.order >= (anchors.get(write.worldKey) ?? 0))
  let nextOrder = source.nextOrder
  return {
    write(input) {
      if (!Number.isSafeInteger(nextOrder + 1)) throw new RangeError('Screen flash order exhausted')
      writes.push(Object.freeze({ ...input, order: nextOrder,
        position: Object.freeze({ ...input.position }), flash: Object.freeze({ ...input.flash }) }))
      nextOrder += 1
    },
    state: () => Object.freeze({ epoch: source.epoch, nextOrder, writes: Object.freeze([...writes]) }),
  }
}
