import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createIdlePlayerPrimaryCast,
  createPlayerCharacter,
} from '../core-kernels/player-character.ts'
import {
  PLAYER_DEATH_PRESENTATION_DURATION_TICKS,
  PLAYER_DEATH_PRESENTATION_MAXIMUM_HELD_TICK,
} from '../core-kernels/player-combat.ts'
import { buyFomentiusItem, projectInventoryItems } from '../core-kernels/hub-economy.ts'
import { createNativeRng, drawNativeInteger } from '../core-kernels/native-rng.ts'
import { rollNativeStarterEquipmentAppearance } from '../core-kernels/native-starter-equipment.ts'
import { bindNativeBeltSkill } from '../core-kernels/native-belt.ts'
import {
  playerLightDriveActive,
} from '../core-kernels/player-lighting.ts'
import {
  addPlayerEntity,
  applyPlayerEntitySkillChoice,
  applyPlayerEntityHagathaPurchaseEffects,
  autofillPlayerEntitySkillSelections,
  coldSlowPlayerEntity,
  createPlayerEntityStore,
  creditPlayerEntityLootGold,
  damagePlayerEntity,
  damagePlayerEntityWithResult,
  dazzlePlayerEntity,
  grantPlayerEntityExperience,
  grantPlayerEntityBonusSkillChoice,
  grantPlayerEntitySkillRanks,
  grantPlayerEntityWeldBuild,
  increaseRandomPlayerEntitySkill,
  insertPlayerEntityLootItem,
  migratePlayerStarterEquipmentAppearance,
  playerEntityCanAcceptInput,
  playerEntityCanCast,
  playerEntityDisplayHealth,
  playerEntityMovementScale,
  playerCharacterAt,
  playerEconomyAt,
  playerEntityId,
  playerLightingAt,
  poisonPlayerEntity,
  playerProgressionAt,
  playerSkillBookAt,
  playerSkillDerivedStatsAt,
  playerSkillRuntimeAt,
  playerStatBookAt,
  removePlayerEntity,
  replacePlayerEconomy,
  replacePlayerCharacter,
  replacePlayerLoadout,
  respawnPlayerEntityAt,
  restorePlayerEntityHealth,
  resetPlayerEntitiesForNewRun,
  setPlayerEntitySpectating,
  stepPlayerEntityCombatTick,
  stepPlayerEntityOverlayLightingTick,
  tryDebitPlayerEntityMana,
} from './player-entity-store.ts'

const FIRST = { discipline: 'arcane', displayName: 'First', element: 'ether' } as const
const SECOND = { discipline: 'mind', displayName: 'Second', element: 'water' } as const

test('players occupy aligned dense ECS columns with stable entity IDs', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 1, y: 2 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 3, y: 4 }), 20)
  assert.deepEqual(store.entityIds, [1, 2])
  assert.deepEqual(store.identities.map((identity) => identity.playerId), ['first', 'second'])
  assert.equal(store.configs.length, store.locomotions.length)
  assert.equal(store.economies.length, store.locomotions.length)
  assert.equal(store.lightings.length, store.locomotions.length)
  assert.equal('config' in store.locomotions[0]!, false)
  assert.equal('primaryCast' in store.locomotions[0]!, false)
  assert.equal(store.locomotions.length, store.progressions.length)
  assert.equal(store.primaryCasts.length, store.progressions.length)
  assert.equal(store.progressions.length, store.skillBooks.length)
  assert.equal(store.belts.length, store.skillBooks.length)
  assert.equal(store.skillBooks.length, store.skillRuntimes.length)
  assert.equal(store.skillBooks.length, store.statBooks.length)
  assert.equal(playerEntityId(store, 'second'), 2)
  assert.equal(playerEconomyAt(store, 'first')?.gold, 500)
  assert.deepEqual(playerLightingAt(store, 'second'), {
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    overlayEffectPhase: 0,
  })

  store = damagePlayerEntity(store, 'second', 60, 0)
  assert.equal(playerProgressionAt(store, 'second')?.currentHealth, -10)
  assert.equal(playerEntityDisplayHealth(store, 'second'), 0)

  store = removePlayerEntity(store, 'first')
  assert.deepEqual(store.entityIds, [2])
  assert.equal(playerEntityId(store, 'second'), 2)
  assert.equal(playerCharacterAt(store, 'second')?.config.displayName, 'Second')
  assert.equal(playerProgressionAt(store, 'second')?.lifeState, 'lethal-pending')
  assert.equal(store.nextEntityId, 3)
})

test('post-Game-Over loadout replacement creates fresh skills while preserving durable profile state', () => {
  let store = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 10, y: 20 }),
    10,
  )
  const sourceBook = store.skillBooks[0]!
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  permanentRanks[51] = 2
  effectiveRanks[51] = 2
  const hagathaRuntime = {
    cheatDeathCharges: 2,
    reverieActive: true,
    serendipityActive: true,
  } as const
  const modifiedBook = {
    ...sourceBook,
    effectiveRanks,
    learnedSkillOrder: [...sourceBook.learnedSkillOrder, 51],
    permanentRanks,
  }
  store = {
    ...store,
    belts: [bindNativeBeltSkill(store.belts[0]!, modifiedBook, 51, 0)],
    progressions: [{
      ...store.progressions[0]!,
      experience: 450,
      hagathaRuntime,
      level: 4,
      revision: 19,
    }],
    skillBooks: [modifiedBook],
  }
  const sourceEconomy = store.economies[0]!
  const oldTints = [0x123456, 0x654321] as const
  const economy = {
    ...sourceEconomy,
    equipment: {
      ...sourceEconomy.equipment,
      hat: { ...sourceEconomy.equipment.hat!, iconTints: oldTints },
      robe: { ...sourceEconomy.equipment.robe!, iconTints: oldTints },
    },
    revision: 11,
  }
  store = { ...store, economies: [economy] }
  const nextConfig = {
    discipline: 'body',
    displayName: 'Reborn',
    element: 'air',
  } as const
  const replaced = replacePlayerLoadout(
    store,
    'first',
    createPlayerCharacter(nextConfig, { x: 30, y: 40 }),
    123_456,
    { starterAppearanceOwner: 'air' },
  )
  const appearance = rollNativeStarterEquipmentAppearance(createNativeRng(123_456), 'air')
  assert.deepEqual(replaced.configs[0], nextConfig)
  assert.notStrictEqual(replaced.economies[0], economy)
  assert.equal(replaced.economies[0]!.revision, 12)
  assert.deepEqual(replaced.economies[0]!.equipment.hat?.iconTints, [
    appearance.primaryTint,
    appearance.secondaryTint,
  ])
  assert.deepEqual(
    replaced.economies[0]!.equipment.robe?.iconTints,
    replaced.economies[0]!.equipment.hat?.iconTints,
  )
  assert.strictEqual(replaced.economies[0]!.backpack, economy.backpack)
  assert.strictEqual(replaced.economies[0]!.equipment.weapon, economy.equipment.weapon)
  assert.strictEqual(replaced.economies[0]!.fomentiusStock, economy.fomentiusStock)
  assert.strictEqual(replaced.economies[0]!.npc, economy.npc)
  assert.strictEqual(replaced.economies[0]!.ownedPerkSelectors, economy.ownedPerkSelectors)
  assert.strictEqual(replaced.economies[0]!.storage, economy.storage)
  assert.strictEqual(replaced.economies[0]!.unforgeBonuses, economy.unforgeBonuses)
  assert.equal(replaced.progressions[0]!.level, 1)
  assert.equal(replaced.progressions[0]!.experience, 0)
  assert.equal(replaced.progressions[0]!.offerSeed, 123_456)
  assert.equal(replaced.progressions[0]!.revision, 20)
  assert.deepEqual(replaced.progressions[0]!.hagathaRuntime, hagathaRuntime)
  assert.equal(replaced.skillBooks[0]!.permanentRanks[51], 0)
  assert.equal(replaced.skillBooks[0]!.permanentRanks[24], 1)
  assert.equal(replaced.skillBooks[0]!.permanentRanks[27], 1)
  assert.deepEqual(
    replaced.belts[0],
    [
      { kind: 'skill', skillId: 27 }, null, null,
      { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null, null,
    ],
  )
  assert.equal(replaced.skillRuntimes[0]!.concentrationSkillIdA, null)
  assert.equal(replaced.skillRuntimes[0]!.concentrationSkillIdB, null)
  assert.deepEqual(playerCharacterAt(replaced, 'first')?.position, { x: 30, y: 40 })
})

test('College Create confirmation preserves its one-shot pre-Create clothing colors', () => {
  let store = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 10, y: 20 }),
    10,
  )
  const sourceEconomy = store.economies[0]!
  const collegeTints = [0x456745, 0xffffff] as const
  const collegeEconomy = {
    ...sourceEconomy,
    equipment: {
      ...sourceEconomy.equipment,
      hat: { ...sourceEconomy.equipment.hat!, iconTints: collegeTints },
      robe: { ...sourceEconomy.equipment.robe!, iconTints: collegeTints },
    },
  }
  store = { ...store, economies: [collegeEconomy] }
  const replaced = replacePlayerLoadout(
    store,
    'first',
    createPlayerCharacter({ ...FIRST, element: 'water' }, { x: 30, y: 40 }),
    123_456,
  )
  assert.strictEqual(replaced.economies[0], collegeEconomy)
  assert.deepEqual(replaced.economies[0]!.equipment.hat?.iconTints, collegeTints)
  assert.deepEqual(replaced.economies[0]!.equipment.robe?.iconTints, collegeTints)
  assert.equal(replaced.skillBooks[0]!.primarySkillId, 32)
  assert.deepEqual(replaced.belts[0]![0], { kind: 'skill', skillId: 35 })
})

test('starter repair replaces only an exact superseded vivid Hat and Robe pair', () => {
  const source = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 10, y: 20 }),
    10,
  )
  const economy = source.economies[0]!
  const vividTints = [0xff19ff, 0xffffff] as const
  const vividEconomy = {
    ...economy,
    collegeIntroPending: false,
    equipment: {
      ...economy.equipment,
      hat: { ...economy.equipment.hat!, iconTints: vividTints },
      robe: { ...economy.equipment.robe!, iconTints: vividTints },
    },
    revision: 4,
    tutorialPending: false,
  }
  const vividStore = { ...source, economies: [vividEconomy] }
  const repaired = migratePlayerStarterEquipmentAppearance(vividStore, 'first')
  const appearance = rollNativeStarterEquipmentAppearance(
    createNativeRng(source.progressions[0]!.offerSeed),
    'ether',
  )
  assert.deepEqual(repaired.economies[0]!.equipment.hat?.iconTints, [
    appearance.primaryTint,
    appearance.secondaryTint,
  ])
  assert.deepEqual(
    repaired.economies[0]!.equipment.robe?.iconTints,
    repaired.economies[0]!.equipment.hat?.iconTints,
  )
  assert.equal(repaired.economies[0]!.revision, 5)

  const customTints = [0x123456, 0xffffff] as const
  for (const equipment of [{
    ...vividEconomy.equipment,
    robe: { ...vividEconomy.equipment.robe!, iconTints: customTints },
  }, {
    ...vividEconomy.equipment,
    hat: { ...vividEconomy.equipment.hat!, iconTints: customTints },
    robe: { ...vividEconomy.equipment.robe!, iconTints: customTints },
  }]) {
    const preserved = {
      ...source,
      economies: [{ ...vividEconomy, equipment }],
    }
    assert.strictEqual(
      migratePlayerStarterEquipmentAppearance(preserved, 'first'),
      preserved,
    )
  }
})

test('all fifteen post-Game-Over Create choices build a fresh complete generation', () => {
  const elementRows = {
    air: [2, 24, 27],
    earth: [4, 40, 45],
    ether: [0, 8, 11],
    fire: [1, 16, 21],
    water: [3, 32, 35],
  } as const
  const disciplineRoots = {
    arcane: 7,
    body: 5,
    mind: 6,
  } as const
  let store = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 10, y: 20 }),
    10,
  )
  let generation = 0
  for (const element of ['ether', 'fire', 'air', 'water', 'earth'] as const) {
    const [elementRoot, primarySkillId, secondarySkillId] = elementRows[element]
    for (const discipline of ['arcane', 'body', 'mind'] as const) {
      const disciplineRoot = disciplineRoots[discipline]
      generation += 1
      const offerSeed = 100_000 + generation
      const config = {
        discipline,
        displayName: `Generation ${generation}`,
        element,
      }
      store = replacePlayerLoadout(
        store,
        'first',
        createPlayerCharacter(config, { x: generation, y: generation + 1 }),
        offerSeed,
        { starterAppearanceOwner: element },
      )
      const book = store.skillBooks[0]!
      const progression = store.progressions[0]!
      const runtime = store.skillRuntimes[0]!
      const appearance = rollNativeStarterEquipmentAppearance(createNativeRng(offerSeed), element)
      const learnedRanks = book.permanentRanks.flatMap((rank, skillId) => (
        rank === 0 ? [] : [[skillId, rank] as const]
      ))
      assert.deepEqual(learnedRanks, [
        ...Array.from({ length: 8 }, (_, skillId) => [skillId, 1] as const),
        [primarySkillId, 1],
        [secondarySkillId, 1],
      ])
      assert.equal(book.elementRoot, elementRoot)
      assert.equal(book.disciplineRoot, disciplineRoot)
      assert.equal(book.primarySkillId, primarySkillId)
      assert.deepEqual(store.belts[0], [
        { kind: 'skill', skillId: secondarySkillId }, null, null,
        { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null, null,
      ])
      assert.equal(book.advancedUnlocks.some(Boolean), false)
      assert.equal(progression.level, 1)
      assert.equal(progression.experience, 0)
      assert.equal(progression.pendingOffer, null)
      assert.deepEqual(progression.pendingLevels, [])
      assert.equal(runtime.concentrationSkillIdA, null)
      assert.equal(runtime.concentrationSkillIdB, null)
      assert.deepEqual(store.economies[0]!.equipment.hat?.iconTints, [
        appearance.primaryTint,
        appearance.secondaryTint,
      ])
      assert.deepEqual(
        store.economies[0]!.equipment.robe?.iconTints,
        store.economies[0]!.equipment.hat?.iconTints,
      )
    }
  }
})

test('learned primary effects follow the selected pure row, not creation element or Weld', () => {
  let store = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 0, y: 0 }),
    10,
  )
  store = {
    ...store,
    primaryCasts: [{
      ...createIdlePlayerPrimaryCast(),
      channelActive: true,
      underpowered: false,
    }],
    skillBooks: [{ ...store.skillBooks[0]!, primarySkillId: 24 }],
    skillRuntimes: [{
      ...store.skillRuntimes[0]!,
      hurricaneCharge: 0,
      hurricaneEnabled: true,
      hurricaneRefreshed: false,
    }],
  }
  const lightning = stepPlayerEntityCombatTick(store).store
  assert.equal(lightning.skillRuntimes[0]!.hurricaneCharge, Math.fround(0.0015))

  const ether = stepPlayerEntityCombatTick({
    ...store,
    configs: [{ ...store.configs[0]!, element: 'air' }],
    skillBooks: [{ ...store.skillBooks[0]!, primarySkillId: 8 }],
  }).store
  assert.equal(ether.skillRuntimes[0]!.hurricaneCharge, 0)

  const weld = stepPlayerEntityCombatTick({
    ...store,
    configs: [{ ...store.configs[0]!, element: 'air' }],
    skillBooks: [{ ...store.skillBooks[0]!, primarySkillId: 52 }],
  }).store
  assert.equal(weld.skillRuntimes[0]!.hurricaneCharge, 0)
})

test('automatic primary replacement resets the cast lane to its selected native row', () => {
  let store = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 0, y: 0 }),
    17,
  )
  const sourceBook = store.skillBooks[0]!
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  permanentRanks[40] = 1
  effectiveRanks[40] = 1
  store = {
    ...store,
    primaryCasts: [{
      ...store.primaryCasts[0]!,
      channelActive: true,
      held: true,
      selectedPrimaryId: 16,
      targetId: 'enemy-99',
    }],
    skillBooks: [{
      ...sourceBook,
      effectiveRanks,
      permanentRanks,
      primarySkillId: 16,
    }],
  }
  const result = autofillPlayerEntitySkillSelections(
    store,
    'first',
    createNativeRng(97),
  )
  const selected = result.store.skillBooks[0]!.primarySkillId
  assert.ok(selected === 8 || selected === 40)
  assert.equal(result.store.primaryCasts[0]!.selectedPrimaryId, selected)
  assert.equal(result.store.primaryCasts[0]!.channelActive, false)
  assert.equal(result.store.primaryCasts[0]!.held, false)
  assert.equal(result.store.primaryCasts[0]!.targetId, null)
  assert.equal(result.rng.indexA, 1)
})

test('Weld acquisition resets the selected primary cast in the same player-store mutation', () => {
  const base = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 0, y: 0 }),
    17,
  )
  const activePrimaryCast = {
    ...base.primaryCasts[0]!,
    actionTick: 1,
    channelActive: true,
    held: true,
    lastWeldPlaybackRate: 1,
    lastWeldSoundVariant: 0,
    oneShotAttackPoseHeld: true,
    selectedPrimaryAgeTicks: 19,
    targetId: 'enemy-99',
    underpowered: true,
  }
  const assertSelectedWeld = (
    store: typeof base,
    buildId: number,
  ): void => {
    const cast = store.primaryCasts[0]!
    assert.equal(store.skillBooks[0]!.primarySkillId, 52)
    assert.equal(store.skillBooks[0]!.weldBuildId, buildId)
    assert.equal(cast.selectedPrimaryId, buildId)
    assert.equal(cast.actionTick, -1)
    assert.equal(cast.channelActive, false)
    assert.equal(cast.held, false)
    assert.equal(cast.lastWeldPlaybackRate, null)
    assert.equal(cast.lastWeldSoundVariant, null)
    assert.equal(cast.oneShotAttackPoseHeld, false)
    assert.equal(cast.selectedPrimaryAgeTicks, 0)
    assert.equal(cast.targetId, null)
    assert.equal(cast.underpowered, false)
  }

  for (let buildId = 1000; buildId <= 1009; buildId += 1) {
    const granted = grantPlayerEntityWeldBuild(
      { ...base, primaryCasts: [activePrimaryCast] },
      'first',
      buildId,
      createNativeRng(buildId),
    )
    assertSelectedWeld(granted.store, buildId)
  }

  const offered = {
    ...base,
    primaryCasts: [activePrimaryCast],
    progressions: [{
      ...base.progressions[0]!,
      level: 2,
      pendingLevels: [2],
      pendingOffer: {
        level: 2,
        options: [{ skillId: 52, targetRank: 1, weldBuildId: 1000 }],
        sequence: 1,
      },
    }],
  }
  const selected = applyPlayerEntitySkillChoice(offered, 'first', {
    choiceIndex: 0,
    offerSequence: 1,
    skillId: 52,
  }, createNativeRng(1000))
  assert.ok(selected)
  assertSelectedWeld(selected.store, 1000)
})

test('equipped native effects refresh effective ranks, maxima, and dense runtime atomically', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  const secondBook = playerSkillBookAt(store, 'second')
  const secondRuntime = playerSkillRuntimeAt(store, 'second')
  const economy = playerEconomyAt(store, 'first')!
  const ring = {
    equipmentType: 'ring' as const,
    iconRecords: [52],
    id: 99,
    kind: 'equipment' as const,
    name: 'Native Effect Ring',
    nativeEffects: [
      { kind: 4, magnitude: 1, operator: 0 as const, target: 64 },
      { kind: 14, magnitude: 50, operator: 2 as const, target: 0 },
      { kind: 16, magnitude: 100, operator: 2 as const, target: 0 },
      { kind: 23, magnitude: 50, operator: 0 as const, target: 0 },
      { kind: 37, magnitude: 0, operator: 0 as const, target: 0 },
      { kind: 38, magnitude: 25, operator: 2 as const, target: 0 },
      { kind: 39, magnitude: 0, operator: 0 as const, target: 0 },
    ],
    nativeSubtype: null,
    nativeTypeId: 7002,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  store = replacePlayerEconomy(store, 'first', {
    ...economy,
    equipment: { ...economy.equipment, rings: [ring, null, null] },
  })
  assert.equal(playerSkillBookAt(store, 'first')?.permanentRanks[64], 0)
  assert.equal(playerSkillBookAt(store, 'first')?.effectiveRanks[64], 1)
  assert.deepEqual(
    [9, 10, 17, 18, 25, 26, 33, 34, 42, 43].map((skillId) => (
      playerSkillBookAt(store, 'first')?.effectiveRanks[skillId]
    )),
    new Array(10).fill(1),
  )
  assert.ok([9, 10, 17, 18, 25, 26, 33, 34, 42, 43].every((skillId) => (
    playerSkillBookAt(store, 'first')?.permanentRanks[skillId] === 0
  )))
  assert.equal(playerProgressionAt(store, 'first')?.maximumHealth, 150)
  assert.equal(playerProgressionAt(store, 'first')?.currentHealth, 150)
  assert.equal(playerProgressionAt(store, 'first')?.weldingOfferBias, true)
  assert.equal(playerSkillRuntimeAt(store, 'first')?.equipmentModifiers.maximumHealth.offset, 50)
  assert.equal(playerSkillRuntimeAt(store, 'first')?.equipmentModifiers.weldEffect, 1.25)
  assert.equal(playerSkillDerivedStatsAt(store, 'first')?.maximumHealth, 150)
  assert.equal(playerSkillDerivedStatsAt(store, 'first')?.goldAmountMultiplier, 1.5)
  const equipmentHealthRecovery = Math.fround(0.002)
  assert.equal(
    playerSkillDerivedStatsAt(store, 'first')?.healthRecoveryPerTick,
    equipmentHealthRecovery,
  )
  assert.strictEqual(playerSkillBookAt(store, 'second'), secondBook)
  assert.strictEqual(playerSkillRuntimeAt(store, 'second'), secondRuntime)
  store = damagePlayerEntity(store, 'first', 10, 0)
  const healthBeforeRecovery = playerProgressionAt(store, 'first')!.currentHealth
  store = restorePlayerEntityHealth(store, 'first', 1.5 / 100)
  store = stepPlayerEntityCombatTick(store).store
  assert.ok(Math.abs(
    playerProgressionAt(store, 'first')!.currentHealth
      - healthBeforeRecovery
      - (1.5 / 100 + equipmentHealthRecovery),
  ) < 1e-12)
  store = replacePlayerEconomy(store, 'first', economy)
  assert.equal(playerProgressionAt(store, 'first')?.weldingOfferBias, false)
  assert.ok([9, 10, 17, 18, 25, 26, 33, 34, 42, 43].every((skillId) => (
    playerSkillBookAt(store, 'first')?.effectiveRanks[skillId] === 0
  )))
})

test('each dense player row owns an isolated economy component that survives run resets', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  const second = playerEconomyAt(store, 'second')!
  const first = playerEconomyAt(store, 'first')!
  const purchase = buyFomentiusItem(first, first.fomentiusStock[0]!.id)
  assert.equal(purchase.accepted, true)
  store = replacePlayerEconomy(store, 'first', purchase.state)

  assert.equal(playerEconomyAt(store, 'first')?.gold, purchase.state.gold)
  assert.strictEqual(playerEconomyAt(store, 'second'), second)
  const economyRows = store.economies
  store = resetPlayerEntitiesForNewRun(store, {
    first: createPlayerCharacter(FIRST, { x: 100, y: 200 }),
    second: createPlayerCharacter(SECOND, { x: 300, y: 400 }),
  })
  assert.strictEqual(store.economies, economyRows)
})

test('each player owns private progression and ranks while sharing immutable stat definitions', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  const secondProgression = playerProgressionAt(store, 'second')
  store = grantPlayerEntityExperience(store, 'first', 100, createNativeRng(101)).store
  assert.equal(playerProgressionAt(store, 'first')?.level, 2)
  assert.equal(playerProgressionAt(store, 'second'), secondProgression)
  assert.notEqual(
    playerSkillBookAt(store, 'first')?.permanentRanks,
    playerSkillBookAt(store, 'second')?.permanentRanks,
  )
  assert.equal(playerStatBookAt(store, 'first'), playerStatBookAt(store, 'second'))
})

test('entity combat APIs update only the indexed progression and publish one-shot death edges', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  const untouched = playerProgressionAt(store, 'second')

  const debit = tryDebitPlayerEntityMana(store, 'first', 6)
  assert.equal(debit.accepted, true)
  store = debit.store
  assert.equal(playerProgressionAt(store, 'first')?.currentMana, 94)
  assert.equal(playerProgressionAt(store, 'second'), untouched)

  store = damagePlayerEntity(store, 'first', 60, 0)
  assert.equal(playerEntityCanAcceptInput(store, 'first'), false)
  assert.equal(playerEntityCanCast(store, 'first'), false)
  assert.equal(playerEntityCanAcceptInput(store, 'second'), true)

  const tick = stepPlayerEntityCombatTick(store)
  store = tick.store
  assert.deepEqual(tick.beganDeathEpochPlayerIds, ['first'])
  assert.deepEqual(tick.completedDeathPresentationPlayerIds, [])
  assert.deepEqual(tick.deathBurstPlayerIds, [])
  assert.equal(playerProgressionAt(store, 'first')?.deathEpoch, 1)
  assert.equal(playerProgressionAt(store, 'second')?.currentHealth, 50)

  store = poisonPlayerEntity(store, 'second', 5, 10)
  assert.equal(playerProgressionAt(store, 'second')?.poisonDamagePerTick, 0.05)
  assert.equal(playerProgressionAt(store, 'second')?.poisonTicksRemaining, 1_000)
})

test('wave respawn restores only a non-positive player on the same durable entity', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 10, y: 20 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 30, y: 40 }), 20)
  store = grantPlayerEntityExperience(store, 'first', 100, createNativeRng(102)).store
  store = replacePlayerCharacter(store, 'first', {
    ...playerCharacterAt(store, 'first')!,
    headingIndex: 7,
    primaryCast: {
      ...playerCharacterAt(store, 'first')!.primaryCast,
      actionTick: 12,
      channelActive: true,
      held: true,
    },
    velocity: { x: 4, y: -3 },
  })
  store = damagePlayerEntity(store, 'first', 60, 100)
  store = stepPlayerEntityCombatTick(store).store

  const entityIds = store.entityIds
  const identities = store.identities
  const configs = store.configs
  const economies = store.economies
  const skillBooks = store.skillBooks
  const statBooks = store.statBooks
  const deathEpoch = playerProgressionAt(store, 'first')!.deathEpoch
  const secondBefore = playerProgressionAt(store, 'second')
  const respawn = respawnPlayerEntityAt(store, 'first', { x: 123, y: 234 })
  store = respawn.store

  assert.equal(respawn.didRespawn, true)
  assert.equal(store.entityIds, entityIds)
  assert.equal(store.identities, identities)
  assert.equal(store.configs, configs)
  assert.equal(store.economies, economies)
  assert.equal(store.skillBooks, skillBooks)
  assert.equal(store.statBooks, statBooks)
  assert.equal(playerProgressionAt(store, 'first')?.deathEpoch, deathEpoch)
  assert.equal(playerProgressionAt(store, 'first')?.deathAgeTicks, 0)
  assert.equal(playerProgressionAt(store, 'first')?.deathTick, 0)
  assert.equal(playerProgressionAt(store, 'first')?.lifeState, 'alive')
  assert.equal(
    playerProgressionAt(store, 'first')?.currentHealth,
    playerProgressionAt(store, 'first')?.maximumHealth,
  )
  assert.equal(
    playerProgressionAt(store, 'first')?.currentMana,
    playerProgressionAt(store, 'first')?.maximumMana,
  )
  assert.deepEqual(playerCharacterAt(store, 'first')?.position, { x: 123, y: 234 })
  assert.deepEqual(playerCharacterAt(store, 'first')?.velocity, { x: 0, y: 0 })
  assert.equal(playerCharacterAt(store, 'first')?.headingIndex, 7)
  assert.equal(playerCharacterAt(store, 'first')?.primaryCast.actionTick, -1)
  assert.equal(playerCharacterAt(store, 'first')?.primaryCast.channelActive, false)
  assert.equal(playerProgressionAt(store, 'second'), secondBefore)

  const living = respawnPlayerEntityAt(store, 'second', { x: 999, y: 999 })
  assert.equal(living.didRespawn, false)
  assert.equal(living.store, store)
  assert.deepEqual(playerCharacterAt(living.store, 'second')?.position, { x: 30, y: 40 })
})

test('new-run placement resets transient combat while retaining dense identity and progression books', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  store = grantPlayerEntityExperience(store, 'first', 100, createNativeRng(103)).store
  store = poisonPlayerEntity(store, 'first', 5, 10)
  store = coldSlowPlayerEntity(store, 'first', 200)
  store = dazzlePlayerEntity(store, 'first', 50)
  store = damagePlayerEntity(store, 'first', 75, 0)
  store = stepPlayerEntityCombatTick(store).store
  store = setPlayerEntitySpectating(store, 'first')

  const entityIds = store.entityIds
  const identities = store.identities
  const configs = store.configs
  const skillBooks = store.skillBooks
  const statBooks = store.statBooks
  const firstProgression = playerProgressionAt(store, 'first')!
  store = resetPlayerEntitiesForNewRun(store, {
    first: createPlayerCharacter(FIRST, { x: 100, y: 200 }),
    second: createPlayerCharacter(SECOND, { x: 300, y: 400 }),
  })

  assert.equal(store.entityIds, entityIds)
  assert.equal(store.identities, identities)
  assert.equal(store.configs, configs)
  assert.equal(store.skillBooks, skillBooks)
  assert.equal(store.statBooks, statBooks)
  assert.deepEqual(playerCharacterAt(store, 'first')?.position, { x: 100, y: 200 })
  assert.deepEqual(playerCharacterAt(store, 'second')?.position, { x: 300, y: 400 })
  assert.equal(playerProgressionAt(store, 'first')?.level, firstProgression.level)
  assert.equal(playerProgressionAt(store, 'first')?.pendingOffer, firstProgression.pendingOffer)
  assert.equal(playerProgressionAt(store, 'first')?.lifeState, 'alive')
  assert.equal(playerProgressionAt(store, 'first')?.currentHealth, 50)
  assert.equal(playerProgressionAt(store, 'first')?.poisonDamagePerTick, 0)
  assert.equal(playerProgressionAt(store, 'first')?.poisonTicksRemaining, 0)
  assert.equal(playerProgressionAt(store, 'first')?.coldSlowTicksRemaining, 0)
  assert.equal(playerProgressionAt(store, 'first')?.dazzleTicksRemaining, 0)
  assert.equal(playerEntityMovementScale(store, 'first'), 1)
  assert.equal(playerProgressionAt(store, 'first')?.currentMana, 100)
  assert.deepEqual(playerLightingAt(store, 'first'), {
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
    overlayEffectPhase: 0,
  })
  assert.throws(() => resetPlayerEntitiesForNewRun(store, {
    first: createPlayerCharacter(FIRST, { x: 0, y: 0 }),
  }), /exactly one placement/)
  assert.throws(() => resetPlayerEntitiesForNewRun(store, {
    first: createPlayerCharacter(FIRST, { x: 0, y: 0 }),
    second: createPlayerCharacter(SECOND, { x: 0, y: 0 }),
  }, {
    first: { managerLane: 'actor', registrationOrdinal: 2 },
  }), /exactly one light registration/)
})

test('action occupancy cannot refresh the event-owned player lighting phase', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  const first = playerCharacterAt(store, 'first')!
  store = replacePlayerCharacter(store, 'first', {
    ...first,
    primaryCast: { ...first.primaryCast, actionTick: 0 },
  })
  const second = playerCharacterAt(store, 'second')!
  store = replacePlayerCharacter(store, 'second', {
    ...second,
    primaryCast: { ...second.primaryCast, actionTick: 1, channelActive: true },
  })
  store = stepPlayerEntityOverlayLightingTick(store)
  assert.equal(playerLightingAt(store, 'first')?.overlayEffectPhase, 0)
  assert.equal(playerLightingAt(store, 'second')?.overlayEffectPhase, 0)

  const idle = createIdlePlayerPrimaryCast()
  assert.equal(playerLightDriveActive(idle, 'alive'), false)
  assert.equal(playerLightDriveActive(idle, 'lethal-pending'), false)
  assert.equal(playerLightDriveActive({ ...idle, actionTick: 0 }, 'alive'), true)
  assert.equal(playerLightDriveActive(idle, 'dying'), true)
  assert.equal(playerLightDriveActive(idle, 'spectating'), true)
})

test('loot credits exactly one dense participant economy or skill row', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  const firstEconomy = playerEconomyAt(store, 'first')!
  store = replacePlayerEconomy(store, 'first', { ...firstEconomy, gold: 10_000 })
  const untouchedEconomy = playerEconomyAt(store, 'second')
  const untouchedSkills = playerSkillBookAt(store, 'second')

  store = creditPlayerEntityLootGold(store, 'first', 11)
  assert.equal(playerEconomyAt(store, 'first')?.gold, 10_011)
  assert.strictEqual(playerEconomyAt(store, 'second'), untouchedEconomy)

  const potion = { ...playerEconomyAt(store, 'first')!.backpack[0]!, id: 99_000 }
  const inserted = insertPlayerEntityLootItem(store, 'first', potion)
  assert.equal(inserted.accepted, true)
  store = inserted.store
  assert.equal(playerEconomyAt(store, 'first')?.backpack[0]?.quantity, 2)

  store = grantPlayerEntityBonusSkillChoice(store, 'first', createNativeRng(104)).store
  assert.ok(playerProgressionAt(store, 'first')?.pendingOffer)
  const increased = increaseRandomPlayerEntitySkill(store, 'first', createNativeRng(123))
  assert.notEqual(increased.skillId, null)
  store = increased.store
  assert.strictEqual(playerSkillBookAt(store, 'second'), untouchedSkills)
})

test('direct rank grants reseed once per actually applied native rank', () => {
  const store = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 0, y: 0 }),
    10,
  )
  const sourceRng = createNativeRng(0x1234_5678)
  const firstSeed = drawNativeInteger(sourceRng, 1_000_000)
  const secondSeed = drawNativeInteger(firstSeed.state, 1_000_000)
  const granted = grantPlayerEntitySkillRanks(store, 'first', 9, 2, sourceRng)
  assert.equal(playerSkillBookAt(granted.store, 'first')?.permanentRanks[9], 2)
  assert.equal(playerProgressionAt(granted.store, 'first')?.offerSeed, secondSeed.value)
  assert.deepEqual(granted.rng, secondSeed.state)
})

test('Hagatha purchase state resolves Revelation, Weird Caster, and offer bias atomically', () => {
  let store = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 0, y: 0 }),
    10,
  )
  store = replacePlayerEconomy(store, 'first', {
    ...playerEconomyAt(store, 'first')!,
    ownedPerkSelectors: [6, 14],
  })
  store = {
    ...store,
    skillRuntimes: [{
      ...store.skillRuntimes[0]!,
      concentrationSkillIdA: 11,
    }],
  }
  const applied = applyPlayerEntityHagathaPurchaseEffects(
    store,
    'first',
    [6, 14],
    createNativeRng(123),
  )
  const book = playerSkillBookAt(applied.store, 'first')!
  assert.equal(book.permanentRanks[11], 2)
  assert.notEqual(applied.weirdCasterSkillId, null)
  assert.equal(book.permanentRanks[applied.weirdCasterSkillId!], 2)
  assert.equal(playerProgressionAt(applied.store, 'first')?.disciplineOfferBias, true)
  assert.notEqual(playerProgressionAt(applied.store, 'first')?.offerSeed, 10)
})

test('Drinker precedes Cheat Death and both clear until-hurt one-shots on real damage', () => {
  let store = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 0, y: 0 }),
    10,
  )
  store = replacePlayerEconomy(store, 'first', {
    ...playerEconomyAt(store, 'first')!,
    ownedPerkSelectors: [7, 15, 24, 25],
  })
  store = applyPlayerEntityHagathaPurchaseEffects(
    store,
    'first',
    [7, 24, 25],
    createNativeRng(1),
  ).store
  const healthBefore = projectInventoryItems(
    playerEconomyAt(store, 'first')!.backpack,
  ).find(({ item }) => item.nativeSubtype === 0)!.item.quantity
  const drank = damagePlayerEntityWithResult(store, 'first', 60, 1)
  assert.equal(drank.autoHealthPotionUsed, true)
  assert.equal(drank.cheatDeathTriggered, false)
  assert.equal(playerProgressionAt(drank.store, 'first')?.currentHealth, 50)
  assert.deepEqual(playerProgressionAt(drank.store, 'first')?.hagathaRuntime, {
    cheatDeathCharges: 1,
    reverieActive: false,
    serendipityActive: false,
  })
  const healthAfter = projectInventoryItems(
    playerEconomyAt(drank.store, 'first')!.backpack,
  ).find(({ item }) => item.nativeSubtype === 0)?.item.quantity ?? 0
  assert.equal(healthAfter, healthBefore - 1)

  store = replacePlayerEconomy(store, 'first', {
    ...playerEconomyAt(store, 'first')!,
    backpack: playerEconomyAt(store, 'first')!.backpack.filter((item) => (
      item.nativeSubtype !== 0
    )),
    ownedPerkSelectors: [7, 24, 25],
  })
  const cheated = damagePlayerEntityWithResult(store, 'first', 60, 2)
  assert.equal(cheated.autoHealthPotionUsed, false)
  assert.equal(cheated.cheatDeathTriggered, true)
  assert.equal(playerProgressionAt(cheated.store, 'first')?.currentHealth, 25)
  assert.equal(playerProgressionAt(cheated.store, 'first')?.lifeState, 'alive')
  assert.equal(playerProgressionAt(cheated.store, 'first')?.hagathaRuntime.cheatDeathCharges, 0)
})

test('Drinker consumes one nested mana potion and retries the same debit once', () => {
  let store = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 0, y: 0 }),
    10,
  )
  store = replacePlayerEconomy(store, 'first', {
    ...playerEconomyAt(store, 'first')!,
    ownedPerkSelectors: [15],
  })
  store = {
    ...store,
    progressions: [{ ...store.progressions[0]!, currentMana: 5 }],
  }
  const quantityBefore = projectInventoryItems(
    playerEconomyAt(store, 'first')!.backpack,
  ).find(({ item }) => item.nativeSubtype === 1)!.item.quantity
  const debit = tryDebitPlayerEntityMana(store, 'first', 6)
  assert.equal(debit.accepted, true)
  assert.equal(debit.autoManaPotionUsed, true)
  assert.equal(playerProgressionAt(debit.store, 'first')?.currentMana, 94)
  const quantityAfter = projectInventoryItems(
    playerEconomyAt(debit.store, 'first')!.backpack,
  ).find(({ item }) => item.nativeSubtype === 1)?.item.quantity ?? 0
  assert.equal(quantityAfter, quantityBefore - 1)
})

test('Last Word emits its native death and archive milestones only for its owner', () => {
  let store = addPlayerEntity(
    createPlayerEntityStore(),
    'first',
    FIRST,
    createPlayerCharacter(FIRST, { x: 0, y: 0 }),
    10,
  )
  store = replacePlayerEconomy(store, 'first', {
    ...playerEconomyAt(store, 'first')!,
    ownedPerkSelectors: [12],
  })
  store = {
    ...store,
    progressions: [{
      ...store.progressions[0]!,
      deathAgeTicks: 333,
      deathTick: 199,
      lifeState: 'dying',
    }],
  }
  const burst = stepPlayerEntityCombatTick(store)
  assert.deepEqual(burst.lastWordBurstPlayerIds, ['first'])
  store = {
    ...burst.store,
    progressions: [{
      ...burst.store.progressions[0]!,
      deathAgeTicks: PLAYER_DEATH_PRESENTATION_DURATION_TICKS - 1,
      deathTick: PLAYER_DEATH_PRESENTATION_MAXIMUM_HELD_TICK,
    }],
  }
  const archive = stepPlayerEntityCombatTick(store)
  assert.deepEqual(archive.lastWordArchivePlayerIds, ['first'])
  assert.deepEqual(archive.completedDeathPresentationPlayerIds, ['first'])
})
