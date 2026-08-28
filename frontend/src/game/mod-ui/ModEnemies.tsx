import { useEffect, useRef, useState, type CSSProperties } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import { loadModGameAudioAsset } from '../game-audio-browser.ts'
import type { GameAudioDirector } from '../game-audio-director.ts'
import { projectModEnemies, type ModEnemyModel } from './mod-enemies.ts'
import './mod-enemies.css'

interface EnemyView {
  readonly enemy: ModEnemyModel
  readonly left: number
  readonly spriteScale: number
  readonly top: number
}

export default function ModEnemies({
  audio,
  session,
}: Readonly<{ audio: GameAudioDirector; session: GameClientSession }>) {
  const [views, setViews] = useState<readonly EnemyView[]>([])
  const heard = useRef(new Set<string>())
  useEffect(() => {
    let active = true
    const update = () => {
      const snapshot = session.getSnapshot()
      const enemies = projectModEnemies(session.getModRuntime(), session.modAssets)
      for (const enemy of enemies) {
        if (!enemy.soundUrl || enemy.soundEventTick === null || snapshot.tick - enemy.soundEventTick > 20) continue
        const key = `${enemy.id}:${enemy.soundEventTick}:${enemy.soundUrl}`
        if (heard.current.has(key)) continue
        heard.current.add(key)
        void loadModGameAudioAsset(enemy.soundUrl).then(() => {
          if (active) audio.playAsset(enemy.soundUrl!, { volume: enemy.soundVolume })
        }, () => undefined)
      }
      if (heard.current.size > 4_096) heard.current.clear()
      setViews(layout(enemies, session))
    }
    const removeRuntime = session.onModRuntime(update)
    const removeSnapshot = session.onSnapshot(update)
    window.addEventListener('resize', update)
    update()
    return () => {
      active = false
      removeRuntime()
      removeSnapshot()
      window.removeEventListener('resize', update)
    }
  }, [audio, session])
  if (views.length === 0) return null
  return (
    <div className="mod-enemies" aria-hidden="true">
      {views.map(({ enemy, left, spriteScale, top }) => {
        const style: CSSProperties = {
          backgroundImage: `url(${JSON.stringify(enemy.imageUrl)})`,
          backgroundPosition: `${-enemy.frame.x * spriteScale}px ${-enemy.frame.y * spriteScale}px`,
          backgroundSize: `${enemy.imageWidth * spriteScale}px ${enemy.imageHeight * spriteScale}px`,
          filter: `drop-shadow(0 0 ${Math.max(4, enemy.lightRadius / 10)}px #${enemy.lightColor.toString(16).padStart(6, '0')})`,
          height: enemy.frame.height * spriteScale,
          left,
          top,
          width: enemy.frame.width * spriteScale,
          zIndex: Math.round(top),
        }
        return (
          <div
            className="mod-enemy"
            data-enemy-id={enemy.id}
            data-life-state={enemy.lifeState}
            key={enemy.id}
            style={style}
          >
            <span className="mod-enemy__name">{enemy.name}</span>
            <span className="mod-enemy__health"><i style={{
              width: `${enemy.currentHealth / enemy.maximumHealth * 100}%`,
            }} /></span>
          </div>
        )
      })}
    </div>
  )
}

function layout(enemies: readonly ModEnemyModel[], session: GameClientSession): readonly EnemyView[] {
  const snapshot = session.getSnapshot()
  const player = snapshot.players[session.playerId]
  const scene = document.querySelector<HTMLElement>('.boneyard-scene')
  if (!player || !scene) return []
  const rect = scene.getBoundingClientRect()
  const zoom = numeric(scene.dataset.cameraZoom, 1)
  const playerScreenX = numeric(scene.dataset.localPlayerScreenX, rect.width / 2)
  const playerScreenY = numeric(scene.dataset.localPlayerScreenY, rect.height / 2)
  return Object.freeze(enemies.map(enemy => Object.freeze({
    enemy,
    left: rect.left + playerScreenX + (enemy.x - player.position.x) * zoom,
    spriteScale: Math.min(1, 128 / Math.max(enemy.frame.width, enemy.frame.height)) * enemy.scale * zoom,
    top: rect.top + playerScreenY + (enemy.y - player.position.y) * zoom,
  })))
}

function numeric(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
