import type { CSSProperties } from 'react'

import { nativeUiAtlasSource } from './native-ui-assets.ts'
import {
  nativeUiAtlas,
  nativeUiRecord,
  type NativeUiAtlasName,
} from './native-ui-catalog.ts'
import { nativeUiStripPieces } from './native-ui-plan.ts'

interface NativeUiStripProps {
  readonly ariaLabel?: string
  readonly atlas: NativeUiAtlasName
  readonly className?: string
  readonly record: number
  readonly style?: CSSProperties
  readonly width: number
}

/** DOM projection of the stock horizontal repeated-strip helper `0x00415230`. */
export default function NativeUiStrip({
  ariaLabel,
  atlas,
  className,
  record,
  style,
  width,
}: NativeUiStripProps) {
  const definition = nativeUiRecord(atlas, record)
  const atlasDefinition = nativeUiAtlas(atlas)
  const [frameX, frameY, sourceWidth, sourceHeight] = definition.frame
  const source = `url("${nativeUiAtlasSource(atlas)}")`
  const pieces = nativeUiStripPieces(sourceWidth, width)

  return (
    <span
      aria-hidden={ariaLabel === undefined ? true : undefined}
      aria-label={ariaLabel}
      className={className}
      data-native-ui-strip={`${atlas}.${record}`}
      role={ariaLabel === undefined ? undefined : 'img'}
      style={{
        display: 'block',
        height: sourceHeight,
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'absolute',
        width,
        ...style,
      }}
    >
      {pieces.map((piece, index) => (
        <i
          aria-hidden
          key={index}
          style={{
            backgroundImage: source,
            backgroundPosition: `${-(frameX + piece.sourceLeft)}px ${-frameY}px`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${atlasDefinition.dimensions[0]}px ${atlasDefinition.dimensions[1]}px`,
            display: 'block',
            height: sourceHeight,
            left: piece.targetLeft,
            position: 'absolute',
            top: 0,
            width: piece.width,
          }}
        />
      ))}
    </span>
  )
}
