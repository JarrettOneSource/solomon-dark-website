import assert from 'node:assert/strict'
import test from 'node:test'
import { DOWSING_EQUIPMENT_RECIPES, createEquipmentInventoryItem, NATIVE_SKILL_BOOK_DEFINITIONS, createNativeSkillBookInventoryItem, insertLootInventoryItem } from '../core-kernels/hub-economy.ts'
import { createGameSimulation, applyGameSimulationHubAction, getPlayerEconomy, getPlayerSkillBook, getPlayerProgression } from './game-simulation.ts'
import { grantPlayerEntitySkillRanks, increaseRandomPlayerEntitySkill, replacePlayerEconomy } from './player-entity-store.ts'
import { playerStatBook } from '../core-kernels/player-progression.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from '../save/game-save-document.ts'

function fixture(subtype: 2 | 3, nested = false) {
  let state = createGameSimulation({ owner: { discipline: 'arcane', displayName: 'Book owner', element: 'water' },
    peer: { discipline: 'arcane', displayName: 'Other wizard', element: 'fire' } })
  const economy = getPlayerEconomy(state, 'owner')
  const book = createNativeSkillBookInventoryItem(NATIVE_SKILL_BOOK_DEFINITIONS.find(row => row.nativeSubtype === subtype)!, 501)
  const inventory = nested ? { ...book, id: 500, name: 'Sack', kind: 'sack' as const,
    nativeTypeId: 7008, nativeSubtype: 0, iconRecords: [70], contents: [book] } : book
  const inserted = insertLootInventoryItem(economy, inventory)
  assert.equal(inserted.accepted, true)
  const added = inserted.state.backpack.at(-1)!
  const bookId = nested ? added.contents![0]!.id : added.id
  state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', inserted.state) }
  return { state, bookId }
}

for (const subtype of [2, 3] as const) for (const nested of [false, true]) {
  test(`native book ${subtype}, nested=${nested}, publishes its actual result with one atomic consumption`, () => {
    const { state, bookId } = fixture(subtype, nested)
    const before = getPlayerSkillBook(state, 'owner')
    const result = applyGameSimulationHubAction(state, 'owner', { type: 'read-skill-book', itemId: bookId })
    assert.equal(result.accepted, true)
    const feedback = getPlayerEconomy(result.state, 'owner').actionFeedback!
    assert.equal(feedback.accepted, true)
    const after = getPlayerSkillBook(result.state, 'owner')
    if (subtype === 3) {
      assert.equal(feedback.skillBookOutcome?.kind, 'rank')
      assert.ok(feedback.skillBookOutcome?.kind === 'rank' && feedback.skillBookOutcome.skillId !== null)
      const changed = after.permanentRanks.flatMap((rank, id) => rank !== before.permanentRanks[id] ? [id] : [])
      assert.deepEqual(changed, [feedback.skillBookOutcome.skillId])
      assert.equal(after.permanentRanks[changed[0]!], before.permanentRanks[changed[0]!]! + 1)
      const repeated = applyGameSimulationHubAction(result.state, 'owner', { type: 'read-skill-book', itemId: bookId })
      assert.equal(repeated.accepted, false)
      assert.deepEqual(getPlayerSkillBook(repeated.state, 'owner'), after)
      assert.deepEqual(repeated.state.gameRng, result.state.gameRng)
    } else {
      assert.deepEqual(feedback.skillBookOutcome, { kind: 'choice' })
      assert.ok(getPlayerProgression(result.state, 'owner').pendingOffer)
      assert.deepEqual(after.permanentRanks, before.permanentRanks)
    }
    assert.deepEqual(getPlayerSkillBook(result.state, 'peer'), getPlayerSkillBook(state, 'peer'))
    assert.deepEqual(getPlayerEconomy(result.state, 'peer'), getPlayerEconomy(state, 'peer'))
  })
}

test('book result survives current saves; old feedback retirement preserves the already-granted rank and RNG', () => {
  const { state, bookId } = fixture(3)
  const accepted = applyGameSimulationHubAction(state, 'owner', { type: 'read-skill-book', itemId: bookId }).state
  const text = createGameSaveDocument({ integrity: 'global-clean', loadedBoneyard: null, mods: [], modState: {}, playerId: 'owner', state: accepted })
  const current = restoreGameSaveDocument(text)
  assert.equal(getPlayerEconomy(current.state, current.playerId).actionFeedback?.skillBookOutcome?.kind, 'rank')
  const invalid = JSON.parse(text)
  delete invalid.continuation.simulation.playerEntities.economies[0].actionFeedback.skillBookOutcome
  assert.throws(() => restoreGameSaveDocument(JSON.stringify(invalid)), /skillBookOutcome/)
  const old = JSON.parse(text)
  old.schemaVersion = 41
  delete old.continuation.simulation.playerEntities.economies[0].actionFeedback.skillBookOutcome
  const restored = restoreGameSaveDocument(JSON.stringify(old))
  assert.equal(getPlayerEconomy(restored.state, restored.playerId).actionFeedback, null)
  assert.deepEqual(getPlayerSkillBook(restored.state, restored.playerId), getPlayerSkillBook(current.state, current.playerId))
  assert.deepEqual(restored.state.gameRng, current.state.gameRng)
  assert.deepEqual(getPlayerEconomy(restored.state, restored.playerId).backpack, getPlayerEconomy(current.state, current.playerId).backpack)
})

function capStartingSkills(state: ReturnType<typeof createGameSimulation>) {
  for (const id of [32, 35]) {
    const granted = grantPlayerEntitySkillRanks(state.playerEntities, 'owner', id,
      playerStatBook().entries[id]!.maximumLevel - getPlayerSkillBook(state, 'owner').permanentRanks[id]!, state.gameRng)
    state = { ...state, playerEntities: granted.store, gameRng: granted.rng }
  }
  return state
}

test('rank book and world Bonus share equipment-only eligibility, and the learned rank survives removing its provider', () => {
  const fixtureState = fixture(3)
  let state = capStartingSkills(fixtureState.state)
  const item = createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES.find(row => row.sourceIndex === 15)!, 90000)
  const economy = getPlayerEconomy(state, 'owner')
  state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', {
    ...economy, equipment: { ...economy.equipment, amulet: item }, nextItemId: item.id + 1,
  }) }
  assert.equal(getPlayerSkillBook(state, 'owner').permanentRanks[11], 0)
  assert.equal(getPlayerSkillBook(state, 'owner').effectiveRanks[11], 1)
  const bonus = increaseRandomPlayerEntitySkill(state.playerEntities, 'owner', state.gameRng)
  assert.equal(bonus.skillId, 11)
  const result = applyGameSimulationHubAction(state, 'owner', { type: 'read-skill-book', itemId: fixtureState.bookId })
  assert.equal(result.accepted, true)
  assert.deepEqual(getPlayerEconomy(result.state, 'owner').actionFeedback?.skillBookOutcome, { kind: 'rank', skillId: 11 })
  assert.deepEqual(result.state.gameRng, bonus.rng)
  assert.equal(getPlayerSkillBook(result.state, 'owner').permanentRanks[11], 1)
  const afterEconomy = getPlayerEconomy(result.state, 'owner')
  const removed = { ...result.state, playerEntities: replacePlayerEconomy(result.state.playerEntities, 'owner', {
    ...afterEconomy, equipment: { ...afterEconomy.equipment, amulet: null },
  }) }
  assert.equal(getPlayerSkillBook(removed, 'owner').permanentRanks[11], 1)
  assert.equal(getPlayerSkillBook(removed, 'owner').effectiveRanks[11], 1)
})

test('an empty rank list still consumes its book, explicitly reports no rank result, and uses no RNG', () => {
  const source = fixture(3)
  const state = capStartingSkills(source.state)
  const result = applyGameSimulationHubAction(state, 'owner', { type: 'read-skill-book', itemId: source.bookId })
  assert.equal(result.accepted, true)
  assert.deepEqual(getPlayerEconomy(result.state, 'owner').actionFeedback?.skillBookOutcome, { kind: 'rank', skillId: null })
  assert.deepEqual(result.state.gameRng, state.gameRng)
  assert.deepEqual(getPlayerSkillBook(result.state, 'owner'), getPlayerSkillBook(state, 'owner'))
  assert.equal(getPlayerEconomy(result.state, 'owner').backpack.some(item => item.id === source.bookId), false)
})
