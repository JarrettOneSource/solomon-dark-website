import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_SECONDARY_ABILITY_CONTRACTS,
  NATIVE_SECONDARY_ABILITY_IDS,
  NATIVE_SECONDARY_BELT_SLOT_COUNT,
  NATIVE_SECONDARY_KEYBOARD_SLOTS,
  NATIVE_SECONDARY_RIGHT_MOUSE_SLOT,
  nativeSecondaryAbilityContract,
} from './native-secondary-ability-contract.ts'

const EXPECTED = [
  [11, 'Call Leviathan', 'aimed-world-point', 'BadGuys:343..372', 'leviathan-roar'],
  [12, 'Planewalker', 'self', 'BadGuys:PlaneOrb', 'planewalker-on'],
  [15, 'Phasing', 'aim-heading-forward-probe', 'BadGuys:53', 'phase'],
  [21, 'Ring of Fire', 'caster-center', 'DeadHawg:46..77', 'big-fire'],
  [23, 'Firewalker', 'self-trail', 'DeadHawg:46..77', 'ignite'],
  [27, 'Magic Storm', 'aimed-world-point', 'BadGuys:storm-cloud', 'magic-storm'],
  [30, 'Prismatic Shock', 'caster-center-rectangle', 'BadGuys:10,11', 'prismatic-shock'],
  [35, 'Ring of Ice', 'caster-center', 'DeadHawg:16,17', 'ring-of-ice'],
  [41, 'Earthquake', 'caster-center', 'DeadHawg:200..202', 'earthquake-loop'],
  [45, 'Raise Golem', 'collision-adjusted-aimed-world-point', 'Golem:1..208', 'golem-provoke'],
  [46, 'Stoneskin', 'self', 'Player:stone-material', 'stoneskin-on'],
  [48, 'Teleport', 'safe-relocation-near-aim', 'BadGuys:90', 'teleport'],
  [49, 'Magic Circle', 'aimed-world-point', 'BadGuys:48,7', 'magic-circle'],
  [50, 'Magic Trap', 'aimed-world-point', 'BadGuys:393..400,16', 'set-trap'],
  [51, 'Dampen', 'caster-center-rectangle', 'BadGuys:10,11,48', 'flash'],
  [54, 'Magic Shield', 'self', 'BadGuys:68', 'magic-shield-up'],
  [72, 'Acid Rain', 'aimed-world-point', 'BadGuys:10,acid-drop', 'magic-storm'],
  [73, 'Fire Wall', 'line-perpendicular-to-aim', 'DeadHawg:46..77', 'ignite'],
  [74, 'Ether Drain', 'aimed-world-point', 'DeadHawg:177..179', 'distort-reality'],
  [76, 'Call Comet', 'aimed-world-point', 'DeadHawg:5,203..207,6', 'comet-loop'],
  [77, 'Turn Undead', 'aimed-area', 'BadGuys:48', 'level-up'],
  [78, 'Mindstar', 'self', 'Player:activation-flash', 'mindstar'],
  [79, 'Regenerate', 'self', 'Player:activation-flash', 'mindstar'],
] as const

test('the native right-click system is the exact closed 23-member category-2 set', () => {
  assert.deepEqual(NATIVE_SECONDARY_ABILITY_IDS, EXPECTED.map(([skillId]) => skillId))
  assert.equal(NATIVE_SECONDARY_ABILITY_CONTRACTS.length, 23)
  assert.equal(new Set(NATIVE_SECONDARY_ABILITY_IDS).size, 23)
  for (const [skillId, name, targeting, art, firstAudioEvent] of EXPECTED) {
    const contract = nativeSecondaryAbilityContract(skillId)
    assert.equal(contract.skillId, skillId)
    assert.equal(contract.name, name)
    assert.equal(contract.category, 2)
    assert.equal(contract.targeting, targeting)
    assert.ok(contract.art.includes(art), `${name} lost ${art}`)
    assert.equal(contract.audio[0]?.event, firstAudioEvent)
    assert.ok(contract.rank.maximumLevel > 0)
    assert.ok(contract.rank.manaCost.length > 0)
    assert.ok(contract.authority.length > 0)
    assert.ok(contract.cleanup.length > 0)
  }
})

test('the native secondary belt maps right mouse and all seven keyboard slots', () => {
  assert.equal(NATIVE_SECONDARY_BELT_SLOT_COUNT, 8)
  assert.equal(NATIVE_SECONDARY_RIGHT_MOUSE_SLOT, 0)
  assert.deepEqual(NATIVE_SECONDARY_KEYBOARD_SLOTS, [1, 2, 3, 4, 5, 6, 7])
})

test('critical native VFX and lifecycle constants cannot collapse to generic effects', () => {
  assert.deepEqual(nativeSecondaryAbilityContract(11).timing, {
    activeTicks: 1_600,
    boltLifetimeTicks: 100,
    phases: ['scale-in', 'active', 'scale-out'],
    scaleInTicks: 40,
    scaleOutTicks: 25,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(21).timing, {
    angleStepDegrees: 12,
    segmentCount: 30,
    shockwaveQueryPeriodTicks: 10,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(45).timing, {
    assemblyMilestones: [0, 50, 100, 200],
    contactEnableAge: 400,
    naturalExpiry: false,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(50).timing, {
    fullChargeTicks: 800,
    triggerPollPeriodTicks: 25,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(51).action, {
    mode: 21,
    name: 'Action_PlayerWizard_CastSpin',
    ticks: 73,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(72).timing, {
    activeTicks: 1_500,
    damagePeriodTicks: 25,
    dropsPerTick: 2,
    enhancedDropsPerTick: 5,
    targetsPerPulse: 'min(n,floor(n/3)+1)',
  })
  assert.deepEqual(nativeSecondaryAbilityContract(73).timing, {
    contactPeriodTicks: 3,
    lineLength: 300,
    patchCount: 11,
    patchLifetimeTicks: 200,
    patchSpacing: 30,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(74).timing, {
    activeTicks: 1_000,
    phases: ['scale-in', 'active', 'scale-out'],
    scaleInTicks: 40,
    scaleOutTicks: 20,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(76).timing, {
    countdownStart: 8_000,
    countdownStep: 20,
    impactTicks: 400,
    whistleTicksRemaining: 175,
  })
  assert.equal(nativeSecondaryAbilityContract(78).audio[0]?.path, 'sounds/mindstar__stream.wav')
  assert.deepEqual(
    nativeSecondaryAbilityContract(79).audio,
    nativeSecondaryAbilityContract(78).audio,
  )

  const serialized = JSON.stringify(NATIVE_SECONDARY_ABILITY_CONTRACTS).toLowerCase()
  for (const forbidden of ['generic', 'placeholder', 'approximate', 'unknown', 'todo', 'tbd']) {
    assert.equal(serialized.includes(forbidden), false, `contract contains ${forbidden}`)
  }
})
