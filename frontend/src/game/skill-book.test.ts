import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  NATIVE_SKILL_CATALOG,
  nativeSkillCategory,
} from './core-kernels/player-progression.ts'
import { createGameSimulation } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import {
  NATIVE_SKILL_PAGE_BASE_WIDTH,
  NATIVE_SKILL_PAGE_DEPENDENT_WIDTH,
  NATIVE_SKILL_PAGE_HEIGHT,
  formatNativeSkillBookTooltipLine,
  nativeSkillBookPagePlacements,
  nativeSkillBookPages,
  nativeSkillBookRows,
  nativeSkillBookTooltipLines,
  selectableConcentrationSkillRows,
  selectablePrimarySkillRows,
  selectableSecondarySkillRows,
  type NativeSkillBookPage,
  type NativeSkillBookRow,
} from './skill-book-model.ts'
import {
  NATIVE_SKILL_HOVER_BOX,
  NATIVE_SKILL_PAGE_PANEL,
  NATIVE_SKILL_ROW_PRESENTATION,
  NATIVE_SKILL_SCREEN_ROOT,
  nativeSkillPageDisplayName,
  nativeSkillPageTextHeight,
  nativeSkillPageTint,
  nativeSkillPageWrappedLines,
  nativeSkillExactTextRuns,
  nativeSkillScreenSealTransform,
  nativeSkillScreenTick,
  type NativeSkillScreenSealTransform,
} from './renderer/skill-book-render-contract.ts'

const component = readFileSync(new URL('./SkillBook.tsx', import.meta.url), 'utf8')
const hudSelector = readFileSync(new URL('./HudSkillSelector.tsx', import.meta.url), 'utf8')
const hudSelectorCss = readFileSync(new URL('./hud-skill-selector.css', import.meta.url), 'utf8')
const hudSelectorRenderer = readFileSync(
  new URL('./renderer/hud-skill-selector-renderer.ts', import.meta.url),
  'utf8',
)
const css = readFileSync(new URL('./skill-book.css', import.meta.url), 'utf8')
const mainMenuCss = readFileSync(new URL('./main-menu.css', import.meta.url), 'utf8')
const renderer = readFileSync(new URL('./renderer/skill-book-renderer.ts', import.meta.url), 'utf8')
const hud = readFileSync(new URL('./GameHud.tsx', import.meta.url), 'utf8')
const scene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const hubScene = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const boneyardScene = readFileSync(new URL('./BoneyardScene.tsx', import.meta.url), 'utf8')
const nativeAssets = JSON.parse(readFileSync(
  new URL('../assets/game/native-ui-assets.json', import.meta.url),
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

test('renderer owns the complete stock root, page-wide panels, row frames, and HoverBox', () => {
  for (const record of [3, 4, 10, 30, 31, 32, 33, 49, 71]) {
    assert.ok(nativeAssets.atlases.UI.records[record])
  }
  for (const record of [0, 5, 6, 13, 14, 164, 165]) {
    assert.ok(nativeAssets.atlases.Skills.records[record])
  }
  assert.match(renderer, /NATIVE_SKILL_SCREEN_ROOT\.leatherRecord/)
  assert.match(renderer, /NATIVE_SKILL_SCREEN_ROOT\.leatherHeight[\s\S]*\.fill\(0x000000\)/)
  assert.match(renderer, /root\.addChild\(curtain, ambient, fixtures, field, overlay, pages, hud, hover\)/)
  assert.match(renderer, /textureFor\(textures, 'Skills', 0\)/)
  assert.match(renderer, /NATIVE_SKILL_SCREEN_ROOT\.topFlourishes/)
  assert.match(renderer, /spriteFor\(textures, 'Skills', 13\)/)
  assert.match(renderer, /row\.category === 1 \|\| row\.category === 2/)
  assert.match(renderer, /drawNativeHoverBox/)
  assert.match(renderer, /selection === 'primary' \? 'casting' : 'concentrate'/)
  assert.match(renderer, /\? 'primary cast'/)
  assert.match(renderer, /nativeHudModalSlideLayout\([\s\S]*?progress[\s\S]*?\)/)
  assert.doesNotMatch(renderer, /QUICKBAR_SLOT_[XY]|liveHudArtOffsetY/)
  assert.match(component, /setNativeModalSlideProgress\('skills', progress\)/)
  assert.match(component, /data-open-progress=\{openProgress\}/)
  assert.doesNotMatch(renderer, /roundRect/)
  assert.doesNotMatch(renderer, /nativeTooltipStatLines/)
  assert.match(
    mainMenuCss,
    /\.main-menu-page\[data-skill-book-open='true'\] \.game-menu-skull\s*\{\s*display: none;/,
  )
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

test('pins the omitted native root and page-wide render contract', () => {
  assert.equal(NATIVE_SKILL_SCREEN_ROOT.ambientAlpha, 0.15)
  assert.equal(NATIVE_SKILL_SCREEN_ROOT.titleY, 60)
  assert.equal(NATIVE_SKILL_SCREEN_ROOT.helpLineGap, 18)
  assert.deepEqual(NATIVE_SKILL_SCREEN_ROOT.titleBacking, {
    height: 34,
    width: 114,
    x: 743,
    y: 34,
  })
  assert.deepEqual(NATIVE_SKILL_SCREEN_ROOT.topFlourishes, [
    { record: 33, rotationDegrees: -90, x: 80, y: 30 },
    { record: 33, rotationDegrees: 90, x: 1520, y: 30 },
  ])
  assert.deepEqual(NATIVE_SKILL_SCREEN_ROOT.topWizards, [
    { mirrorX: true, record: 31, x: 200, y: 20 },
    { mirrorX: false, record: 31, x: 1400, y: 20 },
  ])
  assert.deepEqual(NATIVE_SKILL_SCREEN_ROOT.bottomWarriorClip, {
    height: 80,
    width: 1600,
    x: 0,
    y: 820,
  })
  assert.deepEqual(NATIVE_SKILL_PAGE_PANEL, {
    additiveAlpha: 0.5,
    height: 300,
    inset: 12,
    record: 0,
    selectedAlpha: 0.5,
    slice: 30,
    unselectedAlpha: 0.1,
  })
  assert.equal(NATIVE_SKILL_ROW_PRESENTATION.ordinaryFrameRecord, 5)
  assert.equal(NATIVE_SKILL_ROW_PRESENTATION.actionableFrameRecord, 14)
  assert.equal(NATIVE_SKILL_ROW_PRESENTATION.auraRecord, 13)
  assert.equal(NATIVE_SKILL_ROW_PRESENTATION.iconShadowOffset, 4)
  assert.equal(NATIVE_SKILL_ROW_PRESENTATION.selectedFrameAlpha, 1)
  assert.equal(NATIVE_SKILL_ROW_PRESENTATION.selectedFrameTint, 0x97c797)
  assert.equal(NATIVE_SKILL_ROW_PRESENTATION.textShadowOffset, 1)
  assert.equal(NATIVE_SKILL_ROW_PRESENTATION.textWrapWidth, 140)
  assert.equal(nativeSkillPageTint(0), 0x886688)
  assert.equal(nativeSkillPageTint(1), 0x998077)
  assert.deepEqual(NATIVE_SKILL_HOVER_BOX, {
    contentMargin: 25,
    contentMaxWidth: 380,
    lineGap: 10,
    sourceGap: 50,
    viewportMargin: 25,
  })
})

test('keeps all eight ambient seals on deterministic sine lanes with one local 100 Hz phase', () => {
  const atBirth: readonly NativeSkillScreenSealTransform[] = Array.from(
    { length: NATIVE_SKILL_SCREEN_ROOT.ambientCount },
    (_, index) => nativeSkillScreenSealTransform(index, 0),
  )
  assert.deepEqual(atBirth, [
    { rotationDegrees: 0, x: 800, y: 490 },
    { rotationDegrees: 45, x: 840, y: 490 },
    { rotationDegrees: 90, x: 800, y: 490 },
    { rotationDegrees: 135, x: 760, y: 490 },
    { rotationDegrees: 180, x: 800, y: 490 },
    { rotationDegrees: 225, x: 840, y: 490 },
    { rotationDegrees: 270, x: 800, y: 490 },
    { rotationDegrees: 315, x: 760, y: 490 },
  ])
  for (const tick of [60, 100, 21_600]) {
    const transformsAtTick: readonly NativeSkillScreenSealTransform[] = atBirth.map(
      (_, index) => nativeSkillScreenSealTransform(index, tick),
    )
    assert.deepEqual(
      transformsAtTick.map(({ x, y }) => ({ x, y })),
      atBirth.map(({ x, y }) => ({ x, y })),
    )
    transformsAtTick.forEach(({ rotationDegrees }, index) => {
      assert.equal(rotationDegrees, atBirth[index]!.rotationDegrees - tick / 60)
    })
  }
  assert.equal(nativeSkillScreenTick(0), 0)
  assert.equal(nativeSkillScreenTick(9.999), 0)
  assert.equal(nativeSkillScreenTick(10), 1)
  assert.equal(nativeSkillScreenTick(1_000), 100)
  assert.throws(() => nativeSkillScreenTick(-1), RangeError)
  assert.throws(() => nativeSkillScreenTick(Number.NaN), RangeError)
  assert.throws(() => nativeSkillScreenSealTransform(-1, 0), RangeError)
  assert.throws(() => nativeSkillScreenSealTransform(8, 0), RangeError)
  assert.throws(() => nativeSkillScreenSealTransform(0, 0.5), RangeError)
  assert.match(renderer, /constructedAtMs = performance\.now\(\)/)
  assert.match(renderer, /nativeSkillScreenTick\(nowMs - constructedAtMs\)/)
  assert.match(renderer, /screenTick !== lastSealTick/)
  assert.doesNotMatch(renderer, /nativeSkillScreenSealJitter|ambientJitterWidth|nowMs \/ 1_000/)
})

test('reproduces the stock SkillPage wrapper and vertically centred description block', () => {
  const magicMissile = nativeSkillPageWrappedLines('a magic bolt that follows enemies')
  const callLeviathan = nativeSkillPageWrappedLines('call leviathan from the ether')
  assert.deepEqual(magicMissile, ['a magic bolt', 'that follows', 'enemies'])
  assert.deepEqual(callLeviathan, ['call leviathan', 'from the', 'ether'])
  assert.equal(nativeSkillPageTextHeight(magicMissile), 50)
  assert.equal(nativeSkillPageDisplayName('Magic Missile', 1), 'MAGIC MISSILE')
  assert.equal(nativeSkillPageDisplayName('Magic Missile', 3), 'MAGIC MISSILE 3')
})

test('builds HoverBox lines from authored stats and concentration bonuses in native order', () => {
  const magicMissile = baselineRow(8)
  assert.deepEqual(
    nativeSkillBookTooltipLines(magicMissile)
      .filter(({ kind }) => kind === 'stat')
      .map(({ text }) => text),
    ['   Damage: 1-2', '   Mana Cost: 6'],
  )
  const leviathan = baselineRow(11)
  assert.deepEqual(
    nativeSkillBookTooltipLines(leviathan)
      .filter(({ kind }) => kind === 'stat')
      .map(({ text }) => text),
    ['   Damage: 2', '   Appendages: up to 1', '   Mana Cost: 75'],
  )
  const channelMana = catalogRow(57)
  assert.deepEqual(
    nativeSkillBookTooltipLines(channelMana)
      .filter(({ kind }) => kind === 'stat' || kind === 'bonus')
      .map(({ text }) => text),
    ['   Recovery: +25%', '   Concentrate: +15% Recovery'],
  )
})

test('formats native D/F/X/N values, percent escapes, and ExactText commands', () => {
  assert.equal(formatNativeSkillBookTooltipLine(
    '%d:d% | %f:f% | %x:x% | %n:n% | %n:i% | 50%%',
    { d: 4.6, f: 1.25, i: 3, n: 2.25, x: 1.234 },
    1,
  ), '5 | 1.3 | 1.23 | 2.3 | 3 | 50%')
  assert.deepEqual(nativeSkillExactTextRuns('A_s(.7)_o(0,1)_i / SEC'), [
    { italic: false, offsetX: 0, offsetY: 0, scale: 1, text: 'A' },
    { italic: true, offsetX: 0, offsetY: 1, scale: 0.7, text: ' / SEC' },
  ])
})

test('drains every public SkillScreen tooltip row without unresolved stat tokens', () => {
  for (let skillId = 8; skillId <= 79; skillId += 1) {
    const lines = nativeSkillBookTooltipLines(catalogRow(skillId))
    assert.ok(lines.length >= 5, `skill ${skillId} lost its HoverBox body`)
    assert.equal(
      lines.some(({ text }) => /%[DFNXdfnx]:/.test(text)),
      false,
      `skill ${skillId} retained an unresolved native stat token`,
    )
  }
})

test('selected HUD bindings open the compact native selector in both gameplay scenes', () => {
  assert.match(hud, /hub-hud-selected-skill-action/)
  assert.match(hud, /NATIVE_HUD_SKILL_ACTION_WIDTH/)
  assert.match(hubScene, /onOpenSkillSelector\(binding\)/)
  assert.match(boneyardScene, /onOpenSkillSelector\(binding\)/)
  assert.match(scene, /nativeHudSkillSelectorTarget\(binding\)/)
  assert.match(scene, /onSelectConcentrationSlot=\{session\.selectConcentrationSlot\}/)
  assert.match(hudSelector, /data-selector-kind=\{target\.kind\}/)
  assert.match(hudSelector, /audio\.playSound\('concentrate'\)/)
  assert.match(hudSelectorRenderer, /fill\(\{ color: 0x000000, alpha: 0\.95 \}\)/)
  assert.match(hudSelectorRenderer, /tint: 0xd9ba70/)
  assert.match(hudSelector, /top: layout\.optionTop/)
  assert.match(hudSelectorCss, /\.hud-skill-selector-action[\s\S]*pointer-events: auto/)
})

function baselineRow(skillId: number): NativeSkillBookRow {
  const row = nativeSkillBookRows(baseline).find(({ id }) => id === skillId)
  assert.ok(row)
  return row
}

function catalogRow(skillId: number): NativeSkillBookRow {
  const skill = NATIVE_SKILL_CATALOG[skillId]
  const category = nativeSkillCategory(skillId)
  assert.ok(skill)
  assert.notEqual(category, null)
  return {
    category: category!,
    dependencyIds: [],
    description: skill.config?.mQDescription ?? skill.config?.mDescription ?? '',
    effectiveRank: 1,
    iconRecord: skill.skills_atlas_icon_record,
    id: skillId,
    name: skill.name,
    permanentRank: 1,
    weldBuildId: skillId === 52 ? 1000 : null,
  }
}
