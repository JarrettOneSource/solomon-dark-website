import { WebSocket } from 'ws'

export const DEFAULT_GAME_HEARTBEAT_INTERVAL_MS = 5_000

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
  let awaitingPong = false
  let stopped = false
  const receivePong = () => {
    awaitingPong = false
  }
  socket.on('pong', receivePong)
  const timer = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) return
    if (awaitingPong) {
      socket.terminate()
      return
    }
    awaitingPong = true
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
