import unholy from '../../editor/manifest/unholy.json' with { type: 'json' }
import type { NativeDemonSkullVisualState } from './native-demon-skull.ts'
import { roundHalfToEven } from './native-rounding.ts'
import type { Vector2 } from './vector.ts'

export function nativeDemonSkullFacing(headingDeg: number): number {
  return ((Math.trunc((roundHalfToEven(headingDeg) + 7) / 15) % 24) + 24) % 24
}

export function nativeDemonSkullBob(bodyPhaseDeg: number): number {
  return Math.fround(Math.sin(bodyPhaseDeg * Math.PI / 180) * 10 - 25)
}

export function nativeDemonSkullEyes(position: Readonly<Vector2>, state: NativeDemonSkullVisualState,
  scale: number, headingDeg: number): readonly [Vector2, Vector2] {
  const entry = 99 + state.bodyPose * 24 + nativeDemonSkullFacing(headingDeg)
  const points = unholy.entries[entry]?.extras
  if (points?.length !== 2) throw new Error(`Unholy:${entry} requires both authored eye attachments`)
  const root = { x: position.x + state.bodyOffset.x,
    y: position.y + state.bodyOffset.y + nativeDemonSkullBob(state.bodyPhaseDeg) }
  const first = points[0]!
  const second = points[1]!
  return [{ x: Math.fround(root.x + first.x * 2 * scale), y: Math.fround(root.y + first.y * 2 * scale) },
    { x: Math.fround(root.x + second.x * 2 * scale), y: Math.fround(root.y + second.y * 2 * scale) }]
}
