import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { createGameSimulation } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import {
  NATIVE_SKILL_PAGE_BASE_WIDTH,
  NATIVE_SKILL_PAGE_DEPENDENT_WIDTH,
  NATIVE_SKILL_PAGE_HEIGHT,
  nativeSkillBookPagePlacements,
  nativeSkillBookPages,
  nativeSkillBookRows,
  selectableConcentrationSkillRows,
  selectablePrimarySkillRows,
  selectableSecondarySkillRows,
  type NativeSkillBookPage,
} from './skill-book-model.ts'

const component = readFileSync(new URL('./SkillBook.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./skill-book.css', import.meta.url), 'utf8')
const renderer = readFileSync(new URL('./renderer/skill-book-renderer.ts', import.meta.url), 'utf8')
const hud = readFileSync(new URL('./GameHud.tsx', import.meta.url), 'utf8')
const scene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const hubScene = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const boneyardScene = readFileSync(new URL('./BoneyardScene.tsx', import.meta.url), 'utf8')
const nativeAssets = JSON.parse(readFileSync(
  new URL('../assets/game/skill-picker-native-assets.json', import.meta.url),
  'utf8',
))
const baseline = createGameSnapshot(createGameSimulation(), null)
  .players['local-player']!.progression

test('builds the two native starting pages in learned acquisition order', () => {
  const pages = nativeSkillBookPages(baseline)
  assert.deepEqual(pages.map(({ rootSkillId }) => rootSkillId), [8, 11])
  assert.deepEqual(pages.map(({ rows }) => rows.map(({ id }) => id)), [[8], [11]])
  assert.deepEqual(pages.map(({ width }) => width), [200, 200])
})

test('groups learned transitive dependents under every related native root', () => {
  const progression = {
    ...baseline,
    learnedSkills: [
      ...baseline.learnedSkills,
      [9, 1, 1],
      [13, 1, 1],
      [12, 1, 1],
      [16, 1, 1],
      [21, 1, 1],
      [22, 1, 1],
    ] as const,
    learnedSkillOrder: [8, 11, 13, 9, 12, 16, 21, 22] as const,
  }
  const pages = nativeSkillBookPages(progression)
  assert.deepEqual(pages.map(({ rootSkillId }) => rootSkillId), [8, 11, 12, 16, 21])
  assert.deepEqual(
    pages.find(({ rootSkillId }) => rootSkillId === 8)?.rows.map(({ id }) => id),
    [8, 13, 9],
  )
  assert.deepEqual(
    pages.find(({ rootSkillId }) => rootSkillId === 16)?.rows.map(({ id }) => id),
    [16, 22],
  )
  assert.deepEqual(
    pages.find(({ rootSkillId }) => rootSkillId === 21)?.rows.map(({ id }) => id),
    [21, 22],
  )
  assert.equal(pages.find(({ rootSkillId }) => rootSkillId === 8)?.width, 520)
})

test('exposes every learned interaction category without losing welded primary rows', () => {
  const progression = {
    ...baseline,
    learnedSkills: [
      ...baseline.learnedSkills,
      [16, 1, 1],
      [21, 1, 1],
      [52, 1, 1],
      [57, 1, 1],
    ] as const,
    learnedSkillOrder: [8, 11, 16, 21, 52, 57] as const,
    weldBuildId: 1000,
  }
  assert.deepEqual(selectablePrimarySkillRows(progression).map(({ id }) => id), [8, 16, 52])
  assert.deepEqual(selectableSecondarySkillRows(progression).map(({ id }) => id), [11, 21])
  assert.deepEqual(selectableConcentrationSkillRows(progression).map(({ id }) => id), [57])
  assert.deepEqual(nativeSkillBookRows(progression).map(({ id }) => id), [8, 11, 16, 21, 52, 57])
})

test('uses the recovered page dimensions, wrapping, and common centering', () => {
  const page = (rootSkillId: number, width: number): NativeSkillBookPage => ({
    height: NATIVE_SKILL_PAGE_HEIGHT,
    rootSkillId,
    rows: [],
    width,
  })
  const placements = nativeSkillBookPagePlacements([
    page(8, 840),
    page(11, 840),
    page(12, NATIVE_SKILL_PAGE_BASE_WIDTH + NATIVE_SKILL_PAGE_DEPENDENT_WIDTH),
  ])
  assert.deepEqual(placements.map(({ x, y }) => [x, y]), [
    [200, 72],
    [200, 372],
    [1040, 372],
  ])
})

test('renderer owns the stock screen chrome, draggable primary/secondary frames, and tooltip', () => {
  for (const record of [30, 31, 32]) assert.ok(nativeAssets.atlases.UI.records[record])
  for (const record of [6, 14, 165]) assert.ok(nativeAssets.atlases.Skills.records[record])
  assert.match(renderer, /textureFor\(textures, 'UI', 49\)/)
  assert.match(renderer, /row\.category === 1 \|\| row\.category === 2/)
  assert.match(renderer, /drawHoveredTooltip/)
  assert.match(component, /setPointerCapture/)
  assert.match(component, /quickbarSlotAt/)
  assert.match(component, /progression\.skillQuickbar/)
  assert.match(component, /onSelectConcentration/)
  assert.match(css, /\.skill-book-quickbar-action:nth-child\(8\)/)
  assert.match(hud, /SkillQuickbar/)
  assert.match(hud, /nativeHealthHudPresentation/)
  assert.match(hud, /nativeManaHudPresentation/)
  assert.match(hud, /nativeHudSkillBindings/)
  assert.match(hud, /--native-meter-core-width/)
  assert.match(scene, /current\.maximumHealth === next\.maximumHealth/)
  assert.match(scene, /current\.maximumMana === next\.maximumMana/)
  assert.doesNotMatch(hud, /SecondaryAbilityBelt/)
  assert.match(scene, /onAssignQuickbarSkill=\{session\.bindSkillQuickbar\}/)
  assert.match(hubScene, /event\.code !== settings\.controls\.openSkills/)
  assert.match(boneyardScene, /event\.code !== settings\.controls\.openSkills/)
})
