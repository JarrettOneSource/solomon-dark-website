import type { CSSProperties } from 'react'

import { nativeUiAtlasSource } from './native-ui-assets.ts'
import {
  nativeUiAtlas,
  nativeUiRecord,
  type NativeUiAtlasName,
} from './native-ui-catalog.ts'

interface NativeUiNineSliceProps {
  readonly atlas: NativeUiAtlasName
  readonly className?: string
  readonly edgeUvOrigin?: number
  readonly fill?: boolean
  readonly height: number
  readonly multiplyTint?: number
  readonly record: number
  readonly style?: CSSProperties
  readonly width: number
}

interface SlicePiece {
  readonly height: number
  readonly kind: 'center' | 'corner' | 'horizontal' | 'vertical'
  readonly left: number
  readonly mirrorX: boolean
  readonly mirrorY: boolean
  readonly top: number
  readonly width: number
}

const MIRROR_SHIFT = 1

/** DOM projection of the stock `FUN_00417760` mirrored nine-slice helper. */
export default function NativeUiNineSlice({
  atlas,
  className,
  edgeUvOrigin = 0.95,
  fill = true,
  height,
  multiplyTint,
  record,
  style,
  width,
}: NativeUiNineSliceProps) {
  if (edgeUvOrigin <= 0 || edgeUvOrigin >= 1) {
    throw new RangeError('native UI nine-slice edge origin must be within (0, 1)')
  }
  const definition = nativeUiRecord(atlas, record)
  const [frameX, frameY, cornerWidth, cornerHeight] = definition.frame
  if (width < cornerWidth * 2 || height < cornerHeight * 2) {
    throw new RangeError('native UI nine-slice bounds are smaller than two corners')
  }
  const atlasDefinition = nativeUiAtlas(atlas)
  const source = `url("${nativeUiAtlasSource(atlas)}")`
  const tint = multiplyTint === undefined
    ? null
    : `#${multiplyTint.toString(16).padStart(6, '0')}`
  const edgeWidth = cornerWidth * (1 - edgeUvOrigin)
  const edgeHeight = cornerHeight * (1 - edgeUvOrigin)
  const pieces = nineSlicePieces(cornerWidth, cornerHeight, width, height, fill)

  return (
    <span
      aria-hidden
      className={className}
      data-native-ui-nine-slice={`${atlas}.${record}`}
      style={{
        display: 'block',
        height,
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'absolute',
        width,
        ...style,
      }}
    >
      {pieces.map((piece, index) => {
        if (piece.width <= 0 || piece.height <= 0) return null
        let backgroundSize = `${atlasDefinition.dimensions[0]}px ${atlasDefinition.dimensions[1]}px`
        let backgroundPosition = `${-frameX}px ${-frameY}px`
        if (piece.kind === 'horizontal') {
          const stretch = piece.width / edgeWidth
          backgroundSize = `${atlasDefinition.dimensions[0] * stretch}px ${atlasDefinition.dimensions[1]}px`
          backgroundPosition = `${-(frameX + cornerWidth - edgeWidth) * stretch}px ${-frameY}px`
        } else if (piece.kind === 'vertical') {
          const stretch = piece.height / edgeHeight
          backgroundSize = `${atlasDefinition.dimensions[0]}px ${atlasDefinition.dimensions[1] * stretch}px`
          backgroundPosition = `${-frameX}px ${-(frameY + cornerHeight - edgeHeight) * stretch}px`
        } else if (piece.kind === 'center') {
          const horizontalStretch = piece.width / edgeWidth
          const verticalStretch = piece.height / edgeHeight
          backgroundSize = `${atlasDefinition.dimensions[0] * horizontalStretch}px ${atlasDefinition.dimensions[1] * verticalStretch}px`
          backgroundPosition = `${-(frameX + cornerWidth - edgeWidth) * horizontalStretch}px ${-(frameY + cornerHeight - edgeHeight) * verticalStretch}px`
        }
        return (
          <i
            key={index}
            style={{
              backgroundBlendMode: tint === null ? undefined : 'multiply',
              backgroundImage: tint === null
                ? source
                : `linear-gradient(${tint}, ${tint}), ${source}`,
              backgroundPosition,
              backgroundRepeat: 'no-repeat',
              backgroundSize,
              display: 'block',
              height: piece.height,
              left: piece.left,
              maskImage: tint === null ? undefined : source,
              maskPosition: tint === null ? undefined : backgroundPosition,
              maskRepeat: tint === null ? undefined : 'no-repeat',
              maskSize: tint === null ? undefined : backgroundSize,
              position: 'absolute',
              top: piece.top,
              transform: `scale(${piece.mirrorX ? -1 : 1}, ${piece.mirrorY ? -1 : 1})`,
              transformOrigin: 'center',
              WebkitMaskImage: tint === null ? undefined : source,
              WebkitMaskPosition: tint === null ? undefined : backgroundPosition,
              WebkitMaskRepeat: tint === null ? undefined : 'no-repeat',
              WebkitMaskSize: tint === null ? undefined : backgroundSize,
              width: piece.width,
            }}
          />
        )
      })}
    </span>
  )
}

function nineSlicePieces(
  cornerWidth: number,
  cornerHeight: number,
  width: number,
  height: number,
  fill: boolean,
): readonly SlicePiece[] {
  const innerWidth = width - cornerWidth * 2
  const innerHeight = height - cornerHeight * 2
  const right = width - cornerWidth + MIRROR_SHIFT
  const bottom = height - cornerHeight + MIRROR_SHIFT
  return [
    { height: cornerHeight, kind: 'corner', left: 0, mirrorX: false, mirrorY: false, top: 0, width: cornerWidth },
    { height: cornerHeight, kind: 'corner', left: right, mirrorX: true, mirrorY: false, top: 0, width: cornerWidth },
    { height: cornerHeight, kind: 'corner', left: 0, mirrorX: false, mirrorY: true, top: bottom, width: cornerWidth },
    { height: cornerHeight, kind: 'corner', left: right, mirrorX: true, mirrorY: true, top: bottom, width: cornerWidth },
    { height: cornerHeight, kind: 'horizontal', left: cornerWidth, mirrorX: false, mirrorY: false, top: 0, width: innerWidth },
    { height: cornerHeight, kind: 'horizontal', left: cornerWidth, mirrorX: false, mirrorY: true, top: bottom, width: innerWidth },
    { height: innerHeight, kind: 'vertical', left: 0, mirrorX: false, mirrorY: false, top: cornerHeight, width: cornerWidth },
    { height: innerHeight, kind: 'vertical', left: right, mirrorX: true, mirrorY: false, top: cornerHeight, width: cornerWidth },
    ...(fill
      ? [{ height: innerHeight, kind: 'center' as const, left: cornerWidth, mirrorX: false, mirrorY: false, top: cornerHeight, width: innerWidth }]
      : []),
  ]
}
