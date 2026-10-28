import { nativeUiAtlasSource } from './native-ui-assets.ts'
import { nativeUiAtlas, nativeUiFont } from './native-ui-catalog.ts'
import { nativeUiGlyphInkBounds, NATIVE_UI_TEXT_ITALIC, type NativeUiTextLayout } from './native-ui-text.ts'

/** The DOM glyph painter shared by flow text and native baseline plans. */
export default function NativeUiTextGlyphs({ layout }: { readonly layout: NativeUiTextLayout }) {
  const font = nativeUiFont(layout.font)
  const atlas = nativeUiAtlas(font.atlas)
  const source = `url("${nativeUiAtlasSource(font.atlas)}")`
  return layout.glyphs.map((glyph, index) => {
    const [x, y] = glyph.frame
    const bounds = nativeUiGlyphInkBounds(glyph)
    return (
      <i
        data-native-ui-glyph={glyph.codePoint}
        key={`${index}:${glyph.codePoint}`}
        style={{
          backgroundColor: `#${glyph.tint.toString(16).padStart(6, '0')}`,
          height: bounds.height,
          imageRendering: 'pixelated',
          left: bounds.left,
          maskImage: source,
          maskPosition: `${-x * glyph.scale}px ${-y * glyph.scale}px`,
          maskRepeat: 'no-repeat',
          maskSize: `${atlas.dimensions[0] * glyph.scale}px ${atlas.dimensions[1] * glyph.scale}px`,
          opacity: glyph.alpha,
          position: 'absolute',
          top: bounds.top,
          transform: glyph.italic
            ? `matrix(1, 0, ${(NATIVE_UI_TEXT_ITALIC.glyphTopDelta - NATIVE_UI_TEXT_ITALIC.glyphBottomDelta) / glyph.frame[3]}, 1, 0, 0)`
            : undefined,
          transformOrigin: `${(glyph.logicalSize[0] / 2 - glyph.trimOrigin[0]) * glyph.scale}px ${(glyph.logicalSize[1] / 2 - glyph.trimOrigin[1]) * glyph.scale}px`,
          WebkitMaskImage: source,
          WebkitMaskPosition: `${-x * glyph.scale}px ${-y * glyph.scale}px`,
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskSize: `${atlas.dimensions[0] * glyph.scale}px ${atlas.dimensions[1] * glyph.scale}px`,
          width: bounds.width,
        }}
      />
    )
  })
}
