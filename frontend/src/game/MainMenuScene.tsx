import { useEffect, useState, type AnimationEvent, type ReactNode } from 'react'
import MenuSolomon from '../fx/MenuSolomon'
import { mainMenu } from '../lib/assets'
import CreateMenuScene from './CreateMenuScene'
import HubScene from './HubScene'
import MainMenuBackdrop from './MainMenuBackdrop'
import type { GameClientSession } from './client/game-client-session.ts'
import type {
  PlayerCharacterConfig,
  WizardDiscipline,
  WizardElement,
} from './core-kernels/player-character.ts'
import './main-menu.css'

type MenuScreen = 'root' | 'play' | 'create' | 'hub'
type FadeState = 'idle' | 'covering' | 'revealing'

interface MenuButtonProps {
  accessibleLabel: string
  children?: ReactNode
  className?: string
  compact?: boolean
  disabled?: boolean
  onClick?: () => void
}

function MenuButton({
  accessibleLabel,
  children,
  className,
  compact = false,
  disabled = false,
  onClick,
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
      onClick={onClick}
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

function RootActions({ onPlay }: { onPlay: () => void }) {
  return (
    <>
      <MenuButton accessibleLabel="Play" onClick={onPlay}>
        <img src={mainMenu.text.play} alt="" className="main-menu-label-play" />
      </MenuButton>
      <MenuButton accessibleLabel="Explore the Dark Cloud">
        <span className="main-menu-label-two-lines">
          <img src={mainMenu.text.explore} alt="" />
          <img src={mainMenu.text.darkCloud} alt="" />
        </span>
      </MenuButton>
      <MenuButton accessibleLabel="Settings">
        <img src={mainMenu.text.settings} alt="" className="main-menu-label-settings" />
      </MenuButton>
      <MenuButton accessibleLabel="Hall of Fame">
        <img src={mainMenu.text.hall} alt="" className="main-menu-label-hall" />
      </MenuButton>
    </>
  )
}

function PlayActions({ onBack, onNewGame }: { onBack: () => void; onNewGame: () => void }) {
  return (
    <>
      <MenuButton accessibleLabel="Last game unavailable" className="main-menu-button-last-game" disabled>
        <span className="main-menu-label-last-game">
          <img src={mainMenu.text.resume} alt="" />
          <img src={mainMenu.text.lastGame} alt="" />
        </span>
      </MenuButton>
      <MenuButton accessibleLabel="New game" onClick={onNewGame}>
        <img src={mainMenu.text.newGame} alt="" className="main-menu-label-new-game" />
      </MenuButton>
      <MenuButton accessibleLabel="Unavailable" className="main-menu-button-empty" disabled />
      <MenuButton accessibleLabel="Back" onClick={onBack}>
        <img src={mainMenu.text.back} alt="" className="main-menu-label-back" />
      </MenuButton>
    </>
  )
}

interface MainMenuSceneProps {
  connectSession: (character: PlayerCharacterConfig) => Promise<GameClientSession>
}

export default function MainMenuScene({ connectSession }: MainMenuSceneProps) {
  const [screen, setScreen] = useState<MenuScreen>('root')
  const [fadeState, setFadeState] = useState<FadeState>('idle')
  const [fadeTarget, setFadeTarget] = useState<MenuScreen | null>(null)
  const [session, setSession] = useState<GameClientSession | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => () => session?.destroy(), [session])

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
  ) => {
    if (connecting) return
    setConnecting(true)
    setConnectionError(null)
    try {
      const nextSession = await connectSession({
        discipline: selectedDiscipline,
        displayName: 'Helvidius',
        element: selectedElement,
      })
      setSession(nextSession)
      transitionTo('hub')
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Game server connection failed.')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="main-menu-page">
      <section className="main-menu-stage" aria-label="Solomon Dark game menu">
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
                <RootActions onPlay={() => setScreen('play')} />
              ) : (
                <PlayActions onBack={() => setScreen('root')} onNewGame={() => transitionTo('create')} />
              )}
            </nav>

            <div className="main-menu-quit">
              <MenuButton accessibleLabel="Quit" compact>
                <img src={mainMenu.text.quit} alt="" className="main-menu-label-quit" />
              </MenuButton>
            </div>
          </>
        ) : screen === 'create' ? (
          <CreateMenuScene
            onBack={() => transitionTo('play')}
            onStart={(selectedElement, selectedDiscipline) => {
              void startHub(selectedElement, selectedDiscipline)
            }}
          />
        ) : session ? (
          <HubScene
            playerId={session.playerId}
            initialSnapshot={session.getSnapshot()}
            onInput={session.sendInput}
            subscribe={session.onSnapshot}
          />
        ) : null}

        {(connecting || connectionError) && (
          <div className="main-menu-runtime-status" role={connectionError ? 'alert' : 'status'}>
            {connectionError ?? 'Opening the class…'}
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
