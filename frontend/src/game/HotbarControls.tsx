import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { NATIVE_BELT_SLOT_COUNT, PLAYER_HOTBAR_COUNT } from './core-kernels/native-belt.ts'
import type { GameControlBindings } from './game-settings.ts'
import type { NativeHudRect } from './native-hud-layout.ts'
import { modalHotbarLayout, type ModalHotbarRenderer } from './hotbar-controls-presentation.ts'
import './hotbar-controls.css'

interface HotbarSelection {
  readonly bank: number
  cycle(direction: number): void
  slot(index: number): number
}

const HotbarContext = createContext<HotbarSelection | null>(null)

/** Bank selection is presentation state; all 24 assignments belong to the player authority. */
export function HotbarProvider({ children }: { children: ReactNode }) {
  const [bank, setBank] = useState(0)
  const bankRef = useRef(0)
  const cycle = useCallback((direction: number) => {
    bankRef.current = (bankRef.current + direction + PLAYER_HOTBAR_COUNT) % PLAYER_HOTBAR_COUNT
    setBank(bankRef.current)
  }, [])
  const slot = useCallback((index: number) => bankRef.current * NATIVE_BELT_SLOT_COUNT + index, [])
  const value = useMemo(() => ({ bank, cycle, slot }), [bank, cycle, slot])
  return <HotbarContext.Provider value={value}>{children}</HotbarContext.Provider>
}

export function useHotbar(): HotbarSelection {
  const selection = useContext(HotbarContext)
  if (!selection) throw new Error('hotbar selection requires its gameplay provider')
  return selection
}

export function useHotbarShortcut(controls: GameControlBindings, enabled: boolean): void {
  const { cycle } = useHotbar()
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== controls.cycleHotbar || event.repeat || event.defaultPrevented
        || event.altKey || event.ctrlKey || event.metaKey
        || (event.target instanceof HTMLElement
          && event.target.closest('input, textarea, [contenteditable="true"]'))) return
      event.preventDefault()
      event.stopImmediatePropagation()
      cycle(event.shiftKey ? -1 : 1)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [controls.cycleHotbar, cycle, enabled])
}

export default function HotbarControls({ disabled = false, rects, renderer }: {
  disabled?: boolean
  rects?: readonly NativeHudRect[]
  renderer?: ModalHotbarRenderer | null
}) {
  const { bank, cycle } = useHotbar()
  const [hovered, setHovered] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  useLayoutEffect(() => {
    renderer?.setHotbarControls({ bank, disabled, hovered, focused })
    return () => renderer?.setHotbarControls(null)
  }, [renderer, bank, disabled, hovered, focused])
  const layout = rects ? modalHotbarLayout(rects) : null
  const style = layout ? {
    '--hotbar-top': `${layout.top}px`,
    '--hotbar-left': `${layout.previous}px`,
    '--hotbar-right': `${layout.next}px`,
    '--hotbar-dots-top': `${layout.dotsTop}px`,
  } as CSSProperties : undefined
  return (
    <div className="hotbar-controls" data-hotbar-bank={bank} data-modal={rects ? true : undefined} style={style}>
      <button type="button" className="hotbar-arrow hotbar-previous" aria-label="Previous hotbar"
        onPointerEnter={() => setHovered(-1)} onPointerLeave={() => setHovered(null)}
        onFocus={(event) => setFocused(event.currentTarget.matches(':focus-visible') ? -1 : null)}
        onKeyDown={() => setFocused(-1)} onBlur={() => setFocused(null)}
        title="Previous hotbar" disabled={disabled} onClick={() => cycle(-1)}>
        <span aria-hidden />
      </button>
      <span className="hotbar-dots" role="img" aria-label={`Hotbar ${bank + 1} of ${PLAYER_HOTBAR_COUNT}`}>
        {Array.from({ length: PLAYER_HOTBAR_COUNT }, (_, index) => (
          <span key={index} data-active={bank === index} />
        ))}
      </span>
      <button type="button" className="hotbar-arrow hotbar-next" aria-label="Next hotbar"
        onPointerEnter={() => setHovered(1)} onPointerLeave={() => setHovered(null)}
        onFocus={(event) => setFocused(event.currentTarget.matches(':focus-visible') ? 1 : null)}
        onKeyDown={() => setFocused(1)} onBlur={() => setFocused(null)}
        title="Next hotbar" disabled={disabled} onClick={() => cycle(1)}>
        <span aria-hidden />
      </button>
    </div>
  )
}
