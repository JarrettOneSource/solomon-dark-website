import assert from 'node:assert/strict'
import test from 'node:test'

import { NATIVE_SECONDARY_ABILITY_IDS } from '../../core-kernels/native-secondary-ability-contract.ts'
import {
  NATIVE_SKILL_CATALOG,
  NATIVE_WELD_BUILDS,
  type PlayerSkillBookComponent,
  type PlayerSkillQuickbar,
} from '../../core-kernels/player-progression.ts'
import {
  createGameSimulation,
  getPlayerProgression,
  getPlayerSkillBook,
  getPlayerStatBook,
  type GameSimulationState,
} from '../game-simulation.ts'
import { describeMlBotPolicySkill } from './skill-descriptors.ts'
import { observeMlBotPolicySkillLoadout } from './skill-loadout.ts'
import { describeMlBotPolicySkillOffer } from './skill-options.ts'
import { ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES, ML_BOT_POLICY_SCALES } from './spec.ts'

const PLAYER_ID = 'agent'
const WIDTH = ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length
const COLUMN = Object.fromEntries(
  ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.map((name, index) => [name, index]),
) as Readonly<Record<string, number>>
const PRIMARY_IDS = [8, 16, 24, 32, 40] as const
const PRIMARY_ELEMENTS = {
  8: 'ether',
  16: 'fire',
  24: 'air',
  32: 'water',
  40: 'earth',
} as const
const FORMERLY_AMBIGUOUS_SECONDARIES = [48, 49, 50, 51, 54, 72, 73, 74, 76, 77, 78, 79]

test('equipped primary rows identify all five elements and ten weld builds exactly', () => {
  const identities = new Set<string>()
  for (const skillId of PRIMARY_IDS) {
    const state = createGameSimulation({
      [PLAYER_ID]: {
        discipline: 'arcane',
        displayName: 'Agent',
        element: PRIMARY_ELEMENTS[skillId],
      },
    })
    const row = equippedRow(state, 0)
    assert.equal(row[COLUMN.present!], 1)
    assertClose(row[COLUMN.option_id_index_scaled!]!, skillId / ML_BOT_POLICY_SCALES.skillId)
    assert.equal(row[COLUMN.is_primary!], 1)
    assert.equal(row[COLUMN.is_weld!], 0)
    identities.add(row.join(','))
  }
  for (const weld of NATIVE_WELD_BUILDS) {
    const state = withSkillBook(baseState(), source => {
      const permanentRanks = [...source.permanentRanks]
      const effectiveRanks = [...source.effectiveRanks]
      permanentRanks[52] = 1
      effectiveRanks[52] = 1
      return {
        ...source,
        effectiveRanks: Object.freeze(effectiveRanks),
        permanentRanks: Object.freeze(permanentRanks),
        primarySkillId: 52,
        weldBuildId: weld.id,
      }
    })
    const row = equippedRow(state, 0)
    assertClose(row[COLUMN.option_id_index_scaled!]!, 52 / ML_BOT_POLICY_SCALES.skillId)
    assert.equal(row[COLUMN.is_weld!], 1)
    assertClose(row[COLUMN.weld_build_index_scaled!]!, (weld.id - 1_000) / 10)
    identities.add(row.join(','))
  }
  assert.equal(identities.size, PRIMARY_IDS.length + NATIVE_WELD_BUILDS.length)
})

test('all 23 equipped secondary spells have collision-free rank-aware semantic rows', () => {
  const identities = new Set<string>()
  for (const skillId of NATIVE_SECONDARY_ABILITY_IDS) {
    const state = stateWithSecondarySlots([skillId])
    const row = equippedRow(state, 1)
    assert.equal(row.length, WIDTH)
    assert.ok(row.every(Number.isFinite))
    assert.equal(row[COLUMN.present!], 1)
    assert.equal(row[COLUMN.catalog_known!], 1)
    assertClose(row[COLUMN.option_id_index_scaled!]!, skillId / ML_BOT_POLICY_SCALES.skillId)
    assertClose(row[COLUMN.effective_rank_scaled!]!, 1 / ML_BOT_POLICY_SCALES.skillRank)
    assert.equal(row[COLUMN.is_secondary!], 1)
    assert.ok(ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.some((name, index) => (
      name.endsWith('_present') && row[index] === 1
    )))
    identities.add(row.join(','))
  }
  assert.equal(identities.size, NATIVE_SECONDARY_ABILITY_IDS.length)
  const formerlyAmbiguous = FORMERLY_AMBIGUOUS_SECONDARIES.map(skillId => (
    equippedRow(stateWithSecondarySlots([skillId]), 1).join(',')
  ))
  assert.equal(new Set(formerlyAmbiguous).size, FORMERLY_AMBIGUOUS_SECONDARIES.length)
})

test('equipped rows preserve all eight quickbar positions and exact empty rows', () => {
  const skillIds = [...NATIVE_SECONDARY_ABILITY_IDS.slice(0, 8)]
  const state = stateWithSecondarySlots(skillIds)
  for (let slot = 0; slot < 8; slot += 1) {
    const row = equippedRow(state, slot + 1)
    assertClose(
      row[COLUMN.option_id_index_scaled!]!,
      skillIds[slot]! / ML_BOT_POLICY_SCALES.skillId,
    )
  }
  const empty = stateWithSecondarySlots([])
  for (let slot = 1; slot <= 8; slot += 1) {
    assert.ok(equippedRow(empty, slot).every(value => value === 0))
  }
})

test('equipped rank and authored mechanics change together', () => {
  const rankOne = equippedRow(stateWithSecondarySlots([54], 1), 1)
  const rankTwo = equippedRow(stateWithSecondarySlots([54], 2), 1)
  assertClose(rankOne[COLUMN.effective_rank_scaled!]!, 1 / ML_BOT_POLICY_SCALES.skillRank)
  assertClose(rankTwo[COLUMN.effective_rank_scaled!]!, 2 / ML_BOT_POLICY_SCALES.skillRank)
  assert.notEqual(rankOne[COLUMN.absorb_scaled!], rankTwo[COLUMN.absorb_scaled!])
})

test('offer and equipped paths use the same descriptor row at the same rank', () => {
  let state = stateWithSecondarySlots([49], 2)
  const progression = getPlayerProgression(state, PLAYER_ID)
  state = {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      progressions: [{
        ...progression,
        pendingOffer: Object.freeze({
          level: progression.level,
          options: Object.freeze([{ skillId: 49, targetRank: 2 }]),
          sequence: 77,
        }),
      }],
    },
  }
  const offer = describeMlBotPolicySkillOffer(state, PLAYER_ID)
  assert.ok(offer)
  assert.deepEqual([...offer.descriptors], [...equippedRow(state, 1)])
})

test('descriptor membership covers every authored numeric skill property', () => {
  const state = baseState()
  const skillBook = getPlayerSkillBook(state, PLAYER_ID)
  const statBook = getPlayerStatBook(state, PLAYER_ID)
  const propertyDescriptor: Readonly<Record<string, string>> = {
    mAbsorb: 'absorb',
    mArcs: 'arcs',
    mArmorPlus: 'armor_plus',
    mCapLevel: 'cap_rank',
    mChance: 'chance',
    mCharges: 'charges',
    mConcentration: 'concentration',
    mCooldown: 'cooldown',
    mDamage: 'damage_min',
    mDamage1: 'damage_min',
    mDamage2: 'damage_max',
    mDuration: 'duration',
    mFlee: 'flee',
    mFragments: 'fragments',
    mFreeze: 'freeze',
    mHP: 'hp',
    mHoard: 'hoard',
    mLoss: 'loss',
    mManaCost: 'mana_cost',
    mMaxArmor: 'max_armor',
    mMaxLevel: 'max_rank',
    mPercent: 'percent',
    mPierces: 'pierces',
    mPushback: 'pushback',
    mQuantity: 'quantity',
    mRadius: 'radius',
    mReflect: 'reflect',
    mSeconds: 'duration',
    mSize: 'size',
    mSlow: 'slow',
    mSlowdown: 'slowdown',
    mSpeed: 'speed',
    mSpeedUp: 'speed_up',
    mStrength: 'strength',
    mStunAmount: 'stun_amount',
    mToHit: 'to_hit',
    mValue: 'value',
    mWeaken: 'weaken',
    mWiden: 'widen',
  }
  for (const catalog of NATIVE_SKILL_CATALOG.slice(0, 81)) {
    const stats = statBook.entries[catalog.id]
    if (!stats) continue
    const row = describeMlBotPolicySkill(skillBook, statBook, {
      applyCount: 0,
      skillId: catalog.id,
      targetRank: Math.min(1, stats.maximumLevel),
    })
    assert.ok(row.every(Number.isFinite), `skill ${catalog.id} descriptor must be finite`)
    assertClose(row[COLUMN.option_id_index_scaled!]!, catalog.id / ML_BOT_POLICY_SCALES.skillId)
    for (const property of Object.keys(stats.numericProperties)) {
      const descriptor = propertyDescriptor[property]
      assert.ok(descriptor, `skill ${catalog.id} property ${property} is not represented`)
      if (property === 'mCapLevel' || property === 'mMaxLevel') {
        assert.notEqual(COLUMN[`${descriptor}_scaled`], undefined)
        continue
      }
      assert.equal(
        row[COLUMN[`${descriptor}_present`]!],
        1,
        `skill ${catalog.id} property ${property} must be present`,
      )
    }
  }
})

function baseState(): GameSimulationState {
  return createGameSimulation({
    [PLAYER_ID]: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  })
}

function stateWithSecondarySlots(
  skillIds: readonly number[],
  rank = 1,
): GameSimulationState {
  return withSkillBook(baseState(), source => {
    const permanentRanks = [...source.permanentRanks]
    const effectiveRanks = [...source.effectiveRanks]
    for (const skillId of skillIds) {
      permanentRanks[skillId] = rank
      effectiveRanks[skillId] = rank
    }
    return {
      ...source,
      effectiveRanks: Object.freeze(effectiveRanks),
      permanentRanks: Object.freeze(permanentRanks),
      skillQuickbar: quickbar(skillIds),
    }
  })
}

function withSkillBook(
  state: GameSimulationState,
  update: (source: PlayerSkillBookComponent) => PlayerSkillBookComponent,
): GameSimulationState {
  return {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      skillBooks: [update(getPlayerSkillBook(state, PLAYER_ID))],
    },
  }
}

function quickbar(skillIds: readonly number[]): PlayerSkillQuickbar {
  return Object.freeze(Array.from({ length: 8 }, (_, index) => (
    (skillIds[index] ?? null) as PlayerSkillQuickbar[number]
  ))) as PlayerSkillQuickbar
}

function equippedRow(state: GameSimulationState, row: number): Float32Array {
  return observeMlBotPolicySkillLoadout(state, PLAYER_ID).slice(row * WIDTH, (row + 1) * WIDTH)
}

function assertClose(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} is not close to ${expected}`)
}
