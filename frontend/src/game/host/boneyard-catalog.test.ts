import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import {
  createBoneyardCatalog,
  loadModBoneyardsFromStageReport,
  materializeBoneyard,
} from './boneyard-catalog.ts'
import { NATIVE_GENERATED_BONEYARDS } from './native-generated-boneyards.ts'
import { SOLOMON_DIG_FRAME_PROGRAM } from './project-boneyard.ts'

test('native default bank contains distinct exact materializations and Solomon Dig', () => {
  assert.equal(NATIVE_GENERATED_BONEYARDS.length, 12)
  assert.equal(
    new Set(NATIVE_GENERATED_BONEYARDS.map((entry) => entry.sourceSha256)).size,
    NATIVE_GENERATED_BONEYARDS.length,
  )
  assert.equal(
    new Set(NATIVE_GENERATED_BONEYARDS.map((entry) => entry.geometrySha256)).size,
    NATIVE_GENERATED_BONEYARDS.length,
  )
  for (const template of NATIVE_GENERATED_BONEYARDS) {
    assert.match(template.sourceSha256, /^[0-9a-f]{64}$/)
    assert.match(template.geometrySha256, /^[0-9a-f]{64}$/)
    assert.ok(template.scene.objects.length >= 300)
    assert.ok(template.scene.sprites.length >= 190)
    assert.deepEqual(template.scene.solomonDig.frameProgram, SOLOMON_DIG_FRAME_PROGRAM)
    assert.equal('recipes' in template.scene, false)
    assert.equal('timeline' in template.scene, false)
  }

  const loaded = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16),
  )
  assert.ok(loaded)
  assert.equal(loaded.seed, '0'.repeat(32))
  assert.equal(loaded.sourceSha256, NATIVE_GENERATED_BONEYARDS[0].sourceSha256)
  assert.deepEqual(loaded.scene, NATIVE_GENERATED_BONEYARDS[0].scene)
})

test('stage report exposes every enabled mod Boneyard and ignores non-level art', async (context) => {
  const root = await createTemporaryDirectory()
  context.after(() => rm(root, { recursive: true, force: true }))
  const stageRoot = join(root, 'stage')
  const reportPath = join(stageRoot, '.sdmod', 'stage-report.json')
  const levelTarget = 'sandbox/DarkCloud/mylevels/Contract Arena.boneyard'
  const levelPath = join(stageRoot, ...levelTarget.split('/'))
  await mkdir(join(stageRoot, '.sdmod'), { recursive: true })
  await mkdir(dirname(levelPath), { recursive: true })
  await copyFile('../tests/fixtures/flat_multiplayer_test.boneyard', levelPath)
  await writeFile(reportPath, JSON.stringify({
    enabledMods: [{
      Id: 'tests.contract',
      Name: 'Contract Boneyards',
      Version: '1.0.0',
      overlays: [
        { Target: levelTarget, Source: 'files/Contract Arena.boneyard', Format: 'boneyard' },
        { Target: 'images/Skills.png', Source: 'files/Skills.png' },
      ],
    }],
  }))

  const entries = await loadModBoneyardsFromStageReport(reportPath)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].choice.name, 'Contract Arena')
  assert.equal(entries[0].choice.modId, 'tests.contract')
  assert.equal(entries[0].choice.modName, 'Contract Boneyards')
  assert.match(entries[0].choice.id, /^mod:tests\.contract:contract-arena:[0-9a-f]{12}$/)
  assert.match(entries[0].sourceSha256, /^[0-9a-f]{64}$/)
  assert.ok(entries[0].scene.spawn)
  assert.deepEqual(entries[0].scene.solomonDig.frameProgram, SOLOMON_DIG_FRAME_PROGRAM)

  const catalog = createBoneyardCatalog(entries)
  assert.equal(catalog.choices.length, 2)
  const loaded = materializeBoneyard(catalog, entries[0].choice.id, Buffer.alloc(16, 7))
  assert.equal(loaded?.choice.id, entries[0].choice.id)
  assert.equal(loaded?.geometrySha256, entries[0].geometrySha256)
})

test('stage report attributes a conflicting Boneyard target to its final overlay owner', async (context) => {
  const root = await createTemporaryDirectory()
  context.after(() => rm(root, { recursive: true, force: true }))
  const stageRoot = join(root, 'stage')
  const reportPath = join(stageRoot, '.sdmod', 'stage-report.json')
  const levelTarget = 'data/levels/survival.boneyard'
  const levelPath = join(stageRoot, ...levelTarget.split('/'))
  await mkdir(join(stageRoot, '.sdmod'), { recursive: true })
  await mkdir(dirname(levelPath), { recursive: true })
  await copyFile('../tests/fixtures/flat_multiplayer_test.boneyard', levelPath)
  await writeFile(reportPath, JSON.stringify({
    enabledMods: [
      {
        Id: 'tests.first',
        Name: 'First Boneyards',
        overlays: [{ Target: levelTarget, Source: 'files/first.boneyard' }],
      },
      {
        Id: 'tests.final',
        Name: 'Final Boneyards',
        overlays: [{ Target: levelTarget, Source: 'files/final.boneyard' }],
      },
    ],
  }))

  const entries = await loadModBoneyardsFromStageReport(reportPath)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].choice.modId, 'tests.final')
  assert.equal(entries[0].choice.modName, 'Final Boneyards')
  assert.equal(entries[0].choice.name, 'survival')
})

async function createTemporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'sdr-boneyard-catalog-'))
}
