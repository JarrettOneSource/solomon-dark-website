import { useEffect, useState } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import { gameContentUrl } from '../game-content-cache.ts'
import type { LuaConsoleObject } from '../protocol/game-protocol.ts'
import './mod-shop-npcs.css'

export default function ModShopNpcs({ session }: Readonly<{ session: GameClientSession }>) {
  const [runtime, setRuntime] = useState<LuaConsoleObject | null>(() => session.getModRuntime())
  useEffect(() => {
    const update = () => setRuntime(session.getModRuntime())
    const removeRuntime = session.onModRuntime(setRuntime)
    const removeSnapshot = session.onSnapshot(update)
    return () => { removeRuntime(); removeSnapshot() }
  }, [session])
  const scene = document.querySelector<HTMLElement>('.boneyard-scene, .hub-scene')
  const snapshot = session.getSnapshot()
  const player = snapshot.players[session.playerId]
  if (!runtime || !scene || !player) return null
  const rect = scene.getBoundingClientRect()
  const zoom = numeric(scene.dataset.cameraZoom, 1)
  const originX = rect.left + numeric(scene.dataset.localPlayerScreenX, rect.width / 2)
  const originY = rect.top + numeric(scene.dataset.localPlayerScreenY, rect.height / 2)
  const shops = rows(runtime.shops).flatMap((shop) => {
    const mount = object(shop.mount)
    if (mount.scene === 'hub.courtyard' && (
      snapshot.world.kind !== 'hub' || snapshot.world.participants[session.playerId]?.region !== 'courtyard'
    )) return []
    if (mount.scene === 'boneyard' && snapshot.world.kind !== 'boneyard') return []
    if (typeof mount.x !== 'number' || typeof mount.y !== 'number') return []
    const icon = session.modAssets.find(asset => (
      asset.modId === shop.mod_id && asset.path === shop.icon_path && asset.kind === 'image'
    ))
    const npc = object(shop.npc)
    return [{
      icon: icon ? gameContentUrl(icon) : null,
      left: originX + (mount.x - player.position.x) * zoom,
      name: text(npc.name) || text(shop.name),
      top: originY + (mount.y - player.position.y) * zoom,
    }]
  })
  if (shops.length === 0) return null
  return (
    <div className="mod-shop-npcs" aria-hidden="true">
      {shops.map(shop => (
        <div key={shop.name} style={{ left: shop.left, top: shop.top }}>
          {shop.icon ? <img alt="" src={shop.icon} /> : <i />}
          <span>{shop.name}</span>
        </div>
      ))}
    </div>
  )
}

function rows(value: unknown): LuaConsoleObject[] {
  return Array.isArray(value) ? value.filter((entry): entry is LuaConsoleObject => (
    Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
  )) : []
}

function object(value: unknown): LuaConsoleObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as LuaConsoleObject : {}
}

function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function numeric(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
