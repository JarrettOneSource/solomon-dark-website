import type { CSSProperties } from 'react'

import NativeUiTextGlyphs from './NativeUiTextGlyphs.tsx'
import { layoutNativeUiText, type NativeUiTextSpec } from './native-ui-text.ts'

interface NativeUiTextProps extends Omit<NativeUiTextSpec, 'x' | 'y'> {
  readonly className?: string
  readonly style?: CSSProperties
  readonly width?: number
}

/** Flow boxes contain their ink. For an authored pen, top is the explicit baseline. */
export default function NativeUiText({
  align = 'left',
  className,
  placement = 'box',
  style,
  width,
  ...text
}: NativeUiTextProps) {
  const provisional = layoutNativeUiText({
    ...text,
    align: 'left',
    placement,
    x: 0,
    y: 0,
  })
  const containerWidth = width ?? (placement === 'baseline' ? 0 : provisional.width)
  const layout = align === 'left' ? provisional : layoutNativeUiText({
    ...text,
    align,
    placement,
    x: align === 'right' ? containerWidth : containerWidth / 2,
    y: 0,
  })
  return (
    <span
      aria-hidden
      className={className}
      data-native-ui-font={text.font}
      data-native-ui-placement={placement}
      data-native-ui-unsupported={layout.unsupportedCodePoints.join(',') || undefined}
      style={{
        display: 'inline-block',
        height: layout.height,
        position: placement === 'baseline' ? 'absolute' : 'relative',
        verticalAlign: 'middle',
        width: containerWidth,
        ...style,
      }}
    >
      <NativeUiTextGlyphs layout={layout} />
    </span>
  )
}
