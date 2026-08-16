import { useEffect, useState, type CSSProperties } from 'react'

import { hub } from '../lib/assets.ts'
import type { GameSnapshot } from './protocol/game-protocol.ts'
import {
  allyHudIdentityPresentation,
  allyHudRowsEqual,
  clampAllyHudHealthRatio,
  combineAllyHudRows,
  deriveGolemAllyHudRows,
  derivePlayerAllyHudRows,
  layoutNativeAllyName,
  NATIVE_ALLY_FONT,
  type AllyHudRow,
} from './ally-hud.ts'

const EMPTY_ADDITIONAL_ROWS: readonly AllyHudRow[] = []
const NATIVE_NAME_BASELINE = 7

interface AllyHudProps {
  additionalRows?: readonly AllyHudRow[]
  initialSnapshot: GameSnapshot
  playerId: string
  subscribeSnapshot: (listener: (snapshot: GameSnapshot) => void) => () => void
}

interface AllyHudRosterProps {
  rows: readonly AllyHudRow[]
}

function snapshotWorldKey(snapshot: GameSnapshot, playerId: string): string {
  return snapshot.world.kind === 'boneyard'
    ? `boneyard:${snapshot.world.runId}`
    : `hub:${snapshot.world.participants[playerId]?.region ?? 'courtyard'}`
}

function deriveSnapshotAllyHudRows(
  snapshot: GameSnapshot,
  playerId: string,
): AllyHudRow[] {
  return combineAllyHudRows(
    derivePlayerAllyHudRows(snapshot.players, playerId),
    deriveGolemAllyHudRows(
      snapshot.secondaryAbilities.actors,
      snapshotWorldKey(snapshot, playerId),
    ),
  )
}

function NativeAllyName({ name }: { name: string }) {
  const layout = layoutNativeAllyName(name)
  const maskImage = `url("${hub.hud.fontAtlas}")`
  const maskSize = `${NATIVE_ALLY_FONT.atlasWidth * NATIVE_ALLY_FONT.scale}px ${NATIVE_ALLY_FONT.atlasHeight * NATIVE_ALLY_FONT.scale}px`

  return layout.glyphs.map((glyph, index) => (
    <span
      key={`${index}:${glyph.char}`}
      className="hub-hud-ally-glyph"
      style={{
        height: glyph.height,
        left: glyph.left,
        maskImage,
        maskPosition: `${-glyph.atlasX * NATIVE_ALLY_FONT.scale}px ${-glyph.atlasY * NATIVE_ALLY_FONT.scale}px`,
        maskSize,
        top: NATIVE_NAME_BASELINE + glyph.top,
        WebkitMaskImage: maskImage,
        WebkitMaskPosition: `${-glyph.atlasX * NATIVE_ALLY_FONT.scale}px ${-glyph.atlasY * NATIVE_ALLY_FONT.scale}px`,
        WebkitMaskSize: maskSize,
        width: glyph.width,
      } satisfies CSSProperties}
      aria-hidden
    />
  ))
}

function GolemIdentity() {
  const maskImage = `url("${hub.hud.golem}")`
  return (
    <span
      className="hub-hud-ally-golem"
      style={{
        maskImage,
        WebkitMaskImage: maskImage,
      }}
      aria-hidden
    />
  )
}

export function AllyHudRoster({ rows }: AllyHudRosterProps) {
  return (
    <div
      className="hub-hud-allies"
      data-ally-count={rows.length}
      role="list"
      aria-label="Allies"
    >
      {rows.map((row) => {
        const ratio = clampAllyHudHealthRatio(row.healthRatio)
        const presentation = allyHudIdentityPresentation(row.identity)
        return (
          <div
            key={row.id}
            className="hub-hud-ally-row"
            data-ally-id={row.id}
            data-ally-kind={row.identity.kind}
            data-health-ratio={ratio}
            role="listitem"
            aria-label={presentation.accessibleName}
          >
            <span
              className="hub-hud-ally-bar"
              role="progressbar"
              aria-label={`${presentation.accessibleName} health`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ratio * 100}
            >
              <span
                className="hub-hud-ally-bar-fill"
                style={{ width: 50 * ratio }}
                aria-hidden
              />
            </span>
            <span className="hub-hud-ally-identity" aria-hidden>
              {presentation.visual === 'native-font'
                ? <NativeAllyName name={presentation.accessibleName} />
                : <GolemIdentity />}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function AllyHud({
  additionalRows = EMPTY_ADDITIONAL_ROWS,
  initialSnapshot,
  playerId,
  subscribeSnapshot,
}: AllyHudProps) {
  const [snapshotRows, setSnapshotRows] = useState<readonly AllyHudRow[]>(() => (
    deriveSnapshotAllyHudRows(initialSnapshot, playerId)
  ))

  useEffect(() => {
    const publish = (snapshot: GameSnapshot) => {
      const nextRows = deriveSnapshotAllyHudRows(snapshot, playerId)
      setSnapshotRows((currentRows) => allyHudRowsEqual(currentRows, nextRows)
        ? currentRows
        : nextRows)
    }
    publish(initialSnapshot)
    return subscribeSnapshot(publish)
  }, [initialSnapshot, playerId, subscribeSnapshot])

  return <AllyHudRoster rows={combineAllyHudRows(snapshotRows, additionalRows)} />
}
