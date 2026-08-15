import type { BoneyardEnemyEventSnapshot } from '../protocol/game-state.ts'

export const NATIVE_ENEMY_WORLD_FEEDBACK = Object.freeze({
  accumulatorCap: 3.5,
  accumulatorFloor: 0.1,
  accumulatorImpulse: 0.20000000298023224,
  accumulatorLossPerTick: 0.0025,
  coffinIntensity: 0.2,
  magnitudeCutoff: 0.001,
  magnitudeRetentionPerTick: 0.94,
  skeletonIntensity: 0.1,
})

export interface NativeEnemyWorldFeedbackState {
  readonly accumulator: number
  readonly lastTick: number
  readonly magnitude: number
}

export interface NativeEnemyWorldFeedbackTransform {
  readonly position: Readonly<{ x: number; y: number }>
  readonly scale: number
}

export class NativeEnemyWorldFeedbackPresentation {
  private accumulator = 0
  private lastEventId = 0
  private lastTick: number
  private magnitude = 0

  constructor(initialTick: number) {
    this.lastTick = initialTick
  }

  consume(event: BoneyardEnemyEventSnapshot): boolean {
    if (event.eventId <= this.lastEventId) return false
    this.lastEventId = event.eventId
    const intensity = nativeEnemyWorldFeedbackIntensity(event)
    if (intensity === null) return false
    this.advanceTo(event.tick)
    this.magnitude = Math.fround(Math.min(this.accumulator, 1) * intensity)
    this.accumulator = Math.fround(Math.min(
      NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorCap,
      this.accumulator + NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorImpulse,
    ))
    return true
  }

  sample(tick: number): NativeEnemyWorldFeedbackState {
    this.advanceTo(Math.floor(tick))
    return Object.freeze({
      accumulator: this.accumulator,
      lastTick: this.lastTick,
      magnitude: this.magnitude,
    })
  }

  private advanceTo(tick: number): void {
    const elapsedTicks = Math.max(0, tick - this.lastTick)
    if (elapsedTicks === 0) return
    this.accumulator = Math.fround(Math.max(
      NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorFloor,
      this.accumulator
        - NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorLossPerTick * elapsedTicks,
    ))
    const retainedMagnitude = Math.fround(
      this.magnitude
        * NATIVE_ENEMY_WORLD_FEEDBACK.magnitudeRetentionPerTick ** elapsedTicks,
    )
    this.magnitude = retainedMagnitude < NATIVE_ENEMY_WORLD_FEEDBACK.magnitudeCutoff
      ? 0
      : retainedMagnitude
    this.lastTick = tick
  }
}

export function nativeEnemyWorldFeedbackIntensity(
  event: BoneyardEnemyEventSnapshot,
): number | null {
  if (event.type !== 'enemy-terminal-output') return null
  switch (event.output) {
    case 'archer-shatter':
    case 'mage-shatter':
    case 'skeleton-shatter':
      return NATIVE_ENEMY_WORLD_FEEDBACK.skeletonIntensity
    case 'coffin-break':
      return NATIVE_ENEMY_WORLD_FEEDBACK.coffinIntensity
    default:
      return null
  }
}

export function nativeEnemyWorldFeedbackTransform(
  camera: Readonly<{ x: number; y: number; zoom: number }>,
  viewport: Readonly<{ height: number; width: number }>,
  localPlayerPosition: Readonly<{ x: number; y: number }>,
  magnitude: number,
): NativeEnemyWorldFeedbackTransform {
  const basePosition = {
    x: viewport.width / 2 - camera.x * camera.zoom,
    y: viewport.height / 2 - camera.y * camera.zoom,
  }
  const anchorScreen = {
    x: basePosition.x + localPlayerPosition.x * camera.zoom,
    y: basePosition.y + localPlayerPosition.y * camera.zoom,
  }
  const scale = camera.zoom * (1 + magnitude)
  return Object.freeze({
    position: Object.freeze({
      x: anchorScreen.x - localPlayerPosition.x * scale,
      y: anchorScreen.y - localPlayerPosition.y * scale,
    }),
    scale,
  })
}
