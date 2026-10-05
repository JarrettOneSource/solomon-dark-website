import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { DEFAULT_GAME_SETTINGS } from '../src/game/game-settings.ts'
import { damageGameSimulationPlayer, getPlayerCharacter, getPlayerProgression } from '../src/game/core-server/game-simulation.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import { enterElementHub, enterBoneyard, openBoneyardCombat, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_RESCUE_OUTPUT
assert.ok(output, 'Set the owned rescue evidence directory')
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({ root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)) })
const credential = 'owned-player-rescue-acceptance'
const host = await startGameHost({ allowedOrigins: [server.origin], authentication: { kind: 'shared', credential },
  createBoneyardSeedBytes: () => Buffer.alloc(16), snapshotRate: 100, resetWhenEmpty: true })
const browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const errors = { page: [], console: [], responses: [] }
const receipt = { viewport: { width: 1600, height: 900 }, fixture: 'Real built client/host transport; one authored charge and deterministic direct damage through the canonical boundary', text: null, sound: null }
try {
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push({ status: response.status(), url: response.url() }) })
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.route('**/deployment.json*', route => route.fulfill({
    body: JSON.stringify({ revision: new URL(route.request().url()).searchParams.get('current') }),
    contentType: 'application/json', headers: { 'cache-control': 'no-store' }, status: 200,
  }))
  await page.addInitScript(({ runtime, settings }) => {
    window.solomonDarkRuntime = runtime
    localStorage.setItem('solomon-dark-game-settings-v1', JSON.stringify(settings))
    const nativeConnect = AudioNode.prototype.connect
    const taps = new Map()
    AudioNode.prototype.connect = function (destination, ...args) {
      const result = nativeConnect.call(this, destination, ...args)
      if (destination === this.context.destination) {
        let tap = taps.get(this.context)
        if (!tap) {
          const context = this.context
          const destination = context.createMediaStreamDestination()
          const processor = context.createScriptProcessor(2048, 2, 2)
          const silence = context.createGain()
          silence.gain.value = 0
          nativeConnect.call(processor, silence)
          nativeConnect.call(silence, context.destination)
          tap = { destination, processor, chunks: null, sampleRate: context.sampleRate }
          processor.onaudioprocess = event => {
            if (!tap.chunks) return
            const left = event.inputBuffer.getChannelData(0)
            const right = event.inputBuffer.getChannelData(1)
            const samples = new Int16Array(left.length * 2)
            for (let i = 0; i < left.length; i++) {
              samples[i * 2] = Math.round(Math.max(-1, Math.min(1, left[i])) * 32767)
              samples[i * 2 + 1] = Math.round(Math.max(-1, Math.min(1, right[i])) * 32767)
            }
            tap.chunks.push(new Uint8Array(samples.buffer))
          }
          taps.set(context, tap)
        }
        nativeConnect.call(this, tap.destination)
        nativeConnect.call(this, tap.processor)
      }
      return result
    }
    window.__rescueStartAudioCapture = () => {
      const streams = [...taps.values()].map(tap => tap.destination.stream)
      if (streams.length === 0) throw new Error('No real output audio graph')
      const stream = new MediaStream(streams.flatMap(value => value.getAudioTracks()))
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      const chunks = []
      recorder.ondataavailable = event => chunks.push(event.data)
      recorder.start()
      if (taps.size !== 1) throw new Error('Capture requires one actual output context')
      const tap = [...taps.values()][0]
      tap.chunks = []
      window.__rescueStopAudioCapture = () => new Promise(resolve => {
        recorder.onstop = async () => {
          const bytes = new Uint8Array(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer())
          const pcm = tap.chunks
          tap.chunks = null
          resolve({ mimeType: recorder.mimeType, bytes: Array.from(bytes), sampleRate: tap.sampleRate,
            pcm: pcm.flatMap(chunk => Array.from(chunk)) })
        }
        recorder.stop()
      })
    }
  }, { runtime: { gameEndpoint: { kind: 'localhost', url: host.address.url, credential } },
    settings: { ...DEFAULT_GAME_SETTINGS, musicVolumePercent: 0, soundVolumePercent: 100 } })
  await enterElementHub(page, server.origin, 'Ether')
  await enterBoneyard(page)
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  await openBoneyardCombat(host, playerId)
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  // Keep the authentic loaded arena and participant; isolate the reported trigger.
  state.world = { ...state.world, enemies: { ...state.world.enemies, actors: [], maggots: [], projectiles: [] },
    encounter: state.world.encounter ? { ...state.world.encounter, phase: 'gone' } : null,
    waves: state.world.waves ? { ...state.world.waves, phase: 'interwave', interwaveDelayTicks: 1000000 } : null }
  const index = state.playerEntities.identities.findIndex(value => value.playerId === playerId)
  assert.ok(index >= 0)
  state.playerEntities = { ...state.playerEntities, progressions: state.playerEntities.progressions.map((value, slot) =>
    slot === index ? { ...value, hagathaRuntime: { ...value.hagathaRuntime, cheatDeathCharges: 1 } } : value) }
  const soundMark = await page.evaluate(() => window.__sdrAudioEvents.length)
  await page.evaluate(() => window.__rescueStartAudioCapture())
  const tick = state.tick
  const result = damageGameSimulationPlayer(state, playerId, 100000, tick)
  assert.equal(getPlayerProgression(result, playerId).rescueProtection.fraction, 1)
  assert.equal(result.secondaryAbilities.actors.filter(value => value.kind === 'rescue-shockwave').length, 1)
  Object.assign(host.state(), result)
  const notice = page.locator('.boneyard-loot-messages > span[aria-label="CHEAT DEATH!"]')
  await notice.waitFor({ state: 'visible', timeout: 15000 })
  receipt.text = await notice.evaluate(node => ({ text: node.getAttribute('aria-label'), bounds: node.getBoundingClientRect().toJSON(),
    top: getComputedStyle(node).top, opacity: getComputedStyle(node).opacity, html: node.innerHTML,
    parentBounds: node.parentElement.getBoundingClientRect().toJSON(),
    shadow: { left: getComputedStyle(node.firstElementChild).left, top: getComputedStyle(node.firstElementChild).top } }))
  assert.equal(receipt.text.text, 'CHEAT DEATH!')
  assert.ok(receipt.text.bounds.width > 20 && receipt.text.bounds.height > 0)
  assert.deepEqual(receipt.text.shadow, { left: '0px', top: '2px' })
  await page.screenshot({ path: `${output}/cheat-death-text.png` })
  await page.waitForFunction(mark => window.__sdrAudioEvents.slice(mark).filter(event => event.type === 'buffer-start'
    && /\/flash(?:-spell)?(?:-[\w-]+)?\.wav$/.test(new URL(event.src, location.href).pathname)).length >= 4,
  soundMark, { timeout: 15000 })
  receipt.sound = await page.evaluate(mark => window.__sdrAudioEvents.slice(mark).filter(event => event.type === 'buffer-start'
    && /\/flash(?:-spell)?(?:-[\w-]+)?\.wav$/.test(new URL(event.src, location.href).pathname)), soundMark)
  assert.equal(receipt.sound.length, 4)
  assert.deepEqual(receipt.sound.map(event => /\/flash-spell(?:-[\w-]+)?\.wav$/.test(new URL(event.src).pathname)),
    [true, true, true, false])
  assert.deepEqual(receipt.sound.map(event => event.playbackRate), [1, Math.fround(.8), .5, 1])
  assert.ok(receipt.sound.every(event => event.volume > 0))
  const repeat = damageGameSimulationPlayer(host.state(), playerId, 100000, host.state().tick)
  assert.equal(repeat, host.state())
  await page.waitForTimeout(1000)
  const recording = await page.evaluate(() => window.__rescueStopAudioCapture())
  assert.ok(recording.bytes.length > 100)
  await writeFile(`${output}/cheat-death-audio.webm`, Buffer.from(recording.bytes))
  await writeFile(`${output}/cheat-death-audio.s16le`, Buffer.from(recording.pcm))
  receipt.audioRecording = { mimeType: recording.mimeType, bytes: recording.bytes.length,
    pcmBytes: recording.pcm.length, channels: 2, sampleRate: recording.sampleRate, pcmFormat: 's16le' }
  await waitUntil(() => getPlayerProgression(host.state(), playerId).rescueProtection.fraction === 0,
    'Rescue protection did not retire', 10000)
  await waitUntil(() => getPlayerProgression(host.state(), playerId).rescueProtection.particles.length === 0,
    'Rescue Sparkles did not retire', 10000)
  receipt.lifecycle = { triggerTick: tick, retiredTick: host.state().tick,
    health: getPlayerProgression(host.state(), playerId).currentHealth,
    position: getPlayerCharacter(host.state(), playerId).position, charges: getPlayerProgression(host.state(), playerId).hagathaRuntime.cheatDeathCharges }
  assert.equal(receipt.lifecycle.charges, 0)
  assert.equal(await notice.count(), 0)
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor({ timeout: 10000 })
  await pause.getByRole('button', { name: 'LEAVE GAME' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 30000 })
  assert.equal(await page.locator('.boneyard-world-canvas').count(), 0)
  assert.deepEqual(errors, { page: [], console: [], responses: [] })
  receipt.errors = errors
  receipt.rendererReleased = true
  receipt.limits = 'Controlled native-contract trigger over the real built client/host. PCM comes from the actual browser output graph, not a physical speaker/loopback device; original clip comparison is separate.'
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  process.stdout.write(`${JSON.stringify(receipt)}\n`)
} catch (error) {
  receipt.failure = { message: error.message, stack: error.stack }
  receipt.errors = errors
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {})
  throw error
} finally {
  await page.close()
  await browser.close()
  await host.close()
  await server.close()
}
