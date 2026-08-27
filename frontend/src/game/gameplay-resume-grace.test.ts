import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  gameplayResumeGraceReasonForPauseSource,
  gameplayResumeGraceSeconds,
} from './gameplay-resume-grace.ts'

test('projects every gameplay surface into its complete grace reason family', () => {
  assert.deepEqual([
    gameplayResumeGraceReasonForPauseSource('pause-menu'),
    gameplayResumeGraceReasonForPauseSource('inventory'),
    gameplayResumeGraceReasonForPauseSource('skill-book'),
    gameplayResumeGraceReasonForPauseSource('skill-selector'),
  ], [
    'pause-menu-closed',
    'inventory-closed',
    'skill-book-closed',
    'skill-selector-closed',
  ])
})

test('presents exactly 3, 2, 1 without claiming authority over expiry', () => {
  const grace = {
    reason: 'pause-menu-closed',
    remainingMs: 3_000,
    sequence: 7,
  } as const
  assert.equal(gameplayResumeGraceSeconds(grace, 0), 3)
  assert.equal(gameplayResumeGraceSeconds(grace, 999), 3)
  assert.equal(gameplayResumeGraceSeconds(grace, 1_000), 2)
  assert.equal(gameplayResumeGraceSeconds(grace, 1_999), 2)
  assert.equal(gameplayResumeGraceSeconds(grace, 2_000), 1)
  assert.equal(gameplayResumeGraceSeconds(grace, 3_000), 1)
  assert.equal(gameplayResumeGraceSeconds({ ...grace, remainingMs: null }, 0), null)
})

test('presents pending mutual readiness before the authoritative countdown', () => {
  const component = readFileSync(
    new URL('./GameplayResumeCountdown.tsx', import.meta.url),
    'utf8',
  )
  assert.match(component, /Waiting on players \.\.\./)
  assert.match(component, /data-gameplay-resume-grace-phase=/)
  assert.match(component, /seconds === null \? 'waiting' : 'countdown'/)
  assert.doesNotMatch(component, /if \(seconds === null\) return null/)
})
