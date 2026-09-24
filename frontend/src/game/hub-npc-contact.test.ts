import assert from 'node:assert/strict'
import test from 'node:test'

import { createHubNpcContactState, stepHubNpcContact } from './hub-npc-contact.ts'
import { HUB_INTERACTION_GEOMETRY, HUB_INTERACTION_IDS } from './hub-inventory-presentation.ts'
import { PLAYER_CHARACTER_RADIUS } from './core-kernels/player-character.ts'
import { NATIVE_ACTOR_SEPARATION_EPSILON } from './core-kernels/actor-physics.ts'

const polisher = {
  availability: { skorchaPosition: null, storyOffice: true },
  enabled: true,
  movement: { x: -1, y: 0 },
  position: { x: 606.1, y: 735 },
  region: 'office' as const,
  tick: 0,
}

test('every named NPC uses six native contact ticks, not six render frames', () => {
  for (const id of HUB_INTERACTION_IDS.filter(id => !id.startsWith('painting-'))) {
    const geometry = HUB_INTERACTION_GEOMETRY[id]
    const state = createHubNpcContactState()
    const sample = {
      ...polisher,
      availability: { skorchaPosition: id === 'skorcha' ? geometry.position : null, storyOffice: true },
      region: geometry.region,
      position: { x: geometry.position.x + geometry.radius + PLAYER_CHARACTER_RADIUS + NATIVE_ACTOR_SEPARATION_EPSILON, y: geometry.position.y },
    }
    for (let tick = 10; tick < 15; tick += 1) {
      assert.equal(stepHubNpcContact(state, { ...sample, tick }), null, id)
      assert.equal(stepHubNpcContact(state, { ...sample, tick }), null, 'same tick cannot count twice')
    }
    assert.equal(stepHubNpcContact(state, { ...sample, tick: 15 }), id)
  }
})

test('contact admission latches through Done and rearms only after native range exit', () => {
  const state = createHubNpcContactState()
  stepHubNpcContact(state, polisher)
  assert.equal(stepHubNpcContact(state, { ...polisher, tick: 5 }), 'polisher')
  assert.equal(stepHubNpcContact(state, { ...polisher, tick: 50 }), null)
  assert.equal(stepHubNpcContact(state, { ...polisher, movement: { x: 0, y: 0 }, tick: 60 }), null)
  assert.equal(stepHubNpcContact(state, { ...polisher, tick: 70 }), null)
  stepHubNpcContact(state, { ...polisher, position: { x: 650, y: 735 }, tick: 80 })
  assert.equal(state.engaged.has('polisher'), false)
  stepHubNpcContact(state, { ...polisher, tick: 90 })
  assert.equal(stepHubNpcContact(state, { ...polisher, tick: 95 }), 'polisher')
})

test('ordinary Office, outside contact radius, sideways/backwards and idle never start Polisher Chat', () => {
  for (const change of [
    { availability: { skorchaPosition: null, storyOffice: false } },
    { position: { x: 607, y: 735 } },
    { movement: { x: 1, y: 0 } },
    { movement: { x: 0, y: 1 } },
    { movement: { x: 0, y: 0 } },
    { enabled: false },
  ]) {
    const state = createHubNpcContactState()
    for (let tick = 0; tick < 20; tick += 1) {
      assert.equal(stepHubNpcContact(state, { ...polisher, ...change, tick }), null)
    }
  }
})

test('modal interruption resets dwell and separate players do not share engagement', () => {
  const first = createHubNpcContactState()
  const second = createHubNpcContactState()
  stepHubNpcContact(first, polisher)
  stepHubNpcContact(first, { ...polisher, tick: 4 })
  stepHubNpcContact(first, { ...polisher, enabled: false, tick: 5 })
  assert.equal(stepHubNpcContact(first, { ...polisher, tick: 6 }), null)
  assert.equal(stepHubNpcContact(first, { ...polisher, tick: 11 }), 'polisher')
  assert.equal(second.engaged.size, 0)
  stepHubNpcContact(first, { ...polisher, region: 'courtyard', tick: 12 })
  assert.equal(first.engaged.size, 0)
})

test('native float32 facing cutoff is strictly greater than 0.7', () => {
  for (const alignment of [0.69999, 0.7, 0.70001]) {
    const state = createHubNpcContactState()
    const movement = { x: -alignment, y: Math.sqrt(1 - alignment * alignment) }
    let opened = null
    for (let tick = 0; tick < 6; tick += 1) {
      opened = stepHubNpcContact(state, { ...polisher, movement, tick })
    }
    assert.equal(opened, alignment > 0.7 ? 'polisher' : null)
  }
})
