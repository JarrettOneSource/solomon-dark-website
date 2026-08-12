import { GAME_PROTOCOL_VERSION } from '../protocol/game-protocol.ts'

export interface GameTransport {
  readonly readyState: 'closed' | 'connecting' | 'open'
  close(code?: number, reason?: string): void
  onClose(listener: (reason: string) => void): () => void
  onMessage(listener: (payload: string) => void): () => void
  send(payload: string): void
}

export function connectWebSocketTransport(url: string): Promise<GameTransport> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const timeout = window.setTimeout(() => fail(), 10_000)
    const cleanup = () => {
      window.clearTimeout(timeout)
      socket.removeEventListener('error', fail)
      socket.removeEventListener('close', fail)
    }
    const fail = () => {
      cleanup()
      if (socket.readyState < WebSocket.CLOSING) socket.close()
      reject(new Error(`Could not connect to ${url}`))
    }
    socket.addEventListener('error', fail, { once: true })
    socket.addEventListener('close', fail, { once: true })
    socket.addEventListener('open', () => {
      cleanup()
      resolve(new BrowserWebSocketTransport(socket))
    }, { once: true })
  })
}

class BrowserWebSocketTransport implements GameTransport {
  private readonly closeListeners = new Set<(reason: string) => void>()
  private readonly messageListeners = new Set<(payload: string) => void>()
  private readonly socket: WebSocket

  constructor(socket: WebSocket) {
    this.socket = socket
    socket.addEventListener('close', (event) => {
      for (const listener of this.closeListeners) listener(event.reason || 'connection closed')
    })
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        this.close(1003, `Protocol ${GAME_PROTOCOL_VERSION} accepts text messages only.`)
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

  onClose(listener: (reason: string) => void): () => void {
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
