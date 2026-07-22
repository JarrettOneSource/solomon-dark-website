// The stage chrome: a floating vertical tool rail on the canvas edge, a
// tool-options pill along the top, and the held-pieces actions opposite.
// Icons, not letters; the letters live on as keyboard hints.

import type { ReactNode } from 'react'
import type { Tool, ToolStyles } from '../../editor/render'
import {
  FENCE_STYLE_LABEL,
  ROAD_STYLE_LABEL,
  ROAD_TEXTURES,
  TERRAIN_STYLE_LABEL,
  TERRAIN_TEXTURES,
} from '../../editor/textures'

interface Props {
  tool: Tool
  canUndo: boolean
  canRedo: boolean
  snap: boolean
  showGrid: boolean
  styles: ToolStyles
  selectionCount: number
  /** True when any held thing already belongs to a group. */
  selectionGrouped: boolean
  /** Label of the catalogue piece being planted, when the place tool is up. */
  placeLabel?: string | null
  onTool: (tool: Tool) => void
  onStyles: (patch: Partial<ToolStyles>) => void
  onUndo: () => void
  onRedo: () => void
  onSnap: () => void
  onGrid: () => void
  onGroup: () => void
  onUngroup: () => void
  onDuplicate: () => void
  onDelete: () => void
}

type IconName =
  | 'select' | 'brush' | 'erase' | 'pan'
  | 'road' | 'fence' | 'terrain'
  | 'undo' | 'redo' | 'grid' | 'snap'

const ICON_PATHS: Record<IconName, ReactNode> = {
  select: <path d="M4 1.8l9.2 7.1-4.3 1 2.2 4.6-2 .9-2.2-4.6L4 13.4z" fill="currentColor" />,
  brush: (
    <>
      <path d="M14 2c-2.6.7-5.3 2.6-7 4.6l2.4 2.4C11.4 7.3 13.3 4.6 14 2z" fill="currentColor" />
      <path
        d="M6.2 7.6c-1.5.2-2.3 1-2.6 2.4-.2.9-.6 1.5-1.6 2 1.6 1.1 4 .9 5.1-.2.8-.8 1-2 .7-2.9z"
        fill="currentColor"
      />
    </>
  ),
  erase: (
    <>
      <path d="M9.6 2.6l3.8 3.8-6 6H4.6L2 9.6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 5.7l3.8 3.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 14h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  pan: (
    <path
      d="M8 1l1.8 1.8H8.8v4.4h4.4V6.4L15 8l-1.8 1.6v-.8H8.8v4.4h1L8 15l-1.8-1.8h1V8.8H2.8v.8L1 8l1.8-1.6v.8h4.4V2.8h-1z"
      fill="currentColor"
    />
  ),
  road: (
    <>
      <path d="M4.6 14.5L6.8 1.5M11.4 14.5L9.2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 3.5v1.8M8 7.2V9M8 10.7v1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  fence: (
    <>
      <path d="M3.2 5.5L3.2 14M8 4l0 10M12.8 5.5v8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3.2 5.5L3.2 4.2 2.4 5.5zM8 4l0-1.4L7.2 4zM12.8 5.5V4.2l-.8 1.3z" fill="currentColor" />
      <path d="M1.5 8h13M1.5 11.5h13" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  terrain: (
    <path
      d="M1.5 5.5c2.2-2.2 4.3-2.2 6.5 0s4.3 2.2 6.5 0M1.5 10.5c2.2-2.2 4.3-2.2 6.5 0s4.3 2.2 6.5 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  ),
  undo: (
    <path
      d="M6.5 2.8L2.5 6.8l4 4M2.5 6.8h6.7a4.3 4.3 0 014.3 4.3v1.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  redo: (
    <path
      d="M9.5 2.8l4 4-4 4M13.5 6.8H6.8a4.3 4.3 0 00-4.3 4.3v1.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  grid: (
    <path
      d="M2 2h12v12H2zM2 6h12M2 10h12M6 2v12M10 2v12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  ),
  snap: (
    <>
      <path
        d="M4.6 2v6a3.4 3.4 0 006.8 0V2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3.2 2h2.9v2.6H3.2zM9.9 2h2.9v2.6H9.9z" fill="currentColor" />
    </>
  ),
}

function ToolIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      {ICON_PATHS[name]}
    </svg>
  )
}

function RailButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: IconName
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded transition-all ${
        active
          ? 'bg-gradient-to-b from-[#4a4436] to-[#2a2418] text-gold-bright shadow-[0_0_10px_rgba(200,168,98,.3),inset_0_0_0_1px_rgba(200,168,98,.55)]'
          : 'text-bone-dim hover:bg-gold/10 hover:text-gold-bright'
      } disabled:pointer-events-none disabled:opacity-30`}
    >
      <ToolIcon name={icon} />
    </button>
  )
}

function RailSep() {
  return <span className="mx-auto my-0.5 h-px w-5 bg-gold/15" />
}

/** Floating panel chrome shared by the rail and the pills. */
const PANEL = 'rounded-md border border-gold/20 bg-abyss/90 shadow-[0_2px_14px_rgba(0,0,0,.55)] backdrop-blur-sm'

function PillButton({
  label,
  title,
  tone = 'stone',
  disabled,
  onClick,
}: {
  label: string
  title: string
  tone?: 'stone' | 'blood'
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-2 py-1 font-display text-[10px] font-bold uppercase tracking-[0.12em] transition-colors disabled:pointer-events-none disabled:opacity-35 ${
        tone === 'blood'
          ? 'text-[#e8b0a6] hover:bg-blood/20 hover:text-white'
          : 'text-bone hover:bg-gold/10 hover:text-gold-bright'
      }`}
    >
      {label}
    </button>
  )
}

/** A texture swatch: the actual surface art as the button face. */
function Swatch({
  src,
  label,
  active,
  onClick,
}: {
  src: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={`h-7 w-9 overflow-hidden rounded-sm border bg-cover bg-center transition-all ${
        active
          ? 'border-gold/80 shadow-[0_0_10px_rgba(200,168,98,.35)]'
          : 'border-black/60 opacity-75 hover:border-gold/40 hover:opacity-100'
      }`}
      style={{ backgroundImage: `url(${src})` }}
    >
      <span className="sr-only">{label}</span>
    </button>
  )
}

function OptionLabel({ text }: { text: string }) {
  return <span className="font-mono text-[10px] uppercase tracking-wider text-bone-dim/70">{text}</span>
}

function ChoiceButton({ label, title, active, onClick }: { label: string; title?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded px-2 py-1 font-display text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
        active ? 'bg-gold/15 text-gold-bright shadow-[inset_0_0_0_1px_rgba(200,168,98,.5)]' : 'text-bone hover:bg-gold/10 hover:text-gold-bright'
      }`}
    >
      {label}
    </button>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <OptionLabel text={label} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-24 cursor-pointer appearance-none rounded bg-stone accent-[#c8a862]"
      />
      <span className="min-w-7 font-mono text-[10px] text-bone-dim">{value}</span>
    </label>
  )
}

const ROAD_WIDTHS = [
  { label: 'Path', value: 0.6 },
  { label: 'Road', value: 1 },
  { label: 'Avenue', value: 1.5 },
]

const HAND_TOOLS: { tool: Tool; icon: IconName; label: string }[] = [
  { tool: 'select', icon: 'select', label: 'Select, lasso, move (V)' },
  { tool: 'brush', icon: 'brush', label: 'Scatter brush (P)' },
  { tool: 'erase', icon: 'erase', label: 'Evict, drag sweeps (E)' },
  { tool: 'pan', icon: 'pan', label: 'Survey the view (H)' },
]

const DRAW_TOOLS: { tool: Tool; icon: IconName; label: string }[] = [
  { tool: 'road', icon: 'road', label: 'Lay a road (R)' },
  { tool: 'fence', icon: 'fence', label: 'Run a fence (F)' },
  { tool: 'terrain', icon: 'terrain', label: 'Carve terrain (T)' },
]

export default function Toolbar(p: Props) {
  const options = (() => {
    switch (p.tool) {
      case 'place':
        return (
          <span className="text-fell px-1 text-[11px] text-bone-dim/80">
            Planting {p.placeLabel ? <span className="text-gold/90">{p.placeLabel}</span> : 'from the catalogue'} · V returns to the hand
          </span>
        )
      case 'road':
        return (
          <>
            <OptionLabel text="Surface" />
            {ROAD_TEXTURES.map((src, i) => (
              <Swatch key={src} src={src} label={ROAD_STYLE_LABEL[i]} active={p.styles.road === i} onClick={() => p.onStyles({ road: i })} />
            ))}
            <span className="h-5 w-px bg-gold/15" />
            {ROAD_WIDTHS.map((w) => (
              <ChoiceButton
                key={w.label}
                label={w.label}
                title={`${Math.round(110 * w.value)} px wide`}
                active={p.styles.roadWidth === w.value}
                onClick={() => p.onStyles({ roadWidth: w.value })}
              />
            ))}
          </>
        )
      case 'fence':
        return (
          <>
            <OptionLabel text="Make" />
            {FENCE_STYLE_LABEL.map((label, i) => (
              <ChoiceButton key={label} label={label} active={p.styles.fence === i} onClick={() => p.onStyles({ fence: i })} />
            ))}
          </>
        )
      case 'terrain':
        return (
          <>
            <OptionLabel text="Cut" />
            {TERRAIN_TEXTURES.map((src, i) => (
              <Swatch key={src} src={src} label={TERRAIN_STYLE_LABEL[i]} active={p.styles.terrain === i} onClick={() => p.onStyles({ terrain: i })} />
            ))}
            <span className="font-mono text-[10px] text-gold/80">{TERRAIN_STYLE_LABEL[p.styles.terrain]}</span>
          </>
        )
      case 'brush':
        return (
          <>
            <Slider label="Reach" min={24} max={220} step={4} value={p.styles.brushRadius} onChange={(v) => p.onStyles({ brushRadius: v })} />
            <Slider label="Density" min={1} max={6} step={1} value={p.styles.brushDensity} onChange={(v) => p.onStyles({ brushDensity: v })} />
          </>
        )
      case 'erase':
        return (
          <Slider label="Sweep" min={12} max={160} step={4} value={p.styles.eraseRadius} onChange={(v) => p.onStyles({ eraseRadius: v })} />
        )
      default:
        return null
    }
  })()

  return (
    <>
      {/* the tool rail, riding the stage's left edge */}
      <div className={`absolute left-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-0.5 p-1 ${PANEL}`}>
        {HAND_TOOLS.map((t) => (
          <RailButton key={t.tool} icon={t.icon} label={t.label} active={p.tool === t.tool} onClick={() => p.onTool(t.tool)} />
        ))}
        <RailSep />
        {DRAW_TOOLS.map((t) => (
          <RailButton key={t.tool} icon={t.icon} label={t.label} active={p.tool === t.tool} onClick={() => p.onTool(t.tool)} />
        ))}
        <RailSep />
        <RailButton icon="undo" label="Undo (Ctrl+Z)" disabled={!p.canUndo} onClick={p.onUndo} />
        <RailButton icon="redo" label="Redo (Ctrl+Y)" disabled={!p.canRedo} onClick={p.onRedo} />
        <RailSep />
        <RailButton icon="grid" label="Survey grid" active={p.showGrid} onClick={p.onGrid} />
        <RailButton icon="snap" label="Snap to the grid (G)" active={p.snap} onClick={p.onSnap} />
      </div>

      {/* tool options, floating along the top */}
      {options && (
        <div className={`absolute left-1/2 top-2 z-10 flex max-w-[70%] -translate-x-1/2 flex-wrap items-center gap-1.5 px-2 py-1.5 ${PANEL}`}>
          {options}
        </div>
      )}

      {/* the held pieces and what can be done to them; sits clear of the
          ledger-reopen chevron, and steps down a row when tool options are
          up so the two pills never overlap */}
      {p.selectionCount > 0 && (
        <div className={`absolute right-10 ${options ? 'top-14' : 'top-2'} z-10 flex items-center gap-0.5 px-1.5 py-1 ${PANEL}`}>
          <span className="mr-1 px-1 font-mono text-[10px] uppercase tracking-wider text-gold/80">
            {p.selectionCount} held
          </span>
          <PillButton label="Group" title="Bind the held pieces into one (Ctrl+G)" disabled={p.selectionCount < 2} onClick={p.onGroup} />
          <PillButton label="Ungroup" title="Release the binding (Ctrl+Shift+G)" disabled={!p.selectionGrouped} onClick={p.onUngroup} />
          <PillButton label="Duplicate" title="Copy the held pieces a step over (Ctrl+D)" onClick={p.onDuplicate} />
          <PillButton label="Evict" title="Delete the held pieces (Del)" tone="blood" onClick={p.onDelete} />
        </div>
      )}
    </>
  )
}
