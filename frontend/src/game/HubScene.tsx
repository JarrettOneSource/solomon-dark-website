import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type {
  HubGameSnapshot,
  HubPresentationFrame,
} from './client/hub-presentation-timeline.ts'
import { isHubGameSnapshot } from './client/hub-presentation-timeline.ts'
import {
  HUB_REGION_DEFINITIONS,
  type HubRegionId,
} from './core-kernels/hub-regions.ts'
import type { NativeCollegeIntroState } from './core-kernels/native-college-intro.ts'
import { actorHeadingVector } from './core-kernels/actor-heading.ts'
import {
  HUB_CAMERA_SCALE,
  hubRegionCameraOrigin,
} from './core-kernels/hub-math.ts'
import type { PlayerCharacterInput } from './core-kernels/player-character.ts'
import type { HubInventoryAction } from './core-kernels/hub-economy.ts'
import {
  nativePlayerBeltsEqual,
  type PlayerBeltComponent,
} from './core-kernels/native-belt.ts'
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
import CollegeIntroOverlay from './CollegeIntroOverlay.tsx'
import type { GameMenuAvailability } from './GameMenuSkull.tsx'
import type { NativeHudSkillBinding } from './native-hud-presentation.ts'
import HubInventoryUi from './HubInventoryUi.tsx'
import type { HubUiSurface } from './hub-inventory-ui-model.ts'
import {
  HUB_HUD_SHORTCUTS,
  hubInteractionAtPoint,
  hubInteractionWithinRange,
  hubNpcHintAcknowledgementAction,
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
  ModContentProjection,
} from './protocol/game-protocol.ts'
import type { LocalPartyState, PartyVisibility } from './protocol/party-state.ts'
import type { NativeUiPartyMenuTabId } from './native-ui/core.ts'
import { NativeUiPartyChip, NativeUiPartyInvitation, NativeUiPartyMenu } from './native-ui/react.ts'
import { partyMenuModel, partyMenuVisibility } from './party-menu-presentation.ts'
import './party-menu.css'
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
  boundedGameViewportLayout,
  gameViewportLayout,
  type BoundedGameViewportLayout,
} from './renderer/game-viewport.ts'
import { hubPolisherWipeGain } from './renderer/hub-private-room-presentation.ts'
import { nearestHubPlayer, selectHubPlayerAtPoint } from './hub-player-selection.ts'
import {
  hubPlayerActivities,
  hubPlayerActivityLabel,
  sameHubPlayerActivities,
} from './hub-player-activity.ts'
import './hub.css'
import PlayerCardDialog from './PlayerCardDialog.tsx'

interface HubSceneProps {
  accountUsername: string | null
  audio: GameAudioDirector
  belt: PlayerBeltComponent
  boneyards: readonly BoneyardChoice[]
  chatInputActive: boolean
  gameplayHudHidden: boolean
  getPingMs: () => number | null
  initialSnapshot: GameSnapshot
  inputBlocked: boolean
  inventoryRequestSequence: number
  optionalBookOverlap: boolean
  modalDisabled: boolean
  modAssets: readonly GameModAsset[]
  modContent: ModContentProjection | null
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
  /** Reports whether OPEN MENU would be honoured right now; the stage skull follows it. */
  onMenuAvailabilityChange?: (availability: GameMenuAvailability) => void
  onMessagePlayer: (playerId: string, displayName: string) => void
  onOccupiedChange: (occupied: boolean) => void
  onOpenSkillSelector: (binding: NativeHudSkillBinding) => void
  onOpenSkills: () => void
  onUnassignQuickbarSkill?: (slot: number) => void
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
const EMPTY_WORLD_SPEECHES: readonly GameWorldSpeech[] = Object.freeze([])
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
  belt,
  boneyards,
  chatInputActive,
  gameplayHudHidden,
  getPingMs,
  initialSnapshot,
  inputBlocked,
  inventoryRequestSequence,
  optionalBookOverlap,
  modalDisabled,
  modAssets,
  modContent,
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
  onMenuAvailabilityChange,
  onMessagePlayer,
  onOccupiedChange,
  onOpenSkillSelector,
  onOpenSkills,
  onUnassignQuickbarSkill,
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
  const gameplayHudHiddenRef = useRef(gameplayHudHidden)
  const settingsRef = useRef(settings)
  const modalOpenRef = useRef(false)
  const levelUpPresentationIdRef = useRef(levelUpPresentationId)
  const onLoadingErrorRef = useRef(onLoadingError)
  const onReadyRef = useRef(onReady)
  const controllerActionsRef = useRef({ boneyards, onOpenSkills, onPauseRequest, onStartMatch })
  inputBlockedRef.current = inputBlocked
  gameplayHudHiddenRef.current = gameplayHudHidden
  settingsRef.current = settings
  levelUpPresentationIdRef.current = levelUpPresentationId
  onLoadingErrorRef.current = onLoadingError
  onReadyRef.current = onReady
  controllerActionsRef.current = { boneyards, onOpenSkills, onPauseRequest, onStartMatch }
  const [rendererState, setRendererState] = useState<RendererState>('loading')
  const [rendererError, setRendererError] = useState<string | null>(null)
  const [viewport, setViewport] = useState<BoundedGameViewportLayout>(() => ({
    ...gameViewportLayout(1600, 900),
    worldZoom: 1,
  }))
  const viewportRef = useRef(viewport)
  const [hostPlayerId, setHostPlayerId] = useState(initialSnapshot.hostPlayerId)
  const [currentRegion, setCurrentRegion] = useState<HubRegionId>(
    hubInitialSnapshot.world.participants[playerId]?.region ?? 'courtyard',
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [controllerQuickbarSlot, setControllerQuickbarSlot] = useState<number | undefined>()
  const [hubUiSurface, setHubUiSurface] = useState<HubUiSurface>(null)
  const hubUiSurfaceRef = useRef<HubUiSurface>(hubUiSurface)
  hubUiSurfaceRef.current = hubUiSurface
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [selectedGold, setSelectedGold] = useState<number | null>(null)
  const [partySettingsOpen, setPartySettingsOpen] = useState(false)
  const [partyMenuTab, setPartyMenuTab] = useState<NativeUiPartyMenuTabId>('members')
  const [partyCodeCopied, setPartyCodeCopied] = useState(false)
  const partyCodeCopiedTimeoutRef = useRef<number | null>(null)
  // The chip and the menu share one model: the chip shows it under the skull, the menu
  // opens on whichever tab the chip was pressed for (header: Members, gear: Settings).
  const partyChip = partyState ? partyMenuModel(partyState, playerId, sessionKind) : null
  const partyMenuOpen = partySettingsOpen && partyChip !== null
  const partyMenu = partyMenuOpen ? partyChip : null
  const openPartyMenu = (tab: NativeUiPartyMenuTabId) => {
    setPartyMenuTab(tab)
    setPartySettingsOpen(true)
  }
  useEffect(() => () => {
    if (partyCodeCopiedTimeoutRef.current !== null) window.clearTimeout(partyCodeCopiedTimeoutRef.current)
  }, [])
  const copyPartyCode = () => {
    const joinCode = partyState?.party.joinCode
    if (!joinCode) return
    if (partyCodeCopiedTimeoutRef.current !== null) {
      window.clearTimeout(partyCodeCopiedTimeoutRef.current)
      partyCodeCopiedTimeoutRef.current = null
    }
    const write = navigator.clipboard?.writeText(joinCode)
    if (!write) return
    void write.then(
      () => {
        setPartyCodeCopied(true)
        partyCodeCopiedTimeoutRef.current = window.setTimeout(() => {
          setPartyCodeCopied(false)
          partyCodeCopiedTimeoutRef.current = null
        }, 1_500)
      },
      () => setPartyCodeCopied(false),
    )
  }
  const [partyExpanded, setPartyExpanded] = useState(false)
  const [playerActivities, setPlayerActivities] = useState(() => (
    hubPlayerActivities(hubInitialSnapshot.world.participants)
  ))
  const [memorial, setMemorial] = useState(hubInitialSnapshot.world.memorial)
  const coarsePointer = useCoarsePointer()
  // Touch: whatever hangs from the chip's header (the rows tapped open, an action error
  // line) makes the ally roster under the chip yield. Invitations are a message box over
  // the scene and leave the column alone.
  const partyColumnOpen = partyExpanded || Boolean(partyActionError)
  const selectedPlayerIdRef = useRef<string | null>(null)
  selectedPlayerIdRef.current = selectedPlayerId
  const inventoryRequestRef = useRef(inventoryRequestSequence)
  const [economy, setEconomy] = useState<ProtocolPlayerEconomy>(() => (
    hubInitialSnapshot.players[playerId]!.economy
  ))
  const [liveBelt, setLiveBelt] = useState<PlayerBeltComponent>(belt)
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
    Boolean(hubInitialSnapshot.world.participants[playerId]?.transition)
      || Boolean(
        hubInitialSnapshot.world.participants[playerId]?.collegeIntro
        && hubInitialSnapshot.world.participants[playerId]?.collegeIntro?.phase
          !== 'arch-dialogue',
      )
  ))
  const [collegeIntro, setCollegeIntro] = useState<NativeCollegeIntroState | null>(() => (
    hubInitialSnapshot.world.participants[playerId]?.collegeIntro ?? null
  ))
  const storyOffice = currentRegion === 'office' && economy.collegeIntroPending
  const collegeDialogueSequenceRef = useRef(0)
  useEffect(() => {
    if (
      rendererState !== 'ready'
      || modalDisabled
      || collegeIntro?.phase !== 'arch-dialogue'
      || collegeIntro.dialogueSequence <= collegeDialogueSequenceRef.current
      || hubUiSurface !== null
    ) return
    collegeDialogueSequenceRef.current = collegeIntro.dialogueSequence
    setHubUiSurface({
      interaction: 'arch-chancellor',
      kind: 'dialogue',
      source: 'college-intro',
    })
  }, [collegeIntro, hubUiSurface, modalDisabled, rendererState])
  const polisherWipeGain = storyOffice ? hubPolisherWipeGain(playerPosition) : 0
  useEffect(() => {
    if (!storyOffice) {
      audio.stopLoop('polisher-wipe', 'story-office-polisher')
      return
    }
    audio.startLoop('polisher-wipe', 'story-office-polisher', {
      volume: polisherWipeGain,
    })
  }, [audio, polisherWipeGain, storyOffice])
  useEffect(() => () => {
    audio.stopLoop('polisher-wipe', 'story-office-polisher')
  }, [audio])
  const modalOpen = pickerOpen || hubUiSurface !== null || selectedPlayerId !== null
    || partyMenuOpen
  modalOpenRef.current = modalOpen

  useEffect(() => {
    onOccupiedChange(modalOpen)
  }, [modalOpen, onOccupiedChange])

  useEffect(() => () => onOccupiedChange(false), [onOccupiedChange])

  // The same gate as the OPEN MENU keydown below, published for the stage skull.
  const menuAvailable = !inputBlocked && !modalOpen && !transitionActive
  useEffect(() => {
    if (gameplayHudHidden) {
      onMenuAvailabilityChange?.('hidden')
      return
    }
    onMenuAvailabilityChange?.(menuAvailable ? 'available' : 'inert')
  }, [gameplayHudHidden, menuAvailable, onMenuAvailabilityChange])

  useEffect(() => () => onMenuAvailabilityChange?.('inert'), [onMenuAvailabilityChange])

  useEffect(() => {
    onInventoryOpenChange(hubUiSurface?.kind === 'inventory')
  }, [hubUiSurface?.kind, onInventoryOpenChange])

  useLayoutEffect(() => {
    if (inventoryRequestRef.current === inventoryRequestSequence) return
    inventoryRequestRef.current = inventoryRequestSequence
    if (
      !gameplayHudHidden
      && (!inputBlocked || optionalBookOverlap)
      && !pickerOpen
      && !transitionActive
    ) {
      setHubUiSurface({ kind: 'inventory' })
    }
  }, [
    gameplayHudHidden,
    inputBlocked,
    inventoryRequestSequence,
    optionalBookOverlap,
    pickerOpen,
    transitionActive,
  ])

  useLayoutEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const resize = () => {
      const next = boundedGameViewportLayout(
        scene.clientWidth,
        scene.clientHeight,
        HUB_REGION_DEFINITIONS[currentRegion],
        cameraZoomForFov(HUB_CAMERA_SCALE, settings.cameraFovPercent),
      )
      viewportRef.current = next
      setViewport((current) => sameViewport(current, next) ? current : next)
      rendererRef.current?.resize(next)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(scene)
    return () => observer.disconnect()
  }, [currentRegion, settings.cameraFovPercent])

  useLayoutEffect(() => {
    inputRef.current?.setBlocked(inputBlocked || modalOpen)
  }, [inputBlocked, modalOpen])

  useLayoutEffect(() => {
    inputRef.current?.setControls(settings.controls)
  }, [settings.controls])

  useLayoutEffect(() => {
    rendererRef.current?.setSettings({
      cameraFovPercent: settings.cameraFovPercent,
      reducedScreenFlashes: settings.reducedScreenFlashes,
      zoomEffects: settings.zoomEffects,
    })
  }, [settings.cameraFovPercent, settings.reducedScreenFlashes, settings.zoomEffects])

  useEffect(() => {
    const openSkills = (event: KeyboardEvent) => {
      if (
        gameplayHudHidden
        || inputBlocked
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
  }, [gameplayHudHidden, inputBlocked, onOpenSkills, pickerOpen, settings.controls.openSkills, transitionActive])

  useEffect(() => {
    const openPause = (event: KeyboardEvent) => {
      if (
        gameplayHudHidden
        || inputBlocked
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
  }, [gameplayHudHidden, inputBlocked, modalOpen, onPauseRequest, settings.controls.openMenu, transitionActive])

  useLayoutEffect(() => {
    rendererRef.current?.setLevelUpPresentation(levelUpPresentationId)
  }, [levelUpPresentationId])

  useLayoutEffect(() => {
    rendererRef.current?.setGameplayHudHidden(gameplayHudHidden)
  }, [gameplayHudHidden, rendererState])

  useLayoutEffect(() => {
    rendererRef.current?.setUiSurface(
      gameplayHudHidden ? 'modal' : hubUiSurface?.kind
        ?? (modalOpen || inputBlocked ? 'modal' : null),
    )
  }, [gameplayHudHidden, hubUiSurface?.kind, inputBlocked, modalOpen, rendererState])

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
      setMemorial((current) => current.nextAge === snapshot.world.memorial.nextAge
        ? current
        : snapshot.world.memorial)
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
      if (participant) {
        setTransitionActive(participant.transition !== null
          || (participant.collegeIntro !== null
            && participant.collegeIntro.phase !== 'arch-dialogue'))
        setCollegeIntro(participant.collegeIntro)
      }
      const player = snapshot.players[playerId]
      if (player) {
        setLiveBelt((current) => nativePlayerBeltsEqual(current, player.belt)
          ? current
          : player.belt)
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
    const publishInput = (nextInput: PlayerCharacterInput) => onInput(
      gameplayHudHiddenRef.current
        ? { ...nextInput, cast: { primary: false, quickbar: null } }
        : nextInput,
    )
    const input = createBrowserGameplayInput({
      claimQuickbarPress: (slot) => {
        if (gameplayHudHiddenRef.current) return true
        const entry = samplePresentation().players[playerId]?.belt[slot] ?? null
        if (entry === null || entry.kind === 'skill') return false
        onHubAction({ slot, type: 'activate-belt-slot' })
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
          if (gameplayHudHiddenRef.current) return
          setHubUiSurface({ kind: 'inventory' })
          return
        }
        if (action === 'skills') {
          if (gameplayHudHiddenRef.current) return
          setHubUiSurface(null)
          callbacks.onOpenSkills()
          return
        }
        if (action === 'pause') {
          if (gameplayHudHiddenRef.current) return
          callbacks.onPauseRequest()
          return
        }
        const nearbyPlayer = nearestHubPlayer(snapshot, playerId)
        if (!gameplayHudHiddenRef.current && nearbyPlayer) {
          setSelectedGold(snapshot.players[nearbyPlayer]?.economy.gold ?? null)
          setSelectedPlayerId(nearbyPlayer)
          return
        }
        const interaction = nearestHubInteraction(
          participant.region,
          player.position,
          {
            skorchaPosition: snapshot.world.skorcha?.position ?? null,
            storyOffice: participant.region === 'office'
              && player.economy.collegeIntroPending,
          },
        )
        if (interaction) {
          setHubUiSurface({ interaction, kind: 'dialogue', source: 'world' })
          return
        }
        if (gameplayHudHiddenRef.current) return
        if (snapshot.hostPlayerId !== playerId) return
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
      onInput: publishInput,
      primaryCastingEnabled: false,
      viewportHeight: () => viewportRef.current.height,
      viewportWidth: () => viewportRef.current.width,
      projectDirection: (direction) => {
        const snapshot = samplePresentation()
        const player = snapshot.players[playerId]
        if (!player) return null
        return projectNativeStickAim(
          direction,
          player.position,
          viewportRef.current,
          hubCameraScale(settingsRef.current.cameraFovPercent, viewportRef.current),
        )
      },
      projectPointer: (pointer) => {
        const snapshot = samplePresentation()
        const player = snapshot.players[playerId]
        const participant = snapshot.world.participants[playerId]
        if (!player || !participant) return null
        const cameraScale = hubCameraScale(
          settingsRef.current.cameraFovPercent,
          viewportRef.current,
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
          hubCameraScale(settingsRef.current.cameraFovPercent, viewportRef.current),
        )
      },
      secondaryAtPointer: () => settingsRef.current.castSecondariesAtMouse,
    })
    input.setBlocked(true)
    inputRef.current = input
    setRendererState('loading')
    setRendererError(null)

    void createHubWorldRenderer({
      gameplayHudHidden: gameplayHudHiddenRef.current,
      initialSnapshot: hubInitialSnapshot,
      modAssets,
      onDiagnostics: (diagnostics) => {
        const scene = sceneRef.current
        if (!scene) return
        scene.dataset.localPlayerScreenX = `${diagnostics.localPlayerScreenX}`
        scene.dataset.localPlayerScreenY = `${diagnostics.localPlayerScreenY}`
      },
      playerId,
      settings: settingsRef.current,
      viewport: viewportRef.current,
    }).then((renderer) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      renderer.setGameplayHudHidden(gameplayHudHiddenRef.current)
      renderer.setLevelUpPresentation(levelUpPresentationIdRef.current)
      renderer.setUiSurface(
        gameplayHudHiddenRef.current ? 'modal' : hubUiSurfaceRef.current?.kind
          ?? (modalOpenRef.current || inputBlockedRef.current ? 'modal' : null),
      )
      renderer.setWorldSpeeches(
        gameplayHudHiddenRef.current ? EMPTY_WORLD_SPEECHES : worldSpeechesRef.current,
      )
      host.replaceChildren(renderer.canvas)
      renderer.resize(viewportRef.current)
      setRendererState('ready')
      onReadyRef.current()
      input.setBlocked(inputBlockedRef.current || modalOpenRef.current)
      stopPresentationLoop = startGamePresentationLoop((now) => {
        publishInput(input.sample().input)
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
        renderer.setWorldSpeeches(
          gameplayHudHiddenRef.current ? EMPTY_WORLD_SPEECHES : worldSpeechesRef.current,
        )
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
  }, [audio, hubInitialSnapshot, modAssets, onHubAction, onInput, playerId, samplePresentation])

  const isHost = hostPlayerId === playerId
  const beginMatch = () => {
    if (gameplayHudHidden || !isHost || inputBlocked || pickerOpen || transitionActive) return
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
  const configuredCameraScale = hubCameraScale(settings.cameraFovPercent, viewport)
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
    if (!gameplayHudHidden && selectedPlayer) {
      event.preventDefault()
      event.stopPropagation()
      setSelectedGold(snapshot.players[selectedPlayer]?.economy.gold ?? null)
      setSelectedPlayerId(selectedPlayer)
      return
    }
    const interaction = hubInteractionAtPoint(
      participant.region,
      point,
      {
        skorchaPosition: snapshot.world.skorcha?.position ?? null,
        storyOffice: participant.region === 'office'
          && player.economy.collegeIntroPending,
      },
    )
    if (!interaction || !hubInteractionWithinRange(
      interaction,
      participant.region,
      player.position,
      {
        skorchaPosition: snapshot.world.skorcha?.position ?? null,
        storyOffice: participant.region === 'office'
          && player.economy.collegeIntroPending,
      },
    )) return
    event.preventDefault()
    event.stopPropagation()
    const acknowledgement = hubNpcHintAcknowledgementAction(
      interaction,
      player.economy.npc.helpFlags,
    )
    if (acknowledgement) onHubAction(acknowledgement)
    setHubUiSurface({ interaction, kind: 'dialogue', source: 'world' })
  }

  return (
    <div
      ref={sceneRef}
      className="hub-scene"
      data-camera-zoom={configuredCameraScale}
      data-college-intro={collegeIntro?.phase}
      data-discipline={localPlayer?.config.discipline ?? 'arcane'}
      data-element={element}
      data-gameplay-input-blocked={inputBlocked || modalOpen || rendererState !== 'ready'}
      data-gameplay-hud={gameplayHudHidden ? 'hidden' : 'visible'}
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
      data-story-office={storyOffice || undefined}
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

        {collegeIntro ? <CollegeIntroOverlay state={collegeIntro} /> : null}

        <GameHud
          accountUsername={accountUsername}
          audio={audio}
          allyRosterHidden={coarsePointer && partyColumnOpen}
          controls={settings.controls}
          controllerQuickbarSlot={controllerQuickbarSlot}
          getPingMs={getPingMs}
          initialSnapshot={hubInitialSnapshot}
          mapLabel="Enter the Boneyard"
          mapTransitionActive={transitionActive}
          onInventoryClick={() => {
            if (!gameplayHudHidden && !inputBlocked && !pickerOpen && !transitionActive) {
              setHubUiSurface({ kind: 'inventory' })
            }
          }}
          onHubShortcutClick={(interaction) => {
            if (gameplayHudHidden || inputBlocked || pickerOpen || transitionActive) return
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
          onQuickbarInput={(slot, pressed) => {
            const input = inputRef.current
            if (!input) return
            const entry = samplePresentation().players[playerId]?.belt[slot] ?? null
            if (pressed && entry !== null && entry.kind !== 'skill') {
              if (!gameplayHudHidden && !inputBlocked && !pickerOpen && !transitionActive) {
                onHubAction({ slot, type: 'activate-belt-slot' })
              }
              return
            }
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
          onQuickbarUnassign={onUnassignQuickbarSkill ? (slot) => {
            onUnassignQuickbarSkill(slot)
            audio.playSound('poof')
          } : undefined}
          onSkillBindingClick={(binding) => {
            if (!gameplayHudHidden && !inputBlocked && !pickerOpen && !transitionActive) {
              setHubUiSurface(null)
              onOpenSkillSelector(binding)
            }
          }}
          partyRoster={partyState?.partyRoster}
          onSkillsClick={() => {
            if (!gameplayHudHidden && !inputBlocked && !pickerOpen && !transitionActive) {
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
          belt={liveBelt}
          config={hubInitialSnapshot.players[playerId]!.config}
          disabled={(modalDisabled && !optionalBookOverlap) || pickerOpen}
          economy={economy}
          inputSuspended={chatInputActive}
          inventoryKeyCode={settings.controls.openInventory}
          forceModalHudSettled={optionalBookOverlap}
          inventoryEnabled={!gameplayHudHidden}
          menuKeyCode={settings.controls.openMenu}
          memorial={memorial}
          modAssets={modAssets}
          modContent={modContent}
          nativeUiStageStyle={nativeUiStageStyle}
          onAction={onHubAction}
          onOpenSkills={onOpenSkills}
          onSurfaceChange={setHubUiSurface}
          onUnassignBeltEntry={onUnassignQuickbarSkill}
          overlayRoot={sceneRef}
          playerPosition={playerPosition}
          progression={progression}
          skillsKeyCode={settings.controls.openSkills}
          region={currentRegion}
          skorchaDismissalIndex={skorchaInteraction?.dismissalIndex ?? 0}
          skorchaPosition={skorchaInteraction?.position ?? null}
          surface={hubUiSurface}
          storyOffice={storyOffice}
          transitionActive={transitionActive}
        />

        {partyState && partyChip ? (
          <section
            className="hub-party-panel"
            aria-label="Party"
            data-party-id={partyState.party.id}
            data-party-expanded={!coarsePointer || partyExpanded}
          >
            <NativeUiPartyChip
              collapsible={coarsePointer}
              error={partyActionError}
              expanded={!coarsePointer || partyExpanded}
              members={partyChip.members}
              onMember={openMemberCard}
              onOpen={() => openPartyMenu('members')}
              onRequest={() => openPartyMenu('members')}
              onSettings={() => openPartyMenu('settings')}
              onToggle={() => setPartyExpanded(open => !open)}
              requests={partyChip.requests}
              settings={partyState.party.leaderPlayerId === playerId
                || partyState.party.memberPlayerIds.length > 1
                || sessionKind === 'private-college'}
            />
          </section>
        ) : null}

        {partyMenu && sceneRef.current ? createPortal(
          <div
            className="hub-party-menu-overlay"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setPartySettingsOpen(false)
            }}
          >
            <div className="hub-party-menu-stage" style={nativeUiStageStyle}>
              <NativeUiPartyMenu
                code={partyMenu.code}
                copied={partyCodeCopied}
                curtainAlpha={0}
                error={partyActionError}
                initialTab={partyMenuTab}
                leader={partyMenu.leader}
                leaveLabel={partyMenu.leaveLabel}
                members={partyMenu.members}
                onAcceptRequest={onAcceptPartyJoinRequest}
                onClose={() => setPartySettingsOpen(false)}
                onCopyCode={copyPartyCode}
                onDenyRequest={onDenyPartyJoinRequest}
                onGenerateCode={onPartyRotateCode}
                onKick={onKickPartyPlayer}
                onLeave={onLeaveParty}
                onVisibility={(visibilityId) => {
                  const visibility = partyMenuVisibility(visibilityId)
                  if (visibility) onPartyVisibility(visibility)
                }}
                requests={partyMenu.requests}
                visibility={partyMenu.visibility}
                visibilityOptions={partyMenu.visibilityOptions}
              />
            </div>
          </div>,
          sceneRef.current,
        ) : null}
        {(() => {
          const invitation = partyState?.invitations[0]
          if (!invitation || !sceneRef.current) return null
          return createPortal(
            <div className="hub-party-menu-overlay" data-party-invitation={invitation.id}>
              <div className="hub-party-menu-stage" style={nativeUiStageStyle}>
                <NativeUiPartyInvitation
                  dimAlpha={0}
                  inviter={invitation.inviter.displayName}
                  onAccept={() => onAcceptPartyInvitation(invitation.id)}
                  onDeny={() => onDenyPartyInvitation(invitation.id)}
                />
              </div>
            </div>,
            sceneRef.current,
          )
        })()}

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
          return (
            <PlayerCardDialog
              canInvite={Boolean(
                partyState
                && partyState.party.leaderPlayerId === playerId
                && !alreadyTogether
              )}
              canMessage={!isSelf}
              onClose={() => setSelectedPlayerId(null)}
              onInvite={() => onInvitePlayer(selectedPlayerId)}
              onMessage={() => {
                onMessagePlayer(selectedPlayerId, displayName)
                setSelectedPlayerId(null)
              }}
              player={{
                accountUsername: profile?.accountUsername ?? null,
                activity: activity ? hubPlayerActivityLabel(activity) : null,
                activityKind: activity ?? undefined,
                discipline: presented?.config.discipline ?? 'arcane',
                displayName,
                element: cardElement,
                gold: selectedGold,
                highestWave: profile?.highestWave ?? null,
                id: selectedPlayerId,
                totalPlaytimeMs: profile?.totalPlaytimeMs ?? null,
              }}
            />
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

function sameViewport(
  left: BoundedGameViewportLayout,
  right: BoundedGameViewportLayout,
): boolean {
  return left.displayScale === right.displayScale
    && left.height === right.height
    && left.width === right.width
    && left.worldZoom === right.worldZoom
}

function hubCameraScale(fovPercent: number, viewport: BoundedGameViewportLayout): number {
  return cameraZoomForFov(HUB_CAMERA_SCALE, fovPercent) * viewport.worldZoom
}
