import assert from 'node:assert/strict'
import test from 'node:test'
import type { WebGLRenderer } from 'pixi.js'
import { installNativePixelCenterProjection } from './native-pixel-center-projection.ts'

interface Target {
  width: number
  height: number
  isRoot: boolean
  colorTexture: { resolution: number }
}

function fixture() {
  const calls: unknown[][] = []
  const system = {
    renderTarget: null as Target | null,
    projectionMatrix: { a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 },
    bind(target: Target, ...rest: unknown[]) {
      calls.push([target, ...rest])
      this.renderTarget = target
      const { resolution } = target.colorTexture
      Object.assign(this.projectionMatrix, {
        a: 2 * resolution / target.width,
        b: 0,
        c: 0,
        d: (target.isRoot ? -2 : 2) * resolution / target.height,
        tx: -1,
        ty: target.isRoot ? 1 : -1,
      })
      return target
    },
  }
  return { calls, system, renderer: { renderTarget: system } as unknown as WebGLRenderer }
}

test('native projection adds one physical half pixel for every target size, density and Y orientation', () => {
  const { system, renderer } = fixture()
  installNativePixelCenterProjection(renderer)
  for (const [width, height] of [[256, 256], [512, 512], [1600, 900], [1920, 1080]]) {
    for (const resolution of [0.1, 0.2, 0.25, 0.4, 0.5, 1, 1.25, 2, 2.5, 3, 4]) {
      for (const isRoot of [true, false]) {
        const target = { width: width!, height: height!, isRoot, colorTexture: { resolution } }
        assert.equal(system.bind(target), target)
        const p = system.projectionMatrix
        assert.equal(p.tx, -1 + 1 / width!)
        assert.equal(p.ty, isRoot ? 1 - 1 / height! : -1 + 1 / height!)
        assert.equal(p.a, 2 * resolution / width!)
        assert.equal(p.d, (isRoot ? -2 : 2) * resolution / height!)
        assert.equal(p.b, 0)
        assert.equal(p.c, 0)
      }
    }
  }
})

test('native projection is idempotent and repeated or switched target binds cannot accumulate a shift', () => {
  const { calls, system, renderer } = fixture()
  const originalBind = system.bind
  installNativePixelCenterProjection(renderer)
  const installedBind = system.bind
  assert.notEqual(installedBind, originalBind)
  installNativePixelCenterProjection(renderer)
  assert.equal(system.bind, installedBind)
  const root = { width: 1600, height: 900, isRoot: true, colorTexture: { resolution: 2 } }
  const offscreen = { width: 256, height: 256, isRoot: false, colorTexture: { resolution: 1 } }
  for (const target of [root, root, offscreen, offscreen, root, root]) {
    const frame = { x: 7, y: 11, width: target.width, height: target.height }
    assert.equal(system.bind(target, true, [0, 0, 0, 1], frame, 0, 0), target)
    assert.equal(system.projectionMatrix.tx, -1 + 1 / target.width)
    assert.equal(system.projectionMatrix.ty, target.isRoot ? 1 - 1 / target.height : -1 + 1 / target.height)
    assert.deepEqual(calls.at(-1), [target, true, [0, 0, 0, 1], frame, 0, 0])
  }
  assert.equal(calls.length, 6)
})

test('native projection uses current target dimensions after resize and isolates renderer instances', () => {
  const first = fixture()
  const second = fixture()
  installNativePixelCenterProjection(first.renderer)
  const target = { width: 1600, height: 900, isRoot: true, colorTexture: { resolution: 1 } }
  first.system.bind(target)
  second.system.bind(target)
  assert.equal(second.system.projectionMatrix.tx, -1)
  assert.equal(second.system.projectionMatrix.ty, 1)
  Object.assign(target, { width: 1920, height: 1080 })
  target.colorTexture.resolution = 2.5
  first.system.bind(target)
  assert.equal(first.system.projectionMatrix.tx, -1 + 1 / 1920)
  assert.equal(first.system.projectionMatrix.ty, 1 - 1 / 1080)
  installNativePixelCenterProjection(second.renderer)
  second.system.bind(target)
  assert.deepEqual(first.system.projectionMatrix, second.system.projectionMatrix)
})
