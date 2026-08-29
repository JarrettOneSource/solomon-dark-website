import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import nativeAssets from '../../assets/game/native-ui-assets.json' with { type: 'json' }
import {
  NATIVE_SKILL_CATALOG,
  NATIVE_WELD_BUILDS,
  nativeSkillColorRoot,
} from '../core-kernels/player-progression.ts'
import { nativeSkillPageTextHeight } from './skill-book-render-contract.ts'
import {
  SKILL_PICKER_CARD_CENTERS,
  SKILL_PICKER_CARD_FRAME,
  SKILL_PICKER_CARD_RECORDS,
  SKILL_PICKER_CARD_TEXT,
  SKILL_PICKER_ICON_ANCHOR_OFFSET,
  SKILL_PICKER_ICON_INTER_DRAW_OFFSET,
  SKILL_PICKER_INSIGHT_LABEL_Y,
  SKILL_PICKER_INSIGHT_TINT,
  SKILL_PICKER_NATIVE_UI_RECORDS,
  SKILL_PICKER_PANEL,
  SKILL_PICKER_ROOT_TINTS,
  SKILL_PICKER_SIZE,
  skillPickerCardPresentation,
  skillPickerDetailPresentation,
  skillPickerIconBounds,
  skillPickerInsightAlpha,
  skillPickerPanelBounds,
  skillPickerSpecialActionBounds,
} from './skill-picker-render-contract.ts'

const ASSET_ROOT = new URL('../../assets/game/', import.meta.url)
test('the picker keeps the sealed 1600x900 stock card geometry and records', () => {
  assert.deepEqual(SKILL_PICKER_SIZE, { height: 900, width: 1600 })
  assert.deepEqual(SKILL_PICKER_CARD_CENTERS[3], [600, 800, 1000])
  assert.deepEqual(SKILL_PICKER_CARD_CENTERS[4], [500, 700, 900, 1100])
  assert.deepEqual(SKILL_PICKER_CARD_FRAME, { height: 88, width: 87, y: 382.5 })
  assert.deepEqual(SKILL_PICKER_ICON_ANCHOR_OFFSET, { x: 4, y: 4 })
  assert.deepEqual(SKILL_PICKER_ICON_INTER_DRAW_OFFSET, { x: -4, y: -4 })
  assert.deepEqual(SKILL_PICKER_CARD_RECORDS, [0, 13, 164, 5, 14])
  assert.deepEqual(
    SKILL_PICKER_NATIVE_UI_RECORDS,
    [3, 10, 37, 49, 56, 57, 59, 62, 79, 107, 108, 109, 110],
  )
  assert.deepEqual(SKILL_PICKER_PANEL, {
    cardHeight: 295,
    cardTop: 302.5,
    cardWidth: 200,
    height: 355,
    top: 272.5,
    widthPadding: 60,
  })
  assert.deepEqual(skillPickerPanelBounds(3), {
    height: 355,
    left: 470,
    top: 272.5,
    width: 660,
  })
  assert.deepEqual(skillPickerSpecialActionBounds(3), {
    reroll: { height: 100, left: 1170, top: 322.5, width: 255 },
    save: { height: 100, left: 330, top: 322.5, width: 255 },
  })
  assert.deepEqual(skillPickerSpecialActionBounds(4), {
    reroll: { height: 100, left: 1270, top: 322.5, width: 255 },
    save: { height: 100, left: 230, top: 322.5, width: 255 },
  })
  assert.deepEqual(skillPickerIconBounds(3), [
    { height: 88, left: 556.5, top: 338.5, width: 87 },
    { height: 88, left: 756.5, top: 338.5, width: 87 },
    { height: 88, left: 956.5, top: 338.5, width: 87 },
  ])
  assert.deepEqual(skillPickerIconBounds(4), [
    { height: 88, left: 456.5, top: 338.5, width: 87 },
    { height: 88, left: 656.5, top: 338.5, width: 87 },
    { height: 88, left: 856.5, top: 338.5, width: 87 },
    { height: 88, left: 1_056.5, top: 338.5, width: 87 },
  ])
})

test('the picker consumes the exact extracted UI, Skills, and bitmap-font atlases', () => {
  assert.equal(nativeAssets.sourceExecutableSha256, '03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3')
  assert.deepEqual(nativeAssets.summary, { atlasCount: 12, fontCount: 10, glyphCount: 718, recordCount: 1259 })
  assert.deepEqual(pngDimensions('skill-picker-ui-atlas.png'), [1024, 1024])
  assert.deepEqual(pngDimensions('skill-picker-skills-atlas.png'), [1024, 512])
  assert.deepEqual(pngDimensions('skill-picker-fonts-atlas.png'), [512, 256])
  assert.deepEqual(nativeAssets.fonts.menu.metrics, [24, 6, 28])
  assert.deepEqual(nativeAssets.fonts['skill-uppercase'].metrics, [14, 4, 28])
  assert.deepEqual(nativeAssets.atlases.UI.records['49'].logicalSize, [264, 264])
  assert.deepEqual(nativeAssets.atlases.UI.records['10'].logicalSize, [106, 19])
  assert.deepEqual(nativeAssets.atlases.UI.records['79'].logicalSize, [21, 108])
  assert.ok(nativeAssets.atlases.UI.records['56'])
  assert.ok(nativeAssets.atlases.UI.records['57'])
  assert.equal(nativeAssets.atlases.UI.records['37'].logicalSize[0], 413)
  assert.deepEqual(nativeAssets.atlases.Skills.records['0'].logicalSize, [90, 90])
  assert.deepEqual(nativeAssets.atlases.Skills.records['5'].logicalSize, [87, 88])
  for (const record of ['13', '14', '164'] as const) {
    assert.ok(nativeAssets.atlases.Skills.records[record])
  }
  assert.deepEqual(nativeAssets.atlases.Skills.records['81'].logicalSize, [38, 46])
  assert.deepEqual(nativeAssets.atlases.Skills.records['90'].logicalSize, [44, 24])
  assert.deepEqual(
    NATIVE_WELD_BUILDS.map(({ skillsAtlasIconRecord }) => skillsAtlasIconRecord),
    [81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
  )
  assert.deepEqual(
    NATIVE_WELD_BUILDS.map(({ skillScreenIconRecord }) => skillScreenIconRecord),
    [108, 109, 110, 111, 112, 113, 114, 115, 116, 117],
  )
  const skillScreenRecords = [
    '108', '109', '110', '111', '112', '113', '114', '115', '116', '117',
  ] as const
  for (const record of skillScreenRecords) {
    assert.ok(nativeAssets.atlases.Skills.records[record])
  }
})

test('the picker presents authoritative Creativity Insight identity and detail', () => {
  assert.equal(SKILL_PICKER_INSIGHT_TINT, 0xd9ba70)
  assert.equal(SKILL_PICKER_INSIGHT_LABEL_Y, 305.5)
  assert.equal(skillPickerInsightAlpha(0), 0.5)
  assert.equal(skillPickerInsightAlpha(45), 1)
  assert.ok(Math.abs(skillPickerInsightAlpha(90) - 0.5) < 1e-12)
  assert.equal(skillPickerInsightAlpha(135), 0)
  assert.ok(Math.abs(skillPickerInsightAlpha(180) - 0.5) < 1e-12)
})

test('every public first-presented card owns its exact root color, family, wrapped name, and authored description', () => {
  const familyLabels = [' ETHER', ' FIRE', ' AIR', ' WATER', ' EARTH', 'BODY ', 'MIND ', 'ARCANE ']
  let ordinaryCount = 0
  for (const skill of NATIVE_SKILL_CATALOG.filter(({ id }) => id >= 8 && id <= 79)) {
    if (skill.id === 52) continue
    ordinaryCount += 1
    const card = skillPickerCardPresentation({ skillId: skill.id, targetRank: 1 })
    const root = nativeSkillColorRoot(skill.id)
    assert.notEqual(root, null, skill.name)
    assert.equal(card.root, root, skill.name)
    assert.equal(card.rootTint, SKILL_PICKER_ROOT_TINTS[root!], skill.name)
    assert.deepEqual(card.glowTints, [SKILL_PICKER_ROOT_TINTS[root!]], skill.name)
    assert.equal(card.frameRecord, 5, skill.name)
    assert.equal(card.iconRecord, skill.skills_atlas_icon_record, skill.name)
    assert.equal(card.name, skill.name.toUpperCase(), skill.name)
    assert.equal(card.familyLabel, familyLabels[root!], skill.name)
    assert.equal(
      card.quickDescription,
      skill.config?.mQDescription ?? skill.config?.mDescription,
      skill.name,
    )
    assert.ok(card.quickDescription.length > 0, skill.name)
    assert.ok(card.descriptionLines.every((line) => line.length > 0), skill.name)
    assert.equal(
      card.descriptionBaselineY,
      SKILL_PICKER_CARD_TEXT.descriptionCenterY
        - nativeSkillPageTextHeight(card.descriptionLines) / 2,
      skill.name,
    )
    assert.equal(card.familyBaselineY, card.nameBaselineY + nativeSkillPageTextHeight(card.nameLines))
    assert.equal(card.textShadowOffset, 1)
  }
  assert.equal(ordinaryCount, 71)

  const ring = skillPickerCardPresentation({ skillId: 21, targetRank: 2 })
  assert.equal(ring.name, 'RING OF FIRE 2')
  assert.deepEqual(ring.descriptionLines, ['blast all', 'surrounding', 'enemies'])
  const leviathan = skillPickerCardPresentation({ skillId: 11, targetRank: 2 })
  assert.deepEqual(leviathan.nameLines, ['CALL', 'LEVIATHAN 2'])
  assert.deepEqual(
    skillPickerCardPresentation({ skillId: 12, targetRank: 1 }).nameLines,
    ['PLANEWALK-', 'ER'],
  )
})

test('all ten Welding cards use their synthetic card domain and preserve Insight as a second pass', () => {
  assert.deepEqual(NATIVE_WELD_BUILDS.map(({ pairDescription }) => pairDescription), [
    'Welded Magic Missile + Fireball',
    'Welded Magic Missile + Frost Jet',
    'Welded Magic Missile + Lightning',
    'Welded Lighting + Fireball',
    'Welded Lightning + Frost Jet',
    'Welded Fireball + Frost Jet',
    'Welded Magic Missile + Boulder',
    'Welded Fireball + Boulder',
    'Welded Frost Jet + Boulder',
    'Welded Lightning + Boulder',
  ])
  for (const build of NATIVE_WELD_BUILDS) {
    const card = skillPickerCardPresentation({
      skillId: 52,
      targetRank: 1,
      weldBuildId: build.id,
    })
    assert.equal(card.frameRecord, 14, build.syntheticName)
    assert.equal(card.iconRecord, build.skillScreenIconRecord, build.syntheticName)
    assert.equal(card.name, build.syntheticName, build.syntheticName)
    assert.equal(card.familyLabel, 'ARCANE ', build.syntheticName)
    assert.equal(card.quickDescription, build.pairDescription, build.syntheticName)
    assert.deepEqual(
      card.glowTints,
      build.colorRoots.map((root) => SKILL_PICKER_ROOT_TINTS[root]),
      build.syntheticName,
    )
  }
})

test('every public picker option projects complete authored SkillScreen detail at its offered rank', () => {
  let ordinaryCount = 0
  let concentrationCount = 0
  for (const skill of NATIVE_SKILL_CATALOG.filter(({ id }) => id >= 8 && id <= 79)) {
    if (skill.id === 52) continue
    ordinaryCount += 1
    const detail = skillPickerDetailPresentation({ skillId: skill.id, targetRank: 1 })
    assert.equal(detail.row.id, skill.id, skill.name)
    assert.equal(detail.row.effectiveRank, 1, skill.name)
    assert.equal(detail.row.permanentRank, 1, skill.name)
    assert.ok(detail.lines.length >= 5, `${skill.name} lost its detailed body`)
    assert.equal(
      detail.lines.some(({ text }) => /%[DFNXdfnx]:/.test(text)),
      false,
      `${skill.name} retained an unresolved native stat token`,
    )
    if (detail.row.category === 3) {
      concentrationCount += 1
      assert.ok(
        detail.lines.some(({ kind }) => kind === 'bonus'),
        `${skill.name} lost its concentration bonus`,
      )
    }
  }
  assert.equal(ordinaryCount, 71)
  assert.equal(concentrationCount, 14)

  const ranked = skillPickerDetailPresentation({ insight: true, skillId: 21, targetRank: 3 })
  assert.equal(ranked.row.effectiveRank, 3)
  assert.match(ranked.lines.find(({ kind }) => kind === 'title')?.text ?? '', /3\/5/)
})

test('every Welding picker detail keeps its synthetic build identity and pair description', () => {
  for (const build of NATIVE_WELD_BUILDS) {
    const detail = skillPickerDetailPresentation({
      skillId: 52,
      targetRank: 1,
      weldBuildId: build.id,
    })
    assert.equal(detail.row.name, build.syntheticName)
    assert.equal(detail.row.iconRecord, build.skillScreenIconRecord)
    assert.equal(detail.row.weldBuildId, build.id)
    assert.equal(
      detail.lines.find(({ kind }) => kind === 'description')?.text,
      build.pairDescription,
    )
  }
})

function pngDimensions(name: string): readonly [number, number] {
  const contents = readFileSync(new URL(name, ASSET_ROOT))
  assert.equal(contents.subarray(1, 4).toString('ascii'), 'PNG')
  return [contents.readUInt32BE(16), contents.readUInt32BE(20)]
}
