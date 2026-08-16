import assert from 'node:assert/strict'
import test from 'node:test'
import { createIdlePlayerPrimaryCast } from './core-kernels/player-character.ts'
import {
  NATIVE_PLAYER_DEATH_WEAPON_BOUNCER,
  playerDeathWeaponSample,
} from './renderer/player-death-weapon-presentation.ts'

import {
  createPlayerCharacterDrawPlan,
  createPlayerDeathDrawPlan,
  playerDeathEquipmentAppearance,
  playerCharacterFixedRobeOffset,
  playerCharacterFrontAttachmentOffset,
  playerCharacterHeadOffset,
  playerCharacterRobePose,
  playerCharacterStaffIsFront,
  playerCharacterStaffOrbOffset,
} from './player-character-presentation.ts'

test('player death draw plan uses the native four-frame six-facing bank', () => {
  assert.deepEqual(createPlayerDeathDrawPlan(0, 'alive', 999), {
    facing: 0,
    frame: 3,
    heading: 0,
    shadow: false,
    visible: false,
  })
  assert.equal(createPlayerDeathDrawPlan(2, 'dying', 152).facing, 1)
  assert.equal(createPlayerDeathDrawPlan(23, 'dying', 153).facing, 0)
  assert.equal(createPlayerDeathDrawPlan(6, 'dying', 153).frame, 1)
  assert.equal(createPlayerDeathDrawPlan(6, 'dying', 156).frame, 2)
  assert.deepEqual(createPlayerDeathDrawPlan(6, 'spectating', 159), {
    facing: 2,
    frame: 3,
    heading: 6,
    shadow: true,
    visible: true,
  })
})

function equipmentItem(recipeIndex: number, equipmentType: 'hat' | 'robe' | 'staff' | 'wand') {
  return {
    equipmentType,
    iconRecords: [],
    id: recipeIndex + 1,
    kind: 'equipment' as const,
    name: `recipe-${recipeIndex}`,
    nativeSubtype: null,
    nativeTypeId: 7_000,
    quantity: 1,
    rarity: 'Epic' as const,
    recipeIndex,
  }
}

test('death equipment uses element defaults and every native recipe selector/color override', () => {
  assert.deepEqual(playerDeathEquipmentAppearance('air', {
    hat: null,
    robe: null,
    weapon: null,
  }), {
    hat: { primaryTint: 0xa0c3c3, secondaryTint: 0xffffff, selector: 0 },
    robe: { primaryTint: 0xa0c3c3, secondaryTint: 0xffffff, selector: 0 },
    weapon: { kind: 'staff', selector: 0 },
  })

  const robeCases = [
    [1, 1, 0x191919, 0x80ffff],
    [7, 2, 0xc0c0c0, 0xffffff],
    [12, 0, 0xff19ff, 0xffffff],
    [17, 2, 0x19ffff, 0xffffff],
    [21, 0, 0xff0000, 0xffffff],
    [25, 2, 0x19ff19, 0xc8ffc8],
    [46, 0, 0xffffff, 0xffffff],
  ] as const
  for (const [recipeIndex, selector, primaryTint, secondaryTint] of robeCases) {
    assert.deepEqual(playerDeathEquipmentAppearance('fire', {
      hat: null,
      robe: equipmentItem(recipeIndex, 'robe'),
      weapon: null,
    }).robe, { primaryTint, secondaryTint, selector })
  }

  const hatCases = [
    [5, 0, 0x191919, 0xff80ff],
    [6, 2, 0xc0c0c0, 0xffffff],
    [11, 0, 0xff19ff, 0xffffff],
    [16, 3, 0x19ffff, 0xffffff],
    [20, 2, 0xff0000, 0xffffff],
    [40, 3, 0xffffff, 0xffffff],
  ] as const
  for (const [recipeIndex, selector, primaryTint, secondaryTint] of hatCases) {
    assert.deepEqual(playerDeathEquipmentAppearance('fire', {
      hat: equipmentItem(recipeIndex, 'hat'),
      robe: null,
      weapon: null,
    }).hat, { primaryTint, secondaryTint, selector })
  }

  assert.deepEqual(playerDeathEquipmentAppearance('fire', {
    hat: null,
    robe: null,
    weapon: equipmentItem(18, 'staff'),
  }).weapon, { kind: 'staff', selector: 3 })
  assert.deepEqual(playerDeathEquipmentAppearance('fire', {
    hat: null,
    robe: null,
    weapon: equipmentItem(13, 'wand'),
  }).weapon, { kind: 'wand', selector: 4 })
})

test('death weapon owns one deterministic native-shaped bouncer through settlement', () => {
  const trigger = {
    deathEpoch: 1,
    headingIndex: 0,
    playerId: 'wizard',
    runId: 'run-a',
    weapon: { kind: 'staff' as const, selector: 3 },
  }
  const opening = playerDeathWeaponSample(trigger, 0)
  assert.ok(opening.offset.y <= -(
    NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.initialRadius
    * NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.initialHorizontalSpeed
  ))
  assert.ok(opening.height <= 0)
  assert.equal(opening.settled, false)
  assert.deepEqual(playerDeathWeaponSample(trigger, 0), opening)

  const moving = playerDeathWeaponSample(trigger, 12)
  assert.notDeepEqual(moving, opening)
  const settled = playerDeathWeaponSample(trigger, 10_000)
  assert.equal(settled.height, 0)
  assert.equal(settled.settled, true)
  assert.deepEqual(playerDeathWeaponSample(trigger, 20_000), settled)
})

function closeTo(actual: number, expected: number, epsilon = 0.001): void {
  assert.ok(Math.abs(actual - expected) <= epsilon)
}

const FIRE_CONFIG = {
  discipline: 'arcane',
  displayName: 'Caster',
  element: 'fire',
} as const

test('player character draw plan preserves native attachment and gait transforms', () => {
  assert.deepEqual(playerCharacterStaffOrbOffset(0), { x: -32.5, y: -66.5 })
  assert.deepEqual(playerCharacterStaffOrbOffset(6), { x: 38.5, y: -61.5 })
  assert.deepEqual(playerCharacterStaffOrbOffset(12), { x: 32.5, y: -1.5 })
  assert.deepEqual(playerCharacterStaffOrbOffset(18), { x: -38.5, y: -6.5 })
  assert.deepEqual(playerCharacterStaffOrbOffset(30), playerCharacterStaffOrbOffset(6))
  assert.equal(playerCharacterStaffIsFront(4), false)
  assert.equal(playerCharacterStaffIsFront(5), true)
  assert.equal(playerCharacterStaffIsFront(16), true)
  assert.equal(playerCharacterStaffIsFront(17), false)

  assert.equal(playerCharacterRobePose(4.999), 4)
  closeTo(playerCharacterFixedRobeOffset(90).x, Math.SQRT1_2)
  closeTo(playerCharacterFixedRobeOffset(180, 2).x, 4)
  closeTo(playerCharacterFrontAttachmentOffset(90).y, 1)
  closeTo(playerCharacterHeadOffset(0, 0).x, -0.5)
  closeTo(playerCharacterHeadOffset(0, 90).y, -1.5)
  closeTo(playerCharacterHeadOffset(6, 0).y, -0.5)

  const plan = createPlayerCharacterDrawPlan({
    config: FIRE_CONFIG,
    gaitDegrees: 90,
    headingIndex: 6,
    primaryCast: createIdlePlayerPrimaryCast(),
    velocity: { x: 90, y: 0 },
    walkCyclePrimary: 2.5,
  })
  assert.equal(plan.robePose, 2)
  assert.equal(plan.headingSheetOffsetY, -1020)
  assert.equal(plan.moving, true)
  assert.equal(plan.staffFront, true)
  assert.equal(plan.orbZIndex, 6)
})

test('player draw plan consumes the authoritative Staff Cast 1 pose bank', () => {
  const markerPlan = createPlayerCharacterDrawPlan({
    config: FIRE_CONFIG,
    gaitDegrees: 0,
    headingIndex: 0,
    primaryCast: { ...createIdlePlayerPrimaryCast(), actionTick: 19 },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  })
  assert.equal(markerPlan.attachmentPose, 8)
  assert.deepEqual(markerPlan.orbOffset, { x: 8.5, y: -47.5 })
  assert.equal(markerPlan.staffFront, false)

  const recoveryPlan = createPlayerCharacterDrawPlan({
    config: FIRE_CONFIG,
    gaitDegrees: 0,
    headingIndex: 7,
    primaryCast: { ...createIdlePlayerPrimaryCast(), actionTick: 37 },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  })
  assert.equal(recoveryPlan.attachmentPose, 7)
  assert.deepEqual(recoveryPlan.orbOffset, { x: 41.5, y: -0.5 })
  assert.equal(recoveryPlan.staffFront, true)
})

test('player draw plan holds the sustained Staff Constant pose bank', () => {
  const insertion = createPlayerCharacterDrawPlan({
    config: FIRE_CONFIG,
    gaitDegrees: 0,
    headingIndex: 0,
    primaryCast: {
      ...createIdlePlayerPrimaryCast(),
      actionTick: 0,
      channelActive: true,
    },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  })
  assert.equal(insertion.attachmentPose, 0)
  assert.deepEqual(insertion.orbOffset, { x: -32.5, y: -66.5 })

  const constant = createPlayerCharacterDrawPlan({
    config: FIRE_CONFIG,
    gaitDegrees: 0,
    headingIndex: 0,
    primaryCast: {
      ...createIdlePlayerPrimaryCast(),
      actionTick: 1,
      channelActive: true,
    },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  })
  assert.equal(constant.attachmentPose, 7)
  assert.deepEqual(constant.orbOffset, { x: 8.5, y: -56 })
})
