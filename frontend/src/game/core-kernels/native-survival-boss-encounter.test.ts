import assert from 'node:assert/strict'
import test from 'node:test'
import { NATIVE_SURVIVAL_BOSS_SOURCES } from './native-survival-boss-catalog.ts'
import { createNativeBossEncounter, nativeBossEncounterTimelinePaused, stepNativeBossEncounter } from './native-survival-boss-encounter.ts'

for (const kind of ['heartmonger', 'faculty'] as const) {
for (const source of NATIVE_SURVIVAL_BOSS_SOURCES) {
  test(`${kind} preserves boss-count waits and every completion birth in ${source.sourceSha256}`, () => {
    const initial = createNativeBossEncounter(source.sourceSha256, kind)
    const missed = stepNativeBossEncounter(initial, source[kind].waveOrdinal + 1, 0)
    assert.equal(missed.birth, null)
    assert.equal(missed.state, initial)
    let step = stepNativeBossEncounter(initial, source[kind].waveOrdinal, 0)
    assert.equal(step.birth, 'boss')
    assert.equal(nativeBossEncounterTimelinePaused(step.state), true)
    for (let tick = 1; tick <= 100; tick += 1) {
      step = stepNativeBossEncounter(step.state, source[kind].waveOrdinal, 1)
      assert.equal(step.birth, null)
    }
    assert.equal(step.state.ticksRemaining, 200)
    for (let tick = 101; tick <= 800; tick += 1) {
      step = stepNativeBossEncounter(step.state, source[kind].waveOrdinal, 0)
      assert.equal(step.birth, null)
      assert.equal(step.releaseWave, false)
    }
    assert.equal(step.state.phase, 'completion')
    const births: number[] = []
    const endTick = 800 + source[kind].completionSkeletons * 75
    for (let tick = 801; tick <= endTick; tick += 1) {
      step = stepNativeBossEncounter(step.state, source[kind].waveOrdinal, 0)
      if (step.birth === 'skeleton') births.push(tick)
      assert.equal(step.releaseWave, tick === endTick)
    }
    assert.deepEqual(births, Array.from({ length: source[kind].completionSkeletons }, (_, index) => 875 + 75 * index))
    assert.equal(nativeBossEncounterTimelinePaused(step.state), false)
    assert.equal(stepNativeBossEncounter(step.state, source[kind].waveOrdinal, 0).birth, null)
  })
}
}
