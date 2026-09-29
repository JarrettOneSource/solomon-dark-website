import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, RenderTexture, Sprite, Texture } from 'pixi.js'
import { nativePuppetHitAlpha } from '../core-kernels/native-puppet-hit.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { PlayerEnhancedHitView } from './player-enhanced-hit-view.ts'
import { NATIVE_TEXTURE_COLOR_UNIFORMS } from './native-texture-color.ts'

test('the enhanced cached hit pass switches live without replacing ordinary player layers', () => {
  const ordinary = new Container()
  const shadow = new Sprite(Texture.EMPTY)
  const directHit = new Sprite(Texture.EMPTY)
  ordinary.addChild(shadow, directHit)
  ordinary.position.set(500, 600)
  let captures = 0
  const view = new PlayerEnhancedHitView({ render(options) {
    captures++
    assert.equal(options.container, ordinary)
    assert.ok(options.target instanceof RenderTexture)
    assert.equal(options.target.width, 256)
    assert.equal(shadow.visible, false)
    assert.equal(directHit.visible, false)
    assert.equal(NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor, 1)
  } })
  const snapshot = createGameSnapshot(createGameSimulation({ player: {
    discipline: 'mind', displayName: 'Quality', element: 'air',
  } }), 'player')
  const player = snapshot.players.player!
  const hit = { ...player, progression: { ...player.progression,
    hitFeedback: { tick: 50, timer: .5, strength: .8 } } }
  const update = (on: boolean, stone = false, current = hit) =>
    view.update(current, 50, ordinary, [shadow, directHit], on, stone, true, 0xffffff)
  update(false)
  assert.equal(captures, 0)
  assert.equal(view.container.visible, false)
  update(true)
  assert.equal(captures, 1)
  assert.equal(view.container.visible, true)
  assert.equal(view.container.x, 500)
  assert.equal(view.container.y, 600)
  const sprite = view.container.children[0]
  assert.ok(sprite instanceof Sprite)
  assert.equal(sprite.y, -25)
  assert.equal(sprite.tint, 0x4a0000)
  assert.equal(sprite.alpha, Math.fround(nativePuppetHitAlpha(hit.progression.hitFeedback, 50, true) * Math.fround(.45)))
  assert.equal(shadow.visible, true)
  assert.equal(directHit.visible, true)
  assert.equal(NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor, 0)
  update(false)
  assert.equal(view.container.visible, false)
  assert.equal(captures, 1)
  update(true)
  assert.equal(view.container.children[0], sprite)
  update(true, true)
  assert.equal(view.container.visible, false)
  update(true, false, player)
  assert.equal(view.container.visible, false)
  update(true, false, { ...hit, progression: { ...hit.progression, lifeState: 'dying' } })
  assert.equal(view.container.visible, false)
  assert.equal(shadow.visible, true)
  assert.equal(directHit.visible, true)
  const texture = sprite.texture
  view.destroy()
  assert.equal(texture.destroyed, true)
  ordinary.destroy({ children: true })
})

test('a failed enhanced hit capture restores the ordinary layer and texture state', () => {
  const source = new Container()
  const ordinary = new Sprite(Texture.EMPTY)
  source.addChild(ordinary)
  const player = createGameSnapshot(createGameSimulation({ player: {
    discipline: 'mind', displayName: 'Quality', element: 'air',
  } }), 'player').players.player!
  const hit = { ...player, progression: { ...player.progression,
    hitFeedback: { tick: 50, timer: 1, strength: 1 } } }
  const view = new PlayerEnhancedHitView({ render() { throw new Error('capture failed') } })
  assert.throws(() => view.update(hit, 50, source, [ordinary], true, false, true, 0xffffff), /capture failed/)
  assert.equal(ordinary.visible, true)
  assert.equal(NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor, 0)
  view.destroy()
  source.destroy({ children: true })
})
