import { gameContentUrl } from '../game-content-cache.ts'
import type { GameModAsset, LuaConsoleObject } from '../protocol/game-protocol.ts'

export interface ModSpellEffectModel {
  readonly frame: Readonly<{ height: number; width: number; x: number; y: number }>
  readonly id: number
  readonly imageHeight: number
  readonly imageUrl: string
  readonly imageWidth: number
  readonly kind: 'area' | 'channel' | 'projectile'
  readonly radius: number
  readonly soundUrl: string | null
  readonly soundVolume: number
  readonly startedTick: number
  readonly targetX: number
  readonly targetY: number
  readonly x: number
  readonly y: number
}

export function projectModSpellEffects(
  runtime: LuaConsoleObject | null,
  assets: readonly GameModAsset[],
): readonly ModSpellEffectModel[] {
  const rows = Array.isArray(runtime?.spell_effects) ? runtime.spell_effects : []
  return Object.freeze(rows.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const row = value as LuaConsoleObject
    const kind = row.kind
    const modId = row.mod_id
    const imagePath = row.image_path
    if ((kind !== 'area' && kind !== 'channel' && kind !== 'projectile') ||
        typeof modId !== 'string' || typeof imagePath !== 'string') return []
    const image = asset(assets, modId, imagePath, 'image')
    if (!image) return []
    const soundPath = typeof row.sound_path === 'string' ? row.sound_path : null
    const sound = soundPath ? asset(assets, modId, soundPath, 'audio') : null
    return [Object.freeze({
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
      kind,
      radius: finite(row.radius),
      soundUrl: sound ? gameContentUrl(sound) : null,
      soundVolume: finite(row.sound_volume),
      startedTick: integer(row.started_tick),
      targetX: finite(row.target_x),
      targetY: finite(row.target_y),
      x: finite(row.x),
      y: finite(row.y),
    })]
  }).filter(effect => effect.id > 0 && effect.frame.width > 0 && effect.frame.height > 0))
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
