import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import LobbyPasswordDialog from '../components/LobbyPasswordDialog'
import LobbyTable from '../components/LobbyTable'
import Reveal from '../fx/Reveal'
import { EmptyState, ErrorNote, Spinner } from '../components/ui'
import type { Lobby } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLobbies } from '../lib/useLobbies'

export default function Classes() {
  const [search, setSearch] = useState('')
  const [openSeats, setOpenSeats] = useState(false)
  const [knock, setKnock] = useState<Lobby | null>(null)
  const { user } = useAuth()
  const { data, error, loading } = useLobbies()
  const [searchParams, setSearchParams] = useSearchParams()
  const consumedDeepLink = useRef(false)

  // sdr hand-off: /classes?lobby=<id> opens the knock dialog for that class.
  useEffect(() => {
    if (consumedDeepLink.current || !data) return
    const wanted = searchParams.get('lobby')
    if (!wanted) return
    consumedDeepLink.current = true
    const target = data.items.find((item) => String(item.id) === wanted)
    if (target?.access === 'password') setKnock(target)
    setSearchParams({}, { replace: true })
  }, [data, searchParams, setSearchParams])

  const filtered = useMemo(() => {
    let items = data?.items ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter(
        (lobby) =>
          lobby.hostPlayer.toLowerCase().includes(q) ||
          (lobby.game.boneyardName ?? '').toLowerCase().includes(q),
      )
    }
    if (openSeats) items = items.filter((lobby) => lobby.players < lobby.maxPlayers)
    return items
  }, [data, search, openSeats])

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <Reveal>
        <div className="mb-2 flex items-center gap-3">
          <span className="orb orb-on [animation:banner-pulse_2.2s_ease-in-out_infinite]" />
          <span className="font-mono text-xs text-moss">
            {data ? `${data.items.length} live · ${data.playerCount} wizards afield` : '…'}
          </span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-bone-dim/50">
            live
          </span>
        </div>
        <h1 className="h-display text-3xl">Classes in Session</h1>
        <p className="text-fell mt-2 max-w-xl text-bone-dim">
          Live multiplayer expeditions led by fellow students. Open doors connect at a
          click; warded ones want a password. Attendance is optional; survival is graded.
        </p>
      </Reveal>

      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            className="input max-w-xs"
            placeholder="Search hosts and boneyards…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="flex cursor-pointer items-center gap-2 text-xs uppercase tracking-wider text-bone-dim">
            <input
              type="checkbox"
              checked={openSeats}
              onChange={(e) => setOpenSeats(e.target.checked)}
              className="accent-[#c8a862]"
            />
            open seats only
          </label>
        </div>

        {loading ? (
          <Spinner label="Fetching classes…" />
        ) : error ? (
          <ErrorNote message={error} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No classes in session"
            line={
              search || openSeats
                ? 'Nothing matches. Loosen the filters — or lower your standards.'
                : 'The faculty deny all knowledge. Host one from the SDR loader — or go rogue over Steam P2P.'
            }
          />
        ) : (
          <LobbyTable lobbies={filtered} onKnock={setKnock} />
        )}

        <p className="text-fell mt-6 text-center text-xs text-bone-dim/70">
          {user?.steamId ? (
            <>
              Friends-only classes hosted by your Steam friends appear here automatically,
              marked <span className="text-arcane">Friends</span>.
            </>
          ) : user ? (
            <>
              Friends-only classes stay hidden until the Registrar knows your Steam self —{' '}
              <Link to="/account" className="link-arcane">
                link it in the Annals
              </Link>
              .
            </>
          ) : (
            <>
              Friends-only classes show for{' '}
              <Link to="/login" className="link-arcane">
                signed-in wizards
              </Link>{' '}
              with a linked Steam profile. Steam invites work regardless — no website, no
              account, no paper trail.
            </>
          )}
        </p>
      </div>

      {knock && <LobbyPasswordDialog lobby={knock} onClose={() => setKnock(null)} />}
    </div>
  )
}
