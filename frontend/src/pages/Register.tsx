import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import { ErrorNote, Field } from '../components/ui'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { art } from '../lib/assets'
import mageNames from '../assets/magenames.json'

const RESERVED_NAMES = new Set([
  'solomon',
  'solomondark',
  'raptisoft',
  'generic',
  'librarian',
  'semicus',
  'dean',
  'headmaster',
  'archchancellor',
])

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggest = () => {
    const name = mageNames[Math.floor(Math.random() * mageNames.length)]
    setUsername(name)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (RESERVED_NAMES.has(username.trim().toLowerCase())) {
      setError('That name is reserved. Choose another.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await register(username.trim(), email.trim(), password)
      navigate('/account')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <Reveal>
        <div className="mb-8 text-center">
          <img src={art.skullGold} alt="" className="mx-auto mb-4 h-12 drop-shadow-[0_0_12px_rgba(200,168,98,.5)]" />
          <h1 className="h-display text-2xl">Create an Account</h1>
          <p className="text-fell mt-2 text-sm text-bone-dim">
            Pick the name other players will see.
          </p>
        </div>

        <form onSubmit={submit} className="panel panel-ornate space-y-5 p-6 sm:p-8">
          <Field label="Username" hint="3–24 characters. Letters, numbers, - and _.">
            <div className="flex gap-2">
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Faelificus"
                autoComplete="username"
              />
              <button
                type="button"
                onClick={suggest}
                className="btn btn-stone flex-none !px-3 !text-[10px]"
                title="Pick a random name"
              >
                Suggest
              </button>
            </div>
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@deadhawg.example"
              autoComplete="email"
            />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>

          {error && <ErrorNote message={error} />}

          <button type="submit" className="btn btn-gold w-full !py-3.5" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>

          <p className="text-center text-xs text-bone-dim">
            Already have an account?{' '}
            <Link to="/login" className="link-arcane">
              Sign in
            </Link>
          </p>
        </form>
      </Reveal>
    </div>
  )
}
