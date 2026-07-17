import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import { ErrorNote, Field } from '../components/ui'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { art } from '../lib/assets'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(usernameOrEmail.trim(), password)
      navigate('/account')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <Reveal>
        <div className="mb-8 text-center">
          <img src={art.skullGold} alt="" className="mx-auto mb-4 h-12 drop-shadow-[0_0_12px_rgba(200,168,98,.5)]" />
          <h1 className="h-display text-2xl">Return to Your Studies</h1>
          <p className="text-fell mt-2 text-sm text-bone-dim">
            The College kept your desk exactly as you left it. Dusty.
          </p>
        </div>

        <form onSubmit={submit} className="panel panel-ornate space-y-5 p-6 sm:p-8">
          <Field label="Mage name or email">
            <input
              className="input"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="Faelificus"
              autoComplete="username"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>

          {error && <ErrorNote message={error} />}

          <button type="submit" className="btn btn-gold w-full !py-3.5" disabled={busy}>
            {busy ? 'Unsealing…' : 'Sign in'}
          </button>

          <p className="text-center text-xs text-bone-dim">
            New here?{' '}
            <Link to="/register" className="link-arcane">
              Enroll at the College
            </Link>
          </p>
        </form>
      </Reveal>
    </div>
  )
}
