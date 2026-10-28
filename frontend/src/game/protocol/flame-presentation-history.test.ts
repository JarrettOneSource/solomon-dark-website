import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createFlamePresentationHistory,
  createFlamePresentationReplay,
  type FlamePresentationBirth,
} from './flame-presentation-history.ts'

function birth(id: number, tick: number, kind: 'ribbon' | 'fade' | 'path' = 'ribbon', end = tick + 1): FlamePresentationBirth<{ sample: number }> {
  return { id, birthTick: tick, endTickExclusive: end, ownerId: 'owner',
    worldKey: 'boneyard:run', kind, recipe: { sample: id * .25 } }
}

test('five-tick snapshots retain a Flame birth absent from both endpoint live states', () => {
  const host = createFlamePresentationHistory<{ sample: number }>({ worldKey: 'boneyard:run', tick: 0, maximumBirths: 32 })
  const peer = createFlamePresentationReplay<{ sample: number }>()
  peer.accept(host.frame(null, 0))
  for (let tick = 1; tick <= 5; tick += 1) host.recordTick(tick, tick === 1 ? [birth(1, 1)] : [])
  // The existing age 0 -> 1 -> remove record is absent at both ticks 0 and 5.
  const frame = host.frame({ epoch: host.epoch(), worldTick: 0 }, 5)
  assert.equal(frame.kind, 'continuous')
  peer.accept(frame)
  assert.deepEqual(peer.sample(0), [])
  assert.equal(peer.sample(1)[0]?.id, 1)
  assert.equal(peer.sample(1.99)[0]?.id, 1)
  assert.deepEqual(peer.sample(2), [])
  assert.deepEqual(peer.sample(5), [])
  peer.accept(frame)
  assert.equal(peer.sample(1).length, 1)
  assert.deepEqual(peer.sample(2), [])
})

test('retains the complete short-lived ribbon, fade, and path presentation membership', () => {
  const host = createFlamePresentationHistory<{ sample: number }>({ worldKey: 'boneyard:run', tick: 0, maximumBirths: 32 })
  const peer = createFlamePresentationReplay<{ sample: number }>()
  peer.accept(host.frame(null, 0))
  host.recordTick(1, [birth(1, 1), birth(2, 1, 'fade', 3), birth(1, 1, 'path')])
  for (let tick = 2; tick <= 5; tick += 1) host.recordTick(tick, [])
  peer.accept(host.frame({ epoch: host.epoch(), worldTick: 0 }, 5))
  assert.deepEqual(peer.sample(1).map(item => item.kind), ['ribbon', 'fade', 'path'])
  assert.deepEqual(peer.sample(2).map(item => item.kind), ['fade'])
  assert.deepEqual(peer.sample(3), [])
  assert.deepEqual(peer.sample(500), [])
})

test('paused duplicate world ticks do not age, replay twice, or extend samples', () => {
  const host = createFlamePresentationHistory<{ sample: number }>({ worldKey: 'boneyard:run', tick: 0, maximumBirths: 32 })
  const peer = createFlamePresentationReplay<{ sample: number }>()
  peer.accept(host.frame(null, 0))
  host.recordTick(1, [birth(1, 1)])
  const frame = host.frame({ epoch: host.epoch(), worldTick: 0 }, 1)
  peer.accept(frame)
  for (let update = 0; update < 5; update += 1) {
    host.recordTick(1, [birth(1, 1)])
    peer.accept(frame)
    assert.equal(peer.sample(1).length, 1)
  }
  assert.equal(peer.throughTick(), 1)
})

test('load, world replacement, and a reconnect reset never replay connection history', () => {
  const host = createFlamePresentationHistory<{ sample: number }>({ worldKey: 'boneyard:run', tick: 0, maximumBirths: 32 })
  const peer = createFlamePresentationReplay<{ sample: number }>()
  peer.accept(host.frame(null, 0))
  const oldEpoch = host.epoch()
  host.recordTick(1, [birth(1, 1, 'fade', 6)])
  peer.accept(host.frame({ epoch: oldEpoch, worldTick: 0 }, 1))
  host.reset('boneyard:other', 1)
  peer.accept(host.frame({ epoch: oldEpoch, worldTick: 1 }, 1))
  assert.deepEqual(peer.sample(1), [])
  host.reset('boneyard:run', 1)
  peer.accept(host.frame(null, 1))
  assert.deepEqual(peer.sample(1), [])
})

test('bounded history uses an explicit recovery reset instead of fabricating old births', () => {
  const host = createFlamePresentationHistory<{ sample: number }>({ worldKey: 'boneyard:run', tick: 0, maximumBirths: 2 })
  const baseline = { epoch: host.epoch(), worldTick: 0 }
  for (let tick = 1; tick <= 5; tick += 1) host.recordTick(tick, [birth(tick, tick)])
  assert.equal(host.frame(baseline, 5).kind, 'reset')
  const peer = createFlamePresentationReplay<{ sample: number }>()
  peer.accept(host.frame(baseline, 5))
  assert.deepEqual(peer.sample(1), [])
  assert.deepEqual(peer.sample(5), [])
})

test('early owner retirement shortens an interval and stale duplicate frames cannot extend it', () => {
  const host = createFlamePresentationHistory<{ sample: number }>({ worldKey: 'boneyard:run', tick: 0, maximumBirths: 32 })
  const peer = createFlamePresentationReplay<{ sample: number }>()
  peer.accept(host.frame(null, 0))
  host.recordTick(1, [birth(1, 1, 'fade', 6)])
  const old = host.frame({ epoch: host.epoch(), worldTick: 0 }, 1)
  peer.accept(old)
  host.recordTick(2, [])
  host.retireOwner('owner', 2)
  peer.accept(host.frame({ epoch: host.epoch(), worldTick: 1 }, 2))
  assert.deepEqual(peer.sample(2), [])
  peer.discardBeforeTick(2)
  peer.accept(old)
  assert.deepEqual(peer.sample(2), [])
  peer.discardBeforeTick(6)
  peer.accept(old)
  assert.deepEqual(peer.sample(6), [])
})

test('dropping a reset-born retirement receipt invalidates its changed-tick coverage', () => {
  const host = createFlamePresentationHistory<{ sample: number }>({ worldKey: 'boneyard:run', tick: 1, maximumBirths: 1 })
  const baseline = { epoch: host.epoch(), worldTick: 1 }
  host.recordTick(2, [birth(2, 2)])
  host.retireBirth(birth(1, 1, 'fade', 6), 2)
  assert.equal(host.frame(baseline, 2).kind, 'reset')
})
