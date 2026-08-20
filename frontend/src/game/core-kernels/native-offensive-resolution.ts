import type { NativeEquipmentModifiers } from './native-equipment-effects.ts'
import {
  nativeSkillRoot,
  type NativePrimarySkillRankStats,
} from './player-progression.ts'

export const NATIVE_OFFENSIVE_SKILL_IDS = Object.freeze([
  8, 9, 10, 11, 13,
  16, 17, 18, 19, 20, 21, 23,
  24, 25, 26, 27, 29, 31,
  32, 33, 34, 35, 38,
  40, 41, 42, 43, 44, 47,
  50, 52, 55,
  65,
  72, 73, 74, 76, 77, 78, 79,
] as const)

const NATIVE_OFFENSIVE_SKILL_ID_SET = new Set<number>(NATIVE_OFFENSIVE_SKILL_IDS)

export interface NativeOffensiveSpellFactors {
  readonly damage: number
  readonly equipment?: NativeEquipmentModifiers
  readonly manaCost: number
}

export interface NativeDamageResolutionLanes {
  readonly actorBaseDamage?: number
  readonly baseDamage: number
  readonly classFlatDamage?: number
  readonly classMultiplier?: number
  readonly elementOrClassMultiplier?: number
  readonly globalFlatDamage?: number
  readonly globalMultiplier?: number
  readonly skillFlatDamage?: number
  readonly skillMultiplier?: number
}

export interface NativeManaCostResolutionLanes {
  readonly baseManaCost: number
  readonly classFlatManaCost?: number
  readonly classMultiplier?: number
  readonly elementMultiplier?: number
  readonly globalFlatManaCost?: number
  readonly globalManaReduction?: number
  readonly globalMultiplier?: number
  readonly skillFlatManaCost?: number
  readonly skillMultiplier?: number
}

export function nativeSkillIsOffensive(skillId: number): boolean {
  requireSkillId(skillId)
  return NATIVE_OFFENSIVE_SKILL_ID_SET.has(skillId)
}

/** Mirrors `0x0065FFF0`, including Siege Mage's final authored-row gate. */
export function resolveNativeSkillDamage(
  skillId: number,
  factors: NativeOffensiveSpellFactors,
  lanes: NativeDamageResolutionLanes,
): number {
  validateOffensiveFactors(factors)
  const baseDamage = finite(lanes.baseDamage, 'base damage')
  const equipment = factors.equipment
  const classId = nativeOffensiveSkillClass(skillId)
  let damage = (
    valueOr(lanes.actorBaseDamage, 0, 'actor base damage')
    + baseDamage
    + valueOr(lanes.globalFlatDamage, 0, 'global flat damage')
    + valueOr(lanes.skillFlatDamage, 0, 'skill flat damage')
    + valueOr(lanes.classFlatDamage, 0, 'class flat damage')
    + (equipment?.globalDamageFlat ?? 0)
    + (equipment?.skillDamageFlat[skillId] ?? 0)
    + (equipment?.classDamageFlat[classId] ?? 0)
  )
    * valueOr(lanes.globalMultiplier, 1, 'global damage multiplier')
    * valueOr(lanes.skillMultiplier, 1, 'skill damage multiplier')
    * valueOr(lanes.classMultiplier, 1, 'class damage multiplier')
    * valueOr(lanes.elementOrClassMultiplier, 1, 'element/class damage multiplier')
    * (equipment?.globalDamageMultiplier ?? 1)
    * (equipment?.skillDamageMultiplier[skillId] ?? 1)
    * (equipment?.classDamageMultiplier[classId] ?? 1)
  if (nativeSkillIsOffensive(skillId)) damage *= factors.damage
  return Math.max(0, damage)
}

/** Mirrors `0x006600F0`, including Battle Mage before the later flat lanes. */
export function resolveNativeSkillManaCost(
  skillId: number,
  factors: NativeOffensiveSpellFactors,
  lanes: NativeManaCostResolutionLanes,
): number {
  validateOffensiveFactors(factors)
  const baseManaCost = finite(lanes.baseManaCost, 'base mana cost')
  const equipment = factors.equipment
  const classId = nativeOffensiveSkillClass(skillId)
  let cost = Math.max(
    1,
    baseManaCost - valueOr(lanes.globalManaReduction, 0, 'global mana reduction'),
  )
  if (nativeSkillIsOffensive(skillId)) cost *= factors.manaCost
  cost = (
    cost
    + valueOr(lanes.globalFlatManaCost, 0, 'global flat mana cost')
    + valueOr(lanes.classFlatManaCost, 0, 'class flat mana cost')
    + valueOr(lanes.skillFlatManaCost, 0, 'skill flat mana cost')
    + (equipment?.globalManaCostFlat ?? 0)
    + (equipment?.classManaCostFlat[classId] ?? 0)
  )
    * valueOr(lanes.globalMultiplier, 1, 'global mana multiplier')
    * valueOr(lanes.classMultiplier, 1, 'class mana multiplier')
    * valueOr(lanes.skillMultiplier, 1, 'skill mana multiplier')
    * valueOr(lanes.elementMultiplier, 1, 'element mana multiplier')
    * (equipment?.globalManaCostMultiplier ?? 1)
    * (equipment?.classManaCostMultiplier[classId] ?? 1)
  return Math.max(0, cost)
}

export function resolveNativeSkillDamageValue(
  skillId: number,
  damage: number,
  factors: NativeOffensiveSpellFactors,
): number {
  return resolveNativeSkillDamage(skillId, factors, { baseDamage: damage })
}

export function resolveNativeSkillManaCostValue(
  skillId: number,
  manaCost: number,
  factors: NativeOffensiveSpellFactors,
): number {
  if (manaCost === 0) {
    validateOffensiveFactors(factors)
    requireSkillId(skillId)
    return 0
  }
  return resolveNativeSkillManaCost(skillId, factors, { baseManaCost: manaCost })
}

export function resolveNativePrimarySkillStats(
  source: NativePrimarySkillRankStats,
  factors: NativeOffensiveSpellFactors,
): NativePrimarySkillRankStats {
  return Object.freeze({
    ...source,
    damageMaximum: resolveNativeSkillDamageValue(
      source.skillId,
      source.damageMaximum,
      factors,
    ),
    damageMinimum: resolveNativeSkillDamageValue(
      source.skillId,
      source.damageMinimum,
      factors,
    ),
    manaCost: resolveNativeSkillManaCostValue(source.skillId, source.manaCost, factors),
  })
}

export function validateOffensiveFactors(factors: NativeOffensiveSpellFactors): void {
  if (!Number.isFinite(factors.damage) || factors.damage < 0) {
    throw new RangeError('offensive damage factor must be finite and non-negative')
  }
  if (!Number.isFinite(factors.manaCost) || factors.manaCost < 0) {
    throw new RangeError('offensive mana factor must be finite and non-negative')
  }
}

function requireSkillId(skillId: number): void {
  if (!Number.isSafeInteger(skillId) || skillId < 0) {
    throw new RangeError('skill id must be a non-negative safe integer')
  }
}

function nativeOffensiveSkillClass(skillId: number): number {
  const root = nativeSkillRoot(skillId)
  if (root === null) throw new RangeError(`skill ${skillId} has no native class`)
  return root
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
  return value
}

function valueOr(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  return value === undefined ? fallback : finite(value, label)
}
