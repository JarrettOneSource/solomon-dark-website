import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import { checkLaunchUpdate } from './updates.mjs'

function fixture(responses = [], available = true) {
  const calls = []
  const updater = Object.assign(new EventEmitter(), {
    checkForUpdates: async () => {
      calls.push('check')
      return { isUpdateAvailable: available, updateInfo: { version: '0.2.0' } }
    },
    downloadUpdate: async () => { calls.push('download') },
    quitAndInstall: () => { calls.push('install') },
  })
  return {
    calls, updater,
    options: {
      updater,
      ask: async (options) => {
        calls.push(options.message)
        return { response: responses.shift() ?? 1 }
      },
      beforeInstall: async () => { calls.push('shutdown') },
      report: (message) => calls.push(message),
      timeoutMs: 100,
    },
  }
}

test('every launch checks; declining never downloads or installs on quit', async () => {
  const { calls, updater, options } = fixture([1, 1])
  await checkLaunchUpdate(options)
  await checkLaunchUpdate(options)
  assert.equal(calls.filter(x => x === 'check').length, 2)
  assert.equal(updater.autoDownload, false)
  assert.equal(updater.autoInstallOnAppQuit, false)
  assert.equal(updater.allowDowngrade, false)
  assert.equal(calls.includes('download'), false)
  assert.equal(calls.includes('install'), false)
})

test('download and installation each require consent, and shutdown precedes installation', async () => {
  const { calls, options } = fixture([0, 0])
  await checkLaunchUpdate(options)
  assert.ok(calls.indexOf('download') > calls.indexOf('check'))
  assert.deepEqual(calls.slice(-2), ['shutdown', 'install'])
  const later = fixture([0, 1])
  await checkLaunchUpdate(later.options)
  assert.ok(later.calls.includes('download'))
  assert.equal(later.calls.includes('install'), false)
})

test('offline or unavailable release feed never prevents playing', async () => {
  const { calls, updater, options } = fixture()
  updater.checkForUpdates = async () => { throw new Error('offline') }
  await checkLaunchUpdate(options)
  assert.equal(calls.includes('download'), false)
  assert.ok(calls.some(x => x.includes('offline')))
})

test('a stalled launch check times out without a late prompt', async () => {
  const { calls, updater, options } = fixture()
  let finish
  updater.checkForUpdates = () => new Promise(resolve => { finish = resolve })
  await checkLaunchUpdate({ ...options, timeoutMs: 5 })
  finish({ isUpdateAvailable: true, updateInfo: { version: '0.2.0' } })
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(calls.some(x => x.includes('0.2.0')), false)
})

test('up-to-date launches do not show a redundant update prompt', async () => {
  const { calls, options } = fixture([], false)
  await checkLaunchUpdate(options)
  assert.deepEqual(calls, ['check'])
})
