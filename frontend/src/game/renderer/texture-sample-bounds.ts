import type { Rectangle, Texture } from 'pixi.js'

const UNBOUNDED_SAMPLE = new Float32Array([0, 0, -1, -1])
const boundsByTexture = new WeakMap<Texture, Float32Array>()

export function textureSampleBounds(texture: Texture): Float32Array {
  return boundsByTexture.get(texture) ?? UNBOUNDED_SAMPLE
}

/** Isolate filtering at the original image/frame boundary without changing UVs. */
export function isolateTextureSamples(texture: Texture, frame: Rectangle = texture.frame): Texture {
  const original = frame.clone()
  const bounds = new Float32Array(4)
  boundsByTexture.set(texture, bounds)
  const update = (): void => {
    // Authored frames admit fractional spans, including spans smaller than one texel.
    const insetX = Math.min(.5, original.width / 2)
    const insetY = Math.min(.5, original.height / 2)
    const source = texture.source
    bounds[0] = (original.x + insetX) / source.width
    bounds[1] = (original.y + insetY) / source.height
    bounds[2] = (original.x + original.width - insetX) / source.width
    bounds[3] = (original.y + original.height - insetY) / source.height
  }
  texture.on('update', update)
  update()
  return texture
}

/** Absolute-UV views share their owning record's bounds and source updates. */
export function shareTextureSampleBounds(source: Texture, view: Texture): void {
  const bounds = boundsByTexture.get(source)
  if (!bounds) throw new TypeError('texture page view requires an isolated source record')
  boundsByTexture.set(view, bounds)
}
