import assert from 'node:assert/strict'
import test from 'node:test'

import { installGameLuaConsole } from './game-lua-console.ts'
import {
  DEFAULT_GAME_SETTINGS,
  GAME_SETTINGS_STORAGE_KEY,
  readGameSettings,
  resetGameSettingsListenersForTests,
  setGameSettings,
  type GameSettingsStorage,
} from './game-settings.ts'

class MemoryStorage implements GameSettingsStorage {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

test('Enable Cheats defaults off, persists exactly, and rejects corrupt settings', () => {
  resetGameSettingsListenersForTests()
  const storage = new MemoryStorage()
  assert.deepEqual(readGameSettings(storage), DEFAULT_GAME_SETTINGS)
  assert.deepEqual(setGameSettings({ enableCheats: true }, storage), { enableCheats: true })
  assert.deepEqual(readGameSettings(storage), { enableCheats: true })
  storage.values.set(GAME_SETTINGS_STORAGE_KEY, '{"enableCheats":true,"extra":1}')
  assert.deepEqual(readGameSettings(storage), DEFAULT_GAME_SETTINGS)
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
