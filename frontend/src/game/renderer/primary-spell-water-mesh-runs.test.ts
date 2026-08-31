import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  BufferImageSource,
  Container,
  Mesh,
  Rectangle,
  Shader,
  Texture,
} from 'pixi.js'

import type {
  PrimarySpellWaterHailState,
  PrimarySpellWaterTransientState,
} from '../core-kernels/primary-spells.ts'
import { waterFrostJetKind } from '../core-kernels/primary-spell-water.ts'
import { boneyardCombatAtlasSource } from '../../lib/boneyard-combat-atlas-key.ts'
import {
  isNativeWaterMeshActorState,
  nativeWaterMeshComposite,
  NativeWaterMeshRuns,
} from './primary-spell-water-mesh-runs.ts'

test('combined Water mesh keeps exact Hail geometry and Frost pass order across painter gaps', () => {
  const root = new Container()
  const textures = testAtlasTextures()
  const runs = new NativeWaterMeshRuns(root, textures, testShader())
  const firstFrost = normalWaterId(10)
  const secondFrost = normalWaterId(firstFrost + 1)
  runs.beginFrame()
  runs.update(hail(1, {
    height: -5,
    life: 0.5,
    position: { x: 10, y: 20 },
    rotationDegrees: 0,
    scale: 2,
  }))
  runs.update(water(firstFrost))
  runs.update(water(secondFrost))
  runs.endFrame()
  runs.beginDepths()
  runs.appendDepth(1, 10)
  runs.appendDepth(firstFrost, 11)
  runs.appendDepth(secondFrost, 13)
  runs.commitDepths()

  assert.equal(runs.count, 3)
  assert.equal(runs.hailCount, 1)
  assert.equal(runs.normalFrostCount, 2)
  assert.equal(runs.runCount, 2)
  assert.deepEqual(runs.painterLayer(1)?.registration, {
    managerLane: 'actor',
    registrationOrdinal: 2_001,
  })
  assert.deepEqual(runs.painterLayer(firstFrost)?.registration, {
    managerLane: 'transient',
    registrationOrdinal: firstFrost + 1_000,
  })
  assert.deepEqual(root.children.map(({ label }) => label), [
    'primary-water-mesh-run:0',
    'primary-water-mesh-run:1',
  ])
  const first = root.children[0]
  assert.ok(first instanceof Mesh)
  assert.equal(first.zIndex, 10)
  assert.equal(first.geometry.getIndex().data.length, 24)
  const vertices = first.geometry.getBuffer('aPosition').data
  const indices = first.geometry.getIndex().data
  assert.ok(vertices instanceof Float32Array)
  const vertex = (quad: number, corner: number) => (
    (quad * 4 + corner) * 9
  )
  assert.deepEqual([0, 1, 2, 3].flatMap((corner) => {
    const offset = vertex(0, corner)
    return [vertices[offset], vertices[offset + 1]]
  }), [-9, -7, 29, -7, 29, 33, -9, 33])
  assertClose(vertexUv(vertices, vertex(0, 0)), textureUv(textures.hail))
  assertClose(vertexUv(vertices, vertex(1, 0)), textureUv(textures.core))
  assertClose(vertexUv(vertices, vertex(3, 0)), textureUv(textures.glint))
  assert.equal(vertices[vertex(0, 0) + 8], 0)
  assert.equal(vertices[vertex(1, 0) + 8], 0)
  assert.equal(vertices[vertex(2, 0) + 8], 1)
  assert.equal(vertices[vertex(3, 0) + 8], 1)

  const second = root.children[1]
  assert.ok(second instanceof Mesh)
  assert.equal(second.zIndex, 13)
  assert.equal(second.geometry.getIndex().data.length, 24)
  assert.deepEqual([...second.geometry.getIndex().data.slice(18)], [0, 0, 0, 0, 0, 0])

  runs.beginFrame()
  runs.update(water(firstFrost))
  runs.endFrame()
  runs.beginDepths()
  runs.appendDepth(firstFrost, 10)
  runs.commitDepths()
  assert.equal(root.children[0], first)
  assert.equal(first.geometry.getBuffer('aPosition').data, vertices)
  assert.equal(first.geometry.getIndex().data, indices)
  assert.deepEqual([...indices.slice(18)], [0, 0, 0, 0, 0, 0])

  runs.beginFrame()
  runs.update(hail(1, {
    height: -5,
    life: 0.5,
    position: { x: 10, y: 20 },
    rotationDegrees: 0,
    scale: 2,
  }))
  runs.update(water(firstFrost))
  runs.endFrame()
  runs.beginDepths()
  runs.appendDepth(1, 10)
  runs.appendDepth(firstFrost, 11)
  runs.commitDepths()
  assert.equal(first.geometry.getBuffer('aPosition').data, vertices)
  assert.equal(first.geometry.getIndex().data, indices)
  assert.deepEqual([...indices.slice(18)], [12, 13, 14, 12, 14, 15])

  runs.beginFrame()
  runs.endFrame()
  runs.beginDepths()
  runs.commitDepths()
  assert.equal(runs.count, 0)
  assert.equal(runs.runCount, 0)
  assert.ok(root.children.every(({ renderable }) => !renderable))
  runs.destroy()
  assert.equal(root.children.length, 0)
  destroyTestAtlasTextures(textures)
})

test('combined Water mesh requires one packed atlas source', () => {
  assert.notEqual(Texture.EMPTY.source, Texture.WHITE.source)
  assert.throws(() => new NativeWaterMeshRuns(new Container(), {
    core: Texture.EMPTY,
    glint: Texture.WHITE,
    hail: Texture.EMPTY,
  }, testShader()), /share one packed atlas source/)
  assert.throws(() => new NativeWaterMeshRuns(new Container(), {
    core: Texture.WHITE,
    glint: Texture.WHITE,
    hail: Texture.WHITE,
  }), /native non-premultiplied source policy/)
})

test('combined Water records remain packed on one combat-atlas page', () => {
  const generated = readFileSync(
    new URL('./boneyard-combat-atlas.generated.ts', import.meta.url),
    'utf8',
  )
  for (const entry of [28, 30, 32]) {
    const key = boneyardCombatAtlasSource('BadGuys', entry)
    assert.equal(
      generated.includes(`[${JSON.stringify(key)}, [0,`),
      true,
      `${key} must remain on page zero`,
    )
  }
})

test('combined Water mesh rejects a depth stream outside global painter order', () => {
  const runs = new NativeWaterMeshRuns(new Container(), {
    core: Texture.EMPTY,
    glint: Texture.EMPTY,
    hail: Texture.EMPTY,
  }, testShader())
  runs.beginFrame()
  runs.update(hail(1))
  runs.update(hail(2))
  runs.endFrame()
  runs.beginDepths()
  runs.appendDepth(1, 10)
  assert.throws(() => runs.appendDepth(2, 9), /strictly increasing/)
  runs.destroy()
})

test('combined Water mesh admits Hail and normal Frost but leaves Frost-over on its native lane', () => {
  const normal = water(normalWaterId(100))
  const over = water(overWaterId(100))
  assert.equal(isNativeWaterMeshActorState(hail(1)), true)
  assert.equal(isNativeWaterMeshActorState(normal), true)
  assert.equal(isNativeWaterMeshActorState(over), false)
})

test('zero-alpha affine additive encoding matches native Add on the opaque Arena target', () => {
  const background = [0.1, 0.2, 0.3, 1] as const
  const tint = [1, 0.5, 0.25, 0.75] as const
  const straight = [0.8, 0.6, 0.4, 0.5] as const
  const premultiplied = [0.4, 0.3, 0.2, 0.5] as const
  const straightResult = nativeWaterMeshComposite(
    background,
    straight,
    tint,
    true,
    false,
  )
  const premultipliedResult = nativeWaterMeshComposite(
    background,
    premultiplied,
    tint,
    true,
    true,
  )
  assertClose(straightResult, premultipliedResult)
  assert.equal(straightResult[3], 1)
  const normalThenAdd = nativeWaterMeshComposite(
    nativeWaterMeshComposite(background, straight, tint, false, false),
    straight,
    tint,
    true,
    false,
  )
  const finalNormal = nativeWaterMeshComposite(
    normalThenAdd,
    [0.2, 0.4, 0.6, 0.25],
    [0.7, 0.8, 0.9, 0.5],
    false,
    false,
  )
  assert.ok(finalNormal.every(Number.isFinite))
  assert.equal(finalNormal[3], 1)
})

function water(id: number): PrimarySpellWaterTransientState {
  return {
    ageTicks: 1,
    direction: { x: 1, y: 0 },
    id,
    kind: 'water',
    lightRegistration: null,
    obstructionDistance: null,
    obstructionPoint: null,
    origin: { x: 100, y: 200 },
    ownerId: 'wizard',
    painterRegistrations: [{ managerLane: 'transient', registrationOrdinal: id + 1_000 }],
    speed: 4,
    underpowered: false,
    variant: 0,
    worldKey: 'boneyard:combined-water-mesh',
  }
}

function hail(
  id: number,
  overrides: Partial<PrimarySpellWaterHailState> = {},
): PrimarySpellWaterHailState {
  return {
    ageTicks: 1,
    birthTick: 0,
    bounceProgress: 0.2,
    bounceSoundIndex: null,
    bounceSoundPitch: null,
    bounceSoundSequence: 0,
    height: -5,
    horizontalVelocity: { x: 1, y: 0 },
    id,
    kind: 'water-hail',
    life: 1.5,
    ownerId: 'wizard',
    painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: id + 2_000 }],
    position: { x: 80 + id, y: 90 + id },
    rotationDegrees: 45,
    rotationStepDegrees: 2,
    savedBounceVelocity: -2,
    scale: 1.5,
    verticalVelocity: 0,
    worldKey: 'boneyard:combined-water-mesh',
    ...overrides,
  }
}

function normalWaterId(first: number): number {
  let id = first
  while (waterFrostJetKind(id) !== 'normal') id += 1
  return id
}

function overWaterId(first: number): number {
  let id = first
  while (waterFrostJetKind(id) !== 'over') id += 1
  return id
}

function assertClose(actual: readonly number[], expected: readonly number[]): void {
  assert.equal(actual.length, expected.length)
  actual.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]!) < 1e-6, `${index}: ${value}`)
  })
}

function testAtlasTextures(): NativeWaterMeshTexturesForTest {
  const source = new BufferImageSource({
    alphaMode: 'no-premultiply-alpha',
    height: 1,
    resource: new Uint8Array(12),
    width: 3,
  })
  return {
    core: new Texture({ frame: new Rectangle(0, 0, 1, 1), source }),
    glint: new Texture({ frame: new Rectangle(1, 0, 1, 1), source }),
    hail: new Texture({ frame: new Rectangle(2, 0, 1, 1), source }),
  }
}

type NativeWaterMeshTexturesForTest = Readonly<{
  core: Texture
  glint: Texture
  hail: Texture
}>

function destroyTestAtlasTextures(textures: NativeWaterMeshTexturesForTest): void {
  textures.core.destroy(false)
  textures.glint.destroy(false)
  textures.hail.destroy(true)
}

function textureUv(texture: Texture): readonly number[] {
  return [texture.uvs.x0, texture.uvs.y0]
}

function vertexUv(vertices: Float32Array, offset: number): readonly number[] {
  return [vertices[offset + 2]!, vertices[offset + 3]!]
}

function testShader(): Shader {
  return new Shader({ resources: {} } as unknown as ConstructorParameters<typeof Shader>[0])
}
