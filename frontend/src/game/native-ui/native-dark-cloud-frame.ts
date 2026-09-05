import {
  nativeUiPlan,
  nativeUiRect,
  type NativeUiNode,
  type NativeUiPlan,
} from './native-ui-plan.ts'

/** DarkCloud::Render's tiled bands precede its foreground panel and curtain. */
export function planNativeDarkCloudSceneArt(width: number, height: number): NativeUiPlan {
  const nodes: NativeUiNode[] = [
    { atlas: 'UI', bounds: nativeUiRect(0, 65, width, 108), kind: 'tile', label: 'cloud:wall-top', record: 30 },
    { atlas: 'UI', bounds: nativeUiRect(0, height - 100, width, 108), kind: 'tile', label: 'cloud:wall-bottom', record: 30 },
    { atlas: 'UI', bounds: nativeUiRect(-74, 0, 124, height), kind: 'tile', label: 'cloud:filigree-left', record: 33 },
    { atlas: 'UI', bounds: nativeUiRect(width - 60, 0, 124, height), kind: 'tile', label: 'cloud:filigree-right', record: 33 },
    { anchor: [0.5, 0.5], atlas: 'UI', kind: 'sprite', label: 'cloud:flourish-left', mirrorX: true, mirrorY: true, record: 29, x: 135, y: 83 },
    { anchor: [0.5, 0.5], atlas: 'UI', kind: 'sprite', label: 'cloud:flourish-right', mirrorY: true, record: 29, x: width - 135, y: 83 },
    { atlas: 'UI', kind: 'sprite', label: 'cloud:wizard-top-right', record: 31, x: width - 112, y: 18 },
    { atlas: 'UI', kind: 'sprite', label: 'cloud:wizard-top-left', mirrorX: true, record: 32, x: 104, y: 26.5 },
    { atlas: 'UI', kind: 'sprite', label: 'cloud:wizard-bottom-right', mirrorX: true, record: 32, x: width + 44, y: height - 126.5 },
    { atlas: 'UI', kind: 'sprite', label: 'cloud:wizard-bottom-left', record: 31, x: -57, y: height - 135 },
    {
      bounds: nativeUiRect(0, 0, 55, height),
      kind: 'clip',
      label: 'cloud:side-left',
      nodes: [
        { atlas: 'UI', kind: 'sprite', record: 20, x: -42.5, y: 162.5 },
        { atlas: 'UI', kind: 'sprite', record: 20, x: -82.5, y: (height - 8) / 2 },
      ],
    },
    {
      bounds: nativeUiRect(width - 55, 0, 55, height),
      kind: 'clip',
      label: 'cloud:side-right',
      nodes: [
        { atlas: 'UI', kind: 'sprite', record: 20, x: width - 152.5, y: 162.5 },
        { atlas: 'UI', kind: 'sprite', record: 20, x: width - 112.5, y: (height - 8) / 2 },
      ],
    },
  ]
  return nativeUiPlan(width, height, { actions: [], nodes })
}

/** UiPanel::Render's rails and corners, followed by the browser's leather and gold. */
export function planNativeDarkCloudListFrame(width: number, height: number): NativeUiPlan {
  const nodes: NativeUiNode[] = [
    { atlas: 'UI', bounds: nativeUiRect(-5, -14, width + 10, 19), kind: 'tile', label: 'cloud:chain-top', record: 10 },
    { atlas: 'UI', bounds: nativeUiRect(-5, height - 3, width + 10, 19), kind: 'tile', label: 'cloud:chain-bottom', record: 10 },
    { atlas: 'UI', bounds: nativeUiRect(-15, -2, 21, height + 4), kind: 'tile', label: 'cloud:chain-left', record: 79 },
    { atlas: 'UI', bounds: nativeUiRect(width - 2, -2, 21, height + 4), kind: 'tile', label: 'cloud:chain-right', record: 79 },
    { anchor: [0.5, 0.5], atlas: 'UI', kind: 'sprite', record: 107, x: 22, y: 25 },
    { anchor: [0.5, 0.5], atlas: 'UI', kind: 'sprite', record: 108, x: width - 22, y: 25 },
    { anchor: [0.5, 0.5], atlas: 'UI', kind: 'sprite', record: 109, x: 22, y: height - 25 },
    { anchor: [0.5, 0.5], atlas: 'UI', kind: 'sprite', record: 110, x: width - 22, y: height - 25 },
    { bounds: nativeUiRect(0, 0, width, height), color: 0, kind: 'solid', label: 'cloud:list-back' },
    {
      bounds: nativeUiRect(20, 20, width - 40, height - 40),
      kind: 'clip',
      label: 'cloud:list-interior',
      nodes: [
        { atlas: 'UI', bounds: nativeUiRect(0, 0, width, height), kind: 'tile', label: 'cloud:leather', record: 49 },
        { alpha: 0.5, bounds: nativeUiRect(0, 0, width, 85), color: 0, kind: 'solid', label: 'cloud:column-shade' },
      ],
    },
    { atlas: 'UI', bounds: nativeUiRect(0, 0, width, height), edgeUvOrigin: 0.95, kind: 'nine-slice', label: 'cloud:gold-frame', record: 17 },
  ]
  return nativeUiPlan(width, height, { actions: [], nodes })
}

/** MyQuickCPanel paints one black offset shadow and one foreground gold frame. */
export function planNativeDarkCloudPanel(width: number, height: number): NativeUiPlan {
  const nodes: NativeUiNode[] = [
    { bounds: nativeUiRect(0, 0, width + 40, height + 40), color: 0, kind: 'solid', label: 'cloud:panel-shadow' },
    { atlas: 'UI', bounds: nativeUiRect(0, 0, width + 40, height + 40), edgeUvOrigin: 0.95, kind: 'nine-slice', label: 'cloud:panel-shadow-frame', record: 17, tint: 0 },
    { atlas: 'UI', bounds: nativeUiRect(0, 0, width, height), kind: 'tile', label: 'cloud:panel-leather', record: 49 },
    { atlas: 'UI', bounds: nativeUiRect(-20, -20, width + 40, height + 40), edgeUvOrigin: 0.95, kind: 'nine-slice', label: 'cloud:panel-frame', record: 17 },
  ]
  nodes.push(
      { anchor: [0.5, 0.5], atlas: 'UI', kind: 'sprite', label: 'cloud:panel-flourish-left', record: 18, x: -65, y: height / 2 },
      { anchor: [0.5, 0.5], atlas: 'UI', kind: 'sprite', label: 'cloud:panel-flourish-right', mirrorX: true, record: 18, x: width + 65, y: height / 2 },
  )
  return nativeUiPlan(width, height, { actions: [], nodes })
}
