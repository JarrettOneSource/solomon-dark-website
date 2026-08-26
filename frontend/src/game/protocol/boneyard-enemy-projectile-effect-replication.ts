import {
  BONEYARD_ENEMY_PROJECTILE_EFFECT_ALPHA_MAXIMUMS,
  BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS,
  type BoneyardEnemyProjectileEffectSnapshot,
} from './game-state.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'

export const BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_TYPE_ID = 6

const POSITION_SCALE = 16
const VALUE_SCALE = 1024
const ANGLE_SCALE = 4096
const DESCRIPTOR_LENGTH = 12
const SAMPLE_LENGTH = 10
const LIGHT_KIND_INDEX = BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS.indexOf('fire-burst-glow')
const ALPHA_MAXIMUM = Math.max(
  ...Object.values(BONEYARD_ENEMY_PROJECTILE_EFFECT_ALPHA_MAXIMUMS),
) * VALUE_SCALE
const ATLASES = ['BadGuys', 'DeadHawg'] as const
const BLEND_MODES = ['add', 'normal'] as const

export const BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_REGISTRATION = {
  name: 'boneyard-enemy-projectile-effect',
  typeId: BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_TYPE_ID,
  descriptorIsValid(descriptor: ReplicatedEntityDescriptor): boolean {
    return descriptor.length === DESCRIPTOR_LENGTH
      && descriptor[0] === BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_TYPE_ID
      && positiveInteger(descriptor[1])
      && arrayIndex(descriptor[2], BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS.length)
      && positiveInteger(descriptor[3])
      && positiveInteger(descriptor[4])
      && arrayIndex(descriptor[5], ATLASES.length)
      && arrayIndex(descriptor[6], BLEND_MODES.length)
      && nonnegativeInteger(descriptor[7])
      && positiveInteger(descriptor[8])
      && nonnegativeInteger(descriptor[9])
      && (descriptor[2] === LIGHT_KIND_INDEX
        ? descriptor[10] === 1 && nonnegativeInteger(descriptor[11])
        : descriptor[10] === -1 && descriptor[11] === -1)
  },
  sampleIsValid(sample: ReplicatedEntitySample): boolean {
    return sample.length === SAMPLE_LENGTH
      && sample[0] === BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_TYPE_ID
      && positiveInteger(sample[1])
      && sample.slice(2).every(Number.isSafeInteger)
      && sample[5] >= 0 && sample[5] <= ALPHA_MAXIMUM
      && sample[6] >= 0
      && nonnegativeInteger(sample[7])
      && sample[8] >= 0 && sample[8] <= 0xffffff
      && nonnegativeInteger(sample[9])
  },
}

export function boneyardEnemyProjectileEffectDescriptor(
  effect: BoneyardEnemyProjectileEffectSnapshot,
): ReplicatedEntityDescriptor {
  const lightRegistration = effect.lightRegistration
  if (effect.kind === 'fire-burst-glow') {
    if (lightRegistration?.managerLane !== 'transient') {
      throw new Error('enemy FireBurst glow requires a transient light registration')
    }
  } else if (lightRegistration !== null) {
    throw new Error(`enemy projectile effect ${effect.kind} must not register a light`)
  }
  return [
    BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_TYPE_ID,
    effect.id,
    requiredIndex(BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS, effect.kind, 'kind'),
    effect.ownerActorId,
    effect.ownerProjectileId,
    requiredIndex(ATLASES, effect.atlas, 'atlas'),
    requiredIndex(BLEND_MODES, effect.blendMode, 'blend mode'),
    effect.spawnTick,
    effect.lifetimeTicks,
    effect.phaseOriginTicks,
    lightRegistration === null ? -1 : 1,
    lightRegistration?.registrationOrdinal ?? -1,
  ]
}

export function boneyardEnemyProjectileEffectSample(
  effect: BoneyardEnemyProjectileEffectSnapshot,
): ReplicatedEntitySample {
  return [
    BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_TYPE_ID,
    effect.id,
    quantize(effect.position.x, POSITION_SCALE),
    quantize(effect.position.y, POSITION_SCALE),
    quantize(effect.rotationRadians, ANGLE_SCALE),
    quantize(effect.alpha, VALUE_SCALE),
    quantize(effect.scale, VALUE_SCALE),
    effect.entry,
    effect.tint,
    effect.ageTicks,
  ]
}

export function materializeBoneyardEnemyProjectileEffect(
  descriptor: ReplicatedEntityDescriptor,
  sample: ReplicatedEntitySample,
): BoneyardEnemyProjectileEffectSnapshot {
  if (!BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_REGISTRATION.descriptorIsValid(descriptor)) {
    throw new Error('Boneyard enemy projectile-effect descriptor shape is invalid')
  }
  if (!BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_REGISTRATION.sampleIsValid(sample)) {
    throw new Error('Boneyard enemy projectile-effect sample shape is invalid')
  }
  if (descriptor[1] !== sample[1]) {
    throw new Error('Boneyard enemy projectile-effect identity does not match its descriptor')
  }
  const kind = BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS[descriptor[2]]!
  const alpha = dequantize(sample[5], VALUE_SCALE)
  if (alpha > BONEYARD_ENEMY_PROJECTILE_EFFECT_ALPHA_MAXIMUMS[kind]) {
    throw new Error('Boneyard enemy projectile-effect alpha exceeds its native shape')
  }
  return {
    ageTicks: sample[9],
    alpha,
    atlas: ATLASES[descriptor[5]]!,
    blendMode: BLEND_MODES[descriptor[6]]!,
    entry: sample[7],
    id: descriptor[1],
    kind,
    lightRegistration: descriptor[10] === -1
      ? null
      : { managerLane: 'transient', registrationOrdinal: descriptor[11] },
    lifetimeTicks: descriptor[8],
    ownerActorId: descriptor[3],
    ownerProjectileId: descriptor[4],
    phaseOriginTicks: descriptor[9],
    position: {
      x: dequantize(sample[2], POSITION_SCALE),
      y: dequantize(sample[3], POSITION_SCALE),
    },
    rotationRadians: dequantize(sample[4], ANGLE_SCALE),
    scale: dequantize(sample[6], VALUE_SCALE),
    spawnTick: descriptor[7],
    tint: sample[8],
  }
}

function requiredIndex<T>(values: readonly T[], value: T, field: string): number {
  const index = values.indexOf(value)
  if (index < 0) throw new Error(`enemy projectile effect ${field} is unsupported`)
  return index
}

function quantize(value: number, scale: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('enemy projectile effect sample value must be finite')
  }
  return Math.round(value * scale)
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
