import { UniformGroup, type GlBatchAdaptor, type Graphics, type Mesh, type Renderer, type RenderOptions, type Sprite, type WebGLRenderer } from 'pixi.js'

export const NATIVE_TEXTURE_COLOR_UNIFORMS = new UniformGroup({
  uIgnoreTextureColor: { value: 0, type: 'f32' },
})

export const NATIVE_DIFFUSE_TEXTURE_COLOR_UNIFORMS = new UniformGroup({
  uIgnoreTextureColor: { value: 1, type: 'f32' },
})

export const NATIVE_TEXTURE_COLOR_HEADER = 'uniform float uIgnoreTextureColor;'

const diffuseColorDrawables = new WeakSet<object>()

export function setNativeDiffuseColor(drawable: Sprite | Mesh | Graphics, enabled: boolean): void {
  if (diffuseColorDrawables.has(drawable) === enabled) return
  if (enabled) diffuseColorDrawables.add(drawable)
  else diffuseColorDrawables.delete(drawable)
  // Color mode participates in the pinned Pixi view's retained batch data.
  drawable['onViewUpdate']()
}

export function usesNativeDiffuseColor(drawable: object): boolean {
  return diffuseColorDrawables.has(drawable)
}

export function nativePuppetHitTint(complexLighting: boolean, mainTint = 0xffffff): number {
  const red = complexLighting ? Math.fround(.65) : 1
  return Math.trunc((mainTint >>> 16 & 0xff) * red) << 16
}

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

export function multiplyNativeTints(first: number, second: number): number {
  const channel = (shift: number): number => Math.round(
    ((first >> shift) & 0xff) * ((second >> shift) & 0xff) / 255,
  )
  return channel(16) << 16 | channel(8) << 8 | channel(0)
}
