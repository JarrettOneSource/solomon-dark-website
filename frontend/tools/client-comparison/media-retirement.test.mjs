import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewPixiRetirements } from './media-retirement.mjs'

const failure = { type: 'requestfailed', requestId: 1, url: 'https://game.test/assets/combat.mp3',
  method: 'GET', resourceType: 'media', failure: { errorText: 'net::ERR_ABORTED' } }
function evidence() {
  const before = { documentId: 10, channels: [{ src: failure.url, url: failure.url,
    ready: 4, network: 1, error: null, retired: false, connected: false, loads: 1, preload: 'auto' }] }
  return { mediaFailures: [{ failure, status: 206, retirement: {
    kind: 'document-replacement', completed: true, pendingRequest: true,
    beforeTargetId: 10, afterTargetId: 20, before,
    pendingRequests: [{ ...failure, status: 206, before }],
  } }] }
}
test('attributes an exact loaded request to its observed document replacement', () => {
  const review = reviewPixiRetirements([failure], [evidence()])
  assert.equal(review.expected.length, 1)
  assert.deepEqual(review.unexpected, [])
})
test('keeps incomplete retirement, unloaded audio and a different request as errors', () => {
  for (const damage of [
    row => { row.retirement.completed = false },
    row => { row.retirement.pendingRequest = false },
    row => { row.retirement.afterTargetId = 10 },
    row => { row.retirement.before.channels[0].ready = 1 },
    row => { row.retirement.before.channels[0].error = 3 },
    row => { row.retirement.pendingRequests[0].requestId = 2 },
    row => { row.retirement.pendingRequests[0].status = 500 },
  ]) {
    const report = evidence(); damage(report.mediaFailures[0])
    assert.deepEqual(reviewPixiRetirements([failure], [report]).unexpected, [failure])
  }
  const other = { ...failure, requestId: 2 }
  assert.deepEqual(reviewPixiRetirements([other], [evidence()]).unexpected, [other])
})
