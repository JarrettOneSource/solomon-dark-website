import assert from 'node:assert/strict'
import test from 'node:test'

import {
  deploymentRevisionFromResponse,
  shouldReloadForDeployment,
  waitForDeploymentRevision,
} from './deployment-revision.ts'

test('deployment revision reloads only for an exact changed or announced commit', async () => {
  const current = '1'.repeat(40)
  const target = '2'.repeat(40)
  const response = new Response(JSON.stringify({ revision: target }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  })

  assert.equal(await deploymentRevisionFromResponse(response), target)
  assert.equal(shouldReloadForDeployment(current, target, null), true)
  assert.equal(shouldReloadForDeployment(current, current, null), false)
  assert.equal(shouldReloadForDeployment(current, target, target), true)
  assert.equal(shouldReloadForDeployment(current, current, target), false)
})

test('deployment revision rejects malformed or cache-fallback responses', async () => {
  assert.equal(await deploymentRevisionFromResponse(new Response('{}')), null)
  assert.equal(await deploymentRevisionFromResponse(new Response(
    JSON.stringify({ revision: 'main' }),
  )), null)
  assert.equal(await deploymentRevisionFromResponse(new Response('', { status: 503 })), null)
})

test('watcher returns the validated target for the shared reload guard', async (t) => {
  const revision = '2'.repeat(40)
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ revision })))
  assert.equal(await waitForDeploymentRevision({
    currentRevision: '1'.repeat(40), targetRevision: revision, intervalMs: 500,
    signal: new AbortController().signal,
  }), revision)
})

test('cancelled deployment watcher does not claim a reload', async (t) => {
  const controller = new AbortController()
  t.mock.method(globalThis, 'fetch', async () => {
    controller.abort()
    throw new TypeError('Failed to fetch')
  })
  assert.equal(await waitForDeploymentRevision({
    currentRevision: '1'.repeat(40), targetRevision: null, intervalMs: 500,
    signal: controller.signal,
  }), null)
})
