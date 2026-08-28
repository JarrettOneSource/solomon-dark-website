import assert from 'node:assert/strict'
import test from 'node:test'

import { gameAccountPresentation } from './game-account.ts'

test('game account presentation names anonymous play explicitly', () => {
  assert.deepEqual(gameAccountPresentation(null), {
    accessibleLabel: 'Not logged in',
    username: 'Not logged in',
  })
})

test('game account presentation preserves the exact Website username', () => {
  assert.deepEqual(gameAccountPresentation('Account-Smoke_7'), {
    accessibleLabel: 'Signed in as Account-Smoke_7',
    username: 'Account-Smoke_7',
  })
})
