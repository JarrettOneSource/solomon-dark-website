const FULL_GIT_REVISION = /^[0-9a-f]{40}$/

export async function deploymentRevisionFromResponse(
  response: Response,
): Promise<string | null> {
  if (!response.ok) return null
  try {
    const value = await response.json() as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const revision = (value as Record<string, unknown>).revision
    if (typeof revision !== 'string') return null
    const normalized = revision.trim().toLowerCase()
    return FULL_GIT_REVISION.test(normalized) ? normalized : null
  } catch {
    return null
  }
}

export function shouldReloadForDeployment(
  currentRevision: string,
  liveRevision: string,
  targetRevision: string | null,
): boolean {
  if (liveRevision === currentRevision) return false
  return targetRevision === null || liveRevision === targetRevision
}

export async function waitForDeploymentRevision(options: {
  currentRevision: string
  intervalMs: number
  signal: AbortSignal
  targetRevision: string | null
}): Promise<void> {
  while (!options.signal.aborted) {
    try {
      const response = await fetch(
        `/deployment.json?current=${encodeURIComponent(options.currentRevision)}`,
        {
          cache: 'no-store',
          headers: { accept: 'application/json' },
          signal: options.signal,
        },
      )
      const liveRevision = await deploymentRevisionFromResponse(response)
      if (
        liveRevision
        && shouldReloadForDeployment(
          options.currentRevision,
          liveRevision,
          options.targetRevision,
        )
      ) return
    } catch (error) {
      if (options.signal.aborted) return
      if (error instanceof TypeError) {
        // The Website is expected to be briefly unreachable during cutover.
      } else {
        throw error
      }
    }
    await abortableDelay(options.intervalMs, options.signal)
  }
}

function abortableDelay(durationMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const timeout = window.setTimeout(done, durationMs)
    signal.addEventListener('abort', done, { once: true })
    function done() {
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', done)
      resolve()
    }
  })
}
