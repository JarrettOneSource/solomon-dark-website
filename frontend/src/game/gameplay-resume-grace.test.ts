import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  gameplayResumeGraceReasonForPauseSource,
  gameplayResumeGraceProgress,
} from './gameplay-resume-grace.ts'
import { GAMEPLAY_RESUME_GRACE_DURATION_MS } from './protocol/game-protocol.ts'

test('projects grace only for gameplay surfaces that need reorientation', () => {
  assert.deepEqual([
    gameplayResumeGraceReasonForPauseSource('pause-menu'),
    gameplayResumeGraceReasonForPauseSource('inventory'),
    gameplayResumeGraceReasonForPauseSource('skill-book'),
    gameplayResumeGraceReasonForPauseSource('skill-selector'),
  ], [
    'pause-menu-closed',
    'inventory-closed',
    'skill-book-closed',
    null,
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

  const mainMenu = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
  assert.match(
    mainMenu,
    /gameplayResumeGrace\s*&&\s*gameplayResumeGrace\.reason !== 'skill-picker-closed'/,
  )
})

test('bot level-up completion can unblock an older hold but never creates a picker hold', () => {
  const host = readFileSync(new URL('./host/game-host.ts', import.meta.url), 'utf8')
  const branch = host.match(
    /if \(intent\.kind === 'select-skill'\) \{([\s\S]*?)\n\s*continue\n\s*\}/,
  )?.[1]
  assert.ok(branch)
  assert.match(branch, /maybeStartGameplayResumeGrace\(bot\.playerId\)/)
  assert.doesNotMatch(branch, /beginMultiplayerResumeGrace/)
})

test('mod replacement offers release through the same picker close hold', () => {
  const host = readFileSync(new URL('./host/game-host.ts', import.meta.url), 'utf8')
  assert.match(
    host,
    /if \(closedSkillBarrier\) \{[\s\S]*?beginMultiplayerResumeGrace\(client\.playerId, 'skill-picker-closed'\)/,
  )
})
