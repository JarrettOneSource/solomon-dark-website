import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CREATE_WIZARD_NAME_FONT,
  CREATE_WIZARD_NAME_MAX_WIDTH,
  CREATE_WIZARD_NAME_VALUE_BOUNDS,
  STOCK_WIZARD_NAMES,
  initialCreateWizardName,
  initialCreateWizardNameForSession,
  layoutCreateWizardName,
  measureCreateWizardName,
  randomStockWizardName,
  validateCreateWizardName,
} from './create-wizard-name.ts'

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
    reason: 'Use letters, numbers, or ! , . / : ? only.',
  })
  assert.equal(initialCreateWizardName('Account-Smoke_7'), 'AccountSmok')
  assert.equal(initialCreateWizardName('___'), 'Helvidius')
})

test('wizard-name input uses the native measured-width boundary', () => {
  assert.equal(CREATE_WIZARD_NAME_MAX_WIDTH, 372)
  assert.equal(measureCreateWizardName('HELVIDIUS'), 243)
  assert.equal(measureCreateWizardName('A'.repeat(11)), 363)
  assert.equal(measureCreateWizardName('A'.repeat(12)), 396)
  assert.deepEqual(validateCreateWizardName('A'.repeat(11)), {
    ok: true,
    value: 'A'.repeat(11),
  })
  assert.deepEqual(validateCreateWizardName('A'.repeat(12)), {
    ok: false,
    reason: 'Wizard name is too wide.',
  })
  assert.equal(initialCreateWizardName('A'.repeat(64)), 'A'.repeat(11))
  assert.ok(STOCK_WIZARD_NAMES.every((name) => validateCreateWizardName(name).ok))
})

test('stock wizard-name membership is complete and random selection is bounded', () => {
  assert.equal(STOCK_WIZARD_NAMES.length, 273)
  assert.equal(STOCK_WIZARD_NAMES[0], 'Abodius')
  assert.equal(STOCK_WIZARD_NAMES.at(-1), 'Magnificus')
  assert.equal(STOCK_WIZARD_NAMES.includes('Reaper'), false)
  assert.equal(randomStockWizardName(() => 0), 'Abodius')
  assert.equal(randomStockWizardName(() => 0.999999), 'Magnificus')
  assert.equal(initialCreateWizardNameForSession('', () => 0.5), STOCK_WIZARD_NAMES[136])
  assert.equal(initialCreateWizardNameForSession('Account-Smoke_7', () => 0), 'AccountSmok')
})
