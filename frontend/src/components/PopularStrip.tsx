import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { formatCount } from '../lib/format'
import { art } from '../lib/assets'

const WINDOWS = [30, 60, 90] as const
type PopularWindow = (typeof WINDOWS)[number]

/** The circulation desk: which tomes left the shelves most, lately, with a
 * 30/60/90-day ledger. Renders nothing until the ledger has entries, so pages
 * can mount it unconditionally. */
export default function PopularStrip({
  action,
  className,
}: {
  action?: ReactNode
  className?: string
}) {
  const [days, setDays] = useState<PopularWindow>(30)
  const popular = useApi(() => api.mods.popular(days), [days])

  // useApi keeps the previous window's data during reloads — no flicker.
  const shown = popular.data
  if (!shown || shown.items.length === 0) return null

  return (
    <section className={className}>
      <Reveal>
        <div className="panel panel-ornate p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div>
              <div className="kicker">The circulation desk</div>
              <h2 className="h-display text-lg">In Heavy Circulation</h2>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <div
                className="flex overflow-hidden rounded border border-gold/25"
                role="group"
                aria-label="Popularity window"
              >
                {WINDOWS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setDays(w)}
                    aria-pressed={days === w}
                    className={`px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                      days === w
                        ? 'bg-gold/15 text-gold-bright shadow-[inset_0_0_10px_rgba(200,168,98,.15)]'
                        : 'text-bone-dim hover:bg-gold/5 hover:text-bone'
                    }`}
                  >
                    {w} days
                  </button>
                ))}
              </div>
              {action}
            </div>
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-1.5">
            {shown.items.map((m, i) => (
              <Link key={m.id} to={`/mods/${m.slug}`} className="group w-44 flex-none">
                <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded border border-gold/15 bg-[#0b0910] transition-colors group-hover:border-gold/40">
                  {m.thumbnailUrl ? (
                    <img
                      src={m.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <img src={art.skullGold} alt="" className="h-8 opacity-25" />
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-gold shadow-[0_1px_4px_rgba(0,0,0,.6)]">
                    №{i + 1}
                  </span>
                </div>
                <div className="mt-2 truncate font-display text-[13px] font-bold tracking-wide text-bone group-hover:text-gold-bright">
                  {m.name}
                </div>
                <div className="font-mono text-[11px] text-bone-dim">
                  ↓ {formatCount(m.recentDownloads ?? 0)} · past {shown.days}d
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}
