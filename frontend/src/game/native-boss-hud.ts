import { measureNativeUiText, nativeUiRecord, nativeUiStripPieces, type NativeUiNode, type NativeUiPlan } from './native-ui/core.ts'

/** Game::RenderHud 0x005D257E: stock strips and wrapper-6 recipe name. */
export function nativeBossHudPlan(
  name: string,
  health: number,
  maximumHealth: number,
  viewportWidth: number,
  viewportHeight: number,
): NativeUiPlan {
  const width = measureNativeUiText(name, 'world-and-roster') + 50
  const left = (viewportWidth - width) / 2
  const top = viewportHeight - 109
  const progress = Math.max(0, Math.min(1, health / maximumHealth))
  const nodes: NativeUiNode[] = [
    ...strip(7, left - 4.5, top - 4, width + 11),
    { kind: 'clip', label: 'boss-health-fill', bounds: { left, top, width: width * progress, height: 11 },
      nodes: strip(6, left, top, width) },
    ...[[0, 1], [2, 1], [-2, 1], [0, 2], [2, 2], [-2, 2], [0, 0]].map(([x, y], index): NativeUiNode => ({
      kind: 'text', label: index === 6 ? 'boss-name' : 'boss-name-outline', text: {
        align: 'center', font: 'world-and-roster', placement: 'baseline', text: name,
        tint: index === 6 ? 0xbfbfbf : 0,
        x: viewportWidth / 2 + x, y: viewportHeight - 118 + y,
      },
    })),
  ]
  return { actions: [], height: viewportHeight, nodes, width: viewportWidth }
}

function strip(record: 6 | 7, left: number, top: number, width: number): NativeUiNode[] {
  const [, , sourceWidth, height] = nativeUiRecord('UI', record).frame
  return nativeUiStripPieces(sourceWidth, width).map(piece => ({
    atlas: 'UI', kind: 'slice', record,
    bounds: { left: left + piece.targetLeft, top, width: piece.width, height },
    sourceUv: [piece.sourceLeft / sourceWidth, 0, (piece.sourceLeft + piece.width) / sourceWidth, 1],
  }))
}
