import assert from 'node:assert/strict'
import test from 'node:test'

import type { SolomonDigState } from './boneyard.ts'
import {
  BONEYARD_SOLOMON_DIG_AUDIO_CUES,
  SOLOMON_VOICE_DURATION_TICKS,
  createSolomonEncounter,
  isBoneyardPlayerCombatEnabled,
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

test('player combat opens only on the monotonic Solomon run edge', () => {
  const encounter = createSolomonEncounter(DIG, 'combat-admission')
  for (const phase of [
    'digging',
    'turning',
    'speaking',
    'retreat-hold',
    'retreat-accelerating',
  ] as const) {
    const phaseState = { ...encounter, phase }
    assert.equal(isBoneyardPlayerCombatEnabled(phaseState), false, phase)
  }
  const escaping = {
    ...encounter,
    phase: 'escaping',
    runEventId: 1,
  } as const
  assert.equal(isBoneyardPlayerCombatEnabled(escaping), true)
  const gone = {
    ...encounter,
    phase: 'gone',
    runEventId: 1,
  } as const
  assert.equal(isBoneyardPlayerCombatEnabled(gone), true)
  const missingRunEdge = {
    ...encounter,
    phase: 'escaping',
    runEventId: 0,
  } as const
  assert.equal(isBoneyardPlayerCombatEnabled(missingRunEdge), false)
  assert.equal(isBoneyardPlayerCombatEnabled(null), true)
})

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
    digPhase: 18.7,
  }, player)
  const opened = stepSolomonEncounter({
    ...createSolomonEncounter(NATIVE_DIG, 'dig-gate-open'),
    digPhase: 18.9,
  }, player)

  assert.ok(closed.digPhase < 19)
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

test('digging emits each native shovel and throw-dirt pool once per armed cycle', () => {
  const observed = new Set<string>()
  for (let seed = 0; seed < 24; seed += 1) {
    let encounter = createSolomonEncounter(NATIVE_DIG, `dig-audio-${seed}`)
    for (let tick = 0; tick < 2_000 && observed.size < 4; tick += 1) {
      encounter = stepSolomonEncounter(encounter, {})
      for (const event of encounter.digAudioEvents) observed.add(event.cue)
    }
  }
  assert.deepEqual(
    [...observed].sort(),
    [...BONEYARD_SOLOMON_DIG_AUDIO_CUES].sort(),
  )
})

test('digging preserves the native float32 cursor and RNG event sequence', () => {
  let encounter = createSolomonEncounter(NATIVE_DIG, 'dig-audio-golden')
  let lastEventId = 0
  const events: Array<{ cue: string; id: number; phase: number; tick: number }> = []
  for (let tick = 1; tick < 1_000 && events.length < 8; tick += 1) {
    encounter = stepSolomonEncounter(encounter, {})
    if (encounter.digAudioEventId === lastEventId) continue
    for (const event of encounter.digAudioEvents) {
      if (event.id <= lastEventId) continue
      events.push({ ...event, phase: encounter.digPhase, tick })
    }
    lastEventId = encounter.digAudioEventId
  }
  assert.deepEqual(events, [
    { cue: 'shovel-1', id: 1, phase: 3.9819726943969727, tick: 20 },
    { cue: 'throw-dirt-1', id: 2, phase: 15.164621353149414, tick: 82 },
    { cue: 'shovel-2', id: 3, phase: 4.180782794952393, tick: 183 },
    { cue: 'throw-dirt-1', id: 4, phase: 14.9970121383667, tick: 243 },
    { cue: 'shovel-2', id: 5, phase: 4.090818405151367, tick: 365 },
    { cue: 'throw-dirt-2', id: 6, phase: 15.109530448913574, tick: 427 },
    { cue: 'shovel-2', id: 7, phase: 3.9386777877807617, tick: 542 },
    { cue: 'throw-dirt-2', id: 8, phase: 15.162186622619629, tick: 606 },
  ])
})

test('digging uses strict native cursor gates and bounded ordered event history', () => {
  let encounter = {
    ...createSolomonEncounter(NATIVE_DIG, 'dig-audio-thresholds'),
    digPhase: 3.8,
  }
  encounter = stepSolomonEncounter(encounter, {})
  assert.equal(encounter.digAudioEvents.length, 0)
  assert.equal(encounter.digShovelArmed, true)

  encounter = stepSolomonEncounter({ ...encounter, digPhase: 4 }, {})
  assert.match(encounter.digAudioEvents.at(-1)!.cue, /^shovel-[12]$/)
  assert.equal(encounter.digShovelArmed, false)

  encounter = stepSolomonEncounter({
    ...encounter,
    digPhase: 15,
    digThrowDirtArmed: true,
  }, {})
  assert.match(encounter.digAudioEvents.at(-1)!.cue, /^throw-dirt-[12]$/)
  assert.equal(encounter.digThrowDirtArmed, false)

  for (let index = 0; index < 10; index += 1) {
    encounter = stepSolomonEncounter({
      ...encounter,
      digPhase: 4,
      digShovelArmed: true,
    }, {})
  }
  assert.equal(encounter.digAudioEventId, 12)
  assert.deepEqual(
    encounter.digAudioEvents.map((event) => event.id),
    [5, 6, 7, 8, 9, 10, 11, 12],
  )
})

test('digging rearms both sound gates only on native program wrap', () => {
  const encounter = stepSolomonEncounter({
    ...createSolomonEncounter(NATIVE_DIG, 'dig-audio-wrap'),
    digPhase: 28.95,
    digShovelArmed: false,
    digThrowDirtArmed: false,
  }, {})

  assert.equal(encounter.phase, 'digging')
  assert.equal(encounter.digShovelArmed, true)
  assert.equal(encounter.digThrowDirtArmed, true)
  assert.ok(encounter.digPhase >= 0 && encounter.digPhase <= 4)
  assert.equal(encounter.rngState.words.length, 55)
})

test('contact ends the digging emitter without cancelling its latched history', () => {
  const players = { player: { position: { x: 1000, y: 990 } } }
  let encounter = stepSolomonEncounter({
    ...createSolomonEncounter(NATIVE_DIG, 'dig-audio-contact'),
    digPhase: 19,
  }, players)
  assert.equal(encounter.phase, 'turning')
  const eventsAtContact = encounter.digAudioEvents

  for (let tick = 0; tick < 100; tick += 1) {
    encounter = stepSolomonEncounter(encounter, players)
  }
  assert.deepEqual(encounter.digAudioEvents, eventsAtContact)
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
