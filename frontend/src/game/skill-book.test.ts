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
  selectableConcentrationSkillRows,
  selectablePrimarySkillRows,
  selectableSecondarySkillRows,
  type NativeSkillBookPage,
} from './skill-book-model.ts'

const component = readFileSync(new URL('./SkillBook.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./skill-book.css', import.meta.url), 'utf8')
const renderer = readFileSync(new URL('./renderer/skill-book-renderer.ts', import.meta.url), 'utf8')
const hud = readFileSync(new URL('./GameHud.tsx', import.meta.url), 'utf8')
const hudCss = readFileSync(new URL('./hub.css', import.meta.url), 'utf8')
const scene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const hubScene = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const boneyardScene = readFileSync(new URL('./BoneyardScene.tsx', import.meta.url), 'utf8')
const nativeAssets = JSON.parse(readFileSync(
  new URL('../assets/game/skill-picker-native-assets.json', import.meta.url),
  'utf8',
))

const baseline = createGameSnapshot(createGameSimulation(), null)
  .players['local-player']!.progression

test('builds stock dependency-root pages and duplicates shared-any dependents', () => {
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
      [57, 1, 1],
    ] as const,
    learnedSkillOrder: [8, 11, 13, 9, 12, 16, 21, 22, 57] as const,
  }
  const pages = nativeSkillBookPages(progression)
  assert.deepEqual(pages.map(({ rootSkillId }) => rootSkillId), [8, 11, 12, 16, 21, 57])
  assert.deepEqual(pages.find(({ rootSkillId }) => rootSkillId === 8)?.rows.map(({ id }) => id), [8, 13, 9])
  assert.deepEqual(pages.find(({ rootSkillId }) => rootSkillId === 16)?.rows.map(({ id }) => id), [16, 22])
  assert.deepEqual(pages.find(({ rootSkillId }) => rootSkillId === 21)?.rows.map(({ id }) => id), [21, 22])
  assert.equal(pages.find(({ rootSkillId }) => rootSkillId === 8)?.width, 520)
  assert.deepEqual(selectablePrimarySkillRows(progression).map(({ id }) => id), [8, 16])
  assert.deepEqual(selectableSecondarySkillRows(progression).map(({ id }) => id), [11, 12, 21])
  assert.deepEqual(selectableConcentrationSkillRows(progression).map(({ id }) => id), [57])
})

test('uses recovered 200 by 300 pages, 160 dependent growth, wrap, and common centering', () => {
  const page = (rootSkillId: number, width: number): NativeSkillBookPage => ({
    height: NATIVE_SKILL_PAGE_HEIGHT,
    rootSkillId,
    rows: [],
    width,
  })
  assert.equal(NATIVE_SKILL_PAGE_BASE_WIDTH, 200)
  assert.equal(NATIVE_SKILL_PAGE_DEPENDENT_WIDTH, 160)
  const placements = nativeSkillBookPagePlacements([
    page(8, 680),
    page(11, 680),
    page(12, 360),
  ])
  assert.deepEqual(placements.map(({ x, y }) => [x, y]), [
    [120, 72],
    [800, 72],
    [120, 372],
  ])
  assert.equal(nativeSkillBookPagePlacements([page(8, 200)])[0]?.y, 280)
})

test('drains all public authored rows and every SkillScreen atlas member', () => {
  const publicSkillIds = Array.from({ length: 72 }, (_, index) => index + 8)
  const progression = {
    ...baseline,
    learnedSkills: [
      [0, 1, 1] as const,
      [7, 1, 1] as const,
      ...publicSkillIds.map((skillId) => [skillId, 1, 1] as const),
    ],
    learnedSkillOrder: publicSkillIds,
  }
  const pageRows = nativeSkillBookPages(progression).flatMap(({ rows }) => rows.map(({ id }) => id))
  assert.deepEqual([...new Set(pageRows)].sort((left, right) => left - right), publicSkillIds)
  for (const record of [3, 10, 30, 31, 32, 49, 79]) {
    assert.ok(nativeAssets.atlases.UI.records[record])
  }
  for (const record of [5, 6, 12, 13, 14, 164, 165]) {
    assert.ok(nativeAssets.atlases.Skills.records[record])
  }
  for (let record = 27; record <= 122; record += 1) {
    assert.ok(nativeAssets.atlases.Skills.records[record])
  }
})

test('renders the stock all-pages screen, exact help, shipped art, and eight-slot bindings', () => {
  assert.match(component, />SKILLS</)
  assert.match(component, /skills with a gold or green border/)
  assert.match(component, /can be dragged into your belt/)
  assert.match(component, /hover over a skill icon for more/)
  assert.match(component, /touch and hold a skill icon for more/)
  assert.match(component, /nativeSkillBookPagePlacements/)
  assert.doesNotMatch(component, /skill-book-tabs/)
  assert.doesNotMatch(component, /NativePanelTiles/)
  assert.match(component, /createSkillBookRenderer/)
  assert.match(component, /ticks \* 0\.025/)
  assert.match(renderer, /textureFor\(textures, 'Skills', weldBuild \? 14 : 5\)/)
  assert.match(renderer, /spriteFor\(textures, 'Skills', 6\)/)
  assert.match(renderer, /textureFor\(textures, 'UI', 49\)/)
  assert.match(renderer, /spriteFor\(textures, 'UI', 30\)/)
  assert.match(renderer, /presentation\.openProgress \*\* 3/)
  assert.match(renderer, /nativeWeldBuild/)
  assert.match(renderer, /addBitmapText/)
  assert.match(css, /\.skill-book-canvas[\s\S]*width:\s*1600px/)
  assert.match(css, /\.skill-book-belt-action:nth-child\(8\)/)
  assert.match(renderer, /hub\.hud\.mouseRight/)
})

test('projects player-owned belt through the live HUD and shares I/T surfaces across scenes', () => {
  assert.match(hud, /SecondaryAbilityBelt/)
  assert.match(hud, /secondaryHud\.belt/)
  assert.match(hud, /aria-label="Open skills"/)
  assert.doesNotMatch(hud, /Acid Rain/)
  assert.match(hudCss, /\.hub-hud-secondary-slot/)
  assert.match(hubScene, /event\.code !== 'KeyT'/)
  assert.match(boneyardScene, /event\.code !== 'KeyT'/)
  assert.match(boneyardScene, /tradersEnabled=\{false\}/)
  assert.match(scene, /gameplayPause !== null \|\| skillBookOpen/)
})
