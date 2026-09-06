import type { NativeBossSpell } from '../core-kernels/native-boss-spell.ts'
import { buildNativeAirRibbonLayer, type NativeAirLightningFactoryPlan } from './primary-spell-air-native.ts'

/** Anim_DarkLightningBolt: native normal blend, red ribbon, and two independent meshes. */
export function nativeDarkLightningBody(spell: Extract<NativeBossSpell, { kind: 'blightning' }>): NonNullable<NativeAirLightningFactoryPlan['body']> {
  const common = { birthTick: spell.spawnTick, dark: true, id: spell.id,
    source: { x: 0, y: 0 },
    midpoint: { x: spell.midpoint.x - spell.position.x, y: spell.midpoint.y - spell.position.y },
    endpoint: { x: spell.endpoint.x - spell.position.x, y: spell.endpoint.y - spell.position.y },
    basePhaseDegrees: -3 * spell.spawnTick }
  return { layers: [
    buildNativeAirRibbonLayer({ ...common, alpha: 1, tint: 0xffffff, width: 1, taperScale: 1.75 }),
    buildNativeAirRibbonLayer({ ...common, alpha: .5, tint: 0xff0000, width: .75, taperScale: 1.25, phaseOffset: 15 }),
  ] }
}
