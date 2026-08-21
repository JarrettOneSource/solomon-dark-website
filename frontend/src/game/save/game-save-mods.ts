import type { GameContentIdentity } from '../protocol/game-protocol.ts'

export interface GameSaveModMismatch {
  readonly added: readonly GameContentIdentity[]
  readonly changed: readonly Readonly<{
    active: GameContentIdentity
    saved: GameContentIdentity
  }>[]
  readonly removed: readonly GameContentIdentity[]
}

export function gameSaveModMismatch(
  saved: readonly GameContentIdentity[],
  active: readonly GameContentIdentity[],
): GameSaveModMismatch | null {
  const savedById = new Map(saved.map(mod => [mod.id.toLowerCase(), mod]))
  const activeById = new Map(active.map(mod => [mod.id.toLowerCase(), mod]))
  const added = active.filter(mod => !savedById.has(mod.id.toLowerCase()))
  const removed = saved.filter(mod => !activeById.has(mod.id.toLowerCase()))
  const changed = saved.flatMap(savedMod => {
    const activeMod = activeById.get(savedMod.id.toLowerCase())
    return activeMod && (
      activeMod.version !== savedMod.version
      || activeMod.contentSha256.toLowerCase() !== savedMod.contentSha256.toLowerCase()
    ) ? [{ active: activeMod, saved: savedMod }] : []
  })
  return added.length || removed.length || changed.length ? { added, changed, removed } : null
}
