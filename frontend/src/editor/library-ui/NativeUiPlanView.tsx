import type { CSSProperties, ReactNode } from 'react'

import { nativeUiAtlasSource } from './native-ui-assets.ts'
import {
  nativeUiAtlas,
  nativeUiRecord,
} from './native-ui-catalog.ts'
import NativeUiSprite from './NativeUiSprite.tsx'
import NativeUiTextGlyphs from './NativeUiTextGlyphs.tsx'
import type {
  NativeUiNode,
  NativeUiPlan,
  NativeUiSliceNode,
  NativeUiSpriteNode,
  NativeUiTextNode,
} from './native-ui-plan.ts'
import { layoutNativeUiText } from './native-ui-text.ts'

interface NativeUiPlanViewProps {
  readonly className?: string
  readonly plan: NativeUiPlan
  readonly style?: CSSProperties
}

/** DOM adapter for the stock button plan retained by the authoring shelf. */
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
  if (node.kind === 'sprite') return renderSprite(node)
  if (node.kind === 'slice') return renderSlice(node)
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

function renderText(node: NativeUiTextNode): ReactNode {
  const layout = layoutNativeUiText(node.text)
  return (
    <span
      data-native-ui-font={node.text.font}
      data-native-ui-node={node.label}
      data-native-ui-text-lines={layout.lines.map(({ text }) => text).join('\n')}
      data-native-ui-unsupported={layout.unsupportedCodePoints.join(',') || undefined}
      style={{ inset: 0, pointerEvents: 'none', position: 'absolute' }}
    >
      <NativeUiTextGlyphs layout={layout} />
    </span>
  )
}

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`
}
