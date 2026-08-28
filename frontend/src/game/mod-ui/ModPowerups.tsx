import { useEffect, useRef, useState, type CSSProperties } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import { loadModGameAudioAsset } from '../game-audio-browser.ts'
import type { GameAudioDirector } from '../game-audio-director.ts'
import { gameContentUrl } from '../game-content-cache.ts'
import type { LuaConsoleObject } from '../protocol/game-protocol.ts'
import './mod-powerups.css'

export default function ModPowerups({
  audio,
  session,
}: Readonly<{ audio: GameAudioDirector; session: GameClientSession }>) {
  const [runtime, setRuntime] = useState<LuaConsoleObject | null>(() => session.getModRuntime())
  const heard = useRef(new Set<string>())
  useEffect(() => {
    const update = () => setRuntime(session.getModRuntime())
    const removeRuntime = session.onModRuntime(setRuntime)
    const removeSnapshot = session.onSnapshot(update)
    return () => { removeRuntime(); removeSnapshot() }
  }, [session])
  const snapshot = session.getSnapshot()
  useEffect(() => {
    for (const event of rows(runtime?.powerup_events)) {
      const path = text(event.sound_path)
      const asset = session.modAssets.find(candidate => (
        candidate.modId === event.mod_id && candidate.path === path && candidate.kind === 'audio'
      ))
      const key = `${integer(event.id)}:${integer(event.tick)}`
      if (!asset || heard.current.has(key) || snapshot.tick - integer(event.tick) > 20) continue
      heard.current.add(key)
      const source = gameContentUrl(asset)
      void loadModGameAudioAsset(source).then(() => audio.playAsset(source, {
        volume: finite(event.sound_volume),
      }), () => undefined)
    }
  }, [audio, runtime, session.modAssets, snapshot.tick])
  const scene = document.querySelector<HTMLElement>('.boneyard-scene')
  const player = snapshot.players[session.playerId]
  if (!runtime || !scene || !player) return null
  const rect = scene.getBoundingClientRect()
  const zoom = numeric(scene.dataset.cameraZoom, 1)
  const originX = rect.left + numeric(scene.dataset.localPlayerScreenX, rect.width / 2)
  const originY = rect.top + numeric(scene.dataset.localPlayerScreenY, rect.height / 2)
  const position = (row: LuaConsoleObject) => ({
    left: originX + (finite(row.x) - player.position.x) * zoom,
    top: originY + (finite(row.y) - player.position.y) * zoom,
  })
  return (
    <div className="mod-powerups" aria-hidden="true">
      {rows(runtime.powerup_actors).map((actor) => {
        const asset = session.modAssets.find(candidate => (
          candidate.modId === actor.mod_id && candidate.path === actor.image_path && candidate.kind === 'image'
        ))
        if (!asset) return null
        const frameWidth = finite(actor.frame_width)
        const frameHeight = finite(actor.frame_height)
        const scale = Math.min(1, 72 / Math.max(frameWidth, frameHeight)) * zoom
        const place = position(actor)
        const style: CSSProperties = {
          backgroundImage: `url(${JSON.stringify(gameContentUrl(asset))})`,
          backgroundPosition: `${-finite(actor.frame_x) * scale}px ${-finite(actor.frame_y) * scale}px`,
          backgroundSize: `${finite(actor.image_width) * scale}px ${finite(actor.image_height) * scale}px`,
          height: frameHeight * scale,
          left: place.left,
          top: place.top,
          width: frameWidth * scale,
        }
        return <span className="mod-powerup" data-powerup-id={integer(actor.id)} key={integer(actor.id)} style={style} />
      })}
      {rows(runtime.powerup_events).map((event) => {
        const place = position(event)
        return <i className="mod-powerup-pickup" key={`${integer(event.id)}:${integer(event.tick)}`} style={place} />
      })}
    </div>
  )
}

function rows(value: unknown): LuaConsoleObject[] {
  return Array.isArray(value) ? value.filter((entry): entry is LuaConsoleObject => (
    Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
  )) : []
}

function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function integer(value: unknown): number { return Number.isSafeInteger(value) ? Number(value) : 0 }
function finite(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0 }
function numeric(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
