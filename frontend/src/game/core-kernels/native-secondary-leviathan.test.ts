import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_LEVIATHAN_LIFETIME_TICKS,
  createNativeLeviathanBirth,
  nativeLeviathanActive,
  nativeLeviathanAppendageLocalRoot,
  nativeLeviathanAppendageRecord,
  nativeLeviathanCurrentScale,
  nativeLeviathanDirectionFrame,
  nativeLeviathanInsideTargetLane,
  nativeLeviathanMuzzlePosition,
  nativeLeviathanPhase,
} from './native-secondary-leviathan.ts'
import { advanceNativeRngWords, createNativeRng } from './native-rng.ts'

const LAYOUTS = [
  [{ x: 0, minY: -40, maxY: -20, heading: 10, scale: 2.1 }],
  [
    { x: -10, minY: -40, maxY: -20, heading: 10, scale: 2.1 },
    { x: 10, minY: -20, maxY: -10, heading: 135, scale: 2 },
  ],
  [
    { x: 0, minY: -40, maxY: -20, heading: 10, scale: 2.1 },
    { x: 15, minY: -20, maxY: -10, heading: 135, scale: 2 },
    { x: -15, minY: -20, maxY: -10, heading: 225, scale: 2 },
  ],
  [
    { x: -10, minY: -40, maxY: -20, heading: 10, scale: 2.1 },
    { x: 10, minY: -50, maxY: -20, heading: 10, scale: 2 },
    { x: 18, minY: -20, maxY: -10, heading: 135, scale: 2 },
    { x: -18, minY: -20, maxY: -10, heading: 225, scale: 2 },
  ],
  [
    { x: 0, minY: -50, maxY: -40, heading: 10, scale: 2.25 },
    { x: -18, minY: -40, maxY: -20, heading: 10, scale: 2.1 },
    { x: 18, minY: -50, maxY: -20, heading: 10, scale: 2 },
    { x: 18, minY: -20, maxY: -10, heading: 135, scale: 2 },
    { x: -18, minY: -20, maxY: -10, heading: 225, scale: 2 },
  ],
] as const

test('Leviathan constructor owns all five authored layouts and their exact RNG budgets', () => {
  const source = createNativeRng(123)
  const maximumScales = [0.75, Math.fround(0.85), Math.fround(0.95), 1, 1]
  for (let quantity = 1; quantity <= 5; quantity += 1) {
    const birth = createNativeLeviathanBirth(source, quantity, true)
    assert.equal(birth.quantity, quantity)
    assert.equal(birth.maximumScale, maximumScales[quantity - 1])
    assert.deepEqual(birth.rng, advanceNativeRngWords(source, 1 + 5 * quantity))
    assert.equal(birth.appendages.length, quantity)
    for (let index = 0; index < quantity; index += 1) {
      const appendage = birth.appendages[index]!
      const authored = LAYOUTS[quantity - 1]![index]!
      assert.equal(appendage.baseOffset.x, authored.x)
      assert.ok(appendage.baseOffset.y >= authored.minY)
      assert.ok(appendage.baseOffset.y <= authored.maxY)
      assert.equal(appendage.headingDegrees, authored.heading)
      assert.equal(appendage.spriteScale, authored.scale)
      assert.ok(appendage.spinDegrees >= 0 && appendage.spinDegrees <= 360)
      assert.ok(appendage.spinStepDegrees >= 2 && appendage.spinStepDegrees <= 3)
      assert.ok(appendage.bank === 0 || appendage.bank === 1)
      assert.ok(appendage.countdown >= 0 && appendage.countdown < 100)
    }
  }
})

test('the maximum-Leviathan set skips only the inclusive quantity selector word', () => {
  const source = createNativeRng(123)
  const ordinary = createNativeLeviathanBirth(source, 5, false)
  const maximum = createNativeLeviathanBirth(source, 5, true)
  assert.equal(ordinary.quantity, 5)
  assert.equal(maximum.quantity, 5)
  assert.deepEqual(ordinary.rng, advanceNativeRngWords(source, 2 + 5 * ordinary.quantity))
  assert.deepEqual(maximum.rng, advanceNativeRngWords(source, 1 + 5 * maximum.quantity))
  assert.notDeepEqual(ordinary.appendages, maximum.appendages)
})

test('Leviathan has the exact overlapping float32 phase boundaries', () => {
  assert.equal(NATIVE_LEVIATHAN_LIFETIME_TICKS, 1_664)
  assert.equal(nativeLeviathanCurrentScale(0), 0)
  assert.equal(nativeLeviathanCurrentScale(40), 0.9999995827674866)
  assert.equal(nativeLeviathanCurrentScale(41), 1)
  assert.equal(nativeLeviathanCurrentScale(1_639), 1)
  assert.equal(nativeLeviathanCurrentScale(1_640), 0.9599999785423279)
  assert.equal(nativeLeviathanCurrentScale(1_663), 0.039999820291996)
  assert.equal(nativeLeviathanCurrentScale(1_664), 0)
  assert.deepEqual([40, 41, 1_639, 1_640].map(nativeLeviathanPhase), [0, 1, 1, 2])
  assert.equal(nativeLeviathanActive(40), false)
  assert.equal(nativeLeviathanActive(41), true)
  assert.equal(nativeLeviathanActive(1_640), true)
  assert.equal(nativeLeviathanActive(1_641), false)
})

test('appendage direction records, local geometry, muzzle sockets, and strict lane are native', () => {
  assert.deepEqual(
    [0, 11, 12, 23, 24, 347, 348, 359].map(nativeLeviathanDirectionFrame),
    [0, 0, 1, 1, 1, 14, 0, 0],
  )
  assert.equal(nativeLeviathanAppendageRecord(0, 10), 343)
  assert.equal(nativeLeviathanAppendageRecord(1, 135), 364)
  const local = nativeLeviathanAppendageLocalRoot(
    { x: 0, y: -30 },
    { x: 0, y: 0 },
    0,
    0,
  )
  assert.deepEqual(local, { x: 0, y: 1 })
  assert.deepEqual(nativeLeviathanMuzzlePosition(
    { x: 100, y: 200 }, local, 0, 0, 2,
  ), { x: 100, y: 112 })

  const origin = { x: 0, y: 0 }
  assert.equal(nativeLeviathanInsideTargetLane(origin, 0, { x: 0, y: -299.999 }), true)
  assert.equal(nativeLeviathanInsideTargetLane(origin, 0, { x: 0, y: -300 }), false)
  const inside = 24.99 * Math.PI / 180
  const outside = 25.01 * Math.PI / 180
  assert.equal(nativeLeviathanInsideTargetLane(origin, 0, {
    x: Math.sin(inside) * 200,
    y: -Math.cos(inside) * 200,
  }), true)
  assert.equal(nativeLeviathanInsideTargetLane(origin, 0, {
    x: Math.sin(outside) * 200,
    y: -Math.cos(outside) * 200,
  }), false)
})
