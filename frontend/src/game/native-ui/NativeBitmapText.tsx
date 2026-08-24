import type { CSSProperties } from 'react'

import { nativeUiAtlasSource } from './native-ui-assets.ts'
import { nativeUiAtlas, nativeUiFont, type NativeUiFontName } from './native-ui-catalog.ts'
import { layoutNativeUiText, type NativeUiTextAlign } from './native-ui-text.ts'

interface NativeBitmapTextProps {
  readonly align?: NativeUiTextAlign
  readonly alpha?: number
  readonly className?: string
  readonly font: NativeUiFontName
  readonly lineHeight?: number
  readonly maxWidth?: number
  readonly scale?: number
  readonly style?: CSSProperties
  readonly text: string
  readonly tint?: number
  readonly width?: number
}

export default function NativeBitmapText({
  align = 'left',
  alpha = 1,
  className,
  font: fontName,
  lineHeight,
  maxWidth,
  scale = 1,
  style,
  text,
  tint = 0xffffff,
  width,
}: NativeBitmapTextProps) {
  const font = nativeUiFont(fontName)
  const provisional = layoutNativeUiText({
    align: 'left',
    alpha,
    font: fontName,
    lineHeight,
    maxWidth,
    scale,
    text,
    tint,
    x: 0,
    y: font.metrics[0] * scale / 2,
  })
  const containerWidth = width ?? provisional.width
  const anchorX = align === 'left' ? 0 : align === 'right' ? containerWidth : containerWidth / 2
  const layout = align === 'left'
    ? provisional
    : layoutNativeUiText({
        align,
        alpha,
        font: fontName,
        lineHeight,
        maxWidth,
        scale,
        text,
        tint,
        x: anchorX,
        y: font.metrics[0] * scale / 2,
      })
  const atlas = nativeUiAtlas(font.atlas)
  const source = nativeUiAtlasSource(font.atlas)
  const color = `#${tint.toString(16).padStart(6, '0')}`
  return (
    <span
      aria-hidden
      className={className}
      data-native-ui-font={fontName}
      data-native-ui-unsupported={layout.unsupportedCodePoints.join(',') || undefined}
      style={{
        display: 'inline-block',
        height: layout.height,
        position: 'relative',
        width: containerWidth,
        ...style,
      }}
    >
      {layout.glyphs.map((glyph, index) => {
        const [x, y, glyphWidth, glyphHeight] = glyph.frame
        const renderedWidth = glyphWidth * glyph.scale
        const renderedHeight = glyphHeight * glyph.scale
        return (
          <i
            key={`${index}:${glyph.codePoint}`}
            data-native-ui-glyph={glyph.codePoint}
            style={{
              backgroundColor: color,
              height: renderedHeight,
              left: glyph.centerX - renderedWidth / 2,
              maskImage: `url("${source}")`,
              maskPosition: `${-x * glyph.scale}px ${-y * glyph.scale}px`,
              maskRepeat: 'no-repeat',
              maskSize: `${atlas.dimensions[0] * glyph.scale}px ${atlas.dimensions[1] * glyph.scale}px`,
              opacity: glyph.alpha,
              position: 'absolute',
              top: glyph.centerY - renderedHeight / 2,
              WebkitMaskImage: `url("${source}")`,
              WebkitMaskPosition: `${-x * glyph.scale}px ${-y * glyph.scale}px`,
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskSize: `${atlas.dimensions[0] * glyph.scale}px ${atlas.dimensions[1] * glyph.scale}px`,
              width: renderedWidth,
            }}
          />
        )
      })}
    </span>
  )
}
