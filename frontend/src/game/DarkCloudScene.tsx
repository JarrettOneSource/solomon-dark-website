import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import accountFlourish from '../assets/game/dark-cloud/account-flourish.png'
import borderBottomLeft from '../assets/game/dark-cloud/border-corner-bl.png'
import borderBottomRight from '../assets/game/dark-cloud/border-corner-br.png'
import borderTopLeft from '../assets/game/dark-cloud/border-corner-tr.png'
import borderTopRight from '../assets/game/dark-cloud/border-corner-tl.png'
import searchIcon from '../assets/game/dark-cloud/search.png'
import skull from '../assets/game/dark-cloud/skull.png'
import sortIcon from '../assets/game/dark-cloud/sort.png'
import wizardLeft from '../assets/game/dark-cloud/wizard-left.png'
import wizardRight from '../assets/game/dark-cloud/wizard-right.png'
import {
  api,
  type ModList,
  type ModSubscription,
  type ModSummary,
  type PublicGameParty,
} from '../lib/api.ts'
import DarkCloudMedia from './DarkCloudMedia.tsx'
import DarkCloudModDetail, {
  type DarkCloudSubscriptionAction,
} from './DarkCloudModDetail.tsx'
import './dark-cloud.css'

type DarkCloudTab = 'mods' | 'subscribed' | 'parties'
type SortMode = 'downloads' | 'members' | 'name' | 'newest' | 'updated'

type DarkCloudRow =
  | { key: string; kind: 'mod'; mod: ModSummary; subscription: ModSubscription | null }
  | { key: string; kind: 'party'; party: PublicGameParty }

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
  const requestGeneration = useRef(0)
  const partyRequestGeneration = useRef(0)
  const [tab, setTab] = useState<DarkCloudTab>('mods')
  const [mods, setMods] = useState<ModSummary[]>([])
  const [parties, setParties] = useState<PublicGameParty[]>([])
  const [subscriptions, setSubscriptions] = useState<ModSubscription[]>([])
  const [modsError, setModsError] = useState<string | null>(null)
  const [partiesError, setPartiesError] = useState<string | null>(null)
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [detailMod, setDetailMod] = useState<ModSummary | null>(null)
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [sort, setSort] = useState<SortMode>('newest')

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current
    setLoading(true)
    const [modsResult, partiesResult, subscriptionsResult] = await Promise.allSettled([
      listAllMods(),
      api.gameParties.list(),
      accountUsername
        ? api.mods.subscriptions.list()
        : Promise.resolve({ items: [] as ModSubscription[] }),
    ])
    if (generation !== requestGeneration.current) return

    if (modsResult.status === 'fulfilled') {
      setMods(modsResult.value)
      setModsError(null)
    } else {
      setModsError(message(modsResult.reason, 'The mod catalog could not be loaded.'))
    }
    if (partiesResult.status === 'fulfilled') {
      setParties(partiesResult.value.items)
      setPartiesError(null)
    } else {
      setPartiesError(message(partiesResult.reason, 'The public party directory could not be loaded.'))
    }
    if (subscriptionsResult.status === 'fulfilled') {
      setSubscriptions(subscriptionsResult.value.items)
      setSubscriptionsError(null)
    } else {
      setSubscriptionsError(message(subscriptionsResult.reason, 'Your subscribed mods could not be loaded.'))
    }
    setLoading(false)
  }, [accountUsername])

  useEffect(() => {
    void load()
    return () => { requestGeneration.current += 1 }
  }, [load])

  const refreshParties = useCallback(async () => {
    const generation = ++partyRequestGeneration.current
    try {
      const result = await api.gameParties.list()
      if (generation !== partyRequestGeneration.current) return
      setParties(result.items)
      setPartiesError(null)
    } catch (error) {
      if (generation === partyRequestGeneration.current) {
        setPartiesError(message(error, 'The public party directory could not be loaded.'))
      }
    }
  }, [])

  useEffect(() => {
    if (tab !== 'parties') return
    void refreshParties()
    const timer = window.setInterval(() => { void refreshParties() }, 15_000)
    return () => {
      window.clearInterval(timer)
      partyRequestGeneration.current += 1
    }
  }, [refreshParties, tab])

  const subscriptionsBySlug = useMemo(() => new Map(
    subscriptions.map(subscription => [subscription.mod.slug, subscription]),
  ), [subscriptions])

  const rows = useMemo<DarkCloudRow[]>(() => {
    const source: DarkCloudRow[] = tab === 'parties'
      ? parties.map(party => ({ key: `party:${party.id}`, kind: 'party', party }))
      : (tab === 'subscribed' ? subscriptions.map(item => item.mod) : mods).map(mod => ({
          key: `mod:${mod.slug}`,
          kind: 'mod',
          mod,
          subscription: subscriptionsBySlug.get(mod.slug) ?? null,
        }))
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const filtered = normalizedQuery.length === 0 ? source : source.filter(row => (
      row.kind === 'mod'
        ? [row.mod.name, row.mod.author.username, row.mod.summary, ...row.mod.tags]
            .some(value => value.toLocaleLowerCase().includes(normalizedQuery))
        : [row.party.leader, ...row.party.members, row.party.boneyardName ?? '']
            .some(value => value.toLocaleLowerCase().includes(normalizedQuery))
    ))
    return [...filtered].sort((first, second) => compareRows(first, second, sort))
  }, [mods, parties, query, sort, subscriptions, subscriptionsBySlug, tab])

  useEffect(() => {
    if (!rows.some(row => row.key === selectedKey)) setSelectedKey(rows[0]?.key ?? null)
  }, [rows, selectedKey])

  const selected = rows.find(row => row.key === selectedKey) ?? null
  const activeError = tab === 'mods'
    ? modsError
    : tab === 'subscribed'
      ? subscriptionsError
      : partiesError
  const detailSubscription = detailMod
    ? subscriptionsBySlug.get(detailMod.slug) ?? null
    : null

  const changeTab = (next: DarkCloudTab) => {
    let firstKey: string | null = null
    if (next === 'parties' && parties[0]) firstKey = `party:${parties[0].id}`
    if (next === 'subscribed' && subscriptions[0]) firstKey = `mod:${subscriptions[0].mod.slug}`
    if (next === 'mods' && mods[0]) firstKey = `mod:${mods[0].slug}`
    setTab(next)
    setSelectedKey(firstKey)
    setQuery('')
    setDraftQuery('')
    setSort(next === 'parties' ? 'members' : 'newest')
  }

  const openMod = (mod: ModSummary) => {
    setSelectedKey(`mod:${mod.slug}`)
    setDetailMod(mod)
  }

  const mutateSubscription = async (
    mod: ModSummary,
    action: DarkCloudSubscriptionAction,
  ) => {
    setBusySlug(mod.slug)
    setActionError(null)
    try {
      if (action === 'subscribe') await api.mods.subscriptions.subscribe(mod.slug)
      if (action === 'enable') await api.mods.subscriptions.setEnabled(mod.slug, true)
      if (action === 'disable') await api.mods.subscriptions.setEnabled(mod.slug, false)
      if (action === 'unsubscribe') await api.mods.subscriptions.unsubscribe(mod.slug)
      await load()
    } finally {
      setBusySlug(null)
    }
  }

  const runRowAction = (mod: ModSummary, action: DarkCloudSubscriptionAction) => {
    if (!accountUsername) {
      window.location.assign('/login')
      return
    }
    void mutateSubscription(mod, action).catch((error: unknown) => {
      setActionError(message(error, 'The subscription could not be changed.'))
    })
  }

  const primaryAction = () => {
    if (tab === 'parties') {
      onEnterSharedHub()
      return
    }
    if (selected?.kind === 'mod') openMod(selected.mod)
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
        <h1>THE DARK CLOUD</h1>
        {accountUsername ? (
          <strong>{accountUsername.toUpperCase()}</strong>
        ) : (
          <button type="button" onClick={() => window.location.assign('/login')}>
            <strong>YOU ARE SIGNED IN AS A GUEST.</strong>
            <span>SIGN IN</span>
          </button>
        )}
        <img className="dark-cloud-account-flourish dark-cloud-account-flourish-left" src={accountFlourish} alt="" />
        <img className="dark-cloud-account-flourish dark-cloud-account-flourish-right" src={accountFlourish} alt="" />
      </header>

      <nav className="dark-cloud-tabs" aria-label="Dark Cloud sections">
        {([
          ['mods', 'MODS'],
          ['subscribed', 'SUBSCRIBED MODS'],
          ['parties', 'PARTIES'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? 'selected' : ''}
            aria-current={tab === value ? 'page' : undefined}
            onClick={() => changeTab(value)}
          >
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className="dark-cloud-list-frame">
        <img src={borderTopLeft} className="dark-cloud-corner top-left" alt="" />
        <img src={borderTopRight} className="dark-cloud-corner top-right" alt="" />
        <img src={borderBottomLeft} className="dark-cloud-corner bottom-left" alt="" />
        <img src={borderBottomRight} className="dark-cloud-corner bottom-right" alt="" />

        <div className={`dark-cloud-columns dark-cloud-columns-${tab}`} aria-hidden>
          {columnLabels(tab).map(label => <span key={label}>{label}</span>)}
        </div>

        <div className="dark-cloud-rows" role="list" aria-label={`${tab} entries`} aria-busy={loading}>
          {loading && rows.length === 0 ? <p className="dark-cloud-empty">CONSULTING THE DARK CLOUD…</p> : null}
          {!loading && activeError && rows.length === 0 ? (
            <div className="dark-cloud-empty dark-cloud-empty-error" role="alert">
              <p>{activeError}</p>
              <button type="button" onClick={() => { void load() }}>RETRY</button>
            </div>
          ) : null}
          {!loading && !activeError && rows.length === 0 ? (
            <p className="dark-cloud-empty">{emptyMessage(tab, accountUsername !== null, query)}</p>
          ) : null}
          {rows.map(row => row.kind === 'mod' ? (
            <ModRow
              busy={busySlug === row.mod.slug}
              key={row.key}
              mod={row.mod}
              onOpen={() => openMod(row.mod)}
              onSelect={() => setSelectedKey(row.key)}
              onSubscriptionAction={action => runRowAction(row.mod, action)}
              selected={selectedKey === row.key}
              subscription={row.subscription}
              tab={tab}
            />
          ) : (
            <PartyRow
              key={row.key}
              onEnter={onEnterSharedHub}
              onSelect={() => setSelectedKey(row.key)}
              party={row.party}
              selected={selectedKey === row.key}
            />
          ))}
        </div>
      </main>

      <footer className="dark-cloud-footer">
        <div className="dark-cloud-footer-tools">
          <button type="button" className="dark-cloud-icon-button" onClick={() => {
            setDraftQuery(query)
            setSearchOpen(true)
          }} aria-label="Search">
            <img src={searchIcon} alt="" />
          </button>
          <button type="button" className="dark-cloud-icon-button" onClick={() => setSortOpen(true)} aria-label="Sort">
            <img src={sortIcon} alt="" />
          </button>
        </div>
        <button
          type="button"
          className="dark-cloud-primary-button"
          disabled={tab !== 'parties' && selected?.kind !== 'mod'}
          onClick={primaryAction}
        >
          {tab === 'parties' ? 'ENTER SHARED HUB' : 'VIEW MOD'}
        </button>
        <div className="dark-cloud-footer-status">
          {loading && rows.length > 0 ? <span>REFRESHING…</span> : null}
          {tab === 'parties' ? <button type="button" onClick={() => { void refreshParties() }}>REFRESH</button> : null}
          {query ? <button type="button" onClick={() => setQuery('')}>CLEAR SEARCH</button> : null}
        </div>
      </footer>

      {actionError ? <p className="dark-cloud-error" role="alert">{actionError}</p> : null}

      {searchOpen ? (
        <DarkCloudModal title="SEARCH THE DARK CLOUD" onClose={() => setSearchOpen(false)}>
          <label>
            {tab === 'parties' ? 'LEADER, MEMBER, OR BONEYARD' : 'MOD, AUTHOR, OR TAG'}
            <input
              value={draftQuery}
              onChange={event => setDraftQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key !== 'Enter') return
                setQuery(draftQuery)
                setSearchOpen(false)
              }}
              autoFocus
            />
          </label>
          <button type="button" onClick={() => {
            setQuery(draftQuery)
            setSearchOpen(false)
          }}>SEARCH</button>
        </DarkCloudModal>
      ) : null}

      {sortOpen ? (
        <DarkCloudModal title={tab === 'parties' ? 'SORT PARTIES' : 'SORT MODS'} onClose={() => setSortOpen(false)}>
          {(tab === 'parties' ? [
            ['members', 'MOST WIZARDS'],
            ['name', 'LEADER NAME'],
          ] as const : [
            ['newest', 'NEWEST'],
            ['updated', 'UPDATED RECENTLY'],
            ['downloads', 'MOST DOWNLOADED'],
            ['name', 'NAME'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={sort === value ? 'selected' : ''} onClick={() => {
              setSort(value)
              setSortOpen(false)
            }}>{label}</button>
          ))}
        </DarkCloudModal>
      ) : null}

      {detailMod ? (
        <DarkCloudModDetail
          accountUsername={accountUsername}
          mod={detailMod}
          onClose={() => setDetailMod(null)}
          onSubscriptionAction={action => mutateSubscription(detailMod, action)}
          subscription={detailSubscription}
        />
      ) : null}
    </section>
  )
}

function ModRow({
  busy,
  mod,
  onOpen,
  onSelect,
  onSubscriptionAction,
  selected,
  subscription,
  tab,
}: {
  busy: boolean
  mod: ModSummary
  onOpen: () => void
  onSelect: () => void
  onSubscriptionAction: (action: DarkCloudSubscriptionAction) => void
  selected: boolean
  subscription: ModSubscription | null
  tab: DarkCloudTab
}) {
  return (
    <article
      className={`dark-cloud-row dark-cloud-mod-row${selected ? ' selected' : ''}`}
      data-mod-slug={mod.slug}
      role="listitem"
    >
      <button
        type="button"
        className="dark-cloud-row-main"
        aria-label={`Select ${mod.name}`}
        aria-pressed={selected}
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        <DarkCloudMedia alt={mod.name} className="dark-cloud-row-thumbnail" src={mod.thumbnailUrl} />
        <span className="dark-cloud-row-copy">
          <strong>{mod.name}</strong>
          <small>{mod.summary}</small>
          <span className="dark-cloud-row-tags">{mod.tags.slice(0, 3).join(' · ')}</span>
        </span>
        <span className="dark-cloud-row-author">{mod.author.username}</span>
        <span className="dark-cloud-row-version">v{mod.latestVersion}</span>
        <span className={`dark-cloud-row-state ${subscription?.enabled ? 'enabled' : ''}`}>
          {subscription ? subscription.enabled ? 'ENABLED' : 'DISABLED' : 'NOT SUBSCRIBED'}
        </span>
      </button>
      <div className="dark-cloud-row-actions">
        <button type="button" aria-label={`View ${mod.name}`} onClick={onOpen}>VIEW</button>
        {tab === 'subscribed' && subscription ? (
          <>
            <button
              type="button"
              disabled={busy}
              aria-label={`${subscription.enabled ? 'Disable' : 'Enable'} ${mod.name}`}
              onClick={() => onSubscriptionAction(subscription.enabled ? 'disable' : 'enable')}
            >
              {subscription.enabled ? 'DISABLE' : 'ENABLE'}
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label={`Unsubscribe from ${mod.name}`}
              onClick={() => onSubscriptionAction('unsubscribe')}
            >
              REMOVE
            </button>
          </>
        ) : !subscription ? (
          <button type="button" disabled={busy} onClick={() => onSubscriptionAction('subscribe')}>
            {busy ? 'WORKING…' : 'SUBSCRIBE'}
          </button>
        ) : null}
      </div>
    </article>
  )
}

function PartyRow({
  onEnter,
  onSelect,
  party,
  selected,
}: {
  onEnter: () => void
  onSelect: () => void
  party: PublicGameParty
  selected: boolean
}) {
  return (
    <article
      className={`dark-cloud-row dark-cloud-party-row${selected ? ' selected' : ''}`}
      data-party-id={party.id}
      role="listitem"
    >
      <button
        type="button"
        className="dark-cloud-row-main"
        aria-label={`Select ${party.leader}'s party`}
        aria-pressed={selected}
        onClick={onSelect}
        onDoubleClick={onEnter}
      >
        <span className="dark-cloud-party-mark" aria-hidden>{party.leader.slice(0, 1).toUpperCase()}</span>
        <span className="dark-cloud-row-copy">
          <strong>{`${party.leader}'s party`.toUpperCase()}</strong>
          <small>{party.members.join(' · ')}</small>
        </span>
        <span className="dark-cloud-party-members">{party.memberCount} / {party.maxMembers}</span>
        <span className={`dark-cloud-party-status ${party.status}`}>{party.status === 'playing' ? 'IN GAME' : 'IN HUB'}</span>
        <span className="dark-cloud-party-location">{party.boneyardName ?? 'COLLEGE COURTYARD'}</span>
      </button>
      <div className="dark-cloud-row-actions">
        <button type="button" onClick={onEnter}>ENTER HUB</button>
      </div>
    </article>
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
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  }, [onClose])

  return (
    <div className="dark-cloud-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="dark-cloud-modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <div>{children}</div>
        <button type="button" className="dark-cloud-modal-done" onClick={onClose}>DONE</button>
      </section>
    </div>
  )
}

async function listAllMods(): Promise<ModSummary[]> {
  const first = await api.mods.list({ sort: 'newest', pageSize: 50 })
  const pageCount = Math.ceil(first.total / first.pageSize)
  if (pageCount <= 1) return first.items
  const rest = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => (
    api.mods.list({ sort: 'newest', pageSize: 50, page: index + 2 })
  )))
  return [first, ...rest].flatMap((page: ModList) => page.items)
}

function columnLabels(tab: DarkCloudTab): readonly string[] {
  if (tab === 'parties') return ['PARTY', 'WIZARDS', 'STATUS', 'LOCATION', 'ACTION']
  if (tab === 'subscribed') return ['SUBSCRIBED MOD', 'AUTHOR', 'VERSION', 'STATUS', 'MANAGE']
  return ['MOD', 'AUTHOR', 'VERSION', 'STATUS', 'ACTION']
}

function emptyMessage(tab: DarkCloudTab, authenticated: boolean, query: string): string {
  if (query) return 'NOTHING MATCHES YOUR SEARCH.'
  if (tab === 'parties') return 'NO PUBLIC PARTIES ARE FORMING RIGHT NOW.'
  if (tab === 'subscribed') {
    return authenticated ? 'YOU HAVE NOT SUBSCRIBED TO ANY MODS.' : 'SIGN IN TO SEE SUBSCRIBED MODS.'
  }
  return 'NO MODS HAVE REACHED THE DARK CLOUD.'
}

function compareRows(first: DarkCloudRow, second: DarkCloudRow, sort: SortMode): number {
  if (first.kind === 'party' && second.kind === 'party') {
    if (sort === 'members') return second.party.memberCount - first.party.memberCount
    return first.party.leader.localeCompare(second.party.leader)
  }
  if (first.kind !== 'mod' || second.kind !== 'mod') return 0
  if (sort === 'name') return first.mod.name.localeCompare(second.mod.name)
  if (sort === 'downloads') return second.mod.downloads - first.mod.downloads
  if (sort === 'updated') return second.mod.updatedAtUtc.localeCompare(first.mod.updatedAtUtc)
  return second.mod.createdAtUtc.localeCompare(first.mod.createdAtUtc)
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
