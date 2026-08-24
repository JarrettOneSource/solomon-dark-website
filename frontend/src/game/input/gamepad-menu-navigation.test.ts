import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  activateMenuBack,
  chooseInitialMenuTarget,
  chooseSpatialTarget,
  readMenuGamepad,
  requiresNeutralAfterMenuScopeChange,
  type SpatialCandidate,
} from './gamepad-menu-navigation.ts'

function button(pressed = false): GamepadButton {
  return { pressed, touched: pressed, value: pressed ? 1 : 0 }
}

function gamepad(
  axes: readonly number[] = [0, 0],
  pressed: readonly number[] = [],
) {
  const buttons = Array.from({ length: 16 }, (_, index) => button(pressed.includes(index)))
  return { axes, buttons, connected: true, index: 0, mapping: 'standard' }
}

test('reads standard confirm, back, d-pad, and stick navigation', () => {
  assert.deepEqual(readMenuGamepad([gamepad([0, 0], [0, 14])]), {
    back: false,
    confirm: true,
    direction: 'left',
    next: false,
    previous: false,
  })
  assert.deepEqual(readMenuGamepad([gamepad([0.8, 0], [1])]), {
    back: true,
    confirm: false,
    direction: 'right',
    next: false,
    previous: false,
  })
  assert.equal(readMenuGamepad([gamepad([0, -0.61])]).direction, null)
  assert.equal(readMenuGamepad([gamepad([0, -0.62])]).direction, 'up')
})

test('ignores disconnected pads and uses the first connected pad', () => {
  const disconnected = { ...gamepad([1, 0]), connected: false }
  assert.equal(readMenuGamepad([disconnected, gamepad([0, 1])]).direction, 'down')
  assert.deepEqual(readMenuGamepad([disconnected]), {
    back: false,
    confirm: false,
    direction: null,
    next: false,
    previous: false,
  })
})

test('accepts activity from a later controller when the first connected pad is idle', () => {
  assert.equal(readMenuGamepad([gamepad(), gamepad([-0.8, 0])]).direction, 'left')
})

test('maps bumpers to previous and next and ignores raw unmapped layouts', () => {
  assert.deepEqual(readMenuGamepad([gamepad([0, 0], [4])]), {
    back: false,
    confirm: false,
    direction: null,
    next: false,
    previous: true,
  })
  assert.deepEqual(readMenuGamepad([gamepad([0, 0], [5])]), {
    back: false,
    confirm: false,
    direction: null,
    next: true,
    previous: false,
  })
  assert.deepEqual(readMenuGamepad([{ ...gamepad([1, 0], [0]), mapping: '' }]), {
    back: false,
    confirm: false,
    direction: null,
    next: false,
    previous: false,
  })
})

test('a fresh modal action survives a neutral sample before the scope appears', () => {
  const neutral = readMenuGamepad([gamepad()])
  const confirm = readMenuGamepad([gamepad([0, 0], [0])])
  const back = readMenuGamepad([gamepad([0, 0], [1])])

  assert.equal(requiresNeutralAfterMenuScopeChange(neutral, back), false)
  assert.equal(requiresNeutralAfterMenuScopeChange(confirm, back), true)
  assert.equal(requiresNeutralAfterMenuScopeChange(confirm, neutral), false)
})

test('spatial navigation favours the nearest candidate in the requested half-plane', () => {
  const candidate = (value: string, left: number, top: number): SpatialCandidate<string> => ({
    value,
    bounds: { left, right: left + 80, top, bottom: top + 40, width: 80, height: 40 },
  })
  const current = candidate('current', 100, 100)
  const candidates = [
    current,
    candidate('right-aligned', 210, 100),
    candidate('right-diagonal', 160, 220),
    candidate('left', 0, 100),
    candidate('above', 100, 20),
  ]
  assert.equal(chooseSpatialTarget(current, candidates, 'right'), 'right-aligned')
  assert.equal(chooseSpatialTarget(current, candidates, 'left'), 'left')
  assert.equal(chooseSpatialTarget(current, candidates, 'up'), 'above')
})

test('initial navigation waits for a declared default instead of falling into another action', () => {
  const back = { id: 'back' }
  const preferred = { id: 'preferred' }
  assert.equal(chooseInitialMenuTarget([back], [preferred]), null)
  assert.equal(chooseInitialMenuTarget([back, preferred], [preferred]), preferred)
  assert.equal(chooseInitialMenuTarget([back], []), back)
})

test('the persistent shell routes gamepad input to gameplay modals without stealing world movement', () => {
  const mainMenu = readFileSync(new URL('../MainMenuScene.tsx', import.meta.url), 'utf8')
  assert.match(mainMenu, /createGamepadMenuNavigation\(\{[\s\S]*enabled:/)
  assert.match(mainMenu, /requireModal:/)
  assert.match(mainMenu, /requireModal:\s*screen === 'hub'/)
  assert.doesNotMatch(mainMenu, /if \(screen === 'hub'/)
})

test('both gameplay scenes feed standard gamepad actions and quickbar selection into shared owners', () => {
  for (const file of ['../HubScene.tsx', '../BoneyardScene.tsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /onGamepadAction:/)
    assert.match(source, /onGamepadPresenceChange:/)
    assert.match(source, /onGamepadQuickbarSelection:/)
    assert.match(source, /controllerQuickbarSlot=\{controllerQuickbarSlot\}/)
  }
})

test('controller modal roots declare explicit back policy and Game Over declares its gated root', () => {
  const dismissible = [
    '../DarkCloudModDetail.tsx',
    '../DarkCloudScene.tsx',
    '../GameSaveModMismatchDialog.tsx',
    '../GameSettingsDialog.tsx',
    '../GameplayPauseMenu.tsx',
    '../HudSkillSelector.tsx',
    '../HubInventoryUi.tsx',
    '../HubScene.tsx',
    '../ModdedPlayDialog.tsx',
    '../PartyJoinConsentDialog.tsx',
    '../PartySettingsDialog.tsx',
    '../SkillBook.tsx',
  ]
  for (const file of dismissible) {
    assert.match(
      readFileSync(new URL(file, import.meta.url), 'utf8'),
      /data-game-back/,
      `${file} must expose a controller back owner`,
    )
  }
  const gameOver = readFileSync(new URL('../GameOverOverlay.tsx', import.meta.url), 'utf8')
  assert.match(gameOver, /data-game-controller-navigation-root="true"/)
  assert.match(gameOver, /disabled=\{!presentation\.acceptsInput\}/)
})

test('the menu skull backs out of the topmost modal through its back owner, else reports no modal', () => {
  // Minimal DOM: matchingElements() consults `instanceof HTMLElement` and isVisible()
  // consults getComputedStyle(); neither exists under node:test.
  const globals = globalThis as Record<string, unknown>
  const previous = { HTMLElement: globals.HTMLElement, getComputedStyle: globals.getComputedStyle }
  globals.HTMLElement = class {}
  globals.getComputedStyle = () => ({ visibility: 'visible' })
  const clicks: string[] = []
  const node = (name: string, { backs = [], modals = [] }: { backs?: unknown[]; modals?: unknown[] } = {}) => ({
    click: () => clicks.push(name),
    getClientRects: () => [{}],
    querySelectorAll: (selector: string) => (selector.includes('data-game-back') ? backs : modals),
  })
  const stage = (modals: unknown[]) => (
    node('stage', { backs: [node('title-back')], modals }) as unknown as ParentNode
  )
  try {
    const picker = node('picker')
    const settings = node('settings', { backs: [node('settings-done')] })
    assert.equal(activateMenuBack(stage([])), 'no-modal')
    assert.equal(activateMenuBack(stage([picker])), 'modal-without-back')
    assert.equal(activateMenuBack(stage([picker, settings])), 'activated')
    assert.deepEqual(clicks, ['settings-done'], 'only the topmost modal\'s back owner is pressed')
  } finally {
    globals.HTMLElement = previous.HTMLElement
    globals.getComputedStyle = previous.getComputedStyle
  }
})
