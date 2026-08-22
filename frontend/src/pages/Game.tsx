import { useCallback, useEffect, useRef, useState } from 'react'
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
import type { GameDeploymentRestartRequest } from '../game/client/game-client-session.ts'
import { createGameClientDiagnostics } from '../game/client/game-diagnostics.ts'
import type { PlayerCharacterConfig } from '../game/core-kernels/player-character.ts'
import type {
  HallOfFameBoard,
  HallOfFameEntry,
} from '../game/core-kernels/hall-of-fame.ts'
import {
  admitBrowserGame,
  configuredGameEndpoint,
  type BrowserGameAdmission,
} from '../game/game-bootstrap.ts'
import MainMenuScene from '../game/MainMenuScene'
import NativeLoader from '../game/NativeLoader'
import GameRuntimeError from '../game/GameRuntimeError.tsx'
import { useAuth } from '../lib/auth'
import { api, getToken, type ActiveWebMod } from '../lib/api.ts'
import { GameSaveCoordinator } from '../game/save/game-save-coordinator.ts'
import {
  createCloudGameSaveStore,
  createLocalGameSaveStore,
  type StoredGameSave,
} from '../game/save/game-save-store.ts'
import {
  parseGameSaveDocument,
  type GameSaveCheckpoint,
  type ResumableGameSave,
} from '../game/save/game-save-contract.ts'
import { readLocalHallOfFame } from '../game/hall-of-fame-store.ts'
import { readTotalPlaytimeMs, trackPlaytime } from '../game/playtime-store.ts'
import { TITLE_BUILD_REVISION } from '../game/title-build-revision.ts'
import { waitForDeploymentRevision } from '../game/deployment-revision.ts'
import GameDeploymentUpdate from '../game/GameDeploymentUpdate.tsx'

type Readiness = 'loading' | 'ready'

interface DeploymentRestartState {
  saved: boolean
  targetRevision: string
}

export default function Game() {
  const { user, loading: authLoading, logout } = useAuth()
  const preparedEndpoint = useRef<GameEndpoint | null>(null)
  const diagnosticsRef = useRef<ReturnType<typeof createGameClientDiagnostics> | null>(null)
  diagnosticsRef.current ??= createGameClientDiagnostics()
  const diagnostics = diagnosticsRef.current
  const [readiness, setReadiness] = useState<Readiness>('loading')
  const [loadProgress, setLoadProgress] = useState(initialGameStartupProgress)
  const [fatal, setFatal] = useState<GameConnectionFailure | null>(null)
  const [saveReady, setSaveReady] = useState(false)
  const [modsReady, setModsReady] = useState(false)
  const [activeMods, setActiveMods] = useState<readonly ActiveWebMod[]>([])
  const [resumeSave, setResumeSave] = useState<ResumableGameSave | null>(null)
  const [deploymentRestart, setDeploymentRestart] = useState<DeploymentRestartState | null>(null)
  const saveCoordinator = useRef<GameSaveCoordinator | null>(null)

  useEffect(() => {
    diagnostics.info('game.page_opened', 'The browser game page opened.')
    return diagnostics.attachBrowserListeners()
  }, [diagnostics])

  useEffect(() => trackPlaytime(), [])

  useEffect(() => {
    const currentRevision = TITLE_BUILD_REVISION.full
    if (!currentRevision) return
    const controller = new AbortController()
    void waitForDeploymentRevision({
      currentRevision,
      intervalMs: deploymentRestart ? 500 : 15_000,
      signal: controller.signal,
      targetRevision: deploymentRestart?.targetRevision ?? null,
    }).then(() => {
      if (!controller.signal.aborted) window.location.reload()
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        diagnostics.warning(
          'deployment.revision_poll_failed',
          'The game could not verify the deployed revision.',
          error instanceof Error ? error.message : 'Revision check failed.',
        )
      }
    })
    return () => controller.abort()
  }, [deploymentRestart, diagnostics])

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
        const parsed = parseGameSaveDocument(record.document)
        setResumeSave({
          document: record.document,
          integrity: parsed.integrity,
          mods: parsed.mods,
          summary: parsed.summary,
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

  const refreshActiveMods = useCallback(async (): Promise<readonly ActiveWebMod[]> => {
    if (!user) {
      setActiveMods([])
      return []
    }
    const content = await api.mods.subscriptions.active()
    setActiveMods(content.mods)
    return content.mods
  }, [user])

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setModsReady(false)
    void refreshActiveMods().catch((error: unknown) => {
      if (!cancelled) {
        const failure = GameConnectionFailure.from(
          error instanceof Error ? error : new Error('Subscribed mods could not be loaded.'),
          'asset-load-failed',
        )
        diagnostics.error('mods.load_failed', failure.message, failure.stack)
        setFatal(failure)
      }
    }).finally(() => {
      if (!cancelled) setModsReady(true)
    })
    return () => { cancelled = true }
  }, [authLoading, diagnostics, refreshActiveMods])

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

  const prepareGame = useCallback(async (admission: BrowserGameAdmission): Promise<void> => {
    if (preparedEndpoint.current) return
    const configured = configuredGameEndpoint()
    if (configured) {
      preparedEndpoint.current = configured
      return
    }
    try {
      preparedEndpoint.current = await admitBrowserGame(admission, getToken())
      diagnostics.info(
        'game.admitted',
        `A ${admission.kind} admission was issued.`,
      )
    } catch (error) {
      preparedEndpoint.current = null
      const failure = GameConnectionFailure.from(error)
      diagnostics.error('hub.admission_failed', failure.message, failure.stack)
      throw failure
    }
  }, [diagnostics])

  const cancelCreate = useCallback(async (): Promise<void> => {
    preparedEndpoint.current = null
  }, [])

  const saveForDeployment = useCallback(async (
    request: GameDeploymentRestartRequest,
  ): Promise<void> => {
    setDeploymentRestart({ saved: false, targetRevision: request.targetRevision })
    const coordinator = saveCoordinator.current
    if (!coordinator) throw new Error('The game save owner is unavailable.')
    if (request.checkpoint) coordinator.accept(request.checkpoint)
    await coordinator.waitFor(request.checkpoint?.sequence ?? 0)
    setDeploymentRestart(current => current?.targetRevision === request.targetRevision
      ? { ...current, saved: true }
      : current)
  }, [])

  const connectSession = useCallback(async (
    character: PlayerCharacterConfig,
    onProgress: (stage: GameConnectionStage) => void,
    cheatsEnabled: boolean,
    saveDocument?: string,
    allowModMismatch?: boolean,
  ): Promise<GameSession> => {
    try {
      const endpoint = preparedEndpoint.current
      if (!endpoint) throw new Error('The shared Hub admission was not prepared.')
      const session = await bootGame({
        ...(allowModMismatch ? { allowModMismatch: true } : {}),
        character,
        cheatsEnabled,
        diagnostics,
        endpoint,
        onFatal: setFatal,
        onDeploymentRestart: saveForDeployment,
        onProgress,
        profile: {
          accountUsername,
          highestWave: highestLocalWave(),
          totalPlaytimeMs: readTotalPlaytimeMs(),
        },
        ...(saveDocument ? { saveDocument } : {}),
      })
      preparedEndpoint.current = null
      return session
    } catch (error) {
      preparedEndpoint.current = null
      const failure = GameConnectionFailure.from(error)
      diagnostics.error('connection.session_failed', failure.message, failure.technicalDetail)
      setFatal(failure)
      throw failure
    }
  }, [accountUsername, diagnostics, saveForDeployment])

  const persistCheckpoint = useCallback((checkpoint: GameSaveCheckpoint) => {
    saveCoordinator.current?.accept(checkpoint)
  }, [])

  const persistCheckpointAndWait = useCallback(async (checkpoint: GameSaveCheckpoint) => {
    const coordinator = saveCoordinator.current
    if (!coordinator) throw new Error('The game save owner is unavailable.')
    coordinator.accept(checkpoint)
    await coordinator.waitFor(checkpoint.sequence)
  }, [])

  const loadGlobalHallOfFame = useCallback(async (
    board: HallOfFameBoard,
  ): Promise<readonly HallOfFameEntry[]> => {
    const result = await api.gameLeaderboards.list(board)
    return result.items
  }, [])

  const submitGlobalHallOfFame = useCallback(async (receipt: string) => {
    if (!user) return
    try {
      await api.gameLeaderboards.submit(receipt)
    } catch (error) {
      diagnostics.warning(
        'hall.global_submit_failed',
        'The completed run remains in the local Hall of Fame.',
        error instanceof Error ? error.message : 'Global leaderboard submission failed.',
      )
    }
  }, [diagnostics, user])

  if (fatal && !deploymentRestart) {
    return (
      <GameRuntimeError
        diagnostics={diagnostics}
        failure={fatal}
        token={getToken()}
      />
    )
  }
  return (
    <>
      {readiness === 'ready' && !authLoading && saveReady && modsReady
        ? (
            <MainMenuScene
              activeMods={activeMods}
              accountUsername={accountUsername}
              connectSession={connectSession}
              displayName={displayName}
              initialScreen="root"
              loadGlobalHallOfFame={loadGlobalHallOfFame}
              onCancelCreate={cancelCreate}
              onSaveCheckpoint={persistCheckpoint}
              onSignOut={logout}
              persistSaveCheckpoint={persistCheckpointAndWait}
              prepareGame={prepareGame}
              refreshActiveMods={refreshActiveMods}
              resumeSave={resumeSave}
              submitGlobalHallOfFame={submitGlobalHallOfFame}
            />
          )
        : (
            <NativeLoader
              completed={loadProgress.completed}
              currentItem={loadProgress.activeSource
                ? assetDisplayName(loadProgress.activeSource)
                : null}
              progress={readiness === 'ready' ? 1 : progress}
              stage={readiness === 'ready'
                ? !modsReady ? 'Loading subscribed mods' : 'Loading save'
                : gameStartupStageLabel(loadProgress)}
              total={loadProgress.total}
            />
          )}
      {deploymentRestart && <GameDeploymentUpdate saved={deploymentRestart.saved} />}
    </>
  )
}

function highestLocalWave(): number | null {
  const waves = readLocalHallOfFame()
    .map(({ wave }) => wave)
    .filter((wave) => wave > 0)
  return waves.length === 0 ? null : Math.max(...waves)
}
