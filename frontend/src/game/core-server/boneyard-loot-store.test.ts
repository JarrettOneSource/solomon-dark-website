import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeLootItemIds,
  NATIVE_LOOT_OPEN_PLACEMENT,
  nativeLootModifiers,
  type NativeLootDropSpec,
} from '../core-kernels/native-loot.ts'
import {
  advanceNativeRngWords,
  createNativeRng,
  drawNativeInteger,
} from '../core-kernels/native-rng.ts'
import type { BoneyardLootSnapshot } from '../protocol/game-state.ts'
import {
  boneyardLootDescriptor,
  boneyardLootSample,
  materializeBoneyardLoot,
} from '../protocol/boneyard-loot-replication.ts'
import {
  activateBoneyardGoodie,
  createBoneyardLootStore,
  materializeBoneyardEnemyLoot,
  nativeHagathaLastWordLoot,
  removeBoneyardLootActors,
  rollBoneyardLootSeed,
  spawnBoneyardLootSpecs,
  stepBoneyardLootStore as stepBoneyardLootStoreExact,
  type BoneyardLootActor,
  type BoneyardLootParticipant,
} from './boneyard-loot-store.ts'

const stepBoneyardLootStore = (
  source: Parameters<typeof stepBoneyardLootStoreExact>[0],
  context: Omit<Parameters<typeof stepBoneyardLootStoreExact>[1], 'placement'>,
) => stepBoneyardLootStoreExact(source, {
  ...context,
  placement: NATIVE_LOOT_OPEN_PLACEMENT,
})

const FAR: readonly BoneyardLootParticipant[] = [{
  advancedUnlocks: new Array<boolean>(8).fill(false),
  alive: true,
  connected: true,
  headingIndex: 0,
  level: 1,
  modifiers: nativeLootModifiers([]),
  ownedRecipeIndexes: [],
  playerId: 'far',
  position: { x: 10_000, y: 10_000 },
}]

test('the authoritative loot stream owns stable actor seed writes', () => {
  const initial = createBoneyardLootStore('seed-writers')
  const first = rollBoneyardLootSeed(initial)
  const second = rollBoneyardLootSeed(first.store)
  assert.ok(first.seed >= 0 && first.seed < 10_000_000)
  assert.ok(second.seed >= 0 && second.seed < 10_000_000)
  assert.notEqual(first.seed, second.seed)
  assert.notDeepEqual(second.store.sharedRng, initial.sharedRng)
})

test('Last Word selects only ground Gold and Sacks and removes their actor-owned effects', () => {
  const spawned = spawnBoneyardLootSpecs(
    createBoneyardLootStore('last-word'),
    [gold(7), sack(createNativeLootItemIds(1)), bonus(0), orb()],
    1,
  ).store
  const retained = nativeHagathaLastWordLoot(spawned)
  assert.equal(retained.gold, 7)
  assert.equal(retained.items.length, 1)
  assert.equal(retained.actorIds.length, 2)
  const removed = removeBoneyardLootActors(spawned, retained.actorIds)
  assert.deepEqual(removed.actors.map(({ kind }) => kind).sort(), ['bonus', 'orb'])
})

test('successful Item materialization persists the native last-drop arena level', () => {
  const initial = {
    ...createBoneyardLootStore('last-item-level'),
    lastSuccessfulItemLevel: 9,
    sharedRng: createNativeRng(6),
  }
  const result = materializeBoneyardEnemyLoot(initial, {
    actorSeed: 110,
    advancedUnlocks: new Array<boolean>(8).fill(false),
    arena: {
      disableMask: 0,
      itemLevelMaximum: 100,
      itemLevelMinimum: 0,
      level: 10,
      mode: 0,
      specialSuppression: false,
    },
    inventoryHasHealthPotion: false,
    modifiers: nativeLootModifiers([]),
    nearbyMaskTwoCount: 0,
    ownedRecipeIndexes: [],
    participantLevel: 12,
    participantSlot: 0,
    placement: NATIVE_LOOT_OPEN_PLACEMENT,
    policies: { gold: 0, item: 0, orb: 0, potion: 0, powerup: 0, specificItem: 0 },
    position: { x: 10, y: 20 },
    sceneForcesHealthPotion: false,
    tick: 0,
    worldBadguyCount: 1,
    worldHasHealthPotionSack: false,
  })
  assert.equal(result.store.actors.length, 1)
  assert.equal(result.store.actors[0]?.kind, 'sack')
  assert.equal(result.store.actors[0]?.source, 'enemy')
  assert.equal(result.store.actors[0]?.item?.equipmentType, 'robe')
  assert.equal(result.store.actors[0]?.item?.name, 'Channeling Robe')
  assert.equal(result.store.actors[0]?.item?.nativeTypeId, 7006)
  assert.equal(result.store.actors[0]?.item?.recipeIndex, null)
  assert.equal(result.store.lastSuccessfulItemLevel, 10)
})

test('Orb moves exactly 1.5 units, captures strictly, and credits the first canonical participant', () => {
  let store = createBoneyardLootStore('orb')
  store = spawnBoneyardLootSpecs(store, [orb()], 0).store
  let stepped = stepBoneyardLootStore(store, {
    participants: [{ ...FAR[0]!, playerId: 'host', position: { x: 55, y: 0 } }],
    tick: 0,
  })
  assert.equal(stepped.store.actors[0]?.position.x, 1.5)
  assert.equal(stepped.pickups.length, 0)
  const beforePickupRng = stepped.store.sharedRng

  stepped = stepBoneyardLootStore(stepped.store, {
    participants: [
      { ...FAR[0]!, playerId: 'host', position: { x: 20, y: 0 } },
      { ...FAR[0]!, playerId: 'guest', position: { x: 2, y: 0 } },
    ],
    tick: 1,
  })
  assert.equal(stepped.pickups[0]?.playerId, 'host')
  assert.strictEqual(stepped.store.sharedRng, beforePickupRng)
  assert.equal(stepped.events.find(({ sound }) => sound === 'goto-orb')?.playbackRate, 1)
  assert.equal(stepped.store.actors.length, 0)
  assert.deepEqual(
    stepped.store.effects.map(({ blendMode, entry, scale }) => ({ blendMode, entry, scale })),
    [{ blendMode: 'normal', entry: 15, scale: 1.5 }],
  )
})

test('each in-range Orb slot contributes one ordered 1.5-unit move per tick', () => {
  let store = createBoneyardLootStore('orb-multi-slot')
  store = spawnBoneyardLootSpecs(store, [orb()], 0).store
  const stepped = stepBoneyardLootStore(store, {
    participants: [
      { ...FAR[0]!, playerId: 'first', position: { x: 55, y: 0 } },
      { ...FAR[0]!, playerId: 'second', position: { x: 0, y: 55 } },
    ],
    tick: 0,
  })
  const afterFirst = { x: 1.5, y: 0 }
  const delta = { x: -afterFirst.x, y: 55 - afterFirst.y }
  const distance = Math.hypot(delta.x, delta.y)
  assert.deepEqual(stepped.store.actors[0]?.position, {
    x: Math.fround(afterFirst.x + delta.x / distance * 1.5),
    y: Math.fround(afterFirst.y + delta.y / distance * 1.5),
  })
  assert.deepEqual(stepped.pickups, [])
})

test('Telekinesis and Calling independently scale every native pickup consumer', () => {
  const telekinetic = {
    ...FAR[0]!,
    modifiers: nativeLootModifiers([], { goldAmount: 1, orbPull: 1, pickupFactor: 6.25 }),
    playerId: 'telekinetic',
  }
  let store = spawnBoneyardLootSpecs(
    createBoneyardLootStore('telekinesis-orb-boundary'),
    [orb()],
    0,
  ).store
  let stepped = stepBoneyardLootStore(store, {
    participants: [{ ...telekinetic, position: { x: 375, y: 0 } }],
    tick: 0,
  })
  assert.deepEqual(stepped.store.actors[0]?.position, { x: 0, y: 0 })
  stepped = stepBoneyardLootStore(stepped.store, {
    participants: [{ ...telekinetic, position: { x: 374.999, y: 0 } }],
    tick: 1,
  })
  assert.equal(stepped.store.actors[0]?.position.x, 1.5)

  store = spawnBoneyardLootSpecs(
    createBoneyardLootStore('calling-orb-boundary'),
    [orb()],
    0,
  ).store
  const calling = {
    ...telekinetic,
    modifiers: nativeLootModifiers([], { goldAmount: 1, orbPull: 2, pickupFactor: 6.25 }),
  }
  stepped = stepBoneyardLootStore(store, {
    participants: [{ ...calling, position: { x: 749.999, y: 0 } }],
    tick: 0,
  })
  assert.equal(stepped.store.actors[0]?.position.x, 1.5)

  store = spawnBoneyardLootSpecs(
    createBoneyardLootStore('telekinesis-capture-boundary'),
    [orb()],
    0,
  ).store
  stepped = stepBoneyardLootStore(store, {
    participants: [{ ...calling, position: { x: 125, y: 0 } }],
    tick: 0,
  })
  assert.equal(stepped.pickups.length, 0)
  assert.equal(stepped.store.actors[0]?.position.x, 1.5)
  store = spawnBoneyardLootSpecs(
    createBoneyardLootStore('telekinesis-capture-inside'),
    [orb()],
    0,
  ).store
  stepped = stepBoneyardLootStore(store, {
    participants: [{ ...calling, position: { x: 124.999, y: 0 } }],
    tick: 0,
  })
  assert.equal(stepped.pickups[0]?.playerId, 'telekinetic')

  const bonusStore = spawnBoneyardLootSpecs(
    createBoneyardLootStore('telekinesis-bonus'),
    [bonus(2)],
    0,
  ).store
  const bonusStep = stepBoneyardLootStore(bonusStore, {
    participants: [{ ...telekinetic, position: { x: 124.999, y: 0 } }],
    tick: 0,
  })
  assert.equal(bonusStep.pickups[0]?.kind, 'bonus')

  const ids = createNativeLootItemIds(1)
  const sackStore = spawnBoneyardLootSpecs(
    createBoneyardLootStore('telekinesis-sack'),
    [sack(ids)],
    0,
  ).store
  const sackStep = stepBoneyardLootStore(sackStore, {
    participants: [{ ...telekinetic, position: { x: 187.499, y: 0 } }],
    tick: 0,
  })
  assert.equal(sackStep.pickups[0]?.kind, 'sack')

  let seed = 0
  while (drawNativeInteger(createNativeRng(seed), 15).value !== 1) seed += 1
  const gateRng = createNativeRng(seed)
  const goldSpawn = spawnBoneyardLootSpecs(
    createBoneyardLootStore('telekinesis-gold'),
    [gold(3)],
    0,
  ).store
  const goldStore = {
    ...goldSpawn,
    actors: goldSpawn.actors.map((actor) => ({ ...actor, scatterActive: false })),
    sharedRng: gateRng,
  }
  const goldStep = stepBoneyardLootStore(goldStore, {
    participants: [{ ...telekinetic, position: { x: 187.499, y: 0 } }],
    tick: 0,
  })
  assert.equal(goldStep.pickups[0]?.kind, 'gold')
  assert.deepEqual(goldStep.store.sharedRng, advanceNativeRngWords(gateRng, 3))
})

test('Orb, Gold, Sack, and Bonus use strict stock pickup boundaries', () => {
  let orbStore = spawnBoneyardLootSpecs(createBoneyardLootStore('orb-boundary'), [orb()], 0).store
  let orbStep = stepBoneyardLootStore(orbStore, {
    participants: [{ ...FAR[0]!, position: { x: 75, y: 0 } }],
    tick: 0,
  })
  assert.deepEqual(orbStep.store.actors[0]?.position, { x: 0, y: 0 })
  orbStore = orbStep.store
  orbStep = stepBoneyardLootStore(orbStore, {
    participants: [{ ...FAR[0]!, position: { x: 74.999, y: 0 } }],
    tick: 1,
  })
  assert.equal(orbStep.store.actors[0]?.position.x, 1.5)

  let goldStore = spawnBoneyardLootSpecs(createBoneyardLootStore('gold-boundary'), [gold(3)], 0).store
  let goldStep = stepBoneyardLootStore(goldStore, {
    participants: [{ ...FAR[0]!, position: { x: 37.5, y: 0 } }],
    tick: 0,
  })
  assert.equal(goldStep.pickups.length, 0)
  goldStore = goldStep.store
  goldStep = stepBoneyardLootStore(goldStore, {
    participants: [{ ...FAR[0]!, position: { x: 37.499, y: 0 } }],
    tick: 1,
  })
  assert.equal(goldStep.pickups.length, 1)

  const ids = createNativeLootItemIds(1)
  const sack: NativeLootDropSpec = {
    activationDelayTicks: 0,
    id: 1,
    item: {
      equipmentType: null,
      iconRecords: [46],
      id: ids.next(),
      kind: 'health-potion',
      name: 'Health Potion',
      nativeSubtype: 0,
      nativeTypeId: 7001,
      quantity: 1,
      rarity: null,
      recipeIndex: null,
    },
    kind: 'sack',
    nativeTypeId: 2013,
    phase: 0,
    position: { x: 0, y: 0 },
    source: 'script',
  }
  let sackStore = spawnBoneyardLootSpecs(createBoneyardLootStore('sack-boundary'), [sack], 0).store
  let sackStep = stepBoneyardLootStore(sackStore, {
    participants: [{ ...FAR[0]!, position: { x: 37.5, y: 0 } }],
    tick: 0,
  })
  assert.equal(sackStep.pickups.length, 0)
  sackStore = sackStep.store
  sackStep = stepBoneyardLootStore(sackStore, {
    participants: [{ ...FAR[0]!, position: { x: 37.499, y: 0 } }],
    tick: 1,
  })
  assert.equal(sackStep.pickups.length, 1)

  const bonus: NativeLootDropSpec = {
    activationDelayTicks: 0,
    bonusKind: 2,
    id: 1,
    kind: 'bonus',
    nativeTypeId: 2038,
    phase: 0,
    position: { x: 0, y: 0 },
    source: 'script',
  }
  let bonusStore = spawnBoneyardLootSpecs(createBoneyardLootStore('bonus-boundary'), [bonus], 0).store
  let bonusStep = stepBoneyardLootStore(bonusStore, {
    participants: [{ ...FAR[0]!, position: { x: 25, y: 0 } }],
    tick: 0,
  })
  assert.equal(bonusStep.pickups.length, 0)
  bonusStore = bonusStep.store
  bonusStep = stepBoneyardLootStore(bonusStore, {
    participants: [{ ...FAR[0]!, position: { x: 24.999, y: 0 } }],
    tick: 1,
  })
  assert.equal(bonusStep.pickups.length, 1)
})

test('farther first participant beats a nearer peer for Gold by processing order', () => {
  let store = createBoneyardLootStore('first-retirement')
  store = spawnBoneyardLootSpecs(store, [gold(11)], 0).store
  const stepped = stepBoneyardLootStore(store, {
    participants: [
      { ...FAR[0]!, playerId: 'host', position: { x: 18, y: 0 } },
      { ...FAR[0]!, playerId: 'guest', position: { x: 6, y: 0 } },
    ],
    tick: 0,
  })
  assert.equal(stepped.pickups[0]?.playerId, 'host')
  assert.equal(stepped.pickups[0]?.amount, 11)
  assert.deepEqual(
    stepped.store.effects.map(({ blendMode, entry, tint }) => ({ blendMode, entry, tint })),
    [
      { blendMode: 'add', entry: 83, tint: 0xd9ba70 },
      { blendMode: 'add', entry: 83, tint: 0xffffff },
    ],
  )
})

test('Gold retains all seventeen half-unit scatter updates before one settlement cue', () => {
  let store = createBoneyardLootStore('gold-scatter')
  store = spawnBoneyardLootSpecs(store, [gold(8)], 0).store
  let stepped = stepBoneyardLootStore(store, { participants: FAR, tick: 0 })
  stepped = stepBoneyardLootStore(stepped.store, { participants: FAR, tick: 15 })
  assert.equal(stepped.store.actors[0]?.scatterProgress, 8)
  assert.equal(stepped.store.actors[0]?.scatterActive, true)
  assert.equal(stepped.events.some(({ sound }) => sound === 'drop-coins'), false)
  stepped = stepBoneyardLootStore(stepped.store, { participants: FAR, tick: 16 })
  assert.equal(stepped.store.actors[0]?.scatterProgress, 8.5)
  assert.equal(stepped.store.actors[0]?.scatterActive, false)
  assert.equal(stepped.events.filter(({ sound }) => sound === 'drop-coins').length, 1)
})

test('Gold and Sack persist while Bonus retires on exactly actor update 1300 after its fade', () => {
  let store = createBoneyardLootStore('lifetimes')
  const ids = createNativeLootItemIds(100)
  const sack: NativeLootDropSpec = {
    activationDelayTicks: 0,
    id: 2,
    item: {
      equipmentType: null,
      iconRecords: [46],
      id: ids.next(),
      kind: 'health-potion',
      name: 'Health Potion',
      nativeSubtype: 0,
      nativeTypeId: 7001,
      quantity: 1,
      rarity: null,
      recipeIndex: null,
    },
    kind: 'sack',
    nativeTypeId: 2013,
    phase: 0,
    position: { x: 0, y: 0 },
    source: 'script',
  }
  const bonus: NativeLootDropSpec = {
    activationDelayTicks: 0,
    bonusKind: 2,
    id: 3,
    kind: 'bonus',
    nativeTypeId: 2038,
    phase: 0,
    position: { x: 0, y: 0 },
    source: 'script',
  }
  store = spawnBoneyardLootSpecs(store, [gold(8), sack, bonus], 0).store
  const started = stepBoneyardLootStore(store, { participants: FAR, tick: 0 })
  const before = stepBoneyardLootStore(started.store, { participants: FAR, tick: 1_198 })
  assert.deepEqual(before.store.actors.map(({ kind }) => kind), ['gold', 'sack', 'bonus'])
  const fading = stepBoneyardLootStore(before.store, { participants: FAR, tick: 1_199 })
  assert.equal(fading.store.actors.at(-1)?.alpha, Math.fround(1 - Math.fround(0.01)))
  const residue = stepBoneyardLootStore(fading.store, { participants: FAR, tick: 1_298 })
  const residueActor = residue.store.actors.at(-1)!
  assert.equal(residueActor.alpha, 6.705522537231445e-7)
  for (const bonusKind of [0, 1, 2] as const) {
    const snapshot = lootSnapshot({ ...residueActor, bonusKind })
    const sample = boneyardLootSample(snapshot)
    assert.equal(sample[5], 0)
    const reconstructed = materializeBoneyardLoot(
      boneyardLootDescriptor(snapshot),
      sample,
    )
    assert.equal(reconstructed.alpha, 0)
    assert.equal(reconstructed.bonusKind, bonusKind)
  }
  const terminal = stepBoneyardLootStore(residue.store, { participants: FAR, tick: 1_299 })
  assert.deepEqual(terminal.store.actors.map(({ kind }) => kind), ['gold', 'sack'])
})

test('Goodie activation owns exact phases 100/200 and materializes at 250', () => {
  let store = createBoneyardLootStore('goodie', [{
    eid: 'goodie-1',
    position: { x: 100, y: 200 },
    rewardSeed: 0,
    subtype: 0,
  }])
  store = activateBoneyardGoodie(store, 'goodie-1')
  let stepped = stepBoneyardLootStore(store, { participants: FAR, tick: 0 })
  stepped = stepBoneyardLootStore(stepped.store, { participants: FAR, tick: 98 })
  assert.equal(stepped.store.goodies[0]?.phase, 0)
  stepped = stepBoneyardLootStore(stepped.store, { participants: FAR, tick: 99 })
  assert.equal(stepped.store.goodies[0]?.phase, 1)
  assert.equal(stepped.store.effects.length, 22)
  assert.equal(stepped.store.effects[0]?.entry, 52)
  assert.equal(stepped.store.effects[1]?.entry, 15)
  assert.ok(stepped.store.effects.slice(2).every(({ entry }) => entry >= 377 && entry <= 380))
  assert.notDeepEqual(stepped.store.sharedRng, store.sharedRng)
  stepped = stepBoneyardLootStore(stepped.store, { participants: FAR, tick: 199 })
  assert.equal(stepped.store.goodies[0]?.phase, 2)
  stepped = stepBoneyardLootStore(stepped.store, { participants: FAR, tick: 249 })
  assert.equal(stepped.store.goodies[0]?.active, false)
  assert.equal(stepped.store.actors.length, 1)
  assert.equal(stepped.store.actors[0]?.kind, 'sack')
  assert.equal(stepped.store.actors[0]?.item?.nativeTypeId, 7008)
  assert.deepEqual(
    stepped.store.actors[0]?.item?.contents?.map(({ id, nativeSubtype, quantity }) => (
      [id, nativeSubtype, quantity]
    )),
    [[1, 0, 5]],
  )
  assert.equal(stepped.store.nextItemId, 7)
})

test('proximity alone never activates a locked Goodie without an explicit interaction action', () => {
  const source = [{
    eid: 'locked-goodie',
    position: { x: 0, y: -25 },
    rewardSeed: 8,
    subtype: 0,
  }]
  const participant = {
    ...FAR[0]!,
    level: 20,
    playerId: 'host',
    position: { x: 0, y: 0 },
  }
  const store = createBoneyardLootStore('goodie-unlock', source)
  assert.ok(store.nextKeyDropLevel >= 5 && store.nextKeyDropLevel <= 12)
  const stepped = stepBoneyardLootStore(store, { participants: [participant], tick: 0 })
  assert.equal(stepped.store.goodies[0]?.active, false)
  assert.equal(stepped.store.goodies[0]?.timer, 0)
  assert.deepEqual(stepped.events, [])
})

test('the 2047-ID field fails closed without evicting an existing reward', () => {
  let store = createBoneyardLootStore('capacity')
  for (let index = 0; index < 2_047; index += 1) {
    const spawned = spawnBoneyardLootSpecs(store, [gold(1)], 0)
    assert.equal(spawned.rejectedCount, 0)
    store = spawned.store
  }
  const ids = store.actors.map(({ id }) => id)
  const rejected = spawnBoneyardLootSpecs(store, [gold(1)], 0)
  assert.equal(rejected.rejectedCount, 1)
  assert.deepEqual(rejected.store.actors.map(({ id }) => id), ids)
})

function orb(): NativeLootDropSpec {
  return {
    activationDelayTicks: 0,
    id: 1,
    kind: 'orb',
    nativeTypeId: 2011,
    orbKind: 'health',
    phase: 0,
    position: { x: 0, y: 0 },
    source: 'script',
    value: 0.5,
  }
}

function gold(amount: number): NativeLootDropSpec {
  return {
    activationDelayTicks: 0,
    amount,
    id: 1,
    kind: 'gold',
    nativeTypeId: 2012,
    phase: 0,
    position: { x: 0, y: 0 },
    source: 'script',
    tier: amount < 3 ? 0 : amount < 5 ? 1 : amount < 8 ? 2 : 3,
  }
}

function bonus(bonusKind: 0 | 1 | 2): NativeLootDropSpec {
  return {
    activationDelayTicks: 0,
    bonusKind,
    id: 1,
    kind: 'bonus',
    nativeTypeId: 2038,
    phase: 0,
    position: { x: 0, y: 0 },
    source: 'script',
  }
}

function lootSnapshot(actor: BoneyardLootActor): BoneyardLootSnapshot {
  return {
    activationDelayTicks: actor.activationDelayTicks,
    ageTicks: actor.ageTicks,
    alpha: actor.alpha,
    amount: actor.amount,
    animationPhase: actor.animationPhase,
    bonusKind: actor.bonusKind,
    bounceHeight: actor.bounceHeight,
    framePhase: actor.framePhase,
    id: actor.id,
    itemContentId: actor.item?.modContent?.contentId
      ?? actor.item?.modItemContent?.contentId
      ?? null,
    itemNativeSubtype: actor.item?.nativeSubtype ?? null,
    itemNativeTypeId: actor.item?.nativeTypeId ?? null,
    kind: actor.kind,
    nativeTypeId: actor.nativeTypeId,
    orbKind: actor.orbKind,
    orbValue: actor.orbValue,
    painterRegistration: actor.painterRegistration,
    position: { ...actor.position },
    rotationDeg: actor.rotationDeg,
    scatterActive: actor.scatterActive,
    scatterProgress: actor.scatterProgress,
    scatterSeed: actor.scatterSeed,
    source: actor.source,
    spawnTick: actor.spawnTick,
    tier: actor.tier,
  }
}

function sack(ids: ReturnType<typeof createNativeLootItemIds>): NativeLootDropSpec {
  return {
    activationDelayTicks: 0,
    id: 1,
    item: {
      equipmentType: null,
      iconRecords: [46],
      id: ids.next(),
      kind: 'health-potion',
      name: 'Health Potion',
      nativeSubtype: 0,
      nativeTypeId: 7001,
      quantity: 1,
      rarity: null,
      recipeIndex: null,
    },
    kind: 'sack',
    nativeTypeId: 2013,
    phase: 0,
    position: { x: 0, y: 0 },
    source: 'script',
  }
}
