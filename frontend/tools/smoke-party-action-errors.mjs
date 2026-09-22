import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { startGameHost } from '../src/game/host/game-host.ts'
import { materializeWebSessionContent } from '../src/game/host/web-mod-content.ts'

// Use the built candidate and an isolated authority; no production API or account.
const evidenceRoot = process.env.SDR_PARTY_ERROR_EVIDENCE_DIR
const content = materializeWebSessionContent({ manifestSha256: '0'.repeat(64), mods: [] })
const tickets = new Set()
const errors = { page: [], console: [], responses: [], requests: [], wire: [] }
const contexts = []
const receipts = []
if (evidenceRoot) await mkdir(evidenceRoot, { recursive: true })
const frontend = await preview({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error', preview: { host: '127.0.0.1', port: 0 },
  root: fileURLToPath(new URL('../', import.meta.url)),
})
const address = frontend.httpServer.address()
assert.ok(address && typeof address !== 'string')
const baseUrl = `http://127.0.0.1:${address.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: {
    kind: 'tickets',
    claim: credential => tickets.delete(credential) ? { content, leaderboardUserId: null } : null,
  },
  luaWasmPath: fileURLToPath(new URL('../node_modules/wasmoon/dist/glue.wasm', import.meta.url)),
  resetWhenEmpty: true, sharedHub: true, snapshotRate: 20,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
try {
  for (const [mode, viewport, hasTouch] of [
    ['desktop', { width: 1600, height: 900 }, false],
    ['touch-landscape', { width: 844, height: 390 }, true],
    ['touch-compact', { width: 667, height: 375 }, true],
  ]) {
    const sender = await enterHub('Soggy', viewport, hasTouch)
    const recipient = await enterHub('Basil', { width: 1600, height: 900 }, false)
    await sender.page.waitForFunction(id => (
      Boolean(document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.playerScreenPositions[id])
    ), recipient.id)
    await invite(sender, recipient.id)
    const invitation = recipient.page.locator('[data-party-invitation]')
    await invitation.waitFor()
    await invite(sender, recipient.id)
    const error = sender.page.locator('[data-native-ui-node="chip:error"]')
    await error.waitFor()
    const collapsed = await measureError(sender.page)
    assert.equal(collapsed.lines.join(' '), 'That invitation is already pending.')
    assert.ok(collapsed.lines.length > 1)
    if (hasTouch) {
      assert.equal(await sender.page.locator('[data-native-ui-party-chip="member"]').count(), 0)
      await sender.page.getByRole('button', { name: 'Party', exact: true }).click()
    }
    const expanded = await measureError(sender.page)
    assert.equal(expanded.rows, 1)
    if (evidenceRoot) await sender.page.screenshot({ path: `${evidenceRoot}/${mode}-complete-error.png` })

    // The sibling menu must retain the same message through open/close.
    await sender.page.getByRole('button', { name: 'Party settings', exact: true }).click()
    const menu = sender.page.locator('[data-native-ui-party-menu]')
    await menu.waitFor()
    assert.equal(await menu.locator('[data-native-ui-node="party:error"]').getAttribute('data-native-ui-text-lines'),
      'That invitation is already pending.')
    await menu.getByRole('button', { name: 'Close', exact: true }).click()
    await menu.waitFor({ state: 'detached' })
    assert.deepEqual(await measureError(sender.page), expanded)
    if (hasTouch) {
      await sender.page.getByRole('button', { name: 'Party', exact: true }).click()
      assert.deepEqual(await measureError(sender.page), collapsed)
      await sender.page.getByRole('button', { name: 'Party', exact: true }).click()
    }

    // Denial retires the first invitation. A new successful invitation clears
    // the sender's error and returns the card and its hit regions to baseline.
    await invitation.getByRole('button', { name: /^deny$/i }).click()
    await invitation.waitFor({ state: 'detached' })
    await invite(sender, recipient.id)
    await invitation.waitFor()
    await error.waitFor({ state: 'detached' })
    const clearedHeight = await sender.page.locator('.native-ui-party-chip').evaluate(node => node.offsetHeight)
    assert.equal(clearedHeight, 98)
    await invitation.getByRole('button', { name: /^accept$/i }).click()
    await sender.page.waitForFunction(() => (
      document.querySelectorAll('[data-native-ui-party-chip="member"]').length === 2
    ))
    receipts.push({ mode, viewport, collapsed, expanded, clearedHeight, acceptedMembers: 2 })
    process.stdout.write(`${JSON.stringify({ mode, status: 'passed' })}\n`)
    await sender.context.close()
    await recipient.context.close()
    contexts.splice(0)
  }
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], wire: [] })
  process.stdout.write(`${JSON.stringify({ status: 'ok', browser: browser.version(), receipts, errors })}\n`)
} catch (error) {
  for (const [index, context] of contexts.entries()) {
    const page = context.pages()[0]
    if (evidenceRoot && page) await page.screenshot({ path: `${evidenceRoot}/failure-${index}.png` })
    if (page) process.stderr.write(`${JSON.stringify({ index, body: await page.locator('body').innerText(), errors })}\n`)
  }
  throw error
} finally {
  await Promise.all(contexts.map(context => context.close()))
  await browser.close()
  await Promise.all([host.close(), frontend.close()])
}

async function enterHub(name, viewport, hasTouch) {
  const context = await browser.newContext({ viewport, hasTouch })
  contexts.push(context)
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => {
    if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`)
  })
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.requests.push(request.url())
  })
  page.on('websocket', socket => socket.on('socketerror', error => errors.wire.push(String(error))))
  await page.route('**/deployment.json*', route => route.fulfill({
    json: { revision: new URL(route.request().url()).searchParams.get('current') },
  }))
  const credential = randomBytes(32).toString('base64url')
  tickets.add(credential)
  await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } }, {
    credential, kind: 'localhost', url: host.address.url,
  })
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  const tutorial = page.locator('[data-prompt-kind="tutorial"] .stock-prompt-dialog')
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'New game', exact: true }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor()
  await page.getByRole('textbox', { name: 'Wizard name' }).fill(name)
  await page.getByRole('button', { name: /Fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  const id = await page.locator('.hub-world-canvas').evaluate(node => node.__sdrHubFrame.localPlayerId)
  return { context, page, id, hasTouch }
}

async function invite(client, targetId) {
  const canvas = client.page.locator('.hub-world-canvas')
  const target = await canvas.evaluate((node, id) => ({
    height: Number(node.dataset.viewportHeight),
    width: Number(node.dataset.viewportWidth),
    position: node.__sdrHubFrame.playerScreenPositions[id],
  }), targetId)
  const bounds = await canvas.boundingBox()
  assert.ok(bounds && target.position)
  const x = bounds.x + target.position.x * bounds.width / target.width
  const y = bounds.y + target.position.y * bounds.height / target.height
  if (client.hasTouch) await client.page.touchscreen.tap(x, y)
  else await client.page.mouse.click(x, y)
  await client.page.getByRole('button', { name: 'Invite to Party', exact: true }).click()
  await client.page.getByRole('button', { name: 'Close', exact: true }).click()
}

async function measureError(page) {
  const result = await page.locator('.native-ui-party-chip').evaluate(card => {
    const error = card.querySelector('[data-native-ui-node="chip:error"]')
    const frame = card.getBoundingClientRect()
    const glyphs = [...error.querySelectorAll('[data-native-ui-glyph]')]
    const rects = glyphs.map(glyph => glyph.getBoundingClientRect())
    const rows = [...card.querySelectorAll('[data-native-ui-party-chip="member"]')]
    return {
      lines: error.dataset.nativeUiTextLines.split('\n'),
      glyphs: glyphs.map(glyph => String.fromCodePoint(Number(glyph.dataset.nativeUiGlyph))).join(''),
      contained: rects.every(rect => rect.left >= frame.left && rect.right <= frame.right
        && rect.top >= frame.top && rect.bottom <= frame.bottom),
      beforeRows: rows.every(row => rects.every(rect => rect.bottom < row.getBoundingClientRect().top)),
      visible: frame.left >= 0 && frame.right <= window.innerWidth && frame.top >= 0 && frame.bottom <= window.innerHeight,
      height: card.offsetHeight,
      rows: rows.length,
    }
  })
  assert.equal(result.glyphs.toLowerCase(), 'thatinvitationisalreadypending.')
  assert.equal(result.contained, true)
  assert.equal(result.beforeRows, true)
  assert.equal(result.visible, true)
  return result
}
