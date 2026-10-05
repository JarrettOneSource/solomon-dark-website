import type { Vector2 } from './vector.ts'
import type { NativeWorldManagerRegistration } from './native-world-manager-order.ts'

export const NATIVE_SPARKLE_TIMER = 180
export const NATIVE_SPARKLE_RISE_PER_TICK = Math.fround(0.1)

export interface NativeSparkleState {
  readonly alpha: number
  readonly decay: number
  readonly id: number
  readonly position: Vector2
  readonly painterRegistration: NativeWorldManagerRegistration | null
  readonly rotationDegrees: number
  readonly timer: number
  readonly worldKey: string
}

export function stepNativeSparkle<T extends NativeSparkleState>(source: T): T | null {
  const timer = Math.fround(source.timer - source.decay)
  if (timer <= 0) return null
  return {
    ...source,
    position: { x: source.position.x, y: Math.fround(source.position.y - NATIVE_SPARKLE_RISE_PER_TICK) },
    timer,
  }
}

export function nativeSparkleScale(timer: number): number {
  return Math.sin(timer * Math.PI / 180)
}
