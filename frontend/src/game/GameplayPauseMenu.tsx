import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react'

import fontAssetsJson from '../assets/game/skill-picker-native-assets.json' with { type: 'json' }
import { skillPicker } from '../lib/assets.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import {
  NATIVE_PAUSE_PRESSED_ROW_FRAME,
  NATIVE_PAUSE_ROW_END_FRAME,
  NATIVE_PAUSE_EDGE_UV_START,
  NATIVE_PAUSE_TEXT_TINT,
  NATIVE_PAUSE_MENU_ROWS,
  NATIVE_SIMPLE_MENU_ROW_SIZE,
  gameplayPausePresentation,
  nativePauseMenuRenderPlan,
  nativePauseMenuReveal,
  type NativePauseMenuRowPlan,
  type NativeSimpleMenuAction,
  type NativeSimpleMenuRow,
} from './pause-menu-contract.ts'
import type { GameplayPauseState } from './protocol/game-protocol.ts'
import {
  createGameplayPauseRenderer,
  type GameplayPauseRenderer,
} from './renderer/gameplay-pause-renderer.ts'
import './gameplay-pause-menu.css'

interface GameplayPauseMenuProps {
  audio: GameAudioDirector
  /** Extra full-display owner class for a host whose stage placement differs from gameplay's fixed stage. */
  className?: string
  /** Action selected by an owner Escape; null consumes the edge without closing. */
  escapeAction?: NativeSimpleMenuAction | null
  /** Receives the chosen row's action once the native close tick has run out. */
  onSelect: (action: NativeSimpleMenuAction) => void
  pause: GameplayPauseState
  playerId: string
  /** Authored rows; gameplay's RESUME GAME / GAME SETTINGS / LEAVE GAME unless the host authors its own. */
  rows?: readonly NativeSimpleMenuRow[]
  style: CSSProperties
}

export default function GameplayPauseMenu({
  audio,
  className,
  escapeAction = 'resume',
  onSelect,
  pause,
  playerId,
  rows = NATIVE_PAUSE_MENU_ROWS,
  style,
}: GameplayPauseMenuProps) {
  const firstRowRef = useRef<HTMLButtonElement>(null)
  const rendererHostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<GameplayPauseRenderer | null>(null)
  const openingStartedAtRef = useRef(performance.now())
  const closingStartedAtRef = useRef<number | null>(null)
  const completedCloseRef = useRef(false)
  const callbacksRef = useRef({ onSelect })
  const [closing, setClosing] = useState<NativeSimpleMenuAction | null>(null)
  const [pressedAction, setPressedAction] = useState<NativeSimpleMenuAction | null>(null)
  const [reveal, setReveal] = useState(0)
  const revealRef = useRef(reveal)
  const presentation = gameplayPausePresentation(pause, playerId)
  callbacksRef.current = { onSelect }
  revealRef.current = reveal

  useEffect(() => {
    if (presentation.kind === 'owner') firstRowRef.current?.focus()
  }, [presentation.kind])

  useEffect(() => {
    const host = rendererHostRef.current
    if (!host || presentation.kind !== 'owner') return
    let cancelled = false
    void createGameplayPauseRenderer(rows).then((renderer) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      host.append(renderer.canvas)
      renderer.render(revealRef.current)
    }, (error: unknown) => {
      console.error('Gameplay pause renderer failed', error)
    })
    return () => {
      cancelled = true
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [presentation.kind, rows])

  useEffect(() => {
    rendererRef.current?.render(reveal)
  }, [reveal])

  useEffect(() => {
    const phase = closing ? 'closing' : 'opening'
    const startedAt = closingStartedAtRef.current ?? openingStartedAtRef.current
    let animationFrame = 0
    const sample = (now: number) => {
      const nextReveal = nativePauseMenuReveal(phase, now - startedAt)
      setReveal(nextReveal)
      if (phase === 'opening' && nextReveal === 1) return
      if (phase === 'closing' && nextReveal === 0) {
        if (!closing || completedCloseRef.current) return
        completedCloseRef.current = true
        callbacksRef.current.onSelect(closing)
        return
      }
      animationFrame = requestAnimationFrame(sample)
    }
    sample(performance.now())
    return () => cancelAnimationFrame(animationFrame)
  }, [closing])

  const beginClose = (action: NativeSimpleMenuAction) => {
    if (closing || presentation.kind !== 'owner') return
    audio.playSound('click')
    setPressedAction(null)
    closingStartedAtRef.current = performance.now()
    setClosing(action)
  }
  const consumeEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== 'Escape'
      || event.repeat
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || presentation.kind !== 'owner'
    ) return
    event.preventDefault()
    event.stopPropagation()
    if (escapeAction) beginClose(escapeAction)
  }
  const renderPlan = nativePauseMenuRenderPlan(reveal, pressedAction, rows)
  const pressedRow = renderPlan.rows.find((row) => row.bodyRecord === 102)

  return (
    <div
      className={`gameplay-pause-overlay gameplay-pause-stage${className ? ` ${className}` : ''}`}
      data-gameplay-pause-owner-id={pause.ownerPlayerId}
      data-gameplay-pause-owner-name={pause.ownerDisplayName}
      data-gameplay-pause-source={pause.source}
      data-gameplay-pause-pressed={pressedAction ?? 'none'}
      data-gameplay-pause-reveal={reveal}
      data-gameplay-pause-view={presentation.kind}
      onKeyDown={consumeEscape}
      role={presentation.kind === 'owner' ? 'dialog' : 'status'}
      aria-live={presentation.kind === 'waiting' ? 'polite' : undefined}
      aria-modal={presentation.kind === 'owner' ? true : undefined}
      aria-label={presentation.label}
    >
      <div
        className="gameplay-pause-dim"
        style={{ backgroundColor: `rgb(0 0 0 / ${renderPlan.dimAlpha})` }}
        aria-hidden
      />
      <div className="main-menu-native-stage gameplay-pause-native-stage" style={style}>
        {presentation.kind === 'owner' ? (
          <>
            <div ref={rendererHostRef} className="gameplay-pause-native-render" aria-hidden />
            {pressedRow ? <NativePausePressedRow row={pressedRow} /> : null}
            {renderPlan.rows.map((row, index) => (
              <NativePauseButton
                back={escapeAction === row.action}
                key={row.action}
                buttonRef={index === 0 ? firstRowRef : undefined}
                closing={closing}
                onBeginClose={beginClose}
                onPressedChange={setPressedAction}
                row={row}
              />
            ))}
          </>
        ) : (
          <div className="gameplay-pause-waiting" style={{ opacity: reveal }}>
            <p>{presentation.label}</p>
            <span>{presentation.detail}</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface NativePauseButtonProps {
  back: boolean
  buttonRef?: RefObject<HTMLButtonElement | null>
  closing: NativeSimpleMenuAction | null
  onBeginClose: (action: NativeSimpleMenuAction) => void
  onPressedChange: (action: NativeSimpleMenuAction | null) => void
  row: NativePauseMenuRowPlan
}

function NativePauseButton({
  back,
  buttonRef,
  closing,
  onBeginClose,
  onPressedChange,
  row: { action, bodyRecord, bounds, label },
}: NativePauseButtonProps) {
  const press = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button === 0 && !closing) onPressedChange(action)
  }
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && !closing) onPressedChange(action)
  }
  const release = () => onPressedChange(null)
  // Focus leaving a row releases only that row's press. The first row is auto-focused, so a pointer landing on any
  // other row blurs it inside the same gesture, and the native pressed body (UI.102) has to survive that hand-off.
  const blur = () => {
    if (bodyRecord === 102) release()
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className="gameplay-pause-action"
      style={bounds}
      disabled={closing !== null}
      data-pause-action={action}
      data-game-back={back || undefined}
      onBlur={blur}
      onClick={() => onBeginClose(action)}
      onKeyDown={keyDown}
      onKeyUp={release}
      onPointerCancel={release}
      onPointerDown={press}
      onPointerLeave={release}
      onPointerUp={release}
    >
      {label}
    </button>
  )
}

interface NativePauseGlyphRecord {
  readonly frame: readonly [number, number, number, number]
  readonly metrics?: readonly [number, number, number]
}

interface NativePauseBitmapFont {
  readonly glyphs: Readonly<Record<string, NativePauseGlyphRecord>>
  readonly kerning: readonly (readonly [number, number, number])[]
  readonly spaceAdvance: number
}

const PAUSE_MENU_FONT = (fontAssetsJson as unknown as {
  readonly fonts: Readonly<Record<'menu', NativePauseBitmapFont>>
}).fonts.menu

function NativePausePressedRow({ row: { action, bounds, label } }: { row: NativePauseMenuRowPlan }) {
  const [frameX, frameY] = NATIVE_PAUSE_PRESSED_ROW_FRAME
  const [endX, endY, endWidth, endHeight] = NATIVE_PAUSE_ROW_END_FRAME
  const edgeX = endX + endWidth * NATIVE_PAUSE_EDGE_UV_START
  const edgeWidth = endWidth * (1 - NATIVE_PAUSE_EDGE_UV_START)
  const glyphs = layoutPauseBitmapText(label)
  const tint = `#${NATIVE_PAUSE_TEXT_TINT.toString(16).padStart(6, '0')}`
  return (
    <span
      className="gameplay-pause-pressed-row"
      style={{
        height: endHeight,
        left: bounds.left - 6,
        top: bounds.top - 6,
        width: bounds.width + 12,
      }}
      data-pause-pressed-action={action}
      data-pause-pressed-record="102"
      aria-hidden
    >
      <span
        className="gameplay-pause-pressed-row-body"
        style={{
          backgroundImage: `url("${skillPicker.uiAtlas}")`,
          backgroundPosition: `-${frameX}px -${frameY}px`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1024px 1024px',
          height: bounds.height,
          width: bounds.width,
        }}
      />
      <span
        className="gameplay-pause-pressed-row-end gameplay-pause-pressed-row-end-left"
        style={{
          backgroundImage: `url("${skillPicker.uiAtlas}")`,
          backgroundPosition: `-${endX}px -${endY}px`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1024px 1024px',
          height: endHeight,
          width: endWidth,
        }}
      />
      <svg
        className="gameplay-pause-pressed-row-connector"
        viewBox={`${edgeX} ${endY} ${edgeWidth} ${endHeight}`}
        preserveAspectRatio="none"
      >
        <image href={skillPicker.uiAtlas} width="1024" height="1024" />
      </svg>
      <span
        className="gameplay-pause-pressed-row-end gameplay-pause-pressed-row-end-right"
        style={{
          backgroundImage: `url("${skillPicker.uiAtlas}")`,
          backgroundPosition: `-${endX}px -${endY}px`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1024px 1024px',
          height: endHeight,
          width: endWidth,
        }}
      />
      {glyphs.map(({ code, frame: [x, y, width, height], left, top }, index) => (
        <i
          key={`${index}:${code}`}
          style={{
            backgroundColor: tint,
            height,
            left,
            maskImage: `url("${skillPicker.fontsAtlas}")`,
            maskPosition: `${-x}px ${-y}px`,
            maskRepeat: 'no-repeat',
            maskSize: '512px 256px',
            top,
            WebkitMaskImage: `url("${skillPicker.fontsAtlas}")`,
            WebkitMaskPosition: `${-x}px ${-y}px`,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskSize: '512px 256px',
            width,
          }}
        />
      ))}
    </span>
  )
}

function layoutPauseBitmapText(text: string): ReadonlyArray<Readonly<{
  code: number
  frame: readonly [number, number, number, number]
  left: number
  top: number
}>> {
  const measuredWidth = measurePauseBitmapText(text)
  const glyphs = []
  let cursor = -measuredWidth / 2
  let previous = -1
  for (const character of text) {
    const code = character.codePointAt(0)!
    if (character === ' ') {
      cursor += PAUSE_MENU_FONT.spaceAdvance
      previous = code
      continue
    }
    const glyph = PAUSE_MENU_FONT.glyphs[`${code}`]
    if (!glyph?.metrics) continue
    cursor += pauseKerning(previous, code)
    const [, , width, height] = glyph.frame
    glyphs.push({
      code,
      frame: glyph.frame,
      left: NATIVE_SIMPLE_MENU_ROW_SIZE.width / 2 + 6 + cursor + glyph.metrics[1] - width / 2,
      top: NATIVE_SIMPLE_MENU_ROW_SIZE.height / 2 + 15 + glyph.metrics[2] - height / 2,
    })
    cursor += glyph.metrics[0]
    previous = code
  }
  return glyphs
}

function measurePauseBitmapText(text: string): number {
  let width = 0
  let previous = -1
  for (const character of text) {
    const code = character.codePointAt(0)!
    if (character === ' ') width += PAUSE_MENU_FONT.spaceAdvance
    else {
      const glyph = PAUSE_MENU_FONT.glyphs[`${code}`]
      if (glyph?.metrics) width += pauseKerning(previous, code) + glyph.metrics[0]
    }
    previous = code
  }
  return width
}

function pauseKerning(first: number, second: number): number {
  if (first < 0) return 0
  return PAUSE_MENU_FONT.kerning.find(
    ([left, right]) => left === first && right === second,
  )?.[2] ?? 0
}
