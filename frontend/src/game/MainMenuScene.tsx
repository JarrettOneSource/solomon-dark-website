import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import BoneyardScene from './BoneyardScene.tsx'
import CreateMenuScene from './CreateMenuScene.tsx'
import type { GameClientSession } from './client/game-client-session.ts'
import type {
  PlayerCharacterConfig,
  WizardDiscipline,
  WizardElement,
} from './core-kernels/player-character.ts'
import { GAME_AUDIO_SOURCES } from './game-audio-assets.ts'
import { GameAudioDirector } from './game-audio-director.ts'
import { PrimarySpellAudioSynchronizer } from './primary-spell-audio.ts'
import type { GameAudioScene } from './game-audio-native.ts'
import GameFullscreenButton from './GameFullscreenButton.tsx'
import HubScene from './HubScene.tsx'
import { createGamepadMenuNavigation } from './input/gamepad-menu-navigation.ts'
import type { GameSnapshot, LoadedBoneyard } from './protocol/game-protocol.ts'
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
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
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
}: ActionGroupProps & { onPlay: () => void }) {
  return (
    <>
      <MenuButton action="play" accessibleLabel="Play" defaultFocus onClick={onPlay} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="explore" accessibleLabel="Explore the Dark Cloud" onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="settings" accessibleLabel="Settings" onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="hall" accessibleLabel="Hall of Fame" onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
    </>
  )
}

function PlayActions({
  onBack,
  onHighlight,
  onNewGame,
  onPress,
  onPressState,
}: ActionGroupProps & {
  onBack: () => void
  onNewGame: () => void
}) {
  return (
    <>
      <MenuButton action="last-game" accessibleLabel="Last game unavailable" className="main-menu-button-last-game" disabled onHighlight={onHighlight} onPressState={onPressState} />
      <MenuButton action="new-game" accessibleLabel="New game" defaultFocus onClick={onNewGame} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
      <MenuButton action="unavailable" accessibleLabel="Unavailable" className="main-menu-button-empty" disabled onHighlight={onHighlight} onPressState={onPressState} />
      <MenuButton action="back" accessibleLabel="Back" isBack onClick={onBack} onHighlight={onHighlight} onPress={onPress} onPressState={onPressState} />
    </>
  )
}

interface MainMenuSceneProps {
  displayName: string
  connectSession: (character: PlayerCharacterConfig) => Promise<GameClientSession>
  initialScreen?: 'create' | 'root'
  onCancelCreate: () => Promise<void>
  prepareNewGame: () => Promise<void>
}

export default function MainMenuScene({
  connectSession,
  displayName,
  initialScreen = 'root',
  onCancelCreate,
  prepareNewGame,
}: MainMenuSceneProps) {
  const audio = useMemo(() => new GameAudioDirector(GAME_AUDIO_SOURCES), [])
  const stageRef = useRef<HTMLElement>(null)
  const [screen, setScreen] = useState<MenuScreen>(initialScreen)
  const [fadeState, setFadeState] = useState<FadeState>('idle')
  const [fadeTarget, setFadeTarget] = useState<MenuScreen | null>(null)
  const [session, setSession] = useState<GameClientSession | null>(null)
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<GameSnapshot | null>(null)
  const [loadedBoneyard, setLoadedBoneyard] = useState<LoadedBoneyard | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [hoveredTitleAction, setHoveredTitleAction] = useState<TitleMenuAction | null>(null)
  const [pressedTitleAction, setPressedTitleAction] = useState<TitleMenuAction | null>(null)
  const [fixedViewport, setFixedViewport] = useState(() => (
    fixedGameViewportLayout(GAME_VIEWPORT_MIN_WIDTH, GAME_VIEWPORT_MIN_HEIGHT)
  ))

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
    const audioScene: GameAudioScene = runtimeSnapshot?.world.kind === 'boneyard'
      ? 'boneyard'
      : screen === 'create'
        ? 'create'
        : screen === 'hub'
          ? 'hub'
          : 'title'
    audio.setScene(audioScene)
  }, [audio, runtimeSnapshot?.world.kind, screen])

  useEffect(() => {
    if (!session) return
    setRuntimeSnapshot(session.getSnapshot())
    setLoadedBoneyard(session.getBoneyard())
    const removeSnapshot = session.onSnapshot((snapshot) => {
      setRuntimeSnapshot((current) => sameRuntimeScene(current, snapshot)
        ? current
        : snapshot)
    })
    const removeBoneyard = session.onBoneyard(setLoadedBoneyard)
    return () => {
      removeSnapshot()
      removeBoneyard()
    }
  }, [session])

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
    if (screen === 'hub' || !stageRef.current) return
    const navigation = createGamepadMenuNavigation({ root: stageRef.current })
    return () => navigation.destroy()
  }, [screen])

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

  const beginNewGame = async () => {
    if (preparing || connecting) return
    setPreparing(true)
    setConnectionError(null)
    try {
      await prepareNewGame()
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

  const startHub = async (
    selectedElement: WizardElement,
    selectedDiscipline: WizardDiscipline,
  ): Promise<boolean> => {
    if (connecting) return false
    setConnecting(true)
    setConnectionError(null)
    try {
      const nextSession = await connectSession({
        discipline: selectedDiscipline,
        displayName,
        element: selectedElement,
      })
      setSession(nextSession)
      setRuntimeSnapshot(nextSession.getSnapshot())
      setLoadedBoneyard(nextSession.getBoneyard())
      transitionTo('hub')
      return true
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Game server connection failed.')
      return false
    } finally {
      setConnecting(false)
    }
  }

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

            <div className="main-menu-native-stage" style={nativeStageStyle}>
              <nav key={screen} className="main-menu-actions" aria-label={screen === 'root' ? 'Main menu actions' : 'Play menu actions'}>
                {screen === 'root' ? (
                  <RootActions
                    onHighlight={setHoveredTitleAction}
                    onPlay={() => setScreen('play')}
                    onPress={() => audio.playSound('click')}
                    onPressState={setPressedTitleAction}
                  />
                ) : (
                  <PlayActions
                    onBack={() => setScreen('root')}
                    onHighlight={setHoveredTitleAction}
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
            onBack={() => { void leaveCreate() }}
            onStart={startHub}
            viewport={fixedViewport}
          />
        ) : session && runtimeSnapshot?.world.kind === 'boneyard' && loadedBoneyard
          && runtimeSnapshot.world.runId === loadedBoneyard.runId ? (
          <BoneyardScene
            boneyard={loadedBoneyard}
            getPingMs={session.getPingMs}
            playerId={session.playerId}
            initialSnapshot={runtimeSnapshot}
            onInput={session.sendInput}
            samplePresentation={session.sampleBoneyardPresentation}
            subscribePing={session.onPing}
            subscribe={session.onSnapshot}
          />
        ) : session && runtimeSnapshot?.world.kind === 'hub' ? (
          <HubScene
            audio={audio}
            boneyards={session.boneyards}
            getPingMs={session.getPingMs}
            playerId={session.playerId}
            initialSnapshot={runtimeSnapshot}
            onInput={session.sendInput}
            onStartMatch={session.startMatch}
            samplePresentation={session.samplePresentation}
            subscribePing={session.onPing}
            subscribe={session.onSnapshot}
          />
        ) : session ? (
          <div className="main-menu-runtime-status" role="status">Opening the Boneyard…</div>
        ) : null}

        {(preparing || connecting || connectionError) && (
          <div className="main-menu-runtime-status" role={connectionError ? 'alert' : 'status'}>
            {connectionError ?? (preparing ? 'Opening the web playtest…' : 'Opening the grounds…')}
          </div>
        )}

        <div
          className={`main-menu-screen-fade main-menu-screen-fade-${fadeState}`}
          onAnimationEnd={handleFadeEnd}
          aria-hidden
        />
      </section>
      <GameFullscreenButton />
    </div>
  )
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
  if (!current || current.world.kind !== next.world.kind) return false
  if (current.world.kind === 'boneyard' && next.world.kind === 'boneyard') {
    return current.world.runId === next.world.runId
  }
  return current.world.kind === 'hub'
}
