import { boneyardGeometrySha256 } from './project-boneyard.ts'
import { projectModBoneyard, type ModBoneyardEntry } from './boneyard-catalog.ts'

export const MAX_EDITOR_TEST_BYTES = 8 * 1024 * 1024
export const EDITOR_TEST_BONEYARD_ID = 'editor-test'

/** A disposable geometry preview, never a published mod or persisted wizard. */
export function materializeEditorTestBoneyard(value: unknown): ModBoneyardEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Choose a Boneyard document to test.')
  }
  const body = value as Record<string, unknown>
  if (typeof body.name !== 'string' || body.name.trim().length === 0
      || body.name.length > 160 || typeof body.bytesBase64 !== 'string'
      || body.bytesBase64.length === 0
      || body.bytesBase64.length > Math.ceil(MAX_EDITOR_TEST_BYTES / 3) * 4
      || body.bytesBase64.length % 4 !== 0) {
    throw new Error('The test Boneyard must be a valid native file smaller than 8 MiB.')
  }
  // Bounded decoding plus a canonical round trip avoids a repeated-group
  // regexp, whose backtracking stack can overflow near the 8 MiB limit.
  const bytes = Buffer.from(body.bytesBase64, 'base64')
  if (bytes.length > MAX_EDITOR_TEST_BYTES || bytes.toString('base64') !== body.bytesBase64) {
    throw new Error('The test Boneyard encoding is invalid.')
  }
  const entry = projectModBoneyard('editor-test', 'Private editor test', 'data/levels/editor-test.boneyard', bytes)
  const { bounds, spawn } = entry.scene
  if (![bounds.x, bounds.y, bounds.w, bounds.h, spawn.x, spawn.y, spawn.facingDeg].every(Number.isFinite)
      || bounds.w <= 0 || bounds.h <= 0 || bounds.w > 131072 || bounds.h > 131072) {
    throw new Error('Choose finite Boneyard bounds and a player spawn before testing.')
  }
  const name = body.name.trim()
  const scene = { ...entry.scene, name }
  return {
    ...entry,
    geometrySha256: boneyardGeometrySha256(scene),
    choice: { ...entry.choice, id: EDITOR_TEST_BONEYARD_ID, name },
    scene,
  }
}
