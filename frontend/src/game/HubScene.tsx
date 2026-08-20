import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import type {
  HubGameSnapshot,
  HubPresentationFrame,
} from './client/hub-presentation-timeline.ts'
import { isHubGameSnapshot } from './client/hub-presentation-timeline.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import {
  HUB_CAMERA_SCALE,
  hubRegionCameraOrigin,
} from './core-kernels/hub-math.ts'
import type { PlayerCharacterInput } from './core-kernels/player-character.ts'
import type { HubInventoryAction } from './core-kernels/hub-economy.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import {
  hubTeacherReleasesBetween,
  hubTeacherSummonPitch,
  hubTeacherSummonVolume,
} from './game-audio-native.ts'
import { startGamePresentationLoop } from './game-presentation-frame-loop.ts'
import GameHud from './GameHud.tsx'
import HubInventoryUi, { type HubUiSurface } from './HubInventoryUi.tsx'
import {
  hubTraderAtPoint,
  hubTraderWithinServiceRange,
} from './hub-inventory-presentation.ts'
import TouchJoystick from './input/TouchJoystick.tsx'
import {
  createBrowserGameplayInput,
  type BrowserGameplayInput,
} from './input/gameplay-input.ts'
import {
  projectNativeStickAim,
  projectNativeWorldPointer,
} from './input/gameplay-pointer.ts'
import type { BoneyardChoice, GameSnapshot } from './protocol/game-protocol.ts'
import type {
  ProtocolPlayerEconomy,
  ProtocolPlayerProgression,
} from './protocol/game-state.ts'
import { PlayerFootstepAudioSynchronizer } from './player-footstep-audio.ts'
import {
  createHubWorldRenderer,
  type HubWorldRenderer,
} from './renderer/hub-world-renderer.ts'
import {
  gameViewportLayout,
  type GameViewportLayout,
} from './renderer/game-viewport.ts'
import './hub.css'

interface HubSceneProps {
  accountUsername: string | null
  audio: GameAudioDirector
  boneyards: readonly BoneyardChoice[]
  getPingMs: () => number | null
  initialSnapshot: GameSnapshot
  inputBlocked: boolean
  levelUpModalActive: boolean
  levelUpPresentationId: number | null
  onInput: (input: PlayerCharacterInput) => void
  onHubAction: (action: HubInventoryAction) => void
  onLoadingError: () => void
  onPauseRequest: () => void
  onReady: () => void
  onStartMatch: (boneyardId: string) => void
  playerId: string
  progression: ProtocolPlayerProgression
  presentationPaused: boolean
  samplePresentation: (nowMs?: number) => HubPresentationFrame
  subscribePing: (listener: (pingMs: number) => void) => () => void
  subscribe: (listener: (snapshot: GameSnapshot) => void) => () => void
}

type RendererState = 'loading' | 'ready'
const HUB_TEACHER_POSITION = { x: 576.5, y: 710.5 } as const
const HUB_REGION_ACCESSIBILITY: Readonly<Record<HubRegionId, string>> = {
  courtyard: 'College courtyard. Move with W A S D, arrow keys, a controller, or the touch joystick.',
  mortuary: 'College mortuary. Move toward the south doorway to return to the courtyard.',
  library: 'College library. Move toward the south doorway to return to the courtyard.',
  storeroom: 'College storeroom. Move toward the south doorway to return to the courtyard.',
  office: 'Arch Chancellor office. Move toward the south doorway to return to the courtyard.',
}

export default function HubScene({
  accountUsername,
  audio,
  boneyards,
  getPingMs,
  initialSnapshot,
  inputBlocked,
  levelUpModalActive,
  levelUpPresentationId,
  onInput,
  onHubAction,
  onLoadingError,
  onPauseRequest,
  onReady,
  onStartMatch,
  playerId,
  progression,
  presentationPaused,
  samplePresentation,
  subscribePing,
  subscribe,
}: HubSceneProps) {
  const [hubInitialSnapshot] = useState<HubGameSnapshot>(() => {
    if (!isHubGameSnapshot(initialSnapshot)) {
      throw new Error('Hub scene requires a Hub snapshot')
    }
    return initialSnapshot
  })
  const sceneRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<HubWorldRenderer | null>(null)
  const inputRef = useRef<BrowserGameplayInput | null>(null)
  const inputBlockedRef = useRef(inputBlocked)
  const presentationPausedRef = useRef(presentationPaused)
  const modalOpenRef = useRef(false)
  const levelUpModalActiveRef = useRef(levelUpModalActive)
  const levelUpPresentationIdRef = useRef(levelUpPresentationId)
  const onLoadingErrorRef = useRef(onLoadingError)
  const onReadyRef = useRef(onReady)
  inputBlockedRef.current = inputBlocked
  presentationPausedRef.current = presentationPaused
  levelUpModalActiveRef.current = levelUpModalActive
  levelUpPresentationIdRef.current = levelUpPresentationId
  onLoadingErrorRef.current = onLoadingError
  onReadyRef.current = onReady
  const [rendererState, setRendererState] = useState<RendererState>('loading')
  const [rendererError, setRendererError] = useState<string | null>(null)
  const [viewport, setViewport] = useState<GameViewportLayout>(() => (
    gameViewportLayout(1600, 900)
  ))
  const viewportRef = useRef(viewport)
  const [hostPlayerId, setHostPlayerId] = useState(initialSnapshot.hostPlayerId)
  const [currentRegion, setCurrentRegion] = useState<HubRegionId>(
    hubInitialSnapshot.world.participants[playerId]?.region ?? 'courtyard',
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [hubUiSurface, setHubUiSurface] = useState<HubUiSurface>(null)
  const [economy, setEconomy] = useState<ProtocolPlayerEconomy>(() => (
    hubInitialSnapshot.players[playerId]!.economy
  ))
  const [playerPosition, setPlayerPosition] = useState(() => ({
    ...hubInitialSnapshot.players[playerId]!.position,
  }))
  const [transitionActive, setTransitionActive] = useState(() => (
    hubInitialSnapshot.world.participants[playerId]?.transition !== null
  ))
  const modalOpen = pickerOpen || hubUiSurface !== null
  modalOpenRef.current = modalOpen

  useLayoutEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const resize = () => {
      const next = gameViewportLayout(scene.clientWidth, scene.clientHeight)
      viewportRef.current = next
      setViewport((current) => sameViewport(current, next) ? current : next)
      rendererRef.current?.resize(next)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(scene)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    inputRef.current?.setBlocked(inputBlocked || modalOpen)
  }, [inputBlocked, modalOpen])

  useEffect(() => {
    const openPause = (event: KeyboardEvent) => {
      if (
        inputBlocked
        || modalOpen
        || transitionActive
        || event.key !== 'Escape'
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) return
      event.preventDefault()
      event.stopPropagation()
      onPauseRequest()
    }
    window.addEventListener('keydown', openPause)
    return () => window.removeEventListener('keydown', openPause)
  }, [inputBlocked, modalOpen, onPauseRequest, transitionActive])

  useLayoutEffect(() => {
    rendererRef.current?.setLevelUpPresentation(
      levelUpPresentationId,
      levelUpModalActive,
    )
  }, [levelUpModalActive, levelUpPresentationId])

  useEffect(() => {
    const footstepAudio = new PlayerFootstepAudioSynchronizer(
      audio,
      playerId,
      hubInitialSnapshot,
      (event) => {
        if (event.playerId !== playerId) return
        const scene = sceneRef.current
        if (scene) scene.dataset.lastFootstepTick = `${event.tick}`
      },
    )
    return subscribe((snapshot) => {
      if (!isHubGameSnapshot(snapshot)) return
      const participant = snapshot.world.participants[playerId]
      footstepAudio.update(snapshot)
      if (participant) setCurrentRegion((region) => (
        region === participant.region ? region : participant.region
      ))
      if (participant) setTransitionActive(participant.transition !== null)
      const player = snapshot.players[playerId]
      if (player) {
        setPlayerPosition((position) => (
          position.x === player.position.x && position.y === player.position.y
            ? position
            : { ...player.position }
        ))
        setEconomy((current) => (
          current.revision === player.economy.revision ? current : player.economy
        ))
      }
      setHostPlayerId((current) => current === snapshot.hostPlayerId
        ? current
        : snapshot.hostPlayerId)
    })
  }, [audio, hubInitialSnapshot, playerId, subscribe])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let stopPresentationLoop: (() => void) | null = null
    let previousTeacherSeconds = hubInitialSnapshot.tick / 100
    const input = createBrowserGameplayInput({
      mouseTarget: host,
      onInput,
      projectDirection: (direction) => {
        const snapshot = samplePresentation()
        const player = snapshot.players[playerId]
        if (!player) return null
        return projectNativeStickAim(
          direction,
          player.position,
          viewportRef.current,
          HUB_CAMERA_SCALE,
        )
      },
      projectPointer: (pointer) => {
        const snapshot = samplePresentation()
        const player = snapshot.players[playerId]
        const participant = snapshot.world.participants[playerId]
        if (!player || !participant) return null
        return projectNativeWorldPointer(
          pointer,
          host.getBoundingClientRect(),
          viewportRef.current,
          hubRegionCameraOrigin(
            participant.region,
            player.position,
            viewportRef.current,
          ),
          HUB_CAMERA_SCALE,
        )
      },
    })
    input.setBlocked(inputBlockedRef.current || modalOpenRef.current)
    inputRef.current = input
    setRendererState('loading')
    setRendererError(null)

    void createHubWorldRenderer({
      initialSnapshot: hubInitialSnapshot,
      playerId,
      viewport: viewportRef.current,
    }).then((renderer) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      renderer.setLevelUpPresentation(
        levelUpPresentationIdRef.current,
        levelUpModalActiveRef.current,
      )
      host.replaceChildren(renderer.canvas)
      renderer.resize(viewportRef.current)
      setRendererState('ready')
      onReadyRef.current()
      stopPresentationLoop = startGamePresentationLoop((now) => {
        if (presentationPausedRef.current) return
        onInput(input.sample().input)
        const snapshot = samplePresentation(now)
        const teacherSeconds = snapshot.tick / 100
        for (const releaseIndex of hubTeacherReleasesBetween(
          previousTeacherSeconds,
          teacherSeconds,
        )) {
          const player = snapshot.players[playerId]
          if (player && snapshot.world.participants[playerId]?.region === 'courtyard') {
            audio.playSound('summon', {
              playbackRate: hubTeacherSummonPitch(releaseIndex),
              volume: hubTeacherSummonVolume(HUB_TEACHER_POSITION, player.position),
            })
          }
        }
        previousTeacherSeconds = teacherSeconds
        renderer.render(snapshot)
      })
    }).catch((error: unknown) => {
      if (!cancelled) {
        onLoadingErrorRef.current()
        setRendererError(error instanceof Error
          ? error.message
          : 'The WebGL renderer could not start.')
      }
    })

    return () => {
      cancelled = true
      stopPresentationLoop?.()
      input.destroy()
      inputRef.current = null
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [audio, hubInitialSnapshot, onInput, playerId, samplePresentation])

  const isHost = hostPlayerId === playerId
  const beginMatch = () => {
    if (!isHost || currentRegion !== 'courtyard') return
    if (boneyards.length === 1) {
      onStartMatch(boneyards[0].id)
      return
    }
    setPickerOpen(true)
  }
  const localPlayer = hubInitialSnapshot.players[playerId]
  const element = localPlayer?.config.element ?? 'ether'
  const activatePointerTrader = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || inputBlocked || modalOpen || transitionActive) return
    const host = hostRef.current
    if (!host) return
    const snapshot = samplePresentation()
    const player = snapshot.players[playerId]
    const participant = snapshot.world.participants[playerId]
    if (!player || !participant || participant.transition) return
    const point = projectNativeWorldPointer(
      { x: event.clientX, y: event.clientY },
      host.getBoundingClientRect(),
      viewportRef.current,
      hubRegionCameraOrigin(
        participant.region,
        player.position,
        viewportRef.current,
      ),
      HUB_CAMERA_SCALE,
    )
    if (!point) return
    const trader = hubTraderAtPoint(participant.region, point)
    if (!trader || !hubTraderWithinServiceRange(
      trader,
      participant.region,
      player.position,
    )) return
    event.preventDefault()
    event.stopPropagation()
    setHubUiSurface({ kind: 'dialogue', trader })
  }

  return (
    <div
      ref={sceneRef}
      className="hub-scene"
      data-discipline={localPlayer?.config.discipline ?? 'arcane'}
      data-element={element}
      data-gameplay-input-blocked={inputBlocked || modalOpen}
      data-presentation-paused={presentationPaused}
      data-hub-region={currentRegion}
      data-hub-ui-surface={hubUiSurface?.kind ?? 'none'}
      data-modal-open={modalOpen}
      data-is-host={isHost}
      data-viewport-height={viewport.height}
      data-viewport-scale={viewport.displayScale}
      data-viewport-width={viewport.width}
      data-renderer-state={rendererError ? 'error' : rendererState}
      aria-label={HUB_REGION_ACCESSIBILITY[currentRegion]}
      tabIndex={0}
    >
      <div
        className="hub-native-frame"
        style={{
          height: viewport.height,
          transform: `scale(${viewport.displayScale})`,
          width: viewport.width,
        } satisfies CSSProperties}
      >
        <div
          ref={hostRef}
          className="hub-world-renderer"
          onMouseDownCapture={activatePointerTrader}
        />

        <GameHud
          accountUsername={accountUsername}
          element={element}
          getPingMs={getPingMs}
          initialSnapshot={hubInitialSnapshot}
          mapLabel="Enter the Boneyard"
          onInventoryClick={() => {
            if (!inputBlocked && !pickerOpen && !transitionActive) {
              setHubUiSurface({ kind: 'inventory' })
            }
          }}
          onMapClick={beginMatch}
          playerId={playerId}
          progression={progression}
          subscribePing={subscribePing}
          subscribeSnapshot={subscribe}
        />

        <HubInventoryUi
          audio={audio}
          config={hubInitialSnapshot.players[playerId]!.config}
          disabled={inputBlocked || pickerOpen}
          economy={economy}
          onAction={onHubAction}
          onSurfaceChange={setHubUiSurface}
          playerPosition={playerPosition}
          progression={progression}
          region={currentRegion}
          surface={hubUiSurface}
          transitionActive={transitionActive}
        />

        {pickerOpen && isHost && (
          <div className="hub-boneyard-picker-backdrop" role="presentation">
            <section
              className="hub-boneyard-picker"
              role="dialog"
              aria-modal="true"
              aria-labelledby="hub-boneyard-picker-title"
            >
              <h2 id="hub-boneyard-picker-title">Choose a Boneyard</h2>
              <div className="hub-boneyard-options">
                {boneyards.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className="hub-boneyard-option"
                    data-boneyard-id={choice.id}
                    onClick={() => onStartMatch(choice.id)}
                  >
                    <strong>{choice.name}</strong>
                    <span>
                      {choice.source === 'default'
                        ? 'A stock-generated random arena'
                        : choice.modName ?? choice.modId}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="hub-boneyard-cancel"
                onClick={() => setPickerOpen(false)}
              >
                Cancel
              </button>
            </section>
          </div>
        )}

        <TouchJoystick
          lane="movement"
          onInput={(movement) => inputRef.current?.setTouch(movement)}
        />
        <TouchJoystick
          lane="primary"
          onInput={(direction) => inputRef.current?.setTouchPrimary(direction)}
        />

        <div className="hub-world-accessibility sr-only">
          {currentRegion === 'courtyard'
            ? 'College courtyard landmarks: Mortuary, Library, Storeroom, Arch Chancellor office, Perk witch, Potion trader, Annalist, Items trader, Teacher, fountain, College statue, and Useful Thyngs tent.'
            : HUB_REGION_ACCESSIBILITY[currentRegion]}
        </div>

        {rendererState === 'loading' && !rendererError && (
          <div className="hub-renderer-status" role="status">Preparing the College…</div>
        )}
        {rendererError && (
          <div className="hub-renderer-status hub-renderer-error" role="alert">
            WebGL could not render the College: {rendererError}
          </div>
        )}
      </div>
    </div>
  )
}

function sameViewport(left: GameViewportLayout, right: GameViewportLayout): boolean {
  return left.displayScale === right.displayScale
    && left.height === right.height
    && left.width === right.width
}
