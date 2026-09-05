import assert from 'node:assert/strict'
import test from 'node:test'
import { Container } from 'pixi.js'
import { NATIVE_TEXTURE_COLOR_UNIFORMS, renderNativeDiffuseMask } from './native-texture-color.ts'

test('diffuse mask rendering restores the enclosing color mode after nested renders', () => {
  const container = new Container()
  const modes: number[] = []
  const readMode = () => NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor
  const options = { container }
  assert.equal(readMode(), 0)
  renderNativeDiffuseMask({ render(received) {
    assert.equal(received, options)
    modes.push(readMode())
    renderNativeDiffuseMask({ render() { modes.push(readMode()) } }, options)
    modes.push(readMode())
  } }, options)
  assert.deepEqual(modes, [1, 1, 1])
  assert.equal(readMode(), 0)
  container.destroy()
})

test('diffuse mask rendering propagates render failures and restores color mode', () => {
  const container = new Container()
  const failure = new Error('render failed')
  assert.throws(() => renderNativeDiffuseMask({ render() { throw failure } }, { container }), failure)
  assert.equal(NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor, 0)
  container.destroy()
})
