import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { STOCK_WIZARD_NAMES } from '../src/game/create-wizard-name.ts'
import { damagePlayerEntity } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { restoreGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { enterBoneyard, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_NAME_OUTPUT || '/tmp/solomon-create-wizard-name'
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const receipts = []
try {
  for (const account of [null, 'CloudTester']) receipts.push(await journey(account))
  await writeFile(`${output}/receipt.json`, JSON.stringify({ browser: browser.version(), receipts }, null, 2))
  console.log(JSON.stringify({ browser: browser.version(), receipts }))
} finally {
  await browser.close()
  await server.close()
}

async function journey(account) {
  const label = account ? 'signed-in' : 'anonymous'
  const credential = randomBytes(24).toString('base64url')
  const errors = { page: [], console: [], responses: [], host: [], unexpectedApi: [] }
  const host = await startGameHost({
    allowedOrigins: [server.origin], authentication: { kind: 'shared', credential },
    createBoneyardSeedBytes: () => Buffer.alloc(16), snapshotRate: 20,
    log: row => { if (row.level === 'error') errors.host.push(row) },
  })
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  const page = await context.newPage()
  let cloudSave = null
  let peer = null
  const sent = []
  try {
    await page.addInitScript(({ account, endpoint }) => {
      if (account) localStorage.setItem('sdr.token', 'local-browser-fixture')
      window.solomonDarkRuntime = { gameEndpoint: endpoint }
    }, { account, endpoint: { kind: 'localhost', url: host.address.url, credential } })
    await page.route('**/deployment.json*', route => route.fulfill({
      json: { revision: new URL(route.request().url()).searchParams.get('current') },
    }))
    // Fixture account data is confined to this local browser context. There are
    // no real account logins, profile writes, cloud saves or production calls.
    await page.route('**/api/**', async route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (path === '/api/auth/me') return route.fulfill({ json: {
        user: { id: 1, username: account, school: null, developerAccess: false,
          createdAtUtc: '2026-01-01T00:00:00Z' }, modCount: 0, saveCount: 0,
      } })
      if (path === '/api/mods/active') return route.fulfill({
        json: { disabledMods: [], mods: [], manifestSha256: '0'.repeat(64) },
      })
      if (path === '/api/game/saves/0') {
        if (request.method() === 'PUT') {
          const body = request.postDataJSON()
          cloudSave = { slot: 0, revision: body.expectedRevision + 1, document: body.document }
          return route.fulfill({ json: cloudSave })
        }
        return route.fulfill({ json: { save: cloudSave } })
      }
      if (['/api/mods', '/api/game/parties', '/api/game/players'].includes(path)) {
        return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 50 } })
      }
      errors.unexpectedApi.push(`${request.method()} ${path}`)
      return route.fulfill({ status: 501, json: { error: 'Unconfigured fixture route' } })
    })
    page.on('pageerror', error => errors.page.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
    page.on('response', response => {
      if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`)
    })
    page.on('websocket', socket => socket.on('framesent', ({ payload }) => {
      const message = JSON.parse(String(payload))
      if (['client-hello', 'client-confirm-loadout'].includes(message.type)) sent.push(message)
    }))

    await page.goto(`${server.origin}/game`)
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
    const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
    if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: /^new game$/i }).click()
    await waitForCreate(page)
    const input = page.getByRole('textbox', { name: 'Wizard name', exact: true })
    const initial = await input.inputValue()
    if (account) assert.equal(initial, account)
    else assert.ok(STOCK_WIZARD_NAMES.includes(initial))
    await input.fill('FirstMage')
    await choose(page, 'fire', 'arcane')
    assert.equal(await input.evaluate(node => node.readOnly), true)
    await waitForHub(page)
    const playerId = host.hostPlayerId()
    assert.ok(playerId)
    assert.equal(config().displayName, 'FirstMage')
    assert.equal(sent.find(row => row.type === 'client-hello').character.displayName, 'FirstMage')
    assert.equal(sent.find(row => row.type === 'client-hello').profile.accountUsername, account)
    if (account) peer = await createPeer(host, credential, errors)

    await nextWizard()
    const before = await input.evaluate(node => ({
      value: node.value, readOnly: node.readOnly,
      selectionColor: getComputedStyle(node, '::selection').color,
      selectionBackground: getComputedStyle(node, '::selection').backgroundColor,
    }))
    await input.click()
    await input.press('ControlOrMeta+A')
    await input.pressSequentially('NextMage')
    const afterTyping = await input.inputValue()
    await page.screenshot({ path: `${output}/${label}-post-run.png` })
    assert.equal(before.readOnly, false, 'the next wizard must remain editable on a retained connection')
    assert.equal(afterTyping, 'NextMage')
    assert.equal(before.selectionColor, 'rgba(0, 0, 0, 0)')
    assert.equal(before.selectionBackground, 'rgba(0, 0, 0, 0)')
    await input.fill('A'.repeat(11))
    await input.press('End')
    await input.pressSequentially('A-')
    assert.equal(await input.inputValue(), 'A'.repeat(11), 'native width and glyph restrictions remain enforced')
    await page.getByRole('button', { name: 'Clear wizard name', exact: true }).click()
    assert.equal(await input.inputValue(), '')
    await page.getByRole('button', { name: 'Randomize wizard name', exact: true }).click()
    assert.ok(STOCK_WIZARD_NAMES.includes(await input.inputValue()))
    await input.fill('NextMage')
    await page.getByRole('button', { name: 'water', exact: true }).click()
    await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 30_000 })
    await input.press('End')
    await input.pressSequentially('2')
    assert.equal(await input.inputValue(), 'NextMage2')
    await page.waitForTimeout(300)
    assert.equal(await input.inputValue(), 'NextMage2', 'host snapshots must not overwrite the draft')
    await page.getByRole('button', { name: 'mind', exact: true }).click()
    assert.equal(await input.evaluate(node => node.readOnly), true, 'finalization freezes the selected name')
    if (peer) {
      await waitUntil(() => host.state().run.loadoutReadyPlayerIds.includes(playerId),
        'the first player did not enter the ready barrier', 10_000)
      assert.equal(await input.evaluate(node => node.readOnly), true)
      await input.pressSequentially('LateEdit')
      assert.equal(await input.inputValue(), 'NextMage2')
      assert.equal(await page.getByRole('button', { name: 'Clear wizard name', exact: true }).isDisabled(), true)
      assert.equal(await page.getByRole('button', { name: 'Randomize wizard name', exact: true }).isDisabled(), true)
      const peerInput = peer.page.getByRole('textbox', { name: 'Wizard name', exact: true })
      assert.equal(await peerInput.inputValue(), 'PeerMage')
      assert.equal(await peerInput.evaluate(node => node.readOnly), false)
      await peerInput.fill('PeerNew')
      await choose(peer.page, 'air', 'body')
      await waitForHub(peer.page)
    }
    await waitForHub(page)
    assert.equal(config().displayName, 'NextMage2')
    assert.equal(config().element, 'water')
    assert.equal(config().discipline, 'mind')
    if (peer) assert.equal(host.state().playerEntities.configs.find(row => row.displayName === 'PeerNew')?.element, 'air')
    const confirmation = sent.filter(row => row.type === 'client-confirm-loadout')
    assert.equal(confirmation.length, 1)
    assert.equal(confirmation[0].displayName, 'NextMage2')

    console.log(JSON.stringify({ label, stage: 'name-confirmed', name: config().displayName }))
    let stored
    const checkpointDeadline = Date.now() + 10_000
    do {
      stored = account ? cloudSave?.document : await readLocalSave(page)
      if (stored && restoreGameSaveDocument(stored).state.playerEntities.configs[0].displayName === 'NextMage2') break
      await page.waitForTimeout(50)
    } while (Date.now() < checkpointDeadline)
    assert.ok(stored, 'the selected save store must receive the confirmed name')
    const restored = restoreGameSaveDocument(stored)
    assert.equal(restored.state.playerEntities.configs[0].displayName, 'NextMage2')
    await nextWizard()
    const repeatedEntryName = await input.inputValue()
    assert.equal(repeatedEntryName, 'NextMage2', 'later Create must seed the last committed name')
    assert.equal(await input.evaluate(node => node.readOnly), false)
    await page.getByRole('button', { name: 'Clear wizard name', exact: true }).click()
    assert.equal(await input.inputValue(), '')
    await choose(page, 'earth', 'arcane')
    if (peer) {
      await waitUntil(() => host.state().run.loadoutReadyPlayerIds.includes(playerId),
        'empty-name default did not reach the peer barrier', 10_000)
      await choose(peer.page, 'ether', 'arcane')
      await waitForHub(peer.page)
    }
    await waitForHub(page)
    assert.equal(config().displayName, 'Genericus')
    assert.equal(sent.filter(row => row.type === 'client-confirm-loadout').length, 2)
    assert.equal(sent.at(-1).displayName, 'Genericus')
    if (account) assert.equal((await page.evaluate(() => fetch('/api/auth/me').then(r => r.json()))).user.username, account)
    for (const rows of Object.values(errors)) assert.deepEqual(rows, [])
    return { label, initial, before, afterTyping, savedName: 'NextMage2', repeatedEntryName, emptyNameFallback: config().displayName,
      peerWaitingVerified: peer !== null, sent: sent.map(safeMessage), errors }
  } catch (error) {
    await page.screenshot({ path: `${output}/${label}-failure.png` }).catch(() => {})
    console.error(JSON.stringify({ label, errors, sent: sent.map(safeMessage), body: (await page.locator('body').innerText()).slice(0, 2000) }))
    throw error
  } finally {
    await peer?.context.close()
    await context.close()
    await host.close()
  }

  function config() {
    const state = host.state()
    return state.playerEntities.configs[state.playerEntities.identities.findIndex(row => row.playerId === host.hostPlayerId())]
  }

  async function nextWizard() {
    await enterBoneyard(page)
    await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 30_000 })
    const state = host.state()
    // End the run through the production damage/death/lifecycle owners. No
    // loadout flags, UI props, names or selection gates are overwritten.
    let playerEntities = state.playerEntities
    for (const { playerId } of playerEntities.identities) {
      playerEntities = damagePlayerEntity(playerEntities, playerId, 100_000, state.tick)
    }
    Object.assign(state, { playerEntities })
    await waitUntil(() => host.state().run.phase === 'game-over'
      && host.state().run.gameOverTicks >= 500, 'Game Over did not become dismissible', 30_000)
    await page.getByRole('button', { name: /^Game over\./ }).click()
    await waitForCreate(page)
    if (peer) await waitForCreate(peer.page)
    assert.equal(await page.locator('.create-menu-scene').getAttribute('data-retained-loadout'), 'true')
  }
}

async function createPeer(host, credential, errors) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  try {
    await page.addInitScript(endpoint => { window.solomonDarkRuntime = { gameEndpoint: endpoint } }, {
      kind: 'localhost', credential, url: host.address.url,
    })
    page.on('pageerror', error => errors.page.push(`peer: ${error.message}`))
    page.on('console', message => { if (message.type() === 'error') errors.console.push(`peer: ${message.text()}`) })
    page.on('response', response => {
      if (response.status() >= 400) errors.responses.push(`peer: ${response.status()} ${response.url()}`)
    })
    await page.route('**/deployment.json*', route => route.fulfill({
      json: { revision: new URL(route.request().url()).searchParams.get('current') },
    }))
    await page.goto(`${server.origin}/game`)
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
    const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
    if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: /^new game$/i }).click()
    await waitForCreate(page)
    await page.getByRole('textbox', { name: 'Wizard name', exact: true }).fill('PeerMage')
    await choose(page, 'earth', 'body')
    await waitForHub(page)
    return { context, page }
  } catch (error) {
    await context.close()
    throw error
  }
}

async function readLocalSave(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('Local checkpoint read timed out')), 5000)
    const request = indexedDB.open('solomon-dark-game-saves', 1)
    request.onerror = () => { clearTimeout(deadline); reject(request.error) }
    request.onblocked = () => { clearTimeout(deadline); reject(new Error('Local checkpoint read blocked')) }
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('slots')) {
        clearTimeout(deadline); db.close(); resolve(null); return
      }
      const read = db.transaction('slots').objectStore('slots').get(0)
      read.onsuccess = () => { clearTimeout(deadline); resolve(read.result?.document); db.close() }
      read.onerror = () => { clearTimeout(deadline); reject(read.error); db.close() }
    }
  }))
}

async function waitForCreate(page) {
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 90_000 })
}

async function waitForHub(page) {
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.locator('.match-loading-screen').waitFor({ state: 'detached', timeout: 90_000 })
}

async function choose(page, element, discipline) {
  await page.getByRole('button', { name: element, exact: true }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: discipline, exact: true }).click()
}

function safeMessage(message) {
  return message.type === 'client-hello'
    ? { type: message.type, character: message.character, accountUsername: message.profile.accountUsername }
    : message
}
