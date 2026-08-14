import { BONEYARD_ENEMY_FLAGS } from '../core-kernels/boneyard-enemy-config.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import type {
  BoneyardEnemyAction,
  BoneyardEnemyAnimationState,
  BoneyardEnemyCoffinState,
  BoneyardEnemySnapshot,
} from './game-state.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'

export const BONEYARD_ENEMY_ENTITY_TYPE_ID = 2

const POSITION_SCALE = 16
const ANGLE_SCALE = 64
const VALUE_SCALE = 1024
const DESCRIPTOR_LENGTH = 7
const SAMPLE_LENGTH = 29

const FAMILIES = [
  'SKELETON',
  'SKELETONARCHER',
  'SKELETONMAGE',
  'IMP',
  'ZOMBIE',
  'WRAITH',
  'DEMON',
  'COFFIN',
] as const

const ACTIONS: readonly (BoneyardEnemyAction | null)[] = [
  null,
  'skeleton-claw-a',
  'skeleton-claw-b',
  'skeleton-weapon',
  'skeleton-pike',
  'archer-shot',
  'mage-cast-short',
  'mage-cast-long',
  'imp-contact',
  'zombie-swipe',
  'wraith-drain',
  'demon-claw',
  'demon-bomb',
  'coffin-open',
  'maggot-bite',
]

const ANIMATION_STATES: readonly BoneyardEnemyAnimationState[] = [
  'idle',
  'locomotion',
  'action',
  'death',
]

const COFFIN_STATES: readonly BoneyardEnemyCoffinState[] = [
  'hidden',
  'closed',
  'opening',
  'transition-delay',
  'open',
]

export const BONEYARD_ENEMY_ENTITY_REGISTRATION = {
  name: 'boneyard-enemy',
  typeId: BONEYARD_ENEMY_ENTITY_TYPE_ID,
  descriptorIsValid(descriptor: ReplicatedEntityDescriptor): boolean {
    if (
      descriptor.length !== DESCRIPTOR_LENGTH
      || descriptor[0] !== BONEYARD_ENEMY_ENTITY_TYPE_ID
      || !entityId(descriptor[1])
      || descriptor[1] === 0
      || !arrayIndex(descriptor[2], FAMILIES.length)
      || !Number.isSafeInteger(descriptor[3])
      || !Number.isSafeInteger(descriptor[4])
      || descriptor[4] < 0
      || !Number.isFinite(descriptor[5])
      || descriptor[5] <= 0
      || !Number.isSafeInteger(descriptor[6])
      || descriptor[6] < 0
      || descriptor[6] >= 2 ** BONEYARD_ENEMY_FLAGS.length
    ) return false
    return BONEYARD_WAVE_ENEMY_TYPES[FAMILIES[descriptor[2]]!] === descriptor[3]
  },
  sampleIsValid(sample: ReplicatedEntitySample): boolean {
    return sample.length === SAMPLE_LENGTH
      && sample[0] === BONEYARD_ENEMY_ENTITY_TYPE_ID
      && entityId(sample[1])
      && sample[1] > 0
      && sample.slice(2).every(Number.isSafeInteger)
      && cyclic(sample[4], 360, ANGLE_SCALE)
      && arrayIndex(sample[6], ANIMATION_STATES.length)
      && arrayIndex(sample[7], ACTIONS.length)
      && ((sample[6] === 2) === (sample[7] !== 0))
      && sample[9] >= 0 && sample[9] <= VALUE_SCALE
      && (sample[12] === -1 || sample[12] >= 0)
      && arrayIndex(sample[13], COFFIN_STATES.length)
      && sample[14] >= 0
      && sample[15] >= 0
      && sample[17] >= 0 && sample[17] <= VALUE_SCALE
  },
}

export function boneyardEnemyDescriptor(
  enemy: BoneyardEnemySnapshot,
): ReplicatedEntityDescriptor {
  return [
    BONEYARD_ENEMY_ENTITY_TYPE_ID,
    enemy.id,
    requiredIndex(FAMILIES, enemy.enemyToken, 'enemy family'),
    enemy.nativeTypeId,
    enemy.spawnTick,
    enemy.maximumHealth,
    encodeFlags(enemy.flags),
  ]
}

export function boneyardEnemySample(
  enemy: BoneyardEnemySnapshot,
): ReplicatedEntitySample {
  const animation = enemy.animation
  return [
    BONEYARD_ENEMY_ENTITY_TYPE_ID,
    enemy.id,
    quantize(enemy.position.x, POSITION_SCALE),
    quantize(enemy.position.y, POSITION_SCALE),
    quantizeCyclic(enemy.headingDeg, 360, ANGLE_SCALE),
    quantize(enemy.currentHealth, VALUE_SCALE),
    requiredIndex(ANIMATION_STATES, animation.state, 'animation state'),
    requiredIndex(ACTIONS, animation.action, 'enemy action'),
    quantize(animation.actionProgress, VALUE_SCALE),
    quantize(animation.alpha, VALUE_SCALE),
    quantize(animation.bodyPose, VALUE_SCALE),
    quantize(animation.coffinPose, VALUE_SCALE),
    animation.coffinSecondaryPose === null
      ? -1
      : quantize(animation.coffinSecondaryPose, VALUE_SCALE),
    requiredIndex(COFFIN_STATES, animation.coffinState, 'coffin state'),
    animation.deathEpoch,
    animation.deathTick,
    quantize(animation.gaitPose, VALUE_SCALE),
    quantize(animation.hitFlash, VALUE_SCALE),
    animation.impEffectFrame,
    quantize(animation.verticalOffset, VALUE_SCALE),
    quantize(animation.zombieAngularOffsetDeg, VALUE_SCALE),
    quantize(animation.zombieFrontArmPose, VALUE_SCALE),
    quantize(animation.zombieFrontArmRotationRadians, VALUE_SCALE),
    quantize(animation.zombieRearArmPose, VALUE_SCALE),
    quantize(animation.zombieRearArmRotationRadians, VALUE_SCALE),
    quantize(animation.demonFrontJointRotationRadians, VALUE_SCALE),
    quantize(animation.demonFrontLimbRotationRadians, VALUE_SCALE),
    quantize(animation.demonRearJointRotationRadians, VALUE_SCALE),
    quantize(animation.demonRearLimbRotationRadians, VALUE_SCALE),
  ]
}

export function materializeBoneyardEnemy(
  descriptor: ReplicatedEntityDescriptor,
  sample: ReplicatedEntitySample,
): BoneyardEnemySnapshot {
  if (!BONEYARD_ENEMY_ENTITY_REGISTRATION.descriptorIsValid(descriptor)) {
    throw new Error('Boneyard enemy descriptor shape is invalid')
  }
  if (!BONEYARD_ENEMY_ENTITY_REGISTRATION.sampleIsValid(sample)) {
    throw new Error('Boneyard enemy sample shape is invalid')
  }
  if (descriptor[1] !== sample[1]) {
    throw new Error('Boneyard enemy sample identity does not match its descriptor')
  }
  return {
    animation: {
      action: ACTIONS[sample[7]]!,
      actionProgress: dequantize(sample[8], VALUE_SCALE),
      alpha: dequantize(sample[9], VALUE_SCALE),
      bodyPose: dequantize(sample[10], VALUE_SCALE),
      coffinPose: dequantize(sample[11], VALUE_SCALE),
      coffinSecondaryPose: sample[12] === -1
        ? null
        : dequantize(sample[12], VALUE_SCALE),
      coffinState: COFFIN_STATES[sample[13]]!,
      deathEpoch: sample[14],
      deathTick: sample[15],
      demonFrontJointRotationRadians: dequantize(sample[25], VALUE_SCALE),
      demonFrontLimbRotationRadians: dequantize(sample[26], VALUE_SCALE),
      demonRearJointRotationRadians: dequantize(sample[27], VALUE_SCALE),
      demonRearLimbRotationRadians: dequantize(sample[28], VALUE_SCALE),
      effects: [],
      gaitPose: dequantize(sample[16], VALUE_SCALE),
      hitFlash: dequantize(sample[17], VALUE_SCALE),
      impEffectFrame: sample[18],
      maggots: [],
      state: ANIMATION_STATES[sample[6]]!,
      verticalOffset: dequantize(sample[19], VALUE_SCALE),
      zombieAngularOffsetDeg: dequantize(sample[20], VALUE_SCALE),
      zombieFrontArmPose: dequantize(sample[21], VALUE_SCALE),
      zombieFrontArmRotationRadians: dequantize(sample[22], VALUE_SCALE),
      zombieRearArmPose: dequantize(sample[23], VALUE_SCALE),
      zombieRearArmRotationRadians: dequantize(sample[24], VALUE_SCALE),
    },
    currentHealth: dequantize(sample[5], VALUE_SCALE),
    enemyToken: FAMILIES[descriptor[2]]!,
    flags: decodeFlags(descriptor[6]),
    headingDeg: dequantize(sample[4], ANGLE_SCALE),
    id: descriptor[1],
    maximumHealth: descriptor[5],
    nativeTypeId: descriptor[3],
    position: {
      x: dequantize(sample[2], POSITION_SCALE),
      y: dequantize(sample[3], POSITION_SCALE),
    },
    spawnTick: descriptor[4],
  }
}

function encodeFlags(flags: readonly string[]): number {
  let mask = 0
  for (const flag of flags) {
    const index = (BONEYARD_ENEMY_FLAGS as readonly string[]).indexOf(flag)
    if (index < 0) throw new Error(`unsupported Boneyard enemy flag ${flag}`)
    mask += 2 ** index
  }
  return mask
}

function decodeFlags(mask: number): readonly string[] {
  return BONEYARD_ENEMY_FLAGS.filter((_, index) => (
    Math.floor(mask / 2 ** index) % 2 === 1
  ))
}

function requiredIndex<T>(source: readonly T[], value: T, label: string): number {
  const index = source.indexOf(value)
  if (index < 0) throw new Error(`unsupported ${label} ${String(value)}`)
  return index
}

function quantize(value: number, scale: number): number {
  if (!Number.isFinite(value)) throw new Error('enemy sample contains a non-finite value')
  return Math.round(value * scale)
}

function quantizeCyclic(value: number, period: number, scale: number): number {
  return Math.round((((value % period) + period) % period) * scale) % (period * scale)
}

function dequantize(value: number, scale: number): number {
  return value / scale
}

function entityId(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function arrayIndex(value: number, length: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < length
}

function cyclic(value: number, period: number, scale: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < period * scale
}
