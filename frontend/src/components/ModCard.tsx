import { Link, useNavigate } from 'react-router-dom'
import type { ModSummary } from '../lib/api'
import { formatCount, timeAgo } from '../lib/format'
import { art, elementWords } from '../lib/assets'
import { TagBadge } from './ui'

export default function ModCard({ mod }: { mod: ModSummary }) {
  const navigate = useNavigate()
  // Two wide chips crush the byline, so a long pair shows one chip + count.
  const shownTags =
    (mod.tags[0]?.length ?? 0) + (mod.tags[1]?.length ?? 0) > 18
      ? mod.tags.slice(0, 1)
      : mod.tags.slice(0, 2)
  return (
    <Link
      to={`/mods/${mod.slug}`}
      className="panel group block overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/45 hover:shadow-[0_0_24px_rgba(200,168,98,.12),0_10px_30px_rgba(0,0,0,.45)]"
    >
      <div className="relative flex aspect-[16/8] items-center justify-center overflow-hidden border-b border-gold/10 bg-[#0b0910]">
        {mod.thumbnailUrl ? (
          <img
            src={mod.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <img
            src={art.skullGold}
            alt=""
            className="h-14 opacity-25 transition-opacity group-hover:opacity-40"
          />
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-[15px] font-bold leading-snug tracking-wide text-bone group-hover:text-gold-bright">
            {mod.name}
          </h3>
          <span className="flex flex-none items-center gap-1 font-mono text-[11px] text-bone-dim">
            <span className="text-gold/70">↓</span>
            {formatCount(mod.downloads)}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 min-h-[2.4em] text-[13px] leading-snug text-bone-dim">
          {mod.summary}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-bone-dim/80">
            <span className="truncate">
              by{' '}
              {/* a real <a> can't nest inside the card's Link */}
              <span
                role="link"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  navigate(`/wizards/${encodeURIComponent(mod.author.username)}`)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    navigate(`/wizards/${encodeURIComponent(mod.author.username)}`)
                  }
                }}
                className="cursor-pointer text-gold/80 hover:text-gold-bright hover:underline"
              >
                {mod.author.username}
              </span>
            </span>
            {mod.author.school && (
              <img
                src={elementWords[mod.author.school]}
                alt={mod.author.school}
                title={`School of ${mod.author.school}`}
                className="h-3.5 flex-none"
              />
            )}
            <span className="flex-none text-bone-dim/50">{timeAgo(mod.updatedAtUtc)}</span>
          </span>
          {shownTags.length > 0 && (
            <span className="flex flex-none items-center gap-1">
              {shownTags.map((tag) => (
                <TagBadge
                  key={tag}
                  tag={tag}
                  title={`Everything filed under ${tag}`}
                  onClick={(e) => {
                    // chips live inside the card's Link — don't open the tome
                    e.preventDefault()
                    e.stopPropagation()
                    navigate(`/mods?tag=${encodeURIComponent(tag)}`)
                  }}
                />
              ))}
              {mod.tags.length > shownTags.length && (
                <span className="font-mono text-[10px] text-bone-dim/50">
                  +{mod.tags.length - shownTags.length}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
