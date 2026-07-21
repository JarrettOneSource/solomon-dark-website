import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import { art } from '../lib/assets'
import { distanceToSegment, paddedBounds, pointInPolygon } from './geometry.ts'
import type {
  BoneyardDocument,
  BoneyardLayers,
  Point,
  SceneSelection,
  WorldObject,
} from './model.ts'

type Viewport = Readonly<{
  offsetX: number
  offsetY: number
  scale: number
}>

type CanvasSize = Readonly<{
  width: number
  height: number
  ratio: number
}>

type LoadedImages = Readonly<{
  graves: readonly HTMLImageElement[]
  monument: HTMLImageElement | null
  building: HTMLImageElement | null
  goodie: HTMLImageElement | null
}>

export type BoneyardCanvasHandle = Readonly<{
  fit: () => void
  zoomBy: (factor: number) => void
}>

type BoneyardCanvasProps = Readonly<{
  document: BoneyardDocument
  layers: BoneyardLayers
  selection: SceneSelection | null
  onSelectionChange: (selection: SceneSelection | null) => void
  onZoomChange: (zoom: number) => void
}>

const MIN_ZOOM = 0.035
const MAX_ZOOM = 8
const ROAD_QUAD_ORDER = [0, 2, 3, 1] as const

function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

function fitViewport(document: BoneyardDocument, size: CanvasSize): Viewport {
  const bounds = paddedBounds(document.scene.bounds)
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const scale = clampZoom(Math.min(size.width / width, size.height / height))
  return {
    scale,
    offsetX: (size.width - (bounds.minX + bounds.maxX) * scale) / 2,
    offsetY: (size.height - (bounds.minY + bounds.maxY) * scale) / 2,
  }
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load viewer art: ${source}`))
    image.src = source
  })
}

function useViewerImages(): LoadedImages {
  const [images, setImages] = useState<LoadedImages>({
    graves: [],
    monument: null,
    building: null,
    goodie: null,
  })

  useEffect(() => {
    let active = true
    Promise.all([
      Promise.all([
        art.graveCeltic,
        art.graveCelticSwirl,
        art.graveArch,
        art.graveArchSmall,
        art.graveCross1,
        art.graveCross2,
        art.graveRip,
      ].map(loadImage)),
      loadImage(art.obelisk),
      loadImage(art.gargoyle),
      loadImage(art.skullGold),
    ]).then(([graves, monument, building, goodie]) => {
      if (active) setImages({ graves, monument, building, goodie })
    }).catch(() => {
      // Procedural markers remain fully usable if decorative images fail.
    })
    return () => {
      active = false
    }
  }, [])

  return images
}

function polygonPath(points: readonly Point[], order?: readonly number[]): Path2D {
  const path = new Path2D()
  const indices = order ?? points.map((_, index) => index)
  const first = points[indices[0]]
  if (!first) return path
  path.moveTo(first.x, first.y)
  for (const index of indices.slice(1)) path.lineTo(points[index].x, points[index].y)
  path.closePath()
  return path
}

function drawGrid(
  context: CanvasRenderingContext2D,
  document: BoneyardDocument,
  viewport: Viewport,
): void {
  const bounds = paddedBounds(document.scene.bounds, 384)
  const targetStep = 72 / viewport.scale
  const magnitude = 10 ** Math.floor(Math.log10(targetStep))
  const normalized = targetStep / magnitude
  const step = (normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
  const startX = Math.floor(bounds.minX / step) * step
  const startY = Math.floor(bounds.minY / step) * step

  context.save()
  context.lineWidth = 1 / viewport.scale
  context.strokeStyle = 'rgba(200, 168, 98, 0.08)'
  context.beginPath()
  for (let x = startX; x <= bounds.maxX; x += step) {
    context.moveTo(x, bounds.minY)
    context.lineTo(x, bounds.maxY)
  }
  for (let y = startY; y <= bounds.maxY; y += step) {
    context.moveTo(bounds.minX, y)
    context.lineTo(bounds.maxX, y)
  }
  context.stroke()

  context.strokeStyle = 'rgba(65, 227, 255, 0.16)'
  context.lineWidth = 1.5 / viewport.scale
  context.beginPath()
  context.moveTo(0, bounds.minY)
  context.lineTo(0, bounds.maxY)
  context.moveTo(bounds.minX, 0)
  context.lineTo(bounds.maxX, 0)
  context.stroke()
  context.restore()
}

function drawTerrain(context: CanvasRenderingContext2D, document: BoneyardDocument): void {
  for (const terrain of document.scene.terrain) {
    if (terrain.points.length < 3) continue
    const path = polygonPath(terrain.points)
    context.fillStyle = terrain.mode === 0 ? 'rgba(65, 58, 72, 0.58)' : 'rgba(52, 86, 58, 0.58)'
    context.strokeStyle = terrain.mode === 0 ? 'rgba(169, 159, 136, 0.58)' : 'rgba(127, 179, 95, 0.68)'
    context.lineWidth = 2
    context.fill(path)
    context.stroke(path)
  }
}

function drawRoads(context: CanvasRenderingContext2D, document: BoneyardDocument): void {
  for (const road of document.scene.roads) {
    const path = polygonPath(road.quad, ROAD_QUAD_ORDER)
    context.fillStyle = road.style === 2 ? 'rgba(78, 67, 69, 0.92)' : 'rgba(66, 58, 62, 0.92)'
    context.strokeStyle = 'rgba(200, 168, 98, 0.46)'
    context.lineWidth = 1.5
    context.fill(path)
    context.stroke(path)

    context.save()
    context.setLineDash([18, 14])
    context.strokeStyle = 'rgba(230, 220, 195, 0.2)'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(road.start.x, road.start.y)
    context.lineTo(road.end.x, road.end.y)
    context.stroke()
    context.restore()
  }
}

function drawSprites(context: CanvasRenderingContext2D, document: BoneyardDocument): void {
  for (const sprite of document.scene.sprites) {
    const scale = Math.max(0.4, Math.min(2.2, Math.max(Math.abs(sprite.scaleX), Math.abs(sprite.scaleY))))
    context.save()
    context.translate(sprite.position.x, sprite.position.y)
    context.rotate((sprite.rotation * Math.PI) / 180)
    context.scale(scale, scale)
    context.strokeStyle = sprite.atlasEntryId === 2
      ? 'rgba(127, 179, 95, 0.72)'
      : 'rgba(169, 159, 136, 0.62)'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(-8, 7)
    context.lineTo(0, -9)
    context.lineTo(1, 7)
    context.moveTo(0, 2)
    context.lineTo(8, -5)
    context.stroke()
    context.restore()
  }
}

function drawFences(context: CanvasRenderingContext2D, document: BoneyardDocument): void {
  context.lineCap = 'round'
  for (const fence of document.scene.fences) {
    context.strokeStyle = fence.style === 4 ? 'rgba(139, 164, 173, 0.95)' : 'rgba(177, 145, 91, 0.95)'
    context.lineWidth = fence.style === 4 ? 5 : 4
    context.beginPath()
    context.moveTo(fence.start.x, fence.start.y)
    context.lineTo(fence.end.x, fence.end.y)
    context.stroke()

    context.fillStyle = '#d1b978'
    for (const point of [fence.start, fence.end]) {
      context.beginPath()
      context.arc(point.x, point.y, 5, 0, Math.PI * 2)
      context.fill()
    }
  }
}

function drawImageMarker(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  position: Point,
  height: number,
): void {
  const width = height * (image.naturalWidth / image.naturalHeight)
  context.drawImage(image, position.x - width / 2, position.y - height, width, height)
}

function drawTree(context: CanvasRenderingContext2D, object: WorldObject): void {
  context.fillStyle = 'rgba(54, 43, 35, 0.95)'
  context.fillRect(object.position.x - 4, object.position.y - 22, 8, 25)
  context.fillStyle = object.variant && object.variant % 2 ? '#486c3f' : '#3d5d38'
  context.strokeStyle = 'rgba(157, 188, 118, 0.55)'
  context.lineWidth = 2
  context.beginPath()
  context.arc(object.position.x, object.position.y - 28, 22, 0, Math.PI * 2)
  context.fill()
  context.stroke()
}

function drawWorldObjects(
  context: CanvasRenderingContext2D,
  document: BoneyardDocument,
  images: LoadedImages,
): void {
  for (const object of document.scene.worldObjects) {
    context.save()
    context.shadowColor = 'rgba(0, 0, 0, 0.75)'
    context.shadowBlur = 8
    switch (object.typeId) {
      case 2001:
        drawTree(context, object)
        break
      case 2009:
        if (images.monument) drawImageMarker(context, images.monument, object.position, 76)
        else {
          context.fillStyle = '#968260'
          context.fillRect(object.position.x - 11, object.position.y - 55, 22, 55)
        }
        break
      case 2029: {
        const image = images.graves.length > 0
          ? images.graves[(object.variant ?? object.index) % images.graves.length]
          : undefined
        if (image) drawImageMarker(context, image, object.position, 48)
        else {
          context.fillStyle = '#8b8990'
          context.fillRect(object.position.x - 9, object.position.y - 27, 18, 27)
        }
        break
      }
      case 2040:
        if (images.building) drawImageMarker(context, images.building, object.position, 82)
        else {
          context.fillStyle = '#695c66'
          context.fillRect(object.position.x - 30, object.position.y - 42, 60, 42)
        }
        break
      case 2061:
        if (images.goodie) drawImageMarker(context, images.goodie, object.position, 30)
        break
      default:
        context.fillStyle = '#b45fe0'
        context.beginPath()
        context.arc(object.position.x, object.position.y, 10, 0, Math.PI * 2)
        context.fill()
        break
    }
    context.restore()
  }
}

function drawSpawn(context: CanvasRenderingContext2D, document: BoneyardDocument): void {
  const spawn = document.scene.spawn
  context.save()
  context.translate(spawn.position.x, spawn.position.y)
  context.rotate((spawn.direction * Math.PI) / 180)
  context.fillStyle = 'rgba(65, 227, 255, 0.18)'
  context.strokeStyle = '#8deeff'
  context.lineWidth = 3
  context.beginPath()
  context.arc(0, 0, 22, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.beginPath()
  context.moveTo(0, -34)
  context.lineTo(-9, -17)
  context.lineTo(9, -17)
  context.closePath()
  context.fillStyle = '#8deeff'
  context.fill()
  context.restore()
}

function drawSelection(context: CanvasRenderingContext2D, selection: SceneSelection | null): void {
  if (!selection) return
  context.save()
  context.strokeStyle = '#f0d491'
  context.fillStyle = 'rgba(240, 212, 145, 0.12)'
  context.lineWidth = 3
  context.setLineDash([9, 7])

  if (selection.kind === 'road') {
    const path = polygonPath(selection.quad, ROAD_QUAD_ORDER)
    context.fill(path)
    context.stroke(path)
  } else if (selection.kind === 'fence') {
    context.beginPath()
    context.moveTo(selection.start.x, selection.start.y)
    context.lineTo(selection.end.x, selection.end.y)
    context.stroke()
  } else if (selection.kind === 'terrain') {
    const path = polygonPath(selection.points)
    context.fill(path)
    context.stroke(path)
  } else {
    context.beginPath()
    context.arc(selection.position.x, selection.position.y, selection.kind === 'worldObject' ? 32 : 25, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }
  context.restore()
}

function pickSceneItem(
  document: BoneyardDocument,
  point: Point,
  scale: number,
  layers: BoneyardLayers,
): SceneSelection | null {
  const threshold = 15 / scale
  if (layers.spawn && Math.hypot(
    point.x - document.scene.spawn.position.x,
    point.y - document.scene.spawn.position.y,
  ) <= threshold * 1.6) return document.scene.spawn

  if (layers.objects) {
    for (const object of [...document.scene.worldObjects].reverse()) {
      if (Math.hypot(point.x - object.position.x, point.y - object.position.y) <= threshold * 1.8) {
        return object
      }
    }
  }
  if (layers.sprites) {
    for (const sprite of [...document.scene.sprites].reverse()) {
      if (Math.hypot(point.x - sprite.position.x, point.y - sprite.position.y) <= threshold) {
        return sprite
      }
    }
  }
  if (layers.fences) {
    for (const fence of [...document.scene.fences].reverse()) {
      if (distanceToSegment(point, fence.start, fence.end) <= threshold) return fence
    }
  }
  if (layers.roads) {
    for (const road of [...document.scene.roads].reverse()) {
      const polygon = ROAD_QUAD_ORDER.map((index) => road.quad[index])
      if (pointInPolygon(point, polygon) || distanceToSegment(point, road.start, road.end) <= threshold) {
        return road
      }
    }
  }
  if (layers.terrain) {
    for (const terrain of [...document.scene.terrain].reverse()) {
      if (pointInPolygon(point, terrain.points)) return terrain
    }
  }
  return null
}

const BoneyardCanvas = forwardRef<BoneyardCanvasHandle, BoneyardCanvasProps>(function BoneyardCanvas(
  { document, layers, selection, onSelectionChange, onZoomChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    viewport: Viewport
    moved: boolean
  } | null>(null)
  const images = useViewerImages()
  const [size, setSize] = useState<CanvasSize>({ width: 1, height: 1, ratio: 1 })
  const [viewport, setViewport] = useState<Viewport>({ offsetX: 0, offsetY: 0, scale: 1 })

  const fit = useCallback(() => {
    setViewport(fitViewport(document, size))
  }, [document, size])

  const zoomAt = useCallback((factor: number, screenX: number, screenY: number) => {
    setViewport((current) => {
      const scale = clampZoom(current.scale * factor)
      const worldX = (screenX - current.offsetX) / current.scale
      const worldY = (screenY - current.offsetY) / current.scale
      return {
        scale,
        offsetX: screenX - worldX * scale,
        offsetY: screenY - worldY * scale,
      }
    })
  }, [])

  useImperativeHandle(ref, () => ({
    fit,
    zoomBy: (factor) => zoomAt(factor, size.width / 2, size.height / 2),
  }), [fit, size, zoomAt])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rectangle = canvas.getBoundingClientRect()
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rectangle.width * ratio))
      canvas.height = Math.max(1, Math.round(rectangle.height * ratio))
      setSize({ width: rectangle.width, height: rectangle.height, ratio })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (size.width > 1 && size.height > 1) fit()
  }, [document, size.width, size.height, fit])

  useEffect(() => onZoomChange(viewport.scale), [onZoomChange, viewport.scale])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    context.setTransform(size.ratio, 0, 0, size.ratio, 0, 0)
    context.clearRect(0, 0, size.width, size.height)
    const gradient = context.createRadialGradient(
      size.width * 0.48,
      size.height * 0.42,
      20,
      size.width * 0.48,
      size.height * 0.42,
      Math.max(size.width, size.height) * 0.72,
    )
    gradient.addColorStop(0, '#17141d')
    gradient.addColorStop(1, '#08070b')
    context.fillStyle = gradient
    context.fillRect(0, 0, size.width, size.height)

    context.save()
    context.translate(viewport.offsetX, viewport.offsetY)
    context.scale(viewport.scale, viewport.scale)
    if (layers.grid) drawGrid(context, document, viewport)
    if (layers.terrain) drawTerrain(context, document)
    if (layers.roads) drawRoads(context, document)
    if (layers.sprites) drawSprites(context, document)
    if (layers.fences) drawFences(context, document)
    if (layers.objects) drawWorldObjects(context, document, images)
    if (layers.spawn) drawSpawn(context, document)
    drawSelection(context, selection)
    context.restore()
  }, [document, images, layers, selection, size, viewport])

  const canvasPoint = (clientX: number, clientY: number): Point => {
    const rectangle = canvasRef.current?.getBoundingClientRect()
    return {
      x: clientX - (rectangle?.left ?? 0),
      y: clientY - (rectangle?.top ?? 0),
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
      aria-label={`Overhead map of ${document.internalName}`}
      onContextMenu={(event) => event.preventDefault()}
      onDoubleClick={fit}
      onWheel={(event) => {
        event.preventDefault()
        const point = canvasPoint(event.clientX, event.clientY)
        zoomAt(Math.exp(-event.deltaY * 0.0012), point.x, point.y)
      }}
      onPointerDown={(event) => {
        const point = canvasPoint(event.clientX, event.clientY)
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = {
          pointerId: event.pointerId,
          startX: point.x,
          startY: point.y,
          viewport,
          moved: false,
        }
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const point = canvasPoint(event.clientX, event.clientY)
        const dx = point.x - drag.startX
        const dy = point.y - drag.startY
        if (Math.hypot(dx, dy) > 3) drag.moved = true
        setViewport({
          ...drag.viewport,
          offsetX: drag.viewport.offsetX + dx,
          offsetY: drag.viewport.offsetY + dy,
        })
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        if (!drag.moved) {
          const point = canvasPoint(event.clientX, event.clientY)
          const world = {
            x: (point.x - viewport.offsetX) / viewport.scale,
            y: (point.y - viewport.offsetY) / viewport.scale,
          }
          onSelectionChange(pickSceneItem(document, world, viewport.scale, layers))
        }
        dragRef.current = null
      }}
      onPointerCancel={() => {
        dragRef.current = null
      }}
    />
  )
})

export default BoneyardCanvas
