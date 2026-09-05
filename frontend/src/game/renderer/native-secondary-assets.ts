import badguys from '../../editor/manifest/badguys.json'
import deadhawg from '../../editor/manifest/deadhawg.json'
import golem from '../../editor/manifest/golem.json'
import type { AtlasManifest } from '../../editor/manifest/index.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'
import playerMindblastRing from '../../assets/game/player-mindblast-ring.png'
import playerHardenIce from '../../assets/game/player-harden-ice.png'
import { boneyardCombatAtlasSource } from '../../lib/boneyard-combat-atlas-key.ts'

export const NATIVE_SECONDARY_ATLASES = ['BadGuys', 'Clothes', 'DeadHawg', 'Golem'] as const
export type NativeSecondaryAtlas = typeof NATIVE_SECONDARY_ATLASES[number]

const specialFiles = import.meta.glob([
  '../../assets/game/boneyard/textures/etherplane.png',
], { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const etherPlaneSource = specialFiles[
  '../../assets/game/boneyard/textures/etherplane.png'
]
if (!etherPlaneSource) throw new Error('Native etherplane texture was not bundled')

export const NATIVE_SECONDARY_SPECIAL_ASSET_SOURCES = Object.freeze({
  etherPlane: etherPlaneSource,
})

const BADGUYS_ENTRIES = Object.freeze([
  0, 7, 10, 11, 15, 16, 17, 22, 36, 38, 39, 40, 45, 48, 49, 51, 53, 55, 58, 62, 63, 68, 72, 74, 75, 78, 84, 85, 86, 88, 90,
  ...range(110, 112), ...range(158, 167), ...range(238, 250),
  ...range(251, 266), ...range(267, 270),
  ...range(333, 433), ...range(446, 450), ...range(2008, 2010),
])
const DEADHAWG_ENTRIES = Object.freeze([
  2, 4, 5, 6, 16, 17, 18, ...range(46, 87), 114, 121, ...range(177, 179), ...range(200, 207),
])
const CLOTHES_ENTRIES = Object.freeze([1, 2])
const GOLEM_ENTRIES = Object.freeze(range(1, 208).filter((entry) => {
  const record = (golem as AtlasManifest).entries[entry]
  return record !== undefined && !record.empty && record.file !== null
}))

export const NATIVE_SECONDARY_SPRITE_MEMBERSHIP = Object.freeze({
  BadGuys: BADGUYS_ENTRIES,
  Clothes: CLOTHES_ENTRIES,
  DeadHawg: DEADHAWG_ENTRIES,
  Golem: GOLEM_ENTRIES,
}) satisfies Readonly<Record<NativeSecondaryAtlas, readonly number[]>>

const manifests: Readonly<Record<Exclude<NativeSecondaryAtlas, 'Clothes'>, AtlasManifest>> = {
  BadGuys: badguys as AtlasManifest,
  DeadHawg: deadhawg as AtlasManifest,
  Golem: golem as AtlasManifest,
}
export interface NativeSecondarySpriteRecord {
  readonly anchorX: number
  readonly anchorY: number
  readonly atlas: NativeSecondaryAtlas
  readonly entry: number
  readonly height: number
  readonly source: string
  readonly width: number
}

export const NATIVE_SECONDARY_SPRITE_RECORDS: readonly NativeSecondarySpriteRecord[] =
  Object.freeze(NATIVE_SECONDARY_ATLASES.flatMap((atlas) => (
    NATIVE_SECONDARY_SPRITE_MEMBERSHIP[atlas].map((entry) => record(atlas, entry))
  )))

const NATIVE_SECONDARY_SPRITE_RECORDS_BY_ATLAS = new Map(
  NATIVE_SECONDARY_ATLASES.map((atlas) => [
    atlas,
    new Map(
      NATIVE_SECONDARY_SPRITE_RECORDS
        .filter((record) => record.atlas === atlas)
        .map((record) => [record.entry, record] as const),
    ),
  ] as const),
)

export const NATIVE_SECONDARY_ASSET_SOURCES = Object.freeze([
  ...new Set(NATIVE_SECONDARY_SPRITE_RECORDS.map(({ source }) => source)),
  ...Object.values(NATIVE_SECONDARY_SPECIAL_ASSET_SOURCES),
])
// Preserve native sampler bounds for these individually extracted Clothes records.
export const NATIVE_SECONDARY_STOCK_FRAMED_ASSET_SOURCES = Object.freeze([
  playerHardenIce,
  playerMindblastRing,
])

export function nativeSecondarySpriteRecord(
  atlas: NativeSecondaryAtlas,
  entry: number,
): NativeSecondarySpriteRecord {
  const found = NATIVE_SECONDARY_SPRITE_RECORDS_BY_ATLAS.get(atlas)?.get(entry)
  if (!found) throw new Error(`Native secondary sprite is outside the closed membership: ${atlas}:${entry}`)
  return found
}

export function nativeSecondarySpriteKey(atlas: NativeSecondaryAtlas, entry: number): string {
  return `${atlas}:${entry}`
}

function record(atlas: NativeSecondaryAtlas, entry: number): NativeSecondarySpriteRecord {
  if (atlas === 'Clothes') {
    if (entry !== 1 && entry !== 2) {
      throw new Error(`Native secondary Clothes record is missing: ${entry}`)
    }
    const size = entry === 1 ? 130 : 81
    const anchor = nativeSpriteAnchor(size, size, { x: 0, y: 0 })
    return Object.freeze({
      anchorX: anchor.x,
      anchorY: anchor.y,
      atlas,
      entry,
      height: size,
      source: entry === 1 ? playerHardenIce : playerMindblastRing,
      width: size,
    })
  }
  const sourceRecord = manifests[atlas].entries[entry]
  if (!sourceRecord || sourceRecord.empty || !sourceRecord.file) {
    throw new Error(`Native secondary atlas record is missing: ${atlas}:${entry}`)
  }
  const source = boneyardCombatAtlasSource(atlas, entry)
  const anchor = nativeSpriteAnchor(
    sourceRecord.rect.w,
    sourceRecord.rect.h,
    sourceRecord.origin,
  )
  return Object.freeze({
    anchorX: anchor.x,
    anchorY: anchor.y,
    atlas,
    entry,
    height: sourceRecord.rect.h,
    source,
    width: sourceRecord.rect.w,
  })
}

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}
