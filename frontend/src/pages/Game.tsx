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
import { GameSaveCoordinator } from '../game/save/game-save-coordinator.ts'
import {
  createCloudGameSaveStore,
  createLocalGameSaveStore,
  type StoredGameSave,
} from '../game/save/game-save-store.ts'
import {
  readGameSaveSummary,
  type GameSaveCheckpoint,
  type ResumableGameSave,
} from '../game/save/game-save-contract.ts'

type Readiness = 'loading' | 'ready'

export default function Game() {
  const { user, loading: authLoading } = useAuth()
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
  const [saveReady, setSaveReady] = useState(false)
  const [resumeSave, setResumeSave] = useState<ResumableGameSave | null>(null)
  const saveCoordinator = useRef<GameSaveCoordinator | null>(null)

  useEffect(() => {
    diagnostics.info('game.page_opened', 'The browser game page opened.')
    return diagnostics.attachBrowserListeners()
  }, [diagnostics])

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setSaveReady(false)
    setResumeSave(null)
    const store = user ? createCloudGameSaveStore() : createLocalGameSaveStore()
    const present = (record: StoredGameSave | null) => {
      if (cancelled) return
      if (!record) {
        setResumeSave(null)
        return
      }
      try {
        setResumeSave({
          document: record.document,
          summary: readGameSaveSummary(record.document),
        })
      } catch (error) {
        setResumeSave(null)
        diagnostics.warning(
          'save.invalid',
          'The stored game could not be offered for resume.',
          error instanceof Error ? error.message : 'Invalid game save.',
        )
      }
    }
    const coordinator = new GameSaveCoordinator(
      store,
      present,
      (error) => diagnostics.warning(
        'save.sync_failed',
        'The latest game checkpoint could not be saved.',
        error.message,
      ),
    )
    saveCoordinator.current = coordinator
    void coordinator.load().catch((error: unknown) => {
      diagnostics.warning(
        'save.load_failed',
        'The game save slot could not be loaded.',
        error instanceof Error ? error.message : 'Game save load failed.',
      )
    }).finally(() => {
      if (!cancelled) setSaveReady(true)
    })
    return () => {
      cancelled = true
      if (saveCoordinator.current === coordinator) saveCoordinator.current = null
    }
  }, [authLoading, diagnostics, user])

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
  const displayName = accountUsername ?? ''
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
      const created = await createGameLobby(accountUsername ?? 'Guest')
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
  }, [accountUsername, diagnostics])

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
    saveDocument?: string,
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
        ...(saveDocument ? { saveDocument } : {}),
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

  const persistCheckpoint = useCallback((checkpoint: GameSaveCheckpoint) => {
    saveCoordinator.current?.accept(checkpoint)
  }, [])

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
      {readiness === 'ready' && !authLoading && saveReady
        ? (
            <MainMenuScene
              accountUsername={accountUsername}
              connectSession={connectSession}
              displayName={displayName}
              initialScreen={lobbyId ? 'create' : 'root'}
              onCancelCreate={cancelCreate}
              onSaveCheckpoint={persistCheckpoint}
              prepareNewGame={prepareNewGame}
              resumeSave={resumeSave}
            />
          )
        : (
            <NativeLoader
              completed={loadProgress.completed}
              currentItem={loadProgress.activeSource
                ? assetDisplayName(loadProgress.activeSource)
                : null}
              progress={readiness === 'ready' ? 1 : progress}
              stage={readiness === 'ready' ? 'Loading save' : gameStartupStageLabel(loadProgress)}
              total={loadProgress.total}
            />
          )}
    </>
  )
}
