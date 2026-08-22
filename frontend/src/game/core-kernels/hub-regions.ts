import {
  HUB_COURTYARD_SEGMENTS,
  circleTouchesHubSegment,
  isPathTraversableAgainstHubSegments,
  isTraversableAgainstHubSegments,
  moveWithHubSegmentsCollisionState,
  type HubCollisionMove,
  type HubSegment,
} from './hub-collision.ts'
import {
  HUB_PRIVATE_ROOM_LAYOUTS,
  type PrivateHubRegionId,
} from './hub-private-room-layout.ts'
import {
  PLAYER_CHARACTER_MOVEMENT_LANE_CAP,
  PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
  PLAYER_CHARACTER_RADIUS,
  type PlayerCharacterMovementPlan,
  type PlayerCharacterState,
} from './player-character.ts'
import type { Vector2 } from './vector.ts'
import {
  lineSegmentObstruction,
  nearerLineObstruction,
} from './line-obstruction.ts'

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

function privateRoomDefinition(region: PrivateHubRegionId): HubRegionDefinition {
  const layout = HUB_PRIVATE_ROOM_LAYOUTS[region]
  return {
    height: layout.height,
    id: region,
    nativeId: layout.nativeId,
    segments: layout.architecture.collider.segments,
    width: layout.width,
  }
}

export const HUB_REGION_DEFINITIONS: Readonly<Record<HubRegionId, HubRegionDefinition>> = {
  courtyard: {
    height: 1024,
    id: 'courtyard',
    nativeId: 0,
    segments: HUB_COURTYARD_SEGMENTS,
    width: 2000,
  },
  mortuary: privateRoomDefinition('mortuary'),
  library: privateRoomDefinition('library'),
  storeroom: privateRoomDefinition('storeroom'),
  office: privateRoomDefinition('office'),
}

export function firstHubRegionLineObstruction(
  region: HubRegionId,
  start: Vector2,
  end: Vector2,
): Vector2 | null {
  let nearest = null
  for (const segment of HUB_REGION_DEFINITIONS[region].segments) {
    nearest = nearerLineObstruction(nearest, lineSegmentObstruction(
      start,
      end,
      { x: segment.x1, y: segment.y1 },
      { x: segment.x2, y: segment.y2 },
    ))
  }
  return nearest?.point ?? null
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
    trigger: { x1: 1024.5, y1: 115.5, x2: 881.5, y2: 115.5 },
  },
]

function privateReturnPortal(region: PrivateHubRegionId): HubPortalDefinition {
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

const COURTYARD_REENTRY: Readonly<Record<PrivateHubRegionId, {
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
      && circleTouchesHubSegment(position, radius, portal.trigger)
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

export function isHubRegionPathTraversable(
  region: HubRegionId,
  start: Vector2,
  end: Vector2,
  radius: number,
): boolean {
  return isPathTraversableAgainstHubSegments(
    start,
    end,
    radius,
    HUB_REGION_DEFINITIONS[region].segments,
  )
}

export function clipHubRegionSegment(
  region: HubRegionId,
  start: Vector2,
  end: Vector2,
): Vector2 {
  return firstHubRegionLineObstruction(region, start, end) ?? { ...end }
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
