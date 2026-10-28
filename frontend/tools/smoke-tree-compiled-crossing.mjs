import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Headed compiled integration only. Host state is read, never rewritten. All
// claimed movement is ordinary Playwright keyboard input into the real client.
const source = process.env.SDR_TREE_CROSSING_SOURCE
  ? resolve(process.env.SDR_TREE_CROSSING_SOURCE)
  : fileURLToPath(new URL('../../', import.meta.url))
const output = process.env.SDR_TREE_CROSSING_OUTPUT
  ? resolve(process.env.SDR_TREE_CROSSING_OUTPUT)
  : resolve(source, 'frontend/reports/tree-compiled-crossing',
    new Date().toISOString().replaceAll(':', '-') + '-' + randomBytes(4).toString('hex'))
const imported = relative => import(pathToFileURL(resolve(source, 'frontend', relative)).href)
const { chromium } = await imported('node_modules/playwright-core/index.mjs')
const { startStaticClientServer } = await imported('desktop/static-client-server.mjs')
const { startGameHost } = await imported('src/game/host/game-host.ts')
const { getPlayerCharacter } = await imported('src/game/core-server/game-simulation.ts')
const { createGameSnapshot } = await imported('src/game/host/game-snapshot.ts')
const { nativeTreeActorPositionsFromSnapshot } = await imported('src/game/renderer/boneyard-tree-actors.ts')
const { nativeTreeContainsLocalPlayer, nativeTreeOverlapsCamera,
  NATIVE_TREE_OCCLUSION_POLYGONS, NATIVE_TREE_OCCLUSION_BOUNDS } =
  await imported('src/game/renderer/boneyard-tree-occlusion.ts')
const { GAME_PROTOCOL_VERSION } = await imported('src/game/protocol/game-protocol-contract.ts')
const { enterElementHub, enterBoneyard } = await imported('tools/game-smoke-navigation.mjs')
await mkdir(output, { recursive: true })
const errors = { page: [], console: [], responses: [], requests: [], host: [] }
const report = {
  status: 'running', source, seedHex: '00000002000000000000000000000000',
  protocol: GAME_PROTOCOL_VERSION, errors, stages: [], movement: [],
  scope: 'Headed installed M2 Chrome, compiled normal UI and held keyboard movement; no runtime source override, teleport, state setter, or debugger pause.',
  limits: ['Per-Tree material is identified by unique overlap and existing aggregate ownership invariants; this run does not directly inspect vertex buffers.',
    'Camera and lighting phase are recorded at each endpoint. Screenshots are settled scene observations, not matched native final-pixel parity.',
    'No throughput claim is made by this behavior acceptance.'],
}
const save = () => writeFile(resolve(output, 'result.json'), JSON.stringify(report, null, 2) + '\n')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function sourceManifest() {
  const paths = execFileSync('git', ['-C', source, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' }).split('\0').filter(Boolean).sort()
  const files = []
  for (const path of paths) files.push({ path, sha256: sha(await readFile(resolve(source, path))) })
  return { files, sha256: sha(JSON.stringify(files)) }
}
async function until(predicate, label, timeout = 10000) {
  const start = Date.now()
  while (!predicate()) {
    assert.ok(Date.now() - start < timeout, label)
    await sleep(10)
  }
}
let browser, page, host, server, canvas, playerId, trees
const wire = { protocolVersions: [], inputEvents: [] }
const pressed = new Set()
const hostPose = () => ({ tick: host.state().tick,
  position: { ...getPlayerCharacter(host.state(), playerId).position },
  velocity: { ...getPlayerCharacter(host.state(), playerId).velocity } })
const overlaps = position => trees.filter(tree => nativeTreeContainsLocalPlayer(tree, position)).map(tree => tree.eid)
async function frame() {
  return canvas.evaluate(c => ({ frame: structuredClone(c.__sdrBoneyardFrame), settings: { ...c.dataset },
    visible: document.visibilityState, focused: document.hasFocus(),
    viewport: { cssWidth: c.getBoundingClientRect().width, cssHeight: c.getBoundingClientRect().height,
      backingWidth: c.width, backingHeight: c.height, dpr: devicePixelRatio } }))
}
async function moveToY(key, targetY, phase) {
  const start = hostPose(), samples = []
  const direction = key === 's' ? 1 : -1
  const sample = () => { const pose = hostPose(); samples.push({ ...pose, overlaps: overlaps(pose.position) }) }
  sample()
  const timer = setInterval(sample, 20)
  try {
    pressed.add(key)
    await page.keyboard.down(key)
    await until(() => (hostPose().position.y - targetY) * direction >= 0,
      `${phase}: normal movement did not reach y${targetY}`, 6000)
  } finally {
    await page.keyboard.up(key)
    pressed.delete(key)
    clearInterval(timer)
    sample()
  }
  const end = hostPose()
  report.movement.push({ phase, key, requestedTargetY: targetY, start, end, samples })
  assert.ok(Math.abs(end.position.x - start.position.x) < 0.1, `${phase}: unexpected collision lateral shift`)
  assert.ok((end.position.y - start.position.y) * direction > 30, `${phase}: movement not established`)
  await save()
}
async function endpoint(name, expectedInside) {
  // After key release first settle velocity, then require >=66 raw host ticks
  // and corresponding compiled renderer advancement: 25 scan plus41 approach.
  await until(() => Math.hypot(hostPose().velocity.x, hostPose().velocity.y) < 0.001,
    `${name}: player did not stop`)
  const start = hostPose()
  await until(() => host.state().tick >= start.tick + 80, `${name}: raw clock stalled`)
  await page.waitForFunction(tick => document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.tick >= tick,
    start.tick + 66, { timeout: 15000 })
  const before = await frame()
  const position = hostPose()
  const snapshot = createGameSnapshot(host.state(), host.hostPlayerId())
  const actors = nativeTreeActorPositionsFromSnapshot(snapshot, playerId)
  const bounds = { x: before.frame.cameraX - 1600 / (2 * before.frame.cameraZoom),
    y: before.frame.cameraY - 900 / (2 * before.frame.cameraZoom),
    w: 1600 / before.frame.cameraZoom, h: 900 / before.frame.cameraZoom }
  const allActorOverlaps = trees.filter(tree => actors.some(actor => nativeTreeContainsLocalPlayer(tree, actor)))
    .map(tree => ({ eid: tree.eid, cameraOverlap: nativeTreeOverlapsCamera(tree, bounds) }))
  const cameraActorOverlaps = allActorOverlaps.filter(tree => tree.cameraOverlap).map(tree => tree.eid)
  const expected = expectedInside ? ['object-10'] : []
  assert.deepEqual(overlaps(position.position), expected, `${name}: actual player canopy membership`)
  assert.deepEqual(overlaps({ x: before.frame.playerX, y: before.frame.playerY }), expected,
    `${name}: displayed player canopy membership`)
  assert.deepEqual(cameraActorOverlaps, expected, `${name}: another eligible actor confounds target`)
  assert.equal(before.frame.fadedTreeCount, expectedInside ? 1 : 0, `${name}: faded Tree count`)
  assert.equal(before.frame.minTreeAlpha, expectedInside ? Math.fround(.4) : 1, `${name}: settled alpha`)
  assert.equal(before.frame.treeAlphaMismatchCount, 0, `${name}: main identity/proxy/material alpha ownership`)
  assert.equal(before.frame.treeTintMismatchCount, 0, `${name}: main identity/proxy tint ownership`)
  assert.equal(before.visible, 'visible'); assert.equal(before.focused, true)
  const screenshot = resolve(output, name + '.png')
  await page.screenshot({ path: screenshot, timeout: 30000 })
  const after = await frame()
  assert.equal(after.frame.fadedTreeCount, before.frame.fadedTreeCount)
  assert.equal(after.frame.minTreeAlpha, before.frame.minTreeAlpha)
  const stage = { name, stopTick: start.tick, rawSettledTicks: position.tick - start.tick,
    pose: position, displayedPosition: { x: before.frame.playerX, y: before.frame.playerY },
    playerOverlaps: overlaps(position.position), actorPositions: actors, allActorOverlaps, cameraActorOverlaps,
    cameraBounds: bounds, before, after, screenshot,
    materialEvidence: { identifiedTarget: 'object-10', mainGlobalAlpha: 1,
      ownerAndProxyAlpha: before.frame.minTreeAlpha, alphaOwnershipMismatchCount: before.frame.treeAlphaMismatchCount,
      tintOwnershipMismatchCount: before.frame.treeTintMismatchCount,
      source: 'Existing boneyard-static-lighting diagnostic compares every main alpha, proxy alpha, and material.alpha; target identified by sole eligible overlap.',
      gradientBranchExpected: expectedInside, packedVertexAlphaExpected: expectedInside ? [51, 51, 255, 255] : [255, 255, 255, 255],
      vertexEvidence: 'Expected contract only; direct GPU material qualification is separate.' } }
  report.stages.push(stage)
  await save()
}
try {
  const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim()
  report.base = git('rev-parse', 'HEAD')
  report.gitStatusBefore = git('status', '--short')
  const manifestBefore = await sourceManifest()
  await writeFile(resolve(output, 'source-before.json'), JSON.stringify(manifestBefore, null, 2) + '\n')
  report.sourceManifest = { files: manifestBefore.files.length, sha256: manifestBefore.sha256 }
  report.criticalSources = await Promise.all([
    'frontend/src/game/renderer/boneyard-static-lighting.ts',
    'frontend/src/game/renderer/boneyard-tree-occlusion.ts',
    'frontend/src/game/renderer/boneyard-tree-actors.ts',
    'frontend/src/game/renderer/boneyard-world-renderer.ts',
    'frontend/src/game/renderer/native-scenery-glyph-material.ts',
    'frontend/src/game/protocol/game-protocol-contract.ts',
  ].map(async path => ({ path, sha256: sha(await readFile(resolve(source, path))) })))
  server = await startStaticClientServer({ root: resolve(source, 'backend/wwwroot') })
  const credential = randomBytes(32).toString('base64url')
  host = await startGameHost({ allowedOrigins: [server.origin], authentication: { kind: 'shared', credential },
    resetWhenEmpty: true, snapshotRate: 20, createBoneyardSeedBytes: () => Buffer.from(report.seedHex, 'hex'),
    log: entry => { if (entry.level === 'error') errors.host.push(entry) } })
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false, args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'] })
  report.browser = browser.version()
  // The browser launch can omit enable-automation. Bind the actual child
  // process to this runner without requiring CDP Browser.getBrowserCommandLine.
  const browserProcesses = execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' })
    .split('\n').map(line => line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean)
    .filter(row => Number(row[2]) === process.pid && row[3].startsWith('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome '))
  assert.equal(browserProcesses.length, 1)
  report.browserCommand = { pid: Number(browserProcesses[0][1]), parentPid: process.pid, command: browserProcesses[0][3] }
  assert.ok(!report.browserCommand.command.includes('--headless'))
  report.isolatedProfile = report.browserCommand.command.match(/--user-data-dir=([^ ]+)/)?.[1]
  assert.ok(report.isolatedProfile?.includes('playwright_chromiumdev_profile'))
  page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push({ status: response.status(), url: response.url() }) })
  page.on('requestfailed', request => errors.requests.push({ url: request.url(), error: request.failure()?.errorText }))
  const requests = new Set()
  page.on('request', request => { const path = new URL(request.url()).pathname; if (/\.(?:js|ts)$/.test(path)) requests.add(path) })
  page.on('websocket', socket => socket.on('framesent', ({ payload }) => {
    let message
    try { message = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8')) } catch { return }
    // Retain only protocol version and ordinary input; never hello credentials,
    // player profiles, resume tokens, or save contents.
    if (message.type === 'client-hello') wire.protocolVersions.push(message.protocolVersion)
    if (playerId && message.type === 'client-input') wire.inputEvents.push({
      sequence: message.sequence, targetTick: message.targetTick, input: message.input,
      observedHostTick: host.state().tick,
    })
  }))
  await page.addInitScript(runtime => {
    window.solomonDarkRuntime = runtime
    window.__treeCrossingInputEvents = []
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, event => {
      if (!['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) return
      window.__treeCrossingInputEvents.push({ type, key: event.key, code: event.code,
        isTrusted: event.isTrusted, repeat: event.repeat, at: performance.now(),
        frameTick: document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.tick ?? null })
    }, true)
  }, { gameEndpoint: { kind: 'localhost', credential, url: host.address.url } })
  await page.route('**/deployment.json?*', route => route.fulfill({ json: { revision: new URL(route.request().url()).searchParams.get('current') } }))
  await enterElementHub(page, server.origin, 'Fire')
  await enterBoneyard(page)
  await page.locator('.match-loading-screen').waitFor({ state: 'detached', timeout: 90000 })
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 30000 })
  await page.bringToFront()
  canvas = page.locator('.boneyard-world-canvas')
  await canvas.waitFor()
  const initial = await frame()
  playerId = initial.frame.cameraSubjectPlayerId
  assert.ok(playerId)
  const loaded = host.loadedBoneyard()
  report.loadedScene = loaded
  report.sceneSha256 = sha(JSON.stringify(loaded.scene))
  trees = loaded.scene.objects.filter(object => object.typeId === 2001)
    .map(object => ({ eid: object.eid, mainVariant: object.variant, position: object.pos,
      secondaryVariant: object.secondaryVariant, secondaryVisible: object.secondaryVisible }))
  const original = loaded.scene.objects.find(object => object.eid === 'object-10')
  assert.deepEqual([original.atlasEntry, original.secondaryAtlasEntry, original.secondaryVariant], [266, 245, 2])
  report.target = { original, polygon: NATIVE_TREE_OCCLUSION_POLYGONS[original.secondaryVariant],
    bounds: NATIVE_TREE_OCCLUSION_BOUNDS[original.secondaryVariant] }
  report.initial = { pose: hostPose(), compiled: initial }
  await save()
  await moveToY('s', 235, 'approach-beside')
  await endpoint('01-beside-opaque', false)
  await moveToY('w', 140, 'walk-under')
  await endpoint('02-under-faded', true)
  await moveToY('s', 235, 'walk-away')
  await endpoint('03-away-recovered', false)
  report.inputEvents = await page.evaluate(() => window.__treeCrossingInputEvents)
  report.wire = wire
  assert.ok(wire.protocolVersions.length > 0)
  assert.ok(wire.protocolVersions.every(version => version === GAME_PROTOCOL_VERSION))
  assert.ok(wire.inputEvents.length > 0)
  assert.equal(report.inputEvents.filter(event => event.type === 'keydown' && event.frameTick !== null).length, 3)
  assert.ok(report.inputEvents.every(event => event.isTrusted))
  report.requests = [...requests].sort()
  assert.ok(report.requests.some(path => /^\/assets\/.*\.js$/.test(path)))
  assert.equal(report.requests.some(path => path.startsWith('/src/')), false)
  report.compiledAssets = await Promise.all(report.requests.filter(path => path.startsWith('/assets/'))
    .map(async path => ({ path, sha256: sha(await readFile(resolve(source, 'backend/wwwroot', '.' + path))) })))
  report.finalGpu = await canvas.evaluate(c => {
    const gl = c.getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info')
    return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), glError: gl.getError() }
  })
  assert.match(report.finalGpu.renderer, /Apple M2/)
  assert.equal(report.finalGpu.glError, 0)
  report.cameraStable = report.stages.every(stage => ['cameraX', 'cameraY', 'cameraZoom']
    .every(key => stage.before.frame[key] === report.stages[0].before.frame[key]))
  report.lightingPhase = 'Complex lighting remains enabled; real player light moves with the player. This is recorded phase-varying lighting, not a fixed-light pixel comparison.'
  report.restored = { alpha: report.stages.at(-1).before.frame.minTreeAlpha,
    fadedTrees: report.stages.at(-1).before.frame.fadedTreeCount,
    displacementFromBeside: Math.hypot(report.stages.at(-1).pose.position.x - report.stages[0].pose.position.x,
      report.stages.at(-1).pose.position.y - report.stages[0].pose.position.y) }
  report.gitStatusAfter = git('status', '--short')
  assert.equal(report.gitStatusAfter, report.gitStatusBefore)
  const manifestAfter = await sourceManifest()
  await writeFile(resolve(output, 'source-after.json'), JSON.stringify(manifestAfter, null, 2) + '\n')
  assert.equal(manifestAfter.sha256, manifestBefore.sha256, 'Exact source changed during acceptance')
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], host: [] })
  report.status = 'ok'
} catch (error) {
  report.status = 'failed'
  report.failure = { message: error.message, stack: error.stack }
  if (page && !page.isClosed()) {
    report.inputEvents = await page.evaluate(() => window.__treeCrossingInputEvents).catch(() => [])
    await page.screenshot({ path: resolve(output, 'failure.png'), timeout: 10000 }).catch(() => {})
    if (canvas) report.failureFrame = await frame().catch(() => null)
    if (playerId) report.failurePose = hostPose()
  }
  throw error
} finally {
  for (const key of pressed) await page?.keyboard.up(key).catch(() => {})
  await browser?.close()
  await host?.close()
  await server?.close()
  report.cleanup = { ownedBrowserClosed: !browser?.isConnected(), ownedHostClosed: true,
    ownedStaticServerClosed: true, pressedKeysReleased: true, candidateSourceEdited: false }
  await save()
  process.stdout.write(JSON.stringify({ status: report.status, stages: report.stages.map(stage => ({
    name: stage.name, alpha: stage.before.frame.minTreeAlpha, count: stage.before.frame.fadedTreeCount,
    position: stage.pose.position, settledTicks: stage.rawSettledTicks })), failure: report.failure,
    output, cleanup: report.cleanup }) + '\n')
}
