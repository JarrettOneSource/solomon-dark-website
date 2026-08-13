import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import { BONEYARD_SPRITE_SOURCES, spriteImage } from '../editor/assets'
import type { EditorDoc } from '../editor/model'
import { nativeGatePainterRoot } from '../editor/native-fence-geometry.ts'
import type { MainLayer } from '../editor/native-render-plan.ts'
import {
  drawNativeBoneyardBase,
  drawNativeBoneyardForeground,
  drawNativeBoneyardMainBand,
  nativeBoneyardMainLayers,
  STAGE_TEXTURES,
  worldToScreen,
  type Camera,
} from '../editor/render'
import { boneyard } from '../lib/assets'
import {
  buildBoneyardPainterOrder,
  type PositionedDynamicLayer,
} from './boneyard-painter-order.ts'
import type { BoneyardGateLeafSnapshot } from './core-kernels/boneyard.ts'
import GameHud from './GameHud'
import PlayerCharacter from './PlayerCharacter.tsx'
import type { PlayerCharacterInput } from './core-kernels/player-character.ts'
import type { GameSnapshot, LoadedBoneyard } from './protocol/game-protocol'
import './hub.css'
import './boneyard.css'

const STAGE_WIDTH = 1600
const STAGE_HEIGHT = 900
const NATIVE_BONEYARD_CAMERA_ZOOM = 1.35
const NATIVE_DARKNESS_TARGET_EXTENT = 256 * 2.025
const NATIVE_DARKNESS_MAX_ALPHA = 0.96
const grayscaleAlphaMasks = new WeakMap<HTMLImageElement, HTMLCanvasElement>()

interface BoneyardSceneProps {
  boneyard: LoadedBoneyard
  initialSnapshot: GameSnapshot
  onInput: (input: PlayerCharacterInput) => void
  playerId: string
}

export default function BoneyardScene({
  boneyard: loaded,
  initialSnapshot,
  onInput,
  playerId,
}: BoneyardSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement>(null)
  const foregroundCanvasRef = useRef<HTMLCanvasElement>(null)
  const mainBandCanvasRefs = useRef(new Map<string, HTMLCanvasElement>())
  const basePaintStateRef = useRef<{ camera: Camera; document: EditorDoc } | null>(null)
  const foregroundPaintStateRef = useRef<{ camera: Camera; document: EditorDoc } | null>(null)
  const darknessCanvasRef = useRef<HTMLCanvasElement>(null)
  const digRef = useRef<HTMLSpanElement>(null)
  const keysRef = useRef(new Set<string>())
  const [stageScale, setStageScale] = useState(1)
  const snapshot = initialSnapshot
  const gateLeaves = useMemo(() => (
    snapshot.world.kind === 'boneyard'
      && snapshot.world.runId === loaded.runId
      ? snapshot.world.gateLeaves
      : []
  ), [loaded.runId, snapshot.world])
  const document = useMemo(() => editorDocument(loaded), [loaded])
  const mainLayers = useMemo(() => nativeBoneyardMainLayers(document), [document])
  const localPlayer = snapshot.players[playerId]
  const dig = loaded.scene.solomonDig
  const cameraPosition = localPlayer?.position ?? loaded.scene.spawn
  const cameraX = clampCameraAxis(
    cameraPosition.x,
    loaded.scene.bounds.x,
    loaded.scene.bounds.w,
    STAGE_WIDTH / 2 / NATIVE_BONEYARD_CAMERA_ZOOM,
  )
  const cameraY = clampCameraAxis(
    cameraPosition.y,
    loaded.scene.bounds.y,
    loaded.scene.bounds.h,
    STAGE_HEIGHT / 2 / NATIVE_BONEYARD_CAMERA_ZOOM,
  )
  const camera = useMemo<Camera>(
    () => ({ x: cameraX, y: cameraY, zoom: NATIVE_BONEYARD_CAMERA_ZOOM }),
    [cameraX, cameraY],
  )
  const painterOrder = useMemo(() => {
    const dynamicLayers = Object.entries(snapshot.players).map(([id, player], sourceOrder) => ({
      id: `player:${id}`,
      worldY: player.position.y,
      sortBias: 0,
      sourceOrder,
    }))
    if (dig) {
      dynamicLayers.push({
        id: 'solomon-dig',
        worldY: dig.position.y,
        sortBias: 0,
        sourceOrder: dynamicLayers.length,
      })
      dynamicLayers.push({
        id: 'lantern',
        worldY: dig.lanternPosition.y,
        sortBias: 0,
        sourceOrder: dynamicLayers.length,
      })
    }
    return buildBoneyardPainterOrder({
      referenceY: cameraPosition.y,
      staticLayers: mainLayers.map((layer, layerIndex) => ({
        layerIndex,
        worldY: runtimeMainWorldY(layer, gateLeaves),
        sortBias: layer.sortBias,
        sourceOrder: layer.sourceOrder,
      })),
      dynamicLayers,
    })
  }, [cameraPosition.y, dig, gateLeaves, mainLayers, snapshot.players])
  const dynamicPainterLayers = useMemo<Map<string, PositionedDynamicLayer>>(
    () => new Map(painterOrder.dynamicLayers.map((layer) => [layer.id, layer])),
    [painterOrder.dynamicLayers],
  )

  useLayoutEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const updateScale = () => setStageScale(scene.clientWidth / STAGE_WIDTH)
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(scene)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const movementKeys = new Set([
      'arrowdown', 'arrowleft', 'arrowright', 'arrowup', 'a', 'd', 's', 'w',
    ])
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (!movementKeys.has(key)) return
      event.preventDefault()
      keysRef.current.add(key)
    }
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (!movementKeys.has(key)) return
      event.preventDefault()
      keysRef.current.delete(key)
    }
    const blur = () => keysRef.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    let frame = 0
    const animate = (now: number) => {
      const keys = keysRef.current
      onInput({
        movement: {
          x: Number(keys.has('d') || keys.has('arrowright'))
            - Number(keys.has('a') || keys.has('arrowleft')),
          y: Number(keys.has('s') || keys.has('arrowdown'))
            - Number(keys.has('w') || keys.has('arrowup')),
        },
      })
      const dig = loaded.scene.solomonDig
      if (dig && digRef.current) {
        const program = dig.frameProgram
        const frameTicks = Math.floor(now / 10 / dig.ticksPerFrame)
        const digFrame = program[frameTicks % program.length]
        digRef.current.style.backgroundPosition = `${-digFrame * 200}px 0`
        digRef.current.dataset.frame = `${digFrame}`
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [loaded, onInput])

  useEffect(() => {
    const baseCanvas = baseCanvasRef.current
    const foregroundCanvas = foregroundCanvasRef.current
    if (!baseCanvas || !foregroundCanvas) return
    const dpr = window.devicePixelRatio || 1
    const pixelWidth = Math.round(STAGE_WIDTH * dpr)
    const pixelHeight = Math.round(STAGE_HEIGHT * dpr)
    const needsResize = (canvas: HTMLCanvasElement) => (
      canvas.width !== pixelWidth || canvas.height !== pixelHeight
    )
    const contextFor = (canvas: HTMLCanvasElement, alpha: boolean) => {
      if (needsResize(canvas)) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
      const context = canvas.getContext('2d', { alpha })
      context?.setTransform(dpr, 0, 0, dpr, 0, 0)
      return context
    }
    const paint = (forceStatic = false) => {
      const baseState = basePaintStateRef.current
      if (
        forceStatic
        || needsResize(baseCanvas)
        || baseState?.camera !== camera
        || baseState?.document !== document
      ) {
        const baseContext = contextFor(baseCanvas, false)
        if (!baseContext) return
        drawNativeBoneyardBase(
          baseContext,
          STAGE_WIDTH,
          STAGE_HEIGHT,
          camera,
          document,
        )
        basePaintStateRef.current = { camera, document }
      }
      for (const band of painterOrder.bands) {
        const canvas = mainBandCanvasRefs.current.get(band.id)
        if (!canvas) continue
        const context = contextFor(canvas, true)
        if (!context) continue
        drawNativeBoneyardMainBand(
          context,
          STAGE_WIDTH,
          STAGE_HEIGHT,
          camera,
          document,
          band.layerIndexes,
          gateLeaves,
        )
      }
      const foregroundState = foregroundPaintStateRef.current
      if (
        forceStatic
        || needsResize(foregroundCanvas)
        || foregroundState?.camera !== camera
        || foregroundState?.document !== document
      ) {
        const foregroundContext = contextFor(foregroundCanvas, true)
        if (!foregroundContext) return
        drawNativeBoneyardForeground(
          foregroundContext,
          STAGE_WIDTH,
          STAGE_HEIGHT,
          camera,
          document,
        )
        foregroundPaintStateRef.current = { camera, document }
      }
    }
    paint()
    let paintFrame = 0
    const queuePaint = () => {
      if (paintFrame) return
      paintFrame = requestAnimationFrame(() => {
        paintFrame = 0
        paint(true)
      })
    }
    const pendingImages: HTMLImageElement[] = []
    for (const source of [...BONEYARD_SPRITE_SOURCES, ...STAGE_TEXTURES]) {
      const image = spriteImage(source)
      if (image.complete && image.naturalWidth > 0) continue
      pendingImages.push(image)
      image.addEventListener('load', queuePaint)
    }
    return () => {
      if (paintFrame) cancelAnimationFrame(paintFrame)
      for (const image of pendingImages) image.removeEventListener('load', queuePaint)
    }
  }, [camera, document, gateLeaves, painterOrder.bands])

  useEffect(() => {
    const canvas = darknessCanvasRef.current
    if (!canvas || (loaded.scene.environmentMode !== 1 && loaded.scene.environmentMode !== 2)) {
      return
    }
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(STAGE_WIDTH * dpr)
    canvas.height = Math.round(STAGE_HEIGHT * dpr)
    const context = canvas.getContext('2d')
    if (!context) return
    const aperture = spriteImage(boneyard.darknessAperture)
    const radial = spriteImage(boneyard.darknessRadial)
    let frame = 0
    const paint = (now: number) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      context.globalCompositeOperation = 'lighter'
      if (aperture.complete && aperture.naturalWidth > 0) {
        Object.values(snapshot.players).forEach((player, index) => {
          const position = worldToScreen(
            player.position,
            camera,
            STAGE_WIDTH,
            STAGE_HEIGHT,
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
            STAGE_WIDTH,
            STAGE_HEIGHT,
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
      context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
      frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  }, [camera, loaded.scene.environmentMode, snapshot.players])

  const frameStyle = { transform: `scale(${stageScale})` } as CSSProperties
  const element = localPlayer?.config.element ?? 'ether'
  const discipline = localPlayer?.config.discipline ?? 'arcane'
  const digScreen = dig
    ? worldToScreen(dig.position, camera, STAGE_WIDTH, STAGE_HEIGHT)
    : null
  const graveScreen = dig
    ? worldToScreen(dig.gravePosition, camera, STAGE_WIDTH, STAGE_HEIGHT)
    : null
  const lanternScreen = dig
    ? worldToScreen(dig.lanternPosition, camera, STAGE_WIDTH, STAGE_HEIGHT)
    : null
  const solomonPainter = dynamicPainterLayers.get('solomon-dig')
  const lanternPainter = dynamicPainterLayers.get('lantern')

  return (
    <div
      ref={sceneRef}
      className="boneyard-scene"
      data-boneyard-id={loaded.choice.id}
      data-camera-zoom={camera.zoom}
      data-discipline={discipline}
      data-element={element}
      data-environment-mode={loaded.scene.environmentMode}
      data-geometry-sha256={loaded.geometrySha256}
      data-gate-leaf-count={gateLeaves.length}
      data-gate-state={gateLeaves.map((leaf) => (
        `${leaf.id}:${leaf.tip.x.toFixed(3)},${leaf.tip.y.toFixed(3)}`
      )).join('|')}
      data-local-player-x={localPlayer?.position.x}
      data-local-player-y={localPlayer?.position.y}
      data-painter-band-count={painterOrder.bands.length}
      data-run-id={loaded.runId}
      aria-label={`Boneyard: ${loaded.choice.name}. Move with W A S D or the arrow keys.`}
      tabIndex={0}
    >
      <div className="boneyard-native-frame" style={frameStyle}>
        <div className="boneyard-world-stack">
          <canvas
            ref={baseCanvasRef}
            className="boneyard-canvas"
            data-painter-layer="base"
            aria-hidden
          />
          {painterOrder.bands.map((band) => (
            <canvas
              key={band.id}
              ref={(canvas) => {
                if (canvas) mainBandCanvasRefs.current.set(band.id, canvas)
                else mainBandCanvasRefs.current.delete(band.id)
              }}
              className="boneyard-main-band"
              data-main-layer-count={band.layerIndexes.length}
              data-painter-layer="main"
              data-painter-row={band.row}
              style={{ zIndex: band.zIndex }}
              aria-hidden
            />
          ))}
          {dig && digScreen && graveScreen && lanternScreen ? (
            <>
              <span
                className="boneyard-grave-dirt"
                data-world-x={dig.gravePosition.x}
                data-world-y={dig.gravePosition.y}
                style={{
                  backgroundImage: `url("${boneyard.graveDirt}")`,
                  left: graveScreen.x - 16 * camera.zoom,
                  top: graveScreen.y + 105 * camera.zoom,
                  transform: `scale(${camera.zoom})`,
                  transformOrigin: '0 0',
                  zIndex: solomonPainter?.zIndex,
                }}
                data-painter-row={solomonPainter?.row}
                aria-hidden
              />
              <span
                className="boneyard-lantern"
                data-world-x={dig.lanternPosition.x}
                data-world-y={dig.lanternPosition.y}
                style={{
                  backgroundImage: `url("${boneyard.lantern}")`,
                  left: lanternScreen.x - 14.5 * camera.zoom,
                  top: lanternScreen.y - 22.5 * camera.zoom,
                  transform: `scale(${camera.zoom})`,
                  transformOrigin: '0 0',
                  zIndex: lanternPainter?.zIndex,
                }}
                data-painter-row={lanternPainter?.row}
                aria-hidden
              />
              <span
                className="boneyard-dig-anchor"
                data-world-x={dig.position.x}
                data-world-y={dig.position.y}
                style={{
                  left: digScreen.x,
                  top: digScreen.y,
                  transform: `scale(${camera.zoom})`,
                  transformOrigin: '0 0',
                  zIndex: solomonPainter?.zIndex,
                }}
                data-painter-row={solomonPainter?.row}
              >
                <span
                  ref={digRef}
                  className="boneyard-solomon-dig"
                  style={{ backgroundImage: `url("${boneyard.solomonDig}")` }}
                  role="img"
                  aria-label="Solomon Dig"
                />
              </span>
            </>
          ) : null}
          {Object.entries(snapshot.players).map(([id, player]) => (
            <PlayerCharacter
              key={id}
              className="boneyard-player"
              depth={dynamicPainterLayers.get(`player:${id}`)?.zIndex ?? 1}
              isLocal={id === playerId}
              painterRow={dynamicPainterLayers.get(`player:${id}`)?.row}
              playerId={id}
              scale={camera.zoom}
              state={{
                ...player,
                position: worldToScreen(player.position, camera, STAGE_WIDTH, STAGE_HEIGHT),
              }}
            />
          ))}
          <canvas
            ref={foregroundCanvasRef}
            className="boneyard-foreground"
            data-painter-layer="foreground"
            style={{ zIndex: painterOrder.foregroundZIndex }}
            aria-hidden
          />
        </div>
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
      </div>
    </div>
  )
}

function runtimeMainWorldY(
  layer: MainLayer,
  gateLeaves: readonly BoneyardGateLeafSnapshot[],
): number {
  if (
    layer.kind !== 'fence'
    || layer.part !== 'body'
    || (layer.fence.segmentCode ?? layer.fence.style ?? 0) !== 2
  ) {
    return layer.worldY
  }
  const leaf = gateLeaves.find((candidate) => (
    candidate.fenceEid === layer.fence.eid && candidate.side === layer.pieceIndex
  ))
  return leaf ? nativeGatePainterRoot(leaf.hinge, leaf.tip).y : layer.worldY
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

function clampCameraAxis(position: number, start: number, size: number, halfView: number): number {
  if (size <= halfView * 2) return start + size / 2
  return Math.min(start + size - halfView, Math.max(start + halfView, position))
}

function editorDocument(loaded: LoadedBoneyard): EditorDoc {
  const scene = loaded.scene
  return {
    meta: { name: scene.name, bounds: { ...scene.bounds } },
    objects: scene.objects.map((object) => ({ ...object, pos: { ...object.pos } })),
    sprites: scene.sprites.map((sprite) => ({ ...sprite, pos: { ...sprite.pos } })),
    roads: scene.roads.map((road) => ({
      ...road,
      points: road.points.map((point) => ({ ...point })),
      ...(road.quad ? { quad: road.quad.map((point) => ({ ...point })) } : {}),
    })),
    fences: scene.fences.map((fence) => ({
      ...fence,
      points: fence.points.map((point) => ({ ...point })),
    })),
    terrain: scene.terrain.map(({ points, ...terrain }) => ({
      ...terrain,
      ...(points
        ? { points: points.map((point) => ({ ...point })) }
        : {}),
    })),
    opaque: [],
    hasTimeline: false,
    spawn: { ...scene.spawn },
  }
}
