import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, Mesh, Texture } from 'pixi.js'
import type { NativeBossSpell } from '../core-kernels/native-boss-spell.ts'
import { NativeBossSpellViews } from './native-boss-spell-view.ts'
import { nativeDarkLightningBody } from './native-dark-lightning.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'

const spell: Extract<NativeBossSpell, { kind: 'blightning' }> = {
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
