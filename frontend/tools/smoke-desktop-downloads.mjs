import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'
import { preview } from 'vite'

await mkdir('reports/desktop', { recursive: true })
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } })
const address = server.httpServer.address()
const origin = `http://127.0.0.1:${address.port}`
const browser = await chromium.launch({ channel: 'chrome', headless: true })
let published = false
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  // This UI fixture does not start the unrelated account/mod backend.
  await page.route(`${origin}/api/**`, route => route.fulfill({ status: 503,
    contentType: 'application/json', body: JSON.stringify({ error: 'Backend not part of this UI fixture' }) }))
  await page.route('https://api.github.com/repos/JarrettOneSource/solomon-dark-website/releases/latest', route => route.fulfill({
    status: published ? 200 : 404,
    contentType: 'application/json',
    body: JSON.stringify(published ? {
      tag_name: 'v0.1.0', draft: false, prerelease: false,
      assets: ['Solomon-Darker-Setup-x64.exe', 'Solomon-Darker-arm64.dmg', 'Solomon-Darker-x64.AppImage']
        .map(name => ({ name, size: 1000, state: 'uploaded' })),
    } : { message: 'Not Found' }),
  }))
  await page.goto(origin)
  const homeDownload = page.getByRole('link', { name: 'Download Offline', exact: true })
  await homeDownload.waitFor()
  assert.equal(await homeDownload.getAttribute('href'), '/download')
  await homeDownload.click()
  await page.getByRole('heading', { name: 'The first desktop release is not published yet' }).waitFor()
  await page.screenshot({ path: 'reports/desktop/download-unpublished-fixture.png', fullPage: true })

  published = true
  await page.reload()
  await page.getByRole('region', { name: 'Available desktop installers' }).waitFor()
  const installerLinks = await page.getByRole('region', { name: 'Available desktop installers' }).getByRole('link').evaluateAll(
    links => links.map(link => link.href),
  )
  assert.equal(installerLinks.length, 3)
  assert.ok(installerLinks.every(url => url.startsWith('https://github.com/JarrettOneSource/solomon-dark-website/releases/download/v0.1.0/')))

  await page.goto(`${origin}/game`)
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  await page.locator('[data-prompt-kind="tutorial"]').getByRole('button').last().click()
  const gameDownload = page.getByRole('link', { name: 'Download Offline', exact: true })
  await gameDownload.waitFor()
  assert.equal(await gameDownload.getAttribute('href'), '/download')
  await page.screenshot({ path: 'reports/desktop/game-download-entry.png' })
  await gameDownload.click()
  await page.getByRole('heading', { name: 'Download Offline', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  const receipt = { status: 'ok', homeEntry: true, gameEntry: true,
    unpublishedState: true, catalogFixture: true, canonicalPlatformDownloads: 3 }
  await writeFile('reports/desktop/download-smoke.json', `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify(receipt))
} finally {
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
