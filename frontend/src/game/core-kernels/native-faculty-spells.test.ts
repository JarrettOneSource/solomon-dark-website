import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createNativeDarkFireballs,createNativeRainOfBones,nativeBlightningContains,
  nativeTragicCircleContains,stepNativeDarkFireball,stepNativeRainOfBones,
} from './native-faculty-spells.ts'
import { createNativeRng } from './native-rng.ts'

test('Blightning retains its native tapered polygon in all directions', () => {
  for (const heading of [0, 90, 180, 270]) {
    const angle = heading * Math.PI / 180
    const point = (forward: number, across: number) => ({
      x: Math.sin(angle) * forward + Math.cos(angle) * across,
      y: -Math.cos(angle) * forward + Math.sin(angle) * across,
    })
    assert.equal(nativeBlightningContains({ x: 0, y: 0 }, heading, point(500, 24)), true)
    assert.equal(nativeBlightningContains({ x: 0, y: 0 }, heading, point(500, 26)), false)
    assert.equal(nativeBlightningContains({ x: 0, y: 0 }, heading, point(-1, 0)), false)
    assert.equal(nativeBlightningContains({ x: 0, y: 0 }, heading, point(1001, 0)), false)
  }
})

test('Tragic Circle applies the final ellipse after its broad-phase rectangle', () => {
  const center = { x: 50, y: 60 }
  assert.equal(nativeTragicCircleContains(center, { x: 261.9, y: 60 }), true)
  assert.equal(nativeTragicCircleContains(center, { x: 262, y: 60 }), false)
  assert.equal(nativeTragicCircleContains(center, { x: 200, y: 200 }), false)
  assert.equal(nativeTragicCircleContains(center, { x: 50, y: 229 }), true)
})

test('Direball and Ring of Dire keep distinct birth velocities and the fourteen-shot native ring', () => {
  const source = { x: 10, y: 20 }
  const direct = createNativeDarkFireballs(source, 90, false, 300, createNativeRng(4))
  assert.equal(direct.spells.length, 1)
  assert.ok(Math.abs(direct.spells[0]!.position.x - 65) < .001)
  assert.ok(Math.abs(direct.spells[0]!.position.y + 10) < .001)
  assert.equal(Math.hypot(direct.spells[0]!.velocity.x, direct.spells[0]!.velocity.y), 5)
  assert.equal(direct.spells[0]!.arcPhaseStep, 0)
  const ring = createNativeDarkFireballs(source, 90, true, 300, createNativeRng(4))
  assert.equal(ring.spells.length, 14)
  for (const spell of ring.spells) {
    assert.ok(Math.abs(Math.hypot(spell.velocity.x, spell.velocity.y) - 3) < 1e-6)
    assert.ok(spell.arcPhaseStep > 0)
    let next = { spell, impact: false }
    for (let tick = 1; tick < 200 && !next.impact; tick += 1) next = stepNativeDarkFireball(next.spell, 1)
    assert.equal(next.impact, true)
    assert.ok(next.spell.arcPhase >= 180)
  }
})

test('Acid Pain owns its twelve-second rain clock and emits individual falling bones before fading', () => {
  const initial = createNativeRainOfBones({ x: 0, y: 0 }, createNativeRng(32))
  let state = initial.state
  let rng = initial.rng
  let drops = 0
  for (let tick = 1; tick <= 1301; tick += 1) {
    const step = stepNativeRainOfBones(state, rng)
    state = step.state
    rng = step.rng
    if (step.bone !== null) {
      assert.ok(tick < 1200)
      assert.ok(Math.abs(step.bone.position.x) <= 200 && Math.abs(step.bone.position.y) <= 161)
      assert.ok((step.bone.entry >= 113 && step.bone.entry <= 121)
        || (step.bone.entry >= 1819 && step.bone.entry <= 1822))
      drops += 1
    }
  }
  assert.ok(drops > 100)
  assert.ok(state.alpha <= 0)
  assert.equal(state.remainingTicks, -101)
})
