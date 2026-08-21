import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  HubGameSnapshot,
  HubPresentationFrame,
} from './client/hub-presentation-timeline.ts'
import { isHubGameSnapshot } from './client/hub-presentation-timeline.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import { actorHeadingVector } from './core-kernels/actor-heading.ts'
import {
  HUB_CAMERA_SCALE,
  hubRegionCameraOrigin,
} from './core-kernels/hub-math.ts'
import type { PlayerCharacterInput } from './core-kernels/player-character.ts'
import type { HubInventoryAction } from './core-kernels/hub-economy.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import {
  cameraZoomForFov,
  gameUiScale,
  type GameSettings,
} from './game-settings.ts'
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
import type { BoneyardChoice, GameModAsset, GameSnapshot } from './protocol/game-protocol.ts'
import type { LocalPartyState } from './protocol/party-state.ts'
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
import { selectHubPlayerAtPoint } from './hub-player-selection.ts'
import './hub.css'

interface HubSceneProps {
  accountUsername: string | null
  audio: GameAudioDirector
  boneyards: readonly BoneyardChoice[]
  getPingMs: () => number | null
  initialSnapshot: GameSnapshot
  inputBlocked: boolean
  inventoryRequestSequence: number
  modAssets: readonly GameModAsset[]
  levelUpPresentationId: number | null
  onInput: (input: PlayerCharacterInput) => void
  onAcceptPartyInvitation: (invitationId: string) => void
  onDenyPartyInvitation: (invitationId: string) => void
  onHubAction: (action: HubInventoryAction) => void
  onInventoryOpenChange: (open: boolean) => void
  onInvitePlayer: (playerId: string) => void
  onLoadingError: () => void
  onOpenSkills: () => void
  onPauseRequest: () => void
  onReady: () => void
  onStartMatch: (boneyardId: string) => void
  partyState: LocalPartyState | null
  playerId: string
  progression: ProtocolPlayerProgression
  presentationPaused: boolean
  samplePresentation: (nowMs?: number) => HubPresentationFrame
  settings: GameSettings
  subscribePing: (listener: (pingMs: number) => void) => () => void
  subscribe: (listener: (snapshot: GameSnapshot) => void) => () => void
}

type RendererState = 'loading' | 'ready'
const HUB_TEACHER_POSITION = { x: 576.5, y: 710.5 } as const
const HUB_REGION_ACCESSIBILITY: Readonly<Record<HubRegionId, string>> = {
  courtyard: 'College courtyard. Move with the configured keys, a controller, or the touch joystick.',
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
  inventoryRequestSequence,
  modAssets,
  levelUpPresentationId,
  onInput,
  onAcceptPartyInvitation,
  onDenyPartyInvitation,
  onHubAction,
  onInventoryOpenChange,
  onInvitePlayer,
  onLoadingError,
  onOpenSkills,
  onPauseRequest,
  onReady,
  onStartMatch,
  partyState,
  playerId,
  progression,
  presentationPaused,
  samplePresentation,
  settings,
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
  const settingsRef = useRef(settings)
  const presentationPausedRef = useRef(presentationPaused)
  const modalOpenRef = useRef(false)
  const levelUpPresentationIdRef = useRef(levelUpPresentationId)
  const onLoadingErrorRef = useRef(onLoadingError)
  const onReadyRef = useRef(onReady)
  inputBlockedRef.current = inputBlocked
  settingsRef.current = settings
  presentationPausedRef.current = presentationPaused
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
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const inventoryRequestRef = useRef(inventoryRequestSequence)
  const [economy, setEconomy] = useState<ProtocolPlayerEconomy>(() => (
    hubInitialSnapshot.players[playerId]!.economy
  ))
  const [playerPosition, setPlayerPosition] = useState(() => ({
    ...hubInitialSnapshot.players[playerId]!.position,
  }))
  const [transitionActive, setTransitionActive] = useState(() => (
    hubInitialSnapshot.world.participants[playerId]?.transition !== null
  ))
  const modalOpen = pickerOpen || hubUiSurface !== null || selectedPlayerId !== null
  modalOpenRef.current = modalOpen

  useEffect(() => {
    onInventoryOpenChange(hubUiSurface?.kind === 'inventory')
  }, [hubUiSurface?.kind, onInventoryOpenChange])

  useEffect(() => {
    if (inventoryRequestRef.current === inventoryRequestSequence) return
    inventoryRequestRef.current = inventoryRequestSequence
    if (!inputBlocked && !pickerOpen && !transitionActive) {
      setHubUiSurface({ kind: 'inventory' })
    }
  }, [inputBlocked, inventoryRequestSequence, pickerOpen, transitionActive])

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

  useLayoutEffect(() => {
    inputRef.current?.setControls(settings.controls)
  }, [settings.controls])

  useLayoutEffect(() => {
    rendererRef.current?.setSettings({
      cameraFovPercent: settings.cameraFovPercent,
      zoomEffects: settings.zoomEffects,
    })
  }, [settings.cameraFovPercent, settings.zoomEffects])

  useEffect(() => {
    const openSkills = (event: KeyboardEvent) => {
      if (
        inputBlocked
        || pickerOpen
        || transitionActive
        || event.code !== settings.controls.openSkills
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) return
      event.preventDefault()
      event.stopPropagation()
      setHubUiSurface(null)
      onOpenSkills()
    }
    window.addEventListener('keydown', openSkills, { capture: true })
    return () => window.removeEventListener('keydown', openSkills, { capture: true })
  }, [inputBlocked, onOpenSkills, pickerOpen, settings.controls.openSkills, transitionActive])

  useEffect(() => {
    const openPause = (event: KeyboardEvent) => {
      if (
        inputBlocked
        || modalOpen
        || transitionActive
        || event.code !== settings.controls.openMenu
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
  }, [inputBlocked, modalOpen, onPauseRequest, settings.controls.openMenu, transitionActive])

  useLayoutEffect(() => {
    rendererRef.current?.setLevelUpPresentation(levelUpPresentationId)
  }, [levelUpPresentationId])

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
      setSelectedPlayerId((selected) => {
        if (!selected) return null
        const selectedParticipant = snapshot.world.participants[selected]
        return snapshot.players[selected] && selectedParticipant?.region === participant?.region
          ? selected
          : null
      })
    })
  }, [audio, hubInitialSnapshot, playerId, subscribe])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let stopPresentationLoop: (() => void) | null = null
    let previousTeacherSeconds = hubInitialSnapshot.tick / 100
    const input = createBrowserGameplayInput({
      controls: settingsRef.current.controls,
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
          cameraZoomForFov(
            HUB_CAMERA_SCALE,
            settingsRef.current.cameraFovPercent,
          ),
        )
      },
      projectPointer: (pointer) => {
        const snapshot = samplePresentation()
        const player = snapshot.players[playerId]
        const participant = snapshot.world.participants[playerId]
        if (!player || !participant) return null
        const cameraScale = cameraZoomForFov(
          HUB_CAMERA_SCALE,
          settingsRef.current.cameraFovPercent,
        )
        return projectNativeWorldPointer(
          pointer,
          host.getBoundingClientRect(),
          viewportRef.current,
          hubRegionCameraOrigin(
            participant.region,
            player.position,
            viewportRef.current,
            cameraScale,
          ),
          cameraScale,
        )
      },
      projectSecondaryAim: () => {
        const snapshot = samplePresentation()
        const player = snapshot.players[playerId]
        if (!player) return null
        return projectNativeStickAim(
          actorHeadingVector(player.headingIndex),
          player.position,
          viewportRef.current,
          cameraZoomForFov(
            HUB_CAMERA_SCALE,
            settingsRef.current.cameraFovPercent,
          ),
        )
      },
      secondaryAtPointer: () => settingsRef.current.castSecondariesAtMouse,
    })
    input.setBlocked(true)
    inputRef.current = input
    setRendererState('loading')
    setRendererError(null)

    void createHubWorldRenderer({
      initialSnapshot: hubInitialSnapshot,
      playerId,
      settings: settingsRef.current,
      viewport: viewportRef.current,
    }).then((renderer) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      renderer.setLevelUpPresentation(levelUpPresentationIdRef.current)
      host.replaceChildren(renderer.canvas)
      renderer.resize(viewportRef.current)
      setRendererState('ready')
      onReadyRef.current()
      input.setBlocked(inputBlockedRef.current || modalOpenRef.current)
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
  const configuredCameraScale = cameraZoomForFov(
    HUB_CAMERA_SCALE,
    settings.cameraFovPercent,
  )
  const uiScale = gameUiScale(settings)
  const activatePointerTarget = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || inputBlocked || modalOpen || transitionActive) {
      return
    }
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
        configuredCameraScale,
      ),
      configuredCameraScale,
    )
    if (!point) return
    const selectedPlayer = selectHubPlayerAtPoint(snapshot, playerId, point)
    if (selectedPlayer) {
      event.preventDefault()
      event.stopPropagation()
      setSelectedPlayerId(selectedPlayer)
      return
    }
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
      data-camera-zoom={configuredCameraScale}
      data-discipline={localPlayer?.config.discipline ?? 'arcane'}
      data-element={element}
      data-gameplay-input-blocked={inputBlocked || modalOpen || rendererState !== 'ready'}
      data-presentation-paused={presentationPaused}
      data-hub-region={currentRegion}
      data-hub-ui-surface={hubUiSurface?.kind ?? 'none'}
      data-modal-open={modalOpen}
      data-is-host={isHost}
      data-viewport-height={viewport.height}
      data-viewport-scale={viewport.displayScale}
      data-viewport-width={viewport.width}
      data-ui-scale={uiScale}
      data-renderer-state={rendererError ? 'error' : rendererState}
      aria-label={`${HUB_REGION_ACCESSIBILITY[currentRegion]} Configured movement keys are ${settings.controls.moveUp}, ${settings.controls.moveLeft}, ${settings.controls.moveDown}, and ${settings.controls.moveRight}.`}
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
          onPointerDownCapture={activatePointerTarget}
        />

        <GameHud
          accountUsername={accountUsername}
          controls={settings.controls}
          getPingMs={getPingMs}
          initialSnapshot={hubInitialSnapshot}
          mapLabel="Enter the Boneyard"
          onInventoryClick={() => {
            if (!inputBlocked && !pickerOpen && !transitionActive) {
              setHubUiSurface({ kind: 'inventory' })
            }
          }}
          onMapClick={beginMatch}
          onPotionClick={(itemId) => {
            if (!inputBlocked && !pickerOpen && !transitionActive) {
              onHubAction({ type: 'consume', itemId })
            }
          }}
          onQuickbarInput={(slot, pressed) => {
            const input = inputRef.current
            if (!input) return
            if (!pressed) {
              input.setTouchQuickbar(slot, false)
              return
            }
            const player = samplePresentation().players[playerId]
            input.setTouchQuickbar(
              slot,
              true,
              player ? actorHeadingVector(player.headingIndex) : undefined,
            )
          }}
          partyMemberIds={partyState?.party.memberPlayerIds}
          onSkillsClick={() => {
            if (!inputBlocked && !pickerOpen && !transitionActive) {
              setHubUiSurface(null)
              onOpenSkills()
            }
          }}
          playerId={playerId}
          progression={progression}
          subscribePing={subscribePing}
          subscribeSnapshot={subscribe}
          uiScale={uiScale}
          viewport={viewport}
        />

        <HubInventoryUi
          audio={audio}
          config={hubInitialSnapshot.players[playerId]!.config}
          disabled={inputBlocked || pickerOpen}
          economy={economy}
          inventoryKeyCode={settings.controls.openInventory}
          menuKeyCode={settings.controls.openMenu}
          modAssets={modAssets}
          onAction={onHubAction}
          onSurfaceChange={setHubUiSurface}
          playerPosition={playerPosition}
          progression={progression}
          region={currentRegion}
          surface={hubUiSurface}
          transitionActive={transitionActive}
        />

        {partyState && (
          <section className="hub-party-panel" aria-label="Party" data-party-id={partyState.party.id}>
            <h2>Party</h2>
            <div className="hub-party-members" role="list">
              {partyState.party.memberPlayerIds.map((memberPlayerId) => {
                const profile = partyState.hubPlayers.find(({ playerId: id }) => (
                  id === memberPlayerId
                ))
                return (
                  <div key={memberPlayerId} role="listitem" data-party-member={memberPlayerId}>
                    {profile?.displayName ?? memberPlayerId}
                    {memberPlayerId === partyState.party.leaderPlayerId ? ' · Host' : ''}
                  </div>
                )
              })}
            </div>
            {partyState.invitations.map((invitation) => (
              <div
                className="hub-party-invitation"
                data-party-invitation={invitation.id}
                key={invitation.id}
              >
                <span>{invitation.inviter.displayName} invited you</span>
                <div className="hub-party-invitation-actions">
                  <button
                    type="button"
                    onClick={() => onAcceptPartyInvitation(invitation.id)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="hub-party-invitation-deny"
                    onClick={() => onDenyPartyInvitation(invitation.id)}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {selectedPlayerId && (() => {
          const profile = partyState?.hubPlayers.find(({ playerId: id }) => (
            id === selectedPlayerId
          ))
          const displayName = profile?.displayName
            ?? samplePresentation().players[selectedPlayerId]?.config.displayName
            ?? selectedPlayerId
          const alreadyTogether = partyState?.party.memberPlayerIds.includes(selectedPlayerId)
            ?? false
          return (
            <div className="hub-player-profile-backdrop" role="presentation">
              <section
                className="hub-player-profile"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hub-player-profile-name"
                data-profile-player={selectedPlayerId}
              >
                <h2 id="hub-player-profile-name">{displayName}</h2>
                {partyState && !alreadyTogether && (
                  <button
                    type="button"
                    className="hub-player-profile-invite"
                    onClick={() => onInvitePlayer(selectedPlayerId)}
                  >
                    Invite to Party
                  </button>
                )}
                <button
                  type="button"
                  className="hub-player-profile-close"
                  onClick={() => setSelectedPlayerId(null)}
                >
                  Close
                </button>
              </section>
            </div>
          )
        })()}

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
          uiScale={uiScale}
        />
        <TouchJoystick
          lane="primary"
          onInput={(direction) => inputRef.current?.setTouchPrimary(direction)}
          uiScale={uiScale}
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
