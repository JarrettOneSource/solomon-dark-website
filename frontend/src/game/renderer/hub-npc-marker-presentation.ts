import {
  NATIVE_HUB_HELP_ROW_COUNT,
  NATIVE_HUB_NPC_CATALOG,
  type NativeHubInteractionId,
  type NativeHubNpcMarkerSide,
  type NativeHubNpcMarkerStyle,
} from '../core-kernels/native-hub-npc.ts'
import {
  createNativeRng,
  drawNativeInteger,
} from '../core-kernels/native-rng.ts'
import type { HubRegionId } from '../core-kernels/hub-regions.ts'
import type { Vector2 } from '../core-kernels/vector.ts'

export type HubNpcMarkerSurface = 'dialogue' | 'inventory' | 'modal' | 'service' | null
export type HubNpcMarkerSuppression = readonly [boolean, boolean, boolean]

export interface HubNpcMarkerFrame {
  readonly alpha: number
  readonly interactionId: NativeHubInteractionId
  readonly phaseDegrees: number
  readonly position: Vector2
  readonly record: number
  readonly region: HubRegionId
  readonly side: NativeHubNpcMarkerSide
  readonly style: NativeHubNpcMarkerStyle
  readonly visible: boolean
}

export type HubNpcOnboardingPlan =
  | {
      readonly arrowOffset: Vector2
      readonly arrowRecord: number
      readonly arrowRotationDegrees: number
      readonly kind: 'walk-to-talk'
      readonly target: NativeHubInteractionId
      readonly text: string
      readonly textOffset: Vector2
    }
  | {
      readonly kind: 'directional'
      readonly offset: Vector2
      readonly record: number
      readonly target: NativeHubInteractionId
    }

export function captureHubNpcMarkerSuppression(
  helpFlags: readonly boolean[],
): HubNpcMarkerSuppression {
  if (
    helpFlags.length !== NATIVE_HUB_HELP_ROW_COUNT
    || helpFlags.some(value => typeof value !== 'boolean')
  ) throw new RangeError('native Hub help flags must contain ten boolean rows')
  return [helpFlags[0]!, helpFlags[1]!, helpFlags[2]!]
}

export function hubNpcMarkerFrame(
  interactionId: NativeHubInteractionId,
  tick: number,
  seed: number,
  suppression: HubNpcMarkerSuppression,
  options: {
    readonly skorchaPosition?: Vector2 | null
    readonly skorchaVariant?: number | null
    readonly surface?: HubNpcMarkerSurface
  } = {},
): HubNpcMarkerFrame {
  const actor = NATIVE_HUB_NPC_CATALOG.markers.actors.find(
    candidate => candidate.interactionId === interactionId,
  )
  if (!actor) throw new RangeError(`interaction ${interactionId} has no native actor marker`)
  const skorchaPresent = interactionId !== 'skorcha' || options.skorchaPosition != null
  const mirroredSkorcha = interactionId === 'skorcha' && options.skorchaVariant === 1
  const side = mirroredSkorcha ? 'left' : actor.side
  const record = mirroredSkorcha ? actor.record + 1 : actor.record
  const actorPosition = interactionId === 'skorcha' && options.skorchaPosition
    ? options.skorchaPosition
    : NATIVE_HUB_NPC_CATALOG.interactions[interactionId].geometry.position
  const common = NATIVE_HUB_NPC_CATALOG.markers.common
  const initialPhase = markerInitialPhase(seed, actor.typeId, common.phaseDrawCount)
  const fixedTick = Math.max(0, Math.floor(tick))
  const phaseDegrees = initialPhase + (actor.phaseAdvances ? fixedTick : 0)
  const radians = phaseDegrees * Math.PI / 180
  const profileSuppressed = actor.profileHintIndex !== null
    && suppression[actor.profileHintIndex] === true
  const surface = options.surface ?? null
  return {
    alpha: Math.sin(radians) * common.alphaAmplitude + common.alphaBase,
    interactionId,
    phaseDegrees,
    position: {
      x: actorPosition.x + (side === 'right' ? common.rootOffsetX : -common.rootOffsetX),
      y: actorPosition.y + common.rootOffsetY,
    },
    record,
    region: actor.region,
    side,
    style: actor.style,
    visible: skorchaPresent
      && !profileSuppressed
      && (surface === null || surface === 'dialogue'),
  }
}

export function hubStoryOfficePolisherMarkerFrame(
  tick: number,
  seed: number,
  surface: HubNpcMarkerSurface,
): Pick<HubNpcMarkerFrame, 'alpha' | 'phaseDegrees' | 'position' | 'record' | 'visible'> {
  const common = NATIVE_HUB_NPC_CATALOG.markers.common
  const actor = NATIVE_HUB_NPC_CATALOG.storyOffice.interactions.polisher
  const phaseDegrees = markerInitialPhase(seed, 5011, common.phaseDrawCount)
    + Math.max(0, Math.floor(tick))
  return {
    alpha: Math.sin(phaseDegrees * Math.PI / 180)
      * common.alphaAmplitude
      + common.alphaBase,
    phaseDegrees,
    position: {
      x: actor.geometry.position.x - common.rootOffsetX,
      y: actor.geometry.position.y + common.rootOffsetY,
    },
    record: 14,
    visible: surface === null || surface === 'dialogue',
  }
}

export function hubNpcOnboardingPlan(
  helpFlags: readonly boolean[],
  tick: number,
  surface: HubNpcMarkerSurface,
): readonly HubNpcOnboardingPlan[] {
  captureHubNpcMarkerSuppression(helpFlags)
  if (surface !== null) return []
  const walkToTalk = NATIVE_HUB_NPC_CATALOG.markers.walkToTalk
  if (helpFlags[walkToTalk.profileHintIndex]) {
    return [{
      arrowOffset: { ...walkToTalk.arrowOffset },
      arrowRecord: walkToTalk.arrowRecord,
      arrowRotationDegrees: walkToTalk.arrowRotationDegrees,
      kind: 'walk-to-talk',
      target: walkToTalk.target,
      text: walkToTalk.text,
      textOffset: { ...walkToTalk.textOffset },
    }]
  }
  const directional = NATIVE_HUB_NPC_CATALOG.markers.directionalHints
  const phase = ((Math.floor(tick) % directional.blinkPeriodTicks)
    + directional.blinkPeriodTicks) % directional.blinkPeriodTicks
  if (phase <= directional.visibleAfterTick) return []
  return directional.targets.flatMap(target => (
    helpFlags[target.profileHintIndex]
      ? [{
          kind: 'directional' as const,
          offset: { ...target.offset },
          record: directional.record,
          target: target.interactionId,
        }]
      : []
  ))
}

export function hubNpcDirectionalHintFrame(
  target: Vector2,
  viewport: { readonly height: number; readonly width: number },
): { readonly position: Vector2; readonly rotationRadians: number } {
  const halfWidth = 58
  const halfHeight = 64
  const position = {
    x: Math.min(viewport.width - halfWidth, Math.max(halfWidth, target.x)),
    y: Math.min(viewport.height - halfHeight, Math.max(halfHeight, target.y)),
  }
  return {
    position,
    rotationRadians: Math.atan2(target.y - position.y, target.x - position.x),
  }
}

function markerInitialPhase(seed: number, typeId: number, drawCount: number): number {
  const actorSeed = (seed ^ Math.imul(typeId, 0x9e3779b1)) >>> 0
  return drawNativeInteger(createNativeRng(actorSeed), drawCount).value
}
