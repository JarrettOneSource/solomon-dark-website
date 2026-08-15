import {
  playerPrimaryCastOwnsFacing,
  type PlayerPrimaryCastState,
  type WizardElement,
} from './player-character.ts'
import type { PlayerLifeState } from './player-combat.ts'
import type { NativeLightProviderRegistration } from './native-light-provider-order.ts'

export const NATIVE_PLAYER_LIGHT_OVERLAY_DECAY = 0.8999999761581421
export const NATIVE_PLAYER_STAFF_CAST_ONE_OVERLAY = Math.fround(0.15)
export const NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY = Math.fround(0.25)
export const NATIVE_PLAYER_MAX_LIGHT_OVERLAY = Math.fround(0.45)

export interface PlayerLightingState {
  readonly lightRegistration: NativeLightProviderRegistration
  readonly overlayEffectPhase: number
}

export function createPlayerLighting(
  lightRegistration: NativeLightProviderRegistration,
): PlayerLightingState {
  return {
    lightRegistration,
    overlayEffectPhase: 0,
  }
}

export function stepPlayerOverlayLighting(
  source: PlayerLightingState,
  element: WizardElement,
  primaryCast: PlayerPrimaryCastState,
): PlayerLightingState {
  let phase = source.overlayEffectPhase
  if (
    (element === 'ether' || element === 'fire')
    && primaryCast.actionTick >= 0
  ) {
    phase = NATIVE_PLAYER_STAFF_CAST_ONE_OVERLAY
  } else if (
    (element === 'air' || element === 'water' || element === 'earth')
    && primaryCast.channelActive
  ) {
    phase = NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY
  }
  const overlayEffectPhase = Math.fround(phase * NATIVE_PLAYER_LIGHT_OVERLAY_DECAY)
  return overlayEffectPhase === source.overlayEffectPhase
    ? source
    : { ...source, overlayEffectPhase }
}

export function playerLightDriveActive(
  primaryCast: PlayerPrimaryCastState,
  lifeState: PlayerLifeState,
): boolean {
  return playerPrimaryCastOwnsFacing(primaryCast)
    || lifeState === 'dying'
    || lifeState === 'spectating'
}
