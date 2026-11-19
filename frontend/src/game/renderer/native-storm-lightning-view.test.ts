import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, Mesh, Texture } from 'pixi.js'
import type { NativeSecondaryActorState } from '../core-kernels/native-secondary-abilities.ts'
import { nativeStormLightningPlan, nativeStormContactLight } from '../core-kernels/native-secondary-storm.ts'
import { nativeStormBurst } from '../protocol/codecs/secondary-actors.ts'
import { NativeStormLightningView } from './native-storm-lightning-view.ts'

const textures = { ribbon: Texture.EMPTY, branches: [Texture.EMPTY, Texture.EMPTY],
  circle: Texture.EMPTY, forks: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY] } as const
const actor: NativeSecondaryActorState = { ageTicks: 0, alpha: 1, damage: 0, enhanced: false,
  endpoint: { x: 100, y: 10 }, frame: 0, freezeTicks: 0, golem: null, hitTargetIds: [],
  id: 51, kind: 'storm-strike', lifetimeTicks: 6,
  lightRegistration: { managerLane: 'transient', registrationOrdinal: 51 },
  midpoint: { x: 100, y: 100 }, miscLightAppendOrdinal: null, ownerId: 'player',
  painterRegistrations: [{ managerLane: 'transient', registrationOrdinal: 51 }],
  phase: 123, position: { x: 100, y: 180 }, presentationRng: null, quantity: 0,
  radius: 0, rank: 1, rotationRadians: 0, scale: 1, skillId: 27, slowFactor: 0,
  targetId: 18, variant: 0, velocity: { x: 0, y: 0 }, worldKey: 'boneyard:test' }

function meshes(root: Container): Mesh[] {
  return root.children.flatMap(child => child instanceof Mesh ? [child] : meshes(child))
}

test('Storm bodies draw late for two ticks while source/contact coronas and the contact light fade for six', () => {
  for (const enhanced of [false, true]) {
    const source = { ...actor, enhanced }
    const unchanged = structuredClone(source)
    const root = new Container()
    const view = new NativeStormLightningView(source, root, textures)
    const bodyMeshes = meshes(root)
    const geometry = bodyMeshes.map(mesh => mesh.geometry)
    const buffers = geometry.flatMap(resource => resource.buffers)
    assert.ok(geometry.length >= 2)
    const layers = view.painterLayers(4)
    assert.deepEqual(layers.map(layer => [layer.lane, layer.sortBias]), [
      ['world-sorted', 50], ['post-world-queue', 0], ['post-world-queue', 0],
    ])
    assert.deepEqual(layers[0]!.registration, actor.painterRegistrations![0])
    assert.equal(root.children[0]!.label, 'storm-body:51')
    view.setDepth('storm-contact', 987)
    assert.equal(root.children.find(child => child.label === 'storm-contact:51')!.zIndex, 987)
    const alpha = [1, .800000011920929, .6000000238418579, .40000003576278687,
      .20000003278255463, 2 ** -25, 0]
    for (const [age, expected] of alpha.entries()) {
      view.update({ ...source, ageTicks: age })
      const plan = nativeStormLightningPlan(source, age)
      assert.equal(plan.body !== null, age < 2)
      if (plan.body) {
        assert.deepEqual(plan.body.layers.map(layer => layer.width), [.5, .375])
        assert.equal(plan.body.layers[0]!.phaseDegrees, -369)
      }
      assert.equal(plan.contactCorona.alpha, expected)
      assert.equal(plan.sourceCorona?.alpha ?? 0, expected)
      const light = nativeStormContactLight(source, age)
      assert.equal(light !== null, age < 6)
      if (light) {
        assert.equal(light.castsDirectionalShadow, false)
        assert.ok(light.radius >= .75 && light.radius < 1.5)
        assert.equal(light.position.x, source.position.x + plan.contactCorona.center.x)
        assert.equal(light.position.y, source.position.y + plan.contactCorona.center.y)
      }
      if (age >= 2) {
        assert.ok(bodyMeshes.every(mesh => mesh.destroyed))
        assert.ok(buffers.every(buffer => buffer.destroyed))
      }
    }
    assert.deepEqual(source, unchanged)
    view.setRenderable(false)
    assert.ok(root.children.every(child => !child.renderable))
    view.destroy()
    assert.equal(root.children.length, 0)
    root.destroy()
    assert.equal(Texture.EMPTY.destroyed, false)
  }
  const coarse = nativeStormLightningPlan(actor, 0).body!.layers[0]!
  const fine = nativeStormLightningPlan({ ...actor, enhanced: true }, 0).body!.layers[0]!
  assert.ok(fine.parameterSamples.length > coarse.parameterSamples.length)
})

test('pending Storm snapshot validates the complete bounded burst without retaining a target object', () => {
  const burst = { remainingTicks: 4, source: actor.position, midpoint: actor.midpoint,
    endpoint: actor.endpoint, targetId: 18 }
  assert.deepEqual(nativeStormBurst(JSON.parse(JSON.stringify(burst)), 'burst'), burst)
  for (const invalid of [0, 5, -1, 1.5, Infinity]) {
    assert.throws(() => nativeStormBurst({ ...burst, remainingTicks: invalid }, 'burst'))
  }
  assert.throws(() => nativeStormBurst({ ...burst, source: { x: NaN, y: 0 } }, 'burst'))
  assert.throws(() => nativeStormBurst({ ...burst, targetId: -1 }, 'burst'))
  assert.throws(() => nativeStormBurst({ ...burst, unexpected: true }, 'burst'))
})
