import assert from 'node:assert/strict'
import test from 'node:test'
import { HubDowsingFlashPresentation } from './hub-dowsing-flash.ts'
import { hubDowsingFlashAlpha } from './hub-inventory-render-contract.ts'

for (const action of ['dowse', 'buy-dowsing'] as const) {
  test(`${action}: native flash is identity Off and reduced once On from its first frame`, () => {
    const flash = new HubDowsingFlashPresentation()
    flash.consume(null, 0)
    flash.consume({ accepted: true, action, sequence: 1 }, 100)
    for (const age of [0, 9.999, 10, 50, 100, 190, 200, 2_000]) {
      assert.equal(flash.sample(100 + age, false).alpha, hubDowsingFlashAlpha(age))
      assert.equal(flash.sample(100 + age, true).alpha, hubDowsingFlashAlpha(age) * .2)
    }
    assert.equal(flash.sample(100, true).trigger, action)
    assert.equal(flash.sample(300, true).trigger, null)
  })
}

test('initial accepted snapshot is a baseline, not an action to replay', () => {
  const flash = new HubDowsingFlashPresentation()
  flash.consume({ accepted: true, action: 'dowse', sequence: 7 }, 0)
  assert.deepEqual(flash.sample(0, false), { alpha: 0, trigger: null })
  flash.consume({ accepted: true, action: 'buy-dowsing', sequence: 8 }, 10)
  assert.equal(flash.sample(10, true).alpha, .2)
})

test('rejected and unrelated feedback do not start a Dowsing flash', () => {
  const flash = new HubDowsingFlashPresentation()
  flash.consume(null, 0)
  flash.consume({ accepted: false, action: 'dowse', sequence: 1 }, 10)
  assert.equal(flash.sample(10, false).alpha, 0)
  flash.consume({ accepted: false, action: 'buy-dowsing', sequence: 2 }, 20)
  assert.equal(flash.sample(20, true).alpha, 0)
  flash.consume({ accepted: true, action: 'close-dowsing', sequence: 3 }, 30)
  assert.equal(flash.sample(30, false).alpha, 0)
})

test('live Off-On-Off changes only current alpha and never restarts or compounds the clock', () => {
  const flash = new HubDowsingFlashPresentation()
  flash.consume(null, 0)
  flash.consume({ accepted: true, action: 'dowse', sequence: 1 }, 100)
  const native = hubDowsingFlashAlpha(80)
  assert.equal(flash.sample(180, false).alpha, native)
  assert.equal(flash.sample(180, true).alpha, native * .2)
  assert.equal(flash.sample(180, true).alpha, native * .2)
  assert.equal(flash.sample(180, false).alpha, native)
  assert.equal(flash.sample(300, false).alpha, 0)
})

test('retained close/reopen and duplicate feedback cannot restart the consumed flash', () => {
  const flash = new HubDowsingFlashPresentation()
  const feedback = { accepted: true, action: 'dowse' as const, sequence: 1 }
  flash.consume(null, 0)
  flash.consume(feedback, 100)
  flash.consume(feedback, 180)
  assert.equal(flash.sample(180, true).alpha, hubDowsingFlashAlpha(80) * .2)
  flash.consume(null, 250)
  flash.consume(feedback, 1_000)
  assert.equal(flash.sample(1_000, false).alpha, 0)
})

test('a new accepted purchase starts its own native lifetime after a roll', () => {
  const flash = new HubDowsingFlashPresentation()
  flash.consume(null, 0)
  flash.consume({ accepted: true, action: 'dowse', sequence: 1 }, 100)
  flash.consume({ accepted: true, action: 'buy-dowsing', sequence: 2 }, 150)
  assert.deepEqual(flash.sample(150, true), { alpha: .2, trigger: 'buy-dowsing' })
  assert.equal(flash.sample(340, false).alpha, hubDowsingFlashAlpha(190))
  assert.equal(flash.sample(350, false).alpha, 0)
})
