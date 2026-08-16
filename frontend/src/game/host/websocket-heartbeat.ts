import { WebSocket } from 'ws'

import { GAME_CONNECTION_TIMEOUT_CLOSE_CODE } from '../protocol/game-protocol.ts'

export const DEFAULT_GAME_HEARTBEAT_INTERVAL_MS = 5_000
export const GAME_HEARTBEAT_MISSED_PONG_LIMIT = 6

interface WebSocketHeartbeatOptions {
  onTimeout?: () => void
  timeoutReason?: string
}

export function resolveGameHeartbeatInterval(intervalMs: number | undefined): number {
  const resolved = intervalMs ?? DEFAULT_GAME_HEARTBEAT_INTERVAL_MS
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new Error('heartbeatIntervalMs must be positive')
  }
  return resolved
}

export function monitorWebSocketHeartbeat(
  socket: WebSocket,
  intervalMs: number,
  options: WebSocketHeartbeatOptions = {},
): () => void {
  let missedPongs = 0
  let stopped = false
  let forceCloseTimer: ReturnType<typeof setTimeout> | undefined
  const receivePong = () => {
    missedPongs = 0
  }
  socket.on('pong', receivePong)
  const timer = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) return
    if (missedPongs >= GAME_HEARTBEAT_MISSED_PONG_LIMIT) {
      stopped = true
      clearInterval(timer)
      socket.off('pong', receivePong)
      options.onTimeout?.()
      socket.close(
        GAME_CONNECTION_TIMEOUT_CLOSE_CODE,
        (options.timeoutReason ?? 'connection timed out').slice(0, 123),
      )
      forceCloseTimer = setTimeout(() => {
        if (socket.readyState !== WebSocket.CLOSED) socket.terminate()
      }, Math.max(100, Math.min(intervalMs, 1_000)))
      forceCloseTimer.unref()
      return
    }
    missedPongs += 1
    socket.ping()
  }, intervalMs)
  timer.unref()

  return () => {
    if (forceCloseTimer !== undefined) {
      clearTimeout(forceCloseTimer)
      forceCloseTimer = undefined
    }
    if (stopped) return
    stopped = true
    clearInterval(timer)
    socket.off('pong', receivePong)
  }
}
