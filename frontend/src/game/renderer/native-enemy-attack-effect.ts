export type NativeEnemyRawFireBurstKind = 'demon-bomb-muzzle' | 'imp-contact'

export interface NativeEnemyAuxiliaryPainterPolicy {
  readonly lane: 'post-world-queue' | 'pre-world-queue' | 'world-sorted'
  readonly queueFamily: 'zanim' | null
  readonly sortBias: number
}

export const NATIVE_ENEMY_RAW_FIRE_BURST_PROGRAMS = Object.freeze({
  'demon-bomb-muzzle': Object.freeze({ phasePerTick: 0.25 * 0.75 }),
  'imp-contact': Object.freeze({ phasePerTick: 0.25 }),
} as const)

export const NATIVE_IMP_LANDING_FLARE_TICKS = 13
const NATIVE_IMP_LANDING_FLARE_ALPHA_LOSS = Math.fround(
  Math.fround(0.1) * 0.800000011920929,
)

export interface NativeEnemyRawFireBurstSample {
  frameEntry: number
  frameRotationRadians: number
  glowAlpha: number
  scale: number
  verticalOffset: number
}

export interface NativeImpLandingFlareSample {
  alpha: number
  green: number
  scaleX: number
  scaleY: number
}

export function nativeImpContactBurstOrigin(
  actorPosition: Readonly<{ x: number; y: number }>,
  headingDeg: number,
): Readonly<{ x: number; y: number }> {
  const radians = headingDeg * Math.PI / 180
  return {
    x: actorPosition.x + Math.sin(radians) * 15,
    y: actorPosition.y - 15 - Math.cos(radians) * 15,
  }
}

export function nativeDemonBombMuzzleOrigin(
  actorPosition: Readonly<{ x: number; y: number }>,
  headingDeg: number,
  controllerPoint5: Readonly<{ x: number; y: number }>,
  verticalOffset: number,
): Readonly<{ x: number; y: number }> {
  const radians = headingDeg * Math.PI / 180
  return {
    x: actorPosition.x + controllerPoint5.x + Math.sin(radians) * 25,
    y: actorPosition.y + verticalOffset + controllerPoint5.y - Math.cos(radians) * 25,
  }
}

export function nativeEnemyRawFireBurstSample(
  kind: NativeEnemyRawFireBurstKind,
  eventId: number,
  ageTicks: number,
): NativeEnemyRawFireBurstSample | null {
  requireEventAndAge(eventId, ageTicks)
  const phasePerTick = NATIVE_ENEMY_RAW_FIRE_BURST_PROGRAMS[kind].phasePerTick
  const lifetimeTicks = Math.ceil(4 / phasePerTick)
  if (ageTicks >= lifetimeTicks) return null
  const phase = ageTicks * phasePerTick
  const initialRotation = deterministicUnit(eventId, 1) * Math.PI * 2
  const angularMagnitude = 0.5 + deterministicUnit(eventId, 2)
  const angularDirection = deterministicUnit(eventId, 3) < 0.5 ? -1 : 1
  const scale = kind === 'imp-contact'
    ? 0.5 + deterministicUnit(eventId, 4) * 0.1
    : 1
  return {
    frameEntry: 251 + Math.min(3, Math.floor(phase)),
    frameRotationRadians: initialRotation
      + angularDirection * angularMagnitude * Math.PI / 180 * ageTicks,
    glowAlpha: 0.5 * (1 - phase / 4),
    scale,
    verticalOffset: -ageTicks,
  }
}

export function nativeEnemyRawFireBurstPainterPolicy(
  kind: NativeEnemyRawFireBurstKind,
): NativeEnemyAuxiliaryPainterPolicy {
  return kind === 'imp-contact'
    ? { lane: 'world-sorted', queueFamily: 'zanim', sortBias: 0 }
    : { lane: 'post-world-queue', queueFamily: null, sortBias: 0 }
}

export function nativeImpLandingFlarePainterPolicy(): NativeEnemyAuxiliaryPainterPolicy {
  return { lane: 'pre-world-queue', queueFamily: null, sortBias: 0 }
}

export function nativeImpLandingFlareSample(
  eventId: number,
  ageTicks: number,
): NativeImpLandingFlareSample | null {
  requireEventAndAge(eventId, ageTicks)
  if (ageTicks >= NATIVE_IMP_LANDING_FLARE_TICKS) return null
  const scaleX = 0.5 + deterministicUnit(eventId, 5) * 0.6
  return {
    alpha: Math.max(0, 1 - ageTicks * NATIVE_IMP_LANDING_FLARE_ALPHA_LOSS),
    green: 0.25 + deterministicUnit(eventId, 6) * 0.5,
    scaleX,
    scaleY: scaleX * 0.8,
  }
}

function requireEventAndAge(eventId: number, ageTicks: number): void {
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    throw new RangeError('enemy raw fire-burst event id must be a positive safe integer')
  }
  if (!Number.isFinite(ageTicks) || ageTicks < 0) {
    throw new RangeError('enemy raw fire-burst age must be finite and non-negative')
  }
}

function deterministicUnit(id: number, channel: number): number {
  let value = ((id >>> 0) ^ Math.imul(channel + 1, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  return (value >>> 0) / 0x1_0000_0000
}
