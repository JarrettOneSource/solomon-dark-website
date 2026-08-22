import type { GameRunLifecycleState } from './core-kernels/game-run.ts'
import type { GameStreamCue } from './game-audio-native.ts'
import { SOLOMON_RIFF_GUITAR_TICK } from './game-over-presentation.ts'

export function gameOverAudioEvents(
  previous: GameRunLifecycleState,
  current: GameRunLifecycleState,
): readonly GameStreamCue[] {
  if (current.phase !== 'game-over' || current.runId === null) return []
  const entered = previous.phase !== 'game-over'
    || previous.runId !== current.runId
    || previous.gameOverEventId !== current.gameOverEventId
  const crossedGuitar = !entered
    && previous.gameOverTicks < SOLOMON_RIFF_GUITAR_TICK
    && current.gameOverTicks >= SOLOMON_RIFF_GUITAR_TICK
  return [
    ...(entered ? ['solomon-laugh-big' as const] : []),
    ...(crossedGuitar ? ['death-guitar' as const] : []),
  ]
}
