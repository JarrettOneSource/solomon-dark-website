import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

import {
  createGameSimulation,
  getPlayerProgression,
} from '../core-server/game-simulation.ts'
import { setPlayerEntityMana } from '../core-server/player-entity-store.ts'
import {
  compileWebLuaDefinition,
  WebLuaDefinitionRuntime,
} from '../modding/definition/index.ts'
import type { MaterializedWebSessionContent } from './web-mod-content.ts'
import { prepareModHost } from './prepared-mod-host.ts'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('wasmoon/dist/glue.wasm')
const identity = Object.freeze({ id: 'example.host-content', name: 'Host Content', version: '1.0.0' })
const SCRIPT = `
local icon = sd.art.sprite("art/icon.png")
local status = sd.kit.status({
  key = "invincible",
  duration = "100ms",
  stacking = "refresh",
  modifiers = {incoming_damage = 0, mana_spend = 0},
})
local potion = sd.kit.potion({
  key = "invincibility_potion",
  name = "Invincibility Potion",
  duration = "100ms",
  status = sd.ref("status", "invincible"),
  on_use = sd.rules.all({
    sd.effect.resource({target = "user", mana = "full"}),
    sd.effect.status({target = "user", status = sd.ref("status", "invincible")}),
  }),
  loot = {ordinary = 1, boss = 1},
  art = {icon = sd.art.ref("icon")},
})
local powerup = sd.kit.powerup({
  key = "survey_orb",
  name = "Survey Orb",
  effect = sd.effect.resource({target = "collector", mana = "full"}),
  pickup = {radius = 40},
  art = {world = sd.art.ref("icon")},
})
local spell = sd.kit.spell({
  key = "gravity_well",
  name = "Gravity Well",
  slot = "secondary",
  mana = 30,
  cooldown = "1s",
  behavior = sd.prefab.area({radius = 180}),
  art = {icon = sd.art.ref("icon")},
})
local spawn_powerup = sd.rules.on("run.started", sd.effect.spawn({
  content = sd.ref("powerup", "survey_orb"),
  x = 10000,
  y = 10000,
}))
return sd.mod({
  api = "1.0.0",
  assets = {icon = icon},
  content = {status, potion, powerup, spell},
  rules = {spawn_powerup},
})
`

test('prepared host consumes a 1.0 potion atomically and owns status filters and expiry', async () => {
  const content = await materialized()
  let state = createGameSimulation({
    'player-1': {
      discipline: 'arcane',
      displayName: 'Tester',
      element: 'ether',
    },
  })
  state = {
    ...state,
    playerEntities: setPlayerEntityMana(state.playerEntities, 'player-1', 0),
  }
  const host = await prepareModHost({
    content,
    state: {
      read: () => state,
      write: candidate => { state = candidate },
    },
    wasmPath,
  })
  try {
    const potion = host.content.consumables()[0]!
    const result = host.consume({
      content: potion.content,
      playerId: 'player-1',
      tick: 10,
      useId: 1,
    })
    assert.equal(result.accepted, true)
    assert.equal(getPlayerProgression(state, 'player-1').currentMana, 100)
    const spell = host.content.all().find(entry => entry.contentKind === 'spell')!
    assert.equal(host.cast({
      contentId: spell.contentId,
      playerId: 'player-1',
      requestId: 2,
    }).accepted, true)
    assert.equal(getPlayerProgression(state, 'player-1').currentMana, 100)
    assert.equal(host.drainPresentation()[0]?.fields.prefab, 'area')
    assert.equal(host.extensions.filterDamage({
      amount: 20,
      damageKind: 'physical',
      sourceActorId: null,
      targetPlayerId: 'player-1',
      tick: 11,
    }), 0)
    assert.equal(host.extensions.createLootItems({ actorSeed: 1, enemyToken: 'SKELETON' }).length, 1)
    assert.equal(host.checkpoint().statuses.instances.length, 1)
    const started = host.step([{
      name: 'run.started',
      payload: { run_id: 'run-1' },
    }], 12, 'run-1')
    assert.equal(started.accepted, true, started.errors.join('; '))
    assert.equal(
      host.project().powerups[0]?.contentId,
      host.content.all().find(entry => entry.contentKind === 'powerup')?.contentId,
    )
    host.tick(20)
    assert.equal(host.extensions.filterDamage({
      amount: 20,
      damageKind: 'physical',
      sourceActorId: null,
      targetPlayerId: 'player-1',
      tick: 20,
    }), 20)
  } finally {
    host.close()
  }
})

async function materialized(): Promise<MaterializedWebSessionContent> {
  const runtime = await WebLuaDefinitionRuntime.create({
    entryScript: 'scripts/main.lua',
    identity,
    wasmPath,
  })
  const compiled = (() => {
    try {
      return compileWebLuaDefinition(identity, runtime.run(SCRIPT))
    } finally {
      runtime.close()
    }
  })()
  const bytes = png(53, 50)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  return {
    assets: [{
      byteLength: bytes.length,
      contentType: 'image/png',
      kind: 'image',
      modId: identity.id,
      path: 'art/icon.png',
      sha256,
    }],
    boneyards: [],
    compiledMods: [compiled],
    manifest: {
      manifestSha256: '1'.repeat(64),
      mods: [{ contentSha256: '2'.repeat(64), id: identity.id, version: identity.version }],
    },
    modSources: [{
      entryScript: SCRIPT,
      files: { 'art/icon.png': bytes },
      identity,
      requiredCapabilities: [],
    }],
    summary: {
      manifestSha256: '1'.repeat(64),
      mods: [{
        assets: [],
        contentSha256: '2'.repeat(64),
        graphSha256: compiled.graphSha256,
        id: identity.id,
        name: identity.name,
        slug: 'host-content',
        version: identity.version,
      }],
    },
  }
}

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}
