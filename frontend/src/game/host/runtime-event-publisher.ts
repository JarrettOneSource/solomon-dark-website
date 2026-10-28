import { setTimeout as delay } from 'node:timers/promises'

const MAXIMUM_QUEUED_EVENTS = 256
const MAXIMUM_ATTEMPTS = 5
const RETRY_DELAYS_MS = [100, 500, 2_000, 5_000] as const
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

export interface RuntimeEventEntry {
  readonly component: string
  readonly details: Readonly<Record<string, unknown>>
  readonly event: string
  readonly message: string
  readonly occurredAtUtc?: string
}

export type RuntimeEventSink = (entry: RuntimeEventEntry) => void

export interface RuntimeEventPublisher {
  readonly publish: RuntimeEventSink
  close(): Promise<void>
}

interface QueuedRuntimeEvent {
  attempts: number
  readonly entry: RuntimeEventEntry
}

export function createRuntimeEventPublisher(
  endpoint: string,
  secret: string,
): RuntimeEventPublisher {
  const url = new URL(endpoint)
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error('The runtime event endpoint must use loopback HTTP')
  }
  if (secret.length < 32) throw new Error('The runtime event secret must contain at least 32 bytes')

  const queue: QueuedRuntimeEvent[] = []
  let accepting = true
  let pumping: Promise<void> | null = null

  const pump = async () => {
    while (queue.length > 0) {
      const queued = queue[0]!
      try {
        const response = await fetch(url, {
          body: JSON.stringify({
            component: queued.entry.component,
            event: queued.entry.event,
            message: queued.entry.message,
            occurredAtUtc: queued.entry.occurredAtUtc ?? new Date().toISOString(),
            details: queued.entry.details,
          }),
          headers: {
            authorization: `Bearer ${secret}`,
            'content-type': 'application/json',
          },
          method: 'POST',
          signal: AbortSignal.timeout(2_000),
        })
        if (!response.ok) throw new Error(`runtime event endpoint returned ${response.status}`)
        queue.shift()
      } catch {
        queued.attempts += 1
        if (queued.attempts >= MAXIMUM_ATTEMPTS) {
          queue.shift()
          continue
        }
        await delay(RETRY_DELAYS_MS[Math.min(
          queued.attempts - 1,
          RETRY_DELAYS_MS.length - 1,
        )]!)
      }
    }
  }

  const startPump = () => {
    if (pumping !== null) return
    pumping = pump().finally(() => {
      pumping = null
      if (queue.length > 0) startPump()
    })
  }

  return {
    publish(entry) {
      if (!accepting) return
      if (queue.length >= MAXIMUM_QUEUED_EVENTS) queue.shift()
      queue.push({ attempts: 0, entry })
      startPump()
    },
    async close() {
      accepting = false
      await pumping
    },
  }
}
