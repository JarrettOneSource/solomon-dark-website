import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerCharacterInput } from '../core-kernels/player-character.ts'
import { createNativeHubNpcState } from '../core-kernels/native-hub-npc.ts'
import { createNativeRng, drawNativeInteger } from '../core-kernels/native-rng.ts'
import {
  applyGameSimulationHubAction,
  armGameSimulationCollegeIntro,
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerEconomy,
  stepGameSimulationTick,
} from '../core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../core-server/player-entity-store.ts'
import {
  HUB_SACK_REPLICATION_DEPTH_LIMIT,
  insertLootInventoryItem,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import { HUB_SPAWN } from '../core-kernels/hub-math.ts'
import { archiveHubMemorialPortrait } from '../core-kernels/hub-memorial.ts'
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
  assert.equal(encoded.schemaVersion, 15)
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

  const schemaTwelve = JSON.parse(document)
  schemaTwelve.schemaVersion = 12
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

test('schema 15 resumes every College admission phase and its exact player position', () => {
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
})

test('a client-held save cannot fork the process-owned shared memorial', () => {
  let state = createGameSimulation({ owner: OWNER })
  if (state.world.kind !== 'hub') throw new Error('expected Hub')
  state = {
    ...state,
    world: {
      ...state.world,
      memorial: archiveHubMemorialPortrait(state.world.memorial, {
        capturedAtTick: 300,
        config: OWNER,
        equipment: { hat: null, robe: null, weapon: null },
        headingIndex: 12,
        playerId: 'owner',
        portraitScale: 0.925,
        runId: 'completed-run',
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
  const state = enterBoneyardWorld(
    createGameSimulation({ owner: OWNER }),
    loadedBoneyard,
  )
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
    previous.continuation.summary.partyRejoinToken = 'A'.repeat(43)
    assert.equal(
      readGameSaveSummary(JSON.stringify(previous))?.partyRejoinToken,
      'A'.repeat(43),
    )
  }

  for (const schemaVersion of [9, 8, 7, 6]) {
    const previous = structuredClone(current)
    previous.schemaVersion = schemaVersion
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
  assert.equal(encoded.schemaVersion, 15)
  assert.equal(encoded.continuation.simulation.world.tutorial.stage, 0)
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
    encoded.continuation.simulation.playerEntities.economies[0].backpack[2],
    { ...nativeTutorialAmuletItem(), id: tutorialEconomy.nextItemId },
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
    restored.state.playerEntities.economies[0]?.backpack[2],
    { ...nativeTutorialAmuletItem(), id: tutorialEconomy.nextItemId },
  )
  if (restored.state.world.kind !== 'boneyard') throw new Error('expected Tutorial')
  assert.deepEqual(restored.state.world.tutorial, state.world.kind === 'boneyard'
    ? state.world.tutorial
    : null)
  assert.equal(restored.state.world.encounter?.dialogueMode, 'tutorial')
  assert.equal(restored.state.world.waves, null)
  assert.equal(restored.state.world.arenaTransition, null)

  const legacy = structuredClone(encoded)
  legacy.schemaVersion = 8
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

  const priorSchemaSeven = structuredClone(encoded)
  priorSchemaSeven.schemaVersion = 7
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

function legacyDocument(document: string, schemaVersion: number): string {
  const current = JSON.parse(document)
  const continuation = current.continuation
  const simulation = continuation.simulation
  const playerStore = simulation.playerEntities
  const run = simulation.run

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
