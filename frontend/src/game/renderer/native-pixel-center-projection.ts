import type { TextureSource, WebGLRenderer } from 'pixi.js'

interface NativePixelCenterScope {
  allTargets: boolean
  sources: WeakSet<TextureSource>
}

const installedTargets = new WeakMap<WebGLRenderer['renderTarget'], NativePixelCenterScope>()

/** Keep D3D9 integer pixel centers when native quads reach WebGL's half-pixel centers. */
export function installNativePixelCenterProjection(renderer: WebGLRenderer, source?: TextureSource): void {
  const system = renderer.renderTarget
  const existing = installedTargets.get(system)
  if (existing) {
    if (source) existing.sources.add(source)
    else existing.allTargets = true
    return
  }
  const scope: NativePixelCenterScope = {
    allTargets: source === undefined,
    sources: new WeakSet(source ? [source] : []),
  }
  const originalBind = system.bind
  system.bind = function bindNativePixelCenters(
    this: typeof system,
    ...args: Parameters<typeof originalBind>
  ) {
    const target = originalBind.apply(this, args)
    if (!scope.allTargets && !scope.sources.has(this.renderTarget.colorTexture)) return target
    const projection = this.projectionMatrix
    const halfPixel = 0.5 / this.renderTarget.colorTexture.resolution
    // bind rebuilds this matrix even for the same target. Correct it once afterward,
    // before GlobalUniformSystem publishes it; the target owns resolution and Y flip.
    projection.tx += projection.a * halfPixel
    projection.ty += projection.d * halfPixel
    return target
  }
  installedTargets.set(system, scope)
}
