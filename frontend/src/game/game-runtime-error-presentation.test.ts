import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const component = await readFile(new URL('./GameRuntimeError.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('./game-runtime-error.css', import.meta.url), 'utf8')
const page = await readFile(new URL('../pages/Game.tsx', import.meta.url), 'utf8')

test('the crash report offers Main menu without changing the disconnected report', () => {
  assert.match(
    component,
    /\{!disconnected && \(\s*<button\s+type="button"\s+className="btn btn-stone"\s+onClick=\{\(\) => window\.location\.reload\(\)\}\s*>\s*Main menu\s*<\/button>\s*\)\}/,
  )
  assert.ok(
    component.indexOf('{!disconnected && (') < component.indexOf("'Send logs to server'"),
    'the crash-only recovery action remains independent of diagnostic submission',
  )
})

test('the Game page reconstructs its ordinary title root after the crash-page restart', () => {
  assert.match(page, /<GameRuntimeError\s+diagnostics=\{diagnostics\}\s+failure=\{fatal\}\s+token=\{getToken\(\)\}/)
  assert.match(page, /<MainMenuScene[\s\S]*?initialScreen="root"/)
  assert.doesNotMatch(page, /returnToMainMenu/)
})

test('the two crash actions wrap without losing compact-screen reachability', () => {
  assert.match(
    css,
    /\.game-runtime-error-actions \{\s*display: flex;\s*flex-wrap: wrap;\s*gap: 0\.75rem;\s*justify-content: center;/,
  )
})
