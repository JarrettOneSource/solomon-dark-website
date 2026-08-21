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
  PAUSE_MENU_ACTION_BOUNDS,
  gameplayPausePresentation,
  nativePauseMenuRenderPlan,
  nativePauseMenuReveal,
  type NativePauseAction,
} from './pause-menu-contract.ts'
import type { GameplayPauseState } from './protocol/game-protocol.ts'
import {
  createGameplayPauseRenderer,
  type GameplayPauseRenderer,
} from './renderer/gameplay-pause-renderer.ts'
import './gameplay-pause-menu.css'

interface GameplayPauseMenuProps {
  audio: GameAudioDirector
  onLeave: () => void
  onResume: () => void
  onSettings: () => void
  pause: GameplayPauseState
  playerId: string
  style: CSSProperties
}

export default function GameplayPauseMenu({
  audio,
  onLeave,
  onResume,
  onSettings,
  pause,
  playerId,
  style,
}: GameplayPauseMenuProps) {
  const resumeRef = useRef<HTMLButtonElement>(null)
  const rendererHostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<GameplayPauseRenderer | null>(null)
  const openingStartedAtRef = useRef(performance.now())
  const closingStartedAtRef = useRef<number | null>(null)
  const completedCloseRef = useRef(false)
  const callbacksRef = useRef({ onLeave, onResume, onSettings })
  const [closing, setClosing] = useState<NativePauseAction | null>(null)
  const [pressedAction, setPressedAction] = useState<NativePauseAction | null>(null)
  const [reveal, setReveal] = useState(0)
  const revealRef = useRef(reveal)
  const presentation = gameplayPausePresentation(pause, playerId)
  callbacksRef.current = { onLeave, onResume, onSettings }
  revealRef.current = reveal

  useEffect(() => {
    if (presentation.kind === 'owner') resumeRef.current?.focus()
  }, [presentation.kind])

  useEffect(() => {
    const host = rendererHostRef.current
    if (!host || presentation.kind !== 'owner') return
    let cancelled = false
    void createGameplayPauseRenderer().then((renderer) => {
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
  }, [presentation.kind])

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
        const { onLeave: leave, onResume: resume, onSettings: settings } = callbacksRef.current
        if (closing === 'leave') leave()
        else if (closing === 'settings') settings()
        else resume()
        return
      }
      animationFrame = requestAnimationFrame(sample)
    }
    sample(performance.now())
    return () => cancelAnimationFrame(animationFrame)
  }, [closing])

  const beginClose = (action: NativePauseAction) => {
    if (closing || presentation.kind !== 'owner') return
    audio.playSound('click')
    setPressedAction(null)
    closingStartedAtRef.current = performance.now()
    setClosing(action)
  }
  const consumeEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
  }
  const renderPlan = nativePauseMenuRenderPlan(reveal, pressedAction)

  return (
    <div
      className="main-menu-native-stage gameplay-pause-stage"
      style={style}
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
      {presentation.kind === 'owner' ? (
        <>
          <div ref={rendererHostRef} className="gameplay-pause-native-render" aria-hidden />
          {pressedAction ? <NativePausePressedRow action={pressedAction} /> : null}
          <NativePauseButton
            action="resume"
            buttonRef={resumeRef}
            closing={closing}
            onBeginClose={beginClose}
            onPressedChange={setPressedAction}
          />
          <NativePauseButton
            action="settings"
            closing={closing}
            onBeginClose={beginClose}
            onPressedChange={setPressedAction}
          />
          <NativePauseButton
            action="leave"
            closing={closing}
            onBeginClose={beginClose}
            onPressedChange={setPressedAction}
          />
        </>
      ) : (
        <div className="gameplay-pause-waiting" style={{ opacity: reveal }}>
          <p>{presentation.label}</p>
          <span>{presentation.detail}</span>
        </div>
      )}
    </div>
  )
}

interface NativePauseButtonProps {
  action: NativePauseAction
  buttonRef?: RefObject<HTMLButtonElement | null>
  closing: NativePauseAction | null
  onBeginClose: (action: NativePauseAction) => void
  onPressedChange: (action: NativePauseAction | null) => void
}

function NativePauseButton({
  action,
  buttonRef,
  closing,
  onBeginClose,
  onPressedChange,
}: NativePauseButtonProps) {
  const label = pauseActionLabel(action)
  const press = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button === 0 && !closing) onPressedChange(action)
  }
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && !closing) onPressedChange(action)
  }
  const release = () => onPressedChange(null)

  return (
    <button
      ref={buttonRef}
      type="button"
      className="gameplay-pause-action"
      style={PAUSE_MENU_ACTION_BOUNDS[action]}
      disabled={closing !== null}
      data-pause-action={action}
      onBlur={release}
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

function NativePausePressedRow({ action }: { action: NativePauseAction }) {
  const bounds = PAUSE_MENU_ACTION_BOUNDS[action]
  const [frameX, frameY] = NATIVE_PAUSE_PRESSED_ROW_FRAME
  const [endX, endY, endWidth, endHeight] = NATIVE_PAUSE_ROW_END_FRAME
  const edgeX = endX + endWidth * NATIVE_PAUSE_EDGE_UV_START
  const edgeWidth = endWidth * (1 - NATIVE_PAUSE_EDGE_UV_START)
  const label = pauseActionLabel(action)
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
      left: PAUSE_MENU_ACTION_BOUNDS.resume.width / 2 + 6 + cursor + glyph.metrics[1] - width / 2,
      top: PAUSE_MENU_ACTION_BOUNDS.resume.height / 2 + 15 + glyph.metrics[2] - height / 2,
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

function pauseActionLabel(action: NativePauseAction): string {
  if (action === 'resume') return 'RESUME GAME'
  if (action === 'settings') return 'GAME SETTINGS'
  return 'LEAVE GAME'
}
