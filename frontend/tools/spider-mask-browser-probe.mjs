import { Application, Container } from 'pixi.js'
import { NativeCompactMaskView } from '../src/game/renderer/native-compact-mask-view.ts'
import { loadBoneyardWorldTextures, destroyBoneyardWorldTextures } from '../src/game/renderer/boneyard-textures.ts'
import { installNativeFixedFunctionRenderPipeline } from '../src/game/renderer/native-fixed-function-render-pipeline.ts'
import { installNativeArenaRenderPipeline } from '../src/game/renderer/native-arena-render-pipeline.ts'
import { createNativeDeadSpider, stepNativeDeadSpider } from '../src/game/core-kernels/native-dead-spider.ts'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { nativeEnemySpriteRecord } from '../src/game/renderer/native-enemy-assets.ts'

export async function inspectSpiderCompactMasks() {
  const app = new Application()
  await app.init({ autoStart: false, width: 512, height: 512, preference: 'webgl', background: 0x444444 })
  installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders: false })
  const pipeline = installNativeArenaRenderPipeline(app.renderer)
  const textures = await loadBoneyardWorldTextures()
  document.body.append(app.canvas)
  const position = { x: 800, y: 450 }
  const bounds = { x: 0, y: 0, w: 1600, h: 900 }
  const sprites = [25, 26, 27, 28, 29].map((atlasEntry, index) => ({
    eid: `mask:${index}`, atlasEntry, pos: { x: 630 + index * 80, y: 545 },
    s0: index * 33, s1: 1, s2: 1, flags: 1,
  }))
  let state = createNativeDeadSpider({ x: 930, y: 460 }, 120)
  let rng = createNativeRng(31)
  for (let tick = 0; tick < 82; tick += 1) {
    const result = stepNativeDeadSpider(state, rng)
    state = result.state
    rng = result.rngState
  }
  const records = []
  const edgeWidth = nativeEnemySpriteRecord('DeadHawg', 139).width
  try {
    for (const member of [...sprites.map(sprite => ({ name: `selector-${sprite.atlasEntry}`, sprites: [sprite], remains: [] })),
      { name: 'DeadSpider', sprites: [], remains: [{ id: 1, spawnTick: 0, state }] },
      { name: 'combined', sprites, remains: [{ id: 1, spawnTick: 0, state }] },
      { name: 'cell-boundary', sprites: [{ ...sprites[0], pos: { x: position.x + 256 + edgeWidth / 2 + 1, y: position.y }, s1: 10 }], remains: [] },
    ]) {
      const ground = new Container()
      const root = new Container()
      ground.position.set(-544, -194)
      root.position.copyFrom(ground.position)
      app.stage.addChild(ground, root)
      const view = new NativeCompactMaskView(root, ground, app.renderer, textures, { bounds, sprites: member.sprites })
      view.update({ player: { position } }, member.remains, bounds, 82, 1)
      if (root.children.length !== 1) throw new Error(`${member.name} was not admitted to the compact target`)
      const target = root.children[0].texture
      const { pixels, width, height } = app.renderer.extract.pixels({ target })
      const alphaAt = (x, y) => pixels[(y * width + x) * 4 + 3]
      let nonzeroAlpha = 0
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 0) nonzeroAlpha += 1
      const record = {
        name: member.name, width, height, nonzeroAlpha,
        corners: [alphaAt(0, 0), alphaAt(width - 1, 0), alphaAt(0, height - 1), alphaAt(width - 1, height - 1)],
      }
      view.update({ player: { position }, guest: { position: { x: 820, y: 450 } } }, member.remains, bounds, 83, 1)
      record.joinedTargets = root.children.length
      view.update({ guest: { position } }, member.remains, bounds, 84, 1)
      record.departedTargets = root.children.length
      record.departedTargetDestroyed = target.destroyed
      view.update({ player: { position } }, member.remains, bounds, 85, 1)
      app.render()
      if (member.name === 'combined') {
        record.image = app.renderer.extract.base64({ target: app.stage })
        record.image = await record.image
      }
      view.destroy()
      record.remainingChildren = root.children.length + ground.children.length
      records.push(record)
      root.destroy()
      ground.destroy()
    }
    return records
  } finally {
    destroyBoneyardWorldTextures(textures)
    pipeline.destroy()
    app.destroy({ removeView: true })
  }
}
