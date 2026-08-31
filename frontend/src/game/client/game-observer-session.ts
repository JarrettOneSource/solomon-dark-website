import {
  GAME_PROTOCOL_VERSION,
  GameProtocolError,
  decodeServerGameMessage,
  encodeGameMessage,
  type GameChatMessage,
  type BoneyardEnemyEventSnapshot,
  type GameModAsset,
  type GameSessionKind,
  type GameClientSnapshot,
  type LoadedBoneyard,
} from '../protocol/game-protocol.ts'
import type { ModConsumableCatalogEntry } from '../core-kernels/hub-economy.ts'
import {
  EntityReplicationGapError,
  EntityReplicationReconstructor,
} from '../protocol/entity-replication.ts'
import { createGameClientSnapshot } from '../protocol/primary-spell-hail-replication.ts'
import { appendGameChatMessage } from '../game-chat.ts'
import {
  createBoneyardPresentationTimeline,
  isBoneyardGameSnapshot,
  type BoneyardPresentationFrame,
  type BoneyardPresentationTimeline,
} from './boneyard-presentation-timeline.ts'
import {
  GameConnectionFailure,
  failureFromServerDisconnect,
  failureFromTransportClose,
} from './game-connection-failure.ts'
import type { GameTransport } from './game-transport.ts'

const PING_INTERVAL_MS = 2_000

export interface GameObserverState {
  readonly boneyard: LoadedBoneyard
  readonly chatMessages: readonly GameChatMessage[]
  readonly pingMs: number | null
  readonly snapshot: GameClientSnapshot
  readonly viewPlayerId: string
}

export interface GameObserverSession {
  readonly modAssets: readonly GameModAsset[]
  readonly modCatalog: readonly ModConsumableCatalogEntry[]
  readonly sessionKind: Exclude<GameSessionKind, 'standalone'>
  close(): void
  current(): GameObserverState
  subscribeEnemyEvent(listener: (event: BoneyardEnemyEventSnapshot) => void): () => void
  samplePresentation(nowMs?: number): BoneyardPresentationFrame
  subscribe(listener: (state: GameObserverState) => void): () => void
}

export interface GameObserverSessionOptions {
  readonly credential: string
  readonly now?: () => number
  readonly onEnded?: (reason: string) => void
  readonly onFatal?: (failure: GameConnectionFailure) => void
  readonly transport: GameTransport
}

export function connectGameObserverSession(
  options: GameObserverSessionOptions,
): Promise<GameObserverSession> {
  return new Promise((resolve, reject) => {
    let settled = false
    let closed = false
    let closedByClient = false
    let welcome: Extract<ReturnType<typeof decodeServerGameMessage>, { type: 'server-welcome' }>
      | null = null
    let boneyard: LoadedBoneyard | null = null
    let snapshot: GameClientSnapshot | null = null
    let viewPlayerId: string | null = null
    let pingMs: number | null = null
    let chatMessages: readonly GameChatMessage[] = []
    let lastChatSequence = 0
    let lastSnapshotSequence = 0
    let nextPingNonce = 1
    let pingTimer: ReturnType<typeof globalThis.setInterval> | undefined
    let timeline: BoneyardPresentationTimeline | null = null
    const pendingPings = new Map<number, number>()
    const listeners = new Set<(state: GameObserverState) => void>()
    const enemyEventListeners = new Set<(event: BoneyardEnemyEventSnapshot) => void>()
    let enemyEventCursor: { eventId: number; runId: string } | null = null
    const entityReplication = new EntityReplicationReconstructor()
    const now = options.now ?? (() => performance.now())
    const handshakeDeadline = globalThis.setTimeout(() => {
      fail(new Error('The observer handshake timed out.'))
    }, 5_000)

    const removeMessage = options.transport.onMessage((payload) => {
      let message
      try {
        message = decodeServerGameMessage(payload)
      } catch (error) {
        fail(error instanceof GameProtocolError ? error : new Error('Invalid observer message'))
        return
      }
      if (message.type === 'server-disconnect') {
        fail(failureFromServerDisconnect(message.code, message.reason))
        return
      }
      if (message.type === 'server-welcome') {
        const clientSnapshot = createGameClientSnapshot(message.snapshot)
        if (
          settled
          || message.observer !== true
          || message.protocolVersion !== GAME_PROTOCOL_VERSION
          || message.sessionKind === 'standalone'
          || !isBoneyardGameSnapshot(clientSnapshot)
          || !clientSnapshot.players[message.playerId]
        ) {
          fail(new Error('The server returned an invalid observer welcome.'))
          return
        }
        welcome = message
        snapshot = clientSnapshot
        viewPlayerId = message.playerId
        lastSnapshotSequence = message.snapshotSequence
        entityReplication.reset(clientSnapshot, message.snapshotSequence)
        enemyEventCursor = {
          eventId: clientSnapshot.world.enemyEvents.at(-1)?.eventId ?? 0,
          runId: clientSnapshot.world.runId,
        }
        timeline = createBoneyardPresentationTimeline({
          initialReceivedAtMs: now(),
          initialSnapshot: clientSnapshot,
          serverTickRate: message.serverTickRate,
          snapshotRate: message.snapshotRate,
        })
        finishHandshake()
        return
      }
      if (message.type === 'server-boneyard-loaded') {
        boneyard = message.boneyard
        finishHandshake()
        if (settled) publish()
        return
      }
      if (!welcome || !snapshot || !viewPlayerId || !timeline) {
        fail(new Error('The server sent observer state before the welcome completed.'))
        return
      }
      if (message.type === 'server-chat') {
        if (message.sequence <= lastChatSequence) return
        lastChatSequence = message.sequence
        chatMessages = appendGameChatMessage(chatMessages, {
          ...(message.activity === undefined ? {} : { activity: message.activity }),
          channel: message.channel,
          ...(message.recipient ? { recipient: message.recipient } : {}),
          sender: message.sender,
          sequence: message.sequence,
          text: message.text,
        })
        publish()
        return
      }
      if (message.type === 'server-pong') {
        const sentAt = pendingPings.get(message.nonce)
        if (sentAt === undefined) return
        pendingPings.delete(message.nonce)
        pingMs = Math.max(0, Math.round(now() - sentAt))
        publish()
        return
      }
      if (message.type !== 'server-snapshot') return
      if (message.sequence <= lastSnapshotSequence) return
      let reconstructed: GameClientSnapshot
      try {
        reconstructed = entityReplication.apply(message.frame, message.sequence)
      } catch (error) {
        if (!(error instanceof EntityReplicationGapError)) {
          fail(error)
          return
        }
        options.transport.send(encodeGameMessage({
          type: 'client-snapshot-ack',
          requireKeyframe: true,
          sequence: lastSnapshotSequence,
        }))
        return
      }
      if (
        !isBoneyardGameSnapshot(reconstructed)
        || reconstructed.world.runId !== boneyard?.runId
      ) {
        fail(new Error('The observed match changed identity.'))
        return
      }
      lastSnapshotSequence = message.sequence
      options.transport.send(encodeGameMessage({
        type: 'client-snapshot-ack',
        requireKeyframe: false,
        sequence: message.sequence,
      }))
      snapshot = reconstructed
      if (!snapshot.players[viewPlayerId]) {
        viewPlayerId = Object.keys(snapshot.players)[0] ?? null
        if (!viewPlayerId) {
          fail(new Error('The observed match no longer has a viewable player.'))
          return
        }
      }
      timeline.push(reconstructed, now())
      publishEnemyEvents(reconstructed)
      publish()
    })

    const removeClose = options.transport.onClose((event) => {
      if (closed || closedByClient) return
      closed = true
      cleanup()
      if (event.code === 1000 && event.reason === 'observed match ended') {
        options.onEnded?.(event.reason)
        return
      }
      const failure = failureFromTransportClose(event)
      if (!settled) reject(failure)
      else options.onFatal?.(failure)
    })

    const session: GameObserverSession = {
      get modAssets() {
        if (!welcome) throw new Error('observer session has not been welcomed')
        return welcome.modAssets
      },
      get modCatalog() {
        if (!welcome) throw new Error('observer session has not been welcomed')
        return welcome.modCatalog
      },
      get sessionKind() {
        if (!welcome || welcome.sessionKind === 'standalone') {
          throw new Error('observer session has not been welcomed')
        }
        return welcome.sessionKind
      },
      close() {
        if (closed) return
        closed = true
        closedByClient = true
        cleanup()
        if (options.transport.readyState === 'open') {
          options.transport.send(encodeGameMessage({ type: 'client-disconnect' }))
        }
        options.transport.close(1000, 'observer closed')
      },
      current: currentState,
      samplePresentation(requestedNow = now()) {
        if (!timeline) throw new Error('observer session has no presentation timeline')
        return timeline.sample(requestedNow)
      },
      subscribeEnemyEvent(listener) {
        enemyEventListeners.add(listener)
        return () => enemyEventListeners.delete(listener)
      },
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    }

    options.transport.send(encodeGameMessage({
      type: 'client-observer-hello',
      credential: options.credential,
      protocolVersion: GAME_PROTOCOL_VERSION,
    }))

    function finishHandshake(): void {
      if (settled || !welcome || !snapshot || !viewPlayerId || !boneyard || !timeline) return
      if (!isBoneyardGameSnapshot(snapshot)) {
        fail(new Error('The observer snapshot is not a Boneyard snapshot.'))
        return
      }
      if (boneyard.runId !== snapshot.world.runId) {
        fail(new Error('The observer Boneyard does not match its snapshot.'))
        return
      }
      settled = true
      globalThis.clearTimeout(handshakeDeadline)
      sendPing()
      pingTimer = globalThis.setInterval(sendPing, PING_INTERVAL_MS)
      resolve(session)
    }

    function currentState(): GameObserverState {
      if (!snapshot || !viewPlayerId || !boneyard) {
        throw new Error('observer session is not ready')
      }
      return { boneyard, chatMessages, pingMs, snapshot, viewPlayerId }
    }

    function publish(): void {
      if (!settled) return
      const state = currentState()
      for (const listener of listeners) listener(state)
    }

    function sendPing(): void {
      if (closed || options.transport.readyState !== 'open') return
      const nonce = nextPingNonce
      nextPingNonce = nextPingNonce === 0x7fff_ffff ? 1 : nextPingNonce + 1
      pendingPings.set(nonce, now())
      options.transport.send(encodeGameMessage({ type: 'client-ping', nonce }))
    }

    function cleanup(): void {
      globalThis.clearTimeout(handshakeDeadline)
      if (pingTimer !== undefined) globalThis.clearInterval(pingTimer)
      pingTimer = undefined
      pendingPings.clear()
      listeners.clear()
      enemyEventListeners.clear()
      removeMessage()
      removeClose()
    }

    function fail(error: unknown): void {
      if (closed) return
      closed = true
      const failure = GameConnectionFailure.from(error)
      cleanup()
      options.transport.close(4008, failure.message.slice(0, 123))
      if (!settled) reject(failure)
      else options.onFatal?.(failure)
    }

    function publishEnemyEvents(nextSnapshot: GameClientSnapshot): void {
      if (!isBoneyardGameSnapshot(nextSnapshot)) return
      if (enemyEventCursor?.runId !== nextSnapshot.world.runId) {
        enemyEventCursor = { eventId: 0, runId: nextSnapshot.world.runId }
      }
      for (const event of nextSnapshot.world.enemyEvents) {
        if (event.eventId <= (enemyEventCursor?.eventId ?? 0)) continue
        enemyEventCursor = { eventId: event.eventId, runId: event.runId }
        for (const listener of enemyEventListeners) listener(event)
      }
    }
  })
}
