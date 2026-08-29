import type {
  BoneyardMageLightningPulseFrame,
  BoneyardMageLightningPulseSnapshot,
} from './game-state.ts'

const POSITION_SCALE = 16
const FRAME_LENGTH = 17

export function boneyardMageLightningPulseFrame(
  pulse: BoneyardMageLightningPulseSnapshot,
): BoneyardMageLightningPulseFrame {
  const contact = pulse.contact
  const contactPoint = contact.kind === 'world'
    ? contact.position
    : contact.localOffset
  return [
    pulse.id,
    pulse.ownerActorId,
    pulse.tick,
    pulse.seed,
    quantize(pulse.source.x),
    quantize(pulse.source.y),
    quantize(pulse.midpoint.x),
    quantize(pulse.midpoint.y),
    quantize(pulse.endpoint.x),
    quantize(pulse.endpoint.y),
    contact.kind === 'world' ? 0 : 1,
    quantize(contactPoint.x),
    quantize(contactPoint.y),
    contact.kind === 'target-attached' ? contact.targetPlayerId : null,
    pulse.painterRegistrations[0]!.registrationOrdinal,
    pulse.painterRegistrations[1]!.registrationOrdinal,
    pulse.painterRegistrations[2]?.registrationOrdinal ?? -1,
  ]
}

export function boneyardMageLightningPulseFrameIsValid(
  value: unknown,
): value is BoneyardMageLightningPulseFrame {
  if (!Array.isArray(value) || value.length !== FRAME_LENGTH) return false
  const frame = value as unknown[]
  return positiveInteger(frame[0])
    && positiveInteger(frame[1])
    && nonnegativeInteger(frame[2])
    && unsigned32(frame[3])
    && frame.slice(4, 10).every(safeInteger)
    && (frame[10] === 0 || frame[10] === 1)
    && safeInteger(frame[11])
    && safeInteger(frame[12])
    && (
      (frame[10] === 0 && frame[13] === null)
      || (frame[10] === 1 && validPlayerId(frame[13]))
    )
    && nonnegativeInteger(frame[14])
    && nonnegativeInteger(frame[15])
    && (frame[10] === 0
      ? nonnegativeInteger(frame[16])
      : frame[16] === -1)
}

export function materializeBoneyardMageLightningPulse(
  frame: BoneyardMageLightningPulseFrame,
): BoneyardMageLightningPulseSnapshot {
  if (!boneyardMageLightningPulseFrameIsValid(frame)) {
    throw new Error('Boneyard Mage lightning pulse frame shape is invalid')
  }
  const contactPoint = {
    x: dequantize(frame[11]),
    y: dequantize(frame[12]),
  }
  return {
    contact: frame[10] === 0
      ? { kind: 'world', position: contactPoint }
      : {
          kind: 'target-attached',
          localOffset: contactPoint,
          targetPlayerId: frame[13]!,
        },
    endpoint: { x: dequantize(frame[8]), y: dequantize(frame[9]) },
    id: frame[0],
    midpoint: { x: dequantize(frame[6]), y: dequantize(frame[7]) },
    ownerActorId: frame[1],
    painterRegistrations: Object.freeze([
      { managerLane: 'actor', registrationOrdinal: frame[14] },
      { managerLane: 'actor', registrationOrdinal: frame[15] },
      ...(frame[16] < 0
        ? []
        : [{ managerLane: 'actor' as const, registrationOrdinal: frame[16] }]),
    ]),
    seed: frame[3],
    source: { x: dequantize(frame[4]), y: dequantize(frame[5]) },
    tick: frame[2],
  }
}

function quantize(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Mage lightning pulse contains a non-finite position')
  }
  return Math.round(value * POSITION_SCALE)
}

function dequantize(value: number): number {
  return value / POSITION_SCALE
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function nonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function unsigned32(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xffff_ffff
}

function safeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value)
}

function validPlayerId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && !Object.hasOwn(Object.prototype, value)
}
