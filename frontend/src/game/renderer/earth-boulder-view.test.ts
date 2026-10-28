import assert from 'node:assert/strict'
import test from 'node:test'
import { Sprite, Texture } from 'pixi.js'
import type { PrimarySpellEarthCalledRockState } from '../core-kernels/primary-spells.ts'
import { EarthCalledRockView } from './earth-boulder-view.ts'

test('CalledRock reads the live quality flag without changing its born motion or visible main rock', () => {
  const state: PrimarySpellEarthCalledRockState = {
    ageTicks: 8, falling: true, fallVelocity: 2, height: -12.5, id: 2,
    kind: 'earth-called-rock', lightRegistration: null, lateralMagnitude: 3.25,
    ownerId: 'owner', parentId: 1, painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 2 }],
    position: { x: 760, y: 390 }, rotation: 125, rotationStep: -12,
    scale: .2, speed: .5, targetHeight: -48, variant: 2, worldKey: 'hub:courtyard',
  }
  const original = structuredClone(state)
  const view = new EarthCalledRockView(state, {
    aura: Texture.EMPTY, openingFlash: Texture.EMPTY,
    litRocks: [Texture.EMPTY, Texture.WHITE, Texture.EMPTY],
    rocks: [Texture.EMPTY, Texture.WHITE, Texture.EMPTY],
  })
  const [base, main] = view.container.children
  assert.ok(base instanceof Sprite && main instanceof Sprite)
  const update: (state: PrimarySpellEarthCalledRockState, frame?: number,
    gain?: number, enhanced?: boolean) => void = view.update.bind(view)
  const visibleMain = () => ({ position: { x: main.x, y: main.y }, scale: { x: main.scale.x, y: main.scale.y },
    rotation: main.rotation, alpha: main.alpha, texture: main.texture, renderable: main.renderable })
  const initial = visibleMain()
  for (const enabled of [false, true, false, true]) {
    update(state, 8, 1, enabled)
    assert.equal(base.renderable, enabled, 'Anim_CalledRock 0x45E445 gates only its base pass')
    assert.deepEqual(visibleMain(), initial)
    assert.strictEqual(view.container.children[0], base)
    assert.strictEqual(view.container.children[1], main)
    assert.deepEqual(state, original)
  }
  update({ ...state, height: 0 }, 8, 1, true)
  assert.equal(base.renderable, false)
  view.destroy()
  assert.equal(base.destroyed, true)
  assert.equal(main.destroyed, true)
  assert.equal(Texture.EMPTY.destroyed, false)
  assert.equal(Texture.WHITE.destroyed, false)
})
