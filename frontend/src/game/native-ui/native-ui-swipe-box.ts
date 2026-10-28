export const NATIVE_UI_SWIPE_BOX = Object.freeze({
  wheelStep: 25,
})

export function nativeUiSwipeBoxMaximumOffset(
  contentExtent: number,
  viewportExtent: number,
): number {
  requireExtent(contentExtent, 'content')
  requireExtent(viewportExtent, 'viewport')
  return Math.max(0, contentExtent - viewportExtent)
}

export function clampNativeUiSwipeBoxOffset(
  requested: number,
  contentExtent: number,
  viewportExtent: number,
): number {
  if (!Number.isFinite(requested)) throw new RangeError('native SwipeBox offset must be finite')
  return Math.min(
    nativeUiSwipeBoxMaximumOffset(contentExtent, viewportExtent),
    Math.max(0, requested),
  )
}

export function dragNativeUiSwipeBoxOffset(
  current: number,
  previousPointer: number,
  pointer: number,
  contentExtent: number,
  viewportExtent: number,
): number {
  if (!Number.isFinite(previousPointer) || !Number.isFinite(pointer)) {
    throw new RangeError('native SwipeBox pointer coordinates must be finite')
  }
  return clampNativeUiSwipeBoxOffset(
    current + previousPointer - pointer,
    contentExtent,
    viewportExtent,
  )
}

function requireExtent(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`native SwipeBox ${name} extent must be finite and nonnegative`)
  }
}
