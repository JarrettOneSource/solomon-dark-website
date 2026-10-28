import type { HubActionFeedback } from '../core-kernels/hub-economy.ts'
import { hubDowsingFlashAlpha, hubDowsingFlashFeedbackSequence } from './hub-inventory-render-contract.ts'
import { presentNativeSecondaryScreenOverlay } from './native-screen-feedback.ts'

type DowsingFeedback = Pick<HubActionFeedback, 'accepted' | 'action' | 'sequence'>

/** Retained UI feedback clock; the local preference affects presentation only. */
export class HubDowsingFlashPresentation {
  private previousSequence: number | null = null
  private startedAtMs: number | null = null
  private trigger: 'buy-dowsing' | 'dowse' | null = null

  consume(feedback: DowsingFeedback | null, nowMs: number): void {
    if (feedback === null) {
      // A dialogue/closed surface carries no economy feedback. It must not
      // make the retained owner's already-consumed action look new on return.
      this.previousSequence ??= 0
      return
    }
    const sequence = feedback.sequence
    if (this.previousSequence !== null && sequence !== this.previousSequence
      && hubDowsingFlashFeedbackSequence(feedback) === sequence) {
      this.startedAtMs = nowMs
      this.trigger = feedback.action as 'buy-dowsing' | 'dowse'
    }
    this.previousSequence = sequence
  }

  sample(nowMs: number, reducedScreenFlashes: boolean): {
    readonly alpha: number
    readonly trigger: 'buy-dowsing' | 'dowse' | null
  } {
    const nativeAlpha = this.startedAtMs === null ? 0
      : hubDowsingFlashAlpha(nowMs - this.startedAtMs)
    const overlay = presentNativeSecondaryScreenOverlay(
      { alpha: nativeAlpha, color: 0xff0000 }, reducedScreenFlashes,
    )!
    return { alpha: overlay.alpha, trigger: overlay.alpha > 0 ? this.trigger : null }
  }
}
