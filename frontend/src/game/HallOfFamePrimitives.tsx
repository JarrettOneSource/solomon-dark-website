import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'

import { elementVfx, hub, skillPicker } from '../lib/assets.ts'
import type { HallOfFameEntry } from './core-kernels/hall-of-fame.ts'
import {
  NATIVE_ELEMENT_VFX_SPRITES,
  nativeElementVfxPlan,
  type NativeElement,
  type NativeElementVfxDraw,
  type NativeElementVfxSprite,
} from './element-vfx-native.ts'
import {
  HALL_ATLAS_SIZES,
  HALL_FONT_ATLAS_SIZE,
  HALL_GOLD,
  HALL_NINE_SLICE_EDGE_UV,
  HALL_TICK_MS,
  HALL_WIZARD_SCALE,
  hallAtlasRecord,
  hallNineSliceLayout,
  hallRoundHalfUp,
  layoutHallText,
  type HallAtlas,
  type HallFont,
  type HallRect,
  type HallTextAlign,
} from './hall-of-fame-presentation.ts'
import {
  playerCharacterStaffIsFront,
  playerCharacterStaffOrbOffset,
} from './player-character-presentation.ts'
import {
  PLAYER_CHARACTER_SHEETS,
  playerCharacterAtlasCssFrame,
} from './renderer/player-character-atlas.ts'

const ATLAS_SOURCES: Readonly<Record<HallAtlas, string>> = {
  Inventory: hub.trader.inventoryAtlas,
  Skills: skillPicker.skillsAtlas,
  UI: skillPicker.uiAtlas,
}

const FONT_MASK = `url("${skillPicker.fontsAtlas}")`
const FONT_MASK_SIZE = `${HALL_FONT_ATLAS_SIZE[0]}px ${HALL_FONT_ATLAS_SIZE[1]}px`

function cssColor(tint: number): string {
  return `#${(tint & 0xffffff).toString(16).padStart(6, '0')}`
}

function maskStyle(image: string, position: string, size: string): CSSProperties {
  return {
    maskImage: image,
    maskPosition: position,
    maskRepeat: 'no-repeat',
    maskSize: size,
    WebkitMaskImage: image,
    WebkitMaskPosition: position,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: size,
  }
}

interface HallTextProps {
  readonly align?: HallTextAlign
  readonly alpha?: number
  readonly className?: string
  readonly font: HallFont
  readonly text: string
  readonly tint?: number
  readonly x: number
  readonly y: number
}

/** Native bitmap text: the pen sits on the baseline at (x, y); glyphs are center-anchored sprites. */
export function HallText({ align = 'left', alpha, className, font, text, tint = HALL_GOLD, x, y }: HallTextProps) {
  const layout = useMemo(() => layoutHallText(font, text, align), [align, font, text])
  const color = cssColor(tint)
  return (
    <span
      className={className ? `hall-text ${className}` : 'hall-text'}
      style={{ left: x, opacity: alpha, top: y }}
      aria-hidden
    >
      {layout.glyphs.map((glyph, index) => (
        <i
          key={index}
          style={{
            backgroundColor: color,
            height: glyph.height,
            left: glyph.left,
            top: glyph.top,
            width: glyph.width,
            ...maskStyle(FONT_MASK, `${-glyph.atlasX}px ${-glyph.atlasY}px`, FONT_MASK_SIZE),
          }}
        />
      ))}
    </span>
  )
}

interface HallSpriteProps {
  readonly alpha?: number
  readonly atlas: HallAtlas
  readonly className?: string
  readonly mirrorX?: boolean
  readonly mirrorY?: boolean
  readonly record: number
  readonly rotation?: number
  readonly scale?: number
  readonly tint?: number
  readonly x: number
  readonly y: number
}

/** Center-anchored atlas sprite (`Sprite_Draw` anchor 0.5) with optional rotation, mirroring, and tint. */
export function HallSprite({
  alpha,
  atlas,
  className,
  mirrorX = false,
  mirrorY = false,
  record,
  rotation = 0,
  scale = 1,
  tint,
  x,
  y,
}: HallSpriteProps) {
  const definition = hallAtlasRecord(atlas, record)
  const [frameX, frameY, frameWidth, frameHeight] = definition.frame
  const [width, height] = definition.logicalSize
  const [trimX, trimY] = definition.trimOrigin
  const [atlasWidth, atlasHeight] = HALL_ATLAS_SIZES[atlas]
  const source = ATLAS_SOURCES[atlas]
  const scaleX = mirrorX ? -scale : scale
  const scaleY = mirrorY ? -scale : scale
  const art: CSSProperties = {
    height: frameHeight,
    left: trimX,
    top: trimY,
    width: frameWidth,
  }
  const tinted = tint !== undefined && (tint & 0xffffff) !== 0xffffff
  return (
    <span
      className={className ? `hall-sprite ${className}` : 'hall-sprite'}
      style={{
        height,
        left: hallRoundHalfUp(x - width / 2),
        opacity: alpha,
        top: hallRoundHalfUp(y - height / 2),
        transform: `rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`,
        width,
      }}
      aria-hidden
    >
      <span
        className="hall-sprite-art"
        style={{
          ...art,
          backgroundImage: `url("${source}")`,
          backgroundPosition: `${-frameX}px ${-frameY}px`,
          backgroundSize: `${atlasWidth}px ${atlasHeight}px`,
        }}
      />
      {tinted && (
        <span
          className="hall-sprite-tint"
          style={{
            ...art,
            backgroundColor: cssColor(tint),
            ...maskStyle(`url("${source}")`, `${-frameX}px ${-frameY}px`, `${atlasWidth}px ${atlasHeight}px`),
          }}
        />
      )}
    </span>
  )
}

interface HallNineSliceProps {
  readonly alpha?: number
  readonly className?: string
  readonly record: number
  readonly rect: HallRect
}

/**
 * `FUN_00417760`: four mirrored corner copies of a UI glyph plus its last 5 %
 * column / row stretched along each edge; the middle stays empty.
 */
export function HallNineSlice({ alpha, className, record, rect }: HallNineSliceProps) {
  const definition = hallAtlasRecord('UI', record)
  const [frameX, frameY, frameWidth, frameHeight] = definition.frame
  const [atlasWidth, atlasHeight] = HALL_ATLAS_SIZES.UI
  const source = `url("${skillPicker.uiAtlas}")`
  const edgeWidth = frameWidth * (1 - HALL_NINE_SLICE_EDGE_UV)
  const edgeHeight = frameHeight * (1 - HALL_NINE_SLICE_EDGE_UV)
  const pieces = hallNineSliceLayout(frameWidth, frameHeight, rect)
  return (
    <span
      className={className ? `hall-nine-slice ${className}` : 'hall-nine-slice'}
      style={{ height: rect.height, left: rect.left, opacity: alpha, top: rect.top, width: rect.width }}
      aria-hidden
    >
      {pieces.map((piece, index) => {
        if (piece.width <= 0 || piece.height <= 0) return null
        let backgroundSize = `${atlasWidth}px ${atlasHeight}px`
        let backgroundPosition = `${-frameX}px ${-frameY}px`
        if (piece.kind === 'horizontal') {
          const stretch = piece.width / edgeWidth
          backgroundSize = `${atlasWidth * stretch}px ${atlasHeight}px`
          backgroundPosition = `${-(frameX + frameWidth - edgeWidth) * stretch}px ${-frameY}px`
        } else if (piece.kind === 'vertical') {
          const stretch = piece.height / edgeHeight
          backgroundSize = `${atlasWidth}px ${atlasHeight * stretch}px`
          backgroundPosition = `${-frameX}px ${-(frameY + frameHeight - edgeHeight) * stretch}px`
        }
        return (
          <span
            key={index}
            className="hall-nine-slice-piece"
            style={{
              backgroundImage: source,
              backgroundPosition,
              backgroundSize,
              height: piece.height,
              left: piece.left,
              top: piece.top,
              transform: `scale(${piece.mirrorX ? -1 : 1}, ${piece.mirrorY ? -1 : 1})`,
              width: piece.width,
            }}
          />
        )
      })}
    </span>
  )
}

interface HallElementOrbProps {
  readonly element: NativeElement
  readonly scale: number
  readonly x: number
  readonly y: number
}

function vfxSource(sprite: NativeElementVfxSprite): string {
  return sprite === 'core' || sprite === 'ray' || sprite === 'spark'
    ? elementVfx.common[sprite]
    : elementVfx.frames[sprite]
}

function applyDraw(node: HTMLElement, draw: NativeElementVfxDraw, scale: number): void {
  const metrics = NATIVE_ELEMENT_VFX_SPRITES[draw.sprite]
  const frame = ((draw.frame % metrics.count) + metrics.count) % metrics.count
  const art = node.firstElementChild as HTMLElement
  const tint = node.lastElementChild as HTMLElement
  const source = `url("${vfxSource(draw.sprite)}")`
  const position = `${-frame * metrics.width}px 0px`
  node.style.display = ''
  node.style.width = `${metrics.width}px`
  node.style.height = `${metrics.height}px`
  node.style.left = `${-metrics.width / 2}px`
  node.style.top = `${-metrics.height / 2}px`
  node.style.opacity = `${Math.max(0, Math.min(1, draw.alpha))}`
  node.style.mixBlendMode = draw.blend === 'lighter' ? 'plus-lighter' : 'normal'
  node.style.transform = `translate(${draw.x * scale}px, ${draw.y * scale}px) rotate(${draw.rotation}deg) scale(${draw.scale * scale})`
  art.style.backgroundImage = source
  art.style.backgroundPosition = position
  const [red, green, blue] = draw.color
  const white = red >= 1 && green >= 1 && blue >= 1
  tint.style.display = white ? 'none' : ''
  if (!white) {
    tint.style.backgroundColor = `rgb(${Math.round(red * 255)} ${Math.round(green * 255)} ${Math.round(blue * 255)})`
    tint.style.maskImage = source
    tint.style.maskPosition = position
    tint.style.webkitMaskImage = source
    tint.style.webkitMaskPosition = position
  }
}

/**
 * The staff orb VFX (`nativeElementVfxPlan`) driven on the 100 Hz game tick;
 * the DOM pool is updated imperatively so the row never re-renders per tick.
 */
export function HallElementOrb({ element, scale, x, y }: HallElementOrbProps) {
  const root = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const container = root.current
    if (!container) return
    const pool: HTMLElement[] = []
    let lastTick = Number.NaN
    let frame = 0
    const paint = (tick: number) => {
      const plan = nativeElementVfxPlan(element, tick, 1)
      while (pool.length < plan.length) {
        const node = document.createElement('i')
        node.className = 'hall-orb-draw'
        const art = document.createElement('b')
        art.className = 'hall-orb-art'
        const tint = document.createElement('b')
        tint.className = 'hall-orb-tint'
        node.append(art, tint)
        container.append(node)
        pool.push(node)
      }
      pool.forEach((node, index) => {
        const draw = plan[index]
        if (draw) applyDraw(node, draw, scale)
        else node.style.display = 'none'
      })
    }
    const step = (now: number) => {
      const tick = Math.floor(now / HALL_TICK_MS)
      if (tick !== lastTick) {
        lastTick = tick
        paint(tick)
      }
      frame = requestAnimationFrame(step)
    }
    paint(0)
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      container.replaceChildren()
    }
  }, [element, scale])
  return <span ref={root} className="hall-orb" style={{ left: x, top: y }} aria-hidden />
}

interface HallWizardProps {
  readonly entry: HallOfFameEntry
  readonly x: number
  readonly y: number
}

/** The hub preview composite (`addPlayerPreview`) at `1.25 * portraitScale`, anchored at its center. */
export function HallWizard({ entry, x, y }: HallWizardProps) {
  const heading = ((Math.round(entry.headingIndex) % 24) + 24) % 24
  const scale = HALL_WIZARD_SCALE * entry.portraitScale
  const staffFront = playerCharacterStaffIsFront(heading)
  const orb = playerCharacterStaffOrbOffset(heading)
  const layers: Array<readonly [zIndex: number, node: ReactNode]> = [
    [1, <WizardLayer key="staff-back" heading={heading} scale={scale} sheet={PLAYER_CHARACTER_SHEETS.staffBack} x={x} y={y} />],
    [3, <WizardLayer key="robe-dynamic" heading={heading} scale={scale} sheet={PLAYER_CHARACTER_SHEETS.robeDynamic[entry.element]} x={x} y={y} />],
    [4, <WizardLayer key="robe-fixed" heading={heading} scale={scale} sheet={PLAYER_CHARACTER_SHEETS.robeFixed[entry.element]} x={x} y={y} />],
    [5, <WizardLayer key="staff-front" heading={heading} scale={scale} sheet={PLAYER_CHARACTER_SHEETS.staffFront} x={x} y={y} />],
    [7, <WizardLayer key="head" heading={heading} scale={scale} sheet={PLAYER_CHARACTER_SHEETS.head[entry.element]} x={x} y={y} />],
    [staffFront ? 6 : 2, <HallElementOrb key="orb" element={entry.element} scale={scale} x={x + orb.x * scale} y={y + orb.y * scale} />],
  ]
  const visible = layers.filter(([zIndex]) => (staffFront ? zIndex !== 1 : zIndex !== 5))
  visible.sort((left, right) => left[0] - right[0])
  return <>{visible.map(([, node]) => node)}</>
}

function WizardLayer({
  heading,
  scale,
  sheet,
  x,
  y,
}: {
  readonly heading: number
  readonly scale: number
  readonly sheet: string
  readonly x: number
  readonly y: number
}) {
  return (
    <span
      className="hall-wizard-layer"
      style={{ left: x - 85, top: y - 85, transform: `scale(${scale})` }}
      aria-hidden
    >
      <span style={playerCharacterAtlasCssFrame(sheet, 0, heading)} />
    </span>
  )
}
