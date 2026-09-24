import type {
  PrimarySpellAirHurricaneState,
  PrimarySpellWaterAuraState,
  PrimarySpellWaterHailState,
} from '../core-kernels/primary-spells.ts'
import { nativeColdAuraVisualState } from '../core-kernels/native-cold-aura.ts'
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

export interface NativeHurricaneSpritePlan {
  readonly alpha: number
  readonly blend: 'add' | 'normal'
  readonly position: Readonly<{ x: number; y: number }>
  readonly role: 'core' | 'lane' | 'lane-copy'
  readonly rotationRadians: number
  readonly scale: Readonly<{ x: number; y: number }>
  readonly tint: number
}

/** PlayerWizard::Draw 0x0052C2A0, including both effects-quality branches. */
export function nativeHurricaneVisualPlan(
  state: Pick<
    PrimarySpellAirHurricaneState,
    'charge' | 'enhancedEffects' | 'lanes' | 'phaseDegrees'
  >,
): readonly NativeHurricaneSpritePlan[] {
  if (state.lanes.length !== 8) {
    throw new RangeError('Hurricane painter requires eight native lanes')
  }
  const plans: NativeHurricaneSpritePlan[] = [{
    alpha: Math.fround(state.charge * 0.75),
    blend: 'normal',
    position: Object.freeze({ x: 0, y: -15 }),
    role: 'core',
    rotationRadians: state.phaseDegrees * 1.5 * DEGREES_TO_RADIANS,
    scale: Object.freeze({ x: 5, y: 4 }),
    tint: 0xf2ffff,
  }]
  for (const [index, lane] of state.lanes.entries()) {
    if (!state.enhancedEffects && index % 2 !== 0) continue
    const common = {
      alpha: Math.fround(state.charge * 0.4000000059604645),
      blend: 'add' as const,
      position: Object.freeze({ x: 0, y: -(lane.verticalOffset + 15) }),
      scale: Object.freeze({
        x: lane.radius,
        y: Math.fround(lane.radius * 0.800000011920929),
      }),
      tint: 0xccffff,
    }
    plans.push(Object.freeze({
      ...common,
      role: 'lane',
      rotationRadians: lane.angleDegrees * DEGREES_TO_RADIANS,
    }))
    if (state.enhancedEffects) plans.push(Object.freeze({
      ...common,
      role: 'lane-copy',
      rotationRadians: lane.angleDegrees * 0.75 * DEGREES_TO_RADIANS,
    }))
  }
  return Object.freeze(plans)
}

/** Anim_ColdAura record-14 transform and color lanes recovered at 0x0045AF20. */
export function nativeWaterAuraVisualPlan(
  state: Pick<
    PrimarySpellWaterAuraState,
    'ageTicks' | 'alphaDecay' | 'initialRotationDegrees' | 'rotationStepDegrees'
  >,
): NativeWaterAuraVisualPlan {
  const native = nativeColdAuraVisualState(state)
  return Object.freeze({
    alpha: native.alpha,
    rotationRadians: native.rotationDegrees * DEGREES_TO_RADIANS,
    scale: native.scale,
    tint: (Math.round(native.red * 255) << 16) | 0x00ffff,
  })
}

export const NATIVE_AIR_WATER_SPRITES = Object.freeze({
  coldAura: nativeEnemySpriteRegistration('BadGuys', 14),
  hail: nativeEnemySpriteRegistration('BadGuys', 32),
  hurricaneCore: nativeEnemySpriteRegistration('DeadHawg', 15),
  hurricaneLane: nativeEnemySpriteRegistration('BadGuys', 84),
} satisfies Readonly<Record<string, NativeEnemySpriteRegistration>>)

export const NATIVE_WATER_AURA_SAFE_ALPHA_TRIM = Object.freeze({
  height: 60,
  width: 63,
  x: 0,
  y: 2,
})

/** Anim_Hail draw transform recovered at 0x004540B0. */
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
