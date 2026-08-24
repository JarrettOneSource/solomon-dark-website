import {
  BONEYARD_LOOT_KINDS,
  BONEYARD_LOOT_SOURCES,
  type BoneyardLootSnapshot,
} from './game-state.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'

export const BONEYARD_LOOT_ENTITY_TYPE_ID = 7

const POSITION_SCALE = 16
const VALUE_SCALE = 1024
const DESCRIPTOR_LENGTH = 14
const SAMPLE_LENGTH = 15
const NATIVE_TYPES = [2038, 2012, 2011, 2013] as const
const NATIVE_LOOT_WORLD_ID_MAXIMUM = 2_047
const GOLD_SCATTER_MAXIMUM = Math.round(8.5 * VALUE_SCALE)
const BONUS_FRAME_MAXIMUM = 18 * VALUE_SCALE

export const BONEYARD_LOOT_ENTITY_REGISTRATION = {
  name: 'boneyard-loot',
  typeId: BONEYARD_LOOT_ENTITY_TYPE_ID,
  descriptorIsValid(descriptor: ReplicatedEntityDescriptor): boolean {
    if (
      descriptor.length !== DESCRIPTOR_LENGTH
      || descriptor[0] !== BONEYARD_LOOT_ENTITY_TYPE_ID
      || !integerWithin(descriptor[1], 1, NATIVE_LOOT_WORLD_ID_MAXIMUM)
      || !arrayIndex(descriptor[2], BONEYARD_LOOT_KINDS.length)
      || !Number.isSafeInteger(descriptor[3])
      || !arrayIndex(descriptor[4], BONEYARD_LOOT_SOURCES.length)
      || !Number.isSafeInteger(descriptor[5])
      || !Number.isSafeInteger(descriptor[6])
      || !nonnegativeInteger(descriptor[7])
      || !Number.isSafeInteger(descriptor[8])
      || !Number.isSafeInteger(descriptor[9])
      || !Number.isSafeInteger(descriptor[10])
      || !Number.isSafeInteger(descriptor[11])
      || !nonnegativeInteger(descriptor[12])
      || !nonnegativeInteger(descriptor[13])
    ) return false
    const kind = BONEYARD_LOOT_KINDS[descriptor[2]]!
    if (descriptor[3] !== NATIVE_TYPES[descriptor[2]]) return false
    if (kind === 'orb' ? descriptor[5] !== 0 && descriptor[5] !== 1 : descriptor[5] !== -1) {
      return false
    }
    if (kind === 'bonus' ? descriptor[6] < 0 || descriptor[6] > 2 : descriptor[6] !== -1) {
      return false
    }
    if (kind === 'gold' ? descriptor[7] > 3 : descriptor[7] !== 0) return false
    if (kind === 'sack') {
      if (!nativeSackItemIdentity(
        descriptor[8],
        descriptor[9],
        descriptor[10],
        descriptor[11],
      )) return false
    } else if (
      descriptor[8] !== -1 || descriptor[9] !== -1 ||
      descriptor[10] !== -1 || descriptor[11] !== -1
    ) return false
    if (kind === 'gold') {
      if (descriptor[13] > 99_999) return false
    } else if (descriptor[13] !== 0) return false
    return true
  },
  sampleIsValid(sample: ReplicatedEntitySample): boolean {
    return sample.length === SAMPLE_LENGTH
      && sample[0] === BONEYARD_LOOT_ENTITY_TYPE_ID
      && positiveInteger(sample[1])
      && sample.slice(2).every(Number.isSafeInteger)
      && nonnegativeInteger(sample[4])
      && sample[5] >= 0 && sample[5] <= VALUE_SCALE
      && nonnegativeInteger(sample[6])
      && nonnegativeInteger(sample[8])
      && (sample[10] === 0 || sample[10] === 1)
      && integerWithin(sample[11], 0, GOLD_SCATTER_MAXIMUM)
      && integerWithin(sample[12], 0, VALUE_SCALE)
  },
}

export function boneyardLootDescriptor(
  loot: BoneyardLootSnapshot,
): ReplicatedEntityDescriptor {
  const kind = requiredIndex(BONEYARD_LOOT_KINDS, loot.kind)
  const contentId = loot.itemContentId === null ? null : BigInt(loot.itemContentId)
  return [
    BONEYARD_LOOT_ENTITY_TYPE_ID,
    loot.id,
    kind,
    loot.nativeTypeId,
    requiredIndex(BONEYARD_LOOT_SOURCES, loot.source),
    loot.orbKind === null ? -1 : loot.orbKind === 'health' ? 0 : 1,
    loot.bonusKind ?? -1,
    loot.tier,
    loot.itemNativeTypeId ?? -1,
    loot.itemNativeSubtype ?? -1,
    contentId === null ? -1 : Number(contentId >> 32n),
    contentId === null ? -1 : Number(contentId & 0xffff_ffffn),
    loot.spawnTick,
    loot.scatterSeed,
  ]
}

export function boneyardLootSample(
  loot: BoneyardLootSnapshot,
): ReplicatedEntitySample {
  return [
    BONEYARD_LOOT_ENTITY_TYPE_ID,
    loot.id,
    quantize(loot.position.x, POSITION_SCALE),
    quantize(loot.position.y, POSITION_SCALE),
    loot.ageTicks,
    quantize(loot.alpha, VALUE_SCALE),
    loot.amount,
    quantize(loot.animationPhase, VALUE_SCALE),
    quantize(loot.framePhase, VALUE_SCALE),
    quantize(loot.bounceHeight, VALUE_SCALE),
    Number(loot.scatterActive),
    quantize(loot.scatterProgress, VALUE_SCALE),
    quantize(loot.orbValue, VALUE_SCALE),
    loot.activationDelayTicks,
    quantize(loot.rotationDeg, VALUE_SCALE),
  ]
}

export function materializeBoneyardLoot(
  descriptor: ReplicatedEntityDescriptor,
  sample: ReplicatedEntitySample,
): BoneyardLootSnapshot {
  if (!BONEYARD_LOOT_ENTITY_REGISTRATION.descriptorIsValid(descriptor)) {
    throw new Error('Boneyard loot descriptor shape is invalid')
  }
  if (!BONEYARD_LOOT_ENTITY_REGISTRATION.sampleIsValid(sample)) {
    throw new Error('Boneyard loot sample shape is invalid')
  }
  if (descriptor[1] !== sample[1]) {
    throw new Error('Boneyard loot sample identity does not match its descriptor')
  }
  if (!descriptorMatchesSample(descriptor, sample)) {
    throw new Error('Boneyard loot descriptor and sample are inconsistent')
  }
  return {
    activationDelayTicks: sample[13],
    ageTicks: sample[4],
    alpha: dequantize(sample[5], VALUE_SCALE),
    amount: sample[6],
    animationPhase: dequantize(sample[7], VALUE_SCALE),
    bonusKind: descriptor[6] < 0 ? null : descriptor[6] as 0 | 1 | 2,
    bounceHeight: dequantize(sample[9], VALUE_SCALE),
    framePhase: dequantize(sample[8], VALUE_SCALE),
    id: descriptor[1],
    itemContentId: descriptor[10] < 0
      ? null
      : (BigInt(descriptor[10]) << 32n | BigInt(descriptor[11])).toString(),
    itemNativeSubtype: descriptor[9] < 0 ? null : descriptor[9],
    itemNativeTypeId: descriptor[8] < 0 ? null : descriptor[8],
    kind: BONEYARD_LOOT_KINDS[descriptor[2]]!,
    nativeTypeId: descriptor[3] as BoneyardLootSnapshot['nativeTypeId'],
    orbKind: descriptor[5] < 0 ? null : descriptor[5] === 0 ? 'health' : 'mana',
    orbValue: dequantize(sample[12], VALUE_SCALE),
    position: {
      x: dequantize(sample[2], POSITION_SCALE),
      y: dequantize(sample[3], POSITION_SCALE),
    },
    rotationDeg: dequantize(sample[14], VALUE_SCALE),
    scatterActive: sample[10] === 1,
    scatterProgress: dequantize(sample[11], VALUE_SCALE),
    scatterSeed: descriptor[13],
    source: BONEYARD_LOOT_SOURCES[descriptor[4]]!,
    spawnTick: descriptor[12],
    tier: descriptor[7],
  }
}

function requiredIndex<T>(values: readonly T[], value: T): number {
  const index = values.indexOf(value)
  if (index < 0) throw new Error(`unsupported Boneyard loot value ${String(value)}`)
  return index
}

function quantize(value: number, scale: number): number {
  if (!Number.isFinite(value)) throw new Error('Boneyard loot contains a non-finite value')
  return Math.round(value * scale)
}

function dequantize(value: number, scale: number): number {
  return value / scale
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function integerWithin(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum
}

function nonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function arrayIndex(value: number, length: number): boolean {
  return nonnegativeInteger(value) && value < length
}

function nativeSackItemIdentity(
  nativeTypeId: number,
  nativeSubtype: number,
  contentIdHigh: number,
  contentIdLow: number,
): boolean {
  const hasContentId = integerWithin(contentIdHigh, 0, 0x7fff_ffff)
    && integerWithin(contentIdLow, 0, 0xffff_ffff)
  const hasNoContentId = contentIdHigh === -1 && contentIdLow === -1
  if (nativeTypeId === 7001) {
    return nativeSubtype >= 0 && nativeSubtype <= 261 && (
      nativeSubtype <= 5 ? hasNoContentId : hasContentId
    )
  }
  if (!hasNoContentId) return false
  if (nativeTypeId === 7012) return integerWithin(nativeSubtype, 0, 3)
  if (nativeTypeId === 7008) return nativeSubtype === 0
  return [7002, 7003, 7004, 7005, 7006, 7011].includes(nativeTypeId)
    && nativeSubtype === -1
}

function descriptorMatchesSample(
  descriptor: ReplicatedEntityDescriptor,
  sample: ReplicatedEntitySample,
): boolean {
  const kind = BONEYARD_LOOT_KINDS[descriptor[2]]!
  const amount = sample[6]
  const alpha = sample[5]
  const animationPhase = sample[7]
  const bounceHeight = sample[9]
  const framePhase = sample[8]
  const orbValue = sample[12]
  const rotation = sample[14]
  const scatterActive = sample[10]
  const scatterProgress = sample[11]
  if (kind === 'gold') {
    const tier = amount < 3 ? 0 : amount < 5 ? 1 : amount < 8 ? 2 : 3
    return amount > 0
      && descriptor[7] === tier
      && alpha === 0
      && bounceHeight === 0
      && framePhase === 0
      && orbValue === 0
  }
  if (amount !== 0 || scatterActive !== 0 || scatterProgress !== 0) return false
  if (kind === 'sack') {
    return alpha === 0
      && animationPhase === 0
      && bounceHeight <= 0
      && framePhase === 0
      && orbValue === 0
      && rotation === 0
  }
  if (bounceHeight !== 0 || sample[13] !== 0) return false
  if (kind === 'orb') {
    return framePhase === 0 && rotation === 0
  }
  // The native penultimate fade update is positive but rounds to zero at this scale.
  return alpha >= 0 && framePhase <= BONUS_FRAME_MAXIMUM && orbValue === 0
}
