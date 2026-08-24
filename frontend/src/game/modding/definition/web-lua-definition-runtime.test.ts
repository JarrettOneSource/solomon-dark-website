import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

import {
  compileWebLuaDefinition,
  WebLuaDefinitionError,
  WebLuaDefinitionRuntime,
  WEB_LUA_CONTENT_KINDS,
} from './index.ts'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('wasmoon/dist/glue.wasm')
const identity = Object.freeze({
  id: 'example.web.lua.one',
  name: 'Web Lua One',
  version: '1.0.0',
})

test('definition VM builds and compiles the complete family census without runtime globals', async () => {
  const output: string[] = []
  const runtime = await WebLuaDefinitionRuntime.create({
    entryScript: 'scripts/main.lua',
    identity,
    log: line => output.push(line),
    wasmPath,
  })
  try {
    const definition = runtime.run(`
      assert(io == nil and os == nil and package == nil and require == nil)
      local icon = sd.art.sprite("art/icon.png")
      local state = sd.schema.object({
        count = sd.schema.integer({default = 0, min = 0, max = 99}),
        phase = sd.schema.enum({"normal", "enraged"}),
      })
      local reducer = sd.advanced.reducer({
        key = "counter",
        scope = "party-run",
        schema_version = 1,
        state = state,
        on = {"enemy.death"},
        reduce = function(current, event, context)
          return {count = current.count + 1}, {}
        end,
      })
      print("definition loaded")
      return sd.mod({
        api = "1.0.0",
        assets = {icon = icon},
        content = {
          sd.kit.status({key = "status"}),
          sd.kit.item({key = "item", name = "Item", art = {icon = sd.art.ref("icon")}}),
          sd.kit.potion({
            key = "potion",
            name = "Potion",
            duration = "3m",
            on_use = sd.effect.status({status = sd.ref("status", "status")}),
          }),
          sd.kit.powerup({key = "powerup", name = "Powerup", effect = sd.effect.resource({mana = "full"})}),
          sd.kit.affix({key = "affix", name = "Affix", modifiers = {damage = 1}}),
          sd.kit.affix_pool({key = "affix_pool", entries = {{affix = sd.ref("affix", "affix"), weight = 1}}}),
          sd.kit.skill({key = "skill", name = "Skill", ranks = {{}}}),
          sd.kit.spell({
            key = "spell",
            name = "Spell",
            slot = "secondary",
            behavior = sd.prefab.area({radius = 100}),
          }),
          sd.kit.enemy({
            key = "enemy",
            name = "Enemy",
            base = "stock.skeleton",
            behavior = sd.prefab.enemy("ranged", {leash = 480}),
          }),
          sd.kit.boneyard({key = "boneyard", name = "Boneyard", source = "levels/test.boneyard"}),
          sd.kit.shop({key = "shop", name = "Shop", stock = {}}),
          sd.kit.ui({
            key = "ui",
            mount = "hud.top_right",
            view = sd.prefab.minimap({size = 220}),
          }),
          sd.kit.room({key = "room", geometry = sd.ref("boneyard", "boneyard")}),
          sd.kit.scene({
            key = "scene",
            instance = "party",
            rooms = {sd.ref("room", "room")},
          }),
          sd.kit.scene_extension({
            key = "scene_extension",
            scene = "stock.boneyard",
            features = {sd.prefab.portal({destination = sd.ref("scene", "scene")})},
          }),
        },
        rules = {
          sd.rules.on(
            "enemy.death",
            sd.rules.all({sd.effect.grant({item = sd.ref("item", "item")})}),
            {priority = 10}),
        },
        systems = {reducer},
      })
    `)
    const compiled = compileWebLuaDefinition(identity, definition)

    assert.equal(definition.content.length, WEB_LUA_CONTENT_KINDS.length)
    assert.deepEqual(
      new Set(definition.content.map(({ contentKind }) => contentKind)),
      new Set(WEB_LUA_CONTENT_KINDS),
    )
    assert.equal(compiled.assets[0]?.key, 'icon')
    assert.equal(compiled.reducers[0]?.key, 'counter')
    assert.equal(typeof runtime.reducer('counter')?.callback, 'function')
    assert.deepEqual(output, ['definition loaded'])
    assert.ok(runtime.memoryBytes > 0)
  } finally {
    runtime.close()
  }
  assert.equal(runtime.memoryBytes, 0)
})

test('definition VM rejects an entrypoint without one sd.mod definition', async () => {
  const runtime = await WebLuaDefinitionRuntime.create({
    entryScript: 'scripts/main.lua',
    identity,
    wasmPath,
  })
  try {
    assert.throws(() => runtime.run('return true'), /must return the receipt from sd\.mod/)
  } finally {
    runtime.close()
  }
})

test('definition VM rejects unknown root and reducer fields before retaining a graph', async () => {
  const runtime = await WebLuaDefinitionRuntime.create({
    entryScript: 'scripts/main.lua',
    identity,
    wasmPath,
  })
  try {
    assert.throws(() => runtime.run(`
      local reducer = sd.advanced.reducer({
        key = "bad",
        scope = "party-run",
        schema_version = 1,
        state = sd.schema.object({count = sd.schema.integer({default = 0})}),
        on = {"enemy.death"},
        reduce = function(state) return state, {} end,
        surprise = true,
      })
      return sd.mod({api = "1.0.0", systems = {reducer}})
    `), /unknown fields: surprise/)
    assert.equal(runtime.reducer('bad'), null)
  } finally {
    runtime.close()
  }
})

test('compiler collects actionable diagnostics for messy junior potion input', async () => {
  const runtime = await WebLuaDefinitionRuntime.create({
    entryScript: 'scripts/main.lua',
    identity,
    wasmPath,
  })
  try {
    const definition = runtime.run(`
      return sd.mod({
        api = "1.0.0",
        content = {
          sd.kit.potion({
            key = "god potoin",
            name = "God Potion",
            duration = "3 minutes maybe",
            stacking = "both",
            loot = {ordinary = 500},
            on_use = sd.ref("status", "invincble"),
            mystery = true,
          }),
        },
      })
    `)
    assert.throws(
      () => compileWebLuaDefinition(identity, definition),
      (error: unknown) => {
        assert.ok(error instanceof WebLuaDefinitionError)
        assert.ok(error.issues.some(({ code }) => code === 'E_CONTENT_KEY'))
        assert.ok(error.issues.some(({ code, path }) => (
          code === 'E_SCHEMA' && path.endsWith('.duration')
        )))
        assert.ok(error.issues.some(({ code, path }) => (
          code === 'E_SCHEMA' && path.endsWith('.stacking')
        )))
        assert.ok(error.issues.some(({ code, path }) => (
          code === 'E_SCHEMA' && path.endsWith('.loot.ordinary')
        )))
        assert.ok(error.issues.some(({ code }) => code === 'E_REFERENCE'))
        assert.ok(error.issues.some(({ code }) => code === 'E_UNKNOWN_FIELD'))
        return true
      },
    )
  } finally {
    runtime.close()
  }
})
