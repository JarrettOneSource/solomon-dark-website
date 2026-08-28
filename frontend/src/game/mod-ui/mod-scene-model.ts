import type { LuaConsoleObject } from '../protocol/game-protocol.ts'

export interface ModRoomModel {
  readonly contentId: string
  readonly description: string
  readonly floor: string
  readonly height: number
  readonly name: string
  readonly props: readonly LuaConsoleObject[]
  readonly walls: readonly LuaConsoleObject[]
  readonly width: number
}

export interface ModSceneModel {
  readonly contentId: string
  readonly epoch: number
  readonly roomIndex: number
  readonly rooms: readonly ModRoomModel[]
}

export function projectModScene(
  runtime: LuaConsoleObject | null,
  ownerId: string,
): ModSceneModel | null {
  const scene = rows(runtime?.scenes).find(row => row.owner_id === ownerId)
  if (!scene) return null
  const rooms = rows(scene.rooms).map((room): ModRoomModel => {
    const geometry = object(room.geometry)
    return Object.freeze({
      contentId: text(room.content_id),
      description: text(room.description),
      floor: color(geometry.floor, '#201c2b'),
      height: bounded(geometry.height, 720),
      name: text(room.name) || 'Room',
      props: Object.freeze(rows(room.props)),
      walls: Object.freeze(rows(geometry.walls)),
      width: bounded(geometry.width, 1_120),
    })
  })
  const roomIndex = integer(scene.room_index)
  if (!text(scene.scene_content_id) || rooms.length === 0 || roomIndex < 0 || roomIndex >= rooms.length) {
    return null
  }
  return Object.freeze({
    contentId: text(scene.scene_content_id),
    epoch: integer(scene.epoch),
    roomIndex,
    rooms: Object.freeze(rooms),
  })
}

export function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

export function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function bounded(value: unknown, fallback: number): number {
  const result = number(value, fallback)
  return result >= 160 && result <= 4_096 ? result : fallback
}

function integer(value: unknown): number {
  return Number.isSafeInteger(value) ? Number(value) : 0
}

function object(value: unknown): LuaConsoleObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LuaConsoleObject
    : {}
}

function rows(value: unknown): LuaConsoleObject[] {
  return Array.isArray(value) ? value.filter((entry): entry is LuaConsoleObject => (
    Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
  )) : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
