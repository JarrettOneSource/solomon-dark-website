import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import nativeAssets from '../../assets/game/native-ui-assets.json' with { type: 'json' }
import { NATIVE_WELD_BUILDS } from '../core-kernels/player-progression.ts'
import {
  SKILL_PICKER_CARD_CENTERS,
  SKILL_PICKER_CARD_FRAME,
  SKILL_PICKER_CARD_RECORDS,
  SKILL_PICKER_ICON_ANCHOR_OFFSET,
  SKILL_PICKER_ICON_INTER_DRAW_OFFSET,
  SKILL_PICKER_NATIVE_UI_RECORDS,
  SKILL_PICKER_PANEL,
  SKILL_PICKER_SIZE,
  skillPickerPanelBounds,
  skillPickerSpecialActionBounds,
} from './skill-picker-render-contract.ts'

const ASSET_ROOT = new URL('../../assets/game/', import.meta.url)
const skillPickerCss = readFileSync(new URL('../skill-picker.css', import.meta.url), 'utf8')

test('the picker keeps the sealed 1600x900 stock card geometry and records', () => {
  assert.deepEqual(SKILL_PICKER_SIZE, { height: 900, width: 1600 })
  assert.deepEqual(SKILL_PICKER_CARD_CENTERS[3], [600, 800, 1000])
  assert.deepEqual(SKILL_PICKER_CARD_CENTERS[4], [500, 700, 900, 1100])
  assert.deepEqual(SKILL_PICKER_CARD_FRAME, { height: 88, width: 87, y: 382.5 })
  assert.deepEqual(SKILL_PICKER_ICON_ANCHOR_OFFSET, { x: 4, y: 4 })
  assert.deepEqual(SKILL_PICKER_ICON_INTER_DRAW_OFFSET, { x: -4, y: -4 })
  assert.deepEqual(SKILL_PICKER_CARD_RECORDS, [0, 13, 164, 5])
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
  assert.deepEqual(nativeAssets.atlases.Skills.records['81'].logicalSize, [38, 46])
  assert.deepEqual(nativeAssets.atlases.Skills.records['90'].logicalSize, [44, 24])
  assert.deepEqual(
    NATIVE_WELD_BUILDS.map(({ skillsAtlasIconRecord }) => skillsAtlasIconRecord),
    [81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
  )
})

test('the picker owns the interactive plane above a live gameplay stage', () => {
  assert.match(
    skillPickerCss,
    /\.main-menu-native-stage\.skill-picker-stage\s*\{[^}]*z-index:\s*80;[^}]*pointer-events:\s*auto;/s,
  )
})

function pngDimensions(name: string): readonly [number, number] {
  const contents = readFileSync(new URL(name, ASSET_ROOT))
  assert.equal(contents.subarray(1, 4).toString('ascii'), 'PNG')
  return [contents.readUInt32BE(16), contents.readUInt32BE(20)]
}
