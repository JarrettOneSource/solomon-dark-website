import assert from 'node:assert/strict'
import test from 'node:test'

import { createHubStudentFixture } from './hub-student-fixtures.ts'
import { HubStudentStore } from './hub-student-store.ts'

test('deterministic fixtures retain stable route-distributed identities', () => {
  const first = createHubStudentFixture({ count: 256, seed: 0x12345678 })
  const second = createHubStudentFixture({ count: 256, seed: 0x12345678 })
  assert.deepEqual(first, second)
  assert.equal(new Set(first.map((student) => student.id)).size, 256)
  assert.equal(new Set(first.map((student) => student.pathId)).size, 18)
  assert.ok(new Set(first.map((student) => `${student.position.x},${student.position.y}`)).size > 200)
})

test('component storage round-trips state and preserves source order through slot reuse', () => {
  const fixture = createHubStudentFixture({ count: 48 })
  const store = HubStudentStore.fromStates(fixture)
  assert.deepEqual(store.states(), fixture)

  assert.equal(store.removeById(7), true)
  assert.equal(store.removeById(19), true)
  const replacement = { ...fixture[7], id: 1000 }
  store.add(replacement)
  assert.deepEqual(
    store.states().map((student) => student.id),
    [...fixture.map((student) => student.id).filter((id) => id !== 7 && id !== 19), 1000],
  )
  assert.equal(store.slotForId(1000), store.slotAt(store.size - 1))
})

test('component storage refreshes reusable scalar work views in place', () => {
  const fixture = createHubStudentFixture({ count: 8 })
  const store = HubStudentStore.fromStates(fixture)
  const views = store.states([])
  const identities = [...views]
  store.write(store.slotAt(0), {
    ...fixture[0],
    position: { x: fixture[0].position.x + 10, y: fixture[0].position.y - 5 },
  })

  assert.equal(store.states(views), views)
  assert.deepEqual(views, store.states())
  assert.deepEqual(views.map((view, index) => view === identities[index]), Array(8).fill(true))
})

test('fixture inputs reject invalid population sizes', () => {
  assert.throws(() => createHubStudentFixture({ count: -1 }), /within 0\.\.16384/)
  assert.throws(() => createHubStudentFixture({ count: 1.5 }), /within 0\.\.16384/)
  assert.throws(() => createHubStudentFixture({ count: 16_385 }), /within 0\.\.16384/)
})
