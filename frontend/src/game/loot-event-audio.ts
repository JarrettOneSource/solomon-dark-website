import type { GameSnapshot } from './protocol/game-state.ts'
import type { BoneyardLootEventSnapshot } from './protocol/game-state.ts'

export class BoneyardLootEventSynchronizer {
  private lastEventId: number
  private runId: string | null

  constructor(initialSnapshot: GameSnapshot) {
    if (initialSnapshot.world.kind !== 'boneyard') {
      this.lastEventId = 0
      this.runId = null
      return
    }
    this.lastEventId = initialSnapshot.world.lootEvents.at(-1)?.eventId ?? 0
    this.runId = initialSnapshot.world.runId
  }

  consume(
    snapshot: GameSnapshot,
    onEvent: (event: BoneyardLootEventSnapshot) => void,
  ): void {
    if (snapshot.world.kind !== 'boneyard') return
    if (snapshot.world.runId !== this.runId) {
      this.runId = snapshot.world.runId
      this.lastEventId = 0
    }
    for (const event of snapshot.world.lootEvents) {
      if (event.runId !== this.runId || event.eventId <= this.lastEventId) continue
      onEvent(event)
      this.lastEventId = event.eventId
    }
  }
}
