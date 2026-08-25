import { useEffect, useState } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import type { LuaConsoleObject } from '../protocol/game-protocol.ts'
import './mod-panels.css'

export default function ModPanels({ session }: Readonly<{ session: GameClientSession }>) {
  const [runtime, setRuntime] = useState<LuaConsoleObject | null>(() => session.getModRuntime())
  useEffect(() => {
    const removeRuntime = session.onModRuntime(setRuntime)
    const removeSnapshot = session.onSnapshot(() => {
      const value = session.getModRuntime()
      setRuntime(value ? { ...value } : null)
    })
    return () => {
      removeRuntime()
      removeSnapshot()
    }
  }, [session])
  if (!runtime) return null
  const offeredSkills = new Set(rows(runtime.skill_offers).flatMap(offer => strings(offer.content_ids)))
  const skills = rows(runtime.skills).filter(skill => offeredSkills.has(text(skill.content_id)))
  const spells = rows(runtime.spells)
  const shops = rows(runtime.shops)
  const snapshot = session.getSnapshot()
  const player = snapshot.players[session.playerId]
  const nearMonument = player && session.getBoneyard()?.scene.objects.some(object => {
    const x = object.pos.x - player.position.x
    const y = object.pos.y - player.position.y
    return object.typeId === 2009 && x * x + y * y < 100 * 100
  })
  const portals = nearMonument ? rows(runtime.portals) : []
  if (skills.length + spells.length + shops.length + portals.length === 0) return null
  return (
    <aside className="mod-panels" aria-label="Mod content">
      {skills.map(skill => (
        <button key={text(skill.content_id)} onClick={() => session.sendModAction(
          'skill-choose',
          text(skill.content_id),
        )}>{text(skill.name)}</button>
      ))}
      {spells.map(spell => (
        <button key={text(spell.content_id)} onClick={() => {
          const activePlayer = session.getSnapshot().players[session.playerId]
          if (activePlayer) session.castModSpell(text(spell.content_id), activePlayer.position)
        }}>{text(spell.name)}</button>
      ))}
      {shops.flatMap(shop => rows(shop.stock).map((stock, row) => (
        <button key={`${text(shop.content_id)}:${row}`} onClick={() => session.sendModAction(
          'shop-buy',
          text(shop.content_id),
          { row },
        )}>{text(shop.name)} · {number(stock.price)} gold</button>
      )))}
      {portals.map(portal => (
        <button key={text(portal.id)} onClick={() => session.sendModAction(
          'portal-enter',
          text(portal.id),
        )}>{text(portal.prompt)}</button>
      ))}
    </aside>
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

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}
