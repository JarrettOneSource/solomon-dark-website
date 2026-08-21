import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import { worldToScreen, type Camera } from '../editor/render.ts'
import { boneyard } from '../lib/assets.ts'
import {
  boneyardDigIndicatorLayout,
  SOLOMON_DIG_HOTKEY_CODE,
} from './boneyard-dig-indicator.ts'
import { BoneyardEnemyAmbientAudioSynchronizer } from './boneyard-enemy-ambient-audio.ts'
import {
  BoneyardWeatherAudioSynchronizer,
  nativeBoneyardWeatherArenaFade,
} from './boneyard-weather-audio.ts'
import { BONEYARD_SOLOMON_VOICE_CUES } from './core-kernels/boneyard-encounter.ts'
import { actorHeadingVector } from './core-kernels/actor-heading.ts'
import type { HubInventoryAction } from './core-kernels/hub-economy.ts'
import type { PlayerCharacterInput } from './core-kernels/player-character.ts'
import {
  isBoneyardGameSnapshot,
  type BoneyardGameSnapshot,
} from './client/boneyard-presentation-timeline.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import { loadGameImage } from './game-assets.ts'
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
import HubInventoryUi, { type HubUiSurface } from './HubInventoryUi.tsx'
import GameOverOverlay from './GameOverOverlay.tsx'
import TouchJoystick from './input/TouchJoystick.tsx'
import NativeLootBitmapText from './NativeLootBitmapText.tsx'
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
import type { GameRunLifecycleState } from './core-kernels/game-run.ts'
import type { ModConsumableCatalogEntry } from './core-kernels/hub-economy.ts'
import { PlayerFootstepAudioSynchronizer } from './player-footstep-audio.ts'
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
  boneyard: LoadedBoneyard
  getPingMs: () => number | null
  initialSnapshot: GameSnapshot
  inputBlocked: boolean
  inventoryRequestSequence: number
  modAssets: readonly GameModAsset[]
  modCatalog: readonly ModConsumableCatalogEntry[]
  levelUpPresentationId: number | null
  onInput: (input: PlayerCharacterInput) => void
  onLoadingError: () => void
  onHubAction: (action: HubInventoryAction) => void
  onInventoryOpenChange: (open: boolean) => void
  onOpenSkills: () => void
  onPauseRequest: () => void
  onReady: () => void
  playerId: string
  progression: ProtocolPlayerProgression
  presentationPaused: boolean
  samplePresentation: (nowMs?: number) => GameSnapshot
  subscribePing: (listener: (pingMs: number) => void) => () => void
  subscribeEnemyEvent: (listener: (event: BoneyardEnemyEventSnapshot) => void) => () => void
  subscribe: (listener: (snapshot: GameSnapshot) => void) => () => void
}

interface BoneyardFrameDiagnostics {
  frameCount: number
  modEffectCount: number
  painterBandCount: number
  playerScreenX: number
  playerScreenY: number
  playerWalkPose: number
  solomonFrame: number
  staticPaintCount: number
}

type RendererState = 'loading' | 'ready'

export default function BoneyardScene({
  accountUsername,
  audio,
  boneyard: loaded,
  getPingMs,
  initialSnapshot,
  inputBlocked,
  inventoryRequestSequence,
  modAssets,
  modCatalog,
  levelUpPresentationId,
  onInput,
  onLoadingError,
  onHubAction,
  onInventoryOpenChange,
  onOpenSkills,
  onPauseRequest,
  onReady,
  playerId,
  progression,
  presentationPaused,
  samplePresentation,
  subscribeEnemyEvent,
  subscribePing,
  subscribe,
}: BoneyardSceneProps) {
  const [boneyardInitialSnapshot] = useState<BoneyardGameSnapshot>(() => {
    if (!isBoneyardGameSnapshot(initialSnapshot)) {
      throw new Error('Boneyard scene requires a Boneyard snapshot')
    }
    return initialSnapshot
  })
  const [inventorySurface, setInventorySurface] = useState<HubUiSurface>(null)
  const inventoryRequestRef = useRef(inventoryRequestSequence)
  const [economy, setEconomy] = useState<ProtocolPlayerEconomy>(
    boneyardInitialSnapshot.players[playerId]!.economy,
  )
  const [playerPosition, setPlayerPosition] = useState(
    boneyardInitialSnapshot.players[playerId]!.position,
  )
  const sceneInputBlocked = inputBlocked || inventorySurface !== null

  useEffect(() => {
    onInventoryOpenChange(inventorySurface?.kind === 'inventory')
  }, [inventorySurface?.kind, onInventoryOpenChange])

  const sceneRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const environmentLightCanvasRef = useRef<HTMLCanvasElement>(null)
  const digIndicatorRef = useRef<HTMLDivElement>(null)
  const digReceiptRef = useRef<HTMLSpanElement>(null)
  const rendererRef = useRef<BoneyardWorldRenderer | null>(null)
  const pendingEnemyPresentationEventsRef = useRef<BoneyardEnemyEventSnapshot[]>([])
  const inputRef = useRef<BrowserGameplayInput | null>(null)
  const lastVoiceEventRef = useRef({
    eventId: boneyardInitialSnapshot.world.encounter?.voiceEvents.at(-1)?.id ?? 0,
    runId: loaded.runId,
  })
  const digAudioCursorRef = useRef<SolomonDigAudioCursor | null>(null)
  const inputBlockedRef = useRef(sceneInputBlocked)
  const presentationPausedRef = useRef(presentationPaused)
  const levelUpPresentationIdRef = useRef(levelUpPresentationId)
  const onLoadingErrorRef = useRef(onLoadingError)
  const onReadyRef = useRef(onReady)
  inputBlockedRef.current = sceneInputBlocked
  presentationPausedRef.current = presentationPaused
  levelUpPresentationIdRef.current = levelUpPresentationId
  onLoadingErrorRef.current = onLoadingError
  onReadyRef.current = onReady
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
  const [run, setRun] = useState<GameRunLifecycleState>(boneyardInitialSnapshot.run)
  useEffect(() => {
    if (inventoryRequestRef.current === inventoryRequestSequence) return
    inventoryRequestRef.current = inventoryRequestSequence
    if (!inputBlocked && run.phase === 'active') {
      setInventorySurface({ kind: 'inventory' })
    }
  }, [inputBlocked, inventoryRequestSequence, run.phase])
  const deathEpochRef = useRef(
    boneyardInitialSnapshot.players[playerId]?.progression.deathEpoch ?? 0,
  )
  const [viewport, setViewport] = useState<GameViewportLayout>(() => (
    gameViewportLayout(1600, 900)
  ))
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
    const deathEpoch = snapshot.players[playerId]?.progression.deathEpoch ?? 0
    if (deathEpoch > deathEpochRef.current) audio.playStream('death-guitar')
    deathEpochRef.current = deathEpoch
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
        setEconomy((current) => current.revision === player.economy.revision
          ? current
          : player.economy)
        setPlayerPosition((current) => (
          current.x === player.position.x && current.y === player.position.y
            ? current
            : player.position
        ))
      }
    })
  }, [audio, boneyardInitialSnapshot, loaded.runId, playerId, subscribe])

  useEffect(() => {
    const openSkills = (event: KeyboardEvent) => {
      if (
        inputBlocked
        || run.phase !== 'active'
        || event.code !== 'KeyT'
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
  }, [inputBlocked, onOpenSkills, run.phase])

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
      ) return
      event.preventDefault()
      setDigIndicatorRunId((activeRunId) => (
        activeRunId === loaded.runId ? null : loaded.runId
      ))
    }
    window.addEventListener('keydown', toggleDigIndicator)
    return () => window.removeEventListener('keydown', toggleDigIndicator)
  }, [dig, loaded.runId, sceneInputBlocked])

  useEffect(() => {
    const openPause = (event: KeyboardEvent) => {
      if (
        sceneInputBlocked
        || run.phase !== 'active'
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
  }, [onPauseRequest, run.phase, sceneInputBlocked])

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
      mouseTarget: host,
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
    })
    input.setBlocked(inputBlockedRef.current)
    inputRef.current = input
    setRendererState('loading')
    setRendererError(null)
    setSpectatorStatus(null)

    const environmentLightPresentation = loaded.scene.environmentMode === 1
      || loaded.scene.environmentMode === 2
      ? loadBoneyardEnvironmentLightPresentation()
      : Promise.resolve(null)
    const rendererPromise = createBoneyardWorldRenderer({
      boneyard: loaded,
      initialSnapshot: boneyardInitialSnapshot,
      modAssets,
      modCatalog,
      playerId,
      viewport: viewportRef.current,
    })
    void Promise.all([
      rendererPromise,
      environmentLightPresentation,
    ]).then(([renderer, initialEnvironmentLight]) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      renderer.setLevelUpPresentation(levelUpPresentationIdRef.current)
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
      stopPresentationLoop = startGamePresentationLoop((now) => {
        if (presentationPausedRef.current) return
        const snapshot = samplePresentation(now)
        const camera = renderer.camera(snapshot)
        if (snapshot.run.phase === 'game-over') {
          setRun((current) => (
            current.phase === 'game-over'
              && current.gameOverTicks === snapshot.run.gameOverTicks
              && current.gameOverExitTicks === snapshot.run.gameOverExitTicks
              ? current
              : snapshot.run
          ))
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
            snapshot.world.encounter.digAudioEvents,
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
            nativeBoneyardWeatherArenaFade(snapshot.run.gameOverExitTicks),
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
        renderer.render(snapshot)
        const nextStatus = renderer.spectatorStatus(snapshot)
        setSpectatorStatus((current) => (
          boneyardSpectatorStatusesEqual(current, nextStatus) ? current : nextStatus
        ))
        const environmentLight = environmentLightCanvasRef.current
        if (environmentLight && initialEnvironmentLight) {
          paintBoneyardEnvironmentLight(
            environmentLight,
            snapshot.players,
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
    onInput,
    playerId,
    samplePresentation,
  ])

  const localPlayer = boneyardInitialSnapshot.players[playerId]
  const element = localPlayer?.config.element ?? 'ether'
  const discipline = localPlayer?.config.discipline ?? 'arcane'
  const gateLeaves = boneyardInitialSnapshot.world.gateLeaves
  const digIndicatorVisible = Boolean(dig && digIndicatorRunId === loaded.runId)

  return (
    <div
      ref={sceneRef}
      className="boneyard-scene"
      data-boneyard-id={loaded.choice.id}
      data-camera-zoom="1.35"
      data-discipline={discipline}
      data-element={element}
      data-environment-mode={loaded.scene.environmentMode}
      data-geometry-sha256={loaded.geometrySha256}
      data-gate-leaf-count={gateLeaves.length}
      data-gate-state={gateState(gateLeaves)}
      data-gameplay-input-blocked={sceneInputBlocked}
      data-local-player-x={localPlayer?.position.x}
      data-local-player-y={localPlayer?.position.y}
      data-presentation-paused={presentationPaused}
      data-renderer-state={rendererError ? 'error' : rendererState}
      data-run-id={loaded.runId}
      data-viewport-height={viewport.height}
      data-viewport-scale={viewport.displayScale}
      data-viewport-width={viewport.width}
      aria-label={`Boneyard: ${loaded.choice.name}. Move with W A S D, arrow keys, a controller, or the touch joystick.${dig ? ' Press H to toggle the Solomon Dig direction arrow.' : ''}`}
      tabIndex={0}
    >
      <div
        className="boneyard-native-frame"
        style={{
          height: viewport.height,
          transform: `scale(${viewport.displayScale})`,
          width: viewport.width,
        } satisfies CSSProperties}
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
          getPingMs={getPingMs}
          initialSnapshot={boneyardInitialSnapshot}
          mode="run"
          onInventoryClick={() => {
            if (!inputBlocked && run.phase === 'active') {
              setInventorySurface({ kind: 'inventory' })
            }
          }}
          onPotionClick={(itemId) => {
            if (!inputBlocked && run.phase === 'active') {
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
          onSkillsClick={() => {
            if (!inputBlocked && run.phase === 'active') {
              setInventorySurface(null)
              onOpenSkills()
            }
          }}
          playerId={playerId}
          progression={progression}
          subscribePing={subscribePing}
          subscribeSnapshot={subscribe}
        />
        <HubInventoryUi
          audio={audio}
          config={boneyardInitialSnapshot.players[playerId]!.config}
          disabled={inputBlocked || run.phase !== 'active'}
          economy={economy}
          modAssets={modAssets}
          onAction={onHubAction}
          onSurfaceChange={setInventorySurface}
          playerPosition={playerPosition}
          progression={progression}
          region="courtyard"
          surface={inventorySurface}
          tradersEnabled={false}
          transitionActive={false}
        />
        {spectatorStatus ? (
          <div
            className="boneyard-spectator-status"
            data-run-id={spectatorStatus.runId}
            data-target-player-id={spectatorStatus.targetPlayerId ?? ''}
            role="status"
            aria-atomic="true"
            aria-label={spectatorStatus.accessibleLabel}
            aria-live="polite"
          >
            <span>{spectatorStatus.title}</span>
            {spectatorStatus.instruction ? (
              <>
                <span className="boneyard-spectator-status-divider" aria-hidden>|</span>
                <span>{spectatorStatus.instruction}</span>
              </>
            ) : null}
          </div>
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
        />
        <TouchJoystick
          lane="primary"
          onInput={(direction) => inputRef.current?.setTouchPrimary(direction)}
        />

        {run.phase === 'game-over' && run.runId ? (
          <GameOverOverlay
            eventId={run.gameOverEventId}
            gameOverExitTicks={run.gameOverExitTicks}
            gameOverTicks={run.gameOverTicks}
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
  scene.dataset.solomonPhase = encounter?.phase ?? 'absent'
  scene.dataset.solomonRunEventId = `${encounter?.runEventId ?? 0}`
  scene.dataset.solomonVoiceCue = latestVoiceEvent?.cue ?? 'none'
  scene.dataset.solomonVoiceEventId = `${latestVoiceEvent?.id ?? 0}`
  if (encounter) {
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
