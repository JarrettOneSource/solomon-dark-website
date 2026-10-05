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
  throw new Error(`Unforge scrolling presentation is not implemented (${applicationTick}, ${reveal}, ${width}, ${height})`)
}
