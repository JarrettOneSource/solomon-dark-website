import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import CreateMenuScene from './CreateMenuScene.tsx'
import type { GameClientSession } from './client/game-client-session.ts'
import type {
  PlayerCharacterConfig,
  WizardDiscipline,
  WizardElement,
} from './core-kernels/player-character.ts'
import { initialCreateWizardNameForSession } from './create-wizard-name.ts'
import { createBrowserGameAudioDirector } from './game-audio-browser.ts'
import { PrimarySpellAudioSynchronizer } from './primary-spell-audio.ts'
import {
  NATIVE_LEVEL_UP_SOUND_REQUEST,
  type GameAudioScene,
} from './game-audio-native.ts'
import type { GameRunPhase } from './core-kernels/game-run.ts'
import type { GameConnectionStage } from './engine.ts'
import GameAccountName from './GameAccountName.tsx'
import GameFullscreenButton from './GameFullscreenButton.tsx'
import GameplayPauseMenu from './GameplayPauseMenu.tsx'
import GameSettingsDialog from './GameSettingsDialog.tsx'
import { installGameLuaConsole } from './game-lua-console.ts'
import {
  GAME_SETTINGS_STORAGE_KEY,
  readGameSettings,
  setGameSettings,
  subscribeGameSettings,
  type GameSettings,
} from './game-settings.ts'
import { createGamepadMenuNavigation } from './input/gamepad-menu-navigation.ts'
import MatchLoadingScreen from './MatchLoadingScreen.tsx'
import {
  advanceMatchLoading,
  beginMatchLoading,
  completeMatchLoading,
  type MatchLoadingFlow,
  type MatchLoadingStage,
  type MatchLoadingState,
} from './match-loading.ts'
import type {
  GameSnapshot,
  GameplayPauseState,
  LoadedBoneyard,
} from './protocol/game-protocol.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import type {
  GameSaveCheckpoint,
  ResumableGameSave,
} from './save/game-save-contract.ts'
import {
  GAME_VIEWPORT_MIN_HEIGHT,
  GAME_VIEWPORT_MIN_WIDTH,
  fixedGameStageBounds,
  fixedGameStageCssBounds,
  fixedGameViewportLayout,
  type FixedGameViewportLayout,
  type GameViewportBounds,
} from './renderer/game-viewport.ts'
import type { TitleMenuAction } from './renderer/title-menu-renderer.ts'
import TitleMenuPresentation from './TitleMenuPresentation.tsx'
import './main-menu.css'

const BoneyardScene = lazy(() => import('./BoneyardScene.tsx'))
const HubScene = lazy(() => import('./HubScene.tsx'))
const loadSkillPicker = () => import('./SkillPicker.tsx')
const SkillPicker = lazy(loadSkillPicker)

type MenuScreen = 'root' | 'play' | 'create' | 'hub'
type FadeState = 'idle' | 'covering' | 'revealing'

interface MenuButtonProps {
  accessibleLabel: string
  action: TitleMenuAction
  className?: string
  compact?: boolean
  defaultFocus?: boolean
  disabled?: boolean
  isBack?: boolean
  onClick?: () => void
  onHighlight: (action: TitleMenuAction | null) => void
  onPress?: () => void
  onPressState: (action: TitleMenuAction | null) => void
}

function MenuButton({
  accessibleLabel,
  action,
  className,
  compact = false,
  defaultFocus = false,
  disabled = false,
  isBack = false,
  onClick,
  onHighlight,
  onPress,
  onPressState,
}: MenuButtonProps) {
  const classes = [
    'main-menu-button',
    compact && 'main-menu-button-compact',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={classes}
      aria-label={accessibleLabel}
      disabled={disabled}
      data-game-back={isBack || undefined}
      data-game-default-focus={defaultFocus || undefined}
      onBlur={() => {
        onHighlight(null)
        onPressState(null)
      }}
      onClick={() => {
        onPressState(null)
        onClick?.()
      }}
      onFocus={() => {
        if (!disabled) onHighlight(action)
      }}
      onPointerCancel={() => onPressState(null)}
      onPointerDown={(event) => {
        if (!disabled && event.button === 0) {
          onPressState(action)
          onPress?.()
        }
      }}
      onPointerEnter={() => {
        if (!disabled) onHighlight(action)
      }}
      onPointerLeave={() => {
        onHighlight(null)
        onPressState(null)
      }}
      onPointerUp={() => onPressState(null)}
      onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (!disabled && !event.repeat && (event.key === 'Enter' || event.key === ' ')) {
          onPressState(action)
          onPress?.()
        }
      }}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onPressState(null)
      }}
    />
  )
}

interface ActionGroupProps {
  onHighlight: (action: TitleMenuAction | null) => void
  onPress: () => void
  onPressState: (action: TitleMenuAction | null) => void
}

function RootActions({
  onHighlight,
  onPlay,
  onPress,
  onPressState,
  onSettings,
}: ActionGroupProps & { onPlay: () => void; onSettings: () => void }) {
  return (
    <>
      <MenuButton action="play" accessibleLabel="Play" defaultFocus onClick={onPlay} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="explore" accessibleLabel="Explore the Dark Cloud" onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="settings" accessibleLabel="Settings" onClick={onSettings} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="hall" accessibleLabel="Hall of Fame" onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
    </>
  )
}

function PlayActions({
  canResume,
  onBack,
  onHighlight,
  onLastGame,
  onNewGame,
  onPress,
  onPressState,
}: ActionGroupProps & {
  canResume: boolean
  onBack: () => void
  onLastGame: () => void
  onNewGame: () => void
}) {
  return (
    <>
      <MenuButton action="last-game" accessibleLabel="Last game" className="main-menu-button-last-game" defaultFocus={canResume} disabled={!canResume} onClick={onLastGame} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="new-game" accessibleLabel="New game" defaultFocus={!canResume} onClick={onNewGame} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="unavailable" accessibleLabel="Unavailable" className="main-menu-button-empty" disabled onHighlight={onHighlight} onPressState={onPressState} />
      <MenuButton action="back" accessibleLabel="Back" isBack onClick={onBack} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
    </>
  )
}

interface MainMenuSceneProps {
  accountUsername: string | null
  displayName: string
  connectSession: (
    character: PlayerCharacterConfig,
    onProgress: (stage: GameConnectionStage) => void,
    saveDocument?: string,
  ) => Promise<GameClientSession>
  initialScreen?: 'create' | 'root'
  onCancelCreate: () => Promise<void>
  onSaveCheckpoint: (checkpoint: GameSaveCheckpoint) => void
  prepareNewGame: () => Promise<void>
  resumeSave: ResumableGameSave | null
}

export default function MainMenuScene({
  accountUsername,
  connectSession,
  displayName,
  initialScreen = 'root',
  onCancelCreate,
  onSaveCheckpoint,
  prepareNewGame,
  resumeSave,
}: MainMenuSceneProps) {
  const audio = useMemo(createBrowserGameAudioDirector, [])
  const stageRef = useRef<HTMLElement>(null)
  const [screen, setScreen] = useState<MenuScreen>(initialScreen)
  const [wizardName, setWizardName] = useState(() => (
    initialScreen === 'create' ? initialCreateWizardNameForSession(displayName) : ''
  ))
  const [fadeState, setFadeState] = useState<FadeState>('idle')
  const [fadeTarget, setFadeTarget] = useState<MenuScreen | null>(null)
  const [session, setSession] = useState<GameClientSession | null>(null)
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<GameSnapshot | null>(null)
  const [runtimeProgression, setRuntimeProgression] = useState<ProtocolPlayerProgression | null>(null)
  const [runtimeRunPhase, setRuntimeRunPhase] = useState<GameRunPhase>('hub')
  const [runtimeAudioScene, setRuntimeAudioScene] = useState<GameAudioScene | null>(null)
  const [loadedBoneyard, setLoadedBoneyard] = useState<LoadedBoneyard | null>(null)
  const [gameplayPause, setGameplayPause] = useState<GameplayPauseState | null>(null)
  const activeBoneyardRunRef = useRef<string | null>(null)
  const loadedBoneyardRunRef = useRef<string | null>(null)
  const levelUpPickerPresentationRef = useRef<number | null>(null)
  const levelUpSoundBarrierRef = useRef<number | null>(null)
  const [levelUpPickerClosing, setLevelUpPickerClosing] = useState(false)
  const [loading, setLoading] = useState<MatchLoadingState | null>(null)
  const loadingRef = useRef<MatchLoadingState | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [hoveredTitleAction, setHoveredTitleAction] = useState<TitleMenuAction | null>(null)
  const [pressedTitleAction, setPressedTitleAction] = useState<TitleMenuAction | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [gameSettings, setLocalGameSettings] = useState(readGameSettings)
  const [fixedViewport, setFixedViewport] = useState(() => (
    fixedGameViewportLayout(GAME_VIEWPORT_MIN_WIDTH, GAME_VIEWPORT_MIN_HEIGHT)
  ))

  const beginLoading = useCallback((
    flow: MatchLoadingFlow,
    stage: MatchLoadingStage,
  ) => {
    const next = beginMatchLoading(flow, stage)
    loadingRef.current = next
    setLoading(next)
  }, [])

  const advanceLoading = useCallback((stage: MatchLoadingStage) => {
    const current = loadingRef.current
    if (!current) return
    const next = advanceMatchLoading(current, stage)
    if (next === current) return
    loadingRef.current = next
    setLoading(next)
  }, [])

  const cancelLoading = useCallback((flow: MatchLoadingFlow) => {
    if (loadingRef.current?.flow !== flow) return
    loadingRef.current = null
    setLoading(null)
  }, [])

  const finishLoading = useCallback((flow: MatchLoadingFlow) => {
    const current = loadingRef.current
    if (current?.flow !== flow) return
    loadingRef.current = completeMatchLoading(current)
    setLoading(null)
    loadingRef.current = null
  }, [])

  const finishHubLoading = useCallback(() => finishLoading('hub'), [finishLoading])
  const beginHubLoading = useCallback(
    () => beginLoading('hub', 'connecting_transport'),
    [beginLoading],
  )
  const finishBoneyardLoading = useCallback(
    () => finishLoading('boneyard'),
    [finishLoading],
  )
  const cancelHubLoading = useCallback(() => cancelLoading('hub'), [cancelLoading])
  const cancelBoneyardLoading = useCallback(
    () => cancelLoading('boneyard'),
    [cancelLoading],
  )

  useEffect(() => {
    const unsubscribe = subscribeGameSettings(setLocalGameSettings)
    const syncStoredSettings = (event: StorageEvent) => {
      if (event.key === GAME_SETTINGS_STORAGE_KEY) {
        setLocalGameSettings(readGameSettings())
      }
    }
    window.addEventListener('storage', syncStoredSettings)
    return () => {
      unsubscribe()
      window.removeEventListener('storage', syncStoredSettings)
    }
  }, [])

  useEffect(() => {
    if (!session || !gameSettings.enableCheats || !session.isHost) return
    return installGameLuaConsole(window, session)
  }, [gameSettings.enableCheats, runtimeSnapshot?.hostPlayerId, session])

  useEffect(() => {
    if (!settingsOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [settingsOpen])

  const updateGameSettings = useCallback((settings: GameSettings) => {
    setLocalGameSettings(setGameSettings(settings))
  }, [])

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const resize = () => {
      const next = fixedGameViewportLayout(stage.clientWidth, stage.clientHeight)
      setFixedViewport((current) => sameFixedViewport(current, next) ? current : next)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => session?.destroy(), [session])

  useEffect(() => {
    const unlock = () => audio.unlock()
    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
      audio.destroy()
    }
  }, [audio])

  useEffect(() => {
    const audioScene: GameAudioScene = runtimeAudioScene
      ?? (runtimeSnapshot?.world.kind === 'boneyard'
      ? 'boneyard'
      : screen === 'create'
        ? 'create'
        : screen === 'hub'
          ? 'hub'
          : 'title')
    audio.setScene(audioScene)
  }, [audio, runtimeAudioScene, runtimeSnapshot?.world.kind, screen])

  useEffect(() => {
    if (!session) return
    const initialSnapshot = session.getSnapshot()
    const initialBoneyard = session.getBoneyard()
    const initialSaveCheckpoint = session.getSaveCheckpoint()
    if (initialSaveCheckpoint) onSaveCheckpoint(initialSaveCheckpoint)
    activeBoneyardRunRef.current = initialSnapshot.world.kind === 'boneyard'
      ? initialSnapshot.world.runId
      : null
    loadedBoneyardRunRef.current = initialBoneyard?.runId ?? null
    setRuntimeSnapshot(initialSnapshot)
    setRuntimeRunPhase(initialSnapshot.run.phase)
    setRuntimeAudioScene(gameplayAudioScene(initialSnapshot))
    setRuntimeProgression(initialSnapshot.players[session.playerId]?.progression ?? null)
    setLoadedBoneyard(initialBoneyard)
    setGameplayPause(session.getGameplayPause())
    if (initialSnapshot.world.kind === 'boneyard') {
      if (loadingRef.current?.flow !== 'boneyard') {
        beginLoading('boneyard', initialBoneyard
          ? 'materializing_participants'
          : 'reading_boneyard')
      } else if (initialBoneyard) {
        advanceLoading('materializing_participants')
      }
    } else if (loadingRef.current?.flow === 'hub') {
      advanceLoading('materializing_participants')
    }
    const removeSnapshot = session.onSnapshot((snapshot) => {
      setRuntimeRunPhase(snapshot.run.phase)
      setRuntimeAudioScene(gameplayAudioScene(snapshot))
      if (snapshot.world.kind === 'boneyard') {
        const enteringRun = activeBoneyardRunRef.current !== snapshot.world.runId
        activeBoneyardRunRef.current = snapshot.world.runId
        if (loadingRef.current?.flow === 'boneyard') {
          advanceLoading('materializing_participants')
        } else if (enteringRun) {
          beginLoading('boneyard', 'materializing_participants')
        }
      } else {
        activeBoneyardRunRef.current = null
        if (loadingRef.current?.flow === 'hub') {
          advanceLoading('materializing_participants')
        }
      }
      const progression = snapshot.players[session.playerId]?.progression ?? null
      setRuntimeProgression((current) => (
        sameRuntimeProgression(current, progression) ? current : progression
      ))
      setRuntimeSnapshot((current) => sameRuntimeScene(current, snapshot)
        ? current
        : snapshot)
    })
    const removeBoneyard = session.onBoneyard((nextBoneyard) => {
      const enteringRun = loadedBoneyardRunRef.current !== nextBoneyard.runId
      loadedBoneyardRunRef.current = nextBoneyard.runId
      setLoadedBoneyard(nextBoneyard)
      if (loadingRef.current?.flow === 'boneyard') {
        advanceLoading('reading_boneyard')
      } else if (enteringRun) {
        beginLoading('boneyard', 'reading_boneyard')
      }
    })
    const removeGameplayPause = session.onGameplayPause(setGameplayPause)
    const removeSaveCheckpoint = session.onSaveCheckpoint(onSaveCheckpoint)
    return () => {
      removeSnapshot()
      removeBoneyard()
      removeGameplayPause()
      removeSaveCheckpoint()
    }
  }, [advanceLoading, beginLoading, onSaveCheckpoint, session])

  useEffect(() => {
    if (runtimeSnapshot?.world.kind === 'boneyard') void loadSkillPicker()
  }, [runtimeSnapshot?.world.kind])

  useEffect(() => {
    if (!session || !runtimeSnapshot) return
    if (runtimeRunPhase === 'hub' && screen === 'create') {
      setFadeState('idle')
      setFadeTarget(null)
      setScreen('hub')
      return
    }
    if (runtimeRunPhase !== 'loadout') return
    setFadeState('idle')
    setFadeTarget(null)
    setScreen('create')
  }, [runtimeRunPhase, runtimeSnapshot, screen, session])

  useEffect(() => {
    if (!session) return
    const synchronizer = new PrimarySpellAudioSynchronizer(
      audio,
      session.playerId,
      session.getSnapshot(),
    )
    const removeSnapshot = session.onSnapshot((snapshot) => synchronizer.update(snapshot))
    return () => {
      removeSnapshot()
      synchronizer.destroy()
    }
  }, [audio, session])

  useEffect(() => {
    if (screen === 'hub' || settingsOpen || !stageRef.current) return
    const navigation = createGamepadMenuNavigation({ root: stageRef.current })
    return () => navigation.destroy()
  }, [screen, settingsOpen])

  const transitionTo = (target: MenuScreen) => {
    if (fadeState !== 'idle') return
    setFadeTarget(target)
    setFadeState('covering')
  }

  const handleFadeEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (fadeState === 'covering' && fadeTarget) {
      setScreen(fadeTarget)
      setFadeState('revealing')
      return
    }
    if (fadeState === 'revealing') {
      setFadeState('idle')
      setFadeTarget(null)
    }
  }

  const titleScreen = screen === 'root' || screen === 'play'
  const gameScene = screen === 'hub' && runtimeSnapshot?.world.kind === 'boneyard'
    ? 'boneyard'
    : screen
  const nativeStageStyle = fixedStageStyle(
    fixedViewport,
    fixedGameStageBounds(fixedViewport, 'center', 'center'),
  )
  const quitStageStyle = fixedStageStyle(
    fixedViewport,
    fixedGameStageBounds(fixedViewport, 'right', 'bottom'),
  )
  const accountStageStyle = fixedStageStyle(
    fixedViewport,
    fixedGameStageBounds(fixedViewport, 'left', 'top'),
  )

  const beginNewGame = async () => {
    if (preparing || connecting) return
    setPreparing(true)
    setConnectionError(null)
    try {
      await prepareNewGame()
      setWizardName(initialCreateWizardNameForSession(displayName))
      transitionTo('create')
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Web playtest creation failed.')
    } finally {
      setPreparing(false)
    }
  }

  const leaveCreate = async () => {
    if (preparing || connecting) return
    setPreparing(true)
    setConnectionError(null)
    try {
      await onCancelCreate()
      if (initialScreen !== 'create') transitionTo('play')
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'The web playtest could not be closed.')
    } finally {
      setPreparing(false)
    }
  }

  const activateSession = (nextSession: GameClientSession) => {
    const snapshot = nextSession.getSnapshot()
    setSession(nextSession)
    setRuntimeSnapshot(snapshot)
    setRuntimeProgression(
      snapshot.players[nextSession.playerId]?.progression ?? null,
    )
    setLoadedBoneyard(nextSession.getBoneyard())
    setGameplayPause(nextSession.getGameplayPause())
    if (snapshot.world.kind === 'hub') advanceLoading('materializing_participants')
    setScreen('hub')
  }

  const resumeLastGame = async () => {
    if (!resumeSave || preparing || connecting) return
    const flow: MatchLoadingFlow = resumeSave.summary.worldKind === 'boneyard'
      ? 'boneyard'
      : 'hub'
    setPreparing(true)
    setConnectionError(null)
    try {
      await prepareNewGame()
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Web playtest creation failed.')
      return
    } finally {
      setPreparing(false)
    }
    setConnecting(true)
    beginLoading(flow, 'connecting_transport')
    try {
      const nextSession = await connectSession(
        resumeSave.summary.character,
        advanceLoading,
        resumeSave.document,
      )
      activateSession(nextSession)
    } catch (error) {
      cancelLoading(flow)
      setConnectionError(error instanceof Error ? error.message : 'Saved game connection failed.')
    } finally {
      setConnecting(false)
    }
  }

  const startHub = async (
    selectedDisplayName: string,
    selectedElement: WizardElement,
    selectedDiscipline: WizardDiscipline,
  ): Promise<boolean> => {
    if (connecting) return false
    if (session && runtimeRunPhase === 'loadout') {
      if (!session.isHost) return false
      session.confirmLoadout()
      return true
    }
    setConnecting(true)
    setConnectionError(null)
    try {
      const nextSession = await connectSession(
        {
          discipline: selectedDiscipline,
          displayName: selectedDisplayName,
          element: selectedElement,
        },
        advanceLoading,
      )
      activateSession(nextSession)
      return true
    } catch (error) {
      cancelLoading('hub')
      setConnectionError(error instanceof Error ? error.message : 'Game server connection failed.')
      return false
    } finally {
      setConnecting(false)
    }
  }

  const startBoneyard = (boneyardId: string) => {
    if (!session || loadingRef.current) return
    beginLoading('boneyard', 'preparing_boneyard')
    try {
      session.startMatch(boneyardId)
    } catch (error) {
      cancelLoading('boneyard')
      setConnectionError(error instanceof Error ? error.message : 'The Boneyard could not be opened.')
    }
  }

  const requestGameplayPause = useCallback(() => {
    session?.requestGameplayPause(true)
  }, [session])

  const leaveGameplay = () => {
    session?.destroy()
    setSession(null)
    setRuntimeSnapshot(null)
    setRuntimeProgression(null)
    setRuntimeAudioScene(null)
    setLoadedBoneyard(null)
    setGameplayPause(null)
    setScreen('root')
  }

  const levelUpBarrierId = runtimeSnapshot?.levelUpBarrier?.barrierId ?? null
  if (runtimeProgression?.pendingOffer && levelUpBarrierId !== null) {
    levelUpPickerPresentationRef.current = levelUpBarrierId
  }
  const levelUpPresentationId = runtimeProgression?.pendingOffer
    ? levelUpBarrierId
    : null
  const levelUpPickerPresentationId = levelUpBarrierId
    ?? levelUpPickerPresentationRef.current
  const levelUpModalActive = Boolean(runtimeSnapshot?.levelUpBarrier) || levelUpPickerClosing
  useEffect(() => {
    if (levelUpBarrierId === null) {
      levelUpSoundBarrierRef.current = null
      return
    }
    if (
      !runtimeProgression?.pendingOffer
      || levelUpSoundBarrierRef.current === levelUpBarrierId
    ) return
    levelUpSoundBarrierRef.current = levelUpBarrierId
    audio.playSound(NATIVE_LEVEL_UP_SOUND_REQUEST.cue, {
      playbackRate: NATIVE_LEVEL_UP_SOUND_REQUEST.playbackRate,
    })
  }, [audio, levelUpBarrierId, runtimeProgression?.pendingOffer])

  return (
    <div className="main-menu-page" data-game-scene={gameScene}>
      <section
        ref={stageRef}
        className="main-menu-stage"
        aria-label="Solomon Darker game menu"
      >
        {titleScreen ? (
          <>
            <TitleMenuPresentation
              hoveredAction={hoveredTitleAction}
              pressedAction={pressedTitleAction}
              screen={screen === 'play' ? 'play' : 'root'}
              viewport={fixedViewport}
            />

            <div
              className="main-menu-native-stage main-menu-account-stage"
              style={accountStageStyle}
            >
              <GameAccountName placement="title" username={accountUsername} />
            </div>

            <div className="main-menu-native-stage" style={nativeStageStyle}>
              <nav key={screen} className="main-menu-actions" aria-label={screen === 'root' ? 'Main menu actions' : 'Play menu actions'}>
                {screen === 'root' ? (
                  <RootActions
                    onHighlight={setHoveredTitleAction}
                    onPlay={() => setScreen('play')}
                    onPress={() => audio.playSound('click')}
                    onPressState={setPressedTitleAction}
                    onSettings={() => setSettingsOpen(true)}
                  />
                ) : (
                  <PlayActions
                    canResume={resumeSave !== null}
                    onBack={() => setScreen('root')}
                    onHighlight={setHoveredTitleAction}
                    onLastGame={() => { void resumeLastGame() }}
                    onNewGame={() => { void beginNewGame() }}
                    onPress={() => audio.playSound('click')}
                    onPressState={setPressedTitleAction}
                  />
                )}
              </nav>
            </div>

            <div className="main-menu-native-stage main-menu-quit-stage" style={quitStageStyle}>
              <div className="main-menu-quit">
                <MenuButton
                  action="quit"
                  accessibleLabel="Quit"
                  compact
                  onHighlight={setHoveredTitleAction}
                  onPress={() => audio.playSound('click')}
                  onPressState={setPressedTitleAction}
                />
              </div>
            </div>
          </>
        ) : screen === 'create' ? (
          <CreateMenuScene
            audio={audio}
            displayName={wizardName}
            onBack={() => { void leaveCreate() }}
            onDisplayNameChange={setWizardName}
            onDisciplineCommit={beginHubLoading}
            onStart={startHub}
            retainedLoadoutCanConfirm={Boolean(session?.isHost)}
            retainedLoadout={runtimeRunPhase === 'loadout' && session && runtimeSnapshot
              ? runtimeSnapshot.players[session.playerId]?.config
              : undefined}
            viewport={fixedViewport}
          />
        ) : session && runtimeSnapshot?.world.kind === 'boneyard' && loadedBoneyard
          && runtimeSnapshot.world.runId === loadedBoneyard.runId ? (
          <Suspense fallback={null}>
            <BoneyardScene
              accountUsername={accountUsername}
              audio={audio}
              boneyard={loadedBoneyard}
              getPingMs={session.getPingMs}
              inputBlocked={loading !== null || levelUpModalActive || gameplayPause !== null}
              levelUpModalActive={levelUpModalActive}
              levelUpPresentationId={levelUpPresentationId}
              playerId={session.playerId}
              initialSnapshot={runtimeSnapshot}
              onInput={session.sendInput}
              onLoadingError={cancelBoneyardLoading}
              onPauseRequest={requestGameplayPause}
              onReady={finishBoneyardLoading}
              progression={runtimeProgression ?? runtimeSnapshot.players[session.playerId]!.progression}
              presentationPaused={gameplayPause !== null}
              samplePresentation={session.sampleBoneyardPresentation}
              subscribePing={session.onPing}
              subscribeEnemyEvent={session.onEnemyEvent}
              subscribe={session.onSnapshot}
            />
          </Suspense>
        ) : session && runtimeSnapshot?.world.kind === 'hub' ? (
          <Suspense fallback={null}>
            <HubScene
              accountUsername={accountUsername}
              audio={audio}
              boneyards={session.boneyards}
              getPingMs={session.getPingMs}
              inputBlocked={loading !== null || levelUpModalActive || gameplayPause !== null}
              levelUpModalActive={levelUpModalActive}
              levelUpPresentationId={levelUpPresentationId}
              playerId={session.playerId}
              progression={runtimeProgression ?? runtimeSnapshot.players[session.playerId]!.progression}
              initialSnapshot={runtimeSnapshot}
              onInput={session.sendInput}
              onHubAction={session.sendHubAction}
              onLoadingError={cancelHubLoading}
              onPauseRequest={requestGameplayPause}
              onReady={finishHubLoading}
              onStartMatch={startBoneyard}
              presentationPaused={gameplayPause !== null}
              samplePresentation={session.samplePresentation}
              subscribePing={session.onPing}
              subscribe={session.onSnapshot}
            />
          </Suspense>
        ) : null}

        {session
          && levelUpPickerPresentationId !== null
          && (runtimeProgression?.pendingOffer || levelUpPickerClosing) ? (
          <Suspense fallback={null}>
            <SkillPicker
              audio={audio}
              offer={runtimeProgression?.pendingOffer ?? null}
              onClosingChange={setLevelUpPickerClosing}
              onReroll={session.rerollSkill}
              onSave={session.saveSkill}
              onSelect={session.selectSkill}
              presentationId={levelUpPickerPresentationId}
              sorcerorsCharmAvailable={Boolean(
                runtimeProgression?.sorcerorsCharmAvailable,
              )}
              style={nativeStageStyle}
            />
          </Suspense>
        ) : null}

        {session
          && runtimeSnapshot?.levelUpBarrier
          && !runtimeProgression?.pendingOffer
          && !levelUpPickerClosing ? (
            <div
              className="main-menu-native-stage skill-picker-stage skill-picker-waiting"
              style={nativeStageStyle}
              role="status"
              aria-live="polite"
              data-level-up-barrier-id={runtimeSnapshot.levelUpBarrier.barrierId}
              data-pending-player-ids={runtimeSnapshot.levelUpBarrier.pendingPlayerIds.join(',')}
            >
              <p>Waiting for all players to choose a skill…</p>
            </div>
          ) : null}

        {session && gameplayPause ? (
          <GameplayPauseMenu
            audio={audio}
            onLeave={leaveGameplay}
            onResume={() => session.requestGameplayPause(false)}
            pause={gameplayPause}
            playerId={session.playerId}
            style={nativeStageStyle}
          />
        ) : null}

        {(preparing || connectionError) && (
          <div className="main-menu-runtime-status" role={connectionError ? 'alert' : 'status'}>
            {connectionError ?? 'Opening the web playtest…'}
          </div>
        )}

        {settingsOpen && titleScreen ? (
          <GameSettingsDialog
            onChange={updateGameSettings}
            onClose={() => setSettingsOpen(false)}
            settings={gameSettings}
          />
        ) : null}

        <div
          className={`main-menu-screen-fade main-menu-screen-fade-${fadeState}`}
          onAnimationEnd={handleFadeEnd}
          aria-hidden
        />
      </section>
      {loading && <MatchLoadingScreen loading={loading} />}
      <div className="game-orientation-hint" role="status">
        Rotate your device to landscape to enter the College.
      </div>
      <GameFullscreenButton />
    </div>
  )
}

function gameplayAudioScene(snapshot: GameSnapshot): GameAudioScene | null {
  if (snapshot.run.phase === 'game-over') return 'game-over'
  if (snapshot.world.kind !== 'boneyard') return null
  return snapshot.world.waves?.phase && snapshot.world.waves.phase !== 'dormant'
    ? 'boneyard-combat'
    : 'boneyard'
}

function fixedStageStyle(
  viewport: FixedGameViewportLayout,
  stage: GameViewportBounds,
): CSSProperties {
  const bounds = fixedGameStageCssBounds(viewport, stage)
  return {
    height: `${GAME_VIEWPORT_MIN_HEIGHT}px`,
    transform: `translate3d(${bounds.x}px, ${bounds.y}px, 0) scale(${viewport.displayScale})`,
    width: `${GAME_VIEWPORT_MIN_WIDTH}px`,
  }
}

function sameFixedViewport(
  first: FixedGameViewportLayout,
  second: FixedGameViewportLayout,
): boolean {
  return first.displayScale === second.displayScale
    && first.height === second.height
    && first.width === second.width
    && first.nativeStage.x === second.nativeStage.x
    && first.nativeStage.y === second.nativeStage.y
}

function sameRuntimeScene(
  current: GameSnapshot | null,
  next: GameSnapshot,
): boolean {
  if (
    !current
    || current.hostPlayerId !== next.hostPlayerId
    || !sameLevelUpBarrier(current.levelUpBarrier, next.levelUpBarrier)
    || current.run.phase !== next.run.phase
    || current.world.kind !== next.world.kind
  ) return false
  if (current.world.kind === 'boneyard' && next.world.kind === 'boneyard') {
    return current.world.runId === next.world.runId
  }
  return current.world.kind === 'hub'
}

function sameLevelUpBarrier(
  first: GameSnapshot['levelUpBarrier'],
  second: GameSnapshot['levelUpBarrier'],
): boolean {
  if (first === null || second === null) return first === second
  return first.barrierId === second.barrierId
    && first.milestoneExperience === second.milestoneExperience
    && first.milestoneLevel === second.milestoneLevel
    && first.runId === second.runId
    && first.sourcePlayerId === second.sourcePlayerId
    && first.participantIds.length === second.participantIds.length
    && first.participantIds.every((playerId, index) => (
      playerId === second.participantIds[index]
    ))
    && first.pendingPlayerIds.length === second.pendingPlayerIds.length
    && first.pendingPlayerIds.every((playerId, index) => (
      playerId === second.pendingPlayerIds[index]
    ))
}

function sameRuntimeProgression(
  current: ProtocolPlayerProgression | null,
  next: ProtocolPlayerProgression | null,
): boolean {
  if (!current || !next) return current === next
  return current.revision === next.revision
    && current.currentHealth === next.currentHealth
    && current.currentMana === next.currentMana
    && current.deathEpoch === next.deathEpoch
    && current.deathTick === next.deathTick
    && current.lifeState === next.lifeState
    && current.poisonDamagePerTick === next.poisonDamagePerTick
    && current.poisonTicksRemaining === next.poisonTicksRemaining
}
