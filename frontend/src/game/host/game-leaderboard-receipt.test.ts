import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import { createGameLeaderboardReceipt } from './game-leaderboard-receipt.ts'

const SECRET = 'leaderboard-receipt-test-secret-that-is-long-enough'

test('authoritative leaderboard receipt seals the admitted account and completed row', () => {
  const receipt = createGameLeaderboardReceipt(SECRET, 42, {
    accountUsername: null,
    awesomeness: 91,
    awesomestKill: 'Skeleton',
    completedAtUtc: '2026-08-21T12:34:56.000Z',
    discipline: 'arcane',
    elapsedTicks: 33_950,
    element: 'ether',
    headingIndex: 4,
    highestSkills: [{ rank: 2, skillId: 7 }, { rank: 1, skillId: 11 }],
    level: 1,
    monstersKilled: 17,
    perksUsed: [3, 8],
    portraitScale: 0.925,
    runId: 'leaderboard-run-a',
    wave: 1,
    wizardName: 'Volusius',
  })
  const [payloadPart, signaturePart, extra] = receipt.split('.')
  assert.equal(extra, undefined)
  assert.ok(payloadPart)
  assert.ok(signaturePart)
  assert.deepEqual(
    JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')),
    {
      version: 1,
      userId: 42,
      runId: 'leaderboard-run-a',
      wizardName: 'Volusius',
      element: 'ether',
      discipline: 'arcane',
      headingIndex: 4,
      portraitScale: 0.925,
      level: 1,
      awesomeness: 91,
      elapsedTicks: 33_950,
      wave: 1,
      monstersKilled: 17,
      awesomestKill: 'Skeleton',
      highestSkills: [{ skillId: 7, rank: 2 }, { skillId: 11, rank: 1 }],
      perksUsed: [3, 8],
      completedAtUtc: '2026-08-21T12:34:56.000Z',
    },
  )
  assert.equal(
    signaturePart,
    createHmac('sha256', SECRET)
      .update(`solomon-dark-leaderboard-v1.${payloadPart}`)
      .digest('base64url'),
  )
})

test('authoritative leaderboard receipt rejects an invalid account or secret', () => {
  const entry = {
    accountUsername: null,
    awesomeness: 0,
    awesomestKill: null,
    completedAtUtc: '2026-08-21T12:34:56.000Z',
    discipline: 'body',
    elapsedTicks: 0,
    element: 'air',
    headingIndex: 0,
    highestSkills: [],
    level: 1,
    monstersKilled: 0,
    perksUsed: [],
    portraitScale: 0.85,
    runId: 'run',
    wave: 0,
    wizardName: 'Test',
  } as const
  assert.throws(() => createGameLeaderboardReceipt('', 1, entry), /secret/)
  assert.throws(() => createGameLeaderboardReceipt(SECRET, 0, entry), /user id/)
  assert.throws(() => createGameLeaderboardReceipt(SECRET, 1.5, entry), /user id/)
})
