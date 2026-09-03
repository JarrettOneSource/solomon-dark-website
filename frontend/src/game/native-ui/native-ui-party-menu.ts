import { nativeUiFont, type NativeUiFontName } from './native-ui-catalog.ts'
import {
  NATIVE_UI_BUTTON,
  intersectNativeUiRects,
  nativeUiMessageActionBounds,
  nativeUiPlan,
  nativeUiRect,
  planNativeUiButton,
  planNativeUiMessageFrame,
  planNativeUiTabs,
  type NativeUiActionRegion,
  type NativeUiButtonState,
  type NativeUiNode,
  type NativeUiPlan,
  type NativeUiRect,
} from './native-ui-plan.ts'
import {
  clampNativeUiSwipeBoxOffset,
  nativeUiSwipeBoxMaximumOffset,
} from './native-ui-swipe-box.ts'
import { measureNativeUiText } from './native-ui-text.ts'

/**
 * Stock party menu: a message-box frame carrying a tab strip, a scrolling
 * roster (or the settings rows) and a footer of stock buttons. Every node and
 * action comes from this plan so the DOM and Pixi adapters agree on geometry.
 */

export const NATIVE_UI_PARTY_MENU_TABS = ['members', 'mods', 'settings'] as const
export type NativeUiPartyMenuTabId = typeof NATIVE_UI_PARTY_MENU_TABS[number]

export const NATIVE_UI_PARTY_MENU_TAB_LABELS: Readonly<Record<NativeUiPartyMenuTabId, string>> = Object.freeze({
  members: 'Members',
  mods: 'Mods',
  settings: 'Settings',
})

export type NativeUiPartyMenuTag = 'leader' | 'offline' | 'you'

export const NATIVE_UI_PARTY_MENU = Object.freeze({
  /** Row buttons and the visibility plates end this far inside the row's right edge. */
  buttonRightInset: 12,
  codeGap: 18,
  /** Rows start this far inside the frame; the viewport overhangs by `viewportOverhang`. */
  contentInset: 76,
  /** First row top measured from the tab strip top. */
  contentTopOffset: 88,
  curtainAlpha: 0.75,
  dimTint: 0xaaa2a6,
  emptyBaselineOffset: 40,
  /** Error baseline measured from the footer top: the button height plus 30. */
  errorBaselineOffset: 99,
  errorMaxWidth: 680,
  errorTint: 0xff9a8a,
  footerBottomOffset: 125,
  footerGap: 36,
  frame: Object.freeze({ height: 680, left: 390, top: 110, width: 820 }),
  goldTint: 0xd9ba70,
  inkTint: 0x1a1712,
  labelBaselineOffset: 36,
  nameInset: 26,
  plate: Object.freeze({
    gap: 4,
    height: 41,
    idleRecord: 67,
    labelBaselineOffset: 27,
    labelScale: 1.15,
    selectedRecord: 105,
    topOffset: 7.5,
    width: 141,
  }),
  rowButtonGap: 16,
  rowButtonScale: 0.55,
  rowCornerRecord: 50,
  rowHeight: 56,
  rowPitch: 66,
  stockButton: Object.freeze({ height: 69, surroundHeight: 85, width: 353 }),
  tabHeight: 69,
  tabTopOffset: 80,
  tabWidth: 246,
  tagGap: 12,
  tagSpacing: 8,
  titleBaselineOffset: 52,
  viewportFooterGap: 20,
  viewportOverhang: 6,
  whiteTint: 0xffffff,
})

export interface NativeUiPartyMenuMember {
  readonly id: string
  readonly name: string
  /** Leader-only KICK button. */
  readonly removable: boolean
  readonly tags: readonly NativeUiPartyMenuTag[]
}

export interface NativeUiPartyMenuRequest {
  readonly id: string
  readonly name: string
}

export interface NativeUiPartyMenuVisibilityOption {
  readonly id: string
  readonly label: string
}

export interface NativeUiPartyMenuSpec {
  /** Join code shown on the Settings tab; null hides the Party ID rows. */
  readonly code: string | null
  readonly copyLabel?: string
  /** Full-stage curtain alpha behind the frame. Defaults to the stock 0.75. */
  readonly curtainAlpha?: number
  readonly error?: string | null
  readonly height: number
  readonly leader: boolean
  /** Footer leave button label; null or empty omits the button. */
  readonly leaveLabel?: string | null
  readonly members: readonly NativeUiPartyMenuMember[]
  /** Action id currently held down, drawn with the pressed button chrome. */
  readonly pressedId?: string | null
  readonly requests?: readonly NativeUiPartyMenuRequest[]
  readonly scrollY?: number
  readonly selectedTab: NativeUiPartyMenuTabId
  readonly title?: string
  readonly visibility: string
  readonly visibilityOptions: readonly NativeUiPartyMenuVisibilityOption[]
  readonly width: number
}

export interface NativeUiPartyMenuRow {
  readonly bounds: NativeUiRect
  readonly id: string
  readonly visibleBounds: NativeUiRect | null
}

/** Every row button at its unclipped position, including rows scrolled out of view. */
export interface NativeUiPartyMenuRowAction {
  readonly bounds: NativeUiRect
  readonly id: string
  readonly label: string
  readonly rowId: string
}

export interface NativeUiPartyMenuPlan extends NativeUiPlan {
  readonly contentHeight: number
  readonly frameBounds: NativeUiRect
  readonly maximumScrollY: number
  readonly rowActions: readonly NativeUiPartyMenuRowAction[]
  readonly rows: readonly NativeUiPartyMenuRow[]
  readonly scrollY: number
  readonly viewportBounds: NativeUiRect
}

export type NativeUiPartyMenuActionKind =
  | 'accept'
  | 'close'
  | 'copy'
  | 'deny'
  | 'generate'
  | 'kick'
  | 'leave'
  | 'tab'
  | 'visibility'

export interface NativeUiPartyMenuAction {
  readonly kind: NativeUiPartyMenuActionKind
  /** Member, request, tab or visibility id after the kind prefix; empty otherwise. */
  readonly target: string
}

const ACTION_KINDS: ReadonlySet<string> = new Set<NativeUiPartyMenuActionKind>([
  'accept',
  'close',
  'copy',
  'deny',
  'generate',
  'kick',
  'leave',
  'tab',
  'visibility',
])

/** Splits a plan action id such as `kick:player-7` into its kind and target. */
export function parseNativeUiPartyMenuAction(id: string): NativeUiPartyMenuAction | null {
  const separator = id.indexOf(':')
  const kind = separator === -1 ? id : id.slice(0, separator)
  if (!ACTION_KINDS.has(kind)) return null
  return {
    kind: kind as NativeUiPartyMenuActionKind,
    target: separator === -1 ? '' : id.slice(separator + 1),
  }
}

export function isNativeUiPartyMenuTabId(value: string): value is NativeUiPartyMenuTabId {
  return (NATIVE_UI_PARTY_MENU_TABS as readonly string[]).includes(value)
}

const ROSTER_FONT: NativeUiFontName = 'world-and-roster'
const FALLBACK_NAME_FONT: NativeUiFontName = 'menu'

/**
 * The roster face only carries letters, digits and a little punctuation, so a
 * name with anything else (a hyphen, an underscore) drops to the menu face.
 */
export function nativeUiPartyMenuNameFont(name: string): NativeUiFontName {
  const glyphs = nativeUiFont(ROSTER_FONT).glyphs
  for (const character of name) {
    if (character === ' ') continue
    if (!(`${character.codePointAt(0)}` in glyphs)) return FALLBACK_NAME_FONT
  }
  return ROSTER_FONT
}

/** Drops trailing characters until the text fits `maxWidth` at the given face. */
export function fitNativeUiPartyMenuText(
  text: string,
  font: NativeUiFontName,
  maxWidth: number,
  scale = 1,
): string {
  let candidate = text
  while (candidate.length > 0 && measureNativeUiText(candidate, font, scale) > maxWidth) {
    candidate = Array.from(candidate).slice(0, -1).join('').trimEnd()
  }
  return candidate
}

export interface NativeUiPartyMenuTagPresentation {
  readonly label: string
  readonly tint: number
}

export const NATIVE_UI_PARTY_MENU_TAGS: Readonly<Record<NativeUiPartyMenuTag, NativeUiPartyMenuTagPresentation>> = Object.freeze({
  leader: { label: 'LEADER', tint: NATIVE_UI_PARTY_MENU.goldTint },
  offline: { label: 'OFFLINE', tint: NATIVE_UI_PARTY_MENU.dimTint },
  you: { label: 'YOU', tint: NATIVE_UI_PARTY_MENU.dimTint },
})

interface RowButtonSpec {
  readonly id: string
  readonly label: string
}

interface RowSpec {
  /** Listed right to left: the first button hugs the row's right edge. */
  readonly buttons: readonly RowButtonSpec[]
  readonly id: string
  readonly name: string
  readonly tags: readonly NativeUiPartyMenuTagPresentation[]
}

interface ListPlan {
  readonly contentHeight: number
  readonly maximumScrollY: number
  readonly rowActions: readonly NativeUiPartyMenuRowAction[]
  readonly rows: readonly NativeUiPartyMenuRow[]
  readonly scrollY: number
}

const EMPTY_LIST: ListPlan = Object.freeze({
  contentHeight: 0,
  maximumScrollY: 0,
  rowActions: [],
  rows: [],
  scrollY: 0,
})

type ButtonStateOf = (id: string) => NativeUiButtonState

interface PlanSink {
  readonly actions: NativeUiActionRegion[]
  readonly buttonState: ButtonStateOf
  readonly nodes: NativeUiNode[]
}

/** Body bounds of a stock button scaled to sit inside a 56-tall row, ending at `rightEdge`. */
export function nativeUiPartyMenuRowButtonBounds(
  rightEdge: number,
  rowTop: number,
): Readonly<{ body: NativeUiRect; surroundWidth: number }> {
  const spec = NATIVE_UI_PARTY_MENU
  const scale = spec.rowButtonScale
  const surround = NATIVE_UI_BUTTON.surround * scale
  const width = spec.stockButton.width * scale
  const height = spec.stockButton.height * scale
  const surroundWidth = width + surround * 2
  const surroundHeight = spec.stockButton.surroundHeight * scale
  const top = rowTop + (spec.rowHeight - surroundHeight) / 2 + surround
  return {
    body: nativeUiRect(rightEdge - surroundWidth + surround, top, width, height),
    surroundWidth,
  }
}

export function planNativeUiPartyMenu(spec: NativeUiPartyMenuSpec): NativeUiPartyMenuPlan {
  const layout = NATIVE_UI_PARTY_MENU
  const frame = nativeUiRect(layout.frame.left, layout.frame.top, layout.frame.width, layout.frame.height)
  const centerX = frame.left + frame.width / 2
  const frameBottom = frame.top + frame.height
  const tabTop = frame.top + layout.tabTopOffset
  const contentTop = tabTop + layout.contentTopOffset
  const footerTop = frameBottom - layout.footerBottomOffset
  const viewport = nativeUiRect(
    frame.left + layout.contentInset - layout.viewportOverhang,
    contentTop,
    frame.width - layout.contentInset * 2 + layout.viewportOverhang * 2,
    footerTop - layout.viewportFooterGap - contentTop,
  )
  const pressedId = spec.pressedId ?? null
  const sink: PlanSink = {
    actions: [],
    buttonState: id => (id === pressedId ? 'pressed' : 'idle'),
    nodes: [],
  }

  // The message frame supplies the curtain, background, edges, corners and
  // ornaments; its title and body slots stay empty because the party title is
  // centred in gold instead.
  const frameNodes = planNativeUiMessageFrame({
    body: '',
    bounds: frame,
    dimAlpha: spec.curtainAlpha ?? layout.curtainAlpha,
    height: spec.height,
    title: '',
    width: spec.width,
  }).nodes.filter(node => node.kind !== 'text')
  sink.nodes.push(...frameNodes, {
    kind: 'text',
    label: 'party:title',
    text: {
      font: 'menu',
      text: spec.title ?? 'PARTY',
      tint: layout.goldTint,
      x: centerX,
      y: frame.top + layout.titleBaselineOffset,
    },
  })

  const tabsLeft = frame.left + (frame.width - layout.tabWidth * NATIVE_UI_PARTY_MENU_TABS.length) / 2
  const tabs = planNativeUiTabs({
    height: spec.height,
    selectedId: `tab:${spec.selectedTab}`,
    tabs: NATIVE_UI_PARTY_MENU_TABS.map((tab, index) => ({
      bounds: nativeUiRect(tabsLeft + index * layout.tabWidth, tabTop, layout.tabWidth, layout.tabHeight),
      id: `tab:${tab}`,
      label: NATIVE_UI_PARTY_MENU_TAB_LABELS[tab],
    })),
    width: spec.width,
  })
  sink.nodes.push(...tabs.nodes)
  sink.actions.push(...tabs.actions)

  let list: ListPlan = EMPTY_LIST
  if (spec.selectedTab === 'members') {
    list = planMemberList(spec, viewport, sink)
  } else if (spec.selectedTab === 'settings') {
    planSettings(spec, viewport, contentTop, sink)
  } else {
    sink.nodes.push(noteNode('party:empty', 'Nothing here yet.', centerX, contentTop + layout.emptyBaselineOffset))
  }

  const footer: readonly (readonly [id: string, label: string])[] = spec.leaveLabel
    ? [['leave', spec.leaveLabel], ['close', 'CLOSE']]
    : [['close', 'CLOSE']]
  const footerBounds = nativeUiMessageActionBounds(frame, footer.length === 2 ? 2 : 1, {
    gap: layout.footerGap,
    top: footerTop,
  })
  footer.forEach(([id, label], index) => {
    const button = planNativeUiButton({ bounds: footerBounds[index]!, id, label, state: sink.buttonState(id) })
    sink.nodes.push(...button.nodes)
    sink.actions.push(...button.actions)
  })

  if (spec.error) {
    sink.nodes.push({
      kind: 'text',
      label: 'party:error',
      text: {
        font: 'medium',
        text: fitNativeUiPartyMenuText(spec.error, 'medium', layout.errorMaxWidth),
        tint: layout.errorTint,
        x: centerX,
        y: footerTop + layout.errorBaselineOffset,
      },
    })
  }

  return {
    ...nativeUiPlan(spec.width, spec.height, { actions: sink.actions, nodes: sink.nodes }),
    contentHeight: list.contentHeight,
    frameBounds: frame,
    maximumScrollY: list.maximumScrollY,
    rowActions: list.rowActions,
    rows: list.rows,
    scrollY: list.scrollY,
    viewportBounds: viewport,
  }
}

function planMemberList(
  spec: NativeUiPartyMenuSpec,
  viewport: NativeUiRect,
  sink: PlanSink,
): ListPlan {
  const layout = NATIVE_UI_PARTY_MENU
  const rowSpecs: RowSpec[] = [
    ...(spec.requests ?? []).map((request): RowSpec => ({
      buttons: [
        { id: `deny:${request.id}`, label: 'DENY' },
        { id: `accept:${request.id}`, label: 'ACCEPT' },
      ],
      id: `request:${request.id}`,
      name: request.name,
      tags: [{ label: 'WANTS TO JOIN', tint: layout.goldTint }],
    })),
    ...spec.members.map((member): RowSpec => ({
      buttons: member.removable ? [{ id: `kick:${member.id}`, label: 'KICK' }] : [],
      id: `member:${member.id}`,
      name: member.name,
      tags: member.tags.map(tag => NATIVE_UI_PARTY_MENU_TAGS[tag]),
    })),
  ]
  const contentHeight = rowSpecs.length === 0
    ? 0
    : rowSpecs.length * layout.rowPitch - (layout.rowPitch - layout.rowHeight)
  const maximumScrollY = nativeUiSwipeBoxMaximumOffset(contentHeight, viewport.height)
  const scrollY = clampNativeUiSwipeBoxOffset(spec.scrollY ?? 0, contentHeight, viewport.height)
  const rows: NativeUiPartyMenuRow[] = []
  const rowActions: NativeUiPartyMenuRowAction[] = []
  const clipped: NativeUiNode[] = []

  rowSpecs.forEach((row, index) => {
    const bounds = nativeUiRect(
      viewport.left,
      viewport.top + index * layout.rowPitch - scrollY,
      viewport.width,
      layout.rowHeight,
    )
    const visibleBounds = intersectNativeUiRects(bounds, viewport)
    rows.push({ bounds, id: row.id, visibleBounds })

    let rightEdge = bounds.left + bounds.width - layout.buttonRightInset
    const buttons = row.buttons.map((button) => {
      const { body, surroundWidth } = nativeUiPartyMenuRowButtonBounds(rightEdge, bounds.top)
      rightEdge -= surroundWidth + layout.rowButtonGap
      rowActions.push({ bounds: body, id: button.id, label: button.label, rowId: row.id })
      return { ...button, body }
    })
    if (visibleBounds === null) return

    clipped.push(...nativeUiPartyMenuBracketRowNodes(row.id, bounds))
    const nameX = bounds.left + layout.nameInset
    const baseline = bounds.top + layout.labelBaselineOffset
    const tagsWidth = row.tags.reduce((total, tag, tagIndex) => (
      total + measureNativeUiText(tag.label, 'body') + (tagIndex > 0 ? layout.tagSpacing : 0)
    ), 0)
    const nameLimit = rightEdge - nameX - (row.tags.length > 0 ? tagsWidth + layout.tagGap : 0)
    const font = nativeUiPartyMenuNameFont(row.name)
    const name = fitNativeUiPartyMenuText(row.name, font, nameLimit)
    if (name) {
      clipped.push({
        kind: 'text',
        label: `${row.id}:name`,
        text: { align: 'left', font, text: name, tint: layout.whiteTint, x: nameX, y: baseline },
      })
    }
    let tagX = nameX + measureNativeUiText(name, font) + layout.tagGap
    row.tags.forEach((tag, tagIndex) => {
      clipped.push({
        kind: 'text',
        label: `${row.id}:tag-${tagIndex}`,
        text: { align: 'left', font: 'body', text: tag.label, tint: tag.tint, x: tagX, y: baseline },
      })
      tagX += measureNativeUiText(tag.label, 'body') + layout.tagSpacing
    })
    for (const button of buttons) {
      const fragment = planNativeUiButton({
        bounds: button.body,
        id: button.id,
        label: button.label,
        scale: layout.rowButtonScale,
        state: sink.buttonState(button.id),
      })
      clipped.push(...fragment.nodes)
      const visibleButton = intersectNativeUiRects(button.body, viewport)
      if (visibleButton) {
        sink.actions.push({ bounds: visibleButton, disabled: false, id: button.id, role: 'button' })
      }
    }
  })

  sink.nodes.push({ bounds: viewport, kind: 'clip', label: 'party:swipe-box', nodes: clipped })
  if (rowSpecs.length === 0) {
    sink.nodes.push(noteNode(
      'party:empty',
      'No members yet.',
      viewport.left + viewport.width / 2,
      viewport.top + layout.emptyBaselineOffset,
    ))
  }
  return { contentHeight, maximumScrollY, rowActions, rows, scrollY }
}

function planSettings(
  spec: NativeUiPartyMenuSpec,
  viewport: NativeUiRect,
  contentTop: number,
  sink: PlanSink,
): void {
  const layout = NATIVE_UI_PARTY_MENU
  const labelX = viewport.left + layout.nameInset
  const rightEdge = viewport.left + viewport.width - layout.buttonRightInset
  const rowTop = (index: number) => contentTop + index * layout.rowPitch
  const settingsRow = (id: string, index: number, label: string): NativeUiRect => {
    const bounds = nativeUiRect(viewport.left, rowTop(index), viewport.width, layout.rowHeight)
    sink.nodes.push(...nativeUiPartyMenuBracketRowNodes(id, bounds), {
      kind: 'text',
      label: `${id}:label`,
      text: {
        align: 'left',
        font: ROSTER_FONT,
        text: label,
        tint: layout.whiteTint,
        x: labelX,
        y: bounds.top + layout.labelBaselineOffset,
      },
    })
    return bounds
  }
  const rowButton = (row: NativeUiRect, id: string, label: string) => {
    const { body } = nativeUiPartyMenuRowButtonBounds(rightEdge, row.top)
    const fragment = planNativeUiButton({
      bounds: body,
      id,
      label,
      scale: layout.rowButtonScale,
      state: sink.buttonState(id),
    })
    sink.nodes.push(...fragment.nodes)
    sink.actions.push(...fragment.actions)
  }

  const visibilityRow = settingsRow('visibility', 0, 'Visibility')
  const plateCount = spec.visibilityOptions.length
  const platesWidth = plateCount * layout.plate.width + Math.max(0, plateCount - 1) * layout.plate.gap
  const platesLeft = rightEdge - platesWidth
  const plateTop = visibilityRow.top + layout.plate.topOffset
  spec.visibilityOptions.forEach((option, index) => {
    const left = platesLeft + index * (layout.plate.width + layout.plate.gap)
    const selected = option.id === spec.visibility
    const id = `visibility:${option.id}`
    sink.nodes.push(
      {
        atlas: 'UI',
        kind: 'sprite',
        label: `${id}:plate`,
        record: selected ? layout.plate.selectedRecord : layout.plate.idleRecord,
        x: left,
        y: plateTop,
      },
      {
        kind: 'text',
        label: `${id}:label`,
        text: {
          font: 'control-panel',
          scale: layout.plate.labelScale,
          text: option.label,
          tint: selected ? layout.whiteTint : layout.inkTint,
          x: left + layout.plate.width / 2,
          y: plateTop + layout.plate.labelBaselineOffset,
        },
      },
    )
    sink.actions.push({
      bounds: nativeUiRect(left, plateTop, layout.plate.width, layout.plate.height),
      disabled: !spec.leader,
      id,
      role: 'button',
    })
  })

  if (!spec.leader) {
    sink.nodes.push(noteNode(
      'party:leader-note',
      'Only the party leader can change these settings.',
      viewport.left + viewport.width / 2,
      rowTop(1) + layout.labelBaselineOffset,
    ))
    return
  }
  if (spec.code === null) return

  const codeRow = settingsRow('party-id', 1, 'Party ID')
  sink.nodes.push({
    kind: 'text',
    label: 'party-id:code',
    text: {
      align: 'left',
      font: 'menu',
      text: spec.code,
      tint: layout.goldTint,
      x: labelX + measureNativeUiText('Party ID', ROSTER_FONT) + layout.codeGap,
      y: codeRow.top + layout.labelBaselineOffset,
    },
  })
  rowButton(codeRow, 'copy', spec.copyLabel ?? 'COPY')
  const generateRow = settingsRow('new-party-id', 2, 'New party ID')
  rowButton(generateRow, 'generate', 'GENERATE')
}

/** Four UI.50 corner ticks framing a row, mirrored about the row's far edges. */
export function nativeUiPartyMenuBracketRowNodes(id: string, bounds: NativeUiRect): NativeUiNode[] {
  const record = NATIVE_UI_PARTY_MENU.rowCornerRecord
  const right = bounds.left + bounds.width
  const bottom = bounds.top + bounds.height
  return [
    { atlas: 'UI', kind: 'sprite', label: `${id}:corner-top-left`, record, x: bounds.left, y: bounds.top },
    { atlas: 'UI', kind: 'sprite', label: `${id}:corner-top-right`, mirrorX: true, record, x: right, y: bounds.top },
    { atlas: 'UI', kind: 'sprite', label: `${id}:corner-bottom-left`, mirrorY: true, record, x: bounds.left, y: bottom },
    {
      atlas: 'UI',
      kind: 'sprite',
      label: `${id}:corner-bottom-right`,
      mirrorX: true,
      mirrorY: true,
      record,
      x: right,
      y: bottom,
    },
  ]
}

function noteNode(label: string, text: string, x: number, y: number): NativeUiNode {
  return {
    kind: 'text',
    label,
    text: { font: 'medium', text, tint: NATIVE_UI_PARTY_MENU.dimTint, x, y },
  }
}
