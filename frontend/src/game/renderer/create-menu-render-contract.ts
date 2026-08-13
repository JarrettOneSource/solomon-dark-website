import type {
  WizardDiscipline,
  WizardElement,
} from '../core-kernels/player-character.ts'

export const CREATE_RENDER_WIDTH = 1600
export const CREATE_RENDER_HEIGHT = 900

export const CREATE_HAND_SIZE = { height: 703.5, width: 630 } as const
export const CREATE_HAND_CENTERS = {
  left: { x: 400, y: 560 },
  right: { x: 1200, y: 560 },
} as const

export const CREATE_ELEMENTS = ['earth', 'ether', 'fire', 'water', 'air'] as const
export const CREATE_DISCIPLINES = ['arcane', 'body', 'mind'] as const

export const CREATE_ELEMENT_SIZE: Readonly<Record<WizardElement, {
  height: number
  width: number
}>> = {
  air: { height: 80, width: 96 },
  earth: { height: 84, width: 150 },
  ether: { height: 84, width: 150 },
  fire: { height: 85, width: 116 },
  water: { height: 77, width: 157 },
}

export const CREATE_DISCIPLINE_SIZE: Readonly<Record<WizardDiscipline, {
  height: number
  width: number
}>> = {
  arcane: { height: 238, width: 218 },
  body: { height: 229, width: 238 },
  mind: { height: 241, width: 227 },
}

export const CREATE_STARS = Array.from({ length: 50 }, (_, index) => ({
  delayMs: ((index * 0.067) % 1.25) * 1000,
  durationMs: (2.6 + (index * 0.19) % 2.1) * 1000,
  large: index % 5 === 0,
  scale: 0.55 + (index * 0.23) % 0.9,
  x: ((11 + index * 37) % 98) / 100 * CREATE_RENDER_WIDTH,
  y: ((5 + index * 29) % 92) / 100 * CREATE_RENDER_HEIGHT,
}))

export function createEntryFlashAlpha(elapsedMs: number): number {
  const progress = clamp01(elapsedMs / 1400)
  if (progress <= 0.9) return 0
  if (progress <= 0.957) return 0.82 * (progress - 0.9) / 0.057
  return 0.82 * (1 - progress) / 0.043
}

export function createSelectionFlashAlpha(elapsedMs: number): number {
  const progress = clamp01(elapsedMs / 1680)
  if (progress <= 0.08) return 0.78 * (1 - progress / 0.08)
  if (progress <= 0.92) return 0
  if (progress <= 0.976) return 0.82 * (progress - 0.92) / 0.056
  return 0.82 * (1 - progress) / 0.024
}

export function createStarPresentation(
  star: (typeof CREATE_STARS)[number],
  elapsedMs: number,
): { alpha: number; scale: number; y: number; visible: boolean } {
  const progress = (elapsedMs - star.delayMs) / star.durationMs
  if (progress < 0 || progress > 1) {
    return { alpha: 0, scale: star.scale, visible: false, y: star.y - 117 }
  }
  const alpha = progress < 0.12
    ? 0.78 * progress / 0.12
    : progress < 0.52
      ? 0.78 + (0.34 - 0.78) * (progress - 0.12) / 0.4
      : 0.34 * (1 - progress) / 0.48
  return {
    alpha,
    scale: star.scale * (1 + progress * 0.1),
    visible: true,
    y: star.y - 117 + progress * 396,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
