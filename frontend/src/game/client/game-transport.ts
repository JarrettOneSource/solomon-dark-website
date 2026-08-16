import { GAME_PROTOCOL_VERSION } from '../protocol/game-protocol.ts'
import {
  failureFromTransportAttempt,
  type GameTransportClose,
} from './game-connection-failure.ts'
import type { GameClientDiagnostics } from './game-diagnostics.ts'

export type { GameTransportClose } from './game-connection-failure.ts'

export interface GameTransport {
  readonly readyState: 'closed' | 'connecting' | 'open'
  close(code?: number, reason?: string): void
  onClose(listener: (event: GameTransportClose) => void): () => void
  onMessage(listener: (payload: string) => void): () => void
  send(payload: string): void
}

export function connectWebSocketTransport(
  url: string,
  diagnostics?: GameClientDiagnostics,
): Promise<GameTransport> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    let settled = false
    const timeout = window.setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      if (socket.readyState < WebSocket.CLOSING) socket.close()
      const failure = failureFromTransportAttempt(url)
      diagnostics?.error('connection.open_failed', failure.message, failure.technicalDetail)
      reject(failure)
    }, 10_000)
    const cleanup = () => {
      window.clearTimeout(timeout)
      socket.removeEventListener('error', noteError)
      socket.removeEventListener('close', failClosed)
    }
    const noteError = () => {
      diagnostics?.warning(
        'connection.websocket_error',
        'The browser reported an error while opening the game connection.',
        safeEndpoint(url),
      )
    }
    const failClosed = (event: CloseEvent) => {
      if (settled) return
      settled = true
      cleanup()
      const failure = failureFromTransportAttempt(url, closeEvent(event))
      diagnostics?.error('connection.open_failed', failure.message, failure.technicalDetail)
      reject(failure)
    }
    socket.addEventListener('error', noteError, { once: true })
    socket.addEventListener('close', failClosed, { once: true })
    socket.addEventListener('open', () => {
      if (settled) return
      settled = true
      cleanup()
      diagnostics?.info(
        'connection.transport_open',
        'The secure game transport is open.',
        safeEndpoint(url),
      )
      resolve(new BrowserWebSocketTransport(socket, diagnostics))
    }, { once: true })
  })
}

class BrowserWebSocketTransport implements GameTransport {
  private readonly closeListeners = new Set<(event: GameTransportClose) => void>()
  private readonly diagnostics: GameClientDiagnostics | undefined
  private readonly messageListeners = new Set<(payload: string) => void>()
  private readonly socket: WebSocket

  constructor(socket: WebSocket, diagnostics?: GameClientDiagnostics) {
    this.socket = socket
    this.diagnostics = diagnostics
    socket.addEventListener('close', (event) => {
      const closed = closeEvent(event)
      const detail = `code=${closed.code}; clean=${closed.wasClean}; reason=${closed.reason || 'none'}`
      if (closed.code === 1000) {
        diagnostics?.info('connection.transport_closed', 'The game transport closed.', detail)
      } else {
        diagnostics?.warning(
          'connection.transport_closed',
          'The game transport closed unexpectedly.',
          detail,
        )
      }
      for (const listener of this.closeListeners) listener(closed)
    })
    socket.addEventListener('error', () => {
      this.diagnostics?.warning(
        'connection.transport_error',
        'The browser reported a game transport error.',
      )
    })
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        this.diagnostics?.error(
          'connection.binary_message',
          'The game server sent a binary message that this protocol does not accept.',
        )
        this.close(4003, `Protocol ${GAME_PROTOCOL_VERSION} accepts text messages only.`)
        return
      }
      for (const listener of this.messageListeners) listener(event.data)
    })
  }

  get readyState(): GameTransport['readyState'] {
    if (this.socket.readyState === WebSocket.CONNECTING) return 'connecting'
    if (this.socket.readyState === WebSocket.OPEN) return 'open'
    return 'closed'
  }

  close(code = 1000, reason = 'session destroyed'): void {
    if (this.socket.readyState < WebSocket.CLOSING) this.socket.close(code, reason)
  }

  onClose(listener: (event: GameTransportClose) => void): () => void {
    this.closeListeners.add(listener)
    return () => this.closeListeners.delete(listener)
  }

  onMessage(listener: (payload: string) => void): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  send(payload: string): void {
    if (this.socket.readyState !== WebSocket.OPEN) throw new Error('game transport is not open')
    this.socket.send(payload)
  }
}

function closeEvent(event: CloseEvent): GameTransportClose {
  return {
    code: event.code,
    reason: event.reason,
    wasClean: event.wasClean,
  }
}

function safeEndpoint(value: string): string {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return 'invalid game endpoint'
  }
}
