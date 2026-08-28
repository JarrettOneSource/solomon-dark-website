import { useEffect, useState } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import type { LuaConsoleObject } from '../protocol/game-protocol.ts'
import {
  color,
  number,
  projectModScene,
} from './mod-scene-model.ts'
import './mod-scene-overlay.css'

export default function ModSceneOverlay({ session }: Readonly<{ session: GameClientSession }>) {
  const [runtime, setRuntime] = useState<LuaConsoleObject | null>(() => session.getModRuntime())
  useEffect(() => session.onModRuntime(setRuntime), [session])
  const ownerId = session.getSnapshot().run.runId ?? session.playerId
  const scene = projectModScene(runtime, ownerId)
  if (!scene) return null
  const room = scene.rooms[scene.roomIndex]!
  const party = Object.entries(session.getSnapshot().players)
  return (
    <section
      className="mod-scene-overlay"
      aria-label={room.name}
      data-room-index={scene.roomIndex}
      data-scene-content-id={scene.contentId}
    >
      <header>
        <div>
          <h2>{room.name}</h2>
          {room.description ? <p>{room.description}</p> : null}
        </div>
        <span>Room {scene.roomIndex + 1} / {scene.rooms.length}</span>
      </header>
      <div className="mod-scene-overlay__viewport">
        <svg viewBox={`0 0 ${room.width} ${room.height}`} role="img" aria-label={`${room.name} map`}>
          <rect width={room.width} height={room.height} fill={room.floor} />
          <rect x="4" y="4" width={room.width - 8} height={room.height - 8} fill="none" stroke="#8b7b9d" strokeWidth="8" />
          {room.walls.map((wall, index) => (
            <rect
              fill={color(wall.color, '#51465f')}
              height={Math.max(4, number(wall.height, 24))}
              key={`wall-${index}`}
              width={Math.max(4, number(wall.width, 80))}
              x={number(wall.x)}
              y={number(wall.y)}
            />
          ))}
          {room.props.map((prop, index) => (
            <g key={`prop-${index}`} transform={`translate(${number(prop.x, room.width / 2)} ${number(prop.y, room.height / 2)})`}>
              <circle fill={color(prop.color, '#a68bc6')} r={Math.max(8, number(prop.radius, 18))} />
              <text y="34">{typeof prop.label === 'string' ? prop.label : typeof prop.kind === 'string' ? prop.kind : 'prop'}</text>
            </g>
          ))}
          {party.map(([playerId, player], index) => (
            <g key={playerId} transform={`translate(${room.width / 2 + (index - (party.length - 1) / 2) * 44} ${room.height * .72})`}>
              <circle className="mod-scene-overlay__wizard" r="16" />
              <text y="32">{player.config.displayName}</text>
            </g>
          ))}
        </svg>
      </div>
      <footer>
        <button
          disabled={!session.isHost || scene.roomIndex === 0}
          onClick={() => session.sendModAction('scene-room', scene.contentId, {
            room: scene.roomIndex - 1,
          })}
        >Previous room</button>
        <button
          disabled={!session.isHost || scene.roomIndex + 1 >= scene.rooms.length}
          onClick={() => session.sendModAction('scene-room', scene.contentId, {
            room: scene.roomIndex + 1,
          })}
        >Next room</button>
        <button
          disabled={!session.isHost}
          onClick={() => session.sendModAction('scene-return', scene.contentId)}
        >Return to the Boneyard</button>
      </footer>
      {!session.isHost ? <p className="mod-scene-overlay__waiting">Waiting for the party leader…</p> : null}
    </section>
  )
}
