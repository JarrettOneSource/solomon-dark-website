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
  'Page.domContentEventFired', 'Page.windowOpen', 'Page.screencastFrame', 'Page.captureScreenshot',
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
  'solo-host-exited', 'second-launch-resolved',
])
const validLabel = label => {
  assert.ok(label === 'solo' || label === 'resume', 'Unexpected diagnostic launch label')
  return label
}
const safeError = error => ['TimeoutError', 'AssertionError', 'Error', 'AggregateError'].includes(error?.name) ? error.name : 'other'
const identity = row => row.pid + ':' + row.startTicks
const safeInteger = value => Number.isSafeInteger(value) && value >= 0 ? value : null

export function createProtocolRecorder(write) {
  let launch = 'solo'
  const pending = new Map()
  const active = new Set()
  const stamp = () => ({ at: new Date().toISOString(), monotonicMs: Math.round(performance.now() * 1000) / 1000 })
  return {
    begin(label) { launch = validLabel(label); active.add(label) },
    end(label) { active.delete(validLabel(label)) },
    pending: () => [...pending.values()].map(row => ({ ...row })),
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
        if (!sessions.has(rawSession)) sessions.set(rawSession, 's' + sessions.size)
        const session = sessions.get(rawSession)
        const key = owner + ':' + channel + ':' + session + ':' + id
        const method = direction === 'receive' && id !== null
          ? pending.get(key)?.method ?? 'other'
          : METHODS.has(message.method) ? message.method : 'other'
        const row = { ...stamp(), event: 'protocol', launch: owner, channel, direction, id, method, session }
        if (direction === 'send' && id !== null) pending.set(key, row)
        if (direction === 'receive' && id !== null) pending.delete(key)
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
  assert.ok(/^\d{1,30}$/.test(startTicks) && /^[RSDZTWtXxKPI]$/.test(state))
  const row = { pid, ppid: Number(ppid), pgid: Number(pgid), sid: Number(sid), startTicks, state }
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

export function createLinuxLaunchObserver({ outputDirectory, executable, readProcesses = procRows, signal = process.kill.bind(process), poll = true }) {
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
  const roots = []
  const children = new Map()
  const apps = new Map()
  const protocol = createProtocolRecorder(write)
  const record = (event, data = {}) => write({
    at: new Date().toISOString(), monotonicMs: Math.round(performance.now() * 1000) / 1000,
    event, launch, ...data,
  })
  const sample = () => {
    let all
    try { all = readProcesses() }
    catch { infrastructureFailed = true; record('process-scan-failed'); return [] }
    const current = ownedProcesses(all, roots, known)
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
    stage(stage) {
      assert.ok(STAGES.has(stage), 'Unknown diagnostic stage')
      record('stage', { stage })
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
        roots.push(root)
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
      protocol.end(label)
      if (!children.has(label) || children.get(label).pid !== app.process().pid) {
        infrastructureFailed = true
        record('returned-ownership-unproven', { owner: label })
      }
      record('launch-resolved', { owner: label })
      sample()
    },
    noise(kind) {
      assert.ok(['main-stderr', 'request-failed', 'page-error', 'console-error'].includes(kind))
      record('application-event', { kind })
    },
    failure(error) {
      failure = safeError(error)
      record('workload-failed', { errorKind: failure, pending: protocol.pending() })
      sample()
    },
    async cleanup(profiles, removeProfiles) {
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
          failureKind: failure, processOwnershipProven: roots.length === children.size && !infrastructureFailed,
          processExitProven: !survivors.length && !infrastructureFailed,
          processProofScope: 'Registered exclusive Linux sessions and observed descendants only. Unobserved children that create a new session are outside this proof.',
          cleanupFailed, survivors, pending: protocol.pending(),
        }
        try { writeFileSync(join(outputDirectory, 'launch-outcome.json'), JSON.stringify(result, null, 2) + '\n') }
        catch { infrastructureFailed = true }
        record('observer-stop', { secondResolved, cleanupFailed, survivingProcesses: survivors.length })
        return !cleanupFailed && !infrastructureFailed
      } finally { clearInterval(timer) }
    },
  }
}
