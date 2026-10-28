import assert from 'node:assert/strict'
import test from 'node:test'
import { nativeEtherDrainContact } from './native-ether-drain.ts'

test('field pressure retains the native stored square root and reciprocal on diagonal paths', () => {
  // Instruction-backed binary32 oracle, not a captured retail input trace.
  for (const [y, expectedX] of [[9, .060718342661857605], [10, .054705966264009476], [11, .049771491438150406]]) {
    const contact = nativeEtherDrainContact({ alpha: .5, damage: 5, id: 1, ownerId: 'caster', position: { x: 0, y: 0 } }, {
      activationDelayTicks: 0, forceFactor: 1, nativeFlags: 2, position: { x: -1, y: -y },
      ref: { kind: 'enemy', id: 1, registrationOrdinal: 0 },
    })
    assert.equal(contact?.delta.x, expectedX)
  }
})
