import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { loadLoaderAssets, loadResidentGameAssets } from '../game/game-assets'
import { bootGame, type GameEndpoint, type GameSession } from '../game/engine.ts'
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
import { useAuth } from '../lib/auth'

type Readiness = 'loader' | 'assets' | 'ready'

export default function Game() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedParty = searchParams.get('party')
  const lobbyId = parseGameLobbyId(requestedParty)
  const hostedLobby = useRef<CreatedGameLobby | null>(null)
  const preparedEndpoint = useRef<GameEndpoint | null>(null)
  const [readiness, setReadiness] = useState<Readiness>('loader')
  const [progress, setProgress] = useState(0)
  const [fatal, setFatal] = useState<string | null>(null)

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
    void loadLoaderAssets().then(() => {
      if (!cancelled) setReadiness('assets')
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (readiness !== 'assets') return
    let cancelled = false
    void loadResidentGameAssets(({ completed, total }) => {
      if (!cancelled) setProgress(total === 0 ? 1 : completed / total)
    }).then(() => {
      if (!cancelled) setReadiness('ready')
    })
    return () => { cancelled = true }
  }, [readiness])

  const displayName = user?.username ?? 'Helvidius'

  const prepareNewGame = useCallback(async (): Promise<void> => {
    if (preparedEndpoint.current) return
    const configured = configuredGameEndpoint()
    if (configured) {
      preparedEndpoint.current = configured
      return
    }
    const created = await createGameLobby(displayName)
    hostedLobby.current = created
    preparedEndpoint.current = created.endpoint
  }, [displayName])

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
  ): Promise<GameSession> => {
    const endpoint = lobbyId
      ? await joinGameLobby(lobbyId)
      : preparedEndpoint.current
    if (!endpoint) throw new Error('The web playtest was not prepared.')
    const session = await bootGame({
      character,
      endpoint,
      onFatal: (error) => setFatal(error.message),
    })
    if (lobbyId) navigate('/game', { replace: true })
    hostedLobby.current = null
    preparedEndpoint.current = null
    return session
  }, [lobbyId, navigate])

  if (fatal || (requestedParty !== null && lobbyId === null)) {
    return (
      <div className="game-runtime-error" role="alert">
        {fatal ?? 'The web playtest lobby link is invalid.'}
      </div>
    )
  }
  return (
    <>
      {readiness === 'ready'
        ? (
            <MainMenuScene
              connectSession={connectSession}
              displayName={displayName}
              initialScreen={lobbyId ? 'create' : 'root'}
              onCancelCreate={cancelCreate}
              prepareNewGame={prepareNewGame}
            />
          )
        : <NativeLoader progress={progress} />}
      <div className="game-orientation-hint" role="status">
        Rotate your device to landscape to enter the College.
      </div>
    </>
  )
}
