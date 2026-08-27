import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { createBoneyardWaveDirector } from '../core-kernels/boneyard-wave-director.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  createEquipmentInventoryItem,
} from '../core-kernels/hub-economy.ts'
import { NATIVE_HALL_OF_FAME_SCORE } from '../core-kernels/hall-of-fame-score.ts'
import { nativeSkillCategory } from '../core-kernels/player-progression.ts'
import {
  applyGameSimulationHubAction,
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerBelt,
  getPlayerEconomy,
  getPlayerProgression,
  getPlayerSkillBook,
  grantGameSimulationPlayerExperience,
  stepGameSimulationTick,
  type GameSimulationState,
} from './game-simulation.ts'
import {
  replacePlayerEconomy,
  setPlayerEntityMana,
} from './player-entity-store.ts'

const PLAYER_ID = 'wizard'
const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

function boneyard(): LoadedBoneyard {
  return {
    choice: {
      id: 'mod:npc-integration',
      modId: 'npc-integration',
      modName: 'NPC Integration',
      name: 'NPC Integration',
      source: 'mod',
    },
    geometrySha256: 'b'.repeat(64),
    runId: 'npc-integration-run',
    scene: {
      bounds: { h: 500, w: 500, x: 0, y: 0 },
      environmentMode: 2,
      fences: [],
      name: 'NPC integration fixture',
      objects: [],
      roads: [],
      solomonDig: null,
      spawn: { facingDeg: 180, x: 250, y: 250 },
      sprites: [],
      terrain: [],
    },
    seed: 'npc-integration-seed',
    sourceSha256: 'a'.repeat(64),
  }
}

function waveBoneyard(): LoadedBoneyard {
  const loaded = boneyard()
  return {
    ...loaded,
    choice: { id: 'wave-30', name: 'Wave 30', source: 'default' },
    scene: {
      ...loaded.scene,
      solomonDig: {
        frameProgram: [0, 3, 1],
        gravePosition: { x: 240, y: 390 },
        lanternPosition: { x: 245, y: 390 },
        position: { x: 250, y: 390 },
        ticksPerFrame: 5,
      },
    },
  }
}

function idle(primary = false, quickbar: number | null = null) {
  return {
    [PLAYER_ID]: {
      aim: { x: 250, y: 100 },
      cast: { primary, quickbar },
      movement: { x: 0, y: 0 },
      viewportHeight: 900,
      viewportWidth: 1_600,
    },
  }
}

function selectBoast(state: GameSimulationState, boastId: number): GameSimulationState {
  const result = applyGameSimulationHubAction(state, PLAYER_ID, {
    boastId,
    type: 'select-boast',
  })
  assert.equal(result.accepted, true)
  return result.state
}

test('Teacher purchases debit exact gold, unlock only the advanced flag, and reject repeats', () => {
  let state = createGameSimulation({ [PLAYER_ID]: CHARACTER })
  const economy = getPlayerEconomy(state, PLAYER_ID)
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, PLAYER_ID, {
      ...economy,
      gold: 10_000,
      revision: economy.revision + 1,
    }),
  }
  const beforeRank = getPlayerSkillBook(state, PLAYER_ID).permanentRanks[72]
  const purchased = applyGameSimulationHubAction(state, PLAYER_ID, {
    skillId: 72,
    type: 'buy-teacher-spell',
  })
  assert.equal(purchased.accepted, true)
  state = purchased.state
  assert.equal(getPlayerEconomy(state, PLAYER_ID).gold, 7_000)
  assert.equal(getPlayerSkillBook(state, PLAYER_ID).advancedUnlocks[0], true)
  assert.equal(getPlayerSkillBook(state, PLAYER_ID).permanentRanks[72], beforeRank)
  assert.equal(getPlayerEconomy(state, PLAYER_ID).actionFeedback?.action, 'buy-teacher-spell')
  assert.equal(applyGameSimulationHubAction(state, PLAYER_ID, {
    skillId: 72,
    type: 'buy-teacher-spell',
  }).reason, 'invalid-offer')
})

test('world NPC acknowledgement clears only its durable native help row and is idempotent', () => {
  const initial = createGameSimulation({ [PLAYER_ID]: CHARACTER })
  assert.deepEqual(
    getPlayerEconomy(initial, PLAYER_ID).npc.helpFlags,
    Array<boolean>(10).fill(true),
  )
  const acknowledged = applyGameSimulationHubAction(initial, PLAYER_ID, {
    interactionId: 'fomentius',
    type: 'acknowledge-npc-hint',
  })
  assert.equal(acknowledged.accepted, true)
  assert.deepEqual(getPlayerEconomy(acknowledged.state, PLAYER_ID).npc.helpFlags, [
    true, false, true, true, true, true, true, true, true, true,
  ])
  assert.equal(
    getPlayerEconomy(acknowledged.state, PLAYER_ID).revision,
    getPlayerEconomy(initial, PLAYER_ID).revision + 1,
  )

  const repeated = applyGameSimulationHubAction(acknowledged.state, PLAYER_ID, {
    interactionId: 'fomentius',
    type: 'acknowledge-npc-hint',
  })
  assert.equal(repeated.accepted, true)
  assert.equal(repeated.state, acknowledged.state)
})

test('Potion and magical-equipment producers fail their selected Boasts once in an active run', () => {
  let potion = enterBoneyardWorld(
    selectBoast(createGameSimulation({ [PLAYER_ID]: CHARACTER }), 0),
    boneyard(),
  )
  const potionId = getPlayerEconomy(potion, PLAYER_ID).backpack.find(
    ({ nativeTypeId }) => nativeTypeId === 7001,
  )!.id
  potion = applyGameSimulationHubAction(potion, PLAYER_ID, {
    itemId: potionId,
    type: 'consume',
  }).state
  assert.equal(getPlayerEconomy(potion, PLAYER_ID).npc.boast.failed, true)
  assert.equal(getPlayerEconomy(potion, PLAYER_ID).npc.boast.failureSequence, 1)

  let equipment = selectBoast(createGameSimulation({ [PLAYER_ID]: CHARACTER }), 1)
  const recipe = DOWSING_EQUIPMENT_RECIPES.find((candidate) => candidate.sourceIndex === 0)!
  const economy = getPlayerEconomy(equipment, PLAYER_ID)
  const item = createEquipmentInventoryItem(recipe, economy.nextItemId)
  equipment = {
    ...equipment,
    playerEntities: replacePlayerEconomy(equipment.playerEntities, PLAYER_ID, {
      ...economy,
      backpack: [...economy.backpack, item],
      nextItemId: economy.nextItemId + 1,
      revision: economy.revision + 1,
    }),
  }
  equipment = enterBoneyardWorld(equipment, boneyard())
  const equipped = applyGameSimulationHubAction(equipment, PLAYER_ID, {
    itemId: item.id,
    slot: 'ring-0',
    type: 'equip',
  })
  assert.equal(equipped.accepted, true)
  assert.equal(getPlayerEconomy(equipped.state, PLAYER_ID).npc.boast.failed, true)
})

test('entering the secondary dispatcher fails the secondary-free Boast before spell admission', () => {
  let state = selectBoast(createGameSimulation({ [PLAYER_ID]: CHARACTER }), 2)
  const beltEntry = getPlayerBelt(state, PLAYER_ID)[0]
  assert.ok(beltEntry?.kind === 'skill' && nativeSkillCategory(beltEntry.skillId) === 2)
  state = enterBoneyardWorld(state, boneyard())
  state = stepGameSimulationTick(state, idle(false, 0))
  assert.equal(getPlayerEconomy(state, PLAYER_ID).npc.boast.failed, true)
})

test('strict mana underflow fails its Boast, while ordinary zero is covered by spell kernels', () => {
  let state = enterBoneyardWorld(
    selectBoast(createGameSimulation({ [PLAYER_ID]: CHARACTER }), 4),
    boneyard(),
  )
  state = {
    ...state,
    playerEntities: setPlayerEntityMana(state.playerEntities, PLAYER_ID, 0),
  }
  for (let tick = 0; tick < 30 && !getPlayerEconomy(state, PLAYER_ID).npc.boast.failed; tick += 1) {
    state = stepGameSimulationTick(state, idle(true))
  }
  assert.equal(getPlayerEconomy(state, PLAYER_ID).npc.boast.failed, true)
  assert.equal(getPlayerEconomy(state, PLAYER_ID).npc.boast.failureSequence, 1)
})

test('random-choice Boast writes one host RNG choice onto every new skill offer', () => {
  let state = selectBoast(createGameSimulation({ [PLAYER_ID]: CHARACTER }, {
    gameRngSeed: 73,
  }), 3)
  const beforeRng = state.gameRng
  state = grantGameSimulationPlayerExperience(state, PLAYER_ID, 91)
  const offer = getPlayerProgression(state, PLAYER_ID).pendingOffer
  assert.ok(offer)
  assert.ok(offer.automaticChoiceIndex !== undefined)
  assert.ok(offer.automaticChoiceIndex >= 0 && offer.automaticChoiceIndex < offer.options.length)
  assert.notDeepEqual(state.gameRng, beforeRng)
})

test('surviving into Wave 30 succeeds the Boast and the terminal archive applies 1.1 once', () => {
  let state = enterBoneyardWorld(
    selectBoast(createGameSimulation({ [PLAYER_ID]: CHARACTER }), 0),
    waveBoneyard(),
  )
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  if (state.world.encounter === null) throw new Error('expected Solomon encounter')
  state = {
    ...state,
    world: {
      ...state.world,
      encounter: {
        ...state.world.encounter,
        phase: 'gone',
        runEventId: 1,
      },
      waves: {
        ...createBoneyardWaveDirector('npc-wave-30'),
        phase: 'wave-threshold',
        populationThreshold: 1,
        waveOrdinal: 30,
      },
    },
  }
  state = stepGameSimulationTick(state, idle())
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(state.world.waves?.phase, 'wave-lull-delay')
  assert.equal(state.world.waves?.waveOrdinal, 30)
  assert.equal(getPlayerEconomy(state, PLAYER_ID).npc.boast.succeeded, true)
  const run = state.world.hallOfFameRuns[PLAYER_ID]!
  state = {
    ...state,
    run: {
      ...state.run,
      gameOverEventId: 1,
      gameOverTicks: NATIVE_HALL_OF_FAME_SCORE.archiveDeathTick - 1,
      phase: 'game-over',
    },
    world: {
      ...state.world,
      hallOfFameRuns: {
        ...state.world.hallOfFameRuns,
        [PLAYER_ID]: { ...run, awesomeness: 101 },
      },
    },
  }
  state = stepGameSimulationTick(state, idle())
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(state.world.hallOfFameRuns[PLAYER_ID]?.awesomeness, 111)
})
