import { createHash } from 'node:crypto'

import type { BoneyardDoc } from '../../editor/format/boneyard.ts'
import type { BoneyardPoint, BoneyardScene } from '../core-kernels/boneyard.ts'

export const SOLOMON_DIG_FRAME_PROGRAM = [
  0, 0, 0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 17,
  17, 17, 17, 16, 15, 13, 11, 9, 7, 5, 3, 1,
] as const

const SOLOMON_X_FROM_GRAVE = 10
const SOLOMON_Y_FROM_GRAVE = 113
const LANTERN_X_FROM_GRAVE = -55
const LANTERN_Y_FROM_GRAVE = 73

// Generated compact entry N binds DeadHawg record 114+N. These seven exact
// centered record sizes are the generator's dirt/rock families.
const OPENING_SOLOMON_GROUND_CLUTTER_SIZES = new Map<number, readonly [number, number]>([
  [6, [260, 178]],
  [7, [89, 89]],
  [8, [62, 62]],
  [21, [64, 56]],
  [22, [70, 58]],
  [23, [80, 62]],
  [24, [69, 59]],
])

export function projectBoneyard(doc: BoneyardDoc): BoneyardScene {
  const spawn = doc.geometry.playerSpawn
  if (!spawn) throw new Error(`${doc.meta.name}: Boneyard has no player spawn`)
  const facingDeg = doc.geometry.playerSpawnFacingDeg ?? 0
  const objects = doc.objects.map((object) => compact(object, [
    'eid', 'typeId', 'pos', 'variant', 'rot', 'scale', 'sortBias',
    'atlasEntry', 'secondaryAtlasEntry', 'secondaryVariant',
    'secondaryVisible', 'overlayAtlasEntry', 'overlayVariant', 'atlasEntries',
  ])) as unknown as BoneyardScene['objects']
  const scene = {
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
    roads: doc.roads.map(projectRoad),
    fences: doc.fences.map(projectFence),
    terrain: doc.terrain.map((terrain) => compact(terrain, [
      'eid', 'pos', 'points', 'style', 'entry',
    ])),
    solomonDig: null,
  } as unknown as BoneyardScene
  return materializeOpeningSolomonSetPiece(scene)
}

function projectRoad(road: BoneyardDoc['roads'][number]): Record<string, unknown> {
  return compact({
    ...road,
    linkMask: (
      (road.previousUid !== undefined && road.previousUid !== 0xffffffff ? 1 : 0)
      | (road.nextUid !== undefined && road.nextUid !== 0xffffffff ? 2 : 0)
    ),
  }, [
    'eid', 'typeId', 'points', 'style', 'startWidthScale', 'endWidthScale',
    'quad', 'linkMask',
  ])
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

export function materializeOpeningSolomonSetPiece(scene: BoneyardScene): BoneyardScene {
  const solomonDig = selectSolomonSetPiece(scene.objects, scene.spawn)
  return {
    ...scene,
    solomonDig,
    sprites: solomonDig === null
      ? scene.sprites
      : scene.sprites.filter((sprite) => !openingSolomonGroundClutterContains(
          sprite,
          solomonDig.position,
        )),
  }
}

export function boneyardGeometrySha256(scene: BoneyardScene): string {
  return createHash('sha256').update(JSON.stringify(scene)).digest('hex')
}

function selectSolomonSetPiece(
  objects: BoneyardScene['objects'],
  origin: BoneyardScene['spawn'],
): BoneyardScene['solomonDig'] {
  let selected: BoneyardScene['objects'][number] | null = null
  let selectedDistance = Number.POSITIVE_INFINITY
  for (const object of objects) {
    if (object.typeId !== 2029 || object.overlayVariant !== 8) continue
    const dx = object.pos.x - origin.x
    const dy = object.pos.y - origin.y
    const distance = dx * dx + dy * dy
    if (distance < selectedDistance) {
      selected = object
      selectedDistance = distance
    }
  }
  if (selected === null) return null
  const gravePosition = selected.pos
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

function openingSolomonGroundClutterContains(
  sprite: BoneyardScene['sprites'][number],
  point: Readonly<BoneyardPoint>,
): boolean {
  const compactEntry = sprite.deadHawgEntry === undefined
    ? sprite.atlasEntry
    : sprite.deadHawgEntry - 114
  const size = OPENING_SOLOMON_GROUND_CLUTTER_SIZES.get(compactEntry)
  if (!size) return false
  const scaleY = Number.isFinite(sprite.s1) ? Math.max(0, sprite.s1) : 1
  const scaleX = scaleY * ((sprite.flags & 1) !== 0 ? 0.8 : 1)
  const rotation = (Number.isFinite(sprite.s0) ? sprite.s0 : 0) * Math.PI / 180
  const dx = point.x - sprite.pos.x
  const dy = point.y - sprite.pos.y
  const localX = dx * Math.cos(rotation) + dy * Math.sin(rotation)
  const localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation)
  return Math.abs(localX) <= size[0] * scaleX / 2
    && Math.abs(localY) <= size[1] * scaleY / 2
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
