import type { NativeScreenFlashState, NativeScreenFlashWrite } from '../core-kernels/native-screen-flash.ts'
import { nativeRegionPointGain } from '../core-kernels/native-region-point-gain.ts'
import { packNormalizedRgb, repeatedFloatDecay } from './native-secondary-draws.ts'
import type { NativeSecondaryScreenFeedbackContext, NativeSecondaryScreenOverlay } from './native-secondary-presentation-types.ts'

type ObservedWrite = { write: NativeScreenFlashWrite; gain: number; eligible: boolean }

/** Replays the one native overwrite lane at the observer's presentation clock. */
export class NativeScreenFlashPresentation {
  private readonly writes = new Map<number, ObservedWrite>()
  private epoch = -1
  private retiredOrder = 0
  private tick: number
  private readonly worldKey: string

  constructor(initialTick: number, worldKey: string) {
    this.tick = Math.max(0, Math.trunc(initialTick))
    this.worldKey = worldKey
  }

  consume(state: NativeScreenFlashState, context: NativeSecondaryScreenFeedbackContext): void {
    if (state.epoch < this.epoch) return
    if (state.epoch > this.epoch) {
      this.writes.clear()
      this.retiredOrder = 0
      this.epoch = state.epoch
    }
    for (const write of state.writes) {
      if (write.worldKey !== this.worldKey || write.order <= this.retiredOrder) continue
      const existing = this.writes.get(write.order)
      if (existing?.eligible) continue
      const gain = write.flash.pointAttenuated
        ? nativeRegionPointGain(write.position, context.cameraCenter,
            context.visibleWorldWidth, context.localPlayerAlternate)
        : 1
      this.writes.set(write.order, { write, gain, eligible: false })
    }
  }

  sample(tick: number): NativeSecondaryScreenOverlay | null {
    this.tick = Math.max(this.tick, Math.trunc(tick))
    const eligible = [...this.writes.values()].filter(({ write }) => write.tick <= this.tick)
      .sort((left, right) => left.write.order - right.write.order)
    let winner: ObservedWrite | null = null
    let alpha = 0
    let lastTick = 0
    for (const observed of eligible) {
      const { write } = observed
      observed.eligible = true
      if (winner !== null) alpha = repeatedFloatDecay(alpha, winner.write.flash.decayPerTick, write.tick - lastTick)
      lastTick = write.tick
      if (write.onlyIfClear && alpha > 0) continue
      winner = observed
      alpha = Math.fround(write.flash.alpha * observed.gain)
    }
    if (winner === null) return null
    alpha = repeatedFloatDecay(alpha, winner.write.flash.decayPerTick, this.tick - lastTick)
    // An unconditional overwrite discards its predecessors even after it expires.
    const anchor = eligible.findLast(({ write }) => !write.onlyIfClear)
    if (anchor) this.retiredOrder = Math.max(this.retiredOrder, anchor.write.order - 1)
    // Keep the anchor even after expiry: it still determines whether later
    // conditional attempts were suppressed at their original ticks.
    for (const order of this.writes.keys()) {
      if (order <= this.retiredOrder) this.writes.delete(order)
    }
    if (alpha <= 0) return null
    const { red, green, blue } = winner.write.flash
    return { alpha, color: packNormalizedRgb(red, green, blue) }
  }
}
