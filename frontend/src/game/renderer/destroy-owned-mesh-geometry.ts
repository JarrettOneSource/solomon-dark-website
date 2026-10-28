import type { Geometry } from 'pixi.js'

/** Only when the view owns the geometry and all its buffers. */
export function destroyOwnedMeshGeometry(owner: { readonly geometry: Geometry }): void {
  const geometry = owner.geometry
  // Notify GPU owners before Geometry.destroy removes its unload listeners.
  geometry.unload()
  geometry.destroy(true)
}
