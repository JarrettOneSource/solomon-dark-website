import assert from 'node:assert/strict'
import test from 'node:test'

import type { SolomonDigState } from './boneyard.ts'
import {
  SOLOMON_VOICE_DURATION_TICKS,
  createSolomonEncounter,
  isSolomonPlayerLocked,
  solomonContactContains,
  stepSolomonEncounter,
} from './boneyard-encounter.ts'

const DIG: SolomonDigState = {
  frameProgram: [0, 3, 1],
  gravePosition: { x: 990, y: 887 },
  lanternPosition: { x: 935, y: 927 },
  position: { x: 1000, y: 1000 },
  ticksPerFrame: 5,
}

const NATIVE_DIG_PROGRAM = [
  0, 0, 0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
  15, 17, 17, 17, 17, 16, 15, 13, 11, 9, 7, 5, 3, 1,
] as const

const NATIVE_DIG: SolomonDigState = {
  ...DIG,
  frameProgram: NATIVE_DIG_PROGRAM,
}

function advanceToSpeaking(
  seed: string,
  players = { player: { position: { x: 1000, y: 990 } } },
) {
  let encounter = createSolomonEncounter(DIG, seed)
  encounter = stepSolomonEncounter(encounter, players)
  for (let tick = 0; encounter.phase === 'turning' && tick < 100; tick += 1) {
    encounter = stepSolomonEncounter(encounter, players)
  }
  assert.equal(encounter.phase, 'speaking')
  return encounter
}

test('Solomon first contact uses the strict native 150 by 125 ellipse', () => {
  const center = { x: 1000, y: 990 }
  assert.equal(solomonContactContains(DIG.position, { x: center.x + 149.999, y: center.y }), true)
  assert.equal(solomonContactContains(DIG.position, { x: center.x + 150, y: center.y }), false)
  assert.equal(solomonContactContains(DIG.position, { x: center.x, y: center.y + 124.999 }), true)
  assert.equal(solomonContactContains(DIG.position, { x: center.x, y: center.y + 125 }), false)
})

test('closest qualifying player is locked and owns one seeded hello event', () => {
  let encounter = createSolomonEncounter(DIG, 'closest-player-seed')
  encounter = stepSolomonEncounter(encounter, {
    farther: { position: { x: 1110, y: 990 } },
    nearest: { position: { x: 1020, y: 990 } },
    outside: { position: { x: 1300, y: 990 } },
  })
  assert.equal(encounter.phase, 'turning')
  assert.equal(encounter.targetPlayerId, 'nearest')
  assert.equal(isSolomonPlayerLocked(encounter, 'nearest'), true)
  assert.equal(isSolomonPlayerLocked(encounter, 'farther'), false)

  for (let tick = 0; encounter.phase === 'turning' && tick < 100; tick += 1) {
    encounter = stepSolomonEncounter(encounter, {
      nearest: { position: { x: 1020, y: 990 } },
    })
  }
  assert.equal(encounter.phase, 'speaking')
  assert.equal(encounter.voiceEvents.length, 1)
  const hello = encounter.voiceEvents[0]
  assert.match(hello.cue, /^solomon-hello-[1-4]$/)
  assert.equal(encounter.voiceTicksRemaining, SOLOMON_VOICE_DURATION_TICKS[hello.cue])
  assert.equal(hello.id, 1)
})

test('contact is armed only in the final ten native dig-program slots', () => {
  const player = { player: { position: { x: 1000, y: 990 } } }
  const closed = stepSolomonEncounter({
    ...createSolomonEncounter(NATIVE_DIG, 'dig-gate-closed'),
    digPhase: 18.8,
  }, player)
  const opened = stepSolomonEncounter({
    ...createSolomonEncounter(NATIVE_DIG, 'dig-gate-open'),
    digPhase: 19,
  }, player)

  assert.equal(closed.digPhase, 19)
  assert.equal(closed.phase, 'digging')
  assert.equal(opened.phase, 'turning')
  assert.equal(opened.digFrame, 17)
})

test('contact frame seeds the three native heading and emergence-offset branches', () => {
  const player = { player: { position: { x: 1000, y: 990 } } }
  const branches = [
    { phase: 19, headingDeg: 270, transitionOffsetY: 0 },
    { phase: 21, headingDeg: 225, transitionOffsetY: 6 },
    { phase: 26, headingDeg: 180, transitionOffsetY: 15 },
  ]
  for (const branch of branches) {
    const encounter = stepSolomonEncounter({
      ...createSolomonEncounter(NATIVE_DIG, `dig-branch-${branch.phase}`),
      digPhase: branch.phase,
    }, player)
    assert.equal(encounter.headingDeg, branch.headingDeg)
    assert.equal(encounter.transitionOffsetY, branch.transitionOffsetY)
  }
})

test('turning accelerates through native one-degree substeps before dialogue', () => {
  let encounter = createSolomonEncounter(DIG, 'turn-acceleration-seed')
  const players = { player: { position: { x: 1000, y: 990 } } }
  encounter = stepSolomonEncounter(encounter, players)

  encounter = stepSolomonEncounter(encounter, players)
  assert.equal(encounter.headingDeg, 179)
  assert.equal(encounter.turnRate, 0.5)
  encounter = stepSolomonEncounter(encounter, players)
  assert.equal(encounter.headingDeg, 178)
  assert.equal(encounter.turnRate, 1)
  encounter = stepSolomonEncounter(encounter, players)
  assert.equal(encounter.headingDeg, 176)
  assert.equal(encounter.turnRate, 1.5)
})

test('turning and speech decay the contact emergence offset by 0.9 per tick', () => {
  const encounter = stepSolomonEncounter({
    ...createSolomonEncounter(DIG, 'transition-offset-seed'),
    headingDeg: 0,
    phase: 'turning',
    targetPlayerId: 'player',
    transitionOffsetY: 15,
  }, {
    player: { position: { x: 1000, y: 990 } },
  })

  assert.equal(encounter.phase, 'speaking')
  assert.equal(encounter.transitionOffsetY, 13.5)
})

test('turning reacquires the nearest remaining player when its target disappears', () => {
  const encounter = stepSolomonEncounter({
    ...createSolomonEncounter(DIG, 'turn-target-reacquire'),
    headingDeg: 180,
    phase: 'turning',
    targetPlayerId: 'departed',
    transitionOffsetY: 6,
  }, {
    farther: { position: { x: 1_100, y: 1_000 } },
    nearest: { position: { x: 1_000, y: 990 } },
  })

  assert.equal(encounter.targetPlayerId, 'nearest')
  assert.notEqual(encounter.headingDeg, 180)
  assert.equal(encounter.transitionOffsetY, 5.4)
})

test('turning clears a departed target until an eligible player can be reacquired', () => {
  const waiting = stepSolomonEncounter({
    ...createSolomonEncounter(DIG, 'turn-target-empty'),
    phase: 'turning',
    targetPlayerId: 'departed',
    transitionOffsetY: 6,
  }, {})
  assert.equal(waiting.targetPlayerId, null)

  const resumed = stepSolomonEncounter(waiting, {
    joined: { position: { x: 1_000, y: 990 } },
  })
  assert.equal(resumed.targetPlayerId, 'joined')
})

test('turning preserves the native raw completion check at the 359-to-zero wrap', () => {
  const encounter = stepSolomonEncounter({
    ...createSolomonEncounter(DIG, 'turn-wrap-seed'),
    headingDeg: 359,
    phase: 'turning',
    targetPlayerId: 'player',
  }, {
    player: { position: { x: 1000, y: 990 } },
  })

  assert.equal(encounter.phase, 'turning')
  assert.equal(encounter.headingDeg, 359)
  assert.equal(encounter.voiceEvents.length, 0)
})

test('turning retains exact 360 degrees before the native raw completion check', () => {
  const encounter = stepSolomonEncounter({
    ...createSolomonEncounter(DIG, 'turn-exact-360-seed'),
    headingDeg: 359,
    phase: 'turning',
    targetPlayerId: 'player',
  }, {
    player: {
      position: {
        x: 1000 + Math.tan(0.5 * Math.PI / 180) * 10,
        y: 990,
      },
    },
  })

  assert.equal(encounter.phase, 'turning')
  assert.equal(encounter.headingDeg, 360)
  assert.equal(encounter.voiceEvents.length, 0)
})

test('active speech changes to a different native mouth pose on the seeded timer', () => {
  const players = { player: { position: { x: 1000, y: 990 } } }
  const speaking = advanceToSpeaking('mouth-pose-seed', players)
  const encounter = stepSolomonEncounter({
    ...speaking,
    mouthPoseTicksRemaining: 1,
    voiceTicksRemaining: 100,
  }, players)

  assert.notEqual(encounter.mouthPose, speaking.mouthPose)
  assert.ok(encounter.mouthPose >= 0 && encounter.mouthPose < 3)
  assert.ok(encounter.mouthPoseTicksRemaining >= 40)
  assert.ok(encounter.mouthPoseTicksRemaining <= 88)
  assert.equal(encounter.mouthPoseTicksRemaining % 2, 0)
})

test('dialogue duration, 25-tick hold, and acceleration fire the run edge in native order', () => {
  const players = { player: { position: { x: 1000, y: 990 } } }
  let encounter = advanceToSpeaking('solomon-hello-duration-seed', players)
  const hello = encounter.voiceEvents[0]
  const speakingTicks = SOLOMON_VOICE_DURATION_TICKS[hello.cue]
  for (let tick = 0; tick < speakingTicks - 1; tick += 1) {
    encounter = stepSolomonEncounter(encounter, players)
    assert.equal(encounter.phase, 'speaking')
  }
  encounter = stepSolomonEncounter(encounter, players)
  assert.equal(encounter.phase, 'retreat-hold')
  assert.equal(encounter.motion, 10)
  assert.equal(isSolomonPlayerLocked(encounter, 'player'), false)

  const retreatStart = { ...encounter.position }
  for (let tick = 0; tick < 53; tick += 1) {
    encounter = stepSolomonEncounter(encounter, players)
    assert.equal(encounter.runEventId, 0)
  }
  const headingBeforeRun = encounter.headingDeg
  const rngBeforeRun = encounter.rngState
  encounter = stepSolomonEncounter(encounter, players)
  assert.equal(encounter.phase, 'escaping')
  assert.equal(encounter.runEventId, 1)
  assert.equal(encounter.acceleration, -3)
  const headingDeflection = (
    (encounter.headingDeg - headingBeforeRun + 540) % 360
  ) - 180
  assert.equal(Math.abs(headingDeflection), 15)
  assert.notEqual(encounter.rngState, rngBeforeRun)
  assert.equal(encounter.voiceEvents[1].cue, 'solomon-laugh-1')
  assert.ok(Math.hypot(
    encounter.position.x - retreatStart.x,
    encounter.position.y - retreatStart.y,
  ) >= 89.999)
})

test('queued get-him-boys starts after the exact laugh sample duration', () => {
  const players = { player: { position: { x: 1000, y: 990 } } }
  let encounter = advanceToSpeaking('taunt-queue-seed', players)
  while (encounter.phase === 'speaking') encounter = stepSolomonEncounter(encounter, players)
  while (encounter.voiceEvents.length < 2) encounter = stepSolomonEncounter(encounter, players)
  for (let tick = 0; tick < SOLOMON_VOICE_DURATION_TICKS['solomon-laugh-1'] - 1; tick += 1) {
    encounter = stepSolomonEncounter(encounter, players)
    assert.equal(encounter.voiceEvents.length, 2)
  }
  encounter = stepSolomonEncounter(encounter, players)
  assert.equal(encounter.voiceEvents[2].cue, 'solomon-get-him-boys')
  assert.equal(encounter.voiceEvents[2].id, 3)
})

test('retreat reversal preserves the native strict 360-degree clamp boundary', () => {
  const atBoundary = stepSolomonEncounter({
    ...createSolomonEncounter(DIG, 'retreat-heading-boundary'),
    headingDeg: 180,
    phase: 'retreat-hold',
    phaseTicksRemaining: 1,
  }, {})
  const pastBoundary = stepSolomonEncounter({
    ...createSolomonEncounter(DIG, 'retreat-heading-past-boundary'),
    headingDeg: 180.001,
    phase: 'retreat-hold',
    phaseTicksRemaining: 1,
  }, {})

  assert.equal(atBoundary.headingDeg, 315)
  assert.equal(pastBoundary.headingDeg, 45)
})

test('escape movement uses current speed while gait uses the incremented speed', () => {
  const source = {
    ...createSolomonEncounter(DIG, 'escape-gait-seed'),
    acceleration: -3,
    escapeSpeed: 2,
    headingDeg: 90,
    lifetimeTicksRemaining: 515,
    phase: 'escaping' as const,
    walkCycle: 0,
  }
  const encounter = stepSolomonEncounter(source, {})

  assert.equal(encounter.position.x, DIG.position.x + 2)
  assert.ok(Math.abs(encounter.position.y - DIG.position.y) < 1e-9)
  assert.equal(encounter.escapeSpeed, 2.05)
  assert.equal(encounter.motion, -3)
  assert.equal(encounter.acceleration, -2.75)
  assert.ok(Math.abs(encounter.walkCycle - 2.05 / 30) < 1e-12)
})

test('escape hop lands at zero and resets to the native repeating acceleration', () => {
  const encounter = stepSolomonEncounter({
    ...createSolomonEncounter(DIG, 'escape-hop-seed'),
    acceleration: 0.25,
    escapeSpeed: 2,
    lifetimeTicksRemaining: 100,
    motion: -0.1,
    phase: 'escaping',
  }, {})

  assert.equal(encounter.motion, 0)
  assert.equal(encounter.acceleration, -2)
})

test('the final escape lifetime tick moves before Solomon is retired', () => {
  const encounter = stepSolomonEncounter({
    ...createSolomonEncounter(DIG, 'escape-retirement-seed'),
    acceleration: -3,
    escapeSpeed: 2,
    headingDeg: 90,
    lifetimeTicksRemaining: 1,
    phase: 'escaping',
    walkCycle: 0,
  }, {})

  assert.equal(encounter.phase, 'gone')
  assert.equal(encounter.lifetimeTicksRemaining, 0)
  assert.equal(encounter.position.x, DIG.position.x + 2)
  assert.equal(encounter.escapeSpeed, 2.05)
  assert.ok(Math.abs(encounter.walkCycle - 2.05 / 30) < 1e-12)
})
