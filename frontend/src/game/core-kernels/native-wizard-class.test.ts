import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_WIZARD_CLASS_TITLES,
  nativeWizardClassTitle,
  wizardClassDisplayTitle,
} from './native-wizard-class.ts'

test('drains the complete retail five-element by three-discipline class-title table', () => {
  assert.deepEqual(NATIVE_WIZARD_CLASS_TITLES, {
    ether: { body: 'SAGE', mind: 'SEER', arcane: 'OCCULTIST' },
    fire: { body: 'WARLOCK', mind: 'PYROMANCER', arcane: 'FIRE MAGE' },
    air: { body: 'STORMCALLER', mind: 'ASTROLOGER', arcane: 'STORM MAGE' },
    water: { body: 'ICEBINDER', mind: 'THAUMATURGE', arcane: 'FROST MAGE' },
    earth: { body: 'RITUALIST', mind: 'CHANNELER', arcane: 'EARTH MAGE' },
  })
  assert.equal(nativeWizardClassTitle('air', 'arcane'), 'STORM MAGE')
  assert.equal(nativeWizardClassTitle('ether', 'body'), 'SAGE')
  assert.equal(wizardClassDisplayTitle('earth', 'arcane'), 'Earth Mage')
})
