import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const stylesheet = readFileSync(new URL('./main-menu.css', import.meta.url), 'utf8')

test('closed right hand keeps the native base center before discipline selection', () => {
  const baseRule = stylesheet.match(/\.create-menu-hand-layer-right\s*\{([^}]*)\}/)
  assert.ok(baseRule, 'missing right-hand base rule')
  assert.match(baseRule[1], /top:\s*23\.333333%/)
  assert.match(baseRule[1], /left:\s*55\.125%/)
  assert.doesNotMatch(
    stylesheet,
    /\.create-menu-scene\[data-phase='[^']+'\]\s+\.create-menu-hand-layer-right/,
  )
})
