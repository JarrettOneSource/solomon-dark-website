import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerCharacterInput } from '../core-kernels/player-character.ts'
import { GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS } from '../core-kernels/game-run.ts'
import { materializeStockTutorial } from '../host/boneyard-catalog.ts'
import {
  applyGameSimulationTutorialAction,
  confirmGameSimulationLoadout,
  createGameSimulation,
  enterBoneyardWorld,
  gameSimulationDurableProfileEconomy,
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerSkillBook,
  stepGameSimulationTick,
} from './game-simulation.ts'

const OWNER = {
  discipline: 'arcane',
  displayName: 'Sirmin',
  element: 'ether',
} as const

test('enters the stock Tutorial as a solo authored encounter with its native loadout', () => {
  const loaded = materializeStockTutorial(Buffer.alloc(16, 23))
  const state = enterBoneyardWorld(createGameSimulation({ owner: OWNER }), loaded)
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard') throw new Error('expected Tutorial world')
  assert.ok(state.world.tutorial)
  assert.equal(state.world.waves, null)
  assert.equal(state.world.arenaTransition, null)
  assert.equal(state.world.encounter?.dialogueMode, 'tutorial')
  assert.equal(state.world.encounter?.tutorialDialogueTicks, 3_054)
  assert.equal(state.world.tutorialProfileEconomy?.collegeIntroPending, true)
  assert.equal(state.world.tutorialProfileEconomy?.tutorialPending, true)
  assert.deepEqual(state.secondaryAbilities.actors.map((actor) => ({
    damage: actor.damage,
    kind: actor.kind,
    lifetimeTicks: actor.lifetimeTicks,
    lightRegistration: actor.lightRegistration,
    position: actor.position,
  })), [
    {
      damage: 1,
      kind: 'fire-patch',
      lifetimeTicks: 1_000,
      lightRegistration: { managerLane: 'actor', registrationOrdinal: 2 },
      position: { x: 1766.1005859375, y: 147.63815307617188 },
    },
    {
      damage: 1,
      kind: 'fire-patch',
      lifetimeTicks: 1_000,
      lightRegistration: { managerLane: 'actor', registrationOrdinal: 3 },
      position: { x: 1852.1005859375, y: 199.63815307617188 },
    },
  ])
  const skills = getPlayerSkillBook(state, 'owner')
  assert.equal(skills.primarySkillId, 8)
  assert.deepEqual(skills.skillQuickbar, [72, null, null, null, null, null, null, null])
  assert.equal(skills.permanentRanks[11], 0)
  assert.equal(skills.permanentRanks[72], 1)
  const completedProfile = gameSimulationDurableProfileEconomy({
    ...state,
    run: { ...state.run, phase: 'game-over' },
  }, 'owner')
  assert.equal(completedProfile.collegeIntroPending, true)
  assert.equal(completedProfile.tutorialPending, false)
})

test('Tutorial Game Over starts the title walk and auto-opens the story Office dialogue before Create', () => {
  const loaded = materializeStockTutorial(Buffer.alloc(16, 31))
  let state = enterBoneyardWorld(createGameSimulation({ owner: OWNER }), loaded)
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
  assert.equal(state.run.phase, 'hub')
  assert.equal(state.world.kind, 'hub')
  if (state.world.kind !== 'hub') throw new Error('expected post-Tutorial Hub')
  assert.equal(state.world.participants.owner?.region, 'courtyard')
  assert.equal(state.world.participants.owner?.collegeIntro?.phase, 'courtyard-walk')
  assert.equal(state.world.participants.owner?.collegeIntro?.titleCursor, 0)
  assert.deepEqual(getPlayerCharacter(state, 'owner').position, { x: 972, y: 1_044 })
  assert.equal(getPlayerEconomy(state, 'owner').tutorialPending, false)
  assert.equal(getPlayerEconomy(state, 'owner').collegeIntroPending, true)

  for (let tick = 0; tick < 5_000; tick += 1) {
    if (state.world.kind === 'hub'
      && state.world.participants.owner?.collegeIntro?.phase === 'arch-dialogue') break
    state = stepGameSimulationTick(state, {}, {
      collegeIntroReadyPlayerIds: new Set(['owner']),
    })
  }
  assert.equal(state.world.kind, 'hub')
  if (state.world.kind !== 'hub') throw new Error('expected story Office')
  assert.equal(state.world.participants.owner?.region, 'office')
  assert.equal(state.world.participants.owner?.collegeIntro?.phase, 'arch-dialogue')

  const confirmed = confirmGameSimulationLoadout(state, 'owner', {
    discipline: 'arcane',
    displayName: 'Too Soon',
    element: 'ether',
  })
  assert.equal(confirmed, null)
})

test('holds the controller for the exact 475-tick intro and gates Acid Rain until stage 5', () => {
  const loaded = materializeStockTutorial(Buffer.alloc(16, 29))
  let state = enterBoneyardWorld(createGameSimulation({ owner: OWNER }), loaded)
  const castAcidRain = {
    ...createIdlePlayerCharacterInput(),
    aim: { x: 800, y: 450 },
    cast: { primary: false, quickbar: 0 },
  }
  for (let tick = 0; tick < 474; tick += 1) {
    state = stepGameSimulationTick(state, { owner: castAcidRain })
  }
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard') throw new Error('expected Tutorial world')
  assert.equal(state.world.tutorial?.stage, 0)
  assert.equal(state.world.tutorial?.introActive, true)
  assert.ok((state.world.tutorial?.introFade ?? 0) > 0)
  assert.ok((state.world.tutorial?.introFade ?? 1) < 0.000_001)
  assert.equal(state.secondaryAbilities.players.owner?.castSequence ?? 0, 0)
  assert.equal(getPlayerCharacter(state, 'owner').velocity.y, -90)
  assert.ok(getPlayerCharacter(state, 'owner').position.y < 1_950)

  state = stepGameSimulationTick(state, { owner: castAcidRain })
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard' || !state.world.tutorial) {
    throw new Error('expected Tutorial controller')
  }
  assert.equal(state.world.tutorial.introActive, false)
  assert.equal(state.world.tutorial.introFade, 0)
  state = {
    ...state,
    world: {
      ...state.world,
      encounter: state.world.encounter
        ? { ...state.world.encounter, phase: 'gone', runEventId: 1 }
        : null,
      tutorial: { ...state.world.tutorial, stage: 5 },
    },
  }
  state = stepGameSimulationTick(state, { owner: castAcidRain })
  assert.equal(state.secondaryAbilities.players.owner?.castSequence, 1)
  assert.equal(state.secondaryAbilities.players.owner?.lastSkillId, 72)
})

test('authorizes only the solo Tutorial owner to acknowledge a selected-HUD selector', () => {
  const loaded = materializeStockTutorial(Buffer.alloc(16, 31))
  let state = enterBoneyardWorld(createGameSimulation({ owner: OWNER }), loaded)
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard' || !state.world.tutorial) {
    throw new Error('expected Tutorial controller')
  }
  state = {
    ...state,
    world: {
      ...state.world,
      tutorial: {
        ...state.world.tutorial,
        introActive: false,
        introBlend: 1,
        introDelayTicksRemaining: 0,
        introFade: 0,
        stage: 5,
      },
    },
  }
  assert.equal(applyGameSimulationTutorialAction(
    state,
    'absent',
    'primary-selector-opened',
  ), null)
  const acknowledged = applyGameSimulationTutorialAction(
    state,
    'owner',
    'concentration-a-selector-opened',
  )
  assert.ok(acknowledged)
  assert.equal(
    acknowledged.world.kind === 'boneyard'
      ? acknowledged.world.tutorial?.selectedSkillHudAcknowledged
      : null,
    true,
  )
  assert.equal(applyGameSimulationTutorialAction(
    acknowledged,
    'owner',
    'primary-selector-opened',
  ), acknowledged)
})
