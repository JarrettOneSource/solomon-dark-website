import assert from 'node:assert/strict'
import test from 'node:test'
import { Sprite, Texture } from 'pixi.js'
import { createNativeHardenBreakup } from '../core-kernels/native-harden-effects.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { PlayerHardenEffectView } from './player-harden-effect-view.ts'

test('Harden fragments use all five native records, post-world additive motion, and a separate normal Fade', () => {
  const textures = Object.fromEntries([15, 446, 447, 448, 449, 450].map((entry) => [`BadGuys:${entry}`, Texture.EMPTY]))
  const birth = createNativeHardenBreakup(1, { x: 15, y: 25 }, 'water', 'boneyard:test', 10, 1, createNativeRng(42))
  const records = new Set<number>()
  for (const effect of birth.effects) {
    const view = new PlayerHardenEffectView(effect, textures)
    assert.equal(view.kind, effect.kind)
    const root = view.painterRoots()[0]!
    assert.equal(root.container.x, effect.position.x)
    assert.equal(root.container.y, effect.position.y)
    assert.equal(root.regionLightPoint, null)
    const sprite = root.container.children[0]
    assert.ok(sprite instanceof Sprite)
    if (effect.kind === 'harden-shard') {
      records.add(effect.record)
      assert.equal(root.lane, 'post-world-queue')
      assert.equal(root.queueFamily, null)
      assert.equal(sprite.blendMode, 'add')
      view.update({ ...effect, height: -20, life: 0.25, rotationDegrees: 90 })
      assert.equal(sprite.alpha, 0.25)
      assert.equal(sprite.y, -20)
      assert.equal(sprite.angle, 90)
    } else {
      assert.equal(root.lane, 'world-sorted')
      assert.equal(root.sortBias, 10)
      assert.equal(sprite.blendMode, 'normal')
      assert.equal(sprite.scale.x, 3.5)
      view.update({ ...effect, alpha: 0.25 })
      assert.equal(sprite.alpha, 0.25)
    }
    view.setTint('', 0xaabbcc)
    assert.equal(sprite.tint, 0xaabbcc)
    assert.throws(() => view.update({
      ageTicks: 0, birthTick: 10, durationTicks: 100, id: 1,
      initialAlpha: 0.5, initialRotationDegrees: 0, kind: 'water-aura',
      origin: { x: 0, y: 0 }, ownerId: 'water', rotationStepDegrees: 0, worldKey: 'boneyard:test',
    }), /Harden actor/)
    view.destroy()
    assert.equal(root.container.destroyed, true)
  }
  assert.deepEqual([...records].sort(), [446, 447, 448, 449, 450])
})
