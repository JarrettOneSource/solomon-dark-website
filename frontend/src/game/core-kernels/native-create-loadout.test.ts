import assert from 'node:assert/strict'
import test from 'node:test'

import { nativeWizardClassTitle, wizardClassDisplayTitle } from './native-wizard-class.ts'
import { isWizardDiscipline, isWizardElement } from './player-character.ts'
import { applyPlayerSkillChoice, buildPlayerSkillOffer, createPlayerProgression, createPlayerSkillBook } from './player-progression.ts'
import {
  finalizeNativeCreateLoadout,
  NATIVE_CREATE_ENTRY_FADE_MS,
  NATIVE_CREATE_RANDOMIZE_FINALIZE_MS,
} from './native-create-loadout.ts'
import { createNativeRng, type NativeRngState } from './native-rng.ts'

const ELEMENTS = ['ether', 'fire', 'air', 'water', 'earth'] as const
const ROOTS = [...ELEMENTS, 'body', 'mind', 'arcane'] as const
const STARTERS = [[8, 11], [16, 21], [24, 27], [32, 35], [40, 45]] as const

test('Create identity accepts every native secondary root without broadening primary roots', () => {
  for (const root of ROOTS) assert.equal(isWizardDiscipline(root), true, root)
  for (const root of ['unknown', '', 'Fire', '0', 'constructor']) {
    assert.equal(isWizardDiscipline(root), false, root)
  }
  for (const root of ['arcane', 'body', 'mind']) assert.equal(isWizardElement(root), false)
})

test('all forty native root pairs retain primary-owned starting spells and exact numeric roots', () => {
  for (const [elementRoot, element] of ELEMENTS.entries()) {
    for (const [disciplineRoot, discipline] of ROOTS.entries()) {
      const book = createPlayerSkillBook({ element, discipline, displayName: 'RetainedName' })
      assert.equal(book.elementRoot, elementRoot, `${element}/${discipline}`)
      assert.equal(book.disciplineRoot, disciplineRoot, `${element}/${discipline}`)
      assert.equal(book.primarySkillId, STARTERS[elementRoot]![0])
      assert.deepEqual(book.learnedSkillOrder, STARTERS[elementRoot])
      assert.deepEqual(book.permanentRanks.slice(0, 8), Array(8).fill(1))
      assert.deepEqual(book.permanentRanks.flatMap((rank, id) => id >= 8 && rank > 0 ? [id] : []), STARTERS[elementRoot])
      assert.deepEqual(book.effectiveRanks, book.permanentRanks)
    }
  }
})

test('all elemental secondary roots use the retail WIZARD fallback, including imported equal pairs', () => {
  for (const element of ELEMENTS) {
    for (const discipline of ELEMENTS) {
      assert.equal(nativeWizardClassTitle(element, discipline), 'WIZARD', `${element}/${discipline}`)
      assert.equal(wizardClassDisplayTitle(element, discipline), 'Wizard')
    }
  }
})

// Exact thirty-bit native words: each draw adds a zero word at index B.
function stream(...values: number[]): NativeRngState {
  const words = Array<number>(55).fill(0)
  values.forEach((value, index) => { words[index] = value << 6 })
  return { indexA: 0, indexB: 31, words }
}

test('native randomization drains all ordinary and distinct elemental choices in native pool order', () => {
  const ordinary = ['arcane', 'body', 'mind'] as const
  for (const [primary, element] of ELEMENTS.entries()) {
    for (const gate of [0, 2, 3]) {
      for (const [choice, discipline] of ordinary.entries()) {
        const result = finalizeNativeCreateLoadout(stream(primary, gate, choice), {
          displayName: 'Keep This Name', element: null, discipline: null,
        })
        assert.deepEqual(result.config, { displayName: 'Keep This Name', element, discipline })
        assert.equal(result.state.indexA, 3)
      }
    }
    for (const [secondary, discipline] of ELEMENTS.entries()) {
      if (primary === secondary) continue
      const result = finalizeNativeCreateLoadout(stream(primary, 1, primary, primary, secondary), {
        displayName: 'Mixed', element: null, discipline: null,
      })
      assert.deepEqual(result.config, { displayName: 'Mixed', element, discipline })
      assert.equal(result.state.indexA, 5, 'same-root rejection consumes native words')
    }
  }
})

test('native finalizer fills only missing selections and does not consume unnecessary RNG', () => {
  const state = stream(1, 3)
  const complete = { displayName: 'Manual', element: 'fire', discipline: 'body' } as const
  const unchanged = finalizeNativeCreateLoadout(state, complete)
  assert.deepEqual(unchanged.config, complete)
  assert.strictEqual(unchanged.state, state)
  const selected = finalizeNativeCreateLoadout(state, { ...complete, discipline: null })
  assert.deepEqual(selected.config, { ...complete, discipline: 'water' })
  assert.equal(selected.state.indexA, 2)
  const secondaryChosen = finalizeNativeCreateLoadout(state, { ...complete, element: null })
  assert.deepEqual(secondaryChosen.config, complete)
  assert.equal(secondaryChosen.state.indexA, 1)
})

test('native disabled-primary filtering is ordered and never filters the secondary draw', () => {
  const result = finalizeNativeCreateLoadout(stream(2, 1, 1), {
    displayName: 'Filtered', element: null, discipline: null,
  }, new Set([16, 32]))
  assert.deepEqual(result.config, { displayName: 'Filtered', element: 'earth', discipline: 'fire' })
  assert.equal(result.state.indexA, 3)
  const state = stream(2)
  const empty = finalizeNativeCreateLoadout(state, {
    displayName: 'Empty', element: null, discipline: 'mind',
  }, new Set([8, 16, 24, 32, 40]))
  assert.equal(empty.config.element, 'ether')
  assert.strictEqual(empty.state, state, 'Integer(0) does not advance the stream')
})

test('retail seeded vectors pin draw order, modulo-biased branch, and rejection loop', () => {
  for (const [seed, element, discipline, draws] of [
    [0, 'water', 'arcane', 3], [4, 'fire', 'air', 3],
    [16, 'ether', 'body', 3], [28, 'ether', 'mind', 3],
    [107, 'ether', 'water', 4],
  ] as const) {
    const state = createNativeRng(seed)
    const result = finalizeNativeCreateLoadout(state, { displayName: 'Seeded', element: null, discipline: null })
    assert.deepEqual(result.config, { displayName: 'Seeded', element, discipline })
    assert.equal(result.state.indexA, draws)
    assert.equal(state.indexA, 0, 'source stream remains immutable')
  }
})

test('Create input and dice completion use native float32 fade boundaries', () => {
  assert.equal(NATIVE_CREATE_ENTRY_FADE_MS, 200)
  assert.equal(NATIVE_CREATE_RANDOMIZE_FINALIZE_MS, 230)
  let fade = 0
  let ticks = 0
  while (fade <= Math.fround(1.1)) {
    fade = Math.fround(fade + 0.05000000074505806)
    ticks += 1
  }
  assert.equal(ticks * 10, NATIVE_CREATE_RANDOMIZE_FINALIZE_MS)
})

test('mixed secondary roots enter the priority offer pool and remain learnable with Weird Caster bias', () => {
  const book = createPlayerSkillBook({ element: 'fire', discipline: 'water', displayName: 'Mixed' })
  for (const disciplineOfferBias of [false, true]) {
    const offered = new Set<number>()
    let learnedWater = false
    for (let seed = 0; seed < 128; seed += 1) {
      const progression = { ...createPlayerProgression(seed), level: 20, disciplineOfferBias }
      const { offer, rng } = buildPlayerSkillOffer(progression, book, 1, createNativeRng(1))
      // Native selection permutes the completed triplet after choosing its root row.
      assert.ok(offer.options.some(({ skillId }) => (skillId >= 16 && skillId < 24)
        || (skillId >= 32 && skillId < 40)), 'the offer must retain its Fire/Water priority member')
      for (const option of offer.options) offered.add(option.skillId)
      const choiceIndex = offer.options.findIndex(option => option.skillId === 32)
      if (choiceIndex < 0) continue
      const result = applyPlayerSkillChoice({ ...progression, pendingOffer: offer }, book,
        { choiceIndex, offerSequence: 1, skillId: 32 }, rng)
      assert.ok(result)
      assert.equal(result.skillBook.permanentRanks[32], 1)
      assert.equal(result.skillBook.disciplineRoot, 3)
      assert.equal(result.skillBook.primarySkillId, 16, 'learning Water does not replace the selected Fire cast')
      learnedWater = true
    }
    assert.ok([...offered].some(skillId => skillId >= 32 && skillId < 40))
    assert.equal(learnedWater, true)
  }
})
