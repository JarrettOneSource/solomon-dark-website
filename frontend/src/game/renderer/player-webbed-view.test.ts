import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js'
import { applyNativeWebbed } from '../core-kernels/native-webbed.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { PlayerWebbedView } from './player-webbed-view.ts'

test('webbing captures the current wizard, adds each admitted layer, and releases the cocoon presentation', () => {
  let captures = 0
  const source = new Container()
  const shadow = new Sprite(Texture.EMPTY)
  source.addChild(shadow, new Sprite(Texture.EMPTY))
  const renderer: Pick<Renderer, 'render'> = {
    render(options) {
      captures += 1
      assert.ok(options.target instanceof RenderTexture)
      assert.equal(options.target.width, 256)
      assert.equal(shadow.visible, false)
      assert.deepEqual(options.clearColor, [1, 1, 1, 0])
    },
  }
  const view = new PlayerWebbedView(Texture.EMPTY, renderer)
  source.addChild(view.container)
  const player = createGameSnapshot(createGameSimulation(), 'local-player').players['local-player']!
  view.update(player, undefined, source, [shadow], false)
  assert.equal(captures, 0)
  const first = applyNativeWebbed(null, 10)
  view.update(player, first, source, [shadow], false)
  assert.equal(shadow.visible, true)
  const layers = view.container.children.slice(0, 3)
  assert.deepEqual(layers.map((layer) => layer.visible), [true, false, false])
  assert.deepEqual(layers.map((layer) => layer.scale.x), [1, Math.fround(1.05), Math.fround(1.1)])
  const partial = { ...first, severity: 1.5 }
  view.update(player, partial, source, [shadow], false)
  assert.deepEqual(layers.map((layer) => layer.alpha), [1, 0.5, 0])
  const full = applyNativeWebbed(applyNativeWebbed(first, 50), 10)
  view.update({ ...player, headingIndex: 0 }, { ...full, hitPulse: 0.75 }, source, [shadow], false)
  const cocoon = view.container.children.find((child) => child.label === 'player-cocoon')!
  const hit = view.container.children.find((child) => child.label === 'player-cocoon-hit')!
  assert.ok(cocoon instanceof Sprite)
  assert.ok(hit instanceof Sprite)
  assert.equal(cocoon.visible, true)
  assert.equal(hit.alpha, 0.75)
  assert.equal(hit.tint, 0xff0000)
  cocoon.updateLocalTransform()
  const top = cocoon.localTransform.apply({ x: 0, y: -64.5 })
  const bottom = cocoon.localTransform.apply({ x: 0, y: 64.5 })
  assert.ok(Math.abs(top.y - (-59.5)) < 1e-6)
  assert.ok(Math.abs(bottom.y - 44.5) < 1e-6)
  const beforePriority = captures
  view.update(player, full, source, [shadow], true)
  assert.equal(view.container.visible, false)
  assert.equal(captures, beforePriority)
  view.update({ ...player, progression: { ...player.progression, lifeState: 'dying' } }, full, source, [shadow], false)
  assert.equal(view.container.visible, false)
  view.update(player, undefined, source, [shadow], false)
  assert.equal(view.container.visible, false)
  view.destroy()
  source.destroy({ children: true })
})
