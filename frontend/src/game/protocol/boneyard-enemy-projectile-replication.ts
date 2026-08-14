import type { BoneyardEnemyProjectileSnapshot } from './game-state.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'

export const BONEYARD_ENEMY_PROJECTILE_ENTITY_TYPE_ID = 3

const POSITION_SCALE = 16
const ANGLE_SCALE = 64
const VALUE_SCALE = 1024
const DESCRIPTOR_LENGTH = 9
const SAMPLE_LENGTH = 6

const KINDS = [
  'arrow',
  'demon-bomb',
  'firebolt',
  'guided-missile',
  'poison-pool',
] as const

const NATIVE_TYPE_IDS = {
  arrow: 0x7da,
  'demon-bomb': 0x7f7,
  firebolt: 0x7eb,
  'guided-missile': 0x7ec,
  'poison-pool': 0x806,
} as const

export const BONEYARD_ENEMY_PROJECTILE_ENTITY_REGISTRATION = {
  name: 'boneyard-enemy-projectile',
  typeId: BONEYARD_ENEMY_PROJECTILE_ENTITY_TYPE_ID,
  descriptorIsValid(descriptor: ReplicatedEntityDescriptor): boolean {
    if (
      descriptor.length !== DESCRIPTOR_LENGTH
      || descriptor[0] !== BONEYARD_ENEMY_PROJECTILE_ENTITY_TYPE_ID
      || !positiveInteger(descriptor[1])
      || !arrayIndex(descriptor[2], KINDS.length)
      || !positiveInteger(descriptor[3])
      || !positiveInteger(descriptor[4])
      || !nonnegativeInteger(descriptor[5])
      || !positiveInteger(descriptor[6])
      || !positiveInteger(descriptor[7])
      || (descriptor[8] !== 0 && descriptor[8] !== 1)
    ) return false
    return NATIVE_TYPE_IDS[KINDS[descriptor[2]]!] === descriptor[3]
  },
  sampleIsValid(sample: ReplicatedEntitySample): boolean {
    return sample.length === SAMPLE_LENGTH
      && sample[0] === BONEYARD_ENEMY_PROJECTILE_ENTITY_TYPE_ID
      && positiveInteger(sample[1])
      && sample.slice(2).every(Number.isSafeInteger)
      && cyclic(sample[4], 360, ANGLE_SCALE)
      && nonnegativeInteger(sample[5])
  },
}

export function boneyardEnemyProjectileDescriptor(
  projectile: BoneyardEnemyProjectileSnapshot,
): ReplicatedEntityDescriptor {
  return [
    BONEYARD_ENEMY_PROJECTILE_ENTITY_TYPE_ID,
    projectile.id,
    requiredIndex(KINDS, projectile.kind),
    projectile.nativeTypeId,
    projectile.ownerActorId,
    projectile.spawnTick,
    projectile.lifetimeTicks,
    quantize(projectile.contactRadius, VALUE_SCALE),
    Number(projectile.homing),
  ]
}

export function boneyardEnemyProjectileSample(
  projectile: BoneyardEnemyProjectileSnapshot,
): ReplicatedEntitySample {
  return [
    BONEYARD_ENEMY_PROJECTILE_ENTITY_TYPE_ID,
    projectile.id,
    quantize(projectile.position.x, POSITION_SCALE),
    quantize(projectile.position.y, POSITION_SCALE),
    quantizeCyclic(projectile.headingDeg, 360, ANGLE_SCALE),
    projectile.ageTicks,
  ]
}

export function materializeBoneyardEnemyProjectile(
  descriptor: ReplicatedEntityDescriptor,
  sample: ReplicatedEntitySample,
): BoneyardEnemyProjectileSnapshot {
  if (!BONEYARD_ENEMY_PROJECTILE_ENTITY_REGISTRATION.descriptorIsValid(descriptor)) {
    throw new Error('Boneyard enemy projectile descriptor shape is invalid')
  }
  if (!BONEYARD_ENEMY_PROJECTILE_ENTITY_REGISTRATION.sampleIsValid(sample)) {
    throw new Error('Boneyard enemy projectile sample shape is invalid')
  }
  if (descriptor[1] !== sample[1]) {
    throw new Error('Boneyard enemy projectile sample identity does not match its descriptor')
  }
  return {
    ageTicks: sample[5],
    contactRadius: dequantize(descriptor[7], VALUE_SCALE),
    headingDeg: dequantize(sample[4], ANGLE_SCALE),
    homing: descriptor[8] === 1,
    id: descriptor[1],
    kind: KINDS[descriptor[2]]!,
    lifetimeTicks: descriptor[6],
    nativeTypeId: descriptor[3] as BoneyardEnemyProjectileSnapshot['nativeTypeId'],
    ownerActorId: descriptor[4],
    position: {
      x: dequantize(sample[2], POSITION_SCALE),
      y: dequantize(sample[3], POSITION_SCALE),
    },
    spawnTick: descriptor[5],
  }
}

function requiredIndex<T>(source: readonly T[], value: T): number {
  const index = source.indexOf(value)
  if (index < 0) throw new Error(`unsupported enemy projectile kind ${String(value)}`)
  return index
}

function quantize(value: number, scale: number): number {
  if (!Number.isFinite(value)) throw new Error('enemy projectile contains a non-finite value')
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
