export interface NativeHardenState {
  readonly armor: number
  readonly coating: number
}

export const NATIVE_HARDEN_COATING_PER_TICK = 0.004999999888241291
export const NATIVE_HARDEN_FORMED_THRESHOLD = 0.25
export const NATIVE_HARDEN_CHIP_THRESHOLD = 0.20000000298023224

export function createNativeHarden(): NativeHardenState {
  return { armor: 0, coating: 0 }
}

/** The active-primary dispatcher owns teardown; other held primaries do not. */
export function stepNativeHarden(
  source: NativeHardenState,
  channel: 'water' | 'weak-water' | 'other' | 'idle',
  armorPerTick: number,
  maximumArmor: number,
): NativeHardenState {
  if (channel === 'weak-water' || channel === 'idle') {
    return source.coating > 0 ? createNativeHarden() : source
  }
  if (channel !== 'water' || armorPerTick <= 0) return source
  return {
    armor: Math.fround(Math.min(maximumArmor, source.armor + armorPerTick)),
    coating: Math.fround(Math.min(1, source.coating + NATIVE_HARDEN_COATING_PER_TICK)),
  }
}

export function nativeHardenBreakAngleStep(coating: number): number | null {
  if (coating <= 0.10000000149011612) return null
  if (coating < NATIVE_HARDEN_CHIP_THRESHOLD) return 90
  if (coating < 0.30000001192092896) return 60
  if (coating < 0.4000000059604645) return 45
  if (coating < 0.5) return 35
  return 20
}

export function interpolateNativeHardenCoating(
  older: number,
  newer: number,
  sameCast: boolean,
  blend: number,
): number {
  return sameCast && newer >= older
    ? older + (newer - older) * blend
    : blend < 1 ? older : newer
}
