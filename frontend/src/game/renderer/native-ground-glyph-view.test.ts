import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, Sprite, Texture } from 'pixi.js'
import { nativePlayerGroundGlyph, nativeStudentGroundGlyph } from '../core-kernels/native-ground-auxiliary.ts'
import { NativeGroundGlyphView } from './native-ground-glyph-view.ts'

const PLAYER = { position: { x: 100, y: 200 }, headingDegrees: 0, scale: 1,
  lifeState: 'alive' as const, deathTick: 0, corpseConsumed: false }

test('the public ground view preserves transform/alpha independently of its actor body', () => {
  const root = new Container()
  const ground = new Container()
  const body = new Container()
  root.addChild(ground, body)
  const sprite = new Sprite(Texture.EMPTY)
  const view = new NativeGroundGlyphView(sprite)
  ground.addChild(view.container)
  view.update(nativePlayerGroundGlyph(PLAYER, false))
  body.position.set(20, 30)
  body.scale.set(2)
  assert.equal(view.container.parent, ground)
  assert.deepEqual([view.container.x, view.container.y], [100, 205])
  assert.deepEqual([sprite.scale.x, sprite.scale.y, sprite.alpha], [1.25, 1.25, 1])
  view.update(nativePlayerGroundGlyph(PLAYER, true))
  assert.deepEqual([view.container.x, view.container.y], [100, 202])
  assert.deepEqual([sprite.scale.x, sprite.alpha], [1.2000000476837158, 0.5])
  view.update(nativePlayerGroundGlyph({ ...PLAYER, lifeState: 'dying', deathTick: 150 }, false))
  assert.equal(view.container.visible, true)
  view.update(nativePlayerGroundGlyph({ ...PLAYER, lifeState: 'dying', deathTick: 151 }, false))
  assert.equal(view.container.visible, false)
  view.destroy()
  assert.equal(view.container.parent, null)
  assert.equal(sprite.destroyed, true)
  root.destroy({ children: true })
})

test('a pooled Student ground product can move rooms and be reused without a stale pose', () => {
  const first = new Container(), second = new Container()
  const view = new NativeGroundGlyphView(new Sprite(Texture.EMPTY))
  first.addChild(view.container)
  view.update(nativeStudentGroundGlyph({ position: { x: 50, y: 70 }, heading: 0, scale: 1 }))
  view.container.removeFromParent()
  view.prepareForPool()
  assert.equal(view.container.visible, false)
  second.addChild(view.container)
  view.update(nativeStudentGroundGlyph({ position: { x: 200, y: 300 }, heading: 90, scale: 0.8 }))
  assert.equal(first.children.length, 0)
  assert.equal(view.container.parent, second)
  assert.equal(view.container.visible, true)
  assert.equal(view.container.x, 195)
  assert.ok(Math.abs(view.container.y - 300) < 0.001)
  view.destroy()
  assert.equal(second.children.length, 0)
  first.destroy(); second.destroy()
})
