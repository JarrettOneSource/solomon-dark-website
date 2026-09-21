import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { grantPlayerSkillRanks } from '../core-kernels/player-progression.ts'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { createIdlePlayerCharacterInput, type PlayerCharacterInput } from '../core-kernels/player-character.ts'
import {
  createGameSimulation, enterBoneyardWorld, getPlayerCharacter, getPlayerEconomy, getPlayerProgression,
  grantGameSimulationPlayerExperience, stepGameSimulationTick,
} from '../core-server/game-simulation.ts'
import { compileWebLuaDefinition, WebLuaDefinitionRuntime } from '../modding/definition/index.ts'
import { prepareModHost } from './prepared-mod-host.ts'
import { modPlayerControlObservation } from './mod-player-control.ts'
import type { MaterializedWebSessionContent } from './web-mod-content.ts'

const wasmPath = createRequire(import.meta.url).resolve('wasmoon/dist/glue.wasm')
const identity = { id: 'example.player-control', name: 'Player control test', version: '1.0.0' }
const script = `
sd.status({key = "protected", duration = "1m", modifiers = {incoming_damage = 0}})
sd.ui({
  key = "control", mount = "hud.top_right", actions = {"Toggle bot"},
  visible = {scenes = {"boneyard"}},
  view = sd.prefab.minimap({range = 500, size = 180}),
})
sd.advanced.reducer({
  key = "driver", scope = "participant-run", schema_version = 1,
  state = sd.schema.object({enabled = sd.schema.boolean({default = true})}),
  on = {"player.control", "action.ui.action"},
  reduce = function(state, event, context)
    if context.action == "Toggle bot" then
      return {enabled = not state.enabled}, {sd.intent.input({release = true})}
    end
    if not state.enabled then return state, {} end
    if event.player.offer then
      local option = event.player.offer.options[1]
      return state, {sd.intent.select_skill({
        offer_sequence = event.player.offer.sequence,
        choice_index = option.choice_index, skill_id = option.skill_id,
      })}
    end
    return state, {
      sd.intent.status({target = "user", status = sd.ref("status", "protected")}),
      sd.intent.input({movement = {x = 1, y = 0}, aim = {x = 900, y = 500}, primary = true}),
    }
  end,
})
sd.on("gold.changed", sd.effect.damage({target = "user", amount = 1000}))
`
const otherController = `
sd.advanced.reducer({
  key = "other-driver", scope = "participant-run", schema_version = 1,
  state = sd.schema.object({}), on = {"player.control"},
  reduce = function(state)
    return state, {sd.intent.input({movement = {x = 0, y = 1}})}
  end,
})`

test('Lua controls the connected wizard through normal movement, casting, and damage rules', async () => {
  const fixture = await createFixture(script)
  const { host } = fixture
  try {
    const start = getPlayerCharacter(fixture.state, 'wizard').position.x
    const health = getPlayerProgression(fixture.state, 'wizard').currentHealth
    for (let step = 0; step < 80; step += 1) {
      const inputs = humanInputs()
      host.applyPlayerControls(inputs, step * 10)
      assert.equal(inputs.wizard!.viewportWidth, 1234)
      fixture.state = stepGameSimulationTick(fixture.state, inputs, { extensions: host.extensions })
    }
    assert.ok(getPlayerCharacter(fixture.state, 'wizard').position.x > start + 30)
    assert.ok(getPlayerCharacter(fixture.state, 'wizard').primaryCast.castSequence > 0)
    const damage = host.step([{ name: 'gold.changed', payload: {} }], fixture.state.tick,
      'control-run', { participant_id: 'wizard' })
    assert.equal(damage.accepted, true)
    assert.equal(getPlayerProgression(fixture.state, 'wizard').currentHealth, health)
  } finally { host.close() }
})

test('the mod toggle returns the same wizard to human input and resumes Lua control', async () => {
  const { host } = await createFixture(script)
  try {
    const controlled = humanInputs()
    host.applyPlayerControls(controlled, 0)
    assert.equal(controlled.wizard!.movement.x, 1)
    const contentId = host.content.all().find(row => row.contentKind === 'ui')!.contentId
    assert.equal(host.uiAction({ action: 'Toggle bot', arguments: {}, contentId,
      playerId: 'wizard', requestId: 1 }).accepted, true)
    const human = humanInputs()
    host.applyPlayerControls(human, 100)
    assert.equal(human.wizard!.movement.x, -1)
    assert.equal(human.wizard!.cast.primary, false)
    assert.equal(host.uiAction({ action: 'Toggle bot', arguments: {}, contentId,
      playerId: 'wizard', requestId: 2 }).accepted, true)
    const resumed = humanInputs()
    host.applyPlayerControls(resumed, 200)
    assert.equal(resumed.wizard!.movement.x, 1)
  } finally { host.close() }
})

test('Lua selects a real offered skill while the simulation tick is frozen', async () => {
  const fixture = await createFixture(script)
  const { host } = fixture
  try {
    host.applyPlayerControls(humanInputs(), 0)
    fixture.state = grantGameSimulationPlayerExperience(fixture.state, 'wizard', 100)
    const offered = getPlayerProgression(fixture.state, 'wizard').pendingOffer
    assert.ok(offered)
    assert.ok(fixture.state.levelUpBarrier)
    const frozenTick = fixture.state.tick
    host.applyPlayerControls(humanInputs(), 100)
    assert.equal(fixture.state.tick, frozenTick)
    assert.equal(getPlayerProgression(fixture.state, 'wizard').pendingOffer, null)
    assert.equal(fixture.state.levelUpBarrier, null)
    assert.equal(fixture.state.playerEntities.skillBooks[0]!.permanentRanks[offered.options[0]!.skillId],
      offered.options[0]!.targetRank)
  } finally { host.close() }
})

test('an invalid control transaction cannot retain input or grant its other effects', async () => {
  const invalidScript = script.replace('movement = {x = 1, y = 0}', 'movement = {x = 2, y = 0}')
  const { host, errors } = await createFixture(invalidScript)
  try {
    const inputs = humanInputs()
    host.applyPlayerControls(inputs, 0)
    assert.equal(inputs.wizard!.movement.x, -1)
    assert.equal(host.checkpoint().statuses.instances.length, 0)
    assert.ok(errors.some(message => message.includes('movement')))
  } finally { host.close() }
})

test('a controller that stops supplying decisions expires back to human input', async () => {
  const once = script.replace('if not state.enabled then return state, {} end',
    'if not state.enabled or context.tick > 0 then return state, {} end')
  const fixture = await createFixture(once)
  try {
    const initial = humanInputs()
    fixture.host.applyPlayerControls(initial, 0)
    fixture.state = stepGameSimulationTick(fixture.state, initial)
    const held = humanInputs()
    fixture.host.applyPlayerControls(held, 100)
    assert.equal(held.wizard!.movement.x, 1)
    const expired = humanInputs()
    fixture.host.applyPlayerControls(expired, 251)
    assert.equal(expired.wizard!.movement.x, -1)
    assert.equal(expired.wizard!.cast.primary, false)
  } finally { fixture.host.close() }
})

test('disconnect clears control before a participant can reconnect', async () => {
  const { host } = await createFixture(script)
  try {
    host.applyPlayerControls(humanInputs(), 0)
    host.applyPlayerControls({}, 10)
    const reconnected = humanInputs()
    host.applyPlayerControls(reconnected, 20)
    assert.equal(reconnected.wizard!.movement.x, -1)
    assert.equal(reconnected.wizard!.cast.primary, false)
  } finally { host.close() }
})

test('Lua cannot redirect an input intent to another participant', async () => {
  const redirected = script.replace('movement = {x = 1, y = 0}',
    'target = "another-wizard", movement = {x = 1, y = 0}')
  const { host, errors } = await createFixture(redirected)
  try {
    const inputs = humanInputs()
    host.applyPlayerControls(inputs, 0)
    assert.equal(inputs.wizard!.movement.x, -1)
    assert.ok(errors.some(message => message.includes('target')))
    assert.equal(host.checkpoint().statuses.instances.length, 0)
  } finally { host.close() }
})

test('competing Lua controllers fail atomically instead of silently taking ownership', async () => {
  const { host, errors } = await createFixture(script + otherController)
  try {
    const inputs = humanInputs()
    host.applyPlayerControls(inputs, 0)
    assert.equal(inputs.wizard!.movement.x, -1)
    assert.equal(host.checkpoint().statuses.instances.length, 0)
    assert.ok(errors.some(message => message.includes('another Lua controller')))
  } finally { host.close() }
})

test('a dispatch that exhausts its budget between reducers rolls back all partial effects and state', async () => {
  let clockReads = 0
  const { host, errors } = await createFixture(script + otherController,
    () => clockReads++ < 2 ? 0 : 5)
  try {
    clockReads = 0
    const inputs = humanInputs()
    host.applyPlayerControls(inputs, 0)
    assert.equal(inputs.wizard!.movement.x, -1)
    assert.equal(host.checkpoint().statuses.instances.length, 0)
    assert.equal(host.checkpoint().session.state.cells.length, 0)
    assert.ok(errors.some(message => message.includes('budget exceeded')))
  } finally { host.close() }
})

test('an over-budget scheduled rule cannot apply its resource effect', async () => {
  let clock = 0
  const fixture = await createFixture(`sd.on("wave.started", sd.after("10ms",
    sd.effect.resource({target = "user", gold = 10})))`, () => { clock += 5; return clock })
  try {
    const gold = getPlayerEconomy(fixture.state, 'wizard').gold
    assert.equal(fixture.host.step([{ name: 'wave.started', payload: {} }], 0,
      'control-run', { participant_id: 'wizard' }).accepted, true)
    const result = fixture.host.step([], 1, 'control-run')
    assert.equal(result.budgetExceeded, true)
    assert.equal(result.accepted, false)
    assert.equal(getPlayerEconomy(fixture.state, 'wizard').gold, gold)
    assert.equal(fixture.host.checkpoint().session.timers.length, 0)
  } finally { fixture.host.close() }
})

test('declarative player-control rules use the same connected-player input path', async () => {
  const { host } = await createFixture(`sd.on("player.control",
    sd.effect.input({movement = {x = 0, y = 1}}))`)
  try {
    const inputs = humanInputs()
    host.applyPlayerControls(inputs, 0)
    assert.deepEqual(inputs.wizard!.movement, { x: 0, y: 1 })
  } finally { host.close() }
})

test('a player-control reducer cannot silently subscribe under an unrelated scope', async () => {
  await assert.rejects(createFixture(script.replace('scope = "participant-run"', 'scope = "session"')),
    /player.control reducers require participant-run scope/)
})

test('player control exposes owned secondary slots and native cooldowns without live-state aliases', async () => {
  const fixture = await createFixture(script)
  try {
    let state = stepGameSimulationTick(fixture.state, humanInputs())
    let book = state.playerEntities.skillBooks[0]!
    for (const skillId of [48, 15, 12, 23, 78, 79]) book = grantPlayerSkillRanks(book, skillId, 1)
    const secondary = state.secondaryAbilities.players.wizard!
    assert.ok(secondary)
    state = {
      ...state,
      playerEntities: { ...state.playerEntities,
        skillBooks: [book],
        belts: [[
          { kind: 'skill', skillId: 8 }, { kind: 'skill', skillId: 48 },
          { kind: 'skill', skillId: 15 }, { kind: 'skill', skillId: 12 },
          { kind: 'skill', skillId: 23 }, { kind: 'skill', skillId: 78 },
          { kind: 'skill', skillId: 79 }, { kind: 'skill', skillId: 45 },
        ]],
      },
      secondaryAbilities: { ...state.secondaryAbilities,
        players: { wizard: { ...secondary, globalCooldownTicks: 50, heldSlot: 2,
          cooldownTicksBySkill: secondary.cooldownTicksBySkill.map((ticks, id) => id === 48 ? 3000 : ticks),
          planewalkerTicksRemaining: 100, firewalker: true, mindstar: true, regenerate: true,
        } },
      },
    }
    const observation = modPlayerControlObservation(state, 'wizard')
    const player = observation.player as Record<string, unknown>
    assert.equal(player.secondary_ready, false)
    assert.equal(player.held_quickbar, 2)
    assert.deepEqual(player.secondary_abilities, [
      { slot: 1, skill_id: 48, cooldown_ticks: 3000, active: false },
      { slot: 2, skill_id: 15, cooldown_ticks: 0, active: false },
      { slot: 3, skill_id: 12, cooldown_ticks: 0, active: true },
      { slot: 4, skill_id: 23, cooldown_ticks: 0, active: true },
      { slot: 5, skill_id: 78, cooldown_ticks: 0, active: true },
      { slot: 6, skill_id: 79, cooldown_ticks: 0, active: true },
    ])
    const slots = player.secondary_abilities as Array<{ cooldown_ticks: number }>
    slots[0]!.cooldown_ticks = 9999
    assert.equal(state.secondaryAbilities.players.wizard!.cooldownTicksBySkill[48], 3000)
    state = { ...state, secondaryAbilities: { ...state.secondaryAbilities,
      players: { wizard: { ...state.secondaryAbilities.players.wizard!, globalCooldownTicks: 0 } },
    } }
    assert.equal((modPlayerControlObservation(state, 'wizard').player as Record<string, unknown>).secondary_ready, true)
    state = { ...state, secondaryAbilities: { ...state.secondaryAbilities,
      players: { wizard: { ...state.secondaryAbilities.players.wizard!, castSpinTicksRemaining: 1 } },
    } }
    assert.equal((modPlayerControlObservation(state, 'wizard').player as Record<string, unknown>).secondary_ready, false)
  } finally { fixture.host.close() }
})

test('the real stress pilot rotates ready abilities, keeps toggles on, and does not spend mana', async () => {
  const source = readFileSync(new URL('../../../tools/party-soak-pilot.lua', import.meta.url), 'utf8')
  const fixture = await createFixture(source)
  try {
    let state = stepGameSimulationTick(fixture.state, humanInputs())
    let book = state.playerEntities.skillBooks[0]!
    for (const id of [48, 15, 23]) book = grantPlayerSkillRanks(book, id, 1)
    const secondary = state.secondaryAbilities.players.wizard!
    state = { ...state,
      playerEntities: { ...state.playerEntities, skillBooks: [book],
        belts: [[null, { kind: 'skill', skillId: 48 }, { kind: 'skill', skillId: 15 },
          { kind: 'skill', skillId: 23 }, null, null, null, null]],
        progressions: [{ ...state.playerEntities.progressions[0]!, currentMana: 0 }],
      },
      secondaryAbilities: { ...state.secondaryAbilities,
        players: { wizard: { ...secondary, firewalker: true } },
      },
    }
    fixture.state = state
    const slots = []
    for (let decision = 0; decision < 6; decision += 1) {
      const inputs = humanInputs()
      fixture.host.applyPlayerControls(inputs, decision * 100)
      slots.push(inputs.wizard!.cast.quickbar)
    }
    assert.deepEqual(fixture.errors, [])
    assert.deepEqual(slots, [1, 2, 1, 2, 1, 2])
    assert.equal(getPlayerProgression(fixture.state, 'wizard').currentMana,
      getPlayerProgression(fixture.state, 'wizard').maximumMana)
    assert.equal(Math.abs(fixture.host.extensions.filterMana({ playerId: 'wizard', tick: fixture.state.tick,
      currentMana: 10, maximumMana: 100, delta: -99, source: 'primary-cast' })), 0)
    fixture.state = { ...fixture.state, secondaryAbilities: { ...fixture.state.secondaryAbilities,
      players: { wizard: { ...secondary, globalCooldownTicks: 5 } },
    } }
    const blocked = humanInputs()
    fixture.host.applyPlayerControls(blocked, 600)
    assert.equal(blocked.wizard!.cast.quickbar, null)
    fixture.state = { ...fixture.state, secondaryAbilities: { ...fixture.state.secondaryAbilities,
      players: { wizard: { ...secondary, firewalker: true, heldSlot: 1,
        cooldownTicksBySkill: secondary.cooldownTicksBySkill.map((ticks, id) => id === 15 ? 500 : ticks),
      } },
    } }
    const released = humanInputs()
    fixture.host.applyPlayerControls(released, 700)
    assert.equal(released.wizard!.cast.quickbar, null)
    assert.equal(fixture.state.secondaryAbilities.players.wizard!.cooldownTicksBySkill[15], 500)
    assert.equal(fixture.state.playerEntities.skillBooks[0]!.primarySkillId, book.primarySkillId)
    assert.deepEqual(fixture.errors, [])
  } finally { fixture.host.close() }
})

for (const element of ['fire', 'water'] as const) {
  test(`the actual ${element} stress pilot casts secondaries through native shared cooldowns without mana loss`, async () => {
    const source = readFileSync(new URL('../../../tools/party-soak-pilot.lua', import.meta.url), 'utf8')
    const fixture = await createFixture(source, () => 0, element)
    try {
      const state = stepGameSimulationTick(fixture.state, humanInputs())
      let book = state.playerEntities.skillBooks[0]!
      for (const id of [48, 15]) book = grantPlayerSkillRanks(book, id, 1)
      fixture.state = { ...state, playerEntities: { ...state.playerEntities,
        skillBooks: [book],
        belts: [[{ kind: 'skill', skillId: 48 }, { kind: 'skill', skillId: 15 }, null, null, null, null, null, null]],
        // A controlled finite-capacity fixture separates spending from the
        // unchanged native affordability check. No production ranks are granted.
        progressions: [{ ...state.playerEntities.progressions[0]!, currentMana: 10000, maximumMana: 10000 }],
      } }
      const casts: Array<{ tick: number; skillId: number }> = []
      let sequence = 0
      for (let tick = 0; tick < 600; tick += 1) {
        const inputs = humanInputs()
        fixture.host.applyPlayerControls(inputs, tick * 10)
        fixture.state = stepGameSimulationTick(fixture.state, inputs, { extensions: fixture.host.extensions })
        const secondary = fixture.state.secondaryAbilities.players.wizard!
        if (secondary.castSequence > sequence) {
          casts.push({ tick: fixture.state.tick, skillId: secondary.lastSkillId! })
          sequence = secondary.castSequence
        }
        assert.equal(getPlayerProgression(fixture.state, 'wizard').currentMana, 10000)
      }
      assert.ok(casts.some(cast => cast.skillId === 48))
      assert.ok(casts.some(cast => cast.skillId === 15))
      for (let index = 1; index < casts.length; index += 1) {
        assert.ok(casts[index]!.tick - casts[index - 1]!.tick >= 150,
          'the native 150-tick shared cooldown must not be bypassed')
      }
      assert.equal(fixture.state.playerEntities.skillBooks[0]!.primarySkillId, book.primarySkillId)
      assert.deepEqual(fixture.errors, [])
    } finally { fixture.host.close() }
  })
}

function humanInputs(): Record<string, PlayerCharacterInput> {
  return { wizard: { ...createIdlePlayerCharacterInput(1234, 700), movement: { x: -1, y: 0 } } }
}

async function createFixture(source: string, now: () => number = () => 0, element: 'fire' | 'water' = 'fire') {
  const runtime = await WebLuaDefinitionRuntime.create({ entryScript: 'scripts/main.lua', identity, wasmPath })
  let compiled
  try { compiled = compileWebLuaDefinition(identity, runtime.run(source)) }
  finally { runtime.close() }
  const manifest = { manifestSha256: '1'.repeat(64),
    mods: [{ contentSha256: '2'.repeat(64), id: identity.id, version: identity.version }] }
  const content: MaterializedWebSessionContent = {
    assets: [], boneyards: [], compiledMods: [compiled], manifest,
    modSources: [{ entryScript: source, files: {}, identity }],
    summary: { manifestSha256: manifest.manifestSha256, mods: [{ ...manifest.mods[0]!,
      assets: [], graphSha256: compiled.graphSha256, name: identity.name, slug: 'player-control' }] },
  }
  const loaded: LoadedBoneyard = {
    choice: { id: 'control', name: 'Control test', source: 'default' },
    geometrySha256: '3'.repeat(64), sourceSha256: '4'.repeat(64),
    runId: 'control-run', seed: 'control-seed',
    scene: { bounds: { x: 0, y: 0, w: 1000, h: 1000 }, environmentMode: 0,
      fences: [], name: 'Control test', objects: [], roads: [], solomonDig: null,
      spawn: { x: 500, y: 500, facingDeg: 0 }, sprites: [], terrain: [] },
  }
  let state = enterBoneyardWorld(createGameSimulation({ wizard: {
    discipline: 'arcane', displayName: 'Tester', element,
  } }), loaded)
  const errors: string[] = []
  const host = await prepareModHost({ content, log: message => errors.push(message), now,
    state: { read: () => state, write: next => { state = next } }, wasmPath })
  return { host, errors, get state() { return state }, set state(next) { state = next } }
}
