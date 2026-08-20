import type { NativePlayerStaffVfx } from '../core-kernels/native-player-staff-action.ts'

export interface PlayerStaffVfxRenderPlan {
  readonly alpha: number
  readonly blendMode: 'add' | 'normal'
  readonly entry: 15 | 40 | 45 | 88
  readonly light: null
  readonly position: Readonly<{ x: number; y: number }>
  readonly rotationRadians: number
  readonly scale: number
  readonly tint: number | null
}

export function nativePlayerStaffVfxRenderPlan(
  state: NativePlayerStaffVfx,
): PlayerStaffVfxRenderPlan {
  return Object.freeze({
    alpha: state.alpha,
    blendMode: state.kind === 'player-staff-smoke' ? 'normal' : 'add',
    entry: state.entry,
    light: null,
    position: Object.freeze({ ...state.position }),
    rotationRadians: state.rotationDegrees * Math.PI / 180,
    scale: state.scale,
    tint: state.kind === 'player-staff-smoke' ? null : state.tint,
  })
}
