import badguys from '../../editor/manifest/badguys.json'
import deadhawg from '../../editor/manifest/deadhawg.json'
import type { AtlasManifest } from '../../editor/manifest/index.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'
import { boneyardCombatAtlasSource } from '../../lib/boneyard-combat-atlas-key.ts'

export type NativeLootAtlas = 'BadGuys' | 'DeadHawg'

const deadHawgSpriteFiles = import.meta.glob([
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
  ...[...REQUIRED_BADGUYS].map((entry) => boneyardCombatAtlasSource('BadGuys', entry)),
  ...[...REQUIRED_DEADHAWG].map(requiredDeadHawgSource),
])

export function nativeLootSpriteRecord(
  atlas: NativeLootAtlas,
  entry: number,
): NativeLootSpriteRecord {
  const record = manifests[atlas].entries[entry]
  if (!record || record.empty || !record.file) {
    throw new Error(`Native loot atlas record is missing: ${atlas}:${entry}`)
  }
  const selected = (atlas === 'DeadHawg' ? REQUIRED_DEADHAWG : REQUIRED_BADGUYS).has(entry)
  if (!selected) throw new Error(`Native loot atlas record was not selected: ${atlas}:${entry}`)
  const source = atlas === 'DeadHawg'
    ? requiredDeadHawgSource(entry)
    : boneyardCombatAtlasSource('BadGuys', entry)
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

function requiredDeadHawgSource(entry: number): string {
  const record = manifests.DeadHawg.entries[entry]
  const source = record?.file
    ? deadHawgSpriteFiles[`../../assets/game/boneyard/${record.file}`]
    : undefined
  if (!source) throw new Error(`Native loot DeadHawg source is missing: ${entry}`)
  return source
}

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}
