import assert from 'node:assert/strict'
import test from 'node:test'

import {
  gameFullscreenActive,
  gameFullscreenSupported,
  toggleGameFullscreen,
  type GameFullscreenDocument,
} from './game-fullscreen.ts'

function fullscreenHarness(enabled = true) {
  const target = {
    async requestFullscreen() {
      document.fullscreenElement = target
    },
  }
  const document = {
    documentElement: target,
    fullscreenElement: null,
    fullscreenEnabled: enabled,
    async exitFullscreen() {
      document.fullscreenElement = null
    },
  } as unknown as GameFullscreenDocument & { fullscreenElement: typeof target | null }
  return { document, target }
}

test('fullscreen support requires the standard document and element operations', () => {
  const { document } = fullscreenHarness()
  assert.equal(gameFullscreenSupported(document), true)
  document.fullscreenEnabled = false
  assert.equal(gameFullscreenSupported(document), false)
})

test('the persistent game document enters and exits fullscreen without scene state', async () => {
  const { document, target } = fullscreenHarness()
  assert.equal(gameFullscreenActive(document), false)
  await toggleGameFullscreen(document)
  assert.equal(document.fullscreenElement, target)
  assert.equal(gameFullscreenActive(document), true)
  await toggleGameFullscreen(document)
  assert.equal(document.fullscreenElement, null)
  assert.equal(gameFullscreenActive(document), false)
})

test('an unsupported document rejects instead of pretending fullscreen changed', async () => {
  const { document } = fullscreenHarness(false)
  await assert.rejects(toggleGameFullscreen(document), /not available/i)
  assert.equal(document.fullscreenElement, null)
})
