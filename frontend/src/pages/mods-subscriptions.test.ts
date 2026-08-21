import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const library = await readFile(new URL('./Mods.tsx', import.meta.url), 'utf8')
const card = await readFile(new URL('../components/ModCard.tsx', import.meta.url), 'utf8')

test('Library owns the signed-in subscribed-mod shelf and unsubscribe lifecycle', () => {
  for (const label of [
    'Subscribed Mods',
    'Your collection',
    'No subscribed mods',
    'Sign in to keep a personal list of subscribed mods.',
  ]) assert.ok(library.includes(label), `missing Library copy: ${label}`)

  assert.match(library, /api\.mods\.subscriptions\.unsubscribe\(mod\.slug\)/)
  assert.match(library, /await subscriptions\.reload\(\)/)
  assert.match(library, /onUnsubscribe=\{unsubscribe\}/)
  assert.match(library, /unsubscribing=\{unsubscribing === subscription\.mod\.slug\}/)
})

test('mod cards expose a link-safe unsubscribe action without changing catalogue subscribe', () => {
  assert.match(card, /onUnsubscribe\?: \(mod: ModSummary\) => void/)
  assert.match(card, /unsubscribing \? 'Unsubscribing…' : 'Unsubscribe'/)
  assert.match(card, /subscribed \? 'Subscribed' : subscribing \? 'Subscribing…' : 'Subscribe'/)
  assert.match(card, /event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?subscriptionAction\.run\(mod\)/)
})
