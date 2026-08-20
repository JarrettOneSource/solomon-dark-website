export const NATIVE_IMP_CONTACT_FIRE_BURST_TICKS = 16

export interface NativeImpContactFireBurstSample {
  frameEntry: number
  frameRotationRadians: number
  glowAlpha: number
  scale: number
  verticalOffset: number
}

export function nativeImpContactFireBurstSample(
  eventId: number,
  ageTicks: number,
): NativeImpContactFireBurstSample | null {
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    throw new RangeError('Imp contact fire-burst event id must be a positive safe integer')
  }
  if (!Number.isFinite(ageTicks) || ageTicks < 0) {
    throw new RangeError('Imp contact fire-burst age must be finite and non-negative')
  }
  if (ageTicks >= NATIVE_IMP_CONTACT_FIRE_BURST_TICKS) return null
  const scale = 0.9 + deterministicUnit(eventId, 1) * 0.2
  const initialRotation = deterministicUnit(eventId, 2) * Math.PI * 2
  const angularVelocity = (deterministicUnit(eventId, 3) < 0.5 ? -1 : 1)
    * (0.5 + deterministicUnit(eventId, 4)) * Math.PI / 180
  return {
    frameEntry: 251 + Math.min(3, Math.floor(ageTicks / 4)),
    frameRotationRadians: initialRotation + angularVelocity * ageTicks,
    glowAlpha: 0.5 * (1 - ageTicks / NATIVE_IMP_CONTACT_FIRE_BURST_TICKS),
    scale,
    verticalOffset: -ageTicks,
  }
}

function deterministicUnit(id: number, channel: number): number {
  let value = ((id >>> 0) ^ Math.imul(channel + 1, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  return (value >>> 0) / 0x1_0000_0000
}
