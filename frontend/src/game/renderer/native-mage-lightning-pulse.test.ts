import assert from 'node:assert/strict'
import test from 'node:test'

import { Container, Texture } from 'pixi.js'

import {
  NATIVE_MAGE_LIGHTNING_BODY_TICKS,
  NATIVE_MAGE_LIGHTNING_CONTACT_SCALE_JITTER,
  NATIVE_MAGE_LIGHTNING_SOURCE_GLOW_TICKS,
  NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_ALPHAS,
  NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_BASE_SCALE,
  NATIVE_MAGE_LIGHTNING_WORLD_CONTACT_ALPHAS,
  NATIVE_MAGE_LIGHTNING_WORLD_CONTACT_BASE_SCALE,
  nativeMageLightningPulsePlan,
  type NativeMageLightningPulseInput,
} from './native-mage-lightning-pulse-presentation.ts'
import {
  NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_OFFSET,
  NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_SPAN,
  NativeMageLightningPulseView,
  NativeMageLightningPulseViews,
  nativeMageLightningTargetContactDepths,
} from './native-mage-lightning-pulse-view.ts'
import {
  AIR_LIGHTNING_BRANCH_RECORDS,
  AIR_LIGHTNING_CORONA_CIRCLE_RECORD,
  AIR_LIGHTNING_CORONA_FORK_RECORDS,
} from './primary-spell-air-native.ts'

const WORLD_PULSE = {
  contact: {
    kind: 'world',
    position: { x: 660, y: 17 },
  },
  endpoint: { x: 650, y: 10 },
  midpoint: { x: 350, y: 10 },
  seed: 71,
  source: { x: 0, y: 10 },
  tick: 400,
} as const satisfies NativeMageLightningPulseInput

const TARGET_PULSE = {
  contact: {
    kind: 'target-attached',
    localOffset: { x: -7, y: -23 },
    targetPlayerId: 'wizard-two',
  },
  endpoint: { x: 642, y: 22 },
  midpoint: { x: 340, y: 8 },
  seed: 72,
  source: { x: 5, y: 12 },
  tick: 500,
} as const satisfies NativeMageLightningPulseInput

const AIR_TEXTURES = {
  branches: [Texture.EMPTY, Texture.EMPTY],
  circle: Texture.EMPTY,
  forks: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY],
  ribbon: Texture.EMPTY,
} as const

test('Mage world pulse reuses the Air factory but owns its five-age contact fade', () => {
  assert.equal(NATIVE_MAGE_LIGHTNING_BODY_TICKS, 2)
  assert.equal(NATIVE_MAGE_LIGHTNING_SOURCE_GLOW_TICKS, 1)
  assert.deepEqual(NATIVE_MAGE_LIGHTNING_WORLD_CONTACT_ALPHAS, [1, 0.8, 0.6, 0.4, 0.2])
  assert.deepEqual(AIR_LIGHTNING_BRANCH_RECORDS, [375, 376])
  assert.equal(AIR_LIGHTNING_CORONA_CIRCLE_RECORD, 110)
  assert.deepEqual(AIR_LIGHTNING_CORONA_FORK_RECORDS, [1836, 1837, 1838, 1839])

  const ages = NATIVE_MAGE_LIGHTNING_WORLD_CONTACT_ALPHAS.map((_, age) => (
    nativeMageLightningPulsePlan(WORLD_PULSE, WORLD_PULSE.tick + age)!
  ))
  assert.deepEqual(ages.map(({ body }) => body !== null), [true, true, false, false, false])
  assert.deepEqual(
    ages.map(({ sourceCorona }) => sourceCorona !== null),
    [true, false, false, false, false],
  )
  assert.deepEqual(
    ages[0].body?.layers.map(({ textureRecord }) => textureRecord),
    [44, 44],
  )
  const finalPair = ages[0].body!.layers[0].vertices.slice(-4)
  assert.ok(Math.abs(
    WORLD_PULSE.source.x + (finalPair[0] + finalPair[2]) / 2 - WORLD_PULSE.endpoint.x,
  ) < 0.0001)
  assert.ok(Math.abs(
    WORLD_PULSE.source.y + (finalPair[1] + finalPair[3]) / 2 - WORLD_PULSE.endpoint.y,
  ) < 0.0001)
  assert.notDeepEqual(WORLD_PULSE.endpoint, WORLD_PULSE.contact.position)
  assert.deepEqual(
    ages.map(({ contact }) => contact.corona.alpha),
    NATIVE_MAGE_LIGHTNING_WORLD_CONTACT_ALPHAS,
  )
  assert.deepEqual(
    ages.map(({ contact }) => contact.corona.center),
    Array.from({ length: 5 }, () => WORLD_PULSE.contact.position),
  )
  const sampledScale = ages[0].contact.corona.forks[1].scale
  assert.ok(sampledScale >= NATIVE_MAGE_LIGHTNING_WORLD_CONTACT_BASE_SCALE)
  assert.ok(sampledScale <= (
    NATIVE_MAGE_LIGHTNING_WORLD_CONTACT_BASE_SCALE
      + NATIVE_MAGE_LIGHTNING_CONTACT_SCALE_JITTER
  ))
  assert.ok(ages.every(({ contact }) => contact.corona.forks[1].scale === sampledScale))
  assert.ok(ages[0].pathLights.length > 0)
  assert.ok(ages[0].pathLights.every(({ castsDirectionalShadow }) => castsDirectionalShadow))
  assert.deepEqual(ages.slice(1).map(({ pathLights }) => pathLights.length), [0, 0, 0, 0])
  assert.equal('contactLight' in ages[0], false)
  assert.equal(nativeMageLightningPulsePlan(WORLD_PULSE, WORLD_PULSE.tick + 5), null)
})

test('Mage target contact stays local to its actor and uses the separate three-age law', () => {
  assert.deepEqual(NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_ALPHAS, [1, 0.6, 0.2])
  const ages = NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_ALPHAS.map((_, age) => (
    nativeMageLightningPulsePlan(TARGET_PULSE, TARGET_PULSE.tick + age)!
  ))

  assert.deepEqual(ages.map(({ contact }) => contact.corona.alpha), [1, 0.6, 0.2])
  for (const { contact, endpoint } of ages) {
    assert.equal(contact.kind, 'target-attached')
    if (contact.kind !== 'target-attached') continue
    assert.equal(contact.targetPlayerId, 'wizard-two')
    assert.deepEqual(contact.localOffset, { x: -7, y: -23 })
    assert.deepEqual(contact.corona.center, { x: -7, y: -23 })
    assert.deepEqual(endpoint, TARGET_PULSE.endpoint)
  }
  const sampledScale = ages[0].contact.corona.forks[1].scale
  assert.ok(sampledScale >= NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_BASE_SCALE)
  assert.ok(sampledScale <= (
    NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_BASE_SCALE
      + NATIVE_MAGE_LIGHTNING_CONTACT_SCALE_JITTER
  ))
  assert.equal(nativeMageLightningPulsePlan(TARGET_PULSE, TARGET_PULSE.tick + 3), null)
})

test('Mage pulse view exposes independent painter roots and target attachment ownership', () => {
  const world = new NativeMageLightningPulseView(WORLD_PULSE, AIR_TEXTURES)
  assert.equal(new Set(world.containers).size, 3)
  assert.ok(world.containers.every(({ parent }) => parent === null))
  assert.deepEqual(world.painterRoots().map(({ suffix }) => suffix), [
    'body',
    'source',
    'contact',
  ])
  assert.deepEqual(
    world.painterRoots().map(({ worldY }) => worldY),
    [WORLD_PULSE.midpoint.y, WORLD_PULSE.source.y, WORLD_PULSE.contact.position.y],
  )
  assert.equal(world.targetAttachment(), null)
  assert.equal(world.worldContainers.length, 3)
  assert.ok(world.pathLights.length > 0)

  world.update(WORLD_PULSE.tick + 1)
  assert.deepEqual(world.painterRoots().map(({ suffix }) => suffix), ['body', 'contact'])
  assert.equal(world.pathLights.length, 0)
  world.update(WORLD_PULSE.tick + 2)
  assert.deepEqual(world.painterRoots().map(({ suffix }) => suffix), ['contact'])
  assert.equal(world.update(WORLD_PULSE.tick + 5), false)
  assert.deepEqual(world.painterRoots(), [])
  world.destroy()

  const target = new NativeMageLightningPulseView(TARGET_PULSE, AIR_TEXTURES)
  assert.equal(target.worldContainers.length, 3)
  assert.deepEqual(target.painterRoots().map(({ suffix }) => suffix), ['body', 'source'])
  const attachment = target.targetAttachment()
  assert.ok(attachment)
  assert.equal(attachment.targetPlayerId, 'wizard-two')
  assert.ok(target.worldContainers.includes(attachment.container))
  assert.deepEqual(
    { x: attachment.container.position.x, y: attachment.container.position.y },
    TARGET_PULSE.contact.localOffset,
  )
  target.destroy()
})

test('Mage pulse collection preserves independent world roots, target ownership, and birth-only Misc lights', () => {
  const root = new Container()
  const views = new NativeMageLightningPulseViews(root, AIR_TEXTURES)
  const world = { ...WORLD_PULSE, id: 11, ownerActorId: 101 }
  const target = { ...TARGET_PULSE, id: 12, ownerActorId: 102, tick: WORLD_PULSE.tick }
  const playerPosition = (playerId: string) => (
    playerId === 'wizard-two' ? { x: 900, y: 700 } : null
  )

  views.update([world, target], WORLD_PULSE.tick, playerPosition)
  assert.equal(views.size, 2)
  assert.equal(root.children.length, 6)
  assert.deepEqual(views.painterLayers().map(({ id }) => id), [
    'mage-lightning:11:body',
    'mage-lightning:11:source',
    'mage-lightning:11:contact',
    'mage-lightning:12:body',
    'mage-lightning:12:source',
    'mage-lightning:12:contact',
  ])
  const targetContact = views.painterLayers().at(-1)!
  assert.equal(targetContact.lane, 'post-main-overlay')
  assert.equal(targetContact.queueFamily, null)
  assert.equal(targetContact.pulseId, 12)
  assert.equal(targetContact.pulseTick, WORLD_PULSE.tick)
  assert.equal(targetContact.targetPlayerId, 'wizard-two')
  assert.deepEqual(
    { x: targetContact.container.x, y: targetContact.container.y },
    { x: 893, y: 677 },
  )
  assert.ok(views.pathLights.length > 0)
  assert.deepEqual(
    views.pathLightBatches.map(({ birthTick, id, ownerActorId }) => ({
      birthTick,
      id,
      ownerActorId,
    })),
    [
      { birthTick: WORLD_PULSE.tick, id: 11, ownerActorId: 101 },
      { birthTick: WORLD_PULSE.tick, id: 12, ownerActorId: 102 },
    ],
  )
  views.setRenderable(false)
  assert.ok(root.children.every((container) => !container.renderable))
  views.setRenderable(true)
  assert.ok(root.children.every((container) => container.renderable))

  views.update([world, target], WORLD_PULSE.tick + 1, playerPosition)
  assert.deepEqual(views.painterLayers().map(({ suffix }) => suffix), [
    'body',
    'contact',
    'body',
    'contact',
  ])
  assert.equal(views.pathLights.length, 0)
  assert.deepEqual(views.pathLightBatches, [])

  views.update([world, target], WORLD_PULSE.tick + 3, playerPosition)
  assert.equal(views.size, 1)
  assert.deepEqual(views.painterLayers().map(({ suffix }) => suffix), ['contact'])

  views.update(
    [{ ...world, id: 13, tick: WORLD_PULSE.tick + 10 }],
    WORLD_PULSE.tick + 4,
    playerPosition,
  )
  assert.equal(views.size, 0)
  assert.equal(root.children.length, 0)
  views.destroy()
  root.destroy()
})

test('Mage target contacts occupy the native post-main band in player-slot then birth order', () => {
  const root = new Container()
  const views = new NativeMageLightningPulseViews(root, AIR_TEXTURES)
  const pulses = [
    {
      ...TARGET_PULSE,
      id: 31,
      ownerActorId: 201,
      tick: 501,
    },
    {
      ...TARGET_PULSE,
      contact: {
        ...TARGET_PULSE.contact,
        targetPlayerId: 'wizard-one',
      },
      id: 32,
      ownerActorId: 202,
      tick: 500,
    },
    {
      ...TARGET_PULSE,
      id: 30,
      ownerActorId: 203,
      tick: 500,
    },
  ] as const
  views.update(pulses, 501, () => ({ x: 0, y: 0 }))
  const layers = views.painterLayers()
  const foregroundZIndex = 100
  const depths = nativeMageLightningTargetContactDepths(
    layers,
    ['wizard-two', 'wizard-one'],
    foregroundZIndex,
  )

  assert.equal(NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_OFFSET, 0.25)
  assert.equal(NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_Z_SPAN, 0.125)
  const orderedIds = [...depths.entries()]
    .toSorted((first, second) => first[1] - second[1])
    .map(([id]) => id)
  assert.deepEqual(orderedIds, [
    'mage-lightning:30:contact',
    'mage-lightning:31:contact',
    'mage-lightning:32:contact',
  ])
  assert.equal(depths.get('mage-lightning:30:contact'), foregroundZIndex + 0.25)
  assert.equal(depths.get('mage-lightning:32:contact'), foregroundZIndex + 0.375)
  assert.ok([...depths.values()].every((depth) => (
    depth > foregroundZIndex && depth < foregroundZIndex + 0.5
  )))

  views.destroy()
  root.destroy()
})
