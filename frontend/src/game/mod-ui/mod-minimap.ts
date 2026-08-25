import type { LuaConsoleObject, ModContentProjection } from '../protocol/game-protocol.ts'

export interface ModMinimapSnapshot {
  readonly players: Readonly<Record<string, Readonly<{
    position: Readonly<{ x: number; y: number }>
  }>>>
  readonly world: Readonly<{
    enemies?: readonly Readonly<{
      id: number
      position: Readonly<{ x: number; y: number }>
    }>[]
    kind: 'boneyard' | 'hub'
  }>
}

export interface ModMinimapMarker {
  readonly id: string
  readonly kind: 'enemy' | 'party' | 'powerup' | 'self'
  readonly x: number
  readonly y: number
}

export interface ModMinimapModel {
  readonly accessibleName: string
  readonly center: Readonly<{ x: number; y: number }>
  readonly contentId: string
  readonly markers: readonly ModMinimapMarker[]
}

export function projectModMinimap(
  snapshot: ModMinimapSnapshot,
  mods: ModContentProjection,
  viewerId: string,
  runtime: LuaConsoleObject | null = null,
): ModMinimapModel | null {
  const definition = mods.content.find(content => (
    content.contentKind === 'ui' && content.presentation === 'prefab.minimap'
  ))
  const viewer = snapshot.players[viewerId]
  if (!definition || !viewer) return null
  const markers: ModMinimapMarker[] = Object.entries(snapshot.players).map(([id, player]) => ({
    id,
    kind: id === viewerId ? 'self' as const : 'party' as const,
    x: player.position.x,
    y: player.position.y,
  }))
  if (snapshot.world.kind === 'boneyard') {
    markers.push(...(snapshot.world.enemies ?? []).map(enemy => ({
      id: `enemy-${enemy.id}`,
      kind: 'enemy' as const,
      x: enemy.position.x,
      y: enemy.position.y,
    })))
    markers.push(...runtimeEnemies(runtime))
  }
  markers.push(...mods.powerups.map(powerup => ({
    id: `powerup-${powerup.id}`,
    kind: 'powerup' as const,
    x: powerup.x,
    y: powerup.y,
  })))
  return Object.freeze({
    accessibleName: definition.name,
    center: Object.freeze({ ...viewer.position }),
    contentId: definition.contentId,
    markers: Object.freeze(markers),
  })
}

function runtimeEnemies(runtime: LuaConsoleObject | null): ModMinimapMarker[] {
  const values = runtime?.enemies
  if (!Array.isArray(values)) return []
  return values.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const enemy = value as LuaConsoleObject
    return typeof enemy.id === 'number' && typeof enemy.x === 'number' && typeof enemy.y === 'number'
      ? [{ id: `mod-enemy-${enemy.id}`, kind: 'enemy' as const, x: enemy.x, y: enemy.y }]
      : []
  })
}
