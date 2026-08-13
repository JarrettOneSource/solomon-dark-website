import assert from 'node:assert/strict'
import test from 'node:test'

import {
  boneyardDigIndicatorLayout,
} from './boneyard-dig-indicator.ts'

test('pins an off-screen cardinal target to the HUD-safe edge', () => {
  assert.deepEqual(
    boneyardDigIndicatorLayout(
      { x: 800, y: 450 },
      { x: 2_000, y: 450 },
    ),
    {
      placement: 'edge',
      rotationDeg: 0,
      x: 1_536,
      y: 450,
    },
  )
})

test('preserves diagonal heading when the top edge is reached first', () => {
  assert.deepEqual(
    boneyardDigIndicatorLayout(
      { x: 800, y: 450 },
      { x: -800, y: -1_150 },
    ),
    {
      placement: 'edge',
      rotationDeg: -135,
      x: 438,
      y: 88,
    },
  )
})

test('places the arrow head next to an on-screen Solomon Dig root', () => {
  assert.deepEqual(
    boneyardDigIndicatorLayout(
      { x: 800, y: 450 },
      { x: 1_000, y: 450 },
    ),
    {
      placement: 'target',
      rotationDeg: 0,
      x: 964,
      y: 450,
    },
  )
})

test('uses a finite stable heading when player and target roots coincide', () => {
  assert.deepEqual(
    boneyardDigIndicatorLayout(
      { x: 800, y: 450 },
      { x: 800, y: 450 },
    ),
    {
      placement: 'target',
      rotationDeg: 0,
      x: 764,
      y: 450,
    },
  )
})

test('expands the safe perimeter with a browser-sized logical viewport', () => {
  assert.deepEqual(
    boneyardDigIndicatorLayout(
      { x: 800, y: 500 },
      { x: 800, y: 2_000 },
      { width: 1_600, height: 1_000 },
    ),
    {
      placement: 'edge',
      rotationDeg: 90,
      x: 800,
      y: 880,
    },
  )
})
