import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import ModCard from '../components/ModCard'
import PopularStrip from '../components/PopularStrip'
import Reveal from '../fx/Reveal'
import { TomeFlybys } from '../fx/Critters'
import { EmptyState, ErrorNote, Spinner, TagBadge } from '../components/ui'
import { api } from '../lib/api'
import type { ModSort, ModSummary } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'

export default function Mods() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sort, setSort] = useState<ModSort>('newest')
  const [page, setPage] = useState(1)
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [unsubscribing, setUnsubscribing] = useState<string | null>(null)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const [unsubscribeError, setUnsubscribeError] = useState<string | null>(null)
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
  const subscriptions = useApi(
    () => user ? api.mods.subscriptions.list() : Promise.resolve({ items: [] }),
    [user?.id],
  )
  const subscribedMods = subscriptions.data?.items ?? []
  const subscribedSlugs = new Set(
    subscribedMods.map(subscription => subscription.mod.slug),
  )

  const subscribe = async (mod: ModSummary) => {
    if (!user) {
      navigate('/login')
      return
    }
    setSubscribing(mod.slug)
    setSubscriptionError(null)
    try {
      await api.mods.subscriptions.subscribe(mod.slug)
      await subscriptions.reload()
    } catch (error) {
      setSubscriptionError(error instanceof Error ? error.message : 'Could not subscribe to this mod.')
    } finally {
      setSubscribing(null)
    }
  }

  const unsubscribe = async (mod: ModSummary) => {
    setUnsubscribing(mod.slug)
    setUnsubscribeError(null)
    try {
      await api.mods.subscriptions.unsubscribe(mod.slug)
      await subscriptions.reload()
    } catch (error) {
      setUnsubscribeError(error instanceof Error ? error.message : 'Could not unsubscribe from this mod.')
    } finally {
      setUnsubscribing(null)
    }
  }

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
            <h1 className="h-display text-3xl">The Library</h1>
            <p className="text-fell mt-2 max-w-xl text-bone-dim">
              Lua mods and Boneyards made by the community.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/boneyard"
              className="btn btn-stone"
            >
              ⚒ Create a Boneyard
            </Link>
            <Link to={user ? '/mods/upload' : '/login'} className="btn btn-gold">
              ✦ Upload a mod
            </Link>
          </div>
        </div>
      </Reveal>

      <section className="mt-9" aria-labelledby="subscribed-mods-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="subscribed-mods-heading" className="h-display text-xl">Subscribed Mods</h2>
            <p className="text-fell mt-1 max-w-xl text-sm text-bone-dim">
              Enable your subscribed mods in Explore the Dark Cloud before playing.
            </p>
          </div>
          {user && subscribedMods.length > 0 ? (
            <span className="font-mono text-xs text-bone-dim/60">
              {subscribedMods.length} subscribed
            </span>
          ) : null}
        </div>

        {!user ? (
          <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
            <p className="text-fell text-sm text-bone-dim">
              Sign in to subscribe to mods.
            </p>
            <Link to="/login" className="btn btn-stone">Sign in</Link>
          </div>
        ) : subscriptions.loading ? (
          <Spinner label="Loading subscriptions…" />
        ) : subscriptions.error ? (
          <ErrorNote message={subscriptions.error} />
        ) : subscribedMods.length === 0 ? (
          <EmptyState
            title="No subscribed mods"
            line="Subscribe to a mod below to add it to your collection."
          />
        ) : (
          <>
            {unsubscribeError ? <ErrorNote message={unsubscribeError} /> : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subscribedMods.map((subscription, index) => (
                <Reveal key={subscription.mod.id} delay={Math.min(index, 6) * 60}>
                  <ModCard
                    mod={subscription.mod}
                    onUnsubscribe={unsubscribe}
                    unsubscribing={unsubscribing === subscription.mod.slug}
                  />
                </Reveal>
              ))}
            </div>
          </>
        )}
      </section>

      <PopularStrip className="mt-8" />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search mods…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          value={sort}
          onChange={(e) => setSort(e.target.value as ModSort)}
          aria-label="Sort mods"
        >
          <option value="newest">Newest</option>
          <option value="downloads">Most downloaded</option>
          <option value="updated">Recently updated</option>
          <option value="name">Alphabetical</option>
        </select>
        {total > 0 && (
          <span className="ml-auto font-mono text-xs text-bone-dim/60">
            {total} mod{total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {(indexed.length > 0 || phantoms.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by tag">
          <span className="mr-1 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-bone-dim/70">
            Tags
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
        {subscriptionError ? <ErrorNote message={subscriptionError} /> : null}
        {mods.loading ? (
          <Spinner label="Loading mods…" />
        ) : mods.error ? (
          <ErrorNote message={mods.error} />
        ) : (mods.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="The shelves are bare"
            line={
              debounced
                ? 'No mods match your search. Try a different name or tag.'
                : selected.length > 0
                  ? `No mods match these tags: ${selected.join(', ')}.`
                  : 'No mods have been published yet.'
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mods.data!.items.map((m, i) => (
                <Reveal key={m.id} delay={Math.min(i, 6) * 60}>
                  <ModCard
                    mod={m}
                    onSubscribe={subscribe}
                    subscribed={subscribedSlugs.has(m.slug)}
                    subscribing={subscribing === m.slug}
                  />
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
