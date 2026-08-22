import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { art } from '../lib/assets.ts'
import type { AllyHudRow } from './ally-hud.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import {
  PLAYER_CHARACTER_SHEETS,
  playerCharacterAtlasCssFrame,
} from './renderer/player-character-atlas.ts'
import {
  buildPartyRoster,
  compactPartyRosterRowLimit,
  compactPartyRosterRows,
  compactPartyRosterRowsThatFit,
  partyRosterModelsEqual,
  type PartyRosterModel,
  type PartyRosterRow,
} from './party-roster.ts'
import type { GameSnapshot } from './protocol/game-protocol.ts'
import type { LocalPartyState } from './protocol/party-state.ts'

import './party-roster.css'

const EMPTY_ROWS: readonly AllyHudRow[] = []
const CHIP_HEADING_INDEX = 12
const TOUCH_MEDIA_QUERY = '(hover: none) and (pointer: coarse)'
const SHEET_ID = 'hub-party-sheet'
/** The row the strip measures its fold by: a present wizard with a name and a bar. */
const RULER_ROW: PartyRosterRow = {
  displayName: 'Ruler',
  element: 'fire',
  healthRatio: 1,
  id: 'ruler',
  isLeader: false,
  isSelf: false,
  kind: 'player',
  playerId: null,
  presence: 'present',
}

export interface PartyRosterProps {
  additionalRows?: readonly AllyHudRow[]
  error?: string | null
  initialSnapshot: GameSnapshot
  mode: 'hub' | 'run'
  onAcceptInvitation?: (invitationId: string) => void
  onDenyInvitation?: (invitationId: string) => void
  onOpenMember?: (playerId: string) => void
  onOpenPartySettings?: () => void
  partyState: LocalPartyState | null
  playerId: string
  subscribeSnapshot: (listener: (snapshot: GameSnapshot) => void) => () => void
  uiScale: number
}

/**
 * One surface for "who is with me": a compact strip of ally health bars that
 * doubles as the party list. The party pill folds the full member sheet away
 * until it is asked for, so a large party never crowds the HUD.
 */
export default function PartyRoster({
  additionalRows = EMPTY_ROWS,
  error = null,
  initialSnapshot,
  mode,
  onAcceptInvitation,
  onDenyInvitation,
  onOpenMember,
  onOpenPartySettings,
  partyState,
  playerId,
  subscribeSnapshot,
  uiScale,
}: PartyRosterProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const alliesRef = useRef<HTMLDivElement>(null)
  const rulerRef = useRef<HTMLDivElement>(null)
  const latestSnapshotRef = useRef(initialSnapshot)
  const [model, setModel] = useState<PartyRosterModel>(() => buildPartyRoster({
    additionalRows,
    partyState,
    playerId,
    snapshot: initialSnapshot,
  }))
  const [expanded, setExpanded] = useState(false)
  const [touch, setTouch] = useState(() => window.matchMedia(TOUCH_MEDIA_QUERY).matches)
  // rows that stack inside the strip's box, which stops above the movement
  // joystick (touch) or the chat (mouse); unknown until the strip has layout
  const [rowsThatFit, setRowsThatFit] = useState<number | null>(null)

  useEffect(() => {
    const query = window.matchMedia(TOUCH_MEDIA_QUERY)
    const sync = () => setTouch(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const publish = (snapshot: GameSnapshot) => {
      latestSnapshotRef.current = snapshot
      const next = buildPartyRoster({ additionalRows, partyState, playerId, snapshot })
      setModel((current) => (partyRosterModelsEqual(current, next) ? current : next))
    }
    publish(latestSnapshotRef.current)
    return subscribeSnapshot(publish)
  }, [additionalRows, partyState, playerId, subscribeSnapshot])

  useLayoutEffect(() => {
    const root = rootRef.current
    const column = columnRef.current
    const allies = alliesRef.current
    const ruler = rulerRef.current
    if (!root || !column || !allies || !ruler) return
    const measure = () => {
      // the touch column counters the frame scale with a transform, so the
      // box's screen height converts into the column's own px through the
      // column's net scale
      const scale = column.offsetWidth > 0 ? column.getBoundingClientRect().width / column.offsetWidth : 0
      if (!(scale > 0)) {
        setRowsThatFit(0)
        return
      }
      const columnGap = parseFloat(getComputedStyle(column).rowGap) || 0
      let fixedHeight = 0
      for (const child of Array.from(column.children)) {
        if (child === allies || child === ruler || child.classList.contains('hub-party-more')) continue
        fixedHeight += (child as HTMLElement).offsetHeight + columnGap
      }
      setRowsThatFit(compactPartyRosterRowsThatFit({
        availableHeight: root.getBoundingClientRect().height / scale,
        fixedHeight,
        rowGap: parseFloat(getComputedStyle(allies).rowGap) || 0,
        rowHeight: ruler.offsetHeight,
      }))
    }
    measure()
    // the box follows the viewport, the ruler follows the fonts as they load
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(ruler)
    return () => observer.disconnect()
  }, [error, model, partyState === null, touch, uiScale])

  const open = expanded && partyState !== null

  useEffect(() => {
    if (!open) return
    const keydown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setExpanded(false)
    }
    const pointerdown = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && root.contains(event.target)) return
      setExpanded(false)
    }
    window.addEventListener('keydown', keydown, true)
    document.addEventListener('pointerdown', pointerdown, true)
    return () => {
      window.removeEventListener('keydown', keydown, true)
      document.removeEventListener('pointerdown', pointerdown, true)
    }
  }, [open])

  const rowLimit = Math.min(
    compactPartyRosterRowLimit(touch, uiScale),
    rowsThatFit ?? Number.POSITIVE_INFINITY,
  )
  const compact = partyState === null
    ? { hiddenCount: 0, rows: model.allies }
    : compactPartyRosterRows(model.allies, rowLimit)
  const openMember = onOpenMember === undefined
    ? undefined
    : (row: PartyRosterRow) => {
        if (row.playerId === null || row.presence === 'away') return
        // the member's card replaces the sheet: closing the card lands back
        // on the compact strip, not on a sheet still covering the world
        setExpanded(false)
        onOpenMember(row.playerId)
      }
  const hint = model.size <= 1
    ? (mode === 'hub'
        ? 'Select another wizard in the College to invite them.'
        : 'You are braving the Boneyard alone.')
    : 'Select a member to see their card.'

  return (
    <div
      ref={rootRef}
      className="hub-party-roster"
      data-expanded={open}
      data-party-id={model.partyId ?? undefined}
      data-party-rows-fit={rowsThatFit ?? undefined}
      data-party-size={model.size}
    >
      <div className="hub-party-compact" ref={columnRef}>
        {partyState !== null && (
          <div className="hub-party-pills">
            <button
              type="button"
              className="hub-party-toggle"
              data-party-toggle
              aria-controls={SHEET_ID}
              aria-expanded={open}
              onClick={() => setExpanded((current) => !current)}
            >
              <img src={art.skullGold} alt="" aria-hidden />
              <span className="hub-party-toggle-label">Party</span>
              <span className="hub-party-count" aria-label={`${model.size} in party`}>
                {model.size}
              </span>
              <span className="hub-party-toggle-chevron" aria-hidden />
            </button>
            {/* the settings gear stays one tap away: a leader reads and shares
                the Party ID from here, so it never hides behind the sheet */}
            {onOpenPartySettings && (
              <button
                type="button"
                className="hub-party-settings-open"
                aria-label="Party settings"
                onClick={onOpenPartySettings}
              >
                <svg viewBox="0 0 16 16" aria-hidden>
                  <circle cx="8" cy="8" r="2.4" />
                  <circle cx="8" cy="8" r="5.1" />
                  <path d="M8 .9v2.1M8 13v2.1M.9 8H3M13 8h2.1M3 3l1.5 1.5M11.5 11.5 13 13M3 13l1.5-1.5M11.5 4.5 13 3" />
                </svg>
              </button>
            )}
          </div>
        )}
        {error && <p className="hub-party-error" role="alert">{error}</p>}
        <div
          className="hub-hud-allies"
          data-ally-count={model.allies.length}
          ref={alliesRef}
          role="list"
          aria-label="Allies"
        >
          {compact.rows.map((row) => (
            <AllyRow key={row.id} onOpen={openMember} row={row} />
          ))}
        </div>
        {compact.hiddenCount > 0 && (
          <button
            type="button"
            className="hub-party-more"
            data-party-hidden-count={compact.hiddenCount}
            onClick={() => setExpanded(true)}
          >
            +{compact.hiddenCount} more
          </button>
        )}
        {onAcceptInvitation && onDenyInvitation && model.invitations.map((invitation) => (
          <div
            className="hub-party-invitation"
            data-party-invitation={invitation.id}
            key={invitation.id}
          >
            <span className="hub-party-invitation-text">
              <strong>{invitation.inviter.displayName}</strong> invited you
            </span>
            <div className="hub-party-invitation-actions">
              <button
                type="button"
                onClick={() => onAcceptInvitation(invitation.id)}
              >
                Accept
              </button>
              <button
                type="button"
                className="hub-party-invitation-deny"
                onClick={() => onDenyInvitation(invitation.id)}
              >
                Deny
              </button>
            </div>
          </div>
        ))}
        <div className="hub-party-ruler" ref={rulerRef} aria-hidden inert>
          <AllyRow onOpen={undefined} row={RULER_ROW} />
        </div>
      </div>

      {open && (
        <>
          <div
            className="hub-party-sheet-scrim"
            onPointerDown={() => setExpanded(false)}
            aria-hidden
          />
          <section
            id={SHEET_ID}
            className="hub-party-sheet"
            role="dialog"
            aria-label="Party"
          >
            <header className="hub-party-sheet-header">
              <h2>
                <img src={art.skullGold} alt="" aria-hidden />
                Party
                <span className="hub-party-count">{model.size}</span>
              </h2>
              <button
                type="button"
                className="hub-party-sheet-close"
                aria-label="Close party"
                onClick={() => setExpanded(false)}
              >
                <svg viewBox="0 0 12 12" aria-hidden>
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            </header>
            <div className="hub-party-members" role="list">
              {model.members.map((row) => (
                <PartyMemberRow key={row.id} onOpen={openMember} row={row} />
              ))}
            </div>
            <p className="hub-party-sheet-hint">{hint}</p>
          </section>
        </>
      )}
    </div>
  )
}

function RosterChip({ element, kind }: { element: WizardElement | null; kind: PartyRosterRow['kind'] }) {
  if (kind === 'golem') {
    return (
      <span className="hub-hud-ally-chip hub-hud-ally-chip-golem" aria-hidden>
        <img src={art.skullWhite} alt="" />
      </span>
    )
  }
  if (element === null) {
    return (
      <span className="hub-hud-ally-chip hub-hud-ally-chip-away" aria-hidden>
        <img src={art.skullWhite} alt="" />
      </span>
    )
  }
  const layers = [
    PLAYER_CHARACTER_SHEETS.robeDynamic[element],
    PLAYER_CHARACTER_SHEETS.robeFixed[element],
    PLAYER_CHARACTER_SHEETS.head[element],
  ] as const
  return (
    <span className="hub-hud-ally-chip" data-ally-chip-element={element} aria-hidden>
      {layers.map((sheet, index) => (
        <span key={`${sheet}:${index}`} className="hub-hud-ally-chip-layer">
          <span style={playerCharacterAtlasCssFrame(sheet, 0, CHIP_HEADING_INDEX)} />
        </span>
      ))}
    </span>
  )
}

function HealthBar({ name, ratio }: { name: string; ratio: number }) {
  return (
    <span
      className="hub-hud-ally-bar"
      role="progressbar"
      aria-label={`${name} health`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={ratio * 100}
    >
      <span className="hub-hud-ally-bar-fill" style={{ width: `${ratio * 100}%` }} aria-hidden />
    </span>
  )
}

function AllyRow({
  onOpen,
  row,
}: {
  onOpen: ((row: PartyRosterRow) => void) | undefined
  row: PartyRosterRow
}) {
  const ratio = row.healthRatio ?? 0
  const body = (
    <>
      <RosterChip element={row.element} kind={row.kind} />
      <span className="hub-hud-ally-main">
        <span className="hub-hud-ally-name" aria-hidden>{row.displayName}</span>
        <HealthBar name={row.displayName} ratio={ratio} />
      </span>
    </>
  )
  return (
    <div
      className="hub-hud-ally-row"
      data-ally-id={row.id}
      data-ally-kind={row.kind}
      data-ally-element={row.element ?? undefined}
      data-health-ratio={ratio}
      data-presence={row.presence}
      role="listitem"
      aria-label={row.displayName}
    >
      {onOpen && row.playerId !== null && row.presence !== 'away' ? (
        <button
          type="button"
          className="hub-hud-ally-open"
          aria-label={`${row.displayName}, open player card`}
          onClick={() => onOpen(row)}
        >
          {body}
        </button>
      ) : (
        <span className="hub-hud-ally-open">{body}</span>
      )}
    </div>
  )
}

function PartyMemberRow({
  onOpen,
  row,
}: {
  onOpen: ((row: PartyRosterRow) => void) | undefined
  row: PartyRosterRow
}) {
  const detail = row.presence === 'away'
    ? 'elsewhere'
    : row.presence === 'fallen'
      ? 'fallen'
      : null
  const label = [
    row.displayName,
    row.isSelf ? 'you' : null,
    row.isLeader ? 'leader' : null,
    detail,
  ].filter((part) => part !== null).join(', ')
  const canOpen = onOpen !== undefined && row.presence !== 'away'
  return (
    <div
      role="listitem"
      className="hub-party-member"
      data-party-member={row.id}
      data-party-leader={row.isLeader}
      data-presence={row.presence}
      data-ally-element={row.element ?? undefined}
    >
      <button
        type="button"
        className="hub-party-member-open"
        aria-label={label}
        disabled={!canOpen}
        onClick={() => onOpen?.(row)}
      >
        <RosterChip element={row.element} kind={row.kind} />
        <span className="hub-party-member-main">
          <span className="hub-party-member-title">
            <span className="hub-party-member-name">{row.displayName}</span>
            {row.isSelf && <span className="hub-party-member-tag hub-party-member-you">You</span>}
            {row.isLeader && <span className="hub-party-member-tag hub-party-member-host">Leader</span>}
          </span>
          {row.presence === 'present' && row.healthRatio !== null ? (
            <HealthBar name={row.displayName} ratio={row.healthRatio} />
          ) : (
            <span className="hub-party-member-status">
              {row.presence === 'fallen' ? 'Fallen' : 'Elsewhere'}
            </span>
          )}
        </span>
      </button>
    </div>
  )
}
