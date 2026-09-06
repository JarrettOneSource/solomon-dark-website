import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createNativeBossNarration,enqueueNativeBossNarration,NATIVE_BOSS_STREAM_TICKS,
  NATIVE_FACULTY_VOICE_CUES,stepNativeBossNarration
} from './native-boss-audio.ts'
import { createNativeFacultyVoiceController, stepNativeFacultyVoices } from './native-faculty-voices.ts'
import { createNativeRng } from './native-rng.ts'

test('Faculty banter covers all eight voices, gender branches, and authored short waits', () => {
  const heard = new Set<string>()
  for (const members of [[{ female: true }], [{ female: false }], [{ female: true }, { female: false }]]) {
    for (let seed = 0; seed < 32; seed += 1) {
      for (let line = 0; line < 6; line += 1) {
        const stepped = stepNativeFacultyVoices({ line, ticksRemaining: 0 }, createNativeRng(seed), members, false)
        for (const cue of stepped.cues) {
          heard.add(cue)
          if (members.length === 1) assert.equal(cue.endsWith('-female'), members[0]!.female)
        }
        assert.ok(stepped.state)
        if (line === 2) assert.equal(stepped.state.ticksRemaining, 60)
        if (line === 3) assert.ok(stepped.state.ticksRemaining >= 200 && stepped.state.ticksRemaining <= 298)
        if (line === 5) assert.equal(stepped.state.line, 0)
      }
    }
  }
  assert.deepEqual([...heard].sort(), [...NATIVE_FACULTY_VOICE_CUES].sort())
})

test('a busy Speaker freezes the controller and its RNG; losing all members removes only the controller', () => {
  const created = createNativeFacultyVoiceController(createNativeRng(7))
  assert.ok(created.state.ticksRemaining >= 200 && created.state.ticksRemaining <= 699)
  const busy = stepNativeFacultyVoices(created.state, created.rng, [{ female: false }], true)
  assert.equal(busy.state, created.state)
  assert.equal(busy.rng, created.rng)
  assert.equal(stepNativeFacultyVoices(created.state, created.rng, [], true).state, null)
})

for (const cue of NATIVE_FACULTY_VOICE_CUES) {
  test(`${cue} uses its full WAV duration, queues a reply, and restores the mix after the idle hold`, () => {
    let state = enqueueNativeBossNarration(createNativeBossNarration(), [cue, 'faculty-join-us-1'], 0, true)
    assert.equal(state.current, null)
    state = stepNativeBossNarration(state, 1, false)
    assert.equal(state.current?.cue, cue)
    assert.equal(state.current?.eventId, 1)
    const duration = NATIVE_BOSS_STREAM_TICKS[cue]
    for (let tick = 2; tick <= duration; tick += 1) state = stepNativeBossNarration(state, tick, false)
    assert.equal(state.ticksRemaining, 1)
    state = stepNativeBossNarration(state, duration + 1, false)
    assert.equal(state.current?.cue, 'faculty-join-us-1')
    assert.equal(state.current?.eventId, 2)
    assert.equal(state.mix, .5)
    const end = duration + 1 + NATIVE_BOSS_STREAM_TICKS['faculty-join-us-1']
    for (let tick = duration + 2; tick <= end; tick += 1) state = stepNativeBossNarration(state, tick, false)
    assert.equal(state.current, null)
    assert.equal(state.mix, .5)
    for (let tick = 1; tick <= 24; tick += 1) state = stepNativeBossNarration(state, end + tick, false)
    assert.equal(state.mix, .5)
    state = stepNativeBossNarration(state, end + 25, false)
    assert.equal(state.mix, Math.fround(.5 + .02500000037252903))
    for (let tick = 26; tick <= 50; tick += 1) state = stepNativeBossNarration(state, end + tick, false)
    assert.equal(state.mix, 1)
  })
}
