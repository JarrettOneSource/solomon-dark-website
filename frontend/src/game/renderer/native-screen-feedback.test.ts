import assert from 'node:assert/strict'
import test from 'node:test'
import { boneyardEnemyEvents } from '../protocol/codecs/enemy-effects.ts'
import type { BoneyardEnemyEventSnapshot } from '../protocol/game-state.ts'
import { NativeSecondaryScreenFeedbackPresentation } from './native-screen-feedback.ts'

const context = { cameraCenter: { x: 0, y: 0 }, localPlayerAlternate: false, visibleWorldWidth: 1000 }

const crow: BoneyardEnemyEventSnapshot = { actorId: 1, eventId: 4, runId: 'bosses', tick: 10,
  sourcePosition: { x: 0, y: 0 }, type: 'enemy-screen-flash', screenFlash: {
    alpha: 1, red: 0, green: 0, blue: 0, decayPerTick: Math.fround(.1), pointAttenuated: false,
  } }

test('Crow strike writes the shared black flash and expires on ten native ticks', () => {
  const feedback = new NativeSecondaryScreenFeedbackPresentation(0, 'boneyard:bosses')
  feedback.consumeEnemy(crow, context)
  assert.deepEqual(feedback.sample(10), { alpha: 1, color: 0 })
  assert.ok(Math.abs(feedback.sample(15)!.alpha - .5) < .000001)
  feedback.consumeEnemy(crow, context)
  assert.equal(feedback.sample(20), null)
})

test('late enemy flashes decay before display and never replay into another world', () => {
  const feedback = new NativeSecondaryScreenFeedbackPresentation(15, 'boneyard:bosses')
  feedback.consumeEnemy(crow, context)
  assert.ok(Math.abs(feedback.sample(15)!.alpha - .5) < .000001)
  feedback.consumeEnemy({ ...crow, eventId: 5, runId: 'other', tick: 15 }, context)
  assert.equal(feedback.sample(20), null)
})


test('boss impact flashes attenuate at the camera while Crow flashes remain global', () => {
  const feedback = new NativeSecondaryScreenFeedbackPresentation(0, 'boneyard:bosses')
  feedback.consumeEnemy({ ...crow, sourcePosition: { x: 1100, y: 0 },
    screenFlash: { ...crow.screenFlash!, pointAttenuated: true } }, context)
  assert.equal(feedback.sample(10), null)
  feedback.consumeEnemy({ ...crow, eventId: 5, sourcePosition: { x: 1100, y: 0 } }, context)
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
    feedback.consumeEnemy(event, context)
    assert.ok(Math.abs(feedback.sampleCameraDisplacement(10).x - expected) < .000001)
  }
  const feedback = new NativeSecondaryScreenFeedbackPresentation(0, 'boneyard:bosses')
  feedback.consumePrimaryCameraDisplacement({ eventId: 1, tick: 10, worldKey: 'boneyard:bosses', displacement: { x: 3, y: 4 } })
  feedback.consumeEnemy({ actorId: 1, eventId: 1, runId: 'bosses', tick: 10, type: 'enemy-camera-shake',
    sourcePosition: { x: 0, y: 0 }, cameraShake: { attenuation: 'fixed', displacement: { x: -5, y: 0 } } }, context)
  assert.deepEqual(feedback.sampleCameraDisplacement(10), { x: 3, y: 4 })
  feedback.consumeEnemy({ actorId: 1, eventId: 2, runId: 'bosses', tick: 10, type: 'enemy-camera-shake',
    sourcePosition: { x: 0, y: 0 }, cameraShake: { attenuation: 'fixed', displacement: { x: -6, y: 0 } } }, context)
  assert.deepEqual(feedback.sampleCameraDisplacement(10), { x: -6, y: 0 })
  assert.deepEqual(feedback.sampleCameraDisplacement(11), { x: -4.5, y: 0 })
})
