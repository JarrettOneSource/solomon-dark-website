import { createRequire } from 'node:module'
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { LuaFactory } from 'wasmoon'

import {
  checkWebLuaPackage,
  WEB_LUA_CONTENT_KINDS,
  WEB_LUA_CONTENT_SCHEMA_FIELDS,
  WEB_LUA_DEFINITION_API_VERSION,
} from '../../src/game/modding/definition/index.ts'
import { writeDeterministicZip } from './zip.mjs'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('wasmoon/dist/glue.wasm')

export async function runSdmod(argv, io = console) {
  const [command, ...args] = argv
  switch (command) {
    case 'new': return newMod(args, io)
    case 'check': return checkMod(args, io)
    case 'test': return testMod(args, io)
    case 'pack': return packMod(args, io)
    case 'migrate': return migrateMod(args, io)
    case 'generate': return generateReference(args, io)
    default: throw new Error(usage())
  }
}

async function newMod(args, io) {
  const [kind = 'item', target] = args
  if (!target || !WEB_LUA_CONTENT_KINDS.includes(normalizeKind(kind))) throw new Error(usage())
  const root = resolve(target)
  await requireEmptyDirectory(root)
  await mkdir(join(root, 'scripts'), { recursive: true })
  const id = canonicalId(basename(root))
  const contentKind = normalizeKind(kind)
  await writeFile(join(root, 'manifest.json'), `${JSON.stringify({
    $schema: '/mod-manifest.schema.json',
    id,
    name: displayName(id),
    version: '1.0.0',
    runtime: {
      apiVersion: WEB_LUA_DEFINITION_API_VERSION,
      entryScript: 'scripts/main.lua',
    },
    requiredMods: [],
  }, null, 2)}\n`)
  await writeFile(join(root, 'scripts/main.lua'), template(contentKind, displayName(id)))
  io.log(`Created ${contentKind} mod at ${root}`)
}

async function checkMod(args, io) {
  const [target] = args
  if (!target) throw new Error(usage())
  const checked = await checkWebLuaPackage(resolve(target), wasmPath)
  io.log(JSON.stringify(summary(checked), null, 2))
  return checked
}

async function testMod(args, io) {
  const checked = await checkMod(args, { log: () => {} })
  const testsRoot = join(checked.root, 'tests')
  let entries = []
  try {
    entries = (await readdir(testsRoot)).filter(path => path.endsWith('.lua')).sort()
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  for (const entry of entries) await runLuaTest(join(testsRoot, entry), entry)
  io.log(JSON.stringify({ ...summary(checked), tests: entries.length }, null, 2))
}

async function packMod(args, io) {
  const [target, output] = args
  if (!target || !output) throw new Error(usage())
  const checked = await checkWebLuaPackage(resolve(target), wasmPath)
  const files = await packageEntries(checked.root)
  files.set('compiled/graph.json', Buffer.from(`${checked.compiled.canonicalJson}\n`))
  files.set('compiled/graph.sha256', Buffer.from(`${checked.compiled.graphSha256}\n`))
  const outputPath = resolve(output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeDeterministicZip(outputPath, files)
  io.log(JSON.stringify({ ...summary(checked), output: outputPath }, null, 2))
}

async function migrateMod(args, io) {
  const [sourceArg, targetArg] = args
  if (!sourceArg || !targetArg) throw new Error(usage())
  const source = resolve(sourceArg)
  const target = resolve(targetArg)
  const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'))
  if (manifest.id !== 'canary.lua.invincibility_potion') {
    throw new Error('automatic migration currently supports only canary.lua.invincibility_potion')
  }
  await requireEmptyDirectory(target)
  await mkdir(join(target, 'scripts'), { recursive: true })
  await mkdir(join(target, 'art'), { recursive: true })
  await copyFile(
    join(source, 'sprites/invincibility_potion.png'),
    join(target, 'art/invincibility_potion.png'),
  )
  await copyFile(
    join(source, 'sprites/invincibility_potion.bundle'),
    join(target, 'art/invincibility_potion.bundle'),
  )
  await writeFile(join(target, 'manifest.json'), `${JSON.stringify({
    $schema: '/mod-manifest.schema.json',
    id: manifest.id,
    name: 'Invincibility Potion',
    version: manifest.version,
    runtime: {
      apiVersion: WEB_LUA_DEFINITION_API_VERSION,
      entryScript: 'scripts/main.lua',
    },
    requiredMods: [],
  }, null, 2)}\n`)
  await writeFile(join(target, 'scripts/main.lua'), invincibilityPotionTemplate())
  const checked = await checkWebLuaPackage(target, wasmPath)
  io.log(JSON.stringify({ ...summary(checked), migratedFrom: source }, null, 2))
}

async function generateReference(args, io) {
  const [targetArg, mode] = args
  if (!targetArg) throw new Error(usage())
  const target = resolve(targetArg)
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Solomon Dark Web Lua 1.0 definition inventory',
    apiVersion: WEB_LUA_DEFINITION_API_VERSION,
    content: Object.fromEntries(WEB_LUA_CONTENT_KINDS.map(kind => [
      kind,
      WEB_LUA_CONTENT_SCHEMA_FIELDS[kind],
    ])),
  }
  const generated = new Map([
    ['web-lua-definition.schema.json', `${JSON.stringify(schema, null, 2)}\n`],
    ['sd.lua', luaLsStub()],
    ['REFERENCE.md', referenceMarkdown()],
  ])
  if (mode === '--check') {
    for (const [path, expected] of generated) {
      const actual = await readFile(join(target, path), 'utf8')
      if (actual !== expected) throw new Error(`generated Web Lua author file is stale: ${path}`)
    }
    io.log(`Web Lua author reference is current at ${target}`)
    return
  }
  if (mode !== undefined) throw new Error(usage())
  await mkdir(target, { recursive: true })
  for (const [path, value] of generated) await writeFile(join(target, path), value)
  io.log(`Generated Web Lua author reference at ${target}`)
}

async function runLuaTest(path, name) {
  const factory = new LuaFactory(wasmPath)
  const engine = await factory.createEngine({ enableProxy: false, functionTimeout: 10, injectObjects: false })
  try {
    await engine.doString('io=nil; os=nil; package=nil; require=nil; debug=nil; load=nil; loadfile=nil; dofile=nil')
    const values = await engine.doString(await readFile(path, 'utf8'))
    if (values !== undefined && values !== true) throw new Error(`${name} must return true or no value`)
  } finally {
    engine.global.close()
  }
}

async function packageEntries(root) {
  const result = new Map()
  for (const path of await walk(root)) {
    if (path.startsWith('tests/') || path.startsWith('compiled/')) continue
    result.set(path, await readFile(join(root, path)))
  }
  return result
}

async function walk(root, directory = root) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await walk(root, path))
    else if (entry.isFile()) result.push(relative(root, path).split(sep).join('/'))
  }
  return result.sort()
}

async function requireEmptyDirectory(root) {
  try {
    const info = await stat(root)
    if (!info.isDirectory() || (await readdir(root)).length > 0) {
      throw new Error(`target must be an absent or empty directory: ${root}`)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    await mkdir(root, { recursive: true })
  }
}

function summary(checked) {
  return {
    apiVersion: checked.compiled.apiVersion,
    assets: checked.compiled.assets.length,
    capabilities: checked.compiled.capabilities,
    content: checked.compiled.content.length,
    graphSha256: checked.compiled.graphSha256,
    id: checked.manifest.id,
    reducers: checked.compiled.reducers.length,
    rules: checked.compiled.rules.length,
    version: checked.manifest.version,
  }
}

function normalizeKind(value) {
  return value.replaceAll('_', '-').toLowerCase()
}

function canonicalId(value) {
  const id = value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-._]+|[-._]+$/g, '')
  if (!id) throw new Error('target directory does not produce a valid mod id')
  return id
}

function displayName(value) {
  return value.split(/[._-]+/).map(word => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ')
}

function template(kind, name) {
  const fields = {
    affix: `name = ${JSON.stringify(name)}, modifiers = {damage = 1}`,
    'affix-pool': 'entries = {}',
    boneyard: `name = ${JSON.stringify(name)}, source = "levels/main.boneyard"`,
    enemy: `name = ${JSON.stringify(name)}, base = "stock.skeleton"`,
    item: `name = ${JSON.stringify(name)}`,
    potion: `name = ${JSON.stringify(name)}, duration = "30s", on_use = sd.effect.resource({mana = "full"})`,
    powerup: `name = ${JSON.stringify(name)}, effect = sd.effect.resource({mana = "full"})`,
    room: 'geometry = sd.ref("boneyard", "main_map")',
    scene: 'instance = "party", rooms = {}',
    'scene-extension': 'scene = "stock.boneyard", features = {}',
    shop: `name = ${JSON.stringify(name)}, stock = {}`,
    skill: `name = ${JSON.stringify(name)}, ranks = {{}}`,
    spell: `name = ${JSON.stringify(name)}, slot = "secondary", behavior = sd.prefab.area({radius = 100})`,
    status: '',
    ui: 'mount = "hud.top_right", view = sd.prefab.minimap({size = 220})',
  }
  return `return sd.mod({\n  api = "1.0.0",\n  content = {\n    sd.kit.${kind.replaceAll('-', '_')}({\n      key = "main",\n      ${fields[kind]}\n    }),\n  },\n})\n`
}

function invincibilityPotionTemplate() {
  return `local icon = sd.art.sprite("art/invincibility_potion.png")\n\nreturn sd.mod({\n  api = "1.0.0",\n  assets = {invincibility_potion = icon},\n  content = {\n    sd.kit.status({\n      key = "invincible",\n      duration = "3m",\n      stacking = "refresh",\n      modifiers = {incoming_damage = 0, mana_spend = 0},\n    }),\n    sd.kit.potion({\n      key = "invincibility_potion",\n      name = "Invincibility Potion",\n      description = "Grants invincibility and unlimited mana for 3 minutes.",\n      duration = "3m",\n      stacking = "refresh",\n      status = sd.ref("status", "invincible"),\n      on_use = sd.rules.all({\n        sd.effect.resource({target = "user", mana = "full"}),\n        sd.effect.status({target = "user", status = sd.ref("status", "invincible")}),\n      }),\n      loot = {ordinary = 0.5, boss = 1.0},\n      art = {icon = sd.art.ref("invincibility_potion")},\n    }),\n  },\n})\n`
}

function luaLsStub() {
  const kits = WEB_LUA_CONTENT_KINDS.map(kind => `---@field ${kind.replaceAll('-', '_')} fun(spec: table): table`).join('\n')
  return `---@meta\n\n---@class SdArt\n---@field boneyard fun(spec: table): table\n---@field music fun(path: string, options?: table): table\n---@field ref fun(key: string): table\n---@field scene fun(spec: table): table\n---@field sheet fun(spec: table): table\n---@field sound fun(path: string, options?: table): table\n---@field sprite fun(path: string, options?: table): table\n---@field wearable fun(path: string): table\n\n---@class SdKit\n${kits}\n\n---@class Sd\n---@field art SdArt\n---@field kit SdKit\n---@field mod fun(spec: table): table\n---@field ref fun(kind: string, key: string, mod_id?: string): table\n\n---@type Sd\nsd = {}\n`
}

function referenceMarkdown() {
  const rows = WEB_LUA_CONTENT_KINDS.map(kind => {
    const value = WEB_LUA_CONTENT_SCHEMA_FIELDS[kind]
    return `| \`${kind}\` | ${value.required.map(field => `\`${field}\``).join(', ') || 'none'} | ${value.allowed.map(field => `\`${field}\``).join(', ')} |`
  }).join('\n')
  return `# Web Lua 1.0 generated reference\n\nAPI: \`${WEB_LUA_DEFINITION_API_VERSION}\`\n\n## Art\n\n- \`sd.art.sprite(path, options)\` declares one PNG sprite.\n- \`sd.art.sheet(spec)\` declares an explicit PNG frame grid.\n- \`sd.art.wearable(path)\` declares a 170 px actor sheet for an existing hat, robe, or staff slot.\n- \`sd.art.sound(path, options)\` and \`sd.art.music(path, options)\` declare audio.\n- \`sd.art.scene(spec)\` and \`sd.art.boneyard(spec)\` declare document assets.\n- \`sd.art.ref(key)\` references a named asset from content.\n\n## Content\n\n| Kind | Required fields | Allowed fields |\n| --- | --- | --- |\n${rows}\n`
}

function usage() {
  return [
    'usage:',
    '  sdmod new <content-kind> <directory>',
    '  sdmod check <mod-directory>',
    '  sdmod test <mod-directory>',
    '  sdmod pack <mod-directory> <output.zip>',
    '  sdmod migrate <0.2-mod-directory> <1.0-directory>',
    '  sdmod generate <output-directory> [--check]',
  ].join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSdmod(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
