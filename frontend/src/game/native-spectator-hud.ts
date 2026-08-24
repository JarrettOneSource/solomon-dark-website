import { nativeUiRecord } from './native-ui/native-ui-catalog.ts'
import { NATIVE_UI_MESSAGE } from './native-ui/native-ui-plan.ts'

const HORIZONTAL_RAIL = nativeUiRecord('UI', NATIVE_UI_MESSAGE.horizontalEdgeRecord)
const VERTICAL_RAIL = nativeUiRecord('UI', NATIVE_UI_MESSAGE.verticalEdgeRecord)

export const NATIVE_SPECTATOR_HUD_CONTRACT = Object.freeze({
  font: 'medium' as const,
  horizontalRail: Object.freeze({
    height: HORIZONTAL_RAIL.logicalSize[1],
    record: NATIVE_UI_MESSAGE.horizontalEdgeRecord,
    width: HORIZONTAL_RAIL.logicalSize[0],
  }),
  panelRecords: Object.freeze([
    NATIVE_UI_MESSAGE.horizontalEdgeRecord,
    NATIVE_UI_MESSAGE.verticalEdgeRecord,
    ...NATIVE_UI_MESSAGE.cornerRecords,
  ]),
  surface: Object.freeze({ height: 0.075, width: 0.60, x: 0.20, y: 0.055 }),
  textOffset: Object.freeze({ x: 18, y: 20 }),
  tint: 0xffe68c,
  verticalRail: Object.freeze({
    height: VERTICAL_RAIL.logicalSize[1],
    record: NATIVE_UI_MESSAGE.verticalEdgeRecord,
    width: VERTICAL_RAIL.logicalSize[0],
  }),
})

interface ViewportSize {
  readonly height: number
  readonly width: number
}

interface NativeSpectatorHudRail {
  readonly height: number
  readonly record: number
  readonly width: number
  readonly x: number
  readonly y: number
}

interface NativeSpectatorHudCorner {
  readonly centerX: number
  readonly centerY: number
  readonly record: number
}

export interface NativeSpectatorHudLayout {
  readonly corners: readonly NativeSpectatorHudCorner[]
  readonly horizontalRails: readonly NativeSpectatorHudRail[]
  readonly surface: Readonly<{ height: number; width: number; x: number; y: number }>
  readonly text: Readonly<{ x: number; y: number }>
  readonly verticalRails: readonly NativeSpectatorHudRail[]
}

export function nativeSpectatorHudLayout(
  viewport: ViewportSize,
): NativeSpectatorHudLayout {
  if (
    !Number.isFinite(viewport.width)
    || !Number.isFinite(viewport.height)
    || viewport.width <= 0
    || viewport.height <= 0
  ) throw new RangeError('spectator HUD viewport must be positive and finite')

  const surface = {
    height: viewport.height * NATIVE_SPECTATOR_HUD_CONTRACT.surface.height,
    width: viewport.width * NATIVE_SPECTATOR_HUD_CONTRACT.surface.width,
    x: viewport.width * NATIVE_SPECTATOR_HUD_CONTRACT.surface.x,
    y: viewport.height * NATIVE_SPECTATOR_HUD_CONTRACT.surface.y,
  }
  return Object.freeze({
    corners: Object.freeze([
      { centerX: 37, centerY: 37, record: NATIVE_UI_MESSAGE.cornerRecords[0] },
      {
        centerX: surface.width - 37,
        centerY: 37,
        record: NATIVE_UI_MESSAGE.cornerRecords[1],
      },
      {
        centerX: 37,
        centerY: surface.height - 37,
        record: NATIVE_UI_MESSAGE.cornerRecords[2],
      },
      {
        centerX: surface.width - 37,
        centerY: surface.height - 37,
        record: NATIVE_UI_MESSAGE.cornerRecords[3],
      },
    ]),
    horizontalRails: Object.freeze([
      {
        height: NATIVE_SPECTATOR_HUD_CONTRACT.horizontalRail.height,
        record: NATIVE_UI_MESSAGE.horizontalEdgeRecord,
        width: surface.width - 20,
        x: 10,
        y: -2,
      },
      {
        height: NATIVE_SPECTATOR_HUD_CONTRACT.horizontalRail.height,
        record: NATIVE_UI_MESSAGE.horizontalEdgeRecord,
        width: surface.width - 20,
        x: 10,
        y: surface.height - 15,
      },
    ]),
    surface: Object.freeze(surface),
    text: NATIVE_SPECTATOR_HUD_CONTRACT.textOffset,
    verticalRails: Object.freeze([
      {
        height: surface.height - 20,
        record: NATIVE_UI_MESSAGE.verticalEdgeRecord,
        width: NATIVE_SPECTATOR_HUD_CONTRACT.verticalRail.width,
        x: 0,
        y: 10,
      },
      {
        height: surface.height - 20,
        record: NATIVE_UI_MESSAGE.verticalEdgeRecord,
        width: NATIVE_SPECTATOR_HUD_CONTRACT.verticalRail.width,
        x: surface.width - 17,
        y: 10,
      },
    ]),
  })
}
