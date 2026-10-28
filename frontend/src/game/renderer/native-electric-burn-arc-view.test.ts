import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, Mesh, Texture } from 'pixi.js'
import type { NativeSecondaryActorState } from '../core-kernels/native-secondary-abilities.ts'
import { NativeElectricBurnArcView } from './native-electric-burn-arc-view.ts'

const textures = { ribbon: Texture.EMPTY, branches: [Texture.EMPTY, Texture.EMPTY],
  circle: Texture.EMPTY, forks: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY] } as const

function actor(enhanced: boolean): NativeSecondaryActorState {
  return { ageTicks: 0, alpha: 1, damage: 0, enhanced, endpoint: { x: 100, y: 10 },
    frame: 0, freezeTicks: 0, golem: null, hitTargetIds: [], id: 51, kind: 'electric-burn-arc',
    lifetimeTicks: 2, lightRegistration: null, midpoint: { x: 100, y: 100 }, miscLightAppendOrdinal: null,
    ownerId: 'player', painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 51 }],
    phase: 123, position: { x: 100, y: 180 }, presentationRng: null, quantity: 1, radius: 0,
    rank: 1, rotationRadians: 0, scale: 1, skillId: null, slowFactor: 1, targetId: 18,
    variant: 0, velocity: { x: 0, y: 0 }, worldKey: 'boneyard:test' }
}

function meshes(root: Container): Mesh[] {
  return root.children.flatMap(child => child instanceof Mesh ? [child] : meshes(child))
}

test('ElectricBurn body keeps its born ribbons while live quality changes only split wrappers and releases retired buffers', () => {
  for (const enhanced of [false, true]) {
    const root = new Container()
    const source = actor(enhanced)
    const view = new NativeElectricBurnArcView(source, root, textures, true)
    const firstLayers = view.painterLayers(3)
    assert.equal(firstLayers.length, 1)
    assert.equal(firstLayers[0]!.visible, false)
    assert.equal(firstLayers[0]!.registration?.registrationOrdinal, 51)
    const firstBands = firstLayers[0]!.insertions!
    assert.ok(firstBands.length > 2)
    for (let i = 1; i < firstBands.length; i++) assert.equal(firstBands[i]!.worldY - firstBands[i - 1]!.worldY, 25)
    const first = meshes(root)
    assert.ok(first.length > 0)
    const originals = [...new Set(first.map(mesh => mesh.geometry))]
    assert.ok(originals.length < first.length, 'all clipped bands share immutable native geometry')
    const positions = originals.map(geometry => Array.from(geometry.getBuffer('aPosition').data))
    const buffers = originals.flatMap(geometry => geometry.buffers)
    const lastSuffix = firstBands.at(-1)!.id.split(':').at(-1)!
    view.setDepth(lastSuffix, 987)
    assert.ok(root.children.some(child => child.zIndex === 987))
    view.update({ ...source, ageTicks: 1 }, false)
    assert.ok(first.every(mesh => mesh.destroyed))
    assert.ok(buffers.every(buffer => buffer.destroyed))
    const nextLayers = view.painterLayers(3)
    assert.ok(nextLayers[0]!.insertions!.length < firstBands.length)
    const currentGeometry = [...new Set(meshes(root).map(mesh => mesh.geometry))]
    assert.deepEqual(currentGeometry.map(geometry => Array.from(geometry.getBuffer('aPosition').data)), positions)
    view.update({ ...source, ageTicks: 1 }, true)
    assert.deepEqual(view.painterLayers(3)[0]!.insertions!.map(row => row.worldY), firstBands.map(row => row.worldY))
    view.setRenderable(false)
    assert.ok(root.children.every(child => !child.renderable))
    view.setRenderable(true)
    view.update({ ...source, ageTicks: 2 }, true)
    assert.equal(root.children.length, 0)
    assert.equal(view.painterLayers(3).length, 0)
    assert.throws(() => view.update(source, true), /cannot re-enter/)
    view.destroy()
    root.destroy()
    assert.equal(Texture.EMPTY.destroyed, false)
  }
})
