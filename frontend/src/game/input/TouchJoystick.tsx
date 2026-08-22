import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import type { Vector2 } from '../core-kernels/vector.ts'
import { joystickVector } from './movement-input.ts'

import './touch-joystick.css'

type TouchJoystickLane = 'movement' | 'primary'

interface TouchJoystickProps {
  lane: TouchJoystickLane
  onInput: (movement: Vector2) => void
  uiScale: number
}

export default function TouchJoystick({ lane, onInput, uiScale }: TouchJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null)
  const activePointerRef = useRef<number | null>(null)
  const inputSinkRef = useRef(onInput)
  const [knobOffset, setKnobOffset] = useState<Vector2>({ x: 0, y: 0 })
  const [active, setActive] = useState(false)

  useEffect(() => {
    inputSinkRef.current = onInput
  }, [onInput])

  const release = useCallback((pointerId?: number) => {
    if (pointerId !== undefined && pointerId !== activePointerRef.current) return
    activePointerRef.current = null
    setActive(false)
    setKnobOffset({ x: 0, y: 0 })
    inputSinkRef.current({ x: 0, y: 0 })
  }, [])

  const update = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current
    if (!base) return
    const bounds = base.getBoundingClientRect()
    const inputRadius = Math.min(bounds.width, bounds.height) * 0.34
    const renderRadius = Math.min(base.offsetWidth, base.offsetHeight) * 0.34
    const movement = joystickVector(
      { x: clientX, y: clientY },
      { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 },
      inputRadius,
    )
    setKnobOffset({ x: movement.x * renderRadius, y: movement.y * renderRadius })
    inputSinkRef.current(movement)
  }, [])

  useEffect(() => {
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerId === activePointerRef.current) update(event.clientX, event.clientY)
    }
    const pointerEnd = (event: PointerEvent) => release(event.pointerId)
    const blur = () => release()
    const visibilityChange = () => {
      if (document.visibilityState === 'hidden') release()
    }
    window.addEventListener('pointermove', pointerMove)
    window.addEventListener('pointerup', pointerEnd)
    window.addEventListener('pointercancel', pointerEnd)
    window.addEventListener('blur', blur)
    window.addEventListener('pagehide', blur)
    document.addEventListener('visibilitychange', visibilityChange)
    return () => {
      window.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerup', pointerEnd)
      window.removeEventListener('pointercancel', pointerEnd)
      window.removeEventListener('blur', blur)
      window.removeEventListener('pagehide', blur)
      document.removeEventListener('visibilitychange', visibilityChange)
      activePointerRef.current = null
      inputSinkRef.current({ x: 0, y: 0 })
    }
  }, [release, update])

  return (
    <div
      ref={baseRef}
      className={`game-touch-joystick game-touch-joystick-${lane}`}
      data-active={active}
      data-joystick={lane}
      data-ui-scale={uiScale}
      role="region"
      aria-label={lane === 'movement' ? 'Movement joystick' : 'Primary attack joystick'}
      tabIndex={-1}
      style={{ '--game-ui-scale': uiScale } as CSSProperties}
      onPointerDown={(event) => {
        event.preventDefault()
        if (activePointerRef.current !== null) return
        activePointerRef.current = event.pointerId
        setActive(true)
        event.currentTarget.setPointerCapture(event.pointerId)
        update(event.clientX, event.clientY)
      }}
    >
      {/* centering must live in the inline transform: the build folds the CSS
          `translate` property into `transform`, which inline styles override */}
      <span
        className="game-touch-joystick-knob"
        style={{ transform: `translate(-50%, -50%) translate(${knobOffset.x}px, ${knobOffset.y}px)` }}
      />
    </div>
  )
}
