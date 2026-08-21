import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

import type { WebLuaFrameState, WebLuaModSource } from './web-lua-contract.ts'
import { WebLuaContentRegistry, stableWebLuaContentId } from './web-lua-content-registry.ts'
import {
  createWebLuaGameExtensions,
  dispatchWebLuaConsumption,
} from './web-lua-game-extensions.ts'
import { WebLuaRuntime } from './web-lua-runtime.ts'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('wasmoon/dist/glue.wasm')
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xz6rAAAAAElFTkSuQmCC',
  'base64',
)
const BUNDLE = Buffer.from(
  '00000000000000000000803f0000803f01000000010000000000803f0000803f00000000000000000000000000',
  'hex',
)
const MOD_ID = 'canary.lua.invincibility_potion'
const CONTENT_ID = '8068156596081641415'

const SCRIPT = `
local DURATION_MS = 3 * 60 * 1000
local ITEM_KEY = "invincibility_potion"

sd.sprites.register(ITEM_KEY, "sprites/item.png", "sprites/item.bundle")
local potion = sd.items.register({
  key = ITEM_KEY,
  name = "Invincibility Potion",
  type = "potion",
  description = "Grants invincibility and infinite mana for 3 minutes.",
  icon = {atlas = ITEM_KEY, frame = 0},
  duration_ms = DURATION_MS,
  consume_vfx = {kind = "spell_glow", color = {0.15, 1.0, 0.25, 1.0}},
  on_consume = function(event)
    local restored, result = sd.player.restore_mana()
    if not restored then error("failed to restore mana: " .. tostring(result)) end
  end,
})
sd.loot.register({item = potion.id, chance = 0.5, boss_chance = 1.0})

local active_effects = {}
local function clear_effects()
  for _, effect in pairs(active_effects) do sd.timer.cancel(effect.timer_id) end
  active_effects = {}
end
sd.events.on("item.consumed", function(event)
  if event.content_id ~= potion.id then return end
  local participant_id = event.participant_id
  local previous = active_effects[participant_id]
  if previous ~= nil then sd.timer.cancel(previous.timer_id) end
  local effect = {use_id = event.use_id}
  active_effects[participant_id] = effect
  effect.timer_id = sd.timer.after(event.duration_ms, function()
    if active_effects[participant_id] == effect then active_effects[participant_id] = nil end
  end)
end)
sd.events.on("run.started", clear_effects)
sd.events.on("run.ended", clear_effects)
sd.events.filter("damage.taken", function(event)
  if event.target_participant_id ~= nil and active_effects[event.target_participant_id] ~= nil then
    return false
  end
end)
sd.events.filter("mana.changing", function(event)
  if event.delta < 0 and event.participant_id ~= nil and active_effects[event.participant_id] ~= nil then
    return {delta = 0}
  end
end)
return potion.id
`

test('Invincibility Potion registers, rolls, consumes for a guest, filters, and clears', async () => {
  assert.equal(stableWebLuaContentId(MOD_ID, 'invincibility_potion'), CONTENT_ID)
  const source = modSource()
  const registry = new WebLuaContentRegistry()
  const current = frame()
  const runtime = await WebLuaRuntime.create({
    bindings: {
      getAuthorityPlayerId: () => current.authorityPlayerId,
      getFrame: () => current,
    },
    contentRegistry: registry,
    mod: source.identity,
    modSource: source,
    now: () => 0,
    wasmPath,
  })
  try {
    runtime.runEntrypoint(SCRIPT)
    assert.equal(runtime.metrics.callbackCount, 5)
    assert.throws(() => runtime.runEntrypoint('return true'), /already ran/)
    assert.equal(registry.catalog()[0]?.content.contentId, CONTENT_ID)
    assert.equal(registry.catalog()[0]?.nativeSubtype, 6)
    assert.equal(registry.createLootItems(1, 'DEMON')[0]?.modContent?.contentId, CONTENT_ID)
    assert.ok(Array.from({ length: 64 }, (_, seed) => (
      registry.createLootItems(seed, 'SKELETON').length
    )).includes(0))
    assert.ok(Array.from({ length: 64 }, (_, seed) => (
      registry.createLootItems(seed, 'SKELETON').length
    )).includes(1))

    runtime.beginTick(1)
    const extensions = createWebLuaGameExtensions(registry, [runtime])
    const content = registry.catalog()[0]!.content
    dispatchWebLuaConsumption(registry, [runtime], {
      content,
      playerId: 'guest',
      tick: 1,
      useId: 1,
    })
    assert.deepEqual(runtime.drainCommands(), [{
      amount: 90,
      playerId: 'guest',
      type: 'restore-mana',
    }])
    const filteredDamage = extensions.filterDamage({
      amount: 12,
      damageKind: 'physical',
      sourceActorId: 7,
      targetPlayerId: 'guest',
      tick: 1,
    })
    assert.equal(filteredDamage, 0)
    assert.equal(extensions.filterDamage({
      amount: 12,
      damageKind: 'physical',
      sourceActorId: 7,
      targetPlayerId: 'leader',
      tick: 1,
    }), 12)
    assert.equal(extensions.filterMana({
      currentMana: 100,
      delta: -25,
      maximumMana: 100,
      playerId: 'guest',
      source: 'primary-cast',
      tick: 1,
    }), 0)

    runtime.dispatch('run.ended', {
      event: 'run.ended',
      reason: 'ended',
      run_id: 'run-one',
      tick: 2,
    })
    assert.equal(extensions.filterDamage({
      amount: 12,
      damageKind: 'poison',
      sourceActorId: null,
      targetPlayerId: 'guest',
      tick: 2,
    }), 12)
    assert.equal(runtime.metrics.timerCount, 0)
  } finally {
    runtime.close()
    registry.close()
  }
})

test('failed entrypoint rolls back every partial content registration', async () => {
  const source = modSource()
  const registry = new WebLuaContentRegistry()
  const current = frame()
  const runtime = await WebLuaRuntime.create({
    bindings: {
      getAuthorityPlayerId: () => current.authorityPlayerId,
      getFrame: () => current,
    },
    contentRegistry: registry,
    mod: source.identity,
    modSource: source,
    now: () => 0,
    wasmPath,
  })
  try {
    assert.throws(() => runtime.runEntrypoint(`
      sd.sprites.register('item', 'sprites/item.png', 'sprites/item.bundle')
      error('entrypoint failed')
    `), /entrypoint failed/)
    assert.deepEqual(registry.catalog(), [])
  } finally {
    runtime.close()
    registry.close()
  }
})

function modSource(): WebLuaModSource {
  return {
    entryScript: SCRIPT,
    files: {
      'sprites/item.bundle': BUNDLE,
      'sprites/item.png': PNG,
    },
    identity: { id: MOD_ID, name: 'Invincibility Potion', version: '0.3.0' },
    requiredCapabilities: [
      'events.filters.damage',
      'events.filters.resources',
      'items.consumables.register',
      'loot.register',
      'player.resources.owner',
      'sprites.local.read',
      'sprites.local.register',
      'timer.local.scheduler',
    ],
  }
}

function frame(): WebLuaFrameState {
  return {
    authorityPlayerId: 'leader',
    boneyardSeed: '1'.repeat(32),
    enemies: [],
    multiplayer: true,
    phase: 'active',
    playerCount: 2,
    players: [
      player('leader', 100),
      player('guest', 10),
    ],
    runId: 'run-one',
    scene: 'Random Boneyard',
    tick: 0,
    waves: null,
    world: 'boneyard',
  }
}

function player(id: string, mana: number): WebLuaFrameState['players'][number] {
  return {
    currentHealth: 50,
    currentMana: mana,
    deathTick: 0,
    discipline: 'arcane',
    displayName: id,
    element: 'ether',
    experience: 0,
    gold: 0,
    id,
    level: 1,
    lifeState: 'alive',
    maximumHealth: 50,
    maximumMana: 100,
    pendingLevelUp: false,
    position: { x: 0, y: 0 },
  }
}
