import { execFile } from 'node:child_process'
import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { availableParallelism, cpus, freemem, loadavg, totalmem } from 'node:os'
import { performance, monitorEventLoopDelay } from 'node:perf_hooks'
import { promisify } from 'node:util'

const exec = promisify(execFile)
export const PROBE_MS = 1_000
const diagnosticSecrets = new Set()
export function registerDiagnosticSecret(value) {
  if (typeof value !== 'string' || value.length <= 5) return
  diagnosticSecrets.add(value)
  if (value.startsWith('solomondarker://') && value.includes('#')) diagnosticSecrets.add(value.split('#')[1])
}
export function redactDiagnosticText(text) {
  let value = String(text).replace(/solomondarker:\/\/[^\s"'<>]+/g, 'solomondarker://[invitation-redacted]')
  for (const secret of diagnosticSecrets) if (secret) value = value.split(secret).join('[secret-redacted]')
  return value
}

export function parseProcessRows(text) {
  return text.split('\n').flatMap(line => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\w+\s+\w+\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(\S+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line)
    return m ? [{ pid: +m[1], ppid: +m[2], birth: m[3].replace(/\s+/g, ' '), cpuTime: m[4], cpuPercent: +m[5], rssKiB: +m[6], state: m[7], executable: basename(m[8]) }] : []
  })
}
export function ownedForest(rows, roots) {
  const ids = new Set(roots)
  for (;;) {
    const before = ids.size
    for (const row of rows) if (ids.has(row.ppid)) ids.add(row.pid)
    if (before === ids.size) return rows.filter(row => ids.has(row.pid))
  }
}
export function driverOwnedProcesses(rows, driverPid, registeredRoots = []) {
  return ownedForest(rows, [driverPid, ...registeredRoots]).filter(row => row.pid !== driverPid)
}
export function trustedRegisteredRoots(rows, roots, identities) {
  return roots.filter(pid => {
    const row = rows.find(item => item.pid === pid)
    return row && (!identities.has(pid) || identities.get(pid) === row.birth)
  })
}
export function safeURL(raw) {
  try {
    const u = new URL(raw)
    if (u.protocol === 'solomondarker:') return 'solomondarker://[invitation-redacted]'
    return u.protocol + '//' + u.host + u.pathname
  } catch { return '[unparseable-url]' }
}
const scalar = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const integer = (value, fallback = 0) => Number.isSafeInteger(value) ? value : fallback
const stackSymbol = value => typeof value === 'string' && /^[A-Za-z_$~][A-Za-z0-9_$~:.]{0,199}$/.test(value) && redactDiagnosticText(value) === value ? value : '[omitted]'
export function sanitizeCPUProfile(profile, bundledScripts) {
  const nodes = Array.isArray(profile?.nodes) ? profile.nodes : []
  const samples = Array.isArray(profile?.samples) ? profile.samples : []
  const deltas = Array.isArray(profile?.timeDeltas) ? profile.timeDeltas : []
  let remainingEdges = 20_000
  const frame = raw => {
    let url = ''
    try {
      const parsed = new URL(raw?.url)
      if (parsed.protocol === 'solomon-darker:' && parsed.host === 'app' && bundledScripts.has(parsed.pathname)) {
        const candidate = 'solomon-darker://app' + parsed.pathname
        if (redactDiagnosticText(candidate) === candidate) url = candidate
      }
    } catch {}
    const builtIn = ['(root)', '(program)', '(idle)', '(garbage collector)'].includes(raw?.functionName) && !raw?.url
    return { functionName: builtIn ? raw.functionName : url ? stackSymbol(raw?.functionName) : '[omitted]',
      url, lineNumber: integer(raw?.lineNumber, -1), columnNumber: integer(raw?.columnNumber, -1) }
  }
  return {
    startTime: scalar(profile?.startTime), endTime: scalar(profile?.endTime),
    nodes: nodes.slice(0, 10_000).map(node => {
      const children = Array.isArray(node?.children) ? node.children.slice(0, remainingEdges).filter(Number.isSafeInteger) : []
      remainingEdges -= children.length
      return { id: integer(node?.id), hitCount: Math.max(0, integer(node?.hitCount)), children, callFrame: frame(node?.callFrame) }
    }),
    samples: samples.slice(0, 20_000).map(value => integer(value)),
    timeDeltas: deltas.slice(0, Math.min(20_000, samples.length)).map(value => Math.max(0, scalar(value))),
    truncated: { nodes: nodes.length > 10_000, samples: samples.length > 20_000 },
  }
}
export function sanitizeNativeSample(raw) {
  const text = String(raw)
  const interval = /every ([\d.]+) millisecond/.exec(text)
  const frames = []
  let inGraph = false, truncated = false
  for (const line of text.split('\n')) {
    if (line.trim() === 'Call graph:') { inGraph = true; continue }
    if (/^(Total number in stack|Binary Images|Sort by top of stack)/.test(line)) inGraph = false
    if (!inGraph) continue
    const match = /^\s*([+!:| ]*)(\d+) (.+?) \(in ([^)]+)\)(?: \+ (\d+))? \[0x[0-9a-fA-F]+\]\s*$/.exec(line)
    if (!match) continue
    if (frames.length === 4096) { truncated = true; break }
    // Signatures, template arguments, addresses, thread labels and image paths are not retained.
    const leadingOffset = / \+ (\d+)$/.exec(match[3])
    const symbol = match[3].replace(/ \+ \d+$/, '').split(/[<(]/, 1)[0].trim()
    frames.push({ depth: match[1].replace(/ /g, '').length, samples: +match[2], symbol: stackSymbol(symbol), offset: +(match[5] ?? leadingOffset?.[1] ?? 0) })
  }
  return { intervalMs: interval ? +interval[1] : null, frames, truncated }
}
function nativeFailureMetadata(error, elapsedMs) {
  const codes = new Set(['ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'EACCES', 'EPERM', 'ENOENT', 'ESRCH', 'ETIMEDOUT'])
  const signals = new Set(['SIGTERM', 'SIGKILL', 'SIGABRT', 'SIGSEGV', 'SIGINT', 'SIGHUP', 'SIGBUS'])
  const byteCount = value => typeof value === 'string' ? Buffer.byteLength(value) : Buffer.isBuffer(value) ? value.length : 0
  return {
    code: Number.isSafeInteger(error?.code) ? error.code : error?.code == null ? null : codes.has(error.code) ? error.code : 'other',
    signal: error?.signal == null ? null : signals.has(error.signal) ? error.signal : 'other',
    killed: error?.killed === true, elapsedMs: Math.max(0, scalar(elapsedMs)),
    configuredTimeoutMs: 2500, maxBufferBytes: 1024 * 1024,
    stdoutBytes: byteCount(error?.stdout), stderrBytes: byteCount(error?.stderr),
  }
}
export function createGuestTitleDiagnostics({ openSession, guest, identities, readRows, bundledScripts, record,
  now = () => performance.now(), requestDeadlineMs = PROBE_MS,
  sampleProcess = async pid => (await exec('/usr/bin/sample', [String(pid), '1', '1', '-file', '/dev/stdout'], { timeout: 2500, maxBuffer: 1024 * 1024 })).stdout,
}) {
  let session, starting, closing, detaching, finished = false, cancelled = false, sealed = false, startIssued = false, stallTaken = false, sampling
  let startRequestedMonoMs = null, stopRequested = false, stopSettled = false, detachSettled = false
  const emit = (event, data) => { if (!sealed) record(event, data) }
  const profileIdentity = { target: 'guest-page', rootPid: guest.pid, rootBirth: identities.get(guest.pid) ?? null }
  const failure = (step, kind, detail = {}) => emit('instrumentation-error', { area: 'guest-title', step, kind, ...detail })
  const bounded = async (action, step) => {
    let timer
    try {
      const result = await Promise.race([
        Promise.resolve().then(action).then(value => ({ ok: true, value }), () => ({ ok: false, kind: 'protocol-error' })),
        new Promise(resolve => { timer = setTimeout(() => resolve({ ok: false, kind: 'deadline' }), requestDeadlineMs) }),
      ])
      if (!result.ok) failure(step, result.kind)
      return result
    } finally { clearTimeout(timer) }
  }
  // Raw caught detach adds neither a timer nor a new wait to final shutdown.
  const detach = () => {
    if (!session) return Promise.resolve()
    return detaching ??= Promise.resolve().then(() => session.detach()).then(() => {
      detachSettled = true; emit('guest-profiler-detached', profileIdentity)
    }, () => {
      detachSettled = true; failure('profiler-detach', 'protocol-error')
    }).catch(() => {})
  }
  const closeProfiler = reason => {
    cancelled = true
    return closing ??= (async () => {
      if (session && startIssued) {
        const stopRequestedMonoMs = now()
        stopRequested = true
        // Keep the same request after its responsiveness race; recovery during
        // existing failure capture can still provide a sanitized profile.
        const stop = Promise.resolve().then(() => session.send('Profiler.stop')).then(value => {
          stopSettled = true
          if (!sealed) {
            if (value?.profile) emit('guest-cpu-profile', { ...profileIdentity, reason, samplingIntervalUs: 10_000,
              startRequestedMonoMs, stopRequestedMonoMs, stopResponseMonoMs: now(), profile: sanitizeCPUProfile(value.profile, bundledScripts) })
            else failure('profiler-stop', 'missing-profile')
            emit('guest-profiler-stop-settled', { reason, startIssued, succeeded: true })
          }
          void detach()
        }, () => {
          stopSettled = true
          failure('profiler-stop', 'protocol-error')
          emit('guest-profiler-stop-settled', { reason, startIssued, succeeded: false })
          void detach()
        }).catch(() => {
          try { failure('profiler-stop', 'capture-error') } catch {}
          void detach()
        })
        const result = await bounded(() => stop, 'profiler-stop')
        if (!result.ok) emit('guest-profiler-stop-pending', { reason, startIssued })
      } else {
        if (session) void detach()
        emit('guest-profiler-finished', { reason, startIssued, stopRequested: false })
      }
    })()
  }
  const sampleStacks = async () => {
    const rootBirth = identities.get(guest.pid)
    const selected = ['Tab', 'GPU'].map(type => (guest.metrics ?? []).find(row => row.type === type))
    await Promise.all(selected.map(async metric => {
      if (!metric) { failure('native-sample', 'missing-metric'); return }
      const { pid, type } = metric, birth = identities.get(pid)
      const matches = rows => rootBirth && birth && rows.some(row => row.pid === guest.pid && row.birth === rootBirth) &&
        ownedForest(rows, [guest.pid]).some(row => row.pid === pid && row.birth === birth)
      let before
      try { before = await readRows() } catch { failure('native-sample', 'ownership-read-unavailable', { pid, type }); return }
      if (sealed || guest.child.exitCode !== null || guest.child.signalCode !== null || !matches(before)) {
        failure('native-sample', 'ownership-unverified', { pid, type }); return
      }
      const startedMonoMs = now()
      let raw, partial = false
      try { raw = await sampleProcess(pid) }
      catch (error) {
        partial = true
        failure('native-sample', 'sample-failed', { pid, type, ...nativeFailureMetadata(error, now() - startedMonoMs) })
        raw = typeof error?.stdout === 'string' ? error.stdout : Buffer.isBuffer(error?.stdout) ? error.stdout.toString('utf8') : ''
      }
      if (sealed) return
      const endedMonoMs = now()
      let after
      try { after = await readRows() } catch { failure('native-sample', 'ownership-read-unavailable', { pid, type }); return }
      if (sealed) return
      if (!matches(after)) { failure('native-sample', 'identity-changed', { pid, type }); return }
      const sample = sanitizeNativeSample(raw)
      if (!sample.frames.length) { failure('native-sample', 'no-parsed-stacks', { pid, type }); return }
      emit('process-stack-sample', { pid, type, birth, rootPid: guest.pid, rootBirth, startedMonoMs, endedMonoMs, durationSeconds: 1, partial, sample })
    }))
  }
  return {
    start() {
      if (finished || cancelled) return Promise.resolve(false)
      return starting ??= (async () => {
        const result = await bounded(async () => {
          session = await openSession()
          if (cancelled) { void detach(); return false }
          await session.send('Profiler.enable')
          if (cancelled) return false
          await session.send('Profiler.setSamplingInterval', { interval: 10_000 })
          if (cancelled) return false
          startIssued = true; startRequestedMonoMs = now()
          await session.send('Profiler.start')
          if (cancelled) return false
          emit('guest-profiler-started', { ...profileIdentity, samplingIntervalUs: 10_000, startRequestedMonoMs, startResponseMonoMs: now() })
          return true
        }, 'profiler-start')
        if (!result.ok) void closeProfiler('start-failed')
        return result.ok && result.value === true
      })()
    },
    checkStall(issuedMonoMs, phase) {
      if (finished || !starting || stallTaken || phase !== 'title' || now() - issuedMonoMs < 5_000 || guest.child.exitCode !== null || guest.child.signalCode !== null) return Promise.resolve()
      stallTaken = true
      emit('guest-renderer-stall', { outstandingProbeMs: now() - issuedMonoMs, issuedMonoMs, thresholdMs: 5_000 })
      return sampling = sampleStacks()
    },
    async finish(reason) {
      finished = true
      await Promise.all([closeProfiler(reason), sampling])
    },
    seal() {
      if (sealed) return
      emit('guest-profiler-sealed', { stopRequested, stopSettled, detachRequested: Boolean(detaching), detachSettled })
      sealed = true; finished = true; cancelled = true
      if (session) void detach()
    },
  }
}
export function installRendererTelemetry() {
  const state = {
    started: performance.now(), timers: 0, raf: 0, lastTimer: performance.now(), lastRaf: null,
    maxTimerLagMs: 0, maxRafGapMs: 0, longTasks: { count: 0, duration: 0, max: 0, entries: [], dropped: 0 },
    decodes: { started: 0, completed: 0, failed: 0, pending: {} },
    contextEvents: [], firstMenu: null, firstTutorial: null,
  }
  Object.defineProperty(window, '__sdrDesktopDiagnostic', { value: state, configurable: true })
  let ordinal = 0
  const wrap = (target, name, kind) => {
    if (!target || typeof target[name] !== 'function') return
    const original = target[name]
    target[name] = function (...args) {
      const id = String(++ordinal)
      const started = performance.now()
      state.decodes.started++
      state.decodes.pending[id] = { kind, started }
      let result
      try { result = Reflect.apply(original, this, args) }
      catch (error) { state.decodes.failed++; delete state.decodes.pending[id]; throw error }
      if (result && typeof result.then === 'function') {
        result.then(() => { state.decodes.completed++; delete state.decodes.pending[id] },
          () => { state.decodes.failed++; delete state.decodes.pending[id] })
      } else delete state.decodes.pending[id]
      return result
    }
  }
  wrap(HTMLImageElement.prototype, 'decode', 'image.decode')
  wrap(globalThis.BaseAudioContext?.prototype, 'decodeAudioData', 'audio.decodeAudioData')
  wrap(globalThis, 'createImageBitmap', 'createImageBitmap')
  const observeDOM = () => {
    const now = performance.now()
    if (state.firstMenu === null && document.querySelector('.main-menu-page')) state.firstMenu = now
    if (state.firstTutorial === null && document.querySelector('[data-prompt-kind="tutorial"] [role="dialog"]')) state.firstTutorial = now
  }
  new MutationObserver(observeDOM).observe(document, { childList: true, subtree: true })
  setInterval(() => {
    const now = performance.now()
    state.maxTimerLagMs = Math.max(state.maxTimerLagMs, now - state.lastTimer - 1000)
    state.lastTimer = now
    state.timers++
  }, 1000)
  const frame = now => {
    if (state.lastRaf !== null) state.maxRafGapMs = Math.max(state.maxRafGapMs, now - state.lastRaf)
    state.lastRaf = now
    state.raf++
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  try {
    new PerformanceObserver(list => {
      for (const item of list.getEntries()) {
        state.longTasks.count++; state.longTasks.duration += item.duration
        state.longTasks.max = Math.max(state.longTasks.max, item.duration)
        if (state.longTasks.entries.length === 256) { state.longTasks.entries.shift(); state.longTasks.dropped++ }
        state.longTasks.entries.push({ startTime: item.startTime, duration: item.duration })
      }
    }).observe({ type: 'longtask', buffered: true })
  } catch {}
  for (const type of ['webglcontextlost', 'webglcontextrestored']) {
    document.addEventListener(type, event => {
      if (state.contextEvents.length < 20) state.contextEvents.push({ type, at: performance.now(), tag: event.target?.tagName })
    }, true)
  }
}
export function rendererSnapshot() {
  const text = selector => document.querySelector(selector)?.textContent?.slice(0, 600) ?? null
  const selected = (value, keys) => value ? Object.fromEntries(keys.map(key => [key, value[key]])) : null
  const canvas = (selector, key, fields) => {
    const item = document.querySelector(selector)
    return item ? { data: { ...item.dataset }, width: item.width, height: item.height, frame: selected(item[key], fields) } : null
  }
  const state = window.__sdrDesktopDiagnostic
  return {
    sampledAt: performance.now(), timeOrigin: performance.timeOrigin,
    url: location.protocol + '//' + location.host + location.pathname,
    readyState: document.readyState, visibility: document.visibilityState, focused: document.hasFocus(),
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, fonts: document.fonts.status,
    loader: { summary: text('.native-loader-summary'), item: text('.native-loader-item'), count: text('.native-loader-count') },
    menu: document.querySelector('.main-menu-page')?.dataset.gameScene ?? null,
    hub: selected(document.querySelector('.hub-scene')?.dataset, ['rendererState', 'gameplayInputBlocked']),
    loading: { text: text('.match-loading-screen'), stage: document.querySelector('.match-loading-screen')?.dataset.stage ?? null },
    alerts: [...document.querySelectorAll('[role="alert"]')].slice(0, 4).map(item => item.textContent?.slice(0, 600)),
    loaderCanvas: canvas('.native-loader-canvas', '__sdrLoaderFrame', ['frameCount', 'progress']),
    titleCanvas: canvas('.title-menu-canvas', '__sdrTitleFrame', ['frameCount', 'screen', 'solomonFrame']),
    hubCanvas: canvas('.hub-world-canvas', '__sdrHubFrame', ['frameCount', 'tick', 'playerCount']),
    boneyardCanvas: canvas('.boneyard-world-canvas', '__sdrBoneyardFrame', ['frameCount', 'tick', 'playerCount']),
    telemetry: state ? {
      ...state,
      decodes: { ...state.decodes, pending: Object.entries(state.decodes.pending).slice(0, 80).map(([id, value]) => ({ id, ...value, ageMs: performance.now() - value.started })) },
    } : null,
  }
}
export function locatorSnapshot(elements) {
  return elements.map((item, order) => {
    const rect = item.getBoundingClientRect()
    const style = getComputedStyle(item)
    const ancestors = []
    for (let parent = item; parent && ancestors.length < 8; parent = parent.parentElement) {
      if (parent.hidden || parent.hasAttribute('inert') || parent.hasAttribute('aria-hidden')) {
        ancestors.push({ tag: parent.tagName, hidden: parent.hidden, inert: parent.hasAttribute('inert'), ariaHidden: parent.getAttribute('aria-hidden') })
      }
    }
    return {
      order, tag: item.tagName, role: item.getAttribute('role'), action: item.getAttribute('data-game-action'),
      ariaLabel: item.getAttribute('aria-label'), labelledByText: (item.getAttribute('aria-labelledby') ?? '').split(' ').map(id => document.getElementById(id)?.textContent).filter(Boolean).join(' '),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      display: style.display, visibility: style.visibility, checkVisibility: item.checkVisibility?.(), ancestors,
    }
  })
}
export async function createDesktopObserver(evidence, { applicationPath } = {}) {
  mkdirSync(evidence, { recursive: true })
  const file = join(evidence, 'telemetry.jsonl')
  const started = performance.now()
  const instances = []
  const launches = new Map()
  const channels = new Map()
  const owned = new Map()
  const phaseTimers = new Map()
  const instrumentationErrors = []
  const bundledScripts = new Set()
  const loop = monitorEventLoopDelay({ resolution: 20 }); loop.enable()
  let stopped = false, stopping, lastCpu = process.cpuUsage(), requestOrdinal = 0
  const clean = redactDiagnosticText
  const record = (event, data = {}) => {
    if (stopped) return
    if (event === 'instrumentation-error' && instrumentationErrors.length < 100) instrumentationErrors.push(data)
    appendFileSync(file, clean(JSON.stringify({ utc: new Date().toISOString(), monoMs: performance.now() - started, event, ...data })) + '\n')
  }
  if (applicationPath) {
    try {
      for (const entry of readdirSync(join(applicationPath, 'Solomon Darker.app/Contents/Resources/app/client/assets'), { withFileTypes: true })) {
        if (entry.isFile() && /^[A-Za-z0-9_-]{1,160}\.js$/.test(entry.name)) bundledScripts.add('/assets/' + entry.name)
      }
      if (!bundledScripts.size) record('instrumentation-error', { area: 'guest-title', step: 'bundled-script-list', kind: 'empty' })
    } catch { record('instrumentation-error', { area: 'guest-title', step: 'bundled-script-list', kind: 'read-unavailable' }) }
  }
  const probe = async (channel, action) => {
    if (channels.has(channel)) {
      record('probe-skipped-busy', { channel })
      if (channel === 'guest:renderer') {
        const guest = instances.find(item => item.label === 'guest')
        void guest?.titleDiagnostic?.checkStall(channels.get(channel).issued - started, guest.phase)
      }
      return null
    }
    const issued = performance.now()
    record('probe-issued', { channel })
    const pending = Promise.resolve().then(action).then(value => {
      record('probe-response', { channel, latencyMs: performance.now() - issued, value })
      return value
    }, error => {
      record('probe-error', { channel, latencyMs: performance.now() - issued, error: clean(error?.message ?? error) })
      return null
    }).finally(() => channels.delete(channel))
    channels.set(channel, { pending, issued })
    let timeout
    try {
      return await Promise.race([pending, new Promise(resolve => {
        timeout = setTimeout(() => { record('probe-deadline', { channel, deadlineMs: PROBE_MS }); resolve(null) }, PROBE_MS)
      })])
    } finally { clearTimeout(timeout) }
  }
  const readRows = async () => {
    const { stdout } = await exec('/bin/ps', ['-axo', 'pid=,ppid=,lstart=,time=,%cpu=,rss=,stat=,comm='], { timeout: PROBE_MS, maxBuffer: 2 * 1024 * 1024 })
    const rows = parseProcessRows(stdout)
    if (!rows.some(row => row.pid === process.pid)) throw new Error('ps output did not contain the live driver; process-exit proof is incomplete')
    return rows
  }
  const sampleProcesses = () => probe('os-processes', async () => {
    const rows = await readRows()
    const roots = trustedRegisteredRoots(rows, [...launches.values()].map(item => item.pid).filter(Number.isInteger), owned)
    const forest = driverOwnedProcesses(rows, process.pid, roots)
    for (const row of forest) {
      owned.set(row.pid, row.birth)
    }
    const knownAlive = rows.filter(row => owned.get(row.pid) === row.birth)
    const nowCpu = process.cpuUsage()
    const value = { availableParallelism: availableParallelism(), cpuCount: cpus().length, load: loadavg(), totalMemory: totalmem(), freeMemory: freemem(),
      driverCpuDeltaUs: { user: nowCpu.user - lastCpu.user, system: nowCpu.system - lastCpu.system },
      driverEventLoopMaxMs: Number(loop.max) / 1e6, processes: knownAlive }
    lastCpu = nowCpu
    loop.reset()
    return value
  })
  const snapshot = async item => {
    const tasks = [
      probe(item.label + ':renderer', () => item.page.evaluate(rendererSnapshot)),
      probe(item.label + ':electron', () => item.app.evaluate(({ app }) => app.getAppMetrics().map(row => ({
        pid: row.pid, type: row.type, cpu: row.cpu, memory: row.memory, creationTime: row.creationTime,
      })))).then(metrics => { if (metrics) item.metrics = metrics }),
      probe(item.label + ':locators', async () => {
        const play = item.page.getByRole('button', { name: 'Play', exact: true })
        const tutorial = item.page.getByRole('dialog', { name: 'Play the Tutorial?' })
        const results = await Promise.allSettled([
          play.count(), tutorial.count(), play.isVisible(), tutorial.isVisible(), play.or(tutorial).evaluateAll(locatorSnapshot),
        ])
        const names = ['playCount', 'tutorialCount', 'playVisible', 'tutorialVisible', 'union']
        return Object.fromEntries(results.map((result, index) => [names[index], result.status === 'fulfilled' ? result.value : { error: clean(result.reason?.message ?? result.reason) }]))
      }),
    ]
    if (item.cdp) tasks.push(probe(item.label + ':performance', async () => {
      const result = await item.cdp.send('Performance.getMetrics')
      const names = new Set(['Timestamp', 'TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'JSHeapUsedSize', 'Nodes'])
      return result.metrics.filter(row => names.has(row.name))
    }))
    record('pending-resources', { label: item.label, pending: [...item.pending.values()].slice(0, 200).map(row => ({ ...row, ageMs: performance.now() - row.started })) })
    await Promise.all(tasks)
  }
  const sampleAll = async reason => {
    record('snapshot-begin', { reason })
    await Promise.all([sampleProcesses(), ...instances.filter(item => item.child.exitCode === null && item.child.signalCode === null).map(snapshot)])
    record('snapshot-end', { reason })
  }
  const timer = setInterval(() => { void sampleAll('periodic').catch(error => record('sampler-error', { error: clean(error.message) })) }, 2_000)
  timer.unref()
  record('observer-start', { node: process.version, platform: process.platform, arch: process.arch, acceptance: false })
  const api = {
    record, clean,
    addSecret: registerDiagnosticSecret,
    launching(label) { launches.set(label, { pid: null }); record('launch-begin', { label }) },
    async launched(label, pid) {
      launches.set(label, { pid })
      record('launch-process-registered', { label, pid })
      await sampleProcesses()
    },
    async beforeGuestNavigation(page) {
      const item = instances.find(row => row.label === 'guest' && row.page === page)
      await item?.titleDiagnostic?.start()
    },
    async attach(instance) {
      // Playwright disposes its Electron channel on close; the ChildProcess handle remains valid.
      const child = instance.app.process()
      const item = { instance, app: instance.app, child, page: instance.page, label: instance.label, pid: child.pid, pending: new Map(), metrics: null, cdp: null }
      instances.push(item)
      record('instance', { label: item.label, pid: item.pid })
      const requests = new WeakMap()
      item.page.on('request', request => {
        const id = ++requestOrdinal
        requests.set(request, id)
        const row = { id, type: request.resourceType(), url: safeURL(request.url()), started: performance.now() }
        item.pending.set(id, row); record('resource-start', { label: item.label, ...row })
      })
      const finish = (request, error) => {
        const id = requests.get(request), row = item.pending.get(id)
        item.pending.delete(id)
        record('resource-end', { label: item.label, id, url: safeURL(request.url()), ageMs: row ? performance.now() - row.started : null, error })
      }
      item.page.on('requestfinished', request => finish(request, null))
      item.page.on('requestfailed', request => finish(request, request.failure()?.errorText ?? 'unknown'))
      item.page.on('response', response => record('resource-response', { label: item.label, id: requests.get(response.request()), status: response.status(), fromServiceWorker: response.fromServiceWorker(), url: safeURL(response.url()) }))
      item.page.on('crash', () => record('page-crash', { label: item.label }))
      item.page.on('pageerror', error => record('page-error', { label: item.label, error: clean(error.message) }))
      await probe(item.label + ':init-script', () => item.page.context().addInitScript(installRendererTelemetry))
      await probe(item.label + ':cdp-attach', async () => {
        item.cdp = await item.page.context().newCDPSession(item.page)
        await item.cdp.send('Performance.enable')
        return { attached: true }
      })
      void probe(item.label + ':gpu-info', () => item.app.evaluate(async ({ app }) => ({
        features: app.getGPUFeatureStatus(), info: await app.getGPUInfo('basic'), versions: process.versions,
      })))
      await sampleProcesses()
      if (item.label === 'guest') item.titleDiagnostic = createGuestTitleDiagnostics({
        openSession: () => item.page.context().newCDPSession(item.page), guest: item, identities: owned,
        readRows, bundledScripts, record, now: () => performance.now() - started,
      })
    },
    phase(page, name, timeoutMs) {
      const item = instances.find(row => row.page === page)
      if (!item) return
      clearTimeout(phaseTimers.get(page))
      item.phase = name
      record('phase-start', { label: item.label, phase: name, criterionTimeoutMs: timeoutMs, deadlineMonoMs: performance.now() - started + timeoutMs })
      phaseTimers.set(page, setTimeout(() => { void sampleAll(name + '-before-deadline') }, Math.max(0, timeoutMs - 10_000)))
    },
    async endPhase(page, name) {
      const item = instances.find(row => row.page === page)
      clearTimeout(phaseTimers.get(page)); phaseTimers.delete(page)
      record('phase-complete', { label: item?.label, phase: name })
      if (item) item.phase = null
      if (name === 'title') await item?.titleDiagnostic?.finish('title-complete')
    },
    async beforeFailure(error) {
      record('primary-error', { stack: clean(error?.stack ?? error) })
      await Promise.all(instances.map(item => item.titleDiagnostic?.finish('failure')))
      await sampleAll('failure-before-any-screenshot')
    },
    async beforeScreenshot(label) { await sampleAll('before-screenshot-' + label) },
    async cleanup(running, profiles, removeProfiles) {
      clearInterval(timer)
      for (const timer of phaseTimers.values()) clearTimeout(timer)
      phaseTimers.clear()
      // Drain the task-owned sample subprocesses before proving that owned descendants exited.
      await Promise.all(instances.map(item => item.titleDiagnostic?.finish('cleanup')))
      const failures = []
      const fail = (step, error) => { failures.push({ step, message: clean(error?.message ?? error) }); record('cleanup-error', failures.at(-1)) }
      const incompleteLaunches = [...launches].filter(([, value]) => value.pid === null).map(([label]) => label)
      if (incompleteLaunches.length) fail('launch-ownership-incomplete', new Error('Launch rejected before a PID was registered: ' + incompleteLaunches.join(', ') + '. Driver descendants are sampled, but absence of already reparented unobserved processes cannot be proved.'))
      await sampleProcesses()
      for (const instance of [...running].reverse()) {
        const item = instances.find(row => row.instance === instance)
        let timeout
        try {
          await Promise.race([instance.app.close(), new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Save-aware close exceeded the original 25-second exceptional cleanup bound')), 25_000)
          })])
        } catch (error) { fail(instance.label + '-close', error) }
        finally { clearTimeout(timeout) }
        // Allow ordinary descendant exit after app.close before deciding forced cleanup is needed.
        let rows = null
        for (let attempt = 0; attempt < 50; attempt++) {
          rows = await readRows().catch(error => { fail(instance.label + '-ps', error); return null })
          if (!rows || ownedForest(rows, item ? [item.pid] : []).every(row => owned.get(row.pid) !== row.birth)) break
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        if (rows) {
          const target = new Set(ownedForest(rows, item ? [item.pid] : []).map(row => row.pid))
          for (const row of rows) if (owned.get(row.pid) === row.birth && target.has(row.pid)) {
            try { process.kill(row.pid, 'SIGKILL'); fail(instance.label + '-forced-kill', new Error('Forced owned PID ' + row.pid + '; this is a diagnostic cleanup intervention')) }
            catch (error) { if (error.code !== 'ESRCH') fail(instance.label + '-kill', error) }
          }
        }
      }
      // Include orphaned descendants retained by identity across earlier normal closes.
      let remaining = null
      for (let attempt = 0; attempt < 100; attempt++) {
        let rows
        try { rows = await readRows() } catch (error) { fail('verify-owned-exit', error); break }
        remaining = rows.filter(row => owned.get(row.pid) === row.birth)
        if (remaining.length === 0) break
        if (attempt === 50) for (const row of remaining) {
          try { process.kill(row.pid, 'SIGKILL'); fail('forced-orphan-kill', new Error('Forced owned orphan PID ' + row.pid + '; this is a diagnostic cleanup intervention')) }
          catch (error) { if (error.code !== 'ESRCH') fail('orphan-kill', error) }
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (remaining === null || remaining.length) fail('owned-processes-remain', new Error(JSON.stringify(remaining)))
      else if (incompleteLaunches.length === 0) {
        record('owned-processes-exited', { count: owned.size })
        try { await removeProfiles(profiles, { recursive: true, force: true }) }
        catch (error) { fail('remove-profiles', error) }
      } else record('profile-retained', { reason: 'Incomplete launch ownership proof', profiles })
      return failures
    },
    stop(outcome) {
      return stopping ??= (async () => {
        clearInterval(timer)
        for (const timer of phaseTimers.values()) clearTimeout(timer)
        phaseTimers.clear(); loop.disable()
        await Promise.all(instances.map(item => item.titleDiagnostic?.finish('observer-stop')))
        for (const item of instances) item.titleDiagnostic?.seal()
        record('diagnostic-terminal', { ...outcome, instrumentationErrors, acceptance: false })
        writeFileSync(join(evidence, 'diagnostic-terminal.json'), clean(JSON.stringify({ status: outcome.primaryError ? 'original-workload-failed' : outcome.cleanupErrors.length ? 'diagnostic-cleanup-failed' : instrumentationErrors.length ? 'diagnostic-instrumentation-failed' : 'diagnostic-completed', ...outcome, instrumentationErrors, acceptance: false }, null, 2)) + '\n')
        stopped = true
      })()
    },
  }
  return api
}
