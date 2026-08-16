import { useEffect, useRef, type CSSProperties } from 'react'

import { boneyardGameOverPresentation } from './game-over-presentation.ts'

interface GameOverOverlayProps {
  canAcknowledge: boolean
  eventId: number
  gameOverExitTicks: number | null
  gameOverTicks: number
  onAcknowledge: (eventId: number) => void
  runId: string
}

export default function GameOverOverlay({
  canAcknowledge,
  eventId,
  gameOverExitTicks,
  gameOverTicks,
  onAcknowledge,
  runId,
}: GameOverOverlayProps) {
  const acknowledgedRef = useRef(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const presentation = boneyardGameOverPresentation(gameOverTicks, gameOverExitTicks)

  useEffect(() => {
    acknowledgedRef.current = false
  }, [eventId, runId])

  useEffect(() => {
    if (canAcknowledge && presentation.acceptsInput && !presentation.acknowledged) {
      buttonRef.current?.focus({ preventScroll: true })
    }
  }, [canAcknowledge, presentation.acceptsInput, presentation.acknowledged])

  const acknowledge = () => {
    if (!canAcknowledge || !presentation.acceptsInput || acknowledgedRef.current) return
    acknowledgedRef.current = true
    onAcknowledge(eventId)
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className="boneyard-game-over"
      data-event-id={eventId}
      data-game-over-ticks={gameOverTicks}
      data-game-over-exit-ticks={gameOverExitTicks ?? ''}
      data-acknowledged={presentation.acknowledged}
      data-input-ready={presentation.acceptsInput}
      data-run-id={runId}
      disabled={!canAcknowledge || !presentation.acceptsInput || presentation.acknowledged}
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
