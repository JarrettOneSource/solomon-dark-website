import type { HallOfFameEntry } from '../core-kernels/hall-of-fame.ts'
import { completedHallOfFameEntry } from '../hall-of-fame-entry.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'

export class HallOfFameRunRecorder {
  private readonly completedRunIds = new Set<string>()
  private readonly now: () => Date

  constructor(now: () => Date = () => new Date()) {
    this.now = now
  }

  observe(
    snapshot: GameSnapshot,
    playerId: string,
    accountUsername: string | null,
  ): HallOfFameEntry | null {
    if (snapshot.world.kind !== 'boneyard' || snapshot.run.phase !== 'game-over') {
      return null
    }
    if (this.completedRunIds.has(snapshot.world.runId)) return null
    const entry = completedHallOfFameEntry(
      snapshot,
      playerId,
      accountUsername,
      this.now().toISOString(),
    )
    if (!entry) return null
    this.completedRunIds.add(snapshot.world.runId)
    return entry
  }
}
