import { Rectangle, type Texture } from 'pixi.js'

import { nativeSpriteRecordTexture } from '../renderer/native-sprite-record-texture.ts'
import type { NativeUiGlyphRecord } from './native-ui-catalog.ts'

export function nativeUiGlyphRecordTexture(
  source: Texture['source'],
  glyph: NativeUiGlyphRecord,
): Texture {
  const [x, y, width, height] = glyph.frame
  const [logicalWidth, logicalHeight] = glyph.logicalSize
  const [trimX, trimY] = glyph.trimOrigin
  return nativeSpriteRecordTexture({
    frame: new Rectangle(x, y, width, height),
    orig: new Rectangle(0, 0, logicalWidth, logicalHeight),
    source,
    trim: new Rectangle(trimX, trimY, width, height),
  })
}
