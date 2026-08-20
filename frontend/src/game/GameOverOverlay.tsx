import type { CSSProperties } from 'react'

import { boneyardGameOverPresentation } from './game-over-presentation.ts'

interface GameOverOverlayProps {
  eventId: number
  gameOverExitTicks: number | null
  gameOverTicks: number
  runId: string
}

export default function GameOverOverlay({
  eventId,
  gameOverExitTicks,
  gameOverTicks,
  runId,
}: GameOverOverlayProps) {
  const presentation = boneyardGameOverPresentation(gameOverTicks, gameOverExitTicks)

  return (
    <div
      className="boneyard-game-over"
      data-event-id={eventId}
      data-game-over-ticks={gameOverTicks}
      data-game-over-exit-ticks={gameOverExitTicks ?? ''}
      data-run-id={runId}
      style={{ '--game-over-alpha': presentation.fadeAlpha } as CSSProperties}
      role="status"
      aria-label="Game over."
    />
  )
}
