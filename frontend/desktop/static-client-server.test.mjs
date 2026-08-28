import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { startStaticClientServer } from './static-client-server.mjs'

test('desktop static server is loopback-only, SPA-aware, and hardened', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'solomon-desktop-static-'))
  context.after(() => rm(root, { force: true, recursive: true }))
  await mkdir(join(root, 'assets'))
  await writeFile(join(root, 'index.html'), '<!doctype html><title>Solomon Dark</title>')
  await writeFile(join(root, 'assets', 'game.js'), 'export const ready = true')
  const server = await startStaticClientServer({ root })
  context.after(() => server.close())

  assert.match(server.origin, /^http:\/\/127\.0\.0\.1:\d+$/)
  const game = await fetch(`${server.origin}/game`)
  assert.equal(game.status, 200)
  assert.match(await game.text(), /Solomon Dark/)
  const contentSecurityPolicy = game.headers.get('content-security-policy') ?? ''
  assert.match(contentSecurityPolicy, /object-src 'none'/)
  assert.match(contentSecurityPolicy, /font-src 'self' data:/)
  assert.match(contentSecurityPolicy, /img-src 'self' data: blob:/)
  assert.doesNotMatch(contentSecurityPolicy, /unsafe-eval/)
  assert.equal(game.headers.get('cache-control'), 'no-store')

  const asset = await fetch(`${server.origin}/assets/game.js`)
  assert.equal(asset.status, 200)
  assert.equal(asset.headers.get('content-type'), 'text/javascript; charset=utf-8')
  assert.match(asset.headers.get('cache-control') ?? '', /immutable/)
  assert.equal(await asset.text(), 'export const ready = true')

  const missingAsset = await fetch(`${server.origin}/assets/missing.js`)
  assert.equal(missingAsset.status, 404)
  const health = await fetch(`${server.origin}/__desktop/health`)
  assert.deepEqual(await health.json(), { status: 'ok' })
  const rejectedPost = await fetch(`${server.origin}/__desktop/health`, { method: 'POST' })
  assert.equal(rejectedPost.status, 405)
})

test('desktop static server rejects non-loopback binding', async () => {
  await assert.rejects(
    startStaticClientServer({ root: '.', host: '0.0.0.0' }),
    /must bind to loopback/,
  )
})
