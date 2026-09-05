import { layoutNativeUiText, nativeUiGlyphInkBounds } from './native-ui/core.ts'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { nativeSkillColorRoot } from './core-kernels/player-progression.ts'
import {
  HALL_BOX,
  HALL_CHEVRON_SIZE,
  HALL_EXPANDED_HEIGHT,
  HALL_RECORDS,
  HALL_ROW_HEIGHT,
  HALL_SCROLL_EASE_TICKS,
  hallAtlasRecord,
  hallChevronPlacement,
  hallCurrentFrameAlpha,
  hallCurrentRowScrollTarget,
  hallHighlightFillAlpha,
  hallNineSliceLayout,
  hallPerkIconRecord,
  hallPulse,
  hallRowLayout,
  hallRowTops,
  hallScrollEase,
  hallScrollExtent,
  hallSeparatorHalves,
  hallSkillIconRecord,
  hallTileOffset,
  hallVisibleRowRange,
  layoutHallText,
  measureHallText,
} from './hall-of-fame-presentation.ts'
import {
  SKILL_PICKER_ROOT_TINTS,
  skillPickerRootTint,
} from './renderer/skill-picker-render-contract.ts'

const RANK_WIDTH = 24
const AWESOMENESS_WIDTH = 120

describe('hall of fame row layout (HallOfFameBox::Render 0x005A2C80)', () => {
  it('places the collapsed row anchors from the native pen', () => {
    const layout = hallRowLayout(80, false, RANK_WIDTH, AWESOMENESS_WIDTH)
    assert.equal(layout.height, HALL_ROW_HEIGHT)
    assert.equal(layout.expanded, null)
    assert.deepEqual(layout.highlight, { height: 240, left: 50, top: 55, width: 1100 })
    assert.deepEqual(layout.rank, { align: 'center', font: 'heading', x: 540, y: 155 })
    assert.deepEqual(layout.ornament, { x: 540 - RANK_WIDTH / 2 - 11, y: 144.5 })
    assert.deepEqual(layout.wizard, { x: 600, y: 168 })
    assert.deepEqual(layout.name, { align: 'center', font: 'menu', x: 600, y: 220 })
    assert.deepEqual(layout.level, { align: 'center', font: 'medium', x: 600, y: 235 })
    assert.deepEqual(layout.awesomeness, { align: 'center', font: 'medium', x: 600, y: 250 })
    assert.deepEqual(layout.chevron, { rotation: 90, x: 600 - AWESOMENESS_WIDTH / 2 - 25, y: 235 })
    assert.equal(layout.separatorY, 280)
  })

  it('opens the expanded block 190 px under the row top with the native cascade', () => {
    const layout = hallRowLayout(80, true, RANK_WIDTH, AWESOMENESS_WIDTH)
    assert.equal(layout.height, HALL_ROW_HEIGHT + HALL_EXPANDED_HEIGHT)
    assert.equal(layout.highlight.height, 390)
    assert.equal(layout.separatorY, 430)
    // The 180° state sits one pixel lower than the 90° state (measured, see ledger).
    assert.deepEqual(layout.chevron, { rotation: 180, x: 600 - AWESOMENESS_WIDTH / 2 - 25, y: 236 })
    const expanded = layout.expanded
    assert.ok(expanded)
    assert.equal(expanded.top, 270)
    assert.deepEqual(expanded.survival, { align: 'left', font: 'medium', x: 90, y: 270 })
    assert.deepEqual(expanded.timeLabel, { align: 'left', font: 'medium', x: 121, y: 290 })
    assert.deepEqual(expanded.timeValue, { align: 'left', font: 'medium', x: 170, y: 290 })
    assert.deepEqual(expanded.waveLabel, { align: 'left', font: 'medium', x: 110, y: 305 })
    assert.deepEqual(expanded.waveValue, { align: 'left', font: 'medium', x: 170, y: 305 })
    assert.deepEqual(expanded.highestSkills, { align: 'left', font: 'medium', x: 90, y: 340 })
    assert.deepEqual(expanded.skillCells.map((cell) => cell.center), [
      { x: 120, y: 378 }, { x: 180, y: 378 }, { x: 240, y: 378 },
    ])
    assert.deepEqual(expanded.skillCells[0]!.numeral, { align: 'right', font: 'body', x: 143, y: 400 })
    assert.deepEqual(expanded.skillCells[0]!.badge(10), { height: 15, left: 132, top: 389, width: 13 })
    assert.deepEqual(expanded.perksUsed, { align: 'right', font: 'medium', x: 1110, y: 270 })
    assert.equal(expanded.perkCenters.length, 9)
    assert.deepEqual(expanded.perkCenters[0], { x: 1006, y: 303 })
    assert.deepEqual(expanded.perkCenters[4], { x: 1048, y: 345 })
    assert.deepEqual(expanded.perkCenters[8], { x: 1090, y: 387 })
    assert.deepEqual(expanded.monstersKilled, { align: 'center', font: 'medium', x: 625, y: 328 })
    assert.deepEqual(expanded.awesomestLabel, { align: 'center', font: 'medium', x: 625, y: 348 })
    assert.deepEqual(expanded.awesomestKill, { align: 'center', font: 'menu', x: 625, y: 368 })
    assert.deepEqual(expanded.killsFrame, { height: 90, left: 475, top: 298, width: 300 })
  })

  it('stacks rows from y=80 and measures the content', () => {
    const { contentHeight, tops } = hallRowTops([false, true, false])
    assert.deepEqual(tops, [80, 330, 730])
    assert.equal(contentHeight, 980)
    assert.equal(hallScrollExtent(contentHeight), 285)
    assert.equal(hallScrollExtent(100), 0)
  })

  it('splits the separator into two fading halves around the box centre', () => {
    assert.deepEqual(hallSeparatorHalves(280), [
      { height: 2, left: 150, top: 279, width: 450 },
      { height: 2, left: 600, top: 279, width: 450 },
    ])
  })

  it('virtualises rows around the visible window', () => {
    const flags = Array.from({ length: 100 }, () => false)
    const { tops } = hallRowTops(flags)
    assert.deepEqual(hallVisibleRowRange(tops, flags, 0), { end: 4, start: 0 })
    const middle = hallVisibleRowRange(tops, flags, 5000)
    assert.ok(middle.start >= 17 && middle.start <= 19, `start ${middle.start}`)
    assert.ok(middle.end >= 23 && middle.end <= 25, `end ${middle.end}`)
    assert.deepEqual(hallVisibleRowRange([], [], 0), { end: 0, start: 0 })
  })
})

describe('hall of fame scroll and pulse (HallOfFameBox tick 0x00589DD0)', () => {
  it('targets the current row a quarter box above the top and clamps to the extent', () => {
    assert.equal(hallCurrentRowScrollTarget(330, 980), 330 - HALL_BOX.height / 4)
    assert.equal(hallCurrentRowScrollTarget(80, 980), 0)
    assert.equal(hallCurrentRowScrollTarget(730, 980), 285)
  })

  it('eases with sin(t deg) over 90 ticks', () => {
    assert.equal(HALL_SCROLL_EASE_TICKS, 90)
    assert.equal(hallScrollEase(0), 0)
    assert.ok(Math.abs(hallScrollEase(30) - 0.5) < 1e-9)
    assert.ok(Math.abs(hallScrollEase(89) - Math.sin(89 * Math.PI / 180)) < 1e-12)
    assert.equal(hallScrollEase(500), hallScrollEase(89))
    assert.equal(hallScrollEase(-5), 0)
  })

  it('pulses at sin(tick * 3deg)', () => {
    assert.ok(Math.abs(hallPulse(30) - 1) < 1e-9)
    assert.ok(Math.abs(hallPulse(90) + 1) < 1e-9)
    assert.ok(Math.abs(hallHighlightFillAlpha(30) - 0.15) < 1e-9)
    assert.ok(Math.abs(hallHighlightFillAlpha(90) - 0.05) < 1e-9)
    assert.ok(Math.abs(hallCurrentFrameAlpha(30) - 0.7) < 1e-9)
    assert.ok(Math.abs(hallCurrentFrameAlpha(90) - 0.3) < 1e-9)
  })

  it('wraps the background tile offset on the 264 px tile', () => {
    assert.equal(hallTileOffset(0), 0)
    assert.equal(hallTileOffset(264), 0)
    assert.equal(hallTileOffset(300), 36)
    assert.equal(hallTileOffset(-10), 254)
  })
})

describe('hall of fame atlas records', () => {
  it('resolves the stock records the row draws', () => {
    assert.deepEqual(hallAtlasRecord('UI', 49).frame, [1, 63, 264, 264])
    assert.deepEqual(hallAtlasRecord('UI', 17).frame, [743, 588, 80, 83])
    assert.deepEqual(hallAtlasRecord('Skills', 164).frame, [584, 383, 57, 57])
    assert.deepEqual(hallAtlasRecord('Inventory', 10).frame, [352, 333, 72, 72])
    assert.equal(hallSkillIconRecord(8), 35)
    assert.equal(hallPerkIconRecord(3), 130)
    assert.throws(() => hallAtlasRecord('UI', 999_999), RangeError)
  })

  it('lays out the nine-slice frame from the glyph corners and 5% edges', () => {
    const pieces = hallNineSliceLayout(80, 83, { height: 240, left: 50, top: 55, width: 1100 })
    assert.equal(pieces.length, 8)
    const corners = pieces.filter((piece) => piece.kind === 'corner')
    // Pieces are rect-relative; HallNineSlice parks the container at rect.left/top.
    assert.deepEqual(corners.map((piece) => [piece.left, piece.top, piece.mirrorX, piece.mirrorY]), [
      [0, 0, false, false],
      [1021, 0, true, false],
      [0, 158, false, true],
      [1021, 158, true, true],
    ])
    const horizontals = pieces.filter((piece) => piece.kind === 'horizontal')
    assert.deepEqual(horizontals.map((piece) => [piece.left, piece.top, piece.width, piece.height]), [
      [80, 0, 940, 83],
      [80, 158, 940, 83],
    ])
    const verticals = pieces.filter((piece) => piece.kind === 'vertical')
    assert.deepEqual(verticals.map((piece) => [piece.left, piece.top, piece.width, piece.height]), [
      [0, 83, 80, 74],
      [1021, 83, 80, 74],
    ])
  })
})

describe('hall of fame skill colours', () => {
  it('resolves the exact native colour root for every renderable skill row', () => {
    const expectedRoots = [
      0, 1, 2, 3, 4, 5, 6, 7,
      ...new Array(8).fill(0),
      ...new Array(8).fill(1),
      ...new Array(8).fill(2),
      ...new Array(8).fill(3),
      ...new Array(8).fill(4),
      ...new Array(8).fill(7),
      ...new Array(8).fill(6),
      ...new Array(8).fill(5),
      2, 1, 0, 4, 3, 7, 6, 5, 0,
    ]
    assert.equal(expectedRoots.length, 81)
    assert.deepEqual(
      Array.from({ length: 81 }, (_, skillId) => nativeSkillColorRoot(skillId)),
      expectedRoots,
    )
    for (const root of expectedRoots) {
      assert.equal(skillPickerRootTint(root), SKILL_PICKER_ROOT_TINTS[root])
    }
    assert.equal(nativeSkillColorRoot(81), null)
    assert.equal(nativeSkillColorRoot(82), null)
    assert.equal(nativeSkillColorRoot(-1), null)
  })
})

describe('hall of fame bitmap text', () => {
  it('measures and aligns the picker fonts with the native truncated pen', () => {
    const width = measureHallText('medium', 'Awesomeness: 100')
    assert.ok(width > 60 && width < 200, `width ${width}`)
    const left = layoutHallText('medium', 'Awesomeness: 100', 'left')
    const center = layoutHallText('medium', 'Awesomeness: 100', 'center')
    const right = layoutHallText('medium', 'Awesomeness: 100', 'right')
    assert.equal(left.width, width)
    assert.equal(left.glyphs.length, center.glyphs.length)
    // Centered pen = trunc(x - width / 2): an even width splits evenly, an odd width
    // lands one pixel further left (ceil), exactly like String_Assign does.
    assert.equal(nativeUiGlyphInkBounds(center.glyphs[0]!).left, nativeUiGlyphInkBounds(left.glyphs[0]!).left - Math.ceil(width / 2))
    assert.equal(nativeUiGlyphInkBounds(right.glyphs[0]!).left, nativeUiGlyphInkBounds(left.glyphs[0]!).left - width)
    for (const placed of [left, center, right]) {
      for (const glyph of placed.glyphs) {
        assert.ok(Number.isInteger(nativeUiGlyphInkBounds(glyph).left) && Number.isInteger(nativeUiGlyphInkBounds(glyph).top), `quad ${nativeUiGlyphInkBounds(glyph).left},${nativeUiGlyphInkBounds(glyph).top}`)
      }
    }
    assert.ok(measureHallText('medium', 'Time:') > 0)
    assert.ok(measureHallText('menu', 'Merlin') > 0)
  })

  it('reproduces the stock glyph anchors measured in the 2026-08-22 captures', () => {
    // Row 1 of 03-hall.png: 'Awesomeness: 91' starts at box x 521, 'Level 3 SEER' at 540.
    const awesomeness = layoutHallText('medium', 'Awesomeness: 91', 'center')
    assert.equal(awesomeness.width, 155)
    assert.equal(600 + nativeUiGlyphInkBounds(awesomeness.glyphs[0]!).left, 521)
    const level = layoutHallText('medium', 'Level 1 SEER', 'center')
    assert.equal(level.width, 118)
    assert.equal(600 + nativeUiGlyphInkBounds(level.glyphs[0]!).left, 540)
  })

  it('knows which characters the picker fonts cannot draw', () => {
    assert.deepEqual(missingGlyphs('medium', '…'), ['…'])
    assert.deepEqual(missingGlyphs('menu', 'abcdefghijklmnopqrstuvwxyz'), [])
    for (const text of [
      'Loading global records...', 'No records yet.', 'The global board could not be read.',
      'SURVIVAL', 'PERKS USED', 'HIGHEST SKILLS', 'Time:', 'Wave:', '1:23:45',
      'Monsters Killed: 0', 'Awesomest Kill:', 'Level 1 SEER', 'Awesomeness: 0',
    ]) {
      assert.deepEqual(missingGlyphs('medium', text), [], text)
    }
    assert.deepEqual(missingGlyphs('heading', '0123456789'), [])
  })

  it('snaps the chevron like the native sprite pass (90° and 180° states)', () => {
    assert.deepEqual(HALL_CHEVRON_SIZE, { height: 20, width: 22 })
    assert.deepEqual(hallAtlasRecord('UI', HALL_RECORDS.ui.chevron).logicalSize, [22, 20])
    // Row 1, 'Awesomeness: 91' (155 px) puts the chevron center at 497.5. The native sprite
    // pass draws fractional, bilinear-soft quads (fitted: 488.25/224.05 collapsed, 487.30/225.85
    // expanded); the web uses the nearest whole-pixel quads x 488..507 / y 224..245 and
    // x 487..508 / y 226..245.
    assert.deepEqual(hallChevronPlacement(497.5, 235, false), { rotation: 90, x: 498, y: 235 })
    assert.deepEqual(hallChevronPlacement(497.5, 235, true), { rotation: 180, x: 498, y: 236 })
  })

  it('lays out the heading font per uppercase glyph', () => {
    const single = layoutHallText('heading', '1', 'center')
    assert.equal(single.glyphs.length, 1)
    assert.ok(single.width > 0)
    assert.ok(measureHallText('heading', '12') > measureHallText('heading', '1'))
  })
})

function missingGlyphs(font: 'body' | 'heading' | 'medium' | 'menu', text: string): string[] {
  return layoutNativeUiText({ font, text, x: 0, y: 0 }).unsupportedCodePoints.map(code => String.fromCodePoint(code))
}
