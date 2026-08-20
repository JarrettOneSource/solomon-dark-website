import assert from 'node:assert/strict'
import test from 'node:test'

import {
  layoutTitleBuildRevisionLabel,
  titleBuildRevision,
} from './title-build-revision.ts'

const REVISION = 'd278ff882260ee0acb916743d3dec4d352945d99'

test('formats the exact build revision for the native title slot', () => {
  assert.deepEqual(titleBuildRevision(REVISION.toUpperCase()), {
    full: REVISION,
    label: 'BUILD D278FF88',
    short: 'D278FF88',
  })
})

test('identifies direct module execution as a local build', () => {
  assert.deepEqual(titleBuildRevision(undefined), {
    full: null,
    label: 'LOCAL BUILD',
    short: null,
  })
  assert.throws(
    () => titleBuildRevision('d278ff88'),
    /full 40-character Git commit ID/,
  )
})

test('fits the build label into the stock top-right version slot', () => {
  const layout = layoutTitleBuildRevisionLabel('BUILD D278FF88')
  const widestLayout = layoutTitleBuildRevisionLabel('BUILD AAAAAAAA')

  assert.equal(layout.advance, 95)
  assert.equal(layout.left, 0)
  assert.equal(layout.right, 96)
  assert.equal(layout.top, -8)
  assert.equal(layout.bottom, 2)
  assert.equal(layout.glyphs.map((glyph) => glyph.char).join(''), 'BUILDD278FF88')
  assert.equal(widestLayout.right - widestLayout.left, 103)
  assert.ok(widestLayout.right - widestLayout.left <= 104)
})
