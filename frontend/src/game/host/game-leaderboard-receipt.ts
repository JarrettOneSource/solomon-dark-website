import { createHmac } from 'node:crypto'

import type { HallOfFameEntry } from '../core-kernels/hall-of-fame.ts'

const RECEIPT_DOMAIN = 'solomon-dark-leaderboard-v1.'

export function createGameLeaderboardReceipt(
  secret: string,
  userId: number,
  entry: HallOfFameEntry,
): string {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Leaderboard receipt secret must contain at least 32 bytes')
  }
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new Error('Leaderboard receipt user id must be a positive safe integer')
  }
  const payloadPart = Buffer.from(JSON.stringify({
    version: 1,
    userId,
    runId: entry.runId,
    wizardName: entry.wizardName,
    element: entry.element,
    discipline: entry.discipline,
    headingIndex: entry.headingIndex,
    portraitScale: entry.portraitScale,
    level: entry.level,
    awesomeness: entry.awesomeness,
    elapsedTicks: entry.elapsedTicks,
    wave: entry.wave,
    monstersKilled: entry.monstersKilled,
    awesomestKill: entry.awesomestKill,
    highestSkills: entry.highestSkills.map(({ skillId, rank }) => ({ skillId, rank })),
    perksUsed: [...entry.perksUsed],
    completedAtUtc: entry.completedAtUtc,
  }), 'utf8').toString('base64url')
  const signature = createHmac('sha256', secret)
    .update(`${RECEIPT_DOMAIN}${payloadPart}`)
    .digest('base64url')
  return `${payloadPart}.${signature}`
}
