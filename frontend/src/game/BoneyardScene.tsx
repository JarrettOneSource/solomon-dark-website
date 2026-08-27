import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import { worldToScreen, type Camera } from '../editor/render.ts'
import { boneyard, nativeGameOver } from '../lib/assets.ts'
import {
  boneyardDigIndicatorLayout,
  boneyardTutorialDigIndicatorLayout,
  SOLOMON_DIG_HOTKEY_CODE,
} from './boneyard-dig-indicator.ts'
import { BoneyardEnemyAmbientAudioSynchronizer } from './boneyard-enemy-ambient-audio.ts'
import {
  BoneyardWeatherAudioSynchronizer,
  nativeBoneyardWeatherArenaFade,
} from './boneyard-weather-audio.ts'
import {
  BONEYARD_SOLOMON_VOICE_CUES,
  isBoneyardPlayerCombatEnabled,
} from './core-kernels/boneyard-encounter.ts'
import { actorHeadingVector } from './core-kernels/actor-heading.ts'
import {
  nativeTutorialHostileScenePaused,
  nativeTutorialHudAccess,
  type NativeTutorialState,
} from './core-kernels/native-tutorial.ts'
import type { HubInventoryAction } from './core-kernels/hub-economy.ts'
import {
  nativePlayerBeltsEqual,
  type PlayerBeltComponent,
} from './core-kernels/native-belt.ts'
import { nearestBoneyardGoodie } from './core-kernels/boneyard-goodie-interaction.ts'
import type { PlayerCharacterInput } from './core-kernels/player-character.ts'
import {
  isBoneyardGameSnapshot,
  type BoneyardGameSnapshot,
} from './client/boneyard-presentation-timeline.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import {
  cameraZoomForFov,
  gameUiScale,
  type GameSettings,
} from './game-settings.ts'
import { loadGameImage } from './game-assets.ts'
import { gameOverAudioEvents } from './game-over-audio.ts'
import {
  nativeBoneyardHitPointGain,
  nativeBoneyardPointGain,
  nativeEnemyEventSoundRequest,
  nativeLootEventSoundRequest,
  nativeSolomonDigSoundRequest,
  newSolomonVoiceEvent,
  solomonDigAudioDelta,
  type SolomonDigAudioCursor,
} from './game-audio-native.ts'
import { startGamePresentationLoop } from './game-presentation-frame-loop.ts'
import GameHud from './GameHud.tsx'
import type { GameMenuAvailability } from './GameMenuSkull.tsx'
import ContextualInteractButton from './ContextualInteractButton.tsx'
import type { NativeHudSkillBinding } from './native-hud-presentation.ts'
import HubInventoryUi, { type HubUiSurface } from './HubInventoryUi.tsx'
import GameOverOverlay from './GameOverOverlay.tsx'
import TouchJoystick from './input/TouchJoystick.tsx'
import NativeLootBitmapText from './NativeLootBitmapText.tsx'
import NativeSpectatorStatus from './NativeSpectatorStatus.tsx'
import TutorialOverlay, { TutorialModalCallouts } from './TutorialOverlay.tsx'
import {
  createBrowserGameplayInput,
  type BrowserGameplayInput,
} from './input/gameplay-input.ts'
import {
  projectNativeStickAim,
  projectNativeWorldPointer,
} from './input/gameplay-pointer.ts'
import type {
  BoneyardEnemyEventSnapshot,
  GameModAsset,
  GameSnapshot,
  LoadedBoneyard,
} from './protocol/game-protocol.ts'
import type {
  ProtocolPlayerEconomy,
  ProtocolPlayerProgression,
} from './protocol/game-state.ts'
import type { PartyRosterPlayer } from './protocol/party-state.ts'
import type { GameRunLifecycleState } from './core-kernels/game-run.ts'
import type { ModConsumableCatalogEntry } from './core-kernels/hub-economy.ts'
import { PlayerFootstepAudioSynchronizer } from './player-footstep-audio.ts'
import type { GameWorldSpeech } from './world-speech-presentation.ts'
import { BoneyardLootEventSynchronizer } from './loot-event-audio.ts'
import {
  NativeLootMessagePresentation,
  type NativeLootMessageVisual,
} from './loot-message-presentation.ts'
import {
  createBoneyardWorldRenderer,
  type BoneyardWorldRenderer,
} from './renderer/boneyard-world-renderer.ts'
import {
  paintBoneyardEnvironmentLight,
  type BoneyardEnvironmentLightImages,
} from './renderer/boneyard-environment-light.ts'
import {
  BONEYARD_CAMERA_ZOOM,
  boneyardSpectatorStatusesEqual,
  type BoneyardSpectatorStatusPresentation,
} from './renderer/boneyard-render-contract.ts'
import {
  gameViewportLayout,
  type GameViewportLayout,
} from './renderer/game-viewport.ts'
import './hub.css'
import './boneyard.css'

interface BoneyardSceneProps {
  accountUsername: string | null
  audio: GameAudioDirector
  belt: PlayerBeltComponent
  boneyard: LoadedBoneyard
  chatInputActive: boolean
  getPingMs: () => number | null
  initialSnapshot: GameSnapshot
  inputBlocked: boolean
  inventoryRequestSequence: number
  modalDisabled: boolean
  modAssets: readonly GameModAsset[]
  modCatalog: readonly ModConsumableCatalogEntry[]
  levelUpPresentationId: number | null
  nativeUiStageStyle: CSSProperties
  onInput: (input: PlayerCharacterInput) => void
  onLoadingError: () => void
  onHubAction: (action: HubInventoryAction) => void
  onContinueGameOver: (runId: string, eventId: number) => void
  onInventoryOpenChange: (open: boolean) => void
  /** Reports whether OPEN MENU would be honoured right now; the stage skull follows it. */
  onMenuAvailabilityChange?: (availability: GameMenuAvailability) => void
  onOpenSkillSelector: (binding: NativeHudSkillBinding) => void
  onOpenSkills: () => void
  onUnassignQuickbarSkill?: (slot: number) => void
  onPauseRequest: () => void
  onReady: () => void
  onTutorialAction: (action: 'inventory-opened' | 'inventory-closed' | 'skills-opened' | 'skills-closed') => void
  partyRoster?: readonly PartyRosterPlayer[]
  playerId: string
  progression: ProtocolPlayerProgression
  presentationPaused: boolean
  samplePresentation: (nowMs?: number) => GameSnapshot
  settings: GameSettings
  subscribePing: (listener: (pingMs: number) => void) => () => void
  subscribeEnemyEvent: (listener: (event: BoneyardEnemyEventSnapshot) => void) => () => void
  subscribe: (listener: (snapshot: GameSnapshot) => void) => () => void
  worldSpeeches: readonly GameWorldSpeech[]
}

interface BoneyardFrameDiagnostics {
  frameCount: number
  modEffectCount: number
  painterBandCount: number
  playerScreenX: number
  playerScreenY: number
  playerWalkPose: number
  solomonDirtAgeTicks: number | null
  solomonDirtAlpha: number
  solomonDirtCount: number
  solomonDirtEventId: number
  solomonDirtHeadingDegrees: number
  solomonDirtPassCount: number
  solomonDirtX: number
  solomonDirtY: number
  solomonFrame: number
  staticPaintCount: number
}

type RendererState = 'loading' | 'ready'

export default function BoneyardScene({
  accountUsername,
  audio,
  belt,
  boneyard: loaded,
  chatInputActive,
  getPingMs,
  initialSnapshot,
  inputBlocked,
  inventoryRequestSequence,
  modalDisabled,
  modAssets,
  modCatalog,
  levelUpPresentationId,
  nativeUiStageStyle,
  onInput,
  onLoadingError,
  onHubAction,
  onContinueGameOver,
  onInventoryOpenChange,
  onMenuAvailabilityChange,
  onOpenSkillSelector,
  onOpenSkills,
  onUnassignQuickbarSkill,
  onPauseRequest,
  onReady,
  onTutorialAction,
  partyRoster,
  playerId,
  progression,
  presentationPaused,
  samplePresentation,
  settings,
  subscribeEnemyEvent,
  subscribePing,
  subscribe,
  worldSpeeches,
}: BoneyardSceneProps) {
  const [boneyardInitialSnapshot] = useState<BoneyardGameSnapshot>(() => {
    if (!isBoneyardGameSnapshot(initialSnapshot)) {
      throw new Error('Boneyard scene requires a Boneyard snapshot')
    }
    return initialSnapshot
  })
  const [run, setRun] = useState<GameRunLifecycleState>(boneyardInitialSnapshot.run)
  const [inventorySurface, setInventorySurface] = useState<HubUiSurface>(null)
  const [npcNoteboxOpen, setNpcNoteboxOpen] = useState(false)
  const [controllerQuickbarSlot, setControllerQuickbarSlot] = useState<number | undefined>()
  const [tutorial, setTutorial] = useState<NativeTutorialState | null>(
    boneyardInitialSnapshot.world.tutorial,
  )
  const tutorialAccess = tutorial ? nativeTutorialHudAccess(tutorial) : null
  const [tutorialWorldTarget, setTutorialWorldTarget] = useState<Readonly<{
    x: number
    y: number
  }> | null>(null)
  const [tutorialSolomonPointer, setTutorialSolomonPointer] = useState<Readonly<{
    toX: number
    toY: number
    x: number
    y: number
  }> | null>(null)
  const inventoryRequestRef = useRef(inventoryRequestSequence)
  const tutorialInventoryOpenRef = useRef(false)
  const [economy, setEconomy] = useState<ProtocolPlayerEconomy>(
    boneyardInitialSnapshot.players[playerId]!.economy,
  )
  const [liveBelt, setLiveBelt] = useState<PlayerBeltComponent>(belt)
  const economyRef = useRef(economy)
  economyRef.current = economy
  const [playerPosition, setPlayerPosition] = useState(
    boneyardInitialSnapshot.players[playerId]!.position,
  )
  const [goodieTargetId, setGoodieTargetId] = useState<number | null>(() => {
    const player = boneyardInitialSnapshot.players[playerId]
    return player?.progression.lifeState === 'alive'
      ? nearestBoneyardGoodie(boneyardInitialSnapshot.world.goodies, player)?.id ?? null
      : null
  })
  const goodieTargetIdRef = useRef(goodieTargetId)
  goodieTargetIdRef.current = goodieTargetId
  const sceneInputBlocked = inputBlocked
    || inventorySurface !== null
    || npcNoteboxOpen
    || run.phase !== 'active'

  useEffect(() => {
    onInventoryOpenChange(inventorySurface?.kind === 'inventory')
  }, [inventorySurface?.kind, onInventoryOpenChange])

  useEffect(() => {
    if (!tutorial) {
      tutorialInventoryOpenRef.current = false
      return
    }
    const open = inventorySurface?.kind === 'inventory'
    if (tutorialInventoryOpenRef.current === open) return
    tutorialInventoryOpenRef.current = open
    onTutorialAction(open ? 'inventory-opened' : 'inventory-closed')
  }, [inventorySurface?.kind, onTutorialAction, tutorial])

  // The same gate as the OPEN MENU keydown below, published for the stage skull. Stock
  // paints no skull until the tutorial unlocks the combat HUD (nativeTutorialHudAccess
  // `combat`, the gate hub.css applies to the meters), so the skull stays hidden until then.
  const menuAvailable = !sceneInputBlocked && run.phase === 'active'
  const menuAvailability: GameMenuAvailability = tutorialAccess && !tutorialAccess.combat
    ? 'hidden'
    : menuAvailable ? 'available' : 'inert'
  useEffect(() => {
    onMenuAvailabilityChange?.(menuAvailability)
  }, [menuAvailability, onMenuAvailabilityChange])

  useEffect(() => () => onMenuAvailabilityChange?.('inert'), [onMenuAvailabilityChange])

  const sceneRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const environmentLightCanvasRef = useRef<HTMLCanvasElement>(null)
  const digIndicatorRef = useRef<HTMLDivElement>(null)
  const digReceiptRef = useRef<HTMLSpanElement>(null)
  const rendererRef = useRef<BoneyardWorldRenderer | null>(null)
  const worldSpeechesRef = useRef(worldSpeeches)
  worldSpeechesRef.current = worldSpeeches
  const pendingEnemyPresentationEventsRef = useRef<BoneyardEnemyEventSnapshot[]>([])
  const inputRef = useRef<BrowserGameplayInput | null>(null)
  const settingsRef = useRef(settings)
  const lastVoiceEventRef = useRef({
    eventId: boneyardInitialSnapshot.world.encounter?.voiceEvents.at(-1)?.id ?? 0,
    runId: loaded.runId,
  })
  const digAudioCursorRef = useRef<SolomonDigAudioCursor | null>(null)
  const inputBlockedRef = useRef(sceneInputBlocked)
  const presentationPausedRef = useRef(presentationPaused)
  settingsRef.current = settings
  const levelUpPresentationIdRef = useRef(levelUpPresentationId)
  const onLoadingErrorRef = useRef(onLoadingError)
  const onReadyRef = useRef(onReady)
  const controllerActionsRef = useRef({ onOpenSkills, onPauseRequest })
  inputBlockedRef.current = sceneInputBlocked
  presentationPausedRef.current = presentationPaused
  levelUpPresentationIdRef.current = levelUpPresentationId
  onLoadingErrorRef.current = onLoadingError
  onReadyRef.current = onReady
  controllerActionsRef.current = { onOpenSkills, onPauseRequest }
  const [rendererState, setRendererState] = useState<RendererState>('loading')
  const [lootEventSynchronizer] = useState(() => (
    new BoneyardLootEventSynchronizer(boneyardInitialSnapshot)
  ))
  const [lootMessagePresentation] = useState(() => (
    new NativeLootMessagePresentation(boneyardInitialSnapshot.tick)
  ))
  const [lootMessages, setLootMessages] = useState<readonly NativeLootMessageVisual[]>([])
  const [rendererError, setRendererError] = useState<string | null>(null)
  const [spectatorStatus, setSpectatorStatus] =
    useState<BoneyardSpectatorStatusPresentation | null>(null)
  useEffect(() => {
    if (inventoryRequestRef.current === inventoryRequestSequence) return
    inventoryRequestRef.current = inventoryRequestSequence
    if (!inputBlocked && tutorialAccess?.inventory !== false && run.phase === 'active') {
      setInventorySurface({ kind: 'inventory' })
    }
  }, [inputBlocked, inventoryRequestSequence, run.phase, tutorialAccess?.inventory])
  const previousAudioRunRef = useRef(boneyardInitialSnapshot.run)
  const [viewport, setViewport] = useState<GameViewportLayout>(() => (
    gameViewportLayout(1600, 900)
  ))
  const [gameOverAnchor, setGameOverAnchor] = useState({
    x: 800,
    y: 450,
    zoom: BONEYARD_CAMERA_ZOOM,
  })
  const viewportRef = useRef(viewport)
  const [digIndicatorRunId, setDigIndicatorRunId] = useState<string | null>(null)
  const dig = loaded.scene.solomonDig
  const digPosition = dig?.position

  useEffect(() => subscribe((snapshot) => {
    lootEventSynchronizer.consume(snapshot, (event) => {
      const scene = sceneRef.current
      if (scene) {
        scene.dataset.lastLootActorId = `${event.actorId}`
        scene.dataset.lastLootEventId = `${event.eventId}`
        scene.dataset.lastLootEventType = event.type
        if (event.sound !== undefined) scene.dataset.lastLootSound = event.sound
        if (event.text !== undefined) scene.dataset.lastLootText = event.text
      }
      if (event.playerId === playerId) lootMessagePresentation.consume(event)
      const sound = nativeLootEventSoundRequest(event)
      if (!sound) return
      const renderer = rendererRef.current
      const localPlayer = snapshot.players[playerId]
      const camera = renderer?.camera(snapshot)
      const spatialGain = camera && sound.sourcePosition !== null
        ? nativeBoneyardPointGain(
            sound.sourcePosition,
            camera,
            viewportRef.current.width / camera.zoom,
            localPlayer?.progression.lifeState === 'dying'
              || localPlayer?.progression.lifeState === 'spectating',
          )
        : 1
      audio.playSound(sound.cue, {
        playbackRate: sound.playbackRate,
        volume: sound.volume * spatialGain,
      })
    })
    setLootMessages(lootMessagePresentation.sample(snapshot.tick))
    setRun((current) => (
      snapshot.run.phase === 'game-over' && current.phase === 'game-over'
        ? current
        : snapshot.run
    ))
    if (snapshot.world.kind === 'boneyard') setTutorial(snapshot.world.tutorial)
    for (const cue of gameOverAudioEvents(previousAudioRunRef.current, snapshot.run)) {
      if (cue === 'solomon-laugh-big') audio.stopStreams(BONEYARD_SOLOMON_VOICE_CUES)
      audio.playStream(cue)
    }
    previousAudioRunRef.current = snapshot.run
  }), [audio, lootEventSynchronizer, lootMessagePresentation, playerId, subscribe])

  useEffect(() => subscribeEnemyEvent((event) => {
    if (event.runId !== loaded.runId) return
    const scene = sceneRef.current
    if (scene) {
      scene.dataset.lastEnemyEventActorId = `${event.actorId}`
      scene.dataset.lastEnemyEventId = `${event.eventId}`
      scene.dataset.lastEnemyEventType = event.type
      if (event.output !== undefined) {
        scene.dataset.lastEnemyEventOutput = event.output
      }
    }
    const sound = nativeEnemyEventSoundRequest(event)
    if (sound) {
      const renderer = rendererRef.current
      const snapshot = samplePresentation()
      const localPlayer = snapshot.players[playerId]
      const camera = renderer?.camera(snapshot)
      const spatialGain = camera && sound.sourcePosition !== null
        ? nativeBoneyardPointGain(
            sound.sourcePosition,
            camera,
            viewportRef.current.width / camera.zoom,
            localPlayer?.progression.lifeState === 'dying'
              || localPlayer?.progression.lifeState === 'spectating',
          )
        : 1
      audio.playSound(sound.cue, {
        playbackRate: sound.playbackRate,
        volume: sound.volume * spatialGain,
      })
    }
    const renderer = rendererRef.current
    if (renderer) renderer.consumeEnemyEvent(event)
    else pendingEnemyPresentationEventsRef.current.push(event)
  }), [audio, loaded.runId, playerId, samplePresentation, subscribeEnemyEvent])

  useEffect(() => {
    const synchronizer = new PlayerFootstepAudioSynchronizer(
      audio,
      playerId,
      boneyardInitialSnapshot,
      (event) => {
        if (event.playerId !== playerId) return
        const scene = sceneRef.current
        if (scene) scene.dataset.lastFootstepTick = `${event.tick}`
      },
    )
    return subscribe((snapshot) => {
      if (
        snapshot.world.kind !== 'boneyard'
        || snapshot.world.runId !== loaded.runId
      ) return
      synchronizer.update(snapshot)
      const player = snapshot.players[playerId]
      if (player) {
        setLiveBelt((current) => nativePlayerBeltsEqual(current, player.belt)
          ? current
          : player.belt)
        setEconomy((current) => current.revision === player.economy.revision
          ? current
          : player.economy)
        setPlayerPosition((current) => (
          current.x === player.position.x && current.y === player.position.y
            ? current
            : player.position
        ))
        const target = player.progression.lifeState === 'alive'
          ? nearestBoneyardGoodie(snapshot.world.goodies, player)
          : null
        setGoodieTargetId((current) => current === (target?.id ?? null)
          ? current
          : target?.id ?? null)
      }
    })
  }, [audio, boneyardInitialSnapshot, loaded.runId, playerId, subscribe])

  useEffect(() => {
    const openSkills = (event: KeyboardEvent) => {
      if (
        inputBlocked
        || tutorialAccess?.skills === false
        || run.phase !== 'active'
        || event.code !== settings.controls.openSkills
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) return
      event.preventDefault()
      event.stopPropagation()
      setInventorySurface(null)
      onOpenSkills()
    }
    window.addEventListener('keydown', openSkills, { capture: true })
    return () => window.removeEventListener('keydown', openSkills, { capture: true })
  }, [inputBlocked, onOpenSkills, run.phase, settings.controls.openSkills, tutorialAccess?.skills])

  useEffect(() => {
    const toggleDigIndicator = (event: KeyboardEvent) => {
      if (
        sceneInputBlocked
        || event.code !== SOLOMON_DIG_HOTKEY_CODE
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || !dig
        || tutorial !== null
      ) return
      event.preventDefault()
      setDigIndicatorRunId((activeRunId) => (
        activeRunId === loaded.runId ? null : loaded.runId
      ))
    }
    window.addEventListener('keydown', toggleDigIndicator)
    return () => window.removeEventListener('keydown', toggleDigIndicator)
  }, [dig, loaded.runId, sceneInputBlocked, tutorial])

  useEffect(() => {
    const interact = (event: KeyboardEvent) => {
      if (
        sceneInputBlocked
        || run.phase !== 'active'
        || goodieTargetId === null
        || event.code !== 'KeyE'
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) return
      event.preventDefault()
      event.stopImmediatePropagation()
      onHubAction({ type: 'interact-goodie' })
    }
    window.addEventListener('keydown', interact, { capture: true })
    return () => window.removeEventListener('keydown', interact, { capture: true })
  }, [goodieTargetId, onHubAction, run.phase, sceneInputBlocked])

  useEffect(() => {
    const openPause = (event: KeyboardEvent) => {
      if (
        sceneInputBlocked
        || run.phase !== 'active'
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
  }, [onPauseRequest, run.phase, sceneInputBlocked, settings.controls.openMenu])

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
    inputRef.current?.setBlocked(sceneInputBlocked)
  }, [sceneInputBlocked])

  useLayoutEffect(() => {
    inputRef.current?.setControls(settings.controls)
  }, [settings.controls])

  useLayoutEffect(() => {
    rendererRef.current?.setSettings({
      cameraFovPercent: settings.cameraFovPercent,
      complexLighting: settings.complexLighting,
      complexShadows: settings.complexShadows,
      lightQualityPercent: settings.lightQualityPercent,
      multipleShadows: settings.multipleShadows,
      zoomEffects: settings.zoomEffects,
    })
  }, [
    settings.cameraFovPercent,
    settings.complexLighting,
    settings.complexShadows,
    settings.lightQualityPercent,
    settings.multipleShadows,
    settings.zoomEffects,
  ])

  useLayoutEffect(() => {
    rendererRef.current?.setLevelUpPresentation(levelUpPresentationId)
  }, [levelUpPresentationId])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let stopPresentationLoop: (() => void) | null = null
    const enemyAmbientAudio = new BoneyardEnemyAmbientAudioSynchronizer(audio)
    const weatherAudio = new BoneyardWeatherAudioSynchronizer(audio)
    const input = createBrowserGameplayInput({
      claimQuickbarPress: (slot) => {
        const entry = samplePresentation().players[playerId]?.belt[slot] ?? null
        if (entry === null || entry.kind === 'skill') return false
        onHubAction({ slot, type: 'activate-belt-slot' })
        return true
      },
      claimMouseCastStart: () => {
        const renderer = rendererRef.current
        if (!renderer) return false
        const snapshot = samplePresentation()
        if (!renderer.cycleSpectatorTarget(snapshot)) return false
        const nextStatus = renderer.spectatorStatus(snapshot)
        setSpectatorStatus((current) => (
          boneyardSpectatorStatusesEqual(current, nextStatus) ? current : nextStatus
        ))
        return true
      },
      controls: settingsRef.current.controls,
      mouseTarget: host,
      onGamepadAction: (action) => {
        if (samplePresentation().run.phase !== 'active') return
        const callbacks = controllerActionsRef.current
        if (action === 'inventory') {
          setInventorySurface({ kind: 'inventory' })
        } else if (action === 'skills') {
          setInventorySurface(null)
          callbacks.onOpenSkills()
        } else if (action === 'pause') {
          callbacks.onPauseRequest()
        } else if (action === 'interact' && goodieTargetIdRef.current !== null) {
          onHubAction({ type: 'interact-goodie' })
        }
      },
      onGamepadPresenceChange: (present) => {
        if (!present) setControllerQuickbarSlot(undefined)
      },
      onGamepadQuickbarSelection: setControllerQuickbarSlot,
      onInput,
      projectDirection: (direction) => {
        const renderer = rendererRef.current
        if (!renderer) return null
        const snapshot = samplePresentation()
        const player = snapshot.players[playerId]
        if (!player) return null
        return projectNativeStickAim(
          direction,
          player.position,
          viewportRef.current,
          renderer.camera(snapshot).zoom,
        )
      },
      projectPointer: (pointer) => {
        const renderer = rendererRef.current
        if (!renderer) return null
        const snapshot = samplePresentation()
        const camera = renderer.camera(snapshot)
        const viewport = viewportRef.current
        return projectNativeWorldPointer(
          pointer,
          host.getBoundingClientRect(),
          viewport,
          {
            x: camera.x - viewport.width / 2 / camera.zoom,
            y: camera.y - viewport.height / 2 / camera.zoom,
          },
          camera.zoom,
        )
      },
      projectSecondaryAim: () => {
        const renderer = rendererRef.current
        if (!renderer) return null
        const snapshot = samplePresentation()
        const player = snapshot.players[playerId]
        if (!player) return null
        return projectNativeStickAim(
          actorHeadingVector(player.headingIndex),
          player.position,
          viewportRef.current,
          renderer.camera(snapshot).zoom,
        )
      },
      secondaryAtPointer: () => settingsRef.current.castSecondariesAtMouse,
      viewportHeight: () => viewportRef.current.height,
      viewportWidth: () => viewportRef.current.width,
    })
    input.setBlocked(true)
    inputRef.current = input
    setRendererState('loading')
    setRendererError(null)
    setSpectatorStatus(null)

    const environmentLightPresentation = loaded.scene.environmentMode === 1
      || loaded.scene.environmentMode === 2
      ? loadBoneyardEnvironmentLightPresentation()
      : Promise.resolve(null)
    const gameOverPresentation = Promise.all(
      Object.values(nativeGameOver).map(loadGameImage),
    )
    const rendererPromise = createBoneyardWorldRenderer({
      boneyard: loaded,
      initialSnapshot: boneyardInitialSnapshot,
      modAssets,
      modCatalog,
      playerId,
      settings: settingsRef.current,
      viewport: viewportRef.current,
    })
    void Promise.all([
      rendererPromise,
      environmentLightPresentation,
      gameOverPresentation,
    ]).then(([renderer, initialEnvironmentLight]) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      renderer.setLevelUpPresentation(levelUpPresentationIdRef.current)
      renderer.setWorldSpeeches(worldSpeechesRef.current)
      const pendingEnemyEvents = pendingEnemyPresentationEventsRef.current
      pendingEnemyPresentationEventsRef.current = []
      for (const event of pendingEnemyEvents) {
        if (event.runId === loaded.runId) renderer.consumeEnemyEvent(event)
      }
      host.replaceChildren(renderer.canvas)
      renderer.resize(viewportRef.current)
      const environmentLight = environmentLightCanvasRef.current
      if (environmentLight && initialEnvironmentLight) {
        paintBoneyardEnvironmentLight(
          environmentLight,
          boneyardInitialSnapshot.players,
          renderer.camera(boneyardInitialSnapshot),
          viewportRef.current,
          performance.now(),
          initialEnvironmentLight,
        )
      }
      setRendererState('ready')
      onReadyRef.current()
      input.setBlocked(inputBlockedRef.current)
      stopPresentationLoop = startGamePresentationLoop((now) => {
        if (presentationPausedRef.current) return
        const snapshot = samplePresentation(now)
        const camera = renderer.camera(snapshot)
        if (snapshot.world.kind === 'boneyard') {
          const tutorialState = snapshot.world.tutorial
          const sack = tutorialState && (tutorialState.stage === 8 || tutorialState.stage === 17)
            ? snapshot.world.loot.find(({ kind }) => kind === 'sack')
            : undefined
          const target = sack
            ? worldToScreen(sack.position, camera, viewportRef.current.width, viewportRef.current.height)
            : null
          setTutorialWorldTarget((current) => (
            current?.x === target?.x && current?.y === target?.y ? current : target
          ))
          const tutorialPlayer = snapshot.players[playerId]
          const encounter = snapshot.world.encounter
          let solomonPointer: Readonly<{
            toX: number
            toY: number
            x: number
            y: number
          }> | null = null
          if (
            tutorialState
            && !tutorialState.introActive
            && tutorialState.stage <= 1
            && encounter?.phase === 'digging'
            && tutorialPlayer
            && digPosition
          ) {
            const playerScreen = worldToScreen(
              tutorialPlayer.position,
              camera,
              viewportRef.current.width,
              viewportRef.current.height,
            )
            const digScreen = worldToScreen(
              digPosition,
              camera,
              viewportRef.current.width,
              viewportRef.current.height,
            )
            const layout = boneyardTutorialDigIndicatorLayout(
              playerScreen,
              digScreen,
              viewportRef.current,
            )
            solomonPointer = {
              toX: digScreen.x,
              toY: digScreen.y,
              x: layout.x,
              y: layout.y,
            }
          }
          setTutorialSolomonPointer((current) => (
            current?.x === solomonPointer?.x
            && current?.y === solomonPointer?.y
            && current?.toX === solomonPointer?.toX
            && current?.toY === solomonPointer?.toY
              ? current
              : solomonPointer
          ))
        }
        if (snapshot.run.phase === 'game-over') {
          setRun((current) => (
            current.phase === 'game-over'
              && current.gameOverTicks === snapshot.run.gameOverTicks
              && current.gameOverExitTicks === snapshot.run.gameOverExitTicks
              ? current
              : snapshot.run
          ))
          const player = snapshot.players[playerId]
          if (player) {
            const anchor = worldToScreen(
              player.position,
              camera,
              viewportRef.current.width,
              viewportRef.current.height,
            )
            setGameOverAnchor((current) => (
              current.x === anchor.x
              && current.y === anchor.y
              && current.zoom === camera.zoom
                ? current
                : { ...anchor, zoom: camera.zoom }
            ))
          }
        }
        if (snapshot.world.kind === 'boneyard' && snapshot.world.encounter) {
          if (lastVoiceEventRef.current.runId !== snapshot.world.runId) {
            audio.stopStreams(BONEYARD_SOLOMON_VOICE_CUES)
            lastVoiceEventRef.current = { eventId: 0, runId: snapshot.world.runId }
          }
          const event = newSolomonVoiceEvent(
            lastVoiceEventRef.current.eventId,
            snapshot.world.encounter.voiceEvents,
          )
          if (event) {
            audio.playStream(event.cue)
            lastVoiceEventRef.current.eventId = event.id
          }
          const digAudio = solomonDigAudioDelta(
            digAudioCursorRef.current,
            snapshot.world.runId,
            snapshot.world.encounter.digEvents,
          )
          digAudioCursorRef.current = digAudio.cursor
          for (const digAudioEvent of digAudio.events) {
            const request = nativeSolomonDigSoundRequest(digAudioEvent)
            const localPlayer = snapshot.players[playerId]
            const hitGain = nativeBoneyardHitPointGain(
              snapshot.world.encounter.position,
              camera,
              viewportRef.current.width / camera.zoom,
              localPlayer?.progression.lifeState === 'dying'
                || localPlayer?.progression.lifeState === 'spectating',
            )
            audio.playSound(request.cue, {
              playbackRate: request.playbackRate,
              volume: request.volume * hitGain,
            })
            const scene = sceneRef.current
            if (scene) {
              scene.dataset.solomonDigAudioCue = request.cue
              scene.dataset.solomonDigAudioEventId = `${digAudioEvent.id}`
              scene.dataset.solomonDigAudioGain = `${request.volume * hitGain}`
              scene.dataset.solomonDigAudioPlaybackRate = `${request.playbackRate}`
            }
          }
        }
        if (isBoneyardGameSnapshot(snapshot)) {
          const weatherRequest = weatherAudio.update(
            loaded.scene.environmentMode,
            nativeBoneyardWeatherArenaFade(
              snapshot.run.gameOverExitTicks,
              snapshot.run.gameOverExitKind,
            ),
          )
          const localPlayer = snapshot.players[playerId]
          const requests = enemyAmbientAudio.update(snapshot, (position) => (
            nativeBoneyardPointGain(
              position,
              camera,
              viewportRef.current.width / camera.zoom,
              localPlayer?.progression.lifeState === 'dying'
                || localPlayer?.progression.lifeState === 'spectating',
            )
          ))
          const scene = sceneRef.current
          if (scene) {
            scene.dataset.weatherAudioCue = weatherRequest.cue
            scene.dataset.weatherAudioGain = `${weatherRequest.gain}`
            scene.dataset.weatherAudioOwner = 'boneyard-weather:rainfall'
            const active = requests.filter(({ gain }) => gain > 0)
            scene.dataset.enemyAmbientLoops = active.map(({ cue }) => cue).join(',')
            scene.dataset.enemyAmbientLoopGains = active
              .map(({ cue, gain }) => `${cue}:${gain.toFixed(6)}`)
              .join(',')
          }
        }
        onInput(input.sample().input)
        renderer.setWorldSpeeches(worldSpeechesRef.current)
        renderer.render(snapshot)
        const nextStatus = renderer.spectatorStatus(snapshot)
        setSpectatorStatus((current) => (
          boneyardSpectatorStatusesEqual(current, nextStatus) ? current : nextStatus
        ))
        const environmentLight = environmentLightCanvasRef.current
        if (environmentLight && initialEnvironmentLight) {
          paintBoneyardEnvironmentLight(
            environmentLight,
            Object.fromEntries(Object.entries(snapshot.players).filter(([id]) => (
              !snapshot.materializingPlayerIds.includes(id)
            ))),
            camera,
            viewportRef.current,
            now,
            initialEnvironmentLight,
          )
        }
        positionDigIndicator(
          digIndicatorRef.current,
          snapshot,
          playerId,
          digPosition,
          camera,
          viewportRef.current,
        )
        publishSceneDiagnostics(
          sceneRef.current,
          renderer.canvas,
          digReceiptRef.current,
          snapshot,
          playerId,
        )
      })
    }).catch((error: unknown) => {
      void rendererPromise.then((renderer) => {
        if (rendererRef.current === renderer) rendererRef.current = null
        renderer.destroy()
      }, () => undefined)
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
      enemyAmbientAudio.destroy()
      weatherAudio.destroy()
      audio.stopStreams(BONEYARD_SOLOMON_VOICE_CUES)
      input.destroy()
      inputRef.current = null
      pendingEnemyPresentationEventsRef.current = []
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [
    audio,
    boneyardInitialSnapshot,
    digPosition,
    loaded,
    modAssets,
    modCatalog,
    onHubAction,
    onInput,
    playerId,
    samplePresentation,
  ])

  const localPlayer = boneyardInitialSnapshot.players[playerId]
  const element = localPlayer?.config.element ?? 'ether'
  const discipline = localPlayer?.config.discipline ?? 'arcane'
  const gateLeaves = boneyardInitialSnapshot.world.gateLeaves
  const digIndicatorVisible = Boolean(!tutorial && dig && digIndicatorRunId === loaded.runId)
  const tutorialScenePaused = tutorial !== null
    && nativeTutorialHostileScenePaused(tutorial)
  const configuredCameraZoom = cameraZoomForFov(
    BONEYARD_CAMERA_ZOOM,
    settings.cameraFovPercent,
  )
  const uiScale = gameUiScale(settings)
  return (
    <div
      ref={sceneRef}
      className="boneyard-scene"
      data-boneyard-id={loaded.choice.id}
      data-camera-zoom={configuredCameraZoom}
      data-discipline={discipline}
      data-element={element}
      data-environment-mode={loaded.scene.environmentMode}
      data-geometry-sha256={loaded.geometrySha256}
      data-gate-leaf-count={gateLeaves.length}
      data-gate-state={gateState(gateLeaves)}
      data-gameplay-input-blocked={sceneInputBlocked || rendererState !== 'ready'}
      data-local-player-x={localPlayer?.position.x}
      data-local-player-y={localPlayer?.position.y}
      data-presentation-paused={presentationPaused}
      data-renderer-state={rendererError ? 'error' : rendererState}
      data-run-id={loaded.runId}
      data-tutorial-stage={tutorial?.stage}
      data-tutorial-scene-paused={tutorialScenePaused}
      data-viewport-height={viewport.height}
      data-viewport-scale={viewport.displayScale}
      data-viewport-width={viewport.width}
      data-ui-scale={uiScale}
      aria-label={`Boneyard: ${loaded.choice.name}. Move with the configured keys, a controller, or the touch joystick.${dig && !tutorial ? ' Press H to toggle the Solomon Dig direction arrow.' : ''}`}
      tabIndex={0}
    >
      <div
        className="boneyard-native-frame"
        style={{
          '--hud-display-scale': viewport.displayScale,
          height: viewport.height,
          transform: `scale(${viewport.displayScale})`,
          width: viewport.width,
        } as CSSProperties}
      >
        <div ref={hostRef} className="boneyard-world-renderer" />
        {(loaded.scene.environmentMode === 1 || loaded.scene.environmentMode === 2) ? (
          <canvas
            ref={environmentLightCanvasRef}
            className="boneyard-environment-light"
            data-composite="plus-lighter"
            data-native-light="DeadHawg:18"
            aria-hidden
          />
        ) : null}

        {run.phase !== 'game-over' ? (
          <>
            {tutorial ? (
              <TutorialOverlay
                audio={audio}
                controls={settings.controls}
                solomonPointer={tutorialSolomonPointer}
                state={tutorial}
                viewport={viewport}
                worldTarget={tutorialWorldTarget}
              />
            ) : null}
            <div className="boneyard-loot-messages" aria-live="polite" aria-atomic="false">
              {lootMessages.map((message) => (
                <span
                  key={message.eventId}
                  aria-label={message.text}
                  style={{
                    opacity: message.alpha,
                    transform: `scale(${message.scale})`,
                  }}
                >
                  <NativeLootBitmapText text={message.text} tint={message.tint} />
                </span>
              ))}
            </div>

            <GameHud
              accountUsername={accountUsername}
              audio={audio}
              controls={settings.controls}
              controllerQuickbarSlot={controllerQuickbarSlot}
              getPingMs={getPingMs}
              initialSnapshot={boneyardInitialSnapshot}
              mode="run"
              onInventoryClick={() => {
                if (!inputBlocked && tutorialAccess?.inventory !== false && run.phase === 'active') {
                  setInventorySurface({ kind: 'inventory' })
                }
              }}
              onQuickbarInput={(slot, pressed) => {
                const input = inputRef.current
                if (!input) return
                const entry = samplePresentation().players[playerId]?.belt[slot] ?? null
                if (pressed && entry !== null && entry.kind !== 'skill') {
                  if (!inputBlocked && run.phase === 'active') {
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
                if (!inputBlocked && tutorialAccess?.spell !== false && run.phase === 'active') {
                  setInventorySurface(null)
                  onOpenSkillSelector(binding)
                }
              }}
              onSkillsClick={() => {
                if (!inputBlocked && tutorialAccess?.skills !== false && run.phase === 'active') {
                  setInventorySurface(null)
                  onOpenSkills()
                }
              }}
              partyRoster={partyRoster}
              playerId={playerId}
              progression={progression}
              subscribePing={subscribePing}
              subscribeSnapshot={subscribe}
              tutorialAccess={tutorialAccess}
              uiScale={uiScale}
              viewport={viewport}
            />
            <HubInventoryUi
              audio={audio}
              belt={liveBelt}
              config={boneyardInitialSnapshot.players[playerId]!.config}
              disabled={modalDisabled || tutorialAccess?.inventory === false || run.phase !== 'active'}
              economy={economy}
              inputSuspended={chatInputActive}
              inventoryKeyCode={settings.controls.openInventory}
              menuKeyCode={settings.controls.openMenu}
              modAssets={modAssets}
              nativeUiStageStyle={nativeUiStageStyle}
              onAction={onHubAction}
              onBlockingOverlayChange={setNpcNoteboxOpen}
              onSurfaceChange={setInventorySurface}
              onUnassignBeltEntry={onUnassignQuickbarSkill}
              overlayRoot={sceneRef}
              playerPosition={playerPosition}
              progression={progression}
              region="courtyard"
              surface={inventorySurface}
              interactionsEnabled={false}
              transitionActive={false}
            />
            {goodieTargetId !== null && !sceneInputBlocked && run.phase === 'active' ? (
              <ContextualInteractButton
                label="Unlock locked chest"
                target={`goodie:${goodieTargetId}`}
                onInteract={() => onHubAction({ type: 'interact-goodie' })}
              />
            ) : null}
            {spectatorStatus ? (
              <NativeSpectatorStatus status={spectatorStatus} viewport={viewport} />
            ) : null}
            {digIndicatorVisible ? (
              <div
                ref={digIndicatorRef}
                className="boneyard-dig-indicator"
                data-hotkey="H"
                data-ready="false"
                role="img"
                aria-label="Direction to Solomon Dig"
              >
                <svg viewBox="-40 -28 80 56" aria-hidden>
                  <path d="M -35 -9 H 8 V -23 L 36 0 8 23 V 9 H -35 Z" />
                </svg>
              </div>
            ) : null}
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
          </>
        ) : null}

        {run.phase === 'game-over' && run.runId ? (
          <GameOverOverlay
            anchor={gameOverAnchor}
            eventId={run.gameOverEventId}
            gameOverExitKind={run.gameOverExitKind}
            gameOverExitTicks={run.gameOverExitTicks}
            gameOverTicks={run.gameOverTicks}
            onContinue={(eventId) => {
              audio.playSound('click')
              onContinueGameOver(run.runId!, eventId)
            }}
            runId={run.runId}
          />
        ) : null}

        {dig ? (
          <div className="sr-only">
            <span
              ref={digReceiptRef}
              className="boneyard-dig-anchor"
              data-frame="0"
              data-world-x={dig.position.x}
              data-world-y={dig.position.y}
              role="img"
              aria-label="Solomon Dig"
            />
            <span
              className="boneyard-grave-dirt"
              data-world-x={dig.gravePosition.x}
              data-world-y={dig.gravePosition.y}
              aria-hidden
            />
            <span
              className="boneyard-lantern"
              data-world-x={dig.lanternPosition.x}
              data-world-y={dig.lanternPosition.y}
              aria-hidden
            />
          </div>
        ) : null}

        {rendererState === 'loading' && !rendererError && (
          <div className="hub-renderer-status" role="status">Preparing the Boneyard…</div>
        )}
        {rendererError && (
          <div className="hub-renderer-status hub-renderer-error" role="alert">
            WebGL could not render the Boneyard: {rendererError}
          </div>
        )}
      </div>
      {tutorial && (tutorial.stage === 10 || tutorial.stage === 13) ? (
        <div
          className="main-menu-native-stage tutorial-modal-callout-stage"
          style={nativeUiStageStyle}
        >
          <TutorialModalCallouts
            backpack={economy.backpack}
            controls={settings.controls}
            progression={progression}
            stage={tutorial.stage}
          />
        </div>
      ) : null}
    </div>
  )
}

function positionDigIndicator(
  indicator: HTMLDivElement | null,
  snapshot: GameSnapshot,
  playerId: string,
  digPosition: { x: number; y: number } | undefined,
  camera: Camera,
  viewport: GameViewportLayout,
): void {
  const player = snapshot.players[playerId]
  if (!indicator || !player || !digPosition) return
  const layout = boneyardDigIndicatorLayout(
    worldToScreen(
      player.position,
      camera,
      viewport.width,
      viewport.height,
    ),
    worldToScreen(
      digPosition,
      camera,
      viewport.width,
      viewport.height,
    ),
    viewport,
  )
  indicator.style.left = `${layout.x}px`
  indicator.style.top = `${layout.y}px`
  indicator.style.setProperty('--boneyard-dig-rotation', `${layout.rotationDeg}deg`)
  indicator.dataset.placement = layout.placement
  indicator.dataset.rotationDeg = `${layout.rotationDeg}`
  indicator.dataset.ready = 'true'
}

function sameViewport(left: GameViewportLayout, right: GameViewportLayout): boolean {
  return left.displayScale === right.displayScale
    && left.height === right.height
    && left.width === right.width
}

function publishSceneDiagnostics(
  scene: HTMLDivElement | null,
  canvas: HTMLCanvasElement,
  digReceipt: HTMLSpanElement | null,
  snapshot: GameSnapshot,
  playerId: string,
): void {
  if (!scene || snapshot.world.kind !== 'boneyard') return
  const player = snapshot.players[playerId]
  const diagnostics = (canvas as HTMLCanvasElement & {
    __sdrBoneyardFrame?: BoneyardFrameDiagnostics
  }).__sdrBoneyardFrame
  scene.dataset.gateLeafCount = `${snapshot.world.gateLeaves.length}`
  scene.dataset.gateState = gateState(snapshot.world.gateLeaves)
  if (diagnostics) scene.dataset.painterBandCount = `${diagnostics.painterBandCount}`
  if (player) {
    scene.dataset.localPlayerX = `${player.position.x}`
    scene.dataset.localPlayerY = `${player.position.y}`
  }
  const encounter = snapshot.world.encounter
  const latestVoiceEvent = encounter?.voiceEvents.at(-1)
  scene.dataset.combatEnabled = `${isBoneyardPlayerCombatEnabled(encounter)}`
  scene.dataset.solomonPhase = encounter?.phase ?? 'absent'
  scene.dataset.solomonRunEventId = `${encounter?.runEventId ?? 0}`
  scene.dataset.solomonVoiceCue = latestVoiceEvent?.cue ?? 'none'
  scene.dataset.solomonVoiceEventId = `${latestVoiceEvent?.id ?? 0}`
  if (encounter) {
    scene.dataset.solomonDirtAgeTicks = `${diagnostics?.solomonDirtAgeTicks ?? -1}`
    scene.dataset.solomonDirtAlpha = `${diagnostics?.solomonDirtAlpha ?? 0}`
    scene.dataset.solomonDirtCount = `${diagnostics?.solomonDirtCount ?? 0}`
    scene.dataset.solomonDirtEventId = `${diagnostics?.solomonDirtEventId ?? 0}`
    scene.dataset.solomonDirtHeading = `${diagnostics?.solomonDirtHeadingDegrees ?? 0}`
    scene.dataset.solomonDirtPassCount = `${diagnostics?.solomonDirtPassCount ?? 0}`
    scene.dataset.solomonDirtX = `${diagnostics?.solomonDirtX ?? Number.NaN}`
    scene.dataset.solomonDirtY = `${diagnostics?.solomonDirtY ?? Number.NaN}`
    scene.dataset.solomonDigBodyOffsetY = `${encounter.digBodyOffsetY}`
    scene.dataset.solomonHeading = `${encounter.headingDeg}`
    scene.dataset.solomonMouthPose = `${encounter.mouthPose}`
    scene.dataset.solomonWalkCycle = `${encounter.walkCycle}`
    scene.dataset.solomonX = `${encounter.position.x}`
    scene.dataset.solomonY = `${encounter.position.y}`
  }
  const waves = snapshot.world.waves
  scene.dataset.waveEventId = `${waves?.waveEventId ?? 0}`
  scene.dataset.waveLiveEnemyCount = `${snapshot.world.enemies.length + snapshot.world.maggots.length}`
  scene.dataset.wavePendingSpawnBudget = `${waves?.pendingSpawnBudget ?? 0}`
  scene.dataset.wavePhase = waves?.phase ?? 'absent'
  scene.dataset.waveScheduleIndex = `${waves?.scheduleIndex ?? 0}`
  scene.dataset.waveSpawnDelayTicks = `${waves?.spawnDelayTicks ?? 0}`
  scene.dataset.waveOrdinal = `${waves?.waveOrdinal ?? 0}`
  if (digReceipt) {
    digReceipt.dataset.frame = `${diagnostics?.solomonFrame ?? 0}`
    digReceipt.dataset.phase = encounter?.phase ?? 'absent'
    digReceipt.dataset.worldX = `${encounter?.position.x ?? digReceipt.dataset.worldX}`
    digReceipt.dataset.worldY = `${encounter?.position.y ?? digReceipt.dataset.worldY}`
  }
}

function gateState(leaves: readonly {
  id: string
  tip: { x: number; y: number }
}[]): string {
  return leaves.map((leaf) => (
    `${leaf.id}:${leaf.tip.x.toFixed(3)},${leaf.tip.y.toFixed(3)}`
  )).join('|')
}

async function loadBoneyardEnvironmentLightPresentation(): Promise<BoneyardEnvironmentLightImages> {
  return { aperture: await loadGameImage(boneyard.darknessAperture) }
}
