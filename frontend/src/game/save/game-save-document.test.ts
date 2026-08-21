import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerCharacterInput } from '../core-kernels/player-character.ts'
import {
  createGameSimulation,
  enterBoneyardWorld,
  stepGameSimulationTick,
} from '../core-server/game-simulation.ts'
import { HubStudentPopulationState } from '../core-server/hub-students.ts'
import { HubWorldRuntime } from '../core-server/hub-world.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../host/boneyard-catalog.ts'
import {
  createGameSaveDocument,
  restoreGameSaveDocument,
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
    loadedBoneyard: null,
    mods: MODS,
    modState: MOD_STATE,
    playerId: 'owner',
    state,
  })
  const encoded = JSON.parse(document) as Record<string, unknown>
  assert.deepEqual(encoded.mods, MODS)
  assert.deepEqual(encoded.modState, MOD_STATE)
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

test('schema-3 saves normalize the pre-unforge zero ledger and feedback shape', () => {
  const document = createGameSaveDocument({
    loadedBoneyard: null,
    mods: MODS,
    modState: MOD_STATE,
    playerId: 'owner',
    state: createGameSimulation({ owner: OWNER }),
  })
  const parsed = JSON.parse(document)
  const economy = parsed.simulation.playerEntities.economies[0]
  delete economy.unforgeBonuses
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
    loadedBoneyard: null,
    mods: MODS,
    modState: MOD_STATE,
    playerId: 'owner',
    state: createGameSimulation({ owner: OWNER }),
  })
  const parsed = JSON.parse(document)

  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify({ ...parsed, schemaVersion: 2 })),
    /schema version/,
  )
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify({ ...parsed, surprise: true })),
    /unexpected field/,
  )
  assert.throws(
    () => restoreGameSaveDocument(JSON.stringify({
      ...parsed,
      summary: { ...parsed.summary, playerId: 'someone-else' },
    })),
    /owner/,
  )
  assert.throws(
    () => restoreGameSaveDocument('x'.repeat(MAX_WEB_GAME_SAVE_BYTES + 1)),
    /size limit/,
  )
})
