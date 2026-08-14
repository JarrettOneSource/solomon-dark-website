import {
  HUB_PRIVATE_ROOM_LAYOUTS,
  type PrivateHubRegionId,
} from '../core-kernels/hub-private-room-layout.ts'
import type { Vector2 } from '../core-kernels/vector.ts'

export const HUB_PRIVATE_ROOM_EFFECT_DEPTH = 1_000_000
export const HUB_PRIVATE_ROOM_LATE_FOREGROUND_DEPTH = 2_000_000

export const HUB_LIBRARY_EXIT_MASKS = [
  { height: 121, width: 381, x: 16, y: 801 },
  { height: 121, width: 381, x: 627, y: 801 },
] as const

export const HUB_PRIVATE_ROOM_FLAME_ANCHORS: Readonly<
  Record<PrivateHubRegionId, readonly Vector2[]>
> = {
  mortuary: [
    { x: 190.5, y: 307.5 }, { x: 196.5, y: 303.5 }, { x: 205.5, y: 296.5 },
    { x: 213.5, y: 290.5 }, { x: 221.5, y: 284.5 }, { x: 236.5, y: 273.5 },
    { x: 242.5, y: 268.5 }, { x: 251.5, y: 262.5 }, { x: 274.5, y: 245.5 },
    { x: 263.5, y: 234.5 }, { x: 255.5, y: 240.5 }, { x: 247.5, y: 245.5 },
    { x: 240.5, y: 251.5 }, { x: 225.5, y: 260.5 }, { x: 202.5, y: 279.5 },
    { x: 195.5, y: 285.5 }, { x: 167.5, y: 286.5 }, { x: 175.5, y: 279.5 },
    { x: 192.5, y: 267.5 }, { x: 213.5, y: 252.5 }, { x: 222.5, y: 245.5 },
    { x: 236.5, y: 234.5 }, { x: 245.5, y: 228.5 }, { x: 251.5, y: 224.5 },
    { x: 748.5, y: 246.5 }, { x: 757.5, y: 252.5 }, { x: 766.5, y: 257.5 },
    { x: 773.5, y: 263.5 }, { x: 789.5, y: 274.5 }, { x: 812.5, y: 290.5 },
    { x: 819.5, y: 296.5 }, { x: 829.5, y: 301.5 }, { x: 837.5, y: 305.5 },
    { x: 847.5, y: 294.5 }, { x: 839.5, y: 290.5 }, { x: 830.5, y: 284.5 },
    { x: 823.5, y: 279.5 }, { x: 814.5, y: 273.5 }, { x: 807.5, y: 267.5 },
    { x: 798.5, y: 263.5 }, { x: 792.5, y: 257.5 }, { x: 784.5, y: 252.5 },
    { x: 775.5, y: 246.5 }, { x: 760.5, y: 236.5 }, { x: 769.5, y: 223.5 },
    { x: 777.5, y: 229.5 }, { x: 802.5, y: 245.5 }, { x: 817.5, y: 256.5 },
    { x: 832.5, y: 267.5 }, { x: 841.5, y: 271.5 },
  ],
  storeroom: [
    { x: 588, y: 489.5 }, { x: 561, y: 478.5 }, { x: 421, y: 518.5 },
    { x: 391, y: 536.5 }, { x: 337, y: 303.5 }, { x: 391, y: 285.5 },
    { x: 570, y: 293.5 }, { x: 611, y: 284.5 }, { x: 831, y: 419.5 },
  ],
  library: [
    { x: 464, y: 549.5 }, { x: 539, y: 553.5 }, { x: 566, y: 544.5 },
    { x: 917, y: 465.5 }, { x: 920, y: 481.5 }, { x: 923, y: 640.5 },
    { x: 925, y: 655.5 }, { x: 801, y: 690.5 }, { x: 729, y: 705.5 },
    { x: 289, y: 745.5 }, { x: 225, y: 755.5 }, { x: 292, y: 653.5 },
    { x: 220, y: 637.5 }, { x: 106, y: 465.5 }, { x: 104, y: 481.5 },
    { x: 101, y: 639.5 }, { x: 99, y: 656.5 },
  ],
  office: [
    { x: 588.5, y: 448.5 }, { x: 547.5, y: 422.5 }, { x: 507.5, y: 424.5 },
    { x: 445.5, y: 437.5 }, { x: 324.5, y: 434.5 }, { x: 293.5, y: 446.5 },
    { x: 317.5, y: 470.5 },
  ],
}

export interface HubRoomFlameTransform {
  rotation: number
  scaleX: 0.8
  scaleY: number
}

const REGION_SEEDS: Readonly<Record<PrivateHubRegionId, number>> = {
  mortuary: 0x2f6e2b1,
  storeroom: 0x4af41d3,
  library: 0x6c8e9cf,
  office: 0x8dbca55,
}

export function hubMemoratorHeadingIndex(playerPosition: Vector2): number {
  const memoratorPosition = HUB_PRIVATE_ROOM_LAYOUTS.mortuary.actors.memorator.visual.position
  const radians = Math.atan2(
    playerPosition.x - memoratorPosition.x,
    -(playerPosition.y - memoratorPosition.y),
  )
  const heading = (radians + Math.PI * 2) % (Math.PI * 2)
  return Math.round(heading / (Math.PI * 2) * 16) % 16
}

export function hubRoomFlameTransform(
  region: PrivateHubRegionId,
  tick: number,
  index: number,
): HubRoomFlameTransform {
  const minimumScaleY = region === 'mortuary' ? 0.7 : 0.8
  const scaleRange = region === 'mortuary' ? 0.2 : 0.4
  const scaleY = minimumScaleY + unitSample(region, tick, index, 0) * scaleRange
  const rotationDegrees = -5 + unitSample(region, tick, index, 1) * 10
  return {
    rotation: rotationDegrees * Math.PI / 180,
    scaleX: 0.8,
    scaleY,
  }
}

function unitSample(
  region: PrivateHubRegionId,
  tick: number,
  index: number,
  lane: number,
): number {
  let value = (
    Math.floor(tick)
    ^ REGION_SEEDS[region]
    ^ Math.imul(index + 1, 0x9e3779b1)
    ^ Math.imul(lane + 1, 0x85ebca6b)
  ) >>> 0
  value = Math.imul(value ^ value >>> 16, 0x7feb352d)
  value = Math.imul(value ^ value >>> 15, 0x846ca68b)
  value = (value ^ value >>> 16) >>> 0
  return value / 0x1_0000_0000
}
