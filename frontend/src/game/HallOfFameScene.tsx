import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import { mainMenu, skillPicker } from '../lib/assets.ts'
import {
  HALL_OF_FAME_BOARDS,
  formatHallOfFameTime,
  hallOfFameClassName,
  rankHallOfFameEntries,
  type HallOfFameBoard,
  type HallOfFameEntry,
  type HallOfFameSkill,
} from './core-kernels/hall-of-fame.ts'
import { nativeSkillColorRoot } from './core-kernels/player-progression.ts'
import { HallNineSlice, HallSprite, HallText, HallWizard } from './HallOfFamePrimitives.tsx'
import {
  HALL_ATLAS_SIZES,
  HALL_BOX,
  HALL_CHEVRON_SIZE,
  HALL_KILLS_FRAME_ALPHA,
  HALL_OTHER_FRAME_ALPHA,
  HALL_PERK_CELL,
  HALL_RECORDS,
  HALL_SCROLL_EASE_TICKS,
  HALL_SKILL_CELL,
  HALL_TICK_MS,
  HALL_TILE,
  HALL_WHITE,
  hallAtlasRecord,
  hallCurrentRowScrollTarget,
  hallPerkIconRecord,
  hallRowLayout,
  hallRowTops,
  hallScrollEase,
  hallSeparatorHalves,
  hallSkillIconRecord,
  hallTileOffset,
  hallVisibleRowRange,
  measureHallText,
  type HallExpandedLayout,
  type HallPoint,
  type HallRect,
  type HallSkillCellLayout,
} from './hall-of-fame-presentation.ts'
import { skillPickerRootTint } from './renderer/skill-picker-render-contract.ts'
import './hall-of-fame.css'

type HallScope = 'global' | 'local'

interface HallGlobalResult {
  readonly entries: readonly HallOfFameEntry[]
  readonly error: string | null
  readonly key: string
}

const EMPTY_ENTRIES: readonly HallOfFameEntry[] = []

interface HallOfFameSceneProps {
  /** The run the player just finished; its row pulses, opens, and is scrolled into view like stock. */
  currentRunId?: string | null
  loadGlobal: (board: HallOfFameBoard) => Promise<readonly HallOfFameEntry[]>
  localEntries: readonly HallOfFameEntry[]
  onBack: () => void
  stageStyle: CSSProperties
}

interface HallRowModel {
  readonly current: boolean
  readonly entry: HallOfFameEntry
  readonly expanded: boolean
  readonly key: string
}

const BOARD_LABELS: Readonly<Record<HallOfFameBoard, string>> = {
  awesomeness: 'Awesomeness',
  wave: 'Wave',
  kills: 'Kills',
  time: 'Time',
}

const HEADER_HEIGHT = 55
const HEADER_BASELINE = 36
const HEADER_TAB_GAP = 30
const HEADER_BOARD_GAP = 24
const HEADER_LEFT = 70
const HEADER_RIGHT = HALL_BOX.width - 70
const STATUS_CENTER: HallPoint = { x: HALL_BOX.width / 2, y: 320 }

function entryKey(entry: HallOfFameEntry): string {
  return `${entry.accountUsername ?? 'local'}:${entry.runId}`
}

function rectStyle(rect: HallRect): CSSProperties {
  return { height: rect.height, left: rect.left, top: rect.top, width: rect.width }
}

export default function HallOfFameScene({
  currentRunId = null,
  loadGlobal,
  localEntries,
  onBack,
  stageStyle,
}: HallOfFameSceneProps) {
  const [scope, setScope] = useState<HallScope>('local')
  const [board, setBoard] = useState<HallOfFameBoard>('awesomeness')
  const [globalResult, setGlobalResult] = useState<HallGlobalResult | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [overrides, setOverrides] = useState<Readonly<Record<string, boolean>>>({})
  const [scrollTop, setScrollTop] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const tiles = useRef<HTMLDivElement>(null)
  const scrollAnimation = useRef(0)
  const scrolledRunId = useRef<string | null>(null)

  // The request key changes synchronously with the selection, so the rows of
  // the previous board never show under the new heading while it loads.
  const globalKey = `${board}:${refresh}`
  const globalReady = scope === 'global' && globalResult?.key === globalKey ? globalResult : null
  const loading = scope === 'global' && globalReady === null
  const error = globalReady?.error ?? null
  const globalEntries = globalReady?.entries ?? EMPTY_ENTRIES

  useEffect(() => {
    if (scope !== 'global') return
    let cancelled = false
    void loadGlobal(board).then((entries) => {
      if (!cancelled) setGlobalResult({ entries, error: null, key: globalKey })
    }).catch((reason: unknown) => {
      if (!cancelled) {
        setGlobalResult({
          entries: EMPTY_ENTRIES,
          error: reason instanceof Error ? reason.message : 'The global board could not be read.',
          key: globalKey,
        })
      }
    })
    return () => { cancelled = true }
  }, [board, globalKey, loadGlobal, scope])

  const entries = useMemo(() => scope === 'local'
    ? rankHallOfFameEntries(localEntries)
    : rankHallOfFameEntries(globalEntries, board), [board, globalEntries, localEntries, scope])

  const rows = useMemo<readonly HallRowModel[]>(() => entries.map((entry) => {
    const key = entryKey(entry)
    const current = currentRunId !== null && entry.runId === currentRunId
    return { current, entry, expanded: overrides[key] ?? current, key }
  }), [currentRunId, entries, overrides])
  const expandedFlags = useMemo(() => rows.map((row) => row.expanded), [rows])
  const { contentHeight, tops } = useMemo(() => hallRowTops(expandedFlags), [expandedFlags])
  const range = hallVisibleRowRange(tops, expandedFlags, scrollTop)

  const onScroll = useCallback(() => {
    const element = scroller.current
    if (!element) return
    const top = element.scrollTop
    if (tiles.current) tiles.current.style.transform = `translateY(${-hallTileOffset(top)}px)`
    setScrollTop(top)
  }, [])

  useEffect(() => () => cancelAnimationFrame(scrollAnimation.current), [])

  // `HallOfFameBox` scrolls once to the current wizard: box+0xDC is written the
  // first frame that renders the row, then the tick eases `sin(t deg) * target`.
  useEffect(() => {
    const element = scroller.current
    const index = rows.findIndex((row) => row.current)
    if (!element || index < 0 || scrolledRunId.current === currentRunId) return
    scrolledRunId.current = currentRunId
    const target = hallCurrentRowScrollTarget(tops[index]!, contentHeight)
    if (target <= 0) return
    const start = performance.now()
    const step = (now: number) => {
      const tick = Math.floor((now - start) / HALL_TICK_MS)
      element.scrollTop = hallScrollEase(tick) * target
      if (tick < HALL_SCROLL_EASE_TICKS - 1) scrollAnimation.current = requestAnimationFrame(step)
    }
    scrollAnimation.current = requestAnimationFrame(step)
  }, [contentHeight, currentRunId, rows, tops])

  const toggleRow = useCallback((row: HallRowModel) => {
    setOverrides((previous) => ({ ...previous, [row.key]: !row.expanded }))
  }, [])

  const selectScope = (next: HallScope) => {
    setScope(next)
    if (scroller.current) scroller.current.scrollTop = 0
  }

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

      <div className="hall-of-fame-box">
        <div ref={tiles} className="hall-of-fame-tiles" aria-hidden>
          <HallTiles rows={HALL_TILE.rows} />
        </div>

        <div
          ref={scroller}
          className="hall-of-fame-scroll"
          data-hall-scroll-top={Math.round(scrollTop)}
          onScroll={onScroll}
          aria-busy={loading}
        >
          <div className="hall-of-fame-content" style={{ height: Math.max(contentHeight, HALL_BOX.height) }}>
            {loading ? (
              <HallStatus role="status" text="Loading global records..." />
            ) : error ? (
              <HallStatus role="alert" text={error} onRetry={() => setRefresh((value) => value + 1)} />
            ) : entries.length === 0 ? (
              <HallStatus text="No records yet." />
            ) : rows.slice(range.start, range.end).map((row, offset) => {
              const index = range.start + offset
              return (
                <HallRow
                  key={row.key}
                  onToggle={() => toggleRow(row)}
                  rank={index + 1}
                  row={row}
                  rowTop={tops[index]!}
                  showAccount={scope === 'global'}
                />
              )
            })}
          </div>
        </div>

        <div className="hall-of-fame-header">
          <HallTiles rows={1} />
          <span className="hall-of-fame-header-rule hall-row-separator-left" style={{ left: 150, top: HEADER_HEIGHT - 2, width: HALL_BOX.width / 2 - 150 }} />
          <span className="hall-of-fame-header-rule hall-row-separator-right" style={{ left: HALL_BOX.width / 2, top: HEADER_HEIGHT - 2, width: HALL_BOX.width / 2 - 150 }} />
          <HallTabs
            active={scope}
            ariaLabel="Hall scope"
            font="medium"
            items={[['local', 'Local'], ['global', 'Global']]}
            left={HEADER_LEFT}
            onSelect={selectScope}
          />
          {scope === 'global' && (
            <HallTabs
              active={board}
              ariaLabel="Global leaderboard"
              font="body"
              items={HALL_OF_FAME_BOARDS.map((candidate) => [candidate, BOARD_LABELS[candidate]] as const)}
              onSelect={setBoard}
              right={HEADER_RIGHT}
            />
          )}
        </div>
      </div>

      <button
        type="button"
        className="hall-of-fame-main-menu"
        aria-label="Main Menu"
        data-game-back="true"
        onClick={onBack}
      />
    </section>
  )
}

/** UI record 49 tiled 5 x N from the box origin; the layer translates by `scroll mod 264`. */
function HallTiles({ rows }: { readonly rows: number }) {
  const record = hallAtlasRecord('UI', HALL_RECORDS.ui.tile)
  const [frameX, frameY] = record.frame
  const [atlasWidth, atlasHeight] = HALL_ATLAS_SIZES.UI
  const style: CSSProperties = {
    backgroundImage: `url("${skillPicker.uiAtlas}")`,
    backgroundPosition: `${-frameX}px ${-frameY}px`,
    backgroundSize: `${atlasWidth}px ${atlasHeight}px`,
  }
  const cells: ReactNode[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < HALL_TILE.columns; column += 1) {
      cells.push(
        <span
          key={`${column}:${row}`}
          className="hall-of-fame-tile"
          style={{ ...style, left: column * HALL_TILE.size, top: row * HALL_TILE.size }}
        />,
      )
    }
  }
  return <>{cells}</>
}

function HallTabs<Key extends string>({
  active,
  ariaLabel,
  font,
  items,
  left,
  onSelect,
  right,
}: {
  readonly active: Key
  readonly ariaLabel: string
  readonly font: 'body' | 'medium'
  readonly items: readonly (readonly [Key, string])[]
  readonly left?: number
  readonly onSelect: (key: Key) => void
  readonly right?: number
}) {
  const gap = font === 'medium' ? HEADER_TAB_GAP : HEADER_BOARD_GAP
  const labels = items.map(([key, label]) => ({ key, label: label.toUpperCase(), width: measureHallText(font, label.toUpperCase()) }))
  const total = labels.reduce((sum, item) => sum + item.width, 0) + gap * (labels.length - 1)
  let cursor = right !== undefined ? right - total : left ?? 0
  return (
    <div className="hall-of-fame-tabs" aria-label={ariaLabel} role="group">
      {labels.map((item) => {
        const x = cursor
        cursor += item.width + gap
        return (
          <button
            key={item.key}
            type="button"
            className="hall-tab"
            aria-pressed={active === item.key}
            style={{ left: x - 8, top: HEADER_BASELINE - 22, width: item.width + 16 }}
            onClick={() => onSelect(item.key)}
          >
            <span className="hall-sr-only">{item.label}</span>
            <HallText font={font} text={item.label} x={8} y={22} />
            <span className="hall-tab-underline" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

function HallStatus({
  onRetry,
  role,
  text,
}: {
  readonly onRetry?: () => void
  readonly role?: 'alert' | 'status'
  readonly text: string
}) {
  return (
    <div className="hall-of-fame-status" role={role}>
      <span className="hall-sr-only">{text}</span>
      <HallText align="center" font="medium" text={text} x={STATUS_CENTER.x} y={STATUS_CENTER.y} />
      {onRetry && (
        <button
          type="button"
          className="hall-tab hall-status-retry"
          style={{ left: STATUS_CENTER.x - measureHallText('medium', 'RETRY') / 2 - 8, top: STATUS_CENTER.y + 18, width: measureHallText('medium', 'RETRY') + 16 }}
          onClick={onRetry}
        >
          <span className="hall-sr-only">Retry</span>
          <HallText font="medium" text="RETRY" x={8} y={22} />
          <span className="hall-tab-underline" aria-hidden />
        </button>
      )}
    </div>
  )
}

function HallRow({
  onToggle,
  rank,
  row,
  rowTop,
  showAccount,
}: {
  readonly onToggle: () => void
  readonly rank: number
  readonly row: HallRowModel
  readonly rowTop: number
  readonly showAccount: boolean
}) {
  const { current, entry, expanded } = row
  const rankText = `${rank}`
  const levelText = `Level ${entry.level} ${hallOfFameClassName(entry.element, entry.discipline).toUpperCase()}`
  const awesomenessText = `Awesomeness: ${entry.awesomeness}`
  const layout = hallRowLayout(
    rowTop,
    expanded,
    measureHallText('heading', rankText),
    measureHallText('medium', awesomenessText),
  )
  return (
    <div
      className={current ? 'hall-row hall-row-current' : 'hall-row'}
      data-hall-current={current ? 'true' : undefined}
      data-hall-expanded={expanded}
      data-hall-rank={rank}
    >
      {current && <span className="hall-row-fill" style={rectStyle(layout.highlight)} />}
      <HallNineSlice
        alpha={current ? undefined : HALL_OTHER_FRAME_ALPHA}
        className={current ? 'hall-row-frame hall-row-frame-current' : 'hall-row-frame'}
        record={HALL_RECORDS.ui.frame}
        rect={layout.highlight}
      />
      <HallSprite atlas="UI" record={HALL_RECORDS.ui.ornament} x={layout.ornament.x} y={layout.ornament.y} />
      <HallText {...layout.rank} text={rankText} />
      <HallWizard entry={entry} x={layout.wizard.x} y={layout.wizard.y} />
      <HallText {...layout.name} text={entry.wizardName} />
      <HallText {...layout.level} text={levelText} />
      <HallText {...layout.awesomeness} text={awesomenessText} />
      {showAccount && entry.accountUsername && (
        <HallText {...layout.account} alpha={0.7} text={`@${entry.accountUsername}`} />
      )}
      <button
        type="button"
        className="hall-row-toggle"
        aria-expanded={expanded}
        style={{ left: layout.chevron.x - HALL_CHEVRON_SIZE.width / 2, top: layout.chevron.y - HALL_CHEVRON_SIZE.height / 2 }}
        onClick={onToggle}
      >
        <span className="hall-sr-only">{expanded ? 'Hide' : 'Show'} details for {entry.wizardName}</span>
        <HallSprite
          atlas="UI"
          record={HALL_RECORDS.ui.chevron}
          rotation={layout.chevron.rotation}
          x={HALL_CHEVRON_SIZE.width / 2}
          y={HALL_CHEVRON_SIZE.height / 2}
        />
      </button>
      {layout.expanded && <HallExpanded entry={entry} layout={layout.expanded} />}
      {hallSeparatorHalves(layout.separatorY).map((half, index) => (
        <span
          key={index}
          className={index === 0 ? 'hall-row-separator hall-row-separator-left' : 'hall-row-separator hall-row-separator-right'}
          style={rectStyle(half)}
        />
      ))}
    </div>
  )
}

function HallExpanded({ entry, layout }: { readonly entry: HallOfFameEntry; readonly layout: HallExpandedLayout }) {
  return (
    <>
      <HallText {...layout.survival} text="SURVIVAL" />
      <HallText {...layout.timeLabel} text="Time:" />
      <HallText {...layout.timeValue} text={formatHallOfFameTime(entry.elapsedTicks)} />
      <HallText {...layout.waveLabel} text="Wave:" />
      <HallText {...layout.waveValue} text={`${entry.wave}`} />
      <HallText {...layout.highestSkills} text="HIGHEST SKILLS" />
      {layout.skillCells.map((cell, index) => (
        <HallSkillCell key={index} cell={cell} skill={entry.highestSkills[index] ?? null} />
      ))}
      <HallText {...layout.perksUsed} text="PERKS USED" />
      {layout.perkCenters.map((center, index) => (
        <HallPerkCell key={index} center={center} selector={entry.perksUsed[index] ?? null} />
      ))}
      <HallNineSlice alpha={HALL_KILLS_FRAME_ALPHA} record={HALL_RECORDS.ui.killsFrame} rect={layout.killsFrame} />
      <HallText {...layout.monstersKilled} text={`Monsters Killed: ${entry.monstersKilled}`} />
      <HallText {...layout.awesomestLabel} text="Awesomest Kill:" />
      {entry.awesomestKill && <HallText {...layout.awesomestKill} text={entry.awesomestKill} />}
    </>
  )
}

/**
 * Skill cell draw order from `0x005A2C80`: root-tinted backplate, skill icon,
 * half-black rank badge, white rank numeral, then the inventory frame on top.
 */
function HallSkillCell({ cell, skill }: { readonly cell: HallSkillCellLayout; readonly skill: HallOfFameSkill | null }) {
  if (!skill) {
    return <HallSprite atlas="Inventory" record={HALL_RECORDS.inventory.frame} scale={HALL_SKILL_CELL.emptyFrameScale} x={cell.center.x} y={cell.center.y} />
  }
  const rankText = `${skill.rank}`
  const badge = cell.badge(measureHallText('body', rankText))
  return (
    <span className="hall-skill-cell" data-hall-skill={skill.skillId} data-hall-skill-rank={skill.rank}>
      <HallSprite
        atlas="Skills"
        record={HALL_RECORDS.skills.backplate}
        scale={HALL_SKILL_CELL.backplateScale}
        tint={skillPickerRootTint(nativeSkillColorRoot(skill.skillId))}
        x={cell.center.x}
        y={cell.center.y}
      />
      <HallSprite atlas="Skills" record={hallSkillIconRecord(skill.skillId)} scale={HALL_SKILL_CELL.iconScale} x={cell.center.x} y={cell.center.y} />
      <span className="hall-skill-badge" style={rectStyle(badge)} />
      <HallText {...cell.numeral} text={rankText} tint={HALL_WHITE} />
      <HallSprite atlas="Inventory" record={HALL_RECORDS.inventory.frame} scale={HALL_SKILL_CELL.frameScale} x={cell.center.x} y={cell.center.y} />
    </span>
  )
}

function HallPerkCell({ center, selector }: { readonly center: HallPoint; readonly selector: number | null }) {
  return (
    <span className="hall-perk-cell" data-hall-perk={selector ?? undefined}>
      <HallSprite atlas="Inventory" record={HALL_RECORDS.inventory.frame} scale={HALL_PERK_CELL.frameScale} x={center.x} y={center.y} />
      {selector !== null && (
        <HallSprite atlas="Skills" record={hallPerkIconRecord(selector)} scale={HALL_PERK_CELL.iconScale} x={center.x} y={center.y} />
      )}
    </span>
  )
}
