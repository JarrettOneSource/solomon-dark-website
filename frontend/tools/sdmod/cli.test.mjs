import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'

import { runSdmod } from './cli.mjs'

const execFileAsync = promisify(execFile)

test('sdmod creates, checks, tests, packs, and generates one deterministic v1 mod', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'sdmod-v1-'))
  context.after(() => rm(root, { force: true, recursive: true }))
  const mod = join(root, 'example-item')
  const output = join(root, 'example-item.zip')
  const secondOutput = join(root, 'example-item-second.zip')
  const generated = join(root, 'generated')
  const messages = []
  const io = { log: value => messages.push(String(value)) }

  await runSdmod(['new', 'item', mod], io)
  await mkdir(join(mod, 'tests'))
  await writeFile(join(mod, 'tests/basic.lua'), 'assert(2 + 2 == 4)\nreturn true\n')
  const checked = await runSdmod(['check', mod], io)
  await runSdmod(['test', mod], io)
  await runSdmod(['pack', mod, output], io)
  await runSdmod(['pack', mod, secondOutput], io)
  await runSdmod(['generate', generated], io)
  await runSdmod(['generate', generated, '--check'], io)

  assert.equal(checked.compiled.content[0]?.contentKind, 'item')
  assert.deepEqual(await readFile(output), await readFile(secondOutput))
  const { stdout } = await execFileAsync('unzip', ['-Z1', output])
  assert.deepEqual(stdout.trim().split('\n'), [
    'compiled/graph.json',
    'compiled/graph.sha256',
    'manifest.json',
    'scripts/main.lua',
  ])
  assert.match(await readFile(join(generated, 'sd.lua'), 'utf8'), /---@field potion/)
  assert.match(await readFile(join(generated, 'REFERENCE.md'), 'utf8'), /scene-extension/)
  assert.ok(messages.some(message => message.includes('graphSha256')))
})

test('sdmod migrates the retained Invincibility Potion to the v1 kit', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'sdmod-migrate-'))
  context.after(() => rm(root, { force: true, recursive: true }))
  const source = join(root, 'old')
  const target = join(root, 'new')
  await mkdir(join(source, 'sprites'), { recursive: true })
  await writeFile(join(source, 'manifest.json'), JSON.stringify({
    id: 'canary.lua.invincibility_potion',
    name: 'Invincibility Potion Canary',
    version: '0.3.0',
    minimumLoaderVersion: '0.1.0-beta.29',
    runtime: {
      apiVersion: '0.2.0',
      entryScript: 'scripts/main.lua',
      requiredCapabilities: ['items.consumables.register'],
    },
  }))
  await writeFile(join(source, 'sprites/invincibility_potion.png'), Buffer.from('png'))
  await writeFile(join(source, 'sprites/invincibility_potion.bundle'), Buffer.from('bundle'))

  await runSdmod(['migrate', source, target], { log: () => {} })
  const manifest = JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8'))
  const script = await readFile(join(target, 'scripts/main.lua'), 'utf8')

  assert.equal(manifest.runtime.apiVersion, '1.0.0')
  assert.equal(manifest.minimumLoaderVersion, undefined)
  assert.equal(manifest.runtime.requiredCapabilities, undefined)
  assert.match(script, /sd\.kit\.potion/)
  assert.match(script, /stacking = "refresh"/)
  assert.match(script, /ordinary = 0\.5, boss = 1\.0/)
})

test('sdmod rejects targets and packages outside the v1 contract', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'sdmod-reject-'))
  context.after(() => rm(root, { force: true, recursive: true }))
  const mod = join(root, 'bad')
  await mkdir(join(mod, 'scripts'), { recursive: true })
  await writeFile(join(mod, 'manifest.json'), JSON.stringify({
    id: 'Bad Package',
    name: 'Bad',
    version: '1.0.0',
    runtime: { apiVersion: '0.2.0', entryScript: 'scripts/main.lua' },
  }))
  await writeFile(join(mod, 'scripts/main.lua'), 'return true\n')

  await assert.rejects(() => runSdmod(['check', mod]), /canonical lowercase package id/)
  await assert.rejects(() => runSdmod(['new', 'unknown-kind', join(root, 'new')]), /usage:/)
})
