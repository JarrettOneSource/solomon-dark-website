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
import JoinPartyScene from './JoinPartyScene.tsx'
import ModdedPlayDialog from './ModdedPlayDialog.tsx'
import PartyJoinConsentDialog from './PartyJoinConsentDialog.tsx'
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
  nativeHudSkillSelectorTarget,
  type NativeHudSkillSelectorTarget,
} from './hud-skill-selector.ts'
import type { NativeHudSkillBinding } from './native-hud-presentation.ts'
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
  GameChatMessage,
  GameSnapshot,
  GameplayPauseSource,
  GameplayPauseState,
  LoadedBoneyard,
  PartyActionRejection,
} from './protocol/game-protocol.ts'
import {
  api,
  type ActiveWebMod,
  type PartyJoinResolution,
} from '../lib/api.ts'
import {
  prefetchGameContent,
  type GameContentDownloadProgress,
} from './game-content-cache.ts'
import type { BrowserGameAdmission } from './game-bootstrap.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import type { LocalPartyState } from './protocol/party-state.ts'
import {
  PARTY_INVITATION_SOUND_REQUEST,
  advancePartyInvitationAudioCursor,
  createPartyInvitationAudioCursor,
  type PartyInvitationAudioCursor,
} from './party-invitation-audio.ts'
import {
  appendGameWorldSpeech,
  type GameWorldSpeech,
} from './world-speech-presentation.ts'
import type {
  GameProfileSave,
  GameSaveCheckpoint,
  GameSaveIntent,
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
const loadHudSkillSelector = () => import('./HudSkillSelector.tsx')
const HudSkillSelector = lazy(loadHudSkillSelector)

/** The Dark Cloud's Esc menu is the native simple menu with the local viewer as its owner. */
const DARK_CLOUD_PAUSE_OWNER_ID = 'dark-cloud'
const DARK_CLOUD_PAUSE: GameplayPauseState = {
  ownerDisplayName: 'The Dark Cloud',
  ownerPlayerId: DARK_CLOUD_PAUSE_OWNER_ID,
  source: 'pause-menu',
}

type MenuScreen = 'root' | 'play' | 'join-party' | 'dark-cloud' | 'hall' | 'create' | 'hub'
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
      data-game-action={action}
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
  onJoinParty,
  onNewGame,
  onPress,
  onPressState,
}: ActionGroupProps & {
  canResume: boolean
  onBack: () => void
  onLastGame: () => void
  onJoinParty: () => void
  onNewGame: () => void
}) {
  return (
    <>
      <MenuButton action="last-game" accessibleLabel="Last game" className="main-menu-button-last-game" defaultFocus={canResume} disabled={!canResume} onClick={onLastGame} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="new-game" accessibleLabel="New game" defaultFocus={!canResume} onClick={onNewGame} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="join-party" accessibleLabel="Join party" onClick={onJoinParty} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="back" accessibleLabel="Back" isBack onClick={onBack} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
    </>
  )
}

interface MainMenuSceneProps {
  activeMods: readonly ActiveWebMod[]
  accountUsername: string | null
  displayName: string
  connectSession: (
    character: PlayerCharacterConfig,
    onProgress: (stage: GameConnectionStage) => void,
    cheatsEnabled: boolean,
    saveDocument?: string,
    saveIntent?: GameSaveIntent,
    allowModMismatch?: boolean,
  ) => Promise<GameClientSession>
  developerAccess: boolean
  initialScreen?: 'create' | 'root'
  loadGlobalHallOfFame: (board: HallOfFameBoard) => Promise<readonly HallOfFameEntry[]>
  onCancelCreate: () => Promise<void>
  onSaveCheckpoint: (checkpoint: GameSaveCheckpoint) => void
  persistSaveCheckpoint: (checkpoint: GameSaveCheckpoint) => Promise<void>
  onSignOut: () => void
  prepareGame: (admission: BrowserGameAdmission) => Promise<void>
  profileSave: GameProfileSave | null
  refreshActiveMods: () => Promise<readonly ActiveWebMod[]>
  resumeSave: ResumableGameSave | null
  submitGlobalHallOfFame: (receipt: string) => Promise<void>
}

export default function MainMenuScene({
  activeMods,
  accountUsername,
  connectSession,
  developerAccess,
  displayName,
  initialScreen = 'root',
  loadGlobalHallOfFame,
  onCancelCreate,
  onSaveCheckpoint,
  onSignOut,
  persistSaveCheckpoint,
  prepareGame,
  profileSave,
  refreshActiveMods,
  resumeSave,
  submitGlobalHallOfFame,
}: MainMenuSceneProps) {
  const audio = useMemo(createBrowserGameAudioDirector, [])
  const stageRef = useRef<HTMLElement>(null)
  const [screen, setScreen] = useState<MenuScreen>(initialScreen)
  const [wizardName, setWizardName] = useState(() => (
    initialScreen === 'create' ? initialCreateWizardNameForSession(displayName) : ''
  ))
  const [partyRequesterName] = useState(() => initialCreateWizardNameForSession(displayName))
  const [fadeState, setFadeState] = useState<FadeState>('idle')
  const [fadeTarget, setFadeTarget] = useState<MenuScreen | null>(null)
  const [session, setSession] = useState<GameClientSession | null>(null)
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<GameSnapshot | null>(null)
  const [runtimeProgression, setRuntimeProgression] = useState<ProtocolPlayerProgression | null>(null)
  const [runtimeRunPhase, setRuntimeRunPhase] = useState<GameRunPhase>('hub')
  const [runtimeAudioScene, setRuntimeAudioScene] = useState<GameAudioScene | null>(null)
  const [loadedBoneyard, setLoadedBoneyard] = useState<LoadedBoneyard | null>(null)
  const [gameplayPause, setGameplayPause] = useState<GameplayPauseState | null>(null)
  const [hubPauseMenuOpen, setHubPauseMenuOpen] = useState(false)
  const [gameplayPauseMenuGeneration, setGameplayPauseMenuGeneration] = useState(0)
  const [partyState, setPartyState] = useState<LocalPartyState | null>(null)
  const partyInvitationAudioCursorRef = useRef<PartyInvitationAudioCursor | null>(null)
  const [partyActionError, setPartyActionError] = useState<string | null>(null)
  const [whisperRequest, setWhisperRequest] = useState<GameChatWhisperRequest | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [worldSpeeches, setWorldSpeeches] = useState<readonly GameWorldSpeech[]>([])
  const [gameplaySettingsOpen, setGameplaySettingsOpen] = useState(false)
  const activeBoneyardRunRef = useRef<string | null>(null)
  const loadedBoneyardRunRef = useRef<string | null>(null)
  const levelUpPickerPresentationRef = useRef<number | null>(null)
  const levelUpSoundBarrierRef = useRef<number | null>(null)
  const [levelUpPickerClosing, setLevelUpPickerClosing] = useState(false)
  const [skillBookOpen, setSkillBookOpen] = useState(false)
  const [hudSkillSelector, setHudSkillSelector] = useState<NativeHudSkillSelectorTarget | null>(null)
  const [inventoryScreenOpen, setInventoryScreenOpen] = useState(false)
  const [inventoryRequestSequence, setInventoryRequestSequence] = useState(0)
  const [loading, setLoading] = useState<MatchLoadingState | null>(null)
  const loadingRef = useRef<MatchLoadingState | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [hoveredTitleAction, setHoveredTitleAction] = useState<TitleMenuAction | null>(null)
  const [pressedTitleAction, setPressedTitleAction] = useState<TitleMenuAction | null>(null)
  const [settingsContext, setSettingsContext] = useState<GameSettingsContext | null>(null)
  const [darkCloudMenuOpen, setDarkCloudMenuOpen] = useState(false)
  const [modMismatch, setModMismatch] = useState<GameSaveModMismatch | null>(null)
  const [newGameMismatchAdmission, setNewGameMismatchAdmission] =
    useState<BrowserGameAdmission | null>(null)
  const [newGameModMismatchAllowed, setNewGameModMismatchAllowed] = useState(false)
  const [moddedPlayPrompt, setModdedPlayPrompt] = useState(false)
  const [partyConsent, setPartyConsent] = useState<PartyJoinResolution | null>(null)
  const [pendingAdmission, setPendingAdmission] = useState<BrowserGameAdmission>({
    kind: 'global-hub',
  })
  const [routingBusy, setRoutingBusy] = useState(false)
  const [contentProgress, setContentProgress] = useState<GameContentDownloadProgress | null>(null)
  const [cheatCollegePrompt, setCheatCollegePrompt] = useState(false)
  const [gameSettings, setLocalGameSettings] = useState(readGameSettings)
  const cheatsEnabled = gameSettings.enableCheats && !developerAccess
  const [localHallOfFame, setLocalHallOfFame] = useState(readLocalHallOfFame)
  const [currentHallRunId, setCurrentHallRunId] = useState<string | null>(null)
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
  const presentWorldSpeech = useCallback((message: GameChatMessage) => {
    const receivedAtMs = performance.now()
    setWorldSpeeches(current => appendGameWorldSpeech(current, message, receivedAtMs))
  }, [])

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
    if (!session || (!session.developerAccess && (!cheatsEnabled || !session.isHost))) return
    return installGameLuaConsole(window, session)
  }, [cheatsEnabled, runtimeSnapshot?.hostPlayerId, session])

  useEffect(() => {
    session?.setCheatsEnabled(cheatsEnabled)
  }, [cheatsEnabled, session])

  useEffect(() => {
    audio.setVolumes(
      gameVolume(gameSettings.soundVolumePercent),
      gameVolume(gameSettings.musicVolumePercent),
    )
  }, [audio, gameSettings.musicVolumePercent, gameSettings.soundVolumePercent])

  useEffect(() => {
    if (gameplayPause) setHubPauseMenuOpen(false)
    else if (!hubPauseMenuOpen) setGameplaySettingsOpen(false)
  }, [gameplayPause, hubPauseMenuOpen])

  const updateGameSettings = useCallback((settings: GameSettings) => {
    setLocalGameSettings(setGameSettings(settings))
  }, [])

  useEffect(() => {
    if (developerAccess && gameSettings.enableCheats) {
      updateGameSettings({ ...gameSettings, enableCheats: false })
    }
  }, [developerAccess, gameSettings, updateGameSettings])

  const requestGameSettingsUpdate = useCallback((settings: GameSettings) => {
    if (developerAccess && settings.enableCheats) {
      updateGameSettings({ ...settings, enableCheats: false })
      return
    }
    if (
      session?.sessionKind === 'global-hub'
      && !cheatsEnabled
      && settings.enableCheats
    ) {
      setCheatCollegePrompt(true)
      return
    }
    updateGameSettings(settings)
  }, [cheatsEnabled, developerAccess, session, updateGameSettings])

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
    setWorldSpeeches([])
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
    const initialPartyState = session.getPartyState()
    partyInvitationAudioCursorRef.current = initialPartyState
      ? createPartyInvitationAudioCursor(initialPartyState.invitations.map(({ id }) => id))
      : null
    setPartyState(initialPartyState)
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
    const removePartyAction = session.onPartyAction(result => {
      setPartyActionError(result.ok ? null : partyActionErrorMessage(result.reason))
    })
    const removePartyState = session.onPartyState((nextPartyState) => {
      if (partyInvitationAudioCursorRef.current === null) {
        partyInvitationAudioCursorRef.current = createPartyInvitationAudioCursor(
          nextPartyState.invitations.map(({ id }) => id),
        )
        setPartyState(nextPartyState)
        return
      }
      const delta = advancePartyInvitationAudioCursor(
        partyInvitationAudioCursorRef.current,
        nextPartyState.invitations.map(({ id }) => id),
      )
      partyInvitationAudioCursorRef.current = delta.cursor
      for (let index = 0; index < delta.newInvitationCount; index += 1) {
        audio.playSound(PARTY_INVITATION_SOUND_REQUEST.cue, {
          playbackRate: PARTY_INVITATION_SOUND_REQUEST.playbackRate,
          volume: PARTY_INVITATION_SOUND_REQUEST.volume,
        })
      }
      setPartyState(nextPartyState)
    })
    const removeSaveCheckpoint = session.onSaveCheckpoint(onSaveCheckpoint)
    return () => {
      removeSnapshot()
      removeBoneyard()
      removeGameplayPause()
      removeLeaderboardReceipt()
      removePartyAction()
      removePartyState()
      partyInvitationAudioCursorRef.current = null
      removeSaveCheckpoint()
    }

    function recordHallSnapshot(snapshot: GameSnapshot) {
      const entry = hallRecorder.observe(snapshot, session!.playerId, accountUsername)
      if (!entry) return
      setLocalHallOfFame(recordLocalHallOfFame(entry))
      setCurrentHallRunId(entry.runId)
    }
  }, [accountUsername, advanceLoading, audio, beginLoading, onSaveCheckpoint, session, submitGlobalHallOfFame])

  useEffect(() => {
    if (runtimeSnapshot?.world.kind === 'boneyard') void loadSkillPicker()
  }, [runtimeSnapshot?.world.kind])

  useEffect(() => {
    if (runtimeSnapshot?.world.kind !== 'hub') setHubPauseMenuOpen(false)
  }, [runtimeSnapshot?.world.kind])

  const runtimeConnected = runtimeSnapshot !== null
  useEffect(() => {
    if (runtimeConnected) {
      void loadSkillBook()
      void loadHudSkillSelector()
    }
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

  const controllerNavigationRef = useRef({
    enabled: true,
    requireModal: false,
  })
  controllerNavigationRef.current = {
    enabled: loading === null && !connecting && !leaving && !preparing && fadeState === 'idle',
    requireModal: screen === 'hub',
  }
  useEffect(() => {
    if (!stageRef.current) return
    const navigation = createGamepadMenuNavigation({
      enabled: () => controllerNavigationRef.current.enabled,
      requireModal: () => controllerNavigationRef.current.requireModal,
      root: stageRef.current,
    })
    return () => navigation.destroy()
  }, [])

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

  const beginCreate = (
    admission: BrowserGameAdmission,
    allowModMismatch = false,
  ) => {
    setPendingAdmission(admission)
    setNewGameModMismatchAllowed(allowModMismatch)
    setPartyConsent(null)
    setModdedPlayPrompt(false)
    setWizardName(admission.kind === 'party'
      ? partyRequesterName
      : initialCreateWizardNameForSession(displayName))
    transitionTo('create')
  }

  const requestNewGameCreate = (
    admission: BrowserGameAdmission,
    mods: readonly ActiveWebMod[] = activeMods,
  ) => {
    const mismatch = profileSave ? gameSaveModMismatch(profileSave.mods, mods) : null
    if (mismatch) {
      setNewGameMismatchAdmission(admission)
      setModMismatch(mismatch)
      return
    }
    setNewGameMismatchAdmission(null)
    beginCreate(admission)
  }

  const beginNewGame = () => {
    if (preparing || connecting) return
    setConnectionError(null)
    if (activeMods.length > 0 || cheatsEnabled) {
      setModdedPlayPrompt(true)
      return
    }
    requestNewGameCreate({
      kind: profileSave?.integrity === 'local-only' ? 'private-college' : 'global-hub',
    })
  }

  const playVanilla = async () => {
    if (routingBusy) return
    setRoutingBusy(true)
    setConnectionError(null)
    try {
      if (accountUsername && activeMods.length > 0) {
        await api.mods.subscriptions.disableAll()
        await refreshActiveMods()
      }
      if (cheatsEnabled) {
        updateGameSettings({ ...gameSettings, enableCheats: false })
      }
      requestNewGameCreate({
        kind: profileSave?.integrity === 'local-only' ? 'private-college' : 'global-hub',
      }, [])
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Vanilla play could not be prepared.')
    } finally {
      setRoutingBusy(false)
    }
  }

  const continueLocal = async () => {
    if (routingBusy) return
    setRoutingBusy(true)
    setContentProgress(null)
    try {
      await prefetchGameContent(activeMods.flatMap(mod => mod.assets), setContentProgress)
      requestNewGameCreate({ kind: 'private-college' })
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Mod content could not be prepared.')
    } finally {
      setRoutingBusy(false)
    }
  }

  const resolveParty = (resolution: PartyJoinResolution) => {
    if (
      resolution.target.kind === 'global-hub'
      && activeMods.length === 0
      && !cheatsEnabled
    ) {
      beginCreate({ kind: 'party', intentId: resolution.intentId })
      return
    }
    setPartyConsent(resolution)
  }

  const continueParty = async () => {
    if (!partyConsent || routingBusy) return
    setRoutingBusy(true)
    setContentProgress(null)
    try {
      if (partyConsent.target.kind === 'global-hub') {
        if (accountUsername && activeMods.length > 0) {
          await api.mods.subscriptions.disableAll()
          await refreshActiveMods()
        }
        if (cheatsEnabled) {
          updateGameSettings({ ...gameSettings, enableCheats: false })
        }
      } else {
        if (accountUsername && partyConsent.target.content.mods.length > 0) {
          await api.mods.subscriptions.sync(partyConsent.target.content.mods)
          await refreshActiveMods()
        }
        await prefetchGameContent(
          partyConsent.target.content.mods.flatMap(mod => mod.assets),
          setContentProgress,
        )
      }
      beginCreate({ kind: 'party', intentId: partyConsent.intentId })
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'The party content could not be prepared.')
    } finally {
      setRoutingBusy(false)
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
    setHubPauseMenuOpen(false)
    if (snapshot.world.kind === 'hub') advanceLoading('materializing_participants')
    setScreen('hub')
  }

  const resumeLastGame = async (allowModMismatch = false) => {
    if (!resumeSave || preparing || connecting) return
    const flow: MatchLoadingFlow = resumeSave.summary.worldKind === 'boneyard'
      ? 'boneyard'
      : 'hub'
    setConnecting(true)
    setConnectionError(null)
    beginLoading(flow, 'connecting_transport')
    try {
      if (activeMods.length > 0) {
        await prefetchGameContent(activeMods.flatMap(mod => mod.assets), setContentProgress)
      }
      await prepareGame(
        resumeSave.integrity === 'local-only'
          || activeMods.length > 0
          || cheatsEnabled
          ? { kind: 'private-college' }
          : { kind: 'global-hub' },
      )
      const nextSession = await connectSession(
        resumeSave.summary.character,
        advanceLoading,
        cheatsEnabled,
        resumeSave.document,
        'resume',
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
      setNewGameMismatchAdmission(null)
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
      session.confirmLoadout(selectedElement, selectedDiscipline)
      return true
    }
    setConnecting(true)
    setConnectionError(null)
    try {
      await prepareGame(pendingAdmission)
      const nextSession = await connectSession(
        {
          discipline: selectedDiscipline,
          displayName: selectedDisplayName,
          element: selectedElement,
        },
        advanceLoading,
        cheatsEnabled,
        profileSave?.document,
        profileSave ? 'new-game' : undefined,
        newGameModMismatchAllowed,
      )
      activateSession(nextSession)
      setNewGameModMismatchAllowed(false)
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
    if (runtimeSnapshot?.world.kind === 'hub') {
      setHubPauseMenuOpen(true)
      return
    }
    session?.requestGameplayPause('pause-menu')
  }, [runtimeSnapshot?.world.kind, session])

  const localHubPause: GameplayPauseState | null = hubPauseMenuOpen
    && session
    && runtimeSnapshot?.world.kind === 'hub'
    ? {
        ownerDisplayName: runtimeSnapshot.players[session.playerId]!.config.displayName,
        ownerPlayerId: session.playerId,
        source: 'pause-menu',
      }
    : null
  const displayedGameplayPause = gameplayPause ?? localHubPause

  const leaveGameplay = async () => {
    if (!session || leaving) return
    setLeaving(true)
    setConnectionError(null)
    try {
      const checkpoint = await session.saveBeforeLeave()
      await persistSaveCheckpoint(checkpoint)
      session.destroy()
    } catch (error) {
      setConnectionError(error instanceof Error
        ? error.message
        : 'The game could not be saved before leaving.')
      setGameplayPauseMenuGeneration(current => current + 1)
      setLeaving(false)
      return
    }
    setSession(null)
    setRuntimeSnapshot(null)
    setRuntimeProgression(null)
    setRuntimeAudioScene(null)
    setLoadedBoneyard(null)
    setGameplayPause(null)
    setHubPauseMenuOpen(false)
    setPartyState(null)
    setPartyActionError(null)
    setWhisperRequest(null)
    setChatOpen(false)
    setWorldSpeeches([])
    setGameplaySettingsOpen(false)
    setSkillBookOpen(false)
    setHudSkillSelector(null)
    setInventoryScreenOpen(false)
    setScreen('root')
    setLeaving(false)
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
  const nonMusicMuted = darkCloudMenuOpen
    || displayedGameplayPause?.source === 'pause-menu'
    || displayedGameplayPause?.source === 'skill-selector'
    || hudSkillSelector !== null
    || levelUpModalActive
  useLayoutEffect(() => {
    audio.setSoundMuted(nonMusicMuted)
  }, [audio, nonMusicMuted])
  const ownsModalPause = gameplayPause !== null
    && gameplayPause.ownerPlayerId === session?.playerId
    && gameplayPause.source !== 'pause-menu'
  const ownsActiveInventoryPause = ownsModalPause
    && gameplayPause?.source === 'inventory'
    && inventoryScreenOpen
  const chatDisabled = loading !== null
    || levelUpModalActive
    || skillBookOpen
    || hudSkillSelector !== null
    || inventoryScreenOpen
    || hubPauseMenuOpen
    || gameplayPause !== null
  const sceneInputBlocked = chatOpen
    || loading !== null
    || levelUpModalActive
    || skillBookOpen
    || hudSkillSelector !== null
    || hubPauseMenuOpen
    || (gameplayPause !== null && !ownsActiveInventoryPause)
  const desiredModalPauseSource: GameplayPauseSource | null = skillBookOpen
    ? 'skill-book'
    : hudSkillSelector !== null
      ? 'skill-selector'
      : inventoryScreenOpen
        ? 'inventory'
        : null
  const openSkillBook = useCallback(() => {
    if (
      !session
      || loading !== null
      || levelUpModalActive
      || hubPauseMenuOpen
      || (gameplayPause !== null && !ownsModalPause)
      || (runtimeRunPhase !== 'hub' && runtimeRunPhase !== 'active')
    ) return
    setSkillBookOpen(true)
  }, [gameplayPause, hubPauseMenuOpen, levelUpModalActive, loading, ownsModalPause, runtimeRunPhase, session])

  const openHudSkillSelector = useCallback((binding: NativeHudSkillBinding) => {
    if (
      !session
      || loading !== null
      || levelUpModalActive
      || hubPauseMenuOpen
      || (gameplayPause !== null && !ownsModalPause)
      || (runtimeRunPhase !== 'hub' && runtimeRunPhase !== 'active')
    ) return
    audio.playSound('click')
    setSkillBookOpen(false)
    setHudSkillSelector(nativeHudSkillSelectorTarget(binding))
  }, [audio, gameplayPause, hubPauseMenuOpen, levelUpModalActive, loading, ownsModalPause, runtimeRunPhase, session])

  useEffect(() => {
    if (
      loading !== null
      || levelUpModalActive
      || (gameplayPause !== null && !ownsModalPause)
    ) {
      setSkillBookOpen(false)
      setHudSkillSelector(null)
      setInventoryScreenOpen(false)
    }
  }, [gameplayPause, levelUpModalActive, loading, ownsModalPause])
  useEffect(() => {
    if (!session) return
    if (desiredModalPauseSource !== null) {
      if (gameplayPause === null || ownsModalPause) {
        session.requestGameplayPause(desiredModalPauseSource)
      }
      return
    }
    if (ownsModalPause) session.requestGameplayPause(null)
  }, [desiredModalPauseSource, gameplayPause, ownsModalPause, session])
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
      data-game-sounds-muted={nonMusicMuted}
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
            currentRunId={currentHallRunId}
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
                    onJoinParty={() => transitionTo('join-party')}
                    onNewGame={beginNewGame}
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
                onMenu={openDarkCloudMenu}
                onPartyResolved={resolveParty}
                requesterDisplayName={partyRequesterName}
                onSubscriptionsChanged={refreshActiveMods}
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
        ) : screen === 'join-party' ? (
          <JoinPartyScene
            onBack={() => transitionTo('play')}
            onResolved={resolveParty}
            requesterDisplayName={partyRequesterName}
          />
        ) : screen === 'create' ? (
          <CreateMenuScene
            audio={audio}
            displayName={wizardName}
            onBack={() => { void leaveCreate() }}
            onDisplayNameChange={setWizardName}
            onDisciplineCommit={beginHubLoading}
            onStart={startHub}
            retainedLoadoutCanConfirm={Boolean(
              session
              && !runtimeSnapshot?.run.loadoutReadyPlayerIds.includes(session.playerId)
            )}
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
              onContinueGameOver={session.continueGameOver}
              onHubAction={session.sendHubAction}
              onInventoryOpenChange={setInventoryScreenOpen}
              onOpenSkillSelector={openHudSkillSelector}
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
              worldSpeeches={worldSpeeches}
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
              onAcceptPartyJoinRequest={session.acceptPartyJoinRequest}
              onDenyPartyInvitation={session.denyPartyInvitation}
              onDenyPartyJoinRequest={session.denyPartyJoinRequest}
              onHubAction={session.sendHubAction}
              onInventoryOpenChange={setInventoryScreenOpen}
              onInvitePlayer={session.inviteToParty}
              onKickPartyPlayer={session.kickPartyPlayer}
              onLeaveParty={session.sessionKind === 'private-college'
                ? leaveGameplay
                : session.leaveParty}
              onLoadingError={cancelHubLoading}
              onMessagePlayer={(playerId, displayName) => setWhisperRequest({
                displayName,
                playerId,
                requestedAtMs: Date.now(),
              })}
              onOpenSkillSelector={openHudSkillSelector}
              onOpenSkills={openSkillBook}
              onPauseRequest={requestGameplayPause}
              onReady={finishHubLoading}
              onStartMatch={startBoneyard}
              onPartyRotateCode={session.rotatePartyCode}
              onPartyVisibility={session.setPartyVisibility}
              partyActionError={partyActionError}
              partyState={partyState}
              presentationPaused={gameplayPause !== null}
              samplePresentation={session.samplePresentation}
              settings={gameSettings}
              sessionKind={session.sessionKind}
              subscribePing={session.onPing}
              subscribe={session.onSnapshot}
              worldSpeeches={worldSpeeches}
            />
          </Suspense>
        ) : null}

        {session && runtimeSnapshot && runtimeRunPhase !== 'game-over' ? (
          <GameChat
            disabled={chatDisabled}
            onMessage={presentWorldSpeech}
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
              audio={audio}
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

        {session && hudSkillSelector && runtimeProgression ? (
          <Suspense fallback={null}>
            <HudSkillSelector
              audio={audio}
              onClose={() => setHudSkillSelector(null)}
              onSelectConcentrationSlot={session.selectConcentrationSlot}
              onSelectPrimarySkill={session.selectPrimarySkill}
              progression={runtimeProgression}
              style={nativeStageStyle}
              target={hudSkillSelector}
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
          && displayedGameplayPause
          && !gameplaySettingsOpen
          && (
            displayedGameplayPause.source === 'pause-menu'
            || displayedGameplayPause.ownerPlayerId !== session.playerId
          ) ? (
          <GameplayPauseMenu
            key={gameplayPauseMenuGeneration}
            audio={audio}
            onSelect={(action) => {
              if (leaving) return
              if (action === 'leave') void leaveGameplay()
              else if (action === 'settings') setGameplaySettingsOpen(true)
              else if (action === 'resume') {
                if (localHubPause) setHubPauseMenuOpen(false)
                else session.requestGameplayPause(null)
              }
            }}
            pause={displayedGameplayPause}
            playerId={session.playerId}
            style={nativeStageStyle}
          />
        ) : null}

        {session
          && displayedGameplayPause?.ownerPlayerId === session.playerId
          && gameplaySettingsOpen ? (
            <GameSettingsDialog
              context="gameplay"
              onChange={requestGameSettingsUpdate}
              onClose={() => {
                setGameplaySettingsOpen(false)
                if (localHubPause) setHubPauseMenuOpen(false)
                else session.requestGameplayPause(null)
              }}
              settings={gameSettings}
            />
          ) : null}

        {(preparing || leaving || connectionError) && (
          <div className="main-menu-runtime-status" role={connectionError ? 'alert' : 'status'}>
            {connectionError ?? (leaving ? 'Saving game…' : 'Entering the shared Hub…')}
          </div>
        )}

        {settingsContext && !gameplaySettingsOpen ? (
          <GameSettingsDialog
            context={settingsContext}
            onChange={requestGameSettingsUpdate}
            onClose={() => setSettingsContext(null)}
            settings={gameSettings}
          />
        ) : null}

        {modMismatch ? (
          <GameSaveModMismatchDialog
            mismatch={modMismatch}
            onCancel={() => {
              setModMismatch(null)
              setNewGameMismatchAdmission(null)
            }}
            onContinue={() => {
              const admission = newGameMismatchAdmission
              setModMismatch(null)
              setNewGameMismatchAdmission(null)
              if (admission) beginCreate(admission, true)
              else void resumeLastGame(true)
            }}
            style={nativeStageStyle}
          />
        ) : null}

        {moddedPlayPrompt ? (
          <ModdedPlayDialog
            activeMods={activeMods}
            busy={routingBusy}
            cheatsEnabled={cheatsEnabled}
            onBack={() => setModdedPlayPrompt(false)}
            onContinueLocal={() => { void continueLocal() }}
            onPlayVanilla={() => { void playVanilla() }}
            progress={contentProgress}
          />
        ) : null}

        {partyConsent ? (
          <PartyJoinConsentDialog
            busy={routingBusy}
            onBack={() => setPartyConsent(null)}
            onContinue={() => { void continueParty() }}
            progress={contentProgress}
            requiresVanilla={partyConsent.target.kind === 'global-hub'
              && (activeMods.length > 0 || cheatsEnabled)}
            signedIn={accountUsername !== null}
            target={partyConsent.target}
          />
        ) : null}

        {cheatCollegePrompt ? (
          <div className="play-routing-backdrop" role="presentation">
            <section className="play-routing-dialog" role="dialog" aria-modal="true" aria-label="Cheats require a private College">
              <h2>CHEATS USE PRIVATE COLLEGES</h2>
              <p>Leave the global Hub, then use Last Game to continue this wizard locally.</p>
              <footer>
                <button data-game-back="true" type="button" onClick={() => setCheatCollegePrompt(false)}>CANCEL</button>
                <button type="button" onClick={() => {
                  updateGameSettings({ ...gameSettings, enableCheats: true })
                  setCheatCollegePrompt(false)
                  leaveGameplay()
                }}>LEAVE & CONTINUE</button>
              </footer>
            </section>
          </div>
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

function partyActionErrorMessage(reason: PartyActionRejection | null): string {
  switch (reason) {
    case 'not-leader': return 'Only the party leader can do that.'
    case 'party-full': return 'That party is full.'
    case 'not-in-hub': return 'That wizard is not in the Courtyard.'
    case 'already-in-party': return 'That wizard is already in a party.'
    case 'already-invited': return 'That invitation is already pending.'
    case 'already-requested': return 'That join request is already pending.'
    case 'party-private': return 'That party is private.'
    case 'self-invite':
    case 'self-kick': return 'You cannot target yourself.'
    case 'invitation-missing': return 'That invitation has expired.'
    case 'request-missing': return 'That join request has expired.'
    case 'not-recipient': return 'That invitation belongs to another wizard.'
    case 'player-missing': return 'That wizard is no longer available.'
    case 'same-party': return 'That wizard is already in your party.'
    case 'party-missing':
    case null: return 'That party is no longer available.'
  }
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
