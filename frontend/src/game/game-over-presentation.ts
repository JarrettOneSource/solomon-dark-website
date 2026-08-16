import {
  BONEYARD_GAME_OVER_ENTRY_FADE_TICKS,
  BONEYARD_GAME_OVER_EXIT_FADE_TICKS,
  BONEYARD_GAME_OVER_INPUT_GATE_TICKS,
} from './core-kernels/game-run.ts'

export interface BoneyardGameOverPresentation {
  readonly acceptsInput: boolean
  readonly acknowledged: boolean
  readonly fadeAlpha: number
}

export function boneyardGameOverPresentation(
  gameOverTicks: number,
  gameOverExitTicks: number | null,
): BoneyardGameOverPresentation {
  const ticks = Math.max(0, Math.trunc(gameOverTicks))
  const exitTicks = gameOverExitTicks === null
    ? null
    : Math.max(0, Math.trunc(gameOverExitTicks))
  return {
    acceptsInput: exitTicks === null && ticks >= BONEYARD_GAME_OVER_INPUT_GATE_TICKS,
    acknowledged: exitTicks !== null,
    fadeAlpha: exitTicks === null
      ? Math.max(0, BONEYARD_GAME_OVER_ENTRY_FADE_TICKS - ticks)
        / BONEYARD_GAME_OVER_ENTRY_FADE_TICKS
      : Math.min(1, exitTicks / BONEYARD_GAME_OVER_EXIT_FADE_TICKS),
  }
}
