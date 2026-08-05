/**
 * The seam between the website and the rebuilt game.
 *
 * Everything the browser client needs to start a session goes through
 * `bootGame`. The page never reaches past this module, so the engine can be
 * built, replaced, or version-pinned without the site knowing anything about
 * its internals.
 *
 * The one load-bearing idea here is the transport union below: a session is
 * always a client talking to an authoritative server, and the *only* thing
 * that changes between the three ways to play is where that server lives.
 * Offline is not a second implementation of the game — it is the same server
 * running in-process. Keep it that way; the moment "offline mode" becomes its
 * own code path, the two stop agreeing and the conformance goldens can only
 * ever prove one of them right.
 */

/** Where the authoritative simulation runs for this session. */
export type Transport =
  /**
   * The server runs in this tab (a worker). No network, no website required —
   * this is what the standalone offline build ships. Co-op still works the
   * same way it does everywhere else: the empty seats are filled with bots,
   * which are already modeled as synthetic remote players.
   */
  | { kind: 'local'; bots?: number }
  /** A dedicated server, reached over a WebSocket. */
  | { kind: 'remote'; url: string }

export interface SessionOptions {
  /** The surface the renderer draws into. */
  canvas: HTMLCanvasElement
  transport: Transport
  /** Display name for this player. */
  name?: string
  /** Raised for errors that end the session; the page tears down and reports. */
  onFatal?: (error: Error) => void
}

export interface GameSession {
  /** Stop the loop, release GPU/audio resources, close any socket. */
  destroy(): void
}

/**
 * Whether an engine build is present in this bundle.
 *
 * The reconstruction lands as one flip of this constant plus a real
 * `bootGame`. Until then the page shows the reconstruction status instead of
 * a play surface — there is deliberately no stand-in game, because a
 * placeholder that "sort of" plays is the one thing that would make parity
 * regressions invisible.
 */
export const ENGINE_STATUS: 'not-built' | 'ready' = 'not-built'

/**
 * Where the standalone offline build is published, once one is.
 *
 * Null until a real artifact exists — the page reads this rather than carrying
 * a hardcoded link, so there is never a download button pointing at a release
 * nobody cut.
 */
export const OFFLINE_BUILD_URL: string | null = null

/**
 * Start a session and mount it into `options.canvas`.
 *
 * Implementors: this is the whole public surface. Resolve once the first
 * frame has been presented and the session is accepting input.
 */
export async function bootGame(_options: SessionOptions): Promise<GameSession> {
  throw new Error(
    'The Solomon Dark engine is not part of this build yet. ' +
      'Implement bootGame() and set ENGINE_STATUS to "ready".',
  )
}
