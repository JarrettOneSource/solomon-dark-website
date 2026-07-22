// The mason's catalogue, cut from the game's own atlases. Two drawers:
// native classes (real objects with game behaviour) and DeadHawg scenery
// (static sprites). Search covers labels and drawer titles.

import { useMemo, useState } from 'react'
import { PALETTE } from '../../editor/assets'
import type { PaletteItem } from '../../editor/assets'

interface Props {
  activeKey: string | null
  onPick: (item: PaletteItem) => void
  onCollapse?: () => void
}

type Tab = 'classes' | 'scenery'

export default function PaletteRail({ activeKey, onPick, onCollapse }: Props) {
  const [tab, setTab] = useState<Tab>('classes')
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PALETTE.filter((g) => g.tab === tab)
      .map((g) => ({
        ...g,
        items: q
          ? g.items.filter((i) => i.label.toLowerCase().includes(q) || g.title.toLowerCase().includes(q))
          : g.items,
      }))
      .filter((g) => g.items.length > 0)
  }, [tab, query])

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-r border-gold/15 bg-abyss/70">
      <div className="space-y-2.5 border-b border-gold/15 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="kicker">The catalogue</div>
          {onCollapse && (
            <button
              type="button"
              title="Tuck the catalogue away"
              aria-label="Collapse the catalogue"
              className="rounded px-1.5 py-0.5 text-xs text-bone-dim hover:bg-gold/10 hover:text-gold-bright"
              onClick={onCollapse}
            >
              ❮
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label="Catalogue drawers">
          {(
            [
              { id: 'classes', label: 'Classes' },
              { id: 'scenery', label: 'Scenery' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-sm border px-2 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                tab === t.id
                  ? 'border-gold/60 bg-gold/10 text-gold-bright'
                  : 'border-gold/15 text-bone-dim hover:border-gold/40 hover:text-bone'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          className="input !py-1.5 !text-xs"
          placeholder="Search the drawers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {groups.length === 0 && (
          <p className="text-fell py-6 text-center text-xs text-bone-dim">
            Nothing answers to that name.
          </p>
        )}
        {groups.map((group) => (
          <section key={group.id}>
            <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
              {group.title}
              <span className="ml-2 font-mono text-[9px] font-normal tracking-normal text-bone-dim/50">
                {group.items.length}
              </span>
            </h3>
            {group.note && <p className="text-fell mt-0.5 text-[11px] text-bone-dim/70">{group.note}</p>}
            <div className="mt-2 grid grid-cols-3 gap-2">
              {group.items.map((item) => {
                const active = item.key === activeKey
                return (
                  <button
                    key={item.key}
                    type="button"
                    title={`${item.label} · click toggles planting, or drag onto the plot`}
                    aria-pressed={active}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-sdr-piece', item.key)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => onPick(item)}
                    className={`flex h-16 cursor-grab items-center justify-center rounded-sm border p-1.5 transition-all active:cursor-grabbing ${
                      active
                        ? 'border-gold/80 bg-[radial-gradient(circle_at_50%_35%,#3d3a33,#211e28_80%)] shadow-[0_0_14px_rgba(200,168,98,.35)]'
                        : 'border-black/60 bg-[radial-gradient(circle_at_50%_35%,#312e36,#1a1720_80%)] hover:border-gold/40'
                    }`}
                  >
                    {/* the art is authentically dark; the lift is presentational only */}
                    <img
                      src={item.src}
                      alt={item.label}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain [filter:brightness(1.5)_saturate(1.05)]"
                      draggable={false}
                    />
                  </button>
                )
              })}
            </div>
          </section>
        ))}
        <p className="text-fell border-t border-gold/10 pt-3 text-[11px] leading-relaxed text-bone-dim/60">
          Every piece here is cut from the 0.72.5 atlases. Classes carry game
          behaviour; scenery is set dressing the engine leaves in peace.
        </p>
      </div>
    </aside>
  )
}
