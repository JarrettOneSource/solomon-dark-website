import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_SKILL_CATALOG,
  NATIVE_WELD_BUILDS,
  SPELL_WELDING_SKILL_ID,
  nativeSkillCategory,
} from '../../core-kernels/player-progression.ts'
import {
  ML_BOT_PRIMARY_CURRICULUM,
  mlBotPrimaryCurriculumEntry,
  mlBotPrimaryCurriculumEntryForSeed,
} from './primary-curriculum.ts'

test('primary curriculum discovers every native pure primary and Weld build exactly once', () => {
  const expectedPure = NATIVE_SKILL_CATALOG
    .filter(({ id }) => id !== SPELL_WELDING_SKILL_ID && nativeSkillCategory(id) === 1)
    .map(({ id }) => `primary:${id}`)
  const expectedWelds = NATIVE_WELD_BUILDS.map(({ id }) => `weld:${id}`)
  assert.deepEqual(
    ML_BOT_PRIMARY_CURRICULUM.map(({ key }) => key),
    [...expectedPure, ...expectedWelds],
  )
  assert.equal(new Set(ML_BOT_PRIMARY_CURRICULUM.map(({ key }) => key)).size, 15)
})

test('primary curriculum records exact continuous-cast ownership', () => {
  assert.deepEqual(
    ML_BOT_PRIMARY_CURRICULUM
      .filter(({ castMode }) => castMode === 'continuous')
      .map(({ key }) => key),
    [
      'primary:24',
      'primary:32',
      'primary:40',
      'weld:1003',
      'weld:1004',
      'weld:1005',
    ],
  )
})

test('seed scheduling covers the full authored curriculum without a copied selector table', () => {
  const scheduled = Array.from(
    { length: ML_BOT_PRIMARY_CURRICULUM.length * 2 },
    (_, index) => mlBotPrimaryCurriculumEntryForSeed(index).key,
  )
  assert.deepEqual(scheduled, [
    ...ML_BOT_PRIMARY_CURRICULUM.map(({ key }) => key),
    ...ML_BOT_PRIMARY_CURRICULUM.map(({ key }) => key),
  ])
  for (const entry of ML_BOT_PRIMARY_CURRICULUM) {
    assert.equal(mlBotPrimaryCurriculumEntry(entry.key), entry)
  }
  assert.throws(() => mlBotPrimaryCurriculumEntry('primary:999'), /unknown/)
})
