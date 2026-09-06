import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng } from './native-rng.ts'
import {
  createNativeSpiderState, moveNativeSpider, reactNativeSpiderToDamage, nativeSpiderMovementClock,
  type NativeSpiderMovement, type NativeSpiderState,
} from './native-spider.ts'

const request: NativeSpiderMovement = {
  position: { x: 0, y: 0 }, headingDeg: 90, speed: 4, statusFactor: 1,
  light: 0, target: {
    position: { x: 400, y: 0 }, radius: 25, headingDeg: 90,
    isPlayer: true, webSeverity: 0, velocityPerTick: { x: 0, y: 0 },
  },
  wanderHeadingDeg: 90, spitWebs: true, cocoonHealth: 50,
  liveSilkCount: 0, sharedSpitTicksRemaining: 0,
}
const rng = createNativeRng(17)

test('the Spider movement owner preserves enhanced, ordinary, unlit and off-camera UID phases', () => {
  for (const [visible, lit, enhanced, cadence, full] of [
    [true, true, true, 2, true], [true, true, false, 5, true],
    [true, false, true, 10, false], [false, true, true, 15, false],
  ] as const) {
    assert.deepEqual(nativeSpiderMovementClock(7, 7 + cadence, visible, lit, enhanced), { cadence, full, due: true })
    assert.equal(nativeSpiderMovementClock(7, 8 + cadence, visible, lit, enhanced).due, false)
  }
})

test('targetless Spider routes before heading jitter and retains its native one-and-a-half-speed override', () => {
  const result = moveNativeSpider(createNativeSpiderState(0), {
    ...request, target: null, statusFactor: 0.1,
    routeGoal: goal => {
      assert.equal(goal.x, 10_000)
      return { goal: { x: -100, y: 0 }, followingRoute: true, turnAround: false }
    },
  }, rng)
  assert.equal(result.state.bodyHeadingDeg, 90)
  assert.ok(result.headingDeg >= 225 && result.headingDeg <= 315)
  assert.ok(Math.abs(Math.hypot(result.goal.x, result.goal.y) - 6) < 0.000001)
})

test('Spider fires a real Silk in darkness and respects the shared and per-Spider spawn gates', () => {
  const state = createNativeSpiderState(0)
  const shot = moveNativeSpider(state, request, rng)
  assert.ok(shot.silk)
  assert.equal(shot.silk.state.cocoonHealth, 50)
  assert.equal(shot.silk.state.center.x.points.length, 20)
  assert.equal(shot.state.actionState, 3)
  assert.equal(shot.state.actionTicksRemaining, 149)
  assert.ok(shot.sharedSpitTicksRemaining >= 5 && shot.sharedSpitTicksRemaining <= 50)
  assert.ok(shot.state.spitTicksRemaining >= 200 && shot.state.spitTicksRemaining <= 600)
  for (const blocked of [
    { liveSilkCount: 4 }, { sharedSpitTicksRemaining: 1 }, { spitWebs: false },
    { light: 0.01 }, { target: { ...request.target!, isPlayer: false } },
    { target: { ...request.target!, webSeverity: 3 } },
  ]) {
    assert.equal(moveNativeSpider(state, { ...request, ...blocked }, rng).silk, null)
  }
  assert.equal(moveNativeSpider({ ...state, spitTicksRemaining: 1 }, request, rng).silk, null)
})

test('Spider waits after a spit, completes a strafe, and returns from retreat at its preferred distance', () => {
  const state = createNativeSpiderState(0)
  const waiting = moveNativeSpider({ ...state, actionState: 3, actionTicksRemaining: 2 }, request, rng)
  assert.equal(waiting.state.actionState, 3)
  assert.equal(waiting.state.frame, 3)
  const done = moveNativeSpider({ ...waiting.state, actionTicksRemaining: 0 }, request, rng)
  assert.equal(done.state.actionState, 1)
  const strafe = moveNativeSpider({ ...state, actionState: 2, strafeTicksRemaining: 1, strafeSign: 1 }, request, rng)
  assert.equal(strafe.state.actionState, 1)
  assert.ok(Math.hypot(strafe.goal.x, strafe.goal.y) > 0)
  assert.equal(moveNativeSpider({ ...state, actionState: 4 }, request, rng).state.actionState, 1)
})

test('only a fully webbed player keeps a Spider attached, with one bite and a quarter-second suck after 26 calls', () => {
  const target = { ...request.target!, position: { x: 20, y: 0 }, webSeverity: 3 }
  const contact = { ...request, target, light: 1 }
  let state: NativeSpiderState = { ...createNativeSpiderState(0), actionState: 5 }
  const bite = moveNativeSpider(state, contact, rng)
  assert.equal(bite.bite, true)
  assert.equal(bite.state.attached, true)
  assert.equal(bite.suck, false)
  state = bite.state
  for (let call = 1; call < 25; call += 1) {
    const result = moveNativeSpider(state, contact, rng)
    assert.equal(result.bite, false)
    assert.equal(result.suck, false)
    state = result.state
  }
  assert.equal(moveNativeSpider(state, contact, rng).suck, true)
  const freed = moveNativeSpider(state, { ...contact, target: { ...target, webSeverity: 2 } }, rng)
  assert.equal(freed.state.attached, false)
  assert.equal(freed.state.actionState, 4)
  const summon = moveNativeSpider({ ...state, attached: false }, {
    ...contact, target: { ...target, isPlayer: false },
  }, rng)
  assert.equal(summon.bite, true)
  assert.equal(summon.state.attached, false)
})

test('physical hits start the native dodge while magic leaves the action intact', () => {
  const state = createNativeSpiderState(0)
  const physical = reactNativeSpiderToDamage(state, false, rng)
  assert.equal(physical.state.actionState, 2)
  assert.ok(physical.state.strafeTicksRemaining >= 40 && physical.state.strafeTicksRemaining <= 80)
  assert.deepEqual(reactNativeSpiderToDamage(state, true, rng), { state, rngState: rng })
})
