import type { WizardElement } from './player-character.ts'
import { drawNativeFloat, type NativeRngState } from './native-rng.ts'

export type NativeStarterEquipmentColorOwner = WizardElement | 'college'

export const NATIVE_STARTER_EQUIPMENT_BASE_COLORS = Object.freeze({
  air: [0.1, 1, 1],
  college: [0.25, 0.5, 0.25],
  earth: [0, 0.75, 0],
  ether: [1, 0.1, 1],
  fire: [1, 0.1, 0.1],
  water: [0.1, 0.5, 1],
} as const satisfies Readonly<Record<NativeStarterEquipmentColorOwner, readonly [number, number, number]>>)

export interface NativeStarterEquipmentAppearance {
  readonly primaryTint: number
  readonly rng: NativeRngState
  readonly secondaryTint: number
}

const NATIVE_STARTER_JITTER_MAXIMUM = Math.fround(0.1)
const NATIVE_STARTER_LUMINANCE_MIX = Math.fround(0.800000011920929)
const NATIVE_STARTER_CHANNEL_MIX = Math.fround(0.19999998807907104)
const NATIVE_LUMINANCE_WEIGHTS = Object.freeze([
  Math.fround(0.30860000848770142),
  Math.fround(0.6093999743461609),
  Math.fround(0.0820000022649765),
] as const)

export function rollNativeStarterEquipmentAppearance(
  sourceRng: NativeRngState,
  owner: NativeStarterEquipmentColorOwner,
): NativeStarterEquipmentAppearance {
  let rng = sourceRng
  const color = NATIVE_STARTER_EQUIPMENT_BASE_COLORS[owner]
    .map((channel) => Math.fround(channel)) as [number, number, number]
  for (let channel = 0; channel < color.length; channel += 1) {
    const jitter = drawNativeFloat(rng, NATIVE_STARTER_JITTER_MAXIMUM)
    rng = jitter.state
    color[channel] = clampUnit(Math.fround(color[channel]! + jitter.value))
  }
  const luminance = Math.fround(
    Math.fround(color[0] * NATIVE_LUMINANCE_WEIGHTS[0])
    + Math.fround(color[1] * NATIVE_LUMINANCE_WEIGHTS[1])
    + Math.fround(color[2] * NATIVE_LUMINANCE_WEIGHTS[2]),
  )
  const primary = color.map((channel) => clampUnit(Math.fround(
    Math.fround(luminance * NATIVE_STARTER_LUMINANCE_MIX)
    + Math.fround(channel * NATIVE_STARTER_CHANNEL_MIX),
  )))
  return Object.freeze({
    primaryTint: rgbTint(primary),
    rng,
    secondaryTint: 0xffffff,
  })
}

function rgbTint(color: readonly number[]): number {
  const channel = (value: number) => Math.round(clampUnit(value) * 255)
  return (channel(color[0]!) << 16) | (channel(color[1]!) << 8) | channel(color[2]!)
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, Math.fround(value)))
}
