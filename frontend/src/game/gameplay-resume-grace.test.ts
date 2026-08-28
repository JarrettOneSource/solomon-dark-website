import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  gameplayResumeGraceReasonForPauseSource,
  gameplayResumeGraceProgress,
} from './gameplay-resume-grace.ts'
import { GAMEPLAY_RESUME_GRACE_DURATION_MS } from './protocol/game-protocol.ts'

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

test('projects the two-second authority remainder into monotonic progress', () => {
  const grace = {
    reason: 'pause-menu-closed',
    remainingMs: 2_000,
    sequence: 7,
  } as const
  assert.equal(GAMEPLAY_RESUME_GRACE_DURATION_MS, 2_000)
  assert.equal(gameplayResumeGraceProgress(grace, -1), 0)
  assert.equal(gameplayResumeGraceProgress(grace, 0), 0)
  assert.equal(gameplayResumeGraceProgress(grace, 500), 0.25)
  assert.equal(gameplayResumeGraceProgress(grace, 1_000), 0.5)
  assert.equal(gameplayResumeGraceProgress(grace, 1_500), 0.75)
  assert.equal(gameplayResumeGraceProgress(grace, 2_000), 1)
  assert.equal(gameplayResumeGraceProgress(grace, 3_000), 1)
  assert.equal(gameplayResumeGraceProgress({ ...grace, remainingMs: 1_250 }, 0), 0.375)
  assert.equal(gameplayResumeGraceProgress({ ...grace, remainingMs: null }, 0), null)
})

test('presents pending mutual readiness before the authoritative progress bar', () => {
  const component = readFileSync(
    new URL('./GameplayResumeProgress.tsx', import.meta.url),
    'utf8',
  )
  assert.match(component, /Waiting on players \.\.\./)
  assert.match(component, /Waiting for players to rejoin/)
  assert.match(component, /data-gameplay-resume-grace-phase=/)
  assert.match(component, /progress === null \? 'waiting' : 'progress'/)
  assert.match(component, /role="progressbar"/)
  assert.match(component, /aria-valuenow=\{Math\.round\(progress \* 100\)\}/)
  assert.match(component, /RESUMING\.\.\./)
  assert.doesNotMatch(component, /RESUMING IN|gameplay-resume-countdown|seconds/)
})
