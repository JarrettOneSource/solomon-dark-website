import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import {
  getPlayerCharacter,
  getPlayerProgression,
  getPlayerSkillBook,
  grantGameSimulationPlayerExperience,
} from '../src/game/core-server/game-simulation.ts'
import {
  forcePlayerEntitySkillOfferIds,
  grantPlayerEntitySkillRanks,
  selectPlayerEntityConcentration,
} from '../src/game/core-server/player-entity-store.ts'
import {
  advanceNativeRngWords,
  createNativeRng,
} from '../src/game/core-kernels/native-rng.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_CREATIVITY_INSIGHT_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-creativity-insight'
const credential = randomBytes(32).toString('base64url')
const pageErrors = []
const consoleErrors = []
const failedResponses = []

const vite = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const viteAddress = vite.httpServer?.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its local smoke-test port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  snapshotRate: 100,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

try {
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(`${message.text()} @ ${message.location().url}`)
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })
  await page.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
  })

  await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).click()
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Ether' }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-mind').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const creativityGrant = grantPlayerEntitySkillRanks(
    host.state().playerEntities,
    playerId,
    63,
    1,
    host.state().gameRng,
  )
  Object.assign(host.state(), {
    ...host.state(),
    playerEntities: selectPlayerEntityConcentration(creativityGrant.store, playerId, 63),
  })
  const hubPlayerX = getPlayerCharacter(host.state(), playerId).position.x
  await page.keyboard.down('d')
  await waitForHost(
    () => getPlayerCharacter(host.state(), playerId).position.x > hubPlayerX,
    'authoritative Hub movement before Insight',
  )
  await page.keyboard.up('d')

  const hub = await exerciseInsightOffer('hub')

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
    timeout: 90_000,
  })
  const boneyard = await exerciseInsightOffer('boneyard')

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    boneyard,
    consoleErrors,
    failedResponses,
    hub,
    pageErrors,
  })}\n`)

  async function exerciseInsightOffer(scene) {
    const insightSeed = createNativeRng(1)
    const secondaryRng = host.state().secondaryAbilities.rng
    Object.assign(host.state(), {
      ...host.state(),
      gameRng: insightSeed,
      playerEntities: forcePlayerEntitySkillOfferIds(
        host.state().playerEntities,
        playerId,
        [48, 49, 56, 64],
      ),
    })
    const before = getPlayerProgression(host.state(), playerId)
    const leveled = grantGameSimulationPlayerExperience(
      host.state(),
      playerId,
      before.nextThreshold - before.experience + 1,
    )
    const progression = getPlayerProgression(leveled, playerId)
    const offer = progression.pendingOffer
    assert.ok(offer)
    assert.equal(offer.options.length, 4)
    const insightOptions = offer.options.filter(option => option.insight === true)
    assert.equal(insightOptions.length, 1)
    assert.deepEqual(leveled.gameRng, advanceNativeRngWords(insightSeed, 6))
    assert.strictEqual(leveled.secondaryAbilities.rng, secondaryRng)
    Object.assign(host.state(), leveled)

    const picker = page.getByRole('dialog', {
      name: `Level ${progression.level}. Select a skill.`,
    })
    await picker.waitFor({ timeout: 30_000 })
    await page.waitForFunction(() => (
      document.querySelector('.skill-picker-stage')?.getAttribute('data-renderer-state')
        === 'ready'
      && document.querySelector('.skill-picker-stage')?.getAttribute('data-reveal-interactive')
        === 'true'
    ), undefined, { timeout: 30_000 })

    const insightOption = insightOptions[0]
    const action = picker.locator(
      `.skill-picker-action[data-skill-id="${insightOption.skillId}"][data-insight="true"]`,
    )
    assert.equal(await action.count(), 1)
    const label = await action.getAttribute('aria-label') ?? ''
    assert.match(label, /^Insight\..*Insight Bonus: Skill \+2\.$/)
    const screenshotPath = `${screenshotRoot}-${scene}.png`
    await page.screenshot({ path: screenshotPath })

    const rankBefore = getPlayerSkillBook(host.state(), playerId)
      .permanentRanks[insightOption.skillId]
    const choiceRng = host.state().gameRng
    await action.click()
    await waitForHost(() => (
      getPlayerSkillBook(host.state(), playerId).permanentRanks[insightOption.skillId]
        === rankBefore + 2
    ), `${scene} Insight double rank`)
    await picker.waitFor({ state: 'detached', timeout: 15_000 })
    await waitForHost(() => host.state().levelUpBarrier === null, `${scene} barrier release`)
    assert.deepEqual(host.state().gameRng, advanceNativeRngWords(choiceRng, 2))
    assert.strictEqual(host.state().secondaryAbilities.rng, secondaryRng)
    return {
      label,
      level: progression.level,
      optionCount: offer.options.length,
      rankAfter: getPlayerSkillBook(host.state(), playerId).permanentRanks[insightOption.skillId],
      rankBefore,
      screenshotPath,
      skillId: insightOption.skillId,
    }
  }
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    body: (await page.locator('body').innerText()).slice(0, 2_000),
    consoleErrors,
    failedResponses,
    pageErrors,
    url: page.url(),
  })}\n`)
  throw error
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

async function waitForHost(predicate, label, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`timed out waiting for ${label}`)
}
