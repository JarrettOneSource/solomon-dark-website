import {
  BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES,
  BONEYARD_MAGGOT_STATES,
} from './game-state.ts'
import type { BoneyardMaggotSnapshot } from './game-state.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'

export const BONEYARD_MAGGOT_ENTITY_TYPE_ID = 4

const POSITION_SCALE = 16
const ANGLE_SCALE = 64
const VALUE_SCALE = 1024
const DESCRIPTOR_LENGTH = 8
const SAMPLE_LENGTH = 16

export const BONEYARD_MAGGOT_ENTITY_REGISTRATION = {
  name: 'boneyard-maggot',
  typeId: BONEYARD_MAGGOT_ENTITY_TYPE_ID,
  descriptorIsValid(descriptor: ReplicatedEntityDescriptor): boolean {
    return descriptor.length === DESCRIPTOR_LENGTH
      && descriptor[0] === BONEYARD_MAGGOT_ENTITY_TYPE_ID
      && positiveInteger(descriptor[1])
      && positiveInteger(descriptor[2])
      && nonnegativeInteger(descriptor[3])
      && Number.isFinite(descriptor[4])
      && descriptor[4] > 0
      && arrayIndex(descriptor[5], BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES.length)
      && descriptor[6] === 0
      && nonnegativeInteger(descriptor[7])
  },
  sampleIsValid(sample: ReplicatedEntitySample): boolean {
    return sample.length === SAMPLE_LENGTH
      && sample[0] === BONEYARD_MAGGOT_ENTITY_TYPE_ID
      && positiveInteger(sample[1])
      && sample.slice(2).every(Number.isSafeInteger)
      && cyclic(sample[4], 360, ANGLE_SCALE)
      && arrayIndex(sample[6], BONEYARD_MAGGOT_STATES.length)
      && sample[8] >= 0 && sample[8] <= VALUE_SCALE
      && sample[9] >= 0 && sample[9] <= VALUE_SCALE
      && nonnegativeInteger(sample[10])
      && nonnegativeInteger(sample[11])
      && nonnegativeInteger(sample[12])
      && arrayIndex(sample[14], 10)
      && sample[15] >= 0 && sample[15] <= 5 * VALUE_SCALE
  },
}

export function boneyardMaggotDescriptor(
  maggot: BoneyardMaggotSnapshot,
): ReplicatedEntityDescriptor {
  return [
    BONEYARD_MAGGOT_ENTITY_TYPE_ID,
    maggot.id,
    maggot.ownerCoffinActorId,
    maggot.spawnTick,
    maggot.maximumHealth,
    requiredIndex(
      BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES,
      maggot.launchTrajectory,
      'launch trajectory',
    ),
    maggot.lightRegistration.managerLane === 'actor' ? 0 : -1,
    maggot.lightRegistration.registrationOrdinal,
  ]
}

export function boneyardMaggotSample(
  maggot: BoneyardMaggotSnapshot,
): ReplicatedEntitySample {
  return [
    BONEYARD_MAGGOT_ENTITY_TYPE_ID,
    maggot.id,
    quantize(maggot.position.x, POSITION_SCALE),
    quantize(maggot.position.y, POSITION_SCALE),
    quantizeCyclic(maggot.headingDeg, 360, ANGLE_SCALE),
    quantize(maggot.currentHealth, VALUE_SCALE),
    requiredIndex(BONEYARD_MAGGOT_STATES, maggot.state, 'state'),
    quantize(maggot.pose, VALUE_SCALE),
    quantize(maggot.alpha, VALUE_SCALE),
    quantize(maggot.hitFlash, VALUE_SCALE),
    maggot.deathEpoch,
    maggot.deathTick,
    maggot.emergenceTick,
    quantize(maggot.verticalOffset, VALUE_SCALE),
    maggot.emergenceOrientation,
    quantize(maggot.emergencePhase, VALUE_SCALE),
  ]
}

export function materializeBoneyardMaggot(
  descriptor: ReplicatedEntityDescriptor,
  sample: ReplicatedEntitySample,
): BoneyardMaggotSnapshot {
  if (!BONEYARD_MAGGOT_ENTITY_REGISTRATION.descriptorIsValid(descriptor)) {
    throw new Error('Boneyard Maggot descriptor shape is invalid')
  }
  if (!BONEYARD_MAGGOT_ENTITY_REGISTRATION.sampleIsValid(sample)) {
    throw new Error('Boneyard Maggot sample shape is invalid')
  }
  if (descriptor[1] !== sample[1]) {
    throw new Error('Boneyard Maggot sample identity does not match its descriptor')
  }
  return {
    alpha: dequantize(sample[8], VALUE_SCALE),
    currentHealth: dequantize(sample[5], VALUE_SCALE),
    deathEpoch: sample[10],
    deathTick: sample[11],
    emergencePhase: dequantize(sample[15], VALUE_SCALE),
    headingDeg: dequantize(sample[4], ANGLE_SCALE),
    hitFlash: dequantize(sample[9], VALUE_SCALE),
    id: descriptor[1],
    emergenceTick: sample[12],
    emergenceOrientation: sample[14],
    launchTrajectory: BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES[descriptor[5]]!,
    lightRegistration: {
      managerLane: 'actor',
      registrationOrdinal: descriptor[7],
    },
    maximumHealth: descriptor[4],
    ownerCoffinActorId: descriptor[2],
    pose: dequantize(sample[7], VALUE_SCALE),
    position: {
      x: dequantize(sample[2], POSITION_SCALE),
      y: dequantize(sample[3], POSITION_SCALE),
    },
    spawnTick: descriptor[3],
    state: BONEYARD_MAGGOT_STATES[sample[6]]!,
    verticalOffset: dequantize(sample[13], VALUE_SCALE),
  }
}

function requiredIndex<T>(values: readonly T[], value: T, label: string): number {
  const index = values.indexOf(value)
  if (index < 0) throw new Error(`unsupported Maggot ${label} ${String(value)}`)
  return index
}

function quantize(value: number, scale: number): number {
  if (!Number.isFinite(value)) throw new Error('Maggot sample contains a non-finite value')
  return Math.round(value * scale)
}

function quantizeCyclic(value: number, period: number, scale: number): number {
  return Math.round((((value % period) + period) % period) * scale) % (period * scale)
}

function dequantize(value: number, scale: number): number {
  return value / scale
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function nonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function arrayIndex(value: number, length: number): boolean {
  return nonnegativeInteger(value) && value < length
}

function cyclic(value: number, period: number, scale: number): boolean {
  return nonnegativeInteger(value) && value < period * scale
}
