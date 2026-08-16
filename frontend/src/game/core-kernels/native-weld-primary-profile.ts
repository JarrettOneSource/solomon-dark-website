import {
  nativeWeldBuild,
  type PlayerSkillBookComponent,
  type PlayerStatBookComponent,
} from './player-progression.ts'

export type NativeWeldBuildId =
  | 1000 | 1001 | 1002 | 1003 | 1004
  | 1005 | 1006 | 1007 | 1008 | 1009

export type NativeWeldCastKind = 'channel' | 'one-shot' | 'persistent'

export interface NativeWeldPrimaryVector {
  readonly buildId: NativeWeldBuildId
  readonly castKind: NativeWeldCastKind
  readonly values: readonly number[]
}

const WELD_CAST_KIND: Readonly<Record<NativeWeldBuildId, NativeWeldCastKind>> = {
  1000: 'one-shot',
  1001: 'one-shot',
  1002: 'one-shot',
  1003: 'channel',
  1004: 'channel',
  1005: 'channel',
  1006: 'persistent',
  1007: 'persistent',
  1008: 'persistent',
  1009: 'one-shot',
}

const F32_001 = 0.009999999776482582
const F32_002 = 0.019999999552965164
const F32_08 = 0.800000011920929
const F32_086 = 0.8600000143051147
const F32_09 = 0.8999999761581421
const F32_0932 = 0.9319999814033508
const F32_099 = 0.9900000095367432
const F32_105 = 1.0499999523162842
const F32_11 = 1.100000023841858
const F32_115 = 1.149999976158142
const F32_12 = 1.2000000476837158
const F32_125 = 1.25
const F32_13 = 1.2999999523162842
const F32_29 = 2.9000000953674316

/**
 * Rebuilds the exact float vector consumed by the ten native welded-primary
 * handlers. The formula order follows PlayerWizardSkills::RebuildWeldedSpell
 * (0x00666020); every CFG read and vector write crosses a float32 boundary.
 */
export function nativeWeldPrimaryVector(
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  buildId: number,
  weldEffect = 1,
): NativeWeldPrimaryVector {
  const build = nativeWeldBuild(buildId)
  if (!build) throw new RangeError(`weld build ${buildId} is not native`)
  if (!Number.isFinite(weldEffect) || weldEffect <= 0) {
    throw new RangeError('weld effect must be finite and positive')
  }
  const id = build.id as NativeWeldBuildId
  const ranks = Object.fromEntries(build.componentSkillIds.map((skillId) => (
    [skillId, effectiveRank(skillBook, skillId)]
  ))) as Readonly<Record<number, number>>
  for (const primarySkillId of build.primarySkillIds) {
    if (ranks[primarySkillId] < 1) {
      throw new RangeError(`weld primary skill ${primarySkillId} is not learned`)
    }
  }

  const rank = (skillId: number): number => ranks[skillId] ?? 0
  const value = (skillId: number, property: string, fallback = 0): number => (
    rank(skillId) === 0 ? f32(fallback) : ranked(statBook, skillId, property, rank(skillId))
  )
  const cost = (...skillIds: readonly number[]): number => skillIds.reduce(
    (total, skillId) => rank(skillId) === 0
      ? total
      : f32(total + ranked(statBook, skillId, 'mManaCost', rank(skillId))),
    0,
  )
  const divideWeld = (source: number): number => f32(source / f32(weldEffect))
  const vector = (values: readonly number[]): NativeWeldPrimaryVector => Object.freeze({
    buildId: id,
    castKind: WELD_CAST_KIND[id],
    values: Object.freeze(values.map(f32)),
  })

  switch (id) {
    case 1000: {
      const etherCost = cost(8, 10, 9)
      const fireCost = cost(16, 18, 17)
      const quantity = Math.round(value(10, 'mQuantity', 1))
      const explodeDamage = value(18, 'mDamage')
      const fragments = value(17, 'mFragments')
      let manaCost = divideWeld(f32(
        (Math.min(etherCost, fireCost) + 2 * Math.max(etherCost, fireCost)) / 3,
      ))
      if (quantity > 1 && explodeDamage > 0) {
        const first = f32(f32(quantity * F32_002) + F32_125)
        manaCost = f32(manaCost * f32(first + quantity * F32_001))
      }
      if (fragments > 0) {
        manaCost = f32(manaCost * quantity * F32_105 * 0.5)
      }
      return vector([
        f32(f32((2 * value(8, 'mDamage1') + value(16, 'mDamage')) / 3) * weldEffect),
        f32(f32((2 * value(8, 'mDamage2') + value(16, 'mDamage')) / 3) * weldEffect),
        manaCost,
        quantity,
        f32((1 + value(9, 'mSpeed') / 100) * F32_125),
        f32(explodeDamage * 0.75),
        f32(value(18, 'mRadius') * F32_08),
        f32(value(17, 'mDamage') * 0.75),
        f32(fragments * 0.75),
      ])
    }
    case 1001: {
      const etherCost = cost(8, 10, 9)
      const waterCost = cost(32, 34, 33)
      const waterDamage = value(32, 'mDamage')
      return vector([
        f32(f32((value(8, 'mDamage1') + 2 * waterDamage) / 5) * weldEffect),
        f32(f32((value(8, 'mDamage2') + 2 * waterDamage) / 4) * weldEffect),
        divideWeld(f32(f32(
          (2 * Math.min(etherCost, waterCost) + 3 * Math.max(etherCost, waterCost)) / 3,
        ) * F32_11)),
        Math.round(value(10, 'mQuantity', 1)),
        f32(1 + value(9, 'mSpeed') / 100),
        f32(value(33, 'mPushback') * F32_002),
        f32(value(34, 'mWiden') / 150),
      ])
    }
    case 1002: {
      const etherCost = cost(8, 10, 9)
      const airCost = cost(24, 25, 26)
      const airDamage = value(24, 'mDamage')
      return vector([
        f32(f32(value(8, 'mDamage1') / 3 + airDamage / 100) * F32_29 * weldEffect),
        f32(f32(value(8, 'mDamage2') / 3 + airDamage / 100) * F32_29 * weldEffect),
        divideWeld(f32(f32(etherCost + airCost / 100) * F32_099)),
        Math.round(value(10, 'mQuantity', 1)),
        f32(1 + value(9, 'mSpeed') / 100),
        Math.round(value(25, 'mArcs')),
        f32(1 - value(26, 'mStunAmount') * F32_09 / 100),
      ])
    }
    case 1003: {
      const explodeRank = rank(18)
      const arcRank = rank(25)
      const explodeDamage = value(18, 'mDamage')
      const arcCount = Math.round(value(25, 'mArcs'))
      let manaCost = divideWeld(f32(
        f32(2 * cost(16, 18, 17) + cost(24, 25, 26) / 50) * F32_086,
      ))
      if (arcCount > 0 && explodeDamage > 0) {
        let multiplier = F32_115
        if (arcRank > 1) multiplier = f32(F32_115 + arcRank * F32_002)
        if (explodeRank > 1) multiplier = f32(multiplier + explodeRank * F32_001)
        manaCost = f32(manaCost * multiplier)
      }
      if (rank(17) > 0 && rank(26) > 0) manaCost = f32(manaCost * F32_105)
      return vector([
        f32(f32((2 * value(16, 'mDamage') + value(24, 'mDamage') / 100) / F32_13) * weldEffect),
        manaCost,
        arcCount,
        f32(1 - value(26, 'mStunAmount') * F32_09 / 100),
        f32(explodeDamage * 0.75),
        value(18, 'mRadius'),
        value(17, 'mDamage'),
        f32(value(17, 'mFragments') * 0.75),
      ])
    }
    case 1004: {
      const waterCost = cost(32, 34, 33)
      const airCost = cost(24, 25, 26)
      return vector([
        f32(f32(value(32, 'mDamage') * F32_12 + value(24, 'mDamage') * 0.004) * weldEffect),
        divideWeld(f32(
          Math.max(waterCost, airCost) * F32_12
            + Math.min(waterCost, airCost) * 0.6,
        )),
        Math.round(value(25, 'mArcs')),
        f32(1 - value(26, 'mStunAmount') * F32_09 / 100),
        0,
        f32(value(33, 'mPushback') / 100),
        f32(value(34, 'mWiden') / 250),
      ])
    }
    case 1005: {
      const explodeRank = rank(18)
      const widenRank = rank(34)
      const explodeDamage = value(18, 'mDamage')
      const widen = value(34, 'mWiden')
      let manaCost = divideWeld(f32(
        f32(cost(16, 18, 17) + 2 * cost(32, 34, 33) / 100) * F32_0932,
      ))
      if (widen > 0 && explodeDamage > 0) {
        let multiplier = F32_115
        if (widenRank > 1) multiplier = f32(F32_115 + widenRank * F32_002)
        if (explodeRank > 1) multiplier = f32(multiplier + explodeRank * F32_001)
        manaCost = f32(manaCost * multiplier)
      }
      if (rank(17) > 0 && rank(33) > 0) manaCost = f32(manaCost * F32_105)
      return vector([
        f32(f32((value(16, 'mDamage') + 2 * value(32, 'mDamage')) / 1.125) * weldEffect),
        manaCost,
        f32(widen * 0.5),
        f32(value(33, 'mPushback') * 0.0075),
        f32(explodeDamage * 0.75),
        value(18, 'mRadius'),
        value(17, 'mDamage'),
        f32(value(17, 'mFragments') * 0.75),
      ])
    }
    case 1006: {
      const etherCost = cost(8, 10, 9)
      const earthCost = cost(40, 43, 42)
      return vector([
        f32(f32((value(8, 'mDamage1') + value(40, 'mDamage')) * 0.5) * weldEffect),
        divideWeld(f32((Math.min(etherCost, earthCost) + 2 * Math.max(etherCost, earthCost)) * 0.5)),
        Math.max(1, Math.min(4, Math.round(value(10, 'mQuantity', 1)))),
        f32(1 + value(9, 'mSpeed') / 100),
        f32(value(43, 'mStrength') / 100),
        f32(1 + value(42, 'mSpeedUp') / 100),
      ])
    }
    case 1007: {
      const explodeDamage = f32(value(18, 'mDamage') * 0.75)
      const fragments = value(17, 'mFragments')
      const toughness = f32(value(43, 'mStrength') / 100)
      const growth = f32(1 + value(42, 'mSpeedUp') / 100)
      let manaCost = divideWeld(f32((cost(16, 18, 17) + cost(40, 43, 42)) * F32_125))
      if (toughness > 1 || explodeDamage > 0 || growth > 1 || fragments > 0) {
        manaCost = f32(manaCost * 4.5)
      }
      if (toughness > 1 && explodeDamage > 0) {
        manaCost = f32(f32(manaCost + toughness * 5) * 1.5)
      }
      if (fragments > 0) manaCost = f32(manaCost + fragments)
      const firstDamage = f32(value(16, 'mDamage') * 2)
      const secondDamage = f32(value(40, 'mDamage') * 2)
      return vector([
        f32(Math.min(firstDamage, secondDamage) * weldEffect),
        f32(Math.max(firstDamage, secondDamage) * weldEffect),
        manaCost,
        growth,
        toughness,
        explodeDamage,
        value(18, 'mRadius'),
        value(17, 'mDamage'),
        f32(fragments * 0.6),
      ])
    }
    case 1008: {
      const damage = f32(Math.max(
        1,
        (3 * value(32, 'mDamage') + value(40, 'mDamage')) / 20 * 1.5,
      ))
      const growth = f32(1 + value(42, 'mSpeedUp') / 100)
      const widen = f32(value(34, 'mWiden') / 60)
      let manaCost = f32(
        divideWeld(f32(cost(40, 43, 42) + cost(32, 34, 33) / 100))
        + damage * 2,
      )
      if (widen > 0 && growth > 1) manaCost = f32(manaCost * F32_125)
      return vector([
        f32(damage * weldEffect),
        manaCost,
        growth,
        f32(value(43, 'mStrength') / 100),
        f32(value(33, 'mPushback') / 100),
        widen,
      ])
    }
    case 1009: {
      const arcs = Math.round(value(25, 'mArcs'))
      const manaCost = f32(
        divideWeld(f32((3 * cost(40, 43, 42) + 2 * cost(24, 25, 26) / 100) * 0.25))
        + 2 * arcs,
      )
      return vector([
        f32(f32((value(40, 'mDamage') + value(24, 'mDamage') / 25) * 0.2) * weldEffect),
        manaCost,
        arcs,
        f32(1 - value(26, 'mStunAmount') * F32_09 / 100),
        rank(43),
        f32(1 + value(42, 'mSpeedUp') / 100),
      ])
    }
  }
}

function ranked(
  statBook: PlayerStatBookComponent,
  skillId: number,
  property: string,
  rank: number,
): number {
  const entry = statBook.entries[skillId]
  if (!entry || entry.id !== skillId) throw new RangeError(`stat book is missing native skill ${skillId}`)
  const source = entry.numericProperties[property]
  const resolved = typeof source === 'number'
    ? source
    : source?.[Math.min(rank, source.length - 1)]
  if (resolved === undefined || !Number.isFinite(resolved)) {
    throw new RangeError(`native skill catalog is missing ${skillId}.${property} rank ${rank}`)
  }
  return f32(resolved)
}

function effectiveRank(skillBook: PlayerSkillBookComponent, skillId: number): number {
  const rank = skillBook.effectiveRanks[skillId] ?? 0
  if (!Number.isInteger(rank) || rank < 0) {
    throw new RangeError(`skill ${skillId} has invalid effective rank ${String(rank)}`)
  }
  return rank
}

function f32(value: number): number {
  return Math.fround(value)
}
