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
  readonly actions: readonly string[]
  readonly bindings: LuaConsoleObject
  readonly center: Readonly<{ x: number; y: number }>
  readonly contentId: string
  readonly markers: readonly ModMinimapMarker[]
  readonly mount: string
  readonly range: number
  readonly size: Readonly<{ height: number; width: number }>
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
  const surfaces = rows(runtime?.ui_surfaces)
  const surface = surfaces.find(entry => object(entry.view).operation === 'prefab.minimap')
  if (surfaces.length > 0 && !surface) return null
  const fields = object(object(surface?.view).fields)
  const layers = layerNames(fields.layers)
  const includes = (name: string) => layers.length === 0 || layers.includes(name)
  const viewer = snapshot.players[viewerId]
  if (!definition || !viewer) return null
  const markers: ModMinimapMarker[] = includes('party')
    ? Object.entries(snapshot.players).map(([id, player]) => ({
        id,
        kind: id === viewerId ? 'self' as const : 'party' as const,
        x: player.position.x,
        y: player.position.y,
      }))
    : [{ id: viewerId, kind: 'self', x: viewer.position.x, y: viewer.position.y }]
  if (snapshot.world.kind === 'boneyard' && includes('visible_hostiles')) {
    markers.push(...(snapshot.world.enemies ?? []).map(enemy => ({
      id: `enemy-${enemy.id}`,
      kind: 'enemy' as const,
      x: enemy.position.x,
      y: enemy.position.y,
    })))
    markers.push(...runtimeEnemies(runtime))
  }
  if (includes('powerups')) markers.push(...mods.powerups.map(powerup => ({
      id: `powerup-${powerup.id}`,
      kind: 'powerup' as const,
      x: powerup.x,
      y: powerup.y,
    })))
  const size = object(fields.size)
  const scalarSize = typeof fields.size === 'number' ? fields.size : 220
  return Object.freeze({
    accessibleName: text(surface?.accessible_name) || definition.name,
    actions: Object.freeze(strings(surface?.actions)),
    bindings: Object.freeze(object(surface?.bindings)),
    center: Object.freeze({ ...viewer.position }),
    contentId: text(surface?.content_id) || definition.contentId,
    markers: Object.freeze(markers),
    mount: text(surface?.mount) || 'hud.top_right',
    range: positive(fields.range, 500),
    size: Object.freeze({
      height: positive(size.height, scalarSize),
      width: positive(size.width, scalarSize),
    }),
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

function layerNames(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((entry) => {
    if (typeof entry === 'string') return [entry]
    const source = object(entry).source
    return typeof source === 'string' ? [source] : []
  }) : []
}

function rows(value: unknown): LuaConsoleObject[] {
  return Array.isArray(value) ? value.filter((entry): entry is LuaConsoleObject => (
    Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
  )) : []
}

function object(value: unknown): LuaConsoleObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as LuaConsoleObject : {}
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function text(value: unknown): string { return typeof value === 'string' ? value : '' }

function positive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}
