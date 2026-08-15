import type { BoneyardEnemyDeathEffectSnapshot } from './game-state.ts'
import { BONEYARD_ENEMY_DEATH_EFFECT_KINDS } from './game-state.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'

export const BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_TYPE_ID = 5

const POSITION_SCALE = 16
const VALUE_SCALE = 1024
const ANGLE_SCALE = 4096
const DESCRIPTOR_LENGTH = 8
const SAMPLE_LENGTH = 11
const ATLASES = ['BadGuys', 'DeadHawg', 'Demon'] as const
const BLEND_MODES = ['add', 'normal'] as const

export const BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_REGISTRATION = {
  name: 'boneyard-enemy-death-effect',
  typeId: BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_TYPE_ID,
  descriptorIsValid(descriptor: ReplicatedEntityDescriptor): boolean {
    return descriptor.length === DESCRIPTOR_LENGTH
      && descriptor[0] === BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_TYPE_ID
      && positiveEntityId(descriptor[1])
      && positiveEntityId(descriptor[2])
      && arrayIndex(descriptor[3], BONEYARD_ENEMY_DEATH_EFFECT_KINDS.length)
      && arrayIndex(descriptor[4], ATLASES.length)
      && arrayIndex(descriptor[5], BLEND_MODES.length)
      && nonnegativeInteger(descriptor[6])
      && (descriptor[7] === 0 || descriptor[7] === 1)
  },
  sampleIsValid(sample: ReplicatedEntitySample): boolean {
    return sample.length === SAMPLE_LENGTH
      && sample[0] === BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_TYPE_ID
      && positiveEntityId(sample[1])
      && sample.slice(2).every(Number.isSafeInteger)
      && sample[5] >= 0 && sample[5] <= VALUE_SCALE * 1.25
      && sample[6] > 0
      && nonnegativeInteger(sample[7])
      && sample[8] >= 0 && sample[8] <= 0xffffff
      && nonnegativeInteger(sample[9])
  },
}

export function boneyardEnemyDeathEffectDescriptor(
  effect: BoneyardEnemyDeathEffectSnapshot,
): ReplicatedEntityDescriptor {
  return [
    BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_TYPE_ID,
    effect.id,
    effect.ownerActorId,
    requiredIndex(BONEYARD_ENEMY_DEATH_EFFECT_KINDS, effect.kind, 'death effect kind'),
    requiredIndex(ATLASES, effect.atlas, 'death effect atlas'),
    requiredIndex(BLEND_MODES, effect.blendMode, 'death effect blend mode'),
    effect.spawnTick,
    Number(effect.shadow),
  ]
}

export function boneyardEnemyDeathEffectSample(
  effect: BoneyardEnemyDeathEffectSnapshot,
): ReplicatedEntitySample {
  return [
    BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_TYPE_ID,
    effect.id,
    quantize(effect.position.x, POSITION_SCALE),
    quantize(effect.position.y + effect.height, POSITION_SCALE),
    quantize(effect.rotationRadians, ANGLE_SCALE),
    quantize(effect.alpha, VALUE_SCALE),
    quantize(effect.scale, VALUE_SCALE),
    effect.entry,
    effect.tint,
    effect.ageTicks,
    quantize(effect.height, POSITION_SCALE),
  ]
}

export function materializeBoneyardEnemyDeathEffect(
  descriptor: ReplicatedEntityDescriptor,
  sample: ReplicatedEntitySample,
): BoneyardEnemyDeathEffectSnapshot {
  if (!BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_REGISTRATION.descriptorIsValid(descriptor)) {
    throw new Error('Boneyard enemy death-effect descriptor shape is invalid')
  }
  if (!BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_REGISTRATION.sampleIsValid(sample)) {
    throw new Error('Boneyard enemy death-effect sample shape is invalid')
  }
  if (descriptor[1] !== sample[1]) {
    throw new Error('Boneyard enemy death-effect sample identity does not match its descriptor')
  }
  const alpha = dequantize(sample[5], VALUE_SCALE)
  const maximumAlpha = ATLASES[descriptor[4]] === 'BadGuys'
    && BLEND_MODES[descriptor[5]] === 'add'
    && sample[7] === 69
    && BONEYARD_ENEMY_DEATH_EFFECT_KINDS[descriptor[3]] === 'fade'
    ? 1.25
    : 1
  if (alpha > maximumAlpha) {
    throw new Error('Boneyard enemy death-effect alpha exceeds its native shape')
  }
  const height = dequantize(sample[10], POSITION_SCALE)
  return {
    ageTicks: sample[9],
    alpha,
    atlas: ATLASES[descriptor[4]]!,
    blendMode: BLEND_MODES[descriptor[5]]!,
    entry: sample[7],
    height,
    id: descriptor[1],
    kind: BONEYARD_ENEMY_DEATH_EFFECT_KINDS[descriptor[3]]!,
    ownerActorId: descriptor[2],
    position: {
      x: dequantize(sample[2], POSITION_SCALE),
      y: dequantize(sample[3], POSITION_SCALE) - height,
    },
    rotationRadians: dequantize(sample[4], ANGLE_SCALE),
    scale: dequantize(sample[6], VALUE_SCALE),
    shadow: descriptor[7] === 1,
    spawnTick: descriptor[6],
    tint: sample[8],
  }
}

function requiredIndex<T>(values: readonly T[], value: T, field: string): number {
  const index = values.indexOf(value)
  if (index < 0) throw new Error(`${field} is unsupported`)
  return index
}

function positiveEntityId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function nonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function arrayIndex(value: number, length: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < length
}

function quantize(value: number, scale: number): number {
  if (!Number.isFinite(value)) throw new Error('death effect sample value must be finite')
  return Math.round(value * scale)
}

function dequantize(value: number, scale: number): number {
  return value / scale
}
