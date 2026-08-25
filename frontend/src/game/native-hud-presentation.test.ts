import assert from 'node:assert/strict'
import test from 'node:test'

import { NATIVE_WELD_BUILDS } from './core-kernels/player-progression.ts'
import {
  nativeHealthHudPresentation,
  nativeHudSkillActionRect,
  nativeHudLeftOriginClipPath,
  nativeHudSkillBindings,
  nativeManaHudPresentation,
  nativeTutorialSelectedHudLayout,
} from './native-hud-presentation.ts'

test('clips local vital fills from the right so health remains left anchored', () => {
  assert.equal(nativeHudLeftOriginClipPath(1), 'inset(0 0% 0 0)')
  assert.equal(nativeHudLeftOriginClipPath(0.25), 'inset(0 75% 0 0)')
  assert.equal(nativeHudLeftOriginClipPath(0), 'inset(0 100% 0 0)')
  assert.equal(nativeHudLeftOriginClipPath(-1), 'inset(0 100% 0 0)')
  assert.equal(nativeHudLeftOriginClipPath(2), 'inset(0 0% 0 0)')
})

test('sizes default, upgraded, fractional, shrinking, and authored-maximum vital meters', () => {
  assert.deepEqual(nativeHealthHudPresentation(50, 50), {
    coreWidth: 100,
    fillProgress: 1,
    fillWidth: 100,
    shieldProgress: 0,
    shieldWidth: 0,
    trackWidth: 110,
  })
  assert.deepEqual(nativeHealthHudPresentation(100, 100), {
    coreWidth: 125,
    fillProgress: 1,
    fillWidth: 125,
    shieldProgress: 0,
    shieldWidth: 0,
    trackWidth: 135,
  })
  assert.equal(nativeHealthHudPresentation(700, 700).coreWidth, 425)
  assert.equal(nativeHealthHudPresentation(62.5, 62.5).coreWidth, 106.25)
  assert.equal(nativeHealthHudPresentation(10, 10).coreWidth, 80)

  assert.deepEqual(nativeManaHudPresentation(100, 100), {
    coreWidth: 100,
    fillProgress: 1,
    fillWidth: 100,
    reserveProgress: 0,
    reserveWidth: 0,
    trackWidth: 110,
  })
  assert.deepEqual(nativeManaHudPresentation(200, 200), {
    coreWidth: 125,
    fillProgress: 1,
    fillWidth: 125,
    reserveProgress: 0,
    reserveWidth: 0,
    trackWidth: 135,
  })
  assert.equal(nativeManaHudPresentation(1_350, 1_350).coreWidth, 412.5)
  assert.equal(nativeManaHudPresentation(50, 50).coreWidth, 87.5)
})

test('uses each dynamic core for current fill, reserve, and Magic Shield', () => {
  const health = nativeHealthHudPresentation(50, 100, 25, 50)
  assert.equal(health.fillProgress, 0.25)
  assert.equal(health.fillWidth, 31.25)
  assert.equal(health.shieldProgress, 0.5)
  assert.equal(health.shieldWidth, 62.5)

  const mana = nativeManaHudPresentation(100, 200, 50)
  assert.equal(mana.fillProgress, 0.5)
  assert.equal(mana.fillWidth, 62.5)
  assert.equal(mana.reserveProgress, 0.25)
  assert.equal(mana.reserveWidth, 31.25)
})

test('maps every pure and Weld primary plus the Planewalker override', () => {
  assert.deepEqual(
    [8, 16, 24, 32, 40].map((selectedPrimarySkillId) => (
      nativeHudSkillBindings({
        concentrationSkillIds: [null, null],
        planewalkerActive: false,
        selectedPrimarySkillId,
        weldBuildId: null,
      })[0]!.record
    )),
    [35, 43, 51, 59, 67],
  )
  assert.deepEqual(
    NATIVE_WELD_BUILDS.map(({ id }) => nativeHudSkillBindings({
      concentrationSkillIds: [null, null],
      planewalkerActive: false,
      selectedPrimarySkillId: 52,
      weldBuildId: id,
    })[0]!.record),
    [81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
  )
  assert.equal(nativeHudSkillBindings({
    concentrationSkillIds: [57, null],
    planewalkerActive: true,
    selectedPrimarySkillId: 52,
    weldBuildId: 1000,
  })[0]!.record, 107)
})

test('maps all fourteen reachable concentration records and excludes passive Health Up', () => {
  const concentrationIds = [
    57, 58, 59, 60, 61, 62, 63,
    65, 66, 67, 68, 69, 70, 71,
  ]
  assert.deepEqual(
    concentrationIds.map((skillId) => nativeHudSkillBindings({
      concentrationSkillIds: [skillId, null],
      planewalkerActive: false,
      selectedPrimarySkillId: 40,
      weldBuildId: null,
    })[1]!.record),
    [84, 85, 86, 87, 88, 89, 90, 92, 93, 94, 95, 96, 97, 98],
  )
  assert.equal(nativeHudSkillBindings({
    concentrationSkillIds: [64, null],
    planewalkerActive: false,
    selectedPrimarySkillId: 40,
    weldBuildId: null,
  }).length, 1)
})

test('lays out primary, A, and B in native draw order and visual centers', () => {
  assert.deepEqual(nativeHudSkillBindings({
    concentrationSkillIds: [57, null],
    planewalkerActive: false,
    selectedPrimarySkillId: 40,
    weldBuildId: null,
  }).map(({ binding, centerOffset, record }) => [binding, centerOffset, record]), [
    [12, -20, 67],
    [16, 20, 84],
  ])
  assert.deepEqual(nativeHudSkillBindings({
    concentrationSkillIds: [58, 59],
    planewalkerActive: false,
    selectedPrimarySkillId: 40,
    weldBuildId: null,
  }).map(({ binding, centerOffset, record }) => [binding, centerOffset, record]), [
    [12, -40, 67],
    [16, 40, 85],
    [20, 0, 86],
  ])
})

test('aligns the exact 40 by 65 hit targets with every selected-skill center', () => {
  assert.deepEqual([-40, 0, 40].map((centerOffset) => (
    nativeHudSkillActionRect(centerOffset)
  )), [
    { height: 65, left: 740, top: -7, width: 40 },
    { height: 65, left: 780, top: -7, width: 40 },
    { height: 65, left: 820, top: -7, width: 40 },
  ])
  assert.deepEqual(nativeHudSkillActionRect(20, 1280, -80), {
    height: 65,
    left: 640,
    top: -87,
    width: 40,
  })
})

test('derives the Tutorial selected-HUD lesson from the live primary and A rectangles', () => {
  const primaryAndA = nativeHudSkillBindings({
    concentrationSkillIds: [65, null],
    planewalkerActive: false,
    selectedPrimarySkillId: 8,
    weldBuildId: null,
  })
  assert.deepEqual(nativeTutorialSelectedHudLayout(primaryAndA), {
    firstLine: { x: 560, y: 75.5 },
    pointer: { toX: 800, toY: 25.5, x: 810, y: 75.5 },
    secondLine: { x: 560, y: 95.5 },
  })

  const splitMind = nativeHudSkillBindings({
    concentrationSkillIds: [65, 57],
    planewalkerActive: false,
    selectedPrimarySkillId: 8,
    weldBuildId: null,
  })
  assert.deepEqual(nativeTutorialSelectedHudLayout(splitMind), {
    firstLine: { x: 540, y: 75.5 },
    pointer: { toX: 800, toY: 25.5, x: 790, y: 75.5 },
    secondLine: { x: 540, y: 95.5 },
  })
  assert.equal(nativeTutorialSelectedHudLayout(nativeHudSkillBindings({
    concentrationSkillIds: [null, null],
    planewalkerActive: false,
    selectedPrimarySkillId: 8,
    weldBuildId: null,
  })), null)
})
