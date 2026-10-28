/** CSS bounds can stay unchanged when a window moves to a different-density display. */
export function observeGameDevicePixelRatio(
  onChange: () => void,
  target: Pick<Window, 'devicePixelRatio' | 'matchMedia'> = window,
): () => void {
  let active = true
  let media = target.matchMedia(`(resolution: ${target.devicePixelRatio}dppx)`)
  const changed = () => {
    if (!active) return
    media.removeEventListener('change', changed)
    media = target.matchMedia(`(resolution: ${target.devicePixelRatio}dppx)`)
    media.addEventListener('change', changed)
    onChange()
  }
  media.addEventListener('change', changed)
  return () => {
    active = false
    media.removeEventListener('change', changed)
  }
}
