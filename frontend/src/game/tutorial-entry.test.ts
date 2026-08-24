import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldOfferStockTutorial } from './tutorial-entry.ts'

test('offers the stock tutorial only after the selected save adapter confirms absence', () => {
  assert.equal(shouldOfferStockTutorial('missing'), true)
  assert.equal(shouldOfferStockTutorial('loading'), false)
  assert.equal(shouldOfferStockTutorial('present'), false)
  assert.equal(shouldOfferStockTutorial('unavailable'), false)
})
