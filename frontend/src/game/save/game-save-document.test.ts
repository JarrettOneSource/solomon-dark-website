import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerCharacterInput } from '../core-kernels/player-character.ts'
import {
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerEconomy,
  stepGameSimulationTick,
} from '../core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../core-server/player-entity-store.ts'
import {
  HUB_SACK_REPLICATION_DEPTH_LIMIT,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import { HubStudentPopulationState } from '../core-server/hub-students.ts'
import { HubWorldRuntime } from '../core-server/hub-world.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../host/boneyard-catalog.ts'
import {
  createGameProfileSaveDocument,
  createGameSaveDocument,
  hydrateGameSaveProfile,
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

test('host save documents round-trip the complete owner state and revive Hub runtimes', () => {
  let state = createGameSimulation({ owner: OWNER, guest: GUEST }, {
    hubTraderAnimationSeed: 73,
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
  assert.deepEqual(encoded.mods, MODS)
  assert.deepEqual(encoded.modState, MOD_STATE)
  assert.equal(encoded.integrity, 'local-only')
  assert.equal(new TextEncoder().encode(document).byteLength <= MAX_WEB_GAME_SAVE_BYTES, true)
  assert.deepEqual(readGameSaveSummary(document), {
    character: OWNER,
    phase: 'hub',
    playerId: 'owner',
    savedAtTick: state.tick,
    worldKind: 'hub',
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
  assert.deepEqual(
    restored.state.playerEntities.progressions[0],
    state.playerEntities.progressions[0],
  )
  assert.equal(restored.state.world.kind, 'hub')
  if (restored.state.world.kind !== 'hub') throw new Error('expected restored Hub')
  assert.ok(restored.state.world.runtime instanceof HubWorldRuntime)
  assert.ok(restored.state.world.studentPopulation instanceof HubStudentPopulationState)
  assert.deepEqual(Object.keys(restored.state.world.participants), ['owner'])
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
    playerId: 'owner',
    state,
  })
  const restored = restoreGameSaveDocument(document)

  assert.deepEqual(restored.loadedBoneyard, loadedBoneyard)
  assert.equal(restored.state.world.kind, 'boneyard')
  if (restored.state.world.kind !== 'boneyard') throw new Error('expected restored Boneyard')
  assert.equal(restored.state.world.runId, loadedBoneyard.runId)
  assert.deepEqual(restored.state.world.hallOfFameRuns, state.world.kind === 'boneyard'
    ? state.world.hallOfFameRuns
    : {})
  assert.deepEqual(restored.state.world.enemyWorldFeedback, state.world.kind === 'boneyard'
    ? state.world.enemyWorldFeedback
    : {})
  assert.equal(restored.state.run.runId, loadedBoneyard.runId)
  assert.equal(restored.state.run.phase, 'active')
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

test('known schema 1 through 4 continuations migrate through current authority', () => {
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: createGameSimulation({ owner: OWNER }),
  })

  for (const schemaVersion of [1, 2, 3, 4]) {
    const restored = restoreGameSaveDocument(legacyDocument(document, schemaVersion))
    assert.equal(restored.playerId, 'owner')
    assert.equal(restored.state.world.kind, 'hub')
    assert.equal(restored.state.playerEntities.identities[0]?.playerId, 'owner')
    assert.equal(restored.state.run.gameOverExitKind, null)
    assert.deepEqual(restored.state.run.loadoutReadyPlayerIds, [])
    assert.equal(restored.state.playerEntities.primaryCasts[0]?.oneShotAttackPoseHeld, false)
    assert.equal(
      restored.state.playerEntities.primaryCasts[0]?.selectedPrimaryId,
      schemaVersion === 4 ? -1 : 8,
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

function legacyDocument(document: string, schemaVersion: number): string {
  const current = JSON.parse(document)
  const continuation = current.continuation
  const simulation = continuation.simulation
  const playerStore = simulation.playerEntities
  const run = simulation.run

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
