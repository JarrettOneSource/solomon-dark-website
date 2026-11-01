import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, Mesh, Texture } from 'pixi.js'
import { buildBoneyardPainterOrder } from '../boneyard-painter-order.ts'
import type { NativeBossSpell } from '../core-kernels/native-boss-spell.ts'
import { NativeBossSpellViews } from './native-boss-spell-view.ts'
import { nativeDarkLightningBody } from './native-dark-lightning.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'

const spell: Extract<NativeBossSpell, { kind: 'blightning' }> = {
  enhancedEffects: true,
  ageTicks: 0, damage: 0, endpoint: { x: 600, y: 100 }, id: 7, kind: 'blightning',
  painterRegistration: { managerLane: 'transient', registrationOrdinal: 17 },
  midpoint: { x: 350, y: 100 }, ownerActorId: 1, position: { x: 100, y: 100 }, spawnTick: 31,
}

test('DarkLightning preserves both authored ribbon widths, red branch records, and native normal blend', () => {
  const body = nativeDarkLightningBody(spell)
  assert.deepEqual(body.layers.map(({ alpha, blendMode, phaseDegrees, textureRecord, tint, width }) => ({
    alpha, blendMode, phaseDegrees, textureRecord, tint, width,
  })), [
    { alpha: 1, blendMode: 'normal', phaseDegrees: -93, textureRecord: 64, tint: 0xffffff, width: 1 },
    { alpha: .5, blendMode: 'normal', phaseDegrees: -78, textureRecord: 64, tint: 0xff0000, width: .75 },
  ])
  assert.equal(Math.abs(body.layers[0]!.vertices[1]!), 27.34375)
  assert.equal(Math.abs(body.layers[1]!.vertices[1]!), 14.6484375)
  const branches = new Set<number>()
  for (let id = 1; id <= 64; id += 1) {
    for (const layer of nativeDarkLightningBody({ ...spell, id }).layers) {
      if (layer.branch) branches.add(layer.branch.textureRecord)
    }
  }
  assert.deepEqual([...branches].sort(), [373, 374])
})

test('DarkLightning shares immutable geometry across its depth bands and destroys the complete view at retirement', () => {
  const root = new Container()
  const base = Object.fromEntries([64, 373, 374].map(entry => [nativeEnemySpriteRecord('BadGuys', entry).source, Texture.EMPTY]))
  const views = new NativeBossSpellViews(root, { base, greenPlasma: Texture.EMPTY })
  views.update([spell], 31)
  const layers = views.painterLayers([spell])
  assert.equal(layers[0]!.visible, false)
  assert.ok(layers[0]!.insertions!.length > 1)
  const meshes = (container: Container): Mesh[] => container.children.flatMap(child => (
    child instanceof Mesh ? [child] : child instanceof Container ? meshes(child) : []
  ))
  const before = meshes(root)
  assert.ok(before.every(mesh => mesh.blendMode === 'normal'))
  const geometries = new Set(before.map(mesh => mesh.geometry))
  assert.ok(geometries.size < before.length)
  views.update([{ ...spell, ageTicks: 1 }], 32)
  assert.deepEqual(meshes(root), before, 'a retained bolt never rebuilds or re-jitters its meshes')
  const destroyed = new Set<(typeof before)[number]['geometry']>()
  for (const geometry of geometries) geometry.on('destroy', () => destroyed.add(geometry))
  views.update([], 33)
  assert.equal(root.children.length, 0)
  assert.deepEqual(destroyed, geometries)
  views.destroy()
  root.destroy()
})

test('DarkLightning live split quality changes scenery occlusion while retaining born ribbon data', () => {
  for (const bornEnhanced of [true, false]) {
    const born = { ...spell, enhancedEffects: bornEnhanced }
    const root = new Container()
    const base = Object.fromEntries([64, 373, 374].map(entry => [nativeEnemySpriteRecord('BadGuys', entry).source, Texture.EMPTY]))
    const views = new NativeBossSpellViews(root, { base, greenPlasma: Texture.EMPTY })
    const meshes = (container: Container): Mesh[] => container.children.flatMap(child => (
      child instanceof Mesh ? [child] : child instanceof Container ? meshes(child) : []
    ))
    let birthGeometry: readonly unknown[] | null = null
    for (const liveEnhanced of [true, false, true]) {
      views.update([born], 31, 900, liveEnhanced)
      const layers = views.painterLayers([born])
      const owner = layers[0]!
      const insertions = owner.insertions!
      const height = liveEnhanced ? 25 : 50
      assert.equal(insertions[0]!.worldY - owner.worldY, height)
      assert.deepEqual(owner.registration, born.painterRegistration)
      const order = buildBoneyardPainterOrder({
        referenceY: owner.worldY,
        staticLayers: [{ layerIndex: 0, worldY: owner.worldY + 37, sortBias: 0, sourceOrder: 0 }],
        dynamicLayers: layers,
      })
      const firstDepth = order.dynamicLayers.find(layer => layer.id === insertions[0]!.id)!.zIndex
      const nextDepth = order.dynamicLayers.find(layer => layer.id === insertions[1]!.id)!.zIndex
      const sceneryDepth = order.bands[0]!.zIndex
      assert.ok(liveEnhanced ? firstDepth < sceneryDepth && sceneryDepth < nextDepth : sceneryDepth < firstDepth)
      const current = meshes(root)
      assert.ok(current.every(mesh => mesh.blendMode === 'normal'))
      const geometry = [...new Set(current.map(mesh => mesh.geometry))].map(resource => ({
        positions: [...resource.getBuffer('aPosition').data],
        uvs: [...resource.getBuffer('aUV').data],
      }))
      if (birthGeometry === null) birthGeometry = geometry
      else assert.deepEqual(geometry, birthGeometry, 'live masks cannot reroll born ribbons')
      assert.equal(born.enhancedEffects, bornEnhanced)
    }
    views.update([], 33)
    assert.equal(root.children.length, 0)
    views.destroy()
    root.destroy()
  }
})
