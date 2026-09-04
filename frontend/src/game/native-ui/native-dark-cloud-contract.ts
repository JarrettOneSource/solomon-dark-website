import {
  nativeUiRect,
  type NativeUiButtonState,
  type NativeUiFragment,
  type NativeUiNode,
  type NativeUiRect,
  type NativeUiTabSpec,
} from './native-ui-plan.ts'

export const NATIVE_DARK_CLOUD_PRESENTATION = Object.freeze({
  design: Object.freeze({ height: 900, width: 1_600 }),
  fonts: Object.freeze({ heading: 'heading' as const, menu: 'menu' as const }),
  geometry: Object.freeze({
    accountBounds: nativeUiRect(586, 58, 428, 50),
    listBounds: nativeUiRect(55, 173, 1_490, 627),
    optionsBounds: nativeUiRect(1_017.5, 818, 185, 52),
    primaryBounds: nativeUiRect(623.5, 809.5, 353, 69),
    searchBounds: nativeUiRect(390, 818, 90, 52),
    searchPanelBounds: nativeUiRect(540, 347.5, 520, 205),
    sortBounds: nativeUiRect(495, 818, 90, 52),
    sortPanelBounds: nativeUiRect(640, 347.5, 320, 255),
    tabStripBounds: nativeUiRect(460, 128, 882, 69),
  }),
  records: Object.freeze({
    frameGold: Object.freeze({ atlas: 'UI' as const, record: 17 }),
    frameStoneBottomLeft: Object.freeze({ atlas: 'UI' as const, record: 109 }),
    frameStoneBottomRight: Object.freeze({ atlas: 'UI' as const, record: 110 }),
    frameStoneTopLeft: Object.freeze({ atlas: 'UI' as const, record: 107 }),
    frameStoneTopRight: Object.freeze({ atlas: 'UI' as const, record: 108 }),
    menuSkull: Object.freeze({ atlas: 'UI' as const, record: 42 }),
    panelFlourish: Object.freeze({ atlas: 'UI' as const, record: 18 }),
    primaryIdle: Object.freeze({ atlas: 'UI' as const, record: 101 }),
    primaryPressed: Object.freeze({ atlas: 'UI' as const, record: 102 }),
    primarySurround: Object.freeze({ atlas: 'UI' as const, record: 54 }),
    sceneFlourish: Object.freeze({ atlas: 'UI' as const, record: 29 }),
    sceneSideOrnament: Object.freeze({ atlas: 'UI' as const, record: 20 }),
    sceneWizardShort: Object.freeze({ atlas: 'UI' as const, record: 32 }),
    sceneWizardTall: Object.freeze({ atlas: 'UI' as const, record: 31 }),
    searchIcon: Object.freeze({ atlas: 'UI' as const, record: 58 }),
    sortIcon: Object.freeze({ atlas: 'UI' as const, record: 66 }),
    tabBracket: Object.freeze({ atlas: 'UI' as const, record: 13 }),
    toolIdle: Object.freeze({ atlas: 'UI' as const, record: 103 }),
    toolPressed: Object.freeze({ atlas: 'UI' as const, record: 104 }),
    toolSurround: Object.freeze({ atlas: 'UI' as const, record: 53 }),
  }),
})

export const NATIVE_DARK_CLOUD_TABS = Object.freeze([
  Object.freeze({ bounds: nativeUiRect(0, 0, 170, 69), id: 'mods', label: 'MODS' }),
  Object.freeze({ bounds: nativeUiRect(170, 0, 340, 69), id: 'subscribed', label: 'SUBSCRIBED MODS' }),
  Object.freeze({ bounds: nativeUiRect(510, 0, 170, 69), id: 'parties', label: 'PARTIES' }),
  Object.freeze({ bounds: nativeUiRect(680, 0, 202, 69), id: 'layouts', label: 'LAYOUTS' }),
] satisfies readonly NativeUiTabSpec[])

export const NATIVE_DARK_CLOUD_ROOT_RECORDS = Object.freeze([
  'UI.29', 'UI.29',
  'UI.31', 'UI.31',
  'UI.32', 'UI.32',
  'UI.20', 'UI.20', 'UI.20', 'UI.20',
  'UI.107', 'UI.108', 'UI.109', 'UI.110',
  'UI.17', 'UI.17', 'UI.17', 'UI.17',
  'UI.13', 'UI.13', 'UI.13', 'UI.13', 'UI.13', 'UI.13', 'UI.13', 'UI.13',
  'UI.101', 'UI.54', 'UI.54',
  'UI.103', 'UI.53', 'UI.53', 'UI.58',
  'UI.103', 'UI.53', 'UI.53', 'UI.66',
  'UI.103', 'UI.53', 'UI.53',
  'UI.42',
] as const)

interface NativeDarkCloudToolButtonSpec {
  readonly bounds: NativeUiRect
  readonly iconRecord?: number
  readonly id: string
  readonly label?: string
  readonly state?: NativeUiButtonState
}

export function planNativeDarkCloudToolButton(
  spec: NativeDarkCloudToolButtonSpec,
): NativeUiFragment {
  if ((spec.iconRecord === undefined) === (spec.label === undefined)) {
    throw new TypeError('native Dark Cloud tool button requires exactly one icon or label')
  }
  const state = spec.state ?? 'idle'
  const disabled = state === 'disabled'
  const pressed = state === 'pressed' || state === 'selected'
  const alpha = disabled ? 0.45 : 1
  const { bounds } = spec
  const offset = pressed ? 1 : 0
  const nodes: NativeUiNode[] = [
    {
      alpha,
      atlas: 'UI',
      height: bounds.height,
      kind: 'sprite',
      label: `${spec.id}:body`,
      record: pressed
        ? NATIVE_DARK_CLOUD_PRESENTATION.records.toolPressed.record
        : NATIVE_DARK_CLOUD_PRESENTATION.records.toolIdle.record,
      width: bounds.width,
      x: bounds.left,
      y: bounds.top,
    },
    {
      alpha,
      atlas: 'UI',
      kind: 'sprite',
      label: `${spec.id}:end-left`,
      record: NATIVE_DARK_CLOUD_PRESENTATION.records.toolSurround.record,
      x: bounds.left - 6,
      y: bounds.top - 6,
    },
    {
      alpha,
      atlas: 'UI',
      kind: 'sprite',
      label: `${spec.id}:end-right`,
      mirrorX: true,
      record: NATIVE_DARK_CLOUD_PRESENTATION.records.toolSurround.record,
      x: bounds.left + bounds.width + 6,
      y: bounds.top - 6,
    },
  ]
  if (spec.iconRecord !== undefined) {
    nodes.push({
      alpha,
      anchor: [0.5, 0.5],
      atlas: 'UI',
      kind: 'sprite',
      label: `${spec.id}:icon`,
      record: spec.iconRecord,
      x: bounds.left + bounds.width / 2 + offset,
      y: bounds.top + bounds.height / 2 + offset,
    })
  } else {
    nodes.push({
      kind: 'text',
      label: `${spec.id}:label`,
      text: {
        alpha,
        font: 'menu',
        scale: 0.68,
        text: spec.label!,
        tint: 0xd9ba70,
        x: bounds.left + bounds.width / 2 + offset,
        y: bounds.top + bounds.height / 2 + 5 + offset,
      },
    })
  }
  return {
    actions: [{ bounds, disabled, id: spec.id, role: 'button' }],
    nodes,
  }
}
