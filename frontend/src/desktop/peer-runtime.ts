import type { GameEndpoint } from '../game/engine.ts'
import type { GameTransport } from '../game/client/game-transport.ts'
import { GAME_PROTOCOL_VERSION } from '../game/protocol/game-protocol-contract.ts'
import { attachPeerHostBridge } from './peer-host-bridge.ts'
import { PeerGameTransport } from './peer-game-transport.ts'
import { gatherPeerDescription } from './peer-negotiation.ts'
import { openPeerRoom, type PeerRoom } from './peer-rendezvous.ts'
import { RtcPacketPipe } from './rtc-packet-pipe.ts'

export interface DesktopPeerState {
  mode: 'solo' | 'host' | 'guest'
  phase: 'idle' | 'connecting' | 'ready' | 'error'
  invite: string | null
  connectedPeers: number
  error: string | null
}

interface Link {
  pc: RTCPeerConnection
  pipe: RtcPacketPipe | null
  cleanup: (() => void) | null
  timeout: ReturnType<typeof setTimeout> | null
}

class DesktopPeerRuntime {
  private state: DesktopPeerState = { mode: 'solo', phase: 'idle', invite: null, connectedPeers: 0, error: null }
  private readonly listeners = new Set<() => void>()
  private readonly endpoint: GameEndpoint
  private readonly signalingUrl: string
  private room: PeerRoom | null = null
  private readonly links = new Map<string, Link>()
  private credential: string | null = null
  private transport: PeerGameTransport | null = null
  private pending: { resolve(): void; reject(error: Error): void } | null = null
  private generation = 0

  constructor(endpoint: GameEndpoint, signalingUrl: string) {
    this.endpoint = endpoint
    this.signalingUrl = signalingUrl
    window.addEventListener('beforeunload', () => this.stop())
  }

  getSnapshot = (): DesktopPeerState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  host = (): Promise<void> => this.start('host', '')
  join = (invite: string): Promise<void> => {
    const code = invite.trim()
    if (!/^[A-Za-z0-9_-]{32}$/.test(code)) return Promise.reject(new Error('Paste the complete invitation code from your friend.'))
    return this.start('guest', code)
  }

  stop = (): void => {
    this.generation++
    this.room?.close()
    this.room = null
    this.pending?.reject(new Error('Friend connection cancelled'))
    this.pending = null
    this.transport?.close()
    this.transport = null
    for (const [id] of this.links) this.drop(id, 'Friend connection closed')
    this.credential = null
    this.update({ mode: 'solo', phase: 'idle', invite: null, connectedPeers: 0, error: null })
  }

  gameEndpoint(): GameEndpoint | null {
    if (this.state.mode !== 'guest') return null
    if (this.state.phase !== 'ready' || !this.credential) throw new Error('Connect to your friend before starting the game.')
    return { kind: 'peer', sessionKind: 'standalone', url: 'webrtc://friend', credential: this.credential }
  }

  async connectTransport(): Promise<GameTransport> {
    const pipe = this.links.get('host')?.pipe
    if (!pipe || pipe.channel.readyState !== 'open') throw new Error('The peer connection is unavailable')
    if (this.transport && this.transport.readyState !== 'closed') throw new Error('A peer game is already connected')
    this.transport = new PeerGameTransport(pipe)
    return this.transport.open()
  }

  private async start(mode: 'host' | 'guest', invite: string): Promise<void> {
    this.stop()
    const generation = this.generation
    this.update({ mode, phase: 'connecting', error: null })
    try {
      const room = await openPeerRoom(this.signalingUrl, mode, invite, {
        peerJoined: id => { void this.offer(id).catch(error => this.failPeer(id, error)) },
        peerLeft: id => {
          if (this.links.get(id)?.pipe?.channel.readyState !== 'open') this.drop(id, 'Peer left before connecting')
        },
        signal: (id, description) => { void this.receive(id, description).catch(error => this.failPeer(id, error)) },
        lost: message => {
          if (generation !== this.generation) return
          this.update({ error: message, invite: null })
          if (this.state.phase === 'connecting') this.pending?.reject(new Error(message))
        },
      })
      if (generation !== this.generation) { room.close(); throw new Error('Friend connection cancelled') }
      this.room = room
      if (mode === 'host') this.update({ phase: 'ready', invite: room.invite })
      else {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Could not connect directly. This network may need a TURN relay.')), 35_000)
          this.pending = {
            resolve: () => { clearTimeout(timeout); resolve() },
            reject: error => { clearTimeout(timeout); reject(error) },
          }
        })
        this.pending = null
      }
    } catch (error) {
      if (generation === this.generation) {
        this.room?.close()
        this.room = null
        for (const [id] of this.links) this.drop(id, 'Friend connection failed')
        this.update({ phase: 'error', error: error instanceof Error ? error.message : 'Friend connection failed' })
      }
      throw error
    }
  }

  private update(patch: Partial<DesktopPeerState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private createLink(id: string): Link {
    if (!this.room || this.links.has(id) || this.links.size >= 7) throw new Error('Peer connection is not available')
    const pc = new RTCPeerConnection({ iceServers: this.room.iceServers })
    const link: Link = { pc, pipe: null, cleanup: null, timeout: null }
    this.links.set(id, link)
    link.timeout = setTimeout(() => this.drop(id, 'Peer connection timed out'), 35_000)
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.drop(id, 'Peer connection ended')
      } else if (pc.connectionState === 'connected') {
        if (link.timeout) clearTimeout(link.timeout)
        link.timeout = null
      } else if (pc.connectionState === 'disconnected' && !link.timeout) {
        link.timeout = setTimeout(() => this.drop(id, 'Peer connection was lost'), 10_000)
      }
    })
    return link
  }

  private async offer(id: string): Promise<void> {
    if (this.state.mode !== 'host') return
    const link = this.createLink(id)
    this.bind(id, link, link.pc.createDataChannel('solomon-game-v1', { ordered: true }))
    const description = await gatherPeerDescription(link.pc, await link.pc.createOffer())
    if (this.links.get(id) === link) this.room?.signal(id, description)
  }

  private async receive(id: string, description: RTCSessionDescriptionInit): Promise<void> {
    if (this.state.mode === 'host') {
      const link = this.links.get(id)
      if (!link || description.type !== 'answer') throw new Error('Unexpected guest description')
      await link.pc.setRemoteDescription(description)
      return
    }
    if (this.state.mode !== 'guest' || id !== 'host' || description.type !== 'offer') {
      throw new Error('Unexpected host description')
    }
    const link = this.createLink(id)
    link.pc.addEventListener('datachannel', event => this.bind(id, link, event.channel))
    await link.pc.setRemoteDescription(description)
    const answer = await gatherPeerDescription(link.pc, await link.pc.createAnswer())
    if (this.links.get(id) === link) this.room?.signal(id, answer)
  }

  private bind(id: string, link: Link, channel: RTCDataChannel): void {
    if (link.pipe || channel.label !== 'solomon-game-v1' || !channel.ordered
      || channel.maxRetransmits !== null || channel.maxPacketLifeTime !== null) {
      channel.close()
      this.drop(id, 'Unexpected peer channel')
      return
    }
    const pipe = new RtcPacketPipe(channel)
    link.pipe = pipe
    if (this.state.mode === 'host') link.cleanup = attachPeerHostBridge(pipe, this.endpoint)
    else {
      pipe.onPacket = packet => this.transport?.acceptPacket(packet)
      pipe.onControl = message => {
        if (message.type !== 'hello') { this.transport?.acceptControl(message); return }
        if (message.protocol !== GAME_PROTOCOL_VERSION || typeof message.credential !== 'string'
          || !/^[A-Za-z0-9_-]{32,128}$/.test(message.credential)) {
          this.drop(id, 'Peer host sent an invalid admission')
          return
        }
        this.credential = message.credential
        this.update({ phase: 'ready', connectedPeers: 1, error: null })
        this.pending?.resolve()
      }
    }
    pipe.onClosed = reason => this.drop(id, reason)
    channel.addEventListener('open', () => {
      if (link.timeout) clearTimeout(link.timeout)
      link.timeout = null
      this.update({ connectedPeers: this.connectedCount() })
    })
  }

  private connectedCount(): number {
    return [...this.links.values()].filter(link => link.pipe?.channel.readyState === 'open').length
  }

  private drop(id: string, reason: string): void {
    const link = this.links.get(id)
    if (!link) return
    if (link.pc.connectionState !== 'connected' && link.pc.connectionState !== 'closed') {
      // Connection failures need useful evidence without exposing SDP, network
      // addresses, invitation codes, or the game's bootstrap credential.
      console.warn(`Desktop peer connectivity: ${JSON.stringify({
        role: this.state.mode,
        connection: link.pc.connectionState,
        ice: link.pc.iceConnectionState,
        gathering: link.pc.iceGatheringState,
        signaling: link.pc.signalingState,
        localCandidates: candidateKinds(link.pc.localDescription?.sdp),
        remoteCandidates: candidateKinds(link.pc.remoteDescription?.sdp),
      })}`)
    }
    this.links.delete(id)
    if (link.timeout) clearTimeout(link.timeout)
    link.cleanup?.()
    link.pipe?.close(reason)
    link.pc.close()
    if (id === 'host') {
      this.credential = null
      this.transport?.close(4001, reason)
      this.pending?.reject(new Error(reason))
      this.update({ phase: 'error', error: reason })
    }
    this.update({ connectedPeers: this.connectedCount() })
  }

  private failPeer(id: string, error: unknown): void {
    const reason = error instanceof Error ? error.message.slice(0, 240) : 'Peer connection failed'
    this.drop(id, reason)
    this.update({ error: reason })
    this.pending?.reject(new Error(reason))
  }
}

let runtime: DesktopPeerRuntime | null = null
function candidateKinds(sdp: string | undefined): string[] {
  return (sdp?.match(/^a=candidate:.*$/gm) ?? []).map(line => {
    const fields = line.trim().split(/\s+/)
    const type = fields[fields.indexOf('typ') + 1]
    const safeType = ['host', 'srflx', 'prflx', 'relay'].includes(type) ? type : 'unknown'
    return `${safeType}/${fields[4]?.endsWith('.local') ? 'mdns' : 'address'}`
  })
}

export function getDesktopPeerRuntime(): DesktopPeerRuntime {
  if (runtime) return runtime
  const injected = window.solomonDarkRuntime
  if (!injected?.desktop || !injected.gameEndpoint) throw new Error('Friend hosting is available in the desktop app.')
  runtime = new DesktopPeerRuntime(injected.gameEndpoint, injected.desktop.signalingUrl)
  return runtime
}
