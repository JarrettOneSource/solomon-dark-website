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
import StockPromptDialog from './StockPromptDialog.tsx'
import TutorialPrelude from './TutorialPrelude.tsx'
import type { GameClientSession } from './client/game-client-session.ts'
import type { GameObserverSession } from './client/game-observer-session.ts'
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
import GameMenuSkull, { type GameMenuAvailability } from './GameMenuSkull.tsx'
import GameChat, { type GameChatWhisperRequest } from './GameChat.tsx'
import GameSaveModMismatchDialog from './GameSaveModMismatchDialog.tsx'
import GameSettingsDialog, { type GameSettingsContext } from './GameSettingsDialog.tsx'
import type { NativeSaveTransferController } from './NativeSaveTransferSettings.tsx'
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
  gameUiScale,
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
  GameplayResumeGraceState,
  HubPlayerActivity,
  LoadedBoneyard,
  PartyActionRejection,
} from './protocol/game-protocol.ts'
import {
  api,
  type ActiveWebMod,
  type PartyJoinResolution,
} from '../lib/api.ts'
import {
  GameModContentLoadError,
  prefetchGameContent,
  type GameContentDownloadProgress,
} from './game-content-cache.ts'
import type { BrowserGameAdmission } from './game-bootstrap.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import {
  readGameResumeToken,
  rememberGameResumeToken,
} from './save/game-resume-token.ts'
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
import {
  HUB_SOCIAL_SOUND_REQUESTS,
  advanceHubMembershipAudioCursor,
  createHubMembershipAudioCursor,
  type HubMembershipAudioCursor,
} from './hub-social-audio.ts'
import type {
  GameProfileSave,
  GameSaveCheckpoint,
  GameSaveIntent,
  ResumableGameSave,
} from './save/game-save-contract.ts'
import { restoreGameSaveProfile } from './save/game-save-document.ts'
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
import type { TitleMenuPromptKind } from './title-menu-prompt.ts'
import TitleMenuPresentation from './TitleMenuPresentation.tsx'
import './main-menu.css'

const DISCORD_INVITE_URL = 'https://discord.gg/HGHxZgyM2p'

const BoneyardScene = lazy(() => import('./BoneyardScene.tsx'))
const HubScene = lazy(() => import('./HubScene.tsx'))
const DeveloperObserverScene = lazy(() => import('./DeveloperObserverScene.tsx'))
const loadSkillPicker = () => import('./SkillPicker.tsx')
const SkillPicker = lazy(loadSkillPicker)
const loadSkillBook = () => import('./SkillBook.tsx')
const SkillBook = lazy(loadSkillBook)
const loadHudSkillSelector = () => import('./HudSkillSelector.tsx')
const HudSkillSelector = lazy(loadHudSkillSelector)
const loadGameplayResumeCountdown = () => import('./GameplayResumeCountdown.tsx')
const GameplayResumeCountdown = lazy(loadGameplayResumeCountdown)
const loadGameplayPauseMenu = () => import('./GameplayPauseMenu.tsx')
const GameplayPauseMenu = lazy(loadGameplayPauseMenu)
const ModMinimap = lazy(() => import('./mod-ui/ModMinimap.tsx'))
const ModPanels = lazy(() => import('./mod-ui/ModPanels.tsx'))
const ModSceneOverlay = lazy(() => import('./mod-ui/ModSceneOverlay.tsx'))

/** The Dark Cloud's Esc menu is the native simple menu with the local viewer as its owner. */
const DARK_CLOUD_PAUSE_OWNER_ID = 'dark-cloud'
const DARK_CLOUD_PAUSE: GameplayPauseState = {
  ownerDisplayName: 'The Dark Cloud',
  ownerPlayerId: DARK_CLOUD_PAUSE_OWNER_ID,
  source: 'pause-menu',
}

type MenuScreen = 'root' | 'play' | 'join-party' | 'dark-cloud' | 'hall' | 'create' | 'tutorial-prelude' | 'hub' | 'observer'
type FadeState = 'idle' | 'covering' | 'revealing'

interface MenuButtonProps {
  accessibleLabel: string
  action: TitleMenuAction
  className?: string
  compact?: boolean
  defaultFocus?: boolean
  disabled?: boolean
  href?: string
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
  href,
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
  const Element = href ? 'a' : 'button'

  return (
    <Element
      type={href ? undefined : 'button'}
      className={classes}
      aria-label={accessibleLabel}
      disabled={href ? undefined : disabled}
      href={href}
      rel={href ? 'noreferrer' : undefined}
      target={href ? '_blank' : undefined}
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
      onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement | HTMLAnchorElement>) => {
        if (!disabled && !event.repeat && (event.key === 'Enter' || event.key === ' ')) {
          if (href && event.key === ' ') event.preventDefault()
          onPressState(action)
          onPress?.()
        }
      }}
      onKeyUp={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        onPressState(null)
        if (href && event.key === ' ') {
          event.preventDefault()
          event.currentTarget.click()
        }
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
      <MenuButton action="discord" accessibleLabel="Discord" href={DISCORD_INVITE_URL} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
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
    resumeToken?: string,
    beginCollegeIntro?: boolean,
    declineTutorial?: boolean,
  ) => Promise<GameClientSession>
  connectObserver: (
    matchId: string,
    onEnded: () => void,
  ) => Promise<GameObserverSession>
  developerAccess: boolean
  initialScreen?: 'create' | 'root'
  loadGlobalHallOfFame: (board: HallOfFameBoard) => Promise<readonly HallOfFameEntry[]>
  modLoadError: string | null
  onCancelCreate: () => Promise<void>
  onKillWizard: () => Promise<void>
  onSaveCheckpoint: (checkpoint: GameSaveCheckpoint) => void
  persistSaveCheckpoint: (checkpoint: GameSaveCheckpoint) => Promise<void>
  onSignOut: () => void
  prepareGame: (admission: BrowserGameAdmission) => Promise<void>
  profileSave: GameProfileSave | null
  refreshActiveMods: () => Promise<readonly ActiveWebMod[]>
  resumeSave: ResumableGameSave | null
  saveTransfer: NativeSaveTransferController
  submitGlobalHallOfFame: (receipt: string) => Promise<void>
  tutorialOfferEligible: boolean
}

export default function MainMenuScene({
  activeMods,
  accountUsername,
  connectSession,
  connectObserver,
  developerAccess,
  displayName,
  initialScreen = 'root',
  loadGlobalHallOfFame,
  modLoadError,
  onCancelCreate,
  onKillWizard,
  onSaveCheckpoint,
  onSignOut,
  persistSaveCheckpoint,
  prepareGame,
  profileSave,
  refreshActiveMods,
  resumeSave,
  saveTransfer,
  submitGlobalHallOfFame,
  tutorialOfferEligible,
}: MainMenuSceneProps) {
  const audio = useMemo(createBrowserGameAudioDirector, [])
  const stageRef = useRef<HTMLElement>(null)
  const [screen, setScreen] = useState<MenuScreen>(initialScreen)
  const [tutorialOfferOpen, setTutorialOfferOpen] = useState(
    initialScreen === 'root' && tutorialOfferEligible,
  )
  const [tutorialDeclined, setTutorialDeclined] = useState(false)
  const [wizardName, setWizardName] = useState(() => (
    initialScreen === 'create' ? initialCreateWizardNameForSession(displayName) : ''
  ))
  const [partyRequesterName] = useState(() => initialCreateWizardNameForSession(displayName))
  const [fadeState, setFadeState] = useState<FadeState>('idle')
  const [fadeTarget, setFadeTarget] = useState<MenuScreen | null>(null)
  const [session, setSession] = useState<GameClientSession | null>(null)
  const [observerSession, setObserverSession] = useState<GameObserverSession | null>(null)
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<GameSnapshot | null>(null)
  const [runtimeProgression, setRuntimeProgression] = useState<ProtocolPlayerProgression | null>(null)
  const [runtimeRunPhase, setRuntimeRunPhase] = useState<GameRunPhase>('hub')
  const [runtimeAudioScene, setRuntimeAudioScene] = useState<GameAudioScene | null>(null)
  const [loadedBoneyard, setLoadedBoneyard] = useState<LoadedBoneyard | null>(null)
  const [gameplayPause, setGameplayPause] = useState<GameplayPauseState | null>(null)
  const [gameplayResumeGrace, setGameplayResumeGrace] =
    useState<GameplayResumeGraceState | null>(null)
  const [hubPauseMenuOpen, setHubPauseMenuOpen] = useState(false)
  const [gameplayPauseMenuGeneration, setGameplayPauseMenuGeneration] = useState(0)
  const [partyState, setPartyState] = useState<LocalPartyState | null>(null)
  const partyInvitationAudioCursorRef = useRef<PartyInvitationAudioCursor | null>(null)
  const hubMembershipAudioCursorRef = useRef<HubMembershipAudioCursor | null>(null)
  const [partyActionError, setPartyActionError] = useState<string | null>(null)
  const [whisperRequest, setWhisperRequest] = useState<GameChatWhisperRequest | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [worldSpeeches, setWorldSpeeches] = useState<readonly GameWorldSpeech[]>([])
  const [gameplaySettingsOpen, setGameplaySettingsOpen] = useState(false)
  const activeBoneyardRunRef = useRef<string | null>(null)
  const loadedBoneyardRunRef = useRef<string | null>(null)
  const [readyBoneyardRunId, setReadyBoneyardRunId] = useState<string | null>(null)
  const levelUpPickerPresentationRef = useRef<number | null>(null)
  const levelUpSoundBarrierRef = useRef<number | null>(null)
  const [levelUpPickerClosing, setLevelUpPickerClosing] = useState(false)
  const [skillBookOpen, setSkillBookOpen] = useState(false)
  const [hudSkillSelector, setHudSkillSelector] = useState<NativeHudSkillSelectorTarget | null>(null)
  const [inventoryScreenOpen, setInventoryScreenOpen] = useState(false)
  const [hubSceneOccupied, setHubSceneOccupied] = useState(false)
  const [inventoryRequestSequence, setInventoryRequestSequence] = useState(0)
  const [loading, setLoading] = useState<MatchLoadingState | null>(null)
  const loadingRef = useRef<MatchLoadingState | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(modLoadError)
  const [hoveredTitleAction, setHoveredTitleAction] = useState<TitleMenuAction | null>(null)
  const [pressedTitleAction, setPressedTitleAction] = useState<TitleMenuAction | null>(null)
  const [settingsContext, setSettingsContext] = useState<GameSettingsContext | null>(null)
  const [darkCloudMenuOpen, setDarkCloudMenuOpen] = useState(false)
  /** The gameplay scene's skull state (HUD paint + OPEN MENU gate), mirrored for the stage skull. */
  const [sceneMenuAvailability, setSceneMenuAvailability] = useState<GameMenuAvailability>('inert')
  const [modMismatch, setModMismatch] = useState<GameSaveModMismatch | null>(null)
  const [newGameMismatchAdmission, setNewGameMismatchAdmission] =
    useState<BrowserGameAdmission | null>(null)
  const [newGameModMismatchAllowed, setNewGameModMismatchAllowed] = useState(false)
  const [moddedPlayPrompt, setModdedPlayPrompt] = useState(false)
  const [activeWizardPrompt, setActiveWizardPrompt] = useState(false)
  const [retiringWizard, setRetiringWizard] = useState(false)
  const [partyConsent, setPartyConsent] = useState<PartyJoinResolution | null>(null)
  const [pendingAdmission, setPendingAdmission] = useState<BrowserGameAdmission>({
    kind: 'global-hub',
  })
  const [routingBusy, setRoutingBusy] = useState(false)

  useEffect(() => {
    if (modLoadError) setConnectionError(modLoadError)
  }, [modLoadError])
  const [contentProgress, setContentProgress] = useState<GameContentDownloadProgress | null>(null)
  const [cheatCollegePrompt, setCheatCollegePrompt] = useState(false)
  const [gameSettings, setLocalGameSettings] = useState(readGameSettings)
  const cheatsEnabled = gameSettings.enableCheats && !developerAccess
  const collegeIntroPending = useMemo(
    () => !tutorialDeclined && (profileSave === null
      || restoreGameSaveProfile(profileSave.document).economy.collegeIntroPending
    ),
    [profileSave, tutorialDeclined],
  )
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
    (runId: string) => {
      setReadyBoneyardRunId(runId)
      finishLoading('boneyard')
    },
    [finishLoading],
  )
  const cancelHubLoading = useCallback(() => cancelLoading('hub'), [cancelLoading])
  const cancelBoneyardLoading = useCallback(
    () => cancelLoading('boneyard'),
    [cancelLoading],
  )
  const presentWorldSpeech = useCallback((message: GameChatMessage) => {
    const request = HUB_SOCIAL_SOUND_REQUESTS.chat
    audio.playSound(request.cue, {
      playbackRate: request.playbackRate,
      volume: request.volume,
    })
    const receivedAtMs = performance.now()
    setWorldSpeeches(current => appendGameWorldSpeech(current, message, receivedAtMs))
  }, [audio])

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
    if (gameplayPause || gameplayResumeGrace) setHubPauseMenuOpen(false)
    else if (!hubPauseMenuOpen) setGameplaySettingsOpen(false)
  }, [gameplayPause, gameplayResumeGrace, hubPauseMenuOpen])

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
  useEffect(() => () => observerSession?.close(), [observerSession])

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
      : screen === 'tutorial-prelude'
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
    hubMembershipAudioCursorRef.current = createHubMembershipAudioCursor(
      initialSnapshot,
      session.playerId,
    )
    const initialBoneyard = session.getBoneyard()
    const initialSaveCheckpoint = session.getSaveCheckpoint()
    if (initialSaveCheckpoint) onSaveCheckpoint(initialSaveCheckpoint)
    activeBoneyardRunRef.current = initialSnapshot.world.kind === 'boneyard'
      ? initialSnapshot.world.runId
      : null
    loadedBoneyardRunRef.current = initialBoneyard?.runId ?? null
    setReadyBoneyardRunId(null)
    setRuntimeSnapshot(initialSnapshot)
    setRuntimeRunPhase(initialSnapshot.run.phase)
    setRuntimeAudioScene(gameplayAudioScene(initialSnapshot))
    setRuntimeProgression(initialSnapshot.players[session.playerId]?.progression ?? null)
    setLoadedBoneyard(initialBoneyard)
    setGameplayPause(session.getGameplayPause())
    setGameplayResumeGrace(session.getGameplayResumeGrace())
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
      const membershipCursor = hubMembershipAudioCursorRef.current
      if (membershipCursor) {
        const delta = advanceHubMembershipAudioCursor(
          membershipCursor,
          snapshot,
          session.playerId,
        )
        hubMembershipAudioCursorRef.current = delta.cursor
        for (let index = 0; index < delta.joinedPlayerIds.length; index += 1) {
          const request = HUB_SOCIAL_SOUND_REQUESTS.join
          audio.playSound(request.cue, {
            playbackRate: request.playbackRate,
            volume: request.volume,
          })
        }
        for (let index = 0; index < delta.leftPlayerIds.length; index += 1) {
          const request = HUB_SOCIAL_SOUND_REQUESTS.leave
          audio.playSound(request.cue, {
            playbackRate: request.playbackRate,
            volume: request.volume,
          })
        }
      }
      recordHallSnapshot(snapshot)
      setRuntimeRunPhase(snapshot.run.phase)
      setRuntimeAudioScene(gameplayAudioScene(snapshot))
      if (snapshot.world.kind === 'boneyard') {
        const enteringRun = activeBoneyardRunRef.current !== snapshot.world.runId
        activeBoneyardRunRef.current = snapshot.world.runId
        if (enteringRun) setReadyBoneyardRunId(null)
        if (loadingRef.current?.flow === 'boneyard') {
          advanceLoading('materializing_participants')
        } else if (enteringRun) {
          beginLoading('boneyard', 'materializing_participants')
        }
      } else {
        activeBoneyardRunRef.current = null
        setReadyBoneyardRunId(null)
        if (loadingRef.current?.flow === 'hub') {
          advanceLoading('materializing_participants')
        }
      }
      const progression = snapshot.players[session.playerId]?.progression ?? null
      setRuntimeProgression((current) => (
        sameRuntimeProgression(current, progression) ? current : progression
      ))
      setRuntimeSnapshot((current) => sameRuntimeScene(current, snapshot, session.playerId)
        ? current
        : snapshot)
    })
    const removeBoneyard = session.onBoneyard((nextBoneyard) => {
      const enteringRun = loadedBoneyardRunRef.current !== nextBoneyard.runId
      loadedBoneyardRunRef.current = nextBoneyard.runId
      if (enteringRun) setReadyBoneyardRunId(null)
      setLoadedBoneyard(nextBoneyard)
      if (loadingRef.current?.flow === 'boneyard') {
        advanceLoading('reading_boneyard')
      } else if (enteringRun) {
        beginLoading('boneyard', 'reading_boneyard')
      }
    })
    const removeGameplayPause = session.onGameplayPause(setGameplayPause)
    const removeGameplayResumeGrace = session.onGameplayResumeGrace(
      setGameplayResumeGrace,
    )
    const removeChatMessage = session.onChatMessage(presentWorldSpeech)
    const removeLeaderboardReceipt = session.onLeaderboardReceipt((receipt) => {
      if (!session.developerAccess && gameCheatsEnabled()) return
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
      removeGameplayResumeGrace()
      removeChatMessage()
      removeLeaderboardReceipt()
      removePartyAction()
      removePartyState()
      partyInvitationAudioCursorRef.current = null
      hubMembershipAudioCursorRef.current = null
      removeSaveCheckpoint()
    }

    function recordHallSnapshot(snapshot: GameSnapshot) {
      if (snapshot.world.kind === 'boneyard' && snapshot.world.tutorial) return
      const entry = hallRecorder.observe(snapshot, session!.playerId, accountUsername)
      if (!entry) return
      setLocalHallOfFame(recordLocalHallOfFame(entry))
      setCurrentHallRunId(entry.runId)
    }
  }, [accountUsername, advanceLoading, audio, beginLoading, onSaveCheckpoint, presentWorldSpeech, session, submitGlobalHallOfFame])

  useEffect(() => {
    if (runtimeSnapshot?.world.kind === 'boneyard') void loadSkillPicker()
  }, [runtimeSnapshot?.world.kind])

  useEffect(() => {
    if (runtimeSnapshot?.world.kind !== 'hub') {
      setHubPauseMenuOpen(false)
      setHubSceneOccupied(false)
    }
  }, [runtimeSnapshot?.world.kind])

  useEffect(() => {
    if (
      screen === 'tutorial-prelude'
      && runtimeSnapshot?.world.kind === 'boneyard'
      && runtimeSnapshot.world.tutorial !== null
    ) setScreen('hub')
  }, [runtimeSnapshot, screen])

  const runtimeConnected = runtimeSnapshot !== null
  useEffect(() => {
    if (runtimeConnected) {
      void loadSkillBook()
      void loadHudSkillSelector()
      void loadGameplayResumeCountdown()
      void loadGameplayPauseMenu()
    }
  }, [runtimeConnected])

  const collegeLoadoutActive = Boolean(
    session
    && runtimeSnapshot?.world.kind === 'hub'
    && runtimeSnapshot.world.participants[session.playerId]?.transition?.phase
      === 'college-loadout',
  )
  useEffect(() => {
    if (!session || !runtimeSnapshot) return
    if (collegeLoadoutActive) {
      setWizardName(current => current.length === 0
        ? initialCreateWizardNameForSession(displayName)
        : current)
      setFadeState('idle')
      setFadeTarget(null)
      setScreen('create')
      return
    }
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
  }, [collegeLoadoutActive, displayName, runtimeRunPhase, runtimeSnapshot, screen, session])

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
  const titlePrompt: TitleMenuPromptKind | null = activeWizardPrompt && resumeSave
    ? 'kill-wizard'
    : tutorialOfferOpen
      ? 'tutorial'
      : null
  const titlePromptBusy = titlePrompt === 'kill-wizard' && retiringWizard
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
    if (collegeIntroPending) {
      void startCollegeIntro(admission)
    } else {
      beginCreate(admission)
    }
  }

  const continueNewGame = () => {
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

  const beginNewGame = () => {
    if (preparing || connecting) return
    if (resumeSave) {
      setConnectionError(null)
      setActiveWizardPrompt(true)
      return
    }
    continueNewGame()
  }

  const killPromptWizard = async () => {
    if (retiringWizard) return
    setRetiringWizard(true)
    setConnectionError(null)
    try {
      await onKillWizard()
      setActiveWizardPrompt(false)
      continueNewGame()
    } catch (error) {
      setConnectionError(error instanceof Error
        ? error.message
        : 'The current wizard could not be retired.')
    } finally {
      setRetiringWizard(false)
    }
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

  const prefetchSubscribedModContent = async (mods: readonly {
    assets: ActiveWebMod['assets']
    id: string
    name: string
    slug: string
  }[]): Promise<void> => {
    try {
      await prefetchGameContent(mods.flatMap(mod => mod.assets), setContentProgress)
    } catch (error) {
      if (!(error instanceof GameModContentLoadError) || !accountUsername) throw error
      const failedMod = mods.find(mod => mod.id === error.modId)
      if (!failedMod) throw error
      try {
        await api.mods.subscriptions.setEnabled(failedMod.slug, false)
        await refreshActiveMods()
      } catch {
        throw new Error(`${error.message} The mod could not be disabled automatically.`)
      }
      throw new Error(
        `${failedMod.name} was disabled because its content could not be loaded or verified.`,
      )
    }
  }

  const continueLocal = async () => {
    if (routingBusy) return
    setRoutingBusy(true)
    setContentProgress(null)
    try {
      await prefetchSubscribedModContent(activeMods)
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
      const admission = { kind: 'party', intentId: resolution.intentId } as const
      if (collegeIntroPending) void startCollegeIntro(admission)
      else beginCreate(admission)
      return
    }
    setPartyConsent(resolution)
  }

  const observeMatch = async (matchId: string) => {
    if (observerSession || connecting) return
    setConnecting(true)
    setConnectionError(null)
    let nextObserver: GameObserverSession | null = null
    let targetEnded = false
    try {
      nextObserver = await connectObserver(matchId, () => {
        targetEnded = true
        setObserverSession(current => current === nextObserver ? null : current)
        setScreen('dark-cloud')
        setConnectionError('The observed match ended.')
      })
      await prefetchGameContent(nextObserver.modAssets, setContentProgress)
      if (targetEnded) throw new Error('The observed match ended.')
      setObserverSession(nextObserver)
      setScreen('observer')
    } catch (error) {
      nextObserver?.close()
      throw error instanceof Error ? error : new Error('The match could not be observed.')
    } finally {
      setConnecting(false)
    }
  }

  const exitObserver = () => {
    observerSession?.close()
    setObserverSession(null)
    setContentProgress(null)
    setScreen('dark-cloud')
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
        await prefetchSubscribedModContent(partyConsent.target.content.mods)
      }
      const admission = { kind: 'party', intentId: partyConsent.intentId } as const
      if (collegeIntroPending) await startCollegeIntro(admission)
      else beginCreate(admission)
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

  const activateSession = (nextSession: GameClientSession, preserveScreen = false) => {
    const snapshot = nextSession.getSnapshot()
    rememberGameResumeToken(nextSession.playerId, nextSession.resumeToken)
    setWhisperRequest(null)
    setSession(nextSession)
    setRuntimeSnapshot(snapshot)
    setRuntimeProgression(
      snapshot.players[nextSession.playerId]?.progression ?? null,
    )
    setLoadedBoneyard(nextSession.getBoneyard())
    setGameplayPause(nextSession.getGameplayPause())
    setGameplayResumeGrace(nextSession.getGameplayResumeGrace())
    setHubPauseMenuOpen(false)
    if (snapshot.world.kind === 'hub') advanceLoading('materializing_participants')
    if (!preserveScreen) setScreen('hub')
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
        await prefetchSubscribedModContent(activeMods)
      }
      await prepareGame({
        fallback: resumeSave.integrity === 'local-only'
          || activeMods.length > 0
          || cheatsEnabled
          ? 'private-college'
          : 'global-hub',
        kind: 'resume',
        partyRejoinToken: resumeSave.summary.partyRejoinToken,
        saveDocument: resumeSave.document,
      })
      const nextSession = await connectSession(
        resumeSave.summary.character,
        advanceLoading,
        cheatsEnabled,
        resumeSave.document,
        'resume',
        allowModMismatch,
        readGameResumeToken(resumeSave.summary.playerId),
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
    if (session && (runtimeRunPhase === 'loadout' || collegeLoadoutActive)) {
      session.confirmLoadout(selectedElement, selectedDiscipline, selectedDisplayName)
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
        undefined,
        undefined,
        tutorialDeclined,
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

  async function startCollegeIntro(
    admission: BrowserGameAdmission,
    allowModMismatch = false,
  ): Promise<void> {
    if (connecting) return
    const pendingName = admission.kind === 'party'
      ? partyRequesterName
      : initialCreateWizardNameForSession(displayName)
    setPendingAdmission(admission)
    setNewGameModMismatchAllowed(allowModMismatch)
    setWizardName(pendingName)
    setPartyConsent(null)
    setModdedPlayPrompt(false)
    setConnecting(true)
    setConnectionError(null)
    beginLoading('hub', 'connecting_transport')
    try {
      await prepareGame(admission)
      const nextSession = await connectSession(
        {
          discipline: 'arcane',
          displayName: pendingName,
          element: 'ether',
        },
        advanceLoading,
        cheatsEnabled,
        profileSave?.document,
        profileSave ? 'new-game' : undefined,
        allowModMismatch,
        undefined,
        true,
      )
      activateSession(nextSession)
      setNewGameModMismatchAllowed(false)
    } catch (error) {
      cancelLoading('hub')
      setConnectionError(error instanceof Error
        ? error.message
        : 'The College introduction could not start.')
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

  const startTutorial = async () => {
    if (connecting) return
    setConnecting(true)
    setConnectionError(null)
    beginLoading('boneyard', 'connecting_transport')
    try {
      if (accountUsername && activeMods.length > 0) {
        await api.mods.subscriptions.disableAll()
        await refreshActiveMods()
      }
      if (cheatsEnabled) updateGameSettings({ ...gameSettings, enableCheats: false })
      await prepareGame({ kind: 'global-hub' })
      const nextSession = await connectSession(
        {
          discipline: 'arcane',
          displayName: 'Sirmin',
          element: 'ether',
        },
        advanceLoading,
        false,
      )
      activateSession(nextSession, true)
      nextSession.startTutorial()
    } catch (error) {
      cancelLoading('boneyard')
      setConnectionError(error instanceof Error ? error.message : 'The Tutorial could not be opened.')
    } finally {
      setConnecting(false)
    }
  }

  const startTutorialRef = useRef(startTutorial)
  startTutorialRef.current = startTutorial
  useEffect(() => {
    if (screen !== 'tutorial-prelude') return
    void startTutorialRef.current()
  }, [screen])

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
    setReadyBoneyardRunId(null)
    setGameplayPause(null)
    setGameplayResumeGrace(null)
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
    setHubSceneOccupied(false)
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
  const levelUpWaitingForPeers = Boolean(runtimeSnapshot?.levelUpBarrier)
    && !runtimeProgression?.pendingOffer
    && !levelUpPickerClosing
  const nonMusicMuted = darkCloudMenuOpen
    || displayedGameplayPause?.source === 'pause-menu'
    || displayedGameplayPause?.source === 'skill-selector'
    || hudSkillSelector !== null
    || levelUpWaitingForPeers
  useLayoutEffect(() => {
    audio.setSoundMuted(nonMusicMuted)
  }, [audio, nonMusicMuted])
  const ownsModalPause = gameplayPause !== null
    && gameplayPause.ownerPlayerId === session?.playerId
    && gameplayPause.source !== 'pause-menu'
  const ownsActiveInventoryPause = ownsModalPause
    && gameplayPause?.source === 'inventory'
    && inventoryScreenOpen
  const tutorialSession = runtimeSnapshot?.world.kind === 'boneyard'
    && runtimeSnapshot.world.tutorial !== null
  const tutorialPreludeVisible = screen === 'tutorial-prelude'
    || (
      runtimeSnapshot?.world.kind === 'boneyard'
      && runtimeSnapshot.world.tutorial?.introActive === true
    )
  const chatDisabled = loading !== null
    || tutorialSession
    || gameplaySettingsOpen
    || gameplayResumeGrace !== null
  const sceneInputBlocked = chatOpen
    || loading !== null
    || levelUpModalActive
    || skillBookOpen
    || hudSkillSelector !== null
    || hubPauseMenuOpen
    || (gameplayPause !== null && !ownsActiveInventoryPause)
    || gameplayResumeGrace !== null
  const sceneModalDisabled = loading !== null
    || levelUpModalActive
    || skillBookOpen
    || hudSkillSelector !== null
    || hubPauseMenuOpen
    || (gameplayPause !== null && !ownsActiveInventoryPause)
    || gameplayResumeGrace !== null
  const desiredModalPauseSource: GameplayPauseSource | null =
    runtimeSnapshot?.world.kind === 'boneyard'
      ? skillBookOpen
        ? 'skill-book'
        : hudSkillSelector !== null
          ? 'skill-selector'
          : inventoryScreenOpen
            ? 'inventory'
            : null
      : null
  const localHubActivity: HubPlayerActivity | null =
    runtimeSnapshot?.world.kind !== 'hub'
      ? null
      : hubPauseMenuOpen
        ? 'paused'
        : chatOpen
          || skillBookOpen
          || hudSkillSelector !== null
          || inventoryScreenOpen
          || hubSceneOccupied
          ? 'occupied'
          : null
  const openSkillBook = useCallback(() => {
    if (
      !session
      || loading !== null
      || levelUpModalActive
      || hubPauseMenuOpen
      || gameplayResumeGrace !== null
      || (gameplayPause !== null && !ownsModalPause)
      || (runtimeRunPhase !== 'hub' && runtimeRunPhase !== 'active')
    ) return
    if (runtimeSnapshot?.world.kind === 'boneyard' && runtimeSnapshot.world.tutorial) {
      session.sendTutorialAction('skills-opened')
    }
    setSkillBookOpen(true)
  }, [gameplayPause, gameplayResumeGrace, hubPauseMenuOpen, levelUpModalActive, loading, ownsModalPause, runtimeRunPhase, runtimeSnapshot, session])

  const openHudSkillSelector = useCallback((binding: NativeHudSkillBinding) => {
    if (
      !session
      || loading !== null
      || levelUpModalActive
      || hubPauseMenuOpen
      || gameplayResumeGrace !== null
      || (gameplayPause !== null && !ownsModalPause)
      || (runtimeRunPhase !== 'hub' && runtimeRunPhase !== 'active')
    ) return
    if (runtimeSnapshot?.world.kind === 'boneyard' && runtimeSnapshot.world.tutorial) {
      if (binding === 12) session.sendTutorialAction('primary-selector-opened')
      if (binding === 16) session.sendTutorialAction('concentration-a-selector-opened')
    }
    audio.playSound('click')
    setSkillBookOpen(false)
    setHudSkillSelector(nativeHudSkillSelectorTarget(binding))
  }, [
    audio,
    gameplayPause,
    gameplayResumeGrace,
    hubPauseMenuOpen,
    levelUpModalActive,
    loading,
    ownsModalPause,
    runtimeRunPhase,
    runtimeSnapshot,
    session,
  ])

  useEffect(() => {
    if (
      loading !== null
      || levelUpModalActive
      || gameplayResumeGrace !== null
      || (gameplayPause !== null && !ownsModalPause)
    ) {
      setSkillBookOpen(false)
      setHudSkillSelector(null)
      setInventoryScreenOpen(false)
    }
  }, [gameplayPause, gameplayResumeGrace, levelUpModalActive, loading, ownsModalPause])
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
    session?.setHubActivity(localHubActivity)
  }, [localHubActivity, session])
  useEffect(() => {
    if (
      !gameplayResumeGrace
      || gameplayResumeGrace.remainingMs !== null
      || levelUpModalActive
      || runtimeSnapshot?.world.kind !== 'boneyard'
      || readyBoneyardRunId !== runtimeSnapshot.world.runId
    ) return
    session?.readyResumeGrace()
  }, [
    gameplayResumeGrace,
    levelUpModalActive,
    readyBoneyardRunId,
    runtimeSnapshot,
    session,
  ])
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
      data-college-loadout-active={collegeLoadoutActive || undefined}
      data-game-scene={gameScene}
      data-gameplay-resume-grace={gameplayResumeGrace?.reason ?? 'none'}
      data-game-sounds-muted={nonMusicMuted}
      data-hub-player-activity={localHubActivity ?? 'none'}
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
              canResume={resumeSave !== null}
              hoveredAction={hoveredTitleAction}
              pressedAction={pressedTitleAction}
              prompt={titlePrompt}
              promptBusy={titlePromptBusy}
              screen={screen === 'play' ? 'play' : 'root'}
              viewport={fixedViewport}
            />

            <div
              className="main-menu-native-stage main-menu-account-stage"
              hidden={titlePrompt !== null}
              style={accountStageStyle}
            >
              <GameAccountName placement="title" username={accountUsername} />
            </div>

            <div className="main-menu-native-stage" style={nativeStageStyle}>
              <nav
                key={screen}
                aria-label={screen === 'root' ? 'Main menu actions' : 'Play menu actions'}
                className="main-menu-actions"
                inert={titlePrompt !== null || undefined}
              >
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

            <div
              className="main-menu-native-stage main-menu-quit-stage"
              inert={titlePrompt !== null || undefined}
              style={quitStageStyle}
            >
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
        ) : screen === 'tutorial-prelude' ? (
          <div className="main-menu-native-stage" style={nativeStageStyle}>
            <TutorialPrelude />
          </div>
        ) : screen === 'dark-cloud' ? (
          <>
            <div className="main-menu-native-stage dark-cloud-stage" inert={darkCloudMenuOpen || undefined}>
              <DarkCloudScene
                accountUsername={accountUsername}
                developerAccess={developerAccess}
                menuKeyCode={gameSettings.controls.openMenu}
                menuOpen={darkCloudMenuOpen || settingsContext !== null}
                onMenu={openDarkCloudMenu}
                onObserveMatch={observeMatch}
                onPartyResolved={resolveParty}
                requesterDisplayName={partyRequesterName}
                onSubscriptionsChanged={refreshActiveMods}
              />
            </div>
            {darkCloudMenuOpen ? (
              <Suspense fallback={null}>
                <GameplayPauseMenu
                  audio={audio}
                  backAction="resume"
                  className="dark-cloud-pause-stage"
                  escapeAction={null}
                  inputSuspended={false}
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
              </Suspense>
            ) : null}
          </>
        ) : screen === 'observer' && observerSession ? (
          <Suspense fallback={null}>
            <DeveloperObserverScene
              accountUsername={accountUsername}
              audio={audio}
              nativeUiStageStyle={nativeStageStyle}
              onExit={exitObserver}
              session={observerSession}
              settings={gameSettings}
            />
          </Suspense>
        ) : screen === 'join-party' ? (
          <JoinPartyScene
            onBack={() => transitionTo('play')}
            onResolved={resolveParty}
            requesterDisplayName={partyRequesterName}
          />
        ) : screen === 'create' ? (
          <CreateMenuScene
            audio={audio}
            backDisabled={collegeLoadoutActive}
            displayName={wizardName}
            onBack={() => { void leaveCreate() }}
            onDisplayNameChange={setWizardName}
            onDisciplineCommit={beginHubLoading}
            onStart={startHub}
            retainedLoadoutCanConfirm={runtimeRunPhase === 'loadout' && Boolean(
              session
              && !runtimeSnapshot?.run.loadoutReadyPlayerIds.includes(session.playerId)
            )}
            retainedLoadout={runtimeRunPhase === 'loadout'
              && !runtimeSnapshot?.players[session?.playerId ?? '']?.economy.collegeIntroPending
              && session && runtimeSnapshot
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
              belt={runtimeSnapshot.players[session.playerId]!.belt}
              boneyard={loadedBoneyard}
              chatInputActive={chatOpen}
              getPingMs={session.getPingMs}
              inputBlocked={sceneInputBlocked}
              inventoryRequestSequence={inventoryRequestSequence}
              modalDisabled={sceneModalDisabled}
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
              onMenuAvailabilityChange={setSceneMenuAvailability}
              onOpenSkillSelector={openHudSkillSelector}
              onOpenSkills={openSkillBook}
              onUnassignQuickbarSkill={(slot) => session.bindSkillQuickbar(null, slot)}
              onPauseRequest={requestGameplayPause}
              onReady={() => finishBoneyardLoading(loadedBoneyard.runId)}
              partyRoster={partyState?.partyRoster}
              progression={runtimeProgression ?? runtimeSnapshot.players[session.playerId]!.progression}
              presentationPaused={gameplayPause !== null || gameplayResumeGrace !== null}
              samplePresentation={session.sampleBoneyardPresentation}
              settings={gameSettings}
              subscribePing={session.onPing}
              subscribeEnemyEvent={session.onEnemyEvent}
              subscribe={session.onSnapshot}
              onTutorialAction={session.sendTutorialAction}
              worldSpeeches={worldSpeeches}
            />
          </Suspense>
        ) : session && runtimeSnapshot?.world.kind === 'hub' ? (
          <Suspense fallback={null}>
            <HubScene
              accountUsername={accountUsername}
              audio={audio}
              belt={runtimeSnapshot.players[session.playerId]!.belt}
              boneyards={session.boneyards}
              chatInputActive={chatOpen}
              getPingMs={session.getPingMs}
              inputBlocked={sceneInputBlocked}
              inventoryRequestSequence={inventoryRequestSequence}
              modalDisabled={sceneModalDisabled}
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
              onMenuAvailabilityChange={setSceneMenuAvailability}
              onMessagePlayer={(playerId, displayName) => setWhisperRequest({
                displayName,
                playerId,
                requestedAtMs: Date.now(),
              })}
              onOpenSkillSelector={openHudSkillSelector}
              onOpenSkills={openSkillBook}
              onUnassignQuickbarSkill={(slot) => session.bindSkillQuickbar(null, slot)}
              onOccupiedChange={setHubSceneOccupied}
              onPauseRequest={requestGameplayPause}
              onReady={() => {
                session.readyCollegeIntro()
                finishHubLoading()
              }}
              onStartMatch={startBoneyard}
              onPartyRotateCode={session.rotatePartyCode}
              onPartyVisibility={session.setPartyVisibility}
              partyActionError={partyActionError}
              partyState={partyState}
              samplePresentation={session.samplePresentation}
              settings={gameSettings}
              sessionKind={session.sessionKind}
              subscribePing={session.onPing}
              subscribe={session.onSnapshot}
              worldSpeeches={worldSpeeches}
            />
          </Suspense>
        ) : null}

        {session && runtimeSnapshot ? (
          <Suspense fallback={null}>
            <ModMinimap session={session} />
            <ModPanels session={session} />
            <ModSceneOverlay session={session} />
          </Suspense>
        ) : null}

        {session && runtimeSnapshot && runtimeRunPhase !== 'game-over' && !tutorialSession ? (
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
              audio={audio}
              belt={runtimeSnapshot!.players[session.playerId]!.belt}
              economy={runtimeSnapshot!.players[session.playerId]!.economy}
              element={runtimeSnapshot!.players[session.playerId]!.config.element}
              inputSuspended={chatOpen}
              onAssignQuickbarSkill={session.bindSkillQuickbar}
              onClose={() => {
                setSkillBookOpen(false)
              }}
              onCloseStart={() => {
                if (runtimeSnapshot?.world.kind === 'boneyard' && runtimeSnapshot.world.tutorial) {
                  session.sendTutorialAction('skills-closed')
                }
              }}
              onOpenInventory={() => {
                setInventoryScreenOpen(true)
                setInventoryRequestSequence((sequence) => sequence + 1)
              }}
              onSelectConcentration={session.selectConcentration}
              onSelectPrimarySkill={session.selectPrimarySkill}
              onUnassignQuickbarSkill={(slot) => session.bindSkillQuickbar(null, slot)}
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
              inputSuspended={chatOpen}
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
              inputSuspended={chatOpen}
              onClosingChange={(closing) => {
                setLevelUpPickerClosing(closing)
                if (!closing) session.readyResumeGrace()
              }}
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

        {gameplayResumeGrace ? (
          <Suspense fallback={null}>
            <GameplayResumeCountdown
              grace={gameplayResumeGrace}
              style={nativeStageStyle}
            />
          </Suspense>
        ) : null}

        {session
          && displayedGameplayPause
          && !gameplaySettingsOpen
          && (
            displayedGameplayPause.source === 'pause-menu'
            || displayedGameplayPause.ownerPlayerId !== session.playerId
          ) ? (
          <Suspense fallback={null}>
            <GameplayPauseMenu
              key={gameplayPauseMenuGeneration}
              audio={audio}
              inputSuspended={chatOpen}
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
          </Suspense>
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
            saveTransfer={settingsContext === 'title' ? saveTransfer : undefined}
            settings={gameSettings}
          />
        ) : null}

        {titlePrompt ? (
          <StockPromptDialog
            busy={titlePromptBusy}
            kind={titlePrompt}
            onHighlight={setHoveredTitleAction}
            onPress={() => audio.playSound('click')}
            onPressState={setPressedTitleAction}
            onPrimary={() => {
              setHoveredTitleAction(null)
              setPressedTitleAction(null)
              if (titlePrompt === 'kill-wizard') void killPromptWizard()
              else {
                setTutorialOfferOpen(false)
                setScreen('tutorial-prelude')
              }
            }}
            onSecondary={() => {
              setHoveredTitleAction(null)
              setPressedTitleAction(null)
              if (titlePrompt === 'kill-wizard') setActiveWizardPrompt(false)
              else {
                setTutorialOfferOpen(false)
                setTutorialDeclined(true)
              }
            }}
            style={nativeStageStyle}
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
              if (admission && collegeIntroPending) {
                void startCollegeIntro(admission, true)
              } else if (admission) beginCreate(admission, true)
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

        {/* One menu skull over every scene with a menu: back out of an open modal first,
            otherwise open the scene menu behind the scene's own OPEN MENU gate. */}
        {screen === 'dark-cloud' ? (
          <GameMenuSkull
            availability={!darkCloudMenuOpen && settingsContext === null ? 'available' : 'inert'}
            frameScale={1}
            onOpenMenu={openDarkCloudMenu}
            scene="dark-cloud"
            stage={stageRef}
          />
        ) : screen === 'hub' && session && runtimeSnapshot && runtimeRunPhase !== 'game-over' ? (
          <GameMenuSkull
            availability={sceneMenuAvailability}
            frameScale={gameUiScale(gameSettings) * fixedViewport.displayScale}
            onOpenMenu={requestGameplayPause}
            scene={gameScene === 'boneyard' ? 'boneyard' : 'hub'}
            stage={stageRef}
          />
        ) : null}
      </section>
      {loading && !tutorialPreludeVisible ? <MatchLoadingScreen loading={loading} /> : null}
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
  if (snapshot.world.tutorial) {
    return snapshot.world.tutorial.waveOrdinal > 0 ? 'boneyard-combat' : 'boneyard'
  }
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
  playerId: string,
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
  if (current.world.kind !== 'hub' || next.world.kind !== 'hub') return false
  const currentCollegeLoadout = current.world.participants[playerId]?.transition?.phase
    === 'college-loadout'
  const nextCollegeLoadout = next.world.participants[playerId]?.transition?.phase
    === 'college-loadout'
  return currentCollegeLoadout === nextCollegeLoadout
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
    && current.pendingOffer?.automaticChoiceIndex === next.pendingOffer?.automaticChoiceIndex
    && current.poisonDamagePerTick === next.poisonDamagePerTick
    && current.poisonTicksRemaining === next.poisonTicksRemaining
    && current.selectedPrimarySkillId === next.selectedPrimarySkillId
    && current.weldBuildId === next.weldBuildId
    && current.advancedUnlocks.every((unlocked, index) => (
      unlocked === next.advancedUnlocks[index]
    ))
    && current.concentrationSkillIds.every((skillId, index) => (
      skillId === next.concentrationSkillIds[index]
    ))
}
