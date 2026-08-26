import assert from 'node:assert/strict'
import test from 'node:test'

import type { HubInventoryItem } from './core-kernels/hub-economy.ts'
import { nativeTutorialAmuletItem } from './core-kernels/native-tutorial.ts'
import { createGameSimulation } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import { measureNativeUiText } from './native-ui/native-ui-text.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import {
  hubInventoryEquipmentSlotRects,
  hubInventorySlotPosition,
} from './renderer/hub-inventory-render-contract.ts'
import { nativeSkillBookPagePlacements, nativeSkillBookPages } from './skill-book-model.ts'
import {
  TUTORIAL_CALLOUT_LINE_PITCH,
  TUTORIAL_MODAL_TEXT,
  tutorialCalloutGeometry,
  tutorialModalTeachingPlans,
  tutorialPointerVisible,
  type TutorialModalCalloutPlan,
  type TutorialModalPointerPlan,
  type TutorialModalTeachingPlan,
} from './tutorial-modal-callouts.ts'

const baseline: ProtocolPlayerProgression = createGameSnapshot(createGameSimulation(), null)
  .players['local-player']!.progression

const potion: HubInventoryItem = {
  equipmentType: null,
  iconRecords: [46],
  id: 1,
  kind: 'health-potion',
  name: 'Health Potion',
  nativeSubtype: 0,
  nativeTypeId: 7001,
  quantity: 1,
  rarity: null,
  recipeIndex: null,
}

const manaPotion: HubInventoryItem = {
  ...potion,
  iconRecords: [47],
  id: 2,
  kind: 'mana-potion',
  name: 'Mana Potion',
  nativeSubtype: 1,
}

const amulet: HubInventoryItem = { ...nativeTutorialAmuletItem(), id: 3 }

const threePages: ProtocolPlayerProgression = {
  ...baseline,
  learnedSkillOrder: [...baseline.learnedSkillOrder, 16],
  learnedSkills: [...baseline.learnedSkills, [16, 1, 1]],
}

function plans(
  stage: number,
  overrides: Partial<Parameters<typeof tutorialModalTeachingPlans>[0]> = {},
): readonly TutorialModalTeachingPlan[] {
  return tutorialModalTeachingPlans({
    backpack: [potion, manaPotion, amulet],
    modalProgress: 1,
    progression: baseline,
    resumeBindingLabel: 'I',
    stage,
    ...overrides,
  })
}

function callout(plan: TutorialModalTeachingPlan | undefined): TutorialModalCalloutPlan {
  assert.ok(plan && plan.kind === 'callout', `expected a callout plan, got ${JSON.stringify(plan)}`)
  return plan
}

function pointer(plan: TutorialModalTeachingPlan | undefined): TutorialModalPointerPlan {
  assert.ok(plan && plan.kind === 'pointer', `expected a pointer plan, got ${JSON.stringify(plan)}`)
  return plan
}

const order = (list: readonly TutorialModalTeachingPlan[]) => list.map((plan) => `${plan.kind}:${plan.id}`)
const center = (plan: TutorialModalCalloutPlan) => [plan.geometry.centerX, plan.geometry.centerY]
const arrow = (plan: TutorialModalPointerPlan) => [plan.x, plan.y, plan.toX, plan.toY]

test('frames callout text exactly like Tutorial::Render 0x005C9C70', () => {
  const text = TUTORIAL_MODAL_TEXT.quickUseItems
  const geometry = tutorialCalloutGeometry(text, 1104.5, 759.5)
  const widths = text.split('\n').map((line) => measureNativeUiText(line, 'menu'))
  const textWidth = Math.max(...widths)
  assert.equal(TUTORIAL_CALLOUT_LINE_PITCH, 25)
  assert.equal(geometry.textWidth, textWidth)
  assert.equal(geometry.textHeight, 24 + 25)
  assert.deepEqual(geometry.frame, {
    height: 69,
    width: textWidth + 28,
    x: 1104.5 - (textWidth + 28) / 2,
    y: 729,
  })
  assert.deepEqual(geometry.lines, [
    { text: 'Put items here', width: widths[0]!, x: Math.trunc(1104.5 - widths[0]! / 2), y: 759 },
    { text: 'for quick use', width: widths[1]!, x: Math.trunc(1104.5 - widths[1]! / 2), y: 784 },
  ])

  const single = tutorialCalloutGeometry('Sirmin', 100, 50)
  assert.equal(single.textHeight, 24)
  assert.equal(single.frame.height, 44)
  assert.equal(single.frame.y, 50 + 4 - 22)
  assert.equal(single.lines.length, 1)

  // Stage 13 paints two independent two-line concentration callouts (0x005D1A4x / 0x005D1B0x).
  const pair = tutorialCalloutGeometry(TUTORIAL_MODAL_TEXT.concentration, 800, 400)
  assert.equal(pair.lines.length, 2)
  assert.equal(pair.textHeight, 24 + 25)
  const limit = tutorialCalloutGeometry(TUTORIAL_MODAL_TEXT.concentrationLimit, 800, 400)
  assert.equal(limit.lines.length, 2)
  assert.equal(limit.textHeight, 24 + 25)

  // The height rule is h = 24 + 25 * (lines - 1) for any line count.
  const triple = tutorialCalloutGeometry('one\ntwo\nthree', 800, 400)
  assert.equal(triple.lines.length, 3)
  assert.equal(triple.textHeight, 24 + 25 * 2)
  assert.equal(triple.frame.height, 24 + 25 * 2 + 20)
  assert.deepEqual(triple.lines.map((line) => line.y), [400, 425, 450])
})

test('paints the stage-10 inventory members in native draw order at the slid HUD controls', () => {
  const stage = plans(10)
  assert.deepEqual(order(stage), [
    'callout:resume',
    'pointer:resume',
    'callout:quick-use',
    'pointer:quick-use',
    'callout:equipment',
    'pointer:equipment',
    'callout:backpack',
    'pointer:backpack',
  ])
  const resume = callout(stage[0])
  assert.equal(resume.text, "Click here or press 'I'\nagain to resume playing")
  assert.deepEqual(center(resume), [709.5, 751])
  assert.deepEqual(arrow(pointer(stage[1])), [709.5, 821, 759.5, 871])
  assert.equal(pointer(stage[1]).blink, true)

  const quickUse = callout(stage[2])
  assert.equal(quickUse.text, 'Put items here\nfor quick use')
  assert.deepEqual(center(quickUse), [1104.5, 759.5])
  assert.deepEqual(arrow(pointer(stage[3])), [1084.5, 824.5, 1044.5, 874.5])
  assert.equal(pointer(stage[3]).blink, false)

  const amuletSlot = hubInventoryEquipmentSlotRects('amulet', false)[0]!
  assert.deepEqual(amuletSlot, [1300, 169, 46, 46])
  const equipment = callout(stage[4])
  assert.equal(equipment.text, 'Put equippable items\nhere to wear them.')
  assert.deepEqual(center(equipment), [1073, 242])
  assert.deepEqual(arrow(pointer(stage[5])), [1263, 232, 1323, 192])
  assert.equal(pointer(stage[5]).blink, false)

  assert.deepEqual(hubInventorySlotPosition(2), { x: 24, y: 646 })
  const backpack = callout(stage[6])
  assert.equal(
    backpack.text,
    'Found items go in your backpack.  Click and\ndrag to move items, double-click to use them.',
  )
  assert.deepEqual(center(backpack), [434, 639])
  assert.deepEqual(arrow(pointer(stage[7])), [84, 641, 24, 646])
  assert.equal(pointer(stage[7]).blink, false)
})

test('tracks the live 40-tick modal slide instead of jumping to the settled anchors', () => {
  const inventoryClosed = plans(10, { modalProgress: 0 })
  const inventoryHalf = plans(10, { modalProgress: 0.5 })
  assert.deepEqual(center(callout(inventoryClosed[0])), [709.5, 736])
  assert.deepEqual(arrow(pointer(inventoryClosed[1])), [709.5, 806, 759.5, 856])
  assert.deepEqual(center(callout(inventoryHalf[0])), [709.5, 743.5])
  assert.deepEqual(arrow(pointer(inventoryHalf[3])), [1084.5, 817, 1044.5, 867])
  assert.deepEqual(center(callout(inventoryClosed[4])), [1073, 242])
  assert.deepEqual(arrow(pointer(inventoryClosed[7])), [84, 641, 24, 646])

  const skillsClosed = plans(13, { modalProgress: 0 })
  const skillsHalf = plans(13, { modalProgress: 0.5 })
  assert.deepEqual(center(callout(skillsClosed[0])), [889.5, 746])
  assert.deepEqual(arrow(pointer(skillsClosed[1])), [879.5, 816, 839.5, 856])
  assert.deepEqual(center(callout(skillsHalf[2])), [554.5, 742])
  assert.deepEqual(arrow(pointer(skillsHalf[3])), [534.5, 817, 554.5, 867])
})

test('follows the exact authored amulet cell and drops only that backpack lesson when absent', () => {
  const empty = plans(10, { backpack: [] })
  assert.deepEqual(order(empty), [
    'callout:resume',
    'pointer:resume',
    'callout:quick-use',
    'pointer:quick-use',
    'callout:equipment',
    'pointer:equipment',
  ])
  assert.equal(order(plans(10, { backpack: [potion, manaPotion] })).length, 6)

  const fillers = Array.from({ length: 7 }, (_, index): HubInventoryItem => ({
    ...potion,
    id: 100 + index,
    name: `Filler ${index}`,
  }))
  const moved = plans(10, { backpack: [...fillers, { ...amulet, id: 200 }] })
  assert.deepEqual(hubInventorySlotPosition(7), { x: 99, y: 721 })
  assert.deepEqual(center(callout(moved[6])), [509, 714])
  assert.deepEqual(arrow(pointer(moved[7])), [159, 716, 99, 721])

  const sack: HubInventoryItem = {
    ...potion,
    contents: [{ ...amulet, id: 301 }],
    iconRecords: [70],
    id: 300,
    kind: 'sack',
    name: 'Sack',
    nativeSubtype: 0,
    nativeTypeId: 7008,
  }
  const nested = plans(10, { backpack: [sack] })
  assert.deepEqual(hubInventorySlotPosition(1), { x: 24, y: 571 })
  assert.deepEqual(arrow(pointer(nested[7])), [84, 566, 24, 571])
})

test('uses the resume binding label for the resume lesson', () => {
  const resume = callout(plans(10, { resumeBindingLabel: 'Tab' })[0])
  assert.equal(resume.text, "Click here or press 'Tab'\nagain to resume playing")
  assert.equal(TUTORIAL_MODAL_TEXT.resume('K'), "Click here or press 'K'\nagain to resume playing")
})

test('paints the stage-13 skill members from the native skill book page placements', () => {
  const pages = nativeSkillBookPages(baseline)
  const placements = nativeSkillBookPagePlacements(pages)
  assert.equal(placements.length, 2)
  const stage = plans(13, { resumeBindingLabel: 'K' })
  assert.deepEqual(order(stage), [
    'callout:resume',
    'pointer:resume',
    'callout:quick-use',
    'pointer:quick-use',
    'pointer:hover',
    'callout:hover',
  ])
  const resume = callout(stage[0])
  assert.equal(resume.text, "Click here or press 'K'\nagain to resume playing")
  assert.deepEqual(center(resume), [889.5, 761])
  assert.deepEqual(arrow(pointer(stage[1])), [879.5, 831, 839.5, 871])
  assert.equal(pointer(stage[1]).blink, true)

  const quickUse = callout(stage[2])
  assert.equal(quickUse.text, 'Drag skills here\nfor quick use')
  assert.deepEqual(center(quickUse), [554.5, 749.5])
  assert.deepEqual(arrow(pointer(stage[3])), [534.5, 824.5, 554.5, 874.5])
  assert.equal(pointer(stage[3]).blink, false)

  const first = placements[0]!
  const hoverTip = { x: first.x + 100, y: first.y + 70 }
  assert.deepEqual(arrow(pointer(stage[4])), [hoverTip.x - 100, hoverTip.y - 30, hoverTip.x, hoverTip.y])
  assert.equal(pointer(stage[4]).blink, false)
  const hover = callout(stage[5])
  assert.equal(hover.text, 'Hover your mouse over a\nskill icon for more information.')
  assert.deepEqual(center(hover), [hoverTip.x - 115, hoverTip.y - 30])
})

test('adds the concentration lesson only once a third skill page exists', () => {
  const placements = nativeSkillBookPagePlacements(nativeSkillBookPages(threePages))
  assert.equal(placements.length, 3)
  const stage = plans(13, { progression: threePages })
  assert.deepEqual(order(stage), [
    'callout:resume',
    'pointer:resume',
    'callout:quick-use',
    'pointer:quick-use',
    'pointer:concentration',
    'callout:concentration',
    'callout:concentration-limit',
    'pointer:hover',
    'callout:hover',
  ])
  const third = placements[2]!
  const tip = { x: third.x + 100, y: third.y + 80 }
  assert.deepEqual(arrow(pointer(stage[4])), [tip.x + 100, tip.y - 20, tip.x, tip.y])
  assert.equal(pointer(stage[4]).blink, false)
  const concentration = callout(stage[5])
  assert.equal(concentration.text, 'You are CONCENTRATING on\nyour new skill automatically')
  assert.deepEqual(center(concentration), [tip.x + 50, tip.y - 165])
  const limit = callout(stage[6])
  assert.equal(limit.text, 'This confers a bonus, but is\nlimited to one skill at a time.')
  assert.deepEqual(center(limit), [tip.x + 50, tip.y - 100])
  const first = placements[0]!
  assert.deepEqual(arrow(pointer(stage[7])), [first.x, first.y + 40, first.x + 100, first.y + 70])
})

test('drops the page-anchored lessons when the skill book has no pages', () => {
  const noPages: ProtocolPlayerProgression = { ...baseline, learnedSkillOrder: [], learnedSkills: [] }
  assert.equal(nativeSkillBookPages(noPages).length, 0)
  assert.deepEqual(order(plans(13, { progression: noPages })), [
    'callout:resume',
    'pointer:resume',
    'callout:quick-use',
    'pointer:quick-use',
  ])
})

test('paints nothing outside the two modal stages', () => {
  for (const stage of [0, 8, 9, 11, 12, 14, 17]) assert.deepEqual(plans(stage), [])
})

test('blinks a pointer with the native 50-tick duty cycle', () => {
  for (const ticks of [0, 19, 50, 69, 100]) assert.equal(tutorialPointerVisible(true, ticks), false)
  for (const ticks of [20, 49, 70, 99]) assert.equal(tutorialPointerVisible(true, ticks), true)
  for (const ticks of [0, 19, 20, 49]) assert.equal(tutorialPointerVisible(false, ticks), true)
})
