import {
  nativeUiPlan,
  nativeUiRect,
  type NativeUiButtonState,
  type NativeUiFragment,
  type NativeUiNode,
  type NativeUiPlan,
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

/**
 * Retail text placement inside the 1600 by 900 design space, measured from the
 * stock DarkCloudBrowser capture. Baselines are absolute design-space rows; the
 * menu face renders lowercase as small capitals, so resting labels and column
 * headers keep their authored lowercase.
 */
export const NATIVE_DARK_CLOUD_TEXT = Object.freeze({
  account: Object.freeze({
    bounds: nativeUiRect(586, 58, 428, 50),
    line1: Object.freeze({ baselineY: 88, scale: 1.15 }),
    line2: Object.freeze({ baselineY: 100, scale: 0.89 }),
    underline: nativeUiRect(836, 103, 140, 2),
  }),
  beta: Object.freeze({ baselineY: 50, scale: 0.9, x: 1_006 }),
  colors: Object.freeze({ dim: 0x7a6d4e, gold: 0xd7b96f, green: 0x96c596 }),
  columns: Object.freeze({ baselineY: 238, scale: 0.87 }),
  heading: Object.freeze({ baselineY: 50, centerX: 800, scale: 1 }),
  rows: Object.freeze({ baselineOffset: 28, pitch: 25, scale: 1, top: 260 }),
  tabs: Object.freeze({ labelBaselineY: 181, labelScale: 0.88 }),
})

/** Column anchors in design space: the name column starts at 105, the rest end on the right. */
export const NATIVE_DARK_CLOUD_COLUMNS = Object.freeze({
  mods: Object.freeze([
    Object.freeze({ id: 'name', label: 'mod name', left: 105 }),
    Object.freeze({ id: 'author', label: 'author', right: 1_100 }),
    Object.freeze({ id: 'version', label: 'version', right: 1_255 }),
    Object.freeze({ id: 'status', label: 'status', right: 1_493 }),
  ]),
  parties: Object.freeze([
    Object.freeze({ id: 'name', label: 'party', left: 105 }),
    Object.freeze({ id: 'wizards', label: 'wizards', right: 1_100 }),
    Object.freeze({ id: 'status', label: 'status', right: 1_255 }),
    Object.freeze({ id: 'location', label: 'location', right: 1_493 }),
  ]),
  subscribed: Object.freeze([
    Object.freeze({ id: 'name', label: 'subscribed mod', left: 105 }),
    Object.freeze({ id: 'author', label: 'author', right: 1_100 }),
    Object.freeze({ id: 'version', label: 'version', right: 1_255 }),
    Object.freeze({ id: 'status', label: 'status', right: 1_493 }),
  ]),
})

export interface NativeDarkCloudColumn {
  readonly id: string
  readonly label: string
  readonly left?: number
  readonly right?: number
}

const tabLabel = {
  labelBaselineY: NATIVE_DARK_CLOUD_TEXT.tabs.labelBaselineY - 128,
  labelScale: NATIVE_DARK_CLOUD_TEXT.tabs.labelScale,
  labelTint: NATIVE_DARK_CLOUD_TEXT.colors.gold,
} as const

export const NATIVE_DARK_CLOUD_TABS = Object.freeze([
  Object.freeze({ ...tabLabel, bounds: nativeUiRect(0, 0, 170, 69), id: 'mods', label: 'mods', selectedLabel: 'MODS' }),
  Object.freeze({ ...tabLabel, bounds: nativeUiRect(170, 0, 340, 69), id: 'subscribed', label: 'subscribed mods', selectedLabel: 'SUBSCRIBED MODS' }),
  Object.freeze({ ...tabLabel, bounds: nativeUiRect(510, 0, 170, 69), id: 'parties', label: 'parties', selectedLabel: 'PARTIES' }),
  Object.freeze({ ...tabLabel, bounds: nativeUiRect(680, 0, 202, 69), id: 'layouts', label: 'layouts', selectedLabel: 'LAYOUTS' }),
] satisfies readonly NativeUiTabSpec[])

interface NativeDarkCloudFigure {
  readonly label: string
  readonly mirrorX?: boolean
  readonly record: number
  readonly x: number
  readonly y: number
}

interface NativeDarkCloudPlacement {
  readonly label: string
  readonly mirrorX?: boolean
  readonly mirrorY?: boolean
  readonly x: number
  readonly y: number
}

interface NativeDarkCloudEdgeLine {
  readonly color: number
  readonly offset: number
}

/**
 * The retail DarkCloudBrowser backdrop and list frame, decoded from the stock
 * 1600 by 900 capture (docs/Game Native Parity RE/300). Everything is drawn in
 * painter order; sprite positions are logical (trim already applied), mirrored
 * sprites give their right edge as x the way the plan sprite convention does.
 */
export const NATIVE_DARK_CLOUD_SCENE = Object.freeze({
  chains: Object.freeze({
    bottom: nativeUiRect(39, 804, 1_522, 19),
    clip: nativeUiRect(0, 150, 1_600, 650),
    horizontalRecord: 10,
    leftX: 57,
    rightX: 1_543,
    top: nativeUiRect(24, 158, 1_552, 19),
    verticalCount: 6,
    verticalRecord: 79,
    verticalStep: 108,
    verticalTop: 172,
  }),
  figures: Object.freeze([
    Object.freeze({ label: 'flourish-left', record: 29, x: 63.5, y: 53.5 }),
    Object.freeze({ label: 'flourish-right', mirrorX: true, record: 29, x: 1_536.5, y: 53.5 }),
    Object.freeze({ label: 'wizard-tall-top-right', record: 31, x: 1_488, y: 18 }),
    Object.freeze({ label: 'wizard-short-top-left', mirrorX: true, record: 32, x: 104, y: 26.5 }),
    Object.freeze({ label: 'wizard-short-bottom-right', mirrorX: true, record: 32, x: 1_644, y: 773.5 }),
    Object.freeze({ label: 'wizard-tall-bottom-left', record: 31, x: -57, y: 765 }),
  ] as readonly NativeDarkCloudFigure[]),
  frame: Object.freeze({
    fill: nativeUiRect(57, 175, 1_487, 624),
    goldCorner: Object.freeze({ height: 83, record: 17, width: 80 }),
    goldCorners: Object.freeze([
      Object.freeze({ label: 'gold-top-left', x: 55, y: 173 }),
      Object.freeze({ label: 'gold-top-right', mirrorX: true, x: 1_545, y: 173 }),
      Object.freeze({ label: 'gold-bottom-left', mirrorY: true, x: 55, y: 800 }),
      Object.freeze({ label: 'gold-bottom-right', mirrorX: true, mirrorY: true, x: 1_545, y: 800 }),
    ] as readonly NativeDarkCloudPlacement[]),
    headerBand: Object.freeze({ alpha: 0.5, bounds: nativeUiRect(75, 193, 1_450, 65), color: 0x000000 }),
    /** Gold edge rows measured from the outer frame edge inward; both axes mirror. */
    horizontalLines: Object.freeze([
      Object.freeze({ color: 0xe5d2a4, offset: 0 }),
      Object.freeze({ color: 0xe0c88f, offset: 1 }),
      Object.freeze({ color: 0xa38d55, offset: 2 }),
      Object.freeze({ color: 0x6f603a, offset: 3 }),
      Object.freeze({ color: 0x0e0d0a, offset: 10 }),
      Object.freeze({ color: 0xddcb9d, offset: 11 }),
      Object.freeze({ color: 0xd1b56e, offset: 12 }),
      Object.freeze({ color: 0x6c5e38, offset: 13 }),
    ] satisfies readonly NativeDarkCloudEdgeLine[]),
    leather: Object.freeze({
      clip: nativeUiRect(75, 193, 1_450, 587),
      period: 264,
      record: 49,
      tile: nativeUiRect(55, 173, 1_584, 792),
    }),
    verticalLines: Object.freeze([
      Object.freeze({ color: 0xddc589, offset: 0 }),
      Object.freeze({ color: 0xddc180, offset: 1 }),
      Object.freeze({ color: 0xb99f60, offset: 2 }),
      Object.freeze({ color: 0x96814e, offset: 3 }),
      Object.freeze({ color: 0xb09d6d, offset: 10 }),
      Object.freeze({ color: 0xd8bb75, offset: 11 }),
      Object.freeze({ color: 0xa48d55, offset: 12 }),
      Object.freeze({ color: 0x201c11, offset: 13 }),
    ] satisfies readonly NativeDarkCloudEdgeLine[]),
  }),
  plates: Object.freeze({
    leftClip: nativeUiRect(0, 0, 55, 900),
    positions: Object.freeze([
      Object.freeze({ label: 'plate-top-left', x: -42.5, y: 162.5 }),
      Object.freeze({ label: 'plate-bottom-left', x: -82.5, y: 446 }),
      Object.freeze({ label: 'plate-top-right', mirrorX: true, x: 1_642.5, y: 162.5 }),
      Object.freeze({ label: 'plate-bottom-right', mirrorX: true, x: 1_682.5, y: 446 }),
    ] as readonly NativeDarkCloudPlacement[]),
    record: 20,
    rightClip: nativeUiRect(1_545, 0, 55, 900),
  }),
  scrolls: Object.freeze({ leftX: -74, record: 33, rightX: 1_540, tileHeight: 267 }),
  shade: Object.freeze({
    bandBottom: 50,
    glowReach: 60,
    gradientBottom: 150,
    panel: nativeUiRect(55, 173, 1_490, 627),
  }),
  stones: Object.freeze([
    Object.freeze({ label: 'stone-top-left', record: 107, x: 34.5, y: 153.5 }),
    Object.freeze({ label: 'stone-top-right', record: 108, x: 1_480.5, y: 153.5 }),
    Object.freeze({ label: 'stone-bottom-left', record: 109, x: 34.5, y: 730.5 }),
    Object.freeze({ label: 'stone-bottom-right', record: 110, x: 1_480.5, y: 730.5 }),
  ]),
  wall: Object.freeze({ record: 30, rows: Object.freeze([65, 800]), tileHeight: 108 }),
})

/** Wall tiles, scroll columns, the watching figures and the clipped side plates. */
export function planNativeDarkCloudBackdrop(): NativeUiPlan {
  const { design } = NATIVE_DARK_CLOUD_PRESENTATION
  const scene = NATIVE_DARK_CLOUD_SCENE
  const nodes: NativeUiNode[] = [
    ...scene.wall.rows.map((top, index): NativeUiNode => ({
      atlas: 'UI',
      bounds: nativeUiRect(0, top, design.width, scene.wall.tileHeight),
      kind: 'tile',
      label: `wall-${index}`,
      record: scene.wall.record,
    })),
    {
      atlas: 'UI',
      bounds: nativeUiRect(scene.scrolls.leftX, 0, 124, scene.scrolls.tileHeight * 4),
      kind: 'tile',
      label: 'scroll-left',
      record: scene.scrolls.record,
    },
    {
      atlas: 'UI',
      bounds: nativeUiRect(scene.scrolls.rightX, 0, 124, scene.scrolls.tileHeight * 4),
      kind: 'tile',
      label: 'scroll-right',
      record: scene.scrolls.record,
    },
    ...scene.figures.map((figure): NativeUiNode => ({
      atlas: 'UI',
      kind: 'sprite',
      label: figure.label,
      mirrorX: figure.mirrorX,
      record: figure.record,
      x: figure.x,
      y: figure.y,
    })),
    ...([scene.plates.leftClip, scene.plates.rightClip] as const).map((bounds, index): NativeUiNode => ({
      bounds,
      kind: 'clip',
      label: index === 0 ? 'plates-left' : 'plates-right',
      nodes: scene.plates.positions
        .filter(plate => (plate.mirrorX ?? false) === (index === 1))
        .map((plate): NativeUiNode => ({
          atlas: 'UI',
          kind: 'sprite',
          label: plate.label,
          mirrorX: plate.mirrorX,
          record: scene.plates.record,
          x: plate.x,
          y: plate.y,
        })),
    })),
  ]
  return nativeUiPlan(design.width, design.height, { actions: [], nodes })
}

/** Chains, stone corners, the black list frame with its gold rules, leather and gold corners. */
export function planNativeDarkCloudFrame(): NativeUiPlan {
  const { design } = NATIVE_DARK_CLOUD_PRESENTATION
  const scene = NATIVE_DARK_CLOUD_SCENE
  const { chains, frame } = scene
  const verticalChains: NativeUiNode[] = []
  for (let index = 0; index < chains.verticalCount; index += 1) {
    const y = chains.verticalTop + index * chains.verticalStep
    verticalChains.push({
      atlas: 'UI',
      kind: 'sprite',
      label: `chain-right-${index}`,
      record: chains.verticalRecord,
      x: chains.rightX,
      y,
    }, {
      atlas: 'UI',
      kind: 'sprite',
      label: `chain-left-${index}`,
      mirrorX: true,
      record: chains.verticalRecord,
      x: chains.leftX,
      y,
    })
  }
  const lines: NativeUiNode[] = []
  const fillRight = frame.fill.left + frame.fill.width
  const fillBottom = frame.fill.top + frame.fill.height
  for (const line of frame.horizontalLines) {
    lines.push({
      bounds: nativeUiRect(frame.fill.left, frame.fill.top + line.offset, frame.fill.width, 1),
      color: line.color,
      kind: 'solid',
      label: `frame-top-${line.offset}`,
    }, {
      bounds: nativeUiRect(frame.fill.left, fillBottom - 1 - line.offset, frame.fill.width, 1),
      color: line.color,
      kind: 'solid',
      label: `frame-bottom-${line.offset}`,
    })
  }
  for (const line of frame.verticalLines) {
    lines.push({
      bounds: nativeUiRect(frame.fill.left + line.offset, frame.fill.top, 1, frame.fill.height),
      color: line.color,
      kind: 'solid',
      label: `frame-left-${line.offset}`,
    }, {
      bounds: nativeUiRect(fillRight - 1 - line.offset, frame.fill.top, 1, frame.fill.height),
      color: line.color,
      kind: 'solid',
      label: `frame-right-${line.offset}`,
    })
  }
  const nodes: NativeUiNode[] = [
    {
      bounds: chains.clip,
      kind: 'clip',
      label: 'chains',
      nodes: [
        {
          atlas: 'UI',
          bounds: chains.top,
          kind: 'tile',
          label: 'chain-top',
          record: chains.horizontalRecord,
        },
        {
          atlas: 'UI',
          bounds: chains.bottom,
          kind: 'tile',
          label: 'chain-bottom',
          record: chains.horizontalRecord,
        },
        ...verticalChains,
      ],
    },
    ...scene.stones.map((stone): NativeUiNode => ({
      atlas: 'UI',
      kind: 'sprite',
      label: stone.label,
      record: stone.record,
      x: stone.x,
      y: stone.y,
    })),
    { bounds: frame.fill, color: 0x000000, kind: 'solid', label: 'frame-fill' },
    ...lines,
    {
      bounds: frame.leather.clip,
      kind: 'clip',
      label: 'leather',
      nodes: [{
        atlas: 'UI',
        bounds: frame.leather.tile,
        kind: 'tile',
        label: 'leather-tile',
        record: frame.leather.record,
      }],
    },
    {
      alpha: frame.headerBand.alpha,
      bounds: frame.headerBand.bounds,
      color: frame.headerBand.color,
      kind: 'solid',
      label: 'header-band',
    },
    ...frame.goldCorners.map((corner): NativeUiNode => ({
      atlas: 'UI',
      kind: 'sprite',
      label: corner.label,
      mirrorX: corner.mirrorX,
      mirrorY: corner.mirrorY,
      record: frame.goldCorner.record,
      x: corner.x,
      y: corner.y,
    })),
  ]
  return nativeUiPlan(design.width, design.height, { actions: [], nodes })
}

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
