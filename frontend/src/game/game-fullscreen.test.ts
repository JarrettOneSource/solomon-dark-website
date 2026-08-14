import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  GAME_FULLSCREEN_CHANGE_EVENTS,
  gameFullscreenActive,
  gameFullscreenControlMode,
  gameFullscreenSupported,
  gameInstalledDisplayMode,
  toggleGameFullscreen,
  type GameFullscreenDocument,
} from './game-fullscreen.ts'

function standardFullscreenHarness(enabled = true) {
  let requestedOptions: FullscreenOptions | undefined
  const target = {
    async requestFullscreen(options?: FullscreenOptions) {
      requestedOptions = options
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
  return { document, requestedOptions: () => requestedOptions, target }
}

function webkitFullscreenHarness(enabled = true) {
  const target = {
    webkitRequestFullscreen() {
      document.webkitFullscreenElement = target
    },
  }
  const document = {
    documentElement: target,
    webkitFullscreenElement: null,
    webkitFullscreenEnabled: enabled,
    webkitExitFullscreen() {
      document.webkitFullscreenElement = null
    },
  } as unknown as GameFullscreenDocument & { webkitFullscreenElement: typeof target | null }
  return { document, target }
}

test('fullscreen support requires the standard document and element operations', () => {
  const { document } = standardFullscreenHarness()
  assert.equal(gameFullscreenSupported(document), true)
  document.fullscreenEnabled = false
  assert.equal(gameFullscreenSupported(document), false)
})

test('the persistent game document requests hidden navigation UI and exits without scene state', async () => {
  const { document, requestedOptions, target } = standardFullscreenHarness()
  assert.equal(gameFullscreenActive(document), false)
  await toggleGameFullscreen(document)
  assert.deepEqual(requestedOptions(), { navigationUI: 'hide' })
  assert.equal(document.fullscreenElement, target)
  assert.equal(gameFullscreenActive(document), true)
  await toggleGameFullscreen(document)
  assert.equal(document.fullscreenElement, null)
  assert.equal(gameFullscreenActive(document), false)
})

test('legacy WebKit fullscreen uses one coherent entry, state, event, and exit path', async () => {
  const { document, target } = webkitFullscreenHarness()
  assert.equal(gameFullscreenSupported(document), true)
  assert.equal(gameFullscreenActive(document), false)
  await toggleGameFullscreen(document)
  assert.equal(document.webkitFullscreenElement, target)
  assert.equal(gameFullscreenActive(document), true)
  await toggleGameFullscreen(document)
  assert.equal(document.webkitFullscreenElement, null)
  assert.deepEqual(GAME_FULLSCREEN_CHANGE_EVENTS, [
    'fullscreenchange',
    'webkitfullscreenchange',
  ])
})

test('an unsupported document rejects instead of pretending fullscreen changed', async () => {
  const { document } = standardFullscreenHarness(false)
  await assert.rejects(toggleGameFullscreen(document), /not available/i)
  assert.equal(document.fullscreenElement, null)
})

test('unsupported browser mode offers install guidance unless already app-like', () => {
  const { document: supported } = standardFullscreenHarness()
  const { document: unsupported } = standardFullscreenHarness(false)
  assert.equal(gameFullscreenControlMode(supported, false), 'fullscreen')
  assert.equal(gameFullscreenControlMode(supported, true), 'fullscreen')
  assert.equal(gameFullscreenControlMode(unsupported, false), 'install')
  assert.equal(gameFullscreenControlMode(unsupported, true), 'hidden')
})

test('installed display mode recognizes manifest and Apple Home Screen launches', () => {
  const displayWindow = (
    activeMode: 'browser' | 'fullscreen' | 'standalone',
    appleStandalone = false,
  ) => ({
    matchMedia: (query: string) => ({ matches: query === `(display-mode: ${activeMode})` }),
    navigator: { standalone: appleStandalone },
  })
  assert.equal(gameInstalledDisplayMode(displayWindow('browser')), false)
  assert.equal(gameInstalledDisplayMode(displayWindow('standalone')), true)
  assert.equal(gameInstalledDisplayMode(displayWindow('fullscreen')), true)
  assert.equal(gameInstalledDisplayMode(displayWindow('browser', true)), true)
})

test('the install path launches the landscape game as a fullscreen web app', () => {
  const manifest = JSON.parse(readFileSync(
    new URL('../../public/game.webmanifest', import.meta.url),
    'utf8',
  )) as Record<string, unknown>
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  assert.equal(manifest.id, '/game')
  assert.equal(manifest.start_url, '/game')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.display, 'fullscreen')
  assert.equal(manifest.orientation, 'landscape')
  assert.match(html, /<link rel="manifest" href="\/game\.webmanifest" \/>/)
})
