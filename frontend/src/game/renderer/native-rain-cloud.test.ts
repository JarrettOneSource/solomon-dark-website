import assert from 'node:assert/strict'
import test from 'node:test'
import type { NativeBossSpell } from '../core-kernels/native-boss-spell.ts'
import { createNativeRainOfBones } from '../core-kernels/native-faculty-spells.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { NativeRainCloud } from './native-rain-cloud.ts'

const rain: Extract<NativeBossSpell, { kind: 'rain-of-bones' }> = {
  ...createNativeRainOfBones({ x: 100, y: 200 }, createNativeRng(1)).state,
  ageTicks: 19, alpha: 1, damage: 1, id: 1, kind: 'rain-of-bones',
  painterRegistration: { managerLane: 'actor', registrationOrdinal: 1 }, ownerActorId: 1, spawnTick: 0,
}

test('Rain billows advance their sine on each paint, stay in place overhead, and reconstruct births between frames', () => {
  const cloud = new NativeRainCloud(rain, 19)
  const first = cloud.update(rain, 20)
  assert.equal(first.length, 2)
  assert.ok(first.every(layer => layer.alpha > 0 && layer.alpha < .1))
  assert.ok(first.every(layer => layer.offset.y >= -335 && layer.offset.y <= -15))
  const second = cloud.update(rain, 20)
  assert.equal(second.length, 2)
  assert.deepEqual(second.map(({ offset }) => offset), first.map(({ offset }) => offset))
  assert.ok(second.every((layer, index) => layer.alpha > first[index]!.alpha))
  assert.equal(cloud.update(rain, 25).length, 12)
  for (let frame = 0; frame < 100; frame += 1) cloud.update(rain, 25)
  assert.deepEqual(cloud.update(rain, 25), [], 'paint-only updates drain the manager while simulation is paused')
})

test('Rain emits through tick 1199 and its fading cloud creates no new billows', () => {
  const cloud = new NativeRainCloud({ ...rain, ageTicks: 1198 }, 1198)
  assert.equal(cloud.update(rain, 1200).length, 2)
  assert.equal(cloud.update({ ...rain, alpha: .5 }, 1220).length, 2)
  assert.deepEqual(cloud.update({ ...rain, alpha: 0 }, 1300), [])
})
