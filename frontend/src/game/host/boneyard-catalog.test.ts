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
    const candidates = template.scene.objects.filter((object) => (
      object.typeId === 2029 && object.overlayVariant === 8
    ))
    assert.ok(candidates.length >= 9 && candidates.length <= 14)
    const dig = template.scene.solomonDig
    assert.ok(dig)
    let nearest = candidates[0]!
    let nearestDistance = squaredDistance(nearest.pos, template.scene.spawn)
    for (const candidate of candidates.slice(1)) {
      const distance = squaredDistance(candidate.pos, template.scene.spawn)
      if (distance < nearestDistance) {
        nearest = candidate
        nearestDistance = distance
      }
    }
    assert.deepEqual(dig.gravePosition, nearest.pos)
    assert.deepEqual(dig.position, {
      x: dig.gravePosition.x + 10,
      y: dig.gravePosition.y + 113,
    })
    assert.deepEqual(dig.lanternPosition, {
      x: dig.gravePosition.x - 55,
      y: dig.gravePosition.y + 73,
    })
    assert.deepEqual(dig.frameProgram, SOLOMON_DIG_FRAME_PROGRAM)
    assert.equal(dig.ticksPerFrame, 5)
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

test('native default bank retains the complete stock generator output-family census', () => {
  const objectTypes = new Set<number>()
  const compactTypes = new Set<number>()
  const environmentModes = new Set<number>()

  for (const template of NATIVE_GENERATED_BONEYARDS) {
    const scene = template.scene
    environmentModes.add(scene.environmentMode)
    assert.ok(scene.roads.length > 0)
    assert.ok(scene.fences.length > 0)
    assert.equal(scene.terrain.length, 0)
    for (const object of scene.objects) objectTypes.add(object.typeId)
    for (const sprite of scene.sprites) compactTypes.add(sprite.atlasEntry)
  }

  assert.deepEqual([...objectTypes].sort((a, b) => a - b), [2001, 2029, 2040, 2061])
  assert.deepEqual(
    [...compactTypes].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 21, 22, 23, 24, 25, 26, 27, 28],
  )
  assert.deepEqual([...environmentModes].sort((a, b) => a - b), [0, 1, 2])
})

test('default selector reaches every stock-generated template', () => {
  const catalog = createBoneyardCatalog()
  const selected = NATIVE_GENERATED_BONEYARDS.map((_, index) => {
    const seed = Buffer.alloc(16)
    seed.writeUInt32BE(index)
    return materializeBoneyard(catalog, 'default-random', seed)?.sourceSha256
  })

  assert.deepEqual(
    selected,
    NATIVE_GENERATED_BONEYARDS.map((entry) => entry.sourceSha256),
  )
})

test('opening Solomon placement does not consume a second seed word', () => {
  const catalog = createBoneyardCatalog()
  const seedA = Buffer.alloc(16)
  const seedB = Buffer.alloc(16)
  seedB.writeUInt32BE(7, 4)

  const loadedA = materializeBoneyard(catalog, 'default-random', seedA)
  const loadedB = materializeBoneyard(catalog, 'default-random', seedB)
  assert.ok(loadedA)
  assert.ok(loadedB)
  assert.equal(loadedA.sourceSha256, loadedB.sourceSha256)
  assert.equal(loadedA.geometrySha256, loadedB.geometrySha256)
  assert.deepEqual(loadedA.scene.solomonDig, loadedB.scene.solomonDig)
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
  assert.equal(entries[0].scene.environmentMode, 0)
  assert.equal(entries[0].scene.solomonDig, null)

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

function squaredDistance(
  left: { x: number, y: number },
  right: { x: number, y: number },
): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2
}
