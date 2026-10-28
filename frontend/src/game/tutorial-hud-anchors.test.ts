import assert from 'node:assert/strict'
import test from 'node:test'

import {
  nativeTutorialHudAnchorAttributes,
  nativeTutorialHudPointerPlans,
  tutorialHudInstructionBaselines,
  tutorialClientRectAnchor,
  type TutorialHudAnchors,
} from './tutorial-hud-anchors.ts'

const ANCHORS: TutorialHudAnchors = {
  concentrationA: { scale: 1, x: 820, y: 25.5 },
  healthMeter: { scale: 1, x: 695, y: 24.5 },
  healthPotion: { scale: 1, x: 677.5, y: 858 },
  inventory: { scale: 1, x: 763, y: 855 },
  primarySkill: { scale: 1, x: 780, y: 25.5 },
  secondarySlot: { scale: 1, x: 494.5, y: 859 },
  skills: { scale: 1, x: 843, y: 855 },
}

test('maps transformed browser rectangles back into Tutorial logical coordinates', () => {
  const mapped = tutorialClientRectAnchor(
    { height: 720, left: 100, top: 50, width: 1_280 },
    { height: 42.4, left: 474.4, top: 695.6, width: 42.4 },
    { height: 900, width: 1_600 },
    53,
  )
  assert.ok(mapped)
  assert.ok(Math.abs(mapped.x - 494.5) < 0.000_001)
  assert.ok(Math.abs(mapped.y - 833.5) < 0.000_001)
  assert.ok(Math.abs(mapped.scale - 1) < 0.000_001)
  const mobile = tutorialClientRectAnchor(
    { height: 414, left: 0, top: 0, width: 896 },
    { height: 57.04, left: 391.92, top: 355.58, width: 53.36 },
    { height: 900, width: 896 / 0.46 },
    62,
  )
  assert.ok(mobile)
  assert.ok(Math.abs(mobile.scale - 2) < 0.000_001)
  assert.ok(Math.abs(mobile.x - 910) < 0.000_001)
  assert.ok(Math.abs(mobile.y - 835) < 0.000_001)
  assert.equal(tutorialClientRectAnchor(
    { height: 0, left: 0, top: 0, width: 0 },
    { height: 53, left: 468, top: 832.5, width: 53 },
    { height: 900, width: 1_600 },
    53,
  ), null)
})

test('builds every movable in-world Tutorial pointer from its live semantic anchor', () => {
  assert.deepEqual(nativeTutorialHudAnchorAttributes(5), ['secondary-slot'])
  assert.deepEqual(nativeTutorialHudAnchorAttributes(14), ['primary-skill', 'concentration-a'])
  assert.deepEqual(nativeTutorialHudAnchorAttributes(18), ['health-potion', 'health-meter'])
  assert.deepEqual(nativeTutorialHudAnchorAttributes(3), [])
  assert.deepEqual(nativeTutorialHudPointerPlans(5, ANCHORS), [{
    anchor: 'secondary-slot',
    blink: true,
    scale: 1,
    target: ANCHORS.secondarySlot,
    x: 424.5,
    y: 809,
  }])
  assert.deepEqual(nativeTutorialHudPointerPlans(9, ANCHORS), [{
    anchor: 'inventory',
    blink: true,
    scale: 1,
    target: ANCHORS.inventory,
    x: 723,
    y: 815,
  }])
  assert.deepEqual(nativeTutorialHudPointerPlans(12, ANCHORS), [{
    anchor: 'skills',
    blink: true,
    scale: 1,
    target: ANCHORS.skills,
    x: 883,
    y: 815,
  }])
  assert.deepEqual(nativeTutorialHudPointerPlans(18, ANCHORS), [
    {
      anchor: 'health-potion',
      blink: true,
      scale: 1,
      target: ANCHORS.healthPotion,
      x: 627.5,
      y: 828,
    },
    {
      anchor: 'health-meter',
      blink: true,
      scale: 1,
      target: ANCHORS.healthMeter,
      x: 595,
      y: 94.5,
    },
  ])
})

test('scales the complete pointer composition with responsive HUD targets', () => {
  const scaled: TutorialHudAnchors = {
    ...ANCHORS,
    inventory: { scale: 2, x: 910, y: 835 },
    secondarySlot: { scale: 1.5, x: 320, y: 700 },
  }
  assert.deepEqual(nativeTutorialHudPointerPlans(9, scaled), [{
    anchor: 'inventory',
    blink: true,
    scale: 2,
    target: scaled.inventory,
    x: 830,
    y: 755,
  }])
  assert.deepEqual(nativeTutorialHudPointerPlans(5, scaled), [{
    anchor: 'secondary-slot',
    blink: true,
    scale: 1.5,
    target: scaled.secondarySlot,
    x: 215,
    y: 625,
  }])
})

test('keeps Inventory and Skills copy clear of their scaled centred pointers', () => {
  const native = { heading: 730, subheading: 760 }
  assert.deepEqual(tutorialHudInstructionBaselines(9, native, ANCHORS), native)
  const scaled: TutorialHudAnchors = {
    ...ANCHORS,
    inventory: { scale: 2, x: 910, y: 835 },
    skills: { scale: 2, x: 1_070, y: 835 },
  }
  assert.deepEqual(tutorialHudInstructionBaselines(9, native, scaled), {
    heading: 615,
    subheading: 645,
  })
  assert.deepEqual(tutorialHudInstructionBaselines(12, native, scaled), {
    heading: 615,
    subheading: 645,
  })
  assert.deepEqual(tutorialHudInstructionBaselines(5, native, scaled), native)
})

test('omits only the pointer whose live owner is absent', () => {
  assert.deepEqual(nativeTutorialHudPointerPlans(5, {
    ...ANCHORS,
    secondarySlot: null,
  }), [])
  assert.deepEqual(nativeTutorialHudPointerPlans(18, {
    ...ANCHORS,
    healthPotion: null,
  }), [{
    anchor: 'health-meter',
    blink: true,
    scale: 1,
    target: ANCHORS.healthMeter,
    x: 595,
    y: 94.5,
  }])
})
