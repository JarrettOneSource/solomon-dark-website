import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { BoneyardParseError, parseBoneyard } from './parser.ts'

const flatFixture = new URL('../../../tests/fixtures/flat_multiplayer_test.boneyard', import.meta.url)
const storyFixture = new URL('../../public/samples/story0.boneyard', import.meta.url)

function closeTo(actual: number, expected: number, epsilon = 0.001): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`)
}

test('parses the stock-created blank fixture without inventing scene objects', () => {
  const document = parseBoneyard(readFileSync(flatFixture))

  assert.equal(document.internalName, 'New Boneyard 2')
  assert.deepEqual(document.stats, {
    bytes: 148_413,
    chunks: 7_721,
    namedBuffers: 0,
    maxDepth: 9,
  })
  assert.deepEqual(document.scene.spawn, {
    kind: 'spawn',
    position: { x: 1024, y: 1024 },
    direction: 0,
  })
  assert.equal(document.scene.worldObjects.length, 0)
  assert.equal(document.scene.roads.length, 0)
  assert.equal(document.scene.fences.length, 0)
  assert.equal(document.scene.terrain.length, 0)
  assert.equal(document.scene.sprites.length, 0)
  assert.deepEqual(document.diagnostics, [])
})

test('recovers real spatial records from the retail story0 Boneyard', () => {
  const document = parseBoneyard(readFileSync(storyFixture))

  assert.equal(document.internalName, 'story0')
  assert.equal(document.stats.chunks, 879)
  assert.equal(document.scene.worldObjects.length, 116)
  assert.equal(document.scene.roads.length, 61)
  assert.equal(document.scene.fences.length, 21)
  assert.equal(document.scene.terrain.length, 12)
  assert.equal(document.scene.sprites.length, 133)
  assert.deepEqual(
    Object.fromEntries(
      ['Tree', 'Monument', 'Gravestone'].map((name) => [
        name,
        document.scene.worldObjects.filter((item) => item.typeName === name).length,
      ]),
    ),
    { Tree: 60, Monument: 6, Gravestone: 50 },
  )

  closeTo(document.scene.spawn.position.x, 855.54785)
  closeTo(document.scene.spawn.position.y, 2465.5503)
  closeTo(document.scene.worldObjects[0].position.x, 1222.6038)
  closeTo(document.scene.worldObjects[0].position.y, 41)
  closeTo(document.scene.roads[0].start.x, 707.50305)
  closeTo(document.scene.roads[0].end.y, 2510.2178)
  closeTo(document.scene.fences[0].start.x, 902.9923)
  closeTo(document.scene.fences[0].end.y, 1428.1877)
  assert.equal(document.scene.terrain[0].points.length, 10)
  assert.equal(document.scene.sprites[0].atlasEntryId, 2)
  closeTo(document.scene.sprites[0].position.x, 1342.1227)
  assert.deepEqual(document.diagnostics, [])
})

test('rejects empty, truncated, trailing, and malformed containers', () => {
  const valid = readFileSync(flatFixture)
  const wrongRootCount = Uint8Array.from(valid)
  wrongRootCount[4] = 2

  for (const payload of [
    new Uint8Array(),
    valid.subarray(0, -1),
    Uint8Array.from([...valid, 0]),
    wrongRootCount,
  ]) {
    assert.throws(() => parseBoneyard(payload), BoneyardParseError)
  }
})
