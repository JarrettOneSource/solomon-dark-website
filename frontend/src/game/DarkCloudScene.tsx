import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import accountFlourish from '../assets/game/dark-cloud/account-flourish.png'
import borderBottomLeft from '../assets/game/dark-cloud/border-corner-bl.png'
import borderBottomRight from '../assets/game/dark-cloud/border-corner-br.png'
import borderTopLeft from '../assets/game/dark-cloud/border-corner-tr.png'
import borderTopRight from '../assets/game/dark-cloud/border-corner-tl.png'
import searchIcon from '../assets/game/dark-cloud/search.png'
import sortIcon from '../assets/game/dark-cloud/sort.png'
import wizardLeft from '../assets/game/dark-cloud/wizard-left.png'
import wizardRight from '../assets/game/dark-cloud/wizard-right.png'
import {
  api,
  type ActiveWebMod,
  type ConnectedGamePlayer,
  type DeveloperGameMatch,
  type ModList,
  type ModSubscription,
  type ModSummary,
  type PartyJoinResolution,
  type PublicGameParty,
} from '../lib/api.ts'
import {
  connectedPlayerPresentation,
  useDeveloperPresence,
} from './connected-players.ts'
import DarkCloudMedia from './DarkCloudMedia.tsx'
import DarkCloudModDetail, {
  type DarkCloudSubscriptionAction,
} from './DarkCloudModDetail.tsx'
import DarkCloudPanelOrnaments from './DarkCloudPanel.tsx'
import {
  directoryPartyAction,
  directoryPartyPresentation,
  usePartyDirectory,
} from './party-directory.ts'
import { usePartyJoinActions } from './party-join.ts'
import {
  prefetchGameContent,
  type GameContentDownloadProgress,
} from './game-content-cache.ts'
import './dark-cloud.css'

type DarkCloudTab = 'mods' | 'subscribed' | 'parties'
type SortMode = 'downloads' | 'members' | 'name' | 'newest' | 'updated'

type DarkCloudRow =
  | { key: string; kind: 'mod'; mod: ModSummary; subscription: ModSubscription | null }
  | { key: string; kind: 'party'; party: PublicGameParty }

interface DarkCloudSceneProps {
  accountUsername: string | null
  /**
   * True only for signed-in developer accounts. It gates fetching the live
   * presence feed; the backend independently refuses that feed to anyone else.
   */
  developerAccess: boolean
  /** Key code bound to the game's open-menu control (`settings.controls.openMenu`). */
  menuKeyCode: string
  /** True while the Esc menu or its settings own input, so the open-menu key stays quiet. */
  menuOpen: boolean
  /** Opens the native Esc menu; the host owns its state and mounts the menu. */
  onMenu: () => void
  onPartyResolved: (resolution: PartyJoinResolution) => void
  onObserveMatch: (matchId: string) => Promise<void>
  onSubscriptionsChanged: () => Promise<readonly ActiveWebMod[]>
  requesterDisplayName: string
}

export default function DarkCloudScene({
  accountUsername,
  developerAccess,
  menuKeyCode,
  menuOpen,
  onMenu,
  onObserveMatch,
  onPartyResolved,
  onSubscriptionsChanged,
  requesterDisplayName,
}: DarkCloudSceneProps) {
  const requestGeneration = useRef(0)
  const subscriptionBusyRef = useRef(false)
  const [tab, setTab] = useState<DarkCloudTab>('mods')
  const [mods, setMods] = useState<ModSummary[]>([])
  const [subscriptions, setSubscriptions] = useState<ModSubscription[]>([])
  const [modsError, setModsError] = useState<string | null>(null)
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<GameContentDownloadProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [detailMod, setDetailMod] = useState<ModSummary | null>(null)
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [sort, setSort] = useState<SortMode>('newest')
  const partyDirectory = usePartyDirectory(tab === 'parties')
  const parties = partyDirectory.parties
  const partyActions = usePartyJoinActions(requesterDisplayName, onPartyResolved)
  const developerPresence = useDeveloperPresence(developerAccess && tab === 'parties')
  const [observingMatchId, setObservingMatchId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current
    setLoading(true)
    const [modsResult, subscriptionsResult] = await Promise.allSettled([
      listAllMods(),
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

  // The open-menu control opens the native Esc menu exactly as it does in the
  // Hub and Boneyard; the sheets and the mod viewer consume Escape themselves
  // while they are open, and the menu consumes it once it owns input.
  useEffect(() => {
    if (menuOpen || searchOpen || sortOpen || detailMod) return
    const openMenu = (event: KeyboardEvent) => {
      if (
        event.code !== menuKeyCode
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) return
      event.preventDefault()
      event.stopPropagation()
      onMenu()
    }
    window.addEventListener('keydown', openMenu)
    return () => window.removeEventListener('keydown', openMenu)
  }, [detailMod, menuKeyCode, menuOpen, onMenu, searchOpen, sortOpen])

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
      : partyDirectory.error
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
    if (subscriptionBusyRef.current) return
    subscriptionBusyRef.current = true
    setBusySlug(mod.slug)
    setActionError(null)
    setDownloadError(null)
    try {
      if (action === 'subscribe') await api.mods.subscriptions.subscribe(mod.slug)
      if (action === 'enable') await api.mods.subscriptions.setEnabled(mod.slug, true)
      if (action === 'disable') await api.mods.subscriptions.setEnabled(mod.slug, false)
      if (action === 'unsubscribe') await api.mods.subscriptions.unsubscribe(mod.slug)
      const activeMods = await onSubscriptionsChanged()
      await load()
      if (action === 'subscribe' || action === 'enable') {
        try {
          await prefetchGameContent(
            activeMods.flatMap(active => active.assets),
            setDownloadProgress,
          )
        } catch (error) {
          setDownloadError(message(error, 'The mod is enabled, but its game content was not cached.'))
        } finally {
          setDownloadProgress(null)
        }
      }
    } finally {
      subscriptionBusyRef.current = false
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
      if (selected?.kind === 'party') joinParty(selected.party)
      return
    }
    if (selected?.kind === 'mod') openMod(selected.mod)
  }

  const joinParty = (party: PublicGameParty) => {
    if (partyActions.busy) return
    const action = directoryPartyAction(party)
    if (action === 'join') void partyActions.joinPublic(party.id)
    if (action === 'request') void partyActions.requestInvite(party.id)
  }
  const selectedPartyAction = selected?.kind === 'party'
    ? directoryPartyAction(selected.party)
    : null

  // Same controls in two homes: the footer status slot on desktop and the
  // in-frame band that replaces the column header on phones. CSS shows one.
  const statusControls = (
    <>
      <span className="dark-cloud-status-label">{statusLabel(tab, rows.length, query, loading)}</span>
      {(tab === 'parties' ? partyDirectory.loading : loading) && rows.length > 0
        ? <span className="dark-cloud-status-note">REFRESHING…</span>
        : null}
      {query ? <button type="button" onClick={() => setQuery('')}>CLEAR SEARCH</button> : null}
      {tab === 'parties' ? (
        <button type="button" onClick={() => {
          void partyDirectory.refresh()
          if (developerAccess) void developerPresence.refresh()
        }}>REFRESH</button>
      ) : null}
    </>
  )

  return (
    <section className="dark-cloud-scene" aria-label="The Dark Cloud">
      <div className="dark-cloud-wall" aria-hidden />
      <img className="dark-cloud-wizard dark-cloud-wizard-left" src={wizardLeft} alt="" />
      <img className="dark-cloud-wizard dark-cloud-wizard-right" src={wizardRight} alt="" />
      {/* The menu skull is the stage-level GameMenuSkull the host mounts over this scene. */}

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
        <div className="dark-cloud-list-status">{statusControls}</div>

        <div className="dark-cloud-rows" role="list" aria-label={`${tab} entries`} aria-busy={tab === 'parties' ? partyDirectory.loading : loading}>
          {(tab === 'parties' ? partyDirectory.loading : loading) && rows.length === 0 ? <p className="dark-cloud-empty">CONSULTING THE DARK CLOUD…</p> : null}
          {!(tab === 'parties' ? partyDirectory.loading : loading) && activeError && rows.length === 0 ? (
            <div className="dark-cloud-empty dark-cloud-empty-error" role="alert">
              <p>{activeError}</p>
              <button type="button" onClick={() => { void load() }}>RETRY</button>
            </div>
          ) : null}
          {!(tab === 'parties' ? partyDirectory.loading : loading) && !activeError && rows.length === 0 ? (
            <p className="dark-cloud-empty">{emptyMessage(tab, accountUsername !== null, query)}</p>
          ) : null}
          {rows.map(row => row.kind === 'mod' ? (
            <ModRow
              busy={busySlug !== null}
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
              busy={partyActions.busy}
              key={row.key}
              onEnter={() => joinParty(row.party)}
              onSelect={() => setSelectedKey(row.key)}
              party={row.party}
              pending={partyActions.pendingListingId === row.party.id}
              selected={selectedKey === row.key}
            />
          ))}
          {tab === 'parties' && developerAccess ? (
            <DeveloperPresenceSection
              error={developerPresence.error}
              loading={developerPresence.loading}
              matches={developerPresence.matches}
              observingMatchId={observingMatchId}
              onObserve={async (matchId) => {
                if (observingMatchId !== null) return
                setObservingMatchId(matchId)
                setActionError(null)
                try {
                  await onObserveMatch(matchId)
                } catch (error) {
                  setActionError(message(error, 'The match could not be observed.'))
                  setObservingMatchId(null)
                }
              }}
              players={developerPresence.players}
            />
          ) : null}
        </div>
      </main>

      <footer className="dark-cloud-footer">
        <DarkCloudDownloadProgress progress={downloadProgress} />
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
          disabled={tab === 'parties'
            ? selectedPartyAction === null
              || selectedPartyAction === 'wait'
              || partyActions.busy
            : selected?.kind !== 'mod'}
          onClick={primaryAction}
        >
          {tab === 'parties'
            ? selectedPartyAction === null
              ? 'SELECT PARTY'
              : selectedPartyAction === 'wait'
                ? 'IN GAME'
                : selectedPartyAction === 'request' ? 'REQUEST TO JOIN' : 'JOIN PARTY'
            : 'VIEW MOD'}
        </button>
        <div className="dark-cloud-footer-status">{statusControls}</div>
      </footer>

      {actionError || downloadError || partyActions.error ? (
        <p className="dark-cloud-error" role="alert">
          {actionError ?? downloadError ?? partyActions.error}
        </p>
      ) : null}
      {searchOpen ? (
        <DarkCloudModal title="SEARCH THE DARK CLOUD" onClose={() => setSearchOpen(false)}>
          <div className="dark-cloud-inset">
            <div className="dark-cloud-inset-row dark-cloud-field-row">
              <label htmlFor="dark-cloud-search-input">
                {tab === 'parties' ? 'LEADER, MEMBER, OR BONEYARD:' : 'MOD, AUTHOR, OR TAG:'}
              </label>
              <span className="dark-cloud-field">
                <input
                  id="dark-cloud-search-input"
                  value={draftQuery}
                  onChange={event => setDraftQuery(event.target.value)}
                  onKeyDown={event => {
                    if (event.key !== 'Enter') return
                    setQuery(draftQuery)
                    setSearchOpen(false)
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="dark-cloud-field-clear"
                  aria-label="Clear search text"
                  disabled={draftQuery.length === 0}
                  onClick={() => setDraftQuery('')}
                >
                  <span aria-hidden>×</span>
                </button>
              </span>
            </div>
            <button type="button" className="dark-cloud-inset-button" onClick={() => {
              setQuery(draftQuery)
              setSearchOpen(false)
            }}>SEARCH NOW</button>
          </div>
        </DarkCloudModal>
      ) : null}

      {sortOpen ? (
        <DarkCloudModal title={tab === 'parties' ? 'SORT PARTIES BY…' : 'SORT MODS BY…'} onClose={() => setSortOpen(false)}>
          <div className="dark-cloud-inset" role="group" aria-label="Sort order">
            {(tab === 'parties' ? [
              ['members', 'MOST WIZARDS'],
              ['name', 'LEADER NAME'],
            ] as const : [
              ['newest', 'NEWEST'],
              ['updated', 'UPDATED RECENTLY'],
              ['downloads', 'MOST DOWNLOADED'],
              ['name', 'NAME'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`dark-cloud-inset-button${sort === value ? ' selected' : ''}`}
                aria-pressed={sort === value}
                onClick={() => {
                  setSort(value)
                  setSortOpen(false)
                }}
              >
                {label}
              </button>
            ))}
          </div>
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
  busy,
  onEnter,
  onSelect,
  party,
  pending,
  selected,
}: {
  busy: boolean
  onEnter: () => void
  onSelect: () => void
  party: PublicGameParty
  pending: boolean
  selected: boolean
}) {
  const action = directoryPartyAction(party)
  const presentation = directoryPartyPresentation(party)
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
        <span className="dark-cloud-party-members">{presentation.squad}</span>
        <span className={`dark-cloud-party-status ${party.status}`}>{presentation.status}</span>
        <span className="dark-cloud-party-location" title={presentation.location}>
          {presentation.location}
        </span>
      </button>
      <div className="dark-cloud-row-actions">
        <button type="button" disabled={busy || action === 'wait'} onClick={onEnter}>
          {pending
            ? 'REQUESTED'
            : action === 'request' ? 'REQUEST' : action === 'wait' ? 'IN GAME' : 'JOIN'}
        </button>
      </div>
    </article>
  )
}

/**
 * Developer-only roster of every connected player and what they are doing.
 * The backend answers `/api/game/players` with 404 unless the signed-in user
 * is a developer, so this section can only ever render for developers.
 */
function DeveloperPresenceSection({
  error,
  loading,
  matches,
  observingMatchId,
  onObserve,
  players,
}: {
  error: string | null
  loading: boolean
  matches: readonly DeveloperGameMatch[]
  observingMatchId: string | null
  onObserve: (matchId: string) => Promise<void>
  players: readonly ConnectedGamePlayer[]
}) {
  return (
    <section className="dark-cloud-dev-presence" aria-label="All connected players (developer)">
      <header className="dark-cloud-dev-presence-heading" aria-hidden>
        <span>DEVELOPER SIGHT</span>
        <span className="dark-cloud-dev-presence-count">
          {loading && players.length === 0
            ? 'SCRYING…'
            : `${players.length} CONNECTED ${players.length === 1 ? 'WIZARD' : 'WIZARDS'}`}
        </span>
      </header>
      {error !== null ? (
        <p className="dark-cloud-dev-presence-note" role="alert">{error}</p>
      ) : null}
      {!loading && error === null && players.length === 0 ? (
        <p className="dark-cloud-dev-presence-note">NO WIZARDS ARE CONNECTED RIGHT NOW.</p>
      ) : null}
      <div className="dark-cloud-dev-matches">
        <div className="dark-cloud-dev-subheading">
          <span>ACTIVE MATCHES · ALL VISIBILITIES</span>
          <span>{matches.length}</span>
        </div>
        {!loading && error === null && matches.length === 0 ? (
          <p className="dark-cloud-dev-presence-note">NO BONEYARD MATCHES ARE ACTIVE.</p>
        ) : null}
        {matches.map(match => (
          <div className="dark-cloud-dev-match-row" key={match.id}>
            <span>
              <strong>{match.boneyardName.toUpperCase()}</strong>
              <small>{match.players.join(' · ').toUpperCase()}</small>
            </span>
            <span>{match.waveNumber > 0 ? `WAVE ${match.waveNumber}` : 'STAGING'}</span>
            <span>{match.visibility.toUpperCase()}</span>
            <span>{match.session === 'global-hub' ? 'GLOBAL HUB' : 'PRIVATE COLLEGE'}</span>
            <button
              type="button"
              disabled={observingMatchId !== null}
              onClick={() => { void onObserve(match.id) }}
            >
              {observingMatchId === match.id ? 'OPENING…' : 'OBSERVE'}
            </button>
          </div>
        ))}
      </div>
      <div className="dark-cloud-dev-subheading">
        <span>CONNECTED WIZARDS</span>
        <span>{players.length}</span>
      </div>
      {players.map((player, index) => {
        const presentation = connectedPlayerPresentation(player)
        return (
          <div className="dark-cloud-dev-presence-row" key={`${player.session}:${player.displayName}:${index}`}>
            <span className="dark-cloud-dev-presence-wizard">
              <strong>{player.displayName.toUpperCase()}</strong>
              <small>
                {presentation.detail.toUpperCase()}
                {player.developer ? ' · DEV' : ''}
              </small>
            </span>
            <span className="dark-cloud-dev-presence-session">{presentation.session}</span>
            <span className={`dark-cloud-dev-presence-status ${player.activity}`}>
              {presentation.status}
            </span>
            <span className="dark-cloud-dev-presence-location" title={presentation.location}>
              {presentation.location.toUpperCase()}
            </span>
            <span className="dark-cloud-dev-presence-party" title={presentation.party ?? undefined}>
              {presentation.party?.toUpperCase() ?? 'NO PARTY'}
            </span>
          </div>
        )
      })}
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
      <section className="dark-cloud-modal dark-cloud-panel" role="dialog" aria-modal="true" aria-label={title}>
        <DarkCloudPanelOrnaments />
        <div className="dark-cloud-panel-body">
          <h2 className="dark-cloud-panel-caption">{title}</h2>
          {children}
        </div>
        <div className="dark-cloud-panel-footer">
          <button data-game-back="true" type="button" className="dark-cloud-modal-done dark-cloud-stone-button" onClick={onClose}>DONE</button>
        </div>
      </section>
    </div>
  )
}

function DarkCloudDownloadProgress({
  progress,
}: {
  progress: GameContentDownloadProgress | null
}) {
  if (!progress || progress.totalBytes === 0) return null
  const percent = Math.min(100, Math.round(progress.completedBytes / progress.totalBytes * 100))
  return (
    <div
      className="dark-cloud-download"
      role="progressbar"
      aria-label="Caching subscribed mod content"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span style={{ width: `${percent}%` }} />
      <small>{progress.active ? `DOWNLOADING ${progress.active.modId}` : 'CONTENT READY'} · {percent}%</small>
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

function statusLabel(tab: DarkCloudTab, count: number, query: string, loading: boolean): string {
  if (loading && count === 0) return 'CONSULTING THE DARK CLOUD…'
  if (query) return `"${query.toUpperCase()}" · ${count} ${count === 1 ? 'MATCH' : 'MATCHES'}`
  if (tab === 'parties') return `${count} ${count === 1 ? 'PARTY' : 'PARTIES'}`
  if (tab === 'subscribed') return `${count} SUBSCRIBED`
  return `${count} ${count === 1 ? 'MOD' : 'MODS'}`
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
