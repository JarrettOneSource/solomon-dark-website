import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import { ErrorNote, Field } from '../components/ui'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { art } from '../lib/assets'
import mageNames from '../assets/magenames.json'

// Some names are spoken for. The Annals are firm about this.
const RESERVED_NAMES: Record<string, string> = {
  solomon: 'That name is taken. Permanently. The plot beside it is not.',
  solomondark: 'That name is taken. Permanently. The plot beside it is not.',
  raptisoft: 'The Archchancellor’s name may not be borrowed. It barely fits him.',
  generic: 'That name belongs to the Archivist. He is watching this form.',
  librarian: 'There is only one Librarian. Do not make eye contact.',
  semicus: 'Professor Semicus shelved his own name long ago. Choose another.',
  dean: 'Titles are earned, not enrolled.',
  headmaster: 'Titles are earned, not enrolled.',
  archchancellor: 'Titles are earned, not enrolled.',
}

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
    const reserved = RESERVED_NAMES[username.trim().toLowerCase()]
    if (reserved) {
      setError(reserved)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await register(username.trim(), email.trim(), password)
      navigate('/account')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enrollment failed')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <Reveal>
        <div className="mb-8 text-center">
          <img src={art.skullGold} alt="" className="mx-auto mb-4 h-12 drop-shadow-[0_0_12px_rgba(200,168,98,.5)]" />
          <h1 className="h-display text-2xl">Enroll at the College</h1>
          <p className="text-fell mt-2 text-sm text-bone-dim">
            The Annals await your name. Penmanship counts.
          </p>
        </div>

        <form onSubmit={submit} className="panel panel-ornate space-y-5 p-6 sm:p-8">
          <Field label="Mage name" hint="3–24 characters. Letters, numbers, - and _.">
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
                title="Draw a name from the College registry"
              >
                Suggest
              </button>
            </div>
          </Field>
          <Field label="Email" hint="For recovering your account. No owls, no spam.">
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@deadhawg.example"
              autoComplete="email"
            />
          </Field>
          <Field label="Password" hint="At least 8 characters. “password123” is technically legal.">
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
            {busy ? 'Inscribing…' : 'Sign the Annals'}
          </button>

          <p className="text-center text-xs text-bone-dim">
            Already enrolled?{' '}
            <Link to="/login" className="link-arcane">
              Return to your studies
            </Link>
          </p>
        </form>
      </Reveal>
    </div>
  )
}
