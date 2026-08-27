import assert from 'node:assert/strict'
import test from 'node:test'

import { NATIVE_TUTORIAL_EQUIPMENT_APPEARANCE } from './native-starter-equipment.ts'

import {
  NATIVE_TUTORIAL_AMULET_DESCRIPTION,
  NATIVE_TUTORIAL_AMULET_IDENTITY,
  NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS,
  NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  NATIVE_TUTORIAL_CAMERA_TARGET,
  NATIVE_TUTORIAL_CUES,
  NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN,
  NATIVE_TUTORIAL_FIRES,
  NATIVE_TUTORIAL_MONSTER_RECIPES,
  NATIVE_TUTORIAL_SCRIPT_COMMAND_IDS,
  NATIVE_TUTORIAL_SCRIPT_IDS,
  NATIVE_TUTORIAL_STAGES,
  NATIVE_TUTORIAL_TRIGGER_IDS,
  NATIVE_TUTORIAL_UID_GROUPS,
  NATIVE_TUTORIAL_WAVE_BATCHES,
  acknowledgeNativeTutorialMovementInstruction,
  applyNativeTutorialSurfaceAction,
  createNativeTutorialState,
  nativeTutorialCameraBounds,
  nativeTutorialCameraLockSafetyClear,
  nativeTutorialDialogueTicks,
  nativeTutorialEnemyCameraPositionIsAllowed,
  nativeTutorialEnemySpawnPositionIsAllowed,
  nativeTutorialForcedVelocity,
  nativeTutorialHostileScenePaused,
  nativeTutorialHudAccess,
  nativeTutorialInstructionBaselines,
  nativeTutorialPlayerMovementPaused,
  nativeTutorialAmuletIdentityMatches,
  nativeTutorialAmuletItem,
  nativeTutorialPresentation,
  stepNativeTutorial,
  type NativeTutorialState,
  type NativeTutorialTickInput,
} from './native-tutorial.ts'

const BASE_INPUT: NativeTutorialTickInput = {
  acidRainCastSequence: 0,
  acidRainLastSkillId: null,
  cameraLockSafetyClear: true,
  currentHealth: 100,
  enemyCount: 0,
  groundSackCount: 0,
  hasTopLevelNonPotionItem: false,
  healthPotionCount: 0,
  level: 1,
  levelUpPending: false,
  maximumHealth: 100,
  playerActionIdle: true,
  playerPosition: { x: 1025, y: 2070.0703125 },
  primaryCastSequence: 0,
  solomonPhase: null,
  solomonRunEventId: 0,
  tick: 1,
}

function afterIntro(source: NativeTutorialState): NativeTutorialState {
  return {
    ...source,
    introActive: false,
    introBlend: 1,
    introDelayTicksRemaining: 0,
    introFade: 0,
    introMovementTicksRemaining: 250,
  }
}

test('locks the complete stock Tutorial authored membership', () => {
  assert.deepEqual(NATIVE_TUTORIAL_STAGES, [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  ])
  assert.equal(NATIVE_TUTORIAL_CUES.length, 24)
  assert.deepEqual(NATIVE_TUTORIAL_TRIGGER_IDS, [
    10001, 10003, 10047, 10049, 10054, 10057, 10063, 10072, 10074, 10079,
    10081, 10083, 642218,
  ])
  assert.deepEqual(NATIVE_TUTORIAL_SCRIPT_IDS, [
    10000, 10002, 10048, 10050, 10055, 10058, 10064, 10073, 10075, 10080,
    10084, 642219,
  ])
  assert.deepEqual(NATIVE_TUTORIAL_SCRIPT_COMMAND_IDS, [
    1002, 1004, 1005, 1006, 1007, 1008, 1010, 1013, 1020, 1032, 1033, 1048,
    1051, 1058, 1059, 1061, 1065, 1066,
  ])
  assert.deepEqual(Object.keys(NATIVE_TUTORIAL_MONSTER_RECIPES).map(Number), [
    10004, 10051, 10059, 10065, 10076, 10077, 10085,
  ])
  assert.deepEqual(Object.keys(NATIVE_TUTORIAL_UID_GROUPS).map(Number), [
    10010, 10052, 10060, 10061, 10078, 10086,
  ])
  assert.deepEqual(NATIVE_TUTORIAL_UID_GROUPS, {
    10010: {
      memberUids: [10004, 10004, 10004, 10004, 10004],
      positionCacheDword: 0,
      shareFinalRoot: false,
    },
    10052: {
      memberUids: [10051, 10051, 10051, 10051, 10051],
      positionCacheDword: 0,
      shareFinalRoot: false,
    },
    10060: {
      memberUids: [10059, 10059, 10004, 10004, 10004],
      positionCacheDword: 0,
      shareFinalRoot: false,
    },
    10061: {
      memberUids: [10059, 10059, 10059],
      positionCacheDword: 0xcdcdcdcd,
      shareFinalRoot: true,
    },
    10078: {
      memberUids: [10076, 10077, 10076],
      positionCacheDword: 0,
      shareFinalRoot: false,
    },
    10086: {
      memberUids: [10085, 10076],
      positionCacheDword: 0,
      shareFinalRoot: false,
    },
  })
  assert.deepEqual(Object.fromEntries(Object.entries(NATIVE_TUTORIAL_WAVE_BATCHES).map(
    ([wave, batches]) => [wave, batches.map(batch => [
      batch.tick,
      batch.groupUid,
      batch.recipeUid,
      batch.count,
      batch.positionPolicy,
    ])],
  )), {
    1: [[0, 10010, null, null, 'dark'], [0, 10010, null, null, 'dark']],
    2: [[0, 10052, null, null, 'offscreen'], [200, 10052, null, null, 'offscreen'], [400, 10052, null, null, 'offscreen'], [1300, 10052, null, null, 'light']],
    3: [[0, 10010, null, 3, 'dark'], [0, 10010, null, null, 'offscreen'], [400, 10010, null, null, 'offscreen'], [800, 10010, null, null, 'offscreen'], [1200, 10010, null, null, 'offscreen']],
    4: [[0, 10010, null, null, 'dark'], [0, 10060, null, null, 'dark'], [500, 10061, null, null, 'dark']],
    5: [[0, null, 10065, null, 'light']],
    6: [],
  })
  assert.deepEqual(NATIVE_TUTORIAL_FIRES, [
    { damage: 1, lifetimeTicks: 1_000, position: { x: 1766.1005859375, y: 147.63815307617188 }, radius: 100 },
    { damage: 1, lifetimeTicks: 1_000, position: { x: 1852.1005859375, y: 199.63815307617188 }, radius: 100 },
  ])
  assert.equal(nativeTutorialDialogueTicks(), 3_054)
  assert.equal(
    NATIVE_TUTORIAL_AMULET_DESCRIPTION,
    'A dull trinket, carved with a few beneficial runes',
  )
  assert.deepEqual(NATIVE_TUTORIAL_AMULET_IDENTITY.nativeEffects, [
    { kind: 2, magnitude: 10, operator: 2, target: 0 },
  ])
  assert.deepEqual(nativeTutorialAmuletItem().nativeEffects, [
    { kind: 2, magnitude: 10, operator: 2, target: 0 },
  ])
  const amulet = { ...nativeTutorialAmuletItem(), id: 100 }
  assert.equal(nativeTutorialAmuletIdentityMatches(amulet), true)
  assert.equal(nativeTutorialAmuletIdentityMatches({ ...amulet, name: 'Amulet' }), false)
  assert.equal(nativeTutorialAmuletIdentityMatches({ ...amulet, nativeSelector: 1 }), false)
  assert.equal(nativeTutorialAmuletIdentityMatches({ ...amulet, iconRecords: [30] }), false)
  assert.equal(nativeTutorialAmuletIdentityMatches({ ...amulet, iconTints: [] }), false)
  assert.equal(nativeTutorialAmuletIdentityMatches({
    ...amulet,
    nativeEffects: [{ kind: 2, magnitude: 9, operator: 2, target: 0 }],
  }), false)
})

test('keeps Sirmin tan while the independent Ether Staff effect remains purple', () => {
  assert.deepEqual(NATIVE_TUTORIAL_EQUIPMENT_APPEARANCE, {
    primaryTint: 0xc4915e,
    secondaryTint: 0xffffff,
  })
})

test('starts the exact two five-skeleton opening groups when Solomon runs', () => {
  const initial = createNativeTutorialState(BASE_INPUT.playerPosition, 0, 'tutorial-test')
  const stageOne = { ...afterIntro(initial), stage: 1 as const }
  const result = stepNativeTutorial(stageOne, {
    ...BASE_INPUT,
    solomonPhase: 'escaping',
    solomonRunEventId: 1,
  })
  assert.equal(result.state.stage, 2)
  assert.equal(result.state.waveOrdinal, 1)
  assert.equal(result.spawnIntents.length, 10)
  assert.deepEqual(result.spawnIntents.map(intent => intent.authoredRecipe?.uid), Array(10).fill(10004))
  assert.ok(result.spawnIntents.every(intent => intent.positionPolicy === 'dark'))
  assert.ok(result.spawnIntents.every(intent => intent.placementGroupId === undefined))
  assert.equal(new Set(result.spawnIntents.map(({ position }) => (
    `${position.x},${position.y}`
  ))).size, 10)

  const heldInstruction = stepNativeTutorial(result.state, {
    ...BASE_INPUT,
    enemyCount: 10,
    solomonPhase: 'escaping',
    solomonRunEventId: 1,
    tick: 2,
  })
  assert.equal(heldInstruction.state.stage, 2)
  assert.equal(nativeTutorialHostileScenePaused(heldInstruction.state), true)
  assert.equal(nativeTutorialPlayerMovementPaused(heldInstruction.state), true)
  assert.equal(nativeTutorialPresentation(heldInstruction.state, {
    inventory: 'I', moveDown: 'S', moveLeft: 'A', moveRight: 'D', moveUp: 'W',
    potion: '1', secondary: 'Right Mouse', skills: 'K',
  }, 'desktop').heading, 'POINT AND CLICK YOUR MOUSE\nTO THROW MAGIC MISSILES')

  const released = stepNativeTutorial(heldInstruction.state, {
    ...BASE_INPUT,
    enemyCount: 10,
    primaryCastSequence: 1,
    solomonPhase: 'escaping',
    solomonRunEventId: 1,
    tick: 3,
  })
  assert.equal(released.state.stage, 3)
  assert.equal(nativeTutorialHostileScenePaused(released.state), false)
  assert.equal(nativeTutorialPlayerMovementPaused(released.state), false)
  assert.equal(nativeTutorialPresentation(released.state, {
    inventory: 'I', moveDown: 'S', moveLeft: 'A', moveRight: 'D', moveUp: 'W',
    potion: '1', secondary: 'Right Mouse', skills: 'K',
  }, 'desktop').heading, null)
})

test('movement copy hides only after authenticated input produces a movement epoch', () => {
  const ready = afterIntro(createNativeTutorialState(
    BASE_INPUT.playerPosition,
    0,
    'tutorial-movement-copy',
  ))
  const bindings = {
    inventory: 'I',
    moveDown: 'Down',
    moveLeft: 'Left',
    moveRight: 'Right',
    moveUp: 'Up',
    potion: '3',
    secondary: 'Right Mouse',
    skills: 'K',
  }
  assert.deepEqual(nativeTutorialPresentation(ready, bindings, 'desktop'), {
    heading: 'USE YOUR KEYBOARD\nTO MOVE THE WIZARD',
    hud: { combat: false, inventory: false, quickbar: false, skills: false, spell: false },
    subheading: 'Move with Up, Left, Down, and Right',
  })
  assert.deepEqual(nativeTutorialPresentation(ready, bindings, 'mobile'), {
    heading: 'USE THE LEFT JOYSTICK\nTO MOVE THE WIZARD',
    hud: { combat: false, inventory: false, quickbar: false, skills: false, spell: false },
    subheading: 'Find and confront Solomon Dark',
  })
  const forcedMotion = stepNativeTutorial(ready, {
    ...BASE_INPUT,
    playerPosition: { x: BASE_INPUT.playerPosition.x, y: BASE_INPUT.playerPosition.y - 50 },
  })
  assert.equal(forcedMotion.state.movementInstructionAcknowledged, false)
  assert.notEqual(nativeTutorialPresentation(forcedMotion.state, bindings, 'desktop').heading, null)

  const sealedInput = acknowledgeNativeTutorialMovementInstruction(forcedMotion.state, {
    movementEpochActive: false,
    userMovementRequested: true,
  })
  assert.equal(sealedInput.movementInstructionAcknowledged, false)

  const forcedEpoch = acknowledgeNativeTutorialMovementInstruction(forcedMotion.state, {
    movementEpochActive: true,
    userMovementRequested: false,
  })
  assert.equal(forcedEpoch.movementInstructionAcknowledged, false)

  const moved = acknowledgeNativeTutorialMovementInstruction(forcedMotion.state, {
    movementEpochActive: true,
    userMovementRequested: true,
  })
  assert.equal(moved.stage, 0)
  assert.equal(moved.movementInstructionAcknowledged, true)
  assert.deepEqual(nativeTutorialPresentation(moved, bindings, 'desktop'), {
    heading: null,
    hud: { combat: false, inventory: false, quickbar: false, skills: false, spell: false },
    subheading: null,
  })
})

test('shares only the Three Archers final placement while retaining fresh raw draws', () => {
  const initial = afterIntro(createNativeTutorialState(
    BASE_INPUT.playerPosition,
    0,
    'tutorial-three-archers',
  ))
  const result = stepNativeTutorial({
    ...initial,
    active: false,
    stage: 19,
    waveOrdinal: 4,
    waveSpawnCursor: 2,
    waveTicks: 500,
  }, BASE_INPUT)
  assert.equal(result.spawnIntents.length, 3)
  assert.deepEqual(result.spawnIntents.map(({ authoredRecipe }) => authoredRecipe?.uid), [
    10059, 10059, 10059,
  ])
  assert.deepEqual(result.spawnIntents.map(({ placementGroupId }) => placementGroupId), [1, 1, 1])
  assert.equal(new Set(result.spawnIntents.map(({ position }) => (
    `${position.x},${position.y}`
  ))).size, 3)
})

test('keeps enemy circles north of every authored entrance-Fence segment and Gate gap', () => {
  assert.equal(NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN.length, 17)
  for (let index = 1; index < NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN.length; index += 1) {
    const start = NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[index - 1]
    const end = NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[index]
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    }
    assert.equal(nativeTutorialEnemySpawnPositionIsAllowed({
      x: midpoint.x,
      y: midpoint.y - 26,
    }, 25), true, `segment ${index - 1}`)
    assert.equal(nativeTutorialEnemySpawnPositionIsAllowed({
      x: midpoint.x,
      y: midpoint.y - 24,
    }, 25), false, `segment ${index - 1}`)
  }
  assert.equal(nativeTutorialEnemySpawnPositionIsAllowed({ x: 1025, y: 1700 }, 25), false)
})

test('keeps the Tutorial camera target after its independent cleanup countdown', () => {
  const initial = afterIntro(createNativeTutorialState(
    BASE_INPUT.playerPosition,
    0,
    'tutorial-camera-lock',
  ))
  const triggered = stepNativeTutorial(initial, {
    ...BASE_INPUT,
    playerPosition: { x: 1025, y: 800 },
  }).state
  assert.equal(triggered.cameraLockTriggered, true)
  assert.equal(triggered.cameraLockAgeTicks, 0)
  assert.equal(triggered.cameraLockTicksRemaining, NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS)
  assert.deepEqual(nativeTutorialCameraBounds(triggered), { x: 0, y: 0, w: 2043, h: 2053 })

  let state = triggered
  for (let tick = 1; tick <= NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS; tick += 1) {
    state = stepNativeTutorial(state, {
      ...BASE_INPUT,
      playerPosition: { x: 1025, y: 800 },
      tick: tick + 1,
    }).state
    if (tick === 1) {
      assert.deepEqual(nativeTutorialCameraBounds(state), {
        x: 0,
        y: 0,
        w: 2043,
        h: Math.fround(2053 + (849.91796875 - 2053) * Math.fround(0.01)),
      })
    }
    if (tick === NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS) {
      assert.equal(state.cameraLockTicksRemaining, 0)
      assert.notDeepEqual(nativeTutorialCameraBounds(state), NATIVE_TUTORIAL_CAMERA_TARGET)
    }
  }
  assert.equal(state.cameraLockAgeTicks, NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS)
  assert.equal(state.cameraLockTicksRemaining, 0)
  assert.deepEqual(nativeTutorialCameraBounds(state), NATIVE_TUTORIAL_CAMERA_TARGET)
})

test('suspends the Tutorial camera lock while a living enemy circle is outside its target', () => {
  const boundary = {
    x: NATIVE_TUTORIAL_CAMERA_TARGET.w / 2,
    y: NATIVE_TUTORIAL_CAMERA_TARGET.h - 25,
  }
  assert.equal(nativeTutorialEnemyCameraPositionIsAllowed(boundary, 25), true)
  assert.equal(nativeTutorialEnemyCameraPositionIsAllowed({
    ...boundary,
    y: boundary.y + 0.001,
  }, 25), false)
  assert.equal(nativeTutorialEnemyCameraPositionIsAllowed({ x: 24.999, y: 400 }, 25), false)
  assert.equal(nativeTutorialCameraLockSafetyClear([
    { position: boundary, radius: 25 },
  ]), true)
  assert.equal(nativeTutorialCameraLockSafetyClear([
    { position: { x: 1025, y: 1400 }, radius: 25 },
  ]), false)

  const initial = afterIntro(createNativeTutorialState(
    BASE_INPUT.playerPosition,
    0,
    'tutorial-camera-safety',
  ))
  const blocked = stepNativeTutorial(initial, {
    ...BASE_INPUT,
    cameraLockSafetyClear: false,
    playerPosition: { x: 1025, y: 800 },
  }).state
  assert.equal(blocked.cameraLockTriggered, false)

  const triggered = stepNativeTutorial(blocked, {
    ...BASE_INPUT,
    playerPosition: { x: 1025, y: 800 },
  }).state
  assert.equal(triggered.cameraLockTriggered, true)
  const suspended = stepNativeTutorial(triggered, {
    ...BASE_INPUT,
    cameraLockSafetyClear: false,
    playerPosition: { x: 1025, y: 800 },
  }).state
  assert.equal(suspended.cameraLockTriggered, false)
  assert.equal(suspended.cameraLockAgeTicks, 0)
  assert.equal(suspended.cameraLockTicksRemaining, 0)
})

test('owns inventory and skills modal milestones as authoritative surface actions', () => {
  const initial = createNativeTutorialState(BASE_INPUT.playerPosition, 0, 'tutorial-test')
  const inventory = applyNativeTutorialSurfaceAction(
    { ...afterIntro(initial), stage: 9 as const },
    'inventory-opened',
  )
  assert.equal(inventory.inventoryOpened, true)
  const inventoryScreen = stepNativeTutorial(inventory, BASE_INPUT).state
  assert.equal(inventoryScreen.stage, 10)
  const inventoryClosed = applyNativeTutorialSurfaceAction(inventoryScreen, 'inventory-closed')
  const combatLesson = stepNativeTutorial(inventoryClosed, BASE_INPUT)
  assert.equal(combatLesson.state.stage, 11)
  assert.equal(combatLesson.state.waveOrdinal, 3)
  assert.deepEqual(combatLesson.forceOfferSkillIds, [65, 67, 60])

  const skills = applyNativeTutorialSurfaceAction(
    { ...afterIntro(initial), stage: 12 as const },
    'skills-opened',
  )
  const skillsScreen = stepNativeTutorial(skills, BASE_INPUT).state
  assert.equal(skillsScreen.stage, 13)
  const skillsClosed = applyNativeTutorialSurfaceAction(skillsScreen, 'skills-closed')
  const released = stepNativeTutorial(skillsClosed, BASE_INPUT).state
  assert.equal(released.stage, 15)
  assert.equal(released.waveOrdinal, 4)
  assert.equal(released.damageProtection, false)
})

test('acknowledges the stock primary and concentration-A selector open edges without advancing stage', () => {
  const initial = afterIntro(createNativeTutorialState(
    BASE_INPUT.playerPosition,
    0,
    'tutorial-selected-hud',
  ))
  assert.equal(initial.selectedSkillHudAcknowledged, false)
  assert.equal(applyNativeTutorialSurfaceAction(
    { ...initial, stage: 0 },
    'primary-selector-opened',
  ).selectedSkillHudAcknowledged, false)

  for (const action of [
    'primary-selector-opened',
    'concentration-a-selector-opened',
  ] as const) {
    const acknowledged = applyNativeTutorialSurfaceAction(
      { ...initial, stage: 14 },
      action,
    )
    assert.equal(acknowledged.selectedSkillHudAcknowledged, true)
    assert.equal(stepNativeTutorial(acknowledged, {
      ...BASE_INPUT,
      enemyCount: 3,
    }).state.stage, 14)
    assert.equal(applyNativeTutorialSurfaceAction(
      acknowledged,
      action,
    ), acknowledged)
  }
})

test('preserves the recovered round-robin survival clocks and predicates', () => {
  const initial = createNativeTutorialState(BASE_INPUT.playerPosition, 0, 'tutorial-test')
  let state: NativeTutorialState = {
    ...afterIntro(initial),
    stage: 19,
    survivalEnabled: true,
    survivalLastCheckedTicks: [0, 0, 0],
    waveOrdinal: 6,
  }
  let result = stepNativeTutorial(state, { ...BASE_INPUT, tick: 100 })
  assert.equal(result.spawnIntents.length, 1)
  assert.ok([10076, 10077].includes(result.spawnIntents[0]!.authoredRecipe!.uid))
  assert.equal(result.state.survivalIntervalCursor, 1)

  result = stepNativeTutorial(result.state, { ...BASE_INPUT, enemyCount: 11, tick: 100 })
  assert.equal(result.spawnIntents.length, 1)
  assert.equal(result.state.survivalIntervalCursor, 2)

  result = stepNativeTutorial(result.state, { ...BASE_INPUT, level: 4, tick: 150 })
  assert.equal(result.spawnIntents.length, 1)
  assert.ok([10085, 10076].includes(result.spawnIntents[0]!.authoredRecipe!.uid))
  assert.equal(result.state.survivalIntervalCursor, 0)
})

test('projects every stock teaching gate from the controller stage', () => {
  const initial = createNativeTutorialState(BASE_INPUT.playerPosition, 0, 'tutorial-test')
  assert.deepEqual(nativeTutorialHudAccess(initial), {
    combat: false,
    inventory: false,
    quickbar: false,
    skills: false,
    spell: false,
  })
  const ready = afterIntro(initial)
  const bindings = {
    inventory: 'I', moveDown: 'S', moveLeft: 'A', moveRight: 'D', moveUp: 'W',
    potion: '1', secondary: 'Right Mouse', skills: 'K',
  }
  assert.equal(
    nativeTutorialPresentation(ready, bindings, 'desktop').heading,
    'USE YOUR KEYBOARD\nTO MOVE THE WIZARD',
  )
  assert.deepEqual(nativeTutorialPresentation({ ...ready, stage: 8 }, bindings, 'desktop'), {
    heading: null,
    hud: { combat: false, inventory: false, quickbar: true, skills: false, spell: true },
    subheading: null,
  })
  assert.deepEqual(nativeTutorialPresentation({ ...ready, stage: 9 }, bindings, 'desktop'), {
    heading: 'ACCESS YOUR INVENTORY',
    hud: { combat: false, inventory: true, quickbar: true, skills: false, spell: true },
    subheading: "Click here or press 'I' to open the inventory screen",
  })
  assert.deepEqual(nativeTutorialPresentation({ ...ready, stage: 10 }, bindings, 'desktop'), {
    heading: null,
    hud: { combat: false, inventory: true, quickbar: true, skills: false, spell: true },
    subheading: null,
  })
  assert.deepEqual(nativeTutorialHudAccess({ ...ready, stage: 5 }), {
    combat: false,
    inventory: false,
    quickbar: true,
    skills: false,
    spell: true,
  })
  assert.deepEqual(nativeTutorialHudAccess({ ...ready, stage: 18 }), {
    combat: true,
    inventory: true,
    quickbar: true,
    skills: true,
    spell: true,
  })
  assert.deepEqual(nativeTutorialInstructionBaselines(0), { heading: 100, subheading: 170 })
  assert.deepEqual(nativeTutorialInstructionBaselines(5), { heading: 730, subheading: 760 })
  assert.deepEqual(nativeTutorialInstructionBaselines(5, 1_080), {
    heading: 910,
    subheading: 940,
  })
  assert.deepEqual(nativeTutorialInstructionBaselines(11), { heading: 80, subheading: 110 })
  assert.deepEqual(nativeTutorialInstructionBaselines(19), { heading: 200, subheading: null })
})

test('holds the controller for the exact 475-tick stock intro state', () => {
  const initial = createNativeTutorialState(BASE_INPUT.playerPosition, 0, 'tutorial-intro')
  assert.equal(nativeTutorialForcedVelocity(initial), null)
  assert.equal(nativeTutorialForcedVelocity({
    ...initial,
    introBlend: Math.fround(0.7974),
    introDelayTicksRemaining: 0,
  }), null)
  assert.deepEqual(nativeTutorialForcedVelocity({
    ...initial,
    introBlend: Math.fround(0.8),
    introDelayTicksRemaining: 0,
  }), { x: 0, y: -100 })

  let state = initial
  for (let tick = 1; tick <= 474; tick += 1) {
    state = stepNativeTutorial(state, { ...BASE_INPUT, tick }).state
  }
  assert.equal(state.introActive, true)
  assert.equal(state.introDelayTicksRemaining, 0)
  assert.equal(state.introBlend, 1)
  assert.ok(state.introFade > 0 && state.introFade < 0.000_001)
  assert.equal(state.introMovementTicksRemaining, 250)
  assert.equal(state.stageTicks, 0)
  assert.deepEqual(nativeTutorialForcedVelocity(state), { x: 0, y: -100 })

  state = stepNativeTutorial(state, { ...BASE_INPUT, tick: 475 }).state
  assert.equal(state.introActive, false)
  assert.equal(state.introFade, 0)
  assert.equal(state.stageTicks, 0)
  assert.deepEqual(nativeTutorialForcedVelocity(state), {
    x: 0,
    y: Math.fround(Math.fround(-249 / 250) * 100),
  })

  state = stepNativeTutorial(state, { ...BASE_INPUT, tick: 476 }).state
  assert.equal(state.introMovementTicksRemaining, 249)
  assert.equal(state.stageTicks, 1)
  assert.deepEqual(nativeTutorialForcedVelocity({
    ...state,
    introMovementTicksRemaining: 2,
  }), { x: 0, y: Math.fround(Math.fround(-1 / 250) * 100) })
  assert.equal(nativeTutorialForcedVelocity({
    ...state,
    introMovementTicksRemaining: 1,
  }), null)
})
