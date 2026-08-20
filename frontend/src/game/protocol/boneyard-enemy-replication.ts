import { BONEYARD_ENEMY_FLAGS } from '../core-kernels/boneyard-enemy-config.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import type {
  BoneyardEnemyAction,
  BoneyardEnemyAnimationState,
  BoneyardEnemyCoffinState,
  BoneyardEnemyEffectSnapshot,
  BoneyardEnemySnapshot,
} from './game-state.ts'
import { BONEYARD_ENEMY_EFFECT_ROLES } from './game-state.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'

export const BONEYARD_ENEMY_ENTITY_TYPE_ID = 2

const POSITION_SCALE = 16
const ANGLE_SCALE = 64
const VALUE_SCALE = 1024
const DESCRIPTOR_LENGTH = 11
const EFFECT_COMPONENT_OFFSET = 44
const EFFECT_COMPONENT_COUNT = 10
const MAX_EFFECTS = 1
const SAMPLE_LENGTH = EFFECT_COMPONENT_OFFSET + EFFECT_COMPONENT_COUNT * MAX_EFFECTS

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
  'zombie-beat',
  'wraith-drain',
  'demon-bomb',
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

const EFFECT_ATLASES = ['BadGuys', 'DeadHawg'] as const
const EFFECT_BLEND_MODES = ['add', 'normal'] as const

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
      || (descriptor[7] !== 0 && descriptor[7] !== 1)
      || (descriptor[10] !== 0 && descriptor[10] !== 1)
    ) return false
    const family = FAMILIES[descriptor[2]]!
    return BONEYARD_WAVE_ENEMY_TYPES[family] === descriptor[3]
      && (descriptor[7] === 0 || family === 'SKELETON')
      && descriptor[8] === 0
      && nonnegativeInteger(descriptor[9])
      && (descriptor[10] === 0 || family === 'SKELETONMAGE')
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
      && arrayIndex(sample[29], 2)
      && sample[30] >= -1 && sample[30] <= 2
      && sample[31] >= -1 && sample[31] <= 1
      && sample[32] >= -1 && sample[32] <= 2
      && sample[33] >= 0
      && sample[34] >= sample[33]
      && sample[36] >= 0 && sample[36] <= VALUE_SCALE
      && sample[40] >= 0 && sample[40] <= VALUE_SCALE
      && sample[41] >= 0 && sample[41] <= VALUE_SCALE
      && sample[42] >= 0 && sample[42] <= 2
      && sample[43] >= -1 && sample[43] <= 1
      && (sample[43] === 0 || sample[6] === 2)
      && effectComponentsAreValid(sample)
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
    Number(enemy.armored),
    enemy.lightRegistration.managerLane === 'actor' ? 0 : -1,
    enemy.lightRegistration.registrationOrdinal,
    Number(enemy.mageCloak),
  ]
}

export function boneyardEnemySample(
  enemy: BoneyardEnemySnapshot,
): ReplicatedEntitySample {
  const animation = enemy.animation
  if (
    animation.headFacingOffset !== 0
    && (
      animation.state !== 'action'
      || (enemy.enemyToken !== 'SKELETON' && enemy.enemyToken !== 'SKELETONMAGE')
    )
  ) {
    throw new Error('Boneyard enemy head-facing offset requires an active Skeleton or Mage')
  }
  const effectComponents = encodeEffects(animation.effects)
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
    animation.zombieAttackSide,
    animation.zombieBodyType,
    animation.zombieFlyblownSide,
    animation.zombieHeadType,
    quantize(enemy.shieldHealth, VALUE_SCALE),
    quantize(enemy.shieldMaximumHealth, VALUE_SCALE),
    quantize(animation.impBodyRotationRadians, VALUE_SCALE),
    quantize(animation.impEffectAlpha, VALUE_SCALE),
    quantize(animation.zombieBodyRotationRadians, VALUE_SCALE),
    quantize(animation.zombieHeadRotationRadians, VALUE_SCALE),
    animation.effects.length,
    quantize(enemy.lighting.glow, VALUE_SCALE),
    quantize(enemy.lighting.charge, VALUE_SCALE),
    enemy.lighting.providerCopies,
    animation.headFacingOffset,
    ...effectComponents,
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
  const family = FAMILIES[descriptor[2]]!
  if (
    sample[43] !== 0
    && family !== 'SKELETON'
    && family !== 'SKELETONMAGE'
  ) {
    throw new Error('Boneyard enemy head-facing offset is invalid for its family')
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
      effects: decodeEffects(sample),
      gaitPose: dequantize(sample[16], VALUE_SCALE),
      headFacingOffset: sample[43] as -1 | 0 | 1,
      hitFlash: dequantize(sample[17], VALUE_SCALE),
      impEffectFrame: sample[18],
      impBodyRotationRadians: dequantize(sample[35], VALUE_SCALE),
      impEffectAlpha: dequantize(sample[36], VALUE_SCALE),
      maggots: [],
      state: ANIMATION_STATES[sample[6]]!,
      verticalOffset: dequantize(sample[19], VALUE_SCALE),
      zombieAngularOffsetDeg: dequantize(sample[20], VALUE_SCALE),
      zombieAttackSide: sample[29] as 0 | 1,
      zombieBodyRotationRadians: dequantize(sample[37], VALUE_SCALE),
      zombieBodyType: sample[30],
      zombieFlyblownSide: sample[31],
      zombieFrontArmPose: dequantize(sample[21], VALUE_SCALE),
      zombieFrontArmRotationRadians: dequantize(sample[22], VALUE_SCALE),
      zombieHeadType: sample[32],
      zombieHeadRotationRadians: dequantize(sample[38], VALUE_SCALE),
      zombieRearArmPose: dequantize(sample[23], VALUE_SCALE),
      zombieRearArmRotationRadians: dequantize(sample[24], VALUE_SCALE),
    },
    armored: descriptor[7] === 1,
    currentHealth: dequantize(sample[5], VALUE_SCALE),
    enemyToken: family,
    flags: decodeFlags(descriptor[6]),
    headingDeg: dequantize(sample[4], ANGLE_SCALE),
    id: descriptor[1],
    lightRegistration: {
      managerLane: 'actor',
      registrationOrdinal: descriptor[9],
    },
    lighting: {
      charge: dequantize(sample[41], VALUE_SCALE),
      glow: dequantize(sample[40], VALUE_SCALE),
      providerCopies: sample[42] as 0 | 1 | 2,
    },
    mageCloak: descriptor[10] === 1,
    maximumHealth: descriptor[5],
    nativeTypeId: descriptor[3],
    position: {
      x: dequantize(sample[2], POSITION_SCALE),
      y: dequantize(sample[3], POSITION_SCALE),
    },
    shieldHealth: dequantize(sample[33], VALUE_SCALE),
    shieldMaximumHealth: dequantize(sample[34], VALUE_SCALE),
    spawnTick: descriptor[4],
  }
}

function encodeEffects(effects: readonly BoneyardEnemyEffectSnapshot[]): number[] {
  if (effects.length > MAX_EFFECTS) {
    throw new Error(`Boneyard enemy may contain at most ${MAX_EFFECTS} effects`)
  }
  if (new Set(effects.map((effect) => effect.id)).size !== effects.length) {
    throw new Error('Boneyard enemy effects must have unique ids')
  }
  if (new Set(effects.map((effect) => effect.role)).size !== effects.length) {
    throw new Error('Boneyard enemy effects must have unique roles')
  }
  const components: number[] = []
  for (let index = 0; index < MAX_EFFECTS; index += 1) {
    const effect = effects[index]
    if (!effect) {
      components.push(...Array<number>(EFFECT_COMPONENT_COUNT).fill(0))
      continue
    }
    components.push(
      requiredIndex(BONEYARD_ENEMY_EFFECT_ROLES, effect.role, 'enemy effect role'),
      requiredIndex(EFFECT_ATLASES, effect.atlas, 'enemy effect atlas'),
      requiredIndex(EFFECT_BLEND_MODES, effect.blendMode, 'enemy effect blend mode'),
      effect.entry,
      effect.id,
      quantize(effect.alpha, VALUE_SCALE),
      quantize(effect.offset.x, POSITION_SCALE),
      quantize(effect.offset.y, POSITION_SCALE),
      quantize(effect.rotationRadians, VALUE_SCALE),
      quantize(effect.scale, VALUE_SCALE),
    )
  }
  return components
}

function decodeEffects(sample: ReplicatedEntitySample): readonly BoneyardEnemyEffectSnapshot[] {
  return Array.from({ length: sample[39] }, (_, index) => {
    const offset = EFFECT_COMPONENT_OFFSET + index * EFFECT_COMPONENT_COUNT
    return {
      alpha: dequantize(sample[offset + 5], VALUE_SCALE),
      atlas: EFFECT_ATLASES[sample[offset + 1]]!,
      blendMode: EFFECT_BLEND_MODES[sample[offset + 2]]!,
      entry: sample[offset + 3],
      id: sample[offset + 4],
      offset: {
        x: dequantize(sample[offset + 6], POSITION_SCALE),
        y: dequantize(sample[offset + 7], POSITION_SCALE),
      },
      role: BONEYARD_ENEMY_EFFECT_ROLES[sample[offset]]!,
      rotationRadians: dequantize(sample[offset + 8], VALUE_SCALE),
      scale: dequantize(sample[offset + 9], VALUE_SCALE),
    }
  })
}

function effectComponentsAreValid(sample: ReplicatedEntitySample): boolean {
  const count = sample[39]
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_EFFECTS) return false
  const ids = new Set<number>()
  const roles = new Set<number>()
  for (let index = 0; index < MAX_EFFECTS; index += 1) {
    const offset = EFFECT_COMPONENT_OFFSET + index * EFFECT_COMPONENT_COUNT
    const components = sample.slice(offset, offset + EFFECT_COMPONENT_COUNT)
    if (index >= count) {
      if (components.some((component) => component !== 0)) return false
      continue
    }
    const role = sample[offset]
    const atlas = sample[offset + 1]
    const blendMode = sample[offset + 2]
    const entry = sample[offset + 3]
    const id = sample[offset + 4]
    if (
      !arrayIndex(role, BONEYARD_ENEMY_EFFECT_ROLES.length)
      || !arrayIndex(atlas, EFFECT_ATLASES.length)
      || !arrayIndex(blendMode, EFFECT_BLEND_MODES.length)
      || !Number.isSafeInteger(entry)
      || entry < 0
      || !entityId(id)
      || id === 0
      || sample[offset + 5] < 0
      || sample[offset + 5] > VALUE_SCALE * 1.25
      || (
        BONEYARD_ENEMY_EFFECT_ROLES[role] !== 'magic-shield'
        && sample[offset + 5] > VALUE_SCALE
      )
      || sample[offset + 9] <= 0
      || !effectShapeMatchesRole(role, atlas, blendMode, entry)
      || ids.has(id)
      || roles.has(role)
    ) return false
    ids.add(id)
    roles.add(role)
  }
  return true
}

function effectShapeMatchesRole(
  role: number,
  atlas: number,
  blendMode: number,
  entry: number,
): boolean {
  switch (BONEYARD_ENEMY_EFFECT_ROLES[role]) {
    case 'magic-shield': return atlas === 0 && blendMode === 0 && entry === 49
    default: return false
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

function nonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function arrayIndex(value: number, length: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < length
}

function cyclic(value: number, period: number, scale: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < period * scale
}
