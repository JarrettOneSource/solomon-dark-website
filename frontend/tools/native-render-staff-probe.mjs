import { Application, BufferImageSource, Container, MeshSimple, RenderTexture, Texture } from 'pixi.js'
import { nativeEnchantStaffDrawPlan } from '../src/game/player-enchant-staff-presentation.ts'
import { PlayerEnchantStaffView } from '../src/game/renderer/player-enchant-staff-view.ts'
import { installNativeFixedFunctionRenderPipeline } from '../src/game/renderer/native-fixed-function-render-pipeline.ts'
import { installNativeArenaRenderPipeline } from '../src/game/renderer/native-arena-render-pipeline.ts'
import { setNativeVertexColors } from '../src/game/renderer/native-material-batch.ts'

export async function compareNativeStaffFrames() {
  const texture = new Texture({ source: new BufferImageSource({
    resource: new Uint8Array([255, 255, 255, 255, 192, 192, 192, 128, 32, 32, 32, 64, 128, 128, 128, 192]),
    width: 2, height: 2, alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest',
  }) })
  const grid = Array.from({ length: 24 }, () => new Array(10).fill(Texture.EMPTY))
  const side = { front: grid, back: grid }
  const textures = { auras: [texture, texture], bodies: new Array(6).fill(side), hands: { primary: side, secondary: side } }
  const frames = []
  const lifetimes = []
  try {
    for (const mode of ['fixed', 'arena']) {
      const app = new Application()
      await app.init({ autoStart: false, width: 256, height: 256, preference: 'webgl', resolution: 1 })
      installNativeFixedFunctionRenderPipeline(app.renderer)
      const arena = mode === 'arena' ? installNativeArenaRenderPipeline(app.renderer) : null
      const target = RenderTexture.create({ width: 256, height: 256, alphaMode: 'no-premultiply-alpha' })
      const view = new PlayerEnchantStaffView(textures)
      view.container.position.set(128, 128)
      app.stage.addChild(view.container)
      const children = [...view.container.children]
      const geometry = children.find(child => child instanceof MeshSimple).geometry
      const buffers = [...geometry.buffers]
      let positionBufferUpdates = 0
      geometry.getBuffer('aPosition').on('update', () => { positionBufferUpdates += 1 })
      try {
        const variations = [{ tick: 18, widthSample: 0 }, { tick: 36, widthSample: 1.5 }, { tick: 54, widthSample: 0.75, pose: 2 }]
        for (const [frame, variation] of variations.entries()) {
          const input = {
            headingIndex: 6, pose: 0, learnedSkills: [[65, 1, 1]], living: true,
            nativeStaff: true, selectedPrimarySkillId: 16, selector: 0, weldBuildId: null, ...variation,
          }
          view.update(input, true)
          const actual = capture(app, target, app.stage)
          const plan = nativeEnchantStaffDrawPlan(input)
          const reference = new MeshSimple({
            texture, vertices: new Float32Array(plan.vertices),
            uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
            indices: new Uint32Array([0, 1, 2, 1, 2, 3]),
          })
          reference.blendMode = 'add'
          const packedColor = alpha => ((plan.tint >> 16) | (plan.tint & 0xff00)
            | ((plan.tint & 0xff) << 16) | (Math.trunc(alpha * 255) << 24)) >>> 0
          setNativeVertexColors(reference, new Uint32Array([
            packedColor(plan.nearAlpha), packedColor(plan.nearAlpha), packedColor(plan.farAlpha), packedColor(plan.farAlpha),
          ]))
          const parent = new Container()
          reference.position.set(128, 128)
          parent.addChild(reference)
          const expected = capture(app, target, parent)
          let changedChannels = 0
          let visiblePixels = 0
          for (let i = 0; i < actual.length; i += 1) {
            if (Math.abs(actual[i] - expected[i]) > 1) changedChannels += 1
            if (i % 4 === 3 && expected[i] > 0) visiblePixels += 1
          }
          frames.push({ mode, frame, changedChannels, visiblePixels })
          const referenceGeometry = reference.geometry
          parent.destroy({ children: true })
          referenceGeometry.destroy(true)
        }
      } finally {
        view.destroy()
        lifetimes.push({ mode, container: view.container.destroyed, children: children.every(child => child.destroyed),
          geometry: geometry.buffers === null && buffers.every(buffer => buffer.destroyed), textureAlive: !texture.destroyed,
          positionBufferUpdates })
        target.destroy(true)
        arena?.destroy()
        app.destroy(true, { children: true })
      }
    }
  } finally { texture.destroy(true) }
  return { frames, lifetimes }
}

function capture(app, target, container) {
  app.renderer.render({ container, target, clear: true, clearColor: [0, 0, 0, 0] })
  return app.renderer.extract.pixels({ target }).pixels
}
