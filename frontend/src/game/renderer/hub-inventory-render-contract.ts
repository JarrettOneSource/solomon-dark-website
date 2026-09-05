import {
  nativeSkillColorRoot,
} from '../core-kernels/player-progression.ts'
import {
  nativePrimarySpellDescriptor,
  type NativePrimarySpellDamageUnit,
  type NativePrimarySpellManaUnit,
} from '../core-kernels/native-primary-skill-profile.ts'
import {
  type EquipmentSlot,
  type HubActionFeedback,
} from '../core-kernels/hub-economy.ts'

import {
  nativeWizardClassTitle,
} from '../core-kernels/native-wizard-class.ts'
import type {
  WizardDiscipline,
  WizardElement,
} from '../core-kernels/player-character.ts'
import type {
  ProtocolPlayerProgression,
} from '../protocol/game-state.ts'
import {
  layoutNativeUiSingleActionMessage,
  type NativeUiMessageDataLineSpec,
  type NativeUiSingleActionMessageLayout,
} from '../native-ui/core.ts'
import {
  skillPickerRootTint,
} from './skill-picker-render-contract.ts'

export const HUB_NATIVE_UI_SIZE = { height: 900, width: 1600 } as const

export const HUB_INVENTORY_GRID = {
  capacity: 88,
  cellSize: 72,
  columns: 22,
  left: 24,
  pitch: 75,
  rows: 4,
  slotAlpha: 0.4,
  top: 496,
} as const

export const HUB_INVENTORY_INTERACTION = {
  doubleActivationMs: 500,
  doubleActivationTicks: 50,
  dragThresholdPixels: 10,
  itemInfoDelayMs: 200,
  itemInfoDelayTicks: 20,
  selectionTint: 0x00c020,
} as const

export const HUB_INVENTORY_FLYBY = {
  afterimageAlphaLossPerTick: 0.1,
  afterimageBirthTicks: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const,
  tailTicks: 10,
  tickMs: 10,
  travelTicks: 20,
} as const

export const HUB_INVENTORY_PARENT_HOLDER = {
  alpha: 0.25,
  visibleSlot: 0,
} as const

export interface HubInventoryFlybyAfterimageFrame {
  readonly alpha: number
  readonly progress: number
  readonly spawnTick: number
}

export interface HubInventoryFlybyFrame {
  readonly afterimages: readonly HubInventoryFlybyAfterimageFrame[]
  readonly complete: boolean
  readonly mainProgress: number
  readonly mainVisible: boolean
  readonly tick: number
  readonly travelComplete: boolean
}

export function hubInventoryFlybyFrame(startedAtMs: number, nowMs: number): HubInventoryFlybyFrame {
  const tick = Math.max(0, Math.floor((nowMs - startedAtMs) / HUB_INVENTORY_FLYBY.tickMs))
  const travelComplete = tick >= HUB_INVENTORY_FLYBY.travelTicks
  return {
    afterimages: HUB_INVENTORY_FLYBY.afterimageBirthTicks.flatMap((spawnTick) => {
      if (spawnTick > tick) return []
      const alpha = Math.round(
        (1 - (tick - spawnTick) * HUB_INVENTORY_FLYBY.afterimageAlphaLossPerTick) * 10,
      ) / 10
      return alpha <= 0 ? [] : [{
        alpha,
        progress: spawnTick / HUB_INVENTORY_FLYBY.travelTicks,
        spawnTick,
      }]
    }),
    complete: tick >= HUB_INVENTORY_FLYBY.travelTicks - 1 + HUB_INVENTORY_FLYBY.tailTicks,
    mainProgress: Math.min(tick, HUB_INVENTORY_FLYBY.travelTicks)
      / HUB_INVENTORY_FLYBY.travelTicks,
    mainVisible: !travelComplete,
    tick,
    travelComplete,
  }
}

export function hubInventoryFlybyPoint(
  from: Readonly<{ x: number; y: number }>,
  to: Readonly<{ x: number; y: number }>,
  progress: number,
): { readonly x: number; readonly y: number } {
  const bounded = Math.max(0, Math.min(1, progress))
  return {
    x: from.x + (to.x - from.x) * bounded,
    y: from.y + (to.y - from.y) * bounded,
  }
}

export const HUB_SACK_PAGE_TRANSITION = {
  nativeTickMs: 10,
  pixelsPerTick: 10,
  stageWidth: 1_600,
  ticks: 160,
} as const

export const HUB_MODAL_HUD_CONTROLS = {
  backpack: {
    label: 'native-inventory-resume-control',
    record: 47,
  },
  shadowOffset: [5, 5] as const,
  shadowTint: 0x000000,
  tome: {
    label: 'native-skill-book-control',
    record: 48,
  },
} as const

export type HubSackPageDirection = 'back' | 'open'

export function hubSackPageOffsets(
  direction: HubSackPageDirection,
  startedAtMs: number,
  nowMs: number,
): {
  readonly incomingX: number
  readonly outgoingX: number
  readonly settled: boolean
  readonly ticks: number
} {
  const ticks = Math.min(
    HUB_SACK_PAGE_TRANSITION.ticks,
    Math.max(0, Math.floor((nowMs - startedAtMs) / HUB_SACK_PAGE_TRANSITION.nativeTickMs)),
  )
  const travel = ticks * HUB_SACK_PAGE_TRANSITION.pixelsPerTick
  return direction === 'open'
    ? {
        incomingX: HUB_SACK_PAGE_TRANSITION.stageWidth - travel,
        outgoingX: travel === 0 ? 0 : -travel,
        settled: ticks === HUB_SACK_PAGE_TRANSITION.ticks,
        ticks,
      }
    : {
        incomingX: -HUB_SACK_PAGE_TRANSITION.stageWidth + travel,
        outgoingX: travel,
        settled: ticks === HUB_SACK_PAGE_TRANSITION.ticks,
        ticks,
      }
}

/**
 * Fixed-stage projection of the stock DyeClothing overlay. The executable
 * recovers the relative 3x3-bank geometry, 40/50 spacing, item split, and
 * update rates; these absolute web-stage bounds keep the authored backpack
 * cells visible because stock target HotRects remain the inventory item rects.
 */
export const HUB_DYE_CLOTHING = {
  bankSize: 9,
  cancelRect: [690, 390, 220, 44] as const,
  closeDecrementPerTick: 0.1,
  emptyTubAlpha: 0.2,
  instructionTextBaselineY: 151,
  itemLayerSplitOffsetY: 40,
  nativeTickMs: 10,
  openIncrementPerTick: 0.01,
  panelRect: [480, 80, 640, 360] as const,
  selectedPulseDecrementPerTick: 0.05,
  selectedPulseTicks: 20,
  swatchBankOrigins: [[560, 185], [760, 185]] as const,
  swatchColumns: 3,
  swatchCount: 18,
  swatchPitchX: 40,
  swatchPitchY: 50,
  swatchRows: 3,
  swatchSize: 32,
  titleTextBaselineY: 121,
  tubRect: [960, 198, 96, 96] as const,
} as const

export const HUB_HOVER_BOX = {
  contentMargin: 25,
  contentMaxWidth: 300,
  lineGap: 10,
  ownedPerkDelayTicks: 0,
  ownedPerkSourceExclusionSize: 60,
  ownedPerkSourceGap: 25,
  shopDelayTicks: 0,
  shopSourceExclusionSize: 70,
  shopSourceGap: 35,
  viewportMargin: 25,
} as const

export const HUB_UNFORGE_TARGET = {
  center: [1562, 868] as const,
  rect: [1500, 800, 100, 100] as const,
  redAmplitude: 0.2,
  redBase: 0.6,
  periodTicks: 360,
} as const

export const HUB_UNFORGE_CONFIRMATION = {
  bodyLeft: 614,
  bodyMaxWidth: 376,
  bodyTextBaselineY: 511,
  innerPanelRect: [544.5, 387.5, 514, 326] as const,
  primaryButtonRect: [595, 573, 197, 69] as const,
  secondaryButtonRect: [811, 573, 197, 69] as const,
  titleTextBaselineY: 478,
} as const

export const HUB_UNFORGE_RESULT = {
  bodyLeft: 677,
  bodyLeftOffset: 70.5,
  centerX: 801.5,
  horizontalChrome: 141,
  innerPanelRect: [606.5, 396.5, 390, 308] as const,
  outcomeTextBaselineY: 537,
  primaryButtonRect: [703, 564, 197, 69] as const,
  summaryTextBaselineY: 520,
  titleTextBaselineY: 485,
} as const

export function hubUnforgeResultLayout(maxLineWidth: number): {
  readonly bodyLeft: number
  readonly innerPanelRect: readonly [number, number, number, number]
  readonly primaryButtonRect: typeof HUB_UNFORGE_RESULT.primaryButtonRect
} {
  if (!Number.isFinite(maxLineWidth) || maxLineWidth < 0) {
    throw new RangeError('unforge result line width must be finite and nonnegative')
  }
  const width = maxLineWidth + HUB_UNFORGE_RESULT.horizontalChrome
  const left = HUB_UNFORGE_RESULT.centerX - width / 2
  return {
    bodyLeft: left + HUB_UNFORGE_RESULT.bodyLeftOffset,
    innerPanelRect: [
      left,
      HUB_UNFORGE_RESULT.innerPanelRect[1],
      width,
      HUB_UNFORGE_RESULT.innerPanelRect[3],
    ],
    primaryButtonRect: HUB_UNFORGE_RESULT.primaryButtonRect,
  }
}

export function hubUnforgeTargetTint(nativeTick: number): number {
  const red = Math.round((
    Math.sin(nativeTick * Math.PI / 180) * HUB_UNFORGE_TARGET.redAmplitude
    + HUB_UNFORGE_TARGET.redBase
  ) * 255)
  return (red << 16) | 0x00ffff
}

export const HUB_STARTER_EQUIPMENT_PRIMARY_TINT: Readonly<Record<WizardElement, number>> = {
  air: 0xa0c3c3,
  earth: 0x90b390,
  ether: 0x886688,
  fire: 0x998077,
  water: 0x5e6e81,
}

export const HUB_ITEM_ICON_TRANSFORMS = {
  amulet: { rotationDegrees: 0, translation: [0, -5] },
  hat: { rotationDegrees: 0, translation: [0, 0] },
  ring: { rotationDegrees: 0, translation: [0, 0] },
  robe: { rotationDegrees: 0, translation: [0, 0] },
  staff: { rotationDegrees: 35, translation: [-22.94306, 32.76608] },
  wand: { rotationDegrees: 45, translation: [0, 0] },
} as const

export const HUB_EQUIPMENT_SINK_RENDER = {
  interiorTint: 0x191916,
  normalFrameRecord: 10,
  smallFrameRecord: 9,
  tallPrimitiveOutline: true,
} as const

export const HUB_INVENTORY_INFO_FRAME = {
  fillTint: 0x1a1a17,
  frameRecord: 10,
  sourceSize: 72,
  sourceThird: 24,
} as const

export const HUB_INVENTORY_ROOT_CHROME = {
  backpackHeader: {
    baselineY: 489,
    centerX: 800,
    frameTop: 460,
    text: 'Backpack',
  },
  companionPaneLeft: {
    left: 103,
    right: 1177,
  },
  cornerRecords: [107, 108, 109, 110] as const,
  edgeUvOrigin: 0.95,
  frameRecord: 8,
  horizontalChain: {
    bottomOffset: -5,
    record: 10,
    size: [106, 19] as const,
    topOffset: -12,
  },
  paneSize: [320, 320] as const,
  paneTop: 89,
  sectionHeader: {
    font: 'menu',
    frameHeight: 40,
    horizontalPadding: 20,
    record: 4,
    tint: 0x808080,
  },
  sideHeader: {
    baselineY: 91,
    frameTop: 66,
    titles: {
      left: 'stats',
      right: 'equip',
    },
  },
  standaloneOutwardShift: 53,
  verticalChain: {
    leftOffset: -10,
    record: 79,
    rightOffset: -7,
    size: [21, 108] as const,
  },
} as const

export const HUB_INVENTORY_IDENTITY_PAGE = {
  bodyRect: [86, 139, 228, 50] as const,
  companionShift: 53,
  headingRect: [86, 111, 228, 32] as const,
  identityTextBaselineY: 159,
  nameTextBaselineY: 136,
  textLeft: 96,
  textTint: 0xd9ba70,
} as const

export const HUB_PRIMARY_SPELL_PANE = {
  bodyRect: [86, 230, 228, 80] as const,
  companionShift: 53,
  contentAdvanceScale: 0.9,
  contentFont: 'medium',
  contentTextBaselines: [251, 273, 286, 299] as const,
  gemCenter: [319, 256.5] as const,
  gemRecord: 3,
  headingRect: [86, 207, 228, 27] as const,
  headingFont: 'body',
  headingTextBaselineY: 225,
  headingTint: 0xd9ba70,
  inlineUnit: {
    italic: true,
    offset: [0, 1] as const,
    scale: 0.7,
  },
  meleeBodyRect: [86, 352, 228, 32] as const,
  meleeHeadingRect: [86, 329, 228, 27] as const,
  meleeHeadingTextBaselineY: 347,
  meleeValueTextBaselineY: 374,
  textLeft: 95,
} as const

export const HUB_INVENTORY_STATS_PAGES = {
  actionSize: 36,
  companionClipRect: [103, 89, 320, 320] as const,
  companionIndicatorX: 391,
  contentHeight: 960,
  dragThresholdPixels: 10,
  indicatorRecord: 13,
  pageCount: 3,
  pageHeight: 320,
  standaloneClipRect: [50, 89, 320, 320] as const,
  standaloneIndicatorX: 338,
} as const

export function hubInventoryWizardIdentityText(
  level: number,
  element: WizardElement,
  discipline: WizardDiscipline,
): string {
  return `LEVEL ${level}\n${nativeWizardClassTitle(element, discipline)}`
}

export const HUB_INVENTORY_ATTRIBUTES_PAGE = {
  attributesBodyRect: [86, 479, 228, 80] as const,
  attributesHeadingRect: [86, 451, 228, 32] as const,
  attributesHeadingTextBaselineY: 472,
  attributesRows: [500, 514, 533, 547] as const,
  attributesValueRect: [206, 479, 108, 80] as const,
  decorationCenters: [
    [114, 475],
    [114, 542],
    [256, 505],
    [114, 640],
    [41, 680],
  ] as const,
  headingFont: 'medium',
  headingTint: 0xd9ba70,
  labelFont: 'body',
  labelRight: 201,
  resistancesBodyRect: [86, 627, 228, 60] as const,
  resistancesHeadingRect: [86, 599, 228, 32] as const,
  resistancesHeadingTextBaselineY: 620,
  resistancesValueRect: [206, 627, 108, 60] as const,
  resistanceRows: [648, 662, 676] as const,
  rowTints: {
    blue: 0xc2c2e2,
    green: 0xc9f9c9,
    red: 0xe9c9c9,
  },
  titleCenterX: 200,
  valueFont: 'medium',
  valueLeft: 216,
} as const

export function hubInventoryPrimarySpellTint(selectedPrimarySkillId: number): number {
  return skillPickerRootTint(nativeSkillColorRoot(selectedPrimarySkillId))
}

export function hubInventoryStatsPage(value: number): 0 | 1 | 2 {
  if (!Number.isInteger(value) || value < 0 || value >= HUB_INVENTORY_STATS_PAGES.pageCount) {
    throw new RangeError('native InventoryScreen stats page must be within [0,2]')
  }
  return value as 0 | 1 | 2
}

export function hubInventoryStatsArrowRect(
  page: number,
  direction: 'down' | 'up',
  companion: boolean,
): readonly [number, number, number, number] | null {
  const current = hubInventoryStatsPage(page)
  if ((direction === 'up' && current === 0) || (direction === 'down' && current === 2)) {
    return null
  }
  const size = HUB_INVENTORY_STATS_PAGES.actionSize
  const centerX = companion
    ? HUB_INVENTORY_STATS_PAGES.companionIndicatorX
    : HUB_INVENTORY_STATS_PAGES.standaloneIndicatorX
  const centerY = direction === 'up' ? 119 : 379
  return [centerX - size / 2, centerY - size / 2, size, size]
}

export const HUB_SHOP_GRID = {
  cellSize: 72,
  columns: 7,
  left: 539,
  pitchX: 75,
  pitchY: 75,
  retainedCapacity: 28,
  rows: 4,
  slotAlpha: 0.6,
  top: 56.5,
} as const

export const HUB_DOWSING_GRID = {
  cellSize: 72,
  columns: 3,
  left: 689,
  pitchX: 75,
  pitchY: 75,
  retainedCapacity: 9,
  rows: 3,
  slotAlpha: 0.6,
  top: 94,
} as const

export const HUB_STOREGRID_SELECTED_RECORDS = {
  buyClickAgain: 84,
  buyTouchAgainDormant: 85,
  takeClickAgain: 111,
  takeTouchAgainDormant: 112,
  unaffordable: 46,
} as const

export const HUB_SHOP_PANEL = {
  backgroundBlendModes: ['normal', 'add'] as const,
  backgroundTileExtent: [264, 264] as const,
  backgroundHeight: 400,
  backgroundRepeat: [4, 2] as const,
  doneInnerTint: 0xbfffbf,
  doneMiddleAlpha: 0.85,
  doneRect: [714.5, 358, 171, 58] as const,
  height: 430,
  settledLeft: 498,
  settledTop: -20,
  slideDistance: 100,
  width: 604,
} as const

export function hubShopSlideOffset(reveal: number): number {
  const alpha = Math.max(0, Math.min(1, reveal))
  return alpha === 1 ? 0 : -HUB_SHOP_PANEL.slideDistance * (1 - alpha)
}

export const HUB_SHOP_TEXT = {
  affordableTint: 0xd9ba70,
  goldTint: 0xd9ba70,
  normalBackgroundTint: 0xd9ffd9,
  priceFont: 'body',
  priceTextBaselineOffsetY: 67,
  priceTextRightOffsetX: 67,
  doneTextBaselineY: 392,
  titleTextBaselineY: 32,
  unaffordableTint: 0xff8080,
} as const

export const HUB_HAGATHA_PERK_PANE = {
  columns: 3,
  innerHeight: 230,
  innerPanelTint: HUB_INVENTORY_INFO_FRAME.fillTint,
  innerWidth: 230,
  left: 138,
  lockedSlotAlpha: 0.5,
  rows: 3,
  slotCenterOrigin: [193, 198] as const,
  slotPitch: 60,
  slotScale: 0.8,
  titleTint: 0xd9ba70,
  titleCenterX: 253,
  titleTextBaselineY: 152,
  tonicPromptCenters: [[253, 288], [253, 318]] as const,
  tonicPromptRecord: 5,
  top: 127,
} as const

export function hubHagathaPerkSlotAlpha(index: number, charmCapacity: number): number {
  const slotCount = HUB_HAGATHA_PERK_PANE.columns * HUB_HAGATHA_PERK_PANE.rows
  if (!Number.isInteger(index) || index < 0 || index >= slotCount) {
    throw new RangeError('native Hagatha perk slot index must be within [0, 8]')
  }
  return index < charmCapacity ? 1 : HUB_HAGATHA_PERK_PANE.lockedSlotAlpha
}

export function hubHagathaTonicPromptCenter(
  charmCapacity: number,
): readonly [number, number] | null {
  if (charmCapacity < 4) return HUB_HAGATHA_PERK_PANE.tonicPromptCenters[0]
  if (charmCapacity < 8) return HUB_HAGATHA_PERK_PANE.tonicPromptCenters[1]
  return null
}

export const HUB_DOWSING_PREROLL = {
  buttonActionRect: [675, 265.5, 250, 69] as const,
  feeTextBaselineY: 322.5,
  labelTextBaselineY: 302,
  mirrorPromptRect: [693, 54.5, 214, 41] as const,
  referenceDropRect: [750, 101, 100, 149] as const,
} as const

export const HUB_MSGBOX_ART = {
  horizontalEdgeRecord: 10,
  interiorBackgroundRecord: 49,
  interiorFill: 'tiled-clipped',
  innerPanelEdgeUvOrigin: 0.95,
  innerPanelRecord: 17,
  primaryButtonTextTint: 0xd9ba70,
  verticalEdgeRecord: 79,
} as const

export interface HubStandardNotice {
  readonly actionLabel: string
  readonly body: string
  readonly nativeAnchorY: number
  readonly nativeLines: readonly NativeUiMessageDataLineSpec[]
  readonly title: string
  readonly variant: 'standard'
}

interface HubStandardNoticeSpec {
  readonly anchorY: number
  readonly paragraphs: readonly string[]
  readonly title: string
  readonly trailingBlank?: boolean
}

function createHubStandardNotice(spec: HubStandardNoticeSpec): HubStandardNotice {
  const nativeLines: NativeUiMessageDataLineSpec[] = [
    { font: 'menu', gapAfter: 10, text: spec.title },
  ]
  spec.paragraphs.forEach((paragraph, index) => {
    if (index > 0) nativeLines.push({ font: 'medium', text: '' })
    nativeLines.push({ font: 'medium', text: paragraph })
  })
  if (spec.trailingBlank) nativeLines.push({ font: 'medium', text: '' })
  return Object.freeze({
    actionLabel: 'OKAY',
    body: spec.paragraphs.join('\n\n'),
    nativeAnchorY: spec.anchorY,
    nativeLines: Object.freeze(nativeLines),
    title: spec.title,
    variant: 'standard',
  })
}

export function hubStandardNoticeLayout(
  notice: Pick<HubStandardNotice, 'nativeAnchorY' | 'nativeLines'>,
): NativeUiSingleActionMessageLayout {
  return layoutNativeUiSingleActionMessage({
    anchorX: HUB_NATIVE_UI_SIZE.width / 2,
    anchorY: notice.nativeAnchorY,
    height: HUB_NATIVE_UI_SIZE.height,
    lines: notice.nativeLines,
    width: HUB_NATIVE_UI_SIZE.width,
  })
}

export const HUB_NATIVE_UI_TIMING = {
  chatAcceleratedScrollPerTick: 0.8,
  chatRevealPerTick: 0.05,
  chatScrollPerTick: 0.125,
  inventoryRevealPerTick: 0.025,
  messageBoxCurtainAlpha: 0.75,
  messageBoxRevealPerTick: 0.035,
  nativeTickMs: 10,
} as const

export function hubNativeUiElapsedTicks(elapsedMs: number): number {
  return Math.max(0, Math.floor(elapsedMs / HUB_NATIVE_UI_TIMING.nativeTickMs))
}

export function hubNativeUiReveal(elapsedMs: number, incrementPerTick: number): number {
  return Math.min(1, hubNativeUiElapsedTicks(elapsedMs) * incrementPerTick)
}

export function hubNativeUiCloseReveal(
  startProgress: number,
  elapsedMs: number,
  decrementPerTick: number,
): number {
  if (!Number.isFinite(startProgress) || startProgress < 0 || startProgress > 1) {
    throw new RangeError('native InventoryScreen close progress must be within [0, 1]')
  }
  return Math.max(0, startProgress - hubNativeUiElapsedTicks(elapsedMs) * decrementPerTick)
}

export const HUB_DOWSING_FLASH = {
  decrementPerTick: 0.05,
  durationMs: 200,
  durationTicks: 20,
} as const

export function hubDowsingFlashAlpha(elapsedMs: number): number {
  const ticks = Math.min(HUB_DOWSING_FLASH.durationTicks, hubNativeUiElapsedTicks(elapsedMs))
  let alpha = 1
  for (let tick = 0; tick < ticks; tick += 1) {
    alpha = Math.max(0, Math.fround(alpha - HUB_DOWSING_FLASH.decrementPerTick))
  }
  return alpha
}

export function hubDowsingFlashFeedbackSequence(
  feedback: Pick<HubActionFeedback, 'accepted' | 'action' | 'sequence'> | null,
): number | null {
  return feedback?.accepted === true
    && (feedback.action === 'dowse' || feedback.action === 'buy-dowsing')
    ? feedback.sequence
    : null
}

export const HUB_DOWSING_FIELD = {
  greenAmplitude: 0.1,
  greenBase: 0.7,
  phaseDegreesPerTick: 0.5,
  periodTicks: 720,
} as const

export const HUB_DOWSING_INSUFFICIENT_GOLD = createHubStandardNotice({
  anchorY: 350,
  paragraphs: [
    'Peering into the mirror at the endless, swirling, impossible colors of the ether is debilitating.  It is unthinkable that anyone would do so without just compensation, plus a little extra.',
  ],
  title: 'NOT ENOUGH GOLD!',
  trailingBlank: true,
})

export function hubHagathaFullMindNotice(selector: number) {
  return createHubStandardNotice({
    anchorY: 350,
    paragraphs: selector === 27
      ? ["Because the divinatorial phlogiston of your neurologic peridium is already at full capacity, drinking Hagatha's tonic would cause your head to explode!"]
      : [
          'The Thaumic Covalence Meridian of your cortex is full and cannot hold more charms!',
          "Drinking Hagatha's tonic can sublimate the memetic sensorial pathways to allow more charms, but only if you're not already overloaded.",
        ],
    title: 'YOUR MIND IS FULL!',
  })
}

export const HUB_HAT_REMOVAL_MSGBOX = createHubStandardNotice({
  anchorY: 450,
  paragraphs: [
    'A wizard might switch hats.  A wizard might even wear his hat at a jaunty angle.  But a wizard would never, under any circumstances, remove his hat altogether.',
    "After all, if you're not wearing a wizard hat, how would people know to be awed by the presence of a wizard?",
  ],
  title: 'A WIZARD WOULD NEVER REMOVE HIS HAT!',
  trailingBlank: true,
})

export const HUB_ROBE_REMOVAL_MSGBOX = createHubStandardNotice({
  anchorY: 450,
  paragraphs: [
    'A long, intimidating flowing robe looks debonaire on both a gluttonously fat slob and a pathetically wasted weakling.',
    "Strip away the robe and people might make comments about the kind of physique you get from years in wizarding school.  And then you'd have a completely avoidable disintegration on your conscience.",
  ],
  title: 'A WIZARD WOULD NEVER REMOVE HIS ROBE!',
  trailingBlank: true,
})

export const HUB_NATIVE_UI_SURFACES = [
  'dialogue',
  'fomentius-shop',
  'hagatha-perk-shop',
  'luthacus-inventory-shop',
  'shlorio-dowsing-before-roll',
  'shlorio-dowsing-roll-flash',
  'shlorio-dowsing-purchase-flash',
  'shlorio-dowsing-results',
  'shlorio-insufficient-gold-message',
  'inventory',
  'inventory-item-info',
  'contextual-hover-box',
  'inventory-dragger',
  'inventory-dye-clothing',
  'inventory-required-clothing-message',
  'inventory-unforge-confirmation',
  'inventory-unforge-result',
] as const

export function hubDyeSwatchRect(
  index: number,
): readonly [left: number, top: number, width: number, height: number] {
  if (!Number.isInteger(index) || index < 0 || index >= HUB_DYE_CLOTHING.swatchCount) {
    throw new RangeError('native dye swatch index must be within [0, 17]')
  }
  const bank = Math.floor(index / HUB_DYE_CLOTHING.bankSize)
  const bankIndex = index % HUB_DYE_CLOTHING.bankSize
  const column = bankIndex % HUB_DYE_CLOTHING.swatchColumns
  const row = Math.floor(bankIndex / HUB_DYE_CLOTHING.swatchColumns)
  const [originX, originY] = HUB_DYE_CLOTHING.swatchBankOrigins[bank]!
  return [
    originX + column * HUB_DYE_CLOTHING.swatchPitchX,
    originY + row * HUB_DYE_CLOTHING.swatchPitchY,
    HUB_DYE_CLOTHING.swatchSize,
    HUB_DYE_CLOTHING.swatchSize,
  ]
}

export function hubDyeItemLayerRects(
  inventoryIndex: number,
): Readonly<{
  cloth: readonly [number, number, number, number]
  trim: readonly [number, number, number, number]
}> {
  const { x, y } = hubInventorySlotPosition(inventoryIndex)
  const split = HUB_DYE_CLOTHING.itemLayerSplitOffsetY
  return {
    cloth: [x, y, HUB_INVENTORY_GRID.cellSize, split],
    trim: [
      x,
      y + split,
      HUB_INVENTORY_GRID.cellSize,
      HUB_INVENTORY_GRID.cellSize - split,
    ],
  }
}

export function hubDyeModalOpacity(
  openedAtMs: number,
  closingAtMs: number | null,
  nowMs: number,
): number {
  const openedTicks = nativeElapsedTicks(openedAtMs, Math.min(nowMs, closingAtMs ?? nowMs))
  const openedOpacity = Math.min(1, openedTicks * HUB_DYE_CLOTHING.openIncrementPerTick)
  if (closingAtMs === null || nowMs <= closingAtMs) return openedOpacity
  const closingTicks = nativeElapsedTicks(closingAtMs, nowMs)
  return Math.max(0, openedOpacity - closingTicks * HUB_DYE_CLOTHING.closeDecrementPerTick)
}

export function hubDyeSelectedPulse(selectedAtMs: number | null, nowMs: number): number {
  if (selectedAtMs === null) return 0
  return Math.max(
    0,
    1 - nativeElapsedTicks(selectedAtMs, nowMs) * HUB_DYE_CLOTHING.selectedPulseDecrementPerTick,
  )
}

function nativeElapsedTicks(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / HUB_DYE_CLOTHING.nativeTickMs))
}

export function hubOwnedPerkSlotRect(
  index: number,
): readonly [number, number, number, number] {
  const capacity = HUB_HAGATHA_PERK_PANE.columns * HUB_HAGATHA_PERK_PANE.rows
  if (!Number.isInteger(index) || index < 0 || index >= capacity) {
    throw new RangeError('native owned-perk slot index must be within [0, 8]')
  }
  const centerX = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[0]
    + (index % HUB_HAGATHA_PERK_PANE.columns) * HUB_HAGATHA_PERK_PANE.slotPitch
  const centerY = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[1]
    + Math.floor(index / HUB_HAGATHA_PERK_PANE.columns) * HUB_HAGATHA_PERK_PANE.slotPitch
  const half = HUB_HOVER_BOX.ownedPerkSourceExclusionSize / 2
  return [centerX - half, centerY - half, half * 2, half * 2]
}

export function hubInventorySlotPosition(index: number): { x: number; y: number } {
  if (!Number.isInteger(index) || index < 0 || index >= HUB_INVENTORY_GRID.capacity) {
    throw new RangeError('native inventory slot index must be within [0, 87]')
  }
  return {
    x: HUB_INVENTORY_GRID.left + Math.floor(index / HUB_INVENTORY_GRID.rows) * HUB_INVENTORY_GRID.pitch,
    y: HUB_INVENTORY_GRID.top + (index % HUB_INVENTORY_GRID.rows) * HUB_INVENTORY_GRID.pitch,
  }
}

/** Child Sack pages reserve visible cell zero for the native kind-7 parent return holder. */
export function hubInventoryVisibleSlot(
  inventorySlot: number,
  hasParentRoot: boolean,
): number {
  const visibleSlot = inventorySlot + (hasParentRoot ? 1 : 0)
  if (!Number.isInteger(inventorySlot) || inventorySlot < 0
    || visibleSlot >= HUB_INVENTORY_GRID.capacity) {
    throw new RangeError('native inventory root slot is not visible on this page')
  }
  return visibleSlot
}

export function hubInventoryRootSlot(
  visibleSlot: number,
  hasParentRoot: boolean,
): number | null {
  if (!Number.isInteger(visibleSlot) || visibleSlot < 0
    || visibleSlot >= HUB_INVENTORY_GRID.capacity) {
    throw new RangeError('native inventory visible slot must be within [0, 87]')
  }
  if (hasParentRoot && visibleSlot === 0) return null
  return visibleSlot - (hasParentRoot ? 1 : 0)
}

export function hubInventoryEquipmentSlotRects(
  slot: EquipmentSlot,
  companion = false,
): readonly (readonly [number, number, number, number])[] {
  const shift = companion ? 0 : 53
  switch (slot) {
    case 'amulet': return [[1247 + shift, 169, 46, 46]]
    case 'hat': return [[1301 + shift, 143, 72, 72]]
    case 'weapon': return [[1221 + shift, 223, 72, 72], [1381 + shift, 223, 72, 72]]
    case 'robe': return [[1301 + shift, 223, 72, 108]]
    case 'ring-0': return [[1247 + shift, 303, 46, 46]]
    case 'ring-1': return [[1381 + shift, 303, 46, 46]]
    case 'ring-2': return [[1381 + shift, 350, 46, 46]]
  }
}

export function hubShopSlotPosition(index: number): { x: number; y: number } {
  if (!Number.isInteger(index) || index < 0 || index >= HUB_SHOP_GRID.retainedCapacity) {
    throw new RangeError('native shop slot index must be within [0, 27]')
  }
  return {
    x: HUB_SHOP_GRID.left + Math.floor(index / HUB_SHOP_GRID.rows) * HUB_SHOP_GRID.pitchX,
    y: HUB_SHOP_GRID.top + (index % HUB_SHOP_GRID.rows) * HUB_SHOP_GRID.pitchY,
  }
}

export function hubHagathaOfferSlotPosition(index: number): { x: number; y: number } {
  if (!Number.isInteger(index) || index < 0 || index >= HUB_SHOP_GRID.retainedCapacity) {
    throw new RangeError('Hagatha offer slot index must be within [0, 27]')
  }
  return {
    x: HUB_SHOP_GRID.left + (index % HUB_SHOP_GRID.columns) * HUB_SHOP_GRID.pitchX,
    y: HUB_SHOP_GRID.top + Math.floor(index / HUB_SHOP_GRID.columns) * HUB_SHOP_GRID.pitchY,
  }
}

export function hubDowsingSlotPosition(index: number): { x: number; y: number } {
  if (!Number.isInteger(index) || index < 0 || index >= HUB_DOWSING_GRID.retainedCapacity) {
    throw new RangeError('native dowsing slot index must be within [0, 8]')
  }
  return {
    x: HUB_DOWSING_GRID.left + (index % HUB_DOWSING_GRID.columns) * HUB_DOWSING_GRID.pitchX,
    y: HUB_DOWSING_GRID.top + Math.floor(index / HUB_DOWSING_GRID.columns) * HUB_DOWSING_GRID.pitchY,
  }
}

export function hubDowsingFieldTint(nativeTick: number): number {
  const phaseRadians = nativeTick * HUB_DOWSING_FIELD.phaseDegreesPerTick * Math.PI / 180
  const green = Math.round((
    Math.sin(phaseRadians) * HUB_DOWSING_FIELD.greenAmplitude + HUB_DOWSING_FIELD.greenBase
  ) * 255)
  return (0xff << 16) | (green << 8) | 0xff
}

export interface HubInventoryPrimarySpellLine {
  readonly text: string
  readonly unit: ` / ${NativePrimarySpellDamageUnit | NativePrimarySpellManaUnit}` | null
}

type HubInventoryPrimarySpellSource = Pick<
  ProtocolPlayerProgression,
  'inventoryStats' | 'selectedPrimarySkillId' | 'weldBuildId'
>

export function hubInventoryPrimarySpellLines(
  source: HubInventoryPrimarySpellSource,
): readonly HubInventoryPrimarySpellLine[] {
  const descriptor = nativePrimarySpellDescriptor(
    source.selectedPrimarySkillId,
    source.weldBuildId,
  )
  const { primarySpell, manaRecoveryPerSecond } = source.inventoryStats
  const damage = descriptor.damageRange
    ? `${nativePrimaryStatNumber(primarySpell.damageMinimum)} - ${nativePrimaryStatNumber(primarySpell.damageMaximum)}`
    : nativePrimaryStatNumber(primarySpell.damageMaximum)
  return [
    { text: descriptor.name, unit: null },
    { text: `damage: ${damage}`, unit: ` / ${descriptor.damageUnit}` },
    {
      text: `mana cost: ${nativePrimaryStatNumber(primarySpell.manaCost)}`,
      unit: ` / ${descriptor.manaUnit}`,
    },
    {
      text: `mana heal: ${nativePrimaryStatNumber(manaRecoveryPerSecond)}`,
      unit: ' / sec',
    },
  ]
}

function nativePrimaryStatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError('native primary stat value must be finite')
  return value.toFixed(1)
}
