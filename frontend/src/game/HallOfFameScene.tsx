import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'

import { mainMenu } from '../lib/assets.ts'
import {
  HALL_OF_FAME_BOARDS,
  formatHallOfFameTime,
  hallOfFameClassName,
  rankHallOfFameEntries,
  type HallOfFameBoard,
  type HallOfFameEntry,
} from './core-kernels/hall-of-fame.ts'
import {
  PLAYER_CHARACTER_SHEETS,
  playerCharacterAtlasCssFrame,
} from './renderer/player-character-atlas.ts'
import './hall-of-fame.css'

type HallScope = 'global' | 'local'

interface HallOfFameSceneProps {
  loadGlobal: (board: HallOfFameBoard) => Promise<readonly HallOfFameEntry[]>
  localEntries: readonly HallOfFameEntry[]
  onBack: () => void
  stageStyle: CSSProperties
}

const BOARD_LABELS: Readonly<Record<HallOfFameBoard, string>> = {
  awesomeness: 'Awesomeness',
  wave: 'Wave',
  kills: 'Kills',
  time: 'Time',
}

export default function HallOfFameScene({
  loadGlobal,
  localEntries,
  onBack,
  stageStyle,
}: HallOfFameSceneProps) {
  const [scope, setScope] = useState<HallScope>('local')
  const [board, setBoard] = useState<HallOfFameBoard>('awesomeness')
  const [globalEntries, setGlobalEntries] = useState<readonly HallOfFameEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (scope !== 'global') return
    let cancelled = false
    setLoading(true)
    setError(null)
    void loadGlobal(board).then((entries) => {
      if (!cancelled) setGlobalEntries(entries)
    }).catch((reason: unknown) => {
      if (!cancelled) {
        setGlobalEntries([])
        setError(reason instanceof Error ? reason.message : 'The global board could not be read.')
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [board, loadGlobal, refresh, scope])

  const entries = useMemo(() => scope === 'local'
    ? rankHallOfFameEntries(localEntries)
    : rankHallOfFameEntries(globalEntries, board), [board, globalEntries, localEntries, scope])

  return (
    <section
      className="hall-of-fame-stage"
      data-hall-board={scope === 'local' ? 'awesomeness' : board}
      data-hall-entry-count={entries.length}
      data-hall-scope={scope}
      style={stageStyle}
      aria-label="Hall of Fame"
    >
      <img
        alt=""
        aria-hidden
        className="hall-of-fame-background"
        src={mainMenu.hallOfFameBackground}
      />

      <div className="hall-of-fame-controls">
        <div className="hall-of-fame-scope" aria-label="Hall scope" role="group">
          <HallControl active={scope === 'local'} label="Local" onClick={() => setScope('local')} />
          <HallControl active={scope === 'global'} label="Global" onClick={() => setScope('global')} />
        </div>
        {scope === 'global' && (
          <div className="hall-of-fame-boards" aria-label="Global leaderboard" role="group">
            {HALL_OF_FAME_BOARDS.map((candidate) => (
              <HallControl
                key={candidate}
                active={board === candidate}
                label={BOARD_LABELS[candidate]}
                onClick={() => setBoard(candidate)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="hall-of-fame-list" aria-busy={loading}>
        {loading ? (
          <p className="hall-of-fame-status" role="status">Loading global records…</p>
        ) : error ? (
          <div className="hall-of-fame-status" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button>
          </div>
        ) : entries.length === 0 ? (
          <p className="hall-of-fame-status">No records yet.</p>
        ) : entries.map((entry, index) => (
          <HallEntry
            key={`${entry.accountUsername ?? 'local'}:${entry.runId}`}
            board={scope === 'local' ? 'awesomeness' : board}
            entry={entry}
            rank={index + 1}
            showAccount={scope === 'global'}
          />
        ))}
      </div>

      <button
        type="button"
        className="hall-of-fame-main-menu"
        aria-label="Main Menu"
        onClick={onBack}
      />
    </section>
  )
}

function HallControl({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className="hall-of-fame-control"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function HallEntry({
  board,
  entry,
  rank,
  showAccount,
}: {
  board: HallOfFameBoard
  entry: HallOfFameEntry
  rank: number
  showAccount: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <article className="hall-of-fame-entry" data-expanded={expanded}>
      <button
        type="button"
        className="hall-of-fame-entry-summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <strong className="hall-of-fame-rank">#{rank}</strong>
        <span className="hall-of-fame-entry-center">
          <HallWizard entry={entry} />
          <span className="hall-of-fame-identity">
            <strong>{entry.wizardName}</strong>
            <span>Level {entry.level} {hallOfFameClassName(entry.element, entry.discipline)}</span>
            {showAccount && entry.accountUsername && <span>@{entry.accountUsername}</span>}
          </span>
        </span>
        <span className="hall-of-fame-score">
          <strong>{boardValue(entry, board)}</strong>
          <span>{BOARD_LABELS[board]}</span>
        </span>
        <span className="hall-of-fame-disclosure" aria-hidden>{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && <HallDetails entry={entry} />}
    </article>
  )
}

function HallDetails({ entry }: { entry: HallOfFameEntry }) {
  return (
    <div className="hall-of-fame-details">
      <div>
        <strong>Survival</strong>
        <span>Time: {formatHallOfFameTime(entry.elapsedTicks)}</span>
        <span>Wave: {entry.wave}</span>
      </div>
      <div>
        <strong>Highest Skills</strong>
        <div className="hall-of-fame-skill-grid">
          {Array.from({ length: 3 }, (_, index) => {
            const skill = entry.highestSkills[index]
            return (
              <span key={index} className="hall-of-fame-detail-cell">
                {skill ? `S${skill.skillId} · ${skill.rank}` : ''}
              </span>
            )
          })}
        </div>
      </div>
      <div>
        <span>Monsters Killed: {entry.monstersKilled}</span>
        <span>Awesomest Kill: {entry.awesomestKill ?? 'None'}</span>
      </div>
      <div>
        <strong>Perks Used</strong>
        <div className="hall-of-fame-perk-grid">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className="hall-of-fame-detail-cell">
              {entry.perksUsed[index] === undefined ? '' : entry.perksUsed[index]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function HallWizard({ entry }: { entry: HallOfFameEntry }) {
  const heading = ((Math.round(entry.headingIndex) % 24) + 24) % 24
  const layers = [
    PLAYER_CHARACTER_SHEETS.staffBack,
    PLAYER_CHARACTER_SHEETS.robeDynamic[entry.element],
    PLAYER_CHARACTER_SHEETS.robeFixed[entry.element],
    PLAYER_CHARACTER_SHEETS.staffFront,
    PLAYER_CHARACTER_SHEETS.head[entry.element],
  ] as const
  return (
    <span className="hall-of-fame-wizard" aria-hidden>
      {layers.map((sheet, index) => (
        <span
          key={`${sheet}:${index}`}
          className="hall-of-fame-wizard-layer"
          style={{ transform: `scale(${1.6 * entry.portraitScale})` }}
        >
          <span style={playerCharacterAtlasCssFrame(sheet, 0, heading)} />
        </span>
      ))}
    </span>
  )
}

function boardValue(entry: HallOfFameEntry, board: HallOfFameBoard): string {
  switch (board) {
    case 'awesomeness': return entry.awesomeness.toLocaleString()
    case 'wave': return entry.wave.toLocaleString()
    case 'kills': return entry.monstersKilled.toLocaleString()
    case 'time': return formatHallOfFameTime(entry.elapsedTicks)
  }
}
