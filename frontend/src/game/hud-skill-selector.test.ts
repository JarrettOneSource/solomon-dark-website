import assert from 'node:assert/strict'
import test from 'node:test'

import { NATIVE_WELD_BUILDS } from './core-kernels/player-progression.ts'
import { createGameSimulation } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import {
  nativeHudSkillSelectorLayout,
  nativeHudSkillSelectorOptions,
  nativeHudSkillSelectorTarget,
  nativeHudSkillSelectorTitle,
} from './hud-skill-selector.ts'

const baseline = createGameSnapshot(createGameSimulation(), null)
  .players['local-player']!.progression
test('maps all three native HUD bindings to their addressed selector', () => {
  assert.deepEqual(nativeHudSkillSelectorTarget(12), { binding: 12, kind: 'primary' })
  assert.deepEqual(nativeHudSkillSelectorTarget(16), {
    binding: 16,
    kind: 'concentration',
    slot: 0,
  })
  assert.deepEqual(nativeHudSkillSelectorTarget(20), {
    binding: 20,
    kind: 'concentration',
    slot: 1,
  })
  assert.equal(nativeHudSkillSelectorTitle(nativeHudSkillSelectorTarget(12)), 'Select Primary Attack')
  assert.equal(nativeHudSkillSelectorTitle(nativeHudSkillSelectorTarget(16)), 'Select Concentration')
})

test('selects every pure primary in numeric order and resolves all ten Weld build icons', () => {
  const primarySkillIds = [8, 16, 24, 32, 40, 52] as const
  const progression = {
    ...baseline,
    learnedSkills: primarySkillIds.map((skillId) => [skillId, 1, 1] as const),
    learnedSkillOrder: [52, 40, 32, 24, 16, 8] as const,
    weldBuildId: 1000,
  }
  assert.deepEqual(
    nativeHudSkillSelectorOptions(progression, nativeHudSkillSelectorTarget(12))
      .map(({ skillId }) => skillId),
    primarySkillIds,
  )
  assert.deepEqual(
    NATIVE_WELD_BUILDS.map((build) => nativeHudSkillSelectorOptions(
      { ...progression, weldBuildId: build.id },
      nativeHudSkillSelectorTarget(12),
    ).at(-1)!.iconRecord),
    [108, 109, 110, 111, 112, 113, 114, 115, 116, 117],
  )
  assert.equal(
    nativeHudSkillSelectorOptions(
      { ...progression, weldBuildId: 1005 },
      nativeHudSkillSelectorTarget(12),
    ).at(-1)!.iconRecord,
    113,
  )
})

test('drains all fourteen category-three rows and their exact native icons', () => {
  const concentrationSkillIds = [
    57, 58, 59, 60, 61, 62, 63,
    65, 66, 67, 68, 69, 70, 71,
  ] as const
  const progression = {
    ...baseline,
    concentrationSkillIds: [null, null] as const,
    learnedSkills: concentrationSkillIds.map((skillId) => [skillId, 1, 1] as const),
    learnedSkillOrder: [...concentrationSkillIds],
  }
  const options = nativeHudSkillSelectorOptions(
    progression,
    nativeHudSkillSelectorTarget(16),
  )
  assert.deepEqual(options.map(({ skillId }) => skillId), concentrationSkillIds)
  assert.deepEqual(
    options.map(({ iconRecord }) => iconRecord),
    [84, 85, 86, 87, 88, 89, 90, 92, 93, 94, 95, 96, 97, 98],
  )
})

test('concentration A and B exclude only the opposite occupied slot', () => {
  const progression = {
    ...baseline,
    concentrationSkillIds: [58, 59] as const,
    learnedSkills: [
      ...baseline.learnedSkills,
      [60, 1, 1],
      [59, 1, 1],
      [58, 1, 1],
      [57, 1, 1],
    ] as const,
    learnedSkillOrder: [...baseline.learnedSkillOrder, 60, 59, 58, 57] as const,
  }
  assert.deepEqual(
    nativeHudSkillSelectorOptions(progression, nativeHudSkillSelectorTarget(16))
      .map(({ skillId }) => skillId),
    [57, 58, 60],
  )
  assert.deepEqual(
    nativeHudSkillSelectorOptions(progression, nativeHudSkillSelectorTarget(20))
      .map(({ skillId }) => skillId),
    [57, 59, 60],
  )
})

test('pins the native 52-pixel strip and 79-pixel top panel geometry', () => {
  assert.deepEqual(nativeHudSkillSelectorLayout(3, 120), {
    optionLeft: 722,
    optionTop: 74,
    panelHeight: 79,
    panelLeft: 717,
    panelTop: 52,
    panelWidth: 166,
    stripWidth: 156,
    titleY: 69,
  })
  assert.deepEqual(nativeHudSkillSelectorLayout(1, 140), {
    optionLeft: 774,
    optionTop: 74,
    panelHeight: 79,
    panelLeft: 725,
    panelTop: 52,
    panelWidth: 150,
    stripWidth: 52,
    titleY: 69,
  })
  assert.deepEqual(nativeHudSkillSelectorLayout(1, 200), {
    optionLeft: 774,
    optionTop: 74,
    panelHeight: 79,
    panelLeft: 695,
    panelTop: 52,
    panelWidth: 210,
    stripWidth: 52,
    titleY: 69,
  })
})
