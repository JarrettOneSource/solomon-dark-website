import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { WebSocket } from 'ws'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { startGameHost } from '../src/game/host/game-host.ts'
import { startGameSocialBroker } from '../src/game/host/game-social-broker.ts'
import { GAME_PROTOCOL_VERSION } from '../src/game/protocol/game-protocol-contract.ts'

// Report 01: transformed bounds and source membership, not just panel fit.
const evidence = process.env.SDR_PLAYER_CARD_EVIDENCE
  || fileURLToPath(new URL('../../.player-card-evidence/', import.meta.url))
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'],
  headless: true,
})
const errors = { page: [], console: [], responses: [], requests: [] }
const receipts = []
await mkdir(evidence, { recursive: true })
try {
  for (const scenario of [
    { name: 'report-air', element: 'air', width: 1349, height: 849, touch: false },
    { name: 'desktop-fire', element: 'fire', width: 1600, height: 900, touch: false },
    { name: 'landscape-water', element: 'water', width: 896, height: 414, touch: true },
    { name: 'short-earth', element: 'earth', width: 896, height: 366, touch: true },
    { name: 'rotation-ether', element: 'ether', width: 844, height: 390, touch: true, rotate: true },
  ]) {
    const credential = randomBytes(32).toString('base64url')
    const socialBroker = startGameSocialBroker()
    const options = {
      allowedOrigins: [server.origin],
      authentication: { kind: 'shared', credential },
      sessionKind: 'private-college',
      snapshotRate: 20,
      socialBroker,
    }
    const host = await startGameHost(options)
    const remoteHost = await startGameHost(options)
    const sockets = []
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      deviceScaleFactor: 2,
      hasTouch: scenario.touch,
      isMobile: scenario.touch,
    })
    try {
      const page = await context.newPage()
      page.on('pageerror', error => errors.page.push(error.message))
      page.on('console', message => {
        if (message.type() === 'error') errors.console.push(message.text())
      })
      page.on('response', response => {
        if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`)
      })
      page.on('requestfailed', request => errors.requests.push(`${request.failure()?.errorText} ${request.url()}`))
      await page.route('**/deployment.json?*', route => route.fulfill({
        json: { revision: new URL(route.request().url()).searchParams.get('current') },
      }))
      await page.addInitScript(runtime => { window.solomonDarkRuntime = runtime }, {
        gameEndpoint: { credential, kind: 'localhost', url: host.address.url },
      })
      await page.goto(`${server.origin}/game`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 240000 })
      const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
      if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
      await page.getByRole('button', { name: 'Play', exact: true }).click()
      await page.getByRole('button', { name: /^New game$/i }).click()
      await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30000 })
      await page.getByRole('textbox', { name: 'Wizard name' }).fill('Soggy')
      await page.getByRole('button', { name: scenario.element, exact: true }).click()
      await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15000 })
      await page.locator('.create-menu-discipline-arcane').click()
      await page.locator('.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 240000 })
      await page.locator('.main-menu-screen-fade-idle').waitFor()
      if (scenario.touch) await page.locator('[data-native-ui-party-chip="header"]').click()
      const member = page.locator('[data-native-ui-party-chip="member"]').first()
      await member.click()
      await inspectCard(page, scenario, 'party-self')
      assert.equal(await page.locator('.hub-player-profile-message').count(), 0)
      if (scenario.rotate) {
        await page.setViewportSize({ width: 390, height: 844 })
        await page.getByText('Rotate your device to landscape to enter the College.', { exact: true }).waitFor()
        await page.locator('.hub-player-profile').waitFor({ state: 'hidden' })
        await page.screenshot({ path: `${evidence}/${scenario.name}-portrait-gate.png`, scale: 'css' })
        await page.setViewportSize({ width: scenario.width, height: scenario.height })
        await inspectCard(page, scenario, 'rotation-restored')
      }
      await page.keyboard.press('Escape')
      await page.locator('.hub-player-profile').waitFor({ state: 'detached' })
      await member.click()
      await inspectCard(page, scenario, 'reopened')
      await page.locator('.hub-player-profile-close').click()
      await page.locator('.hub-player-profile').waitFor({ state: 'detached' })
      if (scenario.touch) await page.locator('[data-native-ui-party-chip="header"]').click()

      if (!scenario.touch) {
        const peer = await rawPlayer(host, 'Peer', scenario.element)
        await page.waitForFunction(id => Boolean(document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.playerScreenPositions[id]), peer.id)
        const canvas = page.locator('.hub-world-canvas')
        const point = await canvas.evaluate((node, id) => {
          const position = node.__sdrHubFrame.playerScreenPositions[id]
          const rect = node.getBoundingClientRect()
          return {
            x: rect.x + position.x * rect.width / Number(node.dataset.viewportWidth),
            y: rect.y + position.y * rect.height / Number(node.dataset.viewportHeight),
          }
        }, peer.id)
        await page.mouse.click(point.x, point.y)
        await inspectCard(page, scenario, 'world-peer')
        await page.getByRole('button', { name: 'Message', exact: true }).click()
        await page.locator('.hub-player-profile').waitFor({ state: 'detached' })
        await closeWhisper(page)
      }

      const remote = await rawPlayer(remoteHost, 'Remote Wizard', scenario.element)
      remote.socket.send(JSON.stringify({ type: 'client-chat', channel: 'global', text: 'Open my remote card' }))
      await page.keyboard.press('t')
      await page.getByRole('tab', { name: /^Global/ }).click()
      const author = page.locator('[data-message-channel="global"]', { hasText: 'Open my remote card' }).locator('.game-chat-player-name')
      await author.click()
      await inspectCard(page, scenario, 'remote-chat')
      await page.getByText('PRIVATE COLLEGE · IN COLLEGE', { exact: true }).waitFor()
      await page.getByText('Registered · r01_registered', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Invite to Party', exact: true }).waitFor()
      await page.locator('.hub-player-profile-stat dd', { hasText: /^26$/ }).waitFor()
      await page.locator('.hub-player-profile-stat dd', { hasText: /^17h 54m$/ }).waitFor()
      await page.getByRole('button', { name: 'Message', exact: true }).click()
      await page.locator('.hub-player-profile').waitFor({ state: 'detached' })
      await closeWhisper(page)
      await memberOpenAndDismiss()
      assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [] })
      console.log(JSON.stringify({ scenario: scenario.name, status: 'passed' }))

      async function memberOpenAndDismiss() {
        if (scenario.touch) await page.locator('[data-native-ui-party-chip="header"]').click()
        await member.click()
        await page.locator('.hub-player-profile').waitFor()
        if (scenario.touch) await page.locator('.game-menu-skull').click()
        else await page.locator('.hub-player-profile-backdrop').click({ position: { x: 2, y: 2 } })
        await page.locator('.hub-player-profile').waitFor({ state: 'detached' })
      }

      async function rawPlayer(owner, displayName, element) {
        const socket = new WebSocket(owner.address.url, { origin: server.origin })
        sockets.push(socket)
        await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
        const welcome = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('raw player welcome timeout')), 10000)
          socket.on('message', data => {
            const message = JSON.parse(data.toString())
            if (message.type === 'server-welcome') { clearTimeout(timer); resolve(message) }
          })
        })
        socket.send(JSON.stringify({
          type: 'client-hello', credential, protocolVersion: GAME_PROTOCOL_VERSION,
          character: { discipline: 'arcane', displayName, element }, cheatsEnabled: false,
          onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
          profile: { accountUsername: owner === remoteHost ? 'r01_registered' : null, highestWave: 26, totalPlaytimeMs: 64440000 },
        }))
        return { id: (await welcome).playerId, socket }
      }
    } finally {
      for (const socket of sockets) socket.close()
      await context.close()
      await remoteHost.close()
      await host.close()
    }
  }
  console.log(JSON.stringify({ status: 'passed', browser: browser.version(), cardChecks: receipts.length, errors }))
} finally {
  await writeFile(`${evidence}/receipt.json`, JSON.stringify({ receipts, errors }, null, 2))
  await browser.close()
  await server.close()
}

async function inspectCard(page, scenario, entry) {
  const card = page.locator('.hub-player-profile')
  await card.waitFor()
  await page.screenshot({ path: `${evidence}/${scenario.name}-${entry}.png`, scale: 'css' })
  const measured = await card.evaluate(node => {
    const rect = element => {
      const { left, top, right, bottom, width, height } = element.getBoundingClientRect()
      return { left, top, right, bottom, width, height }
    }
    const corners = [...node.querySelectorAll('.hub-player-profile-corner')]
    const portraitFrame = node.querySelector('.hub-wizard-portrait-frame')
    return {
      card: rect(node), corners: corners.map(rect),
      records: corners.map(corner => corner.dataset.nativeUiRecord),
      frameRecord: portraitFrame.dataset.nativeUiRecord,
      frame: rect(portraitFrame), portrait: rect(node.querySelector('.hub-wizard-portrait')),
      frameInk: portraitFrame.querySelector('i') ? rect(portraitFrame.querySelector('i')) : null,
      element: node.dataset.profileElement,
    }
  })
  receipts.push({ scenario: scenario.name, entry, ...measured })
  const { card: panel, corners: [left, right] } = measured
  assert.deepEqual(measured.records, ['UI.17', 'UI.17'])
  assert.ok(left.left < panel.left && left.right > panel.left, 'left corner straddles the left panel edge')
  assert.ok(right.left < panel.right && right.right > panel.right, `right corner straddles the right panel edge: ${JSON.stringify(measured)}`)
  assert.ok(Math.abs((panel.left - left.left) - (right.right - panel.right)) < 1, 'corner edge overhangs are symmetric')
  assert.ok(Math.abs(left.top - right.top) < 1)
  assert.equal(measured.frameRecord, 'Skills.14', 'portrait uses only the authored gold frame')
  for (const field of ['left', 'top', 'right', 'bottom']) {
    assert.ok(Math.abs(measured.frameInk[field] - measured.portrait[field]) < 1, `portrait frame ${field} fits`)
  }
  assert.equal(measured.element, scenario.element)
  assert.ok(panel.left >= 0 && panel.right <= scenario.width && panel.top >= 0 && panel.bottom <= scenario.height, 'card fits viewport')
}

async function closeWhisper(page) {
  await page.locator('.game-chat[data-chat-open="true"][data-chat-channel="whisper"]').waitFor()
  await page.getByRole('button', { name: 'Close chat', exact: true }).click()
  await page.locator('.game-chat[data-chat-open="false"]').waitFor()
}
