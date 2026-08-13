import { createHash } from 'node:crypto'

import type { BoneyardDoc } from '../../editor/format/boneyard.ts'
import type { BoneyardScene } from '../core-kernels/boneyard.ts'

export const SOLOMON_DIG_FRAME_PROGRAM = [
  0, 0, 0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 17,
  17, 17, 17, 16, 15, 13, 11, 9, 7, 5, 3, 1,
] as const

export function projectBoneyard(doc: BoneyardDoc): BoneyardScene {
  const spawn = doc.geometry.playerSpawn
  if (!spawn) throw new Error(`${doc.meta.name}: Boneyard has no player spawn`)
  const facingDeg = doc.geometry.playerSpawnFacingDeg ?? 0
  const facingRadians = facingDeg * Math.PI / 180
  return {
    name: doc.meta.name,
    bounds: {
      x: doc.meta.bounds.x,
      y: doc.meta.bounds.y,
      w: doc.meta.bounds.w,
      h: doc.meta.bounds.h,
    },
    spawn: { ...spawn, facingDeg },
    objects: doc.objects.map((object) => compact(object, [
      'eid', 'typeId', 'pos', 'variant', 'rot', 'scale', 'sortBias',
      'atlasEntry', 'secondaryAtlasEntry', 'secondaryVariant',
      'secondaryVisible', 'overlayAtlasEntry', 'overlayVariant', 'atlasEntries',
    ])),
    sprites: doc.sprites.map((sprite) => compact(sprite, [
      'eid', 'atlasEntry', 'deadHawgEntry', 'pos', 's0', 's1', 's2', 'flags',
    ])),
    roads: doc.roads.map((road) => compact(road, [
      'eid', 'typeId', 'points', 'style', 'startWidthScale', 'endWidthScale',
      'quad',
    ])),
    fences: doc.fences.map((fence) => compact(fence, [
      'eid', 'typeId', 'points', 'style', 'segmentCode',
    ])),
    terrain: doc.terrain.map((terrain) => compact(terrain, [
      'eid', 'pos', 'points', 'style', 'entry',
    ])),
    solomonDig: {
      position: {
        x: spawn.x + Math.sin(facingRadians) * 240,
        y: spawn.y - Math.cos(facingRadians) * 240,
      },
      frameProgram: SOLOMON_DIG_FRAME_PROGRAM,
      ticksPerFrame: 5,
    },
  } as unknown as BoneyardScene
}

export function boneyardGeometrySha256(scene: BoneyardScene): string {
  return createHash('sha256').update(JSON.stringify(scene)).digest('hex')
}

function compact<T extends object>(
  source: T,
  keys: readonly string[],
): Record<string, unknown> {
  const record = source as unknown as Record<string, unknown>
  const target: Record<string, unknown> = {}
  for (const key of keys) {
    if (record[key] !== undefined) target[key] = record[key]
  }
  return target
}
