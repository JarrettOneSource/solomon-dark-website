import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  CREATE_DISCIPLINE_FINALIZE_MS,
  GAME_SCENE_MUSIC,
  HUB_AUDIO_ATTENUATION_RADIUS,
  NATIVE_MUSIC_MODULE_SHA256,
  NATIVE_LOOP_MANIFEST,
  NATIVE_SOUND_MANIFEST,
  NATIVE_SOLOMON_VOICE_MANIFEST,
  NATIVE_STREAM_MANIFEST,
  createEntryAudioEvents,
  createSelectionAudioEvents,
  hubAudioAttenuation,
  hubTeacherReleasesBetween,
  hubTeacherSummonPitch,
  hubTeacherSummonVolume,
  nativeFootstepCue,
  newSolomonVoiceEvent,
  newNativeFootstepTick,
} from './game-audio-native.ts'
import {
  HUB_TEACHER_CAST_SECONDS,
  HUB_TEACHER_CYCLE_SECONDS,
} from './hub-teacher.ts'

const boneyardSceneSource = readFileSync(
  new URL('./BoneyardScene.tsx', import.meta.url),
  'utf8',
)
const mainMenuSceneSource = readFileSync(
  new URL('./MainMenuScene.tsx', import.meta.url),
  'utf8',
)

test('maps each scene to the recovered module entry and transition clock', () => {
  assert.equal(
    NATIVE_MUSIC_MODULE_SHA256,
    '32bf92cc3191e136b6d186d77d75de48ad28f4bd58acae0c278204455fa57c82',
  )
  assert.deepEqual(GAME_SCENE_MUSIC, {
    boneyard: { cue: 'prelude', transitionTicks: 100 },
    create: { cue: 'selection', transitionTicks: 100 },
    hub: { cue: 'academy', transitionTicks: 2 },
    title: { cue: 'solomondarktheme', transitionTicks: 100 },
  })
})

test('maps the stock Solomon dialogue files and authoritative PCM durations', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(NATIVE_SOLOMON_VOICE_MANIFEST).map(
      ([cue, entry]) => [cue, entry.durationTicks],
    )),
    {
      'solomon-hello-1': 783,
      'solomon-hello-2': 570,
      'solomon-hello-3': 554,
      'solomon-hello-4': 735,
      'solomon-laugh-1': 247,
      'solomon-get-him-boys': 245,
    },
  )
  assert.equal(
    NATIVE_SOLOMON_VOICE_MANIFEST['solomon-get-him-boys'].sourceName,
    'voices\\SAY_GETHIMBOYS.wav',
  )
})

test('pins every checked-in Solomon voice to its untouched stock WAV', () => {
  const filenames = {
    'solomon-get-him-boys': 'solomon-get-him-boys.wav',
    'solomon-hello-1': 'solomon-hello-1.wav',
    'solomon-hello-2': 'solomon-hello-2.wav',
    'solomon-hello-3': 'solomon-hello-3.wav',
    'solomon-hello-4': 'solomon-hello-4.wav',
    'solomon-laugh-1': 'solomon-laugh-1.wav',
  } as const
  for (const [cue, filename] of Object.entries(filenames)) {
    const source = readFileSync(new URL(
      `../assets/game/audio/voice/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOLOMON_VOICE_MANIFEST[
        cue as keyof typeof NATIVE_SOLOMON_VOICE_MANIFEST
      ].sourceSha256,
    )
  }
})

test('keeps native registry offsets on the browser cue manifest', () => {
  assert.equal(NATIVE_SOUND_MANIFEST.click.registryOffset, 0x18)
  assert.equal(NATIVE_SOUND_MANIFEST['pick-skill'].registryOffset, 0x44)
  assert.equal(NATIVE_SOUND_MANIFEST['step-1'].registryOffset, 0x23b8)
  assert.equal(NATIVE_SOUND_MANIFEST['step-2'].registryOffset, 0x23e4)
  assert.equal(NATIVE_SOUND_MANIFEST['start-boulder'].registryOffset, 0xf0c)
  assert.equal(NATIVE_LOOP_MANIFEST['gather-rocks-loop'].registryOffset, 0x176c)
  assert.equal(NATIVE_LOOP_MANIFEST['ice-loop'].registryOffset, 0x182c)
  assert.equal(NATIVE_LOOP_MANIFEST['lightning-loop'].registryOffset, 0x188c)
  assert.equal(NATIVE_LOOP_MANIFEST['rolling-stone-loop'].registryOffset, 0x1acc)
  assert.equal(NATIVE_STREAM_MANIFEST['catch-it'].registryOffset, 0x1344)
  assert.equal(NATIVE_STREAM_MANIFEST['choose-element'].registryOffset, 0x134c)
  assert.equal(NATIVE_STREAM_MANIFEST['start-cast'].registryOffset, 0x141c)
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

test('gives Boneyard the same local authoritative footstep owner', () => {
  assert.match(mainMenuSceneSource, /<BoneyardScene[\s\S]*?audio=\{audio\}/)
  assert.match(boneyardSceneSource, /let previousAudioSnapshot = initialSnapshot/)
  assert.match(boneyardSceneSource, /snapshot\.players\[playerId\]/)
  assert.match(boneyardSceneSource, /newNativeFootstepTick\(/)
  assert.match(
    boneyardSceneSource,
    /audio\.playSound\(nativeFootstepCue\(footstepTick, playerId\), \{ volume: 0\.5 \}\)/,
  )
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
