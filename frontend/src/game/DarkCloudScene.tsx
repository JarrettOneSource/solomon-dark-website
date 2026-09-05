import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  api,
  type ActiveWebMod,
  type ModList,
  type ModSubscription,
  type ModSummary,
  type PartyJoinResolution,
  type PublicGameParty,
} from '../lib/api.ts'
import {
  useDeveloperPresence,
} from './connected-players.ts'
import DarkCloudModDetail, {
  type DarkCloudSubscriptionAction,
} from './DarkCloudModDetail.tsx'
import {
  NativeUiButton,
  NativeDarkCloudHeading,
  NativeDarkCloudListFrameArt,
  NativeDarkCloudSceneArt,
  NativeDarkCloudTabs,
  NativeDarkCloudText,
} from './native-ui/react.ts'
import {
  directoryPartyAction,
  usePartyDirectory,
} from './party-directory.ts'
import { usePartyJoinActions } from './party-join.ts'
import {
  GameModContentLoadError,
  prefetchGameContent,
  type GameContentDownloadProgress,
} from './game-content-cache.ts'
import { DarkCloudSearchDialog, DarkCloudSortDialog, type DarkCloudSort } from './DarkCloudDialogs.tsx'
import { DarkCloudList, DeveloperPresenceSection, type DarkCloudRow, type DarkCloudTab } from './DarkCloudRows.tsx'
import { DarkCloudFooter, DarkCloudStatus } from './DarkCloudFooter.tsx'
import './dark-cloud.css'

const DarkCloudLayouts = lazy(() => import('./DarkCloudLayouts.tsx'))

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
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [sort, setSort] = useState<DarkCloudSort>('newest')
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
      setModsError((modsResult.reason instanceof Error ? modsResult.reason.message : 'The mod catalog could not be loaded.'))
    }
    if (subscriptionsResult.status === 'fulfilled') {
      setSubscriptions(subscriptionsResult.value.items)
      setSubscriptionsError(null)
    } else {
      setSubscriptionsError((subscriptionsResult.reason instanceof Error ? subscriptionsResult.reason.message : 'Your subscribed mods could not be loaded.'))
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
    const source: DarkCloudRow[] = tab === 'layouts'
      ? []
      : tab === 'parties'
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
  const activeError = { mods: modsError, subscribed: subscriptionsError, parties: partyDirectory.error, layouts: null }[tab]
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
    setSearchOpen(false)
    setSortOpen(false)
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
      if (action !== 'subscribe' && action !== 'enable') return
      try {
        await prefetchGameContent(activeMods.flatMap(active => active.assets), setDownloadProgress)
      } catch (error) {
        const loadFailure = error instanceof GameModContentLoadError ? error : null
        const failedMod = loadFailure ? activeMods.find(active => active.id === loadFailure.modId) : null
        if (!loadFailure || !failedMod) {
          setDownloadError(error instanceof Error ? error.message : 'The mod is enabled, but its game content was not cached.')
          return
        }
        try {
          await api.mods.subscriptions.setEnabled(failedMod.slug, false)
          await onSubscriptionsChanged()
          await load()
          setDownloadError(`${failedMod.name} was disabled because its content could not be loaded or verified.`)
        } catch {
          setDownloadError(`${loadFailure.message} The mod could not be disabled automatically.`)
        }
      } finally {
        setDownloadProgress(null)
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
    void mutateSubscription(mod, action).catch((error) => {
      setActionError(error instanceof Error ? error.message : 'The subscription could not be changed.')
    })
  }

  const primaryAction = () => {
    if (tab === 'layouts') return
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
  const listLoading = tab === 'parties' ? partyDirectory.loading : loading
  const refresh = () => {
    if (tab === 'parties') {
      void partyDirectory.refresh()
      if (developerAccess) void developerPresence.refresh()
    } else void load()
  }

  const statusControls = <DarkCloudStatus count={rows.length} loading={listLoading} onClear={() => setQuery('')} onRefresh={refresh} query={query} tab={tab} />
  const notice = actionError || downloadError || partyActions.error

  return (
    <section className="dark-cloud-scene" aria-label="The Dark Cloud">
      <NativeDarkCloudSceneArt />
      {/* The menu skull is the stage-level GameMenuSkull the host mounts over this scene. */}

      <NativeDarkCloudHeading
        accountUsername={accountUsername}
        onAccount={accountUsername ? onMenu : () => window.location.assign('/login')}
      />

      <NativeDarkCloudTabs onSelect={changeTab} selectedId={tab} />

      <main className="dark-cloud-list-frame">
        <NativeDarkCloudListFrameArt />

        {tab === 'layouts' ? (
          <Suspense fallback={<p className="dark-cloud-empty"><NativeDarkCloudText text="OPENING LAYOUTS..." /></p>}>
            <DarkCloudLayouts accountUsername={accountUsername} />
          </Suspense>
        ) : (
          <>
            <div className={`dark-cloud-columns dark-cloud-columns-${tab}`}>
              {columnLabels(tab).map((label, index) => (
                <span key={label}>
                  {tab === 'parties' && index === 4
                    ? <NativeUiButton height={44} onClick={refresh} scale={0.55} width={100}>REFRESH</NativeUiButton>
                    : <NativeDarkCloudText scale={1} text={label.toLowerCase()} />}
                </span>
              ))}
            </div>
            <div className="dark-cloud-list-status">{statusControls}</div>

            <DarkCloudList
              busy={busySlug !== null}
              emptyText={emptyMessage(tab, accountUsername !== null, query)}
              error={activeError}
              label={`${tab} entries`}
              loading={listLoading}
              onJoinParty={joinParty}
              onModAction={runRowAction}
              onOpenMod={openMod}
              onRetry={refresh}
              onSelect={setSelectedKey}
              partyBusy={partyActions.busy}
              pendingParty={partyActions.pendingListingId}
              rows={rows}
              selectedKey={selectedKey}
              subscribed={tab === 'subscribed'}
            >
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
                      setActionError(error instanceof Error ? error.message : 'The match could not be observed.')
                      setObservingMatchId(null)
                    }
                  }}
                  players={developerPresence.players}
                />
              ) : null}
            </DarkCloudList>
          </>
        )}
      </main>

      <DarkCloudFooter
        onPrimary={primaryAction}
        onSearch={() => setSearchOpen(true)}
        onSort={() => setSortOpen(true)}
        partyBusy={partyActions.busy}
        progress={downloadProgress}
        selected={selected}
        status={statusControls}
        tab={tab}
      />

      {notice ? (
        <p className="dark-cloud-error" role="alert">
          {notice}
        </p>
      ) : null}
      {searchOpen ? (
        <DarkCloudSearchDialog
          initialQuery={query}
          onClose={() => setSearchOpen(false)}
          onSearch={value => { setQuery(value); setSearchOpen(false) }}
          parties={tab === 'parties'}
        />
      ) : null}
      {sortOpen ? (
        <DarkCloudSortDialog
          onClose={() => setSortOpen(false)}
          onSort={value => { setSort(value); setSortOpen(false) }}
          parties={tab === 'parties'}
          sort={sort}
        />
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
  if (tab === 'layouts') return []
  if (tab === 'parties') return ['PARTY', 'WIZARDS', 'STATUS', 'LOCATION', 'ACTION']
  if (tab === 'subscribed') return ['SUBSCRIBED MOD', 'AUTHOR', 'VERSION', 'STATUS', 'MANAGE']
  return ['MOD', 'AUTHOR', 'VERSION', 'STATUS', 'ACTION']
}

function emptyMessage(tab: DarkCloudTab, authenticated: boolean, query: string): string {
  if (tab === 'layouts') return ''
  if (query) return 'NOTHING MATCHES YOUR SEARCH.'
  if (tab === 'parties') return 'NO PUBLIC PARTIES.'
  if (tab === 'subscribed') {
    return authenticated ? 'NO SUBSCRIBED MODS.' : 'SIGN IN TO SEE YOUR MODS.'
  }
  return 'NO MODS HAVE REACHED THE DARK CLOUD.'
}

function compareRows(first: DarkCloudRow, second: DarkCloudRow, sort: DarkCloudSort): number {
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
