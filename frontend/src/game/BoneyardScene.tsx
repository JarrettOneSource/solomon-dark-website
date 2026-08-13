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
import {
  drawNativeBoneyardWorld,
  STAGE_TEXTURES,
  worldToScreen,
  type Camera,
} from '../editor/render'
import { boneyard } from '../lib/assets'
import GameHud from './GameHud'
import PlayerCharacter from './PlayerCharacter.tsx'
import type { PlayerCharacterInput } from './core-kernels/player-character.ts'
import type { GameSnapshot, LoadedBoneyard } from './protocol/game-protocol'
import './hub.css'
import './boneyard.css'

const STAGE_WIDTH = 1600
const STAGE_HEIGHT = 900

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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const digRef = useRef<HTMLSpanElement>(null)
  const keysRef = useRef(new Set<string>())
  const [stageScale, setStageScale] = useState(1)
  const snapshot = initialSnapshot
  const document = useMemo(() => editorDocument(loaded), [loaded])
  const localPlayer = snapshot.players[playerId]
  const cameraPosition = localPlayer?.position ?? loaded.scene.spawn
  const cameraX = clampCameraAxis(
    cameraPosition.x,
    loaded.scene.bounds.x,
    loaded.scene.bounds.w,
    STAGE_WIDTH / 2,
  )
  const cameraY = clampCameraAxis(
    cameraPosition.y,
    loaded.scene.bounds.y,
    loaded.scene.bounds.h,
    STAGE_HEIGHT / 2,
  )
  const camera = useMemo<Camera>(() => ({ x: cameraX, y: cameraY, zoom: 1 }), [
    cameraX,
    cameraY,
  ])

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
      const program = loaded.scene.solomonDig.frameProgram
      const frameTicks = Math.floor(now / 10 / loaded.scene.solomonDig.ticksPerFrame)
      const digFrame = program[frameTicks % program.length]
      if (digRef.current) {
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
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(STAGE_WIDTH * dpr)
    canvas.height = Math.round(STAGE_HEIGHT * dpr)
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return
    const paint = () => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawNativeBoneyardWorld(
        context,
        STAGE_WIDTH,
        STAGE_HEIGHT,
        camera,
        document,
      )
    }
    paint()
    let paintFrame = 0
    const queuePaint = () => {
      if (paintFrame) return
      paintFrame = requestAnimationFrame(() => {
        paintFrame = 0
        paint()
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
  }, [camera, document])

  const frameStyle = { transform: `scale(${stageScale})` } as CSSProperties
  const element = localPlayer?.config.element ?? 'ether'
  const discipline = localPlayer?.config.discipline ?? 'arcane'
  const digScreen = worldToScreen(
    loaded.scene.solomonDig.position,
    camera,
    STAGE_WIDTH,
    STAGE_HEIGHT,
  )

  return (
    <div
      ref={sceneRef}
      className="boneyard-scene"
      data-boneyard-id={loaded.choice.id}
      data-discipline={discipline}
      data-element={element}
      data-geometry-sha256={loaded.geometrySha256}
      data-run-id={loaded.runId}
      aria-label={`Boneyard: ${loaded.choice.name}. Move with W A S D or the arrow keys.`}
      tabIndex={0}
    >
      <div className="boneyard-native-frame" style={frameStyle}>
        <canvas ref={canvasRef} className="boneyard-canvas" aria-hidden />
        <div className="boneyard-actors">
          <span
            className="boneyard-dig-anchor"
            style={{
              left: digScreen.x,
              top: digScreen.y,
              zIndex: Math.round(loaded.scene.solomonDig.position.y),
            }}
          >
            <span
              ref={digRef}
              className="boneyard-solomon-dig"
              style={{ backgroundImage: `url("${boneyard.solomonDig}")` }}
              role="img"
              aria-label="Solomon Dig"
            />
          </span>
          {Object.entries(snapshot.players).map(([id, player]) => (
            <PlayerCharacter
              key={id}
              className="boneyard-player"
              depth={Math.round(player.position.y)}
              isLocal={id === playerId}
              playerId={id}
              state={{
                ...player,
                position: worldToScreen(player.position, camera, STAGE_WIDTH, STAGE_HEIGHT),
              }}
            />
          ))}
        </div>
        <GameHud element={element} />
      </div>
    </div>
  )
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
