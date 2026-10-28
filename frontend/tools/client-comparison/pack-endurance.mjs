import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runSdmod } from '../sdmod/cli.mjs'

assert.equal(process.argv.length, 3, 'usage: pack-endurance.mjs /path/to/pilot.zip')
const output = resolve(process.argv[2])
const source = await readFile(new URL('../party-soak-pilot.lua', import.meta.url))
const temporary = await mkdtemp(join(tmpdir(), 'solomon-endurance-package-'))
try {
  await mkdir(join(temporary, 'scripts'))
  await writeFile(join(temporary, 'scripts/main.lua'), source)
  await writeFile(join(temporary, 'manifest.json'), JSON.stringify({
    id: 'local.performance.party-soak', name: 'Private invincible endurance pilot', version: '1.1.0',
    runtime: { apiVersion: '1.0.0', entryScript: 'scripts/main.lua' }, requiredMods: [],
  }, null, 2) + '\n')
  await runSdmod(['pack', temporary, output])
  console.log(JSON.stringify({ output,
    pilotSha256: createHash('sha256').update(source).digest('hex'),
    packageSha256: createHash('sha256').update(await readFile(output)).digest('hex'),
  }))
} finally { await rm(temporary, { recursive: true }) }
