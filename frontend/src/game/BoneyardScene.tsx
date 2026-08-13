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
import type { PlayerCharacterInput } from './core-kernels/player-character.ts'
import GameHud from './GameHud.tsx'
import HubTouchJoystick from './input/HubTouchJoystick.tsx'
import {
  createBrowserMovementInput,
  type BrowserMovementInput,
} from './input/movement-input.ts'
import type { GameSnapshot, LoadedBoneyard } from './protocol/game-protocol.ts'
import {
  BONEYARD_RENDER_HEIGHT,
  BONEYARD_RENDER_WIDTH,
} from './renderer/boneyard-render-contract.ts'
import {
  createBoneyardWorldRenderer,
  type BoneyardWorldRenderer,
} from './renderer/boneyard-world-renderer.ts'
import { hubDisplayScale } from './renderer/hub-render-contract.ts'
import './hub.css'
import './boneyard.css'

const NATIVE_DARKNESS_TARGET_EXTENT = 256 * 2.025
const NATIVE_DARKNESS_MAX_ALPHA = 0.96
const grayscaleAlphaMasks = new WeakMap<HTMLImageElement, HTMLCanvasElement>()

interface BoneyardSceneProps {
  boneyard: LoadedBoneyard
  initialSnapshot: GameSnapshot
  onInput: (input: PlayerCharacterInput) => void
  playerId: string
  samplePresentation: (nowMs?: number) => GameSnapshot
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
  boneyard: loaded,
  initialSnapshot,
  onInput,
  playerId,
  samplePresentation,
}: BoneyardSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const darknessCanvasRef = useRef<HTMLCanvasElement>(null)
  const digReceiptRef = useRef<HTMLSpanElement>(null)
  const rendererRef = useRef<BoneyardWorldRenderer | null>(null)
  const inputRef = useRef<BrowserMovementInput | null>(null)
  const [rendererState, setRendererState] = useState<RendererState>('loading')
  const [rendererError, setRendererError] = useState<string | null>(null)
  const [frameTransform, setFrameTransform] = useState<CSSProperties>()

  useLayoutEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const resize = () => {
      const scale = hubDisplayScale(scene.clientWidth, scene.clientHeight)
      const left = (scene.clientWidth - BONEYARD_RENDER_WIDTH * scale) / 2
      const top = (scene.clientHeight - BONEYARD_RENDER_HEIGHT * scale) / 2
      setFrameTransform({
        transform: `translate3d(${left}px, ${top}px, 0) scale(${scale})`,
      })
      rendererRef.current?.resize(scale)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(scene)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let animationFrame = 0
    const input = createBrowserMovementInput()
    inputRef.current = input
    setRendererState('loading')
    setRendererError(null)

    void createBoneyardWorldRenderer({
      boneyard: loaded,
      host,
      initialSnapshot,
      playerId,
    }).then((renderer) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      host.replaceChildren(renderer.canvas)
      const scene = sceneRef.current
      renderer.resize(scene
        ? hubDisplayScale(scene.clientWidth, scene.clientHeight)
        : 1)
      setRendererState('ready')
      const animate = (now: number) => {
        const snapshot = samplePresentation(now)
        const movement = input.sample().movement
        onInput({ movement })
        renderer.render(snapshot)
        const camera = renderer.camera(snapshot)
        const darkness = darknessCanvasRef.current
        if (darkness) paintDarkness(darkness, snapshot, camera, now)
        publishSceneDiagnostics(
          sceneRef.current,
          renderer.canvas,
          digReceiptRef.current,
          snapshot,
          playerId,
        )
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
      onInput({ movement: { x: 0, y: 0 } })
      input.destroy()
      inputRef.current = null
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [initialSnapshot, loaded, onInput, playerId, samplePresentation])

  const localPlayer = initialSnapshot.players[playerId]
  const element = localPlayer?.config.element ?? 'ether'
  const discipline = localPlayer?.config.discipline ?? 'arcane'
  const gateLeaves = initialSnapshot.world.kind === 'boneyard'
    ? initialSnapshot.world.gateLeaves
    : []
  const dig = loaded.scene.solomonDig

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
      aria-label={`Boneyard: ${loaded.choice.name}. Move with W A S D, arrow keys, a controller, or the touch joystick.`}
      tabIndex={0}
    >
      <div className="boneyard-native-frame" style={frameTransform}>
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

        <GameHud element={element} mode="run" />
        <HubTouchJoystick onInput={(movement) => inputRef.current?.setTouch(movement)} />

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

function paintDarkness(
  canvas: HTMLCanvasElement,
  snapshot: GameSnapshot,
  camera: Camera,
  now: number,
): void {
  const dpr = window.devicePixelRatio || 1
  const width = Math.round(BONEYARD_RENDER_WIDTH * dpr)
  const height = Math.round(BONEYARD_RENDER_HEIGHT * dpr)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  if (!context) return
  const aperture = spriteImage(boneyard.darknessAperture)
  const radial = spriteImage(boneyard.darknessRadial)
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
  context.clearRect(0, 0, BONEYARD_RENDER_WIDTH, BONEYARD_RENDER_HEIGHT)
  context.globalCompositeOperation = 'lighter'
  if (aperture.complete && aperture.naturalWidth > 0) {
    Object.values(snapshot.players).forEach((player, index) => {
      const position = worldToScreen(
        player.position,
        camera,
        BONEYARD_RENDER_WIDTH,
        BONEYARD_RENDER_HEIGHT,
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
        BONEYARD_RENDER_WIDTH,
        BONEYARD_RENDER_HEIGHT,
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
  context.fillRect(0, 0, BONEYARD_RENDER_WIDTH, BONEYARD_RENDER_HEIGHT)
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
  if (digReceipt && diagnostics) digReceipt.dataset.frame = `${diagnostics.solomonFrame}`
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
