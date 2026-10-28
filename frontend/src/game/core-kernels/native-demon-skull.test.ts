import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createNativeDemonSkull,
  nativeDemonSkullAttackChoices,
  nativeDemonSkullHealthTriggerMask,
  prepareNativeDemonSkullTick,
  stepNativeDemonSkullController,
  type NativeDemonSkullControllerContext,
} from './native-demon-skull.ts'
import { createNativeRng, drawNativeFloat } from './native-rng.ts'

const context: NativeDemonSkullControllerContext = {
  alternatePlayer: false, hasAction: false, headingDeg: 0, healthRatio: 1,
  lineOfSight: true, movementScale: 1, screamPlaying: false, targetDistanceSquared: 200 ** 2,
}

test('DemonSkull construction consumes both native phases and retains its first viewport admission', () => {
  const first = drawNativeFloat(createNativeRng(3), 360)
  const second = drawNativeFloat(first.state, 360)
  const created = createNativeDemonSkull(createNativeRng(3), 1)
  assert.deepEqual(created.rng, second.state)
  assert.equal(created.state.bodyPhaseDeg, first.value)
  assert.equal(created.state.flickerPhaseDeg, second.value)
  assert.deepEqual(created.state.bodyOffset, { x: 0, y: 25 })
  assert.equal(created.state.speed, 4)
  assert.equal(created.state.attackTicksRemaining, 500)
  assert.equal(created.state.capabilities, 0)
  const seen = prepareNativeDemonSkullTick(created.state, true)
  assert.equal(prepareNativeDemonSkullTick(seen, false).seen, true)
})

test('DemonSkull health gates are strict one-shot bits and never fabricate an action', () => {
  assert.equal(nativeDemonSkullHealthTriggerMask(1, 0, 0), 15)
  for (const [index, ratio] of [.8, .6, .4, .2].entries()) {
    const threshold = Math.fround(ratio)
    const bit = 1 << index
    assert.equal(nativeDemonSkullHealthTriggerMask(threshold, threshold - .001, 0) & bit, 0)
    assert.equal(nativeDemonSkullHealthTriggerMask(threshold + .001, threshold, 0) & bit, 0)
    assert.equal(nativeDemonSkullHealthTriggerMask(threshold + .001, threshold - .001, 0), bit)
    assert.equal(nativeDemonSkullHealthTriggerMask(threshold + .001, threshold - .001, bit), 0)
  }
})

test('every DemonSkull capability combination uses native distance and line-of-sight weights', () => {
  for (let capabilities = 0; capabilities < 16; capabilities += 1) {
    for (const far of [false, true]) {
      const choices = nativeDemonSkullAttackChoices(capabilities, (far ? 251 : 250) ** 2, true)
      assert.equal(choices.filter(choice => choice === 'eyes').length, capabilities & 1 ? 1 : 0)
      assert.equal(choices.filter(choice => choice === 'mouth').length, capabilities & 2 ? far ? 3 : 1 : 0)
      assert.equal(choices.filter(choice => choice === 'spit').length, capabilities & 4 ? far ? 2 : 1 : 0)
      const blocked = nativeDemonSkullAttackChoices(capabilities, (far ? 251 : 250) ** 2, false)
      assert.ok(blocked.every(choice => choice === 'spit'))
      assert.equal(blocked.length, capabilities & 4 ? far ? 2 : 1 : 0)
    }
  }
})

test('DemonSkull ranged selection waits for deceleration before constructing its action', () => {
  const created = createNativeDemonSkull(createNativeRng(12), 1, 1)
  const selected = stepNativeDemonSkullController({ ...created.state, seen: true, attackTicksRemaining: 1 }, created.rng, context)
  assert.equal(selected.incrementAttackSeed, true)
  assert.equal(selected.beginAction, null)
  assert.equal(selected.state.pendingAttack, 'eyes')
  assert.equal(selected.state.targetSpeed, Math.fround(.0001))
  let state = selected.state
  let rng = selected.rng
  let beganAt = 0
  for (let tick = 1; tick <= 100; tick += 1) {
    const result = stepNativeDemonSkullController(prepareNativeDemonSkullTick(state, false), rng, context)
    state = result.state
    rng = result.rng
    if (result.beginAction !== null) {
      assert.equal(result.beginAction, 'eyes')
      assert.ok(state.speed < Math.fround(.005))
      assert.equal(state.pendingAttack, null)
      beganAt = tick
      break
    }
  }
  assert.equal(beganAt, 80)
})

test('DemonSkull outer visual clocks and heading delay advance while inherited actions are occupied', () => {
  const created = createNativeDemonSkull(createNativeRng(8), 1)
  let state = { ...created.state, bodyHeadingDeg: 0, seen: true }
  let rng = created.rng
  for (let tick = 1; tick <= 11; tick += 1) {
    const result = stepNativeDemonSkullController(state, rng, { ...context, hasAction: true, headingDeg: 90 })
    state = result.state
    rng = result.rng
    assert.equal(state.bodyHeadingDeg, tick < 11 ? 0 : 90)
    assert.equal(state.attackTicksRemaining, 500)
    assert.equal(result.beginAction, null)
  }
  assert.ok(state.lightIntensity > .05 && state.lightIntensity < .06)
  assert.ok(state.bodyPhaseDeg > created.state.bodyPhaseDeg + 32)
})

test('Scream is admitted at full speed and preserves its playback and recovery clocks', () => {
  let source = createNativeDemonSkull(createNativeRng(0), 1)
  let found = false
  for (let seed = 0; seed < 1000; seed += 1) {
    source = createNativeDemonSkull(createNativeRng(seed), 1)
    const result = stepNativeDemonSkullController({ ...source.state, seen: true }, source.rng, {
      ...context, targetDistanceSquared: 401 ** 2,
    })
    if (result.beginAction !== 'scream') continue
    assert.equal(result.state.speed, result.state.targetSpeed)
    assert.equal(result.state.screamActive, true)
    const playing = stepNativeDemonSkullController(result.state, result.rng, { ...context, screamPlaying: true })
    assert.equal(playing.state.speed, Math.fround(4 + Math.fround(.04)))
    assert.equal(playing.screamShake, true)
    const stopped = stepNativeDemonSkullController(playing.state, playing.rng, context)
    assert.equal(stopped.landing, true)
    assert.equal(stopped.state.bodyPose, 0)
    assert.equal(stepNativeDemonSkullController(stopped.state, stopped.rng, context).landing, false)
    const settled = stepNativeDemonSkullController({ ...stopped.state, speed: 1 }, stopped.rng, context)
    assert.equal(settled.state.speed, 1)
    assert.equal(settled.state.screamActive, false)
    found = true
    break
  }
  assert.equal(found, true)
})
