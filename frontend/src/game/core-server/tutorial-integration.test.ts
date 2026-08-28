import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerCharacterInput } from '../core-kernels/player-character.ts'
import {
  NATIVE_TUTORIAL_EQUIPMENT_APPEARANCE,
} from '../core-kernels/native-starter-equipment.ts'
import { GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS } from '../core-kernels/game-run.ts'
import { nativeTutorialAmuletItem } from '../core-kernels/native-tutorial.ts'
import { materializeStockTutorial } from '../host/boneyard-catalog.ts'
import {
  insertPlayerEntityLootItem,
  replacePlayerCharacter,
} from './player-entity-store.ts'
import {
  applyGameSimulationTutorialAction,
  applyGameSimulationHubAction,
  confirmGameSimulationLoadout,
  createGameSimulation,
  enterBoneyardWorld,
  gameSimulationDurableProfileEconomy,
  getPlayerBelt,
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
  getPlayerSkillBook,
  grantGameSimulationPlayerExperience,
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
  assert.deepEqual(getPlayerEconomy(state, 'owner').backpack, [])
  const tutorialAppearance = NATIVE_TUTORIAL_EQUIPMENT_APPEARANCE
  assert.deepEqual(getPlayerEconomy(state, 'owner').equipment.hat?.iconTints, [
    tutorialAppearance.primaryTint,
    tutorialAppearance.secondaryTint,
  ])
  assert.deepEqual(
    getPlayerEconomy(state, 'owner').equipment.robe?.iconTints,
    getPlayerEconomy(state, 'owner').equipment.hat?.iconTints,
  )
  assert.deepEqual(
    state.world.tutorialProfileEconomy?.backpack.map(({ name }) => name),
    ['Health Potion', 'Mana Potion'],
  )
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
  assert.deepEqual(getPlayerBelt(state, 'owner'), [
    { kind: 'skill', skillId: 72 }, null, null,
    { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null, null,
  ])
  assert.equal(skills.permanentRanks[11], 0)
  assert.equal(skills.permanentRanks[72], 1)
  const completedProfile = gameSimulationDurableProfileEconomy({
    ...state,
    run: { ...state.run, phase: 'game-over' },
  }, 'owner')
  assert.equal(completedProfile.collegeIntroPending, true)
  assert.equal(completedProfile.tutorialPending, false)
})

test('opening movement copy acknowledges only a user-requested movement epoch', () => {
  const loaded = materializeStockTutorial(Buffer.alloc(16, 29))
  let state = enterBoneyardWorld(createGameSimulation({ owner: OWNER }), loaded)
  if (state.world.kind !== 'boneyard' || !state.world.tutorial) {
    throw new Error('expected Tutorial controller')
  }
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(
      state.playerEntities,
      'owner',
      { ...getPlayerCharacter(state, 'owner'), velocity: { x: 100, y: 0 } },
    ),
    world: {
      ...state.world,
      tutorial: {
        ...state.world.tutorial,
        introActive: false,
        introBlend: 1,
        introDelayTicksRemaining: 0,
        introFade: 0,
        introMovementTicksRemaining: 0,
        movementInstructionAcknowledged: false,
        stage: 0,
      },
    },
  }

  state = stepGameSimulationTick(state, { owner: createIdlePlayerCharacterInput() })
  assert.equal(
    state.world.kind === 'boneyard'
      ? state.world.tutorial?.movementInstructionAcknowledged
      : null,
    false,
  )

  state = stepGameSimulationTick(state, {
    owner: {
      ...createIdlePlayerCharacterInput(),
      movement: { x: 1, y: 0 },
    },
  })
  assert.equal(
    state.world.kind === 'boneyard'
      ? state.world.tutorial?.movementInstructionAcknowledged
      : null,
    true,
  )
})

test('one authored Health Potion drink clears stage 18 and starts survival', () => {
  const loaded = materializeStockTutorial(Buffer.alloc(16, 41))
  let state = enterBoneyardWorld(createGameSimulation({ owner: OWNER }), loaded)
  if (state.world.kind !== 'boneyard' || !state.world.tutorial) {
    throw new Error('expected Tutorial controller')
  }
  const authoredHealthPotion = state.world.tutorialProfileEconomy?.backpack.find((item) => (
    item.nativeTypeId === 7001 && item.nativeSubtype === 0
  ))
  assert.ok(authoredHealthPotion)
  const inserted = insertPlayerEntityLootItem(
    state.playerEntities,
    'owner',
    authoredHealthPotion,
  )
  assert.equal(inserted.accepted, true)
  state = {
    ...state,
    playerEntities: inserted.store,
    world: {
      ...state.world,
      tutorial: {
        ...state.world.tutorial,
        introActive: false,
        introBlend: 1,
        introDelayTicksRemaining: 0,
        introFade: 0,
        introMovementTicksRemaining: 0,
        stage: 18,
      },
    },
  }

  state = stepGameSimulationTick(state, {})
  assert.equal(state.world.kind === 'boneyard' ? state.world.tutorial?.stage : null, 18)
  const potion = getPlayerEconomy(state, 'owner').backpack.find((item) => (
    item.nativeTypeId === 7001 && item.nativeSubtype === 0
  ))
  assert.ok(potion)
  assert.equal(potion.quantity, 1)

  const consumed = applyGameSimulationHubAction(state, 'owner', {
    type: 'consume',
    itemId: potion.id,
  })
  assert.equal(consumed.accepted, true)
  assert.equal(getPlayerEconomy(consumed.state, 'owner').backpack.some((item) => (
    item.nativeTypeId === 7001 && item.nativeSubtype === 0
  )), false)

  state = stepGameSimulationTick(consumed.state, {})
  assert.equal(state.world.kind === 'boneyard' ? state.world.tutorial?.stage : null, 19)
  assert.equal(state.world.kind === 'boneyard' ? state.world.tutorial?.waveOrdinal : null, 6)
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

test('Tutorial death discards its items and skills when Create confirms the new wizard', () => {
  const loaded = materializeStockTutorial(Buffer.alloc(16, 37))
  let state = enterBoneyardWorld(createGameSimulation({ owner: OWNER }), loaded)
  state = {
    ...state,
    playerEntities: insertPlayerEntityLootItem(
      state.playerEntities,
      'owner',
      nativeTutorialAmuletItem(),
    ).store,
  }
  const amulet = getPlayerEconomy(state, 'owner').backpack.find(
    item => item.name === "Sorceror's Amulet",
  )
  assert.ok(amulet)
  const equipped = applyGameSimulationHubAction(state, 'owner', {
    type: 'equip',
    itemId: amulet.id,
    slot: 'amulet',
  })
  assert.equal(equipped.accepted, true)
  state = grantGameSimulationPlayerExperience(equipped.state, 'owner', 100)
  assert.equal(getPlayerProgression(state, 'owner').level, 2)
  assert.equal(getPlayerSkillBook(state, 'owner').permanentRanks[72], 1)

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
  for (let tick = 0; tick < 5_000; tick += 1) {
    if (state.world.kind === 'hub'
      && state.world.participants.owner?.collegeIntro?.phase === 'arch-dialogue') break
    state = stepGameSimulationTick(state, {}, {
      collegeIntroReadyPlayerIds: new Set(['owner']),
    })
  }
  const acknowledged = applyGameSimulationHubAction(state, 'owner', {
    type: 'acknowledge-college-intro-dialogue',
  })
  assert.equal(acknowledged.accepted, true)
  state = {
    ...acknowledged.state,
    playerEntities: replacePlayerCharacter(
      acknowledged.state.playerEntities,
      'owner',
      {
        ...getPlayerCharacter(acknowledged.state, 'owner'),
        position: { x: 512, y: 924 },
        velocity: { x: 0, y: 0 },
      },
    ),
  }
  for (let tick = 0; tick < 102; tick += 1) state = stepGameSimulationTick(state, {})
  assert.equal(
    state.world.kind === 'hub'
      ? state.world.participants.owner?.transition?.phase
      : null,
    'college-loadout',
  )
  const collegeAppearance = getPlayerEconomy(state, 'owner').equipment.hat?.iconTints
  assert.ok(collegeAppearance)
  assert.deepEqual(getPlayerEconomy(state, 'owner').equipment.robe?.iconTints, collegeAppearance)
  const confirmed = confirmGameSimulationLoadout(state, 'owner', {
    discipline: 'body',
    displayName: 'Reborn',
    element: 'air',
  })
  assert.ok(confirmed)
  const progression = getPlayerProgression(confirmed, 'owner')
  const skills = getPlayerSkillBook(confirmed, 'owner')
  const economy = getPlayerEconomy(confirmed, 'owner')
  assert.equal(progression.level, 1)
  assert.equal(progression.experience, 0)
  assert.equal(progression.pendingOffer, null)
  assert.equal(skills.permanentRanks[72], 0)
  assert.equal(skills.permanentRanks[24], 1)
  assert.equal(skills.permanentRanks[27], 1)
  assert.deepEqual(getPlayerBelt(confirmed, 'owner'), [
    { kind: 'skill', skillId: 27 }, null, null,
    { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null, null,
  ])
  assert.equal(economy.equipment.amulet, null)
  assert.deepEqual(economy.backpack.map(item => item.name), [
    'Health Potion',
    'Mana Potion',
  ])
  assert.deepEqual(economy.equipment.hat?.iconTints, collegeAppearance)
  assert.deepEqual(economy.equipment.robe?.iconTints, collegeAppearance)
  assert.equal(economy.collegeIntroPending, false)
  assert.equal(economy.tutorialPending, false)
  assert.deepEqual(economy.storage, [])
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

test('holds the ten opening Skeletons without catch-up until the owner casts one primary spell', () => {
  const loaded = materializeStockTutorial(Buffer.alloc(16, 43))
  let state = enterBoneyardWorld(createGameSimulation({ owner: OWNER }), loaded)
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard' || !state.world.tutorial || !state.world.encounter) {
    throw new Error('expected Tutorial controller and Solomon encounter')
  }
  const initialPlayer = getPlayerCharacter(state, 'owner')
  const stagedPlayer = {
    ...initialPlayer,
    position: { x: 1_025, y: 1_350 },
    velocity: { x: 100, y: -50 },
  }
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(state.playerEntities, 'owner', stagedPlayer),
    world: {
      ...state.world,
      encounter: {
        ...state.world.encounter,
        phase: 'escaping',
        runEventId: 1,
      },
      tutorial: {
        ...state.world.tutorial,
        introActive: false,
        introBlend: 1,
        introDelayTicksRemaining: 0,
        introFade: 0,
        introMovementTicksRemaining: 0,
        stage: 1,
      },
    },
  }
  state = stepGameSimulationTick(state, {})
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard' || !state.world.tutorial) {
    throw new Error('expected Tutorial stage 2')
  }
  assert.equal(state.world.tutorial.stage, 2)
  assert.equal(state.world.enemies.actors.length, 10)
  assert.deepEqual(getPlayerCharacter(state, 'owner').position, stagedPlayer.position)
  assert.deepEqual(getPlayerCharacter(state, 'owner').velocity, { x: 0, y: 0 })
  const frozenPlayerPosition = { ...getPlayerCharacter(state, 'owner').position }
  const frozen = {
    actors: structuredClone(state.world.enemies.actors),
    deathEffects: structuredClone(state.world.enemies.deathEffects),
    headFacingRngState: state.world.enemies.headFacingRngState,
    locomotionRngState: state.world.enemies.locomotionRngState,
    mageLightningPulses: structuredClone(state.world.enemies.mageLightningPulses),
    maggots: structuredClone(state.world.enemies.maggots),
    projectileEffects: structuredClone(state.world.enemies.projectileEffects),
    projectiles: structuredClone(state.world.enemies.projectiles),
    rngState: state.world.enemies.rngState,
    steeringRngState: state.world.enemies.steeringRngState,
  }
  const firstHeldEnemyTick = state.world.enemies.lastStepTick
  const heldMovement = {
    ...createIdlePlayerCharacterInput(),
    movement: { x: 1, y: 0 },
  }
  for (let tick = 0; tick < 50; tick += 1) {
    state = stepGameSimulationTick(state, { owner: heldMovement })
  }
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard' || !state.world.tutorial) {
    throw new Error('expected held Tutorial stage 2')
  }
  assert.equal(state.world.tutorial.stage, 2)
  assert.equal(state.world.enemies.lastStepTick, firstHeldEnemyTick + 50)
  assert.deepEqual(getPlayerCharacter(state, 'owner').position, frozenPlayerPosition)
  assert.deepEqual(getPlayerCharacter(state, 'owner').velocity, { x: 0, y: 0 })
  assert.deepEqual({
    actors: state.world.enemies.actors,
    deathEffects: state.world.enemies.deathEffects,
    headFacingRngState: state.world.enemies.headFacingRngState,
    locomotionRngState: state.world.enemies.locomotionRngState,
    mageLightningPulses: state.world.enemies.mageLightningPulses,
    maggots: state.world.enemies.maggots,
    projectileEffects: state.world.enemies.projectileEffects,
    projectiles: state.world.enemies.projectiles,
    rngState: state.world.enemies.rngState,
    steeringRngState: state.world.enemies.steeringRngState,
  }, frozen)

  const cast = {
    ...createIdlePlayerCharacterInput(),
    aim: { x: 1_025, y: 1_170 },
    cast: { primary: true, quickbar: null },
    movement: { x: 1, y: 0 },
  }
  state = stepGameSimulationTick(state, { owner: cast })
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard' || !state.world.tutorial) {
    throw new Error('expected cast-admitted Tutorial stage 2')
  }
  assert.equal(state.world.tutorial.stage, 2)
  assert.ok(getPlayerCharacter(state, 'owner').primaryCast.castSequence > 0)
  assert.deepEqual(getPlayerCharacter(state, 'owner').position, frozenPlayerPosition)
  state = stepGameSimulationTick(state, {})
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard' || !state.world.tutorial) {
    throw new Error('expected released Tutorial stage 3')
  }
  assert.equal(state.world.tutorial.stage, 3)
  assert.notDeepEqual(state.world.enemies.actors, frozen.actors)
  state = stepGameSimulationTick(state, { owner: heldMovement })
  assert.ok(getPlayerCharacter(state, 'owner').position.x > frozenPlayerPosition.x)
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
