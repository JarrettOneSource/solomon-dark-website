import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { PlayerHardenView } from './player-harden-view.ts'
import { installNativeTextureColorSync, NATIVE_TEXTURE_COLOR_UNIFORMS } from './native-texture-color.ts'

test('Harden captures the current character, multiplies native ice, and submits three cyan layers', () => {
  const source = new Container()
  const shadow = new Sprite(Texture.EMPTY)
  source.addChild(shadow, new Sprite(Texture.EMPTY))
  const modes: number[] = []
  const renderer: Pick<Renderer, 'render'> = {
    render(options) {
      assert.ok('container' in options)
      assert.ok(options.target instanceof RenderTexture)
      assert.equal(options.target.width, 256)
      assert.equal(options.target.height, 256)
      const mode = NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor
      modes.push(mode)
      if (mode === 1) {
        assert.equal(options.container, source)
        assert.equal(shadow.visible, false)
        assert.deepEqual(options.clearColor, [1, 1, 1, 0])
      } else {
        assert.equal(options.clear, false)
      }
    },
  }
  const view = new PlayerHardenView(Texture.EMPTY, renderer)
  source.addChild(view.container)
  const snapshot = createGameSnapshot(createGameSimulation({ water: {
    discipline: 'mind', displayName: 'Harden', element: 'water',
  } }), 'water')
  const player = snapshot.players.water!
  view.update(player, source, [shadow], false)
  assert.deepEqual(modes, [])
  const active = { ...player, progression: { ...player.progression, hardenCoating: 1 } }
  view.update(active, source, [shadow], false)
  assert.deepEqual(modes, [1, 0])
  assert.equal(shadow.visible, true)
  assert.equal(NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor, 0)
  assert.equal(view.container.visible, true)
  assert.equal(view.container.children.length, 3)
  for (const child of view.container.children) {
    assert.ok(child instanceof Sprite)
    assert.equal(child.tint, 0x3fbfff)
    assert.equal(child.blendMode, 'add')
    assert.equal(child.alpha, Math.fround(0.7))
    assert.equal(child.scale.x, Math.fround(1.12))
    assert.equal(child.y, -25)
  }
  view.update(active, source, [shadow], true)
  assert.equal(view.container.visible, false, 'Stoneskin owns the higher-priority native branch')
  view.update({ ...active, progression: { ...active.progression, lifeState: 'dying' } }, source, [shadow], false)
  assert.equal(view.container.visible, false)
  view.update({ ...active, progression: { ...active.progression, lifeState: 'spectating' } }, source, [shadow], false)
  assert.equal(view.container.visible, false)
  view.update(active, source, [shadow], false)
  assert.equal(view.container.children.length, 3, 'refresh reuses the capture target')
  view.update(player, source, [shadow], false)
  assert.equal(view.container.visible, false)
  view.destroy()
  source.destroy({ children: true })
})

test('a failed GPU capture restores diffuse state and the ordinary player shadow', () => {
  const source = new Container()
  const shadow = new Sprite(Texture.EMPTY)
  source.addChild(shadow)
  const view = new PlayerHardenView(Texture.EMPTY, { render() { throw new Error('GPU capture failed') } })
  source.addChild(view.container)
  const snapshot = createGameSnapshot(createGameSimulation({ water: {
    discipline: 'mind', displayName: 'Harden', element: 'water',
  } }), 'water')
  const player = snapshot.players.water!
  assert.throws(() => view.update({
    ...player, progression: { ...player.progression, hardenCoating: 0.5 },
  }, source, [shadow], false), /GPU capture failed/)
  assert.equal(shadow.visible, true)
  assert.equal(NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor, 0)
  view.destroy()
  source.destroy({ children: true })
})

test('the texture-color batch hook restores its predecessor on renderer teardown', () => {
  const modes: number[] = []
  const adaptor = { start() { modes.push(-1) } }
  const original = adaptor.start
  const restore = installNativeTextureColorSync(adaptor, {
    updateUniformGroup() { modes.push(NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor) },
  })
  adaptor.start()
  assert.deepEqual(modes, [-1, 0])
  restore()
  assert.strictEqual(adaptor.start, original)
  adaptor.start()
  assert.deepEqual(modes, [-1, 0, -1])
})
