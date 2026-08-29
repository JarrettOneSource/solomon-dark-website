import {
  playerPrimaryCastOwnsFacing,
  type PlayerPrimaryCastState,
} from './player-character.ts'
import type { PlayerLifeState } from './player-combat.ts'
import type { NativeWorldManagerRegistration } from './native-world-manager-order.ts'

export const NATIVE_PLAYER_LIGHT_OVERLAY_DECAY = 0.8999999761581421
export const NATIVE_PLAYER_STAFF_CAST_ONE_OVERLAY = Math.fround(0.15)
export const NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY = Math.fround(0.25)
export const NATIVE_PLAYER_STAFF_CAST_TWO_OVERLAY = Math.fround(0.45)
export const NATIVE_PLAYER_MAX_LIGHT_OVERLAY = NATIVE_PLAYER_STAFF_CAST_TWO_OVERLAY

export interface PlayerLightingState {
  readonly deathWeaponPainterRegistration: NativeWorldManagerRegistration | null
  readonly lightRegistration: NativeWorldManagerRegistration
  readonly overlayEffectPhase: number
}

export function createPlayerLighting(
  lightRegistration: NativeWorldManagerRegistration,
): PlayerLightingState {
  return {
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
  return overlayEffectPhase === source.overlayEffectPhase
    ? source
    : { ...source, overlayEffectPhase }
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
