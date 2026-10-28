import { MeshSimple } from 'pixi.js'
import type { ResidentTexture } from './boneyard-renderer-model.ts'
import { destroyOwnedMeshGeometry } from './destroy-owned-mesh-geometry.ts'

/** Retained quads own geometry; original native atlas textures remain borrowed. */
export function destroyResidentTexture(resident: ResidentTexture): void {
  if (resident.sceneryMaterial) resident.sceneryMaterial.destroy()
  else if (resident.surfaceMesh) resident.surfaceMesh.destroy()
  else if (resident.sprite instanceof MeshSimple) destroyOwnedMeshGeometry(resident.sprite)
  for (const geometry of resident.ownedGeometries ?? []) destroyOwnedMeshGeometry({ geometry })
  if (resident.ownsTexture !== false) resident.texture.destroy(true)
  resident.pixels = EMPTY_RESIDENT_PIXELS
}

const EMPTY_RESIDENT_PIXELS = new Uint8ClampedArray(0)
