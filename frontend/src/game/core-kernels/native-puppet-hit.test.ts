import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativePuppetHit, nativePuppetHitAlpha, receiveNativePuppetHit, stepNativePuppetHit, stepNativePuppetHitTimer } from './native-puppet-hit.ts'

test('Puppet hit stores the sampled strength and refreshes the twenty-update float timer', () => {
  assert.equal(nativePuppetHitAlpha(createNativePuppetHit(), 5), 0)
  let hit = receiveNativePuppetHit(100, .25)
  assert.equal(nativePuppetHitAlpha(hit, 100), .25)
  for (let tick = 101; tick <= 110; tick += 1) hit = stepNativePuppetHit(hit, tick)
  assert.equal(hit.timer, .49999988079071045)
  assert.equal(nativePuppetHitAlpha(hit, 110), .12499997019767761)
  assert.equal(nativePuppetHitAlpha(hit, 110, true), .03124997764825821)
  for (let tick = 111; tick <= 120; tick += 1) hit = stepNativePuppetHit(hit, tick)
  assert.equal(hit.timer, 0)
  assert.deepEqual(receiveNativePuppetHit(120, .75), { strength: .75, tick: 120, timer: 1 })
})

test('a later same-tick owner update decrements a newly received hit', () => {
  const hit = receiveNativePuppetHit(12, .5)
  const stepped = stepNativePuppetHit(hit, 12)
  assert.equal(stepped.timer, .949999988079071)
  assert.equal(nativePuppetHitAlpha(stepped, 12), .4749999940395355)
  assert.equal(nativePuppetHitAlpha(hit, 12.5), .48750001192092896)
})

test('reaction and visual clocks retain independent values under the same exact twenty-tick decay', () => {
  let visual = receiveNativePuppetHit(0, 0)
  let reaction = 1
  for (let tick = 1; tick <= 20; tick += 1) {
    visual = stepNativePuppetHit(visual, tick)
    reaction = stepNativePuppetHitTimer(reaction)
    assert.equal(reaction, visual.timer)
    assert.equal(nativePuppetHitAlpha(visual, tick), 0)
    assert.equal(stepNativePuppetHitTimer(0), 0)
    assert.equal(stepNativePuppetHitTimer(1, tick), reaction)
    assert.equal(stepNativePuppetHitTimer(reaction, 0), reaction)
    assert.equal(reaction > 0, tick < 20)
  }
  assert.equal(stepNativePuppetHitTimer(1, 1000), 0)
})
