import type { BoneyardEnemyEventSnapshot } from '../protocol/game-state.ts'
import {
  applyNativeEnemyWorldFeedback,
  createNativeEnemyWorldFeedbackState,
  nativeEnemyWorldFeedbackImpulses,
  NATIVE_ENEMY_WORLD_FEEDBACK,
  stepNativeEnemyWorldFeedback,
  type NativeEnemyWorldFeedbackKernelState,
} from '../core-kernels/native-enemy-world-feedback.ts'

export { NATIVE_ENEMY_WORLD_FEEDBACK }

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
  private feedback: NativeEnemyWorldFeedbackKernelState = createNativeEnemyWorldFeedbackState()
  private lastEventId = 0
  private lastTick: number

  constructor(
    initialTick: number,
    initialFeedback: NativeEnemyWorldFeedbackKernelState = createNativeEnemyWorldFeedbackState(),
    initialEventId = 0,
  ) {
    this.feedback = Object.freeze({ ...initialFeedback })
    this.lastEventId = initialEventId
    this.lastTick = initialTick
  }

  consume(event: BoneyardEnemyEventSnapshot): boolean {
    if (event.eventId <= this.lastEventId) return false
    this.lastEventId = event.eventId
    if (event.type !== 'enemy-terminal-output' || event.output === undefined) return false
    const impulses = nativeEnemyWorldFeedbackImpulses(event.output, event.count)
    this.advanceTo(event.tick)
    for (const intensity of impulses) {
      this.feedback = applyNativeEnemyWorldFeedback(this.feedback, intensity)
    }
    return true
  }

  sample(tick: number): NativeEnemyWorldFeedbackState {
    this.advanceTo(Math.floor(tick))
    return Object.freeze({
      accumulator: this.feedback.accumulator,
      lastTick: this.lastTick,
      magnitude: this.feedback.magnitude,
    })
  }

  private advanceTo(tick: number): void {
    const elapsedTicks = Math.max(0, tick - this.lastTick)
    if (elapsedTicks === 0) return
    this.feedback = stepNativeEnemyWorldFeedback(this.feedback, elapsedTicks)
    this.lastTick = tick
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
