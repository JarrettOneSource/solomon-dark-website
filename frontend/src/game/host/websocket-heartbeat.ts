import { WebSocket } from 'ws'

export const DEFAULT_GAME_HEARTBEAT_INTERVAL_MS = 5_000
export const GAME_HEARTBEAT_MISSED_PONG_LIMIT = 6

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
): () => void {
  let missedPongs = 0
  let stopped = false
  const receivePong = () => {
    missedPongs = 0
  }
  socket.on('pong', receivePong)
  const timer = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) return
    if (missedPongs >= GAME_HEARTBEAT_MISSED_PONG_LIMIT) {
      socket.terminate()
      return
    }
    missedPongs += 1
    socket.ping()
  }, intervalMs)
  timer.unref()

  return () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
    socket.off('pong', receivePong)
  }
}
