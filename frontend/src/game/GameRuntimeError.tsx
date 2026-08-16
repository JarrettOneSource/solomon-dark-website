import { useState } from 'react'

import type { GameConnectionFailure } from './client/game-connection-failure.ts'
import {
  submitBrowserGameDiagnostics,
  type GameClientDiagnostics,
} from './client/game-diagnostics.ts'
import './game-runtime-error.css'

interface GameRuntimeErrorProps {
  diagnostics: GameClientDiagnostics
  failure: GameConnectionFailure
  token: string | null
}

type SubmissionState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; logId: string }
  | { kind: 'failed'; message: string }

export default function GameRuntimeError({
  diagnostics,
  failure,
  token,
}: GameRuntimeErrorProps) {
  const [submission, setSubmission] = useState<SubmissionState>({ kind: 'idle' })
  const disconnected = [
    'authentication-failed',
    'connection-lost',
    'connection-timeout',
    'invalid-message',
    'protocol-mismatch',
    'server-error',
    'server-full',
    'server-rejected',
    'server-restart',
    'session-ended',
    'transport-unavailable',
  ].includes(failure.code)

  const submit = async () => {
    if (submission.kind === 'sending' || submission.kind === 'sent') return
    setSubmission({ kind: 'sending' })
    diagnostics.info(
      'diagnostics.submission_requested',
      'The player chose to send the current game diagnostics to the server.',
    )
    try {
      const receipt = await submitBrowserGameDiagnostics(
        diagnostics.createReport(failure),
        { token },
      )
      diagnostics.info(
        'diagnostics.submitted',
        'The server accepted the game diagnostics.',
        `logId=${receipt.logId}`,
      )
      setSubmission({ kind: 'sent', logId: receipt.logId })
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'The logs could not be sent to the server.'
      diagnostics.error('diagnostics.submission_failed', message)
      setSubmission({ kind: 'failed', message })
    }
  }

  return (
    <main className="game-runtime-error">
      <section className="game-runtime-error-panel" role="alert" aria-live="assertive">
        <p className="game-runtime-error-kicker">Connection report</p>
        <h1>{disconnected ? 'Disconnected from server' : 'The game could not continue'}</h1>
        <p className="game-runtime-error-explanation">{failure.message}</p>
        {failure.technicalDetail && (
          <details className="game-runtime-error-detail">
            <summary>Technical reason</summary>
            <p>{failure.technicalDetail}</p>
          </details>
        )}
        <div className="game-runtime-error-actions">
          <button
            type="button"
            className="btn btn-gold"
            disabled={submission.kind === 'sending' || submission.kind === 'sent'}
            onClick={() => { void submit() }}
          >
            {submission.kind === 'sending'
              ? 'Sending logs…'
              : submission.kind === 'sent'
                ? 'Logs sent'
                : 'Send logs to server'}
          </button>
        </div>
        <p className="game-runtime-error-consent">
          Logs are sent only when you press this button. They include this connection reason,
          recent game-network events, and browser details; session credentials are never included.
        </p>
        {submission.kind === 'sent' && (
          <p className="game-runtime-error-success" role="status">
            Logs sent. Reference: <code>{submission.logId}</code>
          </p>
        )}
        {submission.kind === 'failed' && (
          <p className="game-runtime-error-submit-failure" role="alert">
            {submission.message}
          </p>
        )}
      </section>
    </main>
  )
}
