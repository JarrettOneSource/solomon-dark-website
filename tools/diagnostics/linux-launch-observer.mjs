import assert from 'node:assert/strict'
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

// No protocol object, error text, URL, command line, or application output is serialized.
// Unknown methods and sessions are projected to constants or local aliases at this seam.
const METHODS = new Set([
  'Browser.getVersion', 'Browser.setDownloadBehavior', 'Browser.getWindowForTarget', 'Browser.setWindowBounds', 'Browser.close',
  'Target.setAutoAttach', 'Target.getTargetInfo', 'Target.attachToTarget', 'Target.attachedToTarget',
  'Target.detachedFromTarget', 'Target.targetCreated', 'Target.targetDestroyed', 'Target.targetInfoChanged',
  'Runtime.enable', 'Runtime.evaluate', 'Runtime.callFunctionOn', 'Runtime.getProperties', 'Runtime.releaseObject',
  'Runtime.runIfWaitingForDebugger', 'Runtime.executionContextCreated', 'Runtime.executionContextDestroyed',
  'Runtime.executionContextsCleared', 'Runtime.consoleAPICalled', 'Runtime.exceptionThrown', 'Runtime.bindingCalled', 'Runtime.addBinding',
  'Page.enable', 'Page.getFrameTree', 'Page.setLifecycleEventsEnabled', 'Page.addScriptToEvaluateOnNewDocument',
  'Page.createIsolatedWorld', 'Page.setInterceptFileChooserDialog', 'Page.frameAttached', 'Page.frameDetached',
  'Page.frameNavigated', 'Page.navigatedWithinDocument', 'Page.lifecycleEvent', 'Page.loadEventFired',
  'Page.domContentEventFired', 'Page.windowOpen', 'Page.screencastFrame', 'Page.getLayoutMetrics', 'Page.captureScreenshot',
  'Emulation.setFocusEmulationEnabled', 'Emulation.setEmulatedMedia', 'Emulation.setDeviceMetricsOverride',
  'Emulation.setTouchEmulationEnabled', 'Network.enable', 'Network.setCacheDisabled', 'Network.setBypassServiceWorker',
  'Network.requestWillBeSent', 'Network.responseReceived', 'Network.loadingFailed', 'Network.loadingFinished',
  'Log.enable', 'Log.entryAdded', 'Security.enable', 'Inspector.targetCrashed',
])
const STAGES = new Set([
  'node-socket-connected', 'chrome-socket-connected', 'browser-connect-start', 'browser-version-received',
  'browser-context-start', 'browser-context-ready', 'browser-pages-start', 'browser-pages-ready',
  'browser-connect-ready', 'electron-initialize-start', 'node-runtime-enabled', 'electron-initialize-ready',
  'page-initialize-start', 'page-initialize-ready', 'first-noninitial-navigation-wait',
  'first-noninitial-navigation-ready', 'first-noninitial-navigation-failed',
  'solo-host-exited', 'second-launch-resolved', 'peer-boneyard-ready',
  'peer-capture-start', 'peer-capture-complete', 'workload-complete',
])
const validLabel = label => {
  assert.ok(['solo', 'resume', 'host', 'guest'].includes(label), 'Unexpected diagnostic launch label')
  return label
}
const safeError = error => ['TimeoutError', 'AssertionError', 'Error', 'AggregateError'].includes(error?.name) ? error.name : 'other'
const identity = row => row.pid + ':' + row.startTicks
const safeInteger = value => Number.isSafeInteger(value) && value >= 0 ? value : null

const CAPTURE_METHODS = new Set(['Page.getLayoutMetrics', 'Page.captureScreenshot'])
export const CAPTURE_LIMITS = Object.freeze({ intervalMs: 1000, ticks: 65, processesPerTick: 128 })

export function createProtocolRecorder(write) {
  let launch = 'solo'
  const pending = new Map()
  const active = new Set()
  const launching = new Set()
  let startupRecords = 0
  let captureRecords = 0
  const dropped = { sessionLimit: 0, recordLimit: 0, pendingLimit: 0 }
  const stamp = () => ({ at: new Date().toISOString(), monotonicMs: Math.round(performance.now() * 1000) / 1000 })
  return {
    begin(label) { launch = validLabel(label); active.add(label); launching.add(label) },
    launched(label) { launching.delete(validLabel(label)) },
    end(label) { active.delete(validLabel(label)); launching.delete(label) },
    pending: () => [...pending.values()].map(row => ({ ...row })),
    limits: () => ({ ...dropped }),
    logger(channel) {
      assert.ok(channel === 'node' || channel === 'chrome')
      const owner = launch
      const sessions = new Map([['', 'root']])
      return (direction, message) => {
        if (!active.has(owner)) return
        if (direction !== 'send' && direction !== 'receive') return
        if (!message || typeof message !== 'object') return
        const id = safeInteger(message.id)
        const rawSession = typeof message.sessionId === 'string' ? message.sessionId : ''
        if (!sessions.has(rawSession)) {
          if (sessions.size >= 64) { dropped.sessionLimit++; return }
          sessions.set(rawSession, 's' + sessions.size)
        }
        const session = sessions.get(rawSession)
        const key = owner + ':' + channel + ':' + session + ':' + id
        const request = pending.get(key)
        const method = direction === 'receive' && id !== null
          ? request?.method ?? 'other'
          : METHODS.has(message.method) ? message.method : 'other'
        const capture = CAPTURE_METHODS.has(method)
        if (!capture && !launching.has(owner) && !request) return
        if (direction === 'receive' && id !== null) pending.delete(key)
        // Reserve a separate budget so startup traffic cannot consume capture evidence.
        if (capture ? captureRecords++ >= 256 : startupRecords++ >= 4096) { dropped.recordLimit++; return }
        const time = stamp()
        const row = {
          ...time, event: 'protocol', launch: owner, channel, direction, id, method, session,
          outcome: direction === 'send' ? 'pending' : id === null ? 'event' : message.error ? 'error' : 'ok',
          durationMs: request && direction === 'receive' ? Math.max(0, time.monotonicMs - request.monotonicMs) : null,
        }
        if (direction === 'send' && id !== null) {
          if (pending.size < 256) pending.set(key, row)
          else dropped.pendingLimit++
        }
        write(row)
      }
    },
  }
}

export function parseProcStat(text) {
  const end = text.lastIndexOf(')')
  const pid = Number(text.slice(0, text.indexOf(' ')))
  const fields = text.slice(end + 2).trim().split(/\s+/)
  assert.ok(end > 0 && safeInteger(pid) !== null && fields.length >= 20)
  const [state, ppid, pgid, sid] = fields
  const startTicks = fields[19]
  assert.ok([fields[11], fields[12]].every(value => /^\d{1,30}$/.test(value)))
  const cpuTicks = (BigInt(fields[11]) + BigInt(fields[12])).toString()
  assert.ok(/^\d{1,30}$/.test(startTicks) && /^[RSDZTWtXxKPI]$/.test(state))
  const row = { pid, ppid: Number(ppid), pgid: Number(pgid), sid: Number(sid), startTicks, state, cpuTicks }
  assert.ok([row.ppid, row.pgid, row.sid].every(x => safeInteger(x) !== null))
  return row
}

export function ownedProcesses(rows, roots, previous) {
  const trusted = new Set([...roots, ...previous].map(identity))
  // launchProcess creates an exclusive Linux session/group. Its SID remains reserved
  // while group members exist, including a child orphaned between two polls.
  const sessions = roots.filter(root => !rows.some(row => row.pid === root.pid && identity(row) !== identity(root)))
  const owned = new Map(rows.filter(row => trusted.has(identity(row)) || sessions.some(root =>
    row.sid === root.sid && BigInt(row.startTicks) >= BigInt(root.startTicks)
  )).map(row => [row.pid, row]))
  let changed = true
  while (changed) {
    changed = false
    for (const row of rows) {
      if (owned.has(row.pid)) continue
      const parent = owned.get(row.ppid)
      if (parent && BigInt(row.startTicks) >= BigInt(parent.startTicks)) {
        owned.set(row.pid, row)
        changed = true
      }
    }
  }
  return [...owned.values()].sort((a, b) => a.pid - b.pid)
}

function procRows() {
  return readdirSync('/proc').filter(name => /^\d+$/.test(name)).flatMap(name => {
    try { return [parseProcStat(readFileSync('/proc/' + name + '/stat', 'utf8'))] }
    catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) return []; throw error }
  })
}

export function parseProcessRole(commandLine) {
  const argv = commandLine.split('\0').filter(Boolean)
  // Chromium may rewrite argv as one space-joined title with NUL padding.
  // Preserve real argv boundaries so a private argument cannot supply a role.
  const fields = argv.length === 1 ? argv[0].split(/[ \t]+/) : argv
  const roles = fields.filter(field => field.startsWith('--type='))
  if (roles.length !== 1) return 'other'
  return roles[0] === '--type=renderer' ? 'renderer' : roles[0] === '--type=gpu-process' ? 'gpu' : 'other'
}

function procRole(pid) {
  try { return parseProcessRole(readFileSync('/proc/' + pid + '/cmdline', 'utf8')) }
  catch { return 'unavailable' }
}

// The page projects only these primitive fields before returning over CDP.
function readFrameProgress() {
  const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
  return {
    frameCount: Number.isSafeInteger(frame?.frameCount) && frame.frameCount >= 0 ? frame.frameCount : null,
    playerCount: Number.isSafeInteger(frame?.playerCount) && frame.playerCount >= 0 ? frame.playerCount : null,
    visibility: document.visibilityState === 'visible' ? 'visible' : document.visibilityState === 'hidden' ? 'hidden' : 'other',
    hidden: document.hidden === true, focused: document.hasFocus() === true,
    rendererReady: !!document.querySelector('.boneyard-scene[data-renderer-state="ready"]'),
    overlayPresent: !!document.querySelector('.gameplay-resume-progress-overlay'),
  }
}

function safeFrameProgress(value) {
  return {
    frameCount: safeInteger(value?.frameCount), playerCount: safeInteger(value?.playerCount),
    visibility: ['visible', 'hidden'].includes(value?.visibility) ? value.visibility : 'other',
    ...Object.fromEntries(['hidden', 'focused', 'rendererReady', 'overlayPresent'].map(key => [key, typeof value?.[key] === 'boolean' ? value[key] : null])),
  }
}

export function createLinuxLaunchObserver({ outputDirectory, executable, readProcesses = procRows, readProcessRole = procRole, signal = process.kill.bind(process), poll = true }) {
  const eventsPath = join(outputDirectory, 'launch-events.jsonl')
  let infrastructureFailed = false
  const write = row => {
    try { appendFileSync(eventsPath, JSON.stringify(row) + '\n') }
    catch { infrastructureFailed = true }
  }
  let launch = 'solo'
  let secondResolved = false
  let secondStarted = false
  let failure = null
  let known = []
  let capture = null
  let captureOwner = null
  let roleCoverage = null
  let frameCoverageLimited = false
  let workloadComplete = false
  const roots = []
  const children = new Map()
  const apps = new Map()
  const protocol = createProtocolRecorder(write)
  const record = (event, data = {}) => write({
    at: new Date().toISOString(), monotonicMs: Math.round(performance.now() * 1000) / 1000,
    event, launch, ...data,
  })
  const coverageResult = () => ({
    status: roleCoverage === null ? 'not-observed' : roleCoverage.every(owner => owner.samples > 0 && owner.completeSamples === owner.samples) ? 'complete' : 'incomplete',
    owners: roleCoverage ?? [],
    scope: 'Per-tick recognized renderer and GPU roles in owned sessions only. Other roles are parser non-matches, not proof of inactivity; CPU ticks are counters, not utilization.',
  })
  const sample = (progress = false) => {
    let all
    try { all = readProcesses() }
    catch {
      infrastructureFailed = true
      record('process-scan-failed')
      if (progress) capture.lastRoles = roleCoverage.map(owner => { owner.samples++; return { owner: owner.owner, scanFailed: true, complete: false } })
      return []
    }
    const current = roots.flatMap(root => ownedProcesses(all, [root], known.filter(row => row.owner === root.owner)).map(row => {
      const prior = known.find(old => identity(old) === identity(row))
      const role = ['renderer', 'gpu'].includes(prior?.role) ? prior.role : readProcessRole(row.pid)
      return { ...row, owner: root.owner, role: ['renderer', 'gpu', 'other'].includes(role) ? role : 'unavailable' }
    })).sort((a, b) => a.pid - b.pid)
    if (progress) {
      const recognized = current.filter(row => ['renderer', 'gpu'].includes(row.role))
      const cpu = []
      for (const row of recognized.slice(0, CAPTURE_LIMITS.processesPerTick)) {
        const prior = capture?.cpu.get(identity(row))
        const ticks = typeof row.cpuTicks === 'string' && /^\d{1,31}$/.test(row.cpuTicks) ? row.cpuTicks : null
        const observation = {
          owner: row.owner, pid: row.pid, startTicks: row.startTicks, role: row.role, state: row.state,
          cpuTicks: ticks, deltaCpuTicks: prior !== undefined && ticks !== null && BigInt(ticks) >= BigInt(prior) ? (BigInt(ticks) - BigInt(prior)).toString() : null,
        }
        record('capture-process-progress', observation)
        cpu.push(observation)
        if (ticks !== null) capture?.cpu.set(identity(row), ticks)
      }
      capture.lastRoles = roleCoverage.map(total => {
        const owned = current.filter(row => row.owner === total.owner)
        const observed = cpu.filter(row => row.owner === total.owner)
        const processSamples = Object.fromEntries(['renderer', 'gpu', 'other', 'unavailable'].map(role => [role, owned.filter(row => row.role === role).length]))
        const cpuSamples = Object.fromEntries(['renderer', 'gpu'].map(role => [role, observed.filter(row => row.role === role && row.cpuTicks !== null).length]))
        const cpuDeltaSamples = Object.fromEntries(['renderer', 'gpu'].map(role => [role, observed.filter(row => row.role === role && row.deltaCpuTicks !== null).length]))
        const truncated = recognized.filter(row => row.owner === total.owner).length - observed.length
        const invalidCpu = observed.filter(row => row.cpuTicks === null).length
        const complete = processSamples.renderer > 0 && processSamples.gpu > 0 && processSamples.unavailable === 0 && truncated === 0 && invalidCpu === 0
        total.samples++
        if (complete) total.completeSamples++
        for (const [key, counts] of Object.entries({ processSamples, cpuSamples, cpuDeltaSamples }))
          for (const [role, count] of Object.entries(counts)) total[key][role] += count
        total.truncated += truncated
        total.invalidCpu += invalidCpu
        return { owner: total.owner, processSamples, cpuSamples, cpuDeltaSamples, truncated, invalidCpu, complete }
      })
    }
    const oldIds = new Set(known.map(identity))
    const newIds = new Set(current.map(identity))
    for (const row of current) if (!oldIds.has(identity(row))) record('process-observed', row)
    for (const row of known) if (!newIds.has(identity(row))) record('process-exit-observed', { pid: row.pid, startTicks: row.startTicks })
    known = current
    return current
  }
  const killOwned = signalName => {
    // Re-read each identity immediately before signalling; never signal a reused PID.
    for (const row of sample().reverse()) {
      let now
      try { now = readProcesses().find(candidate => identity(candidate) === identity(row)) }
      catch { infrastructureFailed = true; continue }
      if (!now) continue
      try { signal(now.pid, signalName); record('cleanup-signal', { pid: now.pid, startTicks: now.startTicks, signal: signalName }) }
      catch (error) { if (error.code !== 'ESRCH') { infrastructureFailed = true; record('cleanup-signal-failed', { pid: now.pid }) } }
    }
  }
  const captureStop = () => {
    if (!capture) return
    const stopped = capture
    capture = null
    clearInterval(stopped.timer)
    const probes = stopped.peers.map(peer => ({ owner: peer.label, started: peer.started, completed: peer.completed, failed: peer.failed, pending: peer.pendingAt !== null }))
    frameCoverageLimited = stopped.ticks >= CAPTURE_LIMITS.ticks || probes.some(peer => peer.started === 0 || peer.failed > 0 || peer.pending)
    record('capture-observation-stop', { ticks: stopped.ticks, probes, roleCoverage: coverageResult() })
  }
  const captureTick = () => {
    const current = capture
    if (!current) return
    if (current.ticks >= CAPTURE_LIMITS.ticks) { captureStop(); return }
    current.ticks++
    const scanStart = performance.now()
    sample(true)
    record('capture-process-scan', { durationMs: Math.max(0, performance.now() - scanStart), roleCoverage: current.lastRoles })
    for (const peer of current.peers) {
      if (peer.pendingAt !== null) continue
      peer.pendingAt = performance.now()
      peer.started++
      record('capture-frame-probe-start', { owner: peer.label, sample: peer.started })
      // Never await this probe in the workload or queue a second while it is pending.
      Promise.resolve().then(() => peer.page.evaluate(readFrameProgress)).then(value => {
        if (capture !== current) return
        record('capture-frame-progress', { owner: peer.label, sample: peer.started, durationMs: Math.max(0, performance.now() - peer.pendingAt), ...safeFrameProgress(value) })
      }, error => {
        if (capture === current) { peer.failed++; record('capture-frame-probe-failed', { owner: peer.label, errorKind: safeError(error) }) }
      }).finally(() => { peer.pendingAt = null; peer.completed++ })
    }
  }
  const timer = poll ? setInterval(sample, 250) : null
  timer?.unref()
  record('observer-start', { acceptance: false, diagnostic: true, driverPid: process.pid })
  return {
    begin(label) {
      launch = validLabel(label)
      if (label === 'resume') secondStarted = true
      protocol.begin(label)
      record('launch-start', { timeoutMs: 30_000 })
      sample()
    },
    logger: protocol.logger,
    stage(stage, owner = launch) {
      assert.ok(STAGES.has(stage), 'Unknown diagnostic stage')
      record('stage', { stage, owner: validLabel(owner) })
      if (stage === 'peer-capture-start') captureOwner = owner
      if (stage === 'peer-capture-complete') captureOwner = null
      if (stage === 'workload-complete') workloadComplete = true
      if (stage === 'second-launch-resolved') secondResolved = true
      if (stage === 'solo-host-exited') sample()
    },
    spawned(child, command) {
      const owner = launch
      if (children.has(owner)) infrastructureFailed = true
      children.set(owner, child)
      let root
      if (command === executable) {
        try { root = readProcesses().find(row => row.pid === child.pid && row.ppid === process.pid) }
        catch { infrastructureFailed = true; record('spawn-identity-read-failed', { pid: safeInteger(child.pid) }) }
      }
      if (root && root.pgid === root.pid && root.sid === root.pid) {
        roots.push({ ...root, owner })
        record('spawn-owned', root)
        sample()
      } else {
        infrastructureFailed = true
        record('spawn-ownership-unproven', { pid: safeInteger(child.pid) })
      }
      child.once('exit', (code, exitSignal) => record('child-exit', {
        owner, pid: safeInteger(child.pid), code: safeInteger(code),
        signal: ['SIGKILL', 'SIGTERM', 'SIGABRT', 'SIGSEGV', 'SIGINT'].includes(exitSignal) ? exitSignal : null,
      }))
      child.once('close', () => { record('child-streams-closed', { owner, pid: safeInteger(child.pid) }); sample() })
      child.once('error', () => record('child-error', { owner }))
      // Attach before ElectronApplication exists. Chunks are discarded at the producer.
      child.stdout?.on('data', () => {})
      child.stderr?.on('data', () => {})
    },
    returned(label, app) {
      apps.set(validLabel(label), app)
      protocol.launched(label)
      if (!children.has(label) || children.get(label).pid !== app.process().pid) {
        infrastructureFailed = true
        record('returned-ownership-unproven', { owner: label })
      }
      record('launch-resolved', { owner: label })
      sample()
    },
    captureStart(instances) {
      assert.equal(capture, null)
      assert.deepEqual(instances.map(instance => instance.label), ['host', 'guest'])
      for (const instance of instances) assert.equal(apps.get(instance.label), instance.app, 'Capture owner must be a registered app')
      roleCoverage = instances.map(instance => ({
        owner: instance.label, samples: 0, completeSamples: 0,
        processSamples: { renderer: 0, gpu: 0, other: 0, unavailable: 0 },
        cpuSamples: { renderer: 0, gpu: 0 }, cpuDeltaSamples: { renderer: 0, gpu: 0 }, truncated: 0, invalidCpu: 0,
      }))
      capture = { ticks: 0, timer: null, cpu: new Map(), lastRoles: [], peers: instances.map(instance => ({ ...instance, pendingAt: null, started: 0, completed: 0, failed: 0 })) }
      record('capture-observation-start', { limits: CAPTURE_LIMITS })
      capture.timer = setInterval(captureTick, CAPTURE_LIMITS.intervalMs)
      capture.timer.unref()
      captureTick()
    },
    captureStop,
    noise(kind) {
      assert.ok(['main-stderr', 'request-failed', 'page-error', 'console-error'].includes(kind))
      record('application-event', { kind })
    },
    failure(error) {
      failure = safeError(error)
      record('workload-failed', { errorKind: failure, captureOwner, pending: protocol.pending(), protocolLimits: protocol.limits() })
      captureStop()
      sample()
    },
    async cleanup(profiles, removeProfiles) {
      captureStop()
      let cleanupFailed = false
      try {
        for (const [label, app] of apps) {
          const child = children.get(label)
          if (child && (child.exitCode !== null || child.signalCode !== null)) continue
          let timeout
          try {
            const closed = await Promise.race([
              app.close().then(() => true, () => false),
              new Promise(resolveClose => { timeout = setTimeout(() => resolveClose(false), 25_000) }),
            ])
            if (!closed) { cleanupFailed = true; killOwned('SIGKILL') }
          } finally { clearTimeout(timeout) }
        }
        if (sample().length) killOwned('SIGTERM')
        for (let i = 0; i < 50 && sample().length; i++) await delay(100)
        if (sample().length) { cleanupFailed = true; killOwned('SIGKILL') }
        for (let i = 0; i < 50 && sample().length; i++) await delay(100)
        const survivors = sample()
        if (!survivors.length && !infrastructureFailed) {
          try { await removeProfiles(profiles, { recursive: true, force: true }) }
          catch { cleanupFailed = true; record('profile-cleanup-failed') }
        } else cleanupFailed = true
        const result = {
          acceptance: false, diagnostic: true, secondLaunch: secondResolved ? 'resolved' : secondStarted ? 'failed-before-resolution' : 'not-reached',
          failureKind: failure, captureOwner, workloadComplete, processOwnershipProven: roots.length === children.size && !infrastructureFailed,
          processExitProven: !survivors.length && !infrastructureFailed,
          processProofScope: 'Registered exclusive Linux sessions and observed descendants only. Unobserved children that create a new session are outside this proof.',
          cleanupFailed, survivors, pending: protocol.pending(), protocolLimits: protocol.limits(),
          captureRoleCoverage: coverageResult(), frameCoverageLimited,
          instrumentationLimited: infrastructureFailed || frameCoverageLimited || coverageResult().status !== 'complete' || Object.values(protocol.limits()).some(count => count > 0),
        }
        try { writeFileSync(join(outputDirectory, 'launch-outcome.json'), JSON.stringify(result, null, 2) + '\n') }
        catch { infrastructureFailed = true }
        record('observer-stop', { secondResolved, cleanupFailed, survivingProcesses: survivors.length })
        return !cleanupFailed && !infrastructureFailed
      } finally { clearInterval(timer); for (const label of apps.keys()) protocol.end(label) }
    },
  }
}
