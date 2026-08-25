import { useEffect, useState } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'
import { projectModMinimap, type ModMinimapModel } from './mod-minimap.ts'
import './mod-minimap.css'

const RANGE = 500

export default function ModMinimap({ session }: Readonly<{ session: GameClientSession }>) {
  const [model, setModel] = useState<ModMinimapModel | null>(() => project(
    session,
    session.getSnapshot(),
  ))
  useEffect(() => {
    const update = (snapshot: GameSnapshot) => setModel(project(session, snapshot))
    const removeSnapshot = session.onSnapshot(update)
    const removeMods = session.onModContent(() => update(session.getSnapshot()))
    const removeRuntime = session.onModRuntime(() => update(session.getSnapshot()))
    update(session.getSnapshot())
    return () => {
      removeMods()
      removeRuntime()
      removeSnapshot()
    }
  }, [session])
  if (!model) return null
  return (
    <section className="mod-minimap" aria-label={model.accessibleName}>
      {model.markers.map(marker => (
        <span
          className={`mod-minimap__marker mod-minimap__marker--${marker.kind}`}
          key={`${marker.kind}:${marker.id}`}
          style={{
            left: `${50 + clamp(marker.x - model.center.x) / RANGE * 50}%`,
            top: `${50 + clamp(marker.y - model.center.y) / RANGE * 50}%`,
          }}
        />
      ))}
    </section>
  )
}

function project(session: GameClientSession, snapshot: GameSnapshot): ModMinimapModel | null {
  const mods = session.getModContent()
  return mods ? projectModMinimap(
    snapshot,
    mods,
    session.playerId,
    session.getModRuntime(),
  ) : null
}

function clamp(value: number): number {
  return Math.max(-RANGE, Math.min(RANGE, value))
}
