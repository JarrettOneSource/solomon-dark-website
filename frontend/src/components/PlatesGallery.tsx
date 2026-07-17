import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '../fx/sounds'

export type Plate = { id: number; url: string }

function Arrow({
  dir,
  onClick,
  className = '',
}: {
  dir: -1 | 1
  onClick: (e: React.MouseEvent) => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={dir === 1 ? 'Next plate' : 'Previous plate'}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-black/60 pb-0.5 font-display text-xl leading-none text-gold backdrop-blur-sm transition-all hover:border-gold/70 hover:text-gold-bright hover:shadow-[0_0_14px_rgba(200,168,98,.35)] ${className}`}
    >
      {dir === 1 ? '›' : '‹'}
    </button>
  )
}

/** The illustrations bound into a tome: framed carousel + lightbox for close study. */
export default function PlatesGallery({ plates, name }: { plates: Plate[]; name: string }) {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const touchX = useRef<number | null>(null)
  const activeThumb = useRef<HTMLButtonElement | null>(null)

  const count = plates.length
  // The owner can delete plates while viewing; never point past the end.
  const i = count > 0 ? Math.min(index, count - 1) : 0

  const go = useCallback(
    (delta: number) =>
      setIndex((current) => (Math.min(current, count - 1) + delta + count) % count),
    [count],
  )

  useEffect(() => {
    if (count < 2) return
    for (const n of [(i + 1) % count, (i - 1 + count) % count]) {
      const img = new Image()
      img.src = plates[n].url
    }
  }, [i, count, plates])

  useEffect(() => {
    activeThumb.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [i])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, go])

  if (count === 0) return null
  const plate = plates[i]

  return (
    <div>
      <figure
        tabIndex={0}
        aria-label={`${name} — plate ${i + 1} of ${count}`}
        onKeyDown={(e) => {
          if (open) return // the lightbox's window listener owns the keys
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            go(1)
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            go(-1)
          }
        }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        }}
        className="relative m-0 overflow-hidden rounded border border-gold/25 bg-[#08070c] shadow-[inset_0_0_50px_rgba(0,0,0,.7),0_10px_30px_rgba(0,0,0,.45)]"
      >
        <button
          type="button"
          aria-label="Study this plate up close"
          onClick={() => {
            setOpen(true)
            playSound('attune', 0.12)
          }}
          className="block w-full cursor-zoom-in"
        >
          <img
            key={plate.id}
            src={plate.url}
            alt={`${name} — plate ${i + 1}`}
            className="aspect-video w-full object-contain [animation:plate-in_.35s_ease_both]"
          />
        </button>
        <div className="pointer-events-none absolute inset-[6px] rounded-sm border border-gold/15" />
        {count > 1 && (
          <>
            <Arrow
              dir={-1}
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
            />
            <Arrow
              dir={1}
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
            />
            <figcaption className="absolute bottom-2.5 right-3 rounded border border-gold/25 bg-black/70 px-2 py-0.5 font-mono text-[11px] text-bone-dim backdrop-blur-sm">
              {i + 1} / {count}
            </figcaption>
          </>
        )}
      </figure>

      {count > 1 && (
        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1.5">
          {plates.map((p, n) => (
            <button
              key={p.id}
              type="button"
              ref={n === i ? activeThumb : undefined}
              onClick={() => setIndex(n)}
              aria-label={`Plate ${n + 1}`}
              aria-current={n === i}
              className={`h-16 w-28 flex-none overflow-hidden rounded border transition-all ${
                n === i
                  ? 'border-gold/80 shadow-[0_0_12px_rgba(200,168,98,.35)]'
                  : 'border-gold/15 opacity-50 hover:opacity-90'
              }`}
            >
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Portaled: an ancestor's reveal animation would otherwise trap position:fixed. */}
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${name} — plate ${i + 1} of ${count}`}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm sm:p-10"
          >
            <img
              key={plate.id}
              src={plate.url}
              alt={`${name} — plate ${i + 1}`}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded border border-gold/30 object-contain shadow-[0_0_80px_rgba(0,0,0,.9)] [animation:plate-in_.25s_ease_both]"
            />
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-black/60 font-display text-lg leading-none text-bone-dim transition-colors hover:border-blood/60 hover:text-blood"
            >
              ✕
            </button>
            {count > 1 && (
              <>
                <Arrow
                  dir={-1}
                  onClick={(e) => {
                    e.stopPropagation()
                    go(-1)
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                />
                <Arrow
                  dir={1}
                  onClick={(e) => {
                    e.stopPropagation()
                    go(1)
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                />
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded border border-gold/25 bg-black/70 px-2.5 py-1 font-mono text-xs text-bone-dim">
                  {i + 1} / {count}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
