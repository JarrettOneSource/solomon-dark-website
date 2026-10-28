import { writeFile } from 'node:fs/promises'

// One diagnostic per run. The existing Windows session owns all commands;
// gameplay sampling continues while setup, capture and teardown are in flight.
export function createSlowWindowsCpuProfile({
  cdp, path, event, onError, thresholdFps = 90, durationMs = 25000, commandTimeoutMs = 5000,
  write = (file, profile, signal) => writeFile(file, JSON.stringify(profile), { flag: 'wx', mode: 0o600, signal }),
}) {
  let startup = null
  let finalization = null
  let timer = null
  let closing = false
  let enableRequested = false
  let startRequested = false
  let firstError = null
  const slowWindows = []
  const status = {
    attempted: false, phase: 'idle', file: path, saved: false, failures: 0,
    samplingIntervalUs: 1000, requestedDurationMs: durationMs, thresholdFps,
    diagnosticStartedAtUtc: null, diagnosticFinishedAtUtc: null,
    startRequestedAtUtc: null, startedAtUtc: null, stopRequestedAtUtc: null, stoppedAtUtc: null,
  }
  const emit = (kind, details = {}) => event(kind, { client: 'windows', ...details })
  const failed = (stage, error) => {
    firstError ??= error
    status.failures += 1
    emit('profiling.failed', { stage, code: error.code ?? error.name ?? 'Error' })
    onError(error)
  }
  const bounded = async (operation, stage, controller = null) => {
    let deadline
    try {
      return await Promise.race([Promise.resolve().then(operation), new Promise((_resolve, reject) => {
        deadline = setTimeout(() => {
          controller?.abort()
          const error = new Error(`${stage} exceeded ${commandTimeoutMs} ms`)
          error.code = 'ETIMEDOUT'
          reject(error)
        }, commandTimeoutMs)
      })])
    } finally { clearTimeout(deadline) }
  }
  const send = (method, parameters) => bounded(() => cdp.send(method, parameters), method)

  const finish = reason => {
    closing = true
    clearTimeout(timer)
    if (finalization) return finalization
    finalization = (async () => {
      await startup
      let profile = null
      if (startRequested) {
        status.phase = 'stopping'
        status.stopRequestedAtUtc = new Date().toISOString()
        emit('profiling.stop_requested', { reason, atUtc: status.stopRequestedAtUtc })
        try {
          const captured = (await send('Profiler.stop')).profile
          if (!captured || !Array.isArray(captured.nodes) || !captured.nodes.length
            || !Number.isFinite(captured.startTime) || !Number.isFinite(captured.endTime)) {
            throw new Error('Profiler.stop returned no usable CPU profile')
          }
          profile = captured
          status.stoppedAtUtc = new Date().toISOString()
          emit('profiling.stop', { reason, outcome: 'stopped', atUtc: status.stoppedAtUtc })
        } catch (error) {
          failed('Profiler.stop', error)
          emit('profiling.stop', { reason, outcome: 'unconfirmed' })
        }
      }
      if (enableRequested) {
        try { await send('Profiler.disable') }
        catch (error) { failed('Profiler.disable', error) }
      }
      if (profile) {
        status.phase = 'writing'
        const controller = new AbortController()
        try {
          await bounded(() => write(path, profile, controller.signal), 'profile.write', controller)
          status.saved = true
          emit('profiling.saved', { file: path })
        } catch (error) { failed('profile.write', error) }
      }
      if (status.attempted) {
        status.phase = firstError ? 'failed' : 'finished'
        status.diagnosticFinishedAtUtc = new Date().toISOString()
        emit('profiling.finished', { reason, saved: status.saved, failures: status.failures,
          atUtc: status.diagnosticFinishedAtUtc })
      }
    })()
    return finalization
  }
  const start = () => {
    status.attempted = true
    status.phase = 'starting'
    status.diagnosticStartedAtUtc = new Date().toISOString()
    emit('profiling.triggered', { atUtc: status.diagnosticStartedAtUtc,
      thresholdFps, consecutiveSamples: 4, windows: [...slowWindows],
      samplingIntervalUs: 1000, durationMs })
    startup = (async () => {
      let stage = 'Profiler.enable'
      try {
        enableRequested = true
        await send(stage)
        if (closing) return
        stage = 'Profiler.setSamplingInterval'
        await send(stage, { interval: 1000 })
        if (closing) return
        stage = 'Profiler.start'
        startRequested = true
        status.startRequestedAtUtc = new Date().toISOString()
        emit('profiling.start_requested', { atUtc: status.startRequestedAtUtc })
        await send(stage)
        status.startedAtUtc = new Date().toISOString()
        status.phase = 'capturing'
        emit('profiling.start', { atUtc: status.startedAtUtc, durationMs, samplingIntervalUs: 1000 })
        if (!closing) timer = setTimeout(() => { void finish('duration-complete') }, durationMs)
      } catch (error) { failed(stage, error) }
    })()
    void startup.then(() => { if (closing || firstError) void finish('startup-ended') })
  }
  return {
    observe(row) {
      if (row.client !== 'windows' || status.attempted || closing) return
      const healthy = row.runId && row.hidden === false && row.lifeState === 'alive'
        && row.playerCount === 2 && row.snapshots > 0 && row.renderedFrames > 0
        && row.durationMs >= 4500 && row.durationMs <= 6000
      if (!healthy || !Number.isFinite(row.renderFps) || row.renderFps >= thresholdFps) {
        slowWindows.length = 0
        return
      }
      slowWindows.push({ atUtc: row.atUtc, renderFps: row.renderFps, durationMs: row.durationMs })
      if (slowWindows.length === 4) start()
    },
    async close(reason = 'monitor-shutdown') {
      await finish(reason)
      if (firstError) throw firstError
    },
    overlaps(startMs, endMs) {
      return status.diagnosticStartedAtUtc !== null
        && Date.parse(status.diagnosticStartedAtUtc) <= endMs
        && (status.diagnosticFinishedAtUtc === null || Date.parse(status.diagnosticFinishedAtUtc) >= startMs)
    },
    status() { return { ...status } },
  }
}
