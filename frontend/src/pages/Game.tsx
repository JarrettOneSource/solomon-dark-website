import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  gameStartupStageLabel,
  initialGameStartupProgress,
  loadGameStartupAssets,
} from '../game/game-assets'
import { assetDisplayName } from '../game/game-asset-readiness.ts'
import {
  bootGame,
  bootGameObserver,
  type GameConnectionStage,
  type GameEndpoint,
  type GameSession,
} from '../game/engine.ts'
import {
  GameConnectionFailure,
} from '../game/client/game-connection-failure.ts'
import type { GameDeploymentRestartRequest } from '../game/client/game-client-session.ts'
import type { GameObserverSession } from '../game/client/game-observer-session.ts'
import { createGameClientDiagnostics } from '../game/client/game-diagnostics.ts'
import type { PlayerCharacterConfig } from '../game/core-kernels/player-character.ts'
import type {
  HallOfFameBoard,
  HallOfFameEntry,
} from '../game/core-kernels/hall-of-fame.ts'
import {
  admitBrowserGame,
  admitGameObserver,
  configuredGameEndpoint,
  type BrowserGameAdmission,
} from '../game/game-bootstrap.ts'
import MainMenuScene from '../game/MainMenuScene'
import type {
  NativeSaveTransferController,
} from '../game/NativeSaveTransferSettings.tsx'
import NativeLoader from '../game/NativeLoader'
import GameRuntimeError from '../game/GameRuntimeError.tsx'
import { useAuth } from '../lib/auth'
import {
  api,
  getToken,
  type ActiveWebMod,
  type DisabledWebMod,
} from '../lib/api.ts'
import { GameSaveCoordinator } from '../game/save/game-save-coordinator.ts'
import {
  createCloudGameSaveStore,
  createLocalGameSaveStore,
  type StoredGameSave,
} from '../game/save/game-save-store.ts'
import {
  parseGameSaveDocument,
  type GameProfileSave,
  type GameSaveCheckpoint,
  type GameSaveIntent,
  type ResumableGameSave,
} from '../game/save/game-save-contract.ts'
import { readLocalHallOfFame } from '../game/hall-of-fame-store.ts'
import { readTotalPlaytimeMs, trackPlaytime } from '../game/playtime-store.ts'
import { TITLE_BUILD_REVISION } from '../game/title-build-revision.ts'
import { waitForDeploymentRevision } from '../game/deployment-revision.ts'
import GameDeploymentUpdate from '../game/GameDeploymentUpdate.tsx'
import {
  shouldOfferStockTutorial,
  type BrowserSaveDetection,
} from '../game/tutorial-entry.ts'
import { gameOnlinePreferences, readGameSettings } from '../game/game-settings.ts'

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
  const [saveDetection, setSaveDetection] = useState<BrowserSaveDetection>('loading')
  const [modsReady, setModsReady] = useState(false)
  const [activeMods, setActiveMods] = useState<readonly ActiveWebMod[]>([])
  const [modLoadError, setModLoadError] = useState<string | null>(null)
  const [profileSave, setProfileSave] = useState<GameProfileSave | null>(null)
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
    setSaveDetection('loading')
    setProfileSave(null)
    setResumeSave(null)
    const store = user ? createCloudGameSaveStore() : createLocalGameSaveStore()
    const present = (record: StoredGameSave | null) => {
      if (cancelled) return
      if (!record) {
        setSaveDetection('missing')
        setProfileSave(null)
        setResumeSave(null)
        return
      }
      try {
        const parsed = parseGameSaveDocument(record.document)
        setSaveDetection('present')
        const profile = {
          document: record.document,
          integrity: parsed.integrity,
          mods: parsed.mods,
        }
        setProfileSave(profile)
        setResumeSave(parsed.continuation === null
          ? null
          : { ...profile, summary: parsed.continuation.summary })
      } catch (error) {
        setSaveDetection('present')
        setProfileSave(null)
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
      if (!cancelled) setSaveDetection('unavailable')
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
      setModLoadError(null)
      return []
    }
    const content = await api.mods.subscriptions.active()
    setActiveMods(content.mods)
    setModLoadError(disabledModMessage(content.disabledMods))
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
        setActiveMods([])
        setModLoadError(`Mods could not be loaded. The main menu opened without them: ${failure.message}`)
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
    if (request.checkpoint) await coordinator.accept(request.checkpoint)
    else await coordinator.idle()
    setDeploymentRestart(current => current?.targetRevision === request.targetRevision
      ? { ...current, saved: true }
      : current)
  }, [])

  const connectSession = useCallback(async (
    character: PlayerCharacterConfig,
    onProgress: (stage: GameConnectionStage) => void,
    cheatsEnabled: boolean,
    saveDocument?: string,
    saveIntent?: GameSaveIntent,
    allowModMismatch?: boolean,
    resumeToken?: string,
    beginCollegeIntro?: boolean,
    declineTutorial?: boolean,
  ): Promise<GameSession> => {
    try {
      const endpoint = preparedEndpoint.current
      if (!endpoint) throw new Error('The shared Hub admission was not prepared.')
      const session = await bootGame({
        ...(allowModMismatch ? { allowModMismatch: true } : {}),
        ...(beginCollegeIntro ? { beginCollegeIntro: true } : {}),
        character,
        cheatsEnabled,
        diagnostics,
        ...(declineTutorial ? { declineTutorial: true } : {}),
        endpoint,
        onFatal: setFatal,
        onDeploymentRestart: saveForDeployment,
        onlinePreferences: gameOnlinePreferences(readGameSettings()),
        onProgress,
        profile: {
          accountUsername,
          highestWave: highestLocalWave(),
          totalPlaytimeMs: readTotalPlaytimeMs(),
        },
        ...(saveDocument ? { saveDocument } : {}),
        ...(saveIntent ? { saveIntent } : {}),
        ...(resumeToken ? { resumeToken } : {}),
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

  const connectObserver = useCallback(async (
    matchId: string,
    onEnded: () => void,
  ): Promise<GameObserverSession> => {
    try {
      const endpoint = await admitGameObserver(matchId, getToken())
      return await bootGameObserver({
        endpoint,
        onEnded,
        onFatal: setFatal,
      })
    } catch (error) {
      const failure = GameConnectionFailure.from(error)
      diagnostics.error('observer.session_failed', failure.message, failure.technicalDetail)
      throw failure
    }
  }, [diagnostics])

  const persistCheckpoint = useCallback((checkpoint: GameSaveCheckpoint) => {
    const outcome = saveCoordinator.current?.accept(checkpoint)
    void outcome?.catch(() => {})
  }, [])

  const persistCheckpointAndWait = useCallback(async (checkpoint: GameSaveCheckpoint) => {
    const coordinator = saveCoordinator.current
    if (!coordinator) throw new Error('The game save owner is unavailable.')
    await coordinator.accept(checkpoint)
  }, [])

  const killWizard = useCallback(async (): Promise<void> => {
    const coordinator = saveCoordinator.current
    const current = coordinator?.current()
    if (!coordinator || !current) throw new Error('The current wizard save is unavailable.')
    const { retireGameSaveWizard } = await import('../game/save/game-save-document.ts')
    await coordinator.replace(retireGameSaveWizard(current.document))
  }, [])

  const inspectNativeSaveImport = useCallback(async (files: FileList) => {
    const [{ readNativeSaveFileSelection }, { createWebGameSaveFromPortableProfile }] = await Promise.all([
      import('../game/save/native-save-files.ts'),
      import('../game/save/game-save-portability.ts'),
    ])
    const portable = await readNativeSaveFileSelection(files)
    const imported = createWebGameSaveFromPortableProfile(portable)
    return Object.freeze({
      discipline: imported.character.discipline,
      displayName: imported.character.displayName,
      document: imported.document,
      element: imported.character.element,
      gold: portable.profile.gold,
      hagathaPerks: portable.wizard.perkSelectors.length,
      learnedRows: portable.wizard.permanentRanks.filter(rank => rank > 0).length,
      level: portable.wizard.level,
      warnings: imported.warnings,
    })
  }, [])

  const replaceWithNativeSaveImport = useCallback(async (document: string) => {
    const coordinator = saveCoordinator.current
    if (!coordinator) throw new Error('The game save owner is unavailable.')
    await coordinator.replace(document)
  }, [])

  const exportCurrentNativeSave = useCallback(async () => {
    const current = saveCoordinator.current?.current()
    if (!current) throw new Error('Create or import a wizard before exporting.')
    const { exportWebGameSaveToNativeArchive } = await import(
      '../game/save/game-save-portability.ts'
    )
    const exported = await exportWebGameSaveToNativeArchive(current.document)
    return Object.freeze({ archive: exported.archive, warnings: exported.warnings })
  }, [])

  const nativeSaveTransfer = useMemo<NativeSaveTransferController>(() => Object.freeze({
    canExport: profileSave !== null,
    exportCurrent: exportCurrentNativeSave,
    inspectImport: inspectNativeSaveImport,
    replaceWithImport: replaceWithNativeSaveImport,
  }), [
    exportCurrentNativeSave,
    inspectNativeSaveImport,
    profileSave,
    replaceWithNativeSaveImport,
  ])

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
              connectObserver={connectObserver}
              developerAccess={user?.developerAccess === true}
              displayName={displayName}
              initialScreen="root"
              loadGlobalHallOfFame={loadGlobalHallOfFame}
              modLoadError={modLoadError}
              onCancelCreate={cancelCreate}
              onKillWizard={killWizard}
              onSaveCheckpoint={persistCheckpoint}
              onSignOut={logout}
              persistSaveCheckpoint={persistCheckpointAndWait}
              prepareGame={prepareGame}
              profileSave={profileSave}
              refreshActiveMods={refreshActiveMods}
              resumeSave={resumeSave}
              saveTransfer={nativeSaveTransfer}
              submitGlobalHallOfFame={submitGlobalHallOfFame}
              tutorialOfferEligible={shouldOfferStockTutorial(saveDetection)}
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

function disabledModMessage(mods: readonly DisabledWebMod[]): string | null {
  if (mods.length === 0) return null
  const errors = mods.map(mod => mod.error).join(' ')
  return `${mods.length === 1 ? 'Mod disabled' : 'Mods disabled'}: ${errors}`
}
