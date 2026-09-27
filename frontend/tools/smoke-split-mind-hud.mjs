import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer, preview } from 'vite'
import { CONCENTRATABLE_SKILL_IDS } from '../src/game/core-kernels/player-skill-runtime.ts'
import { createGameSimulation, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { grantPlayerEntitySkillRanks, replacePlayerEconomy, setPlayerEntitySkillRuntime } from '../src/game/core-server/player-entity-store.ts'
import { DEFAULT_GAME_SETTINGS, GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { enterBoneyard } from './game-smoke-navigation.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = process.env.SDR_SPLIT_HUD_OUTPUT || await mkdtemp(join(tmpdir(), 'solomon-split-hud-'))
await mkdir(output, { recursive: true })
const built = process.env.SDR_SPLIT_HUD_BUILT === '1'
const mobile = process.env.SDR_SPLIT_HUD_MOBILE === '1'
const uiScale = Number(process.env.SDR_SPLIT_HUD_UI_SCALE || 100)
const owner = 'split-hud-owner'
const credential = randomBytes(32).toString('base64url')
let state = createGameSimulation({ [owner]: { discipline: 'mind', displayName: 'Split Mind', element: 'air' } })
for (const skillId of CONCENTRATABLE_SKILL_IDS) {
  const granted = grantPlayerEntitySkillRanks(state.playerEntities, owner, skillId, 1, state.gameRng)
  state = { ...state, gameRng: granted.rng, playerEntities: granted.store }
}
state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, owner, {
  ...getPlayerEconomy(state, owner), ownedPerkSelectors: [21], collegeIntroPending: false, tutorialPending: false,
}), world: { ...state.world, participants: Object.fromEntries(Object.entries(state.world.participants)
  .map(([id, value]) => [id, { ...value, collegeIntro: null, region: 'courtyard', transition: null }])) } }
setSlots(state, [65, 67])
const document = createGameSaveDocument({ state, loadedBoneyard: null, integrity: 'local-only',
  playerId: owner, mods: [], modState: {} })
const vite = built
  ? await preview({ root, logLevel: 'error', preview: { host: '127.0.0.1', port: 0 } })
  : await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
if (!built) await vite.listen()
const baseUrl = `http://127.0.0.1:${vite.httpServer.address().port}`
const errors = { page: [], console: [], responses: [], host: [] }
const host = await startGameHost({ allowedOrigins: [baseUrl], authentication: { kind: 'shared', credential },
  snapshotRate: 20, log: entry => { if (entry.level === 'error') errors.host.push(entry.message) } })
const browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome', headless: true })
const page = await browser.newPage(mobile
  ? { viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1600, height: 900 } })
const samples = []
page.on('pageerror', error => errors.page.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
try {
  await page.route('**/__split_seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>HUD fixture</title>' }))
  await page.route('**/deployment.json?*', route => route.fulfill({ json: { revision: new URL(route.request().url()).searchParams.get('current') } }))
  await page.addInitScript(runtime => { window.solomonDarkRuntime = runtime }, {
    gameEndpoint: { kind: 'localhost', credential, url: host.address.url },
  })
  await page.goto(`${baseUrl}/__split_seed`)
  await page.evaluate(({ record, settings, settingsKey }) => new Promise((resolve, reject) => {
    localStorage.setItem(settingsKey, JSON.stringify(settings))
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('slots', { keyPath: 'slot' })
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const transaction = open.result.transaction('slots', 'readwrite')
      transaction.objectStore('slots').put(record)
      transaction.oncomplete = () => { open.result.close(); resolve() }
      transaction.onerror = () => reject(transaction.error)
    }
  }), { record: { document, revision: 1, slot: WEB_GAME_SAVE_SLOT },
    settings: { ...DEFAULT_GAME_SETTINGS, uiScalePercent: uiScale }, settingsKey: GAME_SETTINGS_STORAGE_KEY })
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play', exact: true }).click({ timeout: 180000 })
  await page.getByRole('button', { name: 'Last game', exact: true }).click()
  await page.locator('.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 90000 })
  await page.locator('.hub-hud-selected-skill[data-binding="20"]').waitFor()
  await capture('split-initial', 70)
  for (const slots of [[null, null], [65, null], [null, 67], [65, 67]]) {
    setSlots(host.state(), slots)
    await waitSlots(slots)
    await capture(`slots-${slots.join('-')}`, slots[1] === null ? 50 : 70)
  }
  for (const skill of CONCENTRATABLE_SKILL_IDS) {
    const slots = [skill, skill === 67 ? 65 : 67]
    setSlots(host.state(), slots)
    await waitSlots(slots)
    await capture(`concentration-${skill}`, 70, false)
  }
  setSlots(host.state(), [65, 67])
  await waitSlots([65, 67])
  for (const [binding, skillId] of [[16, 66], [20, 68]]) {
    const button = page.locator(`.hub-hud-selected-skill-action[data-binding="${binding}"]`)
    if (mobile) await button.tap(); else await button.click()
    const selector = page.locator(`.hud-skill-selector-stage[data-binding="${binding}"][data-renderer-state="ready"]`)
    await selector.waitFor()
    const option = selector.locator(`[data-skill-id="${skillId}"]`)
    if (mobile) await option.tap(); else await option.click()
    await selector.waitFor({ state: 'detached' })
  }
  await waitSlots([66, 68])
  await capture('selected-through-ui', 70)
  if (!mobile) {
    for (const viewport of [{ width: 2409, height: 643 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(250)
      await capture(`viewport-${viewport.width}`, 70)
    }
    await page.setViewportSize({ width: 1600, height: 900 })
  }
  await enterBoneyard(page)
  await capture('boneyard', 70)
  setSlots(host.state(), [66, null])
  await waitSlots([66, null])
  await capture('boneyard-cleared-b', 50)
  for (const value of Object.values(errors)) assert.deepEqual(value, [])
  const receipt = { status: 'ok', browser: browser.version(), built, mobile, uiScale,
    fixture: 'Private learned-concentration profile with Split Mind; real A/B selectors and Boneyard entry.', samples, errors }
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} catch (error) {
  await writeFile(join(output, 'failure.json'), JSON.stringify({ samples, errors }, null, 2))
  throw error
} finally {
  await browser.close(); await host.close()
  if (built) await new Promise((resolve, reject) => vite.httpServer.close(error => error ? reject(error) : resolve()))
  else await vite.close()
}

function setSlots(current, [a, b]) {
  current.playerEntities = setPlayerEntitySkillRuntime(current.playerEntities, owner, {
    ...current.playerEntities.skillRuntimes[0], concentrationSkillIdA: a, concentrationSkillIdB: b,
  })
}

async function waitSlots([a, b]) {
  const expected = [12, ...(a === null ? [] : [16]), ...(b === null ? [] : [20])]
  await page.waitForFunction(({ expected, records }) => {
    const icons = [...document.querySelectorAll('.hub-hud-selected-skill')]
    return icons.length === expected.length && icons.every(icon => {
      const binding = Number(icon.getAttribute('data-binding'))
      return expected.includes(binding) && (binding === 12 || Number(icon.getAttribute('data-record')) === records[binding])
    })
  }, { expected, records: { 16: a === null ? null : a + 27, 20: b === null ? null : b + 27 } })
}

async function capture(name, inset, screenshot = true) {
  const sample = await page.locator('.hub-hud').evaluate(hud => {
    const bounds = hud.getBoundingClientRect()
    const scale = bounds.width / parseFloat(getComputedStyle(hud).width)
    const center = (bounds.left + bounds.right) / 2
    const rect = selector => {
      const r = hud.querySelector(selector).getBoundingClientRect()
      return { left: (r.left - center) / scale, right: (r.right - center) / scale, width: r.width / scale }
    }
    return { scale, health: rect('.hub-hud-meter-health'), mana: rect('.hub-hud-meter-mana'),
      icons: [...hud.querySelectorAll('.hub-hud-selected-skill')].map(icon => {
        const r = icon.getBoundingClientRect()
        return { binding: Number(icon.dataset.binding), record: Number(icon.dataset.record),
          left: (r.left - center) / scale, right: (r.right - center) / scale }
      }) }
  })
  samples.push({ name, ...sample })
  if (screenshot) await page.screenshot({ path: join(output, `${name}.png`) })
  assert.ok(Math.abs(sample.health.right + inset) < .1, `${name} health inset: ${sample.health.right}`)
  assert.ok(Math.abs(sample.mana.left - inset) < .1, `${name} mana inset: ${sample.mana.left}`)
  for (const icon of sample.icons) {
    assert.ok(icon.left >= sample.health.right && icon.right <= sample.mana.left,
      `${name} icon overlaps a meter: ${JSON.stringify(icon)}`)
  }
}
