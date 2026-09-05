import { UniformGroup, type GlBatchAdaptor, type Renderer, type RenderOptions, type WebGLRenderer } from 'pixi.js'

export const NATIVE_TEXTURE_COLOR_UNIFORMS = new UniformGroup({
  uIgnoreTextureColor: { value: 0, type: 'f32' },
})

export const NATIVE_TEXTURE_COLOR_HEADER = 'uniform float uIgnoreTextureColor;'

export function installNativeTextureColorSync(
  adaptor: Pick<GlBatchAdaptor, 'start'>,
  shaderSystem: Pick<WebGLRenderer['shader'], 'updateUniformGroup'>,
): () => void {
  const startBatch = adaptor.start
  adaptor.start = function (...args) {
    startBatch.apply(this, args)
    shaderSystem.updateUniformGroup(NATIVE_TEXTURE_COLOR_UNIFORMS)
  }
  return () => { adaptor.start = startBatch }
}

/** Retail D3DTOP_SELECTARG1 keeps diffuse RGB and still samples texture alpha. */
export function renderNativeDiffuseMask(
  renderer: Pick<Renderer, 'render'>,
  options: RenderOptions,
): void {
  const previous = NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor
  NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor = 1
  try {
    renderer.render(options)
  } finally {
    NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor = previous
  }
}
