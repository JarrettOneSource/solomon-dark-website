import { useCallback, useEffect, useState } from 'react'
import { loadLoaderAssets, loadResidentGameAssets } from '../game/game-assets'
import { bootGame, type GameSession } from '../game/engine.ts'
import type { PlayerCharacterConfig } from '../game/core-kernels/player-character.ts'
import { resolveGameEndpoint } from '../game/game-bootstrap.ts'
import MainMenuScene from '../game/MainMenuScene'
import NativeLoader from '../game/NativeLoader'

type Readiness = 'loader' | 'assets' | 'ready'

export default function Game() {
  const [readiness, setReadiness] = useState<Readiness>('loader')
  const [progress, setProgress] = useState(0)
  const [fatal, setFatal] = useState<string | null>(null)

  useEffect(() => {
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)

    const previousOverflow = document.body.style.overflow
    const previousTitle = document.title
    document.body.style.overflow = 'hidden'
    document.title = 'Solomon Dark'

    return () => {
      robots.remove()
      document.body.style.overflow = previousOverflow
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadLoaderAssets().then(() => {
      if (!cancelled) setReadiness('assets')
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (readiness !== 'assets') return
    let cancelled = false
    void loadResidentGameAssets(({ completed, total }) => {
      if (!cancelled) setProgress(total === 0 ? 1 : completed / total)
    }).then(() => {
      if (!cancelled) setReadiness('ready')
    })
    return () => { cancelled = true }
  }, [readiness])

  const connectSession = useCallback(async (
    character: PlayerCharacterConfig,
  ): Promise<GameSession> => {
    const endpoint = await resolveGameEndpoint()
    return bootGame({
      character,
      endpoint,
      onFatal: (error) => setFatal(error.message),
    })
  }, [])

  if (fatal) {
    return <div className="game-runtime-error" role="alert">{fatal}</div>
  }
  return readiness === 'ready'
    ? <MainMenuScene connectSession={connectSession} />
    : <NativeLoader progress={progress} />
}
