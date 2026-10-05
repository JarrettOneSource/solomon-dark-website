import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativePlayerRescueProtection, stepNativePlayerRescueProtection } from '../../core-kernels/native-player-rescue.ts'
import { createNativeRng } from '../../core-kernels/native-rng.ts'
import { createNativeWorldManagerOrder } from '../../core-kernels/native-world-manager-order.ts'
import { nativePlayerRescueProtection } from './native-state.ts'

test('the rescue wire boundary retains zero alpha and validates particle identity and ownership', () => {
  const order = createNativeWorldManagerOrder()
  const state = stepNativePlayerRescueProtection({ ...createNativePlayerRescueProtection(), fraction: Math.fround(.001) },
    { position: { x: 4, y: 5 }, register: order.register, worldKey: 'boneyard:wire' }, createNativeRng(31)).protection
  assert.equal(state.fraction, 0)
  assert.equal(state.particles[0]!.alpha, 0)
  assert.deepEqual(nativePlayerRescueProtection(JSON.parse(JSON.stringify(state)), 'rescue'), state)
  const badIdentity = { ...state, particles: [state.particles[0]!, state.particles[0]!] }
  assert.throws(() => nativePlayerRescueProtection(badIdentity, 'rescue'), /invalid native Sparkle state/)
  const badLane = { ...state, particles: [{ ...state.particles[0]!,
    painterRegistration: { managerLane: 'actor', registrationOrdinal: 0 } }] }
  assert.throws(() => nativePlayerRescueProtection(badLane, 'rescue'), /managerLane must be transient/)
  assert.throws(() => nativePlayerRescueProtection({ ...state, fraction: .1 }, 'rescue'), /native float/)
  assert.throws(() => nativePlayerRescueProtection({ ...state, borrowedSkillId: 45 }, 'rescue'), /not allowed/)
})
