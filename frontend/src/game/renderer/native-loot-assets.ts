import badguys from '../../editor/manifest/badguys.json'
import deadhawg from '../../editor/manifest/deadhawg.json'
import type { AtlasManifest } from '../../editor/manifest/index.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'

export type NativeLootAtlas = 'BadGuys' | 'DeadHawg'

const spriteFiles = import.meta.glob([
  '../../assets/game/boneyard/badguys/0007.png',
  '../../assets/game/boneyard/badguys/0015.png',
  '../../assets/game/boneyard/badguys/0033.png',
  '../../assets/game/boneyard/badguys/0052.png',
  '../../assets/game/boneyard/badguys/0061.png',
  '../../assets/game/boneyard/badguys/0067.png',
  '../../assets/game/boneyard/badguys/0073.png',
  '../../assets/game/boneyard/badguys/0083.png',
  '../../assets/game/boneyard/badguys/0110.png',
  '../../assets/game/boneyard/badguys/01[2-5][0-9].png',
  '../../assets/game/boneyard/badguys/018[8-9].png',
  '../../assets/game/boneyard/badguys/019[0-9].png',
  '../../assets/game/boneyard/badguys/020[0-1].png',
  '../../assets/game/boneyard/badguys/037[7-9].png',
  '../../assets/game/boneyard/badguys/0380.png',
  '../../assets/game/boneyard/badguys/043[4-9].png',
  '../../assets/game/boneyard/badguys/044[0-5].png',
  '../../assets/game/boneyard/deadhawg/14[5-7].png',
], { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const REQUIRED_BADGUYS = new Set([
  7, 15, 33, 52, 61, 67, 73, 83, 110,
  ...range(122, 157),
  ...range(188, 201),
  ...range(377, 380),
  ...range(434, 445),
])
const REQUIRED_DEADHAWG = new Set(range(145, 147))

const selectedSpriteFiles = Object.fromEntries(Object.entries(spriteFiles).filter(([path]) => {
  const entry = Number(path.match(/(\d+)\.png$/)?.[1])
  return (path.includes('/deadhawg/') ? REQUIRED_DEADHAWG : REQUIRED_BADGUYS).has(entry)
})) as Record<string, string>

const manifests: Readonly<Record<NativeLootAtlas, AtlasManifest>> = {
  BadGuys: badguys as AtlasManifest,
  DeadHawg: deadhawg as AtlasManifest,
}

export interface NativeLootSpriteRecord {
  readonly anchorX: number
  readonly anchorY: number
  readonly atlas: NativeLootAtlas
  readonly entry: number
  readonly height: number
  readonly source: string
  readonly width: number
}

export const NATIVE_LOOT_ASSET_SOURCES = Object.freeze([
  ...new Set(Object.values(selectedSpriteFiles)),
])

export function nativeLootSpriteRecord(
  atlas: NativeLootAtlas,
  entry: number,
): NativeLootSpriteRecord {
  const record = manifests[atlas].entries[entry]
  if (!record || record.empty || !record.file) {
    throw new Error(`Native loot atlas record is missing: ${atlas}:${entry}`)
  }
  const source = selectedSpriteFiles[`../../assets/game/boneyard/${record.file}`]
  if (!source) {
    throw new Error(`Native loot atlas record was not selected: ${atlas}:${entry}`)
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

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}
