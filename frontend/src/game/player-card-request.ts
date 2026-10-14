import type { GameClientSession } from './client/game-client-session.ts'
import type { GamePlayerCardProfile } from './protocol/game-chat.ts'

export const PLAYER_CARD_FEEDBACK_MS = 5_000
export interface PlayerCardRequestState {
  readonly profile: GamePlayerCardProfile | null
  readonly pending: boolean
  readonly error: string | null
}
const IDLE: PlayerCardRequestState = { profile: null, pending: false, error: null }

/** One gameplay session owns its requests. The latest request wins. */
export class PlayerCardRequests {
  private readonly session: Pick<GameClientSession, 'resolvePlayerCard'> | null
  private state: PlayerCardRequestState = IDLE
  private generation = 0
  private timeout: ReturnType<typeof setTimeout> | null = null
  private readonly listeners = new Set<() => void>()

  constructor(session: Pick<GameClientSession, 'resolvePlayerCard'> | null) {
    this.session = session
  }

  readonly getSnapshot = (): PlayerCardRequestState => this.state
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  readonly dismiss = (): void => {
    this.generation += 1
    this.clearTimeout()
    this.publish(IDLE)
  }

  readonly open = async (reference: string): Promise<void> => {
    if (!this.session) return
    const generation = ++this.generation
    this.clearTimeout()
    this.publish({ profile: null, pending: true, error: null })
    try {
      const profile = await this.session.resolvePlayerCard(reference)
      if (generation === this.generation) this.publish({ profile, pending: false, error: null })
    } catch (error) {
      if (generation !== this.generation) return
      this.publish({ profile: null, pending: false, error: error instanceof Error
        ? error.message : 'That wizard is no longer available.' })
      this.timeout = setTimeout(() => {
        this.timeout = null
        if (generation === this.generation) this.publish(IDLE)
      }, PLAYER_CARD_FEEDBACK_MS)
    }
  }

  private clearTimeout(): void {
    if (this.timeout !== null) clearTimeout(this.timeout)
    this.timeout = null
  }

  private publish(state: PlayerCardRequestState): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
}
