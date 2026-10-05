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
          const processor = context.createScriptProcessor(2048, 2, 2)
          const silence = context.createGain()
          silence.gain.value = 0
          nativeConnect.call(processor, silence)
          nativeConnect.call(silence, context.destination)
          tap = { processor, chunks: null, sampleRate: context.sampleRate }
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
        nativeConnect.call(this, tap.processor)
      }
      return result
    }
    window.__rescueStartAudioCapture = () => {
      if (taps.size !== 1) throw new Error('Capture requires one actual output context')
      const tap = [...taps.values()][0]
      tap.chunks = []
      window.__rescueStopAudioCapture = () => {
        const pcm = tap.chunks
        tap.chunks = null
        return { sampleRate: tap.sampleRate, pcm: pcm.flatMap(chunk => Array.from(chunk)) }
      }
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
  const authoritative = host.state()
  const tick = authoritative.tick
  const result = damageGameSimulationPlayer(authoritative, playerId, 100000, tick)
  assert.equal(getPlayerProgression(result, playerId).rescueProtection.fraction, 1)
  assert.equal(result.secondaryAbilities.actors.filter(value => value.kind === 'rescue-shockwave').length, 1)
  Object.assign(host.state(), result)
  const notice = page.locator('.boneyard-loot-messages > span[aria-label="CHEAT DEATH!"]')
  const foreground = notice.locator(':scope > [data-native-ui-font="body"]')
  await foreground.locator('i').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(200)
  receipt.text = await notice.evaluate(node => {
    const foreground = node.querySelector(':scope > [data-native-ui-font="body"]')
    const glyphs = [...foreground.querySelectorAll('i')].map(glyph => ({
      codePoint: Number(glyph.dataset.nativeUiGlyph), bounds: glyph.getBoundingClientRect().toJSON(),
      maskImage: getComputedStyle(glyph).maskImage,
    })).filter(glyph => glyph.bounds.width > 0 && glyph.bounds.height > 0)
    const left = Math.min(...glyphs.map(glyph => glyph.bounds.left))
    const right = Math.max(...glyphs.map(glyph => glyph.bounds.right))
    const top = Math.min(...glyphs.map(glyph => glyph.bounds.top))
    const bottom = Math.max(...glyphs.map(glyph => glyph.bounds.bottom))
    return { text: node.getAttribute('aria-label'), bounds: { left, right, top, bottom, width: right - left, height: bottom - top },
      glyphs, font: foreground.dataset.nativeUiFont, placement: foreground.dataset.nativeUiPlacement,
      top: getComputedStyle(node).top, opacity: getComputedStyle(node).opacity,
      parentBounds: node.parentElement.getBoundingClientRect().toJSON(),
      shadow: { left: getComputedStyle(node.firstElementChild).left, top: getComputedStyle(node.firstElementChild).top } }
  })
  assert.equal(receipt.text.text, 'CHEAT DEATH!')
  assert.ok(receipt.text.bounds.width > 20 && receipt.text.bounds.height > 0)
  assert.equal(receipt.text.font, 'body')
  assert.equal(receipt.text.placement, 'baseline')
  assert.ok(receipt.text.glyphs.every(glyph => glyph.maskImage !== 'none'))
  assert.deepEqual(receipt.text.shadow, { left: '0px', top: '2px' })
  await page.screenshot({ path: `${output}/cheat-death-text.png` })
  await page.waitForFunction(mark => window.__sdrAudioEvents.slice(mark).filter(event => event.type === 'buffer-start'
    && ['flash-spell.wav', 'enemy-flash.wav'].some(name => window.__sdrAudioSourceMatches(event.src, name))).length >= 4,
  soundMark, { timeout: 15000 })
  receipt.sound = await page.evaluate(mark => window.__sdrAudioEvents.slice(mark).filter(event => event.type === 'buffer-start'
    && ['flash-spell.wav', 'enemy-flash.wav'].some(name => window.__sdrAudioSourceMatches(event.src, name)))
    .map(event => ({ ...event, cue: window.__sdrAudioSourceMatches(event.src, 'flash-spell.wav') ? 'flash-spell' : 'flash' })), soundMark)
  assert.equal(receipt.sound.length, 4)
  assert.deepEqual(receipt.sound.map(event => event.cue), ['flash-spell', 'flash-spell', 'flash-spell', 'flash'])
  assert.deepEqual(receipt.sound.map(event => event.playbackRate), [1, Math.fround(.8), .5, 1])
  assert.ok(receipt.sound.every(event => event.volume > 0))
  const repeat = damageGameSimulationPlayer(host.state(), playerId, 100000, host.state().tick)
  assert.equal(repeat, host.state())
  await page.waitForTimeout(1000)
  const recording = await page.evaluate(() => window.__rescueStopAudioCapture())
  const pcm = Buffer.from(recording.pcm)
  assert.ok(pcm.length > 100)
  assert.equal(pcm.length % 4, 0)
  let squared = 0
  let peak = 0
  for (let offset = 0; offset < pcm.length; offset += 2) {
    const sample = pcm.readInt16LE(offset)
    squared += sample * sample
    peak = Math.max(peak, Math.abs(sample))
  }
  assert.ok(peak > 0, 'Actual output PCM must contain the audible cue')
  const header = Buffer.alloc(44)
  header.write('RIFF', 0); header.writeUInt32LE(pcm.length + 36, 4); header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22)
  header.writeUInt32LE(recording.sampleRate, 24); header.writeUInt32LE(recording.sampleRate * 4, 28)
  header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
  await writeFile(`${output}/cheat-death-audio.s16le`, pcm)
  await writeFile(`${output}/cheat-death-audio.wav`, Buffer.concat([header, pcm]))
  receipt.audioRecording = { mimeType: 'audio/wav', bytes: pcm.length + 44,
    pcmBytes: pcm.length, channels: 2, sampleRate: recording.sampleRate, pcmFormat: 's16le',
    peak, rms: Math.sqrt(squared / (pcm.length / 2)) }
  await page.keyboard.press('Escape')
  const activePause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await activePause.waitFor({ timeout: 10000 })
  await page.waitForTimeout(50)
  const paused = { tick: host.state().tick,
    fraction: getPlayerProgression(host.state(), playerId).rescueProtection.fraction,
    noticeOpacity: await notice.evaluate(node => getComputedStyle(node).opacity) }
  assert.ok(paused.fraction > 0)
  await page.waitForTimeout(250)
  assert.equal(host.state().tick, paused.tick)
  assert.equal(getPlayerProgression(host.state(), playerId).rescueProtection.fraction, paused.fraction)
  assert.equal(await notice.evaluate(node => getComputedStyle(node).opacity), paused.noticeOpacity)
  receipt.pause = paused
  await activePause.getByRole('button', { name: 'RESUME GAME' }).click()
  await activePause.waitFor({ state: 'detached', timeout: 10000 })
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
