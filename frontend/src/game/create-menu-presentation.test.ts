import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  CREATE_HAND_CENTERS,
  CREATE_HAND_SIZE,
} from './renderer/create-menu-render-contract.ts'
import {
  CREATE_WIZARD_NAME_FONT,
  CREATE_WIZARD_NAME_VALUE_BOUNDS,
  initialCreateWizardName,
  layoutCreateWizardName,
  validateCreateWizardName,
} from './create-wizard-name.ts'

const renderer = readFileSync(
  new URL('./renderer/create-menu-renderer.ts', import.meta.url),
  'utf8',
)
const createScene = readFileSync(new URL('./CreateMenuScene.tsx', import.meta.url), 'utf8')
const mainScene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')

test('closed right hand keeps its recovered center and mirrored, unrotated registration', () => {
  assert.deepEqual(CREATE_HAND_CENTERS.right, { x: 1200, y: 560 })
  assert.deepEqual(CREATE_HAND_SIZE, { height: 703.5, width: 630 })
  assert.match(renderer, /handSprite\(texture\(createMenu\.handFist\), true\)/)
  assert.match(renderer, /\(flipped \? -1 : 1\)/)
  assert.doesNotMatch(renderer, /rightHand\.rotation/)
})

test('wizard-name editing keeps native bitmap pixels and reaches the first player configuration', () => {
  assert.match(createScene, /<input/)
  assert.match(createScene, /onDisplayNameChange/)
  assert.match(renderer, /layoutCreateWizardName/)
  assert.match(renderer, /texture\(hub\.hud\.fontAtlas\)/)
  assert.doesNotMatch(renderer, /texture\(createMenu\.textName\)/)
  assert.match(mainScene, /displayName: selectedDisplayName/)
  assert.match(createScene, /readOnly=\{Boolean\(retainedLoadout\)\}/)
})

test('wizard-name layout drains the native group-4 glyph and kerning membership', () => {
  assert.equal(CREATE_WIZARD_NAME_FONT.group, 4)
  assert.equal(CREATE_WIZARD_NAME_FONT.glyphCount, 42)
  assert.equal(CREATE_WIZARD_NAME_FONT.kerningCount, 132)
  assert.deepEqual(Object.keys(CREATE_WIZARD_NAME_FONT.glyphs).join(''), '0123456789!,./:?ABCDEFGHIJKLMNOPQRSTUVWXYZ')

  const layout = layoutCreateWizardName('helvidius')
  assert.equal(layout.value, 'HELVIDIUS')
  assert.equal(layout.width, 240)
  assert.equal(layout.height, 31)
  assert.equal(layout.left, 122)
  assert.equal(layout.top, 19)
  assert.equal(layout.right, 362)
  assert.equal(layout.glyphs.map((glyph) => glyph.char).join(''), 'HELVIDIUS')
  assert.deepEqual(CREATE_WIZARD_NAME_VALUE_BOUNDS, {
    height: 49,
    left: 50,
    top: 12,
    width: 384,
  })
  assert.deepEqual(validateCreateWizardName('SolonSolus'), {
    ok: true,
    value: 'SolonSolus',
  })
  assert.deepEqual(validateCreateWizardName('Solon-Solus'), {
    ok: false,
    reason: 'Use only the characters available in the native wizard-name face.',
  })
  assert.equal(initialCreateWizardName('Account-Smoke_7'), 'AccountSmoke7')
  assert.equal(initialCreateWizardName('___'), 'Helvidius')
})
