import { subscribeGamePresentationFrames } from '../game-presentation-frame-loop.ts'
import { TITLE_BUILD_REVISION } from '../title-build-revision.ts'
import type { GameClientSession } from './game-client-session.ts'
import { submitBrowserGameDiagnostics, type GameClientDiagnostics } from './game-diagnostics.ts'
import type { GameTransport } from './game-transport.ts'

interface RunPerformanceSample {
  readonly serverTick: number
  readonly durationMs: number
  readonly frames: number
  readonly slowFrames: number
  readonly maximumFrameMs: number
  readonly frameP95Ms: number
  readonly frameP99Ms: number
  readonly snapshots: number
  readonly maximumSnapshotGapMs: number
  readonly messageCharacters: number
  readonly pingMs: number | null
  readonly hidden: boolean
  readonly paused: boolean
}

export interface BrowserRunPerformance {
  readonly runId: string
  readonly playerId: string
  readonly revision: string | null
  readonly endReason: 'game-over' | 'player-died' | 'world-ended' | 'connection-closed' | 'page-hidden'
  readonly width: number
  readonly height: number
  readonly pixelRatio: number
  readonly samples: readonly RunPerformanceSample[]
}

export class RunPerformanceSampler {
  private startedAt: number
  private lastFrameAt: number | null = null
  private lastSnapshotAt: number | null = null
  private frameGaps: number[] = []
  private snapshots = 0
  private maximumSnapshotGapMs = 0
  private messageCharacters = 0
  private hiddenDuringWindow = false

  constructor(now: number) {
    this.startedAt = now
  }

  frame(now: number, hidden: boolean): void {
    this.hiddenDuringWindow ||= hidden
    if (!hidden && this.lastFrameAt !== null && this.frameGaps.length < 1_000) {
      this.frameGaps.push(Math.max(0, now - this.lastFrameAt))
    }
    this.lastFrameAt = hidden ? null : now
  }

  snapshot(now: number): void {
    if (this.lastSnapshotAt !== null) {
      this.maximumSnapshotGapMs = Math.max(this.maximumSnapshotGapMs, now - this.lastSnapshotAt)
    }
    this.lastSnapshotAt = now
    this.snapshots += 1
  }

  message(characters: number): void {
    this.messageCharacters += characters
  }

  visibilityChanged(): void {
    this.lastFrameAt = null
    this.lastSnapshotAt = null
    this.hiddenDuringWindow = true
  }

  sample(now: number, context: Pick<RunPerformanceSample, 'serverTick' | 'pingMs' | 'hidden' | 'paused'>): RunPerformanceSample {
    const gaps = this.frameGaps.sort((a, b) => a - b)
    const sample = {
      ...context,
      hidden: context.hidden || this.hiddenDuringWindow,
      durationMs: Math.max(0, now - this.startedAt),
      frames: gaps.length,
      slowFrames: gaps.filter(gap => gap > 34).length,
      maximumFrameMs: gaps.at(-1) ?? 0,
      frameP95Ms: gaps[Math.max(0, Math.ceil(gaps.length * 0.95) - 1)] ?? 0,
      frameP99Ms: gaps[Math.max(0, Math.ceil(gaps.length * 0.99) - 1)] ?? 0,
      snapshots: this.snapshots,
      maximumSnapshotGapMs: Math.max(this.maximumSnapshotGapMs,
        this.lastSnapshotAt === null ? 0 : now - this.lastSnapshotAt),
      messageCharacters: this.messageCharacters,
    }
    this.startedAt = now
    this.frameGaps = []
    this.snapshots = 0
    this.maximumSnapshotGapMs = 0
    this.messageCharacters = 0
    this.hiddenDuringWindow = false
    return sample
  }
}

export function attachRunPerformanceCapture(
  session: Pick<GameClientSession, 'playerId' | 'getSnapshot' | 'getPingMs'
    | 'getGameplayPause' | 'getGameplayResumeGrace' | 'onSnapshot'>,
  transport: GameTransport,
  diagnostics: GameClientDiagnostics,
): void {
  let active: {
    runId: string
    alive: boolean
    sampler: RunPerformanceSampler
    samples: RunPerformanceSample[]
  } | null = null
  const collect = (): void => {
    if (!active) return
    active.samples.push(active.sampler.sample(performance.now(), {
      serverTick: session.getSnapshot().tick,
      pingMs: session.getPingMs(),
      hidden: document.hidden,
      paused: session.getGameplayPause() !== null || session.getGameplayResumeGrace() !== null,
    }))
    if (active.samples.length > 60) active.samples.shift()
  }
  const finish = (endReason: BrowserRunPerformance['endReason']): void => {
    if (!active) return
    collect()
    const environment = diagnostics.createReport(null)
    const report = {
      ...environment,
      clientLogId: crypto.randomUUID(),
      pageUrl: `${location.origin}${location.pathname}`,
      droppedEntries: 0,
      entries: [{
        atUtc: environment.capturedAtUtc,
        level: 'info' as const,
        event: 'run.performance',
        message: 'Run performance captured.',
        detail: null,
      }],
      performance: {
        runId: active.runId,
        playerId: session.playerId,
        revision: TITLE_BUILD_REVISION.full,
        endReason,
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
        samples: active.samples,
      },
    }
    active = null
    void submitBrowserGameDiagnostics(report, { keepalive: true }).catch((error: Error) => {
      diagnostics.warning('run.performance_upload_failed', 'Run performance could not be uploaded.',
        error.message)
    })
  }
  const observe = (): void => {
    const snapshot = session.getSnapshot()
    const nextRunId = snapshot.run.phase === 'active' ? snapshot.run.runId : null
    const alive = snapshot.players[session.playerId]?.progression.lifeState === 'alive'
    if (active?.alive && !alive && active.runId === nextRunId) finish('player-died')
    if (nextRunId !== (active?.runId ?? null)) {
      finish(snapshot.run.phase === 'game-over' ? 'game-over' : 'world-ended')
      if (nextRunId) active = {
        runId: nextRunId,
        alive,
        sampler: new RunPerformanceSampler(performance.now()),
        samples: [],
      }
    }
    if (active) {
      active.alive = alive
      active.sampler.snapshot(performance.now())
    }
  }
  const removeSnapshot = session.onSnapshot(observe)
  const removeFrames = subscribeGamePresentationFrames(now => {
    active?.sampler.frame(now, document.hidden)
  })
  const visibilityChanged = (): void => active?.sampler.visibilityChanged()
  document.addEventListener('visibilitychange', visibilityChanged)
  const removeMessages = transport.onMessage(payload => {
    active?.sampler.message(payload.length)
  })
  const timer = window.setInterval(collect, 1_000)
  const stop = (reason: BrowserRunPerformance['endReason']): void => {
    finish(reason)
    clearInterval(timer)
    removeSnapshot()
    removeFrames()
    removeMessages()
    removeClose()
    window.removeEventListener('pagehide', pageHidden)
    document.removeEventListener('visibilitychange', visibilityChanged)
  }
  const removeClose = transport.onClose(() => stop('connection-closed'))
  const pageHidden = (event: PageTransitionEvent): void => {
    if (event.persisted) finish('page-hidden')
    else stop('page-hidden')
  }
  window.addEventListener('pagehide', pageHidden)
  observe()
}
