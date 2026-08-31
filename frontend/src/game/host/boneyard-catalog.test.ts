import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { nativeSlumpgutRecipe } from '../core-kernels/native-survival-slumpgut.ts'
import {
  createBoneyardCatalog,
  materializeBoneyard,
  materializeStockTutorial,
  recoverSavedBoneyardRoadLinks,
} from './boneyard-catalog.ts'
import { NATIVE_GENERATED_BONEYARDS } from './native-generated-boneyards.ts'
import {
  boneyardGeometrySha256,
  SOLOMON_DIG_FRAME_PROGRAM,
} from './project-boneyard.ts'

test('native default bank contains distinct exact materializations and Solomon Dig', () => {
  assert.equal(NATIVE_GENERATED_BONEYARDS.length, 12)
  assert.equal(
    new Set(NATIVE_GENERATED_BONEYARDS.map((entry) => entry.sourceSha256)).size,
    NATIVE_GENERATED_BONEYARDS.length,
  )
  assert.ok(NATIVE_GENERATED_BONEYARDS.every(({ sourceSha256 }) => (
    nativeSlumpgutRecipe(sourceSha256).name === 'Slumpgut'
  )))
  assert.equal(
    new Set(NATIVE_GENERATED_BONEYARDS.map((entry) => entry.geometrySha256)).size,
    NATIVE_GENERATED_BONEYARDS.length,
  )
  for (const template of NATIVE_GENERATED_BONEYARDS) {
    assert.match(template.sourceSha256, /^[0-9a-f]{64}$/)
    assert.match(template.geometrySha256, /^[0-9a-f]{64}$/)
    assert.equal(template.geometrySha256, boneyardGeometrySha256(template.scene))
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

test('saved runs recover every default and Tutorial Road link from exact source identity', () => {
  const catalog = createBoneyardCatalog()
  const loaded = NATIVE_GENERATED_BONEYARDS.map((_, index) => {
    const seed = Buffer.alloc(16)
    seed.writeUInt32BE(index)
    return materializeBoneyard(catalog, 'default-random', seed)!
  })
  loaded.push(materializeStockTutorial(Buffer.alloc(16, 19)))

  for (const current of loaded) {
    assert.strictEqual(recoverSavedBoneyardRoadLinks(catalog, current), current)
    const legacy = withoutRoadLinks(current)
    const recovered = recoverSavedBoneyardRoadLinks(catalog, legacy)
    assert.deepEqual(
      recovered.scene.roads.map(road => road.linkMask),
      current.scene.roads.map(road => road.linkMask),
    )
    assert.equal(recovered.geometrySha256, boneyardGeometrySha256(recovered.scene))
    assert.equal(recovered.runId, current.runId)
    assert.equal(recovered.seed, current.seed)
  }
})

test('saved mod runs recover Road links only from the exact admitted catalog entry', () => {
  const template = NATIVE_GENERATED_BONEYARDS[0]!
  const choice = {
    id: 'mod:example:crypt:123456789abc',
    modId: 'example.crypt',
    modName: 'Example Crypt',
    name: 'Crypt',
    source: 'mod' as const,
  }
  const catalog = createBoneyardCatalog([{ ...template, choice }])
  const loaded = materializeBoneyard(catalog, choice.id, Buffer.alloc(16, 29))!
  const recovered = recoverSavedBoneyardRoadLinks(catalog, withoutRoadLinks(loaded))
  assert.deepEqual(recovered.scene.roads, loaded.scene.roads)
  assert.deepEqual(recovered.choice, choice)

  assert.throws(
    () => recoverSavedBoneyardRoadLinks(
      createBoneyardCatalog(),
      withoutRoadLinks(loaded),
    ),
    /content is unavailable/,
  )
  assert.throws(
    () => recoverSavedBoneyardRoadLinks(catalog, {
      ...withoutRoadLinks(loaded),
      sourceSha256: '0'.repeat(64),
    }),
    /content is unavailable/,
  )
})

test('saved Road recovery rejects partial masks and changed source geometry', () => {
  const catalog = createBoneyardCatalog()
  const loaded = materializeBoneyard(catalog, 'default-random', Buffer.alloc(16, 31))!
  const partial = withoutRoadLinks(loaded)
  partial.scene.roads[0]!.linkMask = loaded.scene.roads[0]!.linkMask
  partial.geometrySha256 = boneyardGeometrySha256(partial.scene)
  assert.throws(
    () => recoverSavedBoneyardRoadLinks(catalog, partial),
    /Road links are invalid/,
  )

  const changed = withoutRoadLinks(loaded)
  changed.scene.roads[0]!.points[0]!.x += 1
  changed.geometrySha256 = boneyardGeometrySha256(changed.scene)
  assert.throws(
    () => recoverSavedBoneyardRoadLinks(catalog, changed),
    /Road geometry does not match/,
  )
})

test('native default openings contain no ground clutter beneath Solomon or rock in his grave', () => {
  const overlaps = NATIVE_GENERATED_BONEYARDS.flatMap((template, templateIndex) => {
    const dig = template.scene.solomonDig
    if (!dig) return []
    return template.scene.sprites.flatMap((sprite) => (
      openingGroundClutterContains(sprite, dig.position)
        || (OPENING_ROCK_ENTRIES.has(sprite.atlasEntry)
          && openingGroundClutterContains(sprite, dig.gravePosition))
        ? [{ entry: sprite.atlasEntry, sprite: sprite.eid, templateIndex }]
        : []
    ))
  })

  assert.deepEqual(overlaps, [])
  assert.deepEqual(
    NATIVE_GENERATED_BONEYARDS
      .filter(({ sourceSha256 }) => OPENING_CLEARANCE_RECEIPTS.has(sourceSha256))
      .map(({ geometrySha256, scene, sourceSha256 }) => ({
        geometrySha256,
        sourceSha256,
        spriteCount: scene.sprites.length,
      })),
    [...OPENING_CLEARANCE_RECEIPTS].map(([sourceSha256, receipt]) => ({
      ...receipt,
      sourceSha256,
    })),
  )
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

test('Web Lua catalog metadata never leaks into the loaded Boneyard protocol', () => {
  const template = NATIVE_GENERATED_BONEYARDS[0]!
  const catalog = createBoneyardCatalog([{
    ...template,
    choice: {
      id: 'mod:example:crypt:123456789abc',
      modId: 'example.crypt',
      modName: 'Example Crypt',
      name: 'Crypt',
      source: 'mod',
    },
    webLuaContentId: '123456789',
  }])
  const loaded = materializeBoneyard(
    catalog,
    'mod:example:crypt:123456789abc',
    Buffer.alloc(16),
  )

  assert.ok(loaded)
  assert.equal(loaded.choice.name, 'Crypt')
  assert.equal('webLuaContentId' in loaded, false)
})


function squaredDistance(
  left: { x: number, y: number },
  right: { x: number, y: number },
): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2
}

function withoutRoadLinks(loaded: LoadedBoneyard): Mutable<LoadedBoneyard> {
  const copy = structuredClone(loaded) as Mutable<LoadedBoneyard>
  for (const road of copy.scene.roads) {
    delete (road as Partial<Mutable<LoadedBoneyard['scene']['roads'][number]>>).linkMask
  }
  copy.geometrySha256 = boneyardGeometrySha256(copy.scene)
  return copy
}

type Mutable<T> = T extends readonly (infer Entry)[]
  ? Mutable<Entry>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

const OPENING_GROUND_CLUTTER_SIZES = new Map<number, readonly [number, number]>([
  [6, [260, 178]],
  [7, [89, 89]],
  [8, [62, 62]],
  [21, [64, 56]],
  [22, [70, 58]],
  [23, [80, 62]],
  [24, [69, 59]],
])
const OPENING_ROCK_ENTRIES = new Set([21, 22, 23, 24])

const OPENING_CLEARANCE_RECEIPTS = new Map([
  ['2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f', {
    geometrySha256: 'bb6072ba6adedba364d36a004d6622e7610df848456c1c3ac92b6e372b4ba4c0',
    spriteCount: 327,
  }],
  ['ec2b27a1415c944c233158da8c21324760cd896e1228143aa18d262f65fa2a45', {
    geometrySha256: 'ffaacb41b92345b1816c0a49c5b0585ac6da7b7ab8153ad162bb833473620750',
    spriteCount: 271,
  }],
  ['624b79ae325daa714b24017e0a308c64519f7481eb206e4489968217b1a2e123', {
    geometrySha256: 'a026e733247fe03510a517288a6f04f47f41bec54cf16ecbf1926303a529d2b6',
    spriteCount: 303,
  }],
  ['e62e5e847562d822382fba14709d5367c9cd7de40f8b4fa52ecea3bfc8d9a430', {
    geometrySha256: '489bbe3f9e4e7b365691245035923a1cc67ba1a9018f4c35bd37f1b2ac2b230e',
    spriteCount: 253,
  }],
])

function openingGroundClutterContains(
  sprite: (typeof NATIVE_GENERATED_BONEYARDS)[number]['scene']['sprites'][number],
  point: { x: number, y: number },
): boolean {
  const size = OPENING_GROUND_CLUTTER_SIZES.get(sprite.atlasEntry)
  if (!size) return false
  const scaleY = Math.max(0, sprite.s1)
  const scaleX = scaleY * ((sprite.flags & 1) !== 0 ? 0.8 : 1)
  const rotation = sprite.s0 * Math.PI / 180
  const dx = point.x - sprite.pos.x
  const dy = point.y - sprite.pos.y
  const localX = dx * Math.cos(rotation) + dy * Math.sin(rotation)
  const localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation)
  return Math.abs(localX) <= size[0] * scaleX / 2
    && Math.abs(localY) <= size[1] * scaleY / 2
}
