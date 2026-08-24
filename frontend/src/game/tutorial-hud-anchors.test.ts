import assert from 'node:assert/strict'
import test from 'node:test'

import {
  nativeTutorialHudAnchorAttributes,
  nativeTutorialHudPointerPlans,
  tutorialClientRectAnchor,
  type TutorialHudAnchors,
} from './tutorial-hud-anchors.ts'

const ANCHORS: TutorialHudAnchors = {
  healthMeter: { x: 695, y: 24.5 },
  healthPotion: { x: 677.5, y: 858 },
  inventory: { x: 763, y: 855 },
  secondarySlot: { x: 494.5, y: 859 },
  skills: { x: 843, y: 855 },
}

test('maps transformed browser rectangles back into Tutorial logical coordinates', () => {
  const mapped = tutorialClientRectAnchor(
    { height: 720, left: 100, top: 50, width: 1_280 },
    { height: 42.4, left: 474.4, top: 695.6, width: 42.4 },
    { height: 900, width: 1_600 },
  )
  assert.ok(mapped)
  assert.ok(Math.abs(mapped.x - 494.5) < 0.000_001)
  assert.ok(Math.abs(mapped.y - 833.5) < 0.000_001)
  assert.equal(tutorialClientRectAnchor(
    { height: 0, left: 0, top: 0, width: 0 },
    { height: 53, left: 468, top: 832.5, width: 53 },
    { height: 900, width: 1_600 },
  ), null)
})

test('builds every movable in-world Tutorial pointer from its live semantic anchor', () => {
  assert.deepEqual(nativeTutorialHudAnchorAttributes(5), ['secondary-slot'])
  assert.deepEqual(nativeTutorialHudAnchorAttributes(14), [])
  assert.deepEqual(nativeTutorialHudAnchorAttributes(18), ['health-potion', 'health-meter'])
  assert.deepEqual(nativeTutorialHudAnchorAttributes(3), [])
  assert.deepEqual(nativeTutorialHudPointerPlans(5, ANCHORS), [{
    anchor: 'secondary-slot',
    target: ANCHORS.secondarySlot,
    x: 424.5,
    y: 809,
  }])
  assert.deepEqual(nativeTutorialHudPointerPlans(9, ANCHORS), [{
    anchor: 'inventory',
    target: ANCHORS.inventory,
    x: 723,
    y: 815,
  }])
  assert.deepEqual(nativeTutorialHudPointerPlans(12, ANCHORS), [{
    anchor: 'skills',
    target: ANCHORS.skills,
    x: 883,
    y: 815,
  }])
  assert.deepEqual(nativeTutorialHudPointerPlans(18, ANCHORS), [
    {
      anchor: 'health-potion',
      target: ANCHORS.healthPotion,
      x: 627.5,
      y: 828,
    },
    {
      anchor: 'health-meter',
      target: ANCHORS.healthMeter,
      x: 595,
      y: 94.5,
    },
  ])
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
    target: ANCHORS.healthMeter,
    x: 595,
    y: 94.5,
  }])
})
