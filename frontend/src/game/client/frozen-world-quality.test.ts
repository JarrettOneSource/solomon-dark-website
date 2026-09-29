import assert from 'node:assert/strict'
import test from 'node:test'
import { frozenWorldQuality } from './frozen-world-quality.ts'

test('authoritative frozen quality changes preserve all native birth state and clocks', () => {
  const frame = Object.freeze({ enhancedEffects: true, tick: 177.5,
    primarySpells: Object.freeze({ transients: [Object.freeze({ id: 7, ageTicks: 1.5, enhancedEffects: true })] }),
    secondaryAbilities: Object.freeze({ stoneskinWarp: Object.freeze([1, 2]), actors: Object.freeze([]) }),
    world: Object.freeze({ runId: 'owned-run' }) })
  const off = frozenWorldQuality(frame, false)
  assert.equal(off.enhancedEffects, false)
  assert.equal(off.tick, frame.tick)
  assert.strictEqual(off.primarySpells, frame.primarySpells)
  assert.strictEqual(off.secondaryAbilities, frame.secondaryAbilities)
  assert.strictEqual(off.world, frame.world)
  assert.strictEqual(frozenWorldQuality(off, false), off)
  const restored = frozenWorldQuality(off, true)
  assert.deepEqual(restored, frame)
  assert.strictEqual(restored.primarySpells.transients[0], frame.primarySpells.transients[0])
  assert.equal(frame.enhancedEffects, true)
})
