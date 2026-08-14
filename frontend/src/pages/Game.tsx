import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  gameStartupStageLabel,
  initialGameStartupProgress,
  loadGameStartupAssets,
} from '../game/game-assets'
import { assetDisplayName } from '../game/game-asset-readiness.ts'
import { bootGame, type GameEndpoint, type GameSession } from '../game/engine.ts'
import type { PlayerCharacterConfig } from '../game/core-kernels/player-character.ts'
import {
  cancelGameLobby,
  configuredGameEndpoint,
  createGameLobby,
  joinGameLobby,
  parseGameLobbyId,
  type CreatedGameLobby,
} from '../game/game-bootstrap.ts'
import MainMenuScene from '../game/MainMenuScene'
import NativeLoader from '../game/NativeLoader'
import { useAuth } from '../lib/auth'

type Readiness = 'loading' | 'ready'

export default function Game() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedParty = searchParams.get('party')
  const lobbyId = parseGameLobbyId(requestedParty)
  const hostedLobby = useRef<CreatedGameLobby | null>(null)
  const preparedEndpoint = useRef<GameEndpoint | null>(null)
  const [readiness, setReadiness] = useState<Readiness>('loading')
  const [loadProgress, setLoadProgress] = useState(initialGameStartupProgress)
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
    void loadGameStartupAssets((progress) => {
      if (!cancelled) setLoadProgress(progress)
    }).then(() => {
      if (!cancelled) setReadiness('ready')
    }).catch((error: unknown) => {
      if (!cancelled) {
        setFatal(error instanceof Error
          ? error.message
          : 'The game files could not be loaded.')
      }
    })
    return () => { cancelled = true }
  }, [])

  const displayName = user?.username ?? 'Helvidius'
  const progress = loadProgress.total === 0
    ? 1
    : loadProgress.completed / loadProgress.total

  const prepareNewGame = useCallback(async (): Promise<void> => {
    if (preparedEndpoint.current) return
    const configured = configuredGameEndpoint()
    if (configured) {
      preparedEndpoint.current = configured
      return
    }
    const created = await createGameLobby(displayName)
    hostedLobby.current = created
    preparedEndpoint.current = created.endpoint
  }, [displayName])

  const cancelCreate = useCallback(async (): Promise<void> => {
    if (lobbyId) {
      navigate('/parties')
      return
    }
    const created = hostedLobby.current
    if (created) await cancelGameLobby(created)
    hostedLobby.current = null
    preparedEndpoint.current = null
  }, [lobbyId, navigate])

  const connectSession = useCallback(async (
    character: PlayerCharacterConfig,
  ): Promise<GameSession> => {
    const endpoint = lobbyId
      ? await joinGameLobby(lobbyId)
      : preparedEndpoint.current
    if (!endpoint) throw new Error('The web playtest was not prepared.')
    const session = await bootGame({
      character,
      endpoint,
      onFatal: (error) => setFatal(error.message),
    })
    if (lobbyId) navigate('/game', { replace: true })
    hostedLobby.current = null
    preparedEndpoint.current = null
    return session
  }, [lobbyId, navigate])

  if (fatal || (requestedParty !== null && lobbyId === null)) {
    return (
      <div className="game-runtime-error" role="alert">
        {fatal ?? 'The web playtest lobby link is invalid.'}
      </div>
    )
  }
  return (
    <>
      {readiness === 'ready'
        ? (
            <MainMenuScene
              connectSession={connectSession}
              displayName={displayName}
              initialScreen={lobbyId ? 'create' : 'root'}
              onCancelCreate={cancelCreate}
              prepareNewGame={prepareNewGame}
            />
          )
        : (
            <NativeLoader
              completed={loadProgress.completed}
              currentItem={loadProgress.activeSource
                ? assetDisplayName(loadProgress.activeSource)
                : null}
              progress={progress}
              stage={gameStartupStageLabel(loadProgress)}
              total={loadProgress.total}
            />
          )}
    </>
  )
}
