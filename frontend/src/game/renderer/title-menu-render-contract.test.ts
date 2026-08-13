import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TITLE_CLOUD_WIDTH,
  TITLE_GRAVE_ROWS,
  createTitleGraveRows,
  stepTitleGraveRow,
  tileStart,
  titleBackdropOffsetsAt,
} from './title-menu-render-contract.ts'

test('title parallax uses the recovered native rates', () => {
  const start = titleBackdropOffsetsAt(0)
  const after = titleBackdropOffsetsAt(10)
  assert.equal(after.horizon - start.horizon, 30)
  assert.equal(after.grass - start.grass, 210)
  assert.ok(after.cloudDetail < start.cloudDetail)
  assert.ok(after.cloudShadow < start.cloudShadow)
  assert.ok(start.cloudDetail < TITLE_CLOUD_WIDTH)
})

test('three deterministic grave rows keep native scale, tint, speed, and spacing', () => {
  const widths = [176, 152, 121, 161, 139, 220, 199, 200, 256]
  const first = createTitleGraveRows(widths)
  const second = createTitleGraveRows(widths)
  assert.deepEqual(first.rows, second.rows)
  assert.deepEqual(first.rows.map(({ baseline, gray, scale, speedPerTick }) => ({
    baseline, gray, scale, speedPerTick,
  })), TITLE_GRAVE_ROWS)
  assert.ok(first.rows.every((row) => row.graves.length > 3))

  const x = first.rows[2].graves[0].x
  stepTitleGraveRow(widths, first.rows[2], first.random)
  assert.equal(first.rows[2].graves[0].x, x - TITLE_GRAVE_ROWS[2].speedPerTick)
})

test('tiling starts on or before the left edge for positive and wrapped offsets', () => {
  assert.equal(tileStart(0, 1024), 0)
  assert.equal(tileStart(356, 1024), -356)
  assert.equal(tileStart(1380, 1024), -356)
  assert.equal(tileStart(-10, 1024), -1014)
})
