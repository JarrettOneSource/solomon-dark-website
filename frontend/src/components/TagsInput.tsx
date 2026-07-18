import { useState } from 'react'
import { TagBadge } from './ui'

export const MAX_TAGS = 5

/** Client-side mirror of the backend's filing rules (ModEndpoints tag helpers):
 * lowercase, whitespace collapsed, 2–24 chars of letters/numbers/spaces/hyphens,
 * starting and ending on a letter or digit. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function tagProblem(tag: string): string | null {
  return /^[a-z0-9][a-z0-9 -]{0,22}[a-z0-9]$/.test(tag)
    ? null
    : 'Tags are 2–24 plain characters — letters, numbers, spaces, hyphens.'
}

/** Chip editor for a tome's tags: type and press Enter (or comma) to file,
 * click a chip's ✕ to unfile, click a suggestion to take it as-is. */
export default function TagsInput({
  tags,
  onChange,
  suggestions = [],
  disabled,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = (raw: string) => {
    const tag = normalizeTag(raw)
    if (!tag) return
    if (tags.includes(tag)) {
      setDraft('')
      return
    }
    if (tags.length >= MAX_TAGS) {
      setError('A tome carries at most five tags. The Librarian’s patience is finite.')
      return
    }
    const problem = tagProblem(tag)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setDraft('')
    onChange([...tags, tag])
  }

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag))

  const open = suggestions.filter((s) => !tags.includes(s)).slice(0, 10)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="badge badge-gold">
            {tag}
            <button
              type="button"
              aria-label={`Unfile ${tag}`}
              disabled={disabled}
              className="text-gold/60 transition-colors hover:text-blood"
              onClick={() => remove(tag)}
            >
              ✕
            </button>
          </span>
        ))}
        {tags.length < MAX_TAGS && (
          <input
            className="input !w-44 !py-1.5 text-sm"
            value={draft}
            disabled={disabled}
            placeholder={tags.length === 0 ? 'boneyard, spells, interface…' : 'add another…'}
            onChange={(e) => {
              setDraft(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                add(draft)
              } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
                remove(tags[tags.length - 1])
              }
            }}
            onBlur={() => {
              if (draft.trim()) add(draft)
            }}
          />
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-[#f0b9b9]">{error}</p>}
      {open.length > 0 && tags.length < MAX_TAGS && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-bone-dim/60">
            From the index:
          </span>
          {open.map((s) => (
            <TagBadge key={s} tag={s} title="File under this tag" onClick={() => add(s)} />
          ))}
        </div>
      )}
    </div>
  )
}
