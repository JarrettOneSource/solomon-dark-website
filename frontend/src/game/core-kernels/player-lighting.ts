import type { NativeWorldManagerRegistration } from './native-world-manager-order.ts'
import {
  playerPrimaryCastOwnsFacing,
  type PlayerPrimaryCastState,
} from './player-character.ts'
import type { PlayerLifeState } from './player-combat.ts'

export const NATIVE_PLAYER_LIGHT_OVERLAY_DECAY = 0.8999999761581421
export const NATIVE_PLAYER_STAFF_CAST_ONE_OVERLAY = Math.fround(0.15)
export const NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY = Math.fround(0.25)
export const NATIVE_PLAYER_STAFF_CAST_TWO_OVERLAY = Math.fround(0.45)
export const NATIVE_PLAYER_MAX_LIGHT_OVERLAY = NATIVE_PLAYER_STAFF_CAST_TWO_OVERLAY

export interface PlayerLightingState {
  readonly blindnessTicksRemaining: number
  readonly deathWeaponPainterRegistration: NativeWorldManagerRegistration | null
  readonly lightRegistration: NativeWorldManagerRegistration
  readonly overlayEffectPhase: number
}

export function createPlayerLighting(
  lightRegistration: NativeWorldManagerRegistration,
): PlayerLightingState {
  return {
    blindnessTicksRemaining: 0,
    deathWeaponPainterRegistration: null,
    lightRegistration,
    overlayEffectPhase: 0,
  }
}

export function stepPlayerOverlayLighting(
  source: PlayerLightingState,
): PlayerLightingState {
  const overlayEffectPhase = Math.fround(
    source.overlayEffectPhase * NATIVE_PLAYER_LIGHT_OVERLAY_DECAY,
  )
  const blindnessTicksRemaining = Math.max(0, source.blindnessTicksRemaining - 1)
  return overlayEffectPhase === source.overlayEffectPhase && blindnessTicksRemaining === source.blindnessTicksRemaining
    ? source
    : { ...source, blindnessTicksRemaining, overlayEffectPhase }
}

export function nativePlayerElementEffectPhase(
  primaryPhase: number,
  actionPhase: number,
): number {
  return Math.max(primaryPhase, actionPhase)
}

export function playerLightDriveActive(
  primaryCast: PlayerPrimaryCastState,
  lifeState: PlayerLifeState,
): boolean {
  return playerPrimaryCastOwnsFacing(primaryCast)
    || lifeState === 'dying'
    || lifeState === 'spectating'
}
