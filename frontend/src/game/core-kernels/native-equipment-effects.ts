import nativeEquipmentCatalogJson from './native-equipment-effects-catalog.json' with { type: 'json' }

import type {
  HubEquipmentState,
  HubInventoryItem,
  NativeEquipmentEffect,
} from './hub-economy.ts'
import {
  NATIVE_SKILL_CATALOG,
  NATIVE_SKILL_ROW_COUNT,
  nativeSkillRoot,
} from './player-progression.ts'

export const NATIVE_EQUIPMENT_FEATURE = Object.freeze({
  maximumLeviathan: 0x0001,
  maximumMagicStorm: 0x0002,
  maximumRingOfFire: 0x0004,
  maximumGolem: 0x0008,
  maximumRingOfIce: 0x0010,
  maximumEmbersToImps: 0x0020,
  maximumDisintegration: 0x0040,
  maximumEtherCharge: 0x0080,
  maximumHarden: 0x0100,
  maximumRockSurge: 0x0200,
  mindblast: 0x0400,
  maximumWeld: 0x0800,
  weldCalling: 0x1000,
} as const)

export interface NativeEquipmentScalarTransform {
  readonly offset: number
  readonly scale: number
}

export interface NativeEquipmentModifiers {
  readonly castSpeedFlat: number
  readonly castSpeedMultiplier: number
  readonly classCastSpeedFlat: readonly number[]
  readonly classCastSpeedMultiplier: readonly number[]
  readonly classDamageFlat: readonly number[]
  readonly classDamageMultiplier: readonly number[]
  readonly classManaCostFlat: readonly number[]
  readonly classManaCostMultiplier: readonly number[]
  readonly classRecharge: readonly NativeEquipmentScalarTransform[]
  readonly damageResistance: number
  readonly featureBits: number
  readonly globalDamageFlat: number
  readonly globalDamageMultiplier: number
  readonly globalManaCostFlat: number
  readonly globalManaCostMultiplier: number
  readonly goldMultiplier: number
  readonly healthRecovery: NativeEquipmentScalarTransform
  readonly magicResistance: number
  readonly manaRecovery: NativeEquipmentScalarTransform
  readonly maximumHealth: NativeEquipmentScalarTransform
  readonly maximumMana: NativeEquipmentScalarTransform
  readonly meleeDamageFlat: number
  readonly meleeDamageMultiplier: number
  readonly orbPullMultiplier: number
  readonly poisonResistance: number
  readonly recharge: NativeEquipmentScalarTransform
  readonly skillDamageFlat: readonly number[]
  readonly skillDamageMultiplier: readonly number[]
  readonly walkSpeed: NativeEquipmentScalarTransform
  readonly weldEffect: number
}

export interface NativeEquipmentEffectSource {
  readonly effects: readonly NativeEquipmentEffect[]
  readonly recipeIndex: number | null
}

export interface NativeEquipmentResolution {
  readonly effectiveRanks: readonly number[]
  readonly modifiers: NativeEquipmentModifiers
}

interface NativeEquipmentCatalog {
  readonly items: readonly {
    readonly effects: readonly NativeEquipmentEffect[]
    readonly name: string
    readonly sourceIndex: number
  }[]
  readonly schema: string
  readonly sets: readonly {
    readonly effects: readonly NativeEquipmentEffect[]
    readonly memberRecipeIndices: readonly number[]
    readonly name: string
    readonly sourceIndex: number
  }[]
}

interface MutableNativeEquipmentModifiers {
  castSpeedFlat: number
  castSpeedMultiplier: number
  classCastSpeedFlat: number[]
  classCastSpeedMultiplier: number[]
  classDamageFlat: number[]
  classDamageMultiplier: number[]
  classManaCostFlat: number[]
  classManaCostMultiplier: number[]
  classRecharge: NativeEquipmentScalarTransform[]
  damageResistance: number
  featureBits: number
  globalDamageFlat: number
  globalDamageMultiplier: number
  globalManaCostFlat: number
  globalManaCostMultiplier: number
  goldMultiplier: number
  healthRecovery: NativeEquipmentScalarTransform
  magicResistance: number
  manaRecovery: NativeEquipmentScalarTransform
  maximumHealth: NativeEquipmentScalarTransform
  maximumMana: NativeEquipmentScalarTransform
  meleeDamageFlat: number
  meleeDamageMultiplier: number
  orbPullMultiplier: number
  poisonResistance: number
  recharge: NativeEquipmentScalarTransform
  skillDamageFlat: number[]
  skillDamageMultiplier: number[]
  walkSpeed: NativeEquipmentScalarTransform
  weldEffect: number
}

const CATALOG = nativeEquipmentCatalogJson as NativeEquipmentCatalog
if (CATALOG.schema !== 'solomon-dark-native-equipment-effects-v1') {
  throw new Error('native equipment-effects catalog schema is unsupported')
}

export const NATIVE_EQUIPMENT_RECIPE_COUNT = CATALOG.items.length
export const NATIVE_EQUIPMENT_SET_COUNT = CATALOG.sets.length

export function resolveEquippedNativeEffects(
  permanentRanks: readonly number[],
  equipment: HubEquipmentState,
): NativeEquipmentResolution {
  return resolveNativeEquipmentEffects(
    permanentRanks,
    equippedNativeEffectSources(equipment),
  )
}

export function equippedNativeEffectSources(
  equipment: HubEquipmentState,
): readonly NativeEquipmentEffectSource[] {
  return Object.freeze([
    equipment.hat,
    equipment.robe,
    ...equipment.rings,
    equipment.amulet,
    equipment.weapon,
  ].flatMap((item) => item === null ? [] : [nativeEffectSource(item)]))
}

export function nativeEquipmentRecipeEffects(
  recipeIndex: number,
): readonly NativeEquipmentEffect[] {
  const recipe = CATALOG.items[recipeIndex]
  if (recipe === undefined || recipe.sourceIndex !== recipeIndex) return Object.freeze([])
  return cloneEffects(recipe.effects)
}

export function nativeEquipmentSetEffects(
  equippedRecipeIndices: readonly number[],
): readonly NativeEquipmentEffect[] {
  const equipped = new Set(equippedRecipeIndices)
  return Object.freeze(CATALOG.sets.flatMap((set) => (
    set.memberRecipeIndices.every((recipeIndex) => equipped.has(recipeIndex))
      ? set.effects.map((effect) => Object.freeze({ ...effect }))
      : []
  )))
}

export function resolveNativeEquipmentEffects(
  permanentRanks: readonly number[],
  equippedSources: readonly NativeEquipmentEffectSource[],
): NativeEquipmentResolution {
  if (permanentRanks.length !== NATIVE_SKILL_ROW_COUNT) {
    throw new RangeError(`native permanent ranks must contain ${NATIVE_SKILL_ROW_COUNT} rows`)
  }
  const sources = equippedSources.map((source) => Object.freeze({
    effects: cloneEffects(source.effects),
    recipeIndex: source.recipeIndex,
  }))
  const setEffects = nativeEquipmentSetEffects(sources.flatMap(({ recipeIndex }) => (
    recipeIndex === null ? [] : [recipeIndex]
  )))
  const allSources: readonly NativeEquipmentEffectSource[] = [
    ...sources,
    ...(setEffects.length === 0
      ? []
      : [Object.freeze({ effects: setEffects, recipeIndex: null })]),
  ]

  const effectiveRanks = [...permanentRanks]
  const skillPassSources = [
    ...allSources.filter(({ effects }) => !effects.some(({ kind }) => kind === 4)),
    ...allSources.filter(({ effects }) => effects.some(({ kind }) => kind === 4)),
  ]
  for (const source of skillPassSources) {
    for (const effect of source.effects) {
      applyNativeEquipmentSkillEffect(effectiveRanks, permanentRanks, effect)
    }
  }

  const modifiers = mutableNativeEquipmentModifiers()
  for (const source of allSources) {
    for (const effect of source.effects) applyNativeEquipmentStatEffect(modifiers, effect)
  }
  return Object.freeze({
    effectiveRanks: Object.freeze(effectiveRanks),
    modifiers: freezeNativeEquipmentModifiers(modifiers),
  })
}

export function createNativeEquipmentModifiers(): NativeEquipmentModifiers {
  return freezeNativeEquipmentModifiers(mutableNativeEquipmentModifiers())
}

export function applyNativeEquipmentTransform(
  transform: NativeEquipmentScalarTransform,
  value: number,
): number {
  if (!Number.isFinite(value)) throw new RangeError('native equipment input must be finite')
  if (transform.scale === 1 && transform.offset === 0) return value
  return Math.fround(Math.fround(value * transform.scale) + transform.offset)
}

export function nativeEquipmentHasFeature(
  modifiers: Pick<NativeEquipmentModifiers, 'featureBits'>,
  feature: keyof typeof NATIVE_EQUIPMENT_FEATURE,
): boolean {
  const bit = NATIVE_EQUIPMENT_FEATURE[feature]
  return (modifiers.featureBits & bit) !== 0
}

function nativeEffectSource(item: HubInventoryItem): NativeEquipmentEffectSource {
  return Object.freeze({
    effects: item.nativeEffects === undefined
      ? nativeEquipmentRecipeEffects(item.recipeIndex ?? -1)
      : cloneEffects(item.nativeEffects),
    recipeIndex: item.recipeIndex,
  })
}

function cloneEffects(source: readonly NativeEquipmentEffect[]): readonly NativeEquipmentEffect[] {
  return Object.freeze(source.map((effect) => Object.freeze({ ...effect })))
}

function mutableNativeEquipmentModifiers(): MutableNativeEquipmentModifiers {
  return {
    castSpeedFlat: 0,
    castSpeedMultiplier: 1,
    classCastSpeedFlat: new Array(8).fill(0),
    classCastSpeedMultiplier: new Array(8).fill(1),
    classDamageFlat: new Array(8).fill(0),
    classDamageMultiplier: new Array(8).fill(1),
    classManaCostFlat: new Array(8).fill(0),
    classManaCostMultiplier: new Array(8).fill(1),
    classRecharge: Array.from({ length: 8 }, identityTransform),
    damageResistance: 0,
    featureBits: 0,
    globalDamageFlat: 0,
    globalDamageMultiplier: 1,
    globalManaCostFlat: 0,
    globalManaCostMultiplier: 1,
    goldMultiplier: 1,
    healthRecovery: identityTransform(),
    magicResistance: 0,
    manaRecovery: identityTransform(),
    maximumHealth: identityTransform(),
    maximumMana: identityTransform(),
    meleeDamageFlat: 0,
    meleeDamageMultiplier: 1,
    orbPullMultiplier: 1,
    poisonResistance: 0,
    recharge: identityTransform(),
    skillDamageFlat: new Array(NATIVE_SKILL_ROW_COUNT).fill(0),
    skillDamageMultiplier: new Array(NATIVE_SKILL_ROW_COUNT).fill(1),
    walkSpeed: identityTransform(),
    weldEffect: 1,
  }
}

function applyNativeEquipmentSkillEffect(
  effectiveRanks: number[],
  permanentRanks: readonly number[],
  effect: NativeEquipmentEffect,
): void {
  if (effect.kind < 4 || effect.kind > 8) return
  const magnitude = Math.round(effect.magnitude)
  if (effect.kind === 4) {
    setMinimumSkillRank(effectiveRanks, effect.target, magnitude)
    return
  }
  if (effect.kind === 5) {
    addLearnedSkillRank(effectiveRanks, effect.target, magnitude)
    return
  }
  if (effect.kind === 6) {
    for (let skillId = 8; skillId <= 79; skillId += 1) {
      if (nativeSkillClass(skillId) === effect.target) {
        addLearnedSkillRank(effectiveRanks, skillId, magnitude)
      }
    }
    return
  }
  if (effect.kind === 7) {
    if ((effectiveRanks[effect.target] ?? 0) < 1) {
      setMinimumSkillRank(effectiveRanks, effect.target, magnitude)
    } else {
      addLearnedSkillRank(effectiveRanks, effect.target, magnitude)
    }
    return
  }
  for (let skillId = 8; skillId <= 79; skillId += 1) {
    if ((permanentRanks[skillId] ?? 0) > 0) {
      addLearnedSkillRank(effectiveRanks, skillId, magnitude)
    }
  }
}

function applyNativeEquipmentStatEffect(
  target: MutableNativeEquipmentModifiers,
  effect: NativeEquipmentEffect,
): void {
  const magnitude = effect.magnitude
  if (effect.kind === 1) {
    applySplitEffect(target, 'globalDamageMultiplier', 'globalDamageFlat', effect)
  } else if (effect.kind === 2) {
    applyArraySplitEffect(target.classDamageMultiplier, target.classDamageFlat, effect)
  } else if (effect.kind === 3) {
    applySplitEffect(target, 'meleeDamageMultiplier', 'meleeDamageFlat', effect)
  } else if (effect.kind === 9) {
    target.manaRecovery = appendTransform(target.manaRecovery, effect, magnitude)
  } else if (effect.kind === 10) {
    applySplitEffect(target, 'globalManaCostMultiplier', 'globalManaCostFlat', effect)
  } else if (effect.kind === 11) {
    applyArraySplitEffect(target.classManaCostMultiplier, target.classManaCostFlat, effect)
  } else if (effect.kind === 12) {
    applySplitEffect(target, 'castSpeedMultiplier', 'castSpeedFlat', effect)
  } else if (effect.kind === 13) {
    applyArraySplitEffect(target.classCastSpeedMultiplier, target.classCastSpeedFlat, effect)
  } else if (effect.kind === 14) {
    target.goldMultiplier = Math.fround(target.goldMultiplier * percentMultiplier(magnitude))
  } else if (effect.kind === 15) {
    target.orbPullMultiplier = Math.fround(target.orbPullMultiplier * (
      effect.operator === 1 ? magnitude : percentMultiplier(magnitude)
    ))
  } else if (effect.kind === 16) {
    target.healthRecovery = appendTransform(target.healthRecovery, effect, magnitude)
  } else if (effect.kind === 17) {
    target.walkSpeed = effect.operator === 0
      ? Object.freeze({
          offset: Math.fround(target.walkSpeed.offset + magnitude / 10),
          scale: target.walkSpeed.scale,
        })
      : appendTransform(target.walkSpeed, effect, magnitude)
  } else if (effect.kind === 18) {
    target.damageResistance = Math.fround(target.damageResistance + magnitude / 100)
  } else if (effect.kind === 19) {
    target.magicResistance = Math.fround(target.magicResistance + magnitude / 100)
  } else if (effect.kind === 20) {
    target.poisonResistance = Math.fround(target.poisonResistance + magnitude / 100)
  } else if (effect.kind === 21) {
    target.recharge = appendTransform(target.recharge, effect, magnitude)
  } else if (effect.kind === 22) {
    requireClassTarget(effect.target)
    target.classRecharge[effect.target] = appendTransform(
      target.classRecharge[effect.target]!,
      effect,
      magnitude,
    )
  } else if (effect.kind === 23) {
    target.maximumHealth = appendTransform(target.maximumHealth, effect, magnitude)
  } else if (effect.kind === 24) {
    target.maximumMana = appendTransform(target.maximumMana, effect, magnitude)
  } else if (effect.kind === 25) {
    requireSkillTarget(effect.target)
    if (effect.operator === 0) {
      target.skillDamageFlat[effect.target] = Math.fround(
        target.skillDamageFlat[effect.target]! + magnitude,
      )
    } else {
      target.skillDamageMultiplier[effect.target] = Math.fround(
        target.skillDamageMultiplier[effect.target]! * operatorMultiplier(effect),
      )
    }
  } else if (effect.kind >= 26 && effect.kind <= 37) {
    target.featureBits |= 1 << (effect.kind - 26)
  } else if (effect.kind === 38) {
    target.weldEffect = effect.operator === 0
      ? Math.fround(target.weldEffect + magnitude)
      : effect.operator === 1
        ? Math.fround(target.weldEffect * magnitude)
        : Math.fround(target.weldEffect + magnitude / 100)
  } else if (effect.kind === 39) {
    target.featureBits |= NATIVE_EQUIPMENT_FEATURE.weldCalling
  }
}

function freezeNativeEquipmentModifiers(
  source: MutableNativeEquipmentModifiers,
): NativeEquipmentModifiers {
  return Object.freeze({
    ...source,
    classCastSpeedFlat: Object.freeze([...source.classCastSpeedFlat]),
    classCastSpeedMultiplier: Object.freeze([...source.classCastSpeedMultiplier]),
    classDamageFlat: Object.freeze([...source.classDamageFlat]),
    classDamageMultiplier: Object.freeze([...source.classDamageMultiplier]),
    classManaCostFlat: Object.freeze([...source.classManaCostFlat]),
    classManaCostMultiplier: Object.freeze([...source.classManaCostMultiplier]),
    classRecharge: Object.freeze(source.classRecharge.map((row) => Object.freeze({ ...row }))),
    healthRecovery: Object.freeze({ ...source.healthRecovery }),
    manaRecovery: Object.freeze({ ...source.manaRecovery }),
    maximumHealth: Object.freeze({ ...source.maximumHealth }),
    maximumMana: Object.freeze({ ...source.maximumMana }),
    recharge: Object.freeze({ ...source.recharge }),
    skillDamageFlat: Object.freeze([...source.skillDamageFlat]),
    skillDamageMultiplier: Object.freeze([...source.skillDamageMultiplier]),
    walkSpeed: Object.freeze({ ...source.walkSpeed }),
  })
}

function identityTransform(): NativeEquipmentScalarTransform {
  return Object.freeze({ offset: 0, scale: 1 })
}

function appendTransform(
  source: NativeEquipmentScalarTransform,
  effect: NativeEquipmentEffect,
  magnitude: number,
): NativeEquipmentScalarTransform {
  if (effect.operator === 0) {
    return Object.freeze({
      offset: Math.fround(source.offset + magnitude),
      scale: source.scale,
    })
  }
  const multiplier = operatorMultiplier(effect)
  return Object.freeze({
    offset: Math.fround(source.offset * multiplier),
    scale: Math.fround(source.scale * multiplier),
  })
}

function applySplitEffect<
  KMultiplier extends keyof MutableNativeEquipmentModifiers,
  KFlat extends keyof MutableNativeEquipmentModifiers,
>(
  target: MutableNativeEquipmentModifiers,
  multiplierKey: KMultiplier,
  flatKey: KFlat,
  effect: NativeEquipmentEffect,
): void {
  if (effect.operator === 0) {
    target[flatKey] = Math.fround((target[flatKey] as number) + effect.magnitude) as never
  } else {
    target[multiplierKey] = Math.fround(
      (target[multiplierKey] as number) * operatorMultiplier(effect),
    ) as never
  }
}

function applyArraySplitEffect(
  multipliers: number[],
  flats: number[],
  effect: NativeEquipmentEffect,
): void {
  requireClassTarget(effect.target)
  if (effect.operator === 0) {
    flats[effect.target] = Math.fround(flats[effect.target]! + effect.magnitude)
  } else {
    multipliers[effect.target] = Math.fround(
      multipliers[effect.target]! * operatorMultiplier(effect),
    )
  }
}

function operatorMultiplier(effect: NativeEquipmentEffect): number {
  return effect.operator === 1 ? effect.magnitude : percentMultiplier(effect.magnitude)
}

function percentMultiplier(magnitude: number): number {
  return Math.fround(1 + magnitude / 100)
}

function setMinimumSkillRank(ranks: number[], skillId: number, magnitude: number): void {
  requireSkillTarget(skillId)
  ranks[skillId] = Math.min(
    nativeSkillMaximumLevel(skillId),
    Math.max(ranks[skillId] ?? 0, magnitude),
  )
}

function addLearnedSkillRank(ranks: number[], skillId: number, magnitude: number): void {
  requireSkillTarget(skillId)
  const current = ranks[skillId] ?? 0
  if (current < 1) return
  ranks[skillId] = Math.min(nativeSkillMaximumLevel(skillId), current + magnitude)
}

function nativeSkillMaximumLevel(skillId: number): number {
  return NATIVE_SKILL_CATALOG[skillId]?.config?.mMaxLevel ?? 0
}

function nativeSkillClass(skillId: number): number {
  return nativeSkillRoot(skillId) ?? -1
}

function requireClassTarget(target: number): void {
  if (!Number.isSafeInteger(target) || target < 0 || target > 7) {
    throw new RangeError(`native equipment class target ${target} is invalid`)
  }
}

function requireSkillTarget(target: number): void {
  if (!Number.isSafeInteger(target) || target < 0 || target >= NATIVE_SKILL_ROW_COUNT) {
    throw new RangeError(`native equipment skill target ${target} is invalid`)
  }
}
