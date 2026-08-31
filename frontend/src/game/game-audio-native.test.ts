import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CREATE_DISCIPLINE_FINALIZE_MS,
  GAME_SCENE_MUSIC,
  HUB_AUDIO_ATTENUATION_RADIUS,
  NATIVE_LEVEL_UP_SOUND_REQUEST,
  NATIVE_SOUND_MAXIMUM_VOICES,
  createEntryAudioEvents,
  createSelectionAudioEvents,
  hubAudioAttenuation,
  hubTeacherReleasesBetween,
  hubTeacherSummonPitch,
  hubTeacherSummonVolume,
  nativeBoneyardHitPointGain,
  nativeBoneyardPointGain,
  nativeFootstepCue,
  nativeEnemyEventSoundRequest,
  nativeLootEventSoundRequest,
  nativeSolomonDigSoundRequest,
  newSolomonVoiceEvent,
  newNativeFootstepTick,
  solomonDigAudioDelta,
} from './game-audio-native.ts'
import {
  HUB_TEACHER_CAST_SECONDS,
  HUB_TEACHER_CYCLE_SECONDS,
} from './hub-teacher.ts'

test('maps each scene to the recovered module entry and transition clock', () => {
  assert.deepEqual(GAME_SCENE_MUSIC, {
    boneyard: { cue: 'prelude', transitionTicks: 100 },
    'boneyard-combat': { cue: 'combat', transitionTicks: 100 },
    create: { cue: 'selection', transitionTicks: 100 },
    'game-over': { cue: 'death', transitionTicks: 0 },
    hub: { cue: 'academy', transitionTicks: 2 },
    title: { cue: 'solomondarktheme', transitionTicks: 100 },
  })
})

test('maps the level-up request at scalar one', () => {
  assert.deepEqual(NATIVE_LEVEL_UP_SOUND_REQUEST, {
    cue: 'level-up',
    playbackRate: 1,
  })
})

test('caps each retained Hail bounce sound at ten native voices', () => {
  for (const cue of [
    'hail-bounce-0',
    'hail-bounce-1',
    'hail-bounce-2',
    'hail-bounce-3',
  ] as const) {
    assert.equal(NATIVE_SOUND_MAXIMUM_VOICES[cue], 10)
  }
})

test('maps successful Deflect feedback globally', () => {
  assert.deepEqual(nativeEnemyEventSoundRequest({
    actorId: 9,
    deflectPitch: 1.125,
    eventId: 3,
    runId: 'run-1',
    targetPlayerId: 'wizard',
    tick: 120,
    type: 'attack-marker',
  }), {
    cue: 'swipe',
    playbackRate: 1.125,
    sourcePosition: null,
    volume: 1,
  })
  assert.deepEqual(nativeEnemyEventSoundRequest({
    actorId: 4,
    eventId: 4,
    gainScale: 1,
    pitch: 1.125,
    runId: 'run-1',
    sound: 'bite-2',
    sourcePosition: { x: 10, y: 20 },
    tick: 121,
    type: 'enemy-action-sound',
  }), {
    cue: 'bite-2',
    playbackRate: 1.125,
    sourcePosition: { x: 10, y: 20 },
    volume: 1,
  })
})

test('maps the Archer release cue with its authoritative positional pitch', () => {
  assert.deepEqual(nativeEnemyEventSoundRequest({
    actorId: 4,
    eventId: 5,
    gainScale: 1,
    pitch: 0.95,
    runId: 'run-1',
    sound: 'shoot-arrow',
    sourcePosition: { x: 10, y: 20 },
    tick: 122,
    type: 'enemy-action-sound',
  }), {
    cue: 'shoot-arrow',
    playbackRate: 0.95,
    sourcePosition: { x: 10, y: 20 },
    volume: 1,
  })
})

test('maps ground-loot audio requests', () => {
  assert.deepEqual(nativeLootEventSoundRequest({
    actorId: 8,
    eventId: 4,
    playbackRate: 1.05,
    position: { x: 20, y: 30 },
    runId: 'loot-audio',
    sound: 'pickup-coin',
    tick: 9,
    type: 'loot-pickup',
  }), {
    cue: 'pickup-coin',
    playbackRate: 1.05,
    sourcePosition: { x: 20, y: 30 },
    volume: 1,
  })
})

test('maps authoritative combat sounds to host-authored requests', () => {
  const death = {
    actorId: 9,
    eventId: 3,
    gainScale: 0.375,
    pitch: 1.125,
    runId: 'run-1',
    sound: 'maggot-squeak-2' as const,
    sourcePosition: { x: 10, y: 20 },
    tick: 120,
    type: 'enemy-death-sound' as const,
  }
  assert.deepEqual(nativeEnemyEventSoundRequest(death), {
    cue: 'maggot-squeak-2',
    playbackRate: 1.125,
    sourcePosition: { x: 10, y: 20 },
    volume: 0.375,
  })
  assert.deepEqual(nativeEnemyEventSoundRequest({
    ...death,
    eventId: 4,
    pitch: 0.825,
    sound: 'hit-shield',
    type: 'enemy-damage-sound',
  }), {
    cue: 'hit-shield',
    playbackRate: 0.825,
    sourcePosition: { x: 10, y: 20 },
    volume: 0.375,
  })
  assert.deepEqual(nativeEnemyEventSoundRequest({
    ...death,
    eventId: 5,
    gainScale: 0.625,
    pitch: 1,
    sound: 'wizard-ouch-2',
    targetPlayerId: 'wizard',
    type: 'player-damage-sound',
  }), {
    cue: 'wizard-ouch-2',
    playbackRate: 1,
    sourcePosition: { x: 10, y: 20 },
    volume: 0.625,
  })
  assert.equal(nativeEnemyEventSoundRequest({
    ...death,
    type: 'enemy-death',
  }), null)
})

test('matches native Boneyard point attenuation and death-presentation damping', () => {
  const visibleWorldWidth = 1_600 / 1.35
  const camera = { x: 800, y: 450 }
  const inner = visibleWorldWidth * 0.25
  const outer = visibleWorldWidth * 1.1
  const midpoint = (inner + outer) / 2

  assert.equal(
    nativeBoneyardPointGain(
      { x: camera.x + inner, y: camera.y },
      camera,
      visibleWorldWidth,
      false,
    ),
    1,
  )
  assert.ok(Math.abs(
    nativeBoneyardPointGain(
      { x: camera.x + midpoint, y: camera.y },
      camera,
      visibleWorldWidth,
      false,
    ) - 0.5,
  ) < 1e-12)
  assert.equal(
    nativeBoneyardPointGain(
      { x: camera.x + outer, y: camera.y },
      camera,
      visibleWorldWidth,
      false,
    ),
    0,
  )
  assert.equal(
    nativeBoneyardPointGain(
      { x: camera.x, y: camera.y },
      camera,
      visibleWorldWidth,
      true,
    ),
    0.1,
  )
})

test('matches native Solomon Dig hit attenuation and fixed gain-only requests', () => {
  const width = 1_200
  const camera = { x: 800, y: 450 }
  const inner = width * 0.1
  const outer = width * 0.5
  const midpoint = (inner + outer) / 2

  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x + inner, y: camera.y }, camera, width, false,
  ), 1)
  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x + inner, y: camera.y }, camera, width, true,
  ), 0.1)
  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x + midpoint, y: camera.y }, camera, width, false,
  ), 0.5)
  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x + midpoint, y: camera.y }, camera, width, true,
  ), 0.05)
  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x, y: camera.y }, camera, width, true,
  ), 1)
  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x + outer, y: camera.y }, camera, width, true,
  ), 0)

  assert.deepEqual(nativeSolomonDigSoundRequest({ cue: 'shovel-2', id: 7, tick: 70 }), {
    cue: 'shovel-2',
    playbackRate: 1,
    volume: 0.5,
  })
  assert.deepEqual(nativeSolomonDigSoundRequest({ cue: 'throw-dirt-1', id: 8, tick: 80 }), {
    cue: 'throw-dirt-1',
    playbackRate: 1,
    volume: 1,
  })
})

test('emits Create entry stream commands on crossed native thresholds', () => {
  assert.deepEqual(createEntryAudioEvents(0, 199), [])
  assert.deepEqual(createEntryAudioEvents(199, 200), [
    { action: 'play-stream', cue: 'start-cast' },
  ])
  assert.deepEqual(createEntryAudioEvents(1_339, 1_340), [
    { action: 'pause-stream', cue: 'start-cast' },
    { action: 'play-stream', cue: 'choose-element' },
  ])
})

test('emits the selected element and discipline reveal sounds in native order', () => {
  assert.deepEqual(createSelectionAudioEvents('fire', 0, 1_640), [
    { action: 'play-sound', cue: 'throw-fire' },
    { action: 'play-stream', cue: 'start-cast' },
    { action: 'pause-stream', cue: 'start-cast' },
    { action: 'play-stream', cue: 'choose-element' },
  ])
  assert.deepEqual(createSelectionAudioEvents('air', 979, 980), [
    { action: 'play-sound', cue: 'lightning-start' },
  ])
  assert.equal(CREATE_DISCIPLINE_FINALIZE_MS, 880)
})

test('consumes each authoritative Courtyard footstep once without gap bursts', () => {
  assert.equal(newNativeFootstepTick(undefined, { footstepTick: 0 }), undefined)
  assert.equal(newNativeFootstepTick(
    { footstepTick: 0 },
    { footstepTick: 25 },
  ), 25)
  assert.equal(newNativeFootstepTick(
    { footstepTick: 25 },
    { footstepTick: 25 },
  ), undefined)
  assert.equal(newNativeFootstepTick(
    { footstepTick: 25 },
    { footstepTick: 75 },
  ), 75)
  assert.equal(nativeFootstepCue(25, 'player-1'), nativeFootstepCue(25, 'player-1'))
  assert.ok(['step-1', 'step-2'].includes(nativeFootstepCue(50, 'player-1')))
})

test('consumes only the newest unseen Solomon cue after sparse snapshots', () => {
  const events = [
    { cue: 'solomon-hello-3' as const, id: 1 },
    { cue: 'solomon-laugh-1' as const, id: 2 },
    { cue: 'solomon-get-him-boys' as const, id: 3 },
  ]
  assert.deepEqual(newSolomonVoiceEvent(0, events), events[2])
  assert.deepEqual(newSolomonVoiceEvent(1, events), events[2])
  assert.equal(newSolomonVoiceEvent(3, events), null)
  assert.equal(newSolomonVoiceEvent(0, []), null)
})

test('consumes ordered Solomon Dig events without replaying hydration or a new run', () => {
  const events = [
    { cue: 'shovel-1' as const, id: 4, tick: 40 },
    { cue: 'throw-dirt-2' as const, id: 5, tick: 50 },
    { cue: 'shovel-2' as const, id: 6, tick: 60 },
  ]
  const hydrated = solomonDigAudioDelta(null, 'run-1', events)
  assert.deepEqual(hydrated.events, [])
  assert.deepEqual(hydrated.cursor, { eventId: 6, runId: 'run-1' })

  const next = { cue: 'throw-dirt-1' as const, id: 7, tick: 70 }
  const advanced = solomonDigAudioDelta(
    hydrated.cursor,
    'run-1',
    [...events, next],
  )
  assert.deepEqual(advanced.events, [next])
  assert.deepEqual(advanced.cursor, { eventId: 7, runId: 'run-1' })

  const newRun = solomonDigAudioDelta(
    advanced.cursor,
    'run-2',
    [{ cue: 'shovel-2', id: 1, tick: 10 }],
  )
  assert.deepEqual(newRun.events, [])
  assert.deepEqual(newRun.cursor, { eventId: 1, runId: 'run-2' })
})

test('matches native Courtyard attenuation and Teacher release timing', () => {
  assert.equal(HUB_AUDIO_ATTENUATION_RADIUS, 800)
  assert.equal(hubAudioAttenuation(0), 1)
  assert.equal(hubAudioAttenuation(150), 1)
  assert.equal(hubAudioAttenuation(475), 0.5)
  assert.equal(hubAudioAttenuation(800), 0.25)
  assert.equal(hubAudioAttenuation(2_000), 0.25)
  assert.equal(hubTeacherSummonVolume({ x: 0, y: 0 }, { x: 0, y: 0 }), 0.25)
  assert.equal(hubTeacherSummonVolume({ x: 0, y: 0 }, { x: 800, y: 0 }), 0.0625)

  assert.deepEqual(hubTeacherReleasesBetween(0, HUB_TEACHER_CAST_SECONDS - 0.001), [])
  assert.deepEqual(hubTeacherReleasesBetween(0, HUB_TEACHER_CAST_SECONDS), [0])
  assert.deepEqual(
    hubTeacherReleasesBetween(
      HUB_TEACHER_CAST_SECONDS,
      HUB_TEACHER_CAST_SECONDS + HUB_TEACHER_CYCLE_SECONDS,
    ),
    [1],
  )
  assert.ok(hubTeacherSummonPitch(0) >= 1)
  assert.ok(hubTeacherSummonPitch(0) < 1.1)
})
