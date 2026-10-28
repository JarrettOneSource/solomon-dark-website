import { drawNativeFloat, drawNativeInteger, type NativeRngState } from './native-rng.ts'

export interface NativeFacultyAction {
  readonly end: number
  readonly frames: readonly number[]
  readonly handMask: 1 | 2 | 3
  readonly kind: 'throw' | 'two-hand' | 'lightning'
  readonly marker: number
  readonly progress: number
  readonly rate: number
}

export function createNativeFacultyAction(
  kind: NativeFacultyAction['kind'],
  rng: NativeRngState,
): { action: NativeFacultyAction; rng: NativeRngState } {
  const side = drawNativeInteger(rng, 2)
  const hand = side.value === 1 ? 1 : 2
  rng = side.state
  let end = 20
  if (kind === 'lightning') {
    const extension = drawNativeInteger(rng, 10)
    rng = extension.state
    end = 19 + extension.value
  }
  const speed = drawNativeFloat(rng, .05000000074505806)
  const fast = drawNativeInteger(speed.state, 8)
  let rate = Math.fround(.10000000149011612 + speed.value)
  if (fast.value === 2) rate = Math.fround(rate * 1.350000023841858)
  const frames = [
    ...Array<number>(14).fill(hand), 0,
    ...Array<number>(end - 15).fill(hand === 1 ? 2 : 1), 0,
  ]
  return { rng: fast.state, action: {
    end: kind === 'two-hand' ? 28 : end,
    frames: kind === 'two-hand' ? [...Array<number>(20).fill(3), ...Array<number>(8).fill(4), 0] : frames,
    handMask: kind === 'two-hand' ? 3 : hand,
    kind,
    marker: kind === 'two-hand' ? 20 : 15,
    progress: 0,
    rate,
  } }
}

export function stepNativeFacultyAction(source: NativeFacultyAction, actorTimeScale: number): {
  action: NativeFacultyAction
  bodyPose: number
  complete: boolean
  dispatch: boolean
  lockedFacing: boolean
  marker: boolean
} {
  const progress = Math.fround(source.progress + Math.fround(source.rate * actorTimeScale))
  // 0x00410E40 admits both endpoints, including a second notification after an exact hit.
  const marker = progress > source.progress && source.progress <= source.marker && progress >= source.marker
  return {
    action: { ...source, progress },
    bodyPose: source.frames[Math.trunc(progress)] ?? 0,
    complete: progress > source.end,
    dispatch: source.kind === 'lightning' ? progress >= source.marker && progress < source.end : marker,
    lockedFacing: source.kind === 'lightning' && progress >= 9,
    marker,
  }
}
