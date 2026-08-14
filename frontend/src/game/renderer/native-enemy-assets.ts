import badguys from '../../editor/manifest/badguys.json'
import demon from '../../editor/manifest/demon.json'
import type { AtlasManifest } from '../../editor/manifest/index.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'
import type { NativeEnemyAtlas } from './native-enemy-presentation.ts'

const spriteFiles = {
  ...import.meta.glob([
    '../../assets/game/boneyard/badguys/01[7-8][0-9].png',
    '../../assets/game/boneyard/badguys/02[8-9][0-9].png',
    '../../assets/game/boneyard/badguys/03[0-4][0-9].png',
    '../../assets/game/boneyard/badguys/04[5-6][0-9].png',
    '../../assets/game/boneyard/badguys/06[1-3][0-9].png',
    '../../assets/game/boneyard/badguys/07[7-9][0-9].png',
    '../../assets/game/boneyard/badguys/08[4-6][0-9].png',
    '../../assets/game/boneyard/badguys/09[1-3][0-9].png',
    '../../assets/game/boneyard/badguys/099[0-9].png',
    '../../assets/game/boneyard/badguys/100[0-9].png',
    '../../assets/game/boneyard/badguys/10[4-6][0-9].png',
    '../../assets/game/boneyard/badguys/11[1-3][0-9].png',
    '../../assets/game/boneyard/badguys/13[3-5][0-9].png',
    '../../assets/game/boneyard/badguys/14[0-2][0-9].png',
    '../../assets/game/boneyard/badguys/14[7-9][0-9].png',
    '../../assets/game/boneyard/badguys/15[0-6][0-9].png',
    '../../assets/game/boneyard/badguys/15[8-9][0-9].png',
    '../../assets/game/boneyard/badguys/160[0-9].png',
    '../../assets/game/boneyard/badguys/17[2-4][0-9].png',
    '../../assets/game/boneyard/badguys/20[7-9][0-9].png',
    '../../assets/game/boneyard/badguys/21[0-9][0-9].png',
    '../../assets/game/boneyard/badguys/22[0-5][0-9].png',
    '../../assets/game/boneyard/badguys/229[0-9].png',
    '../../assets/game/boneyard/badguys/23[0-4][0-9].png',
    '../../assets/game/boneyard/badguys/23[6-9][0-9].png',
    '../../assets/game/boneyard/badguys/24[0-1][0-9].png',
    '../../assets/game/boneyard/demon/0[0-3][0-9].png',
    '../../assets/game/boneyard/demon/0[6-9][0-9].png',
    '../../assets/game/boneyard/demon/1[0-1][0-9].png',
  ], { eager: true, query: '?url', import: 'default' }),
} as Record<string, string>

const requiredBadGuysRanges = [
  [175, 187],
  [285, 342],
  [451, 468],
  [613, 630],
  [775, 792],
  [847, 864],
  [919, 936],
  [991, 1008],
  [1045, 1062],
  [1117, 1134],
  [1333, 1350],
  [1405, 1422],
  [1477, 1512],
  [1531, 1566],
  [1585, 1602],
  [1729, 1746],
  [2070, 2087],
  [2095, 2130],
  [2149, 2184],
  [2203, 2256],
  [2293, 2346],
  [2365, 2382],
] as const
const requiredDemonRanges = [[1, 36], [62, 115]] as const
const selectedSpriteFiles = Object.fromEntries(Object.entries(spriteFiles).filter(([path]) => {
  const entry = Number(path.match(/(\d+)\.png$/)?.[1])
  const ranges = path.includes('/demon/') ? requiredDemonRanges : requiredBadGuysRanges
  return ranges.some(([first, last]) => entry >= first && entry <= last)
})) as Record<string, string>

const manifests: Readonly<Record<NativeEnemyAtlas, AtlasManifest>> = {
  BadGuys: badguys as AtlasManifest,
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
