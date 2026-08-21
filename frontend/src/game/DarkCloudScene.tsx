import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import accountFlourish from '../assets/game/dark-cloud/account-flourish.png'
import borderBottomLeft from '../assets/game/dark-cloud/border-corner-bl.png'
import borderBottomRight from '../assets/game/dark-cloud/border-corner-br.png'
import borderTopLeft from '../assets/game/dark-cloud/border-corner-tl.png'
import borderTopRight from '../assets/game/dark-cloud/border-corner-tr.png'
import searchIcon from '../assets/game/dark-cloud/search.png'
import skull from '../assets/game/dark-cloud/skull.png'
import sortIcon from '../assets/game/dark-cloud/sort.png'
import wizardLeft from '../assets/game/dark-cloud/wizard-left.png'
import wizardRight from '../assets/game/dark-cloud/wizard-right.png'
import { api, type ModSummary, type ModSubscription } from '../lib/api.ts'
import './dark-cloud.css'

type DarkCloudTab = 'recent' | 'mods' | 'boneyards' | 'multiplayer'
type SortMode = 'updated' | 'name' | 'downloads'

type DarkCloudRow =
  | { key: string; kind: 'mod'; mod: ModSummary; subscription: ModSubscription | null }
  | { key: 'shared-hub'; kind: 'shared-hub' }

interface DarkCloudSceneProps {
  accountUsername: string | null
  onBack: () => void
  onEnterSharedHub: () => void
}

export default function DarkCloudScene({
  accountUsername,
  onBack,
  onEnterSharedHub,
}: DarkCloudSceneProps) {
  const [tab, setTab] = useState<DarkCloudTab>(accountUsername ? 'mods' : 'boneyards')
  const [recent, setRecent] = useState<ModSummary[]>([])
  const [boneyards, setBoneyards] = useState<ModSummary[]>([])
  const [subscriptions, setSubscriptions] = useState<ModSubscription[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [sort, setSort] = useState<SortMode>('updated')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [recentResult, boneyardResult, subscriptionResult] = await Promise.all([
        api.mods.list({ sort: 'updated', pageSize: 50 }),
        api.mods.list({ tags: ['boneyard'], sort: 'updated', pageSize: 50 }),
        accountUsername
          ? api.mods.subscriptions.list()
          : Promise.resolve({ items: [] as ModSubscription[] }),
      ])
      setRecent(recentResult.items)
      setBoneyards(boneyardResult.items)
      setSubscriptions(subscriptionResult.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'The Dark Cloud is unreachable.')
    } finally {
      setLoading(false)
    }
  }, [accountUsername])

  useEffect(() => { void load() }, [load])
  const subscriptionsBySlug = useMemo(() => new Map(
    subscriptions.map(subscription => [subscription.mod.slug, subscription]),
  ), [subscriptions])
  const rows = useMemo<DarkCloudRow[]>(() => {
    const source: DarkCloudRow[] = tab === 'multiplayer'
      ? [{ key: 'shared-hub', kind: 'shared-hub' }]
      : tab === 'mods'
        ? subscriptions.map(subscription => ({
            key: `mod:${subscription.mod.slug}`,
            kind: 'mod',
            mod: subscription.mod,
            subscription,
          }))
        : (tab === 'boneyards' ? boneyards : recent).map(mod => ({
            key: `mod:${mod.slug}`,
            kind: 'mod',
            mod,
            subscription: subscriptionsBySlug.get(mod.slug) ?? null,
          }))
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = normalizedQuery.length === 0 ? source : source.filter(row => {
      if (row.kind === 'shared-hub') return 'shared college hub multiplayer parties'.includes(normalizedQuery)
      return row.mod.name.toLowerCase().includes(normalizedQuery)
        || row.mod.author.username.toLowerCase().includes(normalizedQuery)
        || row.mod.summary.toLowerCase().includes(normalizedQuery)
    })
    return [...filtered].sort((first, second) => {
      if (sort === 'name') return rowName(first).localeCompare(rowName(second))
      if (sort === 'downloads') return rowPopularity(second) - rowPopularity(first)
      return rowUpdated(second).localeCompare(rowUpdated(first))
    })
  }, [boneyards, query, recent, sort, subscriptions, subscriptionsBySlug, tab])

  useEffect(() => {
    if (!rows.some(row => row.key === selectedKey)) setSelectedKey(rows[0]?.key ?? null)
  }, [rows, selectedKey])
  const selected = rows.find(row => row.key === selectedKey) ?? null

  const perform = async (action: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The Dark Cloud rejected that action.')
    } finally {
      setBusy(false)
    }
  }

  const primaryAction = () => {
    if (!selected || busy) return
    if (selected.kind === 'shared-hub') {
      onEnterSharedHub()
      return
    }
    if (!accountUsername) {
      window.location.assign('/login')
      return
    }
    if (!selected.subscription) {
      void perform(() => api.mods.subscriptions.subscribe(selected.mod.slug))
      return
    }
    void perform(() => api.mods.subscriptions.setEnabled(
      selected.mod.slug,
      !selected.subscription!.enabled,
    ))
  }

  return (
    <section className="dark-cloud-scene" aria-label="The Dark Cloud">
      <div className="dark-cloud-wall" aria-hidden />
      <img className="dark-cloud-wizard dark-cloud-wizard-left" src={wizardLeft} alt="" />
      <img className="dark-cloud-wizard dark-cloud-wizard-right" src={wizardRight} alt="" />
      <button type="button" className="dark-cloud-menu" onClick={onBack} aria-label="Main menu">
        <img src={skull} alt="" />
      </button>

      <header className="dark-cloud-heading">
        <h1>THE DARK CLOUD <small>WEB</small></h1>
        {accountUsername ? (
          <>
            <strong>{accountUsername.toUpperCase()}</strong>
            <span>HOW DARK ARE YOU TODAY?</span>
          </>
        ) : (
          <button type="button" onClick={() => window.location.assign('/login')}>
            <strong>YOU ARE SIGNED IN AS A GUEST.</strong>
            <span>TO CHANGE THIS, CLICK HERE.</span>
          </button>
        )}
        <img className="dark-cloud-account-flourish dark-cloud-account-flourish-left" src={accountFlourish} alt="" />
        <img className="dark-cloud-account-flourish dark-cloud-account-flourish-right" src={accountFlourish} alt="" />
      </header>

      <nav className="dark-cloud-tabs" aria-label="Dark Cloud sections">
        {([
          ['recent', 'RECENT'],
          ['mods', 'MODS'],
          ['boneyards', 'BONEYARDS'],
          ['multiplayer', 'MULTIPLAYER'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? 'selected' : ''}
            onClick={() => { setTab(value); setSelectedKey(null) }}
          >
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="dark-cloud-list-frame">
        <img src={borderTopLeft} className="dark-cloud-corner top-left" alt="" />
        <img src={borderTopRight} className="dark-cloud-corner top-right" alt="" />
        <img src={borderBottomLeft} className="dark-cloud-corner bottom-left" alt="" />
        <img src={borderBottomRight} className="dark-cloud-corner bottom-right" alt="" />
        <div className="dark-cloud-columns" aria-hidden>
          <span>{tab === 'multiplayer' ? 'DESTINATION' : tab === 'mods' ? 'SUBSCRIBED MOD' : 'NAME'}</span>
          <span>{tab === 'multiplayer' ? 'STATUS' : 'AUTHOR'}</span>
          <span>{tab === 'multiplayer' ? 'MODE' : tab === 'mods' ? 'STATUS' : 'VERSION'}</span>
        </div>
        <div className="dark-cloud-rows" role="listbox" aria-label={`${tab} entries`}>
          {loading ? <p className="dark-cloud-empty">CONSULTING THE DARK CLOUD…</p> : null}
          {!loading && error && rows.length === 0 ? <p className="dark-cloud-empty">{error}</p> : null}
          {!loading && !error && rows.length === 0 ? (
            <p className="dark-cloud-empty">{emptyMessage(tab, accountUsername !== null)}</p>
          ) : null}
          {rows.map(row => (
            <button
              type="button"
              role="option"
              aria-selected={selectedKey === row.key}
              key={row.key}
              className={selectedKey === row.key ? 'selected' : ''}
              onClick={() => setSelectedKey(row.key)}
              onDoubleClick={primaryAction}
            >
              <span>
                {row.kind === 'shared-hub' ? 'THE SHARED COLLEGE HUB' : row.mod.name}
                <small>{row.kind === 'mod'
                  ? row.mod.summary
                  : 'Meet wizards in the Courtyard, inspect profiles, and form a party.'}</small>
              </span>
              <span>{row.kind === 'shared-hub' ? 'LIVE' : row.mod.author.username}</span>
              <span>{row.kind === 'shared-hub'
                ? 'PARTIES'
                : row.subscription
                  ? row.subscription.enabled ? 'ENABLED' : 'DISABLED'
                  : `v${row.mod.latestVersion}`}</span>
            </button>
          ))}
        </div>
      </div>

      <footer className="dark-cloud-footer">
        <button type="button" className="dark-cloud-icon-button" onClick={() => {
          setDraftQuery(query)
          setSearchOpen(true)
        }} aria-label="Search">
          <img src={searchIcon} alt="" />
        </button>
        <button type="button" className="dark-cloud-icon-button" onClick={() => setSortOpen(true)} aria-label="Sort">
          <img src={sortIcon} alt="" />
        </button>
        <button
          type="button"
          className="dark-cloud-primary-button"
          disabled={!selected || busy}
          onClick={primaryAction}
        >
          {primaryLabel(selected, accountUsername !== null, busy)}
        </button>
        <button
          type="button"
          className="dark-cloud-options-button"
          disabled={selected?.kind !== 'mod' || !selected.subscription}
          onClick={() => setOptionsOpen(true)}
        >
          OPTIONS
        </button>
      </footer>

      {error && rows.length > 0 ? <p className="dark-cloud-error" role="alert">{error}</p> : null}
      {searchOpen ? (
        <DarkCloudModal title="DARK CLOUD SEARCH" onClose={() => setSearchOpen(false)}>
          <label>
            NAME OR AUTHOR
            <input value={draftQuery} onChange={event => setDraftQuery(event.target.value)} autoFocus />
          </label>
          <button type="button" onClick={() => {
            setQuery(draftQuery)
            setSearchOpen(false)
          }}>SEARCH NOW</button>
        </DarkCloudModal>
      ) : null}
      {sortOpen ? (
        <DarkCloudModal title="SORT THE DARK CLOUD" onClose={() => setSortOpen(false)}>
          {([
            ['updated', 'UPDATED RECENTLY'],
            ['downloads', 'MOST SUBSCRIBED'],
            ['name', 'NAME'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={sort === value ? 'selected' : ''} onClick={() => {
              setSort(value)
              setSortOpen(false)
            }}>{label}</button>
          ))}
        </DarkCloudModal>
      ) : null}
      {optionsOpen && selected?.kind === 'mod' && selected.subscription ? (
        <DarkCloudModal title="MOD OPTIONS" onClose={() => setOptionsOpen(false)}>
          <p>{selected.mod.name}</p>
          <button type="button" onClick={() => {
            setOptionsOpen(false)
            void perform(() => api.mods.subscriptions.setEnabled(
              selected.mod.slug,
              !selected.subscription!.enabled,
            ))
          }}>{selected.subscription.enabled ? 'DISABLE MOD' : 'ENABLE MOD'}</button>
          <button type="button" onClick={() => {
            setOptionsOpen(false)
            void perform(() => api.mods.subscriptions.unsubscribe(selected.mod.slug))
          }}>UNSUBSCRIBE</button>
        </DarkCloudModal>
      ) : null}
    </section>
  )
}

function DarkCloudModal({
  children,
  onClose,
  title,
}: {
  children: ReactNode
  onClose: () => void
  title: string
}) {
  return (
    <div className="dark-cloud-modal-backdrop" role="presentation">
      <section className="dark-cloud-modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <div>{children}</div>
        <button type="button" className="dark-cloud-modal-done" onClick={onClose}>DONE</button>
      </section>
    </div>
  )
}

function primaryLabel(row: DarkCloudRow | null, authenticated: boolean, busy: boolean): string {
  if (busy) return 'WORKING…'
  if (!row) return 'SELECT'
  if (row.kind === 'shared-hub') return 'ENTER HUB'
  if (!authenticated) return 'SIGN IN'
  if (!row.subscription) return 'SUBSCRIBE'
  return row.subscription.enabled ? 'DISABLE' : 'ENABLE'
}

function emptyMessage(tab: DarkCloudTab, authenticated: boolean): string {
  if (tab === 'mods') return authenticated ? 'YOU HAVE NOT SUBSCRIBED TO ANY MODS.' : 'SIGN IN TO SEE YOUR MODS.'
  if (tab === 'boneyards') return 'NO BONEYARDS HAVE REACHED THE CLOUD.'
  if (tab === 'multiplayer') return 'THE SHARED HUB IS UNAVAILABLE.'
  return 'THE DARK CLOUD IS QUIET.'
}

function rowName(row: DarkCloudRow): string {
  return row.kind === 'shared-hub' ? 'The Shared College Hub' : row.mod.name
}

function rowPopularity(row: DarkCloudRow): number {
  return row.kind === 'shared-hub' ? 0 : row.mod.downloads
}

function rowUpdated(row: DarkCloudRow): string {
  return row.kind === 'shared-hub' ? '' : row.mod.updatedAtUtc
}
