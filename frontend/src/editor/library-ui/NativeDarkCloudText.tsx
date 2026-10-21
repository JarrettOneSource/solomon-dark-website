import type { CSSProperties } from 'react'

import NativeUiText from './NativeUiText.tsx'
import { nativeUiFont } from './native-ui-catalog.ts'
import { layoutNativeUiText } from './native-ui-text.ts'

export function NativeDarkCloudText({
  align = 'left',
  className,
  content = false,
  font = 'menu',
  scale = 0.68,
  style,
  text,
  tint = 0xd9ba70,
  width,
}: {
  readonly align?: 'center' | 'left' | 'right'
  readonly className?: string
  /** External names and metadata may contain characters absent from retail atlases. */
  readonly content?: boolean
  readonly font?: 'heading' | 'medium' | 'menu'
  readonly scale?: number
  readonly style?: CSSProperties
  readonly text: string
  readonly tint?: number
  readonly width?: number
}) {
  if (content && layoutNativeUiText({ font, scale, text, x: 0, y: 0 }).unsupportedCodePoints.length > 0) {
    return <span className={['native-ui-content-text', className].filter(Boolean).join(' ')} data-native-ui-content-text style={{ color: `#${tint.toString(16).padStart(6, '0')}`, fontSize: nativeUiFont(font).metrics[0] * scale, ...style }}>{text}</span>
  }
  return (
    <>
      <span className="native-ui-sr-only">{text}</span>
      <NativeUiText
        align={align}
        className={className}
        font={font}
        scale={scale}
        style={style}
        text={text}
        tint={tint}
        width={width}
      />
    </>
  )
}
