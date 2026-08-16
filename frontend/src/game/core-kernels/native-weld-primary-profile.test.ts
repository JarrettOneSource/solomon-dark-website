import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPlayerSkillBook,
  NATIVE_WELD_BUILDS,
  playerStatBook,
  type PlayerSkillBookComponent,
} from './player-progression.ts'
import {
  nativeWeldPrimaryVector,
  type NativeWeldBuildId,
} from './native-weld-primary-profile.ts'

const GOLDENS = {
  1000: {
    base: [2, 2.6666667461395264, 10, 1, 1.25, 0, 0, 0, 0],
    rank1: [2, 2.6666667461395264, 23.38349723815918, 2, 1.375, 3.75, 8, 1.5, 3],
    rank2: [3.6666667461395264, 5, 56.983489990234375, 3, 1.5625, 6.75, 8.800000190734863, 3, 3.75],
    weld2: [4, 5.333333492279053, 11.69174861907959, 2, 1.375, 3.75, 8, 1.5, 3],
  },
  1001: {
    base: [1.2000000476837158, 1.75, 18.149999618530273, 1, 1, 0, 0],
    rank1: [1.2000000476837158, 1.75, 35.56666564941406, 2, 1.100000023841858, 0.19999998807907104, 0.20000000298023224],
    rank2: [1.8000000715255737, 2.75, 55.18333435058594, 3, 1.25, 0.3999999761581421, 0.3333333432674408],
    weld2: [2.4000000953674316, 3.5, 17.78333282470703, 2, 1.100000023841858, 0.19999998807907104, 0.20000000298023224],
  },
  1002: {
    base: [1.0391666889190674, 2.005833387374878, 6.058799743652344, 1, 1, 0, 1],
    rank1: [1.0391666889190674, 2.005833387374878, 11.132550239562988, 2, 1.100000023841858, 1, 0.6399999856948853],
    rank2: [2.049333333969116, 3.9826667308807373, 19.1466007232666, 3, 1.25, 2, 0.5049999952316284],
    weld2: [2.0783333778381348, 4.011666774749756, 5.566275119781494, 2, 1.100000023841858, 1, 0.6399999856948853],
  },
  1003: {
    base: [6.17307710647583, 20.846399307250977, 0, 1, 0, 0, 0, 0],
    rank1: [6.17307710647583, 42.04684066772461, 1, 0.6399999856948853, 3.75, 10, 2, 3],
    rank2: [10.800000190734863, 68.48604583740234, 2, 0.5049999952316284, 6.75, 11, 4, 3.75],
    weld2: [12.34615421295166, 21.023420333862305, 1, 0.6399999856948853, 3.75, 10, 2, 3],
  },
  1004: {
    base: [3.010000228881836, 22.200000762939453, 0, 1, 0, 0, 0],
    rank1: [3.010000228881836, 44.70000457763672, 1, 0.6399999856948853, 0, 0.09999999403953552, 0.11999999731779099],
    rank2: [4.216000080108643, 65.4000015258789, 2, 0.5049999952316284, 0, 0.19999998807907104, 0.20000000298023224],
    weld2: [6.020000457763672, 22.35000228881836, 1, 0.6399999856948853, 0, 0.09999999403953552, 0.11999999731779099],
  },
  1005: {
    base: [8, 11.416999816894531, 0, 0, 0, 0, 0, 0],
    rank1: [8, 23.070493698120117, 15, 0.07499999552965164, 3.75, 10, 2, 3],
    rank2: [12.44444465637207, 37.595359802246094, 25, 0.14999999105930328, 6.75, 11, 4, 3.75],
    weld2: [16, 11.535246849060059, 15, 0.07499999552965164, 3.75, 10, 2, 3],
  },
  1006: {
    base: [5.5, 15, 1, 1, 0, 1],
    rank1: [5.5, 17.700000762939453, 2, 1.100000023841858, 2.5, 1.5],
    rank2: [16, 25.700000762939453, 3, 1.25, 5, 2],
    weld2: [11, 8.850000381469727, 2, 1.100000023841858, 2.5, 1.5],
  },
  1007: {
    base: [8, 20, 30, 1, 0, 0, 0, 0, 0],
    rank1: [8, 20, 294.4375, 1.5, 2.5, 3.75, 10, 2, 2.4000000953674316],
    rank2: [14, 60, 417.125, 2, 5, 6.75, 11, 4, 3],
    weld2: [16, 40, 158.59375, 1.5, 2.5, 3.75, 10, 2, 2.4000000953674316],
  },
  1008: {
    base: [1.3125, 14.75, 1, 0, 0, 0],
    rank1: [1.3125, 18.84375, 1.5, 2.5, 0.09999999403953552, 0.5],
    rank2: [3.0374999046325684, 24.812498092651367, 2, 5, 0.19999998807907104, 0.8333333134651184],
    weld2: [2.625, 11.0625, 1.5, 2.5, 0.09999999403953552, 0.5],
  },
  1009: {
    base: [2.0200002193450928, 9.0600004196167, 0, 1, 0, 1],
    rank1: [2.0200002193450928, 11.272500991821289, 1, 0.6399999856948853, 1, 1.5],
    rank2: [6.0320000648498535, 14.219999313354492, 2, 0.5049999952316284, 2, 2],
    weld2: [4.0400004386901855, 6.6362504959106445, 1, 0.6399999856948853, 1, 1.5],
  },
} as const satisfies Readonly<Record<NativeWeldBuildId, Readonly<Record<string, readonly number[]>>>>

test('rebuilds every mixed native weld vector at base, rank one, rank two, and enhanced-weld inputs', () => {
  const stats = playerStatBook()
  for (const build of NATIVE_WELD_BUILDS) {
    const buildId = build.id as NativeWeldBuildId
    const expected = GOLDENS[buildId]
    const baseRanks = Object.fromEntries(build.primarySkillIds.map((skillId) => [skillId, 1]))
    const rankOne = Object.fromEntries(build.componentSkillIds.map((skillId) => [skillId, 1]))
    const rankTwo = Object.fromEntries(build.componentSkillIds.map((skillId) => [skillId, 2]))
    assertVector(nativeWeldPrimaryVector(book(buildId, baseRanks), stats, buildId), expected.base)
    assertVector(nativeWeldPrimaryVector(book(buildId, rankOne), stats, buildId), expected.rank1)
    assertVector(nativeWeldPrimaryVector(book(buildId, rankTwo), stats, buildId), expected.rank2)
    assertVector(nativeWeldPrimaryVector(book(buildId, rankOne), stats, buildId, 2), expected.weld2)
  }
})

test('classifies the four one-shot, three immediate channels, and three persistent welded actors', () => {
  const stats = playerStatBook()
  const expected = new Map<NativeWeldBuildId, string>([
    [1000, 'one-shot'], [1001, 'one-shot'], [1002, 'one-shot'],
    [1003, 'channel'], [1004, 'channel'], [1005, 'channel'],
    [1006, 'persistent'], [1007, 'persistent'], [1008, 'persistent'],
    [1009, 'one-shot'],
  ])
  for (const build of NATIVE_WELD_BUILDS) {
    const buildId = build.id as NativeWeldBuildId
    const ranks = Object.fromEntries(build.componentSkillIds.map((skillId) => [skillId, 1]))
    assert.equal(nativeWeldPrimaryVector(book(buildId, ranks), stats, buildId).castKind, expected.get(buildId))
  }
})

test('sorts only the three native commutative cost pairs before weighting them', () => {
  const stats = playerStatBook()
  const cases = [
    [1000, 8, 16, 9.628499984741211],
    [1001, 8, 32, 11.733333587646484],
    [1004, 32, 24, 12.600001335144043],
  ] as const
  for (const [buildId, firstSkillId, secondSkillId, expected] of cases) {
    const build = NATIVE_WELD_BUILDS[buildId - 1000]!
    const ranks = Object.fromEntries(build.componentSkillIds.map((skillId) => [skillId, 1]))
    const first = withManaCosts(stats, firstSkillId, 1, secondSkillId, 10)
    const second = withManaCosts(stats, firstSkillId, 10, secondSkillId, 1)
    const slot = buildId < 1003 ? 2 : 1
    assert.ok(Math.abs(
      nativeWeldPrimaryVector(book(buildId, ranks), first, buildId).values[slot]! - expected,
    ) < 0.000_01)
    assert.ok(Math.abs(
      nativeWeldPrimaryVector(book(buildId, ranks), second, buildId).values[slot]! - expected,
    ) < 0.000_01)
  }
})

function book(
  buildId: NativeWeldBuildId,
  ranks: Readonly<Record<number, number>>,
): PlayerSkillBookComponent {
  const source = createPlayerSkillBook({
    discipline: 'arcane',
    displayName: 'Native Weld Vector Test',
    element: 'ether',
  })
  const permanentRanks = [...source.permanentRanks]
  const effectiveRanks = [...source.effectiveRanks]
  permanentRanks[52] = 1
  effectiveRanks[52] = 1
  for (const [rawSkillId, rank] of Object.entries(ranks)) {
    const skillId = Number(rawSkillId)
    permanentRanks[skillId] = rank
    effectiveRanks[skillId] = rank
  }
  return {
    ...source,
    activeWeldBuildId: buildId,
    effectiveRanks,
    permanentRanks,
  }
}

function assertVector(
  actual: ReturnType<typeof nativeWeldPrimaryVector>,
  expected: readonly number[],
): void {
  assert.equal(actual.values.length, expected.length)
  for (let index = 0; index < expected.length; index += 1) {
    assert.ok(
      Math.abs(actual.values[index]! - expected[index]!) <= 0.000_01,
      `slot ${index}: expected ${expected[index]}, received ${actual.values[index]}`,
    )
  }
}

function withManaCosts(
  source: ReturnType<typeof playerStatBook>,
  firstSkillId: number,
  firstCost: number,
  secondSkillId: number,
  secondCost: number,
): ReturnType<typeof playerStatBook> {
  const entries = source.entries.map((entry) => {
    if (!entry) return entry
    const cost = entry.id === firstSkillId
      ? firstCost
      : entry.id === secondSkillId
        ? secondCost
        : 0
    return {
      ...entry,
      numericProperties: { ...entry.numericProperties, mManaCost: cost },
    }
  })
  return { entries }
}
