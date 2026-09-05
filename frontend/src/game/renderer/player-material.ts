import type { PlayerCombatComponent } from '../core-kernels/player-combat.ts'
import type { NativeSecondaryPlayerState } from '../core-kernels/native-secondary-abilities.ts'

export type PlayerStatusMaterialState = Pick<PlayerCombatComponent,
  'coldSlowTicksRemaining' | 'poisonTicksRemaining' | 'poisonBeforeCold'>

export function nativePlayerMaterialTint(
  worldTint: number,
  secondary: NativeSecondaryPlayerState | undefined,
  status: PlayerStatusMaterialState,
): number {
  const material = [1, 1, 1]
  const kinds = status.poisonBeforeCold ? ['poison', 'cold'] : ['cold', 'poison']
  for (const kind of kinds) {
    const active = kind === 'poison'
      ? status.poisonTicksRemaining > 0
      : status.coldSlowTicksRemaining > 0
    if (!active) continue
    const color = kind === 'poison' ? [Math.fround(0.1), 0.5, Math.fround(0.1)] : [0.5, 1, 1]
    for (let index = 0; index < 3; index += 1) {
      material[index] = Math.fround((material[index]! + color[index]!) * 0.5)
    }
  }
  const stoneskin = (secondary?.stoneskinTicksRemaining ?? 0) > 0 ? 0.5 : 1
  const channel = (index: number, shift: number): number => Math.round(
    ((worldTint >> shift) & 0xff) * material[index]! * stoneskin,
  )
  return (channel(0, 16) << 16) | (channel(1, 8) << 8) | channel(2, 0)
}
