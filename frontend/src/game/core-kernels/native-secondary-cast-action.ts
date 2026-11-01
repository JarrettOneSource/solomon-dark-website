import type { NativePlayerHandPose } from './native-player-hand-action.ts'
import { nativeActionMarkerCrossed } from './native-action-marker.ts'

interface NativeEquippedSecondaryCastAction {
  readonly weaponKind: 'staff' | 'wand'
  readonly progress: number
}

interface NativeHandSecondaryCastAction {
  readonly weaponKind: null
  readonly progress: number
  readonly handPose: NativePlayerHandPose
  readonly handDone: boolean
}

export type NativeSecondaryCastAction = NativeEquippedSecondaryCastAction | NativeHandSecondaryCastAction

export function stepNativeSecondaryCastAction(
  action: NativeSecondaryCastAction | null,
  fasterCasterPercent: number,
  timeFactor = 1,
): { readonly action: NativeSecondaryCastAction | null; readonly pulse: boolean } {
  if (action === null || (action.weaponKind === null && action.handDone)) {
    return { action: null, pulse: false }
  }
  const rate = Math.fround(action.weaponKind === 'staff' ? .1 : .095)
  const factor = action.weaponKind === null
    ? timeFactor : Math.fround(1 + fasterCasterPercent / 100)
  const progress = Math.fround(action.progress + factor * rate)
  const pulse = nativeActionMarkerCrossed(action.progress, progress, action.weaponKind === 'staff' ? 0 : 1)
  if (action.weaponKind === null) {
    return {
      action: {
        weaponKind: null,
        progress,
        handPose: progress < 1 ? 1 : progress < 7 ? 3 : 0,
        handDone: progress >= 6,
      },
      pulse,
    }
  }
  const end = action.weaponKind === 'staff' ? 5 : 6
  return { action: progress > end ? null : { weaponKind: action.weaponKind, progress }, pulse }
}
