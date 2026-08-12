import { useEffect, useRef, type CSSProperties } from 'react'
import { elementVfx } from '../lib/assets'
import type { WizardElement } from './CreateMenuScene'
import { loadGameImage } from './game-assets'
import {
  NATIVE_ELEMENT_VFX_SCALE,
  NATIVE_ELEMENT_VFX_SPRITES,
  nativeElementVfxPlan,
  type NativeElementVfxColor,
  type NativeElementVfxSprite,
} from './element-vfx-native'
import './element-vfx.css'

type ElementVfxVariant = keyof typeof NATIVE_ELEMENT_VFX_SCALE

interface ElementVfxProps {
  className?: string
  element: WizardElement
  nativeScale?: number
  style?: CSSProperties
  variant: ElementVfxVariant
}

const CANVAS_SIZE: Readonly<Record<ElementVfxVariant, number>> = {
  held: 720,
  picker: 360,
  staff: 360,
}

const SPRITE_SOURCE: Readonly<Record<NativeElementVfxSprite, string>> = {
  air: elementVfx.frames.air,
  core: elementVfx.common.core,
  earth: elementVfx.frames.earth,
  fire: elementVfx.frames.fire,
  ray: elementVfx.common.ray,
  spark: elementVfx.common.spark,
  water: elementVfx.frames.water,
}

type NativeElementImages = Record<NativeElementVfxSprite, HTMLImageElement>

function loadImages(): Promise<NativeElementImages> {
  return Promise.all(
    Object.entries(SPRITE_SOURCE).map(async ([sprite, source]) => (
      [sprite as NativeElementVfxSprite, await loadGameImage(source)] as const
    )),
  ).then((entries) => Object.fromEntries(entries) as NativeElementImages)
}

function colorKey(color: NativeElementVfxColor): string {
  return color.join(':')
}

function isWhite(color: NativeElementVfxColor): boolean {
  return color[0] === 1 && color[1] === 1 && color[2] === 1
}

function tintedImage(
  image: HTMLImageElement,
  color: NativeElementVfxColor,
  cache: Map<string, HTMLCanvasElement>,
  sprite: NativeElementVfxSprite,
): CanvasImageSource {
  if (isWhite(color)) return image
  const key = `${sprite}:${colorKey(color)}`
  const cached = cache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) return image
  context.drawImage(image, 0, 0)
  context.globalCompositeOperation = 'multiply'
  context.fillStyle = `rgb(${color.map((channel) => Math.round(channel * 255)).join(' ')})`
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.globalCompositeOperation = 'destination-in'
  context.drawImage(image, 0, 0)
  cache.set(key, canvas)
  return canvas
}

export default function ElementVfx({
  className = '',
  element,
  nativeScale,
  style,
  variant,
}: ElementVfxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scaleRef = useRef(nativeScale ?? NATIVE_ELEMENT_VFX_SCALE[variant])
  scaleRef.current = nativeScale ?? NATIVE_ELEMENT_VFX_SCALE[variant]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let cancelled = false
    let animationFrame = 0
    let previousTick = Number.NaN
    const tintCache = new Map<string, HTMLCanvasElement>()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canvasCenter = canvas.width / 2

    void loadImages().then((images) => {
      const render = (time: number) => {
        if (cancelled) return
        const tick = reducedMotion ? 0 : Math.floor(time * 60 / 1000)
        if (tick !== previousTick) {
          previousTick = tick
          context.clearRect(0, 0, canvas.width, canvas.height)
          context.imageSmoothingEnabled = true
          for (const operation of nativeElementVfxPlan(
            element,
            tick,
            scaleRef.current,
          )) {
            const metrics = NATIVE_ELEMENT_VFX_SPRITES[operation.sprite]
            const source = tintedImage(
              images[operation.sprite],
              operation.color,
              tintCache,
              operation.sprite,
            )
            const frame = ((operation.frame % metrics.count) + metrics.count) % metrics.count
            context.save()
            context.globalAlpha = operation.alpha
            context.globalCompositeOperation = operation.blend
            context.translate(canvasCenter + operation.x, canvasCenter + operation.y)
            context.rotate(operation.rotation * Math.PI / 180)
            context.scale(operation.scale, operation.scale)
            context.drawImage(
              source,
              frame * metrics.width,
              0,
              metrics.width,
              metrics.height,
              -metrics.width / 2,
              -metrics.height / 2,
              metrics.width,
              metrics.height,
            )
            context.restore()
          }
        }
        if (!reducedMotion) animationFrame = requestAnimationFrame(render)
      }
      animationFrame = requestAnimationFrame(render)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
    }
  }, [element, variant])

  return (
    <canvas
      ref={canvasRef}
      className={`element-vfx element-vfx-${variant} ${className}`}
      data-element={element}
      style={style}
      width={CANVAS_SIZE[variant]}
      height={CANVAS_SIZE[variant]}
      aria-hidden
    />
  )
}
