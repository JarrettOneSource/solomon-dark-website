import {
  HUB_COURTYARD_SEGMENTS,
  circleOverlapsHubSegment,
  isTraversableAgainstHubSegments,
  moveWithHubSegmentsCollisionState,
  type HubCollisionMove,
  type HubSegment,
} from './hub-collision.ts'
import {
  PLAYER_CHARACTER_MOVEMENT_LANE_CAP,
  PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
  PLAYER_CHARACTER_RADIUS,
  type PlayerCharacterMovementPlan,
  type PlayerCharacterState,
} from './player-character.ts'
import type { Vector2 } from './vector.ts'

export const HUB_REGION_IDS = [
  'courtyard',
  'mortuary',
  'library',
  'storeroom',
  'office',
] as const

export type HubRegionId = typeof HUB_REGION_IDS[number]
export type HubTransitionPhase = 'outgoing' | 'incoming'

export interface HubParticipantTransition {
  alpha: number
  destination: HubRegionId
  phase: HubTransitionPhase
  scriptedSpeed: number
  scriptedTarget: Vector2
  sourceRegion: HubRegionId
}

export interface HubParticipantState {
  region: HubRegionId
  transition: HubParticipantTransition | null
}

export interface HubRegionDefinition {
  height: number
  id: HubRegionId
  nativeId: 0 | 1 | 2 | 3 | 4
  segments: readonly HubSegment[]
  width: number
}

export interface HubPortalDefinition {
  destination: HubRegionId
  preserveContactX?: true
  scriptedSpeed: number
  scriptedTarget: Vector2
  source: HubRegionId
  trigger: HubSegment
}

const MORTUARY_SEGMENT_COORDINATES = [
  [882, 908, 866, 354],
  [866, 354, 808, 346],
  [808, 346, 717, 283],
  [717, 283, 694, 241],
  [694, 241, 693, 214],
  [693, 214, 275, 213],
  [275, 213, 277, 241],
  [277, 241, 253, 282],
  [253, 282, 164, 346],
  [164, 346, 105, 360],
  [105, 360, 85, 916],
] as const

const STOREROOM_SEGMENT_COORDINATES = [
  [586, 718, 587, 614],
  [587, 614, 981, 614],
  [981, 614, 975, 508],
  [975, 508, 987, 368],
  [987, 368, 962, 360],
  [962, 360, 962, 161],
  [962, 161, 849, 156],
  [849, 156, 628, 172],
  [628, 172, 445, 164],
  [445, 164, 289, 169],
  [289, 169, 193, 158],
  [193, 158, 118, 175],
  [118, 175, 112, 344],
  [112, 344, 87, 476],
  [87, 476, 89, 617],
  [89, 617, 485, 617],
  [485, 617, 485, 714],
  [895, 525, 178, 525],
  [178, 525, 175, 483],
  [175, 483, 895, 479],
  [895, 479, 895, 525],
  [887, 403, 174, 403],
  [174, 403, 174, 367],
  [174, 367, 887, 367],
  [887, 367, 887, 403],
  [886, 296, 637, 291],
  [637, 291, 423, 290],
  [423, 290, 279, 309],
  [279, 309, 178, 305],
  [178, 305, 183, 254],
  [183, 254, 421, 255],
  [421, 255, 773, 259],
  [773, 259, 881, 253],
  [881, 253, 886, 296],
] as const

const OFFICE_SEGMENT_COORDINATES = [
  [498, 870, 496, 819],
  [496, 819, 544, 749],
  [544, 749, 698, 742],
  [698, 742, 752, 699],
  [752, 699, 751, 600],
  [751, 600, 809, 600],
  [809, 600, 808, 482],
  [808, 482, 752, 483],
  [752, 483, 700, 474],
  [700, 474, 671, 451],
  [671, 451, 633, 449],
  [633, 449, 593, 413],
  [593, 413, 552, 414],
  [552, 414, 546, 438],
  [546, 438, 523, 449],
  [523, 449, 473, 454],
  [473, 454, 447, 430],
  [447, 430, 444, 408],
  [444, 408, 381, 407],
  [381, 407, 370, 437],
  [370, 437, 341, 436],
  [341, 436, 316, 429],
  [316, 429, 266, 397],
  [266, 397, 214, 427],
  [214, 427, 185, 406],
  [185, 406, 168, 411],
  [168, 411, 168, 426],
  [168, 426, 130, 437],
  [130, 437, 80, 418],
  [80, 418, 74, 479],
  [74, 479, 10, 482],
  [10, 482, 13, 590],
  [13, 590, 65, 597],
  [65, 597, 70, 707],
  [70, 707, 123, 753],
  [123, 753, 263, 758],
  [263, 758, 314, 817],
  [314, 817, 309, 877],
  [348, 639, 487, 639],
  [487, 639, 525, 629],
  [525, 629, 536, 606],
  [536, 606, 536, 574],
  [536, 574, 523, 542],
  [523, 542, 312, 542],
  [312, 542, 300, 571],
  [300, 571, 300, 608],
  [300, 608, 314, 631],
  [314, 631, 349, 639],
] as const

const LIBRARY_SEGMENT_COORDINATES = [
  [929, 783, 921, 542],
  [921, 542, 892, 529],
  [892, 529, 812, 529],
  [812, 529, 710, 515],
  [710, 515, 659, 512],
  [659, 512, 583, 521],
  [583, 521, 582, 537],
  [582, 537, 409, 535],
  [409, 535, 407, 516],
  [407, 516, 70, 512],
  [70, 512, 63, 787],
  [63, 785, 376, 784],
  [376, 784, 376, 906],
  [930, 782, 613, 781],
  [613, 781, 612, 898],
  [826, 671, 668, 671],
  [668, 671, 668, 617],
  [668, 617, 824, 617],
  [824, 617, 824, 668],
  [320, 617, 320, 567],
  [320, 567, 166, 567],
  [166, 567, 166, 617],
  [166, 617, 320, 617],
  [301, 724, 301, 674],
  [301, 674, 145, 674],
  [145, 674, 145, 724],
  [145, 724, 301, 724],
] as const

function segments(
  values: readonly (readonly [number, number, number, number])[],
): readonly HubSegment[] {
  return values.map(([x1, y1, x2, y2]) => ({ x1, y1, x2, y2 }))
}

export const HUB_REGION_DEFINITIONS: Readonly<Record<HubRegionId, HubRegionDefinition>> = {
  courtyard: {
    height: 1024,
    id: 'courtyard',
    nativeId: 0,
    segments: HUB_COURTYARD_SEGMENTS,
    width: 2000,
  },
  mortuary: {
    height: 1024,
    id: 'mortuary',
    nativeId: 1,
    segments: segments(MORTUARY_SEGMENT_COORDINATES),
    width: 1024,
  },
  library: {
    height: 1024,
    id: 'library',
    nativeId: 2,
    segments: segments(LIBRARY_SEGMENT_COORDINATES),
    width: 1024,
  },
  storeroom: {
    height: 800,
    id: 'storeroom',
    nativeId: 3,
    segments: segments(STOREROOM_SEGMENT_COORDINATES),
    width: 1075,
  },
  office: {
    height: 1024,
    id: 'office',
    nativeId: 4,
    segments: segments(OFFICE_SEGMENT_COORDINATES),
    width: 1024,
  },
}

const COURTYARD_PORTALS: readonly HubPortalDefinition[] = [
  {
    destination: 'mortuary',
    scriptedSpeed: 0.65,
    scriptedTarget: { x: 32, y: 363 },
    source: 'courtyard',
    trigger: { x1: 179, y1: 394, x2: 33, y2: 529 },
  },
  {
    destination: 'library',
    scriptedSpeed: 0.45,
    scriptedTarget: { x: 2057.5, y: 460.5 },
    source: 'courtyard',
    trigger: { x1: 1995.5, y1: 606.5, x2: 1915.5, y2: 443.5 },
  },
  {
    destination: 'storeroom',
    scriptedSpeed: 0.45,
    scriptedTarget: { x: 627.5, y: -1000 },
    source: 'courtyard',
    trigger: { x1: 679.5, y1: 146.5, x2: 576.5, y2: 146.5 },
  },
  {
    destination: 'office',
    scriptedSpeed: 0.45,
    scriptedTarget: { x: 881.5, y: -1000 },
    source: 'courtyard',
    trigger: { x1: 1024.5, y1: 881.5, x2: 881.5, y2: 881.5 },
  },
]

function privateReturnPortal(region: Exclude<HubRegionId, 'courtyard'>): HubPortalDefinition {
  const definition = HUB_REGION_DEFINITIONS[region]
  const centerX = definition.width / 2
  const mortuary = region === 'mortuary'
  return {
    destination: 'courtyard',
    ...(mortuary ? { preserveContactX: true as const } : {}),
    scriptedSpeed: 1,
    scriptedTarget: { x: centerX, y: definition.height + 1000 },
    source: region,
    trigger: {
      x1: centerX - (mortuary ? 1000 : 100),
      y1: definition.height - (mortuary ? 60 : 100),
      x2: centerX + (mortuary ? 1000 : 100),
      y2: definition.height - (mortuary ? 60 : 100),
    },
  }
}

export const HUB_PORTALS: readonly HubPortalDefinition[] = [
  ...COURTYARD_PORTALS,
  privateReturnPortal('mortuary'),
  privateReturnPortal('library'),
  privateReturnPortal('storeroom'),
  privateReturnPortal('office'),
]

const COURTYARD_REENTRY: Readonly<Record<Exclude<HubRegionId, 'courtyard'>, {
  position: Vector2
  target: Vector2
}>> = {
  mortuary: { position: { x: 63, y: 413 }, target: { x: 123, y: 488 } },
  library: { position: { x: 1990.5, y: 504.5 }, target: { x: 1917.5, y: 563.5 } },
  storeroom: { position: { x: 627.5, y: 98.5 }, target: { x: 627.5, y: 198.5 } },
  office: { position: { x: 952.5, y: 67.5 }, target: { x: 952.5, y: 157.5 } },
}

export const HUB_OUTGOING_FADE_RATE = 0.01
export const HUB_INCOMING_FADE_RATES: Readonly<Record<HubRegionId, number>> = {
  courtyard: 0.01,
  mortuary: 0.01,
  library: 0.01,
  storeroom: 0.025,
  office: 0.01,
}

export function createHubParticipantState(): HubParticipantState {
  return { region: 'courtyard', transition: null }
}

export function hubPortalAt(
  region: HubRegionId,
  position: Vector2,
  radius = PLAYER_CHARACTER_RADIUS,
): HubPortalDefinition | undefined {
  return HUB_PORTALS.find((portal) => (
    portal.source === region
      && circleOverlapsHubSegment(position, radius, portal.trigger)
  ))
}

export function beginHubTransition(
  participant: HubParticipantState,
  portal: HubPortalDefinition,
  contactPosition: Vector2,
): HubParticipantState {
  if (participant.transition || participant.region !== portal.source) return participant
  return {
    ...participant,
    transition: {
      alpha: 0,
      destination: portal.destination,
      phase: 'outgoing',
      scriptedSpeed: portal.scriptedSpeed,
      scriptedTarget: {
        ...portal.scriptedTarget,
        ...(portal.preserveContactX ? { x: contactPosition.x } : {}),
      },
      sourceRegion: portal.source,
    },
  }
}

export function hubIncomingPlacement(
  source: HubRegionId,
  destination: HubRegionId,
): { position: Vector2; scriptedSpeed: number; scriptedTarget: Vector2 } {
  if (destination === 'courtyard') {
    if (source === 'courtyard') throw new Error('Courtyard has no same-region entrance')
    const reentry = COURTYARD_REENTRY[source]
    return {
      position: { ...reentry.position },
      scriptedSpeed: 1,
      scriptedTarget: { ...reentry.target },
    }
  }
  const definition = HUB_REGION_DEFINITIONS[destination]
  const centerX = definition.width / 2
  const mortuaryOffset = destination === 'mortuary' ? 70 : 100
  const mortuaryTargetOffset = destination === 'mortuary' ? 120 : 150
  return {
    position: { x: centerX, y: definition.height - mortuaryOffset },
    scriptedSpeed: 1,
    scriptedTarget: { x: centerX, y: definition.height - mortuaryTargetOffset },
  }
}

export function hubScriptedDelta(
  position: Vector2,
  target: Vector2,
  speed: number,
): Vector2 {
  const dx = target.x - position.x
  const dy = target.y - position.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return { x: 0, y: 0 }
  const step = Math.min(
    distance,
    speed * PLAYER_CHARACTER_MOVEMENT_LANE_CAP * PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
  )
  return { x: dx / distance * step, y: dy / distance * step }
}

export function planHubScriptedMovement(
  player: PlayerCharacterState,
  target: Vector2,
  speed: number,
): PlayerCharacterMovementPlan {
  const delta = hubScriptedDelta(player.position, target, speed)
  return {
    delta,
    movementActive: delta.x !== 0 || delta.y !== 0,
    requestedVelocity: {
      x: delta.x / PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
      y: delta.y / PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
    },
    retainedVelocity: { x: 0, y: 0 },
  }
}

export function isHubTransitionEdge(
  source: HubRegionId,
  destination: HubRegionId,
): boolean {
  return source === 'courtyard'
    ? destination !== 'courtyard'
    : destination === 'courtyard'
}

export function isHubRegionTraversable(
  region: HubRegionId,
  point: Vector2,
  radius = PLAYER_CHARACTER_RADIUS,
): boolean {
  return isTraversableAgainstHubSegments(
    point,
    radius,
    HUB_REGION_DEFINITIONS[region].segments,
  )
}

export function moveWithHubRegionCollisionState(
  region: HubRegionId,
  position: Vector2,
  delta: Vector2,
  radius: number,
  rngState: number,
): HubCollisionMove {
  return moveWithHubSegmentsCollisionState(
    position,
    delta,
    radius,
    rngState,
    HUB_REGION_DEFINITIONS[region].segments,
  )
}

export function isHubRegionId(value: string): value is HubRegionId {
  return (HUB_REGION_IDS as readonly string[]).includes(value)
}
