import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BONEYARD_GATE_BOUNDARY_DAMPING,
  BONEYARD_GATE_CONTACT_DAMPING,
  BONEYARD_GATE_IDLE_DAMPING,
  applyBoneyardGateContact,
  createBoneyardGateLeaves,
  nativeClosedGateRoots,
  stepBoneyardGateLeaf,
  type BoneyardGateLeafState,
} from './boneyard-gate.ts'

test('materializes native side order, endpoint trim, and one-unit center gap', () => {
  assert.deepEqual(nativeClosedGateRoots([
    { x: 0, y: 40 },
    { x: 100, y: 40 },
  ]), [
    { hinge: { x: 86.5, y: 40 }, side: 0, tip: { x: 51, y: 40 } },
    { hinge: { x: 13.5, y: 40 }, side: 1, tip: { x: 49, y: 40 } },
  ])
})

test('run seed deterministically owns the native signed-Y starting sway', () => {
  const fences = [{
    eid: 'gate',
    points: [{ x: 0, y: 40 }, { x: 100, y: 40 }],
    segmentCode: 2,
    typeId: 3005,
  }]
  const first = createBoneyardGateLeaves(fences, 'same-run-seed')
  const second = createBoneyardGateLeaves(fences, 'same-run-seed')
  assert.deepEqual(first, second)
  assert.equal(first.length, 2)
  for (const leaf of first) {
    assert.ok(Math.abs(Math.hypot(
      leaf.tip.x - leaf.hinge.x,
      leaf.tip.y - leaf.hinge.y,
    ) - 35.5) < 0.000001)
    assert.equal(leaf.damping, BONEYARD_GATE_IDLE_DAMPING)
  }
})

test('contact installs native magnitude-two velocity and 0.96 damping', () => {
  const leaf = gateLeaf()
  const contacted = applyBoneyardGateContact(leaf, { x: 3, y: 4 })
  assert.deepEqual(contacted.velocity, { x: 1.2, y: 1.6 })
  assert.equal(contacted.damping, BONEYARD_GATE_CONTACT_DAMPING)
  const stepped = stepBoneyardGateLeaf(contacted)
  assert.ok(Math.abs(Math.hypot(
    stepped.tip.x - stepped.hinge.x,
    stepped.tip.y - stepped.hinge.y,
  ) - leaf.length) < 0.000001)
  assert.deepEqual(stepped.velocity, { x: 1.152, y: 1.536 })
})

test('travel beyond sixty degrees restores the tip and applies native bounce', () => {
  const angle = 59.9 * Math.PI / 180
  const leaf = {
    ...gateLeaf(),
    tip: { x: Math.cos(angle) * 40, y: Math.sin(angle) * 40 },
    velocity: { x: 0, y: 2 },
  }
  const stepped = stepBoneyardGateLeaf(leaf)
  assert.deepEqual(stepped.tip, leaf.tip)
  assert.equal(stepped.damping, BONEYARD_GATE_BOUNDARY_DAMPING)
  assert.equal(Math.abs(stepped.velocity.x), 0)
  assert.equal(stepped.velocity.y, -0.98)
})

function gateLeaf(): BoneyardGateLeafState {
  return {
    damping: BONEYARD_GATE_CONTACT_DAMPING,
    fenceEid: 'gate',
    hinge: { x: 0, y: 0 },
    id: 'gate:gate:0',
    length: 40,
    restAngleDegrees: 0,
    side: 0,
    tip: { x: 40, y: 0 },
    velocity: { x: 0, y: 0 },
  }
}
