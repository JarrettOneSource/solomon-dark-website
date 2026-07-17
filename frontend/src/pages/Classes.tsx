import { useMemo, useState } from 'react'
import MatchTable from '../components/MatchTable'
import Reveal from '../fx/Reveal'
import { EmptyState, ErrorNote, Spinner } from '../components/ui'
import { useMatches } from '../lib/useMatches'

export default function Classes() {
  const [search, setSearch] = useState('')
  const [openSeats, setOpenSeats] = useState(false)
  const { data, error, loading } = useMatches()

  const filtered = useMemo(() => {
    let items = data?.items ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter(
        (m) =>
          m.hostPlayer.toLowerCase().includes(q) || m.boneyard.toLowerCase().includes(q),
      )
    }
    if (openSeats) items = items.filter((m) => m.players < m.maxPlayers)
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
          Live multiplayer expeditions led by fellow students. Pick a class and the SDR
          loader walks you in. Attendance is optional; survival is graded.
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
                : 'The faculty deny all knowledge. Host one from the game’s multiplayer tab — or go rogue over Steam P2P.'
            }
          />
        ) : (
          <MatchTable matches={filtered} />
        )}

        <p className="text-fell mt-6 text-center text-xs text-bone-dim/70">
          Prefer to keep it private? SDR also speaks plain Steam P2P — host and invite
          friends directly, no website, no account, no paper trail.
        </p>
      </div>
    </div>
  )
}
