import type { AuthoredBoneyardEnemyRecipe } from './boneyard-enemy-config.ts'
import type { BoneyardEnemySpawnIntent } from './boneyard-wave-director.ts'
import type { BoneyardSpawnPositionPolicy } from './boneyard-wave-timeline.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import { seedBoneyardWaveRng } from './boneyard-wave-timeline.ts'
import type { BoneyardBounds, BoneyardPoint } from './boneyard.ts'
import type { BoneyardSolomonPhase } from './boneyard-encounter.ts'
import type { HubInventoryItem } from './hub-economy.ts'
import { PLAYER_CHARACTER_STEADY_SPEED } from './player-character.ts'

export const STOCK_TUTORIAL_BONEYARD_ID = 'stock-tutorial'
export const NATIVE_TUTORIAL_TICK_RATE = 100
export const NATIVE_TUTORIAL_ACID_RAIN_SKILL_ID = 72
export const NATIVE_TUTORIAL_STARTING_PRIMARY_SKILL_ID = 8
export const NATIVE_TUTORIAL_STARTING_SECONDARY_SKILL_ID = 11
export const NATIVE_TUTORIAL_AMULET_DESCRIPTION =
  'A dull trinket, carved with a few beneficial runes'
export const NATIVE_TUTORIAL_AMULET_IDENTITY = Object.freeze({
  equipmentType: 'amulet' as const,
  iconRecords: Object.freeze([30, 18] as const),
  iconTints: Object.freeze([0xffffff, 0xffffff] as const),
  name: "Sorceror's Amulet",
  nativeEffects: Object.freeze([
    Object.freeze({ kind: 2, magnitude: 10, operator: 2 as const, target: 0 }),
  ]),
  nativeSelector: 0,
  nativeTypeId: 7003 as const,
})

export const NATIVE_TUTORIAL_STAGES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
] as const
export type NativeTutorialStage = typeof NATIVE_TUTORIAL_STAGES[number]

export const NATIVE_TUTORIAL_TRIGGER_IDS = Object.freeze([
  10001, 10003, 10047, 10049, 10054, 10057, 10063, 10072, 10074, 10079,
  10081, 10083, 642218,
] as const)

export const NATIVE_TUTORIAL_SCRIPT_IDS = Object.freeze([
  10000, 10002, 10048, 10050, 10055, 10058, 10064, 10073, 10075, 10080,
  10084, 642219,
] as const)

export const NATIVE_TUTORIAL_SCRIPT_COMMAND_IDS = Object.freeze([
  1002, 1004, 1005, 1006, 1007, 1008, 1010, 1013, 1020, 1032, 1033, 1048,
  1051, 1058, 1059, 1061, 1065, 1066,
] as const)

export const NATIVE_TUTORIAL_SURFACE_ACTIONS = [
  'inventory-opened',
  'inventory-closed',
  'skills-opened',
  'skills-closed',
  'primary-selector-opened',
  'concentration-a-selector-opened',
] as const
export type NativeTutorialSurfaceAction = typeof NATIVE_TUTORIAL_SURFACE_ACTIONS[number]

export const NATIVE_TUTORIAL_CUES = [
  'tutorial-show-yourself',
  'tutorial-oh-boy-another-wizard',
  'tutorial-been-dispatched',
  'tutorial-do-the-dispatching',
  'tutorial-your-perversions',
  'tutorial-to-death-exactly',
  'solomon-laugh-1',
  'tutorial-coward-come-back',
  'solomon-get-him-boys',
  'tutorial-i-am-sirmin',
  'tutorial-never-heard-of-you',
  'tutorial-easily-vanquished',
  'tutorial-came-prepared',
  'tutorial-acid-rain-huh',
  'tutorial-surrender',
  'tutorial-careless-fool',
  'tutorial-unredeemable',
  'tutorial-sound-like-mother',
  'tutorial-accept-your-fate',
  'tutorial-make-me-stronger',
  'tutorial-levelling-up',
  'tutorial-looking-beat-up',
  'tutorial-face-the-wrath',
  'tutorial-im-bored',
] as const
export type NativeTutorialCue = typeof NATIVE_TUTORIAL_CUES[number]
export type NativeTutorialSpeaker = 'sirmin' | 'solomon'

export interface NativeTutorialCueDefinition {
  readonly durationTicks: number
  readonly speaker: NativeTutorialSpeaker
  readonly text: string
}

export const NATIVE_TUTORIAL_CUE_DEFINITIONS: Readonly<
  Record<NativeTutorialCue, NativeTutorialCueDefinition>
> = Object.freeze({
  'tutorial-show-yourself': cue(280, 'sirmin', 'SOLOMON DARK!  Show yourself!'),
  'tutorial-oh-boy-another-wizard': cue(844, 'solomon', 'Oh boy, another pointy head from Wizard School.  What is it this time?'),
  'tutorial-been-dispatched': cue(547, 'sirmin', 'Solomon Dark, I have been dispatched here by the College to make you answer for your crimes!'),
  'tutorial-do-the-dispatching': cue(267, 'solomon', "I'll do the dispatching"),
  'tutorial-your-perversions': cue(782, 'sirmin', 'For your perversions against nature, and for the foul murders of the junior mages Morth, Aliss, and Lucritius, I sentence you... TO DEATH!'),
  'tutorial-to-death-exactly': cue(614, 'solomon', 'To death!  Exactly what I had in mind!  Let\'s get it on!'),
  'solomon-laugh-1': cue(247, 'solomon', '(Laughs Wildly)'),
  'tutorial-coward-come-back': cue(220, 'sirmin', 'Coward!  Come back!'),
  'solomon-get-him-boys': cue(245, 'solomon', 'Get him, boys!'),
  'tutorial-i-am-sirmin': cue(597, 'sirmin', 'Your foul necromancy cannot stand against me, for I am Sirmin the Wizard!'),
  'tutorial-never-heard-of-you': cue(621, 'solomon', "I've never heard of you, and nobody else will either."),
  'tutorial-easily-vanquished': cue(446, 'sirmin', 'Ha!  Your so called skeletal hordes are easily vanquished!'),
  'tutorial-came-prepared': cue(299, 'sirmin', 'You see that I came prepared!  I am no neophyte mage, to be awed by a few undead!'),
  'tutorial-acid-rain-huh': cue(406, 'solomon', "Acid rain, huh?  That's kid stuff!"),
  'tutorial-surrender': cue(555, 'sirmin', 'I tire of this!  Surrender and your death will be painless, I swear it.'),
  'tutorial-careless-fool': cue(295, 'sirmin', 'You fool!  Your slave has dropped something precious, I see!'),
  'tutorial-unredeemable': cue(691, 'sirmin', 'Now I bear the amulet!  You are too clumsy and careless to call yourself a wizard!'),
  'tutorial-sound-like-mother': cue(250, 'solomon', 'Geez, you sound like my mother.'),
  'tutorial-accept-your-fate': cue(307, 'sirmin', 'You cannot prevail.  Accept your fate!'),
  'tutorial-make-me-stronger': cue(337, 'sirmin', 'Your depraved magic only serves to make me stronger, Dark Lord!'),
  'tutorial-levelling-up': cue(469, 'solomon', 'Levelling up is not going to save you.'),
  'tutorial-looking-beat-up': cue(578, 'solomon', "You're looking a little beat up there, son."),
  'tutorial-face-the-wrath': cue(727, 'sirmin', 'Now face the wrath of a fully restored and angry wizard!'),
  'tutorial-im-bored': cue(693, 'solomon', "And... I'm bored.  Destroy him, my skeletons!"),
})

export interface NativeTutorialNarrationEvent {
  readonly cue: NativeTutorialCue
  readonly eventId: number
  readonly speaker: NativeTutorialSpeaker
  readonly text: string
}

export interface NativeTutorialNarrationState {
  readonly current: NativeTutorialNarrationEvent | null
  readonly nextEventId: number
  readonly pending: readonly NativeTutorialCue[]
  readonly ticksRemaining: number
}

export interface NativeTutorialState {
  readonly active: boolean
  readonly cameraLockAgeTicks: number
  readonly cameraLockTriggered: boolean
  readonly cameraLockTicksRemaining: number
  readonly damageProtection: boolean
  readonly dialogueArmed: boolean
  readonly introActive: boolean
  readonly introBlend: number
  readonly introDelayTicksRemaining: number
  readonly introFade: number
  readonly introMovementTicksRemaining: number
  readonly inventoryOpened: boolean
  readonly inventorySeen: boolean
  readonly itemDropArmed: boolean
  readonly movementAnchor: Readonly<BoneyardPoint>
  readonly movementInstructionAcknowledged: boolean
  readonly narration: NativeTutorialNarrationState
  readonly nextSpawnIntentId: number
  readonly primaryCastSequenceAtStart: number
  readonly rngState: NativeRngState
  readonly selectedSkillHudAcknowledged: boolean
  readonly skillsOpened: boolean
  readonly skillsSeen: boolean
  readonly solomonDialogueQueued: boolean
  readonly solomonRetreatQueued: boolean
  readonly stage: NativeTutorialStage
  readonly stageTicks: number
  readonly survivalEnabled: boolean
  readonly survivalIntervalCursor: 0 | 1 | 2
  readonly survivalLastCheckedTicks: readonly [number, number, number]
  readonly waveOrdinal: number
  readonly waveSpawnCursor: number
  readonly waveTicks: number
}

export interface NativeTutorialTickInput {
  readonly acidRainCastSequence: number
  readonly acidRainLastSkillId: number | null
  readonly cameraLockSafetyClear: boolean
  readonly currentHealth: number
  readonly enemyCount: number
  readonly groundSackCount: number
  readonly hasTopLevelNonPotionItem: boolean
  readonly healthPotionCount: number
  readonly level: number
  readonly levelUpPending: boolean
  readonly maximumHealth: number
  readonly playerActionIdle: boolean
  readonly playerMovementActive: boolean
  readonly playerPosition: Readonly<BoneyardPoint>
  readonly primaryCastSequence: number
  readonly solomonPhase: BoneyardSolomonPhase | null
  readonly solomonRunEventId: number
  readonly tick: number
}

export interface NativeTutorialTickResult {
  readonly forceOfferSkillIds: readonly number[] | null
  readonly grantExperience: number
  readonly spawnIntents: readonly BoneyardEnemySpawnIntent[]
  readonly state: NativeTutorialState
}

export interface NativeTutorialHudAccess {
  readonly combat: boolean
  readonly inventory: boolean
  readonly quickbar: boolean
  readonly skills: boolean
  readonly spell: boolean
}

export interface NativeTutorialPresentation {
  readonly heading: string | null
  readonly hud: NativeTutorialHudAccess
  readonly subheading: string | null
}

export type NativeTutorialInputMode = 'desktop' | 'mobile'

export interface NativeTutorialBindingLabels {
  readonly inventory: string
  readonly moveDown: string
  readonly moveLeft: string
  readonly moveRight: string
  readonly moveUp: string
  readonly potion: string
  readonly secondary: string
  readonly skills: string
}

export interface NativeTutorialInstructionBaselines {
  readonly heading: number
  readonly subheading: number | null
}

interface TutorialRecipe extends AuthoredBoneyardEnemyRecipe {
  readonly enemyToken: BoneyardEnemySpawnIntent['enemyToken']
  readonly flanking: boolean
  readonly pathfindingMode: 0 | 1 | 2 | 3
}

const DISABLED_LOOT = Object.freeze({
  gold: 4, item: 4, orb: 4, potion: 4, powerup: 4, specificItem: 0,
} as const)

export const NATIVE_TUTORIAL_MONSTER_RECIPES: Readonly<Record<number, TutorialRecipe>> =
  Object.freeze({
    10004: recipe(10004, 'Starter SKELETON', 'SKELETON', 2, 1, 1.100000023841858, 2, 0, DISABLED_LOOT),
    10051: recipe(10051, 'Item Skeleton', 'SKELETON', 2, 1, 1.100000023841858, 2, 0, DISABLED_LOOT),
    10059: recipe(10059, 'SKELETAL ARCHER', 'SKELETONARCHER', 3, 2, 1, 2, 1, DISABLED_LOOT),
    10065: recipe(10065, 'Potion SKELETON', 'SKELETON', 4, 1, 1, 1, 0, DISABLED_LOOT),
    10076: recipe(10076, 'SKELETON', 'SKELETON', 3, 1, 1, 1, 0, {
      gold: 0, item: 0, orb: 0, potion: 4, powerup: 4, specificItem: 0,
    }),
    10077: recipe(10077, 'SKELETAL ARCHER', 'SKELETONARCHER', 4, 3, 1, 1, 0, {
      gold: 0, item: 0, orb: 0, potion: 1, powerup: 4, specificItem: 0,
    }),
    10085: recipe(10085, 'DEADLY SKELETAL ARCHER', 'SKELETONARCHER', 4, 3, 1, 1, 1, {
      gold: 0, item: 0, orb: 0, potion: 0, powerup: 4, specificItem: 0,
    }),
  })

export interface NativeTutorialUidGroup {
  readonly memberUids: readonly number[]
  readonly positionCacheDword: number
  readonly shareFinalRoot: boolean
}

export const NATIVE_TUTORIAL_UID_GROUPS: Readonly<Record<number, NativeTutorialUidGroup>> =
  Object.freeze({
    10010: uidGroup([10004, 10004, 10004, 10004, 10004], 0),
    10052: uidGroup([10051, 10051, 10051, 10051, 10051], 0),
    10060: uidGroup([10059, 10059, 10004, 10004, 10004], 0),
    10061: uidGroup([10059, 10059, 10059], 0xcdcdcdcd),
    10078: uidGroup([10076, 10077, 10076], 0),
    10086: uidGroup([10085, 10076], 0),
  })

export const NATIVE_TUTORIAL_FIRES = Object.freeze([
  Object.freeze({ damage: 1, lifetimeTicks: 1_000, position: Object.freeze({ x: 1766.1005859375, y: 147.63815307617188 }), radius: 100 }),
  Object.freeze({ damage: 1, lifetimeTicks: 1_000, position: Object.freeze({ x: 1852.1005859375, y: 199.63815307617188 }), radius: 100 }),
])

export const NATIVE_TUTORIAL_CAMERA_TRIGGER = Object.freeze({
  h: 887.3675537109375,
  w: 2099.2255859375,
  x: -77.77447509765625,
  y: -55.6324462890625,
})

export const NATIVE_TUTORIAL_CAMERA_LOCK = Object.freeze({
  h: 887.3675537109375,
  w: 2675.215576171875,
  x: -35.53448486328125,
  y: -37.4495849609375,
})

export const NATIVE_TUTORIAL_LEVEL_BOUNDS = Object.freeze({
  h: 2053,
  w: 2043,
  x: 0,
  y: 0,
})

export const NATIVE_TUTORIAL_CAMERA_TARGET = Object.freeze({
  h: 849.91796875,
  w: 2043,
  x: 0,
  y: 0,
})

export const NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS = 300
export const NATIVE_TUTORIAL_CAMERA_LOCK_INITIAL_BLEND = Math.fround(0.01)
export const NATIVE_TUTORIAL_CAMERA_LOCK_BLEND_GROWTH = 1.01
export const NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS = 464

const NATIVE_TUTORIAL_CAMERA_BOUNDS_BY_AGE = buildNativeTutorialCameraBounds()

export const NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN = Object.freeze([
  Object.freeze({ x: 4.150634765625, y: 1627.25146484375 }),
  Object.freeze({ x: 149.150634765625, y: 1623.25146484375 }),
  Object.freeze({ x: 311.150634765625, y: 1620.25146484375 }),
  Object.freeze({ x: 451.150634765625, y: 1620.25146484375 }),
  Object.freeze({ x: 604.150634765625, y: 1618.25146484375 }),
  Object.freeze({ x: 746.150634765625, y: 1616.25146484375 }),
  Object.freeze({ x: 874.206787109375, y: 1614.6953125 }),
  Object.freeze({ x: 933.454345703125, y: 1616 }),
  Object.freeze({ x: 1118.454345703125, y: 1609 }),
  Object.freeze({ x: 1171.994140625, y: 1609 }),
  Object.freeze({ x: 1248.994140625, y: 1609 }),
  Object.freeze({ x: 1325.994140625, y: 1610 }),
  Object.freeze({ x: 1473.150634765625, y: 1611.25146484375 }),
  Object.freeze({ x: 1610.150634765625, y: 1609.25146484375 }),
  Object.freeze({ x: 1747.150634765625, y: 1608.25146484375 }),
  Object.freeze({ x: 1901.150634765625, y: 1606.25146484375 }),
  Object.freeze({ x: 2044.150634765625, y: 1605.25146484375 }),
])

export const NATIVE_TUTORIAL_WAVE_BATCHES: Readonly<
  Record<number, readonly NativeTutorialSpawnBatch[]>
> = Object.freeze({
  1: Object.freeze([
    groupBatch(0, 10010, 'dark'),
    groupBatch(0, 10010, 'dark'),
  ]),
  2: Object.freeze([
    groupBatch(0, 10052, 'offscreen'),
    groupBatch(200, 10052, 'offscreen'),
    groupBatch(400, 10052, 'offscreen'),
    groupBatch(1300, 10052, 'light'),
  ]),
  3: Object.freeze([
    groupBatch(0, 10010, 'dark', 3),
    groupBatch(0, 10010, 'offscreen'),
    groupBatch(400, 10010, 'offscreen'),
    groupBatch(800, 10010, 'offscreen'),
    groupBatch(1200, 10010, 'offscreen'),
  ]),
  4: Object.freeze([
    groupBatch(0, 10010, 'dark'),
    groupBatch(0, 10060, 'dark'),
    groupBatch(500, 10061, 'dark'),
  ]),
  5: Object.freeze([recipeBatch(0, 10065, 'light')]),
  6: Object.freeze([]),
})

export interface NativeTutorialSpawnBatch {
  readonly count: number | null
  readonly groupUid: number | null
  readonly positionPolicy: BoneyardSpawnPositionPolicy
  readonly recipeUid: number | null
  readonly tick: number
}

export function createNativeTutorialState(
  playerPosition: Readonly<BoneyardPoint>,
  primaryCastSequence: number,
  seed: string,
): NativeTutorialState {
  return Object.freeze({
    active: true,
    cameraLockAgeTicks: 0,
    cameraLockTriggered: false,
    cameraLockTicksRemaining: 0,
    damageProtection: true,
    dialogueArmed: true,
    introActive: true,
    introBlend: 0,
    introDelayTicksRemaining: 25,
    introFade: 1,
    introMovementTicksRemaining: 0,
    inventoryOpened: false,
    inventorySeen: false,
    itemDropArmed: true,
    movementAnchor: Object.freeze({
      x: Math.fround(playerPosition.x + 50),
      y: Math.fround(playerPosition.y - 100),
    }),
    movementInstructionAcknowledged: false,
    narration: emptyNarration(),
    nextSpawnIntentId: 1,
    primaryCastSequenceAtStart: primaryCastSequence,
    rngState: createNativeRng(seedBoneyardWaveRng(`${seed}:tutorial`)),
    selectedSkillHudAcknowledged: false,
    skillsOpened: false,
    skillsSeen: false,
    solomonDialogueQueued: false,
    solomonRetreatQueued: false,
    stage: 0,
    stageTicks: 0,
    survivalEnabled: false,
    survivalIntervalCursor: 0,
    survivalLastCheckedTicks: Object.freeze([0, 0, 0] as const),
    waveOrdinal: 0,
    waveSpawnCursor: 0,
    waveTicks: 0,
  })
}

export function nativeTutorialCameraBounds(
  state: NativeTutorialState,
): BoneyardBounds | null {
  if (!state.cameraLockTriggered) return null
  const boundedAge = Math.max(0, Math.min(
    NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
    state.cameraLockAgeTicks,
  ))
  const wholeAge = Math.floor(boundedAge)
  const current = NATIVE_TUTORIAL_CAMERA_BOUNDS_BY_AGE[wholeAge]!
  const fraction = boundedAge - wholeAge
  const next = NATIVE_TUTORIAL_CAMERA_BOUNDS_BY_AGE[wholeAge + 1]
  if (fraction === 0 || !next) return { ...current }
  return {
    h: current.h + (next.h - current.h) * fraction,
    w: current.w + (next.w - current.w) * fraction,
    x: current.x + (next.x - current.x) * fraction,
    y: current.y + (next.y - current.y) * fraction,
  }
}

export interface NativeTutorialCameraSafetyBody {
  readonly position: Readonly<BoneyardPoint>
  readonly radius: number
}

export function nativeTutorialEnemyCameraPositionIsAllowed(
  position: Readonly<BoneyardPoint>,
  radius: number,
): boolean {
  if (!Number.isFinite(radius) || radius <= 0) return false
  return position.x - radius >= NATIVE_TUTORIAL_CAMERA_TARGET.x
    && position.y - radius >= NATIVE_TUTORIAL_CAMERA_TARGET.y
    && position.x + radius <= NATIVE_TUTORIAL_CAMERA_TARGET.x + NATIVE_TUTORIAL_CAMERA_TARGET.w
    && position.y + radius <= NATIVE_TUTORIAL_CAMERA_TARGET.y + NATIVE_TUTORIAL_CAMERA_TARGET.h
}

export function nativeTutorialCameraLockSafetyClear(
  bodies: readonly NativeTutorialCameraSafetyBody[],
): boolean {
  return bodies.every((body) => nativeTutorialEnemyCameraPositionIsAllowed(
    body.position,
    body.radius,
  ))
}

export function nativeTutorialEnemySpawnPositionIsAllowed(
  position: Readonly<BoneyardPoint>,
  radius: number,
): boolean {
  if (!Number.isFinite(radius) || radius <= 0) return false
  const boundaryY = tutorialEntranceFenceY(position.x)
  if (position.y >= boundaryY) return false
  let distanceSquared = Number.POSITIVE_INFINITY
  for (let index = 1; index < NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN.length; index += 1) {
    distanceSquared = Math.min(distanceSquared, pointSegmentDistanceSquared(
      position,
      NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[index - 1],
      NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[index],
    ))
  }
  return distanceSquared >= radius * radius
}

export function applyNativeTutorialSurfaceAction(
  source: NativeTutorialState,
  action: NativeTutorialSurfaceAction,
): NativeTutorialState {
  switch (action) {
    case 'primary-selector-opened':
    case 'concentration-a-selector-opened':
      if (
        source.selectedSkillHudAcknowledged
        || !nativeTutorialHudAccess(source).spell
      ) return source
      return Object.freeze({
        ...source,
        selectedSkillHudAcknowledged: true,
      })
    case 'inventory-opened':
      if (source.stage !== 9 && source.stage !== 10) return source
      return Object.freeze({
        ...source,
        inventoryOpened: true,
        inventorySeen: true,
        stage: 10,
        stageTicks: source.stage === 9 ? 0 : source.stageTicks,
      })
    case 'inventory-closed':
      if ((source.stage !== 9 && source.stage !== 10) || !source.inventorySeen) return source
      return Object.freeze({
        ...source,
        inventoryOpened: false,
        stage: source.stage === 9 ? 10 : source.stage,
        stageTicks: source.stage === 9 ? 0 : source.stageTicks,
      })
    case 'skills-opened':
      if (source.stage !== 12 && source.stage !== 13) return source
      return Object.freeze({
        ...source,
        skillsOpened: true,
        skillsSeen: true,
        stage: 13,
        stageTicks: source.stage === 12 ? 0 : source.stageTicks,
      })
    case 'skills-closed':
      if ((source.stage !== 12 && source.stage !== 13) || !source.skillsSeen) return source
      return Object.freeze({
        ...source,
        skillsOpened: false,
        stage: source.stage === 12 ? 13 : source.stage,
        stageTicks: source.stage === 12 ? 0 : source.stageTicks,
      })
  }
}

export function stepNativeTutorial(
  source: NativeTutorialState,
  input: NativeTutorialTickInput,
): NativeTutorialTickResult {
  const safeSource = source.cameraLockTriggered && !input.cameraLockSafetyClear
    ? Object.freeze({
        ...source,
        cameraLockAgeTicks: 0,
        cameraLockTriggered: false,
        cameraLockTicksRemaining: 0,
      })
    : source
  if (safeSource.introActive) {
    return Object.freeze({
      forceOfferSkillIds: null,
      grantExperience: 0,
      spawnIntents: Object.freeze([]),
      state: Object.freeze(stepNativeTutorialIntro(safeSource)),
    })
  }
  let state = tickBaseState(safeSource, input)
  if (state.stage === 0 && input.playerMovementActive) {
    state = { ...state, movementInstructionAcknowledged: true }
  }
  let grantExperience = 0
  let forceOfferSkillIds: readonly number[] | null = null

  if (input.solomonPhase === 'speaking' && !state.solomonDialogueQueued) {
    state = {
      ...enqueueNarration(state, [
        'tutorial-oh-boy-another-wizard',
        'tutorial-been-dispatched',
        'tutorial-do-the-dispatching',
        'tutorial-your-perversions',
        'tutorial-to-death-exactly',
      ]),
      solomonDialogueQueued: true,
    }
  }
  if (
    (input.solomonPhase === 'retreat-accelerating' || input.solomonPhase === 'escaping')
    && !state.solomonRetreatQueued
  ) {
    state = {
      ...enqueueNarration(state, [
        'solomon-laugh-1',
        'tutorial-coward-come-back',
        'solomon-get-him-boys',
      ]),
      solomonRetreatQueued: true,
    }
  }

  if (state.active) {
    switch (state.stage) {
      case 0:
        if (state.dialogueArmed && state.stageTicks > 50) {
          state = { ...enqueueNarration(state, ['tutorial-show-yourself']), dialogueArmed: false }
        }
        if (distanceSquared(input.playerPosition, state.movementAnchor) > 40_000) {
          state = enterStage(state, 1, { dialogueArmed: true })
        }
        break
      case 1:
        if (input.solomonRunEventId > 0) state = startWave(enterStage(state, 2), 1, input.tick)
        break
      case 2:
        if (state.dialogueArmed && input.enemyCount > 0) {
          state = {
            ...enqueueNarration(state, ['tutorial-i-am-sirmin', 'tutorial-never-heard-of-you']),
            dialogueArmed: false,
          }
        }
        if (input.primaryCastSequence > state.primaryCastSequenceAtStart) {
          state = enterStage(state, 3)
        }
        break
      case 3:
        if (input.enemyCount === 0) {
          state = enterStage(enqueueNarration(state, ['tutorial-easily-vanquished']), 4)
        }
        break
      case 4:
        if (narrationIdle(state.narration)) state = enterStage(state, 5)
        break
      case 5:
        if (
          input.acidRainCastSequence > 0
          && input.acidRainLastSkillId === NATIVE_TUTORIAL_ACID_RAIN_SKILL_ID
        ) {
          state = startWave(enterStage(enqueueNarration(state, [
            'tutorial-came-prepared',
            'tutorial-acid-rain-huh',
            'tutorial-surrender',
          ]), 6), 2, input.tick)
        }
        break
      case 6:
        if (input.enemyCount === 0) state = enterStage(state, 7)
        break
      case 7:
        state = enqueueNarration(state, ['tutorial-careless-fool'])
        state = enterStage(state, input.hasTopLevelNonPotionItem ? 9 : 8)
        break
      case 8:
        if (input.hasTopLevelNonPotionItem) state = enterStage(state, 9)
        break
      case 9:
        if (state.inventoryOpened) state = enterStage(state, 10)
        break
      case 10:
        if (state.inventorySeen && !state.inventoryOpened) {
          state = startWave(enterStage(enqueueNarration(state, [
            'tutorial-unredeemable',
            'tutorial-sound-like-mother',
            'tutorial-accept-your-fate',
          ]), 11), 3, input.tick)
          forceOfferSkillIds = Object.freeze([65, 67, 60])
        }
        break
      case 11:
        if (state.stageTicks > 100 && input.enemyCount === 0 && input.level < 2) {
          grantExperience = 10
        }
        if (
          input.level > 1
          && !input.levelUpPending
          && input.playerActionIdle
        ) {
          state = enterStage(enqueueNarration(state, [
            'tutorial-make-me-stronger',
            'tutorial-levelling-up',
          ]), 12)
        }
        break
      case 12:
        if (state.skillsOpened) state = enterStage(state, 13)
        break
      case 13:
        if (state.skillsSeen && !state.skillsOpened) {
          state = startWave(enterStage(state, 15, { damageProtection: false }), 4, input.tick)
        }
        break
      case 15:
        if (input.enemyCount > 2) state = enterStage(state, 14, { dialogueArmed: true })
        break
      case 14:
        if (
          state.dialogueArmed
          && input.enemyCount < 4
          && input.currentHealth < input.maximumHealth
        ) {
          state = {
            ...enqueueNarration(state, ['tutorial-looking-beat-up']),
            dialogueArmed: false,
          }
        }
        if (input.enemyCount === 0) state = startWave(enterStage(state, 16), 5, input.tick)
        break
      case 16:
        if (input.groundSackCount > 0) state = enterStage(state, 17)
        break
      case 17:
        if (input.groundSackCount === 0) state = enterStage(state, 18)
        break
      case 18:
        if (input.healthPotionCount === 0) {
          state = startWave(enterStage(enqueueNarration(state, [
            'tutorial-face-the-wrath',
            'tutorial-im-bored',
          ]), 19), 6, input.tick)
          forceOfferSkillIds = Object.freeze([8, 72, 57])
        }
        break
      case 19:
        if (input.enemyCount > 5) state = { ...state, active: false }
        break
    }
  }

  const scheduled = materializeScheduledSpawns(state, input)
  state = scheduled.state
  return Object.freeze({
    forceOfferSkillIds,
    grantExperience,
    spawnIntents: scheduled.spawnIntents,
    state: Object.freeze(state),
  })
}

export function nativeTutorialPresentation(
  state: NativeTutorialState,
  bindings: NativeTutorialBindingLabels,
  inputMode: NativeTutorialInputMode,
): NativeTutorialPresentation {
  const access = nativeTutorialHudAccess(state)
  if (state.introActive) return present(null, null, access)
  switch (state.stage) {
    case 0:
      if (state.movementInstructionAcknowledged) return present(null, null, access)
      return inputMode === 'mobile'
        ? present(
            'USE THE LEFT JOYSTICK\nTO MOVE THE WIZARD',
            'Find and confront Solomon Dark',
            access,
          )
        : present(
            'USE YOUR KEYBOARD\nTO MOVE THE WIZARD',
            `Move with ${bindings.moveUp}, ${bindings.moveLeft}, ${bindings.moveDown}, and ${bindings.moveRight}`,
            access,
          )
    case 2:
      return present(
        inputMode === 'mobile'
          ? 'USE THE RIGHT JOYSTICK\nTO THROW MAGIC MISSILES'
          : 'POINT AND CLICK YOUR MOUSE\nTO THROW MAGIC MISSILES',
        'Defeat all evil emanations',
        access,
      )
    case 5: return present('A SECONDARY SPELL IS READY', `Click here or press '${bindings.secondary}' to cast 'ACID RAIN'`, access)
    case 9: return present('ACCESS YOUR INVENTORY', `Click here or press '${bindings.inventory}' to open the inventory screen`, access)
    case 11: return present('WALK INTO ENEMIES TO CLUB THEM', 'This requires an equipped staff', access)
    case 12: return present('ACCESS YOUR SKILLS', `Click here or press '${bindings.skills}' to open the skill screen`, access)
    case 18: return present('DRINK POTION', `Click here or press '${bindings.potion}' to drink\nthis potion and restore your health.`, access)
    case 19: return present(state.active ? 'SURVIVE' : null, null, access)
    default: return present(null, null, access)
  }
}

export function nativeTutorialHostileScenePaused(state: NativeTutorialState): boolean {
  return state.active && !state.introActive && state.stage === 2
}

export function nativeTutorialPlayerMovementPaused(state: NativeTutorialState): boolean {
  return nativeTutorialHostileScenePaused(state)
}

export function nativeTutorialInstructionBaselines(
  stage: NativeTutorialStage,
  viewportHeight = 900,
): NativeTutorialInstructionBaselines | null {
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0
    ? viewportHeight
    : 900
  switch (stage) {
    case 0:
    case 2:
      return Object.freeze({ heading: 100, subheading: 170 })
    case 5:
    case 9:
    case 12:
    case 18:
      return Object.freeze({ heading: height - 170, subheading: height - 140 })
    case 11:
      return Object.freeze({ heading: 80, subheading: 110 })
    case 19:
      return Object.freeze({ heading: 200, subheading: null })
    default:
      return null
  }
}

export function nativeTutorialForcedVelocity(
  state: NativeTutorialState,
): Readonly<BoneyardPoint> | null {
  if (state.introActive) {
    const delayAfterTick = Math.max(0, state.introDelayTicksRemaining - 1)
    const blendAfterTick = delayAfterTick === 0
      ? advanceNativeTutorialIntroBlend(state.introBlend)
      : state.introBlend
    return blendAfterTick > 0.8
      ? Object.freeze({ x: 0, y: -PLAYER_CHARACTER_STEADY_SPEED })
      : null
  }
  const remaining = Math.max(0, state.introMovementTicksRemaining - 1)
  if (remaining === 0) return null
  const nativeAccumulator = Math.fround(-remaining / 250)
  return Object.freeze({
    x: 0,
    y: Math.fround(nativeAccumulator * PLAYER_CHARACTER_STEADY_SPEED),
  })
}

export function nativeTutorialHudAccess(state: NativeTutorialState): NativeTutorialHudAccess {
  const stage = state.stage
  return Object.freeze({
    combat: !state.active || stage === 14 || stage >= 15,
    inventory: !state.active || stage >= 9,
    quickbar: !state.active || stage >= 5,
    skills: !state.active || stage >= 12,
    spell: !state.active || stage >= 5,
  })
}

export function nativeTutorialDialogueTicks(): number {
  return [
    'tutorial-oh-boy-another-wizard',
    'tutorial-been-dispatched',
    'tutorial-do-the-dispatching',
    'tutorial-your-perversions',
    'tutorial-to-death-exactly',
  ].reduce((total, cueName) => (
    total + NATIVE_TUTORIAL_CUE_DEFINITIONS[cueName as NativeTutorialCue].durationTicks
  ), 0)
}

export function nativeTutorialAmuletIdentityMatches(item: HubInventoryItem): boolean {
  return item.kind === 'equipment'
    && item.equipmentType === NATIVE_TUTORIAL_AMULET_IDENTITY.equipmentType
    && item.name === NATIVE_TUTORIAL_AMULET_IDENTITY.name
    && item.nativeTypeId === NATIVE_TUTORIAL_AMULET_IDENTITY.nativeTypeId
    && item.nativeSelector === NATIVE_TUTORIAL_AMULET_IDENTITY.nativeSelector
    && item.nativeSubtype === null
    && item.quantity === 1
    && item.rarity === null
    && item.recipeIndex === null
    && item.generatedLevel === undefined
    && item.iconRecords.length === NATIVE_TUTORIAL_AMULET_IDENTITY.iconRecords.length
    && item.iconRecords.every((record, index) => (
      record === NATIVE_TUTORIAL_AMULET_IDENTITY.iconRecords[index]
    ))
    && item.iconTints?.length === NATIVE_TUTORIAL_AMULET_IDENTITY.iconTints.length
    && item.iconTints?.every((tint, index) => (
      tint === NATIVE_TUTORIAL_AMULET_IDENTITY.iconTints[index]
    )) === true
    && item.nativeEffects?.length === NATIVE_TUTORIAL_AMULET_IDENTITY.nativeEffects.length
    && item.nativeEffects.every((effect, index) => {
      const expected = NATIVE_TUTORIAL_AMULET_IDENTITY.nativeEffects[index]
      return expected !== undefined
        && effect.kind === expected.kind
        && effect.magnitude === expected.magnitude
        && effect.operator === expected.operator
        && effect.target === expected.target
    })
}

export function nativeTutorialAmuletItem(): HubInventoryItem {
  return Object.freeze({
    ...NATIVE_TUTORIAL_AMULET_IDENTITY,
    id: 0,
    kind: 'equipment',
    nativeSubtype: null,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  })
}

export function nativeTutorialHealthPotionItem(): HubInventoryItem {
  return Object.freeze({
    equipmentType: null,
    iconRecords: Object.freeze([46]),
    id: 0,
    kind: 'health-potion',
    name: 'Health Potion',
    nativeSubtype: 0,
    nativeTypeId: 7001,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  })
}

function tickBaseState(
  source: NativeTutorialState,
  input: NativeTutorialTickInput,
): NativeTutorialState {
  let cameraLockTriggered = source.cameraLockTriggered && input.cameraLockSafetyClear
  let cameraLockAgeTicks = cameraLockTriggered
    ? Math.min(NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS, source.cameraLockAgeTicks + 1)
    : 0
  let cameraLockTicksRemaining = cameraLockTriggered
    ? Math.max(0, source.cameraLockTicksRemaining - 1)
    : 0
  if (
    !cameraLockTriggered
    && input.cameraLockSafetyClear
    && pointInside(input.playerPosition, NATIVE_TUTORIAL_CAMERA_TRIGGER)
  ) {
    cameraLockTriggered = true
    cameraLockAgeTicks = 0
    cameraLockTicksRemaining = NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS
  }
  return {
    ...source,
    cameraLockAgeTicks,
    cameraLockTriggered,
    cameraLockTicksRemaining,
    introMovementTicksRemaining: Math.max(0, source.introMovementTicksRemaining - 1),
    narration: stepNarration(source.narration),
    stageTicks: source.stageTicks + 1,
    waveTicks: source.waveOrdinal === 0 ? 0 : source.waveTicks + 1,
  }
}

function stepNativeTutorialIntro(source: NativeTutorialState): NativeTutorialState {
  let introMovementTicksRemaining = source.introMovementTicksRemaining
  if (source.introDelayTicksRemaining === 20) introMovementTicksRemaining = 250
  const introDelayTicksRemaining = Math.max(0, source.introDelayTicksRemaining - 1)
  if (introDelayTicksRemaining > 0) {
    return { ...source, introDelayTicksRemaining, introMovementTicksRemaining }
  }

  const introBlend = advanceNativeTutorialIntroBlend(source.introBlend)
  if (introBlend < 1) {
    return {
      ...source,
      introBlend,
      introDelayTicksRemaining,
      introMovementTicksRemaining,
    }
  }

  const introFade = Math.max(0, Math.fround(source.introFade - 0.02))
  return {
    ...source,
    introActive: introFade > 0,
    introBlend,
    introDelayTicksRemaining,
    introFade,
    introMovementTicksRemaining,
  }
}

function advanceNativeTutorialIntroBlend(source: number): number {
  return Math.min(1, Math.fround(source + 0.0025))
}

function materializeScheduledSpawns(
  source: NativeTutorialState,
  input: NativeTutorialTickInput,
): { state: NativeTutorialState; spawnIntents: readonly BoneyardEnemySpawnIntent[] } {
  let state = source
  const intents: BoneyardEnemySpawnIntent[] = []
  const batches = NATIVE_TUTORIAL_WAVE_BATCHES[state.waveOrdinal] ?? []
  while (
    state.waveSpawnCursor < batches.length
    && batches[state.waveSpawnCursor]!.tick <= state.waveTicks
  ) {
    const result = materializeBatch(
      state,
      batches[state.waveSpawnCursor]!,
      input.playerPosition,
      input.tick,
    )
    state = { ...result.state, waveSpawnCursor: state.waveSpawnCursor + 1 }
    intents.push(...result.intents)
  }
  if (state.survivalEnabled) {
    const interval = materializeSurvivalInterval(state, input)
    state = interval.state
    intents.push(...interval.intents)
  }
  return { state, spawnIntents: Object.freeze(intents) }
}

function materializeSurvivalInterval(
  source: NativeTutorialState,
  input: NativeTutorialTickInput,
): { state: NativeTutorialState; intents: readonly BoneyardEnemySpawnIntent[] } {
  const cursor = source.survivalIntervalCursor
  const periods = [100, 100, 150] as const
  const last = source.survivalLastCheckedTicks[cursor]
  let state: NativeTutorialState = {
    ...source,
    survivalIntervalCursor: ((cursor + 1) % 3) as 0 | 1 | 2,
  }
  if (input.tick - last < periods[cursor]) return { state, intents: [] }
  const checked = [...source.survivalLastCheckedTicks] as [number, number, number]
  checked[cursor] = input.tick
  state = { ...state, survivalLastCheckedTicks: Object.freeze(checked) }
  const eligible = cursor === 0
    ? input.enemyCount < 100
    : cursor === 1
      ? input.enemyCount > 10 && input.enemyCount < 150 && input.level < 4
      : input.level > 3
  if (!eligible) return { state, intents: [] }
  const groupUid = cursor === 2 ? 10086 : 10078
  const batch = groupBatch(0, groupUid, 'light', 1)
  const spawned = materializeBatch(state, batch, input.playerPosition, input.tick)
  return { state: spawned.state, intents: spawned.intents }
}

function materializeBatch(
  source: NativeTutorialState,
  batch: NativeTutorialSpawnBatch,
  playerPosition: Readonly<BoneyardPoint>,
  spawnTick: number,
): { state: NativeTutorialState; intents: readonly BoneyardEnemySpawnIntent[] } {
  let rngState = source.rngState
  const group = batch.groupUid === null
    ? null
    : NATIVE_TUTORIAL_UID_GROUPS[batch.groupUid]
  if (batch.groupUid !== null && !group) {
    throw new Error(`unknown Tutorial UID group ${batch.groupUid}`)
  }
  const spawnCount = batch.recipeUid !== null
    ? 1
    : batch.count === null || batch.count >= group!.memberUids.length
      ? group!.memberUids.length
      : batch.count
  const shareFinalRoot = group?.shareFinalRoot === true
  const placementGroupId = shareFinalRoot ? source.nextSpawnIntentId : null
  let nextSpawnIntentId = source.nextSpawnIntentId
  const intents: BoneyardEnemySpawnIntent[] = []
  for (let index = 0; index < spawnCount; index += 1) {
    let recipeUid: number
    if (batch.recipeUid !== null) {
      recipeUid = batch.recipeUid
    } else if (batch.count === null || batch.count >= group!.memberUids.length) {
      recipeUid = group!.memberUids[index]!
    } else {
      const selected = drawNativeInteger(rngState, group!.memberUids.length)
      rngState = selected.state
      recipeUid = group!.memberUids[selected.value]!
    }
    const selectedPlayer = drawNativeInteger(rngState, 1)
    rngState = selectedPlayer.state
    const angle = drawNativeFloat(rngState, 360)
    rngState = angle.state
    const radians = angle.value * Math.PI / 180
    const position = Object.freeze({
      x: Math.fround(playerPosition.x + Math.cos(radians) * 100),
      y: Math.fround(playerPosition.y + Math.sin(radians) * 100),
    })
    const definition = NATIVE_TUTORIAL_MONSTER_RECIPES[recipeUid]
    if (!definition) throw new Error(`unknown Tutorial MonsterRecipe ${recipeUid}`)
    intents.push(Object.freeze({
      authoredRecipe: definition,
      enemyToken: definition.enemyToken,
      flags: Object.freeze([]),
      flanking: definition.flanking,
      id: nextSpawnIntentId++,
      locationPolicy: 'near-player' as const,
      nativeTypeId: definition.enemyToken === 'SKELETON' ? 1001 : 1002,
      pathfindingMode: definition.pathfindingMode,
      ...(placementGroupId === null ? {} : { placementGroupId }),
      position,
      positionPolicy: batch.positionPolicy,
      spawnTick,
      waveOrdinal: source.waveOrdinal,
    }))
  }
  return {
    intents: Object.freeze(intents),
    state: { ...source, nextSpawnIntentId, rngState },
  }
}

function startWave(
  source: NativeTutorialState,
  waveOrdinal: number,
  tick: number,
): NativeTutorialState {
  return {
    ...source,
    survivalEnabled: waveOrdinal === 6,
    survivalIntervalCursor: 0,
    survivalLastCheckedTicks: waveOrdinal === 6
      ? Object.freeze([tick, tick, tick])
      : source.survivalLastCheckedTicks,
    waveOrdinal,
    waveSpawnCursor: 0,
    waveTicks: 0,
  }
}

function enterStage(
  source: NativeTutorialState,
  stage: NativeTutorialStage,
  patch: Partial<NativeTutorialState> = {},
): NativeTutorialState {
  return { ...source, ...patch, stage, stageTicks: 0 }
}

function enqueueNarration(
  source: NativeTutorialState,
  cues: readonly NativeTutorialCue[],
): NativeTutorialState {
  if (cues.length === 0) return source
  let narration = source.narration
  if (narration.current === null) {
    narration = startNarrationCue(narration, cues[0]!, cues.slice(1))
  } else {
    narration = { ...narration, pending: Object.freeze([...narration.pending, ...cues]) }
  }
  return { ...source, narration }
}

function emptyNarration(): NativeTutorialNarrationState {
  return Object.freeze({ current: null, nextEventId: 1, pending: Object.freeze([]), ticksRemaining: 0 })
}

function stepNarration(source: NativeTutorialNarrationState): NativeTutorialNarrationState {
  if (source.current !== null && source.ticksRemaining > 1) {
    return { ...source, ticksRemaining: source.ticksRemaining - 1 }
  }
  if (source.pending.length === 0) {
    return source.current === null
      ? source
      : { ...source, current: null, ticksRemaining: 0 }
  }
  return startNarrationCue(source, source.pending[0]!, source.pending.slice(1))
}

function startNarrationCue(
  source: NativeTutorialNarrationState,
  cueName: NativeTutorialCue,
  pending: readonly NativeTutorialCue[],
): NativeTutorialNarrationState {
  const definition = NATIVE_TUTORIAL_CUE_DEFINITIONS[cueName]
  return Object.freeze({
    current: Object.freeze({
      cue: cueName,
      eventId: source.nextEventId,
      speaker: definition.speaker,
      text: definition.text,
    }),
    nextEventId: source.nextEventId + 1,
    pending: Object.freeze([...pending]),
    ticksRemaining: definition.durationTicks,
  })
}

function narrationIdle(source: NativeTutorialNarrationState): boolean {
  return source.current === null && source.pending.length === 0
}

function cue(
  durationTicks: number,
  speaker: NativeTutorialSpeaker,
  text: string,
): NativeTutorialCueDefinition {
  return Object.freeze({ durationTicks, speaker, text })
}

function recipe(
  uid: number,
  name: string,
  enemyToken: TutorialRecipe['enemyToken'],
  maximumHealth: number,
  primaryDamage: number,
  chaseSpeed: number,
  pathfindingMode: TutorialRecipe['pathfindingMode'],
  archerAccuracyMode: TutorialRecipe['archerAccuracyMode'],
  lootPolicies: TutorialRecipe['lootPolicies'],
): TutorialRecipe {
  return Object.freeze({
    archerAccuracyMode,
    attackSpeed: 1,
    chaseSpeed,
    enemyToken,
    extraDamage: 0,
    flanking: true,
    lootPolicies: Object.freeze({ ...lootPolicies }),
    maximumHealth,
    movementScale: 1,
    name,
    pathfindingMode,
    primaryDamage,
    secondaryDamage: 0,
    tertiaryDamage: 0,
    uid,
  })
}

function uidGroup(
  memberUids: readonly number[],
  positionCacheDword: number,
): NativeTutorialUidGroup {
  return Object.freeze({
    memberUids: Object.freeze([...memberUids]),
    positionCacheDword,
    shareFinalRoot: (positionCacheDword & 0xff) !== 0,
  })
}

function interpolateCameraBounds(
  source: Readonly<BoneyardBounds>,
  target: Readonly<BoneyardBounds>,
  blend: number,
): BoneyardBounds {
  return {
    h: interpolateCameraFloat(source.h, target.h, blend),
    w: interpolateCameraFloat(source.w, target.w, blend),
    x: interpolateCameraFloat(source.x, target.x, blend),
    y: interpolateCameraFloat(source.y, target.y, blend),
  }
}

function interpolateCameraFloat(source: number, target: number, blend: number): number {
  return Math.fround(source + (target - source) * blend)
}

function buildNativeTutorialCameraBounds(): readonly Readonly<BoneyardBounds>[] {
  const bounds: BoneyardBounds[] = [{ ...NATIVE_TUTORIAL_LEVEL_BOUNDS }]
  let current: BoneyardBounds = { ...NATIVE_TUTORIAL_LEVEL_BOUNDS }
  let blend = NATIVE_TUTORIAL_CAMERA_LOCK_INITIAL_BLEND
  for (let age = 1; age <= NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS; age += 1) {
    current = interpolateCameraBounds(current, NATIVE_TUTORIAL_CAMERA_TARGET, blend)
    bounds.push(Object.freeze(current))
    blend = Math.fround(Math.min(
      1,
      blend * NATIVE_TUTORIAL_CAMERA_LOCK_BLEND_GROWTH,
    ))
  }
  return Object.freeze(bounds)
}

function tutorialEntranceFenceY(x: number): number {
  if (x <= NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[0].x) {
    return NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[0].y
  }
  for (let index = 1; index < NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN.length; index += 1) {
    const end = NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[index]
    if (x > end.x) continue
    const start = NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[index - 1]
    const progress = (x - start.x) / (end.x - start.x)
    return start.y + (end.y - start.y) * progress
  }
  return NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN.at(-1)!.y
}

function pointSegmentDistanceSquared(
  point: Readonly<BoneyardPoint>,
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
): number {
  const segmentX = end.x - start.x
  const segmentY = end.y - start.y
  const lengthSquared = segmentX * segmentX + segmentY * segmentY
  const progress = Math.max(0, Math.min(
    1,
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared,
  ))
  const dx = point.x - (start.x + segmentX * progress)
  const dy = point.y - (start.y + segmentY * progress)
  return dx * dx + dy * dy
}

function groupBatch(
  tick: number,
  groupUid: number,
  positionPolicy: BoneyardSpawnPositionPolicy,
  count: number | null = null,
): NativeTutorialSpawnBatch {
  return Object.freeze({ count, groupUid, positionPolicy, recipeUid: null, tick })
}

function recipeBatch(
  tick: number,
  recipeUid: number,
  positionPolicy: BoneyardSpawnPositionPolicy,
): NativeTutorialSpawnBatch {
  return Object.freeze({ count: null, groupUid: null, positionPolicy, recipeUid, tick })
}

function distanceSquared(left: Readonly<BoneyardPoint>, right: Readonly<BoneyardPoint>): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function pointInside(
  point: Readonly<BoneyardPoint>,
  rect: Readonly<{ h: number; w: number; x: number; y: number }>,
): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w
    && point.y >= rect.y && point.y <= rect.y + rect.h
}

function present(
  heading: string | null,
  subheading: string | null,
  hud: NativeTutorialHudAccess,
): NativeTutorialPresentation {
  return Object.freeze({ heading, hud, subheading })
}
