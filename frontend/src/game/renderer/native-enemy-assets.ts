import badguys from '../../editor/manifest/badguys.json'
import deadhawg from '../../editor/manifest/deadhawg.json'
import demon from '../../editor/manifest/demon.json'
import type { AtlasManifest } from '../../editor/manifest/index.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'
import { boneyardCombatAtlasSource } from '../../lib/boneyard-combat-atlas-key.ts'
import type { NativeEnemySampleAtlas } from './native-enemy-animation.ts'

type NativeEnemyAtlas = NativeEnemySampleAtlas

const deadHawgSpriteFiles = import.meta.glob([
  '../../assets/game/boneyard/deadhawg/000.png',
  '../../assets/game/boneyard/deadhawg/019.png',
  '../../assets/game/boneyard/deadhawg/028.png',
  '../../assets/game/boneyard/deadhawg/030.png',
  '../../assets/game/boneyard/deadhawg/031.png',
  '../../assets/game/boneyard/deadhawg/04[6-9].png',
  '../../assets/game/boneyard/deadhawg/05[0-9].png',
  '../../assets/game/boneyard/deadhawg/06[0-9].png',
  '../../assets/game/boneyard/deadhawg/07[0-7].png',
  '../../assets/game/boneyard/deadhawg/11[4-9].png',
  '../../assets/game/boneyard/deadhawg/12[0-9].png',
  '../../assets/game/boneyard/deadhawg/13[0-9].png',
  '../../assets/game/boneyard/deadhawg/14[0-4].png',
], { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const requiredBadGuysRanges = [
  [2, 2],
  [5, 5],
  [6, 6],
  [10, 11],
  [14, 16],
  [18, 18],
  [20, 20],
  [21, 21],
  [26, 27],
  [28, 28],
  [30, 30],
  [31, 32],
  [35, 35],
  [43, 45],
  [46, 46],
  [49, 51],
  [53, 56],
  [65, 65],
  [67, 67],
  [69, 69],
  [70, 70],
  [71, 71],
  [76, 76],
  [84, 84],
  [86, 87],
  [92, 121],
  [168, 171],
  [175, 187],
  [202, 282],
  [285, 342],
  [375, 376],
  [381, 392],
  [401, 433],
  [451, 612],
  [613, 774],
  [775, 918],
  [919, 990],
  [991, 1044],
  [1045, 1116],
  [1117, 1332],
  [1333, 1566],
  [1585, 1839],
  [2002, 2010],
  [2013, 2069],
  [2070, 2202],
  [2203, 2292],
  [2293, 2364],
  [2365, 2508],
] as const
const requiredDeadHawgRanges = [[0, 0], [19, 19], [28, 28], [30, 31], [46, 77], [114, 144]] as const
const requiredDemonRanges = [[1, 115]] as const
const manifests: Readonly<Record<NativeEnemyAtlas, AtlasManifest>> = {
  BadGuys: badguys as AtlasManifest,
  DeadHawg: deadhawg as AtlasManifest,
  Demon: demon as AtlasManifest,
}
const requiredEntries: Readonly<Record<NativeEnemyAtlas, readonly number[]>> = {
  BadGuys: expandRanges(requiredBadGuysRanges),
  DeadHawg: expandRanges(requiredDeadHawgRanges),
  Demon: expandRanges(requiredDemonRanges),
}
const selectedSources = new Map<string, string>()
for (const atlas of ['BadGuys', 'DeadHawg', 'Demon'] as const) {
  for (const entry of requiredEntries[atlas]) {
    const record = manifests[atlas].entries[entry]
    if (!record || record.empty || !record.file) {
      throw new Error(`Native enemy atlas record is missing: ${atlas}:${entry}`)
    }
    const source = atlas === 'DeadHawg'
      ? deadHawgSpriteFiles[`../../assets/game/boneyard/${record.file}`]
      : boneyardCombatAtlasSource(atlas, entry)
    if (!source) throw new Error(`Native enemy atlas source is missing: ${atlas}:${entry}`)
    selectedSources.set(`${atlas}:${entry}`, source)
  }
}

export interface NativeEnemySpriteGeometry {
  anchorX: number
  anchorY: number
  atlas: NativeEnemyAtlas
  entry: number
  height: number
  points: readonly Readonly<{ x: number; y: number }>[]
  width: number
}

export interface NativeEnemySpriteRecord extends NativeEnemySpriteGeometry {
  source: string
}

export interface NativeEnemyRegisteredFrame {
  height: number
  logicalHeight: number
  logicalWidth: number
  trimX: number
  trimY: number
  width: number
}

export const NATIVE_ENEMY_ASSET_SOURCES = [...new Set(selectedSources.values())]

export function nativeEnemySpriteGeometry(
  atlas: NativeEnemyAtlas,
  entry: number,
): NativeEnemySpriteGeometry {
  const record = manifests[atlas].entries[entry]
  if (!record || record.empty || !record.file) {
    throw new Error(`Native enemy atlas record is missing: ${atlas}:${entry}`)
  }
  const anchor = nativeSpriteAnchor(record.rect.w, record.rect.h, record.origin)
  return {
    anchorX: anchor.x,
    anchorY: anchor.y,
    atlas,
    entry,
    height: record.rect.h,
    points: Object.freeze((record.extras ?? []).map((point) => Object.freeze({ ...point }))),
    width: record.rect.w,
  }
}

export function nativeEnemySpriteRecord(
  atlas: NativeEnemyAtlas,
  entry: number,
): NativeEnemySpriteRecord {
  const geometry = nativeEnemySpriteGeometry(atlas, entry)
  const source = selectedSources.get(`${atlas}:${entry}`)
  if (!source) {
    throw new Error(`Native enemy atlas record was not selected for loading: ${atlas}:${entry}`)
  }
  return { ...geometry, source }
}

export function nativeEnemyRegisteredFrame(
  atlas: NativeEnemyAtlas,
  entry: number,
  logicalWidth: number,
  logicalHeight: number,
): NativeEnemyRegisteredFrame {
  const record = nativeEnemySpriteGeometry(atlas, entry)
  return {
    height: record.height,
    logicalHeight,
    logicalWidth,
    trimX: roundToNearestEven(logicalWidth / 2 - record.anchorX),
    trimY: roundToNearestEven(logicalHeight / 2 - record.anchorY),
    width: record.width,
  }
}

function expandRanges(
  ranges: readonly (readonly [number, number])[],
): number[] {
  return ranges.flatMap(([first, last]) => (
    Array.from({ length: last - first + 1 }, (_, index) => first + index)
  ))
}

function roundToNearestEven(value: number): number {
  const floor = Math.floor(value)
  const fraction = value - floor
  if (fraction !== 0.5) return Math.round(value)
  return floor % 2 === 0 ? floor : floor + 1
}
