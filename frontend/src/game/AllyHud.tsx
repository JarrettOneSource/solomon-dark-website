import { useEffect, useState } from 'react'

import { art } from '../lib/assets.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import type { GameSnapshot } from './protocol/game-protocol.ts'
import type { PartyRosterPlayer } from './protocol/party-state.ts'
import {
  PLAYER_CHARACTER_SHEETS,
  playerCharacterAtlasCssFrame,
} from './renderer/player-character-atlas.ts'
import {
  allyHudAccessibleName,
  allyHudAccessibleStatus,
  allyHudRowsEqual,
  clampAllyHudHealthRatio,
  combineAllyHudRows,
  deriveGolemAllyHudRows,
  derivePlayerAllyHudRows,
  type AllyHudRow,
} from './ally-hud.ts'

const EMPTY_ADDITIONAL_ROWS: readonly AllyHudRow[] = []
const ALLY_CHIP_HEADING_INDEX = 12

interface AllyHudProps {
  additionalRows?: readonly AllyHudRow[]
  /** Touch: the roster yields to an open party column (HubScene owns the condition). */
  hidden?: boolean
  initialSnapshot: GameSnapshot
  partyRoster?: readonly PartyRosterPlayer[]
  playerId: string
  subscribeSnapshot: (listener: (snapshot: GameSnapshot) => void) => () => void
}

interface AllyHudRosterProps {
  hidden?: boolean
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
  partyRoster?: readonly PartyRosterPlayer[],
): AllyHudRow[] {
  return combineAllyHudRows(
    derivePlayerAllyHudRows(snapshot.players, playerId, partyRoster),
    deriveGolemAllyHudRows(
      snapshot.secondaryAbilities.actors,
      snapshotWorldKey(snapshot, playerId),
    ),
  )
}

function AllyChip({ element }: { element: WizardElement }) {
  const layers = [
    PLAYER_CHARACTER_SHEETS.robeDynamic[element],
    PLAYER_CHARACTER_SHEETS.robeFixed[element],
    PLAYER_CHARACTER_SHEETS.head[element],
  ] as const
  return (
    <span className="hub-hud-ally-chip" data-ally-chip-element={element} aria-hidden>
      {layers.map((sheet, index) => (
        <span
          key={`${sheet}:${index}`}
          className="hub-hud-ally-chip-layer"
        >
          <span style={playerCharacterAtlasCssFrame(
            sheet,
            0,
            ALLY_CHIP_HEADING_INDEX,
          )} />
        </span>
      ))}
    </span>
  )
}

function GolemChip() {
  return (
    <span className="hub-hud-ally-chip hub-hud-ally-chip-golem" aria-hidden>
      <img src={art.skullWhite} alt="" />
    </span>
  )
}

export function AllyHudRoster({ hidden, rows }: AllyHudRosterProps) {
  return (
    <div
      className="hub-hud-allies"
      data-ally-count={rows.length}
      hidden={hidden}
      role="list"
      aria-label="Allies"
    >
      {rows.map((row) => {
        const ratio = clampAllyHudHealthRatio(row.healthRatio)
        const accessibleName = allyHudAccessibleName(row.identity)
        const status = row.identity.kind === 'player'
          ? !row.connected
            ? 'DISCONNECTED'
            : row.dead ? 'DEAD' : null
          : null
        return (
          <div
            key={row.id}
            className="hub-hud-ally-row"
            data-ally-id={row.id}
            data-ally-kind={row.identity.kind}
            data-ally-element={row.identity.kind === 'player' ? row.identity.element : undefined}
            data-ally-connected={row.connected}
            data-ally-dead={row.dead}
            data-ally-status={status?.toLowerCase() ?? 'none'}
            data-health-ratio={ratio}
            role="listitem"
            aria-label={allyHudAccessibleStatus(row)}
          >
            {row.identity.kind === 'player'
              ? <AllyChip element={row.identity.element} />
              : <GolemChip />}
            <span className="hub-hud-ally-main">
              <span className="hub-hud-ally-name" aria-hidden>{accessibleName}</span>
              <span
                className="hub-hud-ally-bar"
                role="progressbar"
                aria-label={`${accessibleName} health`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={ratio * 100}
              >
                <span
                  className="hub-hud-ally-bar-fill"
                  style={{ width: `${ratio * 100}%` }}
                  aria-hidden
                />
              </span>
            </span>
            {status === null ? null : (
              <span className="hub-hud-ally-status" aria-hidden>{status}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function AllyHud({
  additionalRows = EMPTY_ADDITIONAL_ROWS,
  hidden,
  initialSnapshot,
  partyRoster,
  playerId,
  subscribeSnapshot,
}: AllyHudProps) {
  const [snapshotRows, setSnapshotRows] = useState<readonly AllyHudRow[]>(() => (
    deriveSnapshotAllyHudRows(initialSnapshot, playerId, partyRoster)
  ))

  useEffect(() => {
    const publish = (snapshot: GameSnapshot) => {
      const nextRows = deriveSnapshotAllyHudRows(snapshot, playerId, partyRoster)
      setSnapshotRows((currentRows) => allyHudRowsEqual(currentRows, nextRows)
        ? currentRows
        : nextRows)
    }
    publish(initialSnapshot)
    return subscribeSnapshot(publish)
  }, [initialSnapshot, partyRoster, playerId, subscribeSnapshot])

  return <AllyHudRoster hidden={hidden} rows={combineAllyHudRows(snapshotRows, additionalRows)} />
}
