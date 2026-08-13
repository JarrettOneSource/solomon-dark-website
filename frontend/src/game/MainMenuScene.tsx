import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import MenuSolomon from '../fx/MenuSolomon.tsx'
import { mainMenu } from '../lib/assets.ts'
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
import type { GameAudioScene } from './game-audio-native.ts'
import HubScene from './HubScene.tsx'
import { createGamepadMenuNavigation } from './input/gamepad-menu-navigation.ts'
import MainMenuBackdrop from './MainMenuBackdrop.tsx'
import type { GameSnapshot, LoadedBoneyard } from './protocol/game-protocol.ts'
import './main-menu.css'

type MenuScreen = 'root' | 'play' | 'create' | 'hub'
type FadeState = 'idle' | 'covering' | 'revealing'

interface MenuButtonProps {
  accessibleLabel: string
  children?: ReactNode
  className?: string
  compact?: boolean
  defaultFocus?: boolean
  disabled?: boolean
  isBack?: boolean
  onClick?: () => void
  onPress?: () => void
}

function MenuButton({
  accessibleLabel,
  children,
  className,
  compact = false,
  defaultFocus = false,
  disabled = false,
  isBack = false,
  onClick,
  onPress,
}: MenuButtonProps) {
  const corner = compact ? mainMenu.quitCorner : mainMenu.buttonCorner
  const rail = compact ? mainMenu.quitRail : mainMenu.buttonRail
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
      onClick={onClick}
      onPointerDown={(event) => {
        if (!disabled && event.button === 0) onPress?.()
      }}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        if (!disabled && !event.repeat && (event.key === 'Enter' || event.key === ' ')) {
          onPress?.()
        }
      }}
    >
      <img src={mainMenu.button} alt="" className="main-menu-button-stone" />
      <img src={mainMenu.buttonHover} alt="" className="main-menu-button-stone main-menu-button-stone-hover" />
      <img src={corner} alt="" className="main-menu-button-corner main-menu-button-corner-left" />
      <img src={corner} alt="" className="main-menu-button-corner main-menu-button-corner-right" />
      <img src={rail} alt="" className="main-menu-button-rail" />
      <span className="main-menu-button-label" aria-hidden>{children}</span>
    </button>
  )
}

function RootActions({ onPlay, onPress }: { onPlay: () => void; onPress: () => void }) {
  return (
    <>
      <MenuButton accessibleLabel="Play" defaultFocus onClick={onPlay} onPress={onPress}>
        <img src={mainMenu.text.play} alt="" className="main-menu-label-play" />
      </MenuButton>
      <MenuButton accessibleLabel="Explore the Dark Cloud" onPress={onPress}>
        <span className="main-menu-label-two-lines">
          <img src={mainMenu.text.explore} alt="" />
          <img src={mainMenu.text.darkCloud} alt="" />
        </span>
      </MenuButton>
      <MenuButton accessibleLabel="Settings" onPress={onPress}>
        <img src={mainMenu.text.settings} alt="" className="main-menu-label-settings" />
      </MenuButton>
      <MenuButton accessibleLabel="Hall of Fame" onPress={onPress}>
        <img src={mainMenu.text.hall} alt="" className="main-menu-label-hall" />
      </MenuButton>
    </>
  )
}

function PlayActions({
  onBack,
  onNewGame,
  onPress,
}: {
  onBack: () => void
  onNewGame: () => void
  onPress: () => void
}) {
  return (
    <>
      <MenuButton accessibleLabel="Last game unavailable" className="main-menu-button-last-game" disabled>
        <span className="main-menu-label-last-game">
          <img src={mainMenu.text.resume} alt="" />
          <img src={mainMenu.text.lastGame} alt="" />
        </span>
      </MenuButton>
      <MenuButton accessibleLabel="New game" defaultFocus onClick={onNewGame} onPress={onPress}>
        <img src={mainMenu.text.newGame} alt="" className="main-menu-label-new-game" />
      </MenuButton>
      <MenuButton accessibleLabel="Unavailable" className="main-menu-button-empty" disabled />
      <MenuButton accessibleLabel="Back" isBack onClick={onBack} onPress={onPress}>
        <img src={mainMenu.text.back} alt="" className="main-menu-label-back" />
      </MenuButton>
    </>
  )
}

interface MainMenuSceneProps {
  connectSession: (character: PlayerCharacterConfig) => Promise<GameClientSession>
}

export default function MainMenuScene({ connectSession }: MainMenuSceneProps) {
  const audio = useMemo(() => new GameAudioDirector(GAME_AUDIO_SOURCES), [])
  const stageRef = useRef<HTMLElement>(null)
  const [screen, setScreen] = useState<MenuScreen>('root')
  const [fadeState, setFadeState] = useState<FadeState>('idle')
  const [fadeTarget, setFadeTarget] = useState<MenuScreen | null>(null)
  const [session, setSession] = useState<GameClientSession | null>(null)
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<GameSnapshot | null>(null)
  const [loadedBoneyard, setLoadedBoneyard] = useState<LoadedBoneyard | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

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
    const audioScene: GameAudioScene = screen === 'create'
      ? 'create'
      : screen === 'hub'
        ? 'hub'
        : 'title'
    audio.setScene(audioScene)
  }, [audio, screen])

  useEffect(() => {
    if (!session) return
    setRuntimeSnapshot(session.getSnapshot())
    setLoadedBoneyard(session.getBoneyard())
    const removeSnapshot = session.onSnapshot(setRuntimeSnapshot)
    const removeBoneyard = session.onBoneyard(setLoadedBoneyard)
    return () => {
      removeSnapshot()
      removeBoneyard()
    }
  }, [session])

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
        displayName: 'Helvidius',
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
    <div className="main-menu-page">
      <section ref={stageRef} className="main-menu-stage" aria-label="Solomon Dark game menu">
        {titleScreen ? (
          <>
            <MainMenuBackdrop />

            <img src={mainMenu.logo} alt="Solomon Dark" className="main-menu-logo" />
            <img src={mainMenu.text.version} alt="Version 0.72 beta" className="main-menu-version" />

            <MenuSolomon className="main-menu-solomon" />

            <img src={mainMenu.flourish} alt="" className="main-menu-flourish main-menu-flourish-left" />
            <img src={mainMenu.flourish} alt="" className="main-menu-flourish main-menu-flourish-right" />

            <nav key={screen} className="main-menu-actions" aria-label={screen === 'root' ? 'Main menu actions' : 'Play menu actions'}>
              {screen === 'root' ? (
                <RootActions
                  onPlay={() => setScreen('play')}
                  onPress={() => audio.playSound('click')}
                />
              ) : (
                <PlayActions
                  onBack={() => setScreen('root')}
                  onNewGame={() => transitionTo('create')}
                  onPress={() => audio.playSound('click')}
                />
              )}
            </nav>

            <div className="main-menu-quit">
              <MenuButton
                accessibleLabel="Quit"
                compact
                onPress={() => audio.playSound('click')}
              >
                <img src={mainMenu.text.quit} alt="" className="main-menu-label-quit" />
              </MenuButton>
            </div>
          </>
        ) : screen === 'create' ? (
          <CreateMenuScene
            audio={audio}
            onBack={() => transitionTo('play')}
            onStart={startHub}
          />
        ) : session && runtimeSnapshot?.world.kind === 'boneyard' && loadedBoneyard
          && runtimeSnapshot.world.runId === loadedBoneyard.runId ? (
          <BoneyardScene
            boneyard={loadedBoneyard}
            playerId={session.playerId}
            initialSnapshot={runtimeSnapshot}
            onInput={session.sendInput}
          />
        ) : session && runtimeSnapshot?.world.kind === 'hub' ? (
          <HubScene
            audio={audio}
            boneyards={session.boneyards}
            playerId={session.playerId}
            initialSnapshot={runtimeSnapshot}
            onInput={session.sendInput}
            onStartMatch={session.startMatch}
            samplePresentation={session.samplePresentation}
            subscribe={session.onSnapshot}
          />
        ) : session ? (
          <div className="main-menu-runtime-status" role="status">Opening the Boneyard…</div>
        ) : null}

        {(connecting || connectionError) && (
          <div className="main-menu-runtime-status" role={connectionError ? 'alert' : 'status'}>
            {connectionError ?? 'Opening the grounds…'}
          </div>
        )}

        <div
          className={`main-menu-screen-fade main-menu-screen-fade-${fadeState}`}
          onAnimationEnd={handleFadeEnd}
          aria-hidden
        />
      </section>
    </div>
  )
}
