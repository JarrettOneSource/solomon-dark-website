import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, type Lobby } from '../lib/api'
import { useAuth } from '../lib/auth'
import { deriveLobbyPasswordHash } from '../lib/pbkdf2'

type Step = 'idle' | 'working' | 'launching'

/**
 * The knock-and-whisper flow for a warded lobby. The password is derived to a
 * PBKDF2 hash in the browser and discarded — only the hash travels, and the
 * short-lived ticket comes back bound to the caller's linked SteamID.
 */
export default function LobbyPasswordDialog({
  lobby,
  onClose,
}: {
  lobby: Lobby
  onClose: () => void
}) {
  const { user, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [launchUri, setLaunchUri] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const knock = async (e: FormEvent) => {
    e.preventDefault()
    if (!lobby.password || step !== 'idle' || password.length === 0) return
    setStep('working')
    setError(null)
    try {
      const hash = await deriveLobbyPasswordHash(
        password,
        lobby.password.salt,
        lobby.password.iterations,
      )
      const grant = await api.lobbies.authorize(lobby.id, hash)
      setPassword('')
      setLaunchUri(grant.launchUri)
      setStep('launching')
      // The ticket lives 60 seconds — open the loader immediately.
      window.location.assign(grant.launchUri)
    } catch (err) {
      setStep('idle')
      if (err instanceof ApiError) {
        setError(
          err.status === 403
            ? 'The wards reject that password.'
            : err.status === 404
              ? 'That class has ended or slipped beyond the veil.'
              : err.status === 409
                ? 'The class is full — every seat is taken.'
                : err.status === 429
                  ? 'Too many wrong whispers. The wards are listening; wait a moment.'
                  : err.message,
        )
      } else {
        setError('The knock went unanswered. Try again.')
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Password for ${lobby.hostPlayer}'s class`}
    >
      <div
        className="panel panel-ornate w-full max-w-md p-6 sm:p-8"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="kicker mb-1.5">A warded class</div>
        <h2 className="h-display text-xl">{lobby.hostPlayer}’s expedition</h2>
        <p className="text-fell mt-2 text-sm text-bone-dim">
          {lobby.game.boneyardName
            ? `Bound for ${lobby.game.boneyardName}. `
            : ''}
          The door answers only to a password. It never leaves this device — just its
          sigil, derived and sent.
        </p>

        {loading ? null : !user ? (
          <div className="mt-6">
            <p className="text-sm text-bone-dim">
              Only enrolled wizards may knock — the ticket is cut to your name.
            </p>
            <div className="mt-4 flex gap-3">
              <Link to="/login" className="btn btn-gold">
                Sign in
              </Link>
              <button type="button" className="btn btn-stone" onClick={onClose}>
                Retreat
              </button>
            </div>
          </div>
        ) : !user.steamId ? (
          <div className="mt-6">
            <p className="text-sm text-bone-dim">
              Link your Steam self first — join tickets are bound to a SteamID, and the
              Registrar hasn’t recorded yours.
            </p>
            <div className="mt-4 flex gap-3">
              <Link to="/account" className="btn btn-gold">
                Visit the Registrar
              </Link>
              <button type="button" className="btn btn-stone" onClick={onClose}>
                Retreat
              </button>
            </div>
          </div>
        ) : step === 'launching' ? (
          <div className="mt-6">
            <p className="text-sm text-moss">The wards part. Opening the SDR loader…</p>
            {launchUri && (
              <p className="mt-2 text-xs text-bone-dim">
                Nothing happened?{' '}
                <a href={launchUri} className="link-arcane">
                  Open the loader manually
                </a>{' '}
                — the ticket expires in about a minute.
              </p>
            )}
            <button type="button" className="btn btn-stone mt-4" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={knock} className="mt-6">
            <label className="block">
              <span className="label">Password</span>
              <input
                className="input"
                type="password"
                autoFocus
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={step !== 'idle'}
              />
            </label>
            {error && (
              <p className="mt-3 rounded border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-[#f0b9b9]">
                {error}
              </p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                className="btn btn-gold"
                disabled={step !== 'idle' || password.length === 0}
              >
                {step === 'working' ? 'Consulting the wards…' : 'Knock'}
              </button>
              <button type="button" className="btn btn-stone" onClick={onClose}>
                Retreat
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
