import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeFaculty, registerNativeFaculty, stepNativeFaculty } from './native-faculty.ts'
import { createNativeRng } from './native-rng.ts'

const context = { tick: 0, actorTimeScale: 1, targetDistanceSquared: 200 ** 2, lineOfSight: true }

test('Faculty primary polling uses even ticks, strict distance bounds, visibility and suppression', () => {
  const initial = createNativeFaculty(createNativeRng(41))
  for (const patch of [
    { tick: 1 }, { targetDistanceSquared: 150 ** 2 },
    { targetDistanceSquared: 250 ** 2 }, { targetDistanceSquared: null }, { lineOfSight: false },
  ]) {
    assert.equal(stepNativeFaculty(initial.state, initial.rng, 0, { ...context, ...patch }).state.action, null)
  }
  const held = stepNativeFaculty({ ...initial.state, disabledPrimaryTicks: 2 }, initial.rng, 0, context)
  assert.equal(held.state.action, null)
  assert.equal(held.state.disabledPrimaryTicks, 1)
  const cast = stepNativeFaculty(initial.state, initial.rng, 1, context)
  assert.equal(cast.state.action?.kind, 'lightning')
  assert.equal(cast.state.primaryPoll, 300)
  assert.ok(cast.state.attackRange >= 350 && cast.state.attackRange <= 600)
})

test('Faculty secondary cooldown starts after the first dispatch and resets only on a secondary selection', () => {
  const initial = createNativeFaculty(createNativeRng(72))
  const idle = stepNativeFaculty({ ...initial.state, primaryPoll: 100 }, initial.rng, 0, context)
  assert.equal(idle.state.secondaryCooldown, initial.state.secondaryCooldown)
  let cast = stepNativeFaculty(initial.state, initial.rng, 0, context)
  let dispatches = 0
  for (let tick = 1; tick < 250; tick += 1) {
    cast = stepNativeFaculty(cast.state, cast.rng, 0, { ...context, tick })
    if (cast.dispatch !== null) dispatches += 1
  }
  assert.equal(dispatches, 1)
  assert.equal(cast.state.completedDispatches, 1)
  assert.ok(cast.state.secondaryCooldown < initial.state.secondaryCooldown)
  let sawSecondary = false
  let sawPrimary = false
  for (let seed = 0; seed < 32; seed += 1) {
    const chosen = stepNativeFaculty({ ...initial.state, secondaryCooldown: -1 }, createNativeRng(seed), 0, context)
    if (chosen.state.action?.kind === 'two-hand') {
      sawSecondary = true
      assert.ok(chosen.state.secondaryCooldown >= 1500 && chosen.state.secondaryCooldown <= 2500)
    } else {
      sawPrimary = true
      assert.equal(chosen.state.secondaryCooldown, -1)
    }
  }
  assert.ok(sawSecondary && sawPrimary)
})

test('Faculty controller registration adds the authored staggering to constructor cooldowns', () => {
  const initial = createNativeFaculty(createNativeRng(9))
  for (const count of [1, 2, 3]) {
    const registered = registerNativeFaculty(initial.state, initial.rng, count).state
    const delta = registered.secondaryCooldown - initial.state.secondaryCooldown
    assert.ok(count === 1 ? delta >= 100 && delta <= 400
      : count === 2 ? delta >= 400 && delta <= 800 : delta >= 800 && delta <= 1000)
    assert.ok(count === 3 ? registered.primaryPoll >= 0 && registered.primaryPoll < 300
      : registered.primaryPoll === (count + 1) * 100)
  }
})

test('Faculty lightning dispatches continuously, retains its hand glow, and unlocks on completion', () => {
  const initial = createNativeFaculty(createNativeRng(89))
  let step = stepNativeFaculty(initial.state, initial.rng, 1, context)
  let pulses = 0
  let locked = false
  for (let tick = 1; tick < 400; tick += 1) {
    step = stepNativeFaculty(step.state, step.rng, 1, { ...context, tick })
    locked ||= step.state.headingLocked
    if (step.dispatch !== null) {
      assert.equal(step.dispatch, 'lightning')
      assert.ok(step.state.handMask > 0)
      pulses += 1
    }
    if (step.state.action === null) break
  }
  assert.ok(pulses > 1 && locked)
  assert.equal(step.state.headingLocked, false)
  assert.equal(step.state.bodyPose, 0)
  assert.equal(step.state.completedDispatches, pulses)
})
