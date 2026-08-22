import {
  GAME_OVER_ENTRY_FADE_TICKS,
  GAME_OVER_INPUT_ACCEPT_TICK,
  gameOverExitDurationTicks,
  type GameOverExitKind,
} from './core-kernels/game-run.ts'

export const GAME_OVER_TITLE_FADE_START_TICK = 300
export const GAME_OVER_PROMPT_FADE_START_TICK = 400
export const SOLOMON_RIFF_ENTRY_TICK = 201
export const SOLOMON_RIFF_GUITAR_TICK = 550

export interface GameOverPresentation {
  readonly acceptsInput: boolean
  readonly entryFadeAlpha: number
  readonly exitFadeAlpha: number
  readonly promptAlpha: number
  readonly titleAlpha: number
}

export interface SolomonRiffPresentation {
  readonly frameRecord: number | null
  readonly visible: boolean
  readonly xOffset: number
  readonly yOffset: number
}

export function gameOverPresentation(
  gameOverTicks: number,
  gameOverExitTicks: number | null,
  gameOverExitKind: GameOverExitKind | null,
): GameOverPresentation {
  const ticks = nonnegativeTick(gameOverTicks)
  const exitTicks = gameOverExitTicks === null
    ? null
    : nonnegativeTick(gameOverExitTicks)
  return {
    acceptsInput: exitTicks === null && ticks >= GAME_OVER_INPUT_ACCEPT_TICK,
    entryFadeAlpha: clampUnit(
      (GAME_OVER_ENTRY_FADE_TICKS - ticks) / GAME_OVER_ENTRY_FADE_TICKS,
    ),
    exitFadeAlpha: exitTicks === null
      ? 0
      : clampUnit(exitTicks / gameOverExitDurationTicks(gameOverExitKind)),
    promptAlpha: clampUnit((ticks - GAME_OVER_PROMPT_FADE_START_TICK) * 0.005),
    titleAlpha: clampUnit((ticks - GAME_OVER_TITLE_FADE_START_TICK) * 0.005),
  }
}

export function solomonRiffPresentation(gameOverTicks: number): SolomonRiffPresentation {
  const finalProgramTick = 951
  const ticks = Math.min(nonnegativeTick(gameOverTicks), finalProgramTick)
  let visible = false
  let xOffset = Math.fround(-375)
  let yOffset = Math.fround(-5)
  let verticalVelocity = Math.fround(-4)
  let frame = Math.fround(0)
  let phase = 0

  for (let counter = 1; counter <= ticks; counter += 1) {
    if (!visible) {
      if (counter >= SOLOMON_RIFF_ENTRY_TICK) visible = true
      continue
    }
    if (yOffset < 0) {
      xOffset = Math.fround(xOffset + 4.4)
      yOffset = Math.fround(yOffset + verticalVelocity)
      verticalVelocity = Math.fround(verticalVelocity + 0.125)
      if (yOffset > 0) yOffset = 0
      continue
    }
    if (phase === 0) {
      if (frame < 3) frame = Math.fround(frame - 0.03)
      frame = Math.fround(frame + 0.13)
      if (frame >= 5) frame = Math.fround(3)
      if (counter > 820) phase = 1
      continue
    }
    if (phase === 1) {
      frame = Math.fround((Math.trunc(counter / 8) & 1))
      if (counter > 920) {
        phase = 2
        frame = Math.fround(6)
      }
      continue
    }
    frame = Math.fround(frame + 0.2)
    if (frame > 11) frame = Math.fround(11)
  }

  return {
    frameRecord: visible ? Math.trunc(frame) + 1 : null,
    visible,
    xOffset,
    yOffset,
  }
}

function nonnegativeTick(value: number): number {
  return Math.max(0, Math.trunc(value))
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}
