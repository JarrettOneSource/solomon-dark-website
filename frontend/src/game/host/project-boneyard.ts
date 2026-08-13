import { createHash } from 'node:crypto'

import type { BoneyardDoc } from '../../editor/format/boneyard.ts'
import type { BoneyardScene } from '../core-kernels/boneyard.ts'

export const SOLOMON_DIG_FRAME_PROGRAM = [
  0, 0, 0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 17,
  17, 17, 17, 16, 15, 13, 11, 9, 7, 5, 3, 1,
] as const

const SOLOMON_X_FROM_GRAVE = 10
const SOLOMON_Y_FROM_GRAVE = 113
const LANTERN_X_FROM_GRAVE = -55
const LANTERN_Y_FROM_GRAVE = 73

export function projectBoneyard(doc: BoneyardDoc): BoneyardScene {
  const spawn = doc.geometry.playerSpawn
  if (!spawn) throw new Error(`${doc.meta.name}: Boneyard has no player spawn`)
  const facingDeg = doc.geometry.playerSpawnFacingDeg ?? 0
  const objects = doc.objects.map((object) => compact(object, [
    'eid', 'typeId', 'pos', 'variant', 'rot', 'scale', 'sortBias',
    'atlasEntry', 'secondaryAtlasEntry', 'secondaryVariant',
    'secondaryVisible', 'overlayAtlasEntry', 'overlayVariant', 'atlasEntries',
  ])) as unknown as BoneyardScene['objects']
  return {
    name: doc.meta.name,
    environmentMode: doc.meta.header.environmentMode,
    bounds: {
      x: doc.meta.bounds.x,
      y: doc.meta.bounds.y,
      w: doc.meta.bounds.w,
      h: doc.meta.bounds.h,
    },
    spawn: { ...spawn, facingDeg },
    objects,
    sprites: doc.sprites.map((sprite) => compact(sprite, [
      'eid', 'atlasEntry', 'deadHawgEntry', 'pos', 's0', 's1', 's2', 'flags',
    ])),
    roads: doc.roads.map((road) => compact(road, [
      'eid', 'typeId', 'points', 'style', 'startWidthScale', 'endWidthScale',
      'quad',
    ])),
    fences: doc.fences.map(projectFence),
    terrain: doc.terrain.map((terrain) => compact(terrain, [
      'eid', 'pos', 'points', 'style', 'entry',
    ])),
    solomonDig: selectSolomonSetPiece(objects, 0),
  } as unknown as BoneyardScene
}

function projectFence(fence: BoneyardDoc['fences'][number]): Record<string, unknown> {
  return compact({
    ...fence,
    startPostVariant: explicitPostVariant(fence.startPostVariant),
    endPostVariant: explicitPostVariant(fence.endPostVariant),
  }, [
    'eid', 'typeId', 'points', 'style', 'segmentCode',
    'startPostVariant', 'endPostVariant',
  ])
}

function explicitPostVariant(value: number | undefined): number | undefined {
  return value === 0xffffffff ? undefined : value
}

export function materializeSolomonSetPiece(
  scene: BoneyardScene,
  selection: number,
): BoneyardScene {
  return {
    ...scene,
    solomonDig: selectSolomonSetPiece(scene.objects, selection),
  }
}

export function boneyardGeometrySha256(scene: BoneyardScene): string {
  return createHash('sha256').update(JSON.stringify(scene)).digest('hex')
}

function selectSolomonSetPiece(
  objects: BoneyardScene['objects'],
  selection: number,
): BoneyardScene['solomonDig'] {
  const candidates = objects.filter((object) => (
    object.typeId === 2029 && object.overlayVariant === 8
  ))
  if (candidates.length === 0) return null
  const gravePosition = candidates[selection % candidates.length].pos
  return {
    gravePosition: { ...gravePosition },
    lanternPosition: {
      x: gravePosition.x + LANTERN_X_FROM_GRAVE,
      y: gravePosition.y + LANTERN_Y_FROM_GRAVE,
    },
    position: {
      x: gravePosition.x + SOLOMON_X_FROM_GRAVE,
      y: gravePosition.y + SOLOMON_Y_FROM_GRAVE,
    },
    frameProgram: SOLOMON_DIG_FRAME_PROGRAM,
    ticksPerFrame: 5,
  }
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
