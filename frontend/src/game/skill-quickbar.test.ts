import assert from 'node:assert/strict'
import test from 'node:test'

import {
  layoutNativeQuickbarBinding,
  nativeCooldownSectorPath,
  nativeSkillQuickbarIconAlpha,
  nativeSkillQuickbarCooldownPresentation,
  NATIVE_SKILL_QUICKBAR_FONT,
  NATIVE_SKILL_QUICKBAR_SLOT_OFFSETS,
} from './skill-quickbar.ts'

test('item belt keeps the exact eight 53 px slots and 60 px pitch', () => {
  assert.deepEqual(NATIVE_SKILL_QUICKBAR_SLOT_OFFSETS, [
    -332, -272, -212, -152, 98, 158, 218, 278,
  ])
  assert.deepEqual(
    NATIVE_SKILL_QUICKBAR_SLOT_OFFSETS.slice(1, 4).map((offset, index) => (
      offset - NATIVE_SKILL_QUICKBAR_SLOT_OFFSETS[index]!
    )),
    [60, 60, 60],
  )
})

test('cooldown presentation selects the stock common or longer row timer', () => {
  assert.deepEqual(nativeSkillQuickbarCooldownPresentation(0, 100, 150), {
    capacity: 150,
    remaining: 150,
  })
  assert.deepEqual(nativeSkillQuickbarCooldownPresentation(6_000, 6_000, 150), {
    capacity: 6_000,
    remaining: 6_000,
  })
  assert.deepEqual(nativeSkillQuickbarCooldownPresentation(2_500, 2_500, 150), {
    capacity: 2_500,
    remaining: 2_500,
  })
  assert.deepEqual(nativeSkillQuickbarCooldownPresentation(0, 50, 150), {
    capacity: 150,
    remaining: 150,
  })
  assert.deepEqual(nativeSkillQuickbarCooldownPresentation(0, 0, 150), {
    capacity: 0,
    remaining: 0,
  })
})

test('BeltButton uses distinct ready, cooldown, and unavailable icon alpha', () => {
  assert.equal(nativeSkillQuickbarIconAlpha({ cooldown: false, unavailable: false }), 0.75)
  assert.equal(nativeSkillQuickbarIconAlpha({ cooldown: true, unavailable: false }), 0.25)
  assert.equal(nativeSkillQuickbarIconAlpha({ cooldown: false, unavailable: true }), 0.375)
  assert.equal(nativeSkillQuickbarIconAlpha({ cooldown: true, unavailable: true }), 0.25)
})

test('item belt lays out native group-8 key labels over 13 px plaques', () => {
  assert.equal(NATIVE_SKILL_QUICKBAR_FONT.group, 8)
  assert.deepEqual(NATIVE_SKILL_QUICKBAR_FONT.header, [10, 3, 28])
  assert.equal(NATIVE_SKILL_QUICKBAR_FONT.glyphCount, 92)
  assert.equal(NATIVE_SKILL_QUICKBAR_FONT.kerningCount, 1)
  assert.equal(NATIVE_SKILL_QUICKBAR_FONT.scale, 1)

  assert.deepEqual(layoutNativeQuickbarBinding('3'), {
    advance: 7,
    backingLeft: 20,
    backingWidth: 13,
    glyphs: [{
      atlasX: 77,
      atlasY: 134,
      char: '3',
      height: 9,
      left: 23,
      top: -8,
      width: 8,
    }],
  })
  assert.deepEqual(layoutNativeQuickbarBinding('4').glyphs[0], {
    atlasX: 435,
    atlasY: 9,
    char: '4',
    height: 9,
    left: 22,
    top: -8,
    width: 10,
  })
})

test('cooldown sector uses the native square fan rather than a circular arc', () => {
  assert.equal(nativeCooldownSectorPath(0, 100), '')
  assert.equal(nativeCooldownSectorPath(100, 100), [
    'M 26.5 26.5',
    'L 53 26.5',
    'L 53 0',
    'L 26.5 0',
    'L 0 0',
    'L 0 26.5',
    'L 0 53',
    'L 26.5 53',
    'L 53 53',
    'L 53 26.5',
    'Z',
  ].join(' '))
  assert.equal(nativeCooldownSectorPath(25, 100), [
    'M 26.5 26.5',
    'L 26.5 53',
    'L 53 53',
    'L 53 26.5',
    'Z',
  ].join(' '))
  assert.equal(nativeCooldownSectorPath(50, 100), [
    'M 26.5 26.5',
    'L 0 26.5',
    'L 0 53',
    'L 26.5 53',
    'L 53 53',
    'L 53 26.5',
    'Z',
  ].join(' '))
})
