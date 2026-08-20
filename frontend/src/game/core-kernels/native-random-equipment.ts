import type {
  EquipmentType,
  NativeEquipmentEffect,
} from './hub-economy.ts'
import {
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import {
  NATIVE_SKILL_CATALOG,
  nativeSkillMinimumLevel,
} from './player-progression.ts'

interface GeneratedEffect extends NativeEquipmentEffect {
  readonly prefix: string
  readonly suffix: string
}

export interface NativeRandomEquipmentEffectsResult {
  readonly effects: readonly NativeEquipmentEffect[]
  readonly itemLevel: number
  readonly name: string
  readonly sharedRng: NativeRngState
}

const EFFECT_NAMES: Readonly<Record<number, readonly [string, string]>> = {
  0: ['Channeling', 'of Channeling'],
  1: ['Managrinding', 'of Managrind'],
  2: ['Searing', 'of Searing'],
  3: ['Arcane', 'of Arcane Pain'],
  4: ['Searing', 'of Searing'],
  5: ['Arcane', 'of Arcane Pain'],
  6: ['Wielding', 'of Wielding'],
  7: ['Brutal', 'of Brutality'],
  8: ['Ingenious', 'of Ingenuity'],
  10: ['Spellbinding', 'of Spellbinding'],
  11: ['Elemental', 'of the Elementalist'],
  12: ['Nimble', 'of Nimble Fingers'],
  13: ['Cunning', 'of Cunning'],
  14: ['Wealthy', 'of Wealth'],
  15: ['Calling', 'of Calling'],
  16: ['Recovering', 'of Recovery'],
  17: ['Hasty', 'of Haste'],
  18: ['Manly', 'of Manliness'],
  19: ['Spellbreaking', 'of Spellbreaking'],
  20: ['Curing', 'of Remedy'],
  21: ['Convergent', 'of Convergence'],
  22: ['Convergent', 'of Convergence'],
  23: ['Fit', 'of Fitness'],
  24: ['Thoughtful', 'of Thought'],
}

const WEARABLE_EXCLUSIONS = new Set([2, 3, 8, 9, 12, 13, 17, 21, 22])
const WEARABLE_HALF_MAGNITUDE = new Set([
  0, 1, 2, 3, 4, 5, 6, 10, 11, 12, 13, 17, 18, 19, 20, 21, 22, 23, 24,
])
const LEVEL_SENTINEL_ALLOWED_SELECTORS = new Set([
  1, 4, 6, 7, 8, 11, 14, 15, 16, 18, 19, 22, 23, 24,
])
const PRIMARY_TARGET_SKILL_IDS = Object.freeze([
  8, 11, 15, 16, 21, 22, 23, 27, 29, 32, 40, 50, 52, 55, 65, 72, 73, 74,
] as const)
const DISCIPLINE_TARGET_SKILL_IDS = Object.freeze([
  57, 58, 59, 60, 61, 62, 63, 65, 66, 67, 68, 69, 70, 71,
] as const)

export interface NativeRandomEquipmentSkillAvailability {
  readonly advancedUnlocks: readonly boolean[]
}

export function generateNativeRandomEquipmentEffects(
  sourceRng: NativeRngState,
  equipmentType: EquipmentType,
  level: number,
  availability: NativeRandomEquipmentSkillAvailability,
): NativeRandomEquipmentEffectsResult {
  const nativeLevel = level === -1 ? 1 : level
  let rng = sourceRng
  const minimum = Math.max(1, Math.trunc(nativeLevel / 2))
  const maximum = Math.max(1, nativeLevel + 5)
  if (minimum !== maximum) ({ state: rng } = drawNativeInteger(rng, maximum - minimum + 1))

  let effectCount = 1
  if (nativeLevel > 18) {
    const draw = drawNativeInteger(rng, 2)
    rng = draw.state
    if (draw.value === 1) effectCount = 2
    if (effectCount === 1) {
      const fallback = drawNativeInteger(rng, 5)
      rng = fallback.state
      if (fallback.value === 3) effectCount = 2
    }
    if (effectCount === 1) {
      const fallback = drawNativeInteger(rng, 10)
      rng = fallback.state
      if (fallback.value === 3) effectCount = 2
    }
  }

  const tierDraw = drawNativeInteger(rng, Math.trunc(nativeLevel / 20))
  rng = tierDraw.state
  const tier = level === -1 ? 0 : Math.max(1, Math.min(3, tierDraw.value + 1))
  const nameSide = drawNativeInteger(rng, 2)
  rng = nameSide.state
  let prefixNext = effectCount !== 2 && nameSide.value === 1
  const effects: GeneratedEffect[] = []
  const skillPools = nativeRandomEquipmentSkillPools(availability)
  let itemLevel = effectCount === 2 ? 8 : 0
  let priorSelector = -1
  while (effects.length < effectCount) {
    prefixNext = !prefixNext
    let selector: number
    do {
      const draw = drawNativeInteger(rng, 25)
      rng = draw.state
      selector = draw.value
    } while (
      selector === priorSelector
      || ((equipmentType === 'hat' || equipmentType === 'robe')
        && WEARABLE_EXCLUSIONS.has(selector))
      || (selector === 6 && effectCount !== 1)
      || (level === -1 && !LEVEL_SENTINEL_ALLOWED_SELECTORS.has(selector))
    )
    priorSelector = selector
    const generated = generateEffect(rng, selector, tier, equipmentType, skillPools)
    rng = generated.rng
    itemLevel = Math.max(itemLevel, generated.itemLevel)
    const names = generated.names
    effects.push({
      ...generated.effect,
      prefix: prefixNext ? names[0] : '',
      suffix: prefixNext ? '' : names[1],
    })
  }
  const baseName = equipmentType[0]!.toUpperCase() + equipmentType.slice(1)
  const prefix = effects.find(({ prefix }) => prefix.length > 0)?.prefix
  const suffix = effects.find(({ suffix }) => suffix.length > 0)?.suffix
  return {
    effects: Object.freeze(effects.map(({ kind, magnitude, operator, target }) => Object.freeze({
      kind,
      magnitude,
      operator,
      target,
    }))),
    itemLevel,
    name: [prefix, baseName, suffix].filter(Boolean).join(' '),
    sharedRng: rng,
  }
}

function generateEffect(
  sourceRng: NativeRngState,
  selector: number,
  tier: number,
  equipmentType: EquipmentType,
  skillPools: NativeRandomEquipmentSkillPools,
): {
  readonly effect: NativeEquipmentEffect
  readonly itemLevel: number
  readonly names: readonly [string, string]
  readonly rng: NativeRngState
} {
  let rng = sourceRng
  let kind = selector
  let operator: 0 | 1 | 2 = 0
  let target = 0
  let magnitude = 0
  let itemLevel = 0
  const amount = (bound: number, addend: number): number => {
    const draw = drawNativeInteger(rng, bound)
    rng = draw.state
    return draw.value + addend
  }
  const byTier = (rows: readonly (readonly [number, number])[]): number => {
    const [bound, addend] = rows[tier] ?? rows.at(-1)!
    return amount(bound, addend)
  }
  switch (selector) {
    case 0:
      kind = 9; operator = 2
      magnitude = byTier([[6, 2], [6, 25], [26, 50], [26, 100]])
      break
    case 1:
      kind = 9
      magnitude = byTier([[2, 1], [3, 1], [5, 5], [5, 10]])
      break
    case 2:
      kind = 1; operator = 2
      magnitude = byTier([[4, 3], [11, 10], [11, 30], [11, 50]])
      break
    case 3:
      kind = 1
      magnitude = tier === 0 ? 1 : byTier([[1, 1], [2, 2], [2, 3], [3, 5]])
      break
    case 4:
      kind = 2; operator = 2
      magnitude = byTier([[6, 4], [11, 15], [11, 35], [11, 60]])
      target = amount(5, 0)
      break
    case 5:
      kind = 2
      magnitude = tier === 0 ? 1 : byTier([[1, 1], [3, 3], [2, 6], [2, 8]])
      target = amount(5, 0)
      break
    case 6:
      kind = 25
      magnitude = byTier([[2, 1], [4, 3], [3, 7], [2, 10]])
      target = skillTargetValue(skillPools.primary, amount)
      break
    case 7:
      kind = 3
      magnitude = byTier([[2, 1], [3, 4], [4, 8], [6, 15]])
      break
    case 8:
      kind = 4
      target = skillTargetValue(skillPools.primaryOrDiscipline, amount)
      itemLevel = Math.max(itemLevel, nativeSkillMinimumLevel(target))
      magnitude = [1, 1, 2, 4][tier] ?? 4
      break
    case 9:
      kind = 5
      target = skillTargetValue(skillPools.all, amount)
      magnitude = [1, 1, 2, 3][tier] ?? 3
      break
    case 10: {
      kind = 10
      const operation = amount(2, 0)
      if (operation === 1) {
        operator = 2
        magnitude = byTier([[4, 2], [6, 10], [6, 20], [11, 30]])
      } else {
        amount(2, 1)
        magnitude = tier === 0 ? 1 : byTier([[1, 1], [3, 2], [3, 5], [3, 8]])
      }
      magnitude = -magnitude
      break
    }
    case 11: {
      kind = 11
      const operation = amount(2, 0)
      if (operation === 1) {
        operator = 2
        magnitude = byTier([[3, 5], [6, 15], [6, 25], [11, 35]])
      } else {
        magnitude = byTier([[2, 1], [5, 2], [5, 5], [7, 8]])
      }
      magnitude = -magnitude
      target = amount(5, 0)
      break
    }
    case 12:
      kind = 12; operator = 2
      magnitude = byTier([[5, 2], [6, 10], [11, 30], [26, 50]])
      break
    case 13:
      kind = 13; operator = 2
      magnitude = byTier([[6, 5], [6, 20], [11, 50], [26, 70]])
      target = amount(5, 0)
      break
    case 14:
      kind = 14; operator = 2
      magnitude = byTier([[6, 5], [11, 10], [26, 50], [26, 100]])
      break
    case 15:
      kind = 15; operator = 1
      amount(4, 2)
      magnitude = tier === 0
        ? 2
        : tier === 1
          ? amount(3, 2)
          : tier === 2
            ? amount(3, 4)
            : amount(4, 6)
      break
    case 16:
      kind = 16; operator = 1
      magnitude = tier === 0 ? 1.5 : byTier([[1, 1], [3, 2], [26, 50], [26, 100]])
      break
    case 17:
      kind = 17; operator = 2
      amount(11, 5)
      magnitude = byTier([[6, 5], [6, 10], [6, 20], [11, 30]])
      break
    case 18:
      kind = 18; operator = 2
      amount(11, 5)
      magnitude = byTier([[6, 2], [6, 5], [11, 20], [16, 40]])
      break
    case 19:
    case 20:
      kind = selector; operator = 2
      magnitude = byTier([[6, 2], [6, 5], [11, 20], [16, 40]])
      break
    case 21:
      kind = 21; operator = 2
      amount(6, 5)
      magnitude = byTier([[4, 3], [6, 10], [6, 20], [16, 30]])
      break
    case 22:
      kind = 22; operator = 2
      amount(6, 5)
      magnitude = byTier([[6, 5], [6, 20], [6, 30], [11, 40]])
      target = amount(5, 0)
      break
    case 23:
      kind = 23
      magnitude = byTier([[11, 5], [26, 25], [76, 75], [101, 200]])
      break
    case 24:
      kind = 24
      magnitude = byTier([[11, 10], [51, 50], [151, 150], [201, 400]])
      break
  }
  if (
    (equipmentType === 'hat' || equipmentType === 'robe')
    && WEARABLE_HALF_MAGNITUDE.has(selector)
    && magnitude > 2
  ) {
    magnitude = roundHalfToEven(magnitude * 0.5)
  }
  const fixedNames = EFFECT_NAMES[selector]
  const skillName = NATIVE_SKILL_CATALOG[target]?.name ?? `Skill ${target}`
  const names = selector === 9
    ? [skillName, `of ${skillName}`] as const
    : fixedNames ?? ['Equipment', 'of Equipment']
  return {
    effect: Object.freeze({ kind, magnitude: Math.fround(magnitude), operator, target }),
    itemLevel,
    names,
    rng,
  }
}

function skillTargetValue(
  skillIds: readonly number[],
  amount: (bound: number, addend: number) => number,
): number {
  return skillIds[amount(skillIds.length, 0)] ?? 0
}

export interface NativeRandomEquipmentSkillPools {
  readonly all: readonly number[]
  readonly primary: readonly number[]
  readonly primaryOrDiscipline: readonly number[]
}

export function nativeRandomEquipmentSkillPools(
  availability: NativeRandomEquipmentSkillAvailability,
): NativeRandomEquipmentSkillPools {
  if (availability.advancedUnlocks.length !== 8) {
    throw new RangeError('native advanced-skill availability must contain eight flags')
  }
  const available = (skillId: number) => (
    skillId < 72 || availability.advancedUnlocks[skillId - 72] === true
  )
  const all = Array.from({ length: 72 }, (_, index) => index + 8).filter(available)
  const primary = PRIMARY_TARGET_SKILL_IDS.filter(available)
  const primaryOrDiscipline = [...new Set([
    ...primary,
    ...DISCIPLINE_TARGET_SKILL_IDS,
  ])].sort((left, right) => left - right)
  return {
    all: Object.freeze(all),
    primary: Object.freeze(primary),
    primaryOrDiscipline: Object.freeze(primaryOrDiscipline),
  }
}

function roundHalfToEven(value: number): number {
  const floor = Math.floor(value)
  const fraction = value - floor
  if (fraction < 0.5) return floor
  if (fraction > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}
