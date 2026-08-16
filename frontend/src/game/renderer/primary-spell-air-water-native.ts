import type {
  PrimarySpellWaterAuraState,
  PrimarySpellWaterHailState,
} from '../core-kernels/primary-spells.ts'
import {
  NATIVE_WATER_AURA_INITIAL_ALPHA,
  NATIVE_WATER_AURA_RED_FADE_PER_TICK,
  NATIVE_WATER_AURA_SCALE_FACTOR,
} from '../core-kernels/air-water-spell-actors.ts'
import {
  nativeEnemySpriteRegistration,
  type NativeEnemySpriteRegistration,
} from './native-enemy-sprite-registration.ts'

const DEGREES_TO_RADIANS = Math.PI / 180

export interface NativeWaterAuraVisualPlan {
  readonly alpha: number
  readonly rotationRadians: number
  readonly scale: number
  readonly tint: number
}

/** Anim_ColdAura record-14 transform and color lanes recovered at 0x0045AF20. */
export function nativeWaterAuraVisualPlan(
  state: Pick<
    PrimarySpellWaterAuraState,
    'ageTicks' | 'alphaDecay' | 'initialRotationDegrees' | 'rotationStepDegrees'
  >,
): NativeWaterAuraVisualPlan {
  const age = Math.max(0, Math.trunc(state.ageTicks))
  let scale = Math.fround(1)
  for (let tick = 0; tick < age; tick += 1) {
    scale = Math.fround(scale * NATIVE_WATER_AURA_SCALE_FACTOR)
  }
  const red = Math.max(0, Math.fround(1 - age * NATIVE_WATER_AURA_RED_FADE_PER_TICK))
  return Object.freeze({
    alpha: Math.max(0, Math.fround(NATIVE_WATER_AURA_INITIAL_ALPHA - age * state.alphaDecay)),
    rotationRadians: (
      state.initialRotationDegrees + age * state.rotationStepDegrees
    ) * DEGREES_TO_RADIANS,
    scale,
    tint: (Math.round(red * 255) << 16) | 0x00ffff,
  })
}

export type NativeAirWaterSpriteKey = keyof typeof NATIVE_AIR_WATER_SPRITES

export const NATIVE_AIR_WATER_SPRITES = Object.freeze({
  coldAura: nativeEnemySpriteRegistration('BadGuys', 14),
  hail: nativeEnemySpriteRegistration('BadGuys', 32),
  prismaticSpark0: nativeEnemySpriteRegistration('BadGuys', 110),
} satisfies Readonly<Record<string, NativeEnemySpriteRegistration>>)

/** Anim_Hail draw transform recovered at 0x00458D80. */
export function nativeHailVisualPlan(
  state: Pick<
    PrimarySpellWaterHailState,
    'height' | 'life' | 'rotationDegrees' | 'scale'
  >,
) {
  return Object.freeze({
    alpha: Math.min(state.life, 1),
    offsetY: state.height,
    rotationRadians: state.rotationDegrees * DEGREES_TO_RADIANS,
    scale: state.scale,
  })
}
