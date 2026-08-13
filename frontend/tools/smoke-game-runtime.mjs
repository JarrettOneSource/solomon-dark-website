import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const expectedModBoneyard = process.env.SDR_GAME_EXPECT_MOD_BONEYARD?.trim()
const screenshotPath = process.env.SDR_GAME_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-boneyard-smoke.png'
const injectedEndpoint = process.env.SDR_GAME_SMOKE_ENDPOINT?.trim()
const injectedCredential = process.env.SDR_GAME_SMOKE_CREDENTIAL?.trim()
if (Boolean(injectedEndpoint) !== Boolean(injectedCredential)) {
  throw new Error('SDR_GAME_SMOKE_ENDPOINT and SDR_GAME_SMOKE_CREDENTIAL must be set together')
}
const runtime = injectedEndpoint && injectedCredential
  ? {
      gameEndpoint: {
        kind: new URL(injectedEndpoint).protocol === 'wss:' ? 'remote' : 'localhost',
        url: injectedEndpoint,
        credential: injectedCredential,
      },
    }
  : await provisionProductionRuntime()
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const clientPage = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const pageErrors = []
  const consoleErrors = []
  const clientPageErrors = []
  const clientConsoleErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  clientPage.on('pageerror', (error) => clientPageErrors.push(error.message))
  clientPage.on('console', (message) => {
    if (message.type() === 'error') clientConsoleErrors.push(message.text())
  })
  if (runtime) {
    await Promise.all([
      page.addInitScript((configuration) => {
        window.solomonDarkRuntime = configuration
      }, runtime),
      clientPage.addInitScript((configuration) => {
        window.solomonDarkRuntime = configuration
      }, runtime),
    ])
  }

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  try {
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  } catch (error) {
    process.stderr.write(JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2000),
      pageErrors,
      title: await page.title(),
      url: page.url(),
    }) + '\n')
    throw error
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()

  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  try {
    await page.getByLabel(/College courtyard/).waitFor({ timeout: 15_000 })
  } catch (error) {
    process.stderr.write(JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2000),
      consoleErrors,
      pageErrors,
      url: page.url(),
    }) + '\n')
    throw error
  }

  const player = page.getByLabel('Helvidius, fire wizard')
  const before = await player.evaluate((node) => Number.parseFloat(getComputedStyle(node).left))
  const teacherFrame = page.locator('.hub-teacher-frame')
  const teacherFrames = []
  for (let sample = 0; sample < 12; sample += 1) {
    teacherFrames.push(await teacherFrame.evaluate((node) => getComputedStyle(node).backgroundPositionX))
    await page.waitForTimeout(50)
  }

  const presentationSamples = []
  await page.keyboard.down('d')
  for (let sample = 0; sample < 14; sample += 1) {
    presentationSamples.push(await player.evaluate((node) => {
      const fixedRobe = node.querySelector('.player-character-robe-fixed')
      const dynamicRobe = node.querySelector('.player-character-robe-dynamic')
      const staffFront = node.querySelector('.player-character-staff-front')
      if (!fixedRobe || !dynamicRobe || !staffFront) throw new Error('player presentation layer missing')
      return {
        dynamicRobeX: getComputedStyle(dynamicRobe).backgroundPositionX,
        fixedRobeX: getComputedStyle(fixedRobe).backgroundPositionX,
        staffFrontX: getComputedStyle(staffFront).backgroundPositionX,
        walkPose: node.dataset.walkPose,
      }
    }))
    await page.waitForTimeout(50)
  }
  await page.keyboard.up('d')
  await page.waitForTimeout(100)
  const after = await player.evaluate((node) => Number.parseFloat(getComputedStyle(node).left))

  assert.ok(after > before, `expected the authoritative player to move right (${before} -> ${after})`)
  assert.ok(new Set(teacherFrames).size > 1, `expected the Teacher's casting frames to animate (${teacherFrames.join(', ')})`)
  assert.ok(new Set(presentationSamples.map(({ walkPose }) => walkPose)).size > 1, 'expected the native robe walk pose to advance')
  assert.ok(new Set(presentationSamples.map(({ fixedRobeX }) => fixedRobeX)).size > 1, 'expected the fixed robe sheet frame to advance')
  assert.deepEqual(new Set(presentationSamples.map(({ dynamicRobeX }) => dynamicRobeX)), new Set(['0px']))
  assert.deepEqual(new Set(presentationSamples.map(({ staffFrontX }) => staffFrontX)), new Set(['0px']))

  await enterHub(clientPage, 'Earth')
  await clientPage.getByText('Waiting for host').waitFor({ timeout: 15_000 })
  assert.equal(await clientPage.getByRole('button', { name: 'Start Match' }).count(), 0)

  await page.getByRole('button', { name: 'Start Match' }).click()
  if (expectedModBoneyard) {
    const picker = page.getByRole('dialog', { name: 'Choose a Boneyard' })
    await picker.waitFor({ timeout: 15_000 })
    await picker.getByRole('button', { name: new RegExp(expectedModBoneyard, 'i') }).click()
  } else {
    assert.equal(await page.getByRole('dialog', { name: 'Choose a Boneyard' }).count(), 0)
  }

  const hostBoneyard = page.locator('.boneyard-scene')
  const clientBoneyard = clientPage.locator('.boneyard-scene')
  await Promise.all([
    hostBoneyard.waitFor({ timeout: 30_000 }),
    clientBoneyard.waitFor({ timeout: 30_000 }),
  ])
  const [hostReceipt, clientReceipt] = await Promise.all([
    boneyardReceipt(hostBoneyard),
    boneyardReceipt(clientBoneyard),
  ])
  assert.equal(hostReceipt.runId, clientReceipt.runId)
  assert.equal(hostReceipt.geometrySha256, clientReceipt.geometrySha256)
  assert.equal(hostReceipt.boneyardId, clientReceipt.boneyardId)
  if (expectedModBoneyard) {
    assert.match(await hostBoneyard.getAttribute('aria-label') || '', new RegExp(expectedModBoneyard, 'i'))
  } else {
    assert.equal(hostReceipt.boneyardId, 'default-random')
  }

  await page.bringToFront()
  const hostDigFrames = await sampleDigFrames(page)
  await clientPage.bringToFront()
  const clientDigFrames = await sampleDigFrames(clientPage)
  assert.ok(new Set(hostDigFrames).size > 1, `expected host Solomon Dig to animate (${hostDigFrames.join(', ')})`)
  assert.ok(new Set(clientDigFrames).size > 1, `expected client Solomon Dig to animate (${clientDigFrames.join(', ')})`)
  assert.equal(await page.getByRole('img', { name: 'Solomon Dig' }).count(), 1)
  assert.equal(await clientPage.getByRole('img', { name: 'Solomon Dig' }).count(), 1)
  await page.screenshot({ path: screenshotPath })

  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(clientConsoleErrors, [])
  assert.deepEqual(clientPageErrors, [])
  process.stdout.write(JSON.stringify({
    status: 'ok',
    before,
    after,
    consoleErrors,
    fixedRobeFrames: [...new Set(presentationSamples.map(({ fixedRobeX }) => fixedRobeX))],
    pageErrors,
    clientConsoleErrors,
    clientPageErrors,
    clientDigFrames: [...new Set(clientDigFrames)],
    hostDigFrames: [...new Set(hostDigFrames)],
    hostReceipt,
    screenshotPath,
    teacherFrames: [...new Set(teacherFrames)],
    walkPoses: [...new Set(presentationSamples.map(({ walkPose }) => walkPose))],
  }) + '\n')
} finally {
  await browser.close()
}

async function provisionProductionRuntime() {
  const origin = new URL(baseUrl)
  if (origin.protocol !== 'https:') return null

  const response = await fetch(new URL('/api/game/sessions', origin), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'x-solomon-dark-session': 'provision',
    },
  })
  const payload = await response.json()
  assert.equal(response.status, 200, JSON.stringify(payload))
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(payload.kind, 'remote')
  assert.equal(new URL(payload.url).protocol, 'wss:')
  assert.equal(typeof payload.credential, 'string')
  return { gameEndpoint: payload }
}

async function enterHub(page, element) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.getByLabel(/College courtyard/).waitFor({ timeout: 15_000 })
}

async function boneyardReceipt(locator) {
  return {
    boneyardId: await locator.getAttribute('data-boneyard-id'),
    geometrySha256: await locator.getAttribute('data-geometry-sha256'),
    runId: await locator.getAttribute('data-run-id'),
  }
}

async function sampleDigFrames(page) {
  const dig = page.getByRole('img', { name: 'Solomon Dig' })
  const frames = []
  for (let sample = 0; sample < 12; sample += 1) {
    frames.push(await dig.getAttribute('data-frame'))
    await page.waitForTimeout(60)
  }
  return frames
}
