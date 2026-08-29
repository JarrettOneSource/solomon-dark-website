import assert from 'node:assert/strict'
import test from 'node:test'

import { Container } from 'pixi.js'

import {
  TITLE_CLOUD_WIDTH,
  TITLE_GRAVE_ROWS,
  TITLE_MAIN_MENU_ATLAS_RECORDS,
  TITLE_SOLOMON_LAYER_Z,
  createTitleGraveRows,
  stepTitleGraveRow,
  tileStart,
  titleBackdropOffsetsAt,
  titleSolomonCloakPasses,
} from './title-menu-render-contract.ts'

test('title menu keeps every active retail Title record on the shared atlas page', () => {
  assert.deepEqual(TITLE_MAIN_MENU_ATLAS_RECORDS, {
    cloudBase: 0,
    cloudShadow: 1,
    cloudDetail: 2,
    solomonBody: 3,
    grass: 4,
    horizon: 5,
    moon: 6,
    solomonEyes: 8,
    solomonCloaks: [11, 12, 13, 14, 15],
    graves: [16, 17, 18, 19, 20, 21, 22, 23, 24],
  })
})

test('title Solomon keeps every cloak pass painter-above the eyes', () => {
  const parent = new Container({ label: 'title-solomon' })
  const child = (label: string, zIndex: number) => {
    const container = new Container({ label })
    container.zIndex = zIndex
    return container
  }
  parent.addChild(
    child('body', TITLE_SOLOMON_LAYER_Z.body),
    child('eyes', TITLE_SOLOMON_LAYER_Z.eyes),
    child('cloak-current-first', TITLE_SOLOMON_LAYER_Z.cloak),
    child('cloak-current-second', TITLE_SOLOMON_LAYER_Z.cloak),
    child('cloak-next-first', TITLE_SOLOMON_LAYER_Z.cloak),
    child('cloak-next-second', TITLE_SOLOMON_LAYER_Z.cloak),
  )

  parent.sortChildren()

  assert.deepEqual(parent.children.map(({ label }) => label), [
    'body',
    'eyes',
    'cloak-current-first',
    'cloak-current-second',
    'cloak-next-first',
    'cloak-next-second',
  ])
  parent.destroy({ children: true })
})

test('title Solomon enumerates every duplicate cloak pass and wraps continuously', () => {
  assert.deepEqual(titleSolomonCloakPasses(0), [
    { alpha: 1, height: 654, index: 0, y: 6 },
    { alpha: 1, height: 654, index: 0, y: 6 },
    { alpha: 0, height: 652, index: 1, y: 8 },
    { alpha: 0, height: 652, index: 1, y: 8 },
  ])
  assert.deepEqual(titleSolomonCloakPasses(4.5), [
    { alpha: 0.875, height: 654, index: 4, y: 6 },
    { alpha: 0.875, height: 654, index: 4, y: 6 },
    { alpha: 0.5, height: 654, index: 0, y: 6 },
    { alpha: 0.5, height: 654, index: 0, y: 6 },
  ])
  assert.deepEqual(titleSolomonCloakPasses(5), titleSolomonCloakPasses(0))
})

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
