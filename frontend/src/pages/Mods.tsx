import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ModCard from '../components/ModCard'
import PopularStrip from '../components/PopularStrip'
import Reveal from '../fx/Reveal'
import { TomeFlybys } from '../fx/Critters'
import { EmptyState, ErrorNote, Spinner, TagBadge } from '../components/ui'
import { api } from '../lib/api'
import type { ModSort } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'

export default function Mods() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sort, setSort] = useState<ModSort>('newest')
  const [page, setPage] = useState(1)
  const pageSize = 12

  // Selected tags live in the URL so /mods?tag=boneyard deep-links to a shelf.
  const selected = params.getAll('tag')
  const selectedKey = selected.join(',')
  const toggleTag = (tag: string) => {
    const next = selected.includes(tag)
      ? selected.filter((t) => t !== tag)
      : [...selected, tag]
    setParams(next.length > 0 ? { tag: next } : {}, { replace: true })
  }

  const tagIndex = useApi(() => api.mods.tagIndex(), [])

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debounced, selectedKey, sort])

  const mods = useApi(
    () => api.mods.list({ search: debounced, tags: selected, sort, page, pageSize }),
    [debounced, selectedKey, sort, page],
  )

  const total = mods.data?.total ?? 0
  const maxPage = Math.max(1, Math.ceil(total / pageSize))

  // Deep links may carry tags the index no longer lists; keep them toggleable.
  const indexed = tagIndex.data?.items ?? []
  const phantoms = selected.filter((tag) => !indexed.some((entry) => entry.tag === tag))

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

      <PopularStrip className="mt-8" />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search the shelves…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          value={sort}
          onChange={(e) => setSort(e.target.value as ModSort)}
          aria-label="Sort the shelves"
        >
          <option value="newest">Newest</option>
          <option value="downloads">Most taken</option>
          <option value="updated">Recently revised</option>
          <option value="name">Alphabetical</option>
        </select>
        {total > 0 && (
          <span className="ml-auto font-mono text-xs text-bone-dim/60">
            {total} tome{total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {(indexed.length > 0 || phantoms.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by tag">
          <span className="mr-1 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-bone-dim/70">
            Filed under
          </span>
          {indexed.map(({ tag, count }) => (
            <TagBadge
              key={tag}
              tag={tag}
              count={count}
              active={selected.includes(tag)}
              onClick={() => toggleTag(tag)}
            />
          ))}
          {phantoms.map((tag) => (
            <TagBadge key={tag} tag={tag} active onClick={() => toggleTag(tag)} />
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              className="link-arcane ml-1 text-[11px] uppercase tracking-wider"
              onClick={() => setParams({}, { replace: true })}
            >
              clear
            </button>
          )}
        </div>
      )}

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
                : selected.length > 0
                  ? `Nothing is filed under ${selected.join(' + ')}. The Librarian admires your specificity.`
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
