import badguys from '../../editor/manifest/badguys.json'
import deadhawg from '../../editor/manifest/deadhawg.json'
import demon from '../../editor/manifest/demon.json'
import type { AtlasManifest } from '../../editor/manifest/index.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'
import type { NativeEnemyAtlas } from './native-enemy-presentation.ts'

const spriteFiles = {
  ...import.meta.glob([
    '../../assets/game/boneyard/badguys/0015.png',
    '../../assets/game/boneyard/badguys/0055.png',
    '../../assets/game/boneyard/badguys/00[8-9][0-9].png',
    '../../assets/game/boneyard/badguys/01[0-2][0-9].png',
    '../../assets/game/boneyard/badguys/01[7-8][0-9].png',
    '../../assets/game/boneyard/badguys/02[0-6][0-9].png',
    '../../assets/game/boneyard/badguys/02[8-9][0-9].png',
    '../../assets/game/boneyard/badguys/03[0-4][0-9].png',
    '../../assets/game/boneyard/badguys/03[8-9][0-9].png',
    '../../assets/game/boneyard/badguys/04[0-1][0-9].png',
    '../../assets/game/boneyard/badguys/04[5-6][0-9].png',
    '../../assets/game/boneyard/badguys/04[7-9][0-9].png',
    '../../assets/game/boneyard/badguys/05[0-9][0-9].png',
    '../../assets/game/boneyard/badguys/060[0-9].png',
    '../../assets/game/boneyard/badguys/06[1-3][0-9].png',
    '../../assets/game/boneyard/badguys/07[7-9][0-9].png',
    '../../assets/game/boneyard/badguys/08[0-9][0-9].png',
    '../../assets/game/boneyard/badguys/09[0-9][0-9].png',
    '../../assets/game/boneyard/badguys/100[0-9].png',
    '../../assets/game/boneyard/badguys/10[4-9][0-9].png',
    '../../assets/game/boneyard/badguys/110[0-9].png',
    '../../assets/game/boneyard/badguys/11[1-3][0-9].png',
    '../../assets/game/boneyard/badguys/13[3-9][0-9].png',
    '../../assets/game/boneyard/badguys/14[0-6][0-9].png',
    '../../assets/game/boneyard/badguys/14[7-9][0-9].png',
    '../../assets/game/boneyard/badguys/15[0-6][0-9].png',
    '../../assets/game/boneyard/badguys/15[8-9][0-9].png',
    '../../assets/game/boneyard/badguys/16[0-9][0-9].png',
    '../../assets/game/boneyard/badguys/17[0-9][0-9].png',
    '../../assets/game/boneyard/badguys/18[0-3][0-9].png',
    '../../assets/game/boneyard/badguys/20[1-6][0-9].png',
    '../../assets/game/boneyard/badguys/20[7-9][0-9].png',
    '../../assets/game/boneyard/badguys/21[0-9][0-9].png',
    '../../assets/game/boneyard/badguys/22[0-5][0-9].png',
    '../../assets/game/boneyard/badguys/22[7-9][0-9].png',
    '../../assets/game/boneyard/badguys/229[0-9].png',
    '../../assets/game/boneyard/badguys/23[0-4][0-9].png',
    '../../assets/game/boneyard/badguys/23[6-9][0-9].png',
    '../../assets/game/boneyard/badguys/24[0-9][0-9].png',
    '../../assets/game/boneyard/badguys/250[0-8].png',
    '../../assets/game/boneyard/demon/0[0-9][0-9].png',
    '../../assets/game/boneyard/demon/1[0-1][0-9].png',
    '../../assets/game/boneyard/deadhawg/0[2-9][0-9].png',
    '../../assets/game/boneyard/deadhawg/1[1-4][0-9].png',
  ], { eager: true, query: '?url', import: 'default' }),
} as Record<string, string>

const requiredBadGuysRanges = [
  [15, 15],
  [55, 55],
  [86, 86],
  [92, 121],
  [175, 187],
  [202, 237],
  [251, 254],
  [285, 342],
  [383, 392],
  [401, 419],
  [451, 612],
  [613, 630],
  [775, 918],
  [919, 936],
  [991, 1008],
  [1045, 1116],
  [1117, 1134],
  [1333, 1566],
  [1585, 1839],
  [2013, 2069],
  [2070, 2087],
  [2095, 2202],
  [2203, 2256],
  [2275, 2292],
  [2293, 2346],
  [2365, 2508],
] as const
const requiredDeadHawgRanges = [[28, 28], [30, 30], [46, 77], [114, 144]] as const
const requiredDemonRanges = [[1, 115]] as const
const selectedSpriteFiles = Object.fromEntries(Object.entries(spriteFiles).filter(([path]) => {
  const entry = Number(path.match(/(\d+)\.png$/)?.[1])
  const ranges = path.includes('/demon/')
    ? requiredDemonRanges
    : path.includes('/deadhawg/')
      ? requiredDeadHawgRanges
      : requiredBadGuysRanges
  return ranges.some(([first, last]) => entry >= first && entry <= last)
})) as Record<string, string>

const manifests: Readonly<Record<NativeEnemyAtlas, AtlasManifest>> = {
  BadGuys: badguys as AtlasManifest,
  DeadHawg: deadhawg as AtlasManifest,
  Demon: demon as AtlasManifest,
}

export interface NativeEnemySpriteRecord {
  anchorX: number
  anchorY: number
  atlas: NativeEnemyAtlas
  entry: number
  height: number
  source: string
  width: number
}

export const NATIVE_ENEMY_ASSET_SOURCES = [...new Set(Object.values(selectedSpriteFiles))]

export function nativeEnemySpriteRecord(
  atlas: NativeEnemyAtlas,
  entry: number,
): NativeEnemySpriteRecord {
  const record = manifests[atlas].entries[entry]
  if (!record || record.empty || !record.file) {
    throw new Error(`Native enemy atlas record is missing: ${atlas}:${entry}`)
  }
  const source = selectedSpriteFiles[`../../assets/game/boneyard/${record.file}`]
  if (!source) {
    throw new Error(`Native enemy atlas record was not selected for loading: ${atlas}:${entry}`)
  }
  const anchor = nativeSpriteAnchor(record.rect.w, record.rect.h, record.origin)
  return {
    anchorX: anchor.x,
    anchorY: anchor.y,
    atlas,
    entry,
    height: record.rect.h,
    source,
    width: record.rect.w,
  }
}
