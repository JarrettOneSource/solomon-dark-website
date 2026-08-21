import { GAME_PROTOCOL_VERSION } from '../protocol/game-protocol.ts'
import type { GameConnectionFailure } from './game-connection-failure.ts'

export type GameDiagnosticLevel = 'error' | 'info' | 'warning'

export interface GameDiagnosticEntry {
  atUtc: string
  level: GameDiagnosticLevel
  event: string
  message: string
  detail: string | null
}

export interface BrowserGameDiagnosticFailure {
  code: string
  explanation: string
  technicalDetail: string | null
  transportCode: number | null
  transportReason: string | null
  transportWasClean: boolean | null
}

export interface BrowserGameDiagnosticReport {
  schemaVersion: 1
  clientLogId: string
  capturedAtUtc: string
  protocolVersion: number
  pageUrl: string
  sessionId: string | null
  online: boolean
  userAgent: string
  droppedEntries: number
  failure: BrowserGameDiagnosticFailure | null
  entries: readonly GameDiagnosticEntry[]
}

export interface BrowserGameDiagnosticEnvironment {
  online: boolean
  pageUrl: string
  sessionId: string | null
  userAgent: string
}

export interface BrowserGameDiagnosticReceipt {
  logId: string
  submittedAtUtc: string
}

export interface GameClientDiagnostics {
  readonly clientLogId: string
  attachBrowserListeners(): () => void
  createReport(
    failure: GameConnectionFailure | null,
    environment?: BrowserGameDiagnosticEnvironment,
  ): BrowserGameDiagnosticReport
  error(event: string, message: string, detail?: string | null): void
  info(event: string, message: string, detail?: string | null): void
  setEndpoint(endpointUrl: string): void
  warning(event: string, message: string, detail?: string | null): void
}

interface GameClientDiagnosticsOptions {
  clientLogId?: string
  maximumEntries?: number
  now?: () => Date
  writeToConsole?: boolean
}

interface BrowserGameDiagnosticSubmissionOptions {
  request?: typeof fetch
  token?: string | null
}

const DEFAULT_MAXIMUM_ENTRIES = 96
const GAME_SESSION_ID = /^\/game-sessions\/([A-Za-z0-9_-]{32})$/
const RECEIPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function createGameClientDiagnostics(
  options: GameClientDiagnosticsOptions = {},
): GameClientDiagnostics {
  const clientLogId = options.clientLogId ?? crypto.randomUUID()
  const maximumEntries = options.maximumEntries ?? DEFAULT_MAXIMUM_ENTRIES
  if (!Number.isInteger(maximumEntries) || maximumEntries < 1 || maximumEntries > 256) {
    throw new Error('maximumEntries must be an integer within 1..256')
  }
  const now = options.now ?? (() => new Date())
  const writeToConsole = options.writeToConsole ?? true
  const entries: GameDiagnosticEntry[] = []
  let droppedEntries = 0
  let sessionId: string | null = null

  const diagnostics: GameClientDiagnostics = {
    clientLogId,
    attachBrowserListeners() {
      if (typeof window === 'undefined') return () => {}
      const online = () => diagnostics.info(
        'browser.online',
        'The browser reported that this device is online.',
      )
      const offline = () => diagnostics.warning(
        'browser.offline',
        'The browser reported that this device is offline.',
      )
      const browserError = (event: ErrorEvent) => diagnostics.error(
        'browser.error',
        event.message || 'The browser reported an uncaught game error.',
        errorDetail(event.error, event.filename, event.lineno, event.colno),
      )
      const unhandledRejection = (event: PromiseRejectionEvent) => diagnostics.error(
        'browser.unhandled_rejection',
        'The browser reported an unhandled game promise rejection.',
        errorDetail(event.reason),
      )
      window.addEventListener('online', online)
      window.addEventListener('offline', offline)
      window.addEventListener('error', browserError)
      window.addEventListener('unhandledrejection', unhandledRejection)
      return () => {
        window.removeEventListener('online', online)
        window.removeEventListener('offline', offline)
        window.removeEventListener('error', browserError)
        window.removeEventListener('unhandledrejection', unhandledRejection)
      }
    },
    createReport(failure, environment = browserEnvironment(sessionId)) {
      return {
        schemaVersion: 1,
        clientLogId,
        capturedAtUtc: now().toISOString(),
        protocolVersion: GAME_PROTOCOL_VERSION,
        pageUrl: bounded(environment.pageUrl, 512),
        sessionId: environment.sessionId,
        online: environment.online,
        userAgent: bounded(environment.userAgent, 512),
        droppedEntries,
        failure: failure ? {
          code: failure.code,
          explanation: bounded(failure.message, 512),
          technicalDetail: nullableBounded(failure.technicalDetail, 2_048),
          transportCode: failure.transport?.code ?? null,
          transportReason: nullableBounded(failure.transport?.reason, 512),
          transportWasClean: failure.transport?.wasClean ?? null,
        } : null,
        entries: entries.map((entry) => ({ ...entry })),
      }
    },
    error: (event, message, detail) => record('error', event, message, detail),
    info: (event, message, detail) => record('info', event, message, detail),
    setEndpoint(endpointUrl) {
      try {
        const endpoint = new URL(endpointUrl)
        sessionId = endpoint.pathname === '/game-hub'
          ? 'shared-hub'
          : GAME_SESSION_ID.exec(endpoint.pathname)?.[1] ?? null
        diagnostics.info(
          'connection.endpoint',
          'The game server endpoint was selected.',
          `server=${endpoint.origin}; sessionId=${sessionId ?? 'none'}`,
        )
      } catch (error) {
        diagnostics.error(
          'connection.endpoint_invalid',
          'The configured game server endpoint is invalid.',
          errorDetail(error),
        )
      }
    },
    warning: (event, message, detail) => record('warning', event, message, detail),
  }

  function record(
    level: GameDiagnosticLevel,
    event: string,
    message: string,
    detail?: string | null,
  ): void {
    const entry: GameDiagnosticEntry = {
      atUtc: now().toISOString(),
      level,
      event: bounded(event, 96),
      message: bounded(message, 512),
      detail: nullableBounded(detail, 2_048),
    }
    entries.push(entry)
    if (entries.length > maximumEntries) {
      entries.shift()
      droppedEntries += 1
    }
    if (writeToConsole) writeConsole(entry)
  }

  return diagnostics
}

export async function submitBrowserGameDiagnostics(
  report: BrowserGameDiagnosticReport,
  options: BrowserGameDiagnosticSubmissionOptions = {},
): Promise<BrowserGameDiagnosticReceipt> {
  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
    'x-solomon-dark-diagnostics': 'browser-game',
  })
  if (options.token) headers.set('authorization', `Bearer ${options.token}`)
  const response = await (options.request ?? fetch)('/api/game/diagnostics', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify(report),
  })
  const payload = await readResponse(response)
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'The logs could not be sent to the server.'
    throw new Error(message)
  }
  if (
    !isRecord(payload)
    || typeof payload.logId !== 'string'
    || !RECEIPT_ID.test(payload.logId)
    || typeof payload.submittedAtUtc !== 'string'
  ) throw new Error('The server returned an invalid log receipt.')
  return {
    logId: payload.logId,
    submittedAtUtc: payload.submittedAtUtc,
  }
}

function browserEnvironment(sessionId: string | null): BrowserGameDiagnosticEnvironment {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { online: true, pageUrl: '', sessionId, userAgent: '' }
  }
  return {
    online: navigator.onLine,
    pageUrl: `${window.location.origin}${window.location.pathname}${window.location.search}`,
    sessionId,
    userAgent: navigator.userAgent,
  }
}

function writeConsole(entry: GameDiagnosticEntry): void {
  const line = `[game:${entry.event}] ${entry.message}`
  const values = entry.detail ? [line, entry.detail] : [line]
  if (entry.level === 'error') console.error(...values)
  else if (entry.level === 'warning') console.warn(...values)
  else console.info(...values)
}

function errorDetail(
  error: unknown,
  filename?: string,
  line?: number,
  column?: number,
): string {
  if (error instanceof Error) return error.stack || error.message
  const location = filename ? `${filename}:${line ?? 0}:${column ?? 0}` : ''
  if (typeof error === 'string') return [error, location].filter(Boolean).join('\n')
  try {
    return [JSON.stringify(error), location].filter(Boolean).join('\n')
  } catch {
    return ['An unprintable browser error occurred.', location].filter(Boolean).join('\n')
  }
}

function bounded(value: string, maximumLength: number): string {
  let normalized = ''
  for (const character of value) {
    const code = character.charCodeAt(0)
    const disallowedControl = code < 32
      ? character !== '\t' && character !== '\n' && character !== '\r'
      : code >= 127 && code <= 159
    if (!disallowedControl) normalized += character
    if (normalized.length >= maximumLength) break
  }
  return normalized.slice(0, maximumLength)
}

function nullableBounded(
  value: string | null | undefined,
  maximumLength: number,
): string | null {
  if (!value) return null
  const normalized = bounded(value, maximumLength).trim()
  return normalized || null
}

async function readResponse(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
