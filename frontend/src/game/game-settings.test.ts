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
  gameUiScale,
  gameVolume,
  quickbarSlotForBinding,
  readGameSettings,
  rebindGameControl,
  resetGameSettingsListenersForTests,
  setGameSettings,
  type GameSettingsStorage,
} from './game-settings.ts'

const settingsComponent = readFileSync(new URL('./GameSettingsDialog.tsx', import.meta.url), 'utf8')
const settingsCss = readFileSync(new URL('./main-menu.css', import.meta.url), 'utf8')
const mainMenuScene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const darkCloudScene = readFileSync(new URL('./DarkCloudScene.tsx', import.meta.url), 'utf8')

class MemoryStorage implements GameSettingsStorage {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

test('complete Settings defaults reproduce the shipped capable native profile', () => {
  resetGameSettingsListenersForTests()
  const storage = new MemoryStorage()
  assert.deepEqual(readGameSettings(storage), DEFAULT_GAME_SETTINGS)
  assert.deepEqual(DEFAULT_GAME_SETTINGS, {
    cameraFovPercent: 100,
    castSecondariesAtMouse: true,
    complexLighting: true,
    complexShadows: true,
    controls: DEFAULT_GAME_CONTROL_BINDINGS,
    enableCheats: false,
    lightQualityPercent: 100,
    musicVolumePercent: 100,
    multipleShadows: true,
    soundVolumePercent: 100,
    uiScalePercent: 100,
    zoomEffects: true,
  })
  assert.deepEqual(GAME_BINDING_ACTIONS, [
    'moveUp', 'moveDown', 'moveLeft', 'moveRight',
    'openMenu', 'openInventory', 'openSkills', 'openChat',
    'belt1', 'belt2', 'belt3', 'belt4', 'belt5', 'belt6', 'belt7', 'belt8',
  ])
})

test('complete Settings persist exactly and migrate the deployed Cheats-only record', () => {
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

  storage.values.set(GAME_SETTINGS_STORAGE_KEY, '{"enableCheats":true,"extra":1}')
  assert.deepEqual(readGameSettings(storage), DEFAULT_GAME_SETTINGS)
  storage.values.set(GAME_SETTINGS_STORAGE_KEY, JSON.stringify({
    ...changed,
    cameraFovPercent: 126,
  }))
  assert.deepEqual(readGameSettings(storage), DEFAULT_GAME_SETTINGS)
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

test('key rebinding swaps conflicts across fifteen native inputs and browser chat', () => {
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
  assert.deepEqual([
    gameBindingLabel('Mouse2'),
    gameBindingLabel('KeyW'),
    gameBindingLabel('Digit7'),
    gameBindingLabel('ArrowLeft'),
  ], ['Right Mouse', 'W', '7', 'Left'])
})

test('Settings drains every ported root, Controls, Performance, and context member', () => {
  for (const label of [
    'SOUND VOL:',
    'MUSIC VOL:',
    'FULLSCREEN',
    'CAMERA FOV',
    'UI SCALE',
    'CUSTOMIZE KEYBOARD',
    'TWEAK GAME',
    'SELECT PRIMARY ATTACK',
    'SELECT CONCENTRATION',
    'ENABLE CHEATS',
    'COMPLEX LIGHTING',
    'COMPLEX SHADOWS',
    'MULTIPLE SHADOWS',
    'LIGHT QUALITY',
    'CAST SECONDARY SPELLS AT MOUSE',
    'ZOOM EFFECTS',
  ]) assert.match(settingsComponent, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  for (const label of [
    'MOVE UP', 'MOVE DOWN', 'MOVE LEFT', 'MOVE RIGHT',
    'OPEN MENU', 'OPEN INVENTORY', 'OPEN SKILLS', 'OPEN CHAT',
  ]) assert.match(settingsComponent, new RegExp(label))
  assert.match(settingsComponent, /`BELT SLOT \$\{index \+ 1\}`/)
  assert.doesNotMatch(settingsComponent, /KID MODE \(STORY GAMES ONLY\)/)
  assert.doesNotMatch(settingsComponent, /SAVE MEMORY \(REQUIRES RESTART\)/)
  assert.match(settingsComponent, /ENHANCED EFFECTS: ON/)
  assert.match(mainMenuScene, /context="gameplay"/)
  assert.match(mainMenuScene, /setSettingsContext\('title'\)/)
  assert.match(mainMenuScene, /setSettingsContext\('dark-cloud'\)/)
  assert.match(darkCloudScene, /GAME SETTINGS/)
})

test('Settings presentation consumes the untouched stock ControlPanel records', () => {
  const atlas = readFileSync(new URL('../assets/game/settings-control-panel-atlas.png', import.meta.url))
  assert.equal(
    createHash('sha256').update(atlas).digest('hex'),
    'd63bd3ac402fcbc00a60916b6f0aa79f662501acc8f6fbe88ee1676e69b43f86',
  )
  assert.match(settingsCss, /background-position: -92px -46px/)
  assert.match(settingsCss, /background-position: -407px -31px/)
  assert.match(settingsCss, /background-position: -26px -45px/)
  assert.match(settingsCss, /background-position: -308px -89px/)
  assert.match(settingsCss, /background-position: -743px -588px/)
  assert.match(settingsCss, /background-position: -543px -205px/)
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
})
