import { createHash } from 'node:crypto'
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
import { fileURLToPath, pathToFileURL } from 'node:url'

import { LuaFactory } from 'wasmoon'

import {
  checkWebLuaPackage,
  WEB_LUA_CONTENT_KINDS,
  WEB_LUA_CONTENT_SCHEMA_FIELDS,
  WEB_LUA_DEFINITION_ERROR_CODES,
  WEB_LUA_DEFINITION_API_VERSION,
  WEB_LUA_RULE_EVENT_NAMES,
  WEB_LUA_SCOPE_KINDS,
} from '../../src/game/modding/definition/index.ts'
import {
  compileModAssets,
} from '../../src/game/modding/assets/index.ts'
import {
  compileModContentCatalog,
} from '../../src/game/modding/content/index.ts'
import { projectModBoneyard } from '../../src/game/host/boneyard-catalog.ts'
import { writeDeterministicZip } from './zip.mjs'
import { runAssetCommand } from './assets.mjs'
import { renderSprite } from './render-sprite.mjs'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('wasmoon/dist/glue.wasm')
const RULES = ['on', 'all', 'first', 'when', 'after', 'every']
const EFFECTS = ['damage', 'resource', 'status', 'spawn', 'grant', 'state', 'present']
const PREFABS = ['projectile', 'area', 'channel', 'minimap', 'portal']
const SCHEMAS = ['boolean', 'integer', 'number', 'string', 'enum', 'array', 'object']

export async function runSdmod(argv, io = console) {
  const [command, ...args] = argv
  switch (command) {
    case 'new': return newMod(args, io)
    case 'assets': return runAssetCommand(args, io)
    case 'check': return checkMod(args, io)
    case 'test': return testMod(args, io)
    case 'pack': return packMod(args, io)
    case 'migrate': return migrateMod(args, io)
    case 'generate': return generateReference(args, io)
    case 'render-sprite': return renderSprite(args, io)
    default: throw new Error(usage())
  }
}

async function newMod(args, io) {
  const [target] = args
  if (!target || args.length !== 1) throw new Error(usage())
  const root = resolve(target)
  await requireEmptyDirectory(root)
  await mkdir(join(root, 'scripts'), { recursive: true })
  await mkdir(join(root, 'art'), { recursive: true })
  const id = canonicalId(basename(root))
  const name = displayName(id)
  await writeFile(join(root, 'manifest.json'), `${JSON.stringify({
    $schema: '/mod-manifest.schema.json',
    id,
    name,
    version: '1.0.0',
    runtime: {
      apiVersion: WEB_LUA_DEFINITION_API_VERSION,
      entryScript: 'scripts/main.lua',
    },
    requiredMods: [],
  }, null, 2)}\n`)
  await writeFile(join(root, 'scripts/main.lua'), starterModTemplate(name))
  await copyFile(
    fileURLToPath(new URL('../../examples/web-lua/apprentice-apothecary/art/star.png', import.meta.url)),
    join(root, 'art/icon.png'),
  )
  await writeFile(join(root, 'THIRD_PARTY_ASSETS.md'), `# Third-party assets

- \`art/icon.png\`: Kenney Game Icons, CC0 1.0, https://kenney.nl/assets/game-icons
`)
  const checked = await checkWebLuaPackage(root, wasmPath)
  admitPreparedPackage(checked)
  io.log(`Created valid starter mod at ${root}`)
}

async function checkMod(args, io) {
  const [target] = args
  if (!target) throw new Error(usage())
  const checked = await checkWebLuaPackage(resolve(target), wasmPath)
  admitPreparedPackage(checked)
  io.log(JSON.stringify(summary(checked), null, 2))
  return checked
}

export function admitPreparedPackage(checked) {
  const identity = {
    id: checked.manifest.id,
    name: checked.manifest.name,
    version: checked.manifest.version,
  }
  const metadata = [...checked.files].map(([path, bytes]) => ({
    byteLength: bytes.length,
    ...typedFile(path),
    modId: identity.id,
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }))
  const assets = compileModAssets({
    assets: metadata,
    mods: [checked.compiled],
    sources: [{ files: Object.fromEntries(checked.files), identity }],
  })
  compileModContentCatalog([checked.compiled], assets)
  for (const definition of checked.compiled.content) {
    if (definition.contentKind !== 'boneyard') continue
    const path = definition.fields.source
    const bytes = typeof path === 'string' ? checked.files.get(path) : undefined
    if (!bytes || typeof path !== 'string') {
      throw new Error(`${identity.id}:${definition.key} Boneyard source is not packaged`)
    }
    projectModBoneyard(identity.id, identity.name, path, bytes)
  }
}

function typedFile(path) {
  if (path.endsWith('.png')) return { contentType: 'image/png', kind: 'image' }
  if (path.endsWith('.ogg')) return { contentType: 'audio/ogg', kind: 'audio' }
  if (path.endsWith('.wav')) return { contentType: 'audio/wav', kind: 'audio' }
  if (path.endsWith('.mp3')) return { contentType: 'audio/mpeg', kind: 'audio' }
  if (path.endsWith('.boneyard')) {
    return { contentType: 'application/vnd.solomon-dark.boneyard', kind: 'boneyard' }
  }
  if (path.startsWith('scenes/') && path.endsWith('.json')) {
    return { contentType: 'application/json', kind: 'scene' }
  }
  if (path.startsWith('art/') && path.endsWith('.json')) {
    return { contentType: 'application/json', kind: 'art-metadata' }
  }
  if (path.startsWith('levels/') && path.endsWith('.json')) {
    return { contentType: 'application/json', kind: 'level-metadata' }
  }
  if (path.endsWith('.bundle')) {
    return {
      contentType: 'application/vnd.solomon-dark.sprite-bundle',
      kind: 'sprite-bundle',
    }
  }
  throw new Error(`unsupported typed package file: ${path}`)
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
  const graph = JSON.parse(checked.compiled.canonicalJson)
  for (const entry of entries) await runLuaTest(join(testsRoot, entry), entry, graph)
  io.log(JSON.stringify({ ...summary(checked), tests: entries.length }, null, 2))
}

async function packMod(args, io) {
  const [target, output] = args
  if (!target || !output) throw new Error(usage())
  const checked = await checkWebLuaPackage(resolve(target), wasmPath)
  admitPreparedPackage(checked)
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
      {
        allowed: ['key', ...WEB_LUA_CONTENT_SCHEMA_FIELDS[kind].allowed],
        required: ['key', ...WEB_LUA_CONTENT_SCHEMA_FIELDS[kind].required],
      },
    ])),
    constructors: {
      effects: EFFECTS,
      events: WEB_LUA_RULE_EVENT_NAMES,
      intents: EFFECTS,
      prefabs: PREFABS,
      rules: RULES,
      schemas: SCHEMAS,
    },
    diagnostics: WEB_LUA_DEFINITION_ERROR_CODES,
    scopes: WEB_LUA_SCOPE_KINDS,
  }
  const generated = new Map([
    ['web-lua-definition.schema.json', `${JSON.stringify(schema, null, 2)}\n`],
    ['sd.lua', luaLsStub()],
    ['REFERENCE.md', referenceMarkdown()],
    ['DIAGNOSTICS.md', diagnosticsMarkdown()],
    ['STARTER.lua', starterLua()],
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

async function runLuaTest(path, name, graph) {
  const factory = new LuaFactory(wasmPath)
  const engine = await factory.createEngine({ enableProxy: false, functionTimeout: 10, injectObjects: false })
  try {
    await engine.doString('io=nil; os=nil; package=nil; require=nil; debug=nil; load=nil; loadfile=nil; dofile=nil')
    await engine.doString(`mod=${luaLiteral(graph)}`)
    const values = await engine.doString(await readFile(path, 'utf8'))
    if (values !== undefined && values !== true) throw new Error(`${name} must return true or no value`)
  } finally {
    engine.global.close()
  }
}

function luaLiteral(value) {
  if (value === null) return 'nil'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `{${value.map(luaLiteral).join(',')}}`
  if (value && typeof value === 'object') return `{${Object.entries(value).map(([key, child]) => (
    `[${JSON.stringify(key)}]=${luaLiteral(child)}`
  )).join(',')}}`
  throw new Error('compiled graph contains a value that cannot be exposed to package tests')
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

function canonicalId(value) {
  const id = value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-._]+|[-._]+$/g, '')
  if (!id) throw new Error('target directory does not produce a valid mod id')
  return id
}

function displayName(value) {
  return value.split(/[._-]+/).map(word => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ')
}

function starterModTemplate(name) {
  return `local icon = sd.art.sprite("art/icon.png")

return sd.mod({
  api = "1.0.0",
  assets = {icon = icon},
  content = {
    sd.kit.item({
      key = "starter_item",
      name = ${JSON.stringify(`${name} Token`)},
      description = "A small item to rename and build on.",
      art = {icon = sd.art.ref("icon")},
    }),
  },
})
`
}

function invincibilityPotionTemplate() {
  return `local icon = sd.art.sprite("art/invincibility_potion.png")

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
}

function luaLsStub() {
  const specs = WEB_LUA_CONTENT_KINDS.map(kind => {
    const fields = WEB_LUA_CONTENT_SCHEMA_FIELDS[kind]
    return `---@class Sd${pascal(kind)}Spec\n---@field key string\n${fields.allowed.map(field => (
      `---@field ${field}${fields.required.includes(field) ? '' : '?'} ${luaFieldType(kind, field)}`
    )).join('\n')}`
  }).join('\n\n')
  const kits = WEB_LUA_CONTENT_KINDS.map(kind => (
    `---@field ${kind.replaceAll('-', '_')} fun(spec: Sd${pascal(kind)}Spec): table`
  )).join('\n')
  const constructors = (name, values, type) => `---@class Sd${name}\n${values.map(value => (
    `---@field ${value} fun(spec: table): ${type}`
  )).join('\n')}`
  return `---@meta

---@alias SdDuration integer|string
---@alias SdEventName ${WEB_LUA_RULE_EVENT_NAMES.map(value => JSON.stringify(value)).join('|')}
---@alias SdScope ${WEB_LUA_SCOPE_KINDS.map(value => JSON.stringify(value)).join('|')}
---@alias SdRule table
---@alias SdIntentValue table
---@alias SdSchemaDefinition table

---@class SdUiBinding
---@field state string

---@class SdUiVisibilityState
---@field state string
---@field equals? boolean|number|string

---@class SdUiVisibility
---@field scenes? ("hub"|"boneyard"|"room")[]
---@field state? SdUiVisibilityState

---@class SdReducerSpec
---@field key string
---@field scope SdScope
---@field schema_version integer
---@field state SdSchemaDefinition
---@field on SdEventName[]
---@field reduce function
---@field migrations? table<integer, function>

${specs}

---@class SdModSpec
---@field api "1.0.0"
---@field assets? table<string, table>
---@field content? table[]
---@field rules? SdRule[]
---@field systems? table[]

---@class SdArt
---@field boneyard fun(spec: string|table): table
---@field music fun(path: string, options?: table): table
---@field ref fun(key: string): table
---@field scene fun(spec: string|table): table
---@field sheet fun(spec: table): table
---@field sound fun(path: string, options?: table): table
---@field sprite fun(path: string, options?: table): table
---@field wearable fun(path: string): table

---@class SdKit
${kits}

---@class SdRules
---@field on fun(event: SdEventName, node: SdRule): SdRule
---@field all fun(nodes: SdRule[]): SdRule
---@field first fun(nodes: SdRule[]): SdRule
---@field when fun(predicate: boolean|table, yes: SdRule, no?: SdRule): SdRule
---@field after fun(duration: SdDuration, node: SdRule): SdRule
---@field every fun(interval: SdDuration, node: SdRule, options: {times: integer}): SdRule

${constructors('Effect', EFFECTS, 'SdRule')}

${constructors('Intent', EFFECTS, 'SdIntentValue')}

${constructors('Prefab', PREFABS, 'SdRule')}

${constructors('Schema', SCHEMAS, 'SdSchemaDefinition')}

---@class SdAdvanced
---@field reducer fun(spec: SdReducerSpec): table

---@class Sd
---@field advanced SdAdvanced
---@field art SdArt
---@field effect SdEffect
---@field intent SdIntent
---@field kit SdKit
---@field mod fun(spec: SdModSpec): table
---@field prefab SdPrefab
---@field ref fun(kind: string, key: string, mod_id?: string): table
---@field rules SdRules
---@field schema SdSchema

---@type Sd
sd = {}
`
}

function referenceMarkdown() {
  const rows = WEB_LUA_CONTENT_KINDS.map(kind => {
    const value = WEB_LUA_CONTENT_SCHEMA_FIELDS[kind]
    return `| \`${kind}\` | ${['key', ...value.required].map(field => `\`${field}\``).join(', ')} | ${['key', ...value.allowed].map(field => `\`${field}\``).join(', ')} |`
  }).join('\n')
  const list = (root, values) => values.map(value => `- \`${root}.${value}(spec)\``).join('\n')
  return `# Web Lua 1.0 generated reference

API: \`${WEB_LUA_DEFINITION_API_VERSION}\`

Every content definition requires a stable \`key\`. The root \`sd.mod\` table accepts \`api\`, \`assets\`, \`content\`, \`rules\`, and \`systems\`; advanced reducers must be listed in \`systems\`.

## Art

- \`sd.art.sprite(path, options)\` declares one PNG sprite.
- \`sd.art.sheet(spec)\` declares an explicit PNG frame grid, with optional \`headings\`.
- \`sd.art.wearable(path)\` declares a 170 px actor sheet for an existing hat, robe, or staff slot.
- \`sd.art.sound(path, options)\` and \`sd.art.music(path, options)\` declare audio.
- \`sd.art.scene(spec)\` and \`sd.art.boneyard(spec)\` declare document assets.
- \`sd.art.ref(key)\` references a named asset from content.

## Content

| Kind | Required fields | Allowed fields |
| --- | --- | --- |
${rows}

## Rules

- \`sd.rules.on(event, node)\`
- \`sd.rules.all(nodes)\`
- \`sd.rules.first(nodes)\`
- \`sd.rules.when(predicate, yes, no)\`
- \`sd.rules.after(duration, node)\`
- \`sd.rules.every(interval, node, {times = count})\`

## Events

${WEB_LUA_RULE_EVENT_NAMES.map(value => `- \`${value}\``).join('\n')}

Unknown event names fail admission. UI rules receive the declared UI action in
the \`action\` context field and the framework action family in \`action_kind\`.

## Effects

${list('sd.effect', EFFECTS)}

## Prefabs

${list('sd.prefab', PREFABS)}

## Advanced reducers

\`sd.advanced.reducer(spec)\` declares a scoped reducer. Versions above 1 require a pure migration for every prior version in \`migrations\`.

## UI state shapes

- \`bindings = {label = {state = "state.key"}}\`
- \`visible = {scenes = {"hub", "boneyard", "room"}}\`
- \`visible = {state = {state = "state.key", equals = value}}\`

## Schemas and intents

${list('sd.schema', SCHEMAS)}

${list('sd.intent', EFFECTS)}

## Scopes

${WEB_LUA_SCOPE_KINDS.map(value => `- \`${value}\``).join('\n')}
`
}

function diagnosticsMarkdown() {
  const descriptions = {
    E_API_VERSION: 'Use api = "1.0.0".',
    E_ASSET: 'Fix the declared path, type, bytes, dimensions, or audio header.',
    E_BUDGET: 'Reduce definitions, nodes, depth, files, or state rather than raising a limit.',
    E_CONTENT_KEY: 'Use a stable lowercase content key.',
    E_CYCLE: 'Remove the reported reference cycle.',
    E_DUPLICATE: 'Rename the duplicate key or mount owner.',
    E_GRAPH: 'Repack from the current source so the compiled graph matches.',
    E_MOUNT_CONFLICT: 'Give exclusive UI or shop mounts one owner.',
    E_REFERENCE: 'Declare the target before packing and use the correct content kind.',
    E_SCHEMA: 'Make the value match its declared bounded schema.',
    E_UNKNOWN_FIELD: 'Remove the field or use the generated allowed-field table.',
  }
  return `# Web Lua diagnostics

Run \`sdmod check <directory>\`. Definition issues include a stable code, graph path, and entry-script path. Prepared package errors name the content or asset field that failed admission.

${WEB_LUA_DEFINITION_ERROR_CODES.map(code => `- \`${code}\`: ${descriptions[code]}`).join('\n')}
`
}

function starterLua() {
  return `local icon = sd.art.sprite("art/icon.png")

local status = sd.kit.status({
  key = "example_status",
  duration = "5s",
  modifiers = {incoming_damage = {multiply = 0.8}},
})

return sd.mod({
  api = "1.0.0",
  assets = {icon = icon},
  content = {
    status,
    sd.kit.item({
      key = "example_item",
      name = "Example Item",
      art = {icon = sd.art.ref("icon")},
    }),
  },
})
`
}

function pascal(value) {
  return value.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('')
}

function luaFieldType(kind, field) {
  if (['accessible_name', 'description', 'name', 'source'].includes(field)) return 'string'
  if (kind === 'boast' && ['instruction', 'response', 'statement'].includes(field)) return 'string'
  if (kind === 'boast' && field === 'fail_on') {
    return '("magical-equipment"|"mana-underflow"|"potion-use"|"secondary-cast")[]'
  }
  if (kind === 'boast' && field === 'random_skill_choices') return 'boolean'
  if (kind === 'boast' && field === 'score_multiplier') return 'number'
  if (kind === 'boast' && ['stock_icon', 'success_wave'].includes(field)) return 'integer'
  if (['cooldown', 'duration', 'restock'].includes(field)) return 'SdDuration'
  if (['maximum_rank', 'rolls'].includes(field)) return 'integer'
  if (field === 'mana') return 'number'
  if (field === 'slot') return '"primary"|"secondary"'
  if (field === 'stacking') return '"ignore"|"refresh"|"replace"|"stack"'
  if (field === 'stock_scope') return '"party"|"player"|"session"'
  if (field === 'rng_domain') return 'string'
  if (field === 'scene' && kind === 'scene-extension') return '"stock.boneyard"'
  if (field === 'mount' && kind === 'ui') {
    return '"hud.bottom_left"|"hud.bottom_right"|"hud.overlay"|"hud.top_left"|"hud.top_right"'
  }
  if (field === 'bindings' && kind === 'ui') return 'table<string, SdUiBinding>'
  if (field === 'visible' && kind === 'ui') return 'SdUiVisibility'
  if (field === 'behavior' || field === 'effect' || field === 'on_use' || field === 'use' || field === 'view') {
    return 'SdRule'
  }
  if (field === 'features' || field === 'triggers') return 'SdRule[]'
  if (['actions', 'applies_to'].includes(field)) return 'string[]'
  if (['entries', 'prerequisites', 'ranks', 'rooms', 'roster', 'services', 'stock', 'waves'].includes(field)) {
    return 'table[]'
  }
  return 'table'
}

function usage() {
  return [
    'usage:',
    '  sdmod new <directory>',
    '  sdmod assets fetch [source-id ...]',
    '  sdmod check <mod-directory>',
    '  sdmod test <mod-directory>',
    '  sdmod pack <mod-directory> <output.zip>',
    '  sdmod migrate <0.2-mod-directory> <1.0-directory>',
    '  sdmod generate <output-directory> [--check]',
    '  sdmod render-sprite <recipe.json>',
  ].join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSdmod(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
