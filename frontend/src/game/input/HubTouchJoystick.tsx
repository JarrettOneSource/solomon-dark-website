import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'

import type { HubPoint } from '../core-kernels/hub-math.ts'
import { joystickVector } from './movement-input.ts'

interface HubTouchJoystickProps {
  onInput: (movement: HubPoint) => void
}

export default function HubTouchJoystick({ onInput }: HubTouchJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLSpanElement>(null)
  const activePointerRef = useRef<number | null>(null)

  const update = (event: ReactPointerEvent<HTMLDivElement>) => {
    const base = baseRef.current
    const knob = knobRef.current
    if (!base || !knob) return
    const bounds = base.getBoundingClientRect()
    const radius = Math.min(bounds.width, bounds.height) * 0.34
    const movement = joystickVector(
      { x: event.clientX, y: event.clientY },
      { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 },
      radius,
    )
    knob.style.transform = `translate(${movement.x * radius}px, ${movement.y * radius}px)`
    onInput(movement)
  }

  const release = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event && event.pointerId !== activePointerRef.current) return
    activePointerRef.current = null
    if (knobRef.current) knobRef.current.style.transform = 'translate(0, 0)'
    onInput({ x: 0, y: 0 })
  }

  useEffect(() => () => onInput({ x: 0, y: 0 }), [onInput])

  return (
    <div
      ref={baseRef}
      className="hub-touch-joystick"
      role="region"
      aria-label="Movement joystick"
      tabIndex={-1}
      onPointerDown={(event) => {
        if (activePointerRef.current !== null) return
        activePointerRef.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        update(event)
      }}
      onPointerMove={(event) => {
        if (event.pointerId === activePointerRef.current) update(event)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span ref={knobRef} className="hub-touch-joystick-knob" />
    </div>
  )
}
