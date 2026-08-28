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
  const spells = rows(runtime.spells)
  const snapshot = session.getSnapshot()
  const player = snapshot.players[session.playerId]
  const shops = rows(runtime.shops).filter(shop => mounted(shop, snapshot, session.playerId))
  const shopStock = rows(runtime.shop_stock)
  const equipment = player?.economy.backpack.find(item => item.kind === 'equipment')
  const nearMonument = player && session.getBoneyard()?.scene.objects.some(object => {
    const x = object.pos.x - player.position.x
    const y = object.pos.y - player.position.y
    return object.typeId === 2009 && x * x + y * y < 100 * 100
  })
  const portals = nearMonument ? rows(runtime.portals) : []
  if (spells.length + shops.length + portals.length === 0) return null
  return (
    <aside className="mod-panels" aria-label="Mod content">
      {spells.map(spell => (
        <button key={text(spell.content_id)} onClick={() => {
          const activePlayer = session.getSnapshot().players[session.playerId]
          if (activePlayer) session.castModSpell(text(spell.content_id), activePlayer.position)
        }}>{text(spell.name)}</button>
      ))}
      {shops.flatMap(shop => rows(shop.stock).map((stock, row) => {
        const state = shopStock.find(candidate => (
          candidate.shop_content_id === shop.content_id && candidate.row === row
        ))
        const remaining = state ? number(state.remaining) : number(stock.quantity)
        return (
          <button
            disabled={remaining < 1}
            key={`${text(shop.content_id)}:${row}`}
            onClick={() => session.sendModAction('shop-buy', text(shop.content_id), { row })}
          >{text(shop.name)} · {number(stock.price)} gold · {remaining} left</button>
        )
      }))}
      {equipment ? shops.flatMap(shop => rows(shop.services).map((service, index) => (
        <button key={`${text(shop.content_id)}:service:${index}`} onClick={() => session.sendModAction(
          'reforge',
          text(shop.content_id),
          { item_id: equipment.id, service: index },
        )}>{text(shop.name)} · Reforge · {number(service.price)} gold</button>
      ))) : null}
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

function mounted(
  shop: LuaConsoleObject,
  snapshot: ReturnType<GameClientSession['getSnapshot']>,
  playerId: string,
): boolean {
  const mount = object(shop.mount)
  const scene = text(mount.scene)
  if (scene === 'hub.courtyard') {
    if (snapshot.world.kind !== 'hub' || snapshot.world.participants[playerId]?.region !== 'courtyard') return false
  } else if (scene === 'boneyard' && snapshot.world.kind !== 'boneyard') return false
  const player = snapshot.players[playerId]
  if (!player || typeof mount.x !== 'number' || typeof mount.y !== 'number') {
    return scene.length === 0 || scene === 'hub.courtyard' || scene === 'boneyard'
  }
  const x = mount.x - player.position.x
  const y = mount.y - player.position.y
  const radius = number(mount.radius) || 120
  return x * x + y * y <= radius * radius
}

function object(value: unknown): LuaConsoleObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LuaConsoleObject
    : {}
}
