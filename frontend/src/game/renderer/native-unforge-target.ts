import { nativeUiRecord } from '../native-ui/core.ts'
import { hubUnforgeTargetTint } from './hub-inventory-render-contract.ts'

export const NATIVE_UNFORGE_TARGET_RECORDS = { image: 77, marker: 75, mask: 76 } as const
export const NATIVE_UNFORGE_CAPTURE_SIZE = 256

export interface NativeUnforgeTargetFrame {
  readonly anchor: readonly [x: number, y: number]
  readonly clip: readonly [left: number, top: number, width: number, height: number]
  readonly imageCenters: readonly [readonly [x: number, y: number], readonly [x: number, y: number]]
  readonly markerTint: number
  readonly records: { readonly image: 77; readonly marker: 75; readonly mask: 76 }
}

export function nativeUnforgeTargetFrame(
  applicationTick: number,
  reveal: number,
  width: number,
  height: number,
): NativeUnforgeTargetFrame {
  const center = NATIVE_UNFORGE_CAPTURE_SIZE / 2
  const [maskWidth, maskHeight] = nativeUiRecord('UI', NATIVE_UNFORGE_TARGET_RECORDS.mask).logicalSize
  const imageHeight = nativeUiRecord('UI', NATIVE_UNFORGE_TARGET_RECORDS.image).logicalSize[1]
  const scroll = Math.trunc(applicationTick / 8) % imageHeight
  return {
    anchor: [width - 38 + (1 - reveal) * 25, height - 32],
    clip: [
      Math.trunc(center - maskWidth / 2 + 0.5),
      Math.trunc(center - maskHeight / 2 + 0.5),
      maskWidth,
      maskHeight,
    ],
    imageCenters: [[center, center - scroll], [center, center + imageHeight - scroll - 1]],
    markerTint: hubUnforgeTargetTint(applicationTick),
    records: NATIVE_UNFORGE_TARGET_RECORDS,
  }
}
