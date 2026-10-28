import { useEffect, useState } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'
import { projectModMinimap, type ModMinimapModel } from './mod-minimap.ts'
import './mod-minimap.css'

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
    <section
      className="mod-minimap"
      aria-label={model.accessibleName}
      data-interactive={model.actions.length > 0}
      data-mount={model.mount}
      style={{ height: model.size.height, width: model.size.width }}
    >
      {model.markers.map(marker => (
        <span
          className={`mod-minimap__marker mod-minimap__marker--${marker.kind}`}
          key={`${marker.kind}:${marker.id}`}
          style={{
            left: `${50 + clamp(marker.x - model.center.x, model.range) / model.range * 50}%`,
            top: `${50 + clamp(marker.y - model.center.y, model.range) / model.range * 50}%`,
          }}
        />
      ))}
      {Object.entries(model.bindings).map(([name, value]) => (
        <output key={name}>{name}: {String(value)}</output>
      ))}
      {model.actions.map(action => (
        <button key={action} onClick={() => session.sendModAction('ui-action', model.contentId, {
          action,
          arguments: { x: model.center.x, y: model.center.y },
        })}>{action}</button>
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

function clamp(value: number, range: number): number {
  return Math.max(-range, Math.min(range, value))
}
