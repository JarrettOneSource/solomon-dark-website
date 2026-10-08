import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import { gameAccountPresentation } from './game-account.ts'

test('game account presentation names anonymous play explicitly', () => {
  assert.deepEqual(gameAccountPresentation(null), {
    accessibleLabel: 'Not logged in',
    username: 'Not logged in',
  })
})

test('game account presentation preserves the exact Website username', () => {
  assert.deepEqual(gameAccountPresentation('Account-Smoke_7'), {
    accessibleLabel: 'Signed in as Account-Smoke_7',
    username: 'Account-Smoke_7',
  })
})


test('editor tests project the current Website account without changing the disposable wizard identity', () => {
  const editor = readFileSync(new URL('../pages/Boneyard.tsx', import.meta.url), 'utf8')
  const runtime = readFileSync(new URL('../editor/EditorTestRuntime.tsx', import.meta.url), 'utf8')
  assert.match(editor, /<EditorTestRuntime\s+accountUsername=\{user\?\.username \?\? null\}/)
  assert.match(runtime, /<MainMenuScene[\s\S]*?accountUsername=\{accountUsername\}/)
  assert.match(runtime, /profile: \{ accountUsername: null, highestWave: null, totalPlaytimeMs: 0 \}/)
  assert.match(runtime, /\}, \[doc\]\)/)
})
