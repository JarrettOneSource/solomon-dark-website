import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_FLOW_SMOKE_URL || 'http://127.0.0.1:4189'
const blockMs = Number(process.env.SDR_GAME_FLOW_BLOCK_MS || '1200')
const highWaterMark = 8
if (!Number.isInteger(blockMs) || blockMs < 500 || blockMs > 5_000) {
  throw new Error('SDR_GAME_FLOW_BLOCK_MS must be an integer between 500 and 5000')
}

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const contexts = []
const sessions = []
const errors = []

try {
  const slow = await createInstrumentedPage('slow')
  const healthy = await createInstrumentedPage('healthy')
  await Promise.all([
    enterHub(slow.page, 'Fire'),
    enterHub(healthy.page, 'Earth'),
  ])
  await Promise.all([
    waitForSnapshotCount(slow.lane, 3),
    waitForSnapshotCount(healthy.lane, 3),
  ])

  let blockedReceipt = null
  let blockStart = null
  await slow.page.exposeFunction('__sdrFlowBlockStarted', () => {
    blockStart = {
      healthyAcknowledgements: healthy.lane.acknowledgements,
      healthySequenceCount: healthy.lane.sequences.length,
      slowAcknowledgements: slow.lane.acknowledgements,
      slowSequenceCount: slow.lane.sequences.length,
    }
  })
  await slow.page.exposeFunction('__sdrFlowBlockEnding', () => {
    assert.ok(blockStart)
    blockedReceipt = {
      healthyAcknowledgements:
        healthy.lane.acknowledgements - blockStart.healthyAcknowledgements,
      healthySequences: healthy.lane.sequences.slice(blockStart.healthySequenceCount),
      slowAcknowledgements: slow.lane.acknowledgements - blockStart.slowAcknowledgements,
      slowSequences: slow.lane.sequences.slice(blockStart.slowSequenceCount),
    }
  })

  const blocked = await slow.page.evaluate(async (durationMs) => {
    await window.__sdrFlowBlockStarted()
    const startedAt = performance.now()
    const notifyAt = startedAt + durationMs - 150
    while (performance.now() < notifyAt) {
      // Deliberately hold the renderer task so WebSocket snapshots cannot be
      // materialized or acknowledged by this browser client.
    }
    void window.__sdrFlowBlockEnding()
    while (performance.now() - startedAt < durationMs) {
      // Keep the task closed until the Node-side receipt captures the window.
    }
    return performance.now() - startedAt
  }, blockMs)
  await waitFor(() => blockedReceipt !== null, 2_000, 'blocked-window receipt')

  const slowBlockedSequences = blockedReceipt.slowSequences
  const healthyBlockedSequences = blockedReceipt.healthySequences
  assert.ok(
    slowBlockedSequences.length <= highWaterMark,
    `slow browser exceeded the ${highWaterMark}-snapshot cap: ${JSON.stringify(blockedReceipt)}`,
  )
  assert.ok(
    blockedReceipt.slowAcknowledgements <= 1,
    `slow browser acknowledged beyond the block boundary: ${JSON.stringify(blockedReceipt)}`,
  )
  assert.ok(
    healthyBlockedSequences.length >= Math.floor(blockMs / 75),
    `healthy browser stopped receiving near 20 Hz: ${JSON.stringify(blockedReceipt)}`,
  )
  assert.equal(sequenceGapCount(healthyBlockedSequences), 0, JSON.stringify(blockedReceipt))

  const slowAcknowledgementsAtUnblock = slow.lane.acknowledgements
  await waitFor(
    () => {
      const sequences = slow.lane.sequences.slice(
        Math.max(0, blockStart.slowSequenceCount - 1),
      )
      const gap = firstSequenceGapIndex(sequences)
      return gap >= 0 && sequences.length >= gap + 3
    },
    5_000,
    'slow-browser sequence-gap recovery',
  )
  const slowRecoveryWindow = slow.lane.sequences.slice(
    Math.max(0, blockStart.slowSequenceCount - 1),
  )
  const gapIndex = firstSequenceGapIndex(slowRecoveryWindow)
  const lastBlockedSequence = slowRecoveryWindow[gapIndex - 1]
  const firstRecoveredSequence = slowRecoveryWindow[gapIndex]
  const recoveredSequences = slowRecoveryWindow.slice(gapIndex, gapIndex + 4)
  assert.equal(typeof lastBlockedSequence, 'number')
  assert.equal(typeof firstRecoveredSequence, 'number')
  assert.ok(
    firstRecoveredSequence > lastBlockedSequence + 1,
    `slow browser did not resume across a bounded sequence gap: ${JSON.stringify({
      firstRecoveredSequence,
      lastBlockedSequence,
      recoveredSequences,
    })}`,
  )
  assert.ok(slow.lane.acknowledgements > slowAcknowledgementsAtUnblock)
  assert.deepEqual(errors, [])

  process.stdout.write(`${JSON.stringify({
    blockedMs: blocked,
    healthySnapshotCount: healthyBlockedSequences.length,
    highWaterMark,
    recoveredSequences,
    slowAcknowledgementsAfterUnblock: slow.lane.acknowledgements,
    slowBlockedSnapshotCount: slowBlockedSequences.length,
    slowSequenceGap: firstRecoveredSequence - lastBlockedSequence,
    status: 'ok',
  })}\n`)
} finally {
  await Promise.allSettled(sessions.map(session => session.detach()))
  await Promise.allSettled(contexts.map(context => context.close()))
  await browser.close()
}

async function createInstrumentedPage(label) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  contexts.push(context)
  const page = await context.newPage()
  await page.route('**/deployment.json*', route => {
    const revision = new URL(route.request().url()).searchParams.get('current') || 'local'
    return route.fulfill({
      body: JSON.stringify({ revision }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    })
  })
  page.on('pageerror', error => errors.push({
    label,
    text: error.message,
    url: page.url(),
  }))
  page.on('console', message => {
    if (message.type() === 'error') errors.push({
      label,
      text: message.text(),
      url: message.location().url,
    })
  })
  const session = await context.newCDPSession(page)
  sessions.push(session)
  await session.send('Network.enable')
  const lane = { acknowledgements: 0, sequences: [] }
  session.on('Network.webSocketFrameReceived', ({ response }) => {
    const message = parseMessage(response.payloadData)
    if (message?.type === 'server-snapshot') lane.sequences.push(message.sequence)
  })
  session.on('Network.webSocketFrameSent', ({ response }) => {
    const message = parseMessage(response.payloadData)
    if (message?.type === 'client-snapshot-ack') {
      lane.acknowledgements += 1
    }
  })
  return { lane, page }
}

async function enterHub(page, element) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const tutorial = page.locator('[data-prompt-kind="tutorial"] .stock-prompt-dialog')
  if (await tutorial.isVisible()) {
    await tutorial.getByRole('button', { exact: true, name: 'NO' }).click()
    await tutorial.waitFor({ state: 'detached' })
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.getByLabel(/College courtyard/).waitFor({ timeout: 30_000 })
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
}

function parseMessage(payload) {
  if (typeof payload !== 'string') return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function sequenceGapCount(sequences) {
  let gaps = 0
  for (let index = 1; index < sequences.length; index += 1) {
    if (sequences[index] !== sequences[index - 1] + 1) gaps += 1
  }
  return gaps
}

function firstSequenceGapIndex(sequences) {
  return sequences.findIndex((sequence, index) => (
    index > 0 && sequence > sequences[index - 1] + 1
  ))
}

async function waitForSnapshotCount(lane, count) {
  await waitFor(() => lane.sequences.length >= count, 30_000, `${count} snapshots`)
}

async function waitFor(predicate, timeoutMs, label) {
  const deadline = performance.now() + timeoutMs
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error(`timed out waiting for ${label}`)
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}
