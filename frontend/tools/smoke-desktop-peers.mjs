import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron } from 'playwright-core'
import { startPeerSignaling } from '../desktop/peer-signaling.mjs'

const root = resolve(process.env.SDR_DESKTOP_APP || `dist-desktop/${process.platform === 'darwin'
  ? 'mac-arm64' : process.platform === 'win32' ? 'win-unpacked' : 'linux-unpacked'}`)
const resources = process.platform === 'darwin'
  ? join(root, 'Solomon Darker.app', 'Contents', 'Resources') : join(root, 'resources')
const manifest = JSON.parse(await readFile(join(resources, 'desktop-package-manifest.json'), 'utf8'))
const executablePath = join(root, manifest.executable)
const evidence = resolve('reports/desktop')
await mkdir(evidence, { recursive: true })
const server = await startPeerSignaling({ iceServers: [] })
const clients = []
let signalingClosed = false

try {
  const host = await launch('host')
  await activate(host.page)
  await host.page.getByRole('button', { name: 'Play with friends', exact: true }).click()
  await host.page.getByRole('button', { name: 'Host friends', exact: true }).click()
  const code = host.page.getByLabel('Your invitation code', { exact: true })
  await code.waitFor({ timeout: 15_000 })
  const invitation = await code.inputValue()
  assert.match(invitation, /^[A-Za-z0-9_-]{32}$/)
  await host.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
  console.log('Desktop peer smoke: host minimized before guest admission')
  const guest = await launch('guest')
  console.log('Desktop peer smoke: both title screens ready')

  await activate(guest.page)
  await guest.page.getByRole('button', { name: 'Play with friends', exact: true }).click()
  await guest.page.getByLabel('Join a friend', { exact: true }).fill(invitation)
  await guest.page.getByRole('button', { name: 'Join friend', exact: true }).click()
  await guest.page.getByText('Connected to your friend.', { exact: false }).waitFor({ timeout: 45_000 })
  await host.page.getByText('1 friend(s) connected.', { exact: false }).waitFor({ timeout: 15_000 })
  await host.app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.restore()
    window.show()
  })
  console.log('Desktop peer smoke: encrypted channel connected')
  await activate(host.page)
  await host.page.getByRole('button', { name: 'Done', exact: true }).click()
  await activate(guest.page)
  await guest.page.getByRole('button', { name: 'Done', exact: true }).click()
  await enterCollege(host.page)
  await enterCollege(guest.page)
  console.log('Desktop peer smoke: both players entered the College')

  for (const client of clients) {
    await activate(client.page)
    await client.page.waitForFunction(() => document.querySelector('.hub-world-canvas')?.__sdrHubFrame.playerCount === 2)
  }
  const hostFrame = await frame(host.page)
  const guestFrame = await frame(guest.page)
  assert.notEqual(hostFrame.localPlayerId, guestFrame.localPlayerId)
  assert.deepEqual(Object.keys(hostFrame.playerPositions).sort(), Object.keys(guestFrame.playerPositions).sort())
  const guestId = guestFrame.localPlayerId
  const before = hostFrame.playerPositions[guestId].x
  await moveGuest(guest.page)
  await activate(host.page)
  await host.page.waitForFunction(({ id, before }) =>
    document.querySelector('.hub-world-canvas').__sdrHubFrame.playerPositions[id].x < before - 10,
  { id: guestId, before })

  // Closing introductions cannot stop an already established peer data path.
  await server.close()
  signalingClosed = true
  const afterSignalingClosed = (await frame(host.page)).playerPositions[guestId].x
  await moveGuest(guest.page)
  await activate(host.page)
  await host.page.waitForFunction(({ id, before }) =>
    document.querySelector('.hub-world-canvas').__sdrHubFrame.playerPositions[id].x < before - 10,
  { id: guestId, before: afterSignalingClosed })
  await host.page.screenshot({ path: join(evidence, 'peer-host-college.png') })
  await activate(guest.page)
  await guest.page.screenshot({ path: join(evidence, 'peer-guest-college.png') })
  assert.deepEqual(clients.flatMap(client => client.pageErrors), [])

  await host.app.close()
  host.closed = true
  await guest.page.waitForFunction(() => !document.querySelector('.hub-world-canvas'), { timeout: 20_000 })
  const receipt = { status: 'ok', protocol: 'shared game protocol', peers: 2,
    sharedAuthority: true, guestMovementSeenByHost: true, signalingIndependentGameplay: true,
    hostCloseDisconnectsGuest: true, minimizedHostAdmission: true,
    numericIceFixture: process.env.SDR_DESKTOP_TEST_NUMERIC_ICE === '1', pageErrors: [] }
  await writeFile(join(evidence, 'peer-smoke.json'), `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify(receipt))
} catch (error) {
  for (const client of clients) {
    if (client.closed) continue
    await client.page.screenshot({ path: join(evidence, `${client.name}-failure.png`) }).catch(() => {})
    console.error(JSON.stringify({ name: client.name, pageErrors: client.pageErrors,
      body: (await client.page.locator('body').innerText().catch(() => '')).slice(0, 2200) }))
  }
  throw error
} finally {
  if (!signalingClosed) await server.close()
  for (const client of clients.reverse()) {
    if (!client.closed) await client.app.close()
    await rm(client.userData, { recursive: true, force: true })
  }
}

async function launch(name) {
  console.log(`Desktop peer smoke: launching ${name}`)
  const userData = await mkdtemp(join(tmpdir(), `solomon-peer-${name}-`))
  const app = await electron.launch({
    executablePath,
    args: [
      ...(process.platform === 'linux'
        ? ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--use-gl=angle'] : []),
      // Hosted Mac VMs gathered only mDNS host candidates and never formed an
      // ICE pair. This isolated same-VM fixture has no STUN/TURN or multicast
      // dependency. Production app launches retain Chromium's privacy default.
      ...(process.env.SDR_DESKTOP_TEST_NUMERIC_ICE === '1'
        ? ['--disable-features=WebRtcHideLocalIpsWithMdns'] : []),
    ],
    env: { ...process.env, SDR_DESKTOP_SKIP_UPDATE_CHECK: '1', SDR_DESKTOP_USER_DATA: userData,
      SDR_DESKTOP_SIGNALING_URL: server.url },
  })
  const page = await app.firstWindow({ timeout: 30_000 })
  page.setDefaultTimeout(25_000)
  const client = { name, app, page, userData, pageErrors: [], closed: false }
  clients.push(client)
  page.on('pageerror', error => client.pageErrors.push(error.message))
  page.on('console', message => {
    if (message.text().startsWith('Desktop peer connectivity:')) console.error(`${name}: ${message.text()}`)
  })
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  await page.locator('[data-prompt-kind="tutorial"]').getByRole('button').last().click()
  return client
}

async function enterCollege(page) {
  await activate(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: /^New game$/i }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor()
  await page.getByRole('button', { name: /ether/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-world-canvas').waitFor({ timeout: 40_000 })
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 40_000 })
  await page.waitForFunction(() => document.querySelector('.hub-world-canvas')?.getAttribute('data-transition-phase') === 'none'
    && !document.querySelector('.match-loading-screen'))
}

async function frame(page) {
  await activate(page)
  return page.locator('.hub-world-canvas').evaluate(canvas => {
    const frame = canvas.__sdrHubFrame
    return { localPlayerId: frame.localPlayerId, playerCount: frame.playerCount, playerPositions: frame.playerPositions }
  })
}

async function moveGuest(page) {
  await activate(page)
  const before = (await frame(page)).playerPositions[(await frame(page)).localPlayerId].x
  // Move toward the courtyard interior rather than its eastern Office doorway.
  await page.keyboard.down('a')
  try {
    await page.waitForFunction(before => document.querySelector('.hub-world-canvas')?.__sdrHubFrame.playerX < before - 10,
      before, { timeout: 10_000 })
  } finally {
    await page.keyboard.up('a')
    // Let the ordinary input loop transmit released keys before the fixture
    // minimizes this window to inspect the other client's rendered state.
    await page.waitForTimeout(250)
  }
}

async function activate(page) {
  const client = clients.find(client => client.page === page)
  if (!client) throw new Error('Unknown desktop test window')
  // Two game windows overlap on the hosted Windows desktop. Keep the active
  // test client visible and the other minimized; gameplay/RTC must keep running
  // in that background host, as it would when a real player switches apps.
  for (const other of clients) {
    if (other === client || other.closed) continue
    await other.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
  }
  await client.app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })
  await page.bringToFront()
}
