import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

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
  await page.getByRole('button', { name: /Fire/ }).click()
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
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  process.stdout.write(JSON.stringify({
    status: 'ok',
    before,
    after,
    consoleErrors,
    fixedRobeFrames: [...new Set(presentationSamples.map(({ fixedRobeX }) => fixedRobeX))],
    pageErrors,
    teacherFrames: [...new Set(teacherFrames)],
    walkPoses: [...new Set(presentationSamples.map(({ walkPose }) => walkPose))],
  }) + '\n')
} finally {
  await browser.close()
}
