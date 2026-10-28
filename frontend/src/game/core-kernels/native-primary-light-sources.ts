import type {
  PrimarySpellEtherImpactState,
  PrimarySpellFireEmberState,
  PrimarySpellFireExplosionState,
  PrimarySpellFireGoodImpState,
  PrimarySpellFireImpactState,
  PrimarySpellFireProjectileState,
} from './primary-spells.ts'
import {
  nativeFirePresentationRandom,
  nativeFirePresentationRandomInt,
  nativeFirePresentationSignedRandom,
} from './primary-spell-fire-native.ts'
import { NATIVE_DEFAULT_MULTIPLE_SHADOWS, type NativeBoneyardLightSource } from './native-boneyard-light-model.ts'

export const NATIVE_FIRE_EXPLOSION_LIT_ARRAY_VISIBLE_TICKS = 37
export const ETHER_PRIMARY_IMPACT_LIGHT_RADIUS = 0.75

export function nativeFireExplosionLightSource(
  state: Pick<PrimarySpellFireExplosionState, 'ageTicks' | 'origin'>,
  pointGain = 1,
  multipleShadows = NATIVE_DEFAULT_MULTIPLE_SHADOWS,
): NativeBoneyardLightSource | null {
  if (state.ageTicks >= NATIVE_FIRE_EXPLOSION_LIT_ARRAY_VISIBLE_TICKS) return null
  return {
    castsDirectionalShadow: multipleShadows,
    intensity: 1,
    position: { ...state.origin },
    radius: Math.fround(2 * Math.max(0, pointGain)),
  }
}

export function nativeFireEmberLightSource(
  state: Pick<PrimarySpellFireEmberState, 'id' | 'life' | 'position'>,
  presentationSample = 0,
): NativeBoneyardLightSource {
  return {
    castsDirectionalShadow: false,
    intensity: Math.fround(Math.min(state.life, 1) * 0.25),
    position: { ...state.position },
    radius: Math.fround(1 - nativeFirePresentationRandom(
      state.id,
      presentationSample,
      39,
      0.25,
    )),
  }
}

export function nativeFireImpactLightSource(
  state: PrimarySpellFireImpactState,
): NativeBoneyardLightSource {
  return {
    intensity: Math.max(0, 1 - state.ageTicks * 0.04),
    castsDirectionalShadow: false,
    position: { x: state.origin.x, y: state.origin.y - 10 - state.ageTicks },
    radius: 1.5,
  }
}

export function nativeFireGoodImpLightSource(
  state: PrimarySpellFireGoodImpState,
  presentationFrame: number,
): NativeBoneyardLightSource {
  const radiusMagnitude = nativeFirePresentationRandom(
    state.id,
    Math.floor(presentationFrame),
    21,
    Math.fround(0.1),
  )
  const radiusSign = nativeFirePresentationRandomInt(
    state.id,
    Math.floor(presentationFrame),
    22,
    2,
  ) === 1 ? -1 : 1
  return {
    castsDirectionalShadow: false,
    intensity: Math.fround(
      Math.fround(state.lightGlow)
      * Math.fround(0.75 + nativeFirePresentationRandom(
        state.id,
        Math.floor(presentationFrame),
        20,
        Math.fround(0.25),
      )),
    ),
    position: { ...state.position },
    radius: Math.fround(0.25 + radiusSign * radiusMagnitude),
  }
}

export function nativeFireballLightSource(
  state: PrimarySpellFireProjectileState,
  presentationFrame: number,
  multipleShadows = NATIVE_DEFAULT_MULTIPLE_SHADOWS,
): NativeBoneyardLightSource {
  return {
    intensity: 0.75,
    castsDirectionalShadow: multipleShadows,
    position: { ...state.position },
    radius: Math.fround(1 + nativeFirePresentationSignedRandom(
      state.id,
      Math.floor(presentationFrame),
      8,
      0.25,
    )),
  }
}

export function etherPrimaryImpactLightSource(
  state: PrimarySpellEtherImpactState,
): NativeBoneyardLightSource {
  let intensity = Math.fround(1)
  for (let tick = 0; tick <= Math.floor(state.ageTicks); tick += 1) {
    intensity = Math.fround(intensity + Math.fround(-0.05))
  }
  return {
    castsDirectionalShadow: false,
    intensity: Math.min(intensity, 1),
    position: { ...state.origin },
    radius: ETHER_PRIMARY_IMPACT_LIGHT_RADIUS,
  }
}
