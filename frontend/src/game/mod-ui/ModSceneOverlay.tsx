import { useEffect, useState } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import type { LuaConsoleObject } from '../protocol/game-protocol.ts'
import './mod-scene-overlay.css'

export default function ModSceneOverlay({ session }: Readonly<{ session: GameClientSession }>) {
  const [runtime, setRuntime] = useState<LuaConsoleObject | null>(() => session.getModRuntime())
  useEffect(() => session.onModRuntime(setRuntime), [session])
  const ownerId = session.getSnapshot().run.runId ?? session.playerId
  const scene = rows(runtime?.scenes).find(row => row.owner_id === ownerId)
  if (!scene || typeof scene.scene_content_id !== 'string') return null
  const definition = session.getModContent()?.content.find(content => (
    content.contentId === scene.scene_content_id
  ))
  return (
    <section className="mod-scene-overlay" aria-label={definition?.name ?? 'Mod scene'}>
      <div className="mod-scene-overlay__room">
        <h2>{definition?.name ?? 'Dungeon'}</h2>
        <p>{definition?.description || 'An authored room beyond the Boneyard monument.'}</p>
        <button onClick={() => session.sendModAction(
          'scene-return',
          scene.scene_content_id as string,
        )}>Return to the Boneyard</button>
      </div>
    </section>
  )
}

function rows(value: unknown): LuaConsoleObject[] {
  return Array.isArray(value) ? value.filter((entry): entry is LuaConsoleObject => (
    Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
  )) : []
}
