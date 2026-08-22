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
import DarkCloudScene from './DarkCloudScene.tsx'
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
import GameChat, { type GameChatWhisperRequest } from './GameChat.tsx'
import GameSaveModMismatchDialog from './GameSaveModMismatchDialog.tsx'
import GameplayPauseMenu from './GameplayPauseMenu.tsx'
import GameSettingsDialog, { type GameSettingsContext } from './GameSettingsDialog.tsx'
import HallOfFameScene from './HallOfFameScene.tsx'
import { HallOfFameRunRecorder } from './client/hall-of-fame-run-recorder.ts'
import type {
  HallOfFameBoard,
  HallOfFameEntry,
} from './core-kernels/hall-of-fame.ts'
import {
  readLocalHallOfFame,
  recordLocalHallOfFame,
} from './hall-of-fame-store.ts'
import { installGameLuaConsole } from './game-lua-console.ts'
import {
  GAME_SETTINGS_STORAGE_KEY,
  gameCheatsEnabled,
  gameVolume,
  readGameSettings,
  setGameSettings,
  subscribeGameSettings,
  type GameSettings,
} from './game-settings.ts'
import { createGamepadMenuNavigation } from './input/gamepad-menu-navigation.ts'
import {
  NATIVE_DARK_CLOUD_GUEST_MENU_ROWS,
  NATIVE_DARK_CLOUD_MENU_ROWS,
  nativePauseMenuStagePlacement,
  type NativePauseMenuStagePlacement,
} from './pause-menu-contract.ts'
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
  GameContentIdentity,
  GameSnapshot,
  GameplayPauseSource,
  GameplayPauseState,
  LoadedBoneyard,
} from './protocol/game-protocol.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import type { LocalPartyState } from './protocol/party-state.ts'
import type {
  GameSaveCheckpoint,
  ResumableGameSave,
} from './save/game-save-contract.ts'
import { gameSaveModMismatch, type GameSaveModMismatch } from './save/game-save-mods.ts'
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
const loadSkillBook = () => import('./SkillBook.tsx')
const SkillBook = lazy(loadSkillBook)

/** The Dark Cloud's Esc menu is the native simple menu with the local viewer as its owner. */
const DARK_CLOUD_PAUSE_OWNER_ID = 'dark-cloud'
const DARK_CLOUD_PAUSE: GameplayPauseState = {
  ownerDisplayName: 'The Dark Cloud',
  ownerPlayerId: DARK_CLOUD_PAUSE_OWNER_ID,
  source: 'pause-menu',
}

type MenuScreen = 'root' | 'play' | 'dark-cloud' | 'hall' | 'create' | 'hub'
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
  onHall,
  onHighlight,
  onExplore,
  onPlay,
  onPress,
  onPressState,
  onSettings,
}: ActionGroupProps & {
  onExplore: () => void
  onHall: () => void
  onPlay: () => void
  onSettings: () => void
}) {
  return (
    <>
      <MenuButton action="play" accessibleLabel="Play" defaultFocus onClick={onPlay} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="explore" accessibleLabel="Explore the Dark Cloud" onClick={onExplore} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="settings" accessibleLabel="Settings" onClick={onSettings} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="hall" accessibleLabel="Hall of Fame" onClick={onHall} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
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
  activeMods: readonly GameContentIdentity[]
  accountUsername: string | null
  displayName: string
  connectSession: (
    character: PlayerCharacterConfig,
    onProgress: (stage: GameConnectionStage) => void,
    cheatsEnabled: boolean,
    saveDocument?: string,
    allowModMismatch?: boolean,
  ) => Promise<GameClientSession>
  initialScreen?: 'create' | 'root'
  loadGlobalHallOfFame: (board: HallOfFameBoard) => Promise<readonly HallOfFameEntry[]>
  onCancelCreate: () => Promise<void>
  onSaveCheckpoint: (checkpoint: GameSaveCheckpoint) => void
  onSignOut: () => void
  prepareNewGame: () => Promise<void>
  resumeSave: ResumableGameSave | null
  submitGlobalHallOfFame: (receipt: string) => Promise<void>
}

export default function MainMenuScene({
  activeMods,
  accountUsername,
  connectSession,
  displayName,
  initialScreen = 'root',
  loadGlobalHallOfFame,
  onCancelCreate,
  onSaveCheckpoint,
  onSignOut,
  prepareNewGame,
  resumeSave,
  submitGlobalHallOfFame,
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
  const [partyState, setPartyState] = useState<LocalPartyState | null>(null)
  const [whisperRequest, setWhisperRequest] = useState<GameChatWhisperRequest | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [gameplaySettingsOpen, setGameplaySettingsOpen] = useState(false)
  const activeBoneyardRunRef = useRef<string | null>(null)
  const loadedBoneyardRunRef = useRef<string | null>(null)
  const levelUpPickerPresentationRef = useRef<number | null>(null)
  const levelUpSoundBarrierRef = useRef<number | null>(null)
  const [levelUpPickerClosing, setLevelUpPickerClosing] = useState(false)
  const [skillBookOpen, setSkillBookOpen] = useState(false)
  const [inventoryScreenOpen, setInventoryScreenOpen] = useState(false)
  const [inventoryRequestSequence, setInventoryRequestSequence] = useState(0)
  const [loading, setLoading] = useState<MatchLoadingState | null>(null)
  const loadingRef = useRef<MatchLoadingState | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [hoveredTitleAction, setHoveredTitleAction] = useState<TitleMenuAction | null>(null)
  const [pressedTitleAction, setPressedTitleAction] = useState<TitleMenuAction | null>(null)
  const [settingsContext, setSettingsContext] = useState<GameSettingsContext | null>(null)
  const [darkCloudMenuOpen, setDarkCloudMenuOpen] = useState(false)
  const [modMismatch, setModMismatch] = useState<GameSaveModMismatch | null>(null)
  const [gameSettings, setLocalGameSettings] = useState(readGameSettings)
  const [localHallOfFame, setLocalHallOfFame] = useState(readLocalHallOfFame)
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
    session?.setCheatsEnabled(gameSettings.enableCheats)
  }, [gameSettings.enableCheats, session])

  useEffect(() => {
    audio.setVolumes(
      gameVolume(gameSettings.soundVolumePercent),
      gameVolume(gameSettings.musicVolumePercent),
    )
  }, [audio, gameSettings.musicVolumePercent, gameSettings.soundVolumePercent])

  useEffect(() => {
    if (!gameplayPause) setGameplaySettingsOpen(false)
  }, [gameplayPause])

  const updateGameSettings = useCallback((settings: GameSettings) => {
    setLocalGameSettings(setGameSettings(settings))
  }, [])

  const openDarkCloudMenu = useCallback(() => setDarkCloudMenuOpen(true), [])

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
    const hallRecorder = new HallOfFameRunRecorder()
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
    setPartyState(session.getPartyState())
    recordHallSnapshot(initialSnapshot)
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
      recordHallSnapshot(snapshot)
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
    const removeLeaderboardReceipt = session.onLeaderboardReceipt((receipt) => {
      if (gameCheatsEnabled()) return
      void submitGlobalHallOfFame(receipt)
    })
    const removePartyState = session.onPartyState(setPartyState)
    const removeSaveCheckpoint = session.onSaveCheckpoint(onSaveCheckpoint)
    return () => {
      removeSnapshot()
      removeBoneyard()
      removeGameplayPause()
      removeLeaderboardReceipt()
      removePartyState()
      removeSaveCheckpoint()
    }

    function recordHallSnapshot(snapshot: GameSnapshot) {
      const entry = hallRecorder.observe(snapshot, session!.playerId, accountUsername)
      if (!entry) return
      setLocalHallOfFame(recordLocalHallOfFame(entry))
    }
  }, [accountUsername, advanceLoading, beginLoading, onSaveCheckpoint, session, submitGlobalHallOfFame])

  useEffect(() => {
    if (runtimeSnapshot?.world.kind === 'boneyard') void loadSkillPicker()
  }, [runtimeSnapshot?.world.kind])

  const runtimeConnected = runtimeSnapshot !== null
  useEffect(() => {
    if (runtimeConnected) void loadSkillBook()
  }, [runtimeConnected])

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
    if (screen === 'hub' || settingsContext || gameplaySettingsOpen
      || modMismatch || !stageRef.current) return
    const navigation = createGamepadMenuNavigation({ root: stageRef.current })
    return () => navigation.destroy()
  }, [gameplaySettingsOpen, modMismatch, screen, settingsContext])

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
  const darkCloudMenuRows = accountUsername ? NATIVE_DARK_CLOUD_MENU_ROWS : NATIVE_DARK_CLOUD_GUEST_MENU_ROWS
  const darkCloudPauseStageStyle = placedStageStyle(
    nativePauseMenuStagePlacement(fixedViewport, darkCloudMenuRows),
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
      setConnectionError(error instanceof Error ? error.message : 'Shared Hub admission failed.')
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
      setConnectionError(error instanceof Error ? error.message : 'The shared Hub admission could not be closed.')
    } finally {
      setPreparing(false)
    }
  }

  const activateSession = (nextSession: GameClientSession) => {
    const snapshot = nextSession.getSnapshot()
    setWhisperRequest(null)
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

  const resumeLastGame = async (allowModMismatch = false) => {
    if (!resumeSave || preparing || connecting) return
    const flow: MatchLoadingFlow = resumeSave.summary.worldKind === 'boneyard'
      ? 'boneyard'
      : 'hub'
    setPreparing(true)
    setConnectionError(null)
    try {
      await prepareNewGame()
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Shared Hub admission failed.')
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
        gameSettings.enableCheats,
        resumeSave.document,
        allowModMismatch,
      )
      activateSession(nextSession)
    } catch (error) {
      cancelLoading(flow)
      setConnectionError(error instanceof Error ? error.message : 'Saved game connection failed.')
    } finally {
      setConnecting(false)
    }
  }

  const requestResumeLastGame = () => {
    if (!resumeSave) return
    const mismatch = gameSaveModMismatch(resumeSave.mods, activeMods)
    if (mismatch) {
      setModMismatch(mismatch)
      return
    }
    void resumeLastGame()
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
        gameSettings.enableCheats,
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
    session?.requestGameplayPause('pause-menu')
  }, [session])

  const leaveGameplay = () => {
    session?.destroy()
    setSession(null)
    setRuntimeSnapshot(null)
    setRuntimeProgression(null)
    setRuntimeAudioScene(null)
    setLoadedBoneyard(null)
    setGameplayPause(null)
    setPartyState(null)
    setWhisperRequest(null)
    setChatOpen(false)
    setGameplaySettingsOpen(false)
    setSkillBookOpen(false)
    setInventoryScreenOpen(false)
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
  const ownsBookPause = gameplayPause !== null
    && gameplayPause.ownerPlayerId === session?.playerId
    && gameplayPause.source !== 'pause-menu'
  const ownsActiveInventoryPause = ownsBookPause
    && gameplayPause?.source === 'inventory'
    && inventoryScreenOpen
  const chatDisabled = loading !== null
    || levelUpModalActive
    || skillBookOpen
    || inventoryScreenOpen
    || gameplayPause !== null
  const sceneInputBlocked = chatOpen
    || loading !== null
    || levelUpModalActive
    || skillBookOpen
    || (gameplayPause !== null && !ownsActiveInventoryPause)
  const desiredBookPauseSource: GameplayPauseSource | null = skillBookOpen
    ? 'skill-book'
    : inventoryScreenOpen
      ? 'inventory'
      : null
  const openSkillBook = useCallback(() => {
    if (
      !session
      || loading !== null
      || levelUpModalActive
      || (gameplayPause !== null && !ownsBookPause)
      || (runtimeRunPhase !== 'hub' && runtimeRunPhase !== 'active')
    ) return
    setSkillBookOpen(true)
  }, [gameplayPause, levelUpModalActive, loading, ownsBookPause, runtimeRunPhase, session])

  useEffect(() => {
    if (
      loading !== null
      || levelUpModalActive
      || (gameplayPause !== null && !ownsBookPause)
    ) {
      setSkillBookOpen(false)
      setInventoryScreenOpen(false)
    }
  }, [gameplayPause, levelUpModalActive, loading, ownsBookPause])
  useEffect(() => {
    if (!session) return
    if (desiredBookPauseSource !== null) {
      if (gameplayPause === null || ownsBookPause) {
        session.requestGameplayPause(desiredBookPauseSource)
      }
      return
    }
    if (ownsBookPause) session.requestGameplayPause(null)
  }, [desiredBookPauseSource, gameplayPause, ownsBookPause, session])
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
    <div
      className="main-menu-page"
      data-chat-open={chatOpen}
      data-game-scene={gameScene}
      data-skill-book-open={skillBookOpen}
    >
      <section
        ref={stageRef}
        className="main-menu-stage"
        aria-label="Solomon Darker game menu"
      >
        {screen === 'hall' ? (
          <HallOfFameScene
            loadGlobal={loadGlobalHallOfFame}
            localEntries={localHallOfFame}
            onBack={() => transitionTo('root')}
            stageStyle={nativeStageStyle}
          />
        ) : titleScreen ? (
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
                    onHall={() => transitionTo('hall')}
                    onHighlight={setHoveredTitleAction}
                    onExplore={() => transitionTo('dark-cloud')}
                    onPlay={() => setScreen('play')}
                    onPress={() => audio.playSound('click')}
                    onPressState={setPressedTitleAction}
                    onSettings={() => setSettingsContext('title')}
                  />
                ) : (
                  <PlayActions
                    canResume={resumeSave !== null}
                    onBack={() => setScreen('root')}
                    onHighlight={setHoveredTitleAction}
                    onLastGame={requestResumeLastGame}
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
        ) : screen === 'dark-cloud' ? (
          <>
            <div className="main-menu-native-stage dark-cloud-stage" inert={darkCloudMenuOpen || undefined}>
              <DarkCloudScene
                accountUsername={accountUsername}
                menuKeyCode={gameSettings.controls.openMenu}
                menuOpen={darkCloudMenuOpen || settingsContext !== null}
                onEnterSharedHub={() => { void beginNewGame() }}
                onMenu={openDarkCloudMenu}
              />
            </div>
            {darkCloudMenuOpen ? (
              <GameplayPauseMenu
                audio={audio}
                className="dark-cloud-pause-stage"
                escapeAction={null}
                onSelect={(action) => {
                  setDarkCloudMenuOpen(false)
                  if (action === 'settings') setSettingsContext('dark-cloud')
                  else if (action === 'sign-out') onSignOut()
                  else if (action === 'leave') transitionTo('root')
                }}
                pause={DARK_CLOUD_PAUSE}
                playerId={DARK_CLOUD_PAUSE_OWNER_ID}
                rows={darkCloudMenuRows}
                style={darkCloudPauseStageStyle}
              />
            ) : null}
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
              inputBlocked={sceneInputBlocked}
              inventoryRequestSequence={inventoryRequestSequence}
              modAssets={session.modAssets}
              modCatalog={session.getModCatalog()}
              levelUpPresentationId={levelUpPresentationId}
              nativeUiStageStyle={nativeStageStyle}
              playerId={session.playerId}
              initialSnapshot={runtimeSnapshot}
              onInput={session.sendInput}
              onLoadingError={cancelBoneyardLoading}
              onHubAction={session.sendHubAction}
              onInventoryOpenChange={setInventoryScreenOpen}
              onOpenSkills={openSkillBook}
              onPauseRequest={requestGameplayPause}
              onReady={finishBoneyardLoading}
              progression={runtimeProgression ?? runtimeSnapshot.players[session.playerId]!.progression}
              presentationPaused={gameplayPause !== null}
              samplePresentation={session.sampleBoneyardPresentation}
              settings={gameSettings}
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
              inputBlocked={sceneInputBlocked}
              inventoryRequestSequence={inventoryRequestSequence}
              modAssets={session.modAssets}
              levelUpPresentationId={levelUpPresentationId}
              nativeUiStageStyle={nativeStageStyle}
              playerId={session.playerId}
              progression={runtimeProgression ?? runtimeSnapshot.players[session.playerId]!.progression}
              initialSnapshot={runtimeSnapshot}
              onInput={session.sendInput}
              onAcceptPartyInvitation={session.acceptPartyInvitation}
              onDenyPartyInvitation={session.denyPartyInvitation}
              onHubAction={session.sendHubAction}
              onInventoryOpenChange={setInventoryScreenOpen}
              onInvitePlayer={session.inviteToParty}
              onLoadingError={cancelHubLoading}
              onMessagePlayer={(playerId, displayName) => setWhisperRequest({
                displayName,
                playerId,
                requestedAtMs: Date.now(),
              })}
              onOpenSkills={openSkillBook}
              onPauseRequest={requestGameplayPause}
              onReady={finishHubLoading}
              onStartMatch={startBoneyard}
              partyState={partyState}
              presentationPaused={gameplayPause !== null}
              samplePresentation={session.samplePresentation}
              settings={gameSettings}
              subscribePing={session.onPing}
              subscribe={session.onSnapshot}
            />
          </Suspense>
        ) : null}

        {session && runtimeSnapshot ? (
          <GameChat
            disabled={chatDisabled}
            onOpenChange={setChatOpen}
            onWhisperRequestHandled={() => setWhisperRequest(null)}
            openKeyCode={gameSettings.controls.openChat}
            partyState={partyState}
            session={session}
            whisperRequest={whisperRequest}
            worldKind={runtimeSnapshot.world.kind}
          />
        ) : null}

        {session && skillBookOpen && runtimeProgression ? (
          <Suspense fallback={null}>
            <SkillBook
              economy={runtimeSnapshot!.players[session.playerId]!.economy}
              onAssignQuickbarSkill={session.bindSkillQuickbar}
              onClose={() => setSkillBookOpen(false)}
              onOpenInventory={() => {
                setInventoryScreenOpen(true)
                setInventoryRequestSequence((sequence) => sequence + 1)
              }}
              onSelectConcentration={session.selectConcentration}
              onSelectPrimarySkill={session.selectPrimarySkill}
              playerId={session.playerId}
              progression={runtimeProgression}
              style={nativeStageStyle}
              subscribeSnapshot={session.onSnapshot}
              topMost
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

        {session
          && gameplayPause
          && !gameplaySettingsOpen
          && (
            gameplayPause.source === 'pause-menu'
            || gameplayPause.ownerPlayerId !== session.playerId
          ) ? (
          <GameplayPauseMenu
            audio={audio}
            onSelect={(action) => {
              if (action === 'leave') leaveGameplay()
              else if (action === 'settings') setGameplaySettingsOpen(true)
              else if (action === 'resume') session.requestGameplayPause(null)
            }}
            pause={gameplayPause}
            playerId={session.playerId}
            style={nativeStageStyle}
          />
        ) : null}

        {session
          && gameplayPause?.ownerPlayerId === session.playerId
          && gameplaySettingsOpen ? (
            <GameSettingsDialog
              context="gameplay"
              onChange={updateGameSettings}
              onClose={() => {
                setGameplaySettingsOpen(false)
                session.requestGameplayPause(null)
              }}
              onSelectConcentration={session.selectConcentration}
              onSelectPrimarySkill={session.selectPrimarySkill}
              progression={runtimeProgression
                ?? runtimeSnapshot!.players[session.playerId]!.progression}
              settings={gameSettings}
            />
          ) : null}

        {(preparing || connectionError) && (
          <div className="main-menu-runtime-status" role={connectionError ? 'alert' : 'status'}>
            {connectionError ?? 'Entering the shared Hub…'}
          </div>
        )}

        {settingsContext && !gameplaySettingsOpen ? (
          <GameSettingsDialog
            context={settingsContext}
            onChange={updateGameSettings}
            onClose={() => setSettingsContext(null)}
            settings={gameSettings}
          />
        ) : null}

        {modMismatch ? (
          <GameSaveModMismatchDialog
            mismatch={modMismatch}
            onCancel={() => setModMismatch(null)}
            onContinue={() => {
              setModMismatch(null)
              void resumeLastGame(true)
            }}
            style={nativeStageStyle}
          />
        ) : null}

        <div
          className={`main-menu-screen-fade main-menu-screen-fade-${fadeState}${screen === 'hall' ? ' main-menu-screen-fade-hall-close' : ''}`}
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
  return stageTransformStyle(bounds.x, bounds.y, viewport.displayScale)
}

function placedStageStyle(placement: NativePauseMenuStagePlacement): CSSProperties {
  return stageTransformStyle(placement.x, placement.y, placement.scale)
}

function stageTransformStyle(x: number, y: number, scale: number): CSSProperties {
  return {
    height: `${GAME_VIEWPORT_MIN_HEIGHT}px`,
    transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
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
    && current.maximumHealth === next.maximumHealth
    && current.maximumMana === next.maximumMana
    && current.poisonDamagePerTick === next.poisonDamagePerTick
    && current.poisonTicksRemaining === next.poisonTicksRemaining
    && current.selectedPrimarySkillId === next.selectedPrimarySkillId
    && current.weldBuildId === next.weldBuildId
    && current.skillQuickbar.every((skillId, index) => skillId === next.skillQuickbar[index])
    && current.concentrationSkillIds.every((skillId, index) => (
      skillId === next.concentrationSkillIds[index]
    ))
}
