import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { installGameLuaConsole } from './game-lua-console.ts'
import {
  CAMERA_FOV_MAX_PERCENT,
  CAMERA_FOV_MIN_PERCENT,
  DEFAULT_GAME_CONTROL_BINDINGS,
  DEFAULT_GAME_SETTINGS,
  GAME_BINDING_ACTIONS,
  GAME_SETTINGS_STORAGE_KEY,
  LIGHT_QUALITY_MAX_PERCENT,
  LIGHT_QUALITY_MIN_PERCENT,
  UI_SCALE_MAX_PERCENT,
  UI_SCALE_MIN_PERCENT,
  cameraZoomForFov,
  gameBindingLabel,
  gameLightQuality,
  gameOnlinePreferences,
  gameSharedHubEnabled,
  gameUiScale,
  gameVolume,
  quickbarSlotForBinding,
  readGameSettings,
  rebindGameControl,
  resetGameSettingsListenersForTests,
  setGameSettings,
  type GameSettingsStorage,
} from './game-settings.ts'

class MemoryStorage implements GameSettingsStorage {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

test('complete Settings defaults retain native presentation and enable online extensions', () => {
  resetGameSettingsListenersForTests()
  const storage = new MemoryStorage()
  assert.deepEqual(readGameSettings(storage), DEFAULT_GAME_SETTINGS)
  assert.deepEqual(DEFAULT_GAME_SETTINGS, {
    cameraFovPercent: 100,
    castSecondariesAtMouse: true,
    complexLighting: true,
    complexShadows: true,
    controls: DEFAULT_GAME_CONTROL_BINDINGS,
    enableActivityMessages: true,
    enableCheats: false,
    enableGlobalChat: true,
    enableOnlineFeatures: true,
    enableSharedHub: true,
    lightQualityPercent: 100,
    musicVolumePercent: 100,
    multipleShadows: true,
    soundVolumePercent: 100,
    submitRunsToServer: true,
    uiScalePercent: 100,
    zoomEffects: true,
  })
  assert.deepEqual(GAME_BINDING_ACTIONS, [
    'moveUp', 'moveDown', 'moveLeft', 'moveRight',
    'openMenu', 'openInventory', 'openSkills', 'openChat', 'openCheats',
    'belt1', 'belt2', 'belt3', 'belt4', 'belt5', 'belt6', 'belt7', 'belt8',
  ])
})

test('complete Settings persist exactly and migrate every deployed record shape', () => {
  const storage = new MemoryStorage()
  storage.values.set(GAME_SETTINGS_STORAGE_KEY, '{"enableCheats":true}')
  assert.deepEqual(readGameSettings(storage), {
    ...DEFAULT_GAME_SETTINGS,
    enableCheats: true,
  })

  const changed = {
    ...DEFAULT_GAME_SETTINGS,
    cameraFovPercent: 125,
    complexLighting: false,
    controls: rebindGameControl(DEFAULT_GAME_CONTROL_BINDINGS, 'moveUp', 'ArrowUp'),
    lightQualityPercent: 24,
    musicVolumePercent: 35,
    soundVolumePercent: 70,
    uiScalePercent: 150,
    zoomEffects: false,
  }
  assert.deepEqual(setGameSettings(changed, storage), changed)
  assert.deepEqual(readGameSettings(storage), changed)

  const deployedComplete = Object.fromEntries(Object.entries(changed).filter(([key]) => ![
    'enableActivityMessages',
    'enableGlobalChat',
    'enableOnlineFeatures',
    'enableSharedHub',
    'submitRunsToServer',
  ].includes(key)))
  storage.values.set(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(deployedComplete))
  assert.deepEqual(readGameSettings(storage), changed)

  const deployedBeforeCheatMenu = {
    ...changed,
    controls: Object.fromEntries(Object.entries(changed.controls).filter(([key]) => (
      key !== 'openCheats'
    ))),
  }
  storage.values.set(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(deployedBeforeCheatMenu))
  assert.deepEqual(readGameSettings(storage), changed)

  const backquoteAlreadyUsed = rebindGameControl(
    DEFAULT_GAME_CONTROL_BINDINGS,
    'moveUp',
    'Backquote',
  )
  storage.values.set(GAME_SETTINGS_STORAGE_KEY, JSON.stringify({
    ...changed,
    controls: Object.fromEntries(Object.entries(backquoteAlreadyUsed).filter(([key]) => (
      key !== 'openCheats'
    ))),
  }))
  assert.deepEqual(readGameSettings(storage).controls, {
    ...Object.fromEntries(Object.entries(backquoteAlreadyUsed).filter(([key]) => (
      key !== 'openCheats'
    ))),
    openCheats: 'F1',
  })

  storage.values.set(GAME_SETTINGS_STORAGE_KEY, '{"enableCheats":true,"extra":1}')
  assert.deepEqual(readGameSettings(storage), DEFAULT_GAME_SETTINGS)
  storage.values.set(GAME_SETTINGS_STORAGE_KEY, JSON.stringify({
    ...changed,
    cameraFovPercent: 126,
  }))
  assert.deepEqual(readGameSettings(storage), DEFAULT_GAME_SETTINGS)
})

test('online-feature master and Global gate derive the exact live host preferences', () => {
  assert.deepEqual(gameOnlinePreferences(DEFAULT_GAME_SETTINGS), {
    activityMessages: true,
    globalChat: true,
    submitRuns: true,
  })
  assert.equal(gameSharedHubEnabled(DEFAULT_GAME_SETTINGS), true)

  const noGlobal = { ...DEFAULT_GAME_SETTINGS, enableGlobalChat: false }
  assert.deepEqual(gameOnlinePreferences(noGlobal), {
    activityMessages: false,
    globalChat: false,
    submitRuns: true,
  })
  assert.equal(gameSharedHubEnabled(noGlobal), true)

  const offline = { ...DEFAULT_GAME_SETTINGS, enableOnlineFeatures: false }
  assert.deepEqual(gameOnlinePreferences(offline), {
    activityMessages: false,
    globalChat: false,
    submitRuns: false,
  })
  assert.equal(gameSharedHubEnabled(offline), false)
})

test('FOV, UI scale, volume, and light quality preserve their exact boundaries', () => {
  assert.deepEqual([CAMERA_FOV_MIN_PERCENT, CAMERA_FOV_MAX_PERCENT], [75, 125])
  assert.deepEqual([UI_SCALE_MIN_PERCENT, UI_SCALE_MAX_PERCENT], [75, 150])
  assert.deepEqual([LIGHT_QUALITY_MIN_PERCENT, LIGHT_QUALITY_MAX_PERCENT], [24, 100])
  assert.equal(cameraZoomForFov(1.2, 100), 1.2)
  assert.equal(cameraZoomForFov(1.2, 75), 1.5999999999999999)
  assert.equal(cameraZoomForFov(1.35, 125), 1.08)
  assert.equal(gameUiScale({ uiScalePercent: 75 }), 0.75)
  assert.equal(gameUiScale({ uiScalePercent: 150 }), 1.5)
  assert.equal(gameVolume(35), 0.35)
  assert.equal(gameLightQuality({ lightQualityPercent: 24 }), Math.fround(0.06))
  assert.equal(gameLightQuality({ lightQualityPercent: 100 }), 0.25)
})

test('key rebinding swaps conflicts across fifteen native inputs and two browser extensions', () => {
  assert.equal(DEFAULT_GAME_CONTROL_BINDINGS.belt4, 'Digit3')
  assert.equal(DEFAULT_GAME_CONTROL_BINDINGS.belt5, 'Digit4')
  const rebound = rebindGameControl(DEFAULT_GAME_CONTROL_BINDINGS, 'moveUp', 'KeyI')
  assert.equal(rebound.moveUp, 'KeyI')
  assert.equal(rebound.openInventory, 'KeyW')
  assert.equal(new Set(Object.values(rebound)).size, GAME_BINDING_ACTIONS.length)
  assert.equal(quickbarSlotForBinding(rebound, 'Mouse2'), 0)
  assert.equal(quickbarSlotForBinding(rebound, 'Digit7'), 7)
  assert.equal(quickbarSlotForBinding(rebound, 'KeyQ'), null)
  const chatSwap = rebindGameControl(DEFAULT_GAME_CONTROL_BINDINGS, 'openSkills', 'KeyT')
  assert.equal(chatSwap.openSkills, 'KeyT')
  assert.equal(chatSwap.openChat, 'KeyK')
  const cheatSwap = rebindGameControl(DEFAULT_GAME_CONTROL_BINDINGS, 'openCheats', 'KeyI')
  assert.equal(cheatSwap.openCheats, 'KeyI')
  assert.equal(cheatSwap.openInventory, 'Backquote')
  assert.deepEqual([
    gameBindingLabel('Mouse2'),
    gameBindingLabel('KeyW'),
    gameBindingLabel('Digit7'),
    gameBindingLabel('ArrowLeft'),
  ], ['Right Mouse', 'W', '7', 'Left'])
})

test('Settings uses the untouched stock ControlPanel atlas', () => {
  const atlas = readFileSync(new URL('../assets/game/settings-control-panel-atlas.png', import.meta.url))
  assert.equal(
    createHash('sha256').update(atlas).digest('hex'),
    'd63bd3ac402fcbc00a60916b6f0aa79f662501acc8f6fbe88ee1676e69b43f86',
  )
})

test('browser Lua console installs only for enabled host and rechecks both gates per call', async () => {
  let enabled = true
  let host = true
  const calls: string[] = []
  const session = {
    executeLua: async (code: string) => {
      calls.push(code)
      return { error: null, ok: true, output: ['hello'], values: [42] }
    },
    get isHost() { return host },
  }
  const disabledTarget = {} as Window
  installGameLuaConsole(disabledTarget, session, () => false)
  assert.equal(disabledTarget.solomonDark, undefined)
  host = false
  const guestTarget = {} as Window
  installGameLuaConsole(guestTarget, session, () => true)
  assert.equal(guestTarget.solomonDark, undefined)
  host = true
  const target = {} as Window
  const cleanup = installGameLuaConsole(target, session, () => enabled)
  assert.ok(target.solomonDark)
  assert.match(target.solomonDark.lua.help(), /sd\.runtime/)
  assert.deepEqual(await target.solomonDark.lua.execute('return 42'), {
    error: null,
    ok: true,
    output: ['hello'],
    values: [42],
  })
  assert.deepEqual(calls, ['return 42'])
  enabled = false
  await assert.rejects(target.solomonDark.lua.execute('return 1'), /Enable Cheats is off/)
  enabled = true
  host = false
  await assert.rejects(target.solomonDark.lua.execute('return 1'), /session host/)
  cleanup()
  assert.equal(target.solomonDark, undefined)

  enabled = false
  const developerTarget = {} as Window
  const developerCleanup = installGameLuaConsole(
    developerTarget,
    { ...session, developerAccess: true },
    () => enabled,
  )
  assert.ok(developerTarget.solomonDark)
  assert.equal((await developerTarget.solomonDark.lua.execute('return 7')).ok, true)
  developerCleanup()
})
