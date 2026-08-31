import type { CSSProperties } from 'react'

import { NativeBitmapText } from './native-ui/react-raw.ts'
import {
  nativeUiAtlas,
  nativeUiRecord,
  type NativeUiAtlasRecord,
} from './native-ui/core.ts'
import { nativeUiAtlasSource } from './native-ui/assets.ts'
import type { GameViewportLayout } from './renderer/game-viewport.ts'
import type { BoneyardSpectatorStatusPresentation } from './renderer/boneyard-render-contract.ts'
import {
  NATIVE_SPECTATOR_HUD_CONTRACT,
  nativeSpectatorHudLayout,
} from './native-spectator-hud.ts'

interface NativeSpectatorStatusProps {
  readonly status: BoneyardSpectatorStatusPresentation
  readonly viewport: GameViewportLayout
}

const UI_ATLAS = nativeUiAtlas('UI')
const UI_ATLAS_SOURCE = nativeUiAtlasSource('UI')

export default function NativeSpectatorStatus({
  status,
  viewport,
}: NativeSpectatorStatusProps) {
  const layout = nativeSpectatorHudLayout(viewport)
  return (
    <div
      className="boneyard-spectator-status"
      data-display-text={status.displayText}
      data-native-font="Fonts.93-184"
      data-native-ui-records={NATIVE_SPECTATOR_HUD_CONTRACT.panelRecords.join(',')}
      data-run-id={status.runId}
      data-target-player-id={status.targetPlayerId ?? ''}
      role="status"
      aria-atomic="true"
      aria-label={status.accessibleLabel}
      aria-live="polite"
      style={{
        height: layout.surface.height,
        left: layout.surface.x,
        top: layout.surface.y,
        width: layout.surface.width,
      }}
    >
      <NativePanelChrome layout={layout} />
      <NativeBitmapText
        className="boneyard-spectator-status-text"
        font={NATIVE_SPECTATOR_HUD_CONTRACT.font}
        style={{ left: layout.text.x, position: 'absolute', top: layout.text.y }}
        text={status.displayText}
        tint={NATIVE_SPECTATOR_HUD_CONTRACT.tint}
      />
      <div
        className="boneyard-spectator-respawn-status"
        data-active-enemy-count={status.activeEnemyCount}
        data-incoming-enemy-count={status.incomingEnemyCount}
        data-respawn-text={status.respawnText}
        data-wave-ordinal={status.waveOrdinal ?? ''}
        data-wave-phase={status.wavePhase ?? ''}
        aria-hidden
        style={{
          height: layout.surface.height,
          left: 0,
          top: layout.surface.height + NATIVE_SPECTATOR_HUD_CONTRACT.respawnPanelGap,
          width: layout.surface.width,
        }}
      >
        <NativePanelChrome layout={layout} />
        <NativeBitmapText
          className="boneyard-spectator-status-text"
          font={NATIVE_SPECTATOR_HUD_CONTRACT.font}
          style={{ left: layout.text.x, position: 'absolute', top: layout.text.y }}
          text={status.respawnText}
          tint={NATIVE_SPECTATOR_HUD_CONTRACT.tint}
        />
      </div>
    </div>
  )
}

function NativePanelChrome({ layout }: Readonly<{
  layout: ReturnType<typeof nativeSpectatorHudLayout>
}>) {
  return (
    <>
      {layout.horizontalRails.map((rail, index) => (
        <NativeAtlasStrip
          key={`horizontal:${index}`}
          direction="horizontal"
          {...rail}
        />
      ))}
      {layout.verticalRails.map((rail, index) => (
        <NativeAtlasStrip
          key={`vertical:${index}`}
          direction="vertical"
          {...rail}
        />
      ))}
      {layout.corners.map((corner) => {
        const record = atlasRecord(corner.record)
        return (
          <NativeAtlasSprite
            key={corner.record}
            record={corner.record}
            style={{
              left: corner.centerX - record.logicalSize[0] / 2,
              top: corner.centerY - record.logicalSize[1] / 2,
            }}
          />
        )
      })}
    </>
  )
}

function NativeAtlasStrip({
  direction,
  height,
  record,
  width,
  x,
  y,
}: Readonly<{
  direction: 'horizontal' | 'vertical'
  height: number
  record: number
  width: number
  x: number
  y: number
}>) {
  const source = atlasRecord(record)
  const sourceExtent = direction === 'horizontal'
    ? source.logicalSize[0]
    : source.logicalSize[1]
  const extent = direction === 'horizontal' ? width : height
  const count = Math.ceil(extent / sourceExtent)
  return (
    <span
      className="boneyard-spectator-status-rail"
      data-native-ui-record={record}
      aria-hidden
      style={{ height, left: x, top: y, width }}
    >
      {Array.from({ length: count }, (_, index) => {
        const offset = index * sourceExtent
        const clippedExtent = Math.min(sourceExtent, extent - offset)
        return (
          <span
            key={index}
            className="boneyard-spectator-status-rail-segment"
            style={direction === 'horizontal'
              ? {
                  height: source.logicalSize[1],
                  left: offset,
                  top: 0,
                  width: clippedExtent,
                }
              : {
                  height: clippedExtent,
                  left: 0,
                  top: offset,
                  width: source.logicalSize[0],
                }}
          >
            <NativeAtlasSprite record={record} style={{ left: 0, top: 0 }} />
          </span>
        )
      })}
    </span>
  )
}

function NativeAtlasSprite({
  record,
  style,
}: Readonly<{
  record: number
  style?: CSSProperties
}>) {
  const source = atlasRecord(record)
  const [x, y, width, height] = source.frame
  return (
    <i
      className="boneyard-spectator-status-native-sprite"
      data-native-ui-record={record}
      aria-hidden
      style={{
        backgroundImage: `url("${UI_ATLAS_SOURCE}")`,
        backgroundPosition: `${-x}px ${-y}px`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${UI_ATLAS.dimensions[0]}px ${UI_ATLAS.dimensions[1]}px`,
        height,
        width,
        ...style,
      }}
    />
  )
}

function atlasRecord(record: number): NativeUiAtlasRecord {
  return nativeUiRecord('UI', record)
}
