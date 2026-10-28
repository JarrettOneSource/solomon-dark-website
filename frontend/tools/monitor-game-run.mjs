import assert from 'node:assert/strict'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

import { enterBoneyard, enterElementHub } from './game-smoke-navigation.mjs'

const baseUrl = process.env.SDR_MONITOR_URL || 'https://solomondarker.com'
const output = resolve(process.env.SDR_MONITOR_OUTPUT || join(tmpdir(), 'sdr-game-monitor-' + Date.now()))
const targetWave = Number(process.env.SDR_MONITOR_WAVE || 50)
const maximumMs = Number(process.env.SDR_MONITOR_MAX_MS || 6 * 60 * 60 * 1000)
const sampleMs = Number(process.env.SDR_MONITOR_SAMPLE_MS || 5000)
const token = process.env.SDR_MONITOR_TOKEN_FILE
  ? (await readFile(process.env.SDR_MONITOR_TOKEN_FILE, 'utf8')).trim() : null
const runtime = process.env.SDR_MONITOR_RUNTIME_FILE
  ? JSON.parse(await readFile(process.env.SDR_MONITOR_RUNTIME_FILE, 'utf8')) : null
const requirePilot = process.env.SDR_MONITOR_PILOT !== '0'
await mkdir(output, { recursive: true })
await writeFile(join(output, 'client.jsonl'), '')
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: process.env.SDR_MONITOR_HEADLESS === '1',
  args: ['--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=19361'],
})
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
const page = await context.newPage()
const errors = []
let socketSamples = { bytes: 0, snapshots: 0, gaps: [], lastAt: null }
let completed = false
const rows = []
const startedAt = Date.now()
const cleanMessage = value => token ? String(value).replaceAll(token, '[redacted]') : String(value)
page.on('pageerror', error => errors.push({ kind: 'page', message: cleanMessage(error.message) }))
page.on('console', message => {
  if (message.type() === 'error') errors.push({ kind: 'console', message: cleanMessage(message.text()) })
})
page.on('response', response => {
  if (response.status() >= 400) {
    const url = new URL(response.url())
    errors.push({ kind: 'http', status: response.status(), path: url.origin + url.pathname })
  }
})
page.on('websocket', socket => {
  socket.on('framereceived', frame => {
    socketSamples.bytes += Buffer.byteLength(frame.payload)
    let message
    try { message = JSON.parse(String(frame.payload)) } catch { return }
    if (message.type !== 'server-snapshot') return
    const now = performance.now()
    if (socketSamples.lastAt !== null) socketSamples.gaps.push(now - socketSamples.lastAt)
    socketSamples.lastAt = now
    socketSamples.snapshots += 1
  })
  socket.on('socketerror', error => errors.push({ kind: 'socket', message: cleanMessage(error) }))
})
await page.addInitScript(({ token, runtime }) => {
  if (token) localStorage.setItem('sdr.token', token)
  if (runtime) window.solomonDarkRuntime = runtime
  localStorage.setItem('solomon-dark-game-settings-v1', JSON.stringify({
    enableActivityMessages: false, enableGlobalChat: false,
  }))
}, { token, runtime })

try {
  const browserCdp = await browser.newBrowserCDPSession()
  const system = await browserCdp.send('SystemInfo.getInfo')
  const hardware = { devices: system.gpu.devices, featureStatus: system.gpu.featureStatus }
  await writeFile(join(output, 'hardware.json'), JSON.stringify(hardware, null, 2))
  await browserCdp.detach()
  console.log(JSON.stringify({ event: 'browser.started', hardware: hardware.devices, baseUrl, output }))
  await page.bringToFront()
  await enterElementHub(page, baseUrl, process.env.SDR_MONITOR_ELEMENT || 'Fire')
  if (token) {
    await page.getByRole('button', { name: 'Party settings', exact: true }).click()
    const party = page.getByRole('dialog', { name: 'PARTY', exact: true })
    const privateChoice = party.getByRole('radio', { name: 'PRIVATE', exact: true })
    await privateChoice.click()
    await page.waitForFunction(() => document.querySelector(
      '[role="radio"][aria-label="PRIVATE"]',
    )?.getAttribute('aria-checked') === 'true')
    await party.getByRole('button', { name: 'Close', exact: true }).click()
  }
  await page.screenshot({ path: join(output, 'hub.png') })
  await enterBoneyard(page)
  if (requirePilot) {
    await page.getByRole('region', { name: 'Lua pilot control' }).waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: 'Toggle bot', exact: true }).waitFor()
  }
  await page.screenshot({ path: join(output, 'boneyard-entry.png') })
  console.log(JSON.stringify({ event: 'boneyard.entered', elapsedSeconds: (Date.now() - startedAt) / 1000 }))
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  let before = metrics(await cdp.send('Performance.getMetrics'))
  socketSamples = { bytes: 0, snapshots: 0, gaps: [], lastAt: null }
  let lastWave = -1
  let checkedToggle = !requirePilot
  while (Date.now() - startedAt < maximumMs) {
    const sampled = await page.evaluate(duration => new Promise(resolveSample => {
      const presentation = window.__sdrGamePresentation
      if (!presentation) throw new Error('game presentation diagnostics are unavailable')
      const gaps = []
      const longTasks = []
      let lastAt = null
      let frames = 0
      let hidden = false
      const unsubscribe = presentation.subscribe(now => {
        hidden ||= document.hidden
        if (lastAt !== null) gaps.push(now - lastAt)
        lastAt = now
        frames += 1
      })
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration)
      })
      observer.observe({ entryTypes: ['longtask'] })
      setTimeout(() => {
        unsubscribe()
        observer.disconnect()
        const scene = document.querySelector('.boneyard-scene')
        const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
        const diagnostics = frame ? Object.fromEntries([
          'tick', 'runId', 'frameCount', 'playerX', 'playerY', 'localPlayerHealth', 'localPlayerMana',
          'localPlayerLifeState', 'enemyCount', 'enemyProjectileCount', 'primarySpellCount',
          'secondaryAbilityCount', 'secondaryAbilityPrimitiveCount', 'weatherDropCount',
          'weatherSplashCount', 'visibleResidentCount', 'residentCount', 'complexShadowQuadCount',
        ].map(key => [key, frame[key]])) : null
        resolveSample({
          diagnostics, frames, gaps, hidden, longTasks,
          scene: scene ? {
            wave: Number(scene.dataset.waveOrdinal || 0),
            wavePhase: scene.dataset.wavePhase,
            solomonPhase: scene.dataset.solomonPhase,
            combatEnabled: scene.dataset.combatEnabled,
            presentationPaused: scene.dataset.presentationPaused,
          } : null,
          control: document.querySelector('.mod-minimap output')?.textContent ?? null,
          ui: [...document.querySelectorAll('[role="dialog"]')].map(node => node.getAttribute('aria-label')),
        })
      }, duration)
    }), sampleMs)
    const after = metrics(await cdp.send('Performance.getMetrics'))
    const durationSeconds = after.Timestamp - before.Timestamp
    const row = {
      atUtc: new Date().toISOString(), elapsedSeconds: (Date.now() - startedAt) / 1000,
      durationSeconds,
      fps: sampled.gaps.length * 1000 / sampled.gaps.reduce((total, gap) => total + gap, 0),
      frameP95Ms: percentile(sampled.gaps, 0.95), frameP99Ms: percentile(sampled.gaps, 0.99),
      maximumFrameMs: Math.max(0, ...sampled.gaps),
      slowFrames34: sampled.gaps.filter(gap => gap > 34).length,
      slowFrames100: sampled.gaps.filter(gap => gap > 100).length,
      longTaskCount: sampled.longTasks.length, maximumLongTaskMs: Math.max(0, ...sampled.longTasks),
      scriptCpuPercent: (after.ScriptDuration - before.ScriptDuration) / durationSeconds * 100,
      taskCpuPercent: (after.TaskDuration - before.TaskDuration) / durationSeconds * 100,
      heapMiB: after.JSHeapUsedSize / 1048576, nodes: after.Nodes, documents: after.Documents,
      snapshotHz: socketSamples.snapshots / durationSeconds,
      snapshotP99GapMs: percentile(socketSamples.gaps, 0.99),
      ingressKiBPerSecond: socketSamples.bytes / 1024 / durationSeconds,
      ...sampled.scene, ...sampled.diagnostics,
      serverTickHz: rows.length === 0 || !sampled.diagnostics ? null
        : (sampled.diagnostics.tick - rows.at(-1).tick) / durationSeconds,
      control: sampled.control, hidden: sampled.hidden, ui: sampled.ui, errors: errors.length,
    }
    rows.push(row)
    await appendFile(join(output, 'client.jsonl'), JSON.stringify(row) + '\n')
    console.log(JSON.stringify(row))
    before = after
    socketSamples = { bytes: 0, snapshots: 0, gaps: [], lastAt: socketSamples.lastAt }
    assert.ok(sampled.diagnostics, 'Boneyard renderer disappeared')
    assert.equal(sampled.hidden, false, 'measured browser must remain visible')
    assert.equal(sampled.diagnostics.localPlayerLifeState, 'alive', 'monitoring pilot died')
    if (row.wave !== lastWave) {
      if (row.wave % 5 === 0 || row.wave >= targetWave) {
        await page.screenshot({ path: join(output, 'wave-' + row.wave + '.png') })
      }
      lastWave = row.wave
    }
    if (!checkedToggle && row.combatEnabled === 'true' && row.wave >= 1) {
      await verifyHumanTakeover(page)
      checkedToggle = true
      before = metrics(await cdp.send('Performance.getMetrics'))
      socketSamples = { bytes: 0, snapshots: 0, gaps: [], lastAt: null }
    }
    if (row.wave > targetWave) { completed = true; break }
  }
  assert.equal(completed, true, 'run did not complete wave ' + targetWave)
  assert.deepEqual(errors, [], 'browser reported errors')
  await page.screenshot({ path: join(output, 'completed.png') })
} catch (error) {
  errors.push({ kind: 'monitor', message: cleanMessage(error.stack || error) })
  await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {})
  throw error
} finally {
  await writeFile(join(output, 'result.json'), JSON.stringify({
    completed, targetWave, startedAtUtc: new Date(startedAt).toISOString(),
    finishedAtUtc: new Date().toISOString(), errors, samples: rows.length,
  }, null, 2))
  await browser.close()
}

async function verifyHumanTakeover(page) {
  const toggle = page.getByRole('button', { name: 'Toggle bot', exact: true })
  await toggle.click()
  await page.locator('.mod-minimap output').filter({ hasText: 'Human' }).waitFor()
  const position = () => page.locator('.boneyard-world-canvas').evaluate(canvas => ({
    x: canvas.__sdrBoneyardFrame.playerX, y: canvas.__sdrBoneyardFrame.playerY,
  }))
  await page.waitForTimeout(500)
  const before = await position()
  await page.keyboard.down('d')
  await page.waitForTimeout(600)
  await page.keyboard.up('d')
  const after = await position()
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 5, 'human keyboard did not move the pilot')
  await toggle.click()
  await page.locator('.mod-minimap output').filter({ hasText: 'Lua' }).waitFor()
  console.log(JSON.stringify({ event: 'human.takeover.verified', before, after }))
}

function metrics(value) { return Object.fromEntries(value.metrics.map(metric => [metric.name, metric.value])) }

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0
}
