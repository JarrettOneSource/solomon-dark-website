import assert from 'node:assert/strict'
import test from 'node:test'

import staffProgramJson from '../assets/game/player-staff-attachment-program.json' with { type: 'json' }
import {
  NATIVE_ENCHANT_STAFF_AURA_RECORDS,
  NATIVE_ENCHANT_STAFF_BODY_RECORDS,
  NATIVE_ENCHANT_STAFF_FAR_ALPHA_FACTOR,
  nativeEnchantStaffDrawPlan,
  nativeEnchantStaffEffectiveRank,
  nativeEnchantStaffGlowAlpha,
  nativeEnchantStaffGlowTint,
  nativeEnchantStaffWeldGlowTint,
} from './player-enchant-staff-presentation.ts'

const learned = (
  permanentRank: number,
  effectiveRank: number,
): readonly (readonly [number, number, number])[] => [
  [65, permanentRank, effectiveRank],
]

const plan = (
  options: Partial<Parameters<typeof nativeEnchantStaffDrawPlan>[0]> = {},
) => nativeEnchantStaffDrawPlan({
  headingIndex: 6,
  learnedSkills: learned(1, 1),
  living: true,
  nativeStaff: true,
  pose: 0,
  selectedPrimarySkillId: 16,
  selector: 0,
  tick: 18,
  weldBuildId: null,
  widthSample: 0,
  ...options,
})

test('positive effective Enchant Staff rank continuously owns the optional attachment program', () => {
  assert.equal(nativeEnchantStaffEffectiveRank([]), 0)
  assert.equal(nativeEnchantStaffEffectiveRank(learned(1, 0)), 0)
  assert.equal(nativeEnchantStaffEffectiveRank(learned(0, 1)), 1)

  assert.equal(plan({ learnedSkills: [] }), null)
  assert.equal(plan({ learnedSkills: learned(1, 0) }), null)
  assert.equal(plan({ learnedSkills: learned(0, 1) })?.bodyRecord, 5)
  assert.equal(plan({ learnedSkills: learned(15, 15) })?.bodyRecord, 5)
  assert.equal(plan({ living: false }), null)
  assert.equal(plan({ nativeStaff: false }), null)
  assert.equal(plan({ selectedPrimarySkillId: -1 }), null)
})

test('all Staff selectors retain the additive shaft while only authored rows 11 and 12 own an aura', () => {
  assert.deepEqual(NATIVE_ENCHANT_STAFF_BODY_RECORDS, [5, 6, 7, 8, 9, 10])
  assert.deepEqual(NATIVE_ENCHANT_STAFF_AURA_RECORDS, [11, 12, null, null, null, null])
  for (let selector = 0; selector < 6; selector += 1) {
    const draw = plan({ selector })
    assert.ok(draw)
    assert.equal(draw.bodyRecord, 5 + selector)
    assert.equal(draw.auraRecord, selector < 2 ? 11 + selector : null)
  }
  assert.throws(() => plan({ selector: -1 }), /selector/)
  assert.throws(() => plan({ selector: 6 }), /selector/)
})

test('the aura uses exact endpoints, five-unit extension, inclusive width, and breathing gradient', () => {
  const narrow = plan({ widthSample: 0 })
  const wide = plan({ widthSample: 1.5 })
  assert.ok(narrow && wide)
  assert.deepEqual(narrow.start, [38.5, -61.5])
  assert.deepEqual(narrow.end, [-3.5, 17.5])
  assert.equal(narrow.front, true)
  assert.equal(narrow.nearAlpha, nativeEnchantStaffGlowAlpha(18))
  assert.ok(Math.abs(narrow.nearAlpha - 0.7) < 1e-7)
  assert.ok(Math.abs(narrow.farAlpha - 0.245) < 1e-7)
  assert.equal(nativeEnchantStaffGlowAlpha(0), 0.5)
  assert.equal(NATIVE_ENCHANT_STAFF_FAR_ALPHA_FACTOR, 0.35)
  assert.equal(narrow.widthFactor, 2)
  assert.equal(wide.widthFactor, 3.5)

  const unitX = (narrow.end[0] - narrow.start[0]) / Math.hypot(
    narrow.end[0] - narrow.start[0],
    narrow.end[1] - narrow.start[1],
  )
  const unitY = (narrow.end[1] - narrow.start[1]) / Math.hypot(
    narrow.end[0] - narrow.start[0],
    narrow.end[1] - narrow.start[1],
  )
  const farMidpoint = [
    (narrow.vertices[4] + narrow.vertices[6]) / 2,
    (narrow.vertices[5] + narrow.vertices[7]) / 2,
  ]
  assert.ok(Math.abs(farMidpoint[0] - (narrow.end[0] + unitX * 5)) < 1e-6)
  assert.ok(Math.abs(farMidpoint[1] - (narrow.end[1] + unitY * 5)) < 1e-6)
  assert.ok(wide.vertices.some((value, index) => value !== narrow.vertices[index]))
})

test('every heading and attachment pose consumes the extracted native point/depth row', () => {
  assert.equal(staffProgramJson.schema, 1)
  assert.equal(staffProgramJson.frames.length, 10)
  for (let pose = 0; pose < 10; pose += 1) {
    assert.equal(staffProgramJson.frames[pose]?.length, 24)
    for (let headingIndex = 0; headingIndex < 24; headingIndex += 1) {
      const draw = plan({ headingIndex, pose })
      const extracted = staffProgramJson.frames[pose]![headingIndex]!
      assert.ok(draw, `${pose}:${headingIndex}`)
      assert.deepEqual(draw.start, extracted.start, `${pose}:${headingIndex}:start`)
      assert.deepEqual(draw.end, extracted.end, `${pose}:${headingIndex}:end`)
      assert.equal(draw.front, extracted.front, `${pose}:${headingIndex}:depth`)
      assert.equal(draw.vertices.length, 8, `${pose}:${headingIndex}:vertices`)
      assert.ok(draw.vertices.every(Number.isFinite), `${pose}:${headingIndex}:finite`)
    }
  }
})

test('current primary selection owns all pure, Weld, and Plane-Orb glow colors', () => {
  assert.equal(nativeEnchantStaffGlowTint(8, null), 0x886688)
  assert.equal(nativeEnchantStaffGlowTint(16, null), 0x998077)
  assert.equal(nativeEnchantStaffGlowTint(24, null), 0xa0c3c3)
  assert.equal(nativeEnchantStaffGlowTint(32, null), 0x5e6e81)
  assert.equal(nativeEnchantStaffGlowTint(40, null), 0x90b390)
  assert.equal(nativeEnchantStaffGlowTint(80, null), 0x886688)
  assert.equal(nativeEnchantStaffGlowTint(52, 1000), 0x7f5d6c)
  assert.equal(nativeEnchantStaffGlowTint(52, 1009), 0xf4f8f8)
  assert.equal(nativeEnchantStaffGlowTint(-1, null), null)
  assert.throws(() => nativeEnchantStaffGlowTint(52, null), /Weld/)

  assert.deepEqual(
    Array.from({ length: 15 }, (_, index) => nativeEnchantStaffWeldGlowTint(1000 + index)),
    [
      0x7f5d6c, 0xbdaabd, 0xded4de, 0xd5ccc2, 0xded4de,
      0xbfbfbf, 0xded4de, 0xd5ccc2, 0xeaf2f2, 0xf4f8f8,
      0x7f5d6c, 0x998077, 0x5e6e81, 0xa0c3c3, 0x90b390,
    ],
  )
  assert.throws(() => nativeEnchantStaffWeldGlowTint(999), /build/)
  assert.throws(() => nativeEnchantStaffWeldGlowTint(1015), /build/)
})

test('selection and rank magnitude change neither the persistent clock nor geometry', () => {
  const fire = plan({ learnedSkills: learned(1, 1), selectedPrimarySkillId: 16, tick: 37 })
  const water = plan({ learnedSkills: learned(15, 15), selectedPrimarySkillId: 32, tick: 37 })
  assert.ok(fire && water)
  assert.equal(fire.nearAlpha, water.nearAlpha)
  assert.equal(fire.farAlpha, water.farAlpha)
  assert.equal(fire.widthFactor, water.widthFactor)
  assert.deepEqual(fire.vertices, water.vertices)
  assert.equal(fire.tint, 0x998077)
  assert.equal(water.tint, 0x5e6e81)
})
