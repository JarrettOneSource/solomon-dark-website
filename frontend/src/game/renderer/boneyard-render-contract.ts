import type { Camera } from '../../editor/render.ts'
import type { Vec2 } from '../../editor/model.ts'
import type { GameRunPhase } from '../core-kernels/game-run.ts'
import {
  PLAYER_DEATH_FRAME_THREE_TICK,
  type PlayerLifeState,
} from '../core-kernels/player-combat.ts'
import {
  GAME_VIEWPORT_MIN_HEIGHT,
  GAME_VIEWPORT_MIN_WIDTH,
} from './game-viewport.ts'

export const BONEYARD_RENDER_WIDTH = GAME_VIEWPORT_MIN_WIDTH
export const BONEYARD_RENDER_HEIGHT = GAME_VIEWPORT_MIN_HEIGHT
export const BONEYARD_CAMERA_ZOOM = 1.35
export const BONEYARD_STATIC_TILE_SIZE = 1024
export const BONEYARD_STATIC_ART_MARGIN = 256
export const BONEYARD_RESIDENT_CULL_PADDING = 32
export const NATIVE_PLAYER_DEATH_SORT_BIAS = -1000

export interface BoneyardBounds {
  h: number
  w: number
  x: number
  y: number
}

export interface BoneyardStaticTile {
  h: number
  w: number
  x: number
  y: number
}

export interface BoneyardRenderViewport {
  height: number
  width: number
}

interface BoneyardSpectatorPlayerSnapshot {
  readonly config: Readonly<{
    displayName: string
  }>
  readonly position: Vec2
  readonly progression: Readonly<{
    lifeState: PlayerLifeState
  }>
}

export interface BoneyardSpectatorCameraSnapshot {
  readonly players: Readonly<Record<string, BoneyardSpectatorPlayerSnapshot>>
  readonly run: Readonly<{
    eligiblePlayerIds: readonly string[]
    phase: GameRunPhase
    runId: string | null
  }>
}

export interface BoneyardSpectatorCameraState {
  readonly runId: string | null
  readonly targetPlayerId: string | null
}

export interface BoneyardCameraFocus {
  readonly playerId: string | null
  readonly position: Vec2
}

export function boneyardPlayerSortBias(player: Readonly<{
  progression: Readonly<{
    deathTick: number
    lifeState: PlayerLifeState
  }>
}>): number {
  const { deathTick, lifeState } = player.progression
  return (
    (lifeState === 'dying' || lifeState === 'spectating')
    && deathTick >= PLAYER_DEATH_FRAME_THREE_TICK
  ) ? NATIVE_PLAYER_DEATH_SORT_BIAS : 0
}

export interface BoneyardSpectatorStatusPresentation {
  readonly accessibleLabel: string
  readonly instruction: string | null
  readonly runId: string
  readonly targetPlayerId: string | null
  readonly title: string
}

export const INITIAL_BONEYARD_SPECTATOR_CAMERA_STATE: BoneyardSpectatorCameraState = {
  runId: null,
  targetPlayerId: null,
}

export function boneyardSpectatorCameraState(
  snapshot: BoneyardSpectatorCameraSnapshot,
  localPlayerId: string,
  current: BoneyardSpectatorCameraState,
  advance = false,
): BoneyardSpectatorCameraState {
  const runId = snapshot.run.runId
  const localPlayer = snapshot.players[localPlayerId]
  if (
    snapshot.run.phase !== 'active'
    || runId === null
    || localPlayer?.progression.lifeState !== 'spectating'
  ) return { runId, targetPlayerId: null }

  const currentTargetPlayerId = current.runId === runId
    ? current.targetPlayerId
    : null
  const eligiblePlayerIds = new Set(snapshot.run.eligiblePlayerIds)
  const currentTarget = currentTargetPlayerId === null
    ? undefined
    : snapshot.players[currentTargetPlayerId]
  if (
    !advance
    && currentTargetPlayerId !== null
    && eligiblePlayerIds.has(currentTargetPlayerId)
    && currentTarget
    && spectatorTargetRemainsPresentable(currentTarget.progression.lifeState)
  ) {
    return { runId, targetPlayerId: currentTargetPlayerId }
  }

  const livingPlayerIds = snapshot.run.eligiblePlayerIds
    .filter((playerId) => (
      playerId !== localPlayerId
      && snapshot.players[playerId]?.progression.lifeState === 'alive'
    ))
    .toSorted(comparePlayerIds)
  if (livingPlayerIds.length === 0) return { runId, targetPlayerId: null }
  if (!advance || currentTargetPlayerId === null) {
    return { runId, targetPlayerId: livingPlayerIds[0] ?? null }
  }
  const currentIndex = livingPlayerIds.indexOf(currentTargetPlayerId)
  return {
    runId,
    targetPlayerId: currentIndex < 0
      ? (livingPlayerIds[0] ?? null)
      : (livingPlayerIds[(currentIndex + 1) % livingPlayerIds.length] ?? null),
  }
}

export function boneyardCameraFocus(
  snapshot: BoneyardSpectatorCameraSnapshot,
  localPlayerId: string,
  spectator: BoneyardSpectatorCameraState,
  fallback: Vec2,
): BoneyardCameraFocus {
  const localPlayer = snapshot.players[localPlayerId]
  const targetPlayerId = (
    snapshot.run.phase === 'active'
    && snapshot.run.runId === spectator.runId
    && localPlayer?.progression.lifeState === 'spectating'
    && spectator.targetPlayerId !== null
    && snapshot.players[spectator.targetPlayerId]
  ) ? spectator.targetPlayerId : null
  const playerId = targetPlayerId ?? (localPlayer ? localPlayerId : null)
  return {
    playerId,
    position: playerId === null ? fallback : snapshot.players[playerId]!.position,
  }
}

export function boneyardSpectatorStatus(
  snapshot: BoneyardSpectatorCameraSnapshot,
  localPlayerId: string,
  spectator: BoneyardSpectatorCameraState,
): BoneyardSpectatorStatusPresentation | null {
  const runId = snapshot.run.runId
  if (
    snapshot.run.phase !== 'active'
    || runId === null
    || spectator.runId !== runId
    || snapshot.players[localPlayerId]?.progression.lifeState !== 'spectating'
  ) return null

  const targetPlayerId = spectator.targetPlayerId
  const targetName = targetPlayerId === null
    ? null
    : snapshot.players[targetPlayerId]?.config.displayName ?? null
  if (targetName === null) {
    const title = 'Spectating - waiting for an alive player'
    return {
      accessibleLabel: `${title}.`,
      instruction: null,
      runId,
      targetPlayerId: null,
      title,
    }
  }
  const title = `Spectating ${targetName}`
  return {
    accessibleLabel: `${title}. Left or right click to select the next player.`,
    instruction: 'Left / Right click: next player',
    runId,
    targetPlayerId,
    title,
  }
}

export function boneyardSpectatorStatusesEqual(
  left: BoneyardSpectatorStatusPresentation | null,
  right: BoneyardSpectatorStatusPresentation | null,
): boolean {
  return left === right || (
    left !== null
    && right !== null
    && left.accessibleLabel === right.accessibleLabel
    && left.instruction === right.instruction
    && left.runId === right.runId
    && left.targetPlayerId === right.targetPlayerId
    && left.title === right.title
  )
}

export function boneyardCamera(
  position: Vec2,
  bounds: BoneyardBounds,
  viewport: BoneyardRenderViewport = {
    height: BONEYARD_RENDER_HEIGHT,
    width: BONEYARD_RENDER_WIDTH,
  },
): Camera {
  return {
    x: clampCameraAxis(
      position.x,
      bounds.x,
      bounds.w,
      viewport.width / 2 / BONEYARD_CAMERA_ZOOM,
    ),
    y: clampCameraAxis(
      position.y,
      bounds.y,
      bounds.h,
      viewport.height / 2 / BONEYARD_CAMERA_ZOOM,
    ),
    zoom: BONEYARD_CAMERA_ZOOM,
  }
}

export function boneyardWorldPosition(
  camera: Camera,
  viewport: BoneyardRenderViewport = {
    height: BONEYARD_RENDER_HEIGHT,
    width: BONEYARD_RENDER_WIDTH,
  },
): Vec2 {
  return {
    x: viewport.width / 2 - camera.x * camera.zoom,
    y: viewport.height / 2 - camera.y * camera.zoom,
  }
}

export function boneyardVisibleWorldBounds(
  camera: Camera,
  viewport: BoneyardRenderViewport = {
    height: BONEYARD_RENDER_HEIGHT,
    width: BONEYARD_RENDER_WIDTH,
  },
  padding = BONEYARD_RESIDENT_CULL_PADDING,
): BoneyardBounds {
  const width = viewport.width / camera.zoom
  const height = viewport.height / camera.zoom
  return {
    x: camera.x - width / 2 - padding,
    y: camera.y - height / 2 - padding,
    w: width + padding * 2,
    h: height + padding * 2,
  }
}

export function boneyardResidentIsVisible(
  resident: BoneyardBounds,
  view: BoneyardBounds,
): boolean {
  return resident.x <= view.x + view.w
    && resident.x + resident.w >= view.x
    && resident.y <= view.y + view.h
    && resident.y + resident.h >= view.y
}

export function boneyardStaticTiles(
  bounds: BoneyardBounds,
  tileSize = BONEYARD_STATIC_TILE_SIZE,
  margin = BONEYARD_STATIC_ART_MARGIN,
): BoneyardStaticTile[] {
  const x0 = bounds.x - margin
  const y0 = bounds.y - margin
  const x1 = bounds.x + bounds.w + margin
  const y1 = bounds.y + bounds.h + margin
  const tiles: BoneyardStaticTile[] = []
  for (let y = y0; y < y1; y += tileSize) {
    for (let x = x0; x < x1; x += tileSize) {
      tiles.push({
        h: Math.min(tileSize, y1 - y),
        w: Math.min(tileSize, x1 - x),
        x,
        y,
      })
    }
  }
  return tiles
}

function clampCameraAxis(
  position: number,
  start: number,
  size: number,
  halfView: number,
): number {
  if (size <= halfView * 2) return start + size / 2
  return Math.min(start + size - halfView, Math.max(start + halfView, position))
}

function spectatorTargetRemainsPresentable(lifeState: PlayerLifeState): boolean {
  return lifeState === 'alive'
    || lifeState === 'lethal-pending'
    || lifeState === 'dying'
}

function comparePlayerIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
