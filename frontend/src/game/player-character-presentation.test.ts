import assert from 'node:assert/strict'
import test from 'node:test'
import { createHubEconomy } from './core-kernels/hub-economy.ts'
import { createIdlePlayerPrimaryCast } from './core-kernels/player-character.ts'
import {
  NATIVE_PLAYER_DEATH_WEAPON_BOUNCER,
  playerDeathWeaponSample,
} from './renderer/player-death-weapon-presentation.ts'

import {
  NATIVE_PLAYER_ROBE_FIXED_POSE_COUNT,
  NATIVE_UNSELECTED_PRIMARY_ATTACHMENT_POSE,
  NATIVE_UNSELECTED_PRIMARY_ROBE_FIXED_POSE,
  createPlayerCharacterDrawPlan,
  createPlayerDeathDrawPlan,
  playerEquippedElementEffectScale,
  playerDeathEquipmentAppearance,
  playerLivingEquipmentAppearance,
  playerLivingNativeEquipmentAppearance,
  playerCharacterFixedRobeOffset,
  playerCharacterFrontAttachmentOffset,
  playerCharacterHeadOffset,
  playerCharacterRobePose,
  playerCharacterRobeFixedPose,
  playerCharacterStaffIsFront,
  playerCharacterStaffOrbOffset,
  playerCharacterStaffOrbPasses,
  playerStaffActionPose,
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

test('native starter equipment uses its persisted randomized element appearance', () => {
  assert.deepEqual(playerDeathEquipmentAppearance(
    'air',
    createHubEconomy(1, { starterElement: 'air' }).equipment,
  ), {
    hat: { primaryTint: 0x9cc8c8, secondaryTint: 0xffffff, selector: 0 },
    robe: { primaryTint: 0x9cc8c8, secondaryTint: 0xffffff, selector: 0 },
    weapon: { kind: 'staff', selector: 0 },
  })
})

test('generated loot equipment keeps its live selector and wearable colors after equip and death', () => {
  const generated = (equipmentType: 'hat' | 'robe' | 'staff' | 'wand', selector: number) => ({
    equipmentType,
    generatedLevel: 20,
    iconRecords: [],
    ...(equipmentType === 'hat' || equipmentType === 'robe'
      ? { iconTints: [0x123456, 0xffffff] as const }
      : {}),
    id: selector + 100,
    kind: 'equipment' as const,
    name: `generated-${equipmentType}`,
    nativeEffects: [{ kind: 9, magnitude: 5, operator: 0 as const, target: 0 }],
    nativeSelector: selector,
    nativeSubtype: null,
    nativeTypeId: 7_000,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  })
  assert.deepEqual(playerDeathEquipmentAppearance('fire', {
    hat: generated('hat', 3),
    robe: generated('robe', 2),
    weapon: generated('wand', 5),
  }), {
    hat: { primaryTint: 0x123456, secondaryTint: 0xffffff, selector: 3 },
    robe: { primaryTint: 0x123456, secondaryTint: 0xffffff, selector: 2 },
    weapon: { kind: 'wand', selector: 5 },
  })
  assert.deepEqual(playerLivingEquipmentAppearance('fire', {
    hat: generated('hat', 3),
    robe: generated('robe', 2),
    weapon: generated('wand', 5),
  }), {
    hat: { primaryTint: 0x123456, secondaryTint: 0xffffff, selector: 3 },
    robe: { primaryTint: 0x123456, secondaryTint: 0xffffff, selector: 2 },
    weapon: { kind: 'wand', selector: 5 },
  })
})

test('dyed named clothing keeps its recipe selector and mutable colors while living and dead', () => {
  const dyedHat = {
    ...equipmentItem(16, 'hat'),
    iconTints: [0x123456, 0xabcdef] as const,
  }
  const dyedRobe = {
    ...equipmentItem(25, 'robe'),
    iconTints: [0x654321, 0xfedcba] as const,
  }
  const equipment = {
    hat: dyedHat,
    robe: dyedRobe,
    weapon: null,
  }
  const expected = {
    hat: { primaryTint: 0x123456, secondaryTint: 0xabcdef, selector: 3 },
    robe: { primaryTint: 0x654321, secondaryTint: 0xfedcba, selector: 2 },
    weapon: { kind: 'staff' as const, selector: 0 },
  }
  assert.deepEqual(playerLivingEquipmentAppearance('fire', equipment), {
    ...expected,
    weapon: null,
  })
  assert.deepEqual(playerDeathEquipmentAppearance('fire', equipment), expected)
})

test('living equipment distinguishes required starter clothes from an empty weapon slot', () => {
  assert.deepEqual(playerLivingEquipmentAppearance(
    'water',
    createHubEconomy(1, { starterElement: 'water' }).equipment,
  ), {
    hat: { primaryTint: 0x657a91, secondaryTint: 0xffffff, selector: 0 },
    robe: { primaryTint: 0x657a91, secondaryTint: 0xffffff, selector: 0 },
    weapon: { kind: 'staff', selector: 0 },
  })
  assert.deepEqual(playerLivingEquipmentAppearance('water', {
    hat: null,
    robe: null,
    weapon: null,
  }), {
    hat: null,
    robe: null,
    weapon: null,
  })
  assert.deepEqual(playerLivingEquipmentAppearance('fire', {
    hat: equipmentItem(16, 'hat'),
    robe: equipmentItem(25, 'robe'),
    weapon: equipmentItem(18, 'staff'),
  }), {
    hat: { primaryTint: 0x19ffff, secondaryTint: 0xffffff, selector: 3 },
    robe: { primaryTint: 0x19ff19, secondaryTint: 0xc8ffc8, selector: 2 },
    weapon: { kind: 'staff', selector: 3 },
  })
})

test('mod wearables keep custom living art while death and memorial use declared native shapes', () => {
  const content = (slot: 'hat' | 'robe' | 'staff', deathShape: number) => ({
    contentId: `${5000000000000000090n + BigInt(deathShape)}`,
    description: 'Mod wearable',
    icon: {
      atlasId: `example.wearables:${slot}`,
      frame: {
        centerOffsetX: 0,
        centerOffsetY: 0,
        contentHeight: 50,
        contentWidth: 50,
        height: 50,
        logicalHeight: 50,
        logicalWidth: 50,
        width: 50,
        x: 0,
        y: 0,
      },
      frameIndex: 0,
      imagePath: `art/${slot}-icon.png`,
    },
    key: `${slot}_item`,
    modId: 'example.wearables',
    stackMaximum: 1,
    wearable: {
      deathShape,
      dyeable: slot !== 'staff',
      slot,
      wornImagePath: `art/${slot}.png`,
      ...(slot === 'staff' ? {} : { wornTrimImagePath: `art/${slot}-trim.png` }),
    },
  })
  const item = (slot: 'hat' | 'robe' | 'staff', deathShape: number) => ({
    equipmentType: slot,
    iconRecords: [],
    ...(slot === 'staff' ? {} : { iconTints: [0x123456, 0xabcdef] as const }),
    id: deathShape + 200,
    kind: 'equipment' as const,
    modItemContent: content(slot, deathShape),
    name: `Mod ${slot}`,
    nativeSubtype: null,
    nativeTypeId: 7013,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  })
  const equipment = {
    hat: item('hat', 3),
    robe: item('robe', 2),
    weapon: item('staff', 5),
  }
  const living = playerLivingEquipmentAppearance('fire', equipment)
  assert.equal('content' in living.hat!, true)
  assert.equal('content' in living.robe!, true)
  assert.equal('content' in living.weapon!, true)
  assert.deepEqual(playerDeathEquipmentAppearance('fire', equipment), {
    hat: { primaryTint: 0x123456, secondaryTint: 0xabcdef, selector: 3 },
    robe: { primaryTint: 0x123456, secondaryTint: 0xabcdef, selector: 2 },
    weapon: { kind: 'staff', selector: 5 },
  })
  assert.deepEqual(playerLivingNativeEquipmentAppearance('fire', equipment), {
    hat: { primaryTint: 0x123456, secondaryTint: 0xabcdef, selector: 3 },
    robe: { primaryTint: 0x123456, secondaryTint: 0xabcdef, selector: 2 },
    weapon: { kind: 'staff', selector: 5 },
  })
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
  assert.deepEqual(plan.orbPasses, {
    frontBase: true,
    frontOverlay: true,
  })
  const pulsingPlan = createPlayerCharacterDrawPlan({
    config: FIRE_CONFIG,
    gaitDegrees: 0,
    headingIndex: 0,
    primaryCast: { ...createIdlePlayerPrimaryCast(), weaponPulse: 0.25 },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  })
  assert.equal('weaponScale' in pulsingPlan, false)
  assert.equal(playerEquippedElementEffectScale(0), 1)
  assert.equal(playerEquippedElementEffectScale(0.25), 3.5)
  assert.equal(playerEquippedElementEffectScale(0.225), 3.25)
  assert.equal(playerEquippedElementEffectScale(0.15), 2.5)
})

test('selected primary -1 owns the pre-Create fallback and Robe prop branch', () => {
  const unselected = createPlayerCharacterDrawPlan({
    config: FIRE_CONFIG,
    gaitDegrees: 90,
    headingIndex: 18,
    primaryCast: { ...createIdlePlayerPrimaryCast(), selectedPrimaryId: -1 },
    velocity: { x: -1, y: 0 },
    walkCyclePrimary: 3.5,
  })
  assert.equal(unselected.unselectedPrimaryAttachment, true)
  assert.equal(unselected.attachmentPose, 0)
  assert.equal(unselected.bareAttachmentPose, null)
  assert.equal(NATIVE_UNSELECTED_PRIMARY_ATTACHMENT_POSE, 4)
  assert.equal(NATIVE_UNSELECTED_PRIMARY_ROBE_FIXED_POSE, 13)
  assert.equal(NATIVE_PLAYER_ROBE_FIXED_POSE_COUNT, 17)
  assert.equal(playerCharacterRobeFixedPose(
    unselected.attachmentPose,
    unselected.unselectedPrimaryAttachment,
    true,
  ), 13)
  assert.equal(playerCharacterRobeFixedPose(
    unselected.attachmentPose,
    unselected.unselectedPrimaryAttachment,
    false,
  ), 0)
  for (let attachmentPose = 0; attachmentPose < 10; attachmentPose += 1) {
    const pose = attachmentPose as Parameters<typeof playerCharacterRobeFixedPose>[0]
    assert.equal(playerCharacterRobeFixedPose(pose, true, true), 13, `${attachmentPose}`)
    assert.equal(playerCharacterRobeFixedPose(pose, true, false), pose, `${attachmentPose}`)
    assert.equal(playerCharacterRobeFixedPose(pose, false, true), pose, `${attachmentPose}`)
  }
  assert.equal(unselected.robePose, 3)

  for (const selectedPrimaryId of [8, 16, 24, 32, 40, 52, 80, 1000]) {
    const selected = createPlayerCharacterDrawPlan({
      config: FIRE_CONFIG,
      gaitDegrees: 0,
      headingIndex: 18,
      primaryCast: { ...createIdlePlayerPrimaryCast(), selectedPrimaryId },
      velocity: { x: 0, y: 0 },
      walkCyclePrimary: 0,
    })
    assert.equal(selected.unselectedPrimaryAttachment, false, `${selectedPrimaryId}`)
    assert.equal(selected.bareAttachmentPose, 0, `${selectedPrimaryId}`)
    assert.equal(playerCharacterRobeFixedPose(
      selected.attachmentPose,
      selected.unselectedPrimaryAttachment,
      true,
    ), selected.attachmentPose, `${selectedPrimaryId}`)
  }
})

test('ordinary no-weapon art never reuses a Staff action pose as a Hand-bank index', () => {
  const state = {
    config: FIRE_CONFIG,
    gaitDegrees: 0,
    headingIndex: 0,
    primaryCast: { ...createIdlePlayerPrimaryCast(), selectedPrimaryId: 16 },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  }
  assert.equal(createPlayerCharacterDrawPlan(state).bareAttachmentPose, 0)
  assert.equal(createPlayerCharacterDrawPlan({
    ...state,
    primaryCast: { ...state.primaryCast, actionTick: 19 },
  }).bareAttachmentPose, null)
  assert.equal(createPlayerCharacterDrawPlan(state, 1, 4).bareAttachmentPose, null)
  assert.equal(createPlayerCharacterDrawPlan(state, 1, null, true).bareAttachmentPose, null)
})

test('Staff element effects preserve exact native call membership across every heading and pose', () => {
  assert.deepEqual(playerCharacterStaffOrbPasses(0, 0, 0), {
    frontBase: false,
    frontOverlay: true,
  })
  assert.deepEqual(playerCharacterStaffOrbPasses(6, 0, 0), {
    frontBase: true,
    frontOverlay: true,
  })
  assert.deepEqual(playerCharacterStaffOrbPasses(7, 0, 0), {
    frontBase: true,
    frontOverlay: false,
  })
  assert.deepEqual(playerCharacterStaffOrbPasses(18, 0, 0), {
    frontBase: true,
    frontOverlay: false,
  })
  assert.deepEqual(playerCharacterStaffOrbPasses(19, 0, 0), {
    frontBase: false,
    frontOverlay: true,
  })
  assert.equal(playerCharacterStaffOrbPasses(7, 0, 0.10000000149011612).frontOverlay, false)
  assert.equal(playerCharacterStaffOrbPasses(
    7,
    0,
    0.10000000149011612 + Number.EPSILON,
  ).frontOverlay, true)
  assert.deepEqual(playerCharacterStaffOrbPasses(7, 9, 0), {
    frontBase: false,
    frontOverlay: true,
  })
  assert.deepEqual(playerCharacterStaffOrbPasses(7, 9, 0.45), {
    frontBase: false,
    frontOverlay: true,
  })

  for (let heading = 0; heading < 24; heading += 1) {
    for (let pose = 0; pose <= 9; pose += 1) {
      for (const phase of [0, 0.10000000149011612, 0.10000000149011634, 0.45]) {
        const passes = playerCharacterStaffOrbPasses(
          heading,
          pose as Parameters<typeof playerCharacterStaffOrbPasses>[1],
          phase,
        )
        const frontAngle = heading >= 6 && heading <= 18
        const backAngle = heading <= 6 || heading > 18
        const expectedCopies = pose === 9
          ? 1
          : Number(frontAngle) + Number(
              phase > 0.10000000149011612 || backAngle,
            )
        assert.equal('backBase' in passes, false, `${heading}:${pose}:${phase}`)
        assert.equal(
          Object.values(passes).filter(Boolean).length,
          expectedCopies,
          `${heading}:${pose}:${phase}`,
        )
      }
    }
  }
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

test('player draw plan holds one-shot release pose across successor action clocks', () => {
  const heldBurst = {
    config: { ...FIRE_CONFIG, element: 'ether' as const },
    gaitDegrees: 0,
    headingIndex: 0,
    primaryCast: {
      ...createIdlePlayerPrimaryCast(),
      actionTick: 0,
      castSequence: 2,
      emissionSequence: 1,
      held: true,
      oneShotAttackPoseHeld: true,
      selectedPrimaryId: 8,
    },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  }
  const plan = createPlayerCharacterDrawPlan(heldBurst)
  assert.equal(plan.attachmentPose, 8)
  assert.deepEqual(plan.orbOffset, { x: 8.5, y: -47.5 })

  assert.equal(createPlayerCharacterDrawPlan(heldBurst, 1, 4).attachmentPose, 4)
  assert.equal(createPlayerCharacterDrawPlan(heldBurst, 1, null, true).attachmentPose, 9)
})

test('player draw plan holds native Staff Cast 2 pose nine during a secondary action', () => {
  const plan = createPlayerCharacterDrawPlan({
    config: FIRE_CONFIG,
    gaitDegrees: 0,
    headingIndex: 0,
    primaryCast: createIdlePlayerPrimaryCast(),
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  }, 1, null, true)
  assert.equal(plan.attachmentPose, 9)
  assert.deepEqual(plan.orbOffset, { x: 32.5, y: -55 })
  assert.equal(plan.staffFront, false)
})

test('selected primary, not creation element, owns the Staff cast pose bank', () => {
  const plan = createPlayerCharacterDrawPlan({
    config: { ...FIRE_CONFIG, element: 'ether' },
    gaitDegrees: 0,
    headingIndex: 7,
    primaryCast: {
      ...createIdlePlayerPrimaryCast(),
      actionTick: 37,
      selectedPrimaryId: 16,
    },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  })
  assert.equal(plan.attachmentPose, 7)
  assert.deepEqual(plan.orbOffset, { x: 41.5, y: -0.5 })
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

test('player draw plan consumes authoritative melee poses and world ownership', () => {
  const state = {
    config: FIRE_CONFIG,
    gaitDegrees: 45,
    headingIndex: 0,
    primaryCast: createIdlePlayerPrimaryCast(),
    velocity: { x: 100, y: 0 },
    walkCyclePrimary: 2.5,
  }
  const plan = createPlayerCharacterDrawPlan(state, 1, 4)
  assert.equal(plan.attachmentPose, 4)
  assert.deepEqual(plan.orbOffset, { x: 39.5, y: -24.5 })
  assert.equal(plan.moving, true)
  assert.equal(plan.robePose, 2)
  assert.equal(plan.staffFront, false)
  assert.equal(playerCharacterStaffIsFront(8, 4), true)

  const action = {
    actionTimingFactor: 1,
    ageTicks: 2,
    baseProgressPerTick: 0.1,
    contactSequence: 0,
    headingDegrees: 0,
    id: 7,
    kind: 'player-staff-melee',
    lane: 'primary',
    origin: { x: 0, y: 0 },
    outcome: 'normal',
    ownerId: 'caster',
    progress: 1,
    swooshPitch: 1.05,
    worldKey: 'boneyard:test',
  } as const
  assert.equal(playerStaffActionPose([action], 'caster', 'boneyard:test'), 4)
  assert.equal(playerStaffActionPose([action], 'caster', 'boneyard:other'), null)
})
