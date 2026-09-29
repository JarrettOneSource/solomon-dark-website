import assert from 'node:assert/strict'
import test from 'node:test'
import { boneyardEnemyEvents } from '../protocol/codecs/enemy-effects.ts'
import type { BoneyardEnemyEventSnapshot } from '../protocol/game-state.ts'
import type { NativeSecondaryEventState } from '../core-kernels/native-secondary-abilities.ts'
import type { NativeScreenFlashState, NativeScreenFlashWrite } from '../core-kernels/native-screen-flash.ts'
import { NativeSecondaryScreenFeedbackPresentation } from './native-screen-feedback.ts'

const context = { cameraCenter: { x: 0, y: 0 }, localPlayerAlternate: false, visibleWorldWidth: 1000 }

const crow: BoneyardEnemyEventSnapshot = { actorId: 1, eventId: 4, runId: 'bosses', tick: 10,
  sourcePosition: { x: 0, y: 0 }, type: 'enemy-screen-flash', screenFlash: {
    alpha: 1, red: 0, green: 0, blue: 0, decayPerTick: Math.fround(.1), pointAttenuated: false,
  } }

function consumeEnemyFlash(lane: NativeSecondaryScreenFeedbackPresentation,
  event: BoneyardEnemyEventSnapshot): void {
  lane.consumeEnemy(event, context)
  if (event.screenFlash) lane.consumeScreenFlashes({ epoch: 0, nextOrder: event.eventId + 1, writes: [{
    order: event.eventId, tick: event.tick, worldKey: `boneyard:${event.runId}`,
    position: event.sourcePosition ?? { x: 0, y: 0 }, flash: event.screenFlash,
    onlyIfClear: event.screenFlashOnlyIfClear ?? false,
  }] }, context)
}
function consumeRing(lane: NativeSecondaryScreenFeedbackPresentation): void {
  lane.consume(ring, context)
  lane.consumeScreenFlashes({ epoch: 0, nextOrder: 2, writes: [{ order: 1, tick: ring.tick, worldKey: ring.worldKey,
    position: ring.position, flash: ring.screenFlash!, onlyIfClear: false }] }, context)
}

const ring: NativeSecondaryEventState = {
  actorId: null, cameraDisplacement: null, cameraMagnitude: 0, cue: null,
  eventId: 1, gain: 1, kind: 'pulse', ownerId: 'player', pitch: 1,
  position: { x: 0, y: 0 }, skillId: 35, tick: 100, worldKey: 'boneyard:bosses',
  screenFlash: { alpha: 1, red: Math.fround(.9), green: 1, blue: 1,
    decayPerTick: Math.fround(.01), pointAttenuated: true },
}

test('later shared flash wins identically across one batch, split delivery and reversed lanes', () => {
  const black = { ...crow, tick: 101, screenFlash: { ...crow.screenFlash!, decayPerTick: Math.fround(.01) } }
  const together = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
  consumeEnemyFlash(together, black)
  consumeRing(together)
  const split = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
  consumeRing(split)
  split.sample(100)
  consumeEnemyFlash(split, black)
  assert.deepEqual(together.sample(105), { alpha: .9600000381469727, color: 0 })
  assert.deepEqual(together.sample(105), split.sample(105))
})

test('future shared flash waits for the presentation tick, including a paused clock', () => {
  const feedback = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
  consumeRing(feedback)
  assert.equal(feedback.sample(98), null)
  assert.equal(feedback.sample(99.9), null)
  assert.deepEqual(feedback.sample(100), { alpha: 1, color: 15073279 })
})

function flashState(writes: readonly NativeScreenFlashWrite[], epoch = 0): NativeScreenFlashState {
  return { epoch, nextOrder: Math.max(0, ...writes.map(write => write.order)) + 1, writes }
}

const cyanWrite: NativeScreenFlashWrite = { order: 1, tick: 100, worldKey: ring.worldKey,
  position: ring.position, flash: ring.screenFlash!, onlyIfClear: false }
const blackWrite: NativeScreenFlashWrite = { ...cyanWrite, order: 2,
  flash: { ...cyanWrite.flash, red: 0, green: 0, blue: 0 } }

test('same-tick flashes use authority execution order regardless of intake order or family IDs', () => {
  for (const writes of [[blackWrite, cyanWrite], [cyanWrite, blackWrite]]) {
    const lane = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
    for (const write of writes) lane.consumeScreenFlashes(flashState([write]), context)
    assert.deepEqual(lane.sample(100), { alpha: 1, color: 0 })
  }
  const reverseAuthority = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
  reverseAuthority.consumeScreenFlashes(flashState([
    { ...blackWrite, order: 1 }, { ...cyanWrite, order: 2 },
  ]), context)
  assert.deepEqual(reverseAuthority.sample(100), { alpha: 1, color: 15073279 })
})

test('late old and repeated writes cannot resurrect after a newer overwrite expires', () => {
  const lane = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
  const short = { ...blackWrite, tick: 101, flash: { ...blackWrite.flash, decayPerTick: 1 } }
  lane.consumeScreenFlashes(flashState([short]), context)
  assert.equal(lane.sample(102), null)
  lane.consumeScreenFlashes(flashState([cyanWrite, short]), context)
  assert.equal(lane.sample(103), null)
})

test('conditional flashes inspect the chronological shared lane across regrouped delivery', () => {
  const green = { ...blackWrite, tick: 101, onlyIfClear: true,
    flash: { ...blackWrite.flash, red: .25, green: 1, blue: .25 } }
  for (const batches of [[[green, cyanWrite]], [[green], [cyanWrite]], [[cyanWrite], [green]]]) {
    const lane = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
    for (const writes of batches) lane.consumeScreenFlashes(flashState(writes), context)
    assert.deepEqual(lane.sample(105), { alpha: .9500000476837158, color: 15073279 })
  }
  const clear = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
  clear.consumeScreenFlashes(flashState([{ ...cyanWrite, flash: { ...cyanWrite.flash, decayPerTick: 1 } }, green]), context)
  assert.deepEqual(clear.sample(101), { alpha: 1, color: 0x40ff40 })
})

test('late history still resolves a conditional attempt after its provisional fade expires', () => {
  const green = { ...blackWrite, tick: 101, onlyIfClear: true,
    flash: { ...blackWrite.flash, alpha: .75, decayPerTick: Math.fround(.1), red: .25, green: 1, blue: .25 } }
  const together = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
  together.consumeScreenFlashes(flashState([cyanWrite, green]), context)
  const late = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
  late.consumeScreenFlashes(flashState([green]), context)
  assert.equal(late.sample(109), null)
  late.consumeScreenFlashes(flashState([cyanWrite, green]), context)
  assert.deepEqual(late.sample(110), together.sample(110))
  assert.deepEqual(late.sample(110), { alpha: .9000000953674316, color: 15073279 })
})

test('observer gain is sampled at eligibility and held during exact float32 aging', () => {
  const lane = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
  const state = flashState([cyanWrite])
  lane.consumeScreenFlashes(state, { ...context, cameraCenter: { x: 1100, y: 0 } })
  assert.equal(lane.sample(98), null)
  lane.consumeScreenFlashes(state, context)
  assert.deepEqual(lane.sample(100), { alpha: 1, color: 15073279 })
  lane.consumeScreenFlashes(state, { ...context, cameraCenter: { x: 1100, y: 0 } })
  assert.deepEqual(lane.sample(105), { alpha: .9500000476837158, color: 15073279 })
})

test('reset epochs clear the same world lane and reject stale previous-world deliveries', () => {
  const lane = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
  lane.consumeScreenFlashes(flashState([cyanWrite]), context)
  assert.ok(lane.sample(100))
  lane.consumeScreenFlashes({ epoch: 1, nextOrder: 2, writes: [] }, context)
  assert.equal(lane.sample(100), null)
  lane.consumeScreenFlashes(flashState([cyanWrite]), context)
  assert.equal(lane.sample(101), null)
  lane.consumeScreenFlashes(flashState([{ ...blackWrite, tick: 102 }], 1), context)
  assert.deepEqual(lane.sample(102), { alpha: 1, color: 0 })
})

test('a zero-gain newer write clears the preceding observer flash instead of revealing it', () => {
  const lane = new NativeSecondaryScreenFeedbackPresentation(98, ring.worldKey)
  lane.consumeScreenFlashes(flashState([cyanWrite]), context)
  assert.ok(lane.sample(100))
  const distant = { ...blackWrite, tick: 101, position: { x: 1100, y: 0 } }
  lane.consumeScreenFlashes(flashState([distant]), context)
  assert.equal(lane.sample(101), null)
  lane.consumeScreenFlashes(flashState([cyanWrite, distant]), context)
  assert.equal(lane.sample(102), null)
})

test('Crow strike writes the shared black flash and expires on ten native ticks', () => {
  const feedback = new NativeSecondaryScreenFeedbackPresentation(0, 'boneyard:bosses')
  consumeEnemyFlash(feedback, crow)
  assert.deepEqual(feedback.sample(10), { alpha: 1, color: 0 })
  assert.ok(Math.abs(feedback.sample(15)!.alpha - .5) < .000001)
  consumeEnemyFlash(feedback, crow)
  assert.equal(feedback.sample(20), null)
})

test('late enemy flashes decay before display and never replay into another world', () => {
  const feedback = new NativeSecondaryScreenFeedbackPresentation(15, 'boneyard:bosses')
  consumeEnemyFlash(feedback, crow)
  assert.ok(Math.abs(feedback.sample(15)!.alpha - .5) < .000001)
  consumeEnemyFlash(feedback, { ...crow, eventId: 5, runId: 'other', tick: 15 })
  assert.equal(feedback.sample(20), null)
})


test('boss impact flashes attenuate at the camera while Crow flashes remain global', () => {
  const feedback = new NativeSecondaryScreenFeedbackPresentation(0, 'boneyard:bosses')
  consumeEnemyFlash(feedback, { ...crow, sourcePosition: { x: 1100, y: 0 },
    screenFlash: { ...crow.screenFlash!, pointAttenuated: true } })
  assert.equal(feedback.sample(10), null)
  consumeEnemyFlash(feedback, { ...crow, eventId: 5, sourcePosition: { x: 1100, y: 0 } })
  assert.deepEqual(feedback.sample(10), { alpha: 1, color: 0 })
})

test('boss shakes use the proper point-gain family and share strict maximum arbitration with primary feedback', () => {
  for (const [attenuation, expected] of [['fixed', 4], ['point', 4 * (800 / 850)], ['hit', 2], ['hit-squared', 1]] as const) {
    const feedback = new NativeSecondaryScreenFeedbackPresentation(0, 'boneyard:bosses')
    const event: BoneyardEnemyEventSnapshot = { actorId: 1, eventId: 1, runId: 'bosses', tick: 10,
      type: 'enemy-camera-shake', sourcePosition: { x: 300, y: 0 },
      cameraShake: { attenuation, displacement: { x: 4, y: 0 } } }
    const wire = boneyardEnemyEvents(JSON.parse(JSON.stringify([event])), 'events', 'bosses', 10)
    assert.deepEqual(wire, [event])
    consumeEnemyFlash(feedback, event)
    assert.ok(Math.abs(feedback.sampleCameraDisplacement(10).x - expected) < .000001)
  }
  const feedback = new NativeSecondaryScreenFeedbackPresentation(0, 'boneyard:bosses')
  feedback.consumePrimaryCameraDisplacement({ eventId: 1, tick: 10, worldKey: 'boneyard:bosses', displacement: { x: 3, y: 4 } })
  consumeEnemyFlash(feedback, { actorId: 1, eventId: 1, runId: 'bosses', tick: 10, type: 'enemy-camera-shake',
    sourcePosition: { x: 0, y: 0 }, cameraShake: { attenuation: 'fixed', displacement: { x: -5, y: 0 } } })
  assert.deepEqual(feedback.sampleCameraDisplacement(10), { x: 3, y: 4 })
  consumeEnemyFlash(feedback, { actorId: 1, eventId: 2, runId: 'bosses', tick: 10, type: 'enemy-camera-shake',
    sourcePosition: { x: 0, y: 0 }, cameraShake: { attenuation: 'fixed', displacement: { x: -6, y: 0 } } })
  assert.deepEqual(feedback.sampleCameraDisplacement(10), { x: -6, y: 0 })
  assert.deepEqual(feedback.sampleCameraDisplacement(11), { x: -4.5, y: 0 })
})
