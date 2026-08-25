/**
 * Native bottom-HUD control geometry recovered from SolomonDark.exe 0.72.5
 * (`docs/game-native-parity-re.md`, 2026-08-25 entry; Mod Loader
 * `docs/reverse-engineering/native-hud.md`).
 *
 * `0x005D76C0` lays the backpack, tome, and the eight belt slots out from the
 * back-buffer size. `0x005C7200(Game, progress)` rewrites their vertical
 * position while an inventory/skill modal slides them down. Each screen drives
 * `progress` from 0 to 1 over 40 ticks and back to 0 while closing; when both
 * screens briefly coexist during a handoff, the writer forces `progress = 1`.
 * Every value is in native back-buffer pixels of the 1600x900 stage. The
 * Tutorial teaching overlay and modal HUD copies read these rectangles instead
 * of carrying their own constants.
 */

export interface NativeHudPoint {
  readonly x: number
  readonly y: number
}

export interface NativeHudRect {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

export interface NativeHudControlLayout {
  readonly backpack: NativeHudRect
  readonly belt: readonly NativeHudRect[]
  readonly tome: NativeHudRect
}

export const NATIVE_HUD_BACKBUFFER = Object.freeze({ height: 900, width: 1600 })

/** Backpack/tome control art (UI records 47/48, 58x62). */
const CONTROL_WIDTH = 58
const CONTROL_HEIGHT = 62
/** Belt slot frame (UI record 2, `0x0079ABE8` = 53). */
const BELT_SLOT_SIZE = 53
/** `0x005D76C0`: control top edge sits `H - 75` (`0x007866E4`). */
const CONTROL_BOTTOM_INSET = 75
/** `0x005D76C0`: backpack left edge `W/2 - 69.5`, tome left edge `W/2 + 10.5`. */
const BACKPACK_LEFT_OFFSET = -69.5
const TOME_LEFT_OFFSET = 10.5
/** `0x005D76C0`: belt centre y sits 3 px below the backpack centre. */
const BELT_CENTER_OFFSET_FROM_BACKPACK_CENTER = 3
/** `0x005D76C0`: belt centres `c(bp).x - 5 - 260 + 60k` (k < 4) and `c(tome).x + 5 + 80 + 60(k - 4)`. */
const BELT_LEFT_GROUP_OFFSET = -(5 + 260)
const BELT_RIGHT_GROUP_OFFSET = 5 + 80
const BELT_STRIDE = 60
const BELT_SLOT_COUNT = 8
/** `0x005C7200`: every bottom control drops `15 * progress`; the belt top starts `+8` below the control top. */
const MODAL_SLIDE_PIXELS = 15
const MODAL_BELT_TOP_OFFSET = 8

export function nativeHudModalSlideOffset(progress: number): number {
  if (!(progress >= 0 && progress <= 1)) {
    throw new RangeError('native HUD modal slide progress must be within [0, 1]')
  }
  return MODAL_SLIDE_PIXELS * progress
}

export function nativeHudRectCenter(rect: NativeHudRect): NativeHudPoint {
  return Object.freeze({ x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.5 })
}

function rect(x: number, y: number, width: number, height: number): NativeHudRect {
  return Object.freeze({ height, width, x, y })
}

function assertBackbuffer(width: number, height: number): void {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new RangeError('native HUD layout needs a positive back-buffer size')
  }
}

function controlLayout(width: number, controlTop: number, beltTop: number): NativeHudControlLayout {
  const backpack = rect(width / 2 + BACKPACK_LEFT_OFFSET, controlTop, CONTROL_WIDTH, CONTROL_HEIGHT)
  const tome = rect(width / 2 + TOME_LEFT_OFFSET, controlTop, CONTROL_WIDTH, CONTROL_HEIGHT)
  const backpackCenterX = nativeHudRectCenter(backpack).x
  const tomeCenterX = nativeHudRectCenter(tome).x
  const belt = Array.from({ length: BELT_SLOT_COUNT }, (_, index) => {
    const centerX = index < 4
      ? backpackCenterX + BELT_LEFT_GROUP_OFFSET + BELT_STRIDE * index
      : tomeCenterX + BELT_RIGHT_GROUP_OFFSET + BELT_STRIDE * (index - 4)
    return rect(centerX - BELT_SLOT_SIZE / 2, beltTop, BELT_SLOT_SIZE, BELT_SLOT_SIZE)
  })
  return Object.freeze({ backpack, belt: Object.freeze(belt), tome })
}

/** `0x005D76C0`: the resting layout written when the HUD is (re)built for a back-buffer size. */
export function nativeHudControlLayout(width: number, height: number): NativeHudControlLayout {
  assertBackbuffer(width, height)
  const controlTop = height - CONTROL_BOTTOM_INSET
  const beltTop = controlTop + CONTROL_HEIGHT / 2 + BELT_CENTER_OFFSET_FROM_BACKPACK_CENTER - BELT_SLOT_SIZE / 2
  return controlLayout(width, controlTop, beltTop)
}

/**
 * `0x005C7200`: the slide writer's layout for a modal progress in `[0, 1]`.
 * Horizontal placement is untouched; the vertical placement is rewritten from
 * the back-buffer height. Callers must pass the screen's live progress rather
 * than substituting the settled `progress = 1` geometry during the opening
 * ramp.
 */
export function nativeHudModalSlideLayout(
  width: number,
  height: number,
  progress: number,
): NativeHudControlLayout {
  assertBackbuffer(width, height)
  const slide = nativeHudModalSlideOffset(progress)
  const controlTop = height - CONTROL_BOTTOM_INSET + slide
  const beltTop = height - CONTROL_BOTTOM_INSET + MODAL_BELT_TOP_OFFSET + slide
  return controlLayout(width, controlTop, beltTop)
}
