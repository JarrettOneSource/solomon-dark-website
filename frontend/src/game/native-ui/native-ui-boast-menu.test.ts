import assert from 'node:assert/strict'
import test from 'node:test'

import { NATIVE_BOASTS } from '../core-kernels/native-hub-npc.ts'
import { planNativeUiBoastMenu } from './native-ui-boast-menu.ts'
import { nativeUiRect } from './native-ui-plan.ts'

const rows = NATIVE_BOASTS.map(boast => ({
  detail: boast.statement,
  id: `native:${boast.id}`,
  label: boast.label,
  stockIconRecord: boast.iconRecord,
}))

test('Boast stays at its Chat parent height when the viewport grows', () => {
  for (const { width, height, left } of [
    { width: 1600, height: 900, left: 450 },
    { width: 1920, height: 1080, left: 610 },
  ]) {
    const plan = planNativeUiBoastMenu({ gold: 83, height, rows, width })
    assert.deepEqual(plan.outerBounds, nativeUiRect(left, 26, 700, 560))
    assert.deepEqual(plan.viewportBounds, nativeUiRect(left + 90, 106, 520, 400))
    assert.deepEqual(plan.doneBounds, nativeUiRect(left + 250, 511, 200, 40))
    assert.deepEqual(plan.rowBounds.map(({ visibleBounds }) => visibleBounds), [
      nativeUiRect(left + 105, 131, 490, 85),
      nativeUiRect(left + 105, 221, 490, 85),
      nativeUiRect(left + 105, 311, 490, 85),
      nativeUiRect(left + 105, 401, 490, 85),
      nativeUiRect(left + 105, 491, 490, 15),
    ])
    const title = plan.nodes.find(({ label }) => label === 'boast:title')
    const done = plan.nodes.find(({ label }) => label === 'boast:done-label')
    assert.ok(title?.kind === 'text' && done?.kind === 'text')
    assert.equal(title.text.y, 90)
    assert.equal(done.text.y, 536)
  }
})

test('Boast shows the current balance outside its scrolling list, including zero gold', () => {
  for (const gold of [0, 83, 123456]) {
    for (const scrollY of [0, 95]) {
      const plan = planNativeUiBoastMenu({ gold, height: 900, rows, scrollY, width: 1600 })
      const icon = plan.nodes.find(({ label }) => label === 'selector:gold-icon')
      const balance = plan.nodes.find(({ label }) => label === 'selector:gold-balance')
      assert.deepEqual(icon, {
        anchor: [0.5, 0.5], atlas: 'UI', kind: 'sprite', label: 'selector:gold-icon',
        record: 21, x: 570, y: 539,
      })
      assert.ok(balance?.kind === 'text')
      assert.deepEqual(balance.text, {
        align: 'left', font: 'body', text: `${gold}`, tint: 0xffffff, x: 580, y: 555,
      })
    }
  }
})

test('an empty Boast list keeps its stationary frame, balance and Done action', () => {
  const plan = planNativeUiBoastMenu({ gold: 0, height: 900, rows: [], scrollY: 95, width: 1600 })
  assert.equal(plan.contentHeight, 0)
  assert.equal(plan.maximumScrollY, 0)
  assert.equal(plan.scrollY, 0)
  assert.deepEqual(plan.rowBounds, [])
  assert.deepEqual(plan.actions.map(({ id }) => id), ['done'])
})

test('Boast rejects stage dimensions that cannot define a viewport', () => {
  for (const dimensions of [
    { width: Number.NaN, height: 900 },
    { width: 0, height: 900 },
    { width: 1600, height: Number.POSITIVE_INFINITY },
    { width: 1600, height: -1 },
  ]) {
    assert.throws(() => planNativeUiBoastMenu({ ...dimensions, gold: 0, rows }), RangeError)
  }
})
