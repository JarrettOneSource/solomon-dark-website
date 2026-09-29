import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, Mesh, RenderTexture, Sprite, Texture } from 'pixi.js'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createNativeStoneskinWarp } from '../core-kernels/native-stoneskin.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { PlayerStoneskinView } from './player-stoneskin-view.ts'

test('Stoneskin keeps its two masked passes and born distortion across live mode changes', () => {
  const source = new Container()
  const excluded = new Sprite(Texture.EMPTY)
  source.addChild(excluded)
  let captures = 0
  let multiplies = 0
  const view = new PlayerStoneskinView(Texture.EMPTY, { render(options) {
    assert.ok(options.target instanceof RenderTexture)
    if (options.clear) {
      captures++
      assert.equal(excluded.visible, false)
    } else {
      multiplies++
      const texture = options.container.children[0]
      assert.ok(texture instanceof Sprite)
      assert.equal(texture.blendMode, 'multiply')
    }
  } })
  const player = createGameSnapshot(createGameSimulation({ player: {
    discipline: 'mind', displayName: 'Stone', element: 'earth',
  } }), 'player').players.player!
  const warp = createNativeStoneskinWarp(createNativeRng(331)).positions
  const update = (enabled: boolean, positions = warp) => view.update(player, source, [excluded], true, positions, enabled)
  update(true)
  assert.equal(view.container.visible, true)
  assert.equal(view.container.children.length, 2)
  const meshes = view.container.children
  assert.ok(meshes[0] instanceof Mesh && meshes[1] instanceof Mesh)
  const initial = meshes[0].geometry
  const initialBuffers = [...new Set([...Object.values(initial.attributes).map(attribute => attribute.buffer), initial.getIndex()])]
  assert.equal(initial.getIndex().data.length, 486)
  assert.strictEqual(meshes[1].geometry, initial)
  assert.equal(meshes[0].y, -25)
  const target = meshes[0].texture
  update(true, [...warp])
  assert.strictEqual(meshes[0].geometry, initial)
  update(false)
  assert.equal(meshes[0].geometry.getIndex().data.length, 6)
  assert.ok(initialBuffers.every(buffer => buffer.destroyed))
  assert.equal(meshes[0].texture, target)
  update(true)
  assert.equal(meshes[0].geometry.getIndex().data.length, 486)
  assert.equal(captures, 4)
  assert.equal(multiplies, 4)
  assert.equal(excluded.visible, true)
  assert.throws(() => view.update(player, source, [excluded], true, null, true), /birth grid/)
  view.update(player, source, [excluded], false, null, true)
  assert.equal(view.container.visible, false)
  const finalGeometry = meshes[0].geometry
  const finalBuffers = [...new Set([...Object.values(finalGeometry.attributes).map(attribute => attribute.buffer), finalGeometry.getIndex()])]
  view.destroy()
  assert.ok(finalBuffers.every(buffer => buffer.destroyed))
  assert.equal(target.destroyed, true)
  source.destroy({ children: true })
})
