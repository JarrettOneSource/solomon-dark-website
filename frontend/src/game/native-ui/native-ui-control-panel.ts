import { nativeUiRecord } from './native-ui-catalog.ts'
import { nativeUiPlan, nativeUiRect, type NativeUiNode } from './native-ui-plan.ts'

/** Preserve the authored six-pixel bevel or three-pixel input recess at any size. */
export function planNativeUiControlPanel(width: number, height: number, record: 3 | 5) {
  const [sourceWidth, sourceHeight] = nativeUiRecord('ControlPanel', record).logicalSize
  const edge = record === 3 ? 6 : 3
  const sourceX = [0, edge, sourceWidth - edge, sourceWidth]
  const sourceY = [0, edge, sourceHeight - edge, sourceHeight]
  const targetX = [0, edge, width - edge, width]
  const targetY = [0, edge, height - edge, height]
  const nodes: NativeUiNode[] = []
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      nodes.push({
        atlas: 'ControlPanel',
        bounds: nativeUiRect(targetX[column]!, targetY[row]!, targetX[column + 1]! - targetX[column]!, targetY[row + 1]! - targetY[row]!),
        kind: 'slice',
        label: `control-panel:${row}:${column}`,
        record,
        sourceUv: [sourceX[column]! / sourceWidth, sourceY[row]! / sourceHeight, sourceX[column + 1]! / sourceWidth, sourceY[row + 1]! / sourceHeight],
      })
    }
  }
  return nativeUiPlan(width, height, { actions: [], nodes })
}
