import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  DOWSING_EQUIPMENT_RECIPES,
  createEquipmentInventoryItem,
  type HubInventoryItem,
  type NativeEquipmentEffect,
} from '../core-kernels/hub-economy.ts'
import {
  bindNativeBeltSkill,
  freezeNativeBelt,
} from '../core-kernels/native-belt.ts'
import { nativeEquipmentRecipeEffects } from '../core-kernels/native-equipment-effects.ts'
import { createNativeRng, drawNativeInteger } from '../core-kernels/native-rng.ts'
import {
  isNativeBeltSkill,
  nativeSkillCategory,
  selectPlayerPrimarySkill,
} from '../core-kernels/player-progression.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { gameSnapshot as decodeSnapshot } from '../protocol/codecs/snapshot.ts'
import {
  createGameSaveDocument,
  createGameProfileSaveDocument,
  hydrateGameSaveProfile,
  restoreGameSaveDocument,
  restoreGameSaveProfile,
} from '../save/game-save-document.ts'
import { createPortableGameProfileFromWebSave } from '../save/game-save-portability.ts'
import { createNativeGameSaveSource } from '../save/portable-game-profile.ts'
import { nativeSkillBookPages } from '../skill-book-model.ts'
import {
  applyGameSimulationHubAction,
  createGameSimulation,
  type GameSimulationState,
} from './game-simulation.ts'
import {
  grantPlayerEntitySkillRanks,
  replacePlayerEconomy,
  selectPlayerEntityConcentrationSkill,
  selectPlayerEntityPrimarySkill,
} from './player-entity-store.ts'

const OWNER = 'grant-owner'
const FIRE = { discipline: 'arcane', displayName: 'Grant Tester', element: 'fire' } as const
const RANDOM_GRANT_TARGETS = [
  8, 11, 16, 21, 22, 23, 24, 27, 29, 32, 40, 50, 52, 55,
  57, 58, 59, 60, 61, 62, 63, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
] as const

function fixture(selectors: readonly number[] = []): GameSimulationState {
  const state = createGameSimulation({ [OWNER]: FIRE })
  const economy = state.playerEntities.economies[0]!
  return {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, OWNER, {
      ...economy,
      ownedPerkSelectors: selectors,
    }),
  }
}

function namedItem(recipeIndex: number): HubInventoryItem {
  const recipe = DOWSING_EQUIPMENT_RECIPES.find(row => row.sourceIndex === recipeIndex)
  assert.ok(recipe)
  return createEquipmentInventoryItem(recipe, 10_000 + recipeIndex)
}

function effectItem(effects: readonly NativeEquipmentEffect[]): HubInventoryItem {
  return {
    ...namedItem(0),
    id: 20_000,
    generatedLevel: 4,
    iconRecords: [52],
    name: 'Grant regression ring',
    nativeEffects: effects,
    nativeSelector: 0,
    rarity: null,
    recipeIndex: null,
  }
}

function equip(state: GameSimulationState, item: HubInventoryItem): GameSimulationState {
  const economy = state.playerEntities.economies[0]!
  const equipment = { ...economy.equipment }
  if (item.equipmentType === 'ring') equipment.rings = [item, null, null]
  else if (item.equipmentType === 'amulet') equipment.amulet = item
  else if (item.equipmentType === 'hat') equipment.hat = item
  else if (item.equipmentType === 'robe') equipment.robe = item
  else equipment.weapon = item
  return {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, OWNER, {
      ...economy,
      equipment,
      nextItemId: Math.max(economy.nextItemId, item.id + 1),
      revision: economy.revision + 1,
    }),
  }
}

function progression(state: GameSimulationState) {
  const snapshot = createGameSnapshot(state, OWNER)
  decodeSnapshot(snapshot)
  return snapshot.players[OWNER]!.progression
}

test('Strangler grants a visible usable rank-one Call Leviathan without permanent learning', () => {
  const original = fixture()
  const state = equip(original, namedItem(15))
  const book = state.playerEntities.skillBooks[0]!
  assert.equal(book.permanentRanks[11], 0)
  assert.equal(book.effectiveRanks[11], 1)
  assert.ok(book.learnedSkillOrder.includes(11))
  assert.deepEqual(state.playerEntities.belts[0]![1], { kind: 'skill', skillId: 11 })
  assert.deepEqual(book.permanentRanks, original.playerEntities.skillBooks[0]!.permanentRanks)
  const view = progression(state)
  assert.ok(nativeSkillBookPages(view).some(page => page.rootSkillId === 11))
  assert.deepEqual(bindNativeBeltSkill(state.playerEntities.belts[0]!, book, 11, 7)[7], {
    kind: 'skill', skillId: 11,
  })
})

test('Strangler uses Revelation rank two and preserves its separate damage modifier', () => {
  const state = equip(fixture([6]), namedItem(15))
  assert.equal(state.playerEntities.skillBooks[0]!.permanentRanks[11], 0)
  assert.equal(state.playerEntities.skillBooks[0]!.effectiveRanks[11], 2)
  assert.equal(state.playerEntities.skillRuntimes[0]!.equipmentModifiers.skillDamageFlat[11], 1)
  progression(state)
})

test('all fifteen named granting recipes publish their temporary skill members', () => {
  let recipeCount = 0
  let grantCount = 0
  for (const recipe of DOWSING_EQUIPMENT_RECIPES) {
    const effects = nativeEquipmentRecipeEffects(recipe.sourceIndex)
      .filter(effect => effect.kind === 4 || effect.kind === 7)
    if (effects.length === 0) continue
    recipeCount += 1
    const original = fixture()
    const state = equip(original, namedItem(recipe.sourceIndex))
    const book = state.playerEntities.skillBooks[0]!
    for (const effect of effects) {
      grantCount += 1
      assert.ok(book.effectiveRanks[effect.target]! > 0, recipe.name)
      assert.ok(book.learnedSkillOrder.includes(effect.target), `${recipe.name}: ${effect.target}`)
      const category = nativeSkillCategory(effect.target)
      if (category === 1 || category === 2) {
        const alreadyKnown = original.playerEntities.skillBooks[0]!.learnedSkillOrder
          .includes(effect.target)
        if (!alreadyKnown) assert.ok(state.playerEntities.belts[0]!.some(entry => (
          entry?.kind === 'skill' && entry.skillId === effect.target
        )), recipe.name)
      }
    }
    assert.deepEqual(book.permanentRanks, original.playerEntities.skillBooks[0]!.permanentRanks)
    progression(state)
  }
  assert.equal(recipeCount, 15)
  assert.equal(grantCount, 20)
})

test('the complete Tempest Kit grants Hurricane through the same visible lifecycle', () => {
  let state = fixture()
  for (const recipeIndex of [16, 17, 18]) state = equip(state, namedItem(recipeIndex))
  assert.equal(state.playerEntities.skillBooks[0]!.effectiveRanks[29], 0)
  state = equip(state, namedItem(19))
  const book = state.playerEntities.skillBooks[0]!
  assert.equal(book.permanentRanks[29], 0)
  assert.equal(book.effectiveRanks[29], 1)
  assert.ok(book.learnedSkillOrder.includes(29))
  progression(state)
  const economy = state.playerEntities.economies[0]!
  state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, OWNER, {
    ...economy, equipment: { ...economy.equipment, amulet: null },
  }) }
  assert.equal(state.playerEntities.skillBooks[0]!.effectiveRanks[29], 0)
  assert.equal(state.playerEntities.skillBooks[0]!.learnedSkillOrder.includes(29), false)
})

test('all random Grant Skill targets at authored magnitudes use the same availability path', () => {
  for (const skillId of RANDOM_GRANT_TARGETS) {
    for (const magnitude of [1, 2, 4]) {
      const state = equip(fixture(), effectItem([{ kind: 4, magnitude, operator: 0, target: skillId }]))
      const book = state.playerEntities.skillBooks[0]!
      assert.ok(book.effectiveRanks[skillId]! > 0, `skill ${skillId}/${magnitude}`)
      assert.ok(book.learnedSkillOrder.includes(skillId), `visible ${skillId}/${magnitude}`)
      if (isNativeBeltSkill(skillId)) {
        const belt = bindNativeBeltSkill(state.playerEntities.belts[0]!, book, skillId, 7)
        assert.equal(belt[7]?.kind, 'skill')
      } else {
        assert.throws(() => bindNativeBeltSkill(state.playerEntities.belts[0]!, book, skillId, 7), /not a native belt skill/)
      }
      if (nativeSkillCategory(skillId) === 3) {
        assert.equal(state.playerEntities.belts[0]!.some(entry => (
          entry?.kind === 'skill' && entry.skillId === skillId
        )), false, 'concentrations require manual placement')
      }
      if (nativeSkillCategory(skillId) === 1 && skillId !== 52) {
        assert.equal(selectPlayerPrimarySkill(book, skillId).primarySkillId, skillId)
      }
      if (skillId === 52) assert.throws(() => selectPlayerPrimarySkill(book, skillId), /Weld|build/i)
      progression(state)
    }
  }
})

test('grant refresh respects manual placement, a full belt, and removal of the final provider', () => {
  let state = equip(fixture(), namedItem(15))
  const book = state.playerEntities.skillBooks[0]!
  let belt = bindNativeBeltSkill(state.playerEntities.belts[0]!, book, 11, 7)
  belt = bindNativeBeltSkill(belt, book, null, 1)
  state = { ...state, playerEntities: { ...state.playerEntities, belts: [belt] } }
  state = equip(state, namedItem(15))
  assert.equal(state.playerEntities.belts[0]![1], null, 'ordinary refresh does not refill cleared slots')
  assert.deepEqual(state.playerEntities.belts[0]![7], { kind: 'skill', skillId: 11 })

  const economy = state.playerEntities.economies[0]!
  state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, OWNER, {
    ...economy, equipment: { ...economy.equipment, amulet: null },
  }) }
  assert.equal(state.playerEntities.skillBooks[0]!.effectiveRanks[11], 0)
  assert.equal(state.playerEntities.skillBooks[0]!.learnedSkillOrder.includes(11), false)
  assert.equal(state.playerEntities.belts[0]![7], null)
  assert.throws(() => bindNativeBeltSkill(state.playerEntities.belts[0]!, state.playerEntities.skillBooks[0]!, 11, 1), /not learned|unavailable/)
  state = equip(state, namedItem(15))
  assert.deepEqual(state.playerEntities.belts[0]![1], { kind: 'skill', skillId: 11 })

  const fresh = fixture()
  const full = freezeNativeBelt(Array.from({ length: 8 }, () => ({ kind: 'skill', skillId: 21 } as const)))
  const filled = equip({ ...fresh, playerEntities: { ...fresh.playerEntities, belts: [full] } }, namedItem(15))
  assert.deepEqual(filled.playerEntities.belts[0], full)
  assert.ok(filled.playerEntities.skillBooks[0]!.learnedSkillOrder.includes(11))
})

test('permanently acquiring an item-granted skill keeps one visible row and one automatic binding', () => {
  let state = equip(fixture(), namedItem(15))
  state = { ...state, playerEntities: grantPlayerEntitySkillRanks(
    state.playerEntities, OWNER, 11, 1, createNativeRng(12),
  ).store }
  assert.equal(state.playerEntities.skillBooks[0]!.learnedSkillOrder.filter(id => id === 11).length, 1)
  assert.equal(state.playerEntities.belts[0]!.filter(entry => entry?.kind === 'skill' && entry.skillId === 11).length, 1)
  const economy = state.playerEntities.economies[0]!
  state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, OWNER, {
    ...economy, equipment: { ...economy.equipment, amulet: null },
  }) }
  assert.equal(state.playerEntities.skillBooks[0]!.effectiveRanks[11], 1)
  assert.deepEqual(state.playerEntities.belts[0]![1], { kind: 'skill', skillId: 11 })
  progression(state)
})

test('equipped grants and manual bindings survive full web-save round-trip without permanent promotion', () => {
  let state = equip(fixture([6]), namedItem(15))
  const book = state.playerEntities.skillBooks[0]!
  const belt = bindNativeBeltSkill(state.playerEntities.belts[0]!, book, 11, 7)
  state = { ...state, playerEntities: { ...state.playerEntities, belts: [belt] } }
  const document = createGameSaveDocument({
    integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {}, playerId: OWNER, state,
  })
  const restored = restoreGameSaveDocument(document).state
  assert.equal(restored.playerEntities.skillBooks[0]!.permanentRanks[11], 0)
  assert.equal(restored.playerEntities.skillBooks[0]!.effectiveRanks[11], 2)
  assert.deepEqual(restored.playerEntities.belts[0], belt)
  progression(restored)
})

test('old effective-only saves acquire the missing visible row and initial belt slot once', () => {
  const state = equip(fixture(), namedItem(15))
  const payload = JSON.parse(createGameSaveDocument({
    integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {}, playerId: OWNER, state,
  }))
  const players = payload.continuation.simulation.playerEntities
  players.skillBooks[0].learnedSkillOrder = players.skillBooks[0].learnedSkillOrder.filter((id: number) => id !== 11)
  players.belts[0] = players.belts[0].map((entry: { kind: string; skillId?: number } | null) => (
    entry?.kind === 'skill' && entry.skillId === 11 ? null : entry
  ))
  const restored = restoreGameSaveDocument(JSON.stringify(payload)).state
  assert.equal(restored.playerEntities.skillBooks[0]!.permanentRanks[11], 0)
  assert.ok(restored.playerEntities.skillBooks[0]!.learnedSkillOrder.includes(11))
  assert.deepEqual(restored.playerEntities.belts[0]![1], { kind: 'skill', skillId: 11 })
  progression(restored)
})

test('a College loadout profile restores equipped grants without permanent learning', () => {
  const state = equip(fixture([6]), namedItem(15))
  const document = createGameProfileSaveDocument({
    integrity: 'local-only', mods: [], modState: {}, playerId: OWNER,
    state: { ...state, run: { ...state.run, phase: 'loadout' } },
  })
  const restored = hydrateGameSaveProfile(fixture(), OWNER, restoreGameSaveProfile(document))
  assert.equal(restored.playerEntities.skillBooks[0]!.permanentRanks[11], 0)
  assert.equal(restored.playerEntities.skillBooks[0]!.effectiveRanks[11], 2)
  assert.deepEqual(restored.playerEntities.belts[0]![1], { kind: 'skill', skillId: 11 })
  progression(restored)
})

test('remaining grant providers retain visibility and snapshots reject unavailable or duplicate rows', () => {
  let state = equip(equip(fixture(), namedItem(15)), namedItem(0))
  const economy = state.playerEntities.economies[0]!
  state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, OWNER, {
    ...economy, equipment: { ...economy.equipment, amulet: null },
  }) }
  assert.equal(state.playerEntities.skillBooks[0]!.effectiveRanks[11], 1)
  assert.deepEqual(state.playerEntities.belts[0]![1], { kind: 'skill', skillId: 11 })
  const good = createGameSnapshot(state, OWNER)
  decodeSnapshot(good)
  const duplicate = JSON.parse(JSON.stringify(good))
  duplicate.players[OWNER]!.progression.learnedSkillOrder.push(11)
  assert.throws(() => decodeSnapshot(duplicate), /learnedSkillOrder/)
  const unknown = JSON.parse(JSON.stringify(createGameSnapshot(fixture(), OWNER)))
  unknown.players[OWNER]!.belt[7] = { kind: 'skill', skillId: 11 }
  assert.throws(() => decodeSnapshot(unknown), /not learned/)
})

test('native progression export does not promote an equipment-only visible skill', async () => {
  const state = equip(fixture([6]), namedItem(15))
  const template = JSON.parse(readFileSync(
    new URL('../../../public/game/native/portable-profile-template.json', import.meta.url), 'utf8',
  )) as { files: { darkdata: { base64: string }; gamestate: { base64: string } }; expected: { runName: string } }
  const nativeSource = await createNativeGameSaveSource(
    Buffer.from(template.files.darkdata.base64, 'base64'),
    Buffer.from(template.files.gamestate.base64, 'base64'),
    template.expected.runName,
  )
  const document = createGameSaveDocument({
    integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {}, nativeSource, playerId: OWNER, state,
  })
  const portable = await createPortableGameProfileFromWebSave(document)
  assert.equal(portable.wizard.permanentRanks[11], 0)
  assert.equal(portable.wizard.learnedOrder.includes(11), false)
  assert.deepEqual(portable.wizard.permanentRanks, state.playerEntities.skillBooks[0]!.permanentRanks)
})

test('equipping a grant does not alter an unrelated player or expose the grant on that peer', () => {
  const peerId = 'untouched-peer'
  const original = createGameSimulation({
    [OWNER]: FIRE,
    [peerId]: { ...FIRE, displayName: 'Unaffected peer' },
  })
  const peerIndex = original.playerEntities.identities.findIndex(row => row.playerId === peerId)
  assert.ok(peerIndex > 0)
  const state = equip(original, namedItem(15))
  for (const component of ['skillBooks', 'skillRuntimes', 'belts', 'economies', 'progressions'] as const) {
    assert.deepEqual(state.playerEntities[component][peerIndex], original.playerEntities[component][peerIndex])
  }
  const snapshot = createGameSnapshot(state, OWNER)
  decodeSnapshot(snapshot)
  assert.ok(snapshot.players[OWNER]!.progression.learnedSkillOrder.includes(11))
  assert.equal(snapshot.players[peerId]!.progression.learnedSkillOrder.includes(11), false)
})

for (const actionType of ['unequip', 'equip'] as const) {
  test(`${actionType} repairs item-only selections before a paused inventory snapshot`, () => {
    let state = equip(fixture(), effectItem([
      { kind: 4, magnitude: 1, operator: 0, target: 8 },
      { kind: 4, magnitude: 1, operator: 0, target: 57 },
    ]))
    const economy = state.playerEntities.economies[0]!
    const replacement = namedItem(14)
    state = {
      ...state,
      playerEntities: replacePlayerEconomy(state.playerEntities, OWNER, {
        ...economy,
        backpack: [...economy.backpack, replacement],
      }),
    }
    state = {
      ...state,
      playerEntities: selectPlayerEntityConcentrationSkill(
        selectPlayerEntityPrimarySkill(state.playerEntities, OWNER, 8), OWNER, 57,
      ),
    }
    const expectedRng = drawNativeInteger(state.gameRng, 1).state
    const result = applyGameSimulationHubAction(state, OWNER, actionType === 'unequip'
      ? { type: 'unequip', slot: 'ring-0' }
      : { type: 'equip', itemId: replacement.id, slot: 'ring-0' })
    assert.equal(result.accepted, true)
    assert.equal(result.state.tick, state.tick, 'inventory need not resume simulation first')
    assert.equal(result.state.playerEntities.skillBooks[0]!.primarySkillId, 16)
    assert.equal(result.state.playerEntities.skillBooks[0]!.effectiveRanks[8], 0)
    assert.equal(result.state.playerEntities.skillRuntimes[0]!.concentrationSkillIdA, null)
    assert.deepEqual(result.state.gameRng, expectedRng, 'native fallback consumes one gameplay draw')
    assert.deepEqual(result.state.playerEntities.skillBooks[0]!.permanentRanks,
      state.playerEntities.skillBooks[0]!.permanentRanks)
    decodeSnapshot(createGameSnapshot(result.state, OWNER))
  })
}
