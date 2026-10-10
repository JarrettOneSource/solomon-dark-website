import type { WebGLRenderer } from 'pixi.js'

const installedTargets = new WeakSet<WebGLRenderer['renderTarget']>()

/** Keep D3D9 integer pixel centers when native quads reach WebGL's half-pixel centers. */
export function installNativePixelCenterProjection(renderer: WebGLRenderer): void {
  const system = renderer.renderTarget
  if (installedTargets.has(system)) return
  const originalBind = system.bind
  system.bind = function bindNativePixelCenters(
    this: typeof system,
    ...args: Parameters<typeof originalBind>
  ) {
    const target = originalBind.apply(this, args)
    const projection = this.projectionMatrix
    const halfPixel = 0.5 / this.renderTarget.colorTexture.resolution
    // bind rebuilds this matrix even for the same target. Correct it once afterward,
    // before GlobalUniformSystem publishes it; the target owns resolution and Y flip.
    projection.tx += projection.a * halfPixel
    projection.ty += projection.d * halfPixel
    return target
  }
  installedTargets.add(system)
}
