import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const cdpUrl = process.env.SDR_GAME_CDP_URL?.trim()
const requireHardwareGpu = process.env.SDR_GAME_REQUIRE_HARDWARE_GPU === '1'
const NORMAL_HUB_COMPRESSED_BUDGET_KIB_PER_SECOND = 64
const MINIMUM_NORMAL_HUB_COMPRESSION_REDUCTION_PERCENT = 60
const sampleMs = requiredInteger(
  process.env.SDR_GAME_NETWORK_SAMPLE_MS || '5000',
  'SDR_GAME_NETWORK_SAMPLE_MS',
  1000,
  60_000,
)
const expectedStudentCount = optionalInteger(
  process.env.SDR_HUB_BENCH_STUDENTS,
  'SDR_HUB_BENCH_STUDENTS',
  0,
  256,
)
const browser = cdpUrl
  ? await chromium.connectOverCDP(cdpUrl)
  : await chromium.launch({
      executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
      headless: true,
    })
const pages = []
const sessions = []
const lanes = []
const errors = []

try {
  const context = cdpUrl
    ? browser.contexts()[0]
    : await browser.newContext({ viewport: { width: 1600, height: 900 } })
  if (!context) throw new Error('CDP browser has no default context')
  for (let index = 0; index < 2; index += 1) {
    const page = await context.newPage()
    await page.setViewportSize({ width: 1600, height: 900 })
    page.on('pageerror', (error) => errors.push(`client-${index + 1}: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`client-${index + 1}: ${message.text()}`)
    })
    const session = await page.context().newCDPSession(page)
    await session.send('Network.enable')
    const lane = createLane()
    session.on('Network.webSocketFrameReceived', ({ response }) => {
      recordFrame(lane, response.payloadData, false)
    })
    session.on('Network.webSocketFrameSent', ({ response }) => {
      recordFrame(lane, response.payloadData, true)
    })
    session.on('Network.webSocketHandshakeResponseReceived', ({ response }) => {
      for (const [name, value] of Object.entries(response.headers)) {
        if (name.toLowerCase() !== 'sec-websocket-extensions') continue
        lane.negotiatedExtensions.add(String(value))
      }
    })
    pages.push(page)
    sessions.push(session)
    lanes.push(lane)
  }

  await Promise.all([
    enterHub(pages[0], 'Fire'),
    enterHub(pages[1], 'Earth'),
  ])
  const canvases = pages.map((page) => page.locator('.hub-world-canvas'))
  await Promise.all(canvases.map((canvas) => canvas.waitFor({ timeout: 30_000 })))

  await pages[0].waitForTimeout(1_000)
  for (const lane of lanes) resetLane(lane)
  const startedAt = performance.now()
  await pages[0].waitForTimeout(sampleMs)
  const elapsedSeconds = (performance.now() - startedAt) / 1000

  const runtimes = await Promise.all(canvases.map((canvas) => canvas.evaluate((node) => {
    const context = node.getContext('webgl2') || node.getContext('webgl')
    const extension = context?.getExtension('WEBGL_debug_renderer_info')
    return {
      astronomerRenderable: node.__sdrHubFrame.astronomerRenderable,
      cameraRenderGroupCount: node.__sdrHubFrame.cameraRenderGroupCount,
      gpu: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      southernArchitectureCount: node.__sdrHubFrame.southernArchitectureCount,
      southernArtRenderable: node.__sdrHubFrame.southernArtRenderable,
      southernChildCount: node.__sdrHubFrame.southernChildCount,
      staticCulling: node.dataset.staticCulling,
      studentCount: node.__sdrHubFrame.studentCount,
      studentCulling: node.dataset.studentCulling,
    }
  })))
  const clients = lanes.map((lane, index) => laneReport(lane, index, elapsedSeconds))
  for (const [index, client] of clients.entries()) {
    assert.ok(
      client.snapshotHertz > 18 && client.snapshotHertz < 22,
      `client ${index + 1} missed the 20 Hz snapshot contract: ${JSON.stringify(client)}`,
    )
    assert.equal(client.sequenceGaps, 0)
    assert.deepEqual(client.playerCounts, [2])
    assert.ok(
      client.negotiatedExtensions.some((value) => value.includes('permessage-deflate')),
      `client ${index + 1} did not negotiate snapshot compression`,
    )
    assert.ok(client.acknowledgementHertz > 18 && client.acknowledgementHertz < 22)
    assert.ok(
      client.estimatedCompressionReductionPercent
        >= MINIMUM_NORMAL_HUB_COMPRESSION_REDUCTION_PERCENT,
      `client ${index + 1} missed the snapshot compression floor: ${JSON.stringify(client)}`,
    )
    if (expectedStudentCount === undefined) {
      assert.ok(
        client.estimatedCompressedSnapshotKiBPerSecond
          <= NORMAL_HUB_COMPRESSED_BUDGET_KIB_PER_SECOND,
        `client ${index + 1} exceeded the normal Hub wire budget: ${JSON.stringify(client)}`,
      )
    }
    if (expectedStudentCount !== undefined) {
      assert.equal(client.studentSampleMinimum, expectedStudentCount)
      assert.equal(client.studentSampleMaximum, expectedStudentCount)
    }
  }
  const sharedSequences = commonSequenceCount(lanes[0], lanes[1])
  assert.ok(
    sharedSequences >= Math.min(clients[0].snapshotFrames, clients[1].snapshotFrames) - 1,
    `clients did not receive the same broadcast sequence lane: ${JSON.stringify(clients)}`,
  )
  assertSharedTicks(lanes[0], lanes[1])
  for (const [index, runtime] of runtimes.entries()) {
    if (requireHardwareGpu) assert.doesNotMatch(runtime.gpu, /SwiftShader|llvmpipe/i)
    assert.equal(runtime.staticCulling, 'none')
    assert.equal(runtime.studentCulling, 'instrumentation-only')
    assert.equal(runtime.astronomerRenderable, true)
    assert.equal(runtime.southernArtRenderable, true)
    assert.equal(runtime.cameraRenderGroupCount, 3)
    assert.ok(runtime.southernArchitectureCount > 0)
    assert.equal(
      runtime.southernChildCount,
      runtime.southernArchitectureCount + 3,
      `client ${index + 1} lost southern render children`,
    )
    if (expectedStudentCount !== undefined) {
      assert.equal(runtime.studentCount, expectedStudentCount)
    }
  }
  assert.deepEqual(errors, [])

  const aggregateIngressKiBPerSecond = clients.reduce(
    (total, client) => total + client.ingressKiBPerSecond,
    0,
  )
  const aggregateEgressKiBPerSecond = clients.reduce(
    (total, client) => total + client.egressKiBPerSecond,
    0,
  )
  process.stdout.write(`${JSON.stringify({
    aggregateEgressKiBPerSecond,
    aggregateIngressKiBPerSecond,
    aggregateKiBPerSecond: aggregateIngressKiBPerSecond + aggregateEgressKiBPerSecond,
    clients,
    elapsedSeconds,
    errors,
    expectedStudentCount: expectedStudentCount ?? null,
    runtimes,
    sharedSequences,
    status: 'ok',
  })}\n`)
} finally {
  await Promise.allSettled(sessions.map((session) => session.detach()))
  await Promise.all(pages.map((page) => page.close()))
  await browser.close()
}

async function enterHub(page, element) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
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

function createLane() {
  return {
    acknowledgementBytes: 0,
    acknowledgementFrames: 0,
    componentBytes: new Map(),
    deltaSnapshotBytes: 0,
    deltaSnapshotFrames: 0,
    estimatedCompressedSnapshotBytes: 0,
    keyframes: 0,
    keyframeSnapshotBytes: 0,
    negotiatedExtensions: new Set(),
    receivedBytes: 0,
    receivedMessages: 0,
    receivedTypes: new Map(),
    sentBytes: 0,
    sentMessages: 0,
    sentTypes: new Map(),
    sequenceTicks: new Map(),
    sequences: [],
    snapshotBytes: 0,
    snapshotFrames: 0,
    studentSamples: [],
    playerCounts: new Set(),
  }
}

function resetLane(lane) {
  lane.acknowledgementBytes = 0
  lane.acknowledgementFrames = 0
  lane.componentBytes.clear()
  lane.deltaSnapshotBytes = 0
  lane.deltaSnapshotFrames = 0
  lane.estimatedCompressedSnapshotBytes = 0
  lane.keyframes = 0
  lane.keyframeSnapshotBytes = 0
  lane.receivedBytes = 0
  lane.receivedMessages = 0
  lane.receivedTypes.clear()
  lane.sentBytes = 0
  lane.sentMessages = 0
  lane.sentTypes.clear()
  lane.sequenceTicks.clear()
  lane.sequences.length = 0
  lane.snapshotBytes = 0
  lane.snapshotFrames = 0
  lane.studentSamples.length = 0
  lane.playerCounts.clear()
}

function recordFrame(lane, payloadData, sent) {
  if (typeof payloadData !== 'string') return
  const bytes = Buffer.byteLength(payloadData)
  let payload
  try {
    payload = JSON.parse(payloadData)
  } catch {
    payload = null
  }
  const type = typeof payload?.type === 'string' ? payload.type : 'non-json'
  if (sent) {
    lane.sentBytes += bytes
    lane.sentMessages += 1
    increment(lane.sentTypes, type)
    if (type === 'client-snapshot-ack') {
      lane.acknowledgementBytes += bytes
      lane.acknowledgementFrames += 1
    }
    return
  }
  lane.receivedBytes += bytes
  lane.receivedMessages += 1
  increment(lane.receivedTypes, type)
  if (type !== 'server-snapshot') return
  lane.snapshotBytes += bytes
  lane.snapshotFrames += 1
  lane.estimatedCompressedSnapshotBytes += deflateRawSync(payloadData, {
    level: 3,
    memLevel: 7,
  }).byteLength
  for (const [key, value] of Object.entries(payload.frame)) {
    increment(lane.componentBytes, key, Buffer.byteLength(JSON.stringify(value)))
  }
  lane.sequences.push(payload.sequence)
  lane.sequenceTicks.set(payload.sequence, payload.frame.tick)
  lane.playerCounts.add(Object.keys(payload.frame.players).length)
  if (payload.frame.world.kind === 'hub') {
    lane.studentSamples.push(payload.frame.world.entities.samples.length)
    if (payload.frame.world.entities.keyframe) {
      lane.keyframes += 1
      lane.keyframeSnapshotBytes += bytes
    } else {
      lane.deltaSnapshotBytes += bytes
      lane.deltaSnapshotFrames += 1
    }
  }
}

function laneReport(lane, index, elapsedSeconds) {
  return {
    acknowledgementBytes: lane.acknowledgementBytes,
    acknowledgementFrames: lane.acknowledgementFrames,
    acknowledgementHertz: lane.acknowledgementFrames / elapsedSeconds,
    client: index + 1,
    componentKiBPerSecond: Object.fromEntries([...lane.componentBytes].map(
      ([key, bytes]) => [key, bytes / 1024 / elapsedSeconds],
    )),
    averageDeltaSnapshotBytes: lane.deltaSnapshotFrames > 0
      ? lane.deltaSnapshotBytes / lane.deltaSnapshotFrames
      : 0,
    averageKeyframeSnapshotBytes: lane.keyframes > 0
      ? lane.keyframeSnapshotBytes / lane.keyframes
      : 0,
    egressKiBPerSecond: lane.sentBytes / 1024 / elapsedSeconds,
    estimatedCompressedSnapshotKiBPerSecond:
      lane.estimatedCompressedSnapshotBytes / 1024 / elapsedSeconds,
    estimatedCompressionReductionPercent: lane.snapshotBytes > 0
      ? (1 - lane.estimatedCompressedSnapshotBytes / lane.snapshotBytes) * 100
      : 0,
    ingressKiBPerSecond: lane.receivedBytes / 1024 / elapsedSeconds,
    keyframes: lane.keyframes,
    negotiatedExtensions: [...lane.negotiatedExtensions].sort(),
    playerCounts: [...lane.playerCounts].sort((first, second) => first - second),
    receivedMessages: lane.receivedMessages,
    receivedTypes: Object.fromEntries(lane.receivedTypes),
    sentMessages: lane.sentMessages,
    sentTypes: Object.fromEntries(lane.sentTypes),
    sequenceFirst: lane.sequences[0] ?? null,
    sequenceGaps: sequenceGapCount(lane.sequences),
    sequenceLast: lane.sequences.at(-1) ?? null,
    snapshotBytes: lane.snapshotBytes,
    snapshotFrames: lane.snapshotFrames,
    snapshotHertz: lane.snapshotFrames / elapsedSeconds,
    snapshotKiBPerSecond: lane.snapshotBytes / 1024 / elapsedSeconds,
    studentSampleMaximum: lane.studentSamples.length
      ? Math.max(...lane.studentSamples)
      : null,
    studentSampleMinimum: lane.studentSamples.length
      ? Math.min(...lane.studentSamples)
      : null,
  }
}

function sequenceGapCount(sequences) {
  let gaps = 0
  for (let index = 1; index < sequences.length; index += 1) {
    if (sequences[index] !== sequences[index - 1] + 1) gaps += 1
  }
  return gaps
}

function commonSequenceCount(first, second) {
  const secondSequences = new Set(second.sequences)
  return first.sequences.filter((sequence) => secondSequences.has(sequence)).length
}

function assertSharedTicks(first, second) {
  for (const [sequence, tick] of first.sequenceTicks) {
    const peerTick = second.sequenceTicks.get(sequence)
    if (peerTick !== undefined) assert.equal(peerTick, tick)
  }
}

function increment(counts, key, amount = 1) {
  counts.set(key, (counts.get(key) ?? 0) + amount)
}

function optionalInteger(value, name, minimum, maximum) {
  if (!value) return undefined
  return requiredInteger(value, name, minimum, maximum)
}

function requiredInteger(value, name, minimum, maximum) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`)
  }
  return parsed
}
