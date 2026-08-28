import { gameContentUrl } from '../game-content-cache.ts'
import type { GameModAsset, LuaConsoleObject } from '../protocol/game-protocol.ts'

export interface ModEnemyModel {
  readonly currentHealth: number
  readonly frame: Readonly<{ height: number; width: number; x: number; y: number }>
  readonly id: number
  readonly imageHeight: number
  readonly imageUrl: string
  readonly imageWidth: number
  readonly lifeState: 'alive' | 'dying'
  readonly lightColor: number
  readonly lightRadius: number
  readonly maximumHealth: number
  readonly name: string
  readonly scale: number
  readonly soundEventTick: number | null
  readonly soundUrl: string | null
  readonly soundVolume: number
  readonly x: number
  readonly y: number
}

export function projectModEnemies(
  runtime: LuaConsoleObject | null,
  assets: readonly GameModAsset[],
): readonly ModEnemyModel[] {
  const rows = Array.isArray(runtime?.enemies) ? runtime.enemies : []
  return Object.freeze(rows.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const row = value as LuaConsoleObject
    const modId = text(row.mod_id)
    const imagePath = text(row.image_path)
    const lifeState = row.life_state
    if (!modId || !imagePath || (lifeState !== 'alive' && lifeState !== 'dying')) return []
    const image = asset(assets, modId, imagePath, 'image')
    if (!image) return []
    const soundPath = text(row.sound_path)
    const sound = soundPath ? asset(assets, modId, soundPath, 'audio') : null
    const model = Object.freeze({
      currentHealth: finite(row.current_health),
      frame: Object.freeze({
        height: finite(row.frame_height),
        width: finite(row.frame_width),
        x: finite(row.frame_x),
        y: finite(row.frame_y),
      }),
      id: integer(row.id),
      imageHeight: finite(row.image_height),
      imageUrl: gameContentUrl(image),
      imageWidth: finite(row.image_width),
      lifeState,
      lightColor: integer(row.light_color),
      lightRadius: finite(row.light_radius),
      maximumHealth: finite(row.maximum_health),
      name: text(row.name),
      scale: finite(row.scale),
      soundEventTick: row.sound_event_tick === null ? null : integer(row.sound_event_tick),
      soundUrl: sound ? gameContentUrl(sound) : null,
      soundVolume: finite(row.sound_volume),
      x: finite(row.x),
      y: finite(row.y),
    })
    return model.id > 0 && model.frame.width > 0 && model.frame.height > 0 &&
      model.maximumHealth > 0 && model.scale > 0 ? [model] : []
  }))
}

function asset(
  assets: readonly GameModAsset[],
  modId: string,
  path: string,
  kind: 'audio' | 'image',
): GameModAsset | null {
  return assets.find(candidate => (
    candidate.modId === modId && candidate.path === path && candidate.kind === kind
  )) ?? null
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function integer(value: unknown): number {
  return Number.isSafeInteger(value) ? Number(value) : 0
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
