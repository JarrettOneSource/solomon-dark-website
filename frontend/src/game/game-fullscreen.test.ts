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

function cssRule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'))?.[1] ?? ''
}

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

test('the exact game route owns one persistent browser interaction surface', () => {
  const shell = readFileSync(new URL('../components/Shell.tsx', import.meta.url), 'utf8')
  assert.match(shell, /import ['"]\.\.\/game\/game-surface\.css['"]/)
  assert.match(
    shell,
    /if \(game\)[\s\S]*?<main[\s\S]*?className="game-surface h-dvh overflow-clip"[\s\S]*?onContextMenu=\{\(event\) => event\.preventDefault\(\)\}[\s\S]*?onDragStart=\{\(event\) => event\.preventDefault\(\)\}/,
  )
  assert.equal(shell.match(/className="game-surface /g)?.length, 1)
})

test('the game surface closes browser defaults without disabling accessibility zoom', () => {
  const styles = readFileSync(new URL('./game-surface.css', import.meta.url), 'utf8')
  const rule = cssRule(styles, '.game-surface')
  assert.match(rule, /-webkit-tap-highlight-color:\s*transparent;/)
  assert.match(rule, /-webkit-touch-callout:\s*none;/)
  assert.match(rule, /-webkit-user-select:\s*none;/)
  assert.match(rule, /overscroll-behavior:\s*none;/)
  assert.match(rule, /touch-action:\s*manipulation;/)
  assert.match(rule, /(?:^|\s)user-select:\s*none;/)

  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  assert.doesNotMatch(html, /(?:maximum-scale|user-scalable)\s*=/i)
})

test('joysticks cancel their own pointer default and retain exclusive direct manipulation', () => {
  const joystick = readFileSync(new URL('./input/TouchJoystick.tsx', import.meta.url), 'utf8')
  const pointerDown = joystick.match(/onPointerDown=\{\(event\) => \{([\s\S]*?)\n\s*\}\}/)?.[1] ?? ''
  assert.match(pointerDown, /event\.preventDefault\(\)/)

  const styles = readFileSync(new URL('./input/touch-joystick.css', import.meta.url), 'utf8')
  assert.match(cssRule(styles, '.game-touch-joystick'), /touch-action:\s*none;/)
})

test('selection policy is not duplicated by transient scenes', () => {
  for (const path of [
    './main-menu.css',
    './hub.css',
    './boneyard.css',
    './match-loading-screen.css',
  ]) {
    const styles = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.doesNotMatch(styles, /(?:^|\s)user-select\s*:/m)
  }
})
