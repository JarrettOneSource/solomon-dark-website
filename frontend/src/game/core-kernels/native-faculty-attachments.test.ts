import assert from 'node:assert/strict'
import test from 'node:test'
import faculty from '../../editor/manifest/faculty.json' with { type: 'json' }
import { clipLineToBounds } from './line-obstruction.ts'
import { nativeFacultyLightningSource } from './native-faculty-attachments.ts'

test('every Faculty pose and facing selects both authored hands independently of body scale and bob', () => {
  for (let pose = 0; pose < 5; pose += 1) for (let facing = 0; facing < 18; facing += 1) {
    const points = faculty.entries[1 + pose * 18 + facing]!.extras!
    for (const mask of [0, 1, 2, 3]) {
      const selected = points.filter((_, hand) => (mask & 1 << hand) !== 0)
      const point = nativeFacultyLightningSource({ x: 100, y: 200 }, pose, facing * 20, mask)
      assert.equal(point.x, 100 + selected.reduce((sum, point) => sum + point.x, 0))
      assert.equal(point.y, 185 + selected.reduce((sum, point) => sum + point.y, 0))
    }
  }
})

test('beam clipping preserves entering, exiting, parallel, and exact-edge view geometry', () => {
  const bounds = { x: 0, y: 0, w: 100, h: 80 }
  assert.deepEqual(clipLineToBounds({ x: -20, y: 40 }, { x: 200, y: 40 }, bounds), {
    start: { x: 0, y: 40 }, end: { x: 100, y: 40 },
  })
  assert.deepEqual(clipLineToBounds({ x: 50, y: 40 }, { x: 50, y: -60 }, bounds), {
    start: { x: 50, y: 40 }, end: { x: 50, y: 0 },
  })
  assert.equal(clipLineToBounds({ x: -20, y: -1 }, { x: 200, y: -1 }, bounds), null)
  assert.deepEqual(clipLineToBounds({ x: -20, y: 0 }, { x: 200, y: 0 }, bounds), {
    start: { x: 0, y: 0 }, end: { x: 100, y: 0 },
  })
})
