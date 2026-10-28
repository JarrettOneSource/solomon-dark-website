import type { BoneyardGoodieSnapshot } from './game-state.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'

export const BONEYARD_GOODIE_ENTITY_TYPE_ID = 8

const POSITION_SCALE = 16
const DESCRIPTOR_LENGTH = 4
const SAMPLE_LENGTH = 8

export const BONEYARD_GOODIE_ENTITY_REGISTRATION = {
  name: 'boneyard-goodie',
  typeId: BONEYARD_GOODIE_ENTITY_TYPE_ID,
  descriptorIsValid(descriptor: ReplicatedEntityDescriptor): boolean {
    return descriptor.length === DESCRIPTOR_LENGTH
      && descriptor[0] === BONEYARD_GOODIE_ENTITY_TYPE_ID
      && positiveInteger(descriptor[1])
      && nonnegativeInteger(descriptor[2])
      && nonnegativeInteger(descriptor[3])
  },
  sampleIsValid(sample: ReplicatedEntitySample): boolean {
    return sample.length === SAMPLE_LENGTH
      && sample[0] === BONEYARD_GOODIE_ENTITY_TYPE_ID
      && positiveInteger(sample[1])
      && sample.slice(2).every(Number.isSafeInteger)
      && (sample[4] === 0 || sample[4] === 1)
      && (sample[5] === 0 || sample[5] === 1)
      && sample[6] >= 0 && sample[6] <= 2
      && nonnegativeInteger(sample[7])
  },
}

export function boneyardGoodieDescriptor(
  goodie: BoneyardGoodieSnapshot,
): ReplicatedEntityDescriptor {
  return [
    BONEYARD_GOODIE_ENTITY_TYPE_ID,
    goodie.id,
    goodie.subtype,
    goodie.sceneryRegistrationOrdinal,
  ]
}

export function boneyardGoodieSample(
  goodie: BoneyardGoodieSnapshot,
): ReplicatedEntitySample {
  return [
    BONEYARD_GOODIE_ENTITY_TYPE_ID,
    goodie.id,
    quantize(goodie.position.x),
    quantize(goodie.position.y),
    Number(goodie.active),
    Number(goodie.exhausted),
    goodie.phase,
    goodie.timer,
  ]
}

export function materializeBoneyardGoodie(
  descriptor: ReplicatedEntityDescriptor,
  sample: ReplicatedEntitySample,
): BoneyardGoodieSnapshot {
  if (!BONEYARD_GOODIE_ENTITY_REGISTRATION.descriptorIsValid(descriptor)) {
    throw new Error('Boneyard Goodie descriptor shape is invalid')
  }
  if (!BONEYARD_GOODIE_ENTITY_REGISTRATION.sampleIsValid(sample)) {
    throw new Error('Boneyard Goodie sample shape is invalid')
  }
  if (descriptor[1] !== sample[1]) {
    throw new Error('Boneyard Goodie sample identity does not match its descriptor')
  }
  return {
    active: sample[4] === 1,
    exhausted: sample[5] === 1,
    id: descriptor[1],
    phase: sample[6] as 0 | 1 | 2,
    position: { x: sample[2] / POSITION_SCALE, y: sample[3] / POSITION_SCALE },
    sceneryRegistrationOrdinal: descriptor[3],
    subtype: descriptor[2],
    timer: sample[7],
  }
}

function quantize(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Boneyard Goodie contains a non-finite value')
  return Math.round(value * POSITION_SCALE)
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function nonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}
