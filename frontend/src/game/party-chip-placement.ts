import type { GameViewportBounds } from './renderer/game-viewport.ts'

/** Party is an added HUD surface. Keep the native guidance at its authored anchor. */
export function placePartyChip(
  card: GameViewportBounds,
  viewport: { readonly width: number; readonly height: number },
  guidance: readonly GameViewportBounds[],
): { x: number; y: number } {
  const visible = guidance.filter(hint => hint.x < viewport.width && hint.y < viewport.height
    && hint.x + hint.width > 0 && hint.y + hint.height > 0)
  const xs = [card.x]
  const ys = [card.y]
  for (const hint of visible) {
    xs.push(hint.x + hint.width + 4, hint.x - card.width - 4)
    ys.push(hint.y + hint.height + 4, hint.y - card.height - 4)
  }
  let position = { x: card.x, y: card.y }
  let distance = Infinity
  for (const x of xs) {
    for (const y of ys) {
      // The normal top/left inset keeps Party below the other fixed HUD controls.
      if (x < card.x || y < card.y || x + card.width > viewport.width
        || y + card.height > viewport.height) continue
      if (visible.some(hint => x < hint.x + hint.width + 4 && x + card.width + 4 > hint.x
        && y < hint.y + hint.height + 4 && y + card.height + 4 > hint.y)) continue
      const candidateDistance = (x - card.x) ** 2 + (y - card.y) ** 2
      if (candidateDistance < distance) {
        position = { x, y }
        distance = candidateDistance
      }
    }
  }
  return position
}
