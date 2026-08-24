import assert from 'node:assert/strict'
import test from 'node:test'

import {
  archiveHubMemorialPortrait,
  createHubMemorialState,
} from './core-kernels/hub-memorial.ts'

import {
  HUB_HUD_SHORTCUTS,
  HUB_INTERACTION_DIALOGUES,
  HUB_INTERACTION_IDS,
  HUB_TRADER_DIALOGUES,
  HUB_TRADER_GRID_CAPACITY,
  HUB_TRADER_NATIVE_UI_RECORDS,
  equipmentSlotsForItem,
  hubEquipmentClickAction,
  hubPotionBeltShortcut,
  hubInteractionAtPoint,
  hubNpcHintAcknowledgementAction,
  hubInteractionWithinRange,
  hubMemorialEulogyIndex,
  hubPotionShortcut,
  hubTraderAtPoint,
  hubTraderWithinServiceRange,
  nearestHubInteraction,
  nearestHubTrader,
} from './hub-inventory-presentation.ts'

test('Painting eulogies follow the current shared memorial portrait id', () => {
  const initial = createHubMemorialState()
  assert.equal(hubMemorialEulogyIndex('painting-100', initial), 2)
  const first = archiveHubMemorialPortrait(initial, {
    capturedAtTick: 300,
    config: { discipline: 'arcane', displayName: 'Aurelia', element: 'ether' },
    equipment: { hat: null, robe: null, weapon: null },
    headingIndex: 12,
    playerId: 'player-a',
    portraitScale: 0.925,
    runId: 'run-a',
  }, 0)
  assert.equal(hubMemorialEulogyIndex('painting-100', first), 100)
  const second = archiveHubMemorialPortrait(first, {
    capturedAtTick: 600,
    config: { discipline: 'mind', displayName: 'Basil', element: 'water' },
    equipment: { hat: null, robe: null, weapon: null },
    headingIndex: 4,
    playerId: 'player-b',
    portraitScale: 0.9,
    runId: 'run-b',
  }, 1)
  assert.equal(hubMemorialEulogyIndex('painting-1', second), 101)
  assert.equal(hubMemorialEulogyIndex('memorator', second), null)
})

test('only native world actor wrappers acknowledge durable NPC hint rows', () => {
  const fresh = Array<boolean>(10).fill(true)
  assert.deepEqual(hubNpcHintAcknowledgementAction('annalist', fresh), {
    interactionId: 'annalist',
    type: 'acknowledge-npc-hint',
  })
  assert.deepEqual(hubNpcHintAcknowledgementAction('fomentius', fresh), {
    interactionId: 'fomentius',
    type: 'acknowledge-npc-hint',
  })
  assert.deepEqual(hubNpcHintAcknowledgementAction('luthacus', fresh), {
    interactionId: 'luthacus',
    type: 'acknowledge-npc-hint',
  })
  assert.equal(hubNpcHintAcknowledgementAction('hagatha', fresh), null)
  assert.equal(hubNpcHintAcknowledgementAction('painting-0', fresh), null)
  assert.equal(hubNpcHintAcknowledgementAction('annalist', Array(10).fill(false)), null)
})

test('HUD potion shortcuts total the addressed kind and consume the first owned stack', () => {
  const backpack = [
    { id: 8, kind: 'health-potion', quantity: 2 },
    { id: 9, kind: 'mana-potion', quantity: 4 },
    { id: 10, kind: 'health-potion', quantity: 3 },
  ] as const
  assert.deepEqual(hubPotionShortcut(backpack, 'health-potion'), { count: 5, itemId: 8 })
  assert.deepEqual(hubPotionShortcut(backpack, 'mana-potion'), { count: 4, itemId: 9 })
  assert.deepEqual(hubPotionShortcut([], 'health-potion'), { count: 0, itemId: null })
  assert.deepEqual(hubPotionBeltShortcut(backpack, 3), { count: 5, itemId: 8 })
  assert.deepEqual(hubPotionBeltShortcut(backpack, 4), { count: 4, itemId: 9 })
  assert.equal(hubPotionBeltShortcut(backpack, 2), null)
})

test('HUD potion shortcuts include recursively owned sack stacks in depth-first order', () => {
  const backpack = [{
    id: 20,
    kind: 'sack',
    quantity: 1,
    contents: [{
      id: 21,
      kind: 'health-potion',
      quantity: 2,
    }, {
      id: 22,
      kind: 'sack',
      quantity: 1,
      contents: [{ id: 23, kind: 'health-potion', quantity: 3 }],
    }],
  }, {
    id: 24,
    kind: 'health-potion',
    quantity: 4,
  }] as const
  assert.deepEqual(hubPotionShortcut(backpack, 'health-potion'), { count: 9, itemId: 21 })
})

test('merchant dialogue exposes only the four reachable retail service commands', () => {
  assert.deepEqual(
    Object.values(HUB_TRADER_DIALOGUES).map(({ actionLabel }) => actionLabel),
    ['Buy Charms and Curses', 'Buy', 'Examine Items', 'Dowse'],
  )
  assert.equal(JSON.stringify(HUB_TRADER_DIALOGUES).includes('Outfit me Randomly'), false)
  assert.equal(HUB_TRADER_DIALOGUES.hagatha.intro[0], 'All right then wizard, what do you want?')
  assert.equal(HUB_TRADER_DIALOGUES.fomentius.intro[0], 'Hello Hello!')
  assert.equal(HUB_TRADER_DIALOGUES.fomentius.intro[1], 'Can I interest you in a high quality and *very legal* herbal potion? Brewed with all the best natural magicks, minimal chance of causing intestinal combustion!')
  assert.equal(HUB_TRADER_DIALOGUES.hagatha.priceLabel, 'Charm Prices?')
  assert.equal(HUB_TRADER_DIALOGUES.shlorio.priceLabel, 'Dowsing Prices?')
  assert.equal(HUB_TRADER_DIALOGUES.shlorio.name, 'Shlorio')
  assert.match(HUB_TRADER_DIALOGUES.luthacus.intro[0], /Official Unreal Crime Scene Investigator/)
  assert.match(HUB_TRADER_DIALOGUES.luthacus.intro[2], /By order of the Archchancellor, o'course\./)
  assert.match(HUB_TRADER_DIALOGUES.shlorio.priceExplanation[2], /vapor burns/)
})

test('merchant proximity uses the exact native radius formula and room ownership', () => {
  assert.equal(hubTraderWithinServiceRange('hagatha', 'courtyard', { x: 1340, y: 280 }), true)
  assert.equal(hubTraderWithinServiceRange('hagatha', 'library', { x: 1340, y: 280 }), false)
  assert.equal(hubTraderWithinServiceRange('hagatha', 'courtyard', {
    x: 1340 + Math.sqrt(5 * 15 * 15 + 1500),
    y: 280,
  }), true)
  assert.equal(hubTraderWithinServiceRange('hagatha', 'courtyard', { x: 1392, y: 280 }), false)
  assert.equal(nearestHubTrader('library', { x: 900, y: 642.5 }), 'shlorio')
  assert.equal(hubTraderAtPoint('courtyard', { x: 1355, y: 280 }), 'hagatha')
  assert.equal(hubTraderAtPoint('courtyard', { x: 1355.01, y: 280 }), null)
  assert.equal(hubTraderAtPoint('library', { x: 900, y: 642.5 }), 'shlorio')
  assert.equal(hubTraderAtPoint('courtyard', { x: 900, y: 642.5 }), null)
})

test('the contextual interaction census covers every rendered named NPC and Mortuary portrait', () => {
  assert.deepEqual(HUB_INTERACTION_IDS, [
    'hagatha', 'fomentius', 'annalist', 'luthacus', 'skorcha', 'teacher',
    'memorator',
    'painting-0', 'painting-1', 'painting-100', 'painting-3', 'painting-4',
    'painting-5', 'painting-6', 'painting-7', 'painting-8', 'painting-9',
    'librarian', 'shlorio', 'arch-chancellor',
  ])
  assert.equal(nearestHubInteraction('courtyard', { x: 895.5, y: 455.5 }), 'annalist')
  assert.equal(nearestHubInteraction('courtyard', { x: 576.5, y: 710.5 }), 'teacher')
  for (const skorchaPosition of [
    { x: 1437.5, y: 732.5 },
    { x: 1637, y: 403.5 },
    { x: 669, y: 705.5 },
  ]) {
    assert.equal(nearestHubInteraction('courtyard', skorchaPosition), null)
    assert.equal(nearestHubInteraction(
      'courtyard',
      skorchaPosition,
      { skorchaPosition },
    ), 'skorcha')
    assert.equal(hubInteractionAtPoint(
      'courtyard',
      skorchaPosition,
      { skorchaPosition },
    ), 'skorcha')
    assert.equal(hubInteractionWithinRange(
      'skorcha',
      'courtyard',
      skorchaPosition,
    ), false)
  }
  assert.equal(nearestHubInteraction('mortuary', { x: 628, y: 770 }), 'memorator')
  assert.equal(nearestHubInteraction('mortuary', { x: 673, y: 683 }), 'painting-100')
  assert.equal(nearestHubInteraction('library', { x: 512, y: 595 }), 'librarian')
  assert.equal(nearestHubInteraction('office', { x: 514, y: 467 }), 'arch-chancellor')
  assert.equal(nearestHubInteraction('storeroom', { x: 538, y: 324 }), null)
  assert.equal(hubInteractionAtPoint('mortuary', { x: 688, y: 683 }), 'painting-100')
  const paintingRange = Math.sqrt(5 * 40 * 40 + 1500)
  assert.equal(hubInteractionWithinRange('painting-100', 'mortuary', {
    x: 673 + paintingRange - 1e-9,
    y: 683,
  }), true)
  assert.equal(hubInteractionWithinRange('painting-100', 'mortuary', {
    x: 673 + paintingRange + 1e-9,
    y: 683,
  }), false)
  assert.equal(hubInteractionWithinRange('painting-100', 'library', { x: 673, y: 683 }), false)
})

test('the Hub shortcut rail uses all five native records and routes the fifth member to Shlorio', () => {
  assert.deepEqual(HUB_HUD_SHORTCUTS, [
    { interaction: 'annalist', levelPickerRecord: 0, mode: 'dialogue', name: 'Provokatus' },
    { interaction: 'hagatha', levelPickerRecord: 6, mode: 'service', name: 'Hagatha' },
    { interaction: 'luthacus', levelPickerRecord: 4, mode: 'service', name: 'Luthacus' },
    { interaction: 'fomentius', levelPickerRecord: 5, mode: 'service', name: 'Fomentius' },
    { interaction: 'shlorio', levelPickerRecord: 2, mode: 'service', name: 'Shlorio' },
  ])
  assert.equal(HUB_INTERACTION_DIALOGUES.annalist.name, 'Provokatus')
  assert.equal(HUB_INTERACTION_DIALOGUES.teacher.name, 'Professor Machinimbus')
  assert.equal(HUB_INTERACTION_DIALOGUES['painting-100'].intro.length, 0)
  assert.equal(HUB_INTERACTION_DIALOGUES.shlorio.service, 'shlorio')
})

test('native shop membership retains padded grids and exports every atlas row', () => {
  assert.deepEqual(HUB_TRADER_GRID_CAPACITY, { fomentius: 28, shlorio: 9 })
  assert.deepEqual(HUB_TRADER_NATIVE_UI_RECORDS, {
    Inventory: 84,
    Skills: 166,
    UI: 113,
  })
})

test('all seven equipment sinks are reachable and the third ring remains gated', () => {
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'hat' }, false), ['hat'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'robe' }, false), ['robe'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'amulet' }, false), ['amulet'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'wand' }, false), ['weapon'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'staff' }, false), ['weapon'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'ring' }, false), ['ring-0', 'ring-1'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'ring' }, true), ['ring-0', 'ring-1', 'ring-2'])
})

test('explicit click-to-slot admission emits only compatible authoritative equip actions', () => {
  const ring = { equipmentType: 'ring', id: 41 } as const
  const robe = { equipmentType: 'robe', id: 42 } as const
  const potion = { equipmentType: null, id: 43 } as const

  assert.deepEqual(hubEquipmentClickAction(ring, 'ring-0', false), {
    itemId: 41,
    slot: 'ring-0',
    type: 'equip',
  })
  assert.equal(hubEquipmentClickAction(ring, 'ring-2', false), null)
  assert.deepEqual(hubEquipmentClickAction(ring, 'ring-2', true), {
    itemId: 41,
    slot: 'ring-2',
    type: 'equip',
  })
  assert.deepEqual(hubEquipmentClickAction(robe, 'robe', false), {
    itemId: 42,
    slot: 'robe',
    type: 'equip',
  })
  assert.equal(hubEquipmentClickAction(robe, 'hat', false), null)
  assert.equal(hubEquipmentClickAction(potion, 'weapon', false), null)
})
