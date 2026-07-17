import { type ReactNode } from 'react'
import type { ModType } from '../lib/api'
import { art } from '../lib/assets'

/** Summoning-circle spinner — the game's arcane circle, slowly rotating. */
export function Spinner({ size = 56, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10" role="status">
      <img
        src={art.circleArcane}
        alt=""
        width={size}
        height={size}
        className="opacity-80 [animation:spin-slow_9s_linear_infinite]"
        style={{ filter: 'drop-shadow(0 0 14px rgb(65 227 255 / .45))' }}
      />
      {label && <span className="kicker">{label}</span>}
    </div>
  )
}

export function SectionHead({
  kicker,
  title,
  action,
}: {
  kicker: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <div className="kicker mb-1.5">{kicker}</div>
        <h2 className="h-display text-xl sm:text-2xl">{title}</h2>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </div>
  )
}

export function EmptyState({ title, line, icon }: { title: string; line?: string; icon?: string }) {
  return (
    <div className="panel panel-ornate flex flex-col items-center gap-3 px-6 py-14 text-center">
      <img src={icon ?? art.skullWhite} alt="" className="h-12 opacity-60" />
      <div className="h-display text-base">{title}</div>
      {line && <p className="text-fell max-w-md text-sm text-bone-dim">{line}</p>}
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded border border-blood/40 bg-blood/10 px-4 py-3 text-sm text-[#f0b9b9]">
      {message}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-bone-dim/70">{hint}</span>}
    </label>
  )
}

/** What kind of tome this is: a Lua script or a downloadable Boneyard run. */
export function TypeBadge({ type }: { type: ModType }) {
  return type === 'boneyard' ? (
    <span className="badge badge-necro" title="A downloadable Boneyard run">Boneyard</span>
  ) : (
    <span className="badge badge-arcane" title="A Lua script tome">Lua</span>
  )
}

export function PlayerBar({ players, max }: { players: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (players / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-24 overflow-hidden rounded-sm border border-black/70 bg-[#0c0a10] shadow-[inset_0_1px_2px_rgba(0,0,0,.8)]">
        <div
          className="h-full rounded-sm bg-gradient-to-b from-[#9ecf7e] to-[#537f3c] shadow-[0_0_8px_rgba(127,179,95,.5)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-bone-dim">
        {players}/{max}
      </span>
    </div>
  )
}

/** Gold-framed stat tile (slot-frame energy from the skill picker). */
export function StatTile({
  icon,
  value,
  label,
  loading,
}: {
  icon: string
  value: number | string | null
  label: string
  loading?: boolean
}) {
  return (
    <div className="panel panel-ornate flex items-center gap-4 px-5 py-4">
      <div
        className="flex h-12 w-12 flex-none items-center justify-center rounded-sm border border-gold/30 bg-[#0d0b12]"
        style={{ boxShadow: 'inset 0 0 12px rgba(0,0,0,.8), 0 0 10px rgba(200,168,98,.12)' }}
      >
        <img src={icon} alt="" className="h-8 w-8 object-contain" />
      </div>
      <div className="min-w-0">
        <div className="h-display text-2xl leading-none">
          {loading || value === null ? <span className="text-gold/40">—</span> : value}
        </div>
        <div className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-bone-dim">
          {label}
        </div>
      </div>
    </div>
  )
}
