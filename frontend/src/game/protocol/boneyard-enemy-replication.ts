import { BONEYARD_ARROW_TYPES, BONEYARD_ENEMY_CLASSIFICATIONS, BONEYARD_MAGE_ELEMENTS, BONEYARD_SKELETON_WEAPONS } from '../core-kernels/boneyard-enemy-config-model.ts'
import { BONEYARD_ENEMY_FLAGS } from '../core-kernels/boneyard-enemy-config.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import type { BoneyardEnemyAction, BoneyardEnemyAnimationState, BoneyardEnemyCoffinState, BoneyardEnemyEffectSnapshot, BoneyardEnemySnapshot } from './game-state.ts'
import { BONEYARD_ENEMY_EFFECT_ROLES } from './game-state.ts'
import type { ReplicatedEntityDescriptor, ReplicatedEntitySample } from './replicated-entity-types.ts'
export const BONEYARD_ENEMY_ENTITY_TYPE_ID = 2

const POSITION_SCALE = 16
const ANGLE_SCALE = 64
const VALUE_SCALE = 1024
const DESCRIPTOR_COMPONENTS = 31
const nameEncoder = new TextEncoder()
const nameDecoder = new TextDecoder('utf-8', { fatal: true })
const EFFECT_COMPONENT_OFFSET = 72
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
  'PORTAL',
  'SPIDER',
  'COCOON',
  'HEARTMONGER',
  'DIREFACULTY',
  'DEMONSKULL',
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
  'zombie-beat',
  'wraith-drain',
  'demon-bomb',
  'faculty-throw',
  'faculty-two-hand',
  'faculty-lightning',
  'demon-skull-bite',
  'demon-skull-eyes',
  'demon-skull-mouth',
  'demon-skull-spit',
  'demon-skull-flair',
  'demon-skull-scream',

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
      descriptor.length < DESCRIPTOR_COMPONENTS
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
      || (descriptor[11] !== -1 && descriptor[11] !== 1)
      || !Number.isSafeInteger(descriptor[12])
      || Math.abs(descriptor[12]) > Math.ceil(Math.PI / 12 * VALUE_SCALE)
      || !Number.isFinite(descriptor[13])
      || descriptor[13] <= 0
    ) return false
    if (!arrayIndex(descriptor[14], 6)
      || !arrayIndex(descriptor[15], BONEYARD_SKELETON_WEAPONS.length)
      || !arrayIndex(descriptor[16], BONEYARD_ENEMY_CLASSIFICATIONS.length)
      || !arrayIndex(descriptor[17], 2)
      || !arrayIndex(descriptor[18], BONEYARD_ARROW_TYPES.length)
      || !arrayIndex(descriptor[19], BONEYARD_MAGE_ELEMENTS.length)
      || !arrayIndex(descriptor[20], 2)
      || !arrayIndex(descriptor[22], 2)
      || !descriptor.slice(23, 31).every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
      || !validNameDescriptor(descriptor)) return false
    const family = FAMILIES[descriptor[2]]!
    return (BONEYARD_WAVE_ENEMY_TYPES[family] === descriptor[3] || family === 'IMP' && descriptor[3] === 2044)
      && (descriptor[7] === 0 || family === 'SKELETON')
      && descriptor[8] === 0
      && nonnegativeInteger(descriptor[9])
      && (descriptor[10] === 0 || family === 'SKELETONMAGE')
      && (family === 'COFFIN' || (descriptor[11] === 1 && descriptor[12] === 0))
      && (family === 'DIREFACULTY' || descriptor.slice(22, 31).every((value) => value === 0))
  },
  sampleIsValid(sample: ReplicatedEntitySample): boolean {
    return sample.length === SAMPLE_LENGTH
      && (sample[52] === 0 || sample[52] === 1)
      && arrayIndex(sample[57], 3)
      && [58, 59, 60, 64].every(index => sample[index] >= 0 && sample[index] <= VALUE_SCALE)
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
      && arrayIndex(sample[27], 2)
      && sample[28] >= -1 && sample[28] <= 3
      && sample[29] >= -1 && sample[29] <= 3
      && sample[30] >= 0
      && sample[31] >= sample[30]
      && sample[33] >= 0 && sample[33] <= VALUE_SCALE
      && sample[37] >= 0 && sample[37] <= VALUE_SCALE
      && sample[38] >= 0 && sample[38] <= VALUE_SCALE
      && sample[39] >= 0 && sample[39] <= 2
      && sample[40] >= -1 && sample[40] <= 1
      && (sample[40] === 0 || sample[6] === 2)
      && sample[41] >= 0
      && sample[66] >= 0
      && sample.slice(42, 46).every((value) => Math.abs(value) <= POSITION_SCALE * 256)
      && (sample[47] === 0 || sample[47] === 1)
      && arrayIndex(sample[48], 4)
      && sample[50] >= 0 && sample[50] <= VALUE_SCALE
      && cyclic(sample[51], 360, ANGLE_SCALE)
      && (sample[46] === -1 || cyclic(sample[46], 360, ANGLE_SCALE))
      && (sample[69] === -1 || cyclic(sample[69], 360, ANGLE_SCALE))
      && sample[70] >= 0 && sample[70] <= VALUE_SCALE
      && sample[71] >= 0 && sample[71] <= 0xffffff
      && (sample[69] !== -1 || (sample[70] === 0 && sample[71] === 0))
      && effectComponentsAreValid(sample)
  },
}

export function boneyardEnemyDescriptor(
  enemy: BoneyardEnemySnapshot,
): ReplicatedEntityDescriptor {
  const name = enemy.name === null ? null : nameEncoder.encode(enemy.name)
  if (name !== null && name.length > 128) throw new Error('enemy name exceeds 128 UTF-8 bytes')
  if ((enemy.enemyToken === 'DIREFACULTY') !== (enemy.faculty !== undefined)) {
    throw new Error('Faculty descriptor requires its appearance')
  }
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
    enemy.animation.coffinScaleX,
    quantize(enemy.animation.coffinRotationRadians, VALUE_SCALE),
    enemy.scale,
    enemy.headgear,
    requiredIndex(BONEYARD_SKELETON_WEAPONS, enemy.weapon, 'Skeleton weapon'),
    requiredIndex(BONEYARD_ENEMY_CLASSIFICATIONS, enemy.classification, 'enemy classification'),
    Number(enemy.burning),
    requiredIndex(BONEYARD_ARROW_TYPES, enemy.arrowType, 'arrow type'),
    requiredIndex(BONEYARD_MAGE_ELEMENTS, enemy.mageElement, 'Mage element'),
    Number(enemy.rotten),
    name?.length ?? -1,
    Number(enemy.faculty?.female ?? false),
    ...(enemy.faculty?.bodyColor ?? [0, 0, 0, 0]),
    ...(enemy.faculty?.headColor ?? [0, 0, 0, 0]),
    ...(name ?? []),
  ]
}

export function boneyardEnemySample(
  enemy: BoneyardEnemySnapshot,
): ReplicatedEntitySample {
  const animation = enemy.animation
  if ((enemy.enemyToken === 'SPIDER') !== (animation.spider !== null)) {
    throw new Error('Boneyard Spider sample does not match the enemy family')
  }
  if (enemy.enemyToken !== 'DEMON' && !demonOffsetsAreZero(animation)) {
    throw new Error('Boneyard Demon endpoint offsets require a Demon family')
  }
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
    quantize(animation.demonFrontRotationRadians, VALUE_SCALE),
    quantize(animation.demonRearRotationRadians, VALUE_SCALE),
    animation.zombieAttackSide,
    animation.zombieBodyType,
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
    quantize(animation.stridePhaseDeg, VALUE_SCALE),
    quantize(animation.demonFrontExtremityOffset.x, POSITION_SCALE),
    quantize(animation.demonFrontExtremityOffset.y, POSITION_SCALE),
    quantize(animation.demonRearExtremityOffset.x, POSITION_SCALE),
    quantize(animation.demonRearExtremityOffset.y, POSITION_SCALE),
    animation.limbHeadingDeg === null ? -1 : quantizeCyclic(animation.limbHeadingDeg, 360, ANGLE_SCALE),
    animation.headVariant,
    enemy.faculty?.handMask ?? 0,
    quantize(enemy.faculty?.lightPhase ?? 0, ANGLE_SCALE),
    quantize(enemy.faculty?.lightIntensity ?? 0, VALUE_SCALE),
    quantizeCyclic(enemy.faculty?.bodyHeadingDeg ?? 0, 360, ANGLE_SCALE),
    Number(enemy.faculty?.lightningActive ?? false),
    quantize(enemy.demonSkull?.bodyHeadingDeg ?? 0, ANGLE_SCALE),
    quantize(enemy.demonSkull?.bodyOffset.x ?? 0, POSITION_SCALE),
    quantize(enemy.demonSkull?.bodyOffset.y ?? 0, POSITION_SCALE),
    quantize(enemy.demonSkull?.bodyPhaseDeg ?? 0, ANGLE_SCALE),
    enemy.demonSkull?.bodyPose ?? 0,
    quantize(enemy.demonSkull?.chargeGlow ?? 0, VALUE_SCALE),
    quantize(enemy.demonSkull?.eyeCharge ?? 0, VALUE_SCALE),
    quantize(enemy.demonSkull?.flairGlow ?? 0, VALUE_SCALE),
    quantize(enemy.demonSkull?.flickerPhaseDeg ?? 0, ANGLE_SCALE),
    quantize(enemy.demonSkull?.jitter.x ?? 0, POSITION_SCALE),
    quantize(enemy.demonSkull?.jitter.y ?? 0, POSITION_SCALE),
    quantize(enemy.demonSkull?.lightIntensity ?? 0, VALUE_SCALE),
    quantize(enemy.demonSkull?.spin ?? 0, ANGLE_SCALE),
    quantize(animation.shadowLateralOffset, VALUE_SCALE),
    quantize(animation.demonShadowOffset.x, POSITION_SCALE),
    quantize(animation.demonShadowOffset.y, POSITION_SCALE),
    animation.spider === null ? -1 : quantizeCyclic(animation.spider.bodyHeadingDeg, 360, ANGLE_SCALE),
    quantize(animation.spider?.outlineAlpha ?? 0, VALUE_SCALE),
    animation.spider?.outlineTint ?? 0,
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
  if ((family === 'SPIDER') !== (sample[69] !== -1)) {
    throw new Error('Boneyard Spider sample does not match the enemy family')
  }
  if (family === 'SPIDER' && (sample[10] < 0 || sample[10] > 3 * VALUE_SCALE || sample[10] % VALUE_SCALE !== 0)) {
    throw new Error('Boneyard Spider pose is outside its four banks')
  }
  if (
    sample[40] !== 0
    && family !== 'SKELETON'
    && family !== 'SKELETONMAGE'
  ) {
    throw new Error('Boneyard enemy head-facing offset is invalid for its family')
  }
  const demonFrontExtremityOffset = {
    x: dequantize(sample[42], POSITION_SCALE),
    y: dequantize(sample[43], POSITION_SCALE),
  }
  const demonRearExtremityOffset = {
    x: dequantize(sample[44], POSITION_SCALE),
    y: dequantize(sample[45], POSITION_SCALE),
  }
  if (
    family !== 'DEMON'
    && (
      demonFrontExtremityOffset.x !== 0
      || demonFrontExtremityOffset.y !== 0
      || demonRearExtremityOffset.x !== 0
      || demonRearExtremityOffset.y !== 0
      || sample[67] !== 0
      || sample[68] !== 0
    )
  ) throw new Error('Boneyard Demon endpoint offsets do not match the enemy family')
  if (family !== 'DEMONSKULL' && sample.slice(53, 66).some(value => value !== 0)) {
    throw new Error('DemonSkull visual fields do not match the enemy family')
  }
  return {
    ...(family !== 'DEMONSKULL' ? {} : { demonSkull: {
      bodyHeadingDeg: dequantize(sample[53], ANGLE_SCALE),
      bodyOffset: { x: dequantize(sample[54], POSITION_SCALE), y: dequantize(sample[55], POSITION_SCALE) },
      bodyPhaseDeg: dequantize(sample[56], ANGLE_SCALE), bodyPose: sample[57],
      chargeGlow: dequantize(sample[58], VALUE_SCALE), eyeCharge: dequantize(sample[59], VALUE_SCALE),
      flairGlow: dequantize(sample[60], VALUE_SCALE), flickerPhaseDeg: dequantize(sample[61], ANGLE_SCALE),
      jitter: { x: dequantize(sample[62], POSITION_SCALE), y: dequantize(sample[63], POSITION_SCALE) },
      lightIntensity: dequantize(sample[64], VALUE_SCALE), spin: dequantize(sample[65], ANGLE_SCALE),
    } }),
    animation: {
      spider: sample[69] === -1 ? null : {
        bodyHeadingDeg: dequantize(sample[69], ANGLE_SCALE),
        outlineAlpha: dequantize(sample[70], VALUE_SCALE),
        outlineTint: sample[71],
      },
      action: ACTIONS[sample[7]]!,
      actionProgress: dequantize(sample[8], VALUE_SCALE),
      alpha: dequantize(sample[9], VALUE_SCALE),
      bodyPose: dequantize(sample[10], VALUE_SCALE),
      coffinPose: dequantize(sample[11], VALUE_SCALE),
      coffinRotationRadians: dequantize(descriptor[12], VALUE_SCALE),
      coffinScaleX: descriptor[11] as -1 | 1,
      coffinSecondaryPose: sample[12] === -1
        ? null
        : dequantize(sample[12], VALUE_SCALE),
      coffinState: COFFIN_STATES[sample[13]]!,
      deathEpoch: sample[14],
      deathTick: sample[15],
      demonFrontExtremityOffset,
      demonFrontRotationRadians: dequantize(sample[25], VALUE_SCALE),
      demonRearExtremityOffset,
      demonRearRotationRadians: dequantize(sample[26], VALUE_SCALE),
      effects: decodeEffects(sample),
      gaitPose: dequantize(sample[16], VALUE_SCALE),
      shadowLateralOffset: dequantize(sample[66], VALUE_SCALE),
      demonShadowOffset: { x: dequantize(sample[67], POSITION_SCALE), y: dequantize(sample[68], POSITION_SCALE) },
      headFacingOffset: sample[40] as -1 | 0 | 1,
      hitFlash: dequantize(sample[17], VALUE_SCALE),
      impEffectFrame: sample[18],
      headVariant: sample[47] as 0 | 1,
      limbHeadingDeg: sample[46] === -1 ? null : dequantize(sample[46], ANGLE_SCALE),
      impBodyRotationRadians: dequantize(sample[32], VALUE_SCALE),
      impEffectAlpha: dequantize(sample[33], VALUE_SCALE),
      maggots: [],
      state: ANIMATION_STATES[sample[6]]!,
      stridePhaseDeg: dequantize(sample[41], VALUE_SCALE),
      verticalOffset: dequantize(sample[19], VALUE_SCALE),
      zombieAngularOffsetDeg: dequantize(sample[20], VALUE_SCALE),
      zombieAttackSide: sample[27] as 0 | 1,
      zombieBodyRotationRadians: dequantize(sample[34], VALUE_SCALE),
      zombieBodyType: sample[28],
      zombieFrontArmPose: dequantize(sample[21], VALUE_SCALE),
      zombieFrontArmRotationRadians: dequantize(sample[22], VALUE_SCALE),
      zombieHeadType: sample[29],
      zombieHeadRotationRadians: dequantize(sample[35], VALUE_SCALE),
      zombieRearArmPose: dequantize(sample[23], VALUE_SCALE),
      zombieRearArmRotationRadians: dequantize(sample[24], VALUE_SCALE),
    },
    ...(family === 'DIREFACULTY' ? { faculty: {
      lightningActive: sample[52] === 1,
      bodyColor: [descriptor[23]!, descriptor[24]!, descriptor[25]!, descriptor[26]!] as const,
      female: descriptor[22] === 1, handMask: sample[48]!,
      bodyHeadingDeg: dequantize(sample[51], ANGLE_SCALE),
      headColor: [descriptor[27]!, descriptor[28]!, descriptor[29]!, descriptor[30]!] as const,
      lightPhase: dequantize(sample[49], ANGLE_SCALE), lightIntensity: dequantize(sample[50], VALUE_SCALE),
    } } : {}),
    armored: descriptor[7] === 1,
    classification: BONEYARD_ENEMY_CLASSIFICATIONS[descriptor[16]]!,
    headgear: descriptor[14] as 0 | 1 | 2 | 3 | 4 | 5,
    burning: descriptor[17] === 1,
    arrowType: BONEYARD_ARROW_TYPES[descriptor[18]]!,
    mageElement: BONEYARD_MAGE_ELEMENTS[descriptor[19]]!,
    rotten: descriptor[20] === 1,
    name: descriptor[21] === -1 ? null : nameDecoder.decode(new Uint8Array(descriptor.slice(DESCRIPTOR_COMPONENTS))),
    weapon: BONEYARD_SKELETON_WEAPONS[descriptor[15]]!,
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
      charge: dequantize(sample[38], VALUE_SCALE),
      glow: dequantize(sample[37], VALUE_SCALE),
      providerCopies: sample[39] as 0 | 1 | 2,
    },
    mageCloak: descriptor[10] === 1,
    maximumHealth: descriptor[5],
    nativeTypeId: descriptor[3],
    position: {
      x: dequantize(sample[2], POSITION_SCALE),
      y: dequantize(sample[3], POSITION_SCALE),
    },
    scale: descriptor[13],
    shieldHealth: dequantize(sample[30], VALUE_SCALE),
    shieldMaximumHealth: dequantize(sample[31], VALUE_SCALE),
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
  return Array.from({ length: sample[36] }, (_, index) => {
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
  const count = sample[36]
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

function demonOffsetsAreZero(animation: BoneyardEnemySnapshot['animation']): boolean {
  return animation.demonFrontExtremityOffset.x === 0
    && animation.demonFrontExtremityOffset.y === 0
    && animation.demonRearExtremityOffset.x === 0
    && animation.demonRearExtremityOffset.y === 0
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

function validNameDescriptor(descriptor: ReplicatedEntityDescriptor): boolean {
  const length = descriptor[21]
  if (length === -1) return descriptor.length === DESCRIPTOR_COMPONENTS
  if (!Number.isSafeInteger(length) || length < 0 || length > 128
    || descriptor.length !== DESCRIPTOR_COMPONENTS + length) return false
  const bytes = descriptor.slice(DESCRIPTOR_COMPONENTS)
  if (bytes.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false
  try {
    nameDecoder.decode(new Uint8Array(bytes))
    return true
  } catch {
    return false
  }
}
