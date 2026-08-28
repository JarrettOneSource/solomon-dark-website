import { useEffect, useRef, useState, type CSSProperties } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import { loadModGameAudioAsset } from '../game-audio-browser.ts'
import type { GameAudioDirector } from '../game-audio-director.ts'
import { projectModSpellEffects, type ModSpellEffectModel } from './mod-spell-effects.ts'
import './mod-spell-effects.css'

interface EffectView {
  readonly effect: ModSpellEffectModel
  readonly left: number
  readonly spriteScale: number
  readonly top: number
  readonly zoom: number
}

export default function ModSpellEffects({
  audio,
  session,
}: Readonly<{ audio: GameAudioDirector; session: GameClientSession }>) {
  const [views, setViews] = useState<readonly EffectView[]>([])
  const seenAudio = useRef(new Set<number>())

  useEffect(() => {
    let active = true
    const update = () => {
      const snapshot = session.getSnapshot()
      const effects = projectModSpellEffects(session.getModRuntime(), session.modAssets)
      for (const effect of effects) {
        if (seenAudio.current.has(effect.id)) continue
        seenAudio.current.add(effect.id)
        if (!effect.soundUrl || snapshot.tick - effect.startedTick > 20) continue
        void loadModGameAudioAsset(effect.soundUrl).then(() => {
          if (active) audio.playAsset(effect.soundUrl!, { volume: effect.soundVolume })
        }, () => undefined)
      }
      if (seenAudio.current.size > 4_096) {
        const live = new Set(effects.map(effect => effect.id))
        seenAudio.current = new Set([...seenAudio.current].filter(id => live.has(id)))
      }
      setViews(layout(effects, session))
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
    <div className="mod-spell-effects" aria-hidden="true">
      {views.map(view => (
        <Effect key={view.effect.id} view={view} />
      ))}
    </div>
  )
}

function Effect({ view }: Readonly<{ view: EffectView }>) {
  const { effect, left, spriteScale, top, zoom } = view
  const spriteStyle: CSSProperties = {
    backgroundImage: `url(${JSON.stringify(effect.imageUrl)})`,
    backgroundPosition: `${-effect.frame.x * spriteScale}px ${-effect.frame.y * spriteScale}px`,
    backgroundSize: `${effect.imageWidth * spriteScale}px ${effect.imageHeight * spriteScale}px`,
    height: effect.frame.height * spriteScale,
    left,
    top,
    width: effect.frame.width * spriteScale,
  }
  const channelDx = (effect.targetX - effect.x) * zoom
  const channelDy = (effect.targetY - effect.y) * zoom
  return (
    <div className="mod-spell-effect" data-effect-id={effect.id} data-kind={effect.kind}>
      {effect.kind === 'area' ? (
        <span className="mod-spell-effect__area" style={{
          height: effect.radius * 2 * zoom,
          left,
          top,
          width: effect.radius * 2 * zoom,
        }} />
      ) : null}
      {effect.kind === 'channel' ? (
        <span className="mod-spell-effect__channel" style={{
          height: Math.max(4, effect.radius * 2 * zoom),
          left,
          top,
          transform: `translateY(-50%) rotate(${Math.atan2(channelDy, channelDx)}rad)`,
          width: Math.hypot(channelDx, channelDy),
        }} />
      ) : null}
      <span className="mod-spell-effect__sprite" style={spriteStyle} />
    </div>
  )
}

function layout(
  effects: readonly ModSpellEffectModel[],
  session: GameClientSession,
): readonly EffectView[] {
  const snapshot = session.getSnapshot()
  const player = snapshot.players[session.playerId]
  const scene = document.querySelector<HTMLElement>('.boneyard-scene, .hub-scene')
  if (!player || !scene) return []
  const rect = scene.getBoundingClientRect()
  const zoom = numeric(scene.dataset.cameraZoom, 1)
  const playerScreenX = numeric(scene.dataset.localPlayerScreenX, rect.width / 2)
  const playerScreenY = numeric(scene.dataset.localPlayerScreenY, rect.height / 2)
  return Object.freeze(effects.map(effect => {
    const maximumFrame = Math.max(effect.frame.width, effect.frame.height)
    return Object.freeze({
      effect,
      left: rect.left + playerScreenX + (effect.x - player.position.x) * zoom,
      spriteScale: Math.min(1, 96 / maximumFrame) * zoom,
      top: rect.top + playerScreenY + (effect.y - player.position.y) * zoom,
      zoom,
    })
  }))
}

function numeric(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
