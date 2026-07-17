import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ModCard from '../components/ModCard'
import Reveal from '../fx/Reveal'
import { TomeFlybys } from '../fx/Critters'
import { EmptyState, ErrorNote, Spinner } from '../components/ui'
import { api } from '../lib/api'
import type { ModType } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'

const SHELVES = [
  { value: '' as const, label: 'All Tomes' },
  { value: 'lua' as const, label: 'Lua' },
  { value: 'boneyard' as const, label: 'Boneyards' },
]

export default function Mods() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sort, setSort] = useState<'newest' | 'downloads'>('newest')
  const [page, setPage] = useState(1)
  const pageSize = 12

  // The shelf lives in the URL so /mods?type=boneyard deep-links to it.
  const rawType = params.get('type')
  const type: ModType | '' = rawType === 'lua' || rawType === 'boneyard' ? rawType : ''
  const setType = (t: ModType | '') =>
    setParams(t ? { type: t } : {}, { replace: true })

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debounced, type, sort])

  const mods = useApi(
    () => api.mods.list({ search: debounced, type, sort, page, pageSize }),
    [debounced, type, sort, page],
  )

  const total = mods.data?.total ?? 0
  const maxPage = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <TomeFlybys />
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="kicker mb-1.5">Restricted section · mostly</div>
            <h1 className="h-display text-3xl">The Library</h1>
            <p className="text-fell mt-2 max-w-xl text-bone-dim">
              Tomes contributed by the community, one click from being yours. Professor
              Semicus keeps the shelves; Machinimbus rates the cataloguing “almost
              completely nearly safe.”
            </p>
          </div>
          <Link to={user ? '/mods/upload' : '/login'} className="btn btn-gold">
            ✦ Contribute a Tome
          </Link>
        </div>
      </Reveal>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded border border-gold/25" role="group" aria-label="Which shelf">
          {SHELVES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setType(s.value)}
              className={`px-3.5 py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                type === s.value
                  ? 'bg-gold/15 text-gold-bright shadow-[inset_0_0_10px_rgba(200,168,98,.15)]'
                  : 'text-bone-dim hover:bg-gold/5 hover:text-bone'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          className="input max-w-xs"
          placeholder="Search the shelves…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'downloads')}>
          <option value="newest">Newest</option>
          <option value="downloads">Most taken</option>
        </select>
        {total > 0 && (
          <span className="ml-auto font-mono text-xs text-bone-dim/60">
            {total} tome{total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="mt-6">
        {mods.loading ? (
          <Spinner label="Consulting the index…" />
        ) : mods.error ? (
          <ErrorNote message={mods.error} />
        ) : (mods.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="The shelves are bare"
            line={
              debounced
                ? 'Nothing matches. The Librarian suggests spelling it differently, or wanting something else.'
                : type === 'boneyard'
                  ? 'No Boneyards on the shelf yet. Bury the first.'
                  : type === 'lua'
                    ? 'No Lua tomes yet. The grimoire section awaits its first author.'
                    : 'No tomes yet. Contribute the first and enjoy a brief, glorious monopoly.'
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mods.data!.items.map((m, i) => (
                <Reveal key={m.id} delay={Math.min(i, 6) * 60}>
                  <ModCard mod={m} />
                </Reveal>
              ))}
            </div>
            {maxPage > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  type="button"
                  className="btn btn-stone !py-2"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Prev
                </button>
                <span className="font-mono text-xs text-bone-dim">
                  page {page} / {maxPage}
                </span>
                <button
                  type="button"
                  className="btn btn-stone !py-2"
                  disabled={page >= maxPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
