import assert from 'node:assert/strict'
import test from 'node:test'

import { completePartyCode, normalizePartyCode } from './party-join.ts'

test('Party ID normalization accepts mobile paste labels and reinserts one hyphen', () => {
  assert.equal(normalizePartyCode('kx7m 4qpd '), 'KX7M-4QPD')
  assert.equal(normalizePartyCode('Party ID: KX7M-4QPD'), 'KX7M-4QPD')
  assert.equal(completePartyCode('kx7m4qpd'), true)
  assert.equal(completePartyCode('KX7M'), false)
})
