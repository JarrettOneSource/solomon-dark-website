import {
  GAME_CONNECTION_TIMEOUT_CLOSE_CODE,
  GAME_HOST_ENDED_SESSION_CLOSE_CODE,
  type GameDisconnectCode,
} from '../protocol/game-protocol.ts'

export interface GameTransportClose {
  code: number
  reason: string
  wasClean: boolean
}

export type GameFailureCode =
  | GameDisconnectCode
  | 'asset-load-failed'
  | 'client-error'
  | 'connection-lost'
  | 'connection-timeout'
  | 'server-error'
  | 'server-rejected'
  | 'server-restart'
  | 'session-ended'
  | 'transport-unavailable'

interface GameConnectionFailureOptions {
  code: GameFailureCode
  explanation: string
  technicalDetail?: string | null
  transport?: GameTransportClose | null
}

export class GameConnectionFailure extends Error {
  readonly code: GameFailureCode
  readonly technicalDetail: string | null
  readonly transport: GameTransportClose | null

  constructor(options: GameConnectionFailureOptions) {
    super(options.explanation)
    this.name = 'GameConnectionFailure'
    this.code = options.code
    this.technicalDetail = options.technicalDetail?.trim() || null
    this.transport = options.transport ? { ...options.transport } : null
  }

  static from(error: unknown, code: GameFailureCode = 'client-error'): GameConnectionFailure {
    if (error instanceof GameConnectionFailure) return error
    const message = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'The game client encountered an unexpected problem.'
    const failure = new GameConnectionFailure({ code, explanation: message })
    if (error instanceof Error && error.stack) failure.stack = error.stack
    return failure
  }
}

export function failureFromServerDisconnect(
  code: GameDisconnectCode,
  reason: string,
): GameConnectionFailure {
  const explanations: Readonly<Record<GameDisconnectCode, string>> = {
    'authentication-failed': 'The server could not verify this game session. The session may have expired or already been used.',
    'invalid-message': 'The server ended the session because it received game data it could not accept.',
    'protocol-mismatch': 'This game client and the server are running different versions. Refresh the page and try again.',
    'server-full': 'This game session has no open player slots.',
  }
  return new GameConnectionFailure({
    code,
    explanation: explanations[code],
    technicalDetail: reason,
  })
}

export function failureFromTransportClose(
  transport: GameTransportClose,
): GameConnectionFailure {
  const technicalDetail = transportCloseDetail(transport)
  if (transport.code === GAME_CONNECTION_TIMEOUT_CLOSE_CODE) {
    return new GameConnectionFailure({
      code: 'connection-timeout',
      explanation: 'The server stopped receiving responses from this client. The network connection likely stalled long enough to time out.',
      technicalDetail,
      transport,
    })
  }
  if (transport.code === GAME_HOST_ENDED_SESSION_CLOSE_CODE) {
    return new GameConnectionFailure({
      code: 'session-ended',
      explanation: 'The player hosting this game ended the session.',
      technicalDetail,
      transport,
    })
  }
  if (transport.code === 1001 || transport.code === 1012) {
    return new GameConnectionFailure({
      code: 'server-restart',
      explanation: 'The game server shut down or restarted while you were connected.',
      technicalDetail,
      transport,
    })
  }
  if (transport.code === 1011) {
    return new GameConnectionFailure({
      code: 'server-error',
      explanation: 'The game server encountered an unexpected error and ended the session.',
      technicalDetail,
      transport,
    })
  }
  if (transport.code === 1008) {
    return new GameConnectionFailure({
      code: 'server-rejected',
      explanation: 'The game server rejected this connection.',
      technicalDetail,
      transport,
    })
  }
  if (transport.code === 1006) {
    return new GameConnectionFailure({
      code: 'connection-lost',
      explanation: 'The network connection or the game server stopped responding without sending a reason.',
      technicalDetail,
      transport,
    })
  }
  if (transport.code === 1000) {
    return new GameConnectionFailure({
      code: 'connection-lost',
      explanation: 'The server ended the connection normally, but the game client was not expecting the session to end.',
      technicalDetail,
      transport,
    })
  }
  return new GameConnectionFailure({
    code: 'connection-lost',
    explanation: 'The connection to the game server ended unexpectedly.',
    technicalDetail,
    transport,
  })
}

export function failureFromTransportAttempt(
  endpointUrl: string,
  close?: GameTransportClose,
): GameConnectionFailure {
  if (close && close.code !== 1006) return failureFromTransportClose(close)
  let endpoint = 'the configured game server'
  try {
    const url = new URL(endpointUrl)
    endpoint = `${url.origin}${url.pathname}`
  } catch {
    // Endpoint validation reports the malformed URL separately.
  }
  return new GameConnectionFailure({
    code: 'transport-unavailable',
    explanation: 'The browser could not open a connection to the game server. The session may have ended, the server may be unavailable, or the network may be blocking it.',
    technicalDetail: close
      ? `${transportCloseDetail(close)} while opening ${endpoint}.`
      : `The connection attempt to ${endpoint} timed out.`,
    transport: close ?? null,
  })
}

function transportCloseDetail(transport: GameTransportClose): string {
  const cleanliness = transport.wasClean ? 'clean' : 'unclean'
  const reason = transport.reason.trim()
  return `WebSocket closed with code ${transport.code} (${cleanliness})${reason ? `: ${reason}` : '.'}`
}
