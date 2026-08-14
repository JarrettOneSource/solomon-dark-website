export const GAME_PRESENTATION_FPS_CAP = 400

const GAME_PRESENTATION_FRAME_INTERVAL_MS = 1_000 / GAME_PRESENTATION_FPS_CAP
const GAME_PRESENTATION_TIMER_WAKE_BIAS_MS = 0.75
const GAME_PRESENTATION_UNCAPPED_DETECTION_FRAMES = 3
const GAME_PRESENTATION_UNCAPPED_DETECTION_WINDOW_MS = 250

type GamePresentationFrameCallback = (now: number) => void
type RequestFrame = (callback: FrameRequestCallback) => number
type CancelFrame = (handle: number) => void
type RequestTimeout = (callback: () => void, delayMs: number) => number
type CancelTimeout = (handle: number) => void

interface GamePresentationTimer {
  cancel: CancelTimeout
  request: RequestTimeout
}

interface GamePresentationFrameSchedulerOptions {
  cancelFrame?: CancelFrame
  isUncapped?: () => boolean
  now?: () => number
  requestFrame?: RequestFrame
  timer?: GamePresentationTimer
}

export interface GamePresentationDiagnostics {
  readonly frameCap: number
  readonly frameCount: number
  readonly lastFrameAt: number | null
  readonly uncapped: boolean
  setUncapped(enabled: boolean): void
  subscribe(listener: GamePresentationFrameCallback): () => void
  toggleUncapped(): boolean
}

declare global {
  interface Window {
    readonly __sdrGamePresentation: GamePresentationDiagnostics
  }
}

export class GamePresentationFrameGate {
  private nextFrameAt: number | null = null

  accept(now: number, uncapped: boolean): boolean {
    if (!uncapped && this.nextFrameAt !== null && now < this.nextFrameAt) {
      return false
    }
    this.nextFrameAt = now + GAME_PRESENTATION_FRAME_INTERVAL_MS
    return true
  }

  millisecondsUntilNext(now: number, uncapped: boolean): number {
    if (uncapped || this.nextFrameAt === null) return 0
    return Math.max(0, this.nextFrameAt - now)
  }

  reset(): void {
    this.nextFrameAt = null
  }
}

class BrowserPresentationTimer implements GamePresentationTimer {
  private channel: MessageChannel | null = null
  private nextHandle = 1
  private pending: {
    callback: () => void
    delayMs: number
    handle: number
    timeout: number | null
  } | null = null

  request = (callback: () => void, delayMs: number): number => {
    const handle = this.nextHandle
    this.nextHandle += 1
    this.pending = { callback, delayMs, handle, timeout: null }
    this.ensureChannel().port2.postMessage(handle)
    return handle
  }

  cancel = (handle: number): void => {
    if (this.pending?.handle !== handle) return
    if (this.pending.timeout !== null) window.clearTimeout(this.pending.timeout)
    this.pending = null
  }

  private ensureChannel(): MessageChannel {
    if (this.channel) return this.channel
    this.channel = new MessageChannel()
    this.channel.port1.onmessage = ({ data }: MessageEvent<number>) => {
      const pending = this.pending
      if (!pending || pending.handle !== data) return
      pending.timeout = window.setTimeout(() => {
        if (this.pending?.handle !== pending.handle) return
        this.pending = null
        pending.callback()
      }, Math.max(0, pending.delayMs - GAME_PRESENTATION_TIMER_WAKE_BIAS_MS))
    }
    return this.channel
  }
}

export class GamePresentationFrameScheduler {
  private readonly callbacks = new Set<GamePresentationFrameCallback>()
  private readonly subscribers = new Set<GamePresentationFrameCallback>()
  private readonly gate = new GamePresentationFrameGate()
  private readonly requestFrame: RequestFrame
  private readonly cancelFrame: CancelFrame
  private readonly timer: GamePresentationTimer
  private readonly isUncapped: () => boolean
  private readonly now: () => number
  private animationFrame: number | null = null
  private earlyDetectionStartedAt: number | null = null
  private earlyFrameCount = 0
  private timeout: number | null = null
  private timerPaced = false
  private frameCount = 0
  private lastFrameAt: number | null = null

  constructor(options: GamePresentationFrameSchedulerOptions = {}) {
    this.requestFrame = options.requestFrame ?? (
      (callback) => window.requestAnimationFrame(callback)
    )
    this.cancelFrame = options.cancelFrame ?? (
      (handle) => window.cancelAnimationFrame(handle)
    )
    this.timer = options.timer ?? new BrowserPresentationTimer()
    this.isUncapped = options.isUncapped ?? isGamePresentationUncapped
    this.now = options.now ?? (() => performance.now())
  }

  get acceptedFrameCount(): number {
    return this.frameCount
  }

  get lastAcceptedFrameAt(): number | null {
    return this.lastFrameAt
  }

  start(callback: GamePresentationFrameCallback): () => void {
    if (this.callbacks.size === 0) {
      this.gate.reset()
      this.earlyDetectionStartedAt = null
      this.earlyFrameCount = 0
      this.timerPaced = false
    }
    this.callbacks.add(callback)
    this.schedule()
    return () => {
      this.callbacks.delete(callback)
      if (this.callbacks.size === 0 && this.animationFrame !== null) {
        this.cancelFrame(this.animationFrame)
        this.animationFrame = null
      }
      if (this.callbacks.size === 0 && this.timeout !== null) {
        this.timer.cancel(this.timeout)
        this.timeout = null
      }
    }
  }

  subscribe(listener: GamePresentationFrameCallback): () => void {
    this.subscribers.add(listener)
    return () => this.subscribers.delete(listener)
  }

  presentationPolicyChanged(): void {
    if (this.isUncapped() && this.timeout !== null) {
      this.timer.cancel(this.timeout)
      this.timeout = null
      this.timerPaced = false
    }
    this.schedule()
  }

  private readonly onAnimationFrame = (): void => {
    this.animationFrame = null
    if (this.callbacks.size === 0) return
    const now = this.now()
    if (!this.gate.accept(now, this.isUncapped())) {
      this.timerPaced = this.detectUncappedBrowser(now)
      this.schedule()
      return
    }

    this.publishAndSchedule(now)
  }

  private readonly onTimeout = (): void => {
    this.timeout = null
    if (this.callbacks.size === 0) return
    if (this.isUncapped()) {
      this.timerPaced = false
      this.schedule()
      return
    }
    const now = this.now()
    if (!this.gate.accept(now, false)) {
      this.schedule()
      return
    }

    this.publishAndSchedule(now)
  }

  private detectUncappedBrowser(now: number): boolean {
    if (
      this.earlyDetectionStartedAt === null
      || now - this.earlyDetectionStartedAt
        > GAME_PRESENTATION_UNCAPPED_DETECTION_WINDOW_MS
    ) {
      this.earlyDetectionStartedAt = now
      this.earlyFrameCount = 1
    } else {
      this.earlyFrameCount += 1
    }
    return this.earlyFrameCount >= GAME_PRESENTATION_UNCAPPED_DETECTION_FRAMES
  }

  private publishAndSchedule(now: number): void {
    try {
      for (const callback of this.callbacks) callback(now)
      this.frameCount += 1
      this.lastFrameAt = now
      for (const subscriber of this.subscribers) subscriber(now)
    } finally {
      this.schedule()
    }
  }

  private schedule(): void {
    if (
      this.animationFrame !== null
      || this.timeout !== null
      || this.callbacks.size === 0
    ) return
    if (this.timerPaced && !this.isUncapped()) {
      this.timeout = this.timer.request(
        this.onTimeout,
        this.gate.millisecondsUntilNext(this.now(), false),
      )
      return
    }
    this.animationFrame = this.requestFrame(this.onAnimationFrame)
  }
}

let gamePresentationUncapped = false

const gamePresentationScheduler = new GamePresentationFrameScheduler()

export function isGamePresentationUncapped(): boolean {
  return gamePresentationUncapped
}

export function setGamePresentationUncapped(enabled: boolean): void {
  gamePresentationUncapped = enabled
  gamePresentationScheduler.presentationPolicyChanged()
}

export function toggleGamePresentationUncapped(): boolean {
  setGamePresentationUncapped(!gamePresentationUncapped)
  return gamePresentationUncapped
}

export function startGamePresentationLoop(
  callback: GamePresentationFrameCallback,
): () => void {
  return gamePresentationScheduler.start(callback)
}

export function subscribeGamePresentationFrames(
  listener: GamePresentationFrameCallback,
): () => void {
  return gamePresentationScheduler.subscribe(listener)
}

const gamePresentationDiagnostics: GamePresentationDiagnostics = {
  frameCap: GAME_PRESENTATION_FPS_CAP,
  get frameCount() {
    return gamePresentationScheduler.acceptedFrameCount
  },
  get lastFrameAt() {
    return gamePresentationScheduler.lastAcceptedFrameAt
  },
  get uncapped() {
    return isGamePresentationUncapped()
  },
  setUncapped: setGamePresentationUncapped,
  subscribe: subscribeGamePresentationFrames,
  toggleUncapped: toggleGamePresentationUncapped,
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__sdrGamePresentation', {
    configurable: true,
    value: gamePresentationDiagnostics,
  })
}
