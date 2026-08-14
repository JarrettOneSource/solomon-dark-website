import { BONEYARD_GAME_OVER_INPUT_GATE_TICKS } from './core-kernels/game-run.ts'

/**
 * The stock Boneyard branch is fade-only. The exact retail blend recurrence is
 * not closed, so the web surface uses a named 1.5 second deterministic fade
 * while retaining the exact 1000-tick input gate.
 */
export const BONEYARD_GAME_OVER_WEB_FADE_TICKS = 150

export interface BoneyardGameOverPresentation {
  readonly acceptsInput: boolean
  readonly fadeAlpha: number
}

export function boneyardGameOverPresentation(
  gameOverTicks: number,
): BoneyardGameOverPresentation {
  const ticks = Math.max(0, Math.trunc(gameOverTicks))
  return {
    acceptsInput: ticks >= BONEYARD_GAME_OVER_INPUT_GATE_TICKS,
    fadeAlpha: Math.min(1, ticks / BONEYARD_GAME_OVER_WEB_FADE_TICKS),
  }
}
