import badguys from '../../editor/manifest/badguys.json'
import deadhawg from '../../editor/manifest/deadhawg.json'
import golem from '../../editor/manifest/golem.json'
import type { AtlasManifest } from '../../editor/manifest/index.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'

export const NATIVE_SECONDARY_ATLASES = ['BadGuys', 'Clothes', 'DeadHawg', 'Golem'] as const
export type NativeSecondaryAtlas = typeof NATIVE_SECONDARY_ATLASES[number]

const files = import.meta.glob([
  '../../assets/game/boneyard/badguys/0000.png',
  '../../assets/game/boneyard/badguys/0007.png',
  '../../assets/game/boneyard/badguys/0010.png',
  '../../assets/game/boneyard/badguys/0011.png',
  '../../assets/game/boneyard/badguys/0015.png',
  '../../assets/game/boneyard/badguys/0016.png',
  '../../assets/game/boneyard/badguys/0017.png',
  '../../assets/game/boneyard/badguys/0022.png',
  '../../assets/game/boneyard/badguys/0036.png',
  '../../assets/game/boneyard/badguys/0038.png',
  '../../assets/game/boneyard/badguys/0039.png',
  '../../assets/game/boneyard/badguys/0040.png',
  '../../assets/game/boneyard/badguys/0045.png',
  '../../assets/game/boneyard/badguys/0048.png',
  '../../assets/game/boneyard/badguys/0049.png',
  '../../assets/game/boneyard/badguys/0051.png',
  '../../assets/game/boneyard/badguys/0053.png',
  '../../assets/game/boneyard/badguys/0055.png',
  '../../assets/game/boneyard/badguys/0058.png',
  '../../assets/game/boneyard/badguys/0062.png',
  '../../assets/game/boneyard/badguys/0063.png',
  '../../assets/game/boneyard/badguys/0068.png',
  '../../assets/game/boneyard/badguys/0072.png',
  '../../assets/game/boneyard/badguys/0074.png',
  '../../assets/game/boneyard/badguys/0075.png',
  '../../assets/game/boneyard/badguys/0078.png',
  '../../assets/game/boneyard/badguys/0084.png',
  '../../assets/game/boneyard/badguys/0085.png',
  '../../assets/game/boneyard/badguys/0086.png',
  '../../assets/game/boneyard/badguys/0088.png',
  '../../assets/game/boneyard/badguys/0090.png',
  '../../assets/game/boneyard/badguys/011[0-2].png',
  '../../assets/game/boneyard/badguys/015[8-9].png',
  '../../assets/game/boneyard/badguys/016[0-7].png',
  '../../assets/game/boneyard/badguys/023[8-9].png',
  '../../assets/game/boneyard/badguys/024[0-9].png',
  '../../assets/game/boneyard/badguys/0250.png',
  '../../assets/game/boneyard/badguys/025[1-4].png',
  '../../assets/game/boneyard/badguys/026[7-9].png',
  '../../assets/game/boneyard/badguys/0270.png',
  '../../assets/game/boneyard/badguys/033[3-9].png',
  '../../assets/game/boneyard/badguys/034[0-2].png',
  '../../assets/game/boneyard/badguys/034[3-9].png',
  '../../assets/game/boneyard/badguys/03[5-9][0-9].png',
  '../../assets/game/boneyard/badguys/0400.png',
  '../../assets/game/boneyard/badguys/200[8-9].png',
  '../../assets/game/boneyard/badguys/2010.png',
  '../../assets/game/boneyard/deadhawg/002.png',
  '../../assets/game/boneyard/deadhawg/004.png',
  '../../assets/game/boneyard/deadhawg/00[5-6].png',
  '../../assets/game/boneyard/deadhawg/01[6-8].png',
  '../../assets/game/boneyard/deadhawg/04[6-9].png',
  '../../assets/game/boneyard/deadhawg/05[0-9].png',
  '../../assets/game/boneyard/deadhawg/06[0-9].png',
  '../../assets/game/boneyard/deadhawg/07[0-9].png',
  '../../assets/game/boneyard/deadhawg/08[0-7].png',
  '../../assets/game/boneyard/deadhawg/114.png',
  '../../assets/game/boneyard/deadhawg/121.png',
  '../../assets/game/boneyard/deadhawg/17[7-9].png',
  '../../assets/game/boneyard/deadhawg/20[0-7].png',
  '../../assets/game/boneyard/golem/*.png',
  '../../assets/game/player-mindblast-ring.png',
], { eager: true, query: '?url', import: 'default' }) as Record<string, string>

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
  ...range(251, 254), ...range(267, 270),
  ...range(333, 400), ...range(2008, 2010),
])
const DEADHAWG_ENTRIES = Object.freeze([
  2, 4, 5, 6, 16, 17, 18, ...range(46, 87), 114, 121, ...range(177, 179), ...range(200, 207),
])
const CLOTHES_ENTRIES = Object.freeze([2])
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

export const NATIVE_SECONDARY_ASSET_SOURCES = Object.freeze([
  ...new Set(NATIVE_SECONDARY_SPRITE_RECORDS.map(({ source }) => source)),
  ...Object.values(NATIVE_SECONDARY_SPECIAL_ASSET_SOURCES),
])

export function nativeSecondarySpriteRecord(
  atlas: NativeSecondaryAtlas,
  entry: number,
): NativeSecondarySpriteRecord {
  const found = NATIVE_SECONDARY_SPRITE_RECORDS.find((record) => (
    record.atlas === atlas && record.entry === entry
  ))
  if (!found) throw new Error(`Native secondary sprite is outside the closed membership: ${atlas}:${entry}`)
  return found
}

export function nativeSecondarySpriteKey(atlas: NativeSecondaryAtlas, entry: number): string {
  return `${atlas}:${entry}`
}

function record(atlas: NativeSecondaryAtlas, entry: number): NativeSecondarySpriteRecord {
  if (atlas === 'Clothes') {
    if (entry !== 2) {
      throw new Error(`Native secondary Clothes record is missing: ${entry}`)
    }
    const source = files['../../assets/game/player-mindblast-ring.png']
    if (!source) throw new Error('Native Mindblast Clothes record was not bundled')
    const anchor = nativeSpriteAnchor(81, 81, { x: 0, y: 0 })
    return Object.freeze({
      anchorX: anchor.x,
      anchorY: anchor.y,
      atlas,
      entry,
      height: 81,
      source,
      width: 81,
    })
  }
  const sourceRecord = manifests[atlas].entries[entry]
  if (!sourceRecord || sourceRecord.empty || !sourceRecord.file) {
    throw new Error(`Native secondary atlas record is missing: ${atlas}:${entry}`)
  }
  const source = files[`../../assets/game/boneyard/${sourceRecord.file}`]
  if (!source) throw new Error(`Native secondary atlas record was not bundled: ${atlas}:${entry}`)
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
