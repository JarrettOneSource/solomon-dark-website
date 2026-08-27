import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createBoneyardCatalog,
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
    assert.ok(template.scene.roads.every((road) => (
      Number.isInteger(road.linkMask) && road.linkMask >= 0 && road.linkMask <= 3
    )))
    assert.ok(template.scene.roads.some((road) => road.linkMask === 2))
    assert.ok(template.scene.roads.some((road) => road.linkMask === 1))
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


function squaredDistance(
  left: { x: number, y: number },
  right: { x: number, y: number },
): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2
}
