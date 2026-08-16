import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  gameStartupStageLabel,
  initialGameStartupProgress,
  loadGameStartupAssets,
} from '../game/game-assets'
import { assetDisplayName } from '../game/game-asset-readiness.ts'
import {
  bootGame,
  type GameConnectionStage,
  type GameEndpoint,
  type GameSession,
} from '../game/engine.ts'
import {
  GameConnectionFailure,
} from '../game/client/game-connection-failure.ts'
import { createGameClientDiagnostics } from '../game/client/game-diagnostics.ts'
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
import GameRuntimeError from '../game/GameRuntimeError.tsx'
import { useAuth } from '../lib/auth'
import { getToken } from '../lib/api.ts'

type Readiness = 'loading' | 'ready'

export default function Game() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedParty = searchParams.get('party')
  const lobbyId = parseGameLobbyId(requestedParty)
  const hostedLobby = useRef<CreatedGameLobby | null>(null)
  const preparedEndpoint = useRef<GameEndpoint | null>(null)
  const diagnosticsRef = useRef<ReturnType<typeof createGameClientDiagnostics> | null>(null)
  diagnosticsRef.current ??= createGameClientDiagnostics()
  const diagnostics = diagnosticsRef.current
  const [readiness, setReadiness] = useState<Readiness>('loading')
  const [loadProgress, setLoadProgress] = useState(initialGameStartupProgress)
  const [fatal, setFatal] = useState<GameConnectionFailure | null>(null)

  useEffect(() => {
    diagnostics.info('game.page_opened', 'The browser game page opened.')
    return diagnostics.attachBrowserListeners()
  }, [diagnostics])

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
        const failure = GameConnectionFailure.from(
          error instanceof Error ? error : new Error('The game files could not be loaded.'),
          'asset-load-failed',
        )
        diagnostics.error('assets.load_failed', failure.message, failure.stack)
        setFatal(failure)
      }
    })
    return () => { cancelled = true }
  }, [diagnostics])

  const accountUsername = user?.username ?? null
  const displayName = accountUsername ?? 'Helvidius'
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
    try {
      const created = await createGameLobby(displayName)
      hostedLobby.current = created
      preparedEndpoint.current = created.endpoint
      diagnostics.info(
        'lobby.created',
        'A browser game lobby was created.',
        `lobbyId=${created.lobbyId}`,
      )
    } catch (error) {
      const failure = GameConnectionFailure.from(error)
      diagnostics.error('lobby.create_failed', failure.message, failure.stack)
      throw failure
    }
  }, [diagnostics, displayName])

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
    onProgress: (stage: GameConnectionStage) => void,
  ): Promise<GameSession> => {
    try {
      const endpoint = lobbyId
        ? await joinGameLobby(lobbyId)
        : preparedEndpoint.current
      if (!endpoint) throw new Error('The web playtest was not prepared.')
      const session = await bootGame({
        character,
        diagnostics,
        endpoint,
        onFatal: setFatal,
        onProgress,
      })
      if (lobbyId) navigate('/game', { replace: true })
      hostedLobby.current = null
      preparedEndpoint.current = null
      return session
    } catch (error) {
      const failure = GameConnectionFailure.from(error)
      diagnostics.error('connection.session_failed', failure.message, failure.technicalDetail)
      setFatal(failure)
      throw failure
    }
  }, [diagnostics, lobbyId, navigate])

  if (fatal || (requestedParty !== null && lobbyId === null)) {
    const failure = fatal ?? GameConnectionFailure.from(
      new Error('This game lobby link is invalid, so the server could not be contacted.'),
    )
    return (
      <GameRuntimeError
        diagnostics={diagnostics}
        failure={failure}
        token={getToken()}
      />
    )
  }
  return (
    <>
      {readiness === 'ready'
        ? (
            <MainMenuScene
              accountUsername={accountUsername}
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
