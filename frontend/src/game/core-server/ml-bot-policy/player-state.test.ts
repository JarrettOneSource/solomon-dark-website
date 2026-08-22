import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../../core-kernels/boneyard.ts'
import { createNativeSecondaryPlayerState } from '../../core-kernels/native-secondary-abilities.ts'
import { createIdlePlayerCharacterInput } from '../../core-kernels/player-character.ts'
import {
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerCharacter,
  stepGameSimulationTick,
} from '../game-simulation.ts'
import { setPlayerEntityMana } from '../player-entity-store.ts'
import { observeMlBotPolicyPlayerState } from './player-state.ts'

const BONEYARD: LoadedBoneyard = {
  choice: { id: 'headless', name: 'Headless', source: 'mod', modId: 'tests', modName: 'Tests' },
  geometrySha256: 'geometry',
  runId: 'run',
  scene: {
    bounds: { h: 1_000, w: 1_000, x: 0, y: 0 },
    environmentMode: 0,
    fences: [],
    name: 'Headless',
    objects: [],
    roads: [],
    solomonDig: null,
    spawn: { facingDeg: 180, x: 500, y: 500 },
    sprites: [],
    terrain: [],
  },
  seed: '12345678',
  sourceSha256: 'source',
}

test('player policy state reads self, primary, and quickbar semantics from authoritative state', () => {
  const state = createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  })
  const observed = observeMlBotPolicyPlayerState(state, 'agent', {
    primaryEffectActive: true,
    secondaryEffectActive: [true, false, false, false, false, false, false, false],
  })
  assert.equal(observed.blockA.length, 32)
  assert.equal(observed.blockB.length, 11)
  assert.equal(observed.blockC.length, 8 * 15)
  assert.equal(observed.blockA[0], 1)
  assert.ok(Math.abs(observed.blockA[2]! - 1 / 75) < 1e-6)
  assert.ok(Math.abs(observed.blockA[4]! - 0.1) < 1e-6)
  assert.equal(observed.blockA[7], 1)
  assert.equal(observed.blockB[0], 1)
  assert.equal(observed.blockB[9], 1)
  assert.equal(observed.blockB[10], 1)
  assert.equal(observed.blockC[0], 1)
  assert.equal(observed.blockC[1], 1)
  assert.ok(Math.abs(observed.blockC[7]! - 75 / 2_000) < 1e-6)
  assert.equal(observed.blockC[10], 1)
  assert.equal(observed.blockC[11], 1)
  assert.equal(observed.blockC[12], 1)
  assert.equal(observed.blockC[14], 0)
})

test('secondary cooldown observation is tick-exact and readiness opens at zero', () => {
  const initial = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }), BONEYARD)
  const secondary = createNativeSecondaryPlayerState()
  const cooldowns = [...secondary.cooldownTicksBySkill]
  const maxima = [...secondary.cooldownMaximumTicksBySkill]
  cooldowns[21] = 150
  maxima[21] = 300
  const cooling = {
    ...initial,
    secondaryAbilities: {
      ...initial.secondaryAbilities,
      players: { agent: { ...secondary, cooldownMaximumTicksBySkill: maxima, cooldownTicksBySkill: cooldowns } },
    },
  }
  const observed = observeMlBotPolicyPlayerState(cooling, 'agent', {
    primaryEffectActive: false,
    secondaryEffectActive: new Array(8).fill(false),
  })
  assert.ok(Math.abs(observed.blockC[8]! - 0.05) < 1e-6)
  assert.ok(Math.abs(observed.blockC[9]! - 0.025) < 1e-6)
  assert.equal(observed.blockC[10], 0)
  const readyState = {
    ...cooling,
    secondaryAbilities: {
      ...cooling.secondaryAbilities,
      players: {
        agent: {
          ...cooling.secondaryAbilities.players.agent!,
          cooldownTicksBySkill: cooling.secondaryAbilities.players.agent!.cooldownTicksBySkill.map(() => 0),
        },
      },
    },
  }
  assert.equal(observeMlBotPolicyPlayerState(readyState, 'agent', {
    primaryEffectActive: false,
    secondaryEffectActive: new Array(8).fill(false),
  }).blockC[10], 1)
})

test('primary affordability agrees with the authoritative underpowered cast outcome', () => {
  const initial = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }), BONEYARD)
  const activity = {
    primaryEffectActive: false,
    secondaryEffectActive: new Array(8).fill(false),
  }
  const manaCost = observeMlBotPolicyPlayerState(initial, 'agent', activity).blockB[7]! * 2_000
  const input = createIdlePlayerCharacterInput()
  const player = getPlayerCharacter(initial, 'agent')
  input.aim = { x: player.position.x + 100, y: player.position.y }
  input.cast.primary = true
  const underfunded = {
    ...initial,
    playerEntities: setPlayerEntityMana(initial.playerEntities, 'agent', 0),
  }
  assert.equal(observeMlBotPolicyPlayerState(underfunded, 'agent', activity).primaryAffordable, false)
  let rejected = underfunded
  for (let tick = 0; tick < 20; tick += 1) rejected = stepGameSimulationTick(rejected, { agent: input })
  assert.equal(rejected.playerEntities.primaryCasts[0]!.underpowered, true)
  const funded = {
    ...initial,
    playerEntities: setPlayerEntityMana(initial.playerEntities, 'agent', manaCost),
  }
  assert.equal(observeMlBotPolicyPlayerState(funded, 'agent', activity).primaryAffordable, true)
  let accepted = funded
  for (let tick = 0; tick < 20; tick += 1) accepted = stepGameSimulationTick(accepted, { agent: input })
  assert.equal(accepted.playerEntities.primaryCasts[0]!.underpowered, false)
})
