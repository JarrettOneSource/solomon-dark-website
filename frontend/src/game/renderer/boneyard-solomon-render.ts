import type { SolomonDigState } from '../core-kernels/boneyard.ts'
import type { BoneyardSolomonSnapshot } from '../protocol/game-state.ts'
import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'
import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'

export type BoneyardSolomonBodyBank = 'dig' | 'dialogue' | 'walk'

export interface BoneyardSolomonVisualState {
  bodyBank: BoneyardSolomonBodyBank
  bodyPose: number
  clipBottomWorldY: number | null
  direction: number
  mouthPose: number | null
  nativeBodyRecord: number
  nativeMouthRecord: number | null
  offsetY: number
  graveMarkVisible: boolean
  visible: boolean
}

const DIRECTION_COUNT = 15
const DIRECTION_ARC_DEGREES = 24
const DIRECTION_HALF_ARC_DEGREES = 12
const DIALOGUE_BODY_RECORD = 213
const DIALOGUE_MOUTH_RECORD = 228
const DIG_RECORD = 2
const WALK_RECORD = 95
const WALK_POSE_COUNT = 6

export function boneyardSolomonPainterLayers(
  dig: SolomonDigState,
  encounter: BoneyardSolomonSnapshot | null,
  lanternRegistration: NativeWorldManagerRegistration,
  solomonRegistration: NativeWorldManagerRegistration,
): readonly DynamicPainterLayer[] {
  const layers: DynamicPainterLayer[] = [{
    id: 'lantern',
    queueFamily: 'ordinary-dynamic',
    registration: lanternRegistration,
    worldY: dig.lanternPosition.y,
    sortBias: 0,
  }]
  if (encounter?.phase !== 'gone') {
    layers.push({
      id: 'solomon-actor',
      queueFamily: 'ordinary-dynamic',
      registration: solomonRegistration,
      worldY: encounter?.position.y ?? dig.position.y,
      sortBias: 0,
    })
  }
  return layers
}

export function nativeSolomonDirection(headingDeg: number): number {
  const normalized = ((headingDeg % 360) + 360) % 360
  return Math.trunc(
    (normalized + DIRECTION_HALF_ARC_DEGREES) / DIRECTION_ARC_DEGREES,
  ) % DIRECTION_COUNT
}

export function boneyardSolomonVisualState(
  encounter: BoneyardSolomonSnapshot,
  dig: SolomonDigState,
  _tick: number,
): BoneyardSolomonVisualState {
  const direction = nativeSolomonDirection(encounter.headingDeg)
  if (encounter.phase === 'digging') {
    const bodyPose = encounter.digFrame
    return {
      bodyBank: 'dig',
      bodyPose,
      clipBottomWorldY: null,
      direction,
      mouthPose: null,
      nativeBodyRecord: DIG_RECORD + bodyPose,
      nativeMouthRecord: null,
      offsetY: encounter.digBodyOffsetY,
      graveMarkVisible: true,
      visible: true,
    }
  }
  if (encounter.phase === 'turning'
    || encounter.phase === 'speaking'
    || encounter.phase === 'retreat-hold') {
    return {
      bodyBank: 'dialogue',
      bodyPose: 0,
      clipBottomWorldY: dig.position.y,
      direction,
      mouthPose: encounter.mouthPose,
      nativeBodyRecord: DIALOGUE_BODY_RECORD + direction,
      nativeMouthRecord: DIALOGUE_MOUTH_RECORD
        + encounter.mouthPose * DIRECTION_COUNT
        + direction,
      offsetY: encounter.transitionOffsetY + encounter.motion,
      graveMarkVisible: true,
      visible: true,
    }
  }
  if (encounter.phase === 'retreat-accelerating') {
    return walkVisual(
      direction,
      0,
      encounter.motion,
      encounter.acceleration < 0 ? dig.position.y : null,
    )
  }
  if (encounter.phase === 'escaping') {
    return walkVisual(
      direction,
      Math.trunc(encounter.walkCycle) % WALK_POSE_COUNT,
      encounter.motion,
      null,
    )
  }
  return {
    bodyBank: 'walk',
    bodyPose: 0,
    clipBottomWorldY: null,
    direction,
    mouthPose: null,
    nativeBodyRecord: WALK_RECORD + direction,
    nativeMouthRecord: null,
    offsetY: 0,
    graveMarkVisible: false,
    visible: false,
  }
}

function walkVisual(
  direction: number,
  bodyPose: number,
  offsetY: number,
  clipBottomWorldY: number | null,
): BoneyardSolomonVisualState {
  return {
    bodyBank: 'walk',
    bodyPose,
    clipBottomWorldY,
    direction,
    mouthPose: null,
    nativeBodyRecord: WALK_RECORD + bodyPose * DIRECTION_COUNT + direction,
    nativeMouthRecord: null,
    offsetY,
    graveMarkVisible: false,
    visible: true,
  }
}
