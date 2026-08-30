export interface NativeHubCollegeObstacleDefinition {
  readonly id: NativeHubCourtyardObstaclePainterId
  readonly position: Readonly<{ x: number; y: number }>
  readonly radius: 40
  readonly records: readonly number[]
  readonly selector: number
  readonly sortBias: 0
}

export const NATIVE_HUB_COURTYARD_OBSTACLE_PAINTER_IDS = [
  'college-obstacle-0',
  'college-obstacle-1',
  'college-obstacle-2',
  'college-obstacle-3',
  'college-obstacle-4',
  'college-obstacle-5',
  'college-obstacle-6',
  'college-obstacle-7',
] as const

export type NativeHubCourtyardObstaclePainterId =
  typeof NATIVE_HUB_COURTYARD_OBSTACLE_PAINTER_IDS[number]

export const NATIVE_HUB_COURTYARD_OBSTACLES = Object.freeze([
  {
    id: 'college-obstacle-0',
    position: { x: 1458.5, y: 320.5 },
    radius: 40,
    records: Object.freeze(Array.from({ length: 12 }, (_, index) => 148 + index)),
    selector: 0,
    sortBias: 0,
  },
  {
    id: 'college-obstacle-1',
    position: { x: 955.5, y: 239.5 },
    radius: 40,
    records: Object.freeze([25]),
    selector: 1,
    sortBias: 0,
  },
  {
    id: 'college-obstacle-2',
    position: { x: 749.5, y: 162.5 },
    radius: 40,
    records: Object.freeze([23]),
    selector: 2,
    sortBias: 0,
  },
  {
    id: 'college-obstacle-3',
    position: { x: 1893, y: 490 },
    radius: 40,
    records: Object.freeze([28]),
    selector: 3,
    sortBias: 0,
  },
  {
    id: 'college-obstacle-4',
    position: { x: 1746, y: 534 },
    radius: 40,
    records: Object.freeze([29]),
    selector: 4,
    sortBias: 0,
  },
  {
    id: 'college-obstacle-5',
    position: { x: 1840, y: 715 },
    radius: 40,
    records: Object.freeze([27]),
    selector: 5,
    sortBias: 0,
  },
  {
    id: 'college-obstacle-6',
    position: { x: 628, y: 215 },
    radius: 40,
    records: Object.freeze([20]),
    selector: 6,
    sortBias: 0,
  },
  {
    id: 'college-obstacle-7',
    position: { x: 956, y: 169 },
    radius: 40,
    records: Object.freeze([24]),
    selector: 7,
    sortBias: 0,
  },
] as const satisfies readonly NativeHubCollegeObstacleDefinition[])

export const NATIVE_HUB_COLLEGE_STATUE = Object.freeze({
  id: 'college-statue',
  position: Object.freeze({ x: 961, y: 834 }),
  radius: 50,
  sortBias: 0,
} as const)

export const NATIVE_HUB_NORTH_ARCH_BIAS_RECT = Object.freeze({
  bottom: 181,
  left: 874,
  right: 1031,
  top: 34,
} as const)

export function nativeCourtyardPlayerSortBias(
  position: Readonly<{ x: number; y: number }>,
  headingIndex: number,
): -20 | 0 | 20 {
  if (
    position.x <= NATIVE_HUB_NORTH_ARCH_BIAS_RECT.left
    || position.x >= NATIVE_HUB_NORTH_ARCH_BIAS_RECT.right
    || position.y <= NATIVE_HUB_NORTH_ARCH_BIAS_RECT.top
    || position.y >= NATIVE_HUB_NORTH_ARCH_BIAS_RECT.bottom
  ) return 0
  const normalizedHeading = ((headingIndex % 24) + 24) % 24
  return normalizedHeading === 0 || normalizedHeading === 12 || normalizedHeading === 23
    ? -20
    : 20
}

export const NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS = Object.freeze([
  'hagatha',
  'fomentius',
  'annalist',
  'luthacus',
  'skorcha',
  'teacher',
  ...NATIVE_HUB_COURTYARD_OBSTACLE_PAINTER_IDS,
  'college-statue',
  'memorator',
  'mortuary-painting-0',
  'mortuary-painting-1',
  'mortuary-painting-100',
  'mortuary-painting-3',
  'mortuary-painting-4',
  'mortuary-painting-5',
  'mortuary-painting-6',
  'mortuary-painting-7',
  'mortuary-painting-8',
  'mortuary-painting-9',
  'mortuary-custom-0',
  'mortuary-custom-1',
  'mortuary-custom-2',
  'mortuary-custom-3',
  'mortuary-custom-4',
  'mortuary-custom-5',
  'mortuary-custom-6',
  'mortuary-custom-7',
  'mortuary-custom-8',
  'mortuary-custom-9',
  'library-custom-0',
  'library-custom-1',
  'library-custom-2',
  'library-custom-100',
  'librarian',
  'shlorio',
  'storeroom-custom-0',
  'storeroom-custom-1',
  'storeroom-custom-2',
  'office-custom-0',
  'arch-chancellor',
  'polisher',
] as const)

export type NativeHubFixedActorPainterId =
  typeof NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS[number]
