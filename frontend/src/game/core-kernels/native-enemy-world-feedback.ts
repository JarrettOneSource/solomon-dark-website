export const NATIVE_ENEMY_WORLD_FEEDBACK = Object.freeze({
  accumulatorCap: 3.5,
  accumulatorFloor: 0.1,
  accumulatorImpulse: 0.20000000298023224,
  accumulatorLossPerTick: 0.0025,
  coffinIntensity: 0.2,
  demonIntensity: 0.2,
  impSplitIntensity: 0.05,
  impTerminalIntensity: 0.1,
  magnitudeCutoff: 0.001,
  magnitudeRetentionPerTick: 0.94,
  skeletonIntensity: 0.1,
  wraithIntensity: 0.1,
  zombieIntensity: 0.1,
})

export type NativeEnemyWorldFeedbackOutput =
  | 'archer-shatter'
  | 'coffin-break'
  | 'demon-split'
  | 'imp-split'
  | 'mage-shatter'
  | 'skeleton-shatter'
  | 'wraith-fragments'
  | 'zombie-collapse'

export interface NativeEnemyWorldFeedbackKernelState {
  readonly accumulator: number
  readonly magnitude: number
}

export function createNativeEnemyWorldFeedbackState(): NativeEnemyWorldFeedbackKernelState {
  return Object.freeze({ accumulator: 0, magnitude: 0 })
}

export function stepNativeEnemyWorldFeedback(
  source: NativeEnemyWorldFeedbackKernelState,
  elapsedTicks = 1,
): NativeEnemyWorldFeedbackKernelState {
  if (!Number.isSafeInteger(elapsedTicks) || elapsedTicks < 0) {
    throw new RangeError('enemy world-feedback elapsed ticks must be non-negative')
  }
  if (elapsedTicks === 0) return source
  const accumulator = Math.fround(Math.max(
    NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorFloor,
    source.accumulator
      - NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorLossPerTick * elapsedTicks,
  ))
  const retainedMagnitude = Math.fround(
    source.magnitude
      * NATIVE_ENEMY_WORLD_FEEDBACK.magnitudeRetentionPerTick ** elapsedTicks,
  )
  return Object.freeze({
    accumulator,
    magnitude: retainedMagnitude < NATIVE_ENEMY_WORLD_FEEDBACK.magnitudeCutoff
      ? 0
      : retainedMagnitude,
  })
}

export function applyNativeEnemyWorldFeedback(
  source: NativeEnemyWorldFeedbackKernelState,
  intensity: number,
): NativeEnemyWorldFeedbackKernelState {
  if (!Number.isFinite(intensity) || intensity < 0) {
    throw new RangeError('enemy world-feedback intensity must be non-negative')
  }
  return Object.freeze({
    accumulator: Math.fround(Math.min(
      NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorCap,
      source.accumulator + NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorImpulse,
    )),
    magnitude: Math.fround(Math.min(source.accumulator, 1) * intensity),
  })
}

export function nativeEnemyWorldFeedbackImpulses(
  output: NativeEnemyWorldFeedbackOutput,
  outputCount?: number,
): readonly number[] {
  switch (output) {
    case 'archer-shatter':
    case 'mage-shatter':
    case 'skeleton-shatter':
      return [NATIVE_ENEMY_WORLD_FEEDBACK.skeletonIntensity]
    case 'imp-split':
      return [outputCount !== undefined && outputCount > 0
        ? NATIVE_ENEMY_WORLD_FEEDBACK.impSplitIntensity
        : NATIVE_ENEMY_WORLD_FEEDBACK.impTerminalIntensity]
    case 'zombie-collapse':
      return [NATIVE_ENEMY_WORLD_FEEDBACK.zombieIntensity]
    case 'wraith-fragments':
      return [
        NATIVE_ENEMY_WORLD_FEEDBACK.wraithIntensity,
        NATIVE_ENEMY_WORLD_FEEDBACK.wraithIntensity,
      ]
    case 'coffin-break': return [NATIVE_ENEMY_WORLD_FEEDBACK.coffinIntensity]
    case 'demon-split': return [NATIVE_ENEMY_WORLD_FEEDBACK.demonIntensity]
  }
}
