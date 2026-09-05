import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

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
  /** Omit to fill the containing block while keeping native end caps unstretched. */
  readonly width?: number
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
  const ref = useRef<HTMLSpanElement>(null)
  const [measuredWidth, setMeasuredWidth] = useState(0)
  useLayoutEffect(() => {
    if (width !== undefined) return
    const element = ref.current!
    setMeasuredWidth(element.clientWidth)
    const observer = new ResizeObserver(([entry]) => setMeasuredWidth(entry!.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [width])
  const definition = nativeUiRecord(atlas, record)
  const atlasDefinition = nativeUiAtlas(atlas)
  const [frameX, frameY, sourceWidth, sourceHeight] = definition.frame
  const source = `url("${nativeUiAtlasSource(atlas)}")`
  const pieces = nativeUiStripPieces(sourceWidth, width ?? measuredWidth)

  return (
    <span
      aria-hidden={ariaLabel === undefined ? true : undefined}
      aria-label={ariaLabel}
      className={className}
      data-native-ui-strip={`${atlas}.${record}`}
      ref={ref}
      role={ariaLabel === undefined ? undefined : 'img'}
      style={{
        display: 'block',
        height: sourceHeight,
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'absolute',
        width: width ?? '100%',
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
