import type { NativePlayerWeaponKind } from './native-player-weapon.ts'

export interface NativeSecondaryCastAction {
  readonly weaponKind: NativePlayerWeaponKind
  readonly progress: number
}

export function stepNativeSecondaryCastAction(
  action: NativeSecondaryCastAction | null,
  fasterCasterPercent: number,
): NativeSecondaryCastAction | null {
  if (action === null) return null
  const rate = Math.fround(action.weaponKind === 'staff' ? 0.1 : 0.095)
  const factor = Math.fround(1 + fasterCasterPercent / 100)
  const progress = Math.fround(action.progress + factor * rate)
  const end = action.weaponKind === 'staff' ? 5 : 6
  return progress > end ? null : { weaponKind: action.weaponKind, progress }
}
