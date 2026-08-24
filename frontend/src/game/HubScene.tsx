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
import { HALL_OF_FAME_CLASS_NAMES } from './core-kernels/hall-of-fame.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import { art, skillIcons } from '../lib/assets.ts'
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
import type { NativeHudSkillBinding } from './native-hud-presentation.ts'
import HubInventoryUi, { type HubUiSurface } from './HubInventoryUi.tsx'
import {
  HUB_HUD_SHORTCUTS,
  hubInteractionAtPoint,
  hubInteractionWithinRange,
  hubPotionBeltShortcut,
  nearestHubInteraction,
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
import type {
  BoneyardChoice,
  GameModAsset,
  GameSessionKind,
  GameSnapshot,
} from './protocol/game-protocol.ts'
import type { LocalPartyState, PartyVisibility } from './protocol/party-state.ts'
import PartySettingsDialog from './PartySettingsDialog.tsx'
import PartySettingsGearIcon from './PartySettingsGearIcon.tsx'
import { useCoarsePointer } from './input/use-coarse-pointer.ts'
import type {
  ProtocolPlayerEconomy,
  ProtocolPlayerProgression,
} from './protocol/game-state.ts'
import { PlayerFootstepAudioSynchronizer } from './player-footstep-audio.ts'
import type { GameWorldSpeech } from './world-speech-presentation.ts'
import {
  createHubWorldRenderer,
  type HubWorldRenderer,
} from './renderer/hub-world-renderer.ts'
import {
  gameViewportLayout,
  type GameViewportLayout,
} from './renderer/game-viewport.ts'
import {
  PLAYER_CHARACTER_SHEETS,
  playerCharacterAtlasCssFrame,
} from './renderer/player-character-atlas.ts'
import { nearestHubPlayer, selectHubPlayerAtPoint } from './hub-player-selection.ts'
import {
  hubPlayerActivities,
  hubPlayerActivityLabel,
  sameHubPlayerActivities,
} from './hub-player-activity.ts'
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
  nativeUiStageStyle: CSSProperties
  onInput: (input: PlayerCharacterInput) => void
  onAcceptPartyInvitation: (invitationId: string) => void
  onAcceptPartyJoinRequest: (requestId: string) => void
  onDenyPartyInvitation: (invitationId: string) => void
  onDenyPartyJoinRequest: (requestId: string) => void
  onHubAction: (action: HubInventoryAction) => void
  onInventoryOpenChange: (open: boolean) => void
  onInvitePlayer: (playerId: string) => void
  onKickPartyPlayer: (playerId: string) => void
  onLeaveParty: () => void
  onLoadingError: () => void
  onMessagePlayer: (playerId: string, displayName: string) => void
  onOccupiedChange: (occupied: boolean) => void
  onOpenSkillSelector: (binding: NativeHudSkillBinding) => void
  onOpenSkills: () => void
  onPauseRequest: () => void
  onReady: () => void
  onStartMatch: (boneyardId: string) => void
  onPartyRotateCode: () => void
  onPartyVisibility: (visibility: PartyVisibility) => void
  partyActionError: string | null
  partyState: LocalPartyState | null
  playerId: string
  progression: ProtocolPlayerProgression
  samplePresentation: (nowMs?: number) => HubPresentationFrame
  settings: GameSettings
  sessionKind: GameSessionKind
  subscribePing: (listener: (pingMs: number) => void) => () => void
  subscribe: (listener: (snapshot: GameSnapshot) => void) => () => void
  worldSpeeches: readonly GameWorldSpeech[]
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
  nativeUiStageStyle,
  onInput,
  onAcceptPartyInvitation,
  onAcceptPartyJoinRequest,
  onDenyPartyInvitation,
  onDenyPartyJoinRequest,
  onHubAction,
  onInventoryOpenChange,
  onInvitePlayer,
  onKickPartyPlayer,
  onLeaveParty,
  onLoadingError,
  onMessagePlayer,
  onOccupiedChange,
  onOpenSkillSelector,
  onOpenSkills,
  onPauseRequest,
  onReady,
  onStartMatch,
  onPartyRotateCode,
  onPartyVisibility,
  partyActionError,
  partyState,
  playerId,
  progression,
  samplePresentation,
  settings,
  sessionKind,
  subscribePing,
  subscribe,
  worldSpeeches,
}: HubSceneProps) {
  const [hubInitialSnapshot] = useState<HubGameSnapshot>(() => {
    if (!isHubGameSnapshot(initialSnapshot)) {
      throw new Error('Hub scene requires a Hub snapshot')
    }
    return initialSnapshot
  })
  const sceneRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const worldSpeechesRef = useRef(worldSpeeches)
  worldSpeechesRef.current = worldSpeeches
  const rendererRef = useRef<HubWorldRenderer | null>(null)
  const inputRef = useRef<BrowserGameplayInput | null>(null)
  const inputBlockedRef = useRef(inputBlocked)
  const settingsRef = useRef(settings)
  const modalOpenRef = useRef(false)
  const levelUpPresentationIdRef = useRef(levelUpPresentationId)
  const onLoadingErrorRef = useRef(onLoadingError)
  const onReadyRef = useRef(onReady)
  const controllerActionsRef = useRef({ boneyards, onOpenSkills, onPauseRequest, onStartMatch })
  inputBlockedRef.current = inputBlocked
  settingsRef.current = settings
  levelUpPresentationIdRef.current = levelUpPresentationId
  onLoadingErrorRef.current = onLoadingError
  onReadyRef.current = onReady
  controllerActionsRef.current = { boneyards, onOpenSkills, onPauseRequest, onStartMatch }
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
  const [controllerQuickbarSlot, setControllerQuickbarSlot] = useState<number | undefined>()
  const [hubUiSurface, setHubUiSurface] = useState<HubUiSurface>(null)
  const [npcNoteboxOpen, setNpcNoteboxOpen] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [selectedGold, setSelectedGold] = useState<number | null>(null)
  const [partySettingsOpen, setPartySettingsOpen] = useState(false)
  const [partyExpanded, setPartyExpanded] = useState(false)
  const [playerActivities, setPlayerActivities] = useState(() => (
    hubPlayerActivities(hubInitialSnapshot.world.participants)
  ))
  const coarsePointer = useCoarsePointer()
  // Touch: every state that extends the party column below the chip (member card,
  // action error, invitation toast) makes the ally roster under the chip yield.
  const partyColumnOpen = partyExpanded
    || Boolean(partyActionError)
    || (partyState?.invitations.length ?? 0) > 0
  const selectedPlayerIdRef = useRef<string | null>(null)
  selectedPlayerIdRef.current = selectedPlayerId
  const inventoryRequestRef = useRef(inventoryRequestSequence)
  const [economy, setEconomy] = useState<ProtocolPlayerEconomy>(() => (
    hubInitialSnapshot.players[playerId]!.economy
  ))
  const economyRef = useRef(economy)
  economyRef.current = economy
  const [playerPosition, setPlayerPosition] = useState(() => ({
    ...hubInitialSnapshot.players[playerId]!.position,
  }))
  const [skorchaInteraction, setSkorchaInteraction] = useState(() => (
    hubInitialSnapshot.world.skorcha === null
      ? null
      : {
          dismissalIndex: hubInitialSnapshot.world.skorcha.dismissalIndex,
          position: { ...hubInitialSnapshot.world.skorcha.position },
        }
  ))
  const [transitionActive, setTransitionActive] = useState(() => (
    hubInitialSnapshot.world.participants[playerId]?.transition !== null
  ))
  const modalOpen = pickerOpen || hubUiSurface !== null || npcNoteboxOpen || selectedPlayerId !== null
    || partySettingsOpen
  modalOpenRef.current = modalOpen

  useEffect(() => {
    onOccupiedChange(modalOpen)
  }, [modalOpen, onOccupiedChange])

  useEffect(() => () => onOccupiedChange(false), [onOccupiedChange])

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
      const nextActivities = hubPlayerActivities(snapshot.world.participants)
      setPlayerActivities((current) => (
        sameHubPlayerActivities(current, nextActivities) ? current : nextActivities
      ))
      const participant = snapshot.world.participants[playerId]
      setSkorchaInteraction((current) => {
        const next = snapshot.world.skorcha
        if (next === null) return current === null ? current : null
        if (
          current !== null
          && current.dismissalIndex === next.dismissalIndex
          && current.position.x === next.position.x
          && current.position.y === next.position.y
        ) return current
        return {
          dismissalIndex: next.dismissalIndex,
          position: { ...next.position },
        }
      })
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
      const selected = selectedPlayerIdRef.current
      if (selected) {
        const gold = snapshot.players[selected]?.economy.gold ?? null
        setSelectedGold((current) => current === gold ? current : gold)
      }
    })
  }, [audio, hubInitialSnapshot, playerId, subscribe])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let stopPresentationLoop: (() => void) | null = null
    let previousTeacherSeconds = hubInitialSnapshot.tick / 100
    const input = createBrowserGameplayInput({
      claimQuickbarPress: (slot) => {
        const potion = hubPotionBeltShortcut(economyRef.current.backpack, slot)
        if (potion === null) return false
        if (potion.itemId !== null) onHubAction({ type: 'consume', itemId: potion.itemId })
        return true
      },
      controls: settingsRef.current.controls,
      mouseTarget: host,
      onGamepadAction: (action) => {
        const callbacks = controllerActionsRef.current
        const snapshot = samplePresentation()
        const participant = snapshot.world.participants[playerId]
        const player = snapshot.players[playerId]
        if (!participant || !player || participant.transition) return
        if (action === 'inventory') {
          setHubUiSurface({ kind: 'inventory' })
          return
        }
        if (action === 'skills') {
          setHubUiSurface(null)
          callbacks.onOpenSkills()
          return
        }
        if (action === 'pause') {
          callbacks.onPauseRequest()
          return
        }
        const nearbyPlayer = nearestHubPlayer(snapshot, playerId)
        if (nearbyPlayer) {
          setSelectedGold(snapshot.players[nearbyPlayer]?.economy.gold ?? null)
          setSelectedPlayerId(nearbyPlayer)
          return
        }
        const interaction = nearestHubInteraction(
          participant.region,
          player.position,
          { skorchaPosition: snapshot.world.skorcha?.position ?? null },
        )
        if (interaction) {
          setHubUiSurface({ interaction, kind: 'dialogue', source: 'world' })
          return
        }
        if (snapshot.hostPlayerId !== playerId || participant.region !== 'courtyard') return
        if (callbacks.boneyards.length === 1) {
          callbacks.onStartMatch(callbacks.boneyards[0]!.id)
        } else {
          setPickerOpen(true)
        }
      },
      onGamepadPresenceChange: (present) => {
        if (!present) setControllerQuickbarSlot(undefined)
      },
      onGamepadQuickbarSelection: setControllerQuickbarSlot,
      onInput,
      primaryCastingEnabled: false,
      viewportWidth: () => viewportRef.current.width,
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
      renderer.setWorldSpeeches(worldSpeechesRef.current)
      host.replaceChildren(renderer.canvas)
      renderer.resize(viewportRef.current)
      setRendererState('ready')
      onReadyRef.current()
      input.setBlocked(inputBlockedRef.current || modalOpenRef.current)
      stopPresentationLoop = startGamePresentationLoop((now) => {
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
        renderer.setWorldSpeeches(worldSpeechesRef.current)
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
  }, [audio, hubInitialSnapshot, onHubAction, onInput, playerId, samplePresentation])

  const isHost = hostPlayerId === playerId
  const beginMatch = () => {
    if (!isHost || currentRegion !== 'courtyard') return
    if (boneyards.length === 1) {
      onStartMatch(boneyards[0].id)
      return
    }
    setPickerOpen(true)
  }
  const openMemberCard = (memberPlayerId: string) => {
    const snapshot = samplePresentation()
    const member = snapshot.players[memberPlayerId]
    const memberRegion = snapshot.world.participants[memberPlayerId]?.region
    if (!member || memberRegion !== snapshot.world.participants[playerId]?.region) return
    setSelectedGold(member.economy.gold)
    setSelectedPlayerId(memberPlayerId)
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
      setSelectedGold(snapshot.players[selectedPlayer]?.economy.gold ?? null)
      setSelectedPlayerId(selectedPlayer)
      return
    }
    const interaction = hubInteractionAtPoint(
      participant.region,
      point,
      { skorchaPosition: snapshot.world.skorcha?.position ?? null },
    )
    if (!interaction || !hubInteractionWithinRange(
      interaction,
      participant.region,
      player.position,
      { skorchaPosition: snapshot.world.skorcha?.position ?? null },
    )) return
    event.preventDefault()
    event.stopPropagation()
    setHubUiSurface({ interaction, kind: 'dialogue', source: 'world' })
  }

  return (
    <div
      ref={sceneRef}
      className="hub-scene"
      data-camera-zoom={configuredCameraScale}
      data-discipline={localPlayer?.config.discipline ?? 'arcane'}
      data-element={element}
      data-gameplay-input-blocked={inputBlocked || modalOpen || rendererState !== 'ready'}
      data-presentation-paused={false}
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
          '--hud-display-scale': viewport.displayScale,
          height: viewport.height,
          transform: `scale(${viewport.displayScale})`,
          width: viewport.width,
        } as CSSProperties}
      >
        <div
          ref={hostRef}
          className="hub-world-renderer"
          onPointerDownCapture={activatePointerTarget}
        />

        <GameHud
          accountUsername={accountUsername}
          allyRosterHidden={coarsePointer && partyColumnOpen}
          controls={settings.controls}
          controllerQuickbarSlot={controllerQuickbarSlot}
          getPingMs={getPingMs}
          initialSnapshot={hubInitialSnapshot}
          mapLabel="Enter the Boneyard"
          onInventoryClick={() => {
            if (!inputBlocked && !pickerOpen && !transitionActive) {
              setHubUiSurface({ kind: 'inventory' })
            }
          }}
          onHubShortcutClick={(interaction) => {
            if (inputBlocked || pickerOpen || transitionActive) return
            const shortcut = HUB_HUD_SHORTCUTS.find((entry) => entry.interaction === interaction)
            if (!shortcut) return
            audio.playSound('click')
            if (shortcut.mode === 'service' && interaction !== 'annalist') {
              setHubUiSurface({ kind: 'service', source: 'shortcut', trader: interaction })
            } else {
              setHubUiSurface({ interaction, kind: 'dialogue', source: 'shortcut' })
            }
          }}
          onMapClick={beginMatch}
          onMenuClick={() => {
            if (inputBlocked || modalOpen || transitionActive) return
            onPauseRequest()
          }}
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
          onSkillBindingClick={(binding) => {
            if (!inputBlocked && !pickerOpen && !transitionActive) {
              setHubUiSurface(null)
              onOpenSkillSelector(binding)
            }
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
          nativeUiStageStyle={nativeUiStageStyle}
          onAction={onHubAction}
          onBlockingOverlayChange={setNpcNoteboxOpen}
          onSurfaceChange={setHubUiSurface}
          overlayRoot={sceneRef}
          playerPosition={playerPosition}
          progression={progression}
          region={currentRegion}
          skorchaDismissalIndex={skorchaInteraction?.dismissalIndex ?? 0}
          skorchaPosition={skorchaInteraction?.position ?? null}
          surface={hubUiSurface}
          transitionActive={transitionActive}
        />

        {partyState && (
          <section
            className="hub-party-panel"
            aria-label="Party"
            data-party-id={partyState.party.id}
            data-party-expanded={!coarsePointer || partyExpanded}
          >
            <h2>
              {coarsePointer ? (
                <button
                  type="button"
                  className="hub-party-toggle"
                  aria-expanded={partyExpanded}
                  aria-controls="hub-party-members"
                  onClick={() => setPartyExpanded((open) => !open)}
                >
                  <img src={art.skullGold} alt="" aria-hidden />
                  Party
                  <span className="hub-party-count">{partyState.party.memberPlayerIds.length}</span>
                  <span className="hub-party-toggle-chevron" aria-hidden />
                </button>
              ) : (
                <>
                  <img src={art.skullGold} alt="" aria-hidden />
                  Party
                  <span className="hub-party-count">{partyState.party.memberPlayerIds.length}</span>
                </>
              )}
              {partyState.party.leaderPlayerId === playerId
                || partyState.party.memberPlayerIds.length > 1
                || sessionKind === 'private-college' ? (
                <button
                  className="hub-party-settings-open"
                  type="button"
                  aria-label="Party settings"
                  onClick={() => setPartySettingsOpen(true)}
                ><PartySettingsGearIcon /></button>
              ) : null}
            </h2>
            {partyActionError ? (
              <p className="hub-party-error" role="alert">{partyActionError}</p>
            ) : null}
            <div
              className="hub-party-members"
              id="hub-party-members"
              role="list"
              hidden={coarsePointer && !partyExpanded}
            >
              {partyState.party.memberPlayerIds.map((memberPlayerId) => {
                const profile = partyState.hubPlayers.find(({ playerId: id }) => (
                  id === memberPlayerId
                ))
                const isLeader = memberPlayerId === partyState.party.leaderPlayerId
                return (
                  <div
                    key={memberPlayerId}
                    role="listitem"
                    className="hub-party-member"
                    data-party-member={memberPlayerId}
                    data-party-leader={isLeader}
                  >
                    <button
                      type="button"
                      className="hub-party-member-open"
                      onClick={() => openMemberCard(memberPlayerId)}
                    >
                      <img
                        className="hub-party-member-marker"
                        src={isLeader ? art.skullGold : art.skullWhite}
                        alt=""
                        aria-hidden
                      />
                      <span className="hub-party-member-name">
                        {profile?.displayName ?? memberPlayerId}
                      </span>
                      {memberPlayerId === playerId && (
                        <span className="hub-party-member-tag hub-party-member-you">You</span>
                      )}
                      {isLeader && (
                        <span className="hub-party-member-tag hub-party-member-host">Leader</span>
                      )}
                    </button>
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
                <span className="hub-party-invitation-text">
                  <strong>{invitation.inviter.displayName}</strong> invited you
                </span>
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

        {partySettingsOpen && partyState ? (
          <PartySettingsDialog
            error={partyActionError}
            onAcceptRequest={onAcceptPartyJoinRequest}
            onClose={() => setPartySettingsOpen(false)}
            onDenyRequest={onDenyPartyJoinRequest}
            onKick={onKickPartyPlayer}
            onLeave={onLeaveParty}
            onRotateCode={onPartyRotateCode}
            onVisibility={onPartyVisibility}
            playerId={playerId}
            sessionKind={sessionKind}
            state={partyState}
          />
        ) : null}

        {selectedPlayerId && (() => {
          const profile = partyState?.hubPlayers.find(({ playerId: id }) => (
            id === selectedPlayerId
          ))
          const presented = samplePresentation().players[selectedPlayerId]
          const displayName = profile?.displayName
            ?? presented?.config.displayName
            ?? selectedPlayerId
          const alreadyTogether = partyState?.party.memberPlayerIds.includes(selectedPlayerId)
            ?? false
          const isSelf = selectedPlayerId === playerId
          const cardElement = presented?.config.element ?? 'ether'
          const activity = playerActivities[selectedPlayerId] ?? null
          const cardClassName =
            HALL_OF_FAME_CLASS_NAMES[cardElement][presented?.config.discipline ?? 'arcane']
          return (
            <div
              className="hub-player-profile-backdrop"
              role="presentation"
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) setSelectedPlayerId(null)
              }}
            >
              <section
                className="hub-player-profile"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hub-player-profile-name"
                data-profile-player={selectedPlayerId}
                data-profile-element={cardElement}
              >
                <img className="hub-player-profile-corner" src={art.cornerGold} alt="" aria-hidden />
                <img
                  className="hub-player-profile-corner hub-player-profile-corner-right"
                  src={art.cornerGold}
                  alt=""
                  aria-hidden
                />
                <header className="hub-player-profile-header">
                  <WizardPortrait element={cardElement} />
                  <div className="hub-player-profile-title">
                    <h2 id="hub-player-profile-name">{displayName}</h2>
                    <p className="hub-player-profile-class">{cardClassName}</p>
                    {profile && (
                      <p
                        className="hub-player-profile-badge"
                        data-registered={profile.accountUsername !== null}
                      >
                        {profile.accountUsername !== null
                          ? `Registered · ${profile.accountUsername}`
                          : 'Guest wizard'}
                      </p>
                    )}
                    {activity ? (
                      <p
                        className="hub-player-profile-activity"
                        data-profile-activity={activity}
                      >
                        {hubPlayerActivityLabel(activity)}
                      </p>
                    ) : null}
                  </div>
                </header>
                <dl className="hub-player-profile-stats">
                  <div className="hub-player-profile-stat">
                    <img src={skillIcons.bag} alt="" aria-hidden />
                    <dt>Gold</dt>
                    <dd data-profile-gold={selectedGold ?? undefined}>
                      {selectedGold === null ? '—' : selectedGold.toLocaleString()}
                    </dd>
                  </div>
                  <div className="hub-player-profile-stat">
                    <img src={skillIcons.wave} alt="" aria-hidden />
                    <dt>Highest Wave</dt>
                    <dd>
                      {profile?.highestWave == null ? '—' : profile.highestWave.toLocaleString()}
                    </dd>
                  </div>
                  <div className="hub-player-profile-stat">
                    <img src={skillIcons.infinity} alt="" aria-hidden />
                    <dt>Time in the Dark</dt>
                    <dd>
                      {profile?.totalPlaytimeMs == null ? '—' : formatPlaytime(profile.totalPlaytimeMs)}
                    </dd>
                  </div>
                </dl>
                <div className="hub-player-profile-actions">
                  {!isSelf && (
                    <button
                      type="button"
                      className="hub-player-profile-message"
                      onClick={() => {
                        onMessagePlayer(selectedPlayerId, displayName)
                        setSelectedPlayerId(null)
                      }}
                    >
                      Message
                    </button>
                  )}
                  {partyState
                    && partyState.party.leaderPlayerId === playerId
                    && !alreadyTogether && (
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
                    data-game-back="true"
                    onClick={() => setSelectedPlayerId(null)}
                  >
                    Close
                  </button>
                </div>
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
                data-game-back="true"
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

const WIZARD_PORTRAIT_HEADING_INDEX = 12

function WizardPortrait({ element }: { element: WizardElement }) {
  const layers = [
    PLAYER_CHARACTER_SHEETS.staffBack,
    PLAYER_CHARACTER_SHEETS.robeDynamic[element],
    PLAYER_CHARACTER_SHEETS.robeFixed[element],
    PLAYER_CHARACTER_SHEETS.staffFront,
    PLAYER_CHARACTER_SHEETS.head[element],
  ] as const
  return (
    <span className="hub-wizard-portrait" data-portrait-element={element} aria-hidden>
      {layers.map((sheet, index) => (
        <span
          key={`${sheet}:${index}`}
          className="hub-wizard-portrait-layer"
        >
          <span style={playerCharacterAtlasCssFrame(
            sheet,
            0,
            WIZARD_PORTRAIT_HEADING_INDEX,
          )} />
        </span>
      ))}
      <img className="hub-wizard-portrait-frame" src={art.frameGold} alt="" />
    </span>
  )
}

function formatPlaytime(totalPlaytimeMs: number): string {
  const totalMinutes = Math.floor(totalPlaytimeMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}
