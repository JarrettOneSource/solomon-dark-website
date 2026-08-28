import { useEffect, useState } from 'react'

import { actorHeadingVector } from '../core-kernels/actor-heading.ts'
import type { GameClientSession } from '../client/game-client-session.ts'
import { gameContentUrl } from '../game-content-cache.ts'
import type { LuaConsoleObject } from '../protocol/game-protocol.ts'
import './mod-skill-quickbar.css'

export default function ModSkillQuickbar({ session }: Readonly<{ session: GameClientSession }>) {
  const [runtime, setRuntime] = useState<LuaConsoleObject | null>(() => session.getModRuntime())
  useEffect(() => session.onModRuntime(setRuntime), [session])
  const bindings = rows(runtime?.mod_quickbar).sort((left, right) => integer(left.slot) - integer(right.slot))
  const spells = new Map(rows(runtime?.spells).map(spell => [text(spell.content_id), spell]))
  const slots = bindings.flatMap(binding => {
    const spell = spells.get(text(binding.content_id))
    return spell ? [{ binding, spell }] : []
  })
  const cast = (spell: LuaConsoleObject) => {
    const player = session.getSnapshot().players[session.playerId]
    if (!player) return
    const heading = actorHeadingVector(player.headingIndex)
    session.castModSpell(text(spell.content_id), {
      x: player.position.x + heading.x * 300,
      y: player.position.y + heading.y * 300,
    })
  }
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return
      const slot = Number(event.key) - 1
      const selected = slots.find(row => integer(row.binding.slot) === slot)
      if (!selected) return
      event.preventDefault()
      cast(selected.spell)
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  })
  if (slots.length === 0) return null
  return (
    <nav className="mod-skill-quickbar" aria-label="Mod spell quickbar">
      {slots.map(({ binding, spell }) => {
        const asset = session.modAssets.find(candidate => (
          candidate.modId === spell.mod_id && candidate.path === spell.icon_path && candidate.kind === 'image'
        ))
        return (
          <button
            key={integer(binding.slot)}
            onClick={() => cast(spell)}
            title={`${text(spell.name)} (Shift+${integer(binding.slot) + 1})`}
          >
            {asset ? <img alt="" src={gameContentUrl(asset)} /> : null}
            <span>{integer(binding.slot) + 1}</span>
          </button>
        )
      })}
    </nav>
  )
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
