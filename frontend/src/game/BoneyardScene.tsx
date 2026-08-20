import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import { spriteImage } from '../editor/assets.ts'
import { worldToScreen, type Camera } from '../editor/render.ts'
import { boneyard } from '../lib/assets.ts'
import {
  boneyardDigIndicatorLayout,
  SOLOMON_DIG_HOTKEY_CODE,
} from './boneyard-dig-indicator.ts'
import { BoneyardEnemyAmbientAudioSynchronizer } from './boneyard-enemy-ambient-audio.ts'
import { BONEYARD_SOLOMON_VOICE_CUES } from './core-kernels/boneyard-encounter.ts'
import type { PlayerCharacterInput } from './core-kernels/player-character.ts'
import {
  isBoneyardGameSnapshot,
  type BoneyardGameSnapshot,
} from './client/boneyard-presentation-timeline.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import {
  nativeBoneyardPointGain,
  nativeEnemyEventSoundRequest,
  newSolomonVoiceEvent,
} from './game-audio-native.ts'
import { startGamePresentationLoop } from './game-presentation-frame-loop.ts'
import GameHud from './GameHud.tsx'
import GameOverOverlay from './GameOverOverlay.tsx'
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
  BoneyardEnemyEventSnapshot,
  GameSnapshot,
  LoadedBoneyard,
} from './protocol/game-protocol.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import type { GameRunLifecycleState } from './core-kernels/game-run.ts'
import { PlayerFootstepAudioSynchronizer } from './player-footstep-audio.ts'
import {
  createBoneyardWorldRenderer,
  type BoneyardWorldRenderer,
} from './renderer/boneyard-world-renderer.ts'
import {
  boneyardSpectatorStatusesEqual,
  type BoneyardSpectatorStatusPresentation,
} from './renderer/boneyard-render-contract.ts'
import {
  gameViewportLayout,
  type GameViewportLayout,
} from './renderer/game-viewport.ts'
import { initialHubResolution } from './renderer/hub-render-contract.ts'
import './hub.css'
import './boneyard.css'

const NATIVE_DARKNESS_TARGET_EXTENT = 256 * 2.025
const NATIVE_DARKNESS_MAX_ALPHA = 0.96
const grayscaleAlphaMasks = new WeakMap<HTMLImageElement, HTMLCanvasElement>()

interface BoneyardSceneProps {
  accountUsername: string | null
  audio: GameAudioDirector
  boneyard: LoadedBoneyard
  getPingMs: () => number | null
  initialSnapshot: GameSnapshot
  inputBlocked: boolean
  levelUpModalActive: boolean
  levelUpPresentationId: number | null
  onInput: (input: PlayerCharacterInput) => void
  onLoadingError: () => void
  onReady: () => void
  playerId: string
  progression: ProtocolPlayerProgression
  samplePresentation: (nowMs?: number) => GameSnapshot
  subscribePing: (listener: (pingMs: number) => void) => () => void
  subscribeEnemyEvent: (listener: (event: BoneyardEnemyEventSnapshot) => void) => () => void
  subscribe: (listener: (snapshot: GameSnapshot) => void) => () => void
}

interface BoneyardFrameDiagnostics {
  frameCount: number
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
  levelUpModalActive,
  levelUpPresentationId,
  onInput,
  onLoadingError,
  onReady,
  playerId,
  progression,
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
  const sceneRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const darknessCanvasRef = useRef<HTMLCanvasElement>(null)
  const digIndicatorRef = useRef<HTMLDivElement>(null)
  const digReceiptRef = useRef<HTMLSpanElement>(null)
  const rendererRef = useRef<BoneyardWorldRenderer | null>(null)
  const pendingEnemyPresentationEventsRef = useRef<BoneyardEnemyEventSnapshot[]>([])
  const inputRef = useRef<BrowserGameplayInput | null>(null)
  const lastVoiceEventRef = useRef({
    eventId: boneyardInitialSnapshot.world.encounter?.voiceEvents.at(-1)?.id ?? 0,
    runId: loaded.runId,
  })
  const inputBlockedRef = useRef(inputBlocked)
  const levelUpModalActiveRef = useRef(levelUpModalActive)
  const levelUpPresentationIdRef = useRef(levelUpPresentationId)
  const onLoadingErrorRef = useRef(onLoadingError)
  const onReadyRef = useRef(onReady)
  inputBlockedRef.current = inputBlocked
  levelUpModalActiveRef.current = levelUpModalActive
  levelUpPresentationIdRef.current = levelUpPresentationId
  onLoadingErrorRef.current = onLoadingError
  onReadyRef.current = onReady
  const [rendererState, setRendererState] = useState<RendererState>('loading')
  const [rendererError, setRendererError] = useState<string | null>(null)
  const [spectatorStatus, setSpectatorStatus] =
    useState<BoneyardSpectatorStatusPresentation | null>(null)
  const [run, setRun] = useState<GameRunLifecycleState>(boneyardInitialSnapshot.run)
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
    setRun((current) => (
      snapshot.run.phase === 'game-over' && current.phase === 'game-over'
        ? current
        : snapshot.run
    ))
    const deathEpoch = snapshot.players[playerId]?.progression.deathEpoch ?? 0
    if (deathEpoch > deathEpochRef.current) audio.playStream('death-guitar')
    deathEpochRef.current = deathEpoch
  }), [audio, playerId, subscribe])

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
      const spatialGain = camera
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
    })
  }, [audio, boneyardInitialSnapshot, loaded.runId, playerId, subscribe])

  useEffect(() => {
    const toggleDigIndicator = (event: KeyboardEvent) => {
      if (
        inputBlocked
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
  }, [dig, inputBlocked, loaded.runId])

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
    inputRef.current?.setBlocked(inputBlocked)
  }, [inputBlocked])

  useLayoutEffect(() => {
    rendererRef.current?.setLevelUpPresentation(
      levelUpPresentationId,
      levelUpModalActive,
    )
  }, [levelUpModalActive, levelUpPresentationId])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let stopPresentationLoop: (() => void) | null = null
    const enemyAmbientAudio = new BoneyardEnemyAmbientAudioSynchronizer(audio)
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

    void createBoneyardWorldRenderer({
      boneyard: loaded,
      initialSnapshot: boneyardInitialSnapshot,
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
      const pendingEnemyEvents = pendingEnemyPresentationEventsRef.current
      pendingEnemyPresentationEventsRef.current = []
      for (const event of pendingEnemyEvents) {
        if (event.runId === loaded.runId) renderer.consumeEnemyEvent(event)
      }
      host.replaceChildren(renderer.canvas)
      renderer.resize(viewportRef.current)
      setRendererState('ready')
      onReadyRef.current()
      stopPresentationLoop = startGamePresentationLoop((now) => {
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
        }
        if (isBoneyardGameSnapshot(snapshot)) {
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
        const darkness = darknessCanvasRef.current
        if (darkness) {
          paintDarkness(darkness, snapshot, camera, viewportRef.current, now)
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
      audio.stopStreams(BONEYARD_SOLOMON_VOICE_CUES)
      input.destroy()
      inputRef.current = null
      pendingEnemyPresentationEventsRef.current = []
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [audio, boneyardInitialSnapshot, digPosition, loaded, onInput, playerId, samplePresentation])

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
      data-local-player-x={localPlayer?.position.x}
      data-local-player-y={localPlayer?.position.y}
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
            ref={darknessCanvasRef}
            className="boneyard-darkness"
            data-max-alpha={NATIVE_DARKNESS_MAX_ALPHA}
            data-native-mask="DeadHawg:18+9"
            aria-hidden
          />
        ) : null}

        <GameHud
          accountUsername={accountUsername}
          element={element}
          getPingMs={getPingMs}
          initialSnapshot={boneyardInitialSnapshot}
          mode="run"
          playerId={playerId}
          progression={progression}
          subscribePing={subscribePing}
          subscribeSnapshot={subscribe}
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

function paintDarkness(
  canvas: HTMLCanvasElement,
  snapshot: GameSnapshot,
  camera: Camera,
  viewport: GameViewportLayout,
  now: number,
): void {
  const dpr = window.devicePixelRatio || 1
  const resolution = initialHubResolution({
    devicePixelRatio: dpr,
    displayScale: viewport.displayScale,
  })
  const width = Math.round(viewport.width * resolution)
  const height = Math.round(viewport.height * resolution)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  if (!context) return
  const aperture = spriteImage(boneyard.darknessAperture)
  const radial = spriteImage(boneyard.darknessRadial)
  context.setTransform(resolution, 0, 0, resolution, 0, 0)
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
  context.clearRect(0, 0, viewport.width, viewport.height)
  context.globalCompositeOperation = 'lighter'
  if (aperture.complete && aperture.naturalWidth > 0) {
    Object.values(snapshot.players).forEach((player, index) => {
      const position = worldToScreen(
        player.position,
        camera,
        viewport.width,
        viewport.height,
      )
      context.globalAlpha = nativeDirectApertureAlpha(now, index)
      context.drawImage(
        aperture,
        position.x - 168 * camera.zoom,
        position.y - 153 * camera.zoom,
        aperture.naturalWidth * camera.zoom,
        aperture.naturalHeight * camera.zoom,
      )
    })
  }
  const radialMask = grayscaleAlphaMask(radial)
  if (radialMask) {
    Object.values(snapshot.players).forEach((player, index) => {
      const position = worldToScreen(
        player.position,
        camera,
        viewport.width,
        viewport.height,
      )
      const extent = NATIVE_DARKNESS_TARGET_EXTENT * camera.zoom
      context.globalAlpha = nativeTargetApertureAlpha(now, index)
      context.drawImage(
        radialMask,
        position.x - extent / 2,
        position.y - extent / 2,
        extent,
        extent,
      )
    })
  }
  context.globalAlpha = NATIVE_DARKNESS_MAX_ALPHA
  context.globalCompositeOperation = 'source-out'
  context.fillStyle = '#000'
  context.fillRect(0, 0, viewport.width, viewport.height)
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

function nativeDirectApertureAlpha(now: number, playerIndex: number): number {
  const flicker = (Math.sin(now * 0.017 + playerIndex * 2.399) + 1) / 2
  return 0.2375 + flicker * 0.0125
}

function nativeTargetApertureAlpha(now: number, playerIndex: number): number {
  const flicker = (Math.sin(now * 0.013 + playerIndex * 3.117 + 1.703) + 1) / 2
  return 0.95 + flicker * 0.05
}

function grayscaleAlphaMask(image: HTMLImageElement): HTMLCanvasElement | null {
  if (!image.complete || image.naturalWidth === 0) return null
  const cached = grayscaleAlphaMasks.get(image)
  if (cached) return cached

  const mask = document.createElement('canvas')
  mask.width = image.naturalWidth
  mask.height = image.naturalHeight
  const context = mask.getContext('2d')
  if (!context) return null
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, mask.width, mask.height)
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    pixels.data[offset + 3] = Math.round(
      (pixels.data[offset] * pixels.data[offset + 3]) / 255,
    )
  }
  context.putImageData(pixels, 0, 0)
  grayscaleAlphaMasks.set(image, mask)
  return mask
}
