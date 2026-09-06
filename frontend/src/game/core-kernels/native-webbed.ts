import type { BoneyardPoint } from './boneyard.ts'
import { directionFromHeading } from './primary-spell-targeting.ts'

export interface NativeWebbedState {
  readonly severity: number
  readonly strength: number
  readonly cocoonHealth: number
  readonly hitPulse: number
}

export function applyNativeWebbed(source: NativeWebbedState | null, strength: number): NativeWebbedState {
  const prior = source?.severity ?? 0
  const severity = Math.min(3, Math.floor(Math.fround(prior + 1)))
  const maximumStrength = Math.max(source?.strength ?? 0, strength)
  return {
    severity,
    strength: maximumStrength,
    cocoonHealth: prior < 3 && severity === 3 ? maximumStrength : source?.cocoonHealth ?? 0,
    hitPulse: source?.hitPulse ?? 0,
  }
}

/** Mod_Webbed 0x00623BA0 renews its timer; only partial webs wear off through movement. */
export function stepNativeWebbed(
  source: NativeWebbedState,
  velocity: Readonly<BoneyardPoint>,
): NativeWebbedState | null {
  const severity = source.severity < 3 && velocity.x ** 2 + velocity.y ** 2 > 0.5
    ? Math.fround(source.severity - Math.fround(0.001))
    : source.severity
  if (severity <= 0) return null
  return { ...source, severity, hitPulse: Math.max(0, Math.fround(source.hitPulse - Math.fround(0.05))) }
}

export function nativeWebbedMovementScale(source: NativeWebbedState | undefined): number {
  return source === undefined ? 1 : Math.max(0, 1 - source.severity / Math.fround(2.9))
}

export function damageNativeCocoon(
  source: NativeWebbedState,
  damage: number,
  hitPulse: number,
): NativeWebbedState | null {
  const cocoonHealth = source.cocoonHealth - damage
  return cocoonHealth <= 0 ? null : { ...source, cocoonHealth, hitPulse }
}

export function nativeCocoonPosition(position: Readonly<BoneyardPoint>, headingDeg: number): BoneyardPoint {
  const direction = directionFromHeading(headingDeg)
  return {
    x: Math.fround(position.x + direction.x * 60 + Math.fround(0.1)),
    y: Math.fround(position.y + direction.y * 60 + Math.fround(0.1)),
  }
}

export function nativeCocoonTilt(headingDeg: number): BoneyardPoint {
  const direction = directionFromHeading(Math.trunc(headingDeg / 30) * 30)
  const x = Math.fround(direction.x * -5)
  const y = Math.fround(direction.y * -5)
  return { x, y: Math.fround(y <= -3 ? y * 0.5 : y + Math.abs(y * 4)) }
}
