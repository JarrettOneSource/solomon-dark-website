import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const library = await readFile(new URL('./Mods.tsx', import.meta.url), 'utf8')
const card = await readFile(new URL('../components/ModCard.tsx', import.meta.url), 'utf8')
const account = await readFile(new URL('./Account.tsx', import.meta.url), 'utf8')
const detail = await readFile(new URL('./ModDetail.tsx', import.meta.url), 'utf8')
const upload = await readFile(new URL('./ModUpload.tsx', import.meta.url), 'utf8')
const boneyardPublish = await readFile(
  new URL('../components/boneyard/PublishDialog.tsx', import.meta.url),
  'utf8',
)
const authenticatedImage = await readFile(
  new URL('../components/AuthenticatedImage.tsx', import.meta.url),
  'utf8',
)

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

test('authors own public, unlisted, and private visibility from upload through management', () => {
  assert.match(upload, /useState<ModVisibility>\('public'\)/)
  assert.match(upload, /form\.set\('visibility', visibility\)/)
  assert.match(boneyardPublish, /visibility,/)
  assert.match(detail, /api\.mods\.update\(mod\.slug, \{ visibility \}\)/)
  assert.match(detail, /<VisibilityEditor key=\{m\.visibility\}/)
  assert.match(account, /api\.mods\.list\(\{ mine: true, pageSize: 50, sort: 'newest' \}\)/)
  assert.match(account, /\{m\.visibility\}/)
})

test('visibility-protected screenshots load through authenticated API fetches', () => {
  assert.match(authenticatedImage, /headers\.set\('Authorization', `Bearer \$\{token\}`\)/)
  assert.match(authenticatedImage, /URL\.createObjectURL\(blob\)/)
  assert.match(card, /<AuthenticatedImage/)
  assert.match(detail, /<AuthenticatedImage src=\{p\.url\}/)
})
