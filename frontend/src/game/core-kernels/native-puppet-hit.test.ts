import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativePuppetHit, nativePuppetHitAlpha, receiveNativePuppetHit, stepNativePuppetHit } from './native-puppet-hit.ts'

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
