import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import {
  getPlayerEconomy,
  selectGameSimulationPlayerConcentration,
} from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotPath = process.env.SDR_DERIVED_HUD_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-native-derived-hud.png'
const credential = randomBytes(32).toString('base64url')
const pageErrors = []
const consoleErrors = []
const networkErrors = []

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
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'failed'
    if (failure === 'net::ERR_ABORTED' && /\.(?:mp3|ogg)(?:\?|$)/.test(request.url())) return
    networkErrors.push(`${request.url()}: ${failure}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
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
  await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /Earth/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-mind').click()
  const hubScene = page.locator('.hub-scene[data-renderer-state="ready"]')
  await hubScene.waitFor({ timeout: 30_000 })
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor({
    timeout: 10_000,
  })

  const defaultHud = await measureHud(page)
  assert.equal(defaultHud.health.width, 110)
  assert.deepEqual(defaultHud.healthCore, {
    bottom: 29.5,
    left: 645,
    right: 745,
    top: 19.5,
    width: 100,
  })
  assert.equal(defaultHud.health.right, 750)
  assert.equal(defaultHud.mana.left, 850)
  assert.equal(defaultHud.mana.width, 110)
  assert.deepEqual(defaultHud.manaCore, {
    bottom: 29.5,
    left: 855,
    right: 955,
    top: 19.5,
    width: 100,
  })
  assert.deepEqual(defaultHud.bindings, [
    { binding: 12, centerX: 800, record: 67 },
  ])

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  mutatePlayer(host.state(), playerId, {
    learnedSkillIds: [12, 23, 56, 57, 58, 64],
    ownedPerkSelectors: [0, 1, 21],
  })
  await page.locator('.hub-hud-meter-health[data-core-width="137.5"]').waitFor({
    timeout: 10_000,
  })
  await page.locator('.hub-hud-meter-mana[data-core-width="137.5"]').waitFor({
    timeout: 10_000,
  })
  const charmedHud = await measureHud(page)
  assert.equal(charmedHud.health.left, 602.5)
  assert.equal(charmedHud.health.right, 750)
  assert.equal(charmedHud.health.width, 147.5)
  assert.equal(charmedHud.mana.left, 850)
  assert.equal(charmedHud.mana.right, 997.5)
  assert.equal(charmedHud.mana.width, 147.5)

  setPlayerHealthRatio(host.state(), playerId, 0.5)
  await waitForLocalHealthDamage(page)
  const damagedHud = await measureHud(page)
  assertLocalHealthRetractsFromRight(damagedHud)

  setVitalLayers(host.state(), playerId)
  await page.locator('.hub-hud-mana-reserve').waitFor({ timeout: 10_000 })
  await page.locator('.hub-hud-meter-shield').waitFor({ timeout: 10_000 })
  const layeredHud = await measureHud(page)
  assert.deepEqual(layeredHud.reserve, {
    bottom: 29.5,
    left: 965,
    right: 992.5,
    top: 19.5,
    width: 27.5,
  })
  assert.deepEqual(layeredHud.shield, {
    bottom: 29.5,
    left: 607.5,
    right: 745,
    top: 19.5,
    width: 137.5,
  })
  assert.equal(layeredHud.shieldClip, 'inset(0px 50% 0px 0px)')

  selectConcentration(host.state(), playerId, 57)
  selectConcentration(host.state(), playerId, 58)
  await page.locator('.hub-hud-selected-skill[data-binding="20"][data-record="85"]').waitFor({
    timeout: 10_000,
  })
  const splitMindHud = await measureHud(page)
  assert.deepEqual(splitMindHud.bindings, [
    { binding: 12, centerX: 760, record: 67 },
    { binding: 16, centerX: 840, record: 84 },
    { binding: 20, centerX: 800, record: 85 },
  ])

  mutatePlayer(host.state(), playerId, {
    learnedSkillIds: [8, 9, 10, 16, 17, 18, 52],
    primarySkillId: 52,
    weldBuildId: 1000,
  })
  await page.locator('.hub-hud-selected-skill[data-binding="12"][data-record="81"]').waitFor({
    timeout: 10_000,
  })
  setPlanewalker(host.state(), playerId, true)
  await page.locator('.hub-hud-selected-skill[data-binding="12"][data-record="107"]').waitFor({
    timeout: 10_000,
  })
  const planewalkerHud = await measureHud(page)
  assert.equal(planewalkerHud.bindings[0].record, 107)
  await page.locator('.hub-hud-selected-skill-action[data-binding="12"]').click({ force: true })
  await page.waitForTimeout(100)
  assert.equal(await page.getByRole('dialog', { name: 'Select Primary Attack' }).count(), 0)
  assert.equal(await hubScene.getAttribute('data-gameplay-input-blocked'), 'false')
  setPlanewalker(host.state(), playerId, false)
  await page.locator('.hub-hud-selected-skill[data-binding="12"][data-record="81"]').waitFor({
    timeout: 10_000,
  })

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
    timeout: 90_000,
  })
  setPlayerHealthRatio(host.state(), playerId, 0.5)
  await waitForLocalHealthDamage(page)
  const boneyardDamagedHud = await measureHud(page)
  assertLocalHealthRetractsFromRight(boneyardDamagedHud)

  await page.screenshot({ path: screenshotPath })
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(networkErrors, [])
  process.stdout.write(`${JSON.stringify({
    boneyardDamagedHud,
    charmedHud,
    consoleErrors,
    damagedHud,
    defaultHud,
    layeredHud,
    networkErrors,
    pageErrors,
    planeOrbSelectorGate: true,
    planewalkerHud,
    screenshotPath,
    splitMindHud,
  })}\n`)
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

function mutatePlayer(state, playerId, {
  learnedSkillIds = [],
  ownedPerkSelectors,
  primarySkillId,
  weldBuildId,
}) {
  const index = state.playerEntities.identities.findIndex(
    ({ playerId: id }) => id === playerId,
  )
  assert.notEqual(index, -1)
  const sourceBook = state.playerEntities.skillBooks[index]
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  const learnedSkillOrder = [...sourceBook.learnedSkillOrder]
  for (const skillId of learnedSkillIds) {
    permanentRanks[skillId] = 1
    effectiveRanks[skillId] = 1
    if (!learnedSkillOrder.includes(skillId)) learnedSkillOrder.push(skillId)
  }
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = {
    ...sourceBook,
    effectiveRanks,
    learnedSkillOrder,
    permanentRanks,
    primarySkillId: primarySkillId ?? sourceBook.primarySkillId,
    weldBuildId: weldBuildId ?? sourceBook.weldBuildId,
  }
  const economy = getPlayerEconomy(state, playerId)
  const nextEconomy = ownedPerkSelectors === undefined
    ? economy
    : { ...economy, ownedPerkSelectors }
  Object.assign(state, {
    ...state,
    playerEntities: replacePlayerEconomy({
      ...state.playerEntities,
      skillBooks,
    }, playerId, nextEconomy),
  })
}

function selectConcentration(state, playerId, skillId) {
  const selected = selectGameSimulationPlayerConcentration(state, playerId, skillId)
  assert.ok(selected)
  Object.assign(state, selected)
}

function setPlanewalker(state, playerId, active) {
  const player = state.secondaryAbilities.players[playerId]
  assert.ok(player)
  Object.assign(state, {
    ...state,
    secondaryAbilities: {
      ...state.secondaryAbilities,
      players: {
        ...state.secondaryAbilities.players,
        [playerId]: {
          ...player,
          planewalkerTicksRemaining: active ? 10_000 : 0,
        },
      },
    },
  })
}

function setPlayerHealthRatio(state, playerId, ratio) {
  const index = state.playerEntities.identities.findIndex(
    ({ playerId: id }) => id === playerId,
  )
  assert.notEqual(index, -1)
  const current = state.playerEntities.progressions[index]
  assert.ok(current)
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...current,
    currentHealth: current.maximumHealth * ratio,
  }
  Object.assign(state, {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      progressions,
    },
  })
}

function setVitalLayers(state, playerId) {
  const player = state.secondaryAbilities.players[playerId]
  assert.ok(player)
  Object.assign(state, {
    ...state,
    secondaryAbilities: {
      ...state.secondaryAbilities,
      players: {
        ...state.secondaryAbilities.players,
        [playerId]: {
          ...player,
          firewalker: true,
          magicShieldAbsorb: 25,
          magicShieldMaximum: 50,
          reservedMana: 50,
        },
      },
    },
  })
}

async function measureHud(page) {
  return page.locator('.hub-hud').evaluate((hud) => {
    const rect = (selector) => {
      const element = hud.querySelector(selector)
      if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`)
      const bounds = element.getBoundingClientRect()
      return {
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        width: bounds.width,
      }
    }
    const bindings = [...hud.querySelectorAll('.hub-hud-selected-skill')]
      .map((element) => {
        if (!(element instanceof HTMLElement)) throw new Error('Missing selected skill icon')
        const bounds = element.getBoundingClientRect()
        return {
          binding: Number(element.getAttribute('data-binding')),
          centerX: (bounds.left + bounds.right) / 2,
          record: Number(element.getAttribute('data-record')),
        }
      })
    const optionalRect = (selector) => {
      const element = hud.querySelector(selector)
      if (!(element instanceof HTMLElement)) return null
      const bounds = element.getBoundingClientRect()
      return {
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        width: bounds.width,
      }
    }
    const shield = hud.querySelector('.hub-hud-meter-shield')
    const healthFill = hud.querySelector(
      '.hub-hud-meter-health .hub-hud-meter-fill:not(.hub-hud-meter-shield)',
    )
    if (!(healthFill instanceof HTMLElement)) throw new Error('Missing local health fill')
    const healthFillBounds = healthFill.getBoundingClientRect()
    const healthClip = getComputedStyle(healthFill).clipPath
    const healthRightInset = /^inset\(0px ([\d.]+)% 0px 0px\)$/.exec(healthClip)
    if (!healthRightInset) throw new Error(`Unexpected local health clip: ${healthClip}`)
    const healthLabel = /^Health ([\d.]+) of ([\d.]+)$/.exec(
      healthFill.getAttribute('alt') ?? '',
    )
    if (!healthLabel) throw new Error(`Unexpected local health label: ${healthFill.getAttribute('alt')}`)
    const healthRightInsetPercent = Number(healthRightInset[1])
    const healthVisibleWidth = healthFillBounds.width
      * (1 - healthRightInsetPercent / 100)
    return {
      bindings,
      health: rect('.hub-hud-meter-health'),
      healthClip,
      healthCurrent: Number(healthLabel[1]),
      healthCore: rect(
        '.hub-hud-meter-health .hub-hud-meter-fill:not(.hub-hud-meter-shield)',
      ),
      healthMaximum: Number(healthLabel[2]),
      healthRightInsetPercent,
      healthVisible: {
        left: healthFillBounds.left,
        right: healthFillBounds.left + healthVisibleWidth,
        width: healthVisibleWidth,
      },
      mana: rect('.hub-hud-meter-mana'),
      manaCore: rect('.hub-hud-meter-mana .hub-hud-meter-fill'),
      reserve: optionalRect('.hub-hud-mana-reserve'),
      shield: optionalRect('.hub-hud-meter-shield'),
      shieldClip: shield instanceof HTMLElement ? getComputedStyle(shield).clipPath : null,
    }
  })
}

async function waitForLocalHealthDamage(page) {
  await page.waitForFunction(() => {
    const fill = document.querySelector(
      '.hub-hud-meter-health .hub-hud-meter-fill:not(.hub-hud-meter-shield)',
    )
    return fill instanceof HTMLElement
      && getComputedStyle(fill).clipPath !== 'inset(0px 0% 0px 0px)'
  }, undefined, { timeout: 10_000 })
}

function assertLocalHealthRetractsFromRight(hud) {
  const healthRatio = Math.min(1, Math.max(0, hud.healthCurrent / hud.healthMaximum))
  const expectedVisibleWidth = hud.healthCore.width * healthRatio ** 2
  assert.ok(hud.healthRightInsetPercent > 70 && hud.healthRightInsetPercent < 80)
  assert.equal(hud.healthVisible.left, hud.healthCore.left)
  assert.ok(Math.abs(hud.healthVisible.width - expectedVisibleWidth) < 0.001)
  assert.ok(Math.abs(
    hud.healthVisible.right - (hud.healthCore.left + expectedVisibleWidth)
  ) < 0.001)
  assert.ok(hud.healthVisible.right < hud.healthCore.right)
}
