import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerCharacterInput } from '../core-kernels/player-character.ts'
import { createNativeHubNpcState } from '../core-kernels/native-hub-npc.ts'
import { GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS } from '../core-kernels/game-run.ts'
import { createNativeRng, drawNativeInteger } from '../core-kernels/native-rng.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import {
  createNativeWaterAuraActor,
  createNativeWaterHailActor,
} from '../core-kernels/air-water-spell-actors.ts'
import {
  stepBoneyardEnemyStore,
  type BoneyardEnemyDeathEffect,
} from '../core-server/boneyard-enemy-store.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardEnemySpawnIntent,
} from '../core-kernels/boneyard-wave-director.ts'
import {
  applyGameSimulationHubAction,
  armGameSimulationCollegeIntro,
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerBelt,
  getPlayerEconomy,
  getPlayerProgression,
  stepGameSimulationTick,
} from '../core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../core-server/player-entity-store.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  HUB_SACK_REPLICATION_DEPTH_LIMIT,
  createEquipmentInventoryItem,
  insertLootInventoryItem,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import { HUB_SPAWN } from '../core-kernels/hub-math.ts'
import { NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS } from '../hub-painter-order.ts'
import { hubCollegeAdmissionPreLoadout } from '../core-kernels/college-admission-lifecycle.ts'
import { archiveHubMemorialPortrait } from '../core-kernels/hub-memorial.ts'
import { rollNativeStarterEquipmentAppearance } from '../core-kernels/native-starter-equipment.ts'
import {
  NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  nativeTutorialAmuletItem,
} from '../core-kernels/native-tutorial.ts'
import { HubStudentPopulationState } from '../core-server/hub-students.ts'
import { createHubSkorchaAtVariant } from '../core-server/hub-skorcha.ts'
import { createHubWorld, HubWorldRuntime } from '../core-server/hub-world.ts'
import {
  createBoneyardCatalog,
  materializeBoneyard,
  materializeStockTutorial,
} from '../host/boneyard-catalog.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { createReplicatedEntityBaseline } from '../protocol/entity-replication.ts'
import {
  createGameProfileSaveDocument,
  createGameSaveDocument,
  hydrateGameSaveProfile,
  retireGameSaveWizard,
  restoreGameSaveDocument,
  restoreGameSaveProfile,
} from './game-save-document.ts'
import {
  MAX_WEB_GAME_SAVE_BYTES,
  readGameSaveSummary,
} from './game-save-contract.ts'

const OWNER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const
const GUEST = {
  discipline: 'mind',
  displayName: 'Vibia',
  element: 'water',
} as const
const MODS = [{
  contentSha256: 'a'.repeat(64),
  id: 'tests.save-mod',
  version: '1.2.3',
}] as const
const MOD_STATE = {
  'tests.save-mod': { enabled_encounters: 7, greeting: 'hello' },
} as const
const SIGNED_PARTY_RECOVERY_CLAIM = `sdrpr2.${'A'.repeat(96)}.${'B'.repeat(43)}`

test('current Hub restore allocates its reconstructed students after persisted owners', () => {
  const state = createGameSimulation({ owner: OWNER })
  const persistedNextActor = state.worldManagerOrder.nextRegistrationOrdinal.actor
  const restored = restoreGameSaveDocument(createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  })).state
  assert.equal(restored.world.kind, 'hub')
  if (restored.world.kind !== 'hub') throw new Error('expected restored Hub')
  const studentRegistrations = restored.world.studentPopulation.students.map(
    ({ painterRegistration }) => painterRegistration,
  )
  assert.ok(studentRegistrations.length > 0)
  assert.equal(
    studentRegistrations.every(({ managerLane, registrationOrdinal }) => (
      managerLane === 'actor' && registrationOrdinal >= persistedNextActor
    )),
    true,
  )
  const actorRegistrations = [
    ...NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS.map((_, registrationOrdinal) => ({
      managerLane: 'actor' as const,
      registrationOrdinal,
    })),
    restored.playerEntities.lightings[0]!.lightRegistration,
    ...studentRegistrations,
  ]
  assert.equal(
    new Set(actorRegistrations.map(({ registrationOrdinal }) => registrationOrdinal)).size,
    actorRegistrations.length,
  )
  assert.ok(
    restored.worldManagerOrder.nextRegistrationOrdinal.actor
      > Math.max(...actorRegistrations.map(({ registrationOrdinal }) => registrationOrdinal)),
  )
})

test('schema 21 Hub saves migrate the old fixed and Student-before-player prefix', () => {
  const state = createGameSimulation({ owner: OWNER })
  assert.equal(state.world.kind, 'hub')
  if (state.world.kind !== 'hub') throw new Error('expected Hub world')
  const document = JSON.parse(createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  }))
  const simulation = document.continuation.simulation
  const studentCount = simulation.world.studentPopulation.students.length
  const currentFixedCount = NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS.length
  const fixedDelta = currentFixedCount - 11
  const currentPlayerOrdinal = currentFixedCount
  const currentStudentStart = currentPlayerOrdinal + 1
  const downgradeRegistration = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(downgradeRegistration)
    if (value === null || typeof value !== 'object') return value
    const source = value as Record<string, unknown>
    if (source.managerLane === 'actor' && Number.isSafeInteger(source.registrationOrdinal)) {
      const ordinal = Number(source.registrationOrdinal)
      return {
        ...source,
        registrationOrdinal: ordinal === currentPlayerOrdinal
          ? 11 + studentCount
          : ordinal >= currentStudentStart && ordinal < currentStudentStart + studentCount
            ? 11 + ordinal - currentStudentStart
            : ordinal - fixedDelta,
      }
    }
    return Object.fromEntries(Object.entries(source).map(([key, entry]) => [
      key,
      downgradeRegistration(entry),
    ]))
  }
  document.continuation.simulation = downgradeRegistration(simulation)
  document.continuation.simulation.worldManagerOrder.nextRegistrationOrdinal.actor -= fixedDelta
  document.schemaVersion = 21

  const restored = restoreGameSaveDocument(JSON.stringify(document)).state
  assert.equal(restored.world.kind, 'hub')
  if (restored.world.kind !== 'hub') throw new Error('expected restored Hub')
  assert.deepEqual(restored.playerEntities.lightings[0]!.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: currentFixedCount,
  })
  assert.ok(restored.world.studentPopulation.students.every(({ painterRegistration }) => (
    painterRegistration.registrationOrdinal > currentFixedCount
  )))
})

test('schema 19 compact inventory roots migrate to current addressed slots', () => {
  const state = createGameSimulation({ owner: OWNER })
  const legacy = JSON.parse(createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  }))
  legacy.schemaVersion = 19
  const legacyBackpack = legacy.continuation.simulation.playerEntities.economies[0].backpack
  for (const item of legacyBackpack) delete item.inventorySlot

  const restored = restoreGameSaveDocument(JSON.stringify(legacy))
  assert.deepEqual(
    restored.state.playerEntities.economies[0]!.backpack.map(({ inventorySlot }) => inventorySlot),
    [0, 1],
  )
  const current = JSON.parse(createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: restored.state,
  }))
  assert.equal(current.schemaVersion, 26)
  assert.deepEqual(
    current.continuation.simulation.playerEntities.economies[0].backpack
      .map(({ inventorySlot }: { inventorySlot: number }) => inventorySlot),
    [0, 1],
  )
})

test('schema 25 active Wraiths migrate from the fabricated phase brain to native flight state', () => {
  const loadedBoneyard = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 91),
  )
  assert.ok(loadedBoneyard)
  let state = enterBoneyardWorld(createGameSimulation({ owner: OWNER }), loadedBoneyard)
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const spawnIntent: BoneyardEnemySpawnIntent = {
    enemyToken: 'WRAITH',
    flags: [],
    id: 1,
    locationPolicy: 'anywhere',
    nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.WRAITH,
    position: { x: 300, y: 300 },
    spawnTick: state.tick,
    waveOrdinal: 1,
  }
  const spawned = stepBoneyardEnemyStore(state.world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: request => request.requestedPosition,
    resolveSpawnIntents: () => [spawnIntent],
    tick: state.tick,
  })
  state = { ...state, world: { ...state.world, enemies: spawned.store } }
  const legacy = JSON.parse(createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  }))
  legacy.schemaVersion = 25
  legacy.continuation.simulation.world.enemies.actors[0].brain = {
    actionTick: 0,
    contactTargetPlayerId: null,
    family: 'wraith',
    markerEmitted: false,
    phase: 'orbit',
    phaseTicksRemaining: 400,
  }

  const restored = restoreGameSaveDocument(JSON.stringify(legacy)).state
  assert.equal(restored.world.kind, 'boneyard')
  if (restored.world.kind !== 'boneyard') throw new Error('expected restored Boneyard')
  const brain = restored.world.enemies.actors[0]!.brain
  assert.equal(brain.family, 'wraith')
  if (brain.family !== 'wraith') throw new Error('expected restored Wraith')
  assert.equal(brain.phase, 'flight')
  assert.equal(brain.baseFlybySpeed, Math.fround(0.8))
  assert.ok(brain.currentSpeed >= 20 && brain.currentSpeed < 60)
  assert.ok(brain.restingSpeed >= 0 && brain.restingSpeed < 8)
  assert.ok(brain.flybyTicksRemaining >= 200 && brain.flybyTicksRemaining <= 800)
  assert.equal(JSON.parse(createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: restored,
  })).schemaVersion, 26)
})

test('schema 20 restores complete Hub and Boneyard world-painter ownership', () => {
  const hubState = createGameSimulation({ owner: OWNER })
  const hubLegacy = downgradeWorldPainterDocumentToSchema20(JSON.parse(
    createGameSaveDocument({
      integrity: 'local-only',
      loadedBoneyard: null,
      mods: [],
      modState: {},
      playerId: 'owner',
      state: hubState,
    }),
  ))
  const restoredHub = restoreGameSaveDocument(JSON.stringify(hubLegacy))
  assert.equal(restoredHub.state.world.kind, 'hub')
  if (restoredHub.state.world.kind !== 'hub') throw new Error('expected restored Hub')
  const hubActorRegistrations = [
    ...NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS.map((_, registrationOrdinal) => ({
      managerLane: 'actor' as const,
      registrationOrdinal,
    })),
    restoredHub.state.playerEntities.lightings[0]!.lightRegistration,
    ...restoredHub.state.world.studentPopulation.students.map(
      student => student.painterRegistration,
    ),
  ]
  assert.equal(
    hubActorRegistrations.every(registration => registration.managerLane === 'actor'),
    true,
  )
  assert.equal(
    new Set(hubActorRegistrations.map(registration => registration.registrationOrdinal)).size,
    hubActorRegistrations.length,
  )
  assert.equal(
    restoredHub.state.worldManagerOrder.nextRegistrationOrdinal.actor
      > Math.max(...hubActorRegistrations.map(registration => registration.registrationOrdinal)),
    true,
  )
  const reencodedHub = JSON.parse(createGameSaveDocument({
    integrity: restoredHub.integrity,
    loadedBoneyard: null,
    mods: restoredHub.mods,
    modState: restoredHub.modState,
    playerId: restoredHub.playerId,
    state: restoredHub.state,
  }))
  assert.equal(reencodedHub.schemaVersion, 26)
  assert.equal('worldManagerOrder' in reencodedHub.continuation.simulation, true)
  assert.equal('lightProviderOrder' in reencodedHub.continuation.simulation, false)

  const loadedBoneyard = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 67),
  )
  assert.ok(loadedBoneyard)
  const boneyardState = enterBoneyardWorld(hubState, loadedBoneyard)
  const boneyardLegacy = downgradeWorldPainterDocumentToSchema20(JSON.parse(
    createGameSaveDocument({
      integrity: 'local-only',
      loadedBoneyard,
      mods: [],
      modState: {},
      playerId: 'owner',
      state: boneyardState,
    }),
  ))
  const restoredBoneyard = restoreGameSaveDocument(JSON.stringify(boneyardLegacy))
  assert.equal(restoredBoneyard.state.world.kind, 'boneyard')
  if (restoredBoneyard.state.world.kind !== 'boneyard') {
    throw new Error('expected restored Boneyard')
  }
  assert.deepEqual(
    restoredBoneyard.state.world.solomonPainterRegistration?.managerLane,
    'actor',
  )
  for (const goodie of restoredBoneyard.state.world.loot.goodies) {
    assert.equal(
      goodie.sceneryRegistrationOrdinal,
      loadedBoneyard.scene.objects.findIndex(object => object.eid === goodie.eid),
    )
  }
  assert.doesNotThrow(() => createGameSnapshot(restoredBoneyard.state, 'owner'))
})

test('schema 22 restores late Water painters and every native death-effect owner', () => {
  const loadedBoneyard = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 83),
  )
  assert.ok(loadedBoneyard)
  let state = enterBoneyardWorld(
    createGameSimulation({ owner: { ...OWNER, element: 'water' } }),
    loadedBoneyard,
  )
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')

  const painterOrder = createNativeWorldManagerOrder(state.worldManagerOrder)
  const deathEffect = (
    id: number,
    kind: BoneyardEnemyDeathEffect['kind'],
    role: string,
    presentationOwner: BoneyardEnemyDeathEffect['presentationOwner'],
  ): BoneyardEnemyDeathEffect => ({
    ageTicks: 0,
    alpha: 1,
    alphaMultiplier: 1,
    alphaLossPerTick: 0.025,
    angularVelocityDeg: 0,
    atlas: 'BadGuys',
    blendMode: 'normal',
    bounceRetention: 0,
    bounceVelocity: 0,
    entry: 86,
    firstEntry: 86,
    frameCount: 1,
    framePhase: 0,
    frameVelocity: 0,
    frameVelocityDamping: 1,
    frameTicks: 1,
    height: 0,
    id,
    kind,
    lastStepTick: 0,
    lifetimeTicks: 40,
    opacityTimer: 1,
    ownerActorId: 1,
    painterRegistration: presentationOwner === 'world-sorted'
      ? painterOrder.register('actor')
      : null,
    presentationOwner,
    position: { x: 200, y: 150 },
    role,
    rotationDeg: 0,
    scale: 1,
    scaleMultiplier: 1,
    shadow: false,
    spawnTick: 0,
    tint: 0xffffff,
    verticalVelocity: 0,
    velocity: { x: 0, y: 0 },
    velocityDamping: 1,
  })
  const enemyDeathEffects = [
    deathEffect(1, 'bouncer', 'skeleton-bone', 'world-sorted'),
    deathEffect(2, 'unbind', 'death-unbind-star', 'direct-post-world'),
    deathEffect(3, 'sprite-array', 'imp-sprite-array', 'pre-world-queue'),
    deathEffect(4, 'late-splat', 'zombie-late-splat:0', 'pre-world-queue'),
    deathEffect(5, 'fire-array', 'demon-death-fire:0', 'pre-world-queue'),
    deathEffect(6, 'fade', 'demon-death-fire-burst-glow', 'direct-post-world'),
    deathEffect(
      7,
      'sprite-array',
      'demon-death-fire-burst-frame',
      'direct-post-world',
    ),
  ]
  const lootDeathEffect = deathEffect(8, 'bouncer', 'goodie-break-particle-0', 'world-sorted')
  const aura = createNativeWaterAuraActor(
    100,
    'owner',
    `boneyard:${loadedBoneyard.runId}`,
    0,
    { x: 200, y: 150 },
    720,
    createNativeRng(1),
  )
  const hail = createNativeWaterHailActor(
    101,
    'owner',
    `boneyard:${loadedBoneyard.runId}`,
    0,
    { x: 200, y: 150 },
    { x: 1, y: 0 },
    aura.rng,
  )
  state = {
    ...state,
    primarySpells: {
      nextId: 102,
      projectiles: [],
      transients: [
        { ...aura.actor, painterRegistrations: [painterOrder.register('actor')] },
        { ...hail.actor, painterRegistrations: [painterOrder.register('actor')] },
      ],
    },
    world: {
      ...state.world,
      enemies: {
        ...state.world.enemies,
        deathEffects: enemyDeathEffects,
        lastStepTick: 0,
        nextDeathEffectId: 9,
      },
      loot: {
        ...state.world.loot,
        effects: [lootDeathEffect],
        nextEffectId: 9,
      },
    },
    worldManagerOrder: painterOrder.state(),
  }

  const legacy = JSON.parse(createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  }))
  legacy.schemaVersion = 22
  for (const transient of legacy.continuation.simulation.primarySpells.transients) {
    delete transient.painterRegistrations
  }
  const legacyEnemyEffects = legacy.continuation.simulation.world.enemies.deathEffects
  const legacyLootEffects = legacy.continuation.simulation.world.loot.effects
  for (const effect of [...legacyEnemyEffects, ...legacyLootEffects]) {
    delete effect.presentationOwner
  }
  legacyEnemyEffects[2].painterRegistration = {
    managerLane: 'actor',
    registrationOrdinal: 999_999,
  }

  const restored = restoreGameSaveDocument(JSON.stringify(legacy))
  assert.equal(restored.state.world.kind, 'boneyard')
  if (restored.state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.deepEqual(
    restored.state.primarySpells.transients.map(({ painterRegistrations }) => (
      painterRegistrations?.map(({ managerLane }) => managerLane)
    )),
    [['actor'], ['actor']],
  )
  assert.deepEqual(
    restored.state.world.enemies.deathEffects.map((effect) => ({
      owner: effect.presentationOwner,
      registration: effect.painterRegistration?.managerLane ?? null,
      role: effect.role,
    })),
    [
      { owner: 'world-sorted', registration: 'actor', role: 'skeleton-bone' },
      { owner: 'direct-post-world', registration: null, role: 'death-unbind-star' },
      { owner: 'pre-world-queue', registration: null, role: 'imp-sprite-array' },
      { owner: 'pre-world-queue', registration: null, role: 'zombie-late-splat:0' },
      { owner: 'pre-world-queue', registration: null, role: 'demon-death-fire:0' },
      {
        owner: 'direct-post-world',
        registration: null,
        role: 'demon-death-fire-burst-glow',
      },
      {
        owner: 'direct-post-world',
        registration: null,
        role: 'demon-death-fire-burst-frame',
      },
    ],
  )
  assert.equal(restored.state.world.loot.effects[0]?.presentationOwner, 'world-sorted')
  assert.equal(restored.state.world.loot.effects[0]?.painterRegistration?.managerLane, 'actor')
  assert.doesNotThrow(() => createReplicatedEntityBaseline(
    createGameSnapshot(restored.state, 'owner'),
  ))

  const current = JSON.parse(createGameSaveDocument({
    integrity: restored.integrity,
    loadedBoneyard,
    mods: restored.mods,
    modState: restored.modState,
    playerId: restored.playerId,
    state: restored.state,
  }))
  assert.equal(current.schemaVersion, 26)
  const missingOwner = structuredClone(current)
  delete missingOwner.continuation.simulation.world.enemies.deathEffects[0]
    .presentationOwner
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(missingOwner)),
    /presentation owner/,
  )
  const missingPainters = structuredClone(current)
  delete missingPainters.continuation.simulation.primarySpells.transients[0]
    .painterRegistrations
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(missingPainters)),
    /painter registrations/,
  )
})

test('host save documents round-trip the complete owner state and revive Hub runtimes', () => {
  let state = createGameSimulation({ owner: OWNER, guest: GUEST }, {
    hubTraderAnimationSeed: 2,
    gameRngSeed: 91,
  })
  for (let tick = 0; tick < 17; tick += 1) {
    state = stepGameSimulationTick(state, {
      owner: createIdlePlayerCharacterInput(),
      guest: createIdlePlayerCharacterInput(),
    })
  }

  const document = createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: MODS,
    modState: MOD_STATE,
    playerId: 'owner',
    state,
  })
  const encoded = JSON.parse(document) as Record<string, unknown>
  assert.equal(encoded.schemaVersion, 26)
  assert.deepEqual(encoded.mods, MODS)
  assert.deepEqual(encoded.modState, MOD_STATE)
  assert.equal(encoded.integrity, 'local-only')
  const serializedHub = (
    encoded.continuation as { simulation: { world: Record<string, unknown> } }
  ).simulation.world
  assert.equal('skorchaHiddenTicks' in serializedHub, false)
  assert.equal('skorchaPopulationRng' in serializedHub, false)
  assert.equal('skorchaTransitionTicksRemaining' in serializedHub, false)
  assert.equal('skorchaVisibleTicks' in serializedHub, false)
  assert.equal(new TextEncoder().encode(document).byteLength <= MAX_WEB_GAME_SAVE_BYTES, true)
  assert.deepEqual(readGameSaveSummary(document), {
    activeRun: false,
    character: OWNER,
    partyRejoinToken: null,
    phase: 'hub',
    playerId: 'owner',
    savedAtTick: state.tick,
    worldKind: 'hub',
  })

  const hubSeed = drawNativeInteger(state.gameRng, 0x40000000)
  const reconstructedHub = createHubWorld(['owner'], {
    traderAnimationSeed: hubSeed.value,
  })
  const restored = restoreGameSaveDocument(document)
  assert.equal(restored.playerId, 'owner')
  assert.equal(restored.integrity, 'local-only')
  assert.deepEqual(restored.mods, MODS)
  assert.deepEqual(restored.modState, MOD_STATE)
  assert.equal(restored.loadedBoneyard, null)
  assert.equal(restored.state.tick, state.tick)
  assert.deepEqual(restored.state.playerEntities.identities, [{ playerId: 'owner' }])
  assert.deepEqual(restored.state.playerEntities.configs, [OWNER])
  assert.deepEqual(
    restored.state.playerEntities.economies[0],
    state.playerEntities.economies[0],
  )

  const schemaSeventeen = JSON.parse(document)
  schemaSeventeen.schemaVersion = 17
  downgradePlayerBeltsToLegacyQuickbar(
    schemaSeventeen.continuation.simulation.playerEntities,
  )
  assert.deepEqual(
    restoreGameSaveDocument(JSON.stringify(schemaSeventeen)).state.playerEntities.belts[0],
    state.playerEntities.belts[0],
  )

  const schemaTwelve = JSON.parse(document)
  schemaTwelve.schemaVersion = 12
  delete schemaTwelve.nativeSource
  downgradePlayerBeltsToLegacyQuickbar(
    schemaTwelve.continuation.simulation.playerEntities,
  )
  delete schemaTwelve.profile.economy.collegeIntroPending
  delete schemaTwelve.continuation.simulation.playerEntities.economies[0]
    .collegeIntroPending
  delete schemaTwelve.continuation.simulation.world.participants.owner.collegeIntro
  const migratedProfile = restoreGameSaveProfile(JSON.stringify(schemaTwelve))
  const migratedContinuation = restoreGameSaveDocument(JSON.stringify(schemaTwelve))
  assert.equal(migratedProfile.economy.collegeIntroPending, false)
  assert.equal(
    migratedContinuation.state.playerEntities.economies[0]?.collegeIntroPending,
    false,
  )
  schemaTwelve.schemaVersion = 13
  assert.throws(
    () => restoreGameSaveProfile(JSON.stringify(schemaTwelve)),
    /College intro state is invalid/,
  )
  assert.deepEqual(
    restored.state.playerEntities.progressions[0],
    state.playerEntities.progressions[0],
  )
  assert.equal(restored.state.world.kind, 'hub')
  if (restored.state.world.kind !== 'hub') throw new Error('expected restored Hub')
  assert.deepEqual(restored.state.world.skorcha, reconstructedHub.skorcha)
  assert.equal(
    restored.state.world.skorchaTransitionTicksRemaining,
    reconstructedHub.skorchaTransitionTicksRemaining,
  )
  assert.deepEqual(restored.state.gameRng, hubSeed.state)
  assert.ok(restored.state.world.runtime instanceof HubWorldRuntime)
  assert.ok(restored.state.world.studentPopulation instanceof HubStudentPopulationState)
  assert.deepEqual(Object.keys(restored.state.world.participants), ['owner'])
  assert.deepEqual(restored.state.playerEntities.locomotions[0]?.position, HUB_SPAWN)
  assert.equal(restored.state.world.participants.owner?.region, 'courtyard')
  assert.equal(restored.state.world.participants.owner?.transition, null)
})

test('restore drops only the stale completed-Tutorial attachment from a Hub College save', () => {
  const tutorial = materializeStockTutorial(Buffer.alloc(16, 31))
  let state = enterBoneyardWorld(createGameSimulation({ owner: OWNER }), tutorial)
  state = {
    ...state,
    run: {
      ...state.run,
      gameOverEventId: 1,
      gameOverExitKind: 'automatic',
      gameOverExitTicks: GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
      gameOverTicks: 1_200,
      nextGameOverEventId: 2,
      phase: 'game-over',
    },
  }
  state = stepGameSimulationTick(state, {})
  assert.equal(state.world.kind, 'hub')
  assert.equal(state.run.phase, 'hub')
  assert.equal(getPlayerEconomy(state, 'owner').tutorialPending, false)

  const clean = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  })
  const affected = JSON.parse(clean)
  affected.continuation.loadedBoneyard = tutorial
  const restored = restoreGameSaveDocument(JSON.stringify(affected))
  assert.equal(restored.loadedBoneyard, null)
  assert.equal(restored.state.world.kind, 'hub')
  assert.equal(
    restored.state.world.kind === 'hub'
      ? restored.state.world.participants.owner?.collegeIntro?.phase
      : null,
    'courtyard-walk',
  )

  const ordinary = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 37),
  )
  assert.ok(ordinary)
  affected.continuation.loadedBoneyard = ordinary
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(affected)),
    /Hub game save carries a Boneyard/,
  )
})

test('save creation rejects every world and Boneyard attachment mismatch', () => {
  const tutorial = materializeStockTutorial(Buffer.alloc(16, 31))
  const hub = createGameSimulation({ owner: OWNER })
  assert.throws(() => createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: tutorial,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: hub,
  }), /Hub game save carries a Boneyard/)

  const active = enterBoneyardWorld(hub, tutorial)
  assert.throws(() => createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: active,
  }), /Boneyard game save is missing its loaded content/)

  const other = materializeStockTutorial(Buffer.alloc(16, 32))
  assert.notEqual(other.runId, tutorial.runId)
  assert.throws(() => createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: other,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: active,
  }), /Boneyard run ownership is inconsistent/)
})

test('save restore repairs only the superseded vivid starter pair to the Stock roll', () => {
  const character = { ...OWNER, element: 'fire' as const }
  let state = createGameSimulation({ owner: character })
  const economy = getPlayerEconomy(state, 'owner')
  const vividTints = [0xff1919, 0xffffff] as const
  const appearance = rollNativeStarterEquipmentAppearance(
    createNativeRng(getPlayerProgression(state, 'owner').offerSeed),
    'fire',
  )
  const stockTints = [appearance.primaryTint, appearance.secondaryTint] as const
  const staleEconomy = {
    ...economy,
    collegeIntroPending: false,
    equipment: {
      ...economy.equipment,
      hat: { ...economy.equipment.hat!, iconTints: vividTints },
      robe: { ...economy.equipment.robe!, iconTints: vividTints },
    },
    revision: 7,
    tutorialPending: false,
  }
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', staleEconomy),
  }
  const continuation = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  })
  const restored = restoreGameSaveDocument(continuation).state
  const restoredEconomy = getPlayerEconomy(restored, 'owner')
  assert.deepEqual(restoredEconomy.equipment.hat?.iconTints, stockTints)
  assert.deepEqual(restoredEconomy.equipment.robe?.iconTints, stockTints)
  assert.equal(restoredEconomy.revision, 8)

  const profile = restoreGameSaveProfile(createGameProfileSaveDocument({
    integrity: 'global-clean',
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  }))
  const profileTints = profile.economy.equipment.hat?.iconTints
  assert.ok(profileTints)
  assert.notDeepEqual(profileTints, vividTints)
  assert.deepEqual(profile.economy.equipment.robe?.iconTints, profileTints)
  const fresh = createGameSimulation({ owner: character })
  const hydrated = hydrateGameSaveProfile(fresh, 'owner', profile)
  const hydratedEconomy = getPlayerEconomy(hydrated, 'owner')
  assert.deepEqual(hydratedEconomy.equipment.hat?.iconTints, profileTints)
  assert.deepEqual(hydratedEconomy.equipment.robe?.iconTints, profileTints)
  assert.equal(hydratedEconomy.revision, 8)

  const collegeTints = [0x6f7e72, 0xffffff] as const
  const collegeState = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', {
      ...staleEconomy,
      collegeIntroPending: true,
      equipment: {
        ...staleEconomy.equipment,
        hat: { ...staleEconomy.equipment.hat!, iconTints: collegeTints },
        robe: { ...staleEconomy.equipment.robe!, iconTints: collegeTints },
      },
    }),
  }
  const pending = restoreGameSaveDocument(createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: collegeState,
  })).state
  assert.deepEqual(getPlayerEconomy(pending, 'owner').equipment.hat?.iconTints, collegeTints)
  assert.deepEqual(getPlayerEconomy(pending, 'owner').equipment.robe?.iconTints, collegeTints)
})

test('Hub resume reconstructs its authoritative Skorcha population with the other Region actors', () => {
  const state = createGameSimulation({ owner: OWNER }, {
    hubTraderAnimationSeed: 2,
    gameRngSeed: 91,
  })
  const hubSeed = drawNativeInteger(state.gameRng, 0x40000000)
  const reconstructedHub = createHubWorld(['owner'], {
    traderAnimationSeed: hubSeed.value,
  })
  const serializedVariant = reconstructedHub.skorcha?.variant === 0 ? 1 : 0
  const serializedSkorcha = createHubSkorchaAtVariant(
    createNativeRng(317),
    serializedVariant,
  )
  const document = JSON.parse(createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  }))
  document.continuation.simulation.playerEntities.locomotions[0].position = {
    x: 1_700,
    y: 700,
  }
  document.continuation.simulation.world.participants.owner = {
    collegeIntro: null,
    region: 'library',
    transition: null,
  }
  document.continuation.simulation.world.skorcha = serializedSkorcha
  document.continuation.simulation.world.traderAnimationSeed = 2

  const restored = restoreGameSaveDocument(JSON.stringify(document))
  assert.equal(restored.state.world.kind, 'hub')
  assert.deepEqual(restored.state.playerEntities.locomotions[0]?.position, { x: 1_700, y: 700 })
  if (restored.state.world.kind !== 'hub') throw new Error('expected restored Hub')
  assert.equal(restored.state.world.participants.owner?.region, 'library')
  assert.equal(restored.state.world.participants.owner?.transition, null)
  assert.equal(restored.state.world.traderAnimationSeed, hubSeed.value)
  assert.deepEqual(restored.state.world.skorcha, reconstructedHub.skorcha)
  assert.notDeepEqual(restored.state.world.skorcha, serializedSkorcha)
  assert.deepEqual(restored.state.gameRng, hubSeed.state)
})

test('schema 16 resumes every College admission phase and its exact player position', () => {
  const resume = (state: ReturnType<typeof createGameSimulation>) => restoreGameSaveDocument(
    createGameSaveDocument({
      integrity: 'global-clean',
      loadedBoneyard: null,
      mods: [],
      modState: {},
      playerId: 'owner',
      state,
    }),
  ).state
  const participant = (state: ReturnType<typeof createGameSimulation>) => (
    state.world.kind === 'hub' ? state.world.participants.owner : null
  )
  const assertResumed = (source: ReturnType<typeof createGameSimulation>) => {
    const restored = resume(source)
    assert.deepEqual(participant(restored), participant(source))
    assert.deepEqual(
      restored.playerEntities.locomotions[0]?.position,
      source.playerEntities.locomotions[0]?.position,
    )
    return restored
  }
  const step = (source: ReturnType<typeof createGameSimulation>) => stepGameSimulationTick(
    source,
    { owner: createIdlePlayerCharacterInput() },
    { collegeIntroReadyPlayerIds: new Set(['owner']) },
  )
  const advanceUntil = (
    source: ReturnType<typeof createGameSimulation>,
    phase: 'office-walk' | 'arch-dialogue',
  ) => {
    let current = source
    for (let ticks = 0; ticks < 4_000 && participant(current)?.collegeIntro?.phase !== phase; ticks += 1) {
      current = step(current)
    }
    assert.equal(participant(current)?.collegeIntro?.phase, phase)
    return current
  }

  let state = armGameSimulationCollegeIntro(createGameSimulation({ owner: OWNER }), 'owner')
  for (let ticks = 0; ticks < 50; ticks += 1) state = step(state)
  assert.equal(participant(state)?.collegeIntro?.phase, 'courtyard-walk')
  state = assertResumed(state)
  state = assertResumed(advanceUntil(state, 'office-walk'))
  state = assertResumed(advanceUntil(state, 'arch-dialogue'))

  const acknowledged = applyGameSimulationHubAction(state, 'owner', {
    type: 'acknowledge-college-intro-dialogue',
  })
  assert.equal(acknowledged.accepted, true)
  const restoredAcknowledged = assertResumed(acknowledged.state)
  assert.equal(participant(restoredAcknowledged)?.collegeIntro, null)
  assert.equal(participant(restoredAcknowledged)?.region, 'office')
  assert.equal(hubCollegeAdmissionPreLoadout(
    participant(restoredAcknowledged) ?? undefined,
    getPlayerEconomy(restoredAcknowledged, 'owner').collegeIntroPending,
  ), true)
  assert.strictEqual(
    armGameSimulationCollegeIntro(restoredAcknowledged, 'owner'),
    restoredAcknowledged,
  )
  if (restoredAcknowledged.world.kind !== 'hub') throw new Error('expected restored Hub')
  const collegeLoadout = assertResumed({
    ...restoredAcknowledged,
    world: {
      ...restoredAcknowledged.world,
      participants: {
        ...restoredAcknowledged.world.participants,
        owner: {
          collegeIntro: null,
          region: 'courtyard',
          transition: {
            alpha: 1,
            destination: 'courtyard',
            phase: 'college-loadout',
            scriptedSpeed: 1,
            scriptedTarget: { x: 952.5, y: 157.5 },
            sourceRegion: 'office',
          },
        },
      },
    },
  })
  assert.equal(hubCollegeAdmissionPreLoadout(
    participant(collegeLoadout) ?? undefined,
    getPlayerEconomy(collegeLoadout, 'owner').collegeIntroPending,
  ), true)
  if (collegeLoadout.world.kind !== 'hub') throw new Error('expected restored Hub')
  const returnedIncoming = assertResumed({
    ...collegeLoadout,
    world: {
      ...collegeLoadout.world,
      participants: {
        ...collegeLoadout.world.participants,
        owner: {
          ...collegeLoadout.world.participants.owner!,
          transition: {
            ...collegeLoadout.world.participants.owner!.transition!,
            phase: 'incoming',
          },
        },
      },
    },
  })
  assert.equal(hubCollegeAdmissionPreLoadout(
    participant(returnedIncoming) ?? undefined,
    getPlayerEconomy(returnedIncoming, 'owner').collegeIntroPending,
  ), false)
})

test('a client-held save cannot fork the process-owned shared memorial', () => {
  let state = createGameSimulation({ owner: OWNER })
  if (state.world.kind !== 'hub') throw new Error('expected Hub')
  state = {
    ...state,
    world: {
      ...state.world,
      memorial: archiveHubMemorialPortrait(state.world.memorial, {
        accountUsername: 'owner',
        awesomeness: 4_567,
        awesomestKill: 'Horned Skeleton',
        capturedAtTick: 300,
        config: OWNER,
        elapsedTicks: 12_345,
        equipment: { hat: null, robe: null, weapon: null },
        headingIndex: 12,
        level: 7,
        monstersKilled: 321,
        playerId: 'owner',
        portraitScale: 0.925,
        runId: 'completed-run',
        wave: 12,
      }, 0),
    },
  }
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  })
  const encoded = JSON.parse(document)
  assert.equal('memorial' in encoded.continuation.simulation.world, false)
  const restored = restoreGameSaveDocument(document)
  if (restored.state.world.kind !== 'hub') throw new Error('expected restored Hub')
  assert.equal(restored.state.world.memorial.nextAge, 1001)
  assert.equal(restored.state.world.memorial.slots.every(({ portrait }) => portrait === null), true)
})

test('native NPC help rows persist after acknowledgement and pre-v11 saves migrate as acknowledged', () => {
  const initial = createGameSimulation({ owner: OWNER })
  const acknowledged = applyGameSimulationHubAction(initial, 'owner', {
    interactionId: 'annalist',
    type: 'acknowledge-npc-hint',
  })
  assert.equal(acknowledged.accepted, true)
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: acknowledged.state,
  })
  assert.deepEqual(
    restoreGameSaveDocument(document).state.playerEntities.economies[0]?.npc.helpFlags,
    [false, true, true, true, true, true, true, true, true, true],
  )

  const legacy = JSON.parse(document)
  legacy.schemaVersion = 10
  delete legacy.nativeSource
  downgradePlayerBeltsToLegacyQuickbar(
    legacy.continuation.simulation.playerEntities,
  )
  delete legacy.profile.economy.collegeIntroPending
  delete legacy.continuation.simulation.playerEntities.economies[0].collegeIntroPending
  delete legacy.continuation.simulation.world.participants.owner.collegeIntro
  delete legacy.profile.economy.npc.helpFlags
  delete legacy.continuation.simulation.playerEntities.economies[0].npc.helpFlags
  assert.deepEqual(
    restoreGameSaveDocument(JSON.stringify(legacy))
      .state.playerEntities.economies[0]?.npc.helpFlags,
    Array<boolean>(10).fill(false),
  )

  legacy.schemaVersion = 12
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(legacy)),
    /Hub NPC help flags are missing/,
  )
})

test('save documents admit the complete Sack wire depth and reject one level beyond it', () => {
  const sackChain = (deepestDepth: number): HubInventoryItem => {
    let item: HubInventoryItem | null = null
    for (let depth = deepestDepth; depth >= 0; depth -= 1) {
      item = {
        contents: item === null ? [] : [item],
        equipmentType: null,
        iconRecords: [70],
        id: 920_000 + depth,
        kind: 'sack',
        name: `Sack ${depth}`,
        nativeSubtype: 0,
        nativeTypeId: 7008,
        quantity: 1,
        rarity: null,
        recipeIndex: null,
      }
    }
    return item!
  }
  const withDepth = (deepestDepth: number) => {
    const initial = createGameSimulation({ owner: OWNER })
    const economy = getPlayerEconomy(initial, 'owner')
    return {
      ...initial,
      playerEntities: replacePlayerEconomy(initial.playerEntities, 'owner', {
        ...economy,
        backpack: [sackChain(deepestDepth)],
        nextItemId: 930_000,
      }),
    }
  }
  const document = createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: withDepth(HUB_SACK_REPLICATION_DEPTH_LIMIT),
  })

  const restored = restoreGameSaveDocument(document)
  const retiredProfile = restoreGameSaveProfile(document)
  assert.equal(retiredProfile.economy.storage.at(-1)?.kind, 'sack')
  assert.equal(
    restored.state.playerEntities.economies[0]?.backpack[0]?.id,
    920_000,
  )
  assert.throws(() => createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: withDepth(HUB_SACK_REPLICATION_DEPTH_LIMIT + 1),
  }), /inventory is invalid/)
  const malformed = JSON.parse(document)
  malformed.continuation.simulation.playerEntities.economies[0].backpack = [
    sackChain(HUB_SACK_REPLICATION_DEPTH_LIMIT + 1),
  ]
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(malformed)),
    /inventory is invalid/,
  )
})

test('current saves retain exact nested and equipped belt identities and reject owner drift', () => {
  let state = createGameSimulation({ owner: OWNER })
  const economy = getPlayerEconomy(state, 'owner')
  const ringRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'ring')!
  const ring = createEquipmentInventoryItem(ringRecipe, economy.nextItemId)
  const sack: HubInventoryItem = {
    contents: [ring],
    equipmentType: null,
    iconRecords: [70],
    id: economy.nextItemId + 1,
    kind: 'sack',
    name: 'Saved belt Sack',
    nativeSubtype: 0,
    nativeTypeId: 7008,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', {
      ...economy,
      backpack: [...economy.backpack, sack],
      nextItemId: economy.nextItemId + 2,
    }),
  }
  const bound = applyGameSimulationHubAction(state, 'owner', {
    itemId: ring.id,
    slot: 2,
    type: 'bind-belt-item',
  })
  assert.equal(bound.accepted, true)
  const equipped = applyGameSimulationHubAction(bound.state, 'owner', {
    slot: 2,
    type: 'activate-belt-slot',
  })
  assert.equal(equipped.accepted, true)
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: equipped.state,
  })
  const restored = restoreGameSaveDocument(document)
  assert.deepEqual(getPlayerBelt(restored.state, 'owner')[2], {
    itemId: ring.id,
    kind: 'item',
    nativeTypeId: 7002,
  })
  assert.equal(getPlayerEconomy(restored.state, 'owner').equipment.rings[0]?.id, ring.id)

  const drifted = JSON.parse(document)
  drifted.continuation.simulation.playerEntities.belts[0][2].itemId += 100_000
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(drifted)),
    /player belt 0 slot 2 item is invalid/,
  )
})

test('schema-4 saves normalize pre-unforge and pre-Hagatha runtime fields', () => {
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: MODS,
    modState: MOD_STATE,
    playerId: 'owner',
    state: createGameSimulation({ owner: OWNER }),
  })
  const parsed = JSON.parse(legacyDocument(document, 4))
  const economy = parsed.simulation.playerEntities.economies[0]
  economy.ownedPerkSelectors = [7, 24, 25]
  delete economy.unforgeBonuses
  delete parsed.simulation.playerEntities.progressions[0].hagathaRuntime
  delete parsed.simulation.playerEntities.skillBooks[0].weldComponentRanks
  economy.actionFeedback = {
    accepted: true,
    action: 'consume',
    dowsingPitch: null,
    reason: null,
    sequence: 1,
    transferDirection: null,
    transferGesture: null,
  }
  const restored = restoreGameSaveDocument(JSON.stringify(parsed))
  assert.deepEqual(restored.state.playerEntities.economies[0]?.unforgeBonuses, {
    experience: 0,
    manaCostReduction: 0,
    maximumHealth: 0,
    maximumMana: 0,
    offensiveDamage: 0,
    recipeAttemptCount: 0,
  })
  assert.equal(
    restored.state.playerEntities.economies[0]?.actionFeedback?.unforgeOutcome,
    null,
  )
  assert.deepEqual(restored.state.playerEntities.progressions[0]?.hagathaRuntime, {
    cheatDeathCharges: 1,
    reverieActive: true,
    serendipityActive: true,
  })
  assert.equal(restored.state.playerEntities.skillBooks[0]?.weldComponentRanks, null)
  assert.equal(restored.state.playerEntities.economies[0]?.tutorialPending, false)
})

test('host save documents retain the active Boneyard and its authoritative run id', () => {
  const loadedBoneyard = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 7),
  )
  assert.ok(loadedBoneyard)
  let state = enterBoneyardWorld(
    createGameSimulation({ owner: OWNER }),
    loadedBoneyard,
  )
  if (state.world.kind !== 'boneyard' || state.world.encounter === null) {
    throw new Error('expected active Boneyard encounter')
  }
  state = {
    ...state,
    world: {
      ...state.world,
      encounter: {
        ...state.world.encounter,
        escapeCollisionSourceIds: ['scenery:grave-4'],
        escapeTarget: { x: 980, y: 3000 },
      },
      waves: state.world.waves === null
        ? null
        : {
            ...state.world.waves,
            portalPhaseIndex: 0,
            portalScriptPhase: 'boss-wait',
            portalSpawnRemaining: 0,
            portalTicksRemaining: 123,
            portalTimelinePaused: true,
            slumpgutPhase: 'script-sleep',
            slumpgutTicksRemaining: 731,
          },
    },
  }
  const document = createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard,
    mods: MODS,
    modState: MOD_STATE,
    partyRejoinToken: SIGNED_PARTY_RECOVERY_CLAIM,
    playerId: 'owner',
    state,
  })
  const restored = restoreGameSaveDocument(document)

  assert.deepEqual(readGameSaveSummary(document), {
    activeRun: true,
    character: OWNER,
    partyRejoinToken: SIGNED_PARTY_RECOVERY_CLAIM,
    phase: 'active',
    playerId: 'owner',
    savedAtTick: state.tick,
    worldKind: 'boneyard',
  })
  const schema5 = legacySchema5Document(document)
  assert.equal(readGameSaveSummary(schema5)?.activeRun, true)
  assert.equal(readGameSaveSummary(schema5)?.partyRejoinToken, null)
  assert.equal(restoreGameSaveDocument(schema5).state.world.kind, 'boneyard')

  assert.deepEqual(restored.loadedBoneyard, loadedBoneyard)
  assert.equal(restored.state.world.kind, 'boneyard')
  if (restored.state.world.kind !== 'boneyard') throw new Error('expected restored Boneyard')
  assert.equal(restored.state.world.runId, loadedBoneyard.runId)
  assert.ok(restored.state.world.encounter?.digBodyBobAmplitude >= 5)
  assert.ok(restored.state.world.encounter?.digBodyBobAmplitude < 10)
  assert.equal(restored.state.world.encounter?.digBodyOffsetY, 0)
  assert.deepEqual(restored.state.world.encounter?.digEvents, [])
  assert.deepEqual(restored.state.world.encounter?.escapeCollisionSourceIds, [
    'scenery:grave-4',
  ])
  assert.deepEqual(restored.state.world.encounter?.escapeTarget, { x: 980, y: 3000 })
  assert.equal(restored.state.world.waves?.slumpgutPhase, 'script-sleep')
  assert.equal(restored.state.world.waves?.slumpgutTicksRemaining, 731)
  assert.equal(restored.state.world.waves?.portalScriptPhase, 'boss-wait')
  assert.equal(restored.state.world.waves?.portalTicksRemaining, 123)
  assert.equal(restored.state.world.waves?.portalTimelinePaused, true)
  assert.deepEqual(
    restored.state.world.waves?.portalProgram,
    state.world.kind === 'boneyard' ? state.world.waves?.portalProgram : null,
  )
  assert.deepEqual(restored.state.world.hallOfFameRuns, state.world.kind === 'boneyard'
    ? state.world.hallOfFameRuns
    : {})
  assert.deepEqual(restored.state.world.enemyWorldFeedback, state.world.kind === 'boneyard'
    ? state.world.enemyWorldFeedback
    : {})
  assert.equal(restored.state.run.runId, loadedBoneyard.runId)
  assert.equal(restored.state.run.phase, 'active')
})

test('active-party capability is strict, active-run-only, and absent from old schemas and profiles', () => {
  const loadedBoneyard = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 37),
  )
  assert.ok(loadedBoneyard)
  const state = enterBoneyardWorld(createGameSimulation({ owner: OWNER }), loadedBoneyard)
  const current = JSON.parse(createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    partyRejoinToken: SIGNED_PARTY_RECOVERY_CLAIM,
    playerId: 'owner',
    state,
  }))

  for (const schemaVersion of [11, 10]) {
    const previous = structuredClone(current)
    previous.schemaVersion = schemaVersion
    delete previous.nativeSource
    previous.continuation.summary.partyRejoinToken = 'A'.repeat(43)
    assert.equal(
      readGameSaveSummary(JSON.stringify(previous))?.partyRejoinToken,
      'A'.repeat(43),
    )
  }

  for (const schemaVersion of [9, 8, 7, 6]) {
    const previous = structuredClone(current)
    previous.schemaVersion = schemaVersion
    delete previous.nativeSource
    delete previous.continuation.summary.partyRejoinToken
    assert.equal(
      readGameSaveSummary(JSON.stringify(previous))?.partyRejoinToken,
      null,
    )
  }

  const malformed = structuredClone(current)
  malformed.continuation.summary.partyRejoinToken = 'short'
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(malformed)),
    /party rejoin token/i,
  )
  assert.throws(() => createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    partyRejoinToken: SIGNED_PARTY_RECOVERY_CLAIM,
    playerId: 'owner',
    state: createGameSimulation({ owner: OWNER }),
  }), /active Boneyard/i)

  const profile = JSON.parse(createGameProfileSaveDocument({
    integrity: 'global-clean',
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  }))
  assert.equal(profile.continuation, null)
  assert.doesNotMatch(JSON.stringify(profile), /partyRejoinToken/)
  const retired = JSON.parse(retireGameSaveWizard(JSON.stringify(current)))
  assert.equal(retired.continuation, null)
  assert.doesNotMatch(JSON.stringify(retired), /partyRejoinToken/)
})

test('current saves migrate the former audio-only Dig lane without replaying dirt', () => {
  const loadedBoneyard = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 17),
  )
  assert.ok(loadedBoneyard)
  const document = JSON.parse(createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: enterBoneyardWorld(createGameSimulation({ owner: OWNER }), loadedBoneyard),
  }))
  const encounter = document.continuation.simulation.world.encounter
  delete encounter.digBodyBobAmplitude
  delete encounter.digBodyOffsetY
  delete encounter.digEventId
  delete encounter.digEvents
  delete encounter.escapeCollisionSourceIds
  delete encounter.escapeTarget
  encounter.digAudioEventId = 12
  encounter.digAudioEvents = [{ cue: 'throw-dirt-1', id: 12 }]

  const restored = restoreGameSaveDocument(JSON.stringify(document))
  assert.equal(restored.state.world.kind, 'boneyard')
  if (restored.state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(restored.state.world.encounter?.digEventId, 12)
  assert.deepEqual(restored.state.world.encounter?.digEvents, [])
  assert.equal('digAudioEventId' in restored.state.world.encounter!, false)
  assert.equal('digAudioEvents' in restored.state.world.encounter!, false)
  assert.ok(restored.state.world.encounter!.digBodyBobAmplitude >= 5)
  assert.ok(restored.state.world.encounter!.digBodyBobAmplitude < 10)
  assert.deepEqual(restored.state.world.encounter!.escapeCollisionSourceIds, [])
  assert.equal(restored.state.world.encounter!.escapeTarget, null)
})

test('schema 18 resumes Frost speed and Arrow Chill accumulation through schema 19', () => {
  const loadedBoneyard = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 23),
  )
  assert.ok(loadedBoneyard)
  const waterCharacter = { ...OWNER, element: 'water' as const }
  let state = enterBoneyardWorld(createGameSimulation({ owner: waterCharacter }), loadedBoneyard)
  state = stepGameSimulationTick(state, { owner: createIdlePlayerCharacterInput() })
  const document = JSON.parse(createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  }))
  const simulation = document.continuation.simulation
  const worldKey = `boneyard:${loadedBoneyard.runId}`
  const painterRegistration = {
    managerLane: 'transient',
    registrationOrdinal: simulation.worldManagerOrder.nextRegistrationOrdinal.transient++,
  }
  simulation.primarySpells = {
    nextId: 2,
    projectiles: [],
    transients: [{
      ageTicks: 1,
      direction: { x: 1, y: 0 },
      id: 1,
      kind: 'water',
      lightRegistration: null,
      obstructionDistance: null,
      obstructionPoint: null,
      origin: { x: 250, y: 250 },
      ownerId: 'owner',
      painterRegistrations: [painterRegistration],
      speed: 4,
      underpowered: false,
      variant: 0,
      worldKey,
    }],
  }
  const enemies = simulation.world.enemies
  const arrowId = enemies.nextProjectileId
  enemies.projectiles = [{
    ageTicks: 1,
    bounceVelocity: 0,
    chillTumbleAccumulator: 0,
    coldSlowTicks: 0,
    contactRadius: 8,
    damage: 1,
    headingDeg: 90,
    hitPlayerIds: [],
    homing: false,
    id: arrowId,
    kind: 'arrow',
    lastStepTick: state.tick,
    lightRegistration: null,
    lifetimeTicks: 300,
    minimumSpeed: 0,
    nativeCellBindingOrder: enemies.nextNativeCellBindingOrder,
    nativeRegistrationOrder: enemies.nextNativeRegistrationOrder,
    nativeTypeId: 0x7da,
    ownerActorId: 1,
    payload: 'normal',
    poisonDamage: 0,
    poisonDuration: 0,
    position: { x: 330, y: 250 },
    settledTicksRemaining: 300,
    spawnTick: state.tick - 1,
    speed: 0,
    targetPlayerId: null,
    verticalOffset: -25,
    verticalVelocity: 0,
    visualPhaseDeg: 0,
    visualScale: 1,
  }]
  enemies.nextProjectileId = arrowId + 1
  enemies.nextNativeCellBindingOrder += 1
  enemies.nextNativeRegistrationOrder += 1

  const current = restoreGameSaveDocument(JSON.stringify(document))
  assert.equal(current.state.primarySpells.transients[0]?.kind, 'water')
  assert.equal(
    current.state.primarySpells.transients[0]?.kind === 'water'
      ? current.state.primarySpells.transients[0].speed
      : null,
    4,
  )
  assert.equal(
    current.state.world.kind === 'boneyard'
      ? current.state.world.enemies.projectiles[0]?.chillTumbleAccumulator
      : null,
    0,
  )

  const legacy = structuredClone(document)
  legacy.schemaVersion = 18
  delete legacy.continuation.simulation.primarySpells.transients[0].painterRegistrations
  delete legacy.continuation.simulation.primarySpells.transients[0].speed
  delete legacy.continuation.simulation.world.enemies.projectiles[0].chillTumbleAccumulator
  const migrated = restoreGameSaveDocument(JSON.stringify(legacy))
  assert.equal(
    migrated.state.primarySpells.transients[0]?.kind === 'water'
      ? migrated.state.primarySpells.transients[0].speed
      : null,
    4,
  )
  assert.equal(
    migrated.state.world.kind === 'boneyard'
      ? migrated.state.world.enemies.projectiles[0]?.chillTumbleAccumulator
      : null,
    0,
  )

  const missingCurrent = structuredClone(document)
  delete missingCurrent.continuation.simulation.primarySpells.transients[0].speed
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(missingCurrent)),
    /Water transient 0 speed/,
  )
  const missingAccumulator = structuredClone(document)
  const missingArrow = missingAccumulator.continuation.simulation.world.enemies.projectiles[0]
  delete missingArrow.chillTumbleAccumulator
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(missingAccumulator)),
    /enemy projectile 0 Chill accumulator/,
  )
})

test('current schema resumes the complete stock Tutorial controller and exact level identity', () => {
  const loadedBoneyard = materializeStockTutorial(Buffer.alloc(16, 19))
  let state = enterBoneyardWorld(
    createGameSimulation({ owner: OWNER }),
    loadedBoneyard,
  )
  const tutorialEconomy = getPlayerEconomy(state, 'owner')
  const inserted = insertLootInventoryItem(tutorialEconomy, nativeTutorialAmuletItem())
  assert.equal(inserted.accepted, true)
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(
      state.playerEntities,
      'owner',
      inserted.state,
    ),
  }
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  })
  const encoded = JSON.parse(document)
  assert.equal(encoded.schemaVersion, 26)
  assert.equal(encoded.continuation.simulation.world.tutorial.stage, 0)
  assert.equal(
    encoded.continuation.simulation.world.tutorial.movementInstructionAcknowledged,
    false,
  )
  assert.equal(
    encoded.continuation.simulation.world.tutorial.selectedSkillHudAcknowledged,
    false,
  )
  assert.equal(encoded.continuation.simulation.world.tutorial.cameraLockAgeTicks, 0)
  assert.deepEqual(
    encoded.profile.economy,
    encoded.continuation.simulation.world.tutorialProfileEconomy,
  )
  assert.equal(encoded.profile.economy.backpack.length, 2)
  assert.deepEqual(
    encoded.continuation.simulation.playerEntities.economies[0].backpack[0],
    { ...nativeTutorialAmuletItem(), id: tutorialEconomy.nextItemId, inventorySlot: 0 },
  )
  const retired = JSON.parse(retireGameSaveWizard(document))
  assert.equal(retired.continuation, null)
  assert.equal(retired.profile.economy.tutorialPending, false)
  assert.deepEqual(
    { ...retired.profile.economy, tutorialPending: true },
    encoded.continuation.simulation.world.tutorialProfileEconomy,
  )

  const restored = restoreGameSaveDocument(document)
  assert.equal(restored.loadedBoneyard?.choice.id, 'stock-tutorial')
  assert.equal(restored.loadedBoneyard?.sourceSha256, '97802f2ca45d9bc6f90a497e7c12a55926298161e191fa70eee5e666b90106ed')
  assert.equal(restored.state.world.kind, 'boneyard')
  assert.deepEqual(
    restored.state.playerEntities.economies[0]?.backpack[0],
    { ...nativeTutorialAmuletItem(), id: tutorialEconomy.nextItemId, inventorySlot: 0 },
  )
  if (restored.state.world.kind !== 'boneyard') throw new Error('expected Tutorial')
  assert.deepEqual(restored.state.world.tutorial, state.world.kind === 'boneyard'
    ? state.world.tutorial
    : null)
  assert.equal(restored.state.world.encounter?.dialogueMode, 'tutorial')
  assert.equal(restored.state.world.waves, null)
  assert.equal(restored.state.world.arenaTransition, null)

  const missingCurrentMovement = structuredClone(encoded)
  delete missingCurrentMovement.continuation.simulation.world.tutorial
    .movementInstructionAcknowledged
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(missingCurrentMovement)),
    /movementInstructionAcknowledged must be boolean/,
  )
  const malformedCurrentMovement = structuredClone(encoded)
  malformedCurrentMovement.continuation.simulation.world.tutorial
    .movementInstructionAcknowledged = 1
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(malformedCurrentMovement)),
    /movementInstructionAcknowledged must be boolean/,
  )

  const legacy = structuredClone(encoded)
  legacy.schemaVersion = 8
  delete legacy.nativeSource
  downgradePlayerBeltsToLegacyQuickbar(
    legacy.continuation.simulation.playerEntities,
  )
  delete legacy.continuation.summary.partyRejoinToken
  delete legacy.continuation.simulation.world.tutorial.cameraLockAgeTicks
  legacy.continuation.simulation.world.tutorial.cameraLockTriggered = true
  legacy.continuation.simulation.world.tutorial.cameraLockTicksRemaining = 0
  const migratedCamera = restoreGameSaveDocument(JSON.stringify(legacy))
  assert.equal(migratedCamera.state.world.kind, 'boneyard')
  if (migratedCamera.state.world.kind !== 'boneyard') throw new Error('expected Tutorial')
  assert.equal(
    migratedCamera.state.world.tutorial?.cameraLockAgeTicks,
    NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  )

  if (state.world.kind !== 'boneyard' || !state.world.tutorial) {
    throw new Error('expected Tutorial state')
  }
  const acknowledgedState = {
    ...state,
    world: {
      ...state.world,
      tutorial: {
        ...state.world.tutorial!,
        movementInstructionAcknowledged: true,
        selectedSkillHudAcknowledged: true,
      },
    },
  }
  const acknowledged = restoreGameSaveDocument(createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: acknowledgedState,
  }))
  assert.equal(
    acknowledged.state.world.kind === 'boneyard'
      ? acknowledged.state.world.tutorial?.selectedSkillHudAcknowledged
      : null,
    true,
  )
  assert.equal(
    acknowledged.state.world.kind === 'boneyard'
      ? acknowledged.state.world.tutorial?.movementInstructionAcknowledged
      : null,
    true,
  )

  const priorSchemaFifteen = structuredClone(encoded)
  priorSchemaFifteen.schemaVersion = 15
  delete priorSchemaFifteen.nativeSource
  downgradePlayerBeltsToLegacyQuickbar(
    priorSchemaFifteen.continuation.simulation.playerEntities,
  )
  delete priorSchemaFifteen.continuation.simulation.world.tutorial
    .movementInstructionAcknowledged
  const migratedMovement = restoreGameSaveDocument(JSON.stringify(priorSchemaFifteen))
  assert.equal(
    migratedMovement.state.world.kind === 'boneyard'
      ? migratedMovement.state.world.tutorial?.movementInstructionAcknowledged
      : null,
    false,
  )

  const priorSchemaSeven = structuredClone(encoded)
  priorSchemaSeven.schemaVersion = 7
  delete priorSchemaSeven.nativeSource
  downgradePlayerBeltsToLegacyQuickbar(
    priorSchemaSeven.continuation.simulation.playerEntities,
  )
  delete priorSchemaSeven.continuation.simulation.world.tutorial.cameraLockAgeTicks
  delete priorSchemaSeven.continuation.summary.partyRejoinToken
  delete priorSchemaSeven.continuation.simulation.world.tutorial
    .selectedSkillHudAcknowledged
  const migrated = restoreGameSaveDocument(JSON.stringify(priorSchemaSeven))
  assert.equal(
    migrated.state.world.kind === 'boneyard'
      ? migrated.state.world.tutorial?.selectedSkillHudAcknowledged
      : null,
    false,
  )
})

test('schema 7 and 6 saves migrate absent NPC state as acknowledged without archival', () => {
  const current = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: createGameSimulation({ owner: OWNER }),
  })
  const currentProfile = restoreGameSaveProfile(current)
  const acknowledgedNpc = {
    ...createNativeHubNpcState(),
    helpFlags: Array<boolean>(10).fill(false),
  }
  for (const schemaVersion of [7, 6]) {
    const previous = JSON.parse(current)
    previous.schemaVersion = schemaVersion
    delete previous.nativeSource
    downgradePlayerBeltsToLegacyQuickbar(
      previous.continuation.simulation.playerEntities,
    )
    delete previous.continuation.summary.partyRejoinToken
    delete previous.profile.economy.npc
    delete previous.profile.economy.collegeIntroPending
    delete previous.continuation.simulation.playerEntities.economies[0].npc
    delete previous.continuation.simulation.playerEntities.economies[0].collegeIntroPending
    delete previous.continuation.simulation.world.participants.owner.collegeIntro
    delete previous.continuation.simulation.world.skorcha
    const document = JSON.stringify(previous)
    const profile = restoreGameSaveProfile(document)
    const restored = restoreGameSaveDocument(document)
    assert.deepEqual(profile.economy, {
      ...currentProfile.economy,
      collegeIntroPending: false,
      npc: acknowledgedNpc,
    })
    assert.equal(restored.state.world.kind, 'hub')
    assert.deepEqual(getPlayerEconomy(restored.state, 'owner').npc, acknowledgedNpc)
  }
})

test('host save documents fail closed for unknown schema, extra fields, owner drift, and size', () => {
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: MODS,
    modState: MOD_STATE,
    playerId: 'owner',
    state: createGameSimulation({ owner: OWNER }),
  })
  const parsed = JSON.parse(document)

  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify({ ...parsed, schemaVersion: 999 })),
    /schema version/,
  )
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify({ ...parsed, surprise: true })),
    /unexpected field/,
  )
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify({
      ...parsed,
      continuation: {
        ...parsed.continuation,
        summary: { ...parsed.continuation.summary, playerId: 'someone-else' },
      },
    })),
    /owner/,
  )
  const invalidHagatha = structuredClone(parsed)
  invalidHagatha.continuation.simulation.playerEntities.progressions[0]
    .hagathaRuntime.cheatDeathCharges = 2
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(invalidHagatha)),
    /Hagatha runtime/,
  )
  const invalidWeld = structuredClone(parsed)
  invalidWeld.continuation.simulation.playerEntities.skillBooks[0].weldComponentRanks = [1]
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(invalidWeld)),
    /Weld cache/,
  )
  const invalidRun = structuredClone(parsed)
  invalidRun.continuation.summary.activeRun = true
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(invalidRun)),
    /active run/,
  )
  assert.throws(
    () => restoreGameSaveDocument('x'.repeat(MAX_WEB_GAME_SAVE_BYTES + 1)),
    /size limit/,
  )
})

test('schema 17 carries bounded native provenance through resume, profile archival, and retirement', () => {
  const nativeSource = {
    darkdataBase64: 'AA==',
    darkdataSha256: '0'.repeat(64),
    gamestateBase64: 'AA==',
    gamestateSha256: '1'.repeat(64),
    retainedFiles: [{
      base64: '',
      path: 'solomondark/Portraits/empty.raw',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    }],
    runName: '_survival',
  }
  const document = createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    nativeSource,
    playerId: 'owner',
    state: createGameSimulation({ owner: OWNER }),
  })
  assert.deepEqual(restoreGameSaveDocument(document).nativeSource, nativeSource)
  assert.deepEqual(restoreGameSaveProfile(document).nativeSource, nativeSource)
  assert.deepEqual(restoreGameSaveProfile(retireGameSaveWizard(document)).nativeSource, nativeSource)

  const malformed = JSON.parse(document)
  malformed.nativeSource.runName = '../escape'
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(malformed)),
    /native source/,
  )
  malformed.nativeSource.runName = '_survival'
  malformed.nativeSource.retainedFiles[0].path = 'solomondark/../escape.raw'
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify(malformed)),
    /retained file/,
  )
  const legacy = JSON.parse(document)
  legacy.schemaVersion = 16
  downgradePlayerBeltsToLegacyQuickbar(
    legacy.continuation.simulation.playerEntities,
  )
  delete legacy.nativeSource
  assert.equal(restoreGameSaveDocument(JSON.stringify(legacy)).nativeSource, null)
})

test('schema-3 saves migrate conservatively to local-only integrity', () => {
  const current = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: createGameSimulation({ owner: OWNER }),
  })

  const restored = restoreGameSaveDocument(legacyDocument(current, 3))
  assert.equal(restored.integrity, 'local-only')
})

test('schema-18 retains ordered Hagatha outcomes and schema 16 materializes Tonic rows', () => {
  let state = createGameSimulation({ owner: OWNER })
  const economy = getPlayerEconomy(state, 'owner')
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', {
      ...economy,
      charmCapacity: 9,
      ownedPerkSelectors: [5, 27, 0, 27],
      tonicPurchases: 2,
    }),
  }
  const document = createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  })
  assert.deepEqual(
    restoreGameSaveDocument(document).state.playerEntities.economies[0]?.ownedPerkSelectors,
    [5, 27, 0, 27],
  )

  const legacy = JSON.parse(document)
  legacy.schemaVersion = 16
  downgradePlayerBeltsToLegacyQuickbar(
    legacy.continuation.simulation.playerEntities,
  )
  delete legacy.nativeSource
  legacy.profile.economy.ownedPerkSelectors = [0, 5]
  legacy.continuation.simulation.playerEntities.economies[0].ownedPerkSelectors = [0, 5]
  assert.deepEqual(
    restoreGameSaveDocument(JSON.stringify(legacy))
      .state.playerEntities.economies[0]?.ownedPerkSelectors,
    [0, 5, 27, 27],
  )
  assert.deepEqual(
    restoreGameSaveProfile(JSON.stringify(legacy)).economy.ownedPerkSelectors,
    [0, 5, 27, 27],
  )
})

test('schema 23 repairs Tonic-inclusive overflow while schema 24 rejects it', () => {
  const document = JSON.parse(createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: createGameSimulation({ owner: OWNER }),
  }))
  const overflow = [27, 27, 0, 1, 2, 3, 4, 5, 6, 24, 25]
  const expected = overflow.slice(0, 9)
  const profileEconomy = document.profile.economy
  const continuationEconomy = document.continuation.simulation.playerEntities.economies[0]
  for (const economy of [profileEconomy, continuationEconomy]) {
    economy.charmCapacity = 9
    economy.firstMixedSelectors = [...new Set(overflow)]
    economy.ownedPerkSelectors = overflow
    economy.tonicPurchases = 2
  }
  document.profile.hagathaRuntime = {
    cheatDeathCharges: 0,
    reverieActive: true,
    serendipityActive: true,
  }
  document.continuation.simulation.playerEntities.progressions[0].hagathaRuntime = {
    cheatDeathCharges: 0,
    reverieActive: true,
    serendipityActive: true,
  }
  document.schemaVersion = 23

  const legacy = JSON.stringify(document)
  const restored = restoreGameSaveDocument(legacy)
  assert.deepEqual(restored.state.playerEntities.economies[0]?.ownedPerkSelectors, expected)
  assert.deepEqual(restored.state.playerEntities.progressions[0]?.hagathaRuntime, {
    cheatDeathCharges: 0,
    reverieActive: false,
    serendipityActive: false,
  })
  const profile = restoreGameSaveProfile(legacy)
  assert.deepEqual(profile.economy.ownedPerkSelectors, expected)
  assert.deepEqual(profile.hagathaRuntime, {
    cheatDeathCharges: 0,
    reverieActive: false,
    serendipityActive: false,
  })
  assert.equal(profile.economy.gold, continuationEconomy.gold)
  assert.deepEqual(profile.economy.firstMixedSelectors, [...new Set(overflow)])

  const lateTonics = structuredClone(document)
  lateTonics.profile.economy.ownedPerkSelectors = [0, 1, 2, 3, 4, 5, 6, 7, 9, 27, 27]
  assert.deepEqual(
    restoreGameSaveProfile(JSON.stringify(lateTonics)).economy.ownedPerkSelectors,
    [0, 1, 2, 3, 4, 5, 6, 27, 27],
  )

  document.schemaVersion = 24
  assert.throws(() => restoreGameSaveDocument(JSON.stringify(document)), /Hagatha|inventory/)
  assert.throws(() => restoreGameSaveProfile(JSON.stringify(document)), /Hagatha|inventory/)
})

test('known schema 1 through 5 continuations migrate through current authority', () => {
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: createGameSimulation({ owner: OWNER }),
  })

  for (const schemaVersion of [1, 2, 3, 4, 5]) {
    const migrated = schemaVersion === 5
      ? legacySchema5Document(document)
      : legacyDocument(document, schemaVersion)
    const restored = restoreGameSaveDocument(migrated)
    assert.equal(restored.playerId, 'owner')
    assert.equal(restored.state.world.kind, 'hub')
    assert.equal(readGameSaveSummary(migrated)?.activeRun, false)
    assert.equal(restored.state.playerEntities.identities[0]?.playerId, 'owner')
    assert.equal(restored.state.playerEntities.economies[0]?.tutorialPending, false)
    assert.equal(restored.state.run.gameOverExitKind, null)
    assert.deepEqual(restored.state.run.loadoutReadyPlayerIds, [])
    assert.equal(restored.state.playerEntities.primaryCasts[0]?.oneShotAttackPoseHeld, false)
    assert.equal(
      restored.state.playerEntities.primaryCasts[0]?.selectedPrimaryId,
      schemaVersion < 4 ? 8 : -1,
    )
    assert.ok(restored.state.playerEntities.skillRuntimes[0])
    assert.deepEqual(restored.state.playerEntities.skillBooks[0]?.learnedSkillOrder, [8, 11])
  }
})

test('Game Over retains a durable profile while removing only the continuation', () => {
  const state = createGameSimulation({ owner: OWNER })
  const economy = state.playerEntities.economies[0]!
  const profiledState = {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      economies: [{
        ...economy,
        dowsingFee: 950,
        gold: 12_345,
        ownedPerkSelectors: [7, 24, 25],
        storage: [{ ...economy.backpack[0]!, id: 99_999 }],
        unforgeBonuses: {
          experience: 0.15,
          manaCostReduction: 3,
          maximumHealth: 20,
          maximumMana: 40,
          offensiveDamage: 5,
          recipeAttemptCount: 7,
        },
      }],
      progressions: [{
        ...state.playerEntities.progressions[0]!,
        hagathaRuntime: {
          cheatDeathCharges: 0,
          reverieActive: false,
          serendipityActive: true,
        },
      }],
    },
  }
  const document = createGameProfileSaveDocument({
    integrity: 'global-clean',
    mods: MODS,
    modState: MOD_STATE,
    playerId: 'owner',
    state: profiledState,
  })
  const profile = restoreGameSaveProfile(document)

  assert.equal(profile.continuation, null)
  assert.equal(profile.economy.gold, 12_345)
  assert.equal(profile.economy.dowsingFee, 950)
  assert.equal(profile.economy.storage.length, 1)
  assert.equal(profile.economy.tutorialPending, true)
  assert.deepEqual(profile.hagathaRuntime, {
    cheatDeathCharges: 0,
    reverieActive: false,
    serendipityActive: true,
  })
  assert.deepEqual(profile.economy.unforgeBonuses, {
    experience: 0.15,
    manaCostReduction: 3,
    maximumHealth: 20,
    maximumMana: 40,
    offensiveDamage: 5,
    recipeAttemptCount: 7,
  })
  assert.throws(() => restoreGameSaveDocument(document), /no resumable continuation/)

  const nextCharacter = { ...OWNER, displayName: 'Next Run', element: 'fire' as const }
  const fresh = createGameSimulation({ next: nextCharacter })
  const hydrated = hydrateGameSaveProfile(fresh, 'next', profile)
  assert.deepEqual(hydrated.playerEntities.configs[0], nextCharacter)
  assert.equal(hydrated.playerEntities.economies[0]?.gold, 12_345)
  assert.deepEqual(
    hydrated.playerEntities.economies[0]?.unforgeBonuses,
    profile.economy.unforgeBonuses,
  )
  assert.deepEqual(
    hydrated.playerEntities.progressions[0]?.hagathaRuntime,
    profile.hagathaRuntime,
  )
})

test('killing the current wizard scavenges carried items and removes only the continuation', () => {
  const state = createGameSimulation({ owner: OWNER })
  const liveDocument = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: MODS,
    modState: MOD_STATE,
    playerId: 'owner',
    state,
  })
  const latent = restoreGameSaveProfile(liveDocument)
  assert.equal(latent.continuation?.summary.activeRun, false)
  assert.equal(latent.economy.storage.at(-1)?.kind, 'sack')
  assert.equal(latent.economy.tutorialPending, true)
  assert.deepEqual(
    latent.economy.storage.at(-1)?.contents?.map(({ name }) => name).sort(),
    ['Hat', 'Health Potion', 'Mana Potion', 'Robe', 'Staff'],
  )
  assert.deepEqual(
    restoreGameSaveDocument(liveDocument).state.playerEntities.economies[0]?.backpack
      .map(({ kind }) => kind),
    ['health-potion', 'mana-potion'],
  )

  const retiredDocument = retireGameSaveWizard(liveDocument)
  const retired = restoreGameSaveProfile(retiredDocument)
  assert.equal(retired.continuation, null)
  assert.equal(retired.economy.gold, state.playerEntities.economies[0]?.gold)
  assert.deepEqual(retired.economy.storage, latent.economy.storage)
  assert.throws(() => restoreGameSaveDocument(retiredDocument), /no resumable continuation/)
})

function downgradeWorldPainterDocumentToSchema20(
  document: Record<string, unknown>,
): Record<string, unknown> {
  const continuation = document.continuation as Record<string, unknown>
  const simulation = continuation.simulation as Record<string, unknown>
  document.schemaVersion = 20
  simulation.lightProviderOrder = simulation.worldManagerOrder
  delete simulation.worldManagerOrder
  removeSchema21WorldPainterFields(simulation)
  return document
}

function removeSchema21WorldPainterFields(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) removeSchema21WorldPainterFields(entry)
    return
  }
  if (value === null || typeof value !== 'object') return
  const source = value as Record<string, unknown>
  for (const key of [
    'deathWeaponPainterRegistration',
    'painterRegistration',
    'painterRegistrations',
    'sceneryRegistrationOrdinal',
    'solomonPainterRegistration',
  ]) delete source[key]
  for (const entry of Object.values(source)) removeSchema21WorldPainterFields(entry)
}

function legacyDocument(document: string, schemaVersion: number): string {
  const current = JSON.parse(document)
  const continuation = current.continuation
  const simulation = continuation.simulation
  const playerStore = simulation.playerEntities
  const run = simulation.run

  downgradePlayerBeltsToLegacyQuickbar(playerStore)

  delete simulation.world.skorcha
  delete continuation.summary.activeRun
  delete continuation.summary.partyRejoinToken
  for (const economy of playerStore.economies) {
    delete economy.collegeIntroPending
    delete economy.npc
    delete economy.tutorialPending
  }
  for (const participant of Object.values(simulation.world.participants ?? {}) as Record<string, unknown>[]) {
    delete participant.collegeIntro
  }

  delete run.gameOverExitKind
  delete run.loadoutReadyPlayerIds
  for (const primaryCast of playerStore.primaryCasts) delete primaryCast.oneShotAttackPoseHeld
  if (schemaVersion < 4) {
    delete current.integrity
    delete simulation.combatRng
    delete simulation.modEffects
    delete simulation.nextModConsumableUseId
    delete playerStore.skillRuntimes
    for (const economy of playerStore.economies) delete economy.unforgeBonuses
    for (const primaryCast of playerStore.primaryCasts) {
      delete primaryCast.etherBlastCharge
      delete primaryCast.etherBlastChargeCueSequence
      delete primaryCast.lastWeldPlaybackRate
      delete primaryCast.lastWeldSoundVariant
      delete primaryCast.selectedPrimaryAgeTicks
      delete primaryCast.selectedPrimaryId
      delete primaryCast.weaponPulse
    }
  }
  if (schemaVersion < 3) {
    simulation.playerOfferRng = simulation.gameRng
    delete simulation.gameRng
    delete simulation.hallOfFameClockStartedAtTick
  }

  const legacy = {
    ...(schemaVersion >= 4 ? { integrity: current.integrity } : {}),
    loadedBoneyard: continuation.loadedBoneyard,
    ...(schemaVersion >= 2 ? { mods: current.mods, modState: current.modState } : {}),
    schemaVersion,
    simulation,
    summary: continuation.summary,
  }
  return JSON.stringify(legacy)
}

function legacySchema5Document(document: string): string {
  const legacy = JSON.parse(document)
  legacy.schemaVersion = 5
  delete legacy.nativeSource
  downgradePlayerBeltsToLegacyQuickbar(
    legacy.continuation.simulation.playerEntities,
  )
  delete legacy.profile.economy.collegeIntroPending
  delete legacy.profile.economy.npc
  delete legacy.continuation.simulation.world.skorcha
  delete legacy.continuation.summary.activeRun
  delete legacy.continuation.summary.partyRejoinToken
  for (const economy of legacy.continuation.simulation.playerEntities.economies) {
    delete economy.collegeIntroPending
    delete economy.npc
    delete economy.tutorialPending
  }
  for (const participant of Object.values(
    legacy.continuation.simulation.world.participants ?? {},
  ) as Record<string, unknown>[]) delete participant.collegeIntro
  return JSON.stringify(legacy)
}

function downgradePlayerBeltsToLegacyQuickbar(playerStore: {
  belts?: Array<Array<{ kind?: string, skillId?: number } | null>>
  skillBooks: Array<{ skillQuickbar?: Array<number | null> }>
}): void {
  if (!Array.isArray(playerStore.belts)) return
  for (let index = 0; index < playerStore.skillBooks.length; index += 1) {
    const belt = playerStore.belts[index] ?? []
    playerStore.skillBooks[index]!.skillQuickbar = belt.map((entry) => (
      entry?.kind === 'skill' && typeof entry.skillId === 'number'
        ? entry.skillId
        : null
    ))
  }
  delete playerStore.belts
}
