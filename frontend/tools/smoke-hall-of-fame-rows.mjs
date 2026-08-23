#!/usr/bin/env node
// Hall of Fame row journey: seed local records, open the Hall from the main
// menu, expand rows, scroll, flip to the global board, and return. Writes
// screenshots + a JSON receipt; fails on any page error or console error.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright-core'

const base = process.env.SDR_BASE_URL ?? 'http://127.0.0.1:5173'
const outDir = path.resolve(process.env.SDR_SMOKE_OUT ?? 'hall-smoke')
const query = process.env.SDR_HALL_QUERY ?? ''
const executablePath = process.env.SDR_CHROME_PATH
if (!executablePath) throw new Error('SDR_CHROME_PATH must point at a Chrome binary')

const STORAGE_KEY = 'sdr.game.hall-of-fame.v2'
const entries = [
  // Stock names are entered in capitals and the stock rows use the adult wizard headings
  // (8-16); the ether wizard sits in row 2 so the orb compares like-for-like with the
  // stock capture's Seer in row 2.
  seed('smoke-1', 'IGNATIUS', 'fire', 'body', 9, 41, 18, 250, 4, [[52, 5], [48, 4], [36, 3]], [1, 4, 7, 9], 0.97, 'Skeleton King', 39_850, 2_104),
  seed('smoke-5', 'AETHER', 'ether', 'mind', 8, 18, 7, 88, 1, [[80, 1]], [], 0.95, null, 36_000, 310),
  seed('smoke-2', 'MARISOL', 'water', 'mind', 14, 37, 15, 211, 6, [[64, 4], [60, 3], [12, 2]], [2, 5, 8], 1, 'Bone Golem', 33_120, 1_760),
  seed('smoke-3', 'ZEPHYR', 'air', 'arcane', 11, 30, 12, 164, 3, [[44, 3], [40, 2], [9, 1]], [3, 6, 10, 11, 12, 13, 14, 15, 16], 0.9, 'Ghoul', 24_000, 1_190),
  seed('smoke-4', 'TERRENCE', 'earth', 'body', 16, 24, 9, 120, 2, [[76, 2], [72, 1]], [4], 0.88, 'Zombie', 16_410, 640),
  seed('smoke-6', 'NOVA', 'fire', 'arcane', 12, 11, 4, 45, 0, [], [], 0.85, null, 4_100, 120),
]

function seed(runId, wizardName, element, discipline, headingIndex, level, wave, monstersKilled, perkCount, skills, perksUsed, portraitScale, awesomestKill, awesomeness, elapsedSeconds) {
  void perkCount
  return {
    accountUsername: null,
    awesomeness,
    awesomestKill,
    completedAtUtc: '2026-08-22T12:00:00.000Z',
    discipline,
    elapsedTicks: elapsedSeconds * 100,
    element,
    headingIndex,
    highestSkills: skills.map(([skillId, rank]) => ({ rank, skillId })),
    level,
    monstersKilled,
    perksUsed,
    portraitScale,
    runId,
    wave,
    wizardName,
  }
}

// dev:game serves no backend: the deployment stamp 404s and the global leaderboard
// read 500s. Those two are the expected dev-loop responses and are recorded apart
// from real failures so the gate stays strict for everything else.
const EXPECTED_DEV_FAILURES = [/\/deployment\.json(?:\?|$)/, /\/api\/game\/leaderboards(?:\?|$)/]
const isExpectedDevFailure = (url) => EXPECTED_DEV_FAILURES.some((pattern) => pattern.test(url))

const receipt = {
  base,
  consoleErrors: [],
  expectedDevErrors: [],
  expectedDevResponses: [],
  failedResponses: [],
  pageErrors: [],
  screenshots: [],
  steps: [],
}
const started = Date.now()
const step = (name, detail = {}) => {
  receipt.steps.push({ at: Date.now() - started, name, ...detail })
  console.log(`[hall-smoke] ${name}`, JSON.stringify(detail))
}

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ executablePath, headless: true })
let failure = null
try {
  const context = await browser.newContext({ deviceScaleFactor: 1, viewport: { height: 900, width: 1600 } })
  await context.addInitScript(([key, value]) => {
    window.localStorage.setItem(key, value)
  }, [STORAGE_KEY, JSON.stringify(entries)])
  const page = await context.newPage()
  page.on('pageerror', (error) => receipt.pageErrors.push(String(error?.stack ?? error)))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    const line = `${message.text()} @ ${location?.url ?? '?'}:${location?.lineNumber ?? '?'}`
    const resourceFailure = message.text().startsWith('Failed to load resource') && isExpectedDevFailure(location?.url ?? '')
    ;(resourceFailure ? receipt.expectedDevErrors : receipt.consoleErrors).push(line)
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    const line = `${response.status()} ${response.url()}`
    ;(isExpectedDevFailure(response.url()) ? receipt.expectedDevResponses : receipt.failedResponses).push(line)
  })

  // Every capture is taken with the pointer parked at the page origin and the
  // toggle hover/focus brightness fully transitioned away, so the chevrons are
  // captured at rest (the stock renderer has no hover state to compare against).
  const restPointer = async () => {
    await page.mouse.move(0, 0)
    await page.waitForFunction(
      () =>
        document.querySelector('.hall-row-toggle:hover') === null &&
        [...document.querySelectorAll('.hall-row-toggle .hall-sprite')].every((el) => getComputedStyle(el).filter === 'none'),
      undefined,
      { timeout: 5_000 },
    )
  }
  const shoot = async (name, clip) => {
    await restPointer()
    const file = path.join(outDir, `${name}.png`)
    await page.screenshot({ clip, path: file })
    receipt.screenshots.push(file)
    step(`screenshot ${name}`)
  }
  const settleArt = async () => {
    await page.evaluate(async () => {
      await document.fonts.ready
      const urls = new Set()
      for (const element of document.querySelectorAll('.hall-of-fame-box *')) {
        const style = getComputedStyle(element)
        for (const value of [style.backgroundImage, style.maskImage, style.webkitMaskImage]) {
          const match = /url\("?([^")]+)"?\)/.exec(value ?? '')
          if (match) urls.add(match[1])
        }
      }
      await Promise.all([...urls].map((url) => new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve()
        image.onerror = () => reject(new Error(`failed to load ${url}`))
        image.src = url
      })))
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
  }

  await page.goto(`${base}/game${query}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  step('menu ready')
  await shoot('01-menu')

  await page.getByRole('button', { name: 'Hall of Fame' }).click()
  const stage = page.locator('section[aria-label="Hall of Fame"]')
  await stage.waitFor({ timeout: 30_000 })
  await page.locator(`section[data-hall-entry-count="${entries.length}"]`).waitFor({ timeout: 30_000 })
  await page.locator('.hall-row').first().waitFor({ state: 'attached' })
  await settleArt()
  step('hall open', { rows: await page.locator('.hall-row').count() })
  await shoot('02-hall-collapsed')
  const box = { height: 695, width: 1200, x: 200, y: 80 }
  await shoot('02b-hall-box-collapsed', box)

  await page.getByRole('button', { name: 'Show details for IGNATIUS' }).click()
  await page.locator('.hall-row[data-hall-rank="1"][data-hall-expanded="true"]').waitFor({ state: 'attached' })
  await settleArt()
  step('row 1 expanded', {
    skillCells: await page.locator('.hall-row[data-hall-rank="1"] .hall-skill-cell').count(),
    perkCells: await page.locator('.hall-row[data-hall-rank="1"] .hall-perk-cell').count(),
  })
  await shoot('03-hall-expanded')
  await shoot('03b-hall-box-expanded', box)
  await shoot('03c-row-1-expanded', { height: 420, width: 1120, x: 240, y: 130 })

  await page.getByRole('button', { name: 'Show details for AETHER' }).click()
  await page.getByRole('button', { name: 'Show details for MARISOL' }).click()
  await page.locator('.hall-row[data-hall-rank="3"][data-hall-expanded="true"]').waitFor({ state: 'attached' })
  await page.evaluate(() => {
    const scroller = document.querySelector('.hall-of-fame-scroll')
    scroller.scrollTop = 620
  })
  await page.locator('.hall-of-fame-scroll[data-hall-scroll-top="620"]').waitFor()
  await settleArt()
  step('scrolled', { scrollTop: 620, rendered: await page.locator('.hall-row').count() })
  await shoot('04-hall-scrolled')
  await shoot('04b-hall-box-scrolled', box)

  await page.getByRole('button', { name: 'Hide details for IGNATIUS' }).click()
  await page.locator('.hall-row[data-hall-rank="1"][data-hall-expanded="false"]').waitFor({ state: 'attached' })
  step('row 1 collapsed again')

  await page.getByRole('group', { name: 'Hall scope' }).getByRole('button', { name: 'GLOBAL' }).click()
  await page.locator('section[data-hall-scope="global"]').waitFor()
  // The scroller reports busy synchronously with the scope switch and stays busy until the
  // global read for this board settles (rows, the empty-board status, or the error alert),
  // so the first non-busy global scroller is the settled board.
  await page.locator('section[data-hall-scope="global"] .hall-of-fame-scroll[aria-busy="false"]').waitFor({ state: 'attached', timeout: 30_000 })
  await settleArt()
  const globalState = {
    alert: await page.locator('.hall-of-fame-scroll [role="alert"]').count(),
    rows: await page.locator('.hall-row').count(),
    status: await page.locator('.hall-of-fame-scroll .hall-of-fame-status').count(),
    board: await stage.getAttribute('data-hall-board'),
  }
  if (globalState.alert + globalState.rows + globalState.status === 0) throw new Error('global board settled with nothing rendered')
  step('global board', globalState)
  await shoot('05-hall-global')
  await page.getByRole('group', { name: 'Global leaderboard' }).getByRole('button', { name: 'WAVE' }).click()
  await page.locator('section[data-hall-board="wave"]').waitFor()
  step('global wave board')

  await page.getByRole('group', { name: 'Hall scope' }).getByRole('button', { name: 'LOCAL' }).click()
  await page.locator('section[data-hall-scope="local"]').waitFor()
  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 30_000 })
  step('back to menu')
  await shoot('06-menu-return')
} catch (error) {
  failure = error
} finally {
  await browser.close()
}

receipt.failure = failure ? String(failure?.stack ?? failure) : null
receipt.elapsedMs = Date.now() - started
await writeFile(path.join(outDir, 'receipt.json'), JSON.stringify(receipt, null, 2))
console.log(JSON.stringify({
  consoleErrors: receipt.consoleErrors.length,
  expectedDevErrors: receipt.expectedDevErrors.length,
  expectedDevResponses: receipt.expectedDevResponses,
  failedResponses: receipt.failedResponses,
  failure: receipt.failure,
  pageErrors: receipt.pageErrors.length,
  screenshots: receipt.screenshots.length,
}, null, 2))
if (failure || receipt.pageErrors.length > 0 || receipt.consoleErrors.length > 0 || receipt.failedResponses.length > 0) {
  console.error(receipt.pageErrors.join('\n'))
  console.error(receipt.consoleErrors.join('\n'))
  console.error(receipt.failedResponses.join('\n'))
  process.exit(1)
}
