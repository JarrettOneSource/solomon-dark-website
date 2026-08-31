import { Fragment, type CSSProperties, type ReactNode } from 'react'

import { nativeUiAtlasSource } from './native-ui-assets.ts'
import {
  nativeUiAtlas,
  nativeUiFont,
  nativeUiRecord,
} from './native-ui-catalog.ts'
import NativeUiNineSlice from './NativeUiNineSlice.tsx'
import NativeUiSprite from './NativeUiSprite.tsx'
import type {
  NativeUiClipNode,
  NativeUiNode,
  NativeUiPlan,
  NativeUiSliceNode,
  NativeUiSpriteNode,
  NativeUiTextNode,
  NativeUiTileNode,
} from './native-ui-plan.ts'
import { layoutNativeUiText } from './native-ui-text.ts'

interface NativeUiPlanViewProps {
  readonly className?: string
  readonly plan: NativeUiPlan
  readonly style?: CSSProperties
}

/** DOM adapter for the same pure native-UI plan consumed by the Pixi adapter. */
export default function NativeUiPlanView({
  className,
  plan,
  style,
}: NativeUiPlanViewProps) {
  return (
    <span
      aria-hidden
      className={className}
      data-native-ui-plan
      style={{
        display: 'block',
        height: plan.height,
        left: 0,
        overflow: 'visible',
        opacity: plan.opacity ?? 1,
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        width: plan.width,
        ...style,
      }}
    >
      {plan.nodes.map((node, index) => (
        <NativeUiPlanNode key={`${node.label ?? node.kind}:${index}`} node={node} />
      ))}
    </span>
  )
}

function NativeUiPlanNode({ node }: { readonly node: NativeUiNode }) {
  if (node.kind === 'clip') return renderClip(node)
  if (node.kind === 'sprite') return renderSprite(node)
  if (node.kind === 'slice') return renderSlice(node)
  if (node.kind === 'tile') return renderTile(node)
  if (node.kind === 'nine-slice') {
    return (
      <NativeUiNineSlice
        atlas={node.atlas}
        edgeUvOrigin={node.edgeUvOrigin}
        height={node.bounds.height}
        multiplyTint={node.tint}
        record={node.record}
        style={{
          left: node.bounds.left,
          opacity: node.alpha ?? 1,
          top: node.bounds.top,
        }}
        width={node.bounds.width}
      />
    )
  }
  if (node.kind === 'text') return renderText(node)
  return (
    <i
      data-native-ui-node={node.label}
      style={{
        backgroundColor: color(node.color),
        display: 'block',
        height: node.bounds.height,
        left: node.bounds.left,
        opacity: node.alpha ?? 1,
        position: 'absolute',
        top: node.bounds.top,
        width: node.bounds.width,
      }}
    />
  )
}

function renderClip(node: NativeUiClipNode): ReactNode {
  const label = node.label ?? 'native-ui-clip'
  return (
    <span
      data-native-ui-clip={label}
      data-native-ui-node={node.label}
      style={{
        display: 'block',
        height: node.bounds.height,
        left: node.bounds.left,
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'absolute',
        top: node.bounds.top,
        width: node.bounds.width,
      }}
    >
      <span style={{
        display: 'block',
        height: node.bounds.height,
        left: -node.bounds.left,
        pointerEvents: 'none',
        position: 'absolute',
        top: -node.bounds.top,
        width: node.bounds.width,
      }}>
        {node.nodes.map((child, index) => (
          <NativeUiPlanNode key={`${child.label ?? child.kind}:${index}`} node={child} />
        ))}
      </span>
    </span>
  )
}

function renderSprite(node: NativeUiSpriteNode): ReactNode {
  const definition = nativeUiRecord(node.atlas, node.record)
  const scale = node.scale ?? 1
  const width = node.width ?? definition.logicalSize[0] * scale
  const height = node.height ?? definition.logicalSize[1] * scale
  const [anchorX, anchorY] = node.anchor ?? [0, 0]
  const transforms = [
    node.rotation ? `rotate(${node.rotation}rad)` : '',
    node.mirrorX || node.mirrorY
      ? `scale(${node.mirrorX ? -1 : 1}, ${node.mirrorY ? -1 : 1})`
      : '',
  ].filter(Boolean).join(' ')
  return (
    <span
      data-native-ui-node={node.label}
      style={{
        display: 'block',
        height,
        left: node.x - anchorX * width,
        opacity: node.alpha ?? 1,
        position: 'absolute',
        top: node.y - anchorY * height,
        transform: transforms || undefined,
        transformOrigin: `${anchorX * 100}% ${anchorY * 100}%`,
        width,
      }}
    >
      <NativeUiSprite
        atlas={node.atlas}
        maskTint={node.tint}
        record={node.record}
        style={{
          transform: `scale(${width / definition.logicalSize[0]}, ${height / definition.logicalSize[1]})`,
          transformOrigin: 'top left',
        }}
      />
    </span>
  )
}

function renderSlice(node: NativeUiSliceNode): ReactNode {
  const definition = nativeUiRecord(node.atlas, node.record)
  const atlas = nativeUiAtlas(node.atlas)
  const [frameX, frameY, frameWidth, frameHeight] = definition.frame
  const [leftUv, topUv, rightUv, bottomUv] = node.sourceUv
  if (
    !node.sourceUv.every(Number.isFinite)
    || leftUv < 0
    || topUv < 0
    || rightUv > 1
    || bottomUv > 1
    || rightUv <= leftUv
    || bottomUv <= topUv
  ) throw new RangeError('native UI slice UV must be an ordered unit rectangle')
  const sourceX = frameX + frameWidth * leftUv
  const sourceY = frameY + frameHeight * topUv
  const sourceWidth = frameWidth * (rightUv - leftUv)
  const sourceHeight = frameHeight * (bottomUv - topUv)
  const scaleX = node.bounds.width / sourceWidth
  const scaleY = node.bounds.height / sourceHeight
  const source = `url("${nativeUiAtlasSource(node.atlas)}")`
  const tint = node.tint === undefined ? null : color(node.tint)
  return (
    <i
      data-native-ui-node={node.label}
      data-native-ui-slice={`${node.atlas}.${node.record}`}
      style={{
        backgroundBlendMode: tint === null ? undefined : 'multiply',
        backgroundColor: tint ?? undefined,
        backgroundImage: tint === null ? source : `linear-gradient(${tint}, ${tint}), ${source}`,
        backgroundPosition: `${-sourceX * scaleX}px ${-sourceY * scaleY}px`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${atlas.dimensions[0] * scaleX}px ${atlas.dimensions[1] * scaleY}px`,
        display: 'block',
        height: node.bounds.height,
        left: node.bounds.left,
        opacity: node.alpha ?? 1,
        position: 'absolute',
        top: node.bounds.top,
        transform: node.mirrorX || node.mirrorY
          ? `scale(${node.mirrorX ? -1 : 1}, ${node.mirrorY ? -1 : 1})`
          : undefined,
        width: node.bounds.width,
      }}
    />
  )
}

function renderTile(node: NativeUiTileNode): ReactNode {
  const definition = nativeUiRecord(node.atlas, node.record)
  const scale = node.scale ?? 1
  const tileWidth = definition.logicalSize[0] * scale
  const tileHeight = definition.logicalSize[1] * scale
  const tiles: ReactNode[] = []
  let index = 0
  for (let tileY = 0; tileY < node.bounds.height; tileY += tileHeight) {
    for (let tileX = 0; tileX < node.bounds.width; tileX += tileWidth) {
      const width = Math.min(tileWidth, node.bounds.width - tileX)
      const height = Math.min(tileHeight, node.bounds.height - tileY)
      tiles.push(
        <Fragment key={index}>
          {renderSlice({
            alpha: node.alpha,
            atlas: node.atlas,
            bounds: {
              height,
              left: node.bounds.left + tileX,
              top: node.bounds.top + tileY,
              width,
            },
            kind: 'slice',
            label: `${node.label ?? `${node.atlas}.${node.record}`}:tile-${index}`,
            record: node.record,
            sourceUv: [0, 0, width / tileWidth, height / tileHeight],
            tint: node.tint,
          })}
        </Fragment>,
      )
      index += 1
    }
  }
  return <>{tiles}</>
}

function renderText(node: NativeUiTextNode): ReactNode {
  const layout = layoutNativeUiText(node.text)
  const font = nativeUiFont(node.text.font)
  const atlas = nativeUiAtlas(font.atlas)
  const source = `url("${nativeUiAtlasSource(font.atlas)}")`
  return (
    <span
      data-native-ui-font={node.text.font}
      data-native-ui-node={node.label}
      data-native-ui-text-lines={layout.lines.map(({ text }) => text).join('\n')}
      data-native-ui-unsupported={layout.unsupportedCodePoints.join(',') || undefined}
      style={{ inset: 0, pointerEvents: 'none', position: 'absolute' }}
    >
      {layout.glyphs.map((glyph, index) => {
        const [x, y, width, height] = glyph.frame
        const renderedWidth = width * glyph.scale
        const renderedHeight = height * glyph.scale
        return (
          <i
            data-native-ui-glyph={glyph.codePoint}
            key={`${index}:${glyph.codePoint}`}
            style={{
              backgroundColor: color(glyph.tint),
              height: renderedHeight,
              imageRendering: 'pixelated',
              left: glyph.centerX - renderedWidth / 2,
              maskImage: source,
              maskPosition: `${-x * glyph.scale}px ${-y * glyph.scale}px`,
              maskRepeat: 'no-repeat',
              maskSize: `${atlas.dimensions[0] * glyph.scale}px ${atlas.dimensions[1] * glyph.scale}px`,
              opacity: glyph.alpha,
              position: 'absolute',
              top: glyph.centerY - renderedHeight / 2,
              WebkitMaskImage: source,
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

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`
}
