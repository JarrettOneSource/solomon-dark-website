import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { newBoneyard, parseBoneyard, serializeBoneyard } from './format/boneyard.ts'

const flatFixture = new URL('../../../tests/fixtures/flat_multiplayer_test.boneyard', import.meta.url)

function closeTo(actual: number | undefined, expected: number, epsilon = 0.001): void {
  assert.ok(actual !== undefined, 'value is missing')
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`)
}

test('the flat fixture carries a player spawn the format layer can read', () => {
  const doc = parseBoneyard(readFileSync(flatFixture))
  assert.ok(doc.geometry.playerSpawn, 'fixture has no player spawn')
})

test('an authored player spawn survives serialize/parse on a parsed envelope', () => {
  const doc = parseBoneyard(readFileSync(flatFixture))
  doc.geometry.playerSpawn = { x: 123.5, y: -456.25 }
  doc.geometry.playerSpawnFacingDeg = 90
  const reparsed = parseBoneyard(serializeBoneyard(doc))
  closeTo(reparsed.geometry.playerSpawn?.x, 123.5)
  closeTo(reparsed.geometry.playerSpawn?.y, -456.25)
  closeTo(reparsed.geometry.playerSpawnFacingDeg, 90)
})

test('an authored player spawn survives the scratch-doc (blank fixture) path', () => {
  const base = newBoneyard('Spawn Test Acre', readFileSync(flatFixture))
  base.geometry.playerSpawn = { x: 1024, y: 640 }
  base.geometry.playerSpawnFacingDeg = 225
  const reparsed = parseBoneyard(serializeBoneyard(base))
  closeTo(reparsed.geometry.playerSpawn?.x, 1024)
  closeTo(reparsed.geometry.playerSpawn?.y, 640)
  closeTo(reparsed.geometry.playerSpawnFacingDeg, 225)
  assert.equal(reparsed.meta.name, 'Spawn Test Acre')
})
