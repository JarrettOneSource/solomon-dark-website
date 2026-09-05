import { layoutNativeUiText, measureNativeUiText, type NativeUiTextLayout } from './native-ui/core.ts'
import { NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS } from './core-kernels/native-secondary-abilities.ts'

export interface NativeBeltBindingLayout {
  advance: number
  backingLeft: number
  backingWidth: number
  text: NativeUiTextLayout
}

export interface NativeSkillQuickbarCooldownPresentation {
  capacity: number
  remaining: number
}

export const NATIVE_SKILL_QUICKBAR_READY_ALPHA = 0.75
export const NATIVE_SKILL_QUICKBAR_COOLDOWN_ALPHA = 0.25
export const NATIVE_SKILL_QUICKBAR_UNAVAILABLE_ALPHA = 0.375

export function nativeSkillQuickbarIconAlpha({
  cooldown,
  unavailable,
}: {
  readonly cooldown: boolean
  readonly unavailable: boolean
}): number {
  if (cooldown) return NATIVE_SKILL_QUICKBAR_COOLDOWN_ALPHA
  return unavailable
    ? NATIVE_SKILL_QUICKBAR_UNAVAILABLE_ALPHA
    : NATIVE_SKILL_QUICKBAR_READY_ALPHA
}

export const NATIVE_SKILL_QUICKBAR_SLOT_OFFSETS = Object.freeze([
  -332, -272, -212, -152, 98, 158, 218, 278,
])

const SLOT_SIZE = 53
const SECTOR_CENTER = SLOT_SIZE / 2

export function nativeSkillQuickbarCooldownPresentation(
  rowRemaining: number,
  rowCapacity: number,
  globalRemaining: number,
): NativeSkillQuickbarCooldownPresentation {
  if (!(rowCapacity > 0)) return { capacity: 0, remaining: 0 }
  if (rowRemaining > 0 && globalRemaining <= rowRemaining) {
    return { capacity: rowCapacity, remaining: rowRemaining }
  }
  return {
    capacity: NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS,
    remaining: Math.max(0, globalRemaining),
  }
}

export function layoutNativeQuickbarBinding(text: string): NativeBeltBindingLayout {
  const advance = measureNativeUiText(text, 'belt')
  const backingWidth = advance + 6
  return {
    advance,
    backingLeft: (SLOT_SIZE - backingWidth) / 2,
    backingWidth,
    text: layoutNativeUiText({ align: 'center', font: 'belt', text, tint: 0x000000, x: SECTOR_CENTER, y: 64 }),
  }
}

export function nativeCooldownSectorPath(remaining: number, capacity: number): string {
  if (!(remaining > 0) || !(capacity > 0)) return ''
  const ratio = Math.min(1, remaining / capacity)
  const startDegrees = 360 * (1 - ratio)
  const perimeter = [squareRayPoint(startDegrees)]
  for (
    let boundary = (Math.floor(startDegrees / 45) + 1) * 45;
    boundary <= 360;
    boundary += 45
  ) {
    perimeter.push(squareRayPoint(boundary))
  }
  return [
    `M ${formatCoordinate(SECTOR_CENTER)} ${formatCoordinate(SECTOR_CENTER)}`,
    ...perimeter.map(({ x, y }) => `L ${formatCoordinate(x)} ${formatCoordinate(y)}`),
    'Z',
  ].join(' ')
}

function squareRayPoint(degrees: number): { x: number; y: number } {
  const radians = degrees * Math.PI / 180
  const dx = Math.cos(radians)
  const dy = -Math.sin(radians)
  const scale = SECTOR_CENTER / Math.max(Math.abs(dx), Math.abs(dy))
  return {
    x: SECTOR_CENTER + dx * scale,
    y: SECTOR_CENTER + dy * scale,
  }
}

function formatCoordinate(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000
  return Object.is(rounded, -0) ? '0' : `${rounded}`
}
