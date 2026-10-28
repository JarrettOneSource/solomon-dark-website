import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

import {
  bundleWebLuaEntryScript,
  compileWebLuaDefinition,
  WebLuaDefinitionError,
  WebLuaDefinitionRuntime,
  type WebLuaDefinitionIssue,
} from './index.ts'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('wasmoon/dist/glue.wasm')
const identity = Object.freeze({
  id: 'example.web.lua.friendly',
  name: 'Friendly',
  version: '1.0.0',
})

const EXPLICIT_POTION = `
local icon = sd.art.sprite("art/invincibility_potion.png")

return sd.mod({
  api = "1.0.0",
  assets = {invincibility_potion = icon},
  content = {
    sd.kit.status({
      key = "invincible",
      duration = "3m",
      stacking = "refresh",
      modifiers = {incoming_damage = 0, mana_spend = 0},
    }),
    sd.kit.potion({
      key = "invincibility_potion",
      name = "Invincibility Potion",
      description = "Grants invincibility and unlimited mana for 3 minutes.",
      duration = "3m",
      status = sd.ref("status", "invincible"),
      on_use = sd.rules.all({
        sd.effect.resource({target = "user", mana = "full"}),
        sd.effect.status({target = "user", status = sd.ref("status", "invincible")}),
      }),
      loot = {ordinary = 0.5, boss = 1.0},
      art = {icon = sd.art.ref("invincibility_potion")},
    }),
  },
})
`

const FRIENDLY_POTION = `
local invincible = sd.status({
  key = "invincible",
  duration = "3m",
  stacking = "refresh",
  modifiers = {incoming_damage = 0, mana_spend = 0},
})

sd.potion({
  name = "Invincibility Potion",
  description = "Grants invincibility and unlimited mana for 3 minutes.",
  status = invincible,
  on_use = sd.all(
    sd.effect.resource({target = "user", mana = "full"}),
    sd.effect.status({target = "user", status = "invincible"})
  ),
  loot = {ordinary = 0.5, boss = 1.0},
  icon = "art/invincibility_potion.png",
})
`

async function createRuntime(scripts?: ReadonlyMap<string, string>): Promise<WebLuaDefinitionRuntime> {
  return WebLuaDefinitionRuntime.create({
    entryScript: 'scripts/main.lua',
    identity,
    scripts,
    wasmPath,
  })
}

async function compileScript(code: string, scripts?: ReadonlyMap<string, string>) {
  const runtime = await createRuntime(scripts)
  try {
    return compileWebLuaDefinition(identity, runtime.run(code))
  } finally {
    runtime.close()
  }
}

async function issuesOf(code: string, scripts?: ReadonlyMap<string, string>): Promise<readonly WebLuaDefinitionIssue[]> {
  const runtime = await createRuntime(scripts)
  try {
    compileWebLuaDefinition(identity, runtime.run(code))
  } catch (error) {
    if (error instanceof WebLuaDefinitionError) return error.issues
    throw error
  } finally {
    runtime.close()
  }
  assert.fail(`expected a definition error for:\n${code}`)
}

test('friendly style compiles to the same graph digest as the explicit style', async () => {
  const explicit = await compileScript(EXPLICIT_POTION)
  const friendly = await compileScript(FRIENDLY_POTION)
  assert.equal(friendly.canonicalJson, explicit.canonicalJson)
  assert.equal(friendly.graphSha256, explicit.graphSha256)
  assert.deepEqual(friendly.content.map(({ key }) => key), ['invincibility_potion', 'invincible'])
  assert.deepEqual(friendly.assets.map(({ key }) => key), ['invincibility_potion'])
})

test('friendly style collects content, strings as references, art paths, and loose rules', async () => {
  const compiled = await compileScript(`
    local page = sd.sound("audio/bookOpen.ogg", {key = "page_sound", volume = 0.45})
    sd.item({name = "Moondust", description = "Ground moon.", stack = {maximum = 20}, icon = "art/information.png"})
    sd.status({key = "warded", duration = "20s", modifiers = {incoming_damage = {multiply = 0.75}}})
    sd.potion({
      name = "Ward Tonic",
      status = "warded",
      on_use = {
        sd.effect.resource({target = "user", mana = 15}),
        sd.effect.present({sound = page}),
      },
      icon = "art/star.png",
    })
    sd.shop({
      name = "Apothecary",
      mount = {scene = "hub.courtyard", x = 1510, y = 665},
      npc = {name = "Pip"},
      stock = {
        {item = "moondust", price = 8, quantity = 5},
        {item = "ward_tonic", price = 30, quantity = 2},
      },
      npc_art = nil,
    })
    sd.on("run.started", sd.effect.grant({target = "user", item = "moondust", quantity = 1}))
    sd.on("wave.completed",
      sd.when({context = "wave", at_least = 5}, sd.effect.present({sound = "audio/bookOpen.ogg"})),
      sd.every("2s", sd.effect.resource({target = "user", mana = 1}), 3)
    )
  `)
  assert.deepEqual(
    compiled.content.map(({ contentKind, key }) => `${contentKind}:${key}`).sort(),
    ['item:moondust', 'potion:ward_tonic', 'shop:apothecary', 'status:warded'],
  )
  assert.deepEqual(compiled.assets.map(({ key }) => key), ['bookopen', 'information', 'page_sound', 'star'])
  assert.equal(compiled.rules.length, 2)
  const potion = compiled.content.find(({ key }) => key === 'ward_tonic')
  assert.equal(potion?.fields.duration, '20s')
  const onUse = potion?.fields.on_use as { operation?: string; fields?: { nodes?: unknown[] } }
  assert.equal(onUse.operation, 'rules.all')
  assert.equal(onUse.fields?.nodes?.length, 2)
  const stock = (compiled.content.find(({ key }) => key === 'apothecary')?.fields.stock as Array<{ item: { targetKind: string } }>)
  assert.deepEqual(stock.map(({ item }) => item.targetKind), ['item', 'potion'])
})

test('explicit sd.mod lists, registry extras, and shared asset shapes combine in one graph', async () => {
  const compiled = await compileScript(`
    local icon = sd.sprite("art/icon.png")
    local ring = sd.item({name = "Ring", art = {icon = icon}})
    sd.item({name = "Extra", icon = "art/icon.png"})
    return sd.mod({
      api = "1.0.0",
      assets = {icon = icon},
      content = {ring},
    })
  `)
  assert.deepEqual(compiled.assets.map(({ key }) => key), ['icon'])
  assert.deepEqual(compiled.content.map(({ key }) => key), ['extra', 'ring'])
})

test('script errors carry the file, the line, and a hint', async () => {
  const syntax = await issuesOf(`sd.item({
  name = "Broken",
  icon = "art/icon.png"
}
`)
  assert.equal(syntax[0]?.code, 'E_SCRIPT')
  assert.equal(syntax[0]?.source.file, 'scripts/main.lua')
  assert.ok((syntax[0]?.source.line ?? 0) > 0)
  assert.match(syntax[0]?.message ?? '', /braces/)

  const nilCall = await issuesOf('local thing = nil\nthing()\n')
  assert.equal(nilCall[0]?.code, 'E_SCRIPT')
  assert.equal(nilCall[0]?.source.line, 2)
  assert.match(nilCall[0]?.message ?? '', /attempt to call a nil value/)

  const member = await issuesOf('sd.kit.potio({name = "Typo"})\n')
  assert.match(member[0]?.message ?? '', /sd\.kit\.potio is not part of Web Lua 1\.0; did you mean sd\.kit\.potion\?/)

  const alias = await issuesOf('item({name = "Typo"})\n')
  assert.match(alias[0]?.message ?? '', /'item' is not defined; did you mean sd\.item\?/)

  const loader = await issuesOf('local other = require("other")\n')
  assert.match(loader[0]?.message ?? '', /require is not available inside Web Lua mods; use sd\.include/)

  const returned = await issuesOf('sd.item({name = "Thing"})\nreturn 5\n')
  assert.equal(returned[0]?.code, 'E_GRAPH')
  assert.match(returned[0]?.message ?? '', /unexpected value/)

  const nothing = await issuesOf('local unused = 1\n')
  assert.equal(nothing[0]?.code, 'E_GRAPH')
  assert.match(nothing[0]?.message ?? '', /defined nothing/)

  const loose = await issuesOf('sd.item({name = "Thing"})\nsd.effect.state({key = "x", value = true})\n')
  assert.equal(loose[0]?.code, 'E_GRAPH')
  assert.match(loose[0]?.message ?? '', /sd\.effect\.state was created but never attached/)

  const slow = await issuesOf('while true do end\n')
  assert.equal(slow[0]?.code, 'E_BUDGET')
  assert.match(slow[0]?.message ?? '', /250 ms/)
})

test('definition globals and every sd namespace are actually read-only', async () => {
  const cases = [
    ['accidental_global = 42\n', /global 'accidental_global' cannot be assigned; write local accidental_global =/],
    ['sd = nil\n', /global 'sd' cannot be assigned/],
    ['print = nil\n', /global 'print' cannot be assigned/],
    ['_G.sd = nil\n', /global 'sd' cannot be assigned/],
    ['sd.item = sd.potion\n', /sd\.item cannot be assigned/],
    ['sd.effect.grant = sd.effect.damage\n', /sd\.effect\.grant cannot be assigned/],
    ['rawset(sd, "item", sd.potion)\n', /rawset is not available inside Web Lua mods/],
    ['setmetatable(sd, nil)\n', /cannot change a protected metatable/],
  ] as const

  for (const [code, message] of cases) {
    const issues = await issuesOf(code)
    assert.equal(issues[0]?.code, 'E_SCRIPT')
    assert.equal(issues[0]?.source.file, 'scripts/main.lua')
    assert.equal(issues[0]?.source.line, 1)
    assert.match(issues[0]?.message ?? '', message)
  }
})

test('friendly lowering rejects malformed art, reference typos, and invalid predicates', async () => {
  const art = await issuesOf('sd.item({name = "Thing", art = 5, icon = "art/icon.png"})\n')
  assert.ok(art.some(({ code, message }) => (
    code === 'E_SCHEMA' && /art must be a table/.test(message)
  )))

  const ruleEnemy = await issuesOf(`
    sd.enemy({name = "Grave Keeper"})
    sd.on("run.started", sd.effect.spawn({enemy = "grave_keper", x = 1, y = 1}))
  `)
  assert.ok(ruleEnemy.some(({ code, message }) => (
    code === 'E_REFERENCE' && /unknown enemy reference .*grave_keper; did you mean grave_keeper\?/.test(message)
  )))

  const rosterEnemy = await issuesOf(`
    sd.enemy({name = "Grave Keeper"})
    sd.boneyard({name = "Yard", source = "levels/yard.boneyard", roster = {"grave_keper"}})
  `)
  assert.ok(rosterEnemy.some(({ code, message }) => (
    code === 'E_REFERENCE' && /unknown enemy reference .*grave_keper; did you mean grave_keeper\?/.test(message)
  )))

  const shopUnion = await issuesOf(`
    sd.potion({
      name = "Health Tonic",
      duration = "1s",
      on_use = sd.effect.resource({target = "user", health = 1}),
      icon = "art/tonic.png",
    })
    sd.shop({name = "Shop", stock = {{item = "health_tonci", price = 1}}})
  `)
  assert.ok(shopUnion.some(({ code, message }) => (
    code === 'E_REFERENCE' && /unknown potion reference .*health_tonci; did you mean health_tonic\?/.test(message)
  )))

  const grantUnion = await issuesOf(`
    sd.ui({
      key = "quest_panel",
      mount = "hud.overlay",
      view = sd.prefab.minimap({range = 100, size = {width = 100, height = 100}}),
    })
    sd.skill({name = "Quest Skill", ranks = {{grant = "quest_pnael"}}})
  `)
  assert.ok(grantUnion.some(({ code, message }) => (
    code === 'E_REFERENCE' && /unknown ui reference .*quest_pnael; did you mean quest_panel\?/.test(message)
  )))

  const event = await issuesOf(`
    sd.on("run.started", sd.when(
      {event = "run.start"},
      sd.effect.state({key = "seen", value = true})
    ))
  `)
  assert.ok(event.some(({ code, message }) => (
    code === 'E_SCHEMA' && /unknown event "run\.start"; did you mean run\.started\?/.test(message)
  )))

  const comparison = await issuesOf(`
    sd.on("run.started", sd.when(
      {context = "wave", equals = {1}},
      sd.effect.state({key = "seen", value = true})
    ))
  `)
  assert.ok(comparison.some(({ code, message }) => (
    code === 'E_SCHEMA' && /equals must be boolean, number, or string/.test(message)
  )))

  const extraInvalidSubject = await issuesOf(`
    sd.on("run.started", sd.when(
      {event = 5, all = {{context = "wave"}}},
      sd.effect.state({key = "seen", value = true})
    ))
  `)
  assert.ok(extraInvalidSubject.some(({ code, message }) => (
    code === 'E_SCHEMA' && /requires exactly one/.test(message)
  )))
  assert.ok(extraInvalidSubject.some(({ code, path }) => (
    code === 'E_SCHEMA' && path.endsWith('.event')
  )))

  const stock = await compileScript(`
    sd.on("run.started", sd.effect.spawn({enemy = "stock.skeleton", x = 1, y = 1}))
  `)
  const on = stock.rules[0]?.fields.node as { fields?: { enemy?: unknown } }
  assert.equal(on.fields?.enemy, 'SKELETON')

  const localNamedLikeStock = await compileScript(`
    sd.enemy({key = "skeleton", name = "Clockwork Skeleton"})
    sd.on("run.started", sd.effect.spawn({enemy = "skeleton", x = 1, y = 1}))
  `)
  const localOn = localNamedLikeStock.rules[0]?.fields.node as {
    fields?: { enemy?: { key?: unknown; targetKind?: unknown } }
  }
  assert.equal(localOn.fields?.enemy?.key, 'skeleton')
  assert.equal(localOn.fields?.enemy?.targetKind, 'enemy')

  const stockTypo = await issuesOf(`
    sd.on("run.started", sd.effect.spawn({token = "SKELETONN", x = 1, y = 1}))
  `)
  assert.ok(stockTypo.some(({ code, message }) => (
    code === 'E_REFERENCE' && /unknown stock enemy SKELETONN; did you mean SKELETON\?/.test(message)
  )))
})

test('compile issues point at the line that created the definition', async () => {
  const issues = await issuesOf(`
    sd.item({name = "Fine"})
    sd.item({key = "Bad Key", name = "Bad"})
    sd.potion({name = "Bad Potion", duration = "soon", on_use = sd.effect.resource({target = "user", mana = 1})})
  `)
  const key = issues.find(({ code }) => code === 'E_CONTENT_KEY')
  assert.equal(key?.source.line, 3)
  const duration = issues.find(({ path }) => path.endsWith('.duration'))
  assert.equal(duration?.source.line, 4)
})

test('sd.include loads package scripts once and packs into one equivalent entry script', async () => {
  const scripts = new Map([
    ['scripts/items.lua', 'local items = {}\nitems.stone = sd.item({name = "Moon Stone", icon = "art/stone.png"})\nreturn items\n'],
    ['scripts/loops/a.lua', 'return sd.include("scripts/loops/b.lua")\n'],
    ['scripts/loops/b.lua', 'return sd.include("scripts/loops/a.lua")\n'],
    ['scripts/broken.lua', 'local thing = nil\nthing()\n'],
    ['scripts/global.lua', 'included_global = true\n'],
  ])
  const main = `
    local items = sd.include("scripts/items.lua")
    local again = sd.include("scripts/items.lua")
    assert(items == again, "include caches")
    sd.potion({
      name = "Stone Tonic",
      duration = "1s",
      on_use = sd.effect.grant({target = "user", item = items.stone}),
    })
  `
  const compiled = await compileScript(main, scripts)
  assert.deepEqual(compiled.content.map(({ key }) => key), ['moon_stone', 'stone_tonic'])
  const bundled = await compileScript(bundleWebLuaEntryScript(main, scripts))
  assert.equal(bundled.graphSha256, compiled.graphSha256)

  const missing = await issuesOf('sd.include("scripts/item.lua")\n', scripts)
  assert.equal(missing[0]?.code, 'E_SCRIPT')
  assert.match(missing[0]?.message ?? '', /did you mean scripts\/items\.lua/)

  const cycle = await issuesOf('sd.include("scripts/loops/a.lua")\n', scripts)
  assert.match(cycle[0]?.message ?? '', /cycle/)

  const self = await issuesOf('sd.include("scripts/main.lua")\n', scripts)
  assert.match(self[0]?.message ?? '', /cannot include itself/)

  const broken = await issuesOf('sd.include("scripts/broken.lua")\n', scripts)
  assert.equal(broken[0]?.source.file, 'scripts/broken.lua')
  assert.equal(broken[0]?.source.line, 2)

  const global = await issuesOf('sd.include("scripts/global.lua")\n', scripts)
  assert.equal(global[0]?.source.file, 'scripts/global.lua')
  assert.equal(global[0]?.source.line, 1)
  assert.match(global[0]?.message ?? '', /global 'included_global' cannot be assigned/)

  const ordinaryMarkerComment = await compileScript(`
    --@sd-bundle this is an ordinary comment, not trailing package metadata
    sd.item({name = "Marker Note"})
  `)
  assert.deepEqual(ordinaryMarkerComment.content.map(({ key }) => key), ['marker_note'])
})
