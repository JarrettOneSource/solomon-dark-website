import type { CSSProperties } from 'react'

import { nativeUiAtlasSource } from './native-ui-assets.ts'
import {
  nativeUiAtlas,
  nativeUiRecord,
  type NativeUiAtlasName,
} from './native-ui-catalog.ts'

interface NativeUiSpriteProps {
  readonly atlas: NativeUiAtlasName
  readonly className?: string
  /** Recolors a stock white-alpha record while preserving its authored alpha. */
  readonly maskTint?: number
  readonly record: number
  readonly style?: CSSProperties
}

export default function NativeUiSprite({
  atlas,
  className,
  maskTint,
  record,
  style,
}: NativeUiSpriteProps) {
  const definition = nativeUiRecord(atlas, record)
  const atlasDefinition = nativeUiAtlas(atlas)
  const [x, y, width, height] = definition.frame
  const [logicalWidth, logicalHeight] = definition.logicalSize
  const [trimX, trimY] = definition.trimOrigin
  return (
    <span
      aria-hidden
      className={className}
      data-native-ui-record={`${atlas}.${record}`}
      style={{
        display: 'block',
        height: logicalHeight,
        position: 'relative',
        width: logicalWidth,
        ...style,
      }}
    >
      <i
        style={{
          backgroundColor: maskTint === undefined
            ? undefined
            : `#${maskTint.toString(16).padStart(6, '0')}`,
          backgroundImage: maskTint === undefined
            ? `url("${nativeUiAtlasSource(atlas)}")`
            : undefined,
          backgroundPosition: `${-x}px ${-y}px`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${atlasDefinition.dimensions[0]}px ${atlasDefinition.dimensions[1]}px`,
          display: 'block',
          height,
          left: trimX,
          maskImage: maskTint === undefined ? undefined : `url("${nativeUiAtlasSource(atlas)}")`,
          maskPosition: maskTint === undefined ? undefined : `${-x}px ${-y}px`,
          maskRepeat: maskTint === undefined ? undefined : 'no-repeat',
          maskSize: maskTint === undefined
            ? undefined
            : `${atlasDefinition.dimensions[0]}px ${atlasDefinition.dimensions[1]}px`,
          position: 'absolute',
          top: trimY,
          WebkitMaskImage: maskTint === undefined ? undefined : `url("${nativeUiAtlasSource(atlas)}")`,
          WebkitMaskPosition: maskTint === undefined ? undefined : `${-x}px ${-y}px`,
          WebkitMaskRepeat: maskTint === undefined ? undefined : 'no-repeat',
          WebkitMaskSize: maskTint === undefined
            ? undefined
            : `${atlasDefinition.dimensions[0]}px ${atlasDefinition.dimensions[1]}px`,
          width,
        }}
      />
    </span>
  )
}
