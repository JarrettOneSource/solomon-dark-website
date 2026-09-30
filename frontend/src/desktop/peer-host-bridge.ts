import type { GameEndpoint } from '../game/engine.ts'
import { GAME_PROTOCOL_VERSION, GAME_WEBSOCKET_MAX_PAYLOAD_BYTES } from '../game/protocol/game-protocol-contract.ts'
import type { RtcPacketPipe } from './rtc-packet-pipe.ts'

export function attachPeerHostBridge(pipe: RtcPacketPipe, endpoint: GameEndpoint): () => void {
  if (endpoint.kind !== 'localhost') throw new Error('Only a local authoritative host can invite friends')
  let socket: WebSocket | null = null
  let connectionId: string | null = null
  let lastOpen = 0
  pipe.control({ type: 'hello', credential: endpoint.credential, protocol: GAME_PROTOCOL_VERSION })
  pipe.onControl = message => {
    if (typeof message.connectionId !== 'string' || message.connectionId.length > 64) {
      pipe.close('Invalid peer connection identity')
      return
    }
    if (message.type === 'close') {
      if (connectionId === message.connectionId) socket?.close(1000, 'Peer session ended')
      return
    }
    if (message.type !== 'open' || Date.now() - lastOpen < 500) {
      pipe.close('Peer connection request rejected')
      return
    }
    lastOpen = Date.now()
    socket?.close(1000, 'Peer session replaced')
    connectionId = message.connectionId
    const id = connectionId
    const current = new WebSocket(endpoint.url)
    socket = current
    current.addEventListener('open', () => {
      if (socket === current) pipe.control({ type: 'opened', connectionId: id })
    })
    current.addEventListener('message', event => {
      if (socket !== current) return
      if (typeof event.data !== 'string') { pipe.close('Unsupported host message'); return }
      try { pipe.send(event.data) }
      catch { pipe.close('Peer cannot receive the host stream') }
    })
    current.addEventListener('close', event => {
      if (socket !== current) return
      socket = null
      if (pipe.channel.readyState === 'open') {
        pipe.control({ type: 'closed', connectionId: id, code: event.code, reason: event.reason.slice(0, 180) })
      }
    })
    current.addEventListener('error', () => current.close())
  }
  pipe.onPacket = packet => {
    if (socket?.readyState !== WebSocket.OPEN) { pipe.close('Local game connection is not ready'); return }
    if (socket.bufferedAmount > GAME_WEBSOCKET_MAX_PAYLOAD_BYTES * 2) {
      pipe.close('Local host cannot keep up')
      return
    }
    socket.send(packet)
  }
  return () => {
    const current = socket
    socket = null
    current?.close(1000, 'Peer disconnected')
  }
}
