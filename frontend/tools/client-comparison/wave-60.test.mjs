import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { LuaFactory } from 'wasmoon'

const source = await readFile(new URL('./scenarios/wave-60.lua', import.meta.url), 'utf8')
const entry = {
  seed: '013528a4000000000000000000000000', runId: 'endurance',
  tick: 100, wave: 29, health: 50, mana: 50, protected: true,
  castSequence: 200, secondaryCastSequence: 40, secondarySkills: ['teleport', 'phasing'],
  kills: 150, pickups: 25, experience: 1000,
}

async function scenario(observe) {
  const lua = await new LuaFactory().createEngine()
  let state = entry, paused = false, continued = false
  const done = async () => {}
  lua.global.set('qa', {
    seed: 20261028, start: done, set_seed: done, enter_boneyard: done, sleep: done,
    capture: async () => state,
    observe: async () => {
      if (!paused && !continued) state = observe()
      return state
    },
    key: async () => { paused = true },
    wait: done, click: done,
    reload_and_continue: async () => { paused = false; continued = true },
  })
  try { await lua.doString(source) } finally { lua.global.close() }
}

test('the endurance journey rejects an indefinitely stale accepted snapshot', async () => {
  await assert.rejects(scenario(() => entry), /authority stopped advancing/)
})

test('the endurance journey permits repeated snapshots, advancing combat and deliberate pause', async () => {
  const frames = [entry, entry, { ...entry, tick: 110 }, { ...entry, tick: 110 },
    { ...entry, tick: 120, wave: 61 }]
  await scenario(() => {
    assert.ok(frames.length, 'the journey should finish after wave 61 and saved continuation')
    return frames.shift()
  })
  assert.equal(frames.length, 0)
})
