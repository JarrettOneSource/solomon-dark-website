import assert from 'node:assert/strict'
import test from 'node:test'

import { NATIVE_UI_FONT_NAMES, nativeUiFont } from './native-ui-catalog.ts'
import { layoutNativeUiText, layoutNativeUiTextRuns, measureNativeUiText, nativeUiGlyphInkBounds, wrapNativeUiMsgBoxText, wrapNativeUiText, wrapNativeUiTextRuns } from './native-ui-text.ts'

test('flow text centers the visible ControlPanel glyph inside its line box', () => {
  const layout = layoutNativeUiText({
    align: 'left',
    font: 'control-panel',
    placement: 'box',
    text: 'A',
    x: 0,
    y: 0,
  })
  assert.equal(layout.height, 14)
  assert.equal(layout.width, 9)
  assert.deepEqual(nativeUiGlyphInkBounds(layout.glyphs[0]!), {
    height: 12,
    left: -1,
    top: 1,
    width: 11,
  })
})

test('every native glyph fits its flow box without changing horizontal geometry', () => {
  let count = 0
  for (const font of NATIVE_UI_FONT_NAMES) {
    for (const codePoint of Object.keys(nativeUiFont(font).glyphs)) {
      const spec = { align: 'left' as const, font, text: String.fromCodePoint(Number(codePoint)), x: 10, y: 20 }
      const baseline = layoutNativeUiText(spec)
      const box = layoutNativeUiText({ ...spec, placement: 'box' })
      const ink = nativeUiGlyphInkBounds(box.glyphs[0]!)
      assert.equal(box.width, baseline.width)
      assert.equal(box.glyphs[0]!.centerX, baseline.glyphs[0]!.centerX)
      assert.ok(ink.top >= 20, `${font} ${codePoint} above box`)
      assert.ok(ink.top + ink.height <= 20 + box.height, `${font} ${codePoint} below box`)
      assert.equal(ink.top + ink.height / 2, 20 + box.height / 2)
      count += 1
    }
  }
  assert.equal(count, 718)
})

test('flow paragraphs keep their authored line pitch and explicit blank lines', () => {
  const layout = layoutNativeUiText({ font: 'menu', lineHeight: 25, placement: 'box', text: 'A\n\nV', x: 0, y: 10 })
  assert.deepEqual(layout.lines.map(line => line.text), ['A', '', 'V'])
  assert.equal(layout.lines[1]!.baselineY - layout.lines[0]!.baselineY, 25)
  assert.equal(layout.lines[2]!.baselineY - layout.lines[1]!.baselineY, 25)
  const empty = layoutNativeUiText({ font: 'medium', placement: 'box', text: ' ☃', x: 0, y: 0 })
  assert.equal(empty.glyphs.length, 0)
  assert.equal(empty.width, 4)
  assert.equal(empty.height, 16)
  assert.deepEqual(empty.unsupportedCodePoints, [9731])
})

test('leading and trailing blank lines occupy their own flow slots', () => {
  const spec = { font: 'menu' as const, placement: 'box' as const, x: 0, y: 0 }
  const trailing = layoutNativeUiText({ ...spec, text: 'A\n' })
  const leading = layoutNativeUiText({ ...spec, text: '\nA' })
  assert.equal(trailing.height, 48)
  assert.equal(leading.height, 48)
  assert.equal(nativeUiGlyphInkBounds(trailing.glyphs[0]!).top, 3)
  assert.equal(nativeUiGlyphInkBounds(leading.glyphs[0]!).top, 27)
})

test('styled runs retain native kerning across emphasis boundaries', () => {
  const layout = layoutNativeUiTextRuns({ font: 'menu', runs: [{ text: 'A' }, { italic: true, text: 'V' }], tint: 0xd9ba70, x: 10, y: 20 })
  assert.equal(layout.width, 37)
  assert.deepEqual(layout.glyphs.map(glyph => ({ x: glyph.centerX, italic: glyph.italic, tint: glyph.tint })), [
    { x: 20, italic: false, tint: 0xd9ba70 },
    { x: 37, italic: true, tint: 0xd9ba70 },
  ])
})

test('run scale, advance and offsets have distinct native ownership', () => {
  const layout = layoutNativeUiTextRuns({
    font: 'menu', x: 10, y: 20,
    runs: [{ text: 'A' }, { advanceScale: 0.5, offsetX: 2, offsetY: 3, scale: 0.75, text: 'A' }],
  })
  assert.equal(layout.width, 30)
  assert.equal(layout.glyphs[1]!.centerX, 39.5)
  assert.equal(layout.glyphs[1]!.centerY, 17)
  assert.equal(layout.glyphs[1]!.scale, 0.75)
})

test('dialogue wrapping preserves hard spaces, blank paragraphs and emphasis', () => {
  const lines = wrapNativeUiTextRuns([{ text: 'AV  ' }, { italic: true, text: 'AV\n\nA' }], 'menu', 40)
  assert.deepEqual(lines.map(line => line.map(run => run.text).join('')), ['AV', 'AV', '', 'A'])
  assert.ok(lines[1]!.every(run => run.italic))
  assert.deepEqual(wrapNativeUiTextRuns([{ text: 'A  V' }], 'menu', 100).map(line => line.map(run => run.text).join('')), ['A  V'])
})

test('native text rejects invalid geometry and alpha at the public layout boundary', () => {
  assert.throws(() => wrapNativeUiText('A', 'menu', -1), /max width must be nonnegative/)
  for (const scale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => measureNativeUiText('A', 'menu', scale), /scale must be positive/)
    assert.throws(() => layoutNativeUiText({ font: 'menu', scale, text: 'A', x: 0, y: 0 }), /scale must be positive/)
  }
  for (const alpha of [-0.1, 1.1, Number.NaN]) {
    assert.throws(() => layoutNativeUiText({ alpha, font: 'menu', text: 'A', x: 0, y: 0 }), /alpha must be within/)
  }
  for (const width of [-1, Number.POSITIVE_INFINITY, Number.NaN]) {
    assert.throws(() => wrapNativeUiMsgBoxText('A', 'menu', width), /finite and nonnegative/)
  }
})

test('right-aligned native text ends its advance at the requested anchor', () => {
  const layout = layoutNativeUiText({ align: 'right', font: 'menu', text: 'AV', x: 100, y: 30 })
  assert.equal(layout.width, 37)
  assert.equal(layout.lines[0]!.x, 63)
  assert.equal(layout.lines[0]!.baselineY, 30)
})

test('unsupported characters are sorted and contribute no pen advance in any text path', () => {
  assert.equal(measureNativeUiText('☃☂', 'menu'), 0)
  const ordinary = layoutNativeUiText({ font: 'menu', text: 'A☃V☂', x: 0, y: 0 })
  const styled = layoutNativeUiTextRuns({ font: 'menu', runs: [{ text: 'A☃' }, { text: 'V☂', italic: true }], x: 0, y: 0 })
  assert.deepEqual(ordinary.unsupportedCodePoints, [9730, 9731])
  assert.deepEqual(styled.unsupportedCodePoints, [9730, 9731])
  assert.equal(ordinary.width, 39)
  assert.equal(styled.width, 39)
})

test('MsgBox removes the remaining spaces after its native wrap replaces a space', () => {
  assert.deepEqual(wrapNativeUiMsgBoxText('AV   AV', 'menu', 50), ['AV', 'AV'])
})

test('native baseline text keeps the authored pen and trimmed ink unchanged', () => {
  const layout = layoutNativeUiText({
    align: 'left',
    font: 'control-panel',
    text: 'A',
    x: 0,
    y: 7,
  })
  assert.equal(layout.lines[0]!.baselineY, 7)
  assert.deepEqual(nativeUiGlyphInkBounds(layout.glyphs[0]!), {
    height: 12,
    left: -1,
    top: -4,
    width: 11,
  })
})
