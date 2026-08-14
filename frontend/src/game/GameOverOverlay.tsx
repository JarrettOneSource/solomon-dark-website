import { useEffect, useRef, type CSSProperties } from 'react'

import { boneyardGameOverPresentation } from './game-over-presentation.ts'

interface GameOverOverlayProps {
  canAcknowledge: boolean
  eventId: number
  gameOverTicks: number
  onAcknowledge: (eventId: number) => void
  runId: string
}

export default function GameOverOverlay({
  canAcknowledge,
  eventId,
  gameOverTicks,
  onAcknowledge,
  runId,
}: GameOverOverlayProps) {
  const acknowledgedRef = useRef(false)
  const presentation = boneyardGameOverPresentation(gameOverTicks)

  useEffect(() => {
    acknowledgedRef.current = false
  }, [eventId, runId])

  const acknowledge = () => {
    if (!canAcknowledge || !presentation.acceptsInput || acknowledgedRef.current) return
    acknowledgedRef.current = true
    onAcknowledge(eventId)
  }

  return (
    <button
      type="button"
      className="boneyard-game-over"
      data-event-id={eventId}
      data-game-over-ticks={gameOverTicks}
      data-input-ready={presentation.acceptsInput}
      data-run-id={runId}
      disabled={!canAcknowledge || !presentation.acceptsInput}
      onClick={acknowledge}
      style={{ '--game-over-alpha': presentation.fadeAlpha } as CSSProperties}
      aria-label={presentation.acceptsInput
        ? canAcknowledge
          ? 'Game over. Continue to loadout.'
          : 'Game over. Waiting for host.'
        : 'Game over.'}
    />
  )
}
