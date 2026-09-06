import type { NativeSecondaryActorState } from '../core-kernels/native-secondary-abilities.ts'
import type { NativeSecondaryAtlas } from './native-secondary-assets.ts'
import type { NativeSecondarySpriteDraw } from './native-secondary-presentation-types.ts'

export const WHITE = 0xffffff

export function secondarySprite(
  actor: NativeSecondaryActorState,
  atlas: NativeSecondaryAtlas,
  entry: number,
  role: string,
  options: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry' | 'role'>> = {},
): NativeSecondarySpriteDraw {
  return {
    alpha: actor.alpha,
    atlas,
    blend: 'normal',
    entry,
    offset: { x: 0, y: 0 },
    role,
    rotationRadians: 0,
    scaleX: actor.scale,
    scaleY: actor.scale,
    tint: WHITE,
    ...options,
  }
}

export function positiveModulo(value: number, divisor: number): number {
  return (value % divisor + divisor) % divisor
}

export function repeatedFloatDecay(initial: number, decay: number, ticks: number): number {
  let value = Math.fround(initial)
  const floatDecay = Math.fround(decay)
  for (let tick = 0; tick < Math.max(0, Math.trunc(ticks)); tick += 1) {
    value = Math.max(0, Math.fround(value - floatDecay))
    if (value === 0) break
  }
  return value
}

export function repeatedFloatMultiply(initial: number, factor: number, ticks: number): number {
  let value = Math.fround(initial)
  const floatFactor = Math.fround(factor)
  for (let tick = 0; tick < Math.max(0, Math.trunc(ticks)); tick += 1) {
    value = Math.fround(value * floatFactor)
  }
  return value
}

export function packNormalizedRgb(red: number, green: number, blue: number): number {
  const byte = (channel: number): number => Math.round(
    Math.max(0, Math.min(1, channel)) * 255,
  )
  return (byte(red) << 16) | (byte(green) << 8) | byte(blue)
}

export function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}

export function hashUnit(first: number, second: number): number {
  let value = Math.imul(first ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(second, 0xc2b2ae35)
  value ^= value >>> 16
  return (value >>> 0) / 0x1_0000_0000
}

export function packGray(value: number): number {
  const channel = Math.max(0, Math.min(255, Math.round(value * 255)))
  return channel << 16 | channel << 8 | channel
}

export function clampEntry(value: number, first: number, last: number): number {
  return Math.max(first, Math.min(last, Math.round(value)))
}
