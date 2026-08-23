import { useEffect, useRef, type CSSProperties } from 'react'

import { nativeGameOver } from '../lib/assets.ts'
import type { GameOverExitKind } from './core-kernels/game-run.ts'
import {
  gameOverPresentation,
  solomonRiffPresentation,
} from './game-over-presentation.ts'
import NativeGameOverPrompt from './NativeGameOverPrompt.tsx'

interface GameOverOverlayProps {
  anchor: Readonly<{ x: number; y: number; zoom: number }>
  eventId: number
  gameOverExitKind: GameOverExitKind | null
  gameOverExitTicks: number | null
  gameOverTicks: number
  onContinue: (eventId: number) => void
  runId: string
}

export default function GameOverOverlay({
  anchor,
  eventId,
  gameOverExitKind,
  gameOverExitTicks,
  gameOverTicks,
  onContinue,
  runId,
}: GameOverOverlayProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const presentation = gameOverPresentation(
    gameOverTicks,
    gameOverExitTicks,
    gameOverExitKind,
  )
  const riff = solomonRiffPresentation(gameOverTicks)

  useEffect(() => {
    if (presentation.acceptsInput) buttonRef.current?.focus({ preventScroll: true })
  }, [presentation.acceptsInput])

  return (
    <button
      ref={buttonRef}
      type="button"
      className="boneyard-game-over"
      data-event-id={eventId}
      data-game-over-exit-kind={gameOverExitKind ?? ''}
      data-game-over-exit-ticks={gameOverExitTicks ?? ''}
      data-game-over-ticks={gameOverTicks}
      data-input-ready={presentation.acceptsInput}
      data-game-controller-navigation-root="true"
      data-game-default-focus="true"
      data-riff-record={riff.frameRecord ?? ''}
      data-run-id={runId}
      disabled={!presentation.acceptsInput}
      onClick={() => onContinue(eventId)}
      aria-label={presentation.acceptsInput
        ? 'Game over. Continue to loadout.'
        : 'Game over.'}
    >
      {riff.visible && riff.frameRecord !== null ? (
        <i
          className="game-over-solomon-riff"
          style={{
            '--game-over-riff-frame': riff.frameRecord - 1,
            '--game-over-riff-scale': anchor.zoom,
            backgroundImage: `url("${nativeGameOver.solomonRiff}")`,
            left: anchor.x + riff.xOffset * anchor.zoom,
            top: anchor.y + riff.yOffset * anchor.zoom,
          } as CSSProperties}
          aria-hidden
        />
      ) : null}
      <i
        className="game-over-black game-over-entry-black"
        style={{ opacity: presentation.entryFadeAlpha }}
        aria-hidden
      />
      <img
        className="game-over-word game-over-word-game"
        src={nativeGameOver.game}
        style={{ opacity: presentation.titleAlpha }}
        alt=""
      />
      <img
        className="game-over-word game-over-word-over"
        src={nativeGameOver.over}
        style={{ opacity: presentation.titleAlpha }}
        alt=""
      />
      <span className="game-over-prompt" style={{ opacity: presentation.promptAlpha }}>
        <NativeGameOverPrompt />
      </span>
      <i
        className="game-over-black game-over-exit-black"
        style={{ opacity: presentation.exitFadeAlpha }}
        aria-hidden
      />
    </button>
  )
}
