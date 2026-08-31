/**
 * Tutorial teaching overlay for the inventory (stage 10) and skill-book
 * (stage 13) modals, recovered from `Tutorial::Render` (`0x005D08C0`) in
 * SolomonDark.exe 0.72.5 — see `docs/game-native-parity-re.md` (2026-08-25)
 * and the Mod Loader's `docs/reverse-engineering/native-hud.md`.
 *
 * Every callout and pointer is anchored to a live native rectangle: the slid
 * HUD controls (`0x005C7200`) and skill-book page placements retain stock
 * ownership. The user-authorized Website improvement targets the exact
 * authored Tutorial amulet's live backpack cell and amulet body sink instead
 * of retail's fixed cell 0 / STAFF-WAND sink. Coordinates remain native
 * back-buffer pixels of the 1600x900 stage; the scene's fixed native stage
 * scales them to the viewport.
 */

import { projectInventoryRootSlots, type HubInventoryItem } from './core-kernels/hub-economy.ts'
import { nativeTutorialAmuletIdentityMatches } from './core-kernels/native-tutorial.ts'
import {
  NATIVE_HUD_BACKBUFFER,
  nativeHudModalSlideLayout,
  nativeHudRectCenter,
  type NativeHudPoint,
  type NativeHudRect,
} from './native-hud-layout.ts'
import { measureNativeUiText, nativeUiFont } from './native-ui/core.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import {
  HUB_INVENTORY_GRID,
  hubInventoryEquipmentSlotRects,
  hubInventorySlotPosition,
} from './renderer/hub-inventory-render-contract.ts'
import { nativeSkillBookPagePlacements, nativeSkillBookPages } from './skill-book-model.ts'

export type TutorialModalCalloutId =
  | 'backpack'
  | 'concentration'
  | 'concentration-limit'
  | 'equipment'
  | 'hover'
  | 'quick-use'
  | 'resume'

export type TutorialModalPointerId =
  | 'backpack'
  | 'concentration'
  | 'equipment'
  | 'hover'
  | 'quick-use'
  | 'resume'

export interface TutorialCalloutLine {
  readonly text: string
  readonly width: number
  /** Left edge of the centred line: `trunc(cx - w_k / 2)`. */
  readonly x: number
  /** Native text y of line k: `trunc(cy) + 25k`. */
  readonly y: number
}

export interface TutorialCalloutGeometry {
  readonly centerX: number
  readonly centerY: number
  readonly frame: NativeHudRect
  readonly lines: readonly TutorialCalloutLine[]
  readonly textHeight: number
  readonly textWidth: number
}

export interface TutorialModalCalloutPlan {
  readonly geometry: TutorialCalloutGeometry
  readonly id: TutorialModalCalloutId
  readonly kind: 'callout'
  readonly text: string
}

export interface TutorialModalPointerPlan {
  readonly blink: boolean
  readonly id: TutorialModalPointerId
  readonly kind: 'pointer'
  readonly toX: number
  readonly toY: number
  readonly x: number
  readonly y: number
}

export type TutorialModalTeachingPlan = TutorialModalCalloutPlan | TutorialModalPointerPlan

export interface TutorialModalTeachingInput {
  readonly backpack: readonly HubInventoryItem[]
  readonly coarsePointer?: boolean
  /** Live `0x005C7200` InventoryScreen / SkillScreen slide progress. */
  readonly modalProgress: number
  readonly progression: ProtocolPlayerProgression
  /** Label of the binding that closes the modal (inventory or skills key). */
  readonly resumeBindingLabel: string
  readonly stage: number
}

/** `0x005C9C70` draws through Fonts group 3, the web `menu` bitmap font. */
export const TUTORIAL_CALLOUT_FONT = 'menu'
/** `0x007DE960`: the callout renderer advances 25 px per line (24 px glyph row + 1). */
export const TUTORIAL_CALLOUT_LINE_PITCH = 25
/** `0x00795160` / `0x007DE920`: frame = measured text + 28 x 20. */
const CALLOUT_FRAME_PAD_WIDTH = 28
const CALLOUT_FRAME_PAD_HEIGHT = 20
/** `0x007DE8C8`: the frame is centred 4 px below the text anchor. */
const CALLOUT_FRAME_Y_OFFSET = 4
/**
 * 0x005C9BB0: a blinking pointer draws while the application tick
 * (`App+0x28`, `0x0081F658`; see native-application-tick.ts) `% 50 > 19`.
 */
const POINTER_BLINK_PERIOD = 50
const POINTER_BLINK_HIDDEN_TICKS = 19
const POINTER_PAINTED_TIP_RADIUS = 28.5
const BACKPACK_POINTER_TIP_GAP = 5

export const TUTORIAL_MODAL_TEXT = Object.freeze({
  backpack: 'Found items go in your backpack.  Click and\ndrag to move items, double-click to use them.',
  concentration: 'You are CONCENTRATING on\nyour new skill automatically',
  concentrationLimit: 'This confers a bonus, but is\nlimited to one skill at a time.',
  equipment: 'Put equippable items\nhere to wear them.',
  hover: 'Hover your mouse over a\nskill icon for more information.',
  tap: 'Tap a skill icon for\nmore information.',
  quickUseItems: 'Put items here\nfor quick use',
  quickUseSkills: 'Drag skills here\nfor quick use',
  resume: (binding: string) => `Click here or press '${binding}'\nagain to resume playing`,
})

const EMPTY_PLANS: readonly TutorialModalTeachingPlan[] = Object.freeze([])

export function tutorialPointerVisible(blink: boolean, applicationTick: number): boolean {
  return !blink || applicationTick % POINTER_BLINK_PERIOD > POINTER_BLINK_HIDDEN_TICKS
}

/**
 * `0x005C9C70(String, x, y)`: measure the text (`0x0043B890`), draw the UI
 * record 4 frame centred at `(x, y + 4)` with a 28 x 20 margin, then draw the
 * text centred at `(x, y)` line by line.
 */
export function tutorialCalloutGeometry(
  text: string,
  centerX: number,
  centerY: number,
): TutorialCalloutGeometry {
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
    throw new RangeError('tutorial callout centre must be finite')
  }
  const glyphHeight = nativeUiFont(TUTORIAL_CALLOUT_FONT).metrics[0]
  const lineTexts = text.split('\n')
  const widths = lineTexts.map((line) => measureNativeUiText(line, TUTORIAL_CALLOUT_FONT))
  const textWidth = Math.max(0, ...widths)
  const textHeight = glyphHeight + TUTORIAL_CALLOUT_LINE_PITCH * (lineTexts.length - 1)
  const frameWidth = textWidth + CALLOUT_FRAME_PAD_WIDTH
  const frameHeight = textHeight + CALLOUT_FRAME_PAD_HEIGHT
  const lines = lineTexts.map((line, index) => Object.freeze({
    text: line,
    width: widths[index]!,
    x: Math.trunc(centerX - widths[index]! / 2),
    y: Math.trunc(centerY) + TUTORIAL_CALLOUT_LINE_PITCH * index,
  }))
  return Object.freeze({
    centerX,
    centerY,
    frame: Object.freeze({
      height: frameHeight,
      width: frameWidth,
      x: centerX - frameWidth / 2,
      y: centerY + CALLOUT_FRAME_Y_OFFSET - frameHeight / 2,
    }),
    lines: Object.freeze(lines),
    textHeight,
    textWidth,
  })
}

function callout(
  id: TutorialModalCalloutId,
  text: string,
  centerX: number,
  centerY: number,
): TutorialModalCalloutPlan {
  return Object.freeze({ geometry: tutorialCalloutGeometry(text, centerX, centerY), id, kind: 'callout', text })
}

function pointer(
  id: TutorialModalPointerId,
  origin: NativeHudPoint,
  tip: NativeHudPoint,
  blink: boolean,
): TutorialModalPointerPlan {
  return Object.freeze({ blink, id, kind: 'pointer', toX: tip.x, toY: tip.y, x: origin.x, y: origin.y })
}

function modalHudLayout(progress: number) {
  return nativeHudModalSlideLayout(
    NATIVE_HUD_BACKBUFFER.width,
    NATIVE_HUD_BACKBUFFER.height,
    progress,
  )
}

/** `case 0xa` of `0x005D08C0`: the inventory modal. */
function inventoryModalPlans(input: TutorialModalTeachingInput): readonly TutorialModalTeachingPlan[] {
  const hud = modalHudLayout(input.modalProgress)
  const backpack = nativeHudRectCenter(hud.backpack)
  const belt7 = nativeHudRectCenter(hud.belt[7]!)
  const belt6 = nativeHudRectCenter(hud.belt[6]!)
  const projected = projectInventoryRootSlots(input.backpack)
  const amuletSlot = projected.find(({ item }) => nativeTutorialAmuletIdentityMatches(item))?.slot
  const [amuletX, amuletY, amuletWidth, amuletHeight] = hubInventoryEquipmentSlotRects(
    'amulet',
    false,
  )[0]!
  const amulet = Object.freeze({
    x: amuletX + amuletWidth / 2,
    y: amuletY + amuletHeight / 2,
  })
  const plans: TutorialModalTeachingPlan[] = [
    callout('resume', TUTORIAL_MODAL_TEXT.resume(input.resumeBindingLabel), backpack.x - 50, backpack.y - 120),
    pointer('resume', { x: backpack.x - 50, y: backpack.y - 50 }, backpack, true),
    callout('quick-use', TUTORIAL_MODAL_TEXT.quickUseItems, belt7.x, belt7.y - 115),
    pointer('quick-use', { x: belt7.x - 20, y: belt7.y - 50 }, belt6, false),
    callout('equipment', TUTORIAL_MODAL_TEXT.equipment, amulet.x - 250, amulet.y + 50),
    pointer('equipment', { x: amulet.x - 60, y: amulet.y + 40 }, amulet, false),
  ]
  if (amuletSlot !== undefined && amuletSlot < HUB_INVENTORY_GRID.capacity) {
    const cell = hubInventorySlotPosition(amuletSlot)
    const cellCenter = {
      x: cell.x + HUB_INVENTORY_GRID.cellSize / 2,
      y: cell.y + HUB_INVENTORY_GRID.cellSize / 2,
    }
    plans.push(
      callout('backpack', TUTORIAL_MODAL_TEXT.backpack, cell.x + 410, cell.y - 7),
      pointer('backpack', {
        x: cellCenter.x,
        y: cell.y - BACKPACK_POINTER_TIP_GAP - POINTER_PAINTED_TIP_RADIUS,
      }, cellCenter, false),
    )
  }
  return Object.freeze(plans)
}

/** `case 0xd` of `0x005D08C0`: the skill-book modal. */
function skillModalPlans(input: TutorialModalTeachingInput): readonly TutorialModalTeachingPlan[] {
  const hud = modalHudLayout(input.modalProgress)
  const tome = nativeHudRectCenter(hud.tome)
  const belt1 = nativeHudRectCenter(hud.belt[1]!)
  const placements = nativeSkillBookPagePlacements(nativeSkillBookPages(input.progression))
  const plans: TutorialModalTeachingPlan[] = [
    callout('resume', TUTORIAL_MODAL_TEXT.resume(input.resumeBindingLabel), tome.x + 50, tome.y - 110),
    pointer('resume', { x: tome.x + 40, y: tome.y - 40 }, tome, true),
    callout('quick-use', TUTORIAL_MODAL_TEXT.quickUseSkills, belt1.x, belt1.y - 125),
    pointer('quick-use', { x: belt1.x - 20, y: belt1.y - 50 }, belt1, false),
  ]
  if (placements.length > 2) {
    const target = Object.freeze({ x: placements[2]!.x + 100, y: placements[2]!.y + 80 })
    plans.push(
      pointer('concentration', { x: target.x + 100, y: target.y - 20 }, target, false),
      callout('concentration', TUTORIAL_MODAL_TEXT.concentration, target.x + 50, target.y - 165),
      callout('concentration-limit', TUTORIAL_MODAL_TEXT.concentrationLimit, target.x + 50, target.y - 100),
    )
  }
  if (placements.length > 0) {
    const target = Object.freeze({ x: placements[0]!.x + 100, y: placements[0]!.y + 70 })
    plans.push(
      pointer('hover', { x: target.x - 100, y: target.y - 30 }, target, false),
      callout(
        'hover',
        input.coarsePointer ? TUTORIAL_MODAL_TEXT.tap : TUTORIAL_MODAL_TEXT.hover,
        target.x - 115,
        target.y - 30,
      ),
    )
  }
  return Object.freeze(plans)
}

/**
 * The callouts and pointers `Tutorial::Render` draws over an open modal, in
 * native draw order. Empty for every other stage.
 */
export function tutorialModalTeachingPlans(
  input: TutorialModalTeachingInput,
): readonly TutorialModalTeachingPlan[] {
  if (input.stage === 10) return inventoryModalPlans(input)
  if (input.stage === 13) return skillModalPlans(input)
  return EMPTY_PLANS
}
