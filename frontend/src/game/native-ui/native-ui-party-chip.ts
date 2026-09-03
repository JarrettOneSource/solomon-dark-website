import { nativeUiRecord } from './native-ui-catalog.ts'
import {
  NATIVE_UI_MESSAGE,
  nativeUiMessageActionBounds,
  nativeUiPlan,
  nativeUiRect,
  type NativeUiActionRegion,
  type NativeUiNode,
  type NativeUiPlan,
  type NativeUiRect,
} from './native-ui-plan.ts'
import {
  NATIVE_UI_PARTY_MENU,
  NATIVE_UI_PARTY_MENU_TAGS,
  fitNativeUiPartyMenuText,
  nativeUiPartyMenuBracketRowNodes,
  nativeUiPartyMenuNameFont,
  type NativeUiPartyMenuMember,
  type NativeUiPartyMenuRequest,
  type NativeUiPartyMenuTagPresentation,
} from './native-ui-party-menu.ts'
import { measureNativeUiText } from './native-ui-text.ts'

/**
 * The hub party chip: the party menu's marble and UI.17 frame at card size, a
 * skull, PARTY, the boneyard editor's gear in gold and the control-panel arrow
 * in a 50 px header, and the menu's UI.50 bracket rows hanging under it.
 * Everything is measured in chip pixels from the card's top-left corner; the
 * host places and scales the card (1:1 on a pointer, 0.55 on touch).
 */
export const NATIVE_UI_PARTY_CHIP = Object.freeze({
  /** ControlPanel.0, centred; rotated a quarter turn to point down while a touch chip is open. */
  arrow: Object.freeze({ record: 0, x: 215, y: 25 }),
  backgroundRecord: NATIVE_UI_MESSAGE.backgroundRecord,
  /** First body line (error or row) starts here. */
  bodyTop: 54,
  bottomPad: 12,
  error: Object.freeze({ baselineOffset: 13, height: 22, scale: 0.85 }),
  /** UI.17 corners scaled to the card; the bare header takes the finer scale. */
  frame: Object.freeze({
    collapsedScale: 0.3,
    edgeUvOrigin: NATIVE_UI_MESSAGE.innerEdgeUvOrigin,
    record: NATIVE_UI_MESSAGE.innerFrameRecord,
    scale: 0.4,
  }),
  /** Bonedit.54 tinted gold, right edge at 198 and centred on the header line; the hit box is larger. */
  gear: Object.freeze({
    centerY: 25,
    hitBounds: Object.freeze({ height: 44, left: 168, top: 3, width: 40 }),
    record: 54,
    rightEdge: 198,
    scale: 0.6,
  }),
  headerHeight: 50,
  name: Object.freeze({ baselineOffset: 21, scale: 0.65 }),
  row: Object.freeze({ height: 32, left: 12, pitch: 36, width: 212 }),
  /** Text left edge inside a row and for the error line. */
  rowInset: 24,
  skull: Object.freeze({ record: 38, scale: 0.5, x: 14, y: 12.25 }),
  tagSpacing: 8,
  title: Object.freeze({ baseline: 33, x: 42 }),
  width: 236,
})

/** The invitation is the stock message box with the party menu's footer line. */
export const NATIVE_UI_PARTY_INVITATION = Object.freeze({
  bounds: nativeUiRect(550, 268, 500, 362),
  footerBottomOffset: NATIVE_UI_PARTY_MENU.footerBottomOffset,
  footerGap: NATIVE_UI_PARTY_MENU.footerGap,
  title: 'PARTY INVITATION',
})

export type NativeUiPartyChipMember = Pick<NativeUiPartyMenuMember, 'id' | 'name' | 'tags'>
export type NativeUiPartyChipRequest = NativeUiPartyMenuRequest

export interface NativeUiPartyChipSpec {
  /** Touch: the header toggles the rows and the arrow points down while they show. */
  readonly collapsible?: boolean
  readonly error?: string | null
  readonly expanded: boolean
  readonly members: readonly NativeUiPartyChipMember[]
  /** Pending join requests, listed after the members as WANTS TO JOIN rows. */
  readonly requests?: readonly NativeUiPartyChipRequest[]
  /** Draws the gear and its `settings` action. */
  readonly settings?: boolean
}

export interface NativeUiPartyChipRow {
  readonly bounds: NativeUiRect
  readonly id: string
}

export interface NativeUiPartyChipPlan extends NativeUiPlan {
  readonly headerBounds: NativeUiRect
  readonly rows: readonly NativeUiPartyChipRow[]
}

export type NativeUiPartyChipActionKind = 'header' | 'member' | 'request' | 'settings'

export interface NativeUiPartyChipAction {
  readonly kind: NativeUiPartyChipActionKind
  /** Member or request id after the kind prefix; empty for the header and the gear. */
  readonly target: string
}

const ACTION_KINDS: ReadonlySet<string> = new Set<NativeUiPartyChipActionKind>([
  'header',
  'member',
  'request',
  'settings',
])

/** Splits a chip action id such as `member:player-7` into its kind and target. */
export function parseNativeUiPartyChipAction(id: string): NativeUiPartyChipAction | null {
  const separator = id.indexOf(':')
  const kind = separator === -1 ? id : id.slice(0, separator)
  if (!ACTION_KINDS.has(kind)) return null
  return {
    kind: kind as NativeUiPartyChipActionKind,
    target: separator === -1 ? '' : id.slice(separator + 1),
  }
}

/** ACCEPT and DENY bounds on the party menu's footer line inside the invitation box. */
export function nativeUiPartyInvitationActionBounds(): readonly NativeUiRect[] {
  const { bounds, footerBottomOffset, footerGap } = NATIVE_UI_PARTY_INVITATION
  return nativeUiMessageActionBounds(bounds, 2, {
    gap: footerGap,
    top: bounds.top + bounds.height - footerBottomOffset,
  })
}

export function nativeUiPartyInvitationBody(inviter: string): string {
  return `${inviter} invited you to their party.`
}

interface ChipRowSpec {
  readonly id: string
  readonly name: string
  readonly tags: readonly NativeUiPartyMenuTagPresentation[]
}

export function planNativeUiPartyChip(spec: NativeUiPartyChipSpec): NativeUiPartyChipPlan {
  const layout = NATIVE_UI_PARTY_CHIP
  const collapsible = spec.collapsible ?? false
  const actions: NativeUiActionRegion[] = []
  const body: NativeUiNode[] = []
  const rows: NativeUiPartyChipRow[] = []
  // Row text sits one inset in from either chip edge, so it clears the bracket
  // corners by the same 12 px on both sides.
  const textLeft = layout.rowInset
  const textRight = layout.width - layout.rowInset
  const textWidth = textRight - textLeft

  let y = layout.bodyTop
  const error = spec.error
    ? fitNativeUiPartyMenuText(spec.error, 'medium', textWidth, layout.error.scale)
    : ''
  if (error) {
    body.push({
      kind: 'text',
      label: 'chip:error',
      text: {
        align: 'left',
        font: 'medium',
        scale: layout.error.scale,
        text: error,
        tint: NATIVE_UI_PARTY_MENU.errorTint,
        x: textLeft,
        y: y + layout.error.baselineOffset,
      },
    })
    y += layout.error.height
  }

  const rowSpecs: ChipRowSpec[] = spec.expanded
    ? [
        ...spec.members.map((member): ChipRowSpec => ({
          id: `member:${member.id}`,
          name: member.name,
          tags: member.tags.map(tag => NATIVE_UI_PARTY_MENU_TAGS[tag]),
        })),
        ...(spec.requests ?? []).map((request): ChipRowSpec => ({
          id: `request:${request.id}`,
          name: request.name,
          tags: [{ label: 'WANTS TO JOIN', tint: NATIVE_UI_PARTY_MENU.goldTint }],
        })),
      ]
    : []
  for (const row of rowSpecs) {
    const bounds = nativeUiRect(layout.row.left, y, layout.row.width, layout.row.height)
    rows.push({ bounds, id: row.id })
    actions.push({ bounds, disabled: false, id: row.id, role: 'button' })
    body.push(...nativeUiPartyMenuBracketRowNodes(row.id, bounds))
    const baseline = bounds.top + layout.name.baselineOffset
    const tagsWidth = row.tags.reduce((total, tag, index) => (
      total + measureNativeUiText(tag.label, 'body') + (index > 0 ? layout.tagSpacing : 0)
    ), 0)
    const tagsLeft = textRight - tagsWidth
    const nameLimit = row.tags.length > 0
      ? tagsLeft - layout.tagSpacing - textLeft
      : textWidth
    const font = nativeUiPartyMenuNameFont(row.name)
    const name = fitNativeUiPartyMenuText(row.name, font, nameLimit, layout.name.scale)
    if (name) {
      body.push({
        kind: 'text',
        label: `${row.id}:name`,
        text: {
          align: 'left',
          font,
          scale: layout.name.scale,
          text: name,
          tint: NATIVE_UI_PARTY_MENU.whiteTint,
          x: textLeft,
          y: baseline,
        },
      })
    }
    let tagX = tagsLeft
    row.tags.forEach((tag, index) => {
      body.push({
        kind: 'text',
        label: `${row.id}:tag-${index}`,
        text: { align: 'left', font: 'body', text: tag.label, tint: tag.tint, x: tagX, y: baseline },
      })
      tagX += measureNativeUiText(tag.label, 'body') + layout.tagSpacing
    })
    y += layout.row.pitch
  }

  // With a body the card ends one pad under the last line; a bare header is 50 px
  // and takes the finer frame so two corners still fit.
  const tall = body.length > 0
  const height = tall
    ? y - (layout.row.pitch - layout.row.height) + layout.bottomPad
    : layout.headerHeight
  const headerBounds = nativeUiRect(0, 0, layout.width, layout.headerHeight)
  const nodes: NativeUiNode[] = [
    {
      atlas: 'UI',
      bounds: nativeUiRect(0, 0, layout.width, height),
      kind: 'tile',
      label: 'chip:background',
      record: layout.backgroundRecord,
    },
    ...frameNodes(layout.width, height, tall ? layout.frame.scale : layout.frame.collapsedScale),
    {
      atlas: 'UI',
      kind: 'sprite',
      label: 'chip:skull',
      record: layout.skull.record,
      scale: layout.skull.scale,
      x: layout.skull.x,
      y: layout.skull.y,
    },
    {
      kind: 'text',
      label: 'chip:title',
      text: {
        align: 'left',
        font: 'menu',
        text: 'PARTY',
        tint: NATIVE_UI_PARTY_MENU.goldTint,
        x: layout.title.x,
        y: layout.title.baseline,
      },
    },
  ]
  const headerActions: NativeUiActionRegion[] = [
    { bounds: headerBounds, disabled: false, id: 'header', role: 'button' },
  ]
  if (spec.settings) {
    const [gearWidth, gearHeight] = nativeUiRecord('Bonedit', layout.gear.record).logicalSize
    nodes.push({
      atlas: 'Bonedit',
      kind: 'sprite',
      label: 'chip:gear',
      record: layout.gear.record,
      scale: layout.gear.scale,
      tint: NATIVE_UI_PARTY_MENU.goldTint,
      x: layout.gear.rightEdge - gearWidth * layout.gear.scale,
      y: layout.gear.centerY - (gearHeight * layout.gear.scale) / 2,
    })
    const hit = layout.gear.hitBounds
    // The gear sits inside the header action; adapters resolve the later action on top.
    headerActions.push({
      bounds: nativeUiRect(hit.left, hit.top, hit.width, hit.height),
      disabled: false,
      id: 'settings',
      role: 'button',
    })
  }
  nodes.push({
    anchor: [0.5, 0.5],
    atlas: 'ControlPanel',
    kind: 'sprite',
    label: 'chip:arrow',
    record: layout.arrow.record,
    x: layout.arrow.x,
    y: layout.arrow.y,
    ...(collapsible && spec.expanded ? { rotation: Math.PI / 2 } : {}),
  })
  nodes.push(...body)

  return {
    ...nativeUiPlan(layout.width, height, { actions: [...headerActions, ...actions], nodes }),
    headerBounds,
    rows,
  }
}

/**
 * UI.17 around the card: four scaled corner sprites mirrored at the far edges
 * and the record's outer strips stretched along each side, the way the stock
 * nine-slice composes it, minus the centre the marble already fills.
 */
function frameNodes(width: number, height: number, scale: number): NativeUiNode[] {
  const { edgeUvOrigin, record } = NATIVE_UI_PARTY_CHIP.frame
  const [logicalWidth, logicalHeight] = nativeUiRecord('UI', record).logicalSize
  const cornerWidth = logicalWidth * scale
  const cornerHeight = logicalHeight * scale
  const middleWidth = width - cornerWidth * 2
  const middleHeight = height - cornerHeight * 2
  const nodes: NativeUiNode[] = [
    { atlas: 'UI', kind: 'sprite', label: 'chip:frame-corner-top-left', record, scale, x: 0, y: 0 },
    { atlas: 'UI', kind: 'sprite', label: 'chip:frame-corner-top-right', mirrorX: true, record, scale, x: width, y: 0 },
    { atlas: 'UI', kind: 'sprite', label: 'chip:frame-corner-bottom-left', mirrorY: true, record, scale, x: 0, y: height },
    {
      atlas: 'UI',
      kind: 'sprite',
      label: 'chip:frame-corner-bottom-right',
      mirrorX: true,
      mirrorY: true,
      record,
      scale,
      x: width,
      y: height,
    },
  ]
  if (middleWidth >= 1) {
    const horizontal: readonly [left: number, top: number, right: number, bottom: number] = [edgeUvOrigin, 0, 1, 1]
    nodes.push(
      {
        atlas: 'UI',
        bounds: nativeUiRect(cornerWidth, 0, middleWidth, cornerHeight),
        kind: 'slice',
        label: 'chip:frame-edge-top',
        record,
        sourceUv: horizontal,
      },
      {
        atlas: 'UI',
        bounds: nativeUiRect(cornerWidth, height - cornerHeight, middleWidth, cornerHeight),
        kind: 'slice',
        label: 'chip:frame-edge-bottom',
        mirrorY: true,
        record,
        sourceUv: horizontal,
      },
    )
  }
  if (middleHeight >= 1) {
    const vertical: readonly [left: number, top: number, right: number, bottom: number] = [0, edgeUvOrigin, 1, 1]
    nodes.push(
      {
        atlas: 'UI',
        bounds: nativeUiRect(0, cornerHeight, cornerWidth, middleHeight),
        kind: 'slice',
        label: 'chip:frame-edge-left',
        record,
        sourceUv: vertical,
      },
      {
        atlas: 'UI',
        bounds: nativeUiRect(width - cornerWidth, cornerHeight, cornerWidth, middleHeight),
        kind: 'slice',
        label: 'chip:frame-edge-right',
        mirrorX: true,
        record,
        sourceUv: vertical,
      },
    )
  }
  return nodes
}
