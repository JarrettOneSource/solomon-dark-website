import { useEffect, useState } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import { gameContentUrl } from '../game-content-cache.ts'
import type { LuaConsoleObject } from '../protocol/game-protocol.ts'
import './mod-skill-book.css'

export default function ModSkillBook({ session }: Readonly<{ session: GameClientSession }>) {
  const [runtime, setRuntime] = useState<LuaConsoleObject | null>(() => session.getModRuntime())
  useEffect(() => session.onModRuntime(setRuntime), [session])
  if (!runtime) return null
  const ranks = new Map(rows(runtime.skill_ranks).map(row => [text(row.content_id), integer(row.rank)]))
  const learned = rows(runtime.skills).filter(skill => (ranks.get(text(skill.content_id)) ?? 0) > 0)
  const spells = rows(runtime.spells)
  const bindings = rows(runtime.mod_quickbar)
  if (learned.length + spells.length === 0) return null
  return (
    <aside className="mod-skill-book" aria-label="Mod skills">
      <h2>Mod skills</h2>
      {learned.length === 0 ? <p>No mod skills learned yet.</p> : learned.map(skill => (
        <article
          key={text(skill.content_id)}
          data-subskill={Boolean(skill.parent_content_id)}
        >
          <Icon session={session} row={skill} />
          <strong>{text(skill.name)}</strong>
          <span>Rank {ranks.get(text(skill.content_id))} / {integer(skill.maximum_rank)}</span>
          <small>{text(skill.description)}</small>
        </article>
      ))}
      {spells.length > 0 ? <h3>Unlocked spells</h3> : null}
      {spells.map(spell => {
        const contentId = text(spell.content_id)
        const binding = bindings.find(row => row.content_id === contentId)
        const occupied = new Set(bindings.map(row => integer(row.slot)))
        const openSlot = Array.from({ length: 8 }, (_, slot) => slot).find(slot => !occupied.has(slot))
        return (
          <button key={contentId} disabled={!binding && openSlot === undefined} onClick={() => {
            const slot = binding ? integer(binding.slot) : openSlot!
            session.sendModAction('quickbar-bind', contentId, {
              ...(binding ? { clear: true } : {}),
              slot,
            })
          }}>
            <Icon session={session} row={spell} />
            <span>{text(spell.name)}</span>
            <small>{binding ? `Remove from slot ${integer(binding.slot) + 1}` : `Add to slot ${openSlot! + 1}`}</small>
          </button>
        )
      })}
    </aside>
  )
}

function Icon({ session, row }: Readonly<{ session: GameClientSession; row: LuaConsoleObject }>) {
  const asset = session.modAssets.find(candidate => (
    candidate.modId === row.mod_id && candidate.path === row.icon_path && candidate.kind === 'image'
  ))
  return asset ? <img alt="" src={gameContentUrl(asset)} /> : null
}

function rows(value: unknown): LuaConsoleObject[] {
  return Array.isArray(value) ? value.filter((entry): entry is LuaConsoleObject => (
    Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
  )) : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function integer(value: unknown): number {
  return Number.isSafeInteger(value) ? Number(value) : 0
}
