import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_GOODIE_FACING_PROBE_DISTANCE,
  NATIVE_GOODIE_QUERY_RADIUS,
  nearestBoneyardGoodie,
} from './boneyard-goodie-interaction.ts'

const player = { headingIndex: 0, position: { x: 0, y: 0 } } as const

test('Goodie interaction uses the exact strict native facing query', () => {
  assert.equal(NATIVE_GOODIE_FACING_PROBE_DISTANCE, 25)
  assert.equal(NATIVE_GOODIE_QUERY_RADIUS, 50)
  const selected = nearestBoneyardGoodie([
    goodie(1, 0, -74.99),
    goodie(2, 0, -30),
    goodie(3, 0, -40),
  ], player)
  assert.equal(selected?.id, 2)

  assert.equal(nearestBoneyardGoodie([goodie(4, 0, -75)], player), null)
  assert.equal(nearestBoneyardGoodie([goodie(5, 0, 25)], player), null)
})

test('Goodie interaction excludes active, exhausted, and nonzero-phase members', () => {
  assert.equal(nearestBoneyardGoodie([
    { ...goodie(1, 0, -25), active: true },
    { ...goodie(2, 0, -25), exhausted: true },
    { ...goodie(3, 0, -25), phase: 1 as const },
  ], player), null)
})

test('Goodie interaction resolves all 24 headings from the authoritative actor', () => {
  assert.equal(nearestBoneyardGoodie([
    goodie(1, 74.99, 0),
    goodie(2, -25, 0),
  ], { headingIndex: 6, position: { x: 0, y: 0 } })?.id, 1)
  assert.equal(nearestBoneyardGoodie([
    goodie(1, 0, 74.99),
    goodie(2, 0, -25),
  ], { headingIndex: 12, position: { x: 0, y: 0 } })?.id, 1)
})

function goodie(id: number, x: number, y: number) {
  return {
    active: false,
    exhausted: false,
    id,
    phase: 0 as const,
    position: { x, y },
  }
}
