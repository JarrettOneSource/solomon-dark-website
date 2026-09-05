import assert from 'node:assert/strict'
import test from 'node:test'

import { Texture, type Sprite } from 'pixi.js'

import type { NativeEnchantStaffDrawInput } from '../player-enchant-staff-presentation.ts'
import { PlayerEnchantStaffView } from './player-enchant-staff-view.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

function grid(): readonly (readonly Texture[])[] {
  return Array.from({ length: 24 }, () => Array.from(
    { length: 10 },
    () => Texture.EMPTY,
  ))
}

function textures(): PlayerWorldTextures['enchantStaff'] {
  return {
    auras: [Texture.EMPTY, Texture.EMPTY],
    bodies: Array.from({ length: 6 }, () => ({ back: grid(), front: grid() })),
    hands: {
      primary: { back: grid(), front: grid() },
      secondary: { back: grid(), front: grid() },
    },
  }
}

const input = (
  options: Partial<NativeEnchantStaffDrawInput> = {},
): NativeEnchantStaffDrawInput => ({
  headingIndex: 6,
  learnedSkills: [[65, 1, 1]],
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

test('retained Staff view keeps normal body, additive body, aura, then hands in native order', () => {
  const view = new PlayerEnchantStaffView(textures())
  view.update(input(), true)
  assert.equal(view.container.visible, true)
  assert.equal(view.container.zIndex, 5)
  assert.deepEqual(view.container.children.map(({ zIndex }) => zIndex), [0, 1, 2, 3, 4])
  assert.equal(view.container.children[0]?.visible, true)
  assert.equal(view.container.children[1]?.visible, true)
  assert.equal(view.container.children[1]?.blendMode, 'add')
  assert.equal(view.container.children[2]?.visible, true)
  assert.equal(view.container.children[2]?.blendMode, 'add')
  assert.equal(view.container.children[3]?.visible, true)
  assert.equal(view.container.children[4]?.visible, true)
  assert.equal(view.active, true)
  assert.equal(view.auraRecord, 11)
  assert.equal(view.tint, 0x998077)
  view.destroy()
})

test('rank zero keeps the split ordinary Staff while selectors 2 through 5 stay additive-only', () => {
  const view = new PlayerEnchantStaffView(textures())
  view.update(input({ learnedSkills: [[65, 1, 0]] }), false)
  assert.equal(view.container.zIndex, 1)
  assert.equal(view.container.children[0]?.visible, true)
  assert.equal(view.container.children[1]?.visible, false)
  assert.equal(view.container.children[2]?.visible, false)
  assert.equal(view.container.children[3]?.visible, true)
  assert.equal(view.container.children[4]?.visible, true)
  assert.equal(view.active, false)

  view.update(input({ selector: 2 }), false)
  assert.equal(view.container.children[1]?.visible, true)
  assert.equal(view.container.children[2]?.visible, false)
  assert.equal(view.active, true)
  assert.equal(view.auraRecord, null)
  view.destroy()
})

test('non-Staff, unselected, and nonliving owners hide the retained attachment without stale glow', () => {
  const view = new PlayerEnchantStaffView(textures())
  for (const state of [
    input({ nativeStaff: false }),
    input({ selectedPrimarySkillId: -1 }),
    input({ living: false }),
  ]) {
    view.update(state, false)
    assert.equal(view.container.visible, false)
    assert.equal(view.active, false)
    assert.equal(view.auraRecord, null)
  }
  view.destroy()
})

test('material tint reaches Staff body and hands without replacing selected-primary aura tint', () => {
  const view = new PlayerEnchantStaffView(textures())
  view.update(input(), true)
  view.setMaterialTint(0x8090a0)
  const [body, bodyAdditive, aura, primaryHand, secondaryHand] =
    view.container.children as Sprite[]
  assert.equal(body?.tint, 0x8090a0)
  assert.equal(bodyAdditive?.tint, 0x8090a0)
  assert.equal(primaryHand?.tint, 0x8090a0)
  assert.equal(secondaryHand?.tint, 0x8090a0)
  assert.equal(aura?.tint, 0xffffff)
  assert.equal(view.tint, 0x998077)
  view.destroy()
})

test('Staff rejects an incomplete atlas at each required attachment', () => {
  for (const [missing, expected] of [
    ['body-style', 'missing native Staff body selector'],
    ['body-frame', 'missing native Staff body/hand attachment frame'],
    ['primary-hand', 'missing native Staff body/hand attachment frame'],
    ['secondary-hand', 'missing native Staff body/hand attachment frame'],
    ['aura', 'missing Clothes aura record 11'],
  ]) {
    const complete = textures()
    const emptySide = { back: [], front: [] }
    const broken = {
      ...complete,
      ...(missing === 'body-style' ? { bodies: [] } : {}),
      ...(missing === 'body-frame' ? { bodies: [emptySide] } : {}),
      ...(missing === 'aura' ? { auras: [] } : {}),
      hands: {
        primary: missing === 'primary-hand' ? emptySide : complete.hands.primary,
        secondary: missing === 'secondary-hand' ? emptySide : complete.hands.secondary,
      },
    }
    const view = new PlayerEnchantStaffView(broken)
    assert.throws(() => view.update(input(), true), { message: expected }, missing)
    view.destroy()
  }
})

test('Staff diagnostics expire with the last visible draw plan', () => {
  const view = new PlayerEnchantStaffView(textures())
  view.update(input(), true)
  assert.ok(view.nearAlpha > 0)
  assert.notEqual(view.tint, null)
  view.update(input({ living: false }), false)
  assert.equal(view.nearAlpha, 0)
  assert.equal(view.tint, null)
  view.destroy()
})
