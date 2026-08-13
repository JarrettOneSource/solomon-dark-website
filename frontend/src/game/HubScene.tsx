import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type {
  HubGameSnapshot,
  HubPresentationFrame,
} from './client/hub-presentation-timeline.ts'
import { isHubGameSnapshot } from './client/hub-presentation-timeline.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import type { PlayerCharacterInput } from './core-kernels/player-character.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import {
  hubTeacherReleasesBetween,
  hubTeacherSummonPitch,
  hubTeacherSummonVolume,
  nativeFootstepCue,
  newNativeFootstepTick,
} from './game-audio-native.ts'
import GameHud from './GameHud.tsx'
import HubTouchJoystick from './input/HubTouchJoystick.tsx'
import {
  createBrowserMovementInput,
  type BrowserMovementInput,
} from './input/movement-input.ts'
import type { BoneyardChoice, GameSnapshot } from './protocol/game-protocol.ts'
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
  audio: GameAudioDirector
  boneyards: readonly BoneyardChoice[]
  initialSnapshot: GameSnapshot
  onInput: (input: PlayerCharacterInput) => void
  onStartMatch: (boneyardId: string) => void
  playerId: string
  samplePresentation: (nowMs?: number) => HubPresentationFrame
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
  audio,
  boneyards,
  initialSnapshot,
  onInput,
  onStartMatch,
  playerId,
  samplePresentation,
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
  const inputRef = useRef<BrowserMovementInput | null>(null)
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

  useEffect(() => {
    let previousAudioSnapshot = hubInitialSnapshot
    return subscribe((snapshot) => {
      if (!isHubGameSnapshot(snapshot)) return
      const player = snapshot.players[playerId]
      const previousParticipant = previousAudioSnapshot.world.participants[playerId]
      const participant = snapshot.world.participants[playerId]
      if (player && previousParticipant?.region === participant?.region) {
        const footstepTick = newNativeFootstepTick(
          previousAudioSnapshot.players[playerId],
          player,
        )
        if (footstepTick !== undefined) {
          audio.playSound(nativeFootstepCue(footstepTick, playerId), { volume: 0.5 })
        }
      }
      previousAudioSnapshot = snapshot
      if (participant) setCurrentRegion((region) => (
        region === participant.region ? region : participant.region
      ))
      setHostPlayerId((current) => current === snapshot.hostPlayerId
        ? current
        : snapshot.hostPlayerId)
    })
  }, [audio, hubInitialSnapshot, playerId, subscribe])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let animationFrame = 0
    let previousTeacherSeconds = hubInitialSnapshot.tick / 100
    const input = createBrowserMovementInput({
      onStop: () => onInput({ movement: { x: 0, y: 0 } }),
    })
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
      host.replaceChildren(renderer.canvas)
      renderer.resize(viewportRef.current)
      setRendererState('ready')
      const animate = (now: number) => {
        const movement = input.sample().movement
        onInput({ movement })
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
        animationFrame = requestAnimationFrame(animate)
      }
      animationFrame = requestAnimationFrame(animate)
    }).catch((error: unknown) => {
      if (!cancelled) {
        setRendererError(error instanceof Error
          ? error.message
          : 'The WebGL renderer could not start.')
      }
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
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

  return (
    <div
      ref={sceneRef}
      className="hub-scene"
      data-discipline={localPlayer?.config.discipline ?? 'arcane'}
      data-element={element}
      data-hub-region={currentRegion}
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
        <div ref={hostRef} className="hub-world-renderer" />

        <GameHud
          element={element}
          mapLabel="Enter the Boneyard"
          onMapClick={beginMatch}
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

        <HubTouchJoystick onInput={(movement) => inputRef.current?.setTouch(movement)} />

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
