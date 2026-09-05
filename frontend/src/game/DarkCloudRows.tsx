import type { ReactNode } from 'react'

import type { ConnectedGamePlayer, DeveloperGameMatch, ModSubscription, ModSummary, PublicGameParty } from '../lib/api.ts'
import { connectedPlayerPresentation } from './connected-players.ts'
import DarkCloudMedia from './DarkCloudMedia.tsx'
import type { DarkCloudSubscriptionAction } from './DarkCloudModDetail.tsx'
import { directoryPartyAction, directoryPartyPresentation } from './party-directory.ts'
import { NativeDarkCloudText, NativeUiButton } from './native-ui/react.ts'

export type DarkCloudTab = 'layouts' | 'mods' | 'subscribed' | 'parties'

export type DarkCloudRow =
  | { key: string; kind: 'mod'; mod: ModSummary; subscription: ModSubscription | null }
  | { key: string; kind: 'party'; party: PublicGameParty }

function ModRow({
  busy,
  mod,
  onOpen,
  onSelect,
  onSubscriptionAction,
  selected,
  subscription,
  subscribed,
}: {
  busy: boolean
  mod: ModSummary
  onOpen: () => void
  onSelect: () => void
  onSubscriptionAction: (action: DarkCloudSubscriptionAction) => void
  selected: boolean
  subscription: ModSubscription | null
  subscribed: boolean
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
          <strong><NativeDarkCloudText content scale={0.85} text={mod.name} tint={selected ? 0xbfffbf : 0xd9ba70} /></strong>
          <small>{mod.summary}</small>
          <span className="dark-cloud-row-tags"><NativeDarkCloudText content font="medium" scale={0.85} text={mod.tags.slice(0, 3).join(', ')} tint={0xa99a70} /></span>
        </span>
        <span className="dark-cloud-row-author"><NativeDarkCloudText content font="medium" scale={1} text={mod.author.username} /></span>
        <span className="dark-cloud-row-version"><NativeDarkCloudText content font="medium" scale={1} text={`v${mod.latestVersion}`} /></span>
        <span className={`dark-cloud-row-state ${subscription?.enabled ? 'enabled' : ''}`}>
          <NativeDarkCloudText
            font="medium"
            scale={0.85}
            text={subscription ? subscription.enabled ? 'ENABLED' : 'DISABLED' : 'NOT SUBSCRIBED'}
            tint={subscription?.enabled ? 0xa9d29d : 0xa99a70}
          />
        </span>
      </button>
      <div className="dark-cloud-row-actions">
        <NativeUiButton height={44} scale={0.55} width="fill" type="button" aria-label={`View ${mod.name}`} onClick={onOpen}>VIEW</NativeUiButton>
        {subscribed && subscription ? (
          <>
            <NativeUiButton height={44} scale={0.55} width="fill"
              type="button"
              disabled={busy}
              aria-label={`${subscription.enabled ? 'Disable' : 'Enable'} ${mod.name}`}
              onClick={() => onSubscriptionAction(subscription.enabled ? 'disable' : 'enable')}
            >
              {subscription.enabled ? 'DISABLE' : 'ENABLE'}
            </NativeUiButton>
            <NativeUiButton height={44} scale={0.55} width="fill"
              type="button"
              disabled={busy}
              aria-label={`Unsubscribe from ${mod.name}`}
              onClick={() => onSubscriptionAction('unsubscribe')}
            >
              REMOVE
            </NativeUiButton>
          </>
        ) : !subscription ? (
          <NativeUiButton height={44} scale={0.55} width="fill" type="button" disabled={busy} onClick={() => onSubscriptionAction('subscribe')}>
            {busy ? 'WORKING...' : 'SUBSCRIBE'}
          </NativeUiButton>
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
        aria-label={`Select ${party.leader}'s party${party.modCount > 0
          ? `, modded with ${party.modCount} ${party.modCount === 1 ? 'mod' : 'mods'}`
          : ''}${party.cheatsEnabled ? ', cheats enabled' : ''}`}
        aria-pressed={selected}
        onClick={onSelect}
        onDoubleClick={onEnter}
      >
        <span className="dark-cloud-party-mark" aria-hidden><NativeDarkCloudText content scale={1} text={party.leader.slice(0, 1).toUpperCase()} /></span>
        <span className="dark-cloud-row-copy">
          <strong><NativeDarkCloudText content scale={0.85} text={`${party.leader}'s party`} tint={selected ? 0xbfffbf : 0xd9ba70} /></strong>
          <span className="dark-cloud-party-flags">
            {party.sessionKind === 'private-college' ? <em><NativeDarkCloudText font="medium" scale={0.85} text="PRIVATE COLLEGE" /></em> : null}
            {party.modCount > 0 ? <em><NativeDarkCloudText font="medium" scale={0.85} text={`MODDED (${party.modCount})`} /></em> : null}
            {party.cheatsEnabled ? <em className="cheats"><NativeDarkCloudText font="medium" scale={0.85} text="CHEATS" tint={0xe6a078} /></em> : null}
          </span>
          <small>{party.members.join(', ')}</small>
        </span>
        <span className="dark-cloud-party-members"><NativeDarkCloudText font="medium" scale={0.85} text={presentation.squad.toUpperCase()} /></span>
        <span className={`dark-cloud-party-status ${party.status}`}><NativeDarkCloudText font="medium" scale={0.85} text={presentation.status.toUpperCase()} /></span>
        <span className="dark-cloud-party-location" title={presentation.location}>
          <NativeDarkCloudText content font="medium" scale={0.85} text={presentation.location} />
        </span>
      </button>
      <div className="dark-cloud-row-actions">
        <NativeUiButton height={44} scale={0.55} width="fill" type="button" disabled={busy || action === 'wait'} onClick={onEnter}>
          {pending
            ? 'REQUESTED'
            : action === 'request' ? 'REQUEST' : action === 'wait' ? 'IN GAME' : 'JOIN'}
        </NativeUiButton>
      </div>
    </article>
  )
}

/**
 * Developer-only roster of every connected player and what they are doing.
 * The backend answers `/api/game/players` with 404 unless the signed-in user
 * is a developer, so this section can only ever render for developers.
 */
export function DeveloperPresenceSection({
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
        <span><NativeDarkCloudText font="medium" scale={1} text="DEVELOPER SIGHT" /></span>
        <span className="dark-cloud-dev-presence-count">
          <NativeDarkCloudText font="medium" scale={1} text={loading && players.length === 0
            ? 'SCRYING...'
            : `${players.length} CONNECTED ${players.length === 1 ? 'WIZARD' : 'WIZARDS'}`} />
        </span>
      </header>
      {error !== null ? (
        <p className="dark-cloud-dev-presence-note" role="alert">{error}</p>
      ) : null}
      {!loading && error === null && players.length === 0 ? (
        <p className="dark-cloud-dev-presence-note"><NativeDarkCloudText font="medium" scale={1} text="NO CONNECTED WIZARDS." /></p>
      ) : null}
      <div className="dark-cloud-dev-matches">
        <div className="dark-cloud-dev-subheading">
          <span><NativeDarkCloudText font="medium" scale={1} text="ACTIVE MATCHES" /></span>
          <span><NativeDarkCloudText font="medium" scale={1} text={String(matches.length)} /></span>
        </div>
        {!loading && error === null && matches.length === 0 ? (
          <p className="dark-cloud-dev-presence-note"><NativeDarkCloudText font="medium" scale={1} text="NO ACTIVE MATCHES." /></p>
        ) : null}
        {matches.map(match => (
          <div className="dark-cloud-dev-match-row" key={match.id}>
            <span>
              <strong><NativeDarkCloudText content font="medium" scale={1} text={match.boneyardName} /></strong>
              <small><NativeDarkCloudText content font="medium" scale={0.85} text={match.players.join(', ')} /></small>
            </span>
            <span><NativeDarkCloudText font="medium" scale={0.85} text={match.waveNumber > 0 ? `WAVE ${match.waveNumber}` : 'STAGING'} /></span>
            <span><NativeDarkCloudText font="medium" scale={0.85} text={match.visibility.toUpperCase()} /></span>
            <span><NativeDarkCloudText font="medium" scale={0.85} text={match.session === 'global-hub' ? 'GLOBAL HUB' : 'PRIVATE COLLEGE'} /></span>
            <NativeUiButton height={44} scale={0.55} width="fill"
              type="button"
              disabled={observingMatchId !== null}
              onClick={() => { void onObserve(match.id) }}
            >
              {observingMatchId === match.id ? 'OPENING...' : 'OBSERVE'}
            </NativeUiButton>
          </div>
        ))}
      </div>
      <div className="dark-cloud-dev-subheading">
        <span><NativeDarkCloudText font="medium" scale={1} text="CONNECTED WIZARDS" /></span>
        <span><NativeDarkCloudText font="medium" scale={1} text={String(players.length)} /></span>
      </div>
      {players.map((player, index) => {
        const presentation = connectedPlayerPresentation(player)
        return (
          <div className="dark-cloud-dev-presence-row" key={`${player.session}:${player.displayName}:${index}`}>
            <span className="dark-cloud-dev-presence-wizard">
              <strong><NativeDarkCloudText content font="medium" scale={1} text={player.displayName} /></strong>
              <small>
                <NativeDarkCloudText content font="medium" scale={0.85} text={`${presentation.detail}${player.developer ? ', DEV' : ''}`} />
              </small>
            </span>
            <span className="dark-cloud-dev-presence-session"><NativeDarkCloudText font="medium" scale={0.85} text={presentation.session} /></span>
            <span className={`dark-cloud-dev-presence-status ${player.activity}`}>
              <NativeDarkCloudText font="medium" scale={0.85} text={presentation.status} />
            </span>
            <span className="dark-cloud-dev-presence-location" title={presentation.location}>
              <NativeDarkCloudText content font="medium" scale={0.85} text={presentation.location} />
            </span>
            <span className="dark-cloud-dev-presence-party" title={presentation.party ?? undefined}>
              <NativeDarkCloudText content font="medium" scale={0.85} text={presentation.party ?? 'NO PARTY'} />
            </span>
          </div>
        )
      })}
    </section>
  )
}

interface DarkCloudListProps {
  busy: boolean
  children?: ReactNode
  emptyText: string
  error: string | null
  label: string
  loading: boolean
  onJoinParty: (party: PublicGameParty) => void
  onModAction: (mod: ModSummary, action: DarkCloudSubscriptionAction) => void
  onOpenMod: (mod: ModSummary) => void
  onRetry: () => void
  onSelect: (key: string) => void
  partyBusy: boolean
  pendingParty: string | null
  rows: readonly DarkCloudRow[]
  selectedKey: string | null
  subscribed: boolean
}

export function DarkCloudList({ busy, children, emptyText, error, label, loading, onJoinParty, onModAction, onOpenMod, onRetry, onSelect, partyBusy, pendingParty, rows, selectedKey, subscribed }: DarkCloudListProps) {
  return (
    <div className="dark-cloud-rows" role="list" aria-label={label} aria-busy={loading}>
      {loading && rows.length === 0 ? <p className="dark-cloud-empty"><NativeDarkCloudText text="CONSULTING THE DARK CLOUD..." /></p> : null}
      {!loading && error && rows.length === 0 ? (
        <div className="dark-cloud-empty dark-cloud-empty-error" role="alert">
          <p>{error}</p>
          <NativeUiButton height={44} scale={0.55} width="fill" type="button" onClick={onRetry}>RETRY</NativeUiButton>
        </div>
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="dark-cloud-empty"><NativeDarkCloudText text={emptyText} /></p>
      ) : null}
      {rows.map(row => row.kind === 'mod' ? (
        <ModRow
          busy={busy}
          key={row.key}
          mod={row.mod}
          onOpen={() => onOpenMod(row.mod)}
          onSelect={() => onSelect(row.key)}
          onSubscriptionAction={action => onModAction(row.mod, action)}
          selected={selectedKey === row.key}
          subscription={row.subscription}
          subscribed={subscribed}
        />
      ) : (
        <PartyRow
          busy={partyBusy}
          key={row.key}
          onEnter={() => onJoinParty(row.party)}
          onSelect={() => onSelect(row.key)}
          party={row.party}
          pending={pendingParty === row.party.id}
          selected={selectedKey === row.key}
        />
      ))}
      {children}
    </div>
  )
}
