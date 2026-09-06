import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { createIdlePlayerCharacterInput, type PlayerCharacterInput } from '../core-kernels/player-character.ts'
import {
  createGameSimulation, enterBoneyardWorld, getPlayerCharacter, getPlayerEconomy, getPlayerProgression,
  grantGameSimulationPlayerExperience, stepGameSimulationTick,
} from '../core-server/game-simulation.ts'
import { compileWebLuaDefinition, WebLuaDefinitionRuntime } from '../modding/definition/index.ts'
import { prepareModHost } from './prepared-mod-host.ts'
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

function humanInputs(): Record<string, PlayerCharacterInput> {
  return { wizard: { ...createIdlePlayerCharacterInput(1234, 700), movement: { x: -1, y: 0 } } }
}

async function createFixture(source: string, now: () => number = () => 0) {
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
    discipline: 'arcane', displayName: 'Tester', element: 'fire',
  } }), loaded)
  const errors: string[] = []
  const host = await prepareModHost({ content, log: message => errors.push(message), now,
    state: { read: () => state, write: next => { state = next } }, wasmPath })
  return { host, errors, get state() { return state }, set state(next) { state = next } }
}
