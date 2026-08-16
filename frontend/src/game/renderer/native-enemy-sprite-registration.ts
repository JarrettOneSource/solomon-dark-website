import badguys from '../../editor/manifest/badguys.json' with { type: 'json' }
import deadhawg from '../../editor/manifest/deadhawg.json' with { type: 'json' }
import demon from '../../editor/manifest/demon.json' with { type: 'json' }

import type { AtlasManifest } from '../../editor/manifest/index.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'
import type { NativeEnemyAtlas } from './native-enemy-presentation.ts'

const manifests: Readonly<Record<NativeEnemyAtlas, AtlasManifest>> = {
  BadGuys: badguys as AtlasManifest,
  DeadHawg: deadhawg as AtlasManifest,
  Demon: demon as AtlasManifest,
}

export interface NativeEnemySpriteRegistration {
  readonly anchorX: number
  readonly anchorY: number
  readonly atlas: NativeEnemyAtlas
  readonly entry: number
  readonly file: string
  readonly height: number
  readonly width: number
}

export function nativeEnemySpriteRegistration(
  atlas: NativeEnemyAtlas,
  entry: number,
): NativeEnemySpriteRegistration {
  const record = manifests[atlas].entries[entry]
  if (!record || record.empty || !record.file) {
    throw new Error(`Native enemy atlas record is missing: ${atlas}:${entry}`)
  }
  const anchor = nativeSpriteAnchor(record.rect.w, record.rect.h, record.origin)
  return Object.freeze({
    anchorX: anchor.x,
    anchorY: anchor.y,
    atlas,
    entry,
    file: record.file,
    height: record.rect.h,
    width: record.rect.w,
  })
}
